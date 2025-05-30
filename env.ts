import "dotenv/config";
import Joi from "joi";


interface SystemFields {
    NODE_ENV: "development" | "production" | "test";
    NODE_TIMEZONE: "Asia/Hong_Kong" | string;
    NODE_SCHEMA_EXCLUDES?: string;
}

interface LoggerFields {
    LOGGER_LEVEL: "debug" | string;
    LOGGER_WEBHOOK_URL?: string;
}

interface ServerFields {
    SERVER_PORT: number;
    SERVER_JWT_FROM: "BearerToken" | "QueryParameter";
}

interface DBFields {
    DB_HOST: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_DATABASE: string;
}

interface JwtFields {
    JWT_SECRET: string;
    JWT_REFRESH_TIME: number;
    JWT_EXPIRES: number;
}

interface MQFields {
    MQ_HOST: string;
}

interface CustomFields {

}

type Fields =
    & SystemFields
    & LoggerFields
    & ServerFields
    & DBFields
    & JwtFields
    & MQFields
    & CustomFields;


const systemSchema = {
    NODE_ENV: Joi.string().required().allow("development", "production", "test").default("development"),
    NODE_TIMEZONE: Joi.string().required().default("Asia/Hong_Kong"),
}

const loggerSchema = {
    LOGGER_LEVEL: Joi.string().required().default("debug"),
    LOGGER_WEBHOOK_URL: Joi.string(),
}

const serverSchema = {
    SERVER_PORT: Joi.number().integer().default(1234),
    SERVER_JWT_FROM: Joi.string().required().allow("BearerToken", "QueryParameter").default("BearerToken"),
}

const dbSchema = {
    DB_HOST: Joi.string().required(),
    DB_USER: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),
    DB_DATABASE: Joi.string().required(),
}

const jwtSchema = {
    JWT_SECRET: Joi.string().required().default("HelloWorld!"),
    JWT_REFRESH_TIME: Joi.number().integer().required().default(1000 * 60 * 60),
    JWT_EXPIRES: Joi.number().integer().required().default(1000 * 60 * 60 * 48),
}

const mqSchema = {
    MQ_HOST: Joi.string().required(),
}

const customSchema = {

}

const NODE_SCHEMA_EXCLUDES = Joi.attempt(process.env.NODE_ENV_EXCLUDES, Joi.string().default(""));

const schemas = new Map<string, Record<string, Joi.AnySchema>>();
schemas.set("system", systemSchema);
schemas.set("logger", loggerSchema);
schemas.set("server", serverSchema);
schemas.set("db", dbSchema);
schemas.set("jwt", jwtSchema);
schemas.set("mq", mqSchema);
schemas.set("custom", customSchema);

NODE_SCHEMA_EXCLUDES.split(",").forEach(s => schemas.delete(s));


const schema = Joi.object<Fields>(
    schemas
        .values()
        .reduce((prev, curr) => ({ ...prev, ...curr }), {})
);

const env = Joi.attempt(process.env, schema, {
    allowUnknown: true,
});

export default env;

