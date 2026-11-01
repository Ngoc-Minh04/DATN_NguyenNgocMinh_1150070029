"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const env_js_1 = require("./config/env.js");
const index_js_1 = require("./routes/index.js");
const rateLimit_middleware_js_1 = require("./middlewares/rateLimit.middleware.js");
exports.app = (0, express_1.default)();
// 1. Cấu hình bảo mật HTTP Headers theo chuẩn OWASP với Helmet
exports.app.use((0, helmet_1.default)());
// 2. Cấu hình CORS
exports.app.use((0, cors_1.default)({
    origin: env_js_1.ENV.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
// 3. Body parsers
exports.app.use(express_1.default.json({ limit: '10mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// 4. Rate limiting toàn cục
exports.app.use('/api', rateLimit_middleware_js_1.apiRateLimiter);
// 5. Gắn API Routes
exports.app.use('/api/v1', index_js_1.apiRouter);
// 6. Xử lý 404 Not Found
exports.app.use((req, res) => {
    res.status(404).json({ message: `Đường dẫn [${req.method}] ${req.originalUrl} không tồn tại.` });
});
// 7. Xử lý lỗi toàn cục (Global Error Handler)
exports.app.use((err, req, res, next) => {
    console.error('[Unhandled Server Error]', err);
    res.status(err.status || 500).json({
        message: err.message || 'Lỗi hệ thống nội bộ.',
        ...(env_js_1.ENV.NODE_ENV === 'development' && { stack: err.stack }),
    });
});
