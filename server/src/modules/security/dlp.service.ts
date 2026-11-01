export interface DlpInspectionResult {
  isBlocked: boolean;
  violationCount: number;
  reasons: string[];
}

export class DlpService {
  // Regex nhận diện Căn cước công dân (12 chữ số)
  private static readonly CCCD_REGEX = /(?:\D|^)(0\d{11})(?:\D|$)/g;

  // Regex nhận diện thẻ thanh toán Visa / Mastercard sơ bộ
  private static readonly CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

  // Danh mục từ khóa bí mật / bảo mật mặc định
  private static readonly DEFAULT_SENSITIVE_KEYWORDS = [
    'CONFIDENTIAL',
    'TOP SECRET',
    'BẢO MẬT',
    'TÀI LIỆU MẬT',
    'TUYỆT MẬT',
    'BẢNG LƯƠNG',
  ];

  /**
   * Thuật toán Luhn kiểm tra tính hợp lệ của số thẻ tín dụng
   */
  private static checkLuhn(cardNumStr: string): boolean {
    const cleanNum = cardNumStr.replace(/\D/g, '');
    if (cleanNum.length < 13 || cleanNum.length > 19) return false;

    let sum = 0;
    let shouldDouble = false;
    for (let i = cleanNum.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNum.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  /**
   * Quét nội dung văn bản (Email subject/body, tin nhắn chat)
   */
  public static inspectText(text: string, customKeywords?: string[]): DlpInspectionResult {
    const reasons: string[] = [];

    if (!text || text.trim() === '') {
      return { isBlocked: false, violationCount: 0, reasons: [] };
    }

    // 1. Quét Căn cước công dân
    const cccdMatches = [...text.matchAll(this.CCCD_REGEX)];
    if (cccdMatches.length > 0) {
      reasons.push(`Phát hiện ${cccdMatches.length} số Căn cước công dân (CCCD) nhạy cảm.`);
    }

    // 2. Quét Số thẻ ngân hàng (Regex + Luhn algorithm)
    const cardMatches = text.match(this.CREDIT_CARD_REGEX) || [];
    let validCardCount = 0;
    for (const match of cardMatches) {
      if (this.checkLuhn(match)) {
        validCardCount++;
      }
    }
    if (validCardCount > 0) {
      reasons.push(`Phát hiện ${validCardCount} số thẻ ngân hàng (Visa/Mastercard) hợp lệ.`);
    }

    // 3. Quét Từ khóa nhạy cảm
    const keywords = customKeywords || this.DEFAULT_SENSITIVE_KEYWORDS;
    const lowerText = text.toLowerCase();
    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        reasons.push(`Phát hiện từ khóa cấm/nhạy cảm: "${kw}".`);
      }
    }

    return {
      isBlocked: reasons.length > 0,
      violationCount: reasons.length,
      reasons,
    };
  }

  /**
   * Kiểm tra tệp tin dựa trên Magic Bytes / File Signature
   * Ngăn chặn việc đổi đuôi file độc hại (.exe -> .pdf)
   */
  public static inspectFileBuffer(
    buffer: Buffer,
    declaredFilename: string
  ): DlpInspectionResult {
    const reasons: string[] = [];
    const hexHeader = buffer.subarray(0, 8).toString('hex').toLowerCase();
    const ext = declaredFilename.split('.').pop()?.toLowerCase() || '';

    // 1. Nhận diện file thực thi Windows PE / DOS (.exe, .dll, .sys)
    // Magic Bytes: 4D 5A (MZ)
    const isExecutable = hexHeader.startsWith('4d5a');

    if (isExecutable) {
      reasons.push(
        `CẢNH BÁO NGUY HIỂM: Tệp chứa mã thực thi nhị phân PE/EXE (Magic bytes: 4D 5A).`
      );
      if (ext !== 'exe') {
        reasons.push(
          `Phát hiện hành vi giả mạo đuôi tệp: Khai báo là .${ext} nhưng thực chất là tệp thực thi độc hại.`
        );
      }
    }

    // 2. Kiểm tra tính xác thực của file PDF (phải bắt đầu bằng %PDF- = 25 50 44 46)
    if (ext === 'pdf' && !hexHeader.startsWith('25504446')) {
      reasons.push(
        `Định dạng tệp không khớp chữ ký PDF thực tế (Magic bytes khác %PDF-).`
      );
    }

    return {
      isBlocked: reasons.length > 0,
      violationCount: reasons.length,
      reasons,
    };
  }
}
