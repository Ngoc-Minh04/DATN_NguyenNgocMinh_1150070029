"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
class CryptoService {
    /**
     * Sinh cặp khóa RSA-2048 cho người dùng (PKCS#8 & SPKI PEM)
     */
    static generateRsaKeyPair() {
        const { publicKey, privateKey } = node_crypto_1.default.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
            },
        });
        return { publicKey, privateKey };
    }
    /**
     * Mã hóa lai (Hybrid Encryption): AES-256-GCM + RSA-OAEP
     * Dùng mã hóa nội dung tin nhắn hoặc thư trước khi lưu trữ vào Database (Data at Rest)
     */
    static encryptHybrid(plainText, recipientPublicKeyPem) {
        // 1. Sinh khóa phiên đối xứng ngẫu nhiên (AES 256 bits = 32 bytes) và IV (12 bytes)
        const sessionKey = node_crypto_1.default.randomBytes(32);
        const iv = node_crypto_1.default.randomBytes(12);
        // 2. Mã hóa nội dung bằng AES-256-GCM
        const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', sessionKey, iv);
        let encryptedContent = cipher.update(plainText, 'utf8', 'base64');
        encryptedContent += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        // 3. Mã hóa khóa phiên AES bằng Public Key của người nhận (RSA-OAEP SHA-256)
        const encryptedSessionKeyBuffer = node_crypto_1.default.publicEncrypt({
            key: recipientPublicKeyPem,
            padding: node_crypto_1.default.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        }, sessionKey);
        return {
            encryptedContent,
            encryptedSessionKey: encryptedSessionKeyBuffer.toString('base64'),
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
        };
    }
    /**
     * Giải mã lai (Hybrid Decryption)
     * Sử dụng Private Key của người nhận để mở khoá phiên AES, sau đó giải mã nội dung
     */
    static decryptHybrid(encryptedData, recipientPrivateKeyPem) {
        // 1. Giải mã khoá phiên AES bằng Private Key người nhận
        const sessionKey = node_crypto_1.default.privateDecrypt({
            key: recipientPrivateKeyPem,
            padding: node_crypto_1.default.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        }, Buffer.from(encryptedData.encryptedSessionKey, 'base64'));
        // 2. Giải mã nội dung bằng AES-256-GCM
        const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', sessionKey, Buffer.from(encryptedData.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        let decrypted = decipher.update(encryptedData.encryptedContent, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
exports.CryptoService = CryptoService;
