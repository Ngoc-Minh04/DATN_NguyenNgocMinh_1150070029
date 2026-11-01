"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.ENV = {
    PORT: process.env.PORT || '5000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    // PostgreSQL
    PG_HOST: process.env.PG_HOST || 'localhost',
    PG_PORT: parseInt(process.env.PG_PORT || '5432', 10),
    PG_USER: process.env.PG_USER || 'postgres',
    PG_PASSWORD: process.env.PG_PASSWORD || 'postgres',
    PG_DATABASE: process.env.PG_DATABASE || 'secure_comms_db',
    // Redis
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
    // JWT & Security
    JWT_SECRET: process.env.JWT_SECRET || 'fallback_default_jwt_secret_key_minimum_32_chars',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
    MASTER_ENCRYPTION_KEY: process.env.MASTER_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
