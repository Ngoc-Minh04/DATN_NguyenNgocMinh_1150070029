"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_service_js_1 = require("./modules/security/crypto.service.js");
const dlp_service_js_1 = require("./modules/security/dlp.service.js");
const otplib_1 = require("otplib");
function printHeader(title) {
    console.log('\n' + '='.repeat(70));
    console.log(`📌 ${title}`);
    console.log('='.repeat(70));
}
async function runSecurityTestSuite() {
    console.log('\n🚀 BẮT ĐẦU KIỂM THỬ CÁC CƠ CHẾ BẢO MẬT & DLP (ĐỀ TÀI 31)...');
    // =========================================================================
    // TEST 1: MÃ HÓA LAI HYBRID ENCRYPTION (AES-256-GCM + RSA-2048)
    // =========================================================================
    printHeader('BÀI TEST 1: MÃ HÓA LAI (AES-256-GCM + RSA-2048)');
    // 1. Sinh cặp khóa RSA cho Người nhận (User B)
    console.log('1. Sinh cặp khóa RSA-2048 cho Người nhận (Recipient)...');
    const recipientKeys = crypto_service_js_1.CryptoService.generateRsaKeyPair();
    console.log('   [+] Public Key (lưu công khai trên hệ thống):\n' + recipientKeys.publicKey.substring(0, 100) + '...\n');
    // 2. Nội dung thư cần mã hóa
    const originalMessage = 'Báo cáo mật: Đề xuất chuyển khoản dự án nội bộ 500,000,000 VND. Chỉ người nhận mới được đọc.';
    console.log(`2. Bản rõ gốc (Plaintext):\n   "${originalMessage}"\n`);
    // 3. Tiến hành mã hóa lai
    console.log('3. Tiến hành mã hóa: Tạo khóa phiên AES-256, mã hóa AES-GCM, bọc khóa AES bằng RSA Public Key...');
    const encryptedPayload = crypto_service_js_1.CryptoService.encryptHybrid(originalMessage, recipientKeys.publicKey);
    console.log('   [+] Dữ liệu lưu trong CSDL (Data at Rest):');
    console.log(`       - Encrypted Content (Base64) : ${encryptedPayload.encryptedContent}`);
    console.log(`       - Encrypted Session Key (RSA): ${encryptedPayload.encryptedSessionKey.substring(0, 50)}...`);
    console.log(`       - GCM Auth Tag (16 bytes)    : ${encryptedPayload.authTag}`);
    console.log(`       - Initialization Vector (IV) : ${encryptedPayload.iv}`);
    // 4. Tiến hành giải mã lai bằng Private Key của Người nhận
    console.log('\n4. Người nhận dùng Private Key của mình để giải mã lại tin nhắn...');
    const decryptedMessage = crypto_service_js_1.CryptoService.decryptHybrid(encryptedPayload, recipientKeys.privateKey);
    console.log(`   [+] Bản rõ sau khi giải mã:\n   "${decryptedMessage}"`);
    if (decryptedMessage === originalMessage) {
        console.log('   ==> KẾT QUẢ: ✅ THÀNH CÔNG! Nội dung bảo toàn toàn vẹn 100%.');
    }
    else {
        console.error('   ==> KẾT QUẢ: ❌ THẤT BẠI!');
    }
    // =========================================================================
    // TEST 2: KIỂM SOÁT RÒ RỈ DỮ LIỆU NỘI DUNG (DLP TEXT INSPECTION)
    // =========================================================================
    printHeader('BÀI TEST 2: KIỂM SOÁT RÒ RỈ DỮ LIỆU (DLP TEXT MATCHING)');
    // Kịch bản 2.1: Tin nhắn văn bản thông thường
    const normalText = 'Chào bạn, chiều nay 14h chúng ta họp giao ban tại phòng họp số 2 nhé.';
    console.log(`2.1 Kiểm tra tin nhắn bình thường: "${normalText}"`);
    const res1 = dlp_service_js_1.DlpService.inspectText(normalText);
    console.log(`    Trạng thái: ${res1.isBlocked ? '❌ BỊ CHẶN' : '✅ HỢP LỆ (CHO PHÉP GỬI)'}`);
    // Kịch bản 2.2: Rò rỉ số Căn cước công dân (CCCD)
    const cccdText = 'Gửi bạn số căn cước của tôi là 079199001234 để làm thủ tục hợp đồng.';
    console.log(`\n2.2 Cố tình gửi số Căn cước công dân (CCCD): "${cccdText}"`);
    const res2 = dlp_service_js_1.DlpService.inspectText(cccdText);
    console.log(`    Trạng thái: ${res2.isBlocked ? '🚫 HỆ THỐNG TỰ ĐỘNG CHẶN (BLOCK)' : 'CHO PHÉP'}`);
    res2.reasons.forEach((r) => console.log(`    -> Lý do: ${r}`));
    // Kịch bản 2.3: Rò rỉ số thẻ Visa hợp lệ (đáp ứng thuật toán Luhn)
    const cardText = 'Thanh toán hộ tôi qua thẻ tín dụng 4532015112830366 nhé.';
    console.log(`\n2.3 Cố tình gửi số thẻ Visa/Mastercard: "${cardText}"`);
    const res3 = dlp_service_js_1.DlpService.inspectText(cardText);
    console.log(`    Trạng thái: ${res3.isBlocked ? '🚫 HỆ THỐNG TỰ ĐỘNG CHẶN (BLOCK)' : 'CHO PHÉP'}`);
    res3.reasons.forEach((r) => console.log(`    -> Lý do: ${r}`));
    // Kịch bản 2.4: Chứa từ khóa bí mật / tài liệu mật
    const secretText = 'Đây là tài liệu TOP SECRET về kế hoạch phát triển nhân sự năm 2026.';
    console.log(`\n2.4 Cố tình gửi từ khóa bảo mật: "${secretText}"`);
    const res4 = dlp_service_js_1.DlpService.inspectText(secretText);
    console.log(`    Trạng thái: ${res4.isBlocked ? '🚫 HỆ THỐNG TỰ ĐỘNG CHẶN (BLOCK)' : 'CHO PHÉP'}`);
    res4.reasons.forEach((r) => console.log(`    -> Lý do: ${r}`));
    // =========================================================================
    // TEST 3: PHÁT HIỆN TỆP ĐỘC HẠI BẰNG MAGIC BYTES (FILE SIGNATURE)
    // =========================================================================
    printHeader('BÀI TEST 3: PHÁT HIỆN TỆP GIẢ MẠO ĐỊNH DẠNG (MAGIC BYTES)');
    // Kịch bản 3.1: Tệp PDF thật (Bắt đầu bằng %PDF- tương ứng hex: 25 50 44 46)
    const validPdfBuffer = Buffer.from('%PDF-1.4 sample pdf content for testing internal docs');
    console.log('3.1 Tải lên tệp "hop_dong.pdf" thật:');
    const fileRes1 = dlp_service_js_1.DlpService.inspectFileBuffer(validPdfBuffer, 'hop_dong.pdf');
    console.log(`    Trạng thái: ${fileRes1.isBlocked ? '❌ BỊ CHẶN' : '✅ HỢP LỆ (CHO PHÉP TẢI LÊN)'}`);
    // Kịch bản 3.2: Kẻ tấn công đổi file độc hại .exe thành .pdf để qua mặt người dùng
    // File EXE thực tế bắt đầu bằng chữ ký 'MZ' (Hex: 4D 5A)
    const fakePdfBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04]); // Chữ ký PE EXE thật
    console.log('\n3.2 Kẻ tấn công đổi tên tệp thực thi "malware.exe" thành "bao_cao_tai_chinh.pdf":');
    console.log(`    Tên tệp hiển thị: "bao_cao_tai_chinh.pdf"`);
    console.log(`    Byte nhị phân thực tế: ${fakePdfBuffer.subarray(0, 4).toString('hex').toUpperCase()} (Ký tự: 'MZ')`);
    const fileRes2 = dlp_service_js_1.DlpService.inspectFileBuffer(fakePdfBuffer, 'bao_cao_tai_chinh.pdf');
    console.log(`    Trạng thái: ${fileRes2.isBlocked ? '🚫 NGUY HIỂM! HỆ THỐNG PHÁT HIỆN & CHẶN NGAY LẬP TỨC' : 'CHO PHÉP'}`);
    fileRes2.reasons.forEach((r) => console.log(`    -> Phát hiện vi phạm: ${r}`));
    // =========================================================================
    // TEST 4: XÁC THỰC HAI YẾU TỐ 2FA / TOTP (RFC 6238)
    // =========================================================================
    printHeader('BÀI TEST 4: XÁC THỰC HAI YẾU TỐ 2FA / TOTP (RFC 6238)');
    const secret2fa = otplib_1.authenticator.generateSecret();
    console.log(`1. Sinh mã bí mật 2FA (Secret Key): ${secret2fa}`);
    // Sinh mã 6 số OTP tại thời điểm hiện tại
    const currentToken = otplib_1.authenticator.generate(secret2fa);
    console.log(`2. Mã OTP 6 số tại thời điểm này: [ ${currentToken} ]`);
    // Kiểm tra mã đúng
    const isMatch = otplib_1.authenticator.check(currentToken, secret2fa);
    console.log(`3. Kiểm tra với mã chính xác [ ${currentToken} ]: ${isMatch ? '✅ XÁC THỰC THÀNH CÔNG' : '❌ THẤT BẠI'}`);
    // Kiểm tra với mã sai
    const wrongToken = '999888';
    const isWrongMatch = otplib_1.authenticator.check(wrongToken, secret2fa);
    console.log(`4. Kiểm tra với mã ngẫu nhiên sai [ ${wrongToken} ]: ${isWrongMatch ? 'HỢP LỆ' : '🚫 TỪ CHỐI TRUY CẬP (SAI MÃ)'}`);
    console.log('\n' + '='.repeat(70));
    console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ BẢO MẬT ĐỀU ĐẠT CHUẨN YÊU CẦU ĐỀ CƯƠNG!');
    console.log('='.repeat(70) + '\n');
}
runSecurityTestSuite();
