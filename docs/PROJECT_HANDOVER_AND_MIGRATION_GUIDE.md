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

**หัวคอลัมน์แถวที่ 1 ในชีตจริง (ตรวจแล้วเมื่อ 2026-11-03)** เว็บอ่านด้วยตำแหน่งคอลัมน์ แต่ n8n อ่านด้วยชื่อหัว ห้ามเปลี่ยนชื่อหัวโดยไม่แก้ workflow:
- `Master_Data` (A:Q): `ID, Customer_Name, Email, Phone, Insurance_Type, Policy_No, Expiry_Date, Data_Status, Review_Reason, Mail_R1_Status, Mail_R1_Date, Mail_R2_Status, Mail_R2_Date, Customer_Status, Next_Followup_Date, Assigned_Agent, Notes`
  - `Data_Status` ต้องเป็น `Valid` (หรือว่าง) จึงจะส่งเมล `Invalid` / `ข้อมูลไม่ครบ` ถูกข้าม เว็บตั้ง `ข้อมูลไม่ครบ` + `Review_Reason` ให้อัตโนมัติเมื่อบันทึกข้อมูลที่อีเมลไม่ถูกต้องหรือไม่มีวันหมดอายุ (หน้า Master Data มีตัวกรอง "ข้อมูลไม่ครบ")
  - `Mail_R1/R2_Status`: `Sent`/`สำเร็จ`/`Skipped` = ไม่ส่งรอบนั้นอีก, `Pending`/ว่าง = ยังส่งได้
  - `Customer_Status`: `รอดำเนินการ`, `สนใจ / ดำเนินการต่อ`, `นัดหมายติดตาม`, `ยังไม่สนใจ` (หยุดส่ง R2), `ไม่ติดต่อ / ปิดงาน` (หยุดส่งทุกรอบ)
- `Email_Logs` (A:L): `Log_ID, Sent_Timestamp, Customer_ID, Customer_Name, Recipient_Email, Mail_Round, Subject, Message_ID, Send_Status, Error_Detail, Original_Body, Attachments` (เว็บอ่าน A:J และ L; `Original_Body` คอลัมน์ K เก็บเนื้อหาอีเมลขาเข้าไว้ให้ Re-forward; `Attachments` คอลัมน์ L เป็น JSON `[{index, name, mimeType, size}]` รายการไฟล์แนบในอีเมล เว็บเปิดไฟล์จากกล่องจดหมายด้วย Message-ID ตามลำดับนี้ (รายการที่มี `id` = ไฟล์ใน Google Drive กรณีเปิดใช้การอัปโหลด))
  - workflow 01 (ส่งออก) เพิ่มแถว `Send_Status` = `Sent` / `Failed`
  - workflow 02 (ขาเข้า) เพิ่มแถว `Forwarded` / `Failed` / `Needs Review` โดย `Recipient_Email` = อีเมลผู้ส่งของอีเมลขาเข้า
- `Call_Logs` (A:J): `Call_ID, Call_Timestamp, Customer_ID, Customer_Name, Phone, Agent_Name, Call_Result, Customer_Interest, Next_Appointment, Call_Notes` บันทึกจากหน้า "ติดตามลูกค้า" ของเว็บ (`POST /api/call-logs`): `Customer_Interest` = สถานะลูกค้าหลังโทร, `Next_Appointment` = วันนัด yyyy-mm-dd และอัปเดต `Customer_Status` / `Next_Followup_Date` / `Assigned_Agent` ใน `Master_Data` (เขียนเฉพาะคอลัมน์ N:P) คิวโทร = ลูกค้าที่ได้รับอีเมล R1/R2 แล้ว และยังไม่ "ไม่ติดต่อ / ปิดงาน"
- `Templates` (A:G): `Template_ID, Template_Name, Subject, Recipient_Type, Status, Description, HTML_Content` workflow เลือก template รอบ R1/R2 จาก `Template_Name` = `R1 - 6 เดือน` / `R2 - 3 เดือน` (ตั้งชื่อใน `Global Config`) ซึ่งเพิ่มไว้แล้วเป็น `TPL-05` / `TPL-06` ตัวแปรที่ใช้ได้: `{{customerName}} {{policyNo}} {{policyExpiry}} {{insuranceType}} {{roundLabel}} {{monthsAhead}} {{driveLinks}}` (`{{customerName}}` ใช้ชื่อตามชีตตรงๆ ไม่ต้องใส่คำว่า "คุณ" นำหน้า)

