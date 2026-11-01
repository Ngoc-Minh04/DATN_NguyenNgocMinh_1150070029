import { Router, Request, Response } from 'express';
import { AuditService } from './audit.service.js';
import { authenticateJwt, requireRole } from '../../middlewares/auth.middleware.js';

export const auditRouter = Router();

/**
 * LẤY DANH SÁCH NHẬT KÝ KIỂM TOÁN (GET /api/v1/audit/logs)
 * Chỉ dành cho Quản trị viên (ADMIN) hoặc Kiểm toán viên (AUDITOR)
 */
auditRouter.get(
  '/logs',
  authenticateJwt,
  requireRole('ADMIN', 'AUDITOR'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const action = req.query.action as string | undefined;
      const status = req.query.status as string | undefined;

      const result = await AuditService.queryLogs({ page, limit, action, status });
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Lỗi truy vấn nhật ký kiểm toán.', error: error.message });
    }
  }
);
