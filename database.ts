import knex from "knex";
import env from "./env";
import logger from "./logger";

const database = knex({
    client: "mysql2",
    connection: {
        host: env.DB_HOST,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_DATABASE,
        charset: "utf8",
    },
    pool: {
        max: 20,
        min: 5,
        idleTimeoutMillis: 10000,
        acquireTimeoutMillis: 30000,
    },
    debug: env.NODE_ENV === "development",
    log: {
        debug: logger.debug,
        error: logger.error,
    },
});

type TransactionHandler = (transaction: knex.Knex.Transaction) => Promise<void>;

export async function safeTransaction(handler: TransactionHandler) {
    const transaction = await database.transaction();
    await handler(transaction)
        .then(() => transaction.commit())
        .catch(error => transaction.rollback().then(() => error));
}