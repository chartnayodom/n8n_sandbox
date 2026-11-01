# 📋 เอกสารสรุปสถานะโปรเจกต์และคู่มือการย้ายเครื่อง (Handover & PC Migration Guide)
## ระบบ AutoMail Insurance & Management Web Portal (n8n + React + Node.js + Google Sheets)

> **วันที่จัดทำ:** 1 พฤศจิกายน 2026  
> **วัตถุประสงค์:** สรุปภาพรวมของงานทั้งหมดที่ทำเสร็จแล้ว, สิ่งที่ค้างไว้ที่ต้องทำต่อ, และขั้นตอนการย้ายโปรเจกต์ไปติดตั้งและพัฒนาต่อบนเครื่อง PC เครื่องใหม่อย่างราบรื่น ไม่ตกหล่น

---

## ⚠️ 1. สิ่งที่ต้องทำทันที "ก่อนปิดเครื่องเดิม" (Critical Pre-Migration)

ก่อนที่คุณจะย้ายออกจากเครื่อง PC เครื่องนี้ มี **2 สิ่งสำคัญอย่างยิ่ง** ที่ต้องทำ:

### 1.1 Push โค้ดล่าสุดขึ้น GitHub
โค้ดระบบเว็บ `sheets-app` และไฟล์ workflow ล่าสุดเพิ่งถูกบันทึกใน Local Git (`commit 15d0e24`) แต่ **ยังไม่ได้ Push ขึ้น Remote Repository**:
```bash
git push origin main
```
*(หากยังไม่มี Remote หรือใช้ USB Drive ให้คัดลอกโฟลเดอร์โปรเจกต์ `n8n_sandbox` ทั้งหมดเก็บไว้)*

### 1.2 สำรองไฟล์ `.env` ที่อยู่ใน `sheets-app/server/.env`
เนื่องจากไฟล์ `.env` ถูกตั้งค่า `.gitignore` ไว้ (เพื่อความปลอดภัย ไม่ให้อัปโหลดคีย์ลับขึ้น GitHub) **ไฟล์นี้จะไม่ติดไปกับ Git**:
- คุณต้อง Copy ไฟล์ `sheets-app/server/.env` เก็บไว้ใน Flash Drive, Secure Cloud, หรือบันทึกข้อความเก็บไว้ เพื่อนำไปวางที่เครื่องใหม่
- **เนื้อหาในไฟล์ `sheets-app/server/.env` ประกอบด้วย:**
  - `PORT=5000`
  - `SPREADSHEET_ID=12S24DnEVXj72JDarLex5Z6cEo7zla4DEULaCfEW6QWo`
  - `SHEET_NAME=Master_Data`
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL=n8n-sheet-bot@n8n-test-511914.iam.gserviceaccount.com`
  - `GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`

---

## 🏛️ 2. ภาพรวมสถาปัตยกรรมระบบ (Architecture Overview)

ระบบประกอบด้วย 3 ส่วนหลักที่ทำงานผสานกัน:

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Frontend Client (Port 3000)"]
        UI["React 19 + Tailwind v4 + Vite"]
        LoginUI["A. Login (Two-tier Auth)"]
        DashUI["1. Dashboard (4 Metric Cards)"]
        InboxUI["2. Inbox & 5. Needs Review"]
        DetailUI["3. Email Detail & Reply Chain"]
        MasterUI["4. Master Data (Whitelist)"]
        TplUI["6. Template Editor (No-Code Form)"]
        SetUI["7. Settings & 8. Activity Logs"]
    end

    subgraph ServerLayer ["2. Backend API (Port 5000)"]
        API["Node.js Express Server"]
        AuthService["Google Drive Permissions Check"]
        SheetsService["Google Sheets API v4 Handler"]
        WebhookTrigger["n8n Webhook Caller"]
    end

    subgraph StorageLayer ["3. Cloud Data & Automation Engine"]
        GSheets[("Google Spreadsheet ID:\n12S24DnEVXj72JDarLex5Z6cEo7zla4DEULaCfEW6QWo")]
        N8N["n8n Automation Engine (Port 5678)"]
        GmailSMTP["Gmail SMTP / IMAP Trigger"]
    end

    UI --> API
    API --> AuthService --> GSheets
    API --> SheetsService --> GSheets
    API --> WebhookTrigger --> N8N
    N8N --> SheetsService
    N8N --> GmailSMTP
```

---

## ✅ 3. สรุปฟังก์ชั่นที่พัฒนาเสร็จสมบูรณ์แล้ว (Completed Work)

### 3.1 ระบบ Authentication แบบ 2 ชั้น (Two-tier Authorization Gate)
- **Tier 1:** ตรวจสอบผ่าน Google Drive API (`drive.permissions.list`) ว่าบัญชี Google ของผู้ใช้มีสิทธิ์ใน `SPREADSHEET_ID` หรือไม่
- **Tier 2:** ตรวจสอบเทียบกับรายชื่อในแผ่นงาน `config` เพื่อดึง Role (`Admin` หรือ `Viewer`) และตรวจสอบสถานะบัญชี
- มีปุ่มลัดเลือกบัญชีทดสอบที่ได้รับสิทธิ์: `baipor2545@gmail.com` (Owner/Admin) และ `staff@company.com` (Viewer)

### 3.2 เว็บแอปพลิเคชัน AutoMail Insurance Management ครบ 8 หน้าจอ
1. **Dashboard (ภาพรวม):** สรุป 4 Metric Cards (*อีเมลทั้งหมด*, *ส่งต่อบริษัทประกันแล้ว*, *Needs Review*, *รอดำเนินการ*), ตารางรายการล่าสุด 6 รายการ, และฟิลเตอร์วันที่
2. **รายการอีเมล (Inbox):** แท็บกรองสถานะ (ทั้งหมด, ส่งต่อแล้ว, Needs Review, รอดำเนินการ), ช่องค้นหา, และปุ่มดูรายละเอียด
3. **รายละเอียดของรายการอีเมล (Detail Modal):** แสดงผู้ส่ง, ผู้รับ, วันที่, Message-ID, Thread ID, สลับดู HTML/Text, การ์ดไฟล์แนบเปิดดูใน Google Drive, ไทม์ไลน์ห่วงโซ่อีเมล (Reply Chain), และปุ่ม **"ส่งต่ออีกครั้ง" (Re-forward)**
4. **Master Data (รายชื่อลูกค้า):** ตาราง Whitelist แสดงสถานะ Active, ปุ่มเพิ่มลูกค้าใหม่ (`+ เพิ่มรายการ`), ปุ่มแก้ไขข้อมูล ซิงค์ตรงกับแผ่นงาน `Master_Data`
5. **Needs Review (ไม่พบใน Master Data):** คัดกรองอีเมลที่มีหัวข้อตรงตามระบบประกันแต่ผู้ส่งไม่อยู่ใน Whitelist พร้อมปุ่มด่วน **"+ เพิ่มเข้า Master Data ทันที"** (One-click Approval)
6. **Email Template Editor (อัปเกรด No-Code สำหรับผู้ใช้ทั่วไป):**
   - **โหมดแก้ไขแบบง่าย (Simple Form Editor):** ไม่ต้องรู้ HTML เลย กรอกหัวเรื่อง, เลือกสี (น้ำเงิน, เขียว, ส้ม, แดง, ม่วง), คำขึ้นต้น, เนื้อหาข้อความภาษาไทยธรรมดา, ติ๊กถูกเปิด/ปิดกล่องข้อมูล (`{{bookingNo}}`, `{{policyExpiry}}`, `{{driveLinks}}`), และข้อความท้ายอีเมล
   - **ปุ่มข้อความแม่แบบด่วน 1-Click:** แจ้งข้อมูลประกัน, ขอบคุณและยืนยัน, ขอเอกสารเพิ่ม, ส่งต่อบริษัทประกัน
   - **โหมดโค้ด HTML ขั้นสูง:** สำหรับผู้ดูแลระบบที่ต้องการดูหรือแก้โค้ด HTML ดิบ
   - **Live HTML Preview:** จอตัวอย่างอีเมลจริงอัปเดตแบบเรียลไทม์
7. **System Settings (ชีต `config`):** รวมการตั้งค่าทั้งหมดในชีตเดียว:
   - ข้อมูลทั่วไป และ n8n Re-forward Webhook URL
   - อีเมลบริษัทประกัน และสวิตช์เปิด/ปิด Auto Forward
   - จัดการลิงก์ไฟล์ Google Drive สำหรับแนบใน Automail
   - จัดการเพิ่ม/ลบสิทธิ์ผู้ใช้งาน (User Access: Email & Role)
8. **ประวัติการทำงาน (Activity Logs):** Audit trail บันทึกทุก Action ในระบบ

