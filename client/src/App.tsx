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
  Database,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { checkServerHealth, inspectDlpText, inspectDlpFile } from './api';

// Kiểu dữ liệu liên hệ
interface Contact {
  id: string;
  name: string;
  department: string;
  online: boolean;
}

// Kiểu dữ liệu tin nhắn
interface Message {
  id: string;
  contactId: string;
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
  actionDisplay: string;
  user: string;
  status: 'SUCCESS' | 'BLOCKED' | 'FAILED';
  statusDisplay: string;
  ip: string;
  timestamp: string;
  details: string;
}

const CONTACTS: Contact[] = [
  { id: 'mai', name: 'Trần Thị Mai', department: 'Phòng Kế toán - Tài chính', online: true },
  { id: 'hai', name: 'Lê Văn Hải', department: 'Phòng Tổ chức - Cán bộ', online: false },
  { id: 'triet', name: 'Dương Minh Triết', department: 'Phòng Công nghệ thông tin', online: false },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'email' | 'dlp' | 'dashboard'>('chat');
  const [serverOnline, setServerOnline] = useState(false);
  const [showCiphertext, setShowCiphertext] = useState(false);
  const [showEmailAuthDetails, setShowEmailAuthDetails] = useState(false);
  const [showFileTechDetails, setShowFileTechDetails] = useState(false);

  // Trạng thái liên hệ đang chọn
  const [selectedContact, setSelectedContact] = useState<Contact>(CONTACTS[0]);

  // Trạng thái Chat
  const [chatInput, setChatInput] = useState('');
  const [dlpWarning, setDlpWarning] = useState<string[]>([]);
  const [sendBlockedNotice, setSendBlockedNotice] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      contactId: 'mai',
      sender: 'Trần Thị Mai',
      role: 'Phòng Kế toán - Tài chính',
      isMe: false,
      plainText: 'Chào anh Minh, anh gửi giúp em bảng dự toán chi phí máy chủ tuần này nhé.',
      cipherText: 'U2FsdGVkX1+vG3...x8Y0pZ9mK1bQv2wE4rT7yU9iO',
      authTag: '8f7a2d3e1c4b5a6f',
      iv: 'a1b2c3d4e5f6',
      timestamp: '10:15',
    },
    {
      id: '2',
      contactId: 'mai',
      sender: 'Nguyễn Ngọc Minh',
      role: 'Quản trị viên',
      isMe: true,
      plainText: 'Anh gửi qua thư nội bộ rồi nhé, Mai.',
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
      body: 'Tất cả cán bộ cần bật xác thực hai bước bằng ứng dụng tạo mã. Vui lòng không lưu thông tin định danh cá nhân trên thiết bị ngoài.',
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
      body: 'Khi tin nhắn chứa thông tin thuộc diện hạn chế chia sẻ, hệ thống sẽ chặn gửi. Thư và tài liệu được mã hóa khi lưu trữ.',
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
      actionDisplay: 'Đăng nhập',
      user: 'nguyen.minh@internal.vn',
      status: 'SUCCESS',
      statusDisplay: 'Thành công',
      ip: '192.168.1.105',
      timestamp: '10:14:22',
      details: 'Xác thực hai bước thành công',
    },
    {
      id: 'LOG-002',
      action: 'DLP_VIOLATION',
      actionDisplay: 'Chặn rò rỉ dữ liệu',
      user: 'duong.triet@internal.vn',
      status: 'BLOCKED',
      statusDisplay: 'Đã chặn',
      ip: '192.168.1.112',
      timestamp: '10:16:45',
      details: 'Phát hiện số CCCD (12 chữ số) trong tin nhắn',
    },
    {
      id: 'LOG-003',
      action: 'DLP_FILE_BLOCKED',
      actionDisplay: 'Chặn tệp không hợp lệ',
      user: 'unknown_client',
      status: 'BLOCKED',
      statusDisplay: 'Đã chặn',
      ip: '192.168.1.200',
      timestamp: '10:20:01',
      details: 'Chặn tệp PE/EXE giả mạo đuôi .pdf (Magic Bytes: 4D 5A)',
    },
    {
      id: 'LOG-004',
      action: 'SEND_MESSAGE',
      actionDisplay: 'Gửi tin nhắn',
      user: 'nguyen.minh@internal.vn',
      status: 'SUCCESS',
      statusDisplay: 'Thành công',
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
      setSendBlockedNotice(null);
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
      const reasonsList = dlpCheck.result.reasons.join('; ');
      setSendBlockedNotice(
        `Tin nhắn chưa được gửi do chứa thông tin hạn chế chia sẻ (${reasonsList}). Vui lòng xóa hoặc chỉnh sửa nội dung này trước khi gửi lại.`
      );

      // Ghi Audit log vi phạm
      const newAudit: AuditItem = {
        id: `LOG-00${auditLogs.length + 1}`,
        action: 'DLP_VIOLATION',
        actionDisplay: 'Chặn rò rỉ dữ liệu',
        user: 'nguyen.minh@internal.vn',
        status: 'BLOCKED',
        statusDisplay: 'Đã chặn',
        ip: '127.0.0.1',
        timestamp: new Date().toLocaleTimeString(),
        details: `Cố ý gửi thông tin nhạy cảm: ${dlpCheck.result.reasons[0]}`,
      };
      setAuditLogs([newAudit, ...auditLogs]);
      return;
    }

    setSendBlockedNotice(null);

    // Tạo tin nhắn mới gắn với liên hệ đang trao đổi
    const newMsg: Message = {
      id: String(Date.now()),
      contactId: selectedContact.id,
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
      actionDisplay: 'Gửi tin nhắn',
      user: 'nguyen.minh@internal.vn',
      status: 'SUCCESS',
      statusDisplay: 'Thành công',
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
      actionDisplay: type === 'valid_pdf' ? 'Tải tệp' : 'Chặn tệp không hợp lệ',
      user: 'nguyen.minh@internal.vn',
      status: type === 'valid_pdf' ? 'SUCCESS' : 'BLOCKED',
      statusDisplay: type === 'valid_pdf' ? 'Thành công' : 'Đã chặn',
      ip: '127.0.0.1',
      timestamp: new Date().toLocaleTimeString(),
      details:
        type === 'valid_pdf'
          ? 'Tải lên tệp hop_dong_kinh_te.pdf hợp lệ'
          : 'Phát hiện tệp độc hại giả mạo đuôi bao_cao_tai_chinh_2026.pdf (Magic Bytes: 4D 5A)',
    };
    setAuditLogs([fileAudit, ...auditLogs]);
  };

  // Lọc tin nhắn của cuộc trò chuyện đang chọn
  const currentMessages = messages.filter((m) => m.contactId === selectedContact.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. TOP HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg shadow-sm">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-normal">
              Cổng trao đổi nội bộ
            </h1>
          </div>
        </div>

        {/* Server & User status badges */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-slate-800/80 border border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {serverOnline ? 'Máy chủ: Trực tuyến' : 'Máy chủ: Sẵn sàng'}
            </span>
          </div>

          <div className="flex items-center space-x-2 pl-3 border-l border-slate-800">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400 font-semibold text-xs">
              NM
            </div>
            <div className="text-left text-xs hidden sm:block">
              <p className="font-semibold text-slate-200">Nguyễn Ngọc Minh</p>
              <div className="flex items-center space-x-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>Đã xác thực 2 bước</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. NAVIGATION BAR */}
      <nav className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex space-x-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeTab === 'chat'
              ? 'border-blue-500 text-blue-400 bg-slate-800/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Tin nhắn</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeTab === 'email'
              ? 'border-blue-500 text-blue-400 bg-slate-800/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Hộp thư</span>
        </button>

        <button
          onClick={() => setActiveTab('dlp')}
          className={`flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeTab === 'dlp'
              ? 'border-blue-500 text-blue-400 bg-slate-800/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <FileSearch className="w-4 h-4" />
          <span>Kiểm tra tệp</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeTab === 'dashboard'
              ? 'border-blue-500 text-blue-400 bg-slate-800/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Quản trị và nhật ký</span>
        </button>
      </nav>

      {/* 3. MAIN TAB CONTENT */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {/* =========================================================================
            TAB 1: TIN NHẮN
           ========================================================================= */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 min-h-[640px] md:h-[720px]">
            {/* Cột trái: Danh bạ */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Danh bạ
              </h2>
              <div className="space-y-2 flex-1">
                {CONTACTS.map((c) => {
                  const isSelected = selectedContact.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedContact(c)}
                      className={`p-3 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-600/15 border border-blue-500/40 text-white'
                          : 'bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{c.name}</p>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            c.online ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{c.department}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {c.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Chèn nội dung mẫu */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg mt-4 text-xs space-y-2">
                <p className="font-semibold text-slate-400 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Chèn nội dung mẫu:</span>
                </p>
                <button
                  onClick={() => setChatInput('Số CCCD của tôi là 079199001234')}
                  className="w-full text-left p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 hover:text-white transition"
                >
                  • Số Căn cước công dân
                </button>
                <button
                  onClick={() => setChatInput('Chuyển tiền vào thẻ 4532015112830366')}
                  className="w-full text-left p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 hover:text-white transition"
                >
                  • Số thẻ ngân hàng
                </button>
                <button
                  onClick={() => setChatInput('Kế hoạch BẢO MẬT tuyệt đối quý 4')}
                  className="w-full text-left p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 hover:text-white transition"
                >
                  • Từ khóa tài liệu mật
                </button>
              </div>
            </div>

            {/* Cột phải: Khung Chat */}
            <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
              {/* Chat Header: Dùng tên người nhận làm tiêu đề */}
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>{selectedContact.name}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                        Mã hóa đầu cuối
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">{selectedContact.department}</p>
                  </div>
                </div>

                {/* Nút Chi tiết mã hóa / Quay lại tin nhắn */}
                <button
                  onClick={() => setShowCiphertext(!showCiphertext)}
                  className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                    showCiphertext
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {showCiphertext ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showCiphertext ? 'Quay lại tin nhắn' : 'Chi tiết mã hóa'}</span>
                </button>
              </div>

              {/* Chat Messages Feed */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {currentMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Chưa có tin nhắn nào với {selectedContact.name}. Hãy nhập tin nhắn bên dưới.
                  </div>
                ) : (
                  currentMessages.map((m) => (
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
                              Dữ liệu mã hóa lưu trữ:
                            </p>
                            <p>{m.cipherText}</p>
                            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                              <span>Thẻ xác thực (Tag): {m.authTag}</span>
                              <span>Vectơ (IV): {m.iv}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="leading-relaxed">{m.plainText}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cảnh báo khi bị chặn gửi */}
              {sendBlockedNotice && (
                <div className="mx-4 mb-2 p-3 bg-red-950/90 border border-red-500 rounded-lg flex items-start space-x-2 text-xs text-red-200">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-300 mb-0.5">Không thể gửi tin nhắn</p>
                    <p className="leading-relaxed">{sendBlockedNotice}</p>
                  </div>
                </div>
              )}

              {/* Cảnh báo DLP Real-time khi đang soạn */}
              {dlpWarning.length > 0 && !sendBlockedNotice && (
                <div className="mx-4 mb-2 p-2.5 bg-amber-950/80 border border-amber-500/50 rounded-lg flex items-center space-x-2 text-xs text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold">Phát hiện dữ liệu nhạy cảm: </span>
                    {dlpWarning.join(' | ')}
                  </div>
                </div>
              )}

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center space-x-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    if (sendBlockedNotice) setSendBlockedNotice(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Nhập tin nhắn gửi ${selectedContact.name}...`}
                  className={`flex-1 bg-slate-950 border px-4 py-2.5 rounded-lg text-sm focus:outline-none transition ${
                    dlpWarning.length > 0 || sendBlockedNotice
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
            TAB 2: HỘP THƯ
           ========================================================================= */}
        {activeTab === 'email' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[640px] md:h-[720px]">
            {/* Cột 1: Danh sách Hộp thư */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="mb-3">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Hộp thư đến ({emails.length})
                </h2>
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
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{e.body}</p>
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

                {/* Khối Chi tiết xác thực (người xem chủ động mở) */}
                <div className="mt-3 border border-slate-800 rounded-lg overflow-hidden bg-slate-950/50">
                  <button
                    onClick={() => setShowEmailAuthDetails(!showEmailAuthDetails)}
                    className="w-full px-3 py-2 flex items-center justify-between text-xs text-slate-300 hover:bg-slate-800/40 transition"
                  >
                    <span className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-medium">Chi tiết xác thực người gửi</span>
                    </span>
                    <span className="flex items-center space-x-1 text-slate-400 text-[11px]">
                      <span>{showEmailAuthDetails ? 'Thu gọn' : 'Xem chi tiết'}</span>
                      {showEmailAuthDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showEmailAuthDetails && (
                    <div className="px-3 py-2.5 border-t border-slate-800 text-xs space-y-1.5 bg-slate-950/80">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Xác thực máy chủ gửi (SPF):</span>
                        <span className="font-mono text-emerald-400 font-semibold">{selectedEmail.spf}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Chữ ký số thư (DKIM):</span>
                        <span className="font-mono text-emerald-400 font-semibold">{selectedEmail.dkim}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Chính sách tên miền (DMARC):</span>
                        <span className="font-mono text-emerald-400 font-semibold">{selectedEmail.dmarc}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Thân thư */}
              <div className="flex-1 text-sm text-slate-200 leading-relaxed bg-slate-950/40 p-4 rounded-lg border border-slate-800 whitespace-pre-line">
                {selectedEmail.body}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: KIỂM TRA TỆP
           ========================================================================= */}
        {activeTab === 'dlp' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <FileSearch className="w-5 h-5 text-blue-400" />
                <span>Kiểm tra tệp</span>
              </h2>

              {/* Danh sách tệp mẫu */}
              <div className="mt-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Tệp mẫu
                </h3>
                <div className="space-y-3">
                  {/* Tệp 1 */}
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">hop_dong_kinh_te.pdf</p>
                      <p className="text-xs text-slate-400 mt-0.5">Tệp tài liệu văn bản tiêu chuẩn</p>
                    </div>
                    <button
                      onClick={() => handleTestFileSimulation('valid_pdf')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Kiểm tra
                    </button>
                  </div>

                  {/* Tệp 2 */}
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">bao_cao_tai_chinh_2026.pdf</p>
                      <p className="text-xs text-slate-400 mt-0.5">Tệp văn bản đính kèm cần xác minh</p>
                    </div>
                    <button
                      onClick={() => handleTestFileSimulation('fake_exe')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Kiểm tra
                    </button>
                  </div>
                </div>
              </div>

              {/* Bảng báo cáo kết quả kiểm tra */}
              {fileAnalysis && (
                <div
                  className={`mt-6 p-5 rounded-xl border ${
                    fileAnalysis.type === 'valid_pdf'
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-red-950/20 border-red-500/50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800">
                    {fileAnalysis.type === 'valid_pdf' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {fileAnalysis.type === 'valid_pdf'
                          ? 'Phần đầu tệp khớp với định dạng PDF.'
                          : 'Đã chặn tệp. Tệp có đuôi .pdf nhưng phần đầu mang dấu hiệu của tệp thực thi Windows.'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tệp đã kiểm tra: {fileAnalysis.filename}
                      </p>
                    </div>
                  </div>

                  {/* Chi tiết kỹ thuật (mở rộng khi cần) */}
                  <div className="mt-3">
                    <button
                      onClick={() => setShowFileTechDetails(!showFileTechDetails)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
                    >
                      <span>Chi tiết kỹ thuật</span>
                      {showFileTechDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showFileTechDetails && (
                      <div className="mt-2 p-3 bg-black/40 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Chuỗi byte đầu tệp:</span>
                          <span className="text-white font-bold">{fileAnalysis.magicHex}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Kích thước mẫu:</span>
                          <span>{fileAnalysis.size} bytes</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: QUẢN TRỊ VÀ NHẬT KÝ
           ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 4 Thẻ Thống kê */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Tổng số sự kiện</p>
                <p className="text-2xl font-bold text-white mt-1">1,482</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Sự kiện DLP ngăn chặn</p>
                <p className="text-2xl font-bold text-red-400 mt-1">37</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Tỷ lệ mã hóa dữ liệu</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">100%</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Người dùng đã bật xác thực hai bước</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">100%</p>
              </div>
            </div>

            {/* Bảng Nhật ký kiểm toán */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  <span>Nhật ký kiểm toán</span>
                </h3>
                <button
                  onClick={() => alert('Đã xuất báo cáo kiểm toán (audit_report_2026.csv)')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg transition"
                >
                  Xuất báo cáo CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Mã sự kiện</th>
                      <th className="py-2.5 px-3">Thời gian</th>
                      <th className="py-2.5 px-3">Hành động</th>
                      <th className="py-2.5 px-3">Tác nhân</th>
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
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          {log.actionDisplay} <span className="text-[10px] text-slate-500 font-mono font-normal">({log.action})</span>
                        </td>
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
                            {log.statusDisplay}
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
    </div>
  );
}