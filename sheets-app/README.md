# Google Sheets Manager (React + Node.js Express)

โปรเจกต์เว็บแอปพลิเคชันสำหรับจัดการข้อมูล Google Sheets (แสดงผล, เพิ่ม, แก้ไข, ลบ - CRUD) พร้อมระบบความปลอดภัยที่ไม่เปิดเผย API Key หรือ Credential สู่หน้าเว็บเบราว์เซอร์

---

## 📁 โครงสร้างโปรเจกต์

```text
sheets-app/
├── server/                    # Node.js + Express API Backend
│   ├── .env                   # ไฟล์เก็บ Service Account Key & Sheet ID (ห้าม Commit)
│   ├── .env.example           # ตัวอย่าง Template สำหรับตั้งค่า
│   ├── googleSheets.js        # Service เชื่อมต่อ Google Sheets API v4
│   ├── index.js               # Express API Endpoints (CRUD)
│   └── package.json
└── client/                    # React (Vite) Frontend
    ├── src/
    │   ├── App.jsx            # หน้า Dashboard (ตาราง, ค้นหา, กรอง, Modal Add/Edit, Confirm Delete)
    │   ├── App.css            # สไตล์ Modern Dark Glassmorphism
    │   └── index.css          # CSS Variables & Global Typography
    ├── vite.config.js         # Proxy ไปยัง Backend (port 5000)
    └── package.json
```

---

## 🚀 วิธีเปิดใช้งาน (Getting Started)

### 1. รัน Backend (Port 5000)
```bash
cd sheets-app/server
npm start
```
*(เซิร์ฟเวอร์จะเริ่มทำงานบน `http://localhost:5000`)*

### 2. รัน Frontend (Port 3000)
```bash
cd sheets-app/client
npm run dev
```
เปิดเบราว์เซอร์ไปที่ **`http://localhost:3000`**

> **💡 หมายเหตุ:** หากยังไม่ได้ใส่ Credential ระบบจะทำงานใน **Demo / Mock Mode** ให้อัตโนมัติ สามารถทดสอบ เพิ่ม/แก้ไข/ลบ ข้อมูลบนหน้าเว็บได้ทันทีโดยไม่เกิด Error

---

## 🔑 วิธีเชื่อมต่อกับ Google Sheet จริง (Go Live)

1. **สร้าง Google Cloud Service Account:**
   - ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
   - เปิดใช้งาน **Google Sheets API**
   - ไปที่ **IAM & Admin > Service Accounts** แล้วสร้าง Service Account ใหม่
   - กดแท็บ **Keys > Add Key > Create new key (JSON)** เพื่อดาวน์โหลดไฟล์คีย์

2. **แชร์ Google Sheet ให้ Service Account:**
   - คัดลอกอีเมลของ Service Account (เช่น `xxx@yyy.iam.gserviceaccount.com`)
   - เปิด Google Sheet ของคุณ แล้วกดปุ่ม **Share (แชร์)**
   - วางอีเมล Service Account ลงไป และกำหนดสิทธิ์เป็น **Editor (ผู้แก้ไข)**

3. **นำข้อมูลมากรอกใน `sheets-app/server/.env`:**
   ```env
   PORT=5000
   SPREADSHEET_ID=ไอดีจาก_URL_ของ_Google_Sheet
   SHEET_NAME=Sheet1
   GOOGLE_SERVICE_ACCOUNT_EMAIL=อีเมล_service_account@...
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
4. รีสตาร์ท Backend ด้วย `npm start` หน้าเว็บจะเปลี่ยนสถานะเป็น **Google Sheets Live** ทันที