### 3.3 โครงสร้างฐานข้อมูล Google Sheets (`SPREADSHEET_ID: 12S24DnEVXj72JDarLex5Z6cEo7zla4DEULaCfEW6QWo`)
- `Master_Data`: เก็บข้อมูลลูกค้าและ Whitelist
- `Email_Logs`: เก็บประวัติอีเมลขาเข้า-ขาออก สถานะ และ Message ID
- `Settings`: การตั้งค่าระบบเดิม
- `Templates`: เทมเพลตอีเมลและโค้ด HTML
- `config`: แผ่นงานใหม่ที่สร้างขึ้น รองรับ Category: `SYSTEM`, `DRIVE_LINK`, `USER_ACCESS`

### 3.4 เวิร์กโฟลว์ n8n ที่บันทึกไว้ในโฟลเดอร์ `workflows/`
- `01 - Google Sheets Outbound Email (Service Account) (3).json`: ดึงข้อมูลจากชีตส่งเมลหาลูกค้า
- `02 - Inbound Monitor & Auto-Forward (IMAP to SMTP) Updated (1).json`: ตรวจจับอีเมลขาเข้า ตรวจสอบ Whitelist และส่งต่อ
- เวิร์กโฟลว์เวอร์ชันก่อนหน้าอื่นๆ ถูกจัดเก็บอยู่ในโฟลเดอร์ `workflows/` ทั้งหมด

---

## 💻 4. ขั้นตอนการติดตั้งบนเครื่อง PC เครื่องใหม่ (New PC Setup Guide)

เมื่อย้ายไปยังเครื่องใหม่ ให้ปฏิบัติตามขั้นตอนนี้ตามลำดับ:

