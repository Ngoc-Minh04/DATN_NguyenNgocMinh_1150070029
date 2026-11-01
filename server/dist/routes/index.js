"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const auth_routes_js_1 = require("../modules/auth/auth.routes.js");
const dlp_routes_js_1 = require("../modules/security/dlp.routes.js");
const audit_routes_js_1 = require("../modules/audit/audit.routes.js");
const comm_routes_js_1 = require("../modules/communication/comm.routes.js");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.use('/auth', auth_routes_js_1.authRouter);
exports.apiRouter.use('/dlp', dlp_routes_js_1.dlpRouter);
exports.apiRouter.use('/audit', audit_routes_js_1.auditRouter);
exports.apiRouter.use('/communication', comm_routes_js_1.commRouter);
// Health check endpoint
exports.apiRouter.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ONLINE',
        system: 'Hệ thống bảo mật và kiểm soát trao đổi thông tin nội bộ',
        timestamp: new Date().toISOString(),
    });
});
