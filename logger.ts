import winston from "winston";
import TransportStream from "winston-transport";
import stripAnsi from "strip-ansi";
import axios from "axios";
import datetime from "./datetime";
import env from "./env";

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
}

const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
}

winston.addColors(colors);

const format = winston.format.combine(
    winston.format.timestamp({ format: () => datetime().tz().format("YYYY-MM-DD HH:mm:ss.SSS") }),
    winston.format.colorize({ all: true }),
    winston.format.align(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message?.toString()}`)
);

const webhookTextTemplate = (info: any) =>
    stripAnsi(`${info.timestamp} ${info.level}: ${info.message?.toString()}`);

class WebhookTransport extends TransportStream {
    private readonly webhookUrl: string;

    constructor(webhookUrl: string, options?: TransportStream.TransportStreamOptions) {
        super(options);
        this.webhookUrl = webhookUrl;
    }

    log(info: any, next: () => void) {
        const that = this;
        const data = {
            "msg_type": "text",
            "content": {
                "text": webhookTextTemplate(info),
            }
        }

        axios({
            url: this.webhookUrl,
            method: "POST",
            data,
        }).then(function (){
            setImmediate(() => {
                that.emit("logged", info);
            });
        }).catch(function (error) {
            setImmediate(() => {
                that.emit("error", error);
            });
        }).finally(function () {
            next();
        });
    }
}

const transports: winston.transport[] = [];
const consoleTransport = new winston.transports.Console();
transports.push(consoleTransport);

if (env.LOGGER_WEBHOOK_URL) {
    const webhookTransport = new WebhookTransport(env.LOGGER_WEBHOOK_URL, { level: "info" });
    transports.push(webhookTransport);
}

const logger = winston.createLogger({
    level: env.LOGGER_LEVEL,
    levels,
    format,
    transports,
});

export default logger;