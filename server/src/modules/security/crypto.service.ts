import crypto from 'node:crypto';

export interface HybridEncryptedData {
  encryptedContent: string;     // Base64
  encryptedSessionKey: string;  // Base64 (RSA encrypted AES key)
  iv: string;                   // Hex (12 bytes for GCM)
  authTag: string;              // Hex (16 bytes GCM auth tag)
}

export class CryptoService {
  /**
   * Sinh cặp khóa RSA-2048 cho người dùng (PKCS#8 & SPKI PEM)
   */
  public static generateRsaKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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
  public static encryptHybrid(
    plainText: string,
    recipientPublicKeyPem: string
  ): HybridEncryptedData {
    // 1. Sinh khóa phiên đối xứng ngẫu nhiên (AES 256 bits = 32 bytes) và IV (12 bytes)
    const sessionKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    // 2. Mã hóa nội dung bằng AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
    let encryptedContent = cipher.update(plainText, 'utf8', 'base64');
    encryptedContent += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // 3. Mã hóa khóa phiên AES bằng Public Key của người nhận (RSA-OAEP SHA-256)
    const encryptedSessionKeyBuffer = crypto.publicEncrypt(
      {
        key: recipientPublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      sessionKey
    );

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
  public static decryptHybrid(
    encryptedData: HybridEncryptedData,
    recipientPrivateKeyPem: string
  ): string {
    // 1. Giải mã khoá phiên AES bằng Private Key người nhận
    const sessionKey = crypto.privateDecrypt(
      {
        key: recipientPrivateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encryptedData.encryptedSessionKey, 'base64')
    );

    // 2. Giải mã nội dung bằng AES-256-GCM
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      sessionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encryptedContent, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
