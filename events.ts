import amqp from "amqplib";
import env from "./env";
import Joi from "joi";
import {filter, Subject} from "rxjs";

interface RabbitMqInitializer {
    assertExchange(exchange: string): Promise<void>;
    assertQueue(exchange: string, routingKey: string, queue: string): Promise<void>;
}

interface SubscriberMessage<T> {
    exchange: string;
    routingKey: string;
    queue: string;
    sourceData: object;
    data: T;
    ackMessage: () => void;
}

export async function connect(onConnected: (init: RabbitMqInitializer) => Promise<void>) {
    const connection = await amqp.connect(env.MQ_HOST);
    const publisher = await connection.createChannel();

    async function assertExchange(exchange: string) {
        await publisher.assertExchange(exchange, "topic", { durable: true });
    }

    async function assertQueue(exchange: string, routingKey: string, queue: string) {
        await publisher.assertExchange(exchange, "topic", { durable: true });
        await publisher.assertQueue(queue, { durable: true });
        await publisher.bindQueue(queue, exchange, routingKey);
    }

    await onConnected({ assertExchange, assertQueue });

    function publish(exchange: string, routingKey: string, data: object, priority?: number) {
        const json = JSON.stringify(data);
        const buffer = Buffer.from(json, "utf-8");
        return publisher.publish(exchange, routingKey, buffer, { priority });
    }

    function consume<T>(queue: string, prefetch: number = 200) {
        const message$ = new Subject<SubscriberMessage<T>>();

        !async function () {
            const listener = await connection.createChannel();
            await listener.prefetch(prefetch);
            await listener.consume(queue, function (message) {
                if (!message) return;
                const exchange = message.fields.exchange;
                const routingKey = message.fields.routingKey;
                const sourceData = JSON.parse(message.content.toString("utf-8"));
                const data = sourceData as T;
                const ackMessage = () => listener.ack(message);

                message$.next({
                    exchange,
                    routingKey,
                    queue,
                    sourceData,
                    data,
                    ackMessage,
                });
            });
        }();

        return message$;
    }

    return { publish, consume };
}

export function filterOrAck<T>(filterByMessageData: (data: T) => boolean) {
    return filter<SubscriberMessage<T>>((message) =>
        filterByMessageData(message.data)? true : (message.ackMessage(), false)
    );
}

export type ErrorHandler = <T>(error: Error, message: SubscriberMessage<T>) => void;

export function attemptMessageData<T>(schema: Record<string, Joi.AnySchema>, onError: ErrorHandler) {
    return filter<SubscriberMessage<T>>(function (message) {
        try {
            message.data = Joi.attempt(message.data, Joi.object(schema), { allowUnknown: true });
            return true;
        } catch (error) {
            message.ackMessage();
            onError(error, message);
            return false;
        }
    });
}