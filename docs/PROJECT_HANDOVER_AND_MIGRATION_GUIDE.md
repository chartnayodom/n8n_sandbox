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
    subgraph ClientLayer ["1. Frontend Client (dev: Vite 3000 / Docker: เสิร์ฟจาก server 5000)"]
        UI["React 19 + Tailwind v4 + Vite"]
        LoginUI["A. Login (USER_ACCESS + Session)"]
        DashUI["1. Dashboard (4 Metric Cards)"]
        InboxUI["2. Inbox & 5. Needs Review"]
        DetailUI["3. Email Detail & Reply Chain"]
        MasterUI["4. Master Data (Whitelist)"]
        TplUI["6. Template Editor (No-Code Form)"]
        SetUI["7. Settings & 8. Activity Logs"]
    end

    subgraph ServerLayer ["2. Backend API (dev: 3001 / Docker: 5000)"]
        API["Node.js Express Server"]
        AuthService["Session + Role Check (config sheet)"]
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

### 3.1 ระบบ Authentication & Session
- ตรวจอีเมลกับแถว `USER_ACCESS` ในชีต `config` เพื่อดึง Role (`Admin` / `Staff` / `Viewer`) ไม่มีการเช็คสิทธิ์แชร์ไฟล์บน Drive แล้ว
- server ออก session เป็น cookie httpOnly ตรวจทุก `/api/*` (ยกเว้น `/api/status`, `/api/auth/login`) หมดอายุเมื่อไม่มีการใช้งาน 2 ชม. และตรวจชีตซ้ำทุก 5 นาที
- `Admin` เท่านั้นที่เข้า `/api/config` และ `/api/templates` ได้, `Viewer` เรียกได้เฉพาะ GET
- ยังไม่มีการยืนยันตัวตน (กรอกอีเมลอย่างเดียว) รอเลือกวิธีแทน Google Sign-In
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
- `AutoMailOutbound.json` (ชื่อใน n8n: `01 - AutoMail Outbound R1/R2 (v2 Master_Data)` id คงที่ `AutoMailOutbound` import ซ้ำจะอัปเดต workflow เดิม ไม่ชนกับ workflow เวอร์ชันเก่า และ `active: false`):
  - อ่านชีต `config` ทุกครั้งที่รัน (node `Read config` → `Load Settings`): รอบ R1 = เหลือ (`r2_days_before`, `r1_days_before`] วัน, R2 = เหลือ (0, `r2_days_before`] วัน (ค่าแนะนำ 180 / 90) ค่าว่างหรือผิด = workflow หยุดและแจ้ง error ลูกค้าที่เข้ามาหลังช่วง R1 ได้แค่ R2
  - ไฟล์แนบทุกเมลมาจากหมวด `DRIVE_LINK` ในชีต `config` (ดาวน์โหลดด้วย Service Account) ดึงไฟล์ใดไม่ได้ = หยุดทั้งรอบ ไม่ส่งเมลที่เอกสารไม่ครบ ตัวแปร template: `{{driveLinks}}` = ชื่อไฟล์, `{{daysRemaining}}` = จำนวนวันที่เหลือจริง, `{{monthsAhead}}` / `{{roundLabel}}` = round(วันของรอบ / 30)
  - ตรวจสอบ `Mail_R1_Status` และ `Mail_R2_Status` ป้องกันการส่งซ้ำ หากรอบใดเคยส่งแล้ว (`Sent`) จะข้ามทันที
  - สร้างหัวข้อ (Subject) และเนื้อหาอีเมลแยกตามรอบที่ส่ง
  - อัปเดต `Mail_R1_Status` / `Mail_R1_Date` หรือ `Mail_R2_Status` / `Mail_R2_Date` กลับลงชีต `Master_Data` ตามรอบจริง
  - รายงานสรุปผลแยกตามรอบ R1 / R2 ส่งถึง `admin_report_email` ในชีต `config` (คั่นด้วย , ได้ ว่าง = ไม่ส่ง)
