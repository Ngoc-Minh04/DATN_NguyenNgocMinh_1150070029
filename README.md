# HỆ THỐNG BẢO MẬT VÀ KIỂM SOÁT TRAO ĐỔI THÔNG TIN NỘI BỘ
**Đề tài tốt nghiệp số 31 - Khoa CNTT, Trường Đại học Tài nguyên và Môi trường TP.HCM**  
**Sinh viên thực hiện:** Nguyễn Ngọc Minh (Lớp: 11_ĐH_TMĐT - MSSV: 1150070029)  
**Giảng viên hướng dẫn:** ThS. Từ Thanh Trí

---

## 📁 Cấu Trúc Thư Mục Hệ Thống

```
c:\DATN
├── docker-compose.yml              # Cấu hình khởi chạy nhanh PostgreSQL 16 & Redis 7
├── README.md                       # Tài liệu hướng dẫn cài đặt & vận hành
├── client/                         # Giao diện người dùng Web Client (React + Tailwind CSS)
│   ├── src/
│   │   ├── App.tsx                 # Giao diện Chat, Email, Magic Bytes Sandbox, Dashboard
│   │   └── api.ts                  # Kết nối Backend API bảo mật
│   └── package.json
└── server/                         # Backend API & Socket.io (Node.js + TypeScript)
    ├── package.json
    ├── tsconfig.json
    ├── .env.example                # Mẫu biến môi trường
    ├── .env                        # Biến môi trường cục bộ
    └── src/
        ├── app.ts                  # Cấu hình Express, Helmet, CORS, Rate Limit
        ├── server.ts               # Khởi động HTTP Server & Socket.io
        ├── test-security.ts        # Kịch bản kiểm thử bảo mật tự động
        ├── config/                 # Kết nối DB & Redis
        ├── database/schema.sql     # Schema CSDL
        ├── middlewares/            # Auth JWT, Rate Limit
        ├── modules/security/       # Mã hóa lai AES-GCM + RSA, DLP Regex & Magic Bytes
        ├── modules/audit/          # Nhật ký kiểm toán Append-only
        └── routes/                 # Endpoint /api/v1
```

---

## 🚀 Hướng Dẫn Vận Hành

### Bước 1: Khởi động Server Backend
Ở thư mục `server/` hoặc ngay tại thư mục gốc:
```bash
npm run server
# hoặc: cd server && npm run dev
```
> Backend chạy tại: `http://localhost:5000`

### Bước 2: Khởi động Giao diện Web Client
Mở thêm một cửa sổ terminal mới:
```bash
npm run client
# hoặc: cd client && npm run dev
```
> Web Client chạy tại: `http://localhost:5173`

---

## 🛡️ Các Phân Hệ Bảo Mật Đã Tích Hợp Sẵn Trong Boilerplate

1. **Xác thực & Chống Brute-force (`auth.routes.ts`):**
   - Băm mật khẩu bằng thuật toán **Argon2id** (chuẩn NIST khuyến nghị).
   - Tự động khóa tài khoản khi nhập sai quá 5 lần (**Account Lockout**).
   - Giới hạn tần suất gọi API đăng nhập (**Rate Limiting**).
   - Xác thực 2 yếu tố **2FA / TOTP** (RFC 6238) tương thích ứng dụng *Google Authenticator*.
2. **Mã hóa lai Hybrid Encryption (`crypto.service.ts`):**
   - Dữ liệu lưu trữ (Data at Rest) được mã hóa bằng thuật toán đối xứng **AES-256-GCM**.
   - Khóa phiên AES được bảo vệ bằng cặp khóa bất đối xứng **RSA-2048 (RSA-OAEP)** của người nhận.
3. **Bộ lọc rò rỉ dữ liệu DLP & Magic Bytes (`dlp.service.ts`):**
   - Tự động quét và chặn nội dung chứa: **CCCD (12 số)**, **Thẻ Visa/Mastercard (thuật toán Luhn)**, **Từ khóa bí mật**.
   - Kiểm tra chữ ký tệp tin ở tầng nhị phân (**Magic Bytes**): Phát hiện và chặn tệp thực thi độc hại (`.exe` mang header `4D 5A`) cố tình đổi tên đuôi file thành `.pdf`.
4. **Nhật ký kiểm toán chống chối bỏ (`audit.service.ts`):**
   - Cơ chế ghi nhật ký bất biến (**Append-only**) theo dõi mọi sự kiện: Đăng nhập, xác thực 2FA, gửi thư, vi phạm DLP, tải file.
