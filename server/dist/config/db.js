"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbPool = void 0;
exports.testDbConnection = testDbConnection;
const pg_1 = __importDefault(require("pg"));
const env_js_1 = require("./env.js");
const { Pool } = pg_1.default;
exports.dbPool = new Pool({
    host: env_js_1.ENV.PG_HOST,
    port: env_js_1.ENV.PG_PORT,
    user: env_js_1.ENV.PG_USER,
    password: env_js_1.ENV.PG_PASSWORD,
    database: env_js_1.ENV.PG_DATABASE,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
exports.dbPool.on('error', (err) => {
    console.error('[PostgreSQL Error] Unexpected error on idle client:', err.message);
});
async function testDbConnection() {
    try {
        const client = await exports.dbPool.connect();
        const result = await client.query('SELECT NOW() as current_time');
        client.release();
        console.log(`[PostgreSQL Connected] Server time: ${result.rows[0].current_time}`);
        return true;
    }
    catch (error) {
        console.warn(`[PostgreSQL Connection Warning] Unable to connect: ${error.message}`);
        return false;
    }
}
