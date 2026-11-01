"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const node_http_1 = __importDefault(require("node:http"));
const socket_io_1 = require("socket.io");
const app_js_1 = require("./app.js");
const env_js_1 = require("./config/env.js");
const db_js_1 = require("./config/db.js");
const redis_js_1 = require("./config/redis.js");
const httpServer = node_http_1.default.createServer(app_js_1.app);
// Cấu hình Socket.io cho liên lạc tin nhắn thời gian thực
exports.io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: env_js_1.ENV.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
exports.io.on('connection', (socket) => {
    console.log(`[Socket.io] Client kết nối: ${socket.id}`);
    // Người dùng tham gia vào phòng chat cá nhân để nhận tin nhắn mã hóa
    socket.on('join_user_room', (userId) => {
        if (userId) {
            socket.join(userId);
            console.log(`[Socket.io] User ${userId} đã tham gia room riêng.`);
        }
    });
    socket.on('disconnect', () => {
        console.log(`[Socket.io] Client ngắt kết nối: ${socket.id}`);
    });
});
async function bootstrap() {
    console.log('--- KHỞI ĐỘNG HỆ THỐNG BẢO MẬT VÀ TRAO ĐỔI THÔNG TIN NỘI BỘ ---');
    // 1. Kiểm tra kết nối CSDL PostgreSQL
    await (0, db_js_1.testDbConnection)();
    // 2. Kiểm tra kết nối Redis
    await (0, redis_js_1.testRedisConnection)();
    // 3. Khởi động HTTP & WebSocket Server
    httpServer.listen(env_js_1.ENV.PORT, () => {
        console.log(`[Server Ready] Máy chủ đang lắng nghe tại: http://localhost:${env_js_1.ENV.PORT}`);
        console.log(`[API Base] http://localhost:${env_js_1.ENV.PORT}/api/v1/health`);
    });
}
bootstrap().catch((err) => {
    console.error('[Bootstrap Error] Không thể khởi động máy chủ:', err);
    process.exit(1);
});
