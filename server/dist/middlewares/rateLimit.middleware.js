"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRateLimiter = exports.authRateLimiter = void 0;
const express_rate_limit_1 = require("express-rate-limit");
// Giới hạn cho các endpoint đăng nhập / xác thực nhằm chống tấn công Brute-force
exports.authRateLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10, // Tối đa 10 lần yêu cầu trong 15 phút
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Quá nhiều yêu cầu đăng nhập từ IP này. Vui lòng thử lại sau 15 phút.',
    },
});
// Giới hạn chung cho toàn bộ API
exports.apiRateLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60 * 1000, // 1 phút
    max: 120, // Tối đa 120 request / phút
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Tần suất gửi yêu cầu quá nhanh. Vui lòng chậm lại.',
    },
});
