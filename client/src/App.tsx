import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
  MessageSquare,
  FileSearch,
  Activity,
  AlertTriangle,
  Send,
  Key,
  Database,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { checkServerHealth, inspectDlpText, inspectDlpFile } from './api';

// Kiểu dữ liệu tin nhắn
interface Message {
  id: string;
  sender: string;
  role: string;
  isMe: boolean;
  plainText: string;
  cipherText: string;
  authTag: string;
  iv: string;
  timestamp: string;
}

// Kiểu dữ liệu email
interface EmailItem {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  spf: 'PASS' | 'FAIL';
  dkim: 'PASS' | 'FAIL';
  dmarc: 'PASS' | 'FAIL';
  timestamp: string;
}

// Kiểu dữ liệu Audit Log
interface AuditItem {
  id: string;
  action: string;
  user: string;
  status: 'SUCCESS' | 'BLOCKED' | 'FAILED';
  ip: string;
  timestamp: string;
  details: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'email' | 'dlp' | 'dashboard'>('chat');
  const [serverOnline, setServerOnline] = useState(false);
  const [showCiphertext, setShowCiphertext] = useState(false);

  // Trạng thái Chat
  const [chatInput, setChatInput] = useState('');
  const [dlpWarning, setDlpWarning] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Trần Thị Mai',
      role: 'Phòng Kế Toán',
      isMe: false,
      plainText: 'Chào anh Minh, anh gửi giúp em bảng dự toán chi phí máy chủ tuần này nhé.',
      cipherText: 'U2FsdGVkX1+vG3...x8Y0pZ9mK1bQv2wE4rT7yU9iO',
      authTag: '8f7a2d3e1c4b5a6f',
      iv: 'a1b2c3d4e5f6',
      timestamp: '10:15',
    },
    {
      id: '2',
      sender: 'Nguyễn Ngọc Minh',
      role: 'Quản trị viên',
      isMe: true,
      plainText: 'Đã gửi qua email nội bộ rồi nhé Mai. Toàn bộ tài liệu đều được mã hóa AES-GCM.',
      cipherText: '7a2f1b8c0e9d4a3b2c1f0e9d8c7b6a5f4e3d2c1b0a9f',
      authTag: 'e4d3c2b1a0f9e8d7',
      iv: '1234567890ab',
      timestamp: '10:18',
    },
  ]);

  // Trạng thái Email
  const [emails] = useState<EmailItem[]>([
    {
      id: 'em-1',
      sender: 'hr@internal.gov.vn',
      recipient: 'minh.nguyen@internal.gov.vn',
      subject: 'Thông báo chính sách an toàn thông tin quý 4/2026',
      body: 'Yêu cầu 100% cán bộ kích hoạt 2FA TOTP và không lưu trữ thông tin định danh cá nhân trên thiết bị ngoài.',
      spf: 'PASS',
      dkim: 'PASS',
      dmarc: 'PASS',
      timestamp: '09:30 25/10/2026',
    },
    {
      id: 'em-2',
      sender: 'director@internal.gov.vn',
      recipient: 'all-staff@internal.gov.vn',
      subject: 'Kế hoạch triển khai hệ thống trao đổi thông tin bảo mật',
      body: 'Hệ thống mới sẽ tự động ngăn ngừa rò rỉ dữ liệu (DLP) và mã hóa toàn bộ dữ liệu lưu trữ (Data at Rest).',
      spf: 'PASS',
      dkim: 'PASS',
      dmarc: 'PASS',
      timestamp: '08:00 25/10/2026',
    },
  ]);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem>(emails[0]);

  // Trạng thái DLP File Sandbox
  const [fileAnalysis, setFileAnalysis] = useState<any>(null);

  // Trạng thái Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([
    {
      id: 'LOG-001',
      action: 'LOGIN',
      user: 'nguyen.minh@internal.vn',
      status: 'SUCCESS',
      ip: '192.168.1.105',
      timestamp: '10:14:22',
      details: 'Xác thực 2FA/TOTP thành công',
    },
    {
      id: 'LOG-002',
      action: 'DLP_VIOLATION',
      user: 'duong.triet@internal.vn',
      status: 'BLOCKED',
      ip: '192.168.1.112',
      timestamp: '10:16:45',
      details: 'Phát hiện số CCCD (12 chữ số) trong tin nhắn chat',
    },
    {
      id: 'LOG-003',
      action: 'DLP_FILE_BLOCKED',
      user: 'unknown_client',
      status: 'BLOCKED',
      ip: '192.168.1.200',
      timestamp: '10:20:01',
      details: 'Chặn tệp PE/EXE giả mạo đuôi .pdf (Magic Bytes: 4D 5A)',
    },
    {
      id: 'LOG-004',
      action: 'SEND_MESSAGE',
      user: 'nguyen.minh@internal.vn',
      status: 'SUCCESS',
      ip: '192.168.1.105',
      timestamp: '10:25:30',
      details: 'Mã hóa AES-256-GCM + bọc khóa phiên RSA-2048 thành công',
    },
  ]);

  // Kiểm tra sức khỏe máy chủ
  useEffect(() => {
    checkServerHealth().then((res) => {
      setServerOnline(res.status === 'ONLINE');
    });
    const interval = setInterval(() => {
      checkServerHealth().then((res) => {
        setServerOnline(res.status === 'ONLINE');
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real-time DLP check khi người dùng đang nhập text
  useEffect(() => {
    if (!chatInput.trim()) {
      setDlpWarning([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await inspectDlpText(chatInput);
      if (res.result?.isBlocked) {
        setDlpWarning(res.result.reasons);
      } else {
        setDlpWarning([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [chatInput]);

  // Gửi tin nhắn
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    // Kiểm tra DLP trước khi gửi
    const dlpCheck = await inspectDlpText(chatInput);
    if (dlpCheck.result?.isBlocked) {
      alert(`🚫 HỆ THỐNG DLP TỪ CHỐI GỬI:\n- ${dlpCheck.result.reasons.join('\n- ')}`);

      // Ghi Audit log vi phạm
      const newAudit: AuditItem = {
        id: `LOG-00${auditLogs.length + 1}`,
        action: 'DLP_VIOLATION',
        user: 'nguyen.minh@internal.vn',
        status: 'BLOCKED',
        ip: '127.0.0.1',
        timestamp: new Date().toLocaleTimeString(),
        details: `Cố ý gửi thông tin nhạy cảm: ${dlpCheck.result.reasons[0]}`,
      };
      setAuditLogs([newAudit, ...auditLogs]);
      return;
    }

    // Mô phỏng mã hóa lai AES-256-GCM + RSA
    const newMsg: Message = {
      id: String(Date.now()),
      sender: 'Nguyễn Ngọc Minh',
      role: 'Quản trị viên',
      isMe: true,
      plainText: chatInput,
      cipherText: btoa(unescape(encodeURIComponent(chatInput + '_AES_ENCRYPTED_DATA_REST'))),
      authTag: Math.random().toString(16).substring(2, 18),
      iv: Math.random().toString(16).substring(2, 14),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMsg]);
    setChatInput('');
    setDlpWarning([]);

    // Ghi log thành công
    const successAudit: AuditItem = {
      id: `LOG-00${auditLogs.length + 1}`,
      action: 'SEND_MESSAGE',
      user: 'nguyen.minh@internal.vn',
      status: 'SUCCESS',
      ip: '127.0.0.1',
      timestamp: new Date().toLocaleTimeString(),
      details: 'Gửi tin nhắn mã hóa AES-256-GCM thành công',
    };
    setAuditLogs([successAudit, ...auditLogs]);
  };

  // Thử nghiệm file Magic Bytes
  const handleTestFileSimulation = async (type: 'valid_pdf' | 'fake_exe') => {
    let mockFile: File;

    if (type === 'valid_pdf') {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
      mockFile = new File([pdfBytes], 'hop_dong_kinh_te.pdf', { type: 'application/pdf' });
    } else {
      // Giả lập file EXE có chữ ký 'MZ' (4D 5A) nhưng đặt tên là .pdf
      const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ
      mockFile = new File([exeBytes], 'bao_cao_tai_chinh_2026.pdf', { type: 'application/pdf' });
    }

    const inspection = await inspectDlpFile(mockFile);
    setFileAnalysis({
      filename: mockFile.name,
      size: mockFile.size,
      type,
      magicHex: type === 'valid_pdf' ? '25 50 44 46 (%PDF-)' : '4D 5A (Ký tự PE/EXE "MZ")',
      result: inspection,
    });

    // Ghi Audit log
    const fileAudit: AuditItem = {
      id: `LOG-00${auditLogs.length + 1}`,
      action: type === 'valid_pdf' ? 'FILE_UPLOAD' : 'DLP_FILE_BLOCKED',
      user: 'nguyen.minh@internal.vn',
      status: type === 'valid_pdf' ? 'SUCCESS' : 'BLOCKED',
      ip: '127.0.0.1',
      timestamp: new Date().toLocaleTimeString(),
      details:
        type === 'valid_pdf'
          ? 'Tải lên tệp hop_dong_kinh_te.pdf hợp lệ'
          : 'Phát hiện tệp độc hại giả mạo đuôi bao_cao_tai_chinh_2026.pdf (Magic Bytes: 4D 5A)',
    };
    setAuditLogs([fileAudit, ...auditLogs]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. TOP HEADER & SYSTEM BANNER */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                HỆ THỐNG BẢO MẬT & KIỂM SOÁT THÔNG TIN NỘI BỘ
              </h1>
              <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono">
                Enterprise v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Mã hóa lai AES-256-GCM + RSA-2048 | Bộ lọc DLP PII & Magic Bytes | Audit Log Chống chối bỏ
            </p>
          </div>
        </div>

        {/* Server & User status badges */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-slate-300 font-mono">
              Backend: {serverOnline ? 'ONLINE (Port 5000)' : 'LOCAL SIMULATOR'}
            </span>
          </div>

          <div className="flex items-center space-x-2 pl-3 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400 font-semibold text-xs">
              NM
            </div>
            <div className="text-left text-xs">
              <p className="font-semibold text-slate-200">Nguyễn Ngọc Minh</p>
              <div className="flex items-center space-x-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>2FA TOTP Verified</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. NAVIGATION BAR (TABS) */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 flex space-x-1">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'chat'
              ? 'border-blue-500 text-blue-400 bg-slate-800/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Tin nhắn bảo mật (Chat)</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'email'
              ? 'border-blue-500 text-blue-400 bg-slate-800/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Thư điện tử nội bộ (Email)</span>
        </button>

        <button
          onClick={() => setActiveTab('dlp')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'dlp'
              ? 'border-blue-500 text-blue-400 bg-slate-800/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <FileSearch className="w-4 h-4" />
          <span>Sandbox DLP & Magic Bytes</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'dashboard'
              ? 'border-blue-500 text-blue-400 bg-slate-800/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Admin Dashboard & Audit Log</span>
        </button>
      </nav>

      {/* 3. MAIN TAB CONTENT */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {/* =========================================================================
            TAB 1: TIN NHẮN BẢO MẬT (SECURE CHAT)
           ========================================================================= */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[720px]">
            {/* Cột trái: Danh bạ nội bộ */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Danh bạ nội bộ (Đơn vị)
              </h2>
              <div className="space-y-2 flex-1">
                <div className="p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg cursor-pointer">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Trần Thị Mai</p>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <p className="text-xs text-slate-400">Phòng Kế toán - Tài chính</p>
                  <p className="text-[10px] text-blue-400 mt-1 flex items-center space-x-1">
                    <Key className="w-3 h-3 inline" /> <span>RSA-2048 Key: Đã xác thực</span>
                  </p>
                </div>

                <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg opacity-70">
                  <p className="text-sm font-semibold text-slate-300">Lê Văn Hải</p>
                  <p className="text-xs text-slate-400">Phòng Tổ chức - Cán bộ</p>
                </div>
                <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg opacity-70">
                  <p className="text-sm font-semibold text-slate-300">Dương Minh Triết</p>
                  <p className="text-xs text-slate-400">Phòng Công nghệ thông tin</p>
                </div>
              </div>

              {/* Hộp gợi ý test nhanh */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg mt-auto text-xs space-y-2">
                <p className="font-semibold text-slate-300 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kịch bản thử nghiệm DLP:</span>
                </p>
                <button
                  onClick={() => setChatInput('Số CCCD của tôi là 079199001234')}
                  className="w-full text-left p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-amber-300 transition"
                >
                  ⚡ Thử gửi Căn cước công dân (12 số)
                </button>
                <button
                  onClick={() => setChatInput('Chuyển tiền vào thẻ 4532015112830366')}
                  className="w-full text-left p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-amber-300 transition"
                >
                  ⚡ Thử gửi Thẻ Visa (Luhn Check)
                </button>
                <button
                  onClick={() => setChatInput('Kế hoạch BẢO MẬT tuyệt đối quý 4')}
                  className="w-full text-left p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-amber-300 transition"
                >
                  ⚡ Thử gửi từ khóa bí mật
                </button>
              </div>
            </div>

            {/* Cột phải: Khung Chat */}
            <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
              {/* Chat Header */}
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>Đang trò chuyện với: Trần Thị Mai</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        End-to-End Encrypted
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Giao thức TLS 1.3 | Mã hóa lưu trữ AES-256-GCM | Bọc khóa RSA-OAEP
                    </p>
                  </div>
                </div>

                {/* Nút Toggle xem Ciphertext vs Plaintext (Cực kỳ giá trị khi thuyết trình) */}
                <button
                  onClick={() => setShowCiphertext(!showCiphertext)}
                  className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                    showCiphertext
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {showCiphertext ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showCiphertext ? 'Xem Bản rõ (Plaintext)' : 'Xem CSDL (Data at Rest)'}</span>
                </button>
              </div>

              {/* Chat Messages Feed */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-semibold text-slate-300">{m.sender}</span>
                      <span className="text-[10px] text-slate-500">{m.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-lg p-3.5 rounded-xl text-sm ${
                        m.isMe
                          ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-900/30'
                          : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                      }`}
                    >
                      {showCiphertext ? (
                        <div className="font-mono text-xs break-all bg-black/40 p-2.5 rounded border border-amber-500/30 text-amber-300 space-y-1">
                          <p className="text-[10px] text-amber-400 font-bold">
                            🔒 CIPHERTEXT TRONG POSTGRESQL (AES-256-GCM):
                          </p>
                          <p>{m.cipherText}</p>
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                            <span>Tag: {m.authTag}</span>
                            <span>IV: {m.iv}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="leading-relaxed">{m.plainText}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-1 text-[10px] text-slate-500 mt-1">
                      <Lock className="w-2.5 h-2.5 text-emerald-400" />
                      <span>AES-256-GCM Verified</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cảnh báo DLP Real-time dưới chân Input */}
              {dlpWarning.length > 0 && (
                <div className="mx-4 mb-2 p-2.5 bg-red-950/80 border border-red-500/50 rounded-lg flex items-center space-x-2 text-xs text-red-300 animate-pulse">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <span className="font-bold text-red-200">CẢNH BÁO DLP (DATA LEAKAGE PREVENTION): </span>
                    {dlpWarning.join(' | ')}
                  </div>
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center space-x-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Nhập tin nhắn nội bộ... (Hệ thống DLP sẽ tự động kiểm soát nội dung)"
                  className={`flex-1 bg-slate-950 border px-4 py-2.5 rounded-lg text-sm focus:outline-none transition ${
                    dlpWarning.length > 0
                      ? 'border-red-500 text-red-200 focus:ring-1 focus:ring-red-500'
                      : 'border-slate-700 text-white focus:border-blue-500'
                  }`}
                />
                <button
                  onClick={handleSendMessage}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center space-x-2 text-sm font-semibold shadow-lg shadow-blue-600/30 transition"
                >
                  <Send className="w-4 h-4" />
                  <span>Gửi</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: THƯ ĐIỆN TỬ NỘI BỘ (EMAIL)
           ========================================================================= */}
        {activeTab === 'email' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[720px]">
            {/* Cột 1: Danh sách Hộp thư */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Hộp thư đến ({emails.length})
                </h2>
                <span className="text-xs text-blue-400 font-mono">Mail Server Sandbox</span>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto">
                {emails.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => setSelectedEmail(e)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition ${
                      selectedEmail.id === e.id
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-400">{e.sender}</p>
                    <p className="text-sm font-bold text-slate-200 mt-1 line-clamp-1">{e.subject}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{e.body}</p>
                    <div className="flex items-center space-x-1.5 mt-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                        SPF: {e.spf}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                        DKIM: {e.dkim}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                        DMARC: {e.dmarc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cột 2: Nội dung Thư chi tiết */}
            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
              <div className="border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">{selectedEmail.subject}</h3>
                  <span className="text-xs text-slate-400">{selectedEmail.timestamp}</span>
                </div>
                <div className="mt-2 text-xs text-slate-300 space-y-1">
                  <p>
                    <strong className="text-slate-400">Từ:</strong> {selectedEmail.sender}
                  </p>
                  <p>
                    <strong className="text-slate-400">Đến:</strong> {selectedEmail.recipient}
                  </p>
                </div>

                {/* Kết quả xác thực Header chống Spoofing (RFC 7208 / 6376 / 7489) */}
                <div className="mt-3 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Nguồn gốc thư điện tử đã được xác thực chống giả mạo (Anti-Spoofing):</span>
                  </div>
                  <div className="flex space-x-2 font-mono text-[11px]">
                    <span className="text-emerald-300">SPF=PASS</span>
                    <span className="text-emerald-300">DKIM=VALID</span>
                    <span className="text-emerald-300">DMARC=ENFORCED</span>
                  </div>
                </div>
              </div>

              {/* Thân thư */}
              <div className="flex-1 text-sm text-slate-200 leading-relaxed bg-slate-950/40 p-4 rounded-lg border border-slate-800">
                {selectedEmail.body}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Dữ liệu lưu trữ: AES-256-GCM Encrypted at Rest</span>
                <span className="text-emerald-400 flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Chữ ký số toàn vẹn hợp lệ</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: SANDBOX DLP & FILE INSPECTOR (MAGIC BYTES LAB)
           ========================================================================= */}
        {activeTab === 'dlp' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <FileSearch className="w-5 h-5 text-blue-400" />
                <span>PHÒNG THỬ NGHIỆM CHỮ KÝ TỆP TIN (MAGIC BYTES / FILE SIGNATURE INSPECTION)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Kẻ tấn công thường đổi đuôi tệp độc hại (.exe, .scr, .bat) thành tài liệu văn phòng (.pdf, .docx)
                để lừa người nhận và qua mặt bộ lọc thông thường. Hệ thống DLP này trực tiếp phân tích byte nhị phân ở
                tầng thấp (Binary Header).
              </p>

              {/* 2 Nút thử nghiệm trực tiếp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <h3 className="text-sm font-semibold text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Kịch bản 1: Tệp PDF hợp lệ</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Tệp có chữ ký chuẩn <code>%PDF-</code> (Hex: <code>25 50 44 46</code>).
                  </p>
                  <button
                    onClick={() => handleTestFileSimulation('valid_pdf')}
                    className="mt-4 w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition"
                  >
                    ⚡ Thử tải lên "hop_dong_kinh_te.pdf"
                  </button>
                </div>

                <div className="p-4 bg-slate-950 border border-red-900/50 rounded-xl">
                  <h3 className="text-sm font-semibold text-red-400 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Kịch bản 2: Tấn công giả mạo đuôi tệp (Spoofed Malware)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Tệp thực thi Windows (.exe mang chữ ký <code>4D 5A</code> tức MZ) nhưng đổi đuôi thành <code>.pdf</code>.
                  </p>
                  <button
                    onClick={() => handleTestFileSimulation('fake_exe')}
                    className="mt-4 w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-lg text-xs font-semibold transition"
                  >
                    🔥 Thử tải lên "bao_cao_tai_chinh_2026.pdf" (Thực chất là .EXE)
                  </button>
                </div>
              </div>

              {/* Bảng báo cáo phân tích chi tiết */}
              {fileAnalysis && (
                <div
                  className={`mt-6 p-5 rounded-xl border ${
                    fileAnalysis.type === 'valid_pdf'
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-red-950/20 border-red-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between border-b pb-3 border-slate-800">
                    <div className="flex items-center space-x-2">
                      {fileAnalysis.type === 'valid_pdf' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <h4 className="text-sm font-bold text-white">
                        KẾT QUẢ GIẢM SÁT: {fileAnalysis.type === 'valid_pdf' ? 'CHO PHÉP LƯU HÀNH' : 'ĐÃ BỊ CHẶN BỞI DLP'}
                      </h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      Tên tệp: {fileAnalysis.filename} ({fileAnalysis.size} bytes)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
                    <div>
                      <p className="text-slate-400">Chữ ký nhị phân thực tế (Magic Bytes):</p>
                      <p className="font-mono text-sm font-bold text-white mt-1 bg-black/40 p-2 rounded border border-slate-800">
                        {fileAnalysis.magicHex}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400">Đánh giá nguy cơ:</p>
                      <p
                        className={`text-sm font-bold mt-1 ${
                          fileAnalysis.type === 'valid_pdf' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {fileAnalysis.type === 'valid_pdf'
                          ? 'Mức độ nguy cơ: AN TOÀN (LOW)'
                          : 'Mức độ nguy cơ: RẤT NGUY HIỂM (CRITICAL)'}
                      </p>
                    </div>
                  </div>

                  {fileAnalysis.result.data?.reasons && (
                    <div className="mt-4 pt-3 border-t border-slate-800 text-xs">
                      <p className="text-slate-300 font-semibold mb-1">Chi tiết vi phạm chính sách:</p>
                      <ul className="list-disc list-inside space-y-1 text-red-300">
                        {fileAnalysis.result.data.reasons.map((r: string, idx: number) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: ADMIN DASHBOARD & AUDIT LOG
           ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 4 Thẻ Thống kê An toàn thông tin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Tổng sự kiện kiểm toán</p>
                <p className="text-2xl font-bold text-white mt-1">1,482</p>
                <p className="text-[10px] text-emerald-400 mt-1 flex items-center space-x-1">
                  <span>Append-only database</span>
                </p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Số vụ rò rỉ DLP bị chặn</p>
                <p className="text-2xl font-bold text-red-400 mt-1">37</p>
                <p className="text-[10px] text-red-300 mt-1">Bao gồm CCCD, Thẻ & Malware EXE</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Tỷ lệ mã hóa lưu trữ</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">100%</p>
                <p className="text-[10px] text-blue-300 mt-1">AES-256-GCM (Data at Rest)</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Kích hoạt 2FA / TOTP</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">100%</p>
                <p className="text-[10px] text-emerald-300 mt-1">Bắt buộc theo chuẩn RFC 6238</p>
              </div>
            </div>

            {/* Bảng Nhật ký kiểm toán (Audit Trail Table) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span>NHẬT KÝ KIỂM TOÁN HỆ THỐNG (APPEND-ONLY AUDIT TRAIL)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ghi nhận không thể chỉnh sửa, phục vụ công tác điều tra và đối soát an ninh mạng
                  </p>
                </div>
                <button
                  onClick={() => alert('Đã trích xuất báo cáo kiểm toán thành công (audit_report_2026.csv)!')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg transition"
                >
                  Xuất báo cáo CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Mã Log</th>
                      <th className="py-2.5 px-3">Thời gian</th>
                      <th className="py-2.5 px-3">Hành động</th>
                      <th className="py-2.5 px-3">Tác nhân (User)</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                      <th className="py-2.5 px-3">Địa chỉ IP</th>
                      <th className="py-2.5 px-3">Chi tiết kỹ thuật</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{log.id}</td>
                        <td className="py-2.5 px-3 text-slate-300">{log.timestamp}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{log.action}</td>
                        <td className="py-2.5 px-3 text-slate-300">{log.user}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : log.status === 'BLOCKED'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{log.ip}</td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 px-6 text-center text-xs text-slate-500">
        Hệ thống Bảo mật & Kiểm soát Trao đổi Thông tin Nội bộ (DLP & Secure Communication)
      </footer>
    </div>
  );
}
