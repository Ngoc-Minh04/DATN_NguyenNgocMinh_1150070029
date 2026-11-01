-- Database Schema for Secure Communication & DLP System
-- Đề tài: Nghiên cứu và xây dựng giải pháp bảo mật và kiểm soát trao đổi thông tin

-- Kích hoạt extension pgcrypto (hỗ trợ sinh UUID nếu cần)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BẢNG NGƯỜI DÙNG (USERS)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'AUDITOR')),
    
    -- Xác thực 2FA / TOTP (RFC 6238)
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    
    -- Cặp khóa RSA (Public key lưu công khai, Private key mã hóa an toàn ở client hoặc vault)
    rsa_public_key TEXT,
    
    -- Chống Brute-force & Account Lockout
    failed_attempts INT DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    locked_until TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG TIN NHẮN MÃ HÓA (MESSAGES - Hybrid Encryption AES-256-GCM + RSA)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Nội dung đã mã hóa bằng AES-256-GCM (Data at Rest Encryption)
    encrypted_content TEXT NOT NULL,
    encrypted_session_key TEXT NOT NULL, -- Khoá AES được mã hóa bằng Public Key người nhận
    iv VARCHAR(64) NOT NULL,             -- Initialization Vector
    auth_tag VARCHAR(64) NOT NULL,       -- GCM Authentication Tag để chống giả mạo cipher
    
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. BẢNG THƯ ĐIỆN TỬ MÃ HÓA (EMAILS)
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    
    -- Thân thư đã mã hóa bằng AES-256-GCM
    encrypted_body TEXT NOT NULL,
    encrypted_session_key TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    
    -- Trạng thái xác thực nguồn gốc (SPF / DKIM / DMARC verification result)
    spf_status VARCHAR(50) DEFAULT 'PASS',
    dkim_status VARCHAR(50) DEFAULT 'PASS',
    dmarc_status VARCHAR(50) DEFAULT 'PASS',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. BẢNG CHÍNH SÁCH KIỂM SOÁT NỘI DUNG (DLP RULES)
CREATE TABLE IF NOT EXISTS dlp_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('REGEX', 'KEYWORD', 'FILE_SIGNATURE')),
    pattern TEXT NOT NULL, -- Regex pattern, từ khóa, hoặc Magic Bytes (Hex)
    severity VARCHAR(20) DEFAULT 'HIGH' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    action VARCHAR(20) DEFAULT 'BLOCK' CHECK (action IN ('BLOCK', 'WARN', 'AUDIT_ONLY')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. BẢNG NHẬT KÝ KIỂM TOÁN CHỐNG CHỐI BỎ (AUDIT LOGS - Append Only)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- LOGIN, 2FA_VERIFY, SEND_MESSAGE, SEND_EMAIL, DLP_VIOLATION, FILE_UPLOAD
    status VARCHAR(20) NOT NULL, -- SUCCESS, FAILED, BLOCKED
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,               -- Thông tin bổ sung (tên file vi phạm, rule DLP bị trigger, ...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index tối ưu truy vấn bảo mật & kiểm toán
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);

-- Dữ liệu mẫu ban đầu cho bộ lọc DLP (Sample initial DLP rules)
INSERT INTO dlp_rules (name, rule_type, pattern, severity, action)
VALUES 
    ('Phát hiện Căn cước công dân (CCCD)', 'REGEX', '(?:\\D|^)(0[0-9]{11})(?:\\D|$)', 'CRITICAL', 'BLOCK'),
    ('Phát hiện Thẻ Visa / MasterCard', 'REGEX', '(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})', 'CRITICAL', 'BLOCK'),
    ('Từ khóa tài liệu mật', 'KEYWORD', 'CONFIDENTIAL,TOP_SECRET,BẢO MẬT,TÀI LIỆU MẬT', 'HIGH', 'BLOCK'),
    ('Chặn file thực thi độc hại (PE/EXE)', 'FILE_SIGNATURE', '4D5A', 'CRITICAL', 'BLOCK')
ON CONFLICT DO NOTHING;
