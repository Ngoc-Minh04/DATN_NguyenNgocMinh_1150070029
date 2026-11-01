const API_BASE = 'http://localhost:5000/api/v1';

export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return await res.json();
  } catch (error) {
    return { status: 'OFFLINE' };
  }
}

export async function inspectDlpText(text: string) {
  try {
    const res = await fetch(`${API_BASE}/dlp/inspect/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return await res.json();
  } catch (err) {
    // Client-side fallback inspection if offline
    const hasCccd = /(?:\D|^)(0\d{11})(?:\D|$)/.test(text);
    const hasCard = /\b(?:\d[ -]*?){13,16}\b/.test(text);
    const hasSecret = /CONFIDENTIAL|TOP SECRET|BẢO MẬT|TÀI LIỆU MẬT/i.test(text);
    const reasons: string[] = [];
    if (hasCccd) reasons.push('Phát hiện Căn cước công dân (CCCD) 12 chữ số.');
    if (hasCard) reasons.push('Phát hiện số thẻ thanh toán (Visa/Mastercard).');
    if (hasSecret) reasons.push('Phát hiện từ khóa mật/tài liệu nhạy cảm.');

    return {
      passed: reasons.length === 0,
      result: {
        isBlocked: reasons.length > 0,
        reasons,
      },
    };
  }
}

export async function inspectDlpFile(file: File) {
  try {
    const formData = new FormData();
    formData.append('attachment', file);
    const res = await fetch(`${API_BASE}/dlp/inspect/file`, {
      method: 'POST',
      body: formData,
    });
    return {
      status: res.status,
      data: await res.json(),
    };
  } catch (err) {
    // Client fallback check using ArrayBuffer
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 4));
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (hex.startsWith('4D5A')) {
      return {
        status: 403,
        data: {
          message: 'Tệp đính kèm bị CHẶN do vi phạm chính sách an toàn thông tin.',
          reasons: [
            'CẢNH BÁO NGUY HIỂM: Tệp chứa mã thực thi nhị phân PE/EXE (Magic bytes: 4D 5A).',
            ext !== 'exe' ? `Phát hiện hành vi giả mạo đuôi tệp: Khai báo .${ext} nhưng là file thực thi .exe` : ''
          ].filter(Boolean),
        }
      };
    }

    return {
      status: 200,
      data: { message: 'Tệp đính kèm hợp lệ, an toàn để lưu hành.', filename: file.name, size: file.size }
    };
  }
}
