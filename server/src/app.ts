import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ENV } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { apiRateLimiter } from './middlewares/rateLimit.middleware.js';

export const app = express();

// 1. Cấu hình bảo mật HTTP Headers theo chuẩn OWASP với Helmet
app.use(helmet());

// 2. Cấu hình CORS
app.use(
  cors({
    origin: ENV.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// 3. Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Rate limiting toàn cục
app.use('/api', apiRateLimiter);

// 5. Gắn API Routes
app.use('/api/v1', apiRouter);

// 6. Xử lý 404 Not Found
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Đường dẫn [${req.method}] ${req.originalUrl} không tồn tại.` });
});

// 7. Xử lý lỗi toàn cục (Global Error Handler)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Lỗi hệ thống nội bộ.',
    ...(ENV.NODE_ENV === 'development' && { stack: err.stack }),
  });
});
