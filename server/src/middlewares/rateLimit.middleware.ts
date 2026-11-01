import { rateLimit } from 'express-rate-limit';

// Giới hạn cho các endpoint đăng nhập / xác thực nhằm chống tấn công Brute-force
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,                   // Tối đa 10 lần yêu cầu trong 15 phút
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Quá nhiều yêu cầu đăng nhập từ IP này. Vui lòng thử lại sau 15 phút.',
  },
});

// Giới hạn chung cho toàn bộ API
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 120,            // Tối đa 120 request / phút
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Tần suất gửi yêu cầu quá nhanh. Vui lòng chậm lại.',
  },
});