**โหมดทดสอบการส่งอีเมล:** ตั้ง `test_recipient_email` ใน node `Global Config` เป็นอีเมลที่ต้องการ ทุกฉบับจะถูกส่งไปอีเมลนั้นแทนอีเมลลูกค้า และ subject จะขึ้นต้นด้วย `[TEST]` (log ใน `Email_Logs` บันทึกอีเมลที่ส่งจริง) ปล่อยว่าง = ส่งถึงลูกค้าจริง

### 3.4 เวิร์กโฟลว์ n8n ที่บันทึกไว้ในโฟลเดอร์ `workflows/`
- `c7AnideudYIbfvmK.json` (ชื่อใน n8n: `01 - AutoMail Outbound R1/R2 (v2 Master_Data)` id คงที่ `AutoMailOutbound` import ซ้ำจะอัปเดต workflow เดิม ไม่ชนกับ workflow เวอร์ชันเก่า และ `active: false`):
  - **[อัปเดตล่าสุด]:** เพิ่มระบบตรวจสอบรอบการส่ง Auto Email ล่วงหน้า 6 เดือน (R1: 91 - 180 วัน) และ 3 เดือน (R2: 1 - 90 วัน) อัตโนมัติ
  - ตรวจสอบ `Mail_R1_Status` และ `Mail_R2_Status` ป้องกันการส่งซ้ำ หากรอบใดเคยส่งแล้ว (`Sent`) จะข้ามทันที
  - สร้างหัวข้อ (Subject) และเนื้อหาอีเมลแยกตามรอบที่ส่ง
  - อัปเดต `Mail_R1_Status` / `Mail_R1_Date` หรือ `Mail_R2_Status` / `Mail_R2_Date` กลับลงชีต `Master_Data` ตามรอบจริง
  - ปรับปรุงรายงานสรุปผล (Summary Report) ให้แสดงสถิติการส่งสำเร็จแยกตามรอบ 6M และ 3M
