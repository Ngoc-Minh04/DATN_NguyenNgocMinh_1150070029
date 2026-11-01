"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRouter = void 0;
const express_1 = require("express");
const audit_service_js_1 = require("./audit.service.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
exports.auditRouter = (0, express_1.Router)();
/**
 * LẤY DANH SÁCH NHẬT KÝ KIỂM TOÁN (GET /api/v1/audit/logs)
 * Chỉ dành cho Quản trị viên (ADMIN) hoặc Kiểm toán viên (AUDITOR)
 */
exports.auditRouter.get('/logs', auth_middleware_js_1.authenticateJwt, (0, auth_middleware_js_1.requireRole)('ADMIN', 'AUDITOR'), async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const action = req.query.action;
        const status = req.query.status;
        const result = await audit_service_js_1.AuditService.queryLogs({ page, limit, action, status });
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Lỗi truy vấn nhật ký kiểm toán.', error: error.message });
    }
});
