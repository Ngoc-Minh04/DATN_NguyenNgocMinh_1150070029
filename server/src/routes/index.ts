import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { dlpRouter } from '../modules/security/dlp.routes.js';
import { auditRouter } from '../modules/audit/audit.routes.js';
import { commRouter } from '../modules/communication/comm.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/dlp', dlpRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/communication', commRouter);

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    system: 'Hệ thống bảo mật và kiểm soát trao đổi thông tin nội bộ',
    timestamp: new Date().toISOString(),
  });
});
