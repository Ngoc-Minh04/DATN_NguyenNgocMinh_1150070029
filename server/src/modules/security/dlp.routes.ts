import { Router, Request, Response } from 'express';
import multer from 'multer';
import { DlpService } from './dlp.service.js';
import { AuditService } from '../audit/audit.service.js';
import { authenticateJwt } from '../../middlewares/auth.middleware.js';

export const dlpRouter = Router();

// Cấu hình Multer lưu bộ nhớ tạm (MemoryStorage) để kiểm tra Magic Bytes ngay trên RAM trước khi ghi đĩa
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * 1. KIỂM TRA NỘI DUNG VĂN BẢN (POST /api/v1/dlp/inspect/text)
 */
dlpRouter.post('/inspect/text', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const { text } = req.body;

  const result = DlpService.inspectText(text || '');

  if (result.isBlocked) {
    await AuditService.recordLog({
      userId: req.user?.id,
      action: 'DLP_VIOLATION',
      status: 'BLOCKED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        type: 'TEXT_INSPECTION',
        reasons: result.reasons,
        snippet: text ? text.substring(0, 50) + '...' : '',
      },
    });
  }

  res.status(200).json({
    passed: !result.isBlocked,
    result,
  });
});

/**
 * 2. KIỂM TRA TỆP ĐÍNH KÈM QUA CHỮ KÝ TỆP (POST /api/v1/dlp/inspect/file)
 * Phát hiện tệp độc hại .exe giả danh .pdf
 */
dlpRouter.post(
  '/inspect/file',
  authenticateJwt,
  upload.single('attachment'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ message: 'Vui lòng đính kèm tệp tin để kiểm tra.' });
      return;
    }

    const { originalname, buffer, size } = req.file;
    const result = DlpService.inspectFileBuffer(buffer, originalname);

    if (result.isBlocked) {
      await AuditService.recordLog({
        userId: req.user?.id,
        action: 'DLP_VIOLATION',
        status: 'BLOCKED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          type: 'FILE_INSPECTION_MAGIC_BYTES',
          filename: originalname,
          fileSize: size,
          reasons: result.reasons,
          magicBytesDetected: buffer.subarray(0, 8).toString('hex'),
        },
      });

      res.status(403).json({
        message: 'Tệp đính kèm bị CHẶN do vi phạm chính sách an toàn thông tin.',
        filename: originalname,
        reasons: result.reasons,
      });
      return;
    }

    await AuditService.recordLog({
      userId: req.user?.id,
      action: 'FILE_UPLOAD',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { filename: originalname, fileSize: size },
    });

    res.status(200).json({
      message: 'Tệp đính kèm hợp lệ, an toàn để lưu hành.',
      filename: originalname,
      size,
    });
  }
);
