"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const argon2_1 = __importDefault(require("argon2"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const db_js_1 = require("../../config/db.js");
const env_js_1 = require("../../config/env.js");
const crypto_service_js_1 = require("../security/crypto.service.js");
const audit_service_js_1 = require("../audit/audit.service.js");
const rateLimit_middleware_js_1 = require("../../middlewares/rateLimit.middleware.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
exports.authRouter = (0, express_1.Router)();
/**
 * 1. ĐĂNG KÝ TÀI KHOẢN (POST /api/v1/auth/register)
 * Tự động băm mật khẩu bằng Argon2id và tạo cặp khóa RSA cho người dùng
 */
exports.authRouter.post('/register', rateLimit_middleware_js_1.authRateLimiter, async (req, res) => {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName) {
        res.status(400).json({ message: 'Vui lòng điền đầy đủ Email, Mật khẩu và Họ tên.' });
        return;
    }
    try {
        // 1. Kiểm tra tài khoản đã tồn tại chưa
        const existing = await db_js_1.dbPool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            res.status(409).json({ message: 'Email này đã được đăng ký trong hệ thống.' });
            return;
        }
        // 2. Băm mật khẩu bằng Argon2id (Chuẩn NIST khuyến nghị)
        const passwordHash = await argon2_1.default.hash(password, { type: argon2_1.default.argon2id });
        // 3. Tự động sinh cặp khóa RSA-2048 cho người dùng phục vụ mã hóa lai
        const { publicKey, privateKey } = crypto_service_js_1.CryptoService.generateRsaKeyPair();
        const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'USER';
        const insertResult = await db_js_1.dbPool.query(`INSERT INTO users (email, password_hash, full_name, role, rsa_public_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, rsa_public_key, created_at;`, [email, passwordHash, fullName, assignedRole, publicKey]);
        const newUser = insertResult.rows[0];
        // Ghi Audit Log
        await audit_service_js_1.AuditService.recordLog({
            userId: newUser.id,
            action: 'LOGIN',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { message: 'Đăng ký tài khoản mới thành công' },
        });
        res.status(201).json({
            message: 'Đăng ký tài khoản thành công.',
            user: newUser,
            // Cung cấp Private Key cho client lưu trữ an toàn (chỉ sinh 1 lần)
            privateKeyPem: privateKey,
        });
    }
    catch (error) {
        console.error('[Register Error]', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi tạo tài khoản.', error: error.message });
    }
});
/**
 * 2. ĐĂNG NHẬP (POST /api/v1/auth/login)
 * Kiểm tra tài khoản bị khóa (Account Lockout) và yêu cầu xác thực 2FA nếu có
 */
exports.authRouter.post('/login', rateLimit_middleware_js_1.authRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu.' });
        return;
    }
    try {
        const result = await db_js_1.dbPool.query(`SELECT id, email, password_hash, full_name, role, is_locked, failed_attempts, two_factor_enabled
       FROM users WHERE email = $1;`, [email]);
        if (result.rows.length === 0) {
            res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
            return;
        }
        const user = result.rows[0];
        // 1. Kiểm tra tài khoản có đang bị khóa do nhập sai quá 5 lần hay không
        if (user.is_locked) {
            await audit_service_js_1.AuditService.recordLog({
                userId: user.id,
                action: 'ACCOUNT_LOCKED',
                status: 'BLOCKED',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { email, message: 'Đăng nhập vào tài khoản đang bị khóa' },
            });
            res.status(403).json({
                message: 'Tài khoản đã bị tạm khóa do nhập sai mật khẩu quá 5 lần. Hãy liên hệ Quản trị viên.',
            });
            return;
        }
        // 2. Xác thực mật khẩu Argon2
        const isPasswordValid = await argon2_1.default.verify(user.password_hash, password);
        if (!isPasswordValid) {
            const updatedAttempts = user.failed_attempts + 1;
            const shouldLock = updatedAttempts >= 5;
            await db_js_1.dbPool.query(`UPDATE users SET failed_attempts = $1, is_locked = $2 WHERE id = $3;`, [updatedAttempts, shouldLock, user.id]);
            await audit_service_js_1.AuditService.recordLog({
                userId: user.id,
                action: 'LOGIN',
                status: 'FAILED',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { failedAttempts: updatedAttempts, isLockedNow: shouldLock },
            });
            res.status(401).json({
                message: shouldLock
                    ? 'Bạn đã nhập sai 5 lần! Tài khoản của bạn đã bị khóa để phòng chống tấn công dò mật khẩu.'
                    : `Mật khẩu không chính xác (Đã sai ${updatedAttempts}/5 lần).`,
            });
            return;
        }
        // Đặt lại số lần nhập sai sau khi nhập đúng
        await db_js_1.dbPool.query(`UPDATE users SET failed_attempts = 0 WHERE id = $1;`, [user.id]);
        // 3. Nếu bật 2FA, trả về cờ yêu cầu mã 2FA
        if (user.two_factor_enabled) {
            // Cấp token tạm thời chỉ có hiệu lực 5 phút để xác thực bước 2FA
            const tempToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, step: '2FA_PENDING' }, env_js_1.ENV.JWT_SECRET, { expiresIn: '5m' });
            res.status(200).json({
                requires2FA: true,
                tempToken,
                message: 'Mật khẩu chính xác. Vui lòng cung cấp mã xác thực 2FA (OTP).',
            });
            return;
        }
        // 4. Nếu không bật 2FA, cấp JWT token chính thức
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, env_js_1.ENV.JWT_SECRET, { expiresIn: env_js_1.ENV.JWT_EXPIRES_IN });
        await audit_service_js_1.AuditService.recordLog({
            userId: user.id,
            action: 'LOGIN',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { role: user.role },
        });
        res.status(200).json({
            requires2FA: false,
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('[Login Error]', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập.', error: error.message });
    }
});
/**
 * 3. BẬT XÁC THỰC 2 YẾU TỐ 2FA / TOTP (GET /api/v1/auth/2fa/setup)
 */
exports.authRouter.get('/2fa/setup', auth_middleware_js_1.authenticateJwt, async (req, res) => {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const secret = otplib_1.authenticator.generateSecret();
    const otpauth = otplib_1.authenticator.keyuri(userEmail, 'SecureCommsInternal', secret);
    try {
        const qrCodeImageUrl = await qrcode_1.default.toDataURL(otpauth);
        // Lưu tạm secret vào DB (chờ xác nhận)
        await db_js_1.dbPool.query(`UPDATE users SET two_factor_secret = $1 WHERE id = $2;`, [secret, userId]);
        res.status(200).json({
            secret,
            qrCode: qrCodeImageUrl,
            message: 'Quét mã QR bằng ứng dụng Google Authenticator và nhập mã 6 số để kích hoạt.',
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Không thể sinh mã QR 2FA.', error: error.message });
    }
});
/**
 * 4. XÁC MINH VÀ KÍCH HOẠT 2FA HOẶC HOÀN TẤT ĐĂNG NHẬP BƯỚC 2 (POST /api/v1/auth/2fa/verify)
 */
exports.authRouter.post('/2fa/verify', async (req, res) => {
    const { code, tempToken } = req.body;
    if (!code || !tempToken) {
        res.status(400).json({ message: 'Thiếu mã 6 số OTP hoặc token phiên tạm thời.' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(tempToken, env_js_1.ENV.JWT_SECRET);
        const userId = decoded.id;
        const userRes = await db_js_1.dbPool.query(`SELECT id, email, role, two_factor_secret FROM users WHERE id = $1;`, [userId]);
        if (userRes.rows.length === 0 || !userRes.rows[0].two_factor_secret) {
            res.status(400).json({ message: 'Không tìm thấy cấu hình 2FA cho tài khoản này.' });
            return;
        }
        const user = userRes.rows[0];
        const isValid = otplib_1.authenticator.check(code, user.two_factor_secret);
        if (!isValid) {
            await audit_service_js_1.AuditService.recordLog({
                userId: user.id,
                action: '2FA_VERIFY',
                status: 'FAILED',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { message: 'Mã xác thực 2FA OTP không đúng' },
            });
            res.status(400).json({ message: 'Mã xác thực 2FA không chính xác hoặc đã hết hạn.' });
            return;
        }
        // Kích hoạt chính thức cờ 2FA
        await db_js_1.dbPool.query(`UPDATE users SET two_factor_enabled = TRUE WHERE id = $1;`, [user.id]);
        // Cấp JWT Token chính thức
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, env_js_1.ENV.JWT_SECRET, { expiresIn: env_js_1.ENV.JWT_EXPIRES_IN });
        await audit_service_js_1.AuditService.recordLog({
            userId: user.id,
            action: '2FA_VERIFY',
            status: 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
        res.status(200).json({
            message: 'Xác thực 2FA thành công!',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        res.status(401).json({ message: 'Phiên xác thực đã hết hạn, vui lòng đăng nhập lại.', error: error.message });
    }
});