- `02-AutoMail-Inbound-Router.json` (ชื่อใน n8n: `02 - AutoMail Inbound Router (Master_Data → Insurance / Needs Review)` id คงที่ `AutoMailInbound2`, `active: false`) แทนที่ `a14U6Ep5Yxt4eZH1.json` และ workflow 02 เวอร์ชันเก่าทั้งหมด:
  - **Flow A (IMAP Trigger):** อ่านอีเมลใหม่ (UNSEEN, ทำเครื่องหมายอ่านแล้ว) → เทียบอีเมลผู้ส่งกับ `Master_Data`
    - **ส่งต่อบริษัทประกัน** เมื่อผู้ส่งอยู่ใน `Master_Data` **และ** (เป็นการตอบกลับอีเมลที่ระบบส่ง ตรวจจาก In-Reply-To/References เทียบ `Message_ID` ใน `Email_Logs` **หรือ** หัวข้อมี prefix ตาม `subject_prefixes` ในชีต `config`) → ส่งไป `insurance_email` พร้อมไฟล์แนบ ตั้ง Reply-To เป็นผู้ส่งเดิม → บันทึก `Forwarded` (ส่งไม่สำเร็จ = `Failed`)
      - ถ้า `auto_forward` เป็น FALSE → บันทึก `Pending` รอเจ้าหน้าที่กด "ส่งต่ออีกครั้ง" / ถ้ายังไม่ได้ตั้ง `insurance_email` → บันทึก `Failed`
    - **นอกนั้นทั้งหมด = Needs Review**: ผู้ส่งไม่อยู่ใน `Master_Data` (แม้เป็นการตอบกลับ) หรืออยู่แต่ไม่ใช่การตอบกลับและหัวข้อไม่มี prefix → บันทึก `Needs Review` พร้อมเหตุผลใน `Error_Detail` เจ้าหน้าที่จัดการในหน้า Needs Review: ส่งต่ออีกครั้ง (→ `Manually Forwarded`) / เพิ่มผู้ส่งเข้า Master Data / ปิดรายการ (→ `Closed`)
    - **ไฟล์แนบ**: ไม่เก็บสำเนา workflow บันทึกรายการไฟล์ (ลำดับ ชื่อ ชนิด ขนาด) ในคอลัมน์ `Attachments` เมื่อเจ้าหน้าที่กด "ดู" เว็บ server ต่อ IMAP เข้ากล่องจดหมาย ค้นอีเมลด้วย `Message-ID` (ในโฟลเดอร์ All Mail ของ Gmail) แล้วดึงเฉพาะไฟล์นั้น (`GET /api/emails/:logId/attachments/:index`) แสดงในหน้าได้: PNG/JPEG/GIF/WebP/PDF/ข้อความ ชนิดอื่นดาวน์โหลด
      - ต้องตั้ง `IMAP_USER` / `IMAP_PASSWORD` (App Password) ใน `sheets-app/server/.env` และอีเมลต้องยังอยู่ในกล่องจดหมาย (ลบถาวรแล้วจะเปิดไม่ได้)
      - ชุด node อัปโหลด Google Drive (`Split Attachments` → `Upload to Drive` → `Collect Attachments`) ยังอยู่ใน workflow แต่**ไม่ได้เชื่อมต่อ** เป็นทางสำรอง ถ้าจะใช้ต้องมี Shared Drive (Workspace) หรือ credential Google Drive OAuth2 เพราะ Service Account อัปโหลดเข้า My Drive ไม่ได้
    - ข้ามอีเมลที่ผู้ส่งอยู่ใน `ignore_senders` / เป็นอีเมลบริษัทประกัน และอีเมลที่ Message-ID อยู่ใน `Email_Logs` แล้ว
    - ถ้าตั้ง `review_alert_email` ใน `Global Config` จะส่งอีเมลแจ้งเตือนเมื่อมีรายการ Needs Review
  - **Flow B (Webhook `POST /webhook/re-forward`):** รับคำสั่ง Re-forward จากปุ่มบนเว็บ ส่งเนื้อหาที่เก็บใน `Original_Body` ไปยัง `insurance_email` จาก `config` เสมอ (ไม่ใช้ปลายทางที่มากับ request) เว็บเป็นฝ่ายเพิ่มแถว log เอง ไฟล์แนบเดิมไม่ถูกส่งซ้ำ
  - **โหมดทดสอบ:** ตั้ง `test_forward_email` ใน `Global Config` (และ `Re-forward Config` สำหรับ Flow B) ทุกฉบับจะถูกส่งไปอีเมลนั้นแทนบริษัทประกัน และ subject ขึ้นต้นด้วย `[TEST]` ปล่อยว่าง = ส่งไป `insurance_email` จริง (ปัจจุบันในชีต `config` เป็นค่าตัวอย่าง)
  - ค่าใน `config`: `n8n_webhook_url` ต้องชี้ production URL ของ webhook นี้ (ตอนนี้เป็น `http://localhost:5678/webhook/re-forward` ใช้ได้เมื่อ workflow เปิด Active และเว็บเรียกจากเครื่องที่เข้าถึง n8n ได้)
- workflow 01 เลิกเขียน n8n Data Table `email_log` แล้ว (workflow 02 ใหม่ใช้ `Email_Logs` แทน)
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
  - `workflows/c7AnideudYIbfvmK.json`
  - `workflows/a14U6Ep5Yxt4eZH1.json`

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

