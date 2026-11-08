import argon2 from 'argon2';
import { authenticator } from 'otplib';
import { dbPool } from '../config/db.js';
import { CryptoService } from '../modules/security/crypto.service.js';

async function seedDatabase() {
  console.log('🌱 BẮT ĐẦU SEED DỮ LIỆU MẪU CHO HỆ THỐNG...');

  try {
    // 1. Dọn dẹp dữ liệu cũ (nếu có)
    await dbPool.query('DELETE FROM audit_logs;');
    await dbPool.query('DELETE FROM emails;');
    await dbPool.query('DELETE FROM messages;');
    await dbPool.query('DELETE FROM users;');
    console.log('   [+] Đã làm sạch các bảng dữ liệu cũ.');

    // 2. Tạo danh sách người dùng với mật khẩu băm Argon2id và cặp khóa RSA
    const defaultPassword = 'Password@123';
    const passwordHash = await argon2.hash(defaultPassword, { type: argon2.argon2id });

    // Sinh khóa RSA cho từng người dùng
    const adminKeys = CryptoService.generateRsaKeyPair();
    const auditorKeys = CryptoService.generateRsaKeyPair();
    const minhKeys = CryptoService.generateRsaKeyPair();
    const maiKeys = CryptoService.generateRsaKeyPair();

    const usersData = [
      {
        email: 'admin@security.internal',
        fullName: 'Quản Trị Viên Hệ Thống',
        role: 'ADMIN',
        rsaPublicKey: adminKeys.publicKey,
        twoFactorSecret: authenticator.generateSecret(),
        twoFactorEnabled: true,
      },
      {
        email: 'auditor@security.internal',
        fullName: 'Chuyên Viên Kiểm Toán An Ninh',
        role: 'AUDITOR',
        rsaPublicKey: auditorKeys.publicKey,
        twoFactorSecret: authenticator.generateSecret(),
        twoFactorEnabled: true,
      },
      {
        email: 'minh.nn@security.internal',
        fullName: 'Nguyễn Ngọc Minh',
        role: 'USER',
        rsaPublicKey: minhKeys.publicKey,
        twoFactorSecret: authenticator.generateSecret(),
        twoFactorEnabled: true,
      },
      {
        email: 'mai.tt@security.internal',
        fullName: 'Trần Thị Mai (Kế Toán)',
        role: 'USER',
        rsaPublicKey: maiKeys.publicKey,
        twoFactorSecret: authenticator.generateSecret(),
        twoFactorEnabled: false,
      },
    ];

    const insertedUsers: Record<string, string> = {};

    for (const u of usersData) {
      const res = await dbPool.query(
        `INSERT INTO users (email, password_hash, full_name, role, rsa_public_key, two_factor_secret, two_factor_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, full_name;`,
        [u.email, passwordHash, u.fullName, u.role, u.rsaPublicKey, u.twoFactorSecret, u.twoFactorEnabled]
      );
      insertedUsers[u.email] = res.rows[0].id;
      console.log(`   [+] Đã tạo user: ${u.fullName} (${u.email}) [Role: ${u.role}]`);
    }

    const minhId = insertedUsers['minh.nn@security.internal'];
    const maiId = insertedUsers['mai.tt@security.internal'];
    const adminId = insertedUsers['admin@security.internal'];

    // 3. Tạo tin nhắn trao đổi mẫu (Mã hóa lai AES-256-GCM + RSA)
    const msg1Plain = 'Chào anh Minh, anh gửi giúp em bảng dự toán chi phí máy chủ và chứng chỉ SSL nội bộ nhé.';
    const enc1 = CryptoService.encryptHybrid(msg1Plain, minhKeys.publicKey);

    await dbPool.query(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_content, encrypted_session_key, iv, auth_tag, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [maiId, minhId, enc1.encryptedContent, enc1.encryptedSessionKey, enc1.iv, enc1.authTag, true]
    );

    const msg2Plain = 'Chào chị Mai, tôi đã duyệt và gửi file dự toán chi phí máy chủ quý 4 cho phòng kế toán rồi nhé.';
    const enc2 = CryptoService.encryptHybrid(msg2Plain, maiKeys.publicKey);

    await dbPool.query(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_content, encrypted_session_key, iv, auth_tag, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [minhId, maiId, enc2.encryptedContent, enc2.encryptedSessionKey, enc2.iv, enc2.authTag, false]
    );
    console.log('   [+] Đã tạo các tin nhắn nội bộ mã hóa lai (AES-256-GCM + RSA).');

    // 4. Tạo thư điện tử mã hóa mẫu
    const emailPlain = 'Kính gửi Ban Giám Đốc, báo cáo kết quả rà soát phân hệ mã hóa lai và phát hiện DLP quý 4/2026.';
    const encEmail = CryptoService.encryptHybrid(emailPlain, adminKeys.publicKey);

    await dbPool.query(
      `INSERT INTO emails (sender_id, recipient_email, subject, encrypted_body, encrypted_session_key, iv, auth_tag, spf_status, dkim_status, dmarc_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
      [minhId, 'giamdoc@security.internal', 'Báo cáo kiểm soát trao đổi thông tin Q4/2026', encEmail.encryptedContent, encEmail.encryptedSessionKey, encEmail.iv, encEmail.authTag, 'PASS', 'PASS', 'PASS']
    );
    console.log('   [+] Đã tạo thư điện tử bảo mật mã hóa kèm xác thực SPF/DKIM/DMARC.');

    // 5. Tạo nhật ký kiểm toán Audit Logs (Append-only)
    const auditEvents = [
      {
        userId: adminId,
        action: 'LOGIN',
        status: 'SUCCESS',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        details: { method: 'PASSWORD_ARGON2ID', note: 'Đăng nhập thành công' },
      },
      {
        userId: adminId,
        action: '2FA_VERIFY',
        status: 'SUCCESS',
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        details: { method: 'TOTP_RFC6238', result: 'Xác thực OTP hợp lệ' },
      },
      {
        userId: maiId,
        action: 'DLP_VIOLATION',
        status: 'BLOCKED',
        ip: '192.168.1.25',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        details: {
          channel: 'CHAT_MESSAGE',
          reasons: ['Phát hiện số Căn cước công dân (CCCD) nhạy cảm: 079199001234'],
          policy: 'BLOCK_IMMEDIATELY',
        },
      },
      {
        userId: minhId,
        action: 'FILE_UPLOAD',
        status: 'BLOCKED',
        ip: '192.168.1.33',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        details: {
          filename: 'bao_cao_tai_chinh.pdf',
          magicBytes: '4D5A (PE/EXE)',
          reasons: ['Cảnh báo tệp thực thi độc hại giả mạo phần mở rộng file .pdf'],
        },
      },
      {
        userId: minhId,
        action: 'SEND_MESSAGE',
        status: 'SUCCESS',
        ip: '192.168.1.33',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        details: {
          receiver: 'mai.tt@security.internal',
          encryption: 'AES-256-GCM + RSA-OAEP',
        },
      },
    ];

    for (const a of auditEvents) {
      await dbPool.query(
        `INSERT INTO audit_logs (user_id, action, status, ip_address, user_agent, details)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [a.userId, a.action, a.status, a.ip, a.userAgent, JSON.stringify(a.details)]
      );
    }
    console.log('   [+] Đã tạo nhật ký kiểm toán chống chối bỏ (Audit Logs).');

    console.log('\n=============================================================');
    console.log('🎉 SEED DỮ LIỆU MẪU THÀNH CÔNG VÀO CSDL POSTGRESQL!');
    console.log('=============================================================');
    console.log('📌 TÀI KHOẢN MẪU ĐỂ ĐĂNG NHẬP THỬ NGHIỆM:');
    console.log('   1. Quản trị viên : admin@security.internal     | Mật khẩu: Password@123');
    console.log('   2. Kiểm toán viên: auditor@security.internal   | Mật khẩu: Password@123');
    console.log('   3. Sinh viên     : minh.nn@security.internal   | Mật khẩu: Password@123');
    console.log('   4. Kế toán       : mai.tt@security.internal    | Mật khẩu: Password@123');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('❌ Lỗi trong quá trình Seed CSDL:', err);
  } finally {
    await dbPool.end();
  }
}

seedDatabase();