- `R3pXov64UiK0AkDL.json` (ชื่อใน n8n: `02 - AutoMail Inbound Router (Master_Data → Insurance / Needs Review)` id คงที่ `R3pXov64UiK0AkDL`, `active: false`) แทนที่ `a14U6Ep5Yxt4eZH1.json` และ workflow 02 เวอร์ชันเก่าทั้งหมด:
  - **Flow A (IMAP Trigger):** อ่านอีเมลใหม่ (UNSEEN, ทำเครื่องหมายอ่านแล้ว) → เทียบอีเมลผู้ส่งกับ `Master_Data`
    - **ส่งต่อบริษัทประกัน** เมื่อผู้ส่งอยู่ใน `Master_Data` **และ** (เป็นการตอบกลับอีเมลที่ระบบส่ง ตรวจจาก In-Reply-To/References เทียบ `Message_ID` ใน `Email_Logs` **หรือ** หัวข้อมี prefix ตาม `subject_prefixes` ในชีต `config`) → ส่งไป `insurance_email` พร้อมไฟล์แนบ ตั้ง Reply-To เป็นผู้ส่งเดิม → บันทึก `Forwarded` (ส่งไม่สำเร็จ = `Failed`)
      - ถ้า `auto_forward` เป็น FALSE → บันทึก `Pending` รอเจ้าหน้าที่กด "ส่งต่ออีกครั้ง" / ถ้ายังไม่ได้ตั้ง `insurance_email` → บันทึก `Failed`
    - **นอกนั้นทั้งหมด = Needs Review**: ผู้ส่งไม่อยู่ใน `Master_Data` (แม้เป็นการตอบกลับ) หรืออยู่แต่ไม่ใช่การตอบกลับและหัวข้อไม่มี prefix → บันทึก `Needs Review` พร้อมเหตุผลใน `Error_Detail` เจ้าหน้าที่จัดการในหน้า Needs Review: ส่งต่ออีกครั้ง (→ `Manually Forwarded`) / เพิ่มผู้ส่งเข้า Master Data / ปิดรายการ (→ `Closed`)
    - **ไฟล์แนบ**: ไม่เก็บสำเนา workflow บันทึกรายการไฟล์ (ลำดับ ชื่อ ชนิด ขนาด) ในคอลัมน์ `Attachments` เมื่อเจ้าหน้าที่กด "ดู" เว็บ server ต่อ IMAP เข้ากล่องจดหมาย ค้นอีเมลด้วย `Message-ID` (ในโฟลเดอร์ All Mail ของ Gmail) แล้วดึงเฉพาะไฟล์นั้น (`GET /api/emails/:logId/attachments/:index`) แสดงในหน้าได้: PNG/JPEG/GIF/WebP/PDF/ข้อความ ชนิดอื่นดาวน์โหลด
      - ต้องตั้ง `IMAP_USER` / `IMAP_PASSWORD` (App Password) ใน `sheets-app/server/.env` และอีเมลต้องยังอยู่ในกล่องจดหมาย (ลบถาวรแล้วจะเปิดไม่ได้)
      - ชุด node อัปโหลด Google Drive (`Split Attachments` → `Upload to Drive` → `Collect Attachments`) ยังอยู่ใน workflow แต่**ไม่ได้เชื่อมต่อ** เป็นทางสำรอง ถ้าจะใช้ต้องมี Shared Drive (Workspace) หรือ credential Google Drive OAuth2 เพราะ Service Account อัปโหลดเข้า My Drive ไม่ได้
    - ข้ามอีเมลที่ผู้ส่งอยู่ใน `ignore_senders` / เป็นอีเมลบริษัทประกัน และอีเมลที่ Message-ID อยู่ใน `Email_Logs` แล้ว
    - ถ้าตั้ง `review_alert_email` ในชีต `config` (คั่นด้วย , ได้) จะส่งอีเมลแจ้งเตือนเมื่อมีรายการ Needs Review
    - เมลส่งต่อ (ทั้ง Flow A และ B) ขึ้นต้น "เรียน {insurance_name}" เมื่อตั้งค่าไว้ และหัวสรุปแสดง `Current_Insurer` (Master_Data คอลัมน์ R) ของลูกค้าเมื่อมีค่า
  - **Flow B (Webhook `POST /webhook/re-forward`):** รับคำสั่ง Re-forward จากปุ่มบนเว็บ ส่งเนื้อหาที่เก็บใน `Original_Body` ไปยัง `insurance_email` จาก `config` เสมอ (ไม่ใช้ปลายทางที่มากับ request) เว็บเป็นฝ่ายเพิ่มแถว log เอง ไฟล์แนบเดิมไม่ถูกส่งซ้ำ
  - **โหมดทดสอบ:** ตั้ง `test_forward_email` ใน `Global Config` (และ `Re-forward Config` สำหรับ Flow B) ทุกฉบับจะถูกส่งไปอีเมลนั้นแทนบริษัทประกัน และ subject ขึ้นต้นด้วย `[TEST]` ปล่อยว่าง = ส่งไป `insurance_email` จริง (ปัจจุบันในชีต `config` เป็นค่าตัวอย่าง)
  - ค่าใน `config`: `n8n_webhook_url` ต้องชี้ production URL ของ webhook นี้ (ตอนนี้เป็น `http://localhost:5678/webhook/re-forward` ใช้ได้เมื่อ workflow เปิด Active และเว็บเรียกจากเครื่องที่เข้าถึง n8n ได้)
