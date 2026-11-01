"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dlpRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const dlp_service_js_1 = require("./dlp.service.js");
const audit_service_js_1 = require("../audit/audit.service.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
exports.dlpRouter = (0, express_1.Router)();
// Cấu hình Multer lưu bộ nhớ tạm (MemoryStorage) để kiểm tra Magic Bytes ngay trên RAM trước khi ghi đĩa
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});
/**
 * 1. KIỂM TRA NỘI DUNG VĂN BẢN (POST /api/v1/dlp/inspect/text)
 */
exports.dlpRouter.post('/inspect/text', auth_middleware_js_1.authenticateJwt, async (req, res) => {
    const { text } = req.body;
    const result = dlp_service_js_1.DlpService.inspectText(text || '');
    if (result.isBlocked) {
        await audit_service_js_1.AuditService.recordLog({
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
exports.dlpRouter.post('/inspect/file', auth_middleware_js_1.authenticateJwt, upload.single('attachment'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ message: 'Vui lòng đính kèm tệp tin để kiểm tra.' });
        return;
    }
    const { originalname, buffer, size } = req.file;
    const result = dlp_service_js_1.DlpService.inspectFileBuffer(buffer, originalname);
    if (result.isBlocked) {
        await audit_service_js_1.AuditService.recordLog({
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
    await audit_service_js_1.AuditService.recordLog({
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
});
