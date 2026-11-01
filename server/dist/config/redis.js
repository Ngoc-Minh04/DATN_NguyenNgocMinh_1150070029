"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
exports.testRedisConnection = testRedisConnection;
const ioredis_1 = __importDefault(require("ioredis"));
const env_js_1 = require("./env.js");
exports.redisClient = new ioredis_1.default({
    host: env_js_1.ENV.REDIS_HOST,
    port: env_js_1.ENV.REDIS_PORT,
    password: env_js_1.ENV.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
        if (times > 3) {
            return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 1000, 3000);
    },
});
exports.redisClient.on('connect', () => {
    console.log('[Redis Connected] Successfully connected to Redis instance.');
});
exports.redisClient.on('error', (err) => {
    console.warn(`[Redis Connection Warning] ${err.message}`);
});
async function testRedisConnection() {
    try {
        await exports.redisClient.connect();
        const pong = await exports.redisClient.ping();
        return pong === 'PONG';
    }
    catch (err) {
        console.warn(`[Redis Connect Fallback] Continuing without active Redis cache: ${err.message}`);
        return false;
    }
}