### ขั้นตอนที่ 1: เตรียมสภาพแวดล้อม (Prerequisites)
1. ติดตั้ง **Git**: [git-scm.com](https://git-scm.com/)
2. ติดตั้ง **Node.js**: แนะนำเวอร์ชัน **20.x หรือ 22.x LTS** (เช็คด้วย `node -v` และ `npm -v`)
3. ติดตั้ง **Docker Desktop** (กรณีต้องการรัน n8n ผ่าน Docker Compose)

### ขั้นตอนที่ 2: Clone โค้ดจาก Git ลงเครื่องใหม่
```bash
git clone <URL_REPOSITORY_ของคุณ> n8n_sandbox
cd n8n_sandbox
```

### ขั้นตอนที่ 3: กู้คืนไฟล์ Environment (`.env`)
1. เข้าไปที่โฟลเดอร์ `sheets-app/server/`
2. สร้างไฟล์ชื่อ `.env` (คัดลอกจากของเดิมที่คุณสำรองไว้ หรือดูตัวอย่างใน `.env.example`)
```env
PORT=5000
SPREADSHEET_ID=12S24DnEVXj72JDarLex5Z6cEo7zla4DEULaCfEW6QWo
SHEET_NAME=Master_Data
GOOGLE_SERVICE_ACCOUNT_EMAIL=n8n-sheet-bot@n8n-test-511914.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### ขั้นตอนที่ 4: ติดตั้ง Dependencies
เปิด Terminal ในโฟลเดอร์โปรเจกต์:

```bash
# 1. ติดตั้ง Dependencies ของ Backend Server
cd sheets-app/server
npm install

# 2. ติดตั้ง Dependencies ของ Frontend Client
cd ../client
npm install
```

### ขั้นตอนที่ 5: เริ่มต้นรันระบบเว็บ (Web Application)
เปิด Terminal 2 หน้าต่าง (หรือรันแยกแท็บ):

- **หน้าต่างที่ 1: รัน Backend API (Port 5000)**
  ```bash
  cd sheets-app/server
  npm start
  ```
  *(จะขึ้นข้อความ `🚀 AutoMail Insurance Backend running on http://localhost:5000` และ `📡 Google Sheets Config Status: LIVE`)*

- **หน้าต่างที่ 2: รัน Frontend Client (Port 3000)**
  ```bash
  cd sheets-app/client
  npm run dev
  ```
  *(เปิดเว็บเบราว์เซอร์ไปที่ **`http://localhost:3000`**)*

---

## ⚙️ 5. การเปิดใช้งาน n8n บนเครื่องใหม่

### ทางเลือก A: รันผ่าน Local npm (ง่ายและเร็วที่สุด)
```bash
npx n8n
# หรือติดตั้งแบบ global: npm install -g n8n แล้วรัน: n8n start
```
เปิด `http://localhost:5678` จากนั้น Import Workflows จากโฟลเดอร์ `workflows/`:
- ไปที่หน้า UI n8n > **Workflows** > เมนูมุมขวาบน > **Import from File...**
- เลือกไฟล์:
  - `workflows/01 - Google Sheets Outbound Email (Service Account) (3).json`
  - `workflows/02 - Inbound Monitor & Auto-Forward (IMAP to SMTP) Updated (1).json`

### ทางเลือก B: รันผ่าน Docker Compose
```bash
docker compose up -d
```

---

## 🎯 6. สิ่งที่ค้างไว้และสิ่งที่ต้องทำต่อ (Roadmap & Next Steps)

เมื่อติดตั้งบนเครื่องใหม่และรันระบบขึ้นมาได้แล้ว นี่คือสิ่งที่คุณสามารถดำเนินการต่อได้ทันที:

1. **ตั้งค่า Credential จริงใน n8n:**
   - **Google Sheets Credential:** นำอีเมลและ Private Key ของ Service Account ไปใส่ใน Credential ชนิด Google Service Account ใน n8n
   - **Email SMTP / Gmail OAuth:** ผูกอีเมลสำหรับส่งอีเมลออก (Outbound Email)
   - **IMAP Trigger Credential:** ใส่บัญชีอีเมลสำหรับตรวจจับอีเมลขาเข้า (เช่น Host: `imap.gmail.com`, Port `993`, App Password)
2. **ทดสอบ Webhook การส่งต่ออีกครั้ง (Re-forward):**
   - ตรวจสอบว่าใน n8n Workflow มี Webhook Trigger รอรับคำขอที่ Path `/webhook/re-forward` หรือไม่
   - หากต้องการเปลี่ยน URL สามารถเข้าไปแก้ไขได้ที่หน้าเว็บเมนู **ตั้งค่าระบบ (Settings) > ข้อมูลทั่วไป & Webhook**
3. **ทดสอบ End-to-End Flow:**
   - ทดลองส่งอีเมลทดสอบเข้ามาที่กล่องข้อความ
   - ตรวจสอบว่า n8n ตรวจจับอีเมลและบันทึกลงชีต `Email_Logs` หรือไม่
   - ดูการแสดงผลในหน้าเว็บแท็บ **Inbox** และ **Needs Review**
   - ทดสอบกดปุ่ม **"+ เพิ่มเข้า Master Data ทันที"** และ **"ส่งต่ออีกครั้ง"**

---

## 📁 7. โครงสร้างโฟลเดอร์สรุป (Project Structure)

```text
n8n_sandbox/
├── docs/                                          # เอกสารสเปกและคู่มือ
│   ├── flow_specification.md                      # สเปกการทำงานของ n8n Flow
│   ├── management_web_plan_and_questions.md      # แผนงานและข้อสรุปทั้ง 8 หน้าจอ
│   └── PROJECT_HANDOVER_AND_MIGRATION_GUIDE.md    # [ไฟล์นี้] คู่มือย้ายเครื่องและสรุปสถานะ
├── sheets-app/                                    # ระบบเว็บ Management Portal
│   ├── server/                                    # Node.js Express API Backend
│   │   ├── .env                                   # [สำคัญ: ต้องสำรองไว้] คีย์ Google API
│   │   ├── .env.example                           # ตัวอย่างการตั้งค่า Environment
│   │   ├── googleSheets.js                        # Service เชื่อมต่อ Sheets API & Drive API
│   │   ├── index.js                               # API Endpoints (Auth, Logs, Config, CRUD)
│   │   └── package.json
│   └── client/                                    # React (Vite) Frontend
│       ├── src/
│       │   ├── App.jsx                            # โค้ดหลักครบทั้ง 8 หน้าจอ + Simple Editor
│       │   ├── App.css                            # สไตล์
│       │   └── index.css                          # Tailwind CSS & Badges
│       ├── vite.config.js                         # Proxy ไปยัง Backend (Port 5000)
│       └── package.json
├── workflows/                                     # ไฟล์ Workflow JSON สำหรับ n8n
│   ├── 01 - Google Sheets Outbound Email...json   # เวิร์กโฟลว์ส่งอีเมลออก
│   └── 02 - Inbound Monitor & Auto-Forward...json # เวิร์กโฟลว์ตรวจจับและส่งต่ออีเมล
├── Dockerfile                                     # Docker image สำหรับ n8n
├── docker-compose.yml                             # Container orchestration
├── Jenkinsfile                                    # CI/CD pipeline
├── GEMINI.md                                      # กฎและ Role ของ AI Coding Agent
└── .gitignore                                     # กรองไฟล์ sensitive ไม่ให้ขึ้น Git
```

