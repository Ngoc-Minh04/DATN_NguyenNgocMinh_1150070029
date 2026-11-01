import { Router, Request, Response } from 'express';
import { dbPool } from '../../config/db.js';
import { authenticateJwt } from '../../middlewares/auth.middleware.js';
import { DlpService } from '../security/dlp.service.js';
import { CryptoService } from '../security/crypto.service.js';
import { AuditService } from '../audit/audit.service.js';

export const commRouter = Router();

/**
 * 1. GỬI TIN NHẮN NỘI BỘ MÃ HÓA (POST /api/v1/communication/messages/send)
 * Quy trình: Kiểm tra DLP -> Mã hóa lai AES-256-GCM + RSA -> Lưu DB
 */
commRouter.post('/messages/send', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const senderId = req.user!.id;
  const { receiverId, plainContent } = req.body;

  if (!receiverId || !plainContent) {
    res.status(400).json({ message: 'Thiếu người nhận hoặc nội dung tin nhắn.' });
    return;
  }

  // BƯỚC 1: KIỂM SOÁT RÒ RỈ DỮ LIỆU (DLP)
  const dlpCheck = DlpService.inspectText(plainContent);
  if (dlpCheck.isBlocked) {
    await AuditService.recordLog({
      userId: senderId,
      action: 'DLP_VIOLATION',
      status: 'BLOCKED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        channel: 'CHAT_MESSAGE',
        receiverId,
        reasons: dlpCheck.reasons,
      },
    });

    res.status(403).json({
      message: 'Tin nhắn bị từ chối gửi do chứa thông tin nhạy cảm (DLP Blocked).',
      reasons: dlpCheck.reasons,
    });
    return;
  }

  try {
    // BƯỚC 2: LẤY PUBLIC KEY CỦA NGƯỜI NHẬN
    const receiverRes = await dbPool.query(
      `SELECT id, email, rsa_public_key FROM users WHERE id = $1;`,
      [receiverId]
    );

    if (receiverRes.rows.length === 0 || !receiverRes.rows[0].rsa_public_key) {
      res.status(404).json({ message: 'Không tìm thấy người nhận hoặc khóa công khai của người nhận.' });
      return;
    }

    const recipientPublicKey = receiverRes.rows[0].rsa_public_key;

    // BƯỚC 3: MÃ HÓA LAI (HYBRID ENCRYPTION)
    const encrypted = CryptoService.encryptHybrid(plainContent, recipientPublicKey);

    // BƯỚC 4: LƯU TRỮ VÀO CSDL (DATA AT REST LUÔN LÀ CIPHERTEXT)
    const insertRes = await dbPool.query(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_content, encrypted_session_key, iv, auth_tag)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, sender_id, receiver_id, is_read, created_at;`,
      [
        senderId,
        receiverId,
        encrypted.encryptedContent,
        encrypted.encryptedSessionKey,
        encrypted.iv,
        encrypted.authTag,
      ]
    );

    await AuditService.recordLog({
      userId: senderId,
      action: 'SEND_MESSAGE',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { receiverId, messageId: insertRes.rows[0].id },
    });

    res.status(201).json({
      message: 'Tin nhắn đã được mã hóa an toàn và gửi đi thành công.',
      messageMetadata: insertRes.rows[0],
    });
  } catch (error: any) {
    console.error('[Send Message Error]', error);
    res.status(500).json({ message: 'Lỗi mã hóa hoặc lưu trữ tin nhắn.', error: error.message });
  }
});

/**
 * 2. LẤY HỘP THƯ / DANH SÁCH TIN NHẮN (GET /api/v1/communication/messages)
 */
commRouter.get('/messages', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const result = await dbPool.query(
      `SELECT m.id, m.sender_id, m.receiver_id, m.encrypted_content, m.encrypted_session_key, 
              m.iv, m.auth_tag, m.is_read, m.created_at,
              u.email as sender_email, u.full_name as sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.receiver_id = $1
       ORDER BY m.created_at DESC;`,
      [userId]
    );

    res.status(200).json({ data: result.rows });
  } catch (error: any) {
    res.status(500).json({ message: 'Lỗi truy xuất tin nhắn.', error: error.message });
  }
});

/**
 * 3. HỖ TRỢ GIẢI MÃ TIN NHẮN CHO CLIENT (POST /api/v1/communication/messages/decrypt)
 */
commRouter.post('/messages/decrypt', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const { encryptedContent, encryptedSessionKey, iv, authTag, privateKeyPem } = req.body;

  if (!encryptedContent || !encryptedSessionKey || !iv || !authTag || !privateKeyPem) {
    res.status(400).json({ message: 'Thiếu thông số mã hóa hoặc Private Key để giải mã.' });
    return;
  }

  try {
    const plainText = CryptoService.decryptHybrid(
      { encryptedContent, encryptedSessionKey, iv, authTag },
      privateKeyPem
    );

    res.status(200).json({ plainText });
  } catch (error: any) {
    res.status(400).json({ message: 'Giải mã thất bại! Private key không hợp lệ hoặc dữ liệu bị can thiệp.', error: error.message });
  }
});