- workflow 01 เลิกเขียน n8n Data Table `email_log` แล้ว (workflow 02 ใหม่ใช้ `Email_Logs` แทน)
- เวิร์กโฟลว์เวอร์ชันก่อนหน้าเก็บไว้ในโฟลเดอร์ `workflows/` โดยขึ้นต้นชื่อไฟล์ด้วย `UNUSED_` ห้าม import เข้า production (`Dockerfile` คัดลอกเฉพาะ 2 ไฟล์ข้างบน)
- เมื่อรันด้วย Docker Compose ให้ตั้ง `n8n_webhook_url` = `http://n8n:5678/webhook/re-forward` (ดู `SETUP_AND_MAINTENANCE_GUIDE.md` หัวข้อ 2.4)

---

## 💻 4. ขั้นตอนการติดตั้งบนเครื่อง PC เครื่องใหม่ (New PC Setup Guide)

> คู่มือ deploy ฉบับเต็ม (Docker Compose, Jenkins, ตัวแปร environment ทั้งหมด) อยู่ที่ [SETUP_AND_MAINTENANCE_GUIDE.md](../SETUP_AND_MAINTENANCE_GUIDE.md) หัวข้อนี้สรุปเฉพาะการรันเพื่อพัฒนาต่อ

### ขั้นตอนที่ 1: เตรียมสภาพแวดล้อม (Prerequisites)
1. ติดตั้ง **Git**: [git-scm.com](https://git-scm.com/)
2. ติดตั้ง **Node.js 20.19 – 24.x** (แนะนำ 22 LTS) เช็คด้วย `node -v` และ `npm -v`
3. ติดตั้ง **Docker Desktop** (กรณีต้องการรันทั้งระบบผ่าน Docker Compose)

### ขั้นตอนที่ 2: Clone โค้ดจาก Git ลงเครื่องใหม่
```bash
git clone <URL_REPOSITORY_ของคุณ> n8n_sandbox
cd n8n_sandbox
```

### ขั้นตอนที่ 3: กู้คืนไฟล์ Environment (`.env`)
1. `sheets-app/server/.env`: คัดลอกของเดิมที่สำรองไว้ หรือคัดลอกจาก `sheets-app/server/.env.example` แล้วกรอกค่า
```env
PORT=3001
SPREADSHEET_ID=<Spreadsheet ID>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account>@<project>.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=<กล่องจดหมายที่ workflow 02 อ่าน>
IMAP_PASSWORD=<App Password>
```
   * `PORT` ต้องเป็น `3001` ตอนพัฒนา เพราะ Vite proxy `/api` ไปที่ `http://localhost:3001` (ใน Docker ถูกบังคับเป็น 5000 อยู่แล้ว)
   * `SHEET_NAME` ไม่ถูกใช้ใน code แล้ว ไม่ต้องใส่
2. `.env` ที่โฟลเดอร์ราก (สำหรับ n8n): คัดลอกจาก `.env.example` แล้วใส่ `N8N_ENCRYPTION_KEY` (ค่าเดิมถ้าจะใช้ `credentials.json` เดิม)

### ขั้นตอนที่ 4: ติดตั้ง Dependencies
```bash
npm install                                  # n8n 2.8.4 ที่โฟลเดอร์ราก
npm --prefix sheets-app/server install       # Backend
npm --prefix sheets-app/client install       # Frontend
```

### ขั้นตอนที่ 5: เริ่มต้นรันระบบเว็บ (Web Application)
เปิด Terminal 2 หน้าต่าง:

- **หน้าต่างที่ 1: Backend API (Port 3001)**
  ```bash
  cd sheets-app/server
  npm run dev      # หรือ npm start
  ```
  *(จะขึ้น `🚀 AutoMail Insurance Backend running on http://localhost:3001` และ `📡 Google Sheets Config Status: LIVE ...` ถ้าเป็น `DEMO MODE` แปลว่าค่า Google ใน .env ยังไม่ครบ)*

- **หน้าต่างที่ 2: Frontend Client (Port 3000)**
  ```bash
  cd sheets-app/client
  npm run dev
  ```
  *(เปิดเว็บเบราว์เซอร์ไปที่ **`http://localhost:3000`**)*

---

## ⚙️ 5. การเปิดใช้งาน n8n บนเครื่องใหม่

### ทางเลือก A: รันผ่าน Local npm
```bash
npm start        # = n8n start (ใช้ n8n 2.8.4 ที่ติดตั้งในโปรเจกต์)
```
เปิด `http://localhost:5678` สร้างบัญชี owner แล้ว import **เฉพาะ** workflow ที่ใช้งานจริง (ไม่ import ไฟล์ `UNUSED_*`):
```bash
npx n8n import:workflow --input=./workflows/AutoMailOutbound.json
npx n8n import:workflow --input=./workflows/R3pXov64UiK0AkDL.json
```
หรือใน UI: **Workflows** > เมนูมุมขวาบน > **Import from File...** เลือก 2 ไฟล์ข้างบน

### ทางเลือก B: รันทั้งระบบผ่าน Docker Compose (n8n + เว็บ)
```bash
docker compose up -d --build
docker exec -u node n8n_auto_email n8n import:workflow --separate --input=/home/node/workflows/
docker restart n8n_auto_email
```
n8n อยู่ที่ `http://localhost:5678` เว็บอยู่ที่ `http://localhost:5000` (รายละเอียดดู SETUP_AND_MAINTENANCE_GUIDE.md หัวข้อ 2)

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
│   ├── management_web_plan_and_questions.md       # แผนงานและข้อสรุปทั้ง 8 หน้าจอ
│   ├── CUSTOMER_HANDOVER_CHECKLIST.md             # รายการย้ายระบบไปบัญชีของลูกค้า
│   └── PROJECT_HANDOVER_AND_MIGRATION_GUIDE.md    # [ไฟล์นี้] คู่มือย้ายเครื่องและสรุปสถานะ
├── sheets-app/                                    # ระบบเว็บ Management Portal
│   ├── Dockerfile                                 # build client (Vite) + server (Express) เป็น image เดียว พอร์ต 5000
│   ├── server/                                    # Node.js Express API Backend
│   │   ├── .env                                   # [สำคัญ: ต้องสำรองไว้] คีย์ Google API + IMAP
│   │   ├── .env.example                           # ตัวอย่างการตั้งค่า Environment
│   │   ├── googleSheets.js                        # Service เชื่อมต่อ Sheets API & Drive API
│   │   ├── mailbox.js                             # เปิดไฟล์แนบจากกล่องจดหมายผ่าน IMAP ด้วย Message-ID
│   │   ├── index.js                               # API Endpoints + เสิร์ฟหน้าเว็บที่ build แล้ว (public/)
│   │   └── package.json
│   └── client/                                    # React (Vite) Frontend
│       ├── src/
│       │   ├── App.jsx                            # โค้ดหลักครบทั้ง 8 หน้าจอ + Simple Editor
│       │   ├── App.css                            # สไตล์
│       │   └── index.css                          # Tailwind CSS & Badges
│       ├── vite.config.js                         # dev server 3000, proxy /api → localhost:3001
│       └── package.json
├── workflows/                                     # ไฟล์ Workflow JSON สำหรับ n8n
│   ├── AutoMailOutbound.json                      # workflow 01: ส่งอีเมลแจ้งเตือน R1/R2
│   ├── R3pXov64UiK0AkDL.json                      # workflow 02: Inbound Router + webhook re-forward
│   └── UNUSED_*.json                              # เวอร์ชันเก่า ไม่ใช้งาน
├── scripts/                                       # export-workflows.(sh|ps1), init-sqlite.js (ระบบเก่า)
├── Dockerfile                                     # image n8n 2.8.4 + workflow 2 ไฟล์
├── docker-compose.yml                             # service n8n (5678) + web (5000)
├── Jenkinsfile                                    # CI/CD pipeline
├── SETUP_AND_MAINTENANCE_GUIDE.md                 # คู่มือ deploy และดูแลระบบ
├── CONTEXT.md                                     # คำศัพท์ของโดเมน
├── GEMINI.md / AGENTS.md / CLAUDE.md              # กฎและ Role ของ AI Coding Agent
└── .gitignore                                     # กรองไฟล์ sensitive ไม่ให้ขึ้น Git
```
