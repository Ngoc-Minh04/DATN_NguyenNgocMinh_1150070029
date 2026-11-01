"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../../config/db.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const dlp_service_js_1 = require("../security/dlp.service.js");
const crypto_service_js_1 = require("../security/crypto.service.js");
const audit_service_js_1 = require("../audit/audit.service.js");
exports.commRouter = (0, express_1.Router)();
/**
 * 1. GỬI TIN NHẮN NỘI BỘ MÃ HÓA (POST /api/v1/communication/messages/send)
 * Quy trình: Kiểm tra DLP -> Mã hóa lai AES-256-GCM + RSA -> Lưu DB
 */
exports.commRouter.post('/messages/send', auth_middleware_js_1.authenticateJwt, async (req, res) => {
    const senderId = req.user.id;
    const { receiverId, plainContent } = req.body;
    if (!receiverId || !plainContent) {
        res.status(400).json({ message: 'Thiếu người nhận hoặc nội dung tin nhắn.' });
        return;
    }
    // BƯỚC 1: KIỂM SOÁT RÒ RỈ DỮ LIỆU (DLP)
    const dlpCheck = dlp_service_js_1.DlpService.inspectText(plainContent);
    if (dlpCheck.isBlocked) {
        await audit_service_js_1.AuditService.recordLog({
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
        const receiverRes = await db_js_1.dbPool.query(`SELECT id, email, rsa_public_key FROM users WHERE id = $1;`, [receiverId]);
        if (receiverRes.rows.length === 0 || !receiverRes.rows[0].rsa_public_key) {
            res.status(404).json({ message: 'Không tìm thấy người nhận hoặc khóa công khai của người nhận.' });
            return;
        }
        const recipientPublicKey = receiverRes.rows[0].rsa_public_key;
        // BƯỚC 3: MÃ HÓA LAI (HYBRID ENCRYPTION)
        const encrypted = crypto_service_js_1.CryptoService.encryptHybrid(plainContent, recipientPublicKey);
        // BƯỚC 4: LƯU TRỮ VÀO CSDL (DATA AT REST LUÔN LÀ CIPHERTEXT)
        const insertRes = await db_js_1.dbPool.query(`INSERT INTO messages (sender_id, receiver_id, encrypted_content, encrypted_session_key, iv, auth_tag)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, sender_id, receiver_id, is_read, created_at;`, [
            senderId,
            receiverId,
            encrypted.encryptedContent,
            encrypted.encryptedSessionKey,
            encrypted.iv,
            encrypted.authTag,
        ]);
        await audit_service_js_1.AuditService.recordLog({
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
    }
    catch (error) {
        console.error('[Send Message Error]', error);
        res.status(500).json({ message: 'Lỗi mã hóa hoặc lưu trữ tin nhắn.', error: error.message });
    }
});
/**
 * 2. LẤY HỘP THƯ / DANH SÁCH TIN NHẮN (GET /api/v1/communication/messages)
 */
exports.commRouter.get('/messages', auth_middleware_js_1.authenticateJwt, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db_js_1.dbPool.query(`SELECT m.id, m.sender_id, m.receiver_id, m.encrypted_content, m.encrypted_session_key, 
              m.iv, m.auth_tag, m.is_read, m.created_at,
              u.email as sender_email, u.full_name as sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.receiver_id = $1
       ORDER BY m.created_at DESC;`, [userId]);
        res.status(200).json({ data: result.rows });
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi truy xuất tin nhắn.', error: error.message });
    }
});
/**
 * 3. HỖ TRỢ GIẢI MÃ TIN NHẮN CHO CLIENT (POST /api/v1/communication/messages/decrypt)
 */
exports.commRouter.post('/messages/decrypt', auth_middleware_js_1.authenticateJwt, async (req, res) => {
    const { encryptedContent, encryptedSessionKey, iv, authTag, privateKeyPem } = req.body;
    if (!encryptedContent || !encryptedSessionKey || !iv || !authTag || !privateKeyPem) {
        res.status(400).json({ message: 'Thiếu thông số mã hóa hoặc Private Key để giải mã.' });
        return;
    }
    try {
        const plainText = crypto_service_js_1.CryptoService.decryptHybrid({ encryptedContent, encryptedSessionKey, iv, authTag }, privateKeyPem);
        res.status(200).json({ plainText });
    }
    catch (error) {
        res.status(400).json({ message: 'Giải mã thất bại! Private key không hợp lệ hoặc dữ liệu bị can thiệp.', error: error.message });
    }
});
