import amqp from "amqplib";
import env from "./env";
import Joi from "joi";
import {filter, Subject} from "rxjs";

interface RabbitMqInitializer {
    assertExchange(exchange: string): Promise<void>;
    assertQueue(exchange: string, routingKey: string, queue: string): Promise<void>;
}

export interface AbstractConsumeMessage<T extends object> {
    exchange: string;
    routingKey: string;
    sourceData: object;
    data: T;
    ackMessage: () => void;
}

export interface ConsumeMessage<T extends object> extends AbstractConsumeMessage<T> {
    throwError: (err: Error) => void;
}

export interface ErrMessage<T extends object> extends AbstractConsumeMessage<T> {
    errMessage: string;
    errType: string;
    sourceExchange: string;
    sourceRoutingKey: string;
    replyData: (priority?: number) => void;
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

    async function publish(exchange: string, routingKey: string, data: object, priority?: number) {
        const json = JSON.stringify(data);
        const buffer = Buffer.from(json, "utf-8");
        publisher.publish(exchange, routingKey, buffer, { priority });
    }

    function consume<T extends object>(queue: string, prefetch: number = 200) {
        const message$ = new Subject<ConsumeMessage<T>>();

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

                async function throwError(err: Error) {
                    const errData = {
                        sourceExchange: exchange,
                        sourceRoutingKey: routingKey,
                        sourceData,
                        errType: err.constructor.name,
                        errMessage: err.message,
                    }
                    await assertQueue("error", errData.errType, "errors");
                    await publish("error", errData.errType, errData);
                }

                message$.next({
                    exchange,
                    routingKey,
                    sourceData,
                    data,
                    ackMessage,
                    throwError,
                });
            });
        }();

        return message$;
    }

    function consumeErrors<T extends object>(prefetch: number = 200) {
        const errMessage$ = new Subject<ErrMessage<T>>();

        !async function () {
            const listener = await connection.createChannel();
            await listener.prefetch(prefetch);
            await listener.consume("errors", function (message) {
                if (!message) return;
                const errMessage = JSON.parse(message.content.toString("utf-8")) as ErrMessage<T>;
                errMessage.exchange = message.fields.exchange;
                errMessage.routingKey = message.fields.routingKey;
                errMessage.data = errMessage.sourceData as T;
                errMessage.ackMessage = () => listener.ack(message);
                errMessage.replyData = (priority?: number) =>
                    publish(errMessage.sourceExchange, errMessage.sourceRoutingKey, errMessage.data, priority);
                errMessage$.next(errMessage);
            });
        }();

        return errMessage$;
    }

    return { publish, consume, consumeErrors };
}

export function assertData<T extends object>(schema: Record<string, Joi.AnySchema>) {
    return filter<ConsumeMessage<T>>(function (message) {
        try {
            message.data = Joi.attempt(message.data, Joi.object(schema), { allowUnknown: true });
            return true;
        } catch (error) {
            message.ackMessage();
            message.throwError(error);
            return false;
        }
    });
}

export function filterOrAck<T extends object>(filterByMessageData: (data: T) => boolean) {
    return filter<ConsumeMessage<T>>((message) =>
        filterByMessageData(message.data)? true : (message.ackMessage(), false)
    );
}

