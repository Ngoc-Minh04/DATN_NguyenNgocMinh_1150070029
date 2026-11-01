import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { ENV } from './config/env.js';
import { testDbConnection } from './config/db.js';
import { testRedisConnection } from './config/redis.js';

const httpServer = http.createServer(app);

// Cấu hình Socket.io cho liên lạc tin nhắn thời gian thực
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ENV.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client kết nối: ${socket.id}`);

  // Người dùng tham gia vào phòng chat cá nhân để nhận tin nhắn mã hóa
  socket.on('join_user_room', (userId: string) => {
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
  await testDbConnection();

  // 2. Kiểm tra kết nối Redis
  await testRedisConnection();

  // 3. Khởi động HTTP & WebSocket Server
  httpServer.listen(ENV.PORT, () => {
    console.log(`[Server Ready] Máy chủ đang lắng nghe tại: http://localhost:${ENV.PORT}`);
    console.log(`[API Base] http://localhost:${ENV.PORT}/api/v1/health`);
  });
}

bootstrap().catch((err) => {
  console.error('[Bootstrap Error] Không thể khởi động máy chủ:', err);
  process.exit(1);
});
