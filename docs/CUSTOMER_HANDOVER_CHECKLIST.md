# รายการเตรียมส่งมอบระบบให้ลูกค้า (ย้ายจากบัญชีส่วนตัวไปบัญชีกลางของลูกค้า)

ตอนนี้ทุกอย่างผูกกับบัญชีส่วนตัวของผู้พัฒนา เอกสารนี้คือสิ่งที่ต้องสร้างใหม่ในบัญชีของลูกค้า เรียงตามลำดับที่ต้องทำ ทำครบแล้วค่อยยกเลิกสิทธิ์ของบัญชีส่วนตัว (หัวข้อ 9)

## 0. สิ่งที่ผูกกับบัญชีส่วนตัวตอนนี้

| รายการ | อยู่ที่ไหน | ต้องเปลี่ยนเป็น |
|---|---|---|
| Google Cloud project + Service Account + JSON key | `sheets-app/server/.env` (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) และ credential "Google Service Account account" ใน n8n | project และ Service Account ใหม่ในบัญชีลูกค้า |
| Google Sheet (Master_Data, Email_Logs, Call_Logs, Templates, config, Settings) | เจ้าของเป็นบัญชีส่วนตัว, ID อยู่ใน `.env` และฝังใน node Google Sheets ของ workflow 01 (6 node) และ 02 (8 node) | สำเนาใน Drive ของบัญชีกลาง |
| ไฟล์แนบของอีเมลแจ้งเตือน R1/R2 (2 ไฟล์) | ID ไฟล์ฝังใน node "Download file1" / "Download file" ของ workflow 01 | ไฟล์ใน Drive ของบัญชีกลาง |
| ผู้ส่งอีเมล (SMTP) | credential "SMTP account" ใน n8n, `sender_email` ใน Global Config ของ workflow 01/02 และ Re-forward Config | อีเมลกลางของลูกค้า |
| กล่องจดหมายขาเข้า (IMAP) | credential "IMAP account" ใน n8n และ `IMAP_USER` / `IMAP_PASSWORD` ใน `sheets-app/server/.env` | อีเมลกลางของลูกค้า |
| อีเมลรับรายงานสรุป | `admin_report_email` ใน Global Config ของ workflow 01 | อีเมลผู้ดูแลฝั่งลูกค้า |
| ผู้ใช้เว็บ | ชีต `config` หมวด `USER_ACCESS` และสิทธิ์แชร์ของ Google Sheet | เจ้าหน้าที่ของลูกค้า |
| n8n instance และ `N8N_ENCRYPTION_KEY` | เครื่องผู้พัฒนา | เครื่อง/เซิร์ฟเวอร์ของลูกค้า พร้อม key ใหม่ |

## 1. บัญชีที่ลูกค้าต้องเตรียม

- [ ] **อีเมลกลาง** (เช่น `insurance-desk@<โดเมนลูกค้า>`) ใช้ทั้งส่ง (SMTP) และรับ (IMAP)
  - [ ] เปิด 2-Step Verification
  - [ ] สร้าง App Password (ใช้ตัวเดียวกันทั้ง n8n และเว็บ หรือแยก 2 ตัวเพื่อยกเลิกแยกกันได้)
  - [ ] ถ้าเป็น Google Workspace: ให้ admin อนุญาต IMAP และ App Password ในโดเมน
- [ ] **บัญชี Google ที่เป็นเจ้าของ Sheet และไฟล์ใน Drive** ใช้อีเมลกลางได้เลย
- [ ] **อีเมลบริษัทประกันจริง** ที่จะรับอีเมลส่งต่อ (ตอนนี้ในชีต `config` เป็นค่าตัวอย่าง `insurance@company.com`)
- [ ] **รายชื่อเจ้าหน้าที่** ที่จะใช้เว็บ พร้อมสิทธิ์ (Admin / Viewer)

## 2. Google Cloud (สร้างด้วยบัญชีลูกค้า)

- [ ] สร้าง project ใหม่
- [ ] เปิด **Google Sheets API** และ **Google Drive API**
- [ ] สร้าง Service Account แล้วสร้าง JSON key
  - ถ้าเป็น Google Workspace ที่สร้างใหม่ การสร้าง key อาจถูกนโยบายองค์กร `iam.disableServiceAccountKeyCreation` บล็อกไว้ ต้องให้ admin ยกเว้นให้ project นี้
- [ ] เก็บ JSON key ในที่ปลอดภัย ห้าม commit ลง Git
- หมายเหตุ: Service Account อัปโหลดไฟล์เข้า My Drive ไม่ได้ (พื้นที่ 0 ไบต์) ระบบตอนนี้เปิดไฟล์แนบจากกล่องจดหมายแทน จึงไม่ต้องอัปโหลด ถ้าอนาคตจะเปิดการอัปโหลด (ชุด node สำรองใน workflow 02) ต้องใช้ Shared Drive ของ Workspace หรือ credential OAuth2

## 3. Google Sheet

- [ ] เปิด Sheet ปัจจุบัน → File → Make a copy ไปไว้ใน Drive ของบัญชีกลาง (ได้ทุกแท็บและหัวคอลัมน์ครบ)
- [ ] ลบข้อมูลทดสอบ: แถวลูกค้าใน `Master_Data`, แถวใน `Email_Logs` และ `Call_Logs` (เก็บแถวหัวคอลัมน์ไว้)
- [ ] แชร์ Sheet ให้อีเมล Service Account ใหม่ สิทธิ์ **Editor**
- [ ] แชร์ Sheet ให้เจ้าหน้าที่ที่จะใช้เว็บ (เว็บตรวจสิทธิ์การแชร์ไฟล์นี้ตอน login)
- [ ] แก้ชีต `config`:
  - [ ] `insurance_email`, `insurance_name` = ค่าจริง
  - [ ] `USER_ACCESS` = อีเมลเจ้าหน้าที่ของลูกค้า และลบอีเมลส่วนตัวออก
  - [ ] `n8n_webhook_url` = URL ของ n8n ฝั่งลูกค้า (`https://<n8n-host>/webhook/re-forward`)
  - [ ] `subject_prefixes` = prefix หัวข้อที่ลูกค้าใช้
  - [ ] `attachment_folder_id` = เว้นว่าง (ไม่ได้ใช้การอัปโหลดลง Drive)
- [ ] ตรวจเนื้อหา template `R1 - 6 เดือน` / `R2 - 3 เดือน` ในชีต `Templates`: ชื่อบริษัท คำลงท้าย และช่องทางติดต่อของลูกค้า
- [ ] จด Spreadsheet ID ใหม่ (ส่วนกลางของ URL `docs.google.com/spreadsheets/d/<ID>/edit`)

## 4. ไฟล์แนบของอีเมลแจ้งเตือน (workflow 01)

- [ ] อัปโหลดไฟล์ 2 ไฟล์ที่แนบไปกับอีเมล R1/R2 เข้า Drive ของบัญชีกลาง
- [ ] แชร์ให้อีเมล Service Account สิทธิ์ **Viewer**
- [ ] ใส่ลิงก์ใหม่ใน node "Download file1" และ "Download file" ของ workflow 01

## 5. n8n (เครื่องของลูกค้า)

- [ ] ติดตั้งตาม `SETUP_AND_MAINTENANCE_GUIDE.md` (Docker แนะนำ) และสร้าง `N8N_ENCRYPTION_KEY` ใหม่ ห้ามใช้ key ของเครื่องผู้พัฒนา
- [ ] สร้างบัญชีเจ้าของ n8n ด้วยอีเมลกลาง
- [ ] สร้าง credential ใหม่ 3 ตัว ห้ามนำ `credentials.json` จากเครื่องผู้พัฒนาไปใช้:
  - [ ] Google Service Account: อีเมลและ private key จาก JSON key ข้อ 2
  - [ ] SMTP: Gmail ใช้ `smtp.gmail.com` พอร์ต 465 (SSL), user = อีเมลกลาง, password = App Password
  - [ ] IMAP: Gmail ใช้ `imap.gmail.com` พอร์ต 993 (SSL), user = อีเมลกลาง, password = App Password
- [ ] import `workflows/c7AnideudYIbfvmK.json` (workflow 01) และ `workflows/02-AutoMail-Inbound-Router.json` (workflow 02) แล้วเลือก credential ใหม่ในทุก node ที่ขึ้นเตือน
- [ ] เปลี่ยน Spreadsheet ID ในทุก node Google Sheets (workflow 01: 6 node, workflow 02: 8 node) เป็น ID ใหม่จากข้อ 3
- [ ] แก้ Global Config:
  - [ ] workflow 01: `sender_email` = อีเมลกลาง, `admin_report_email` = อีเมลผู้ดูแลฝั่งลูกค้า, `test_recipient_email` = ว่าง
  - [ ] workflow 02: `sender_email` = อีเมลกลาง, `ignore_senders` = อีเมลกลาง (กันวนตอบตัวเอง), `test_forward_email` = ว่าง, `review_alert_email` = อีเมลที่ต้องการให้แจ้งเตือน (ถ้ามี)
  - [ ] workflow 02 node "Re-forward Config": `sender_email` = อีเมลกลาง, `test_forward_email` = ว่าง
- [ ] ทดสอบด้วยโหมดทดสอบก่อน (หัวข้อ 8) แล้วค่อยกด Active ทั้ง 2 workflow

## 6. เว็บ (sheets-app)

- [ ] คัดลอก `sheets-app/server/.env.example` เป็น `.env` แล้วกรอก:
  - `SPREADSHEET_ID` = ID ใหม่
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` = จาก JSON key ข้อ 2 (คง `\n` ใน key ไว้)
  - `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD` = กล่องจดหมายกลาง (ใช้เปิดไฟล์แนบจากอีเมลด้วย Message-ID)
- [ ] ติดตั้งบนเครื่องของลูกค้าด้วย `docker compose up -d --build` (service `web` อยู่ใน compose เดียวกับ n8n) เปิดผ่าน HTTPS และตั้ง `n8n_webhook_url` ในชีต `config` เป็น `http://n8n:5678/webhook/re-forward`

## 7. เรื่องความปลอดภัยที่ต้องแก้ก่อนใช้งานจริง

- [ ] **หน้า login ไม่มีการยืนยันตัวตน:** ตอนนี้กรอกแค่อีเมลที่อยู่ใน `USER_ACCESS` ก็เข้าได้ ไม่มีรหัสผ่าน token เป็นค่าที่ server ไม่ตรวจ และ API ทุกเส้นเรียกได้โดยไม่ต้อง login ต้องทำ Google Sign-In ตามแผนใน `docs/management_web_plan_and_questions.md` และตรวจ session ที่ server ก่อนเปิดให้ใช้งาน
- [ ] server เปิด CORS ให้ทุกโดเมน ควรจำกัดเฉพาะโดเมนของเว็บ
- [ ] webhook `re-forward` ของ n8n ไม่มีรหัสยืนยัน (ส่งได้เฉพาะไปอีเมลบริษัทประกันใน config จึงเสี่ยงต่ำ) ควรเพิ่ม header secret ถ้าเปิด n8n สู่อินเทอร์เน็ต
- [ ] ประวัติการทำงานของเว็บเก็บใน memory ของ server หายเมื่อรีสตาร์ท ถ้าต้องใช้เป็นหลักฐาน ควรย้ายลงชีต

## 8. ทดสอบก่อนเปิดใช้

- [ ] workflow 01: กรอก `test_recipient_email` → Manual Trigger → ตรวจว่าอีเมล `[TEST]` มาถึง, `Master_Data` อัปเดต `Mail_R1/R2_Status`, `Email_Logs` มีแถวใหม่ → ล้าง `test_recipient_email` และคืนสถานะแถวที่ทดสอบเป็น `Pending`
- [ ] workflow 02: กรอก `test_forward_email` → ส่งอีเมลจากอีเมลลูกค้าใน Master Data (หัวข้อมี prefix และมีไฟล์แนบ) → ตรวจว่าถูกส่งต่อ, `Email_Logs` เป็น `Forwarded` → ส่งจากอีเมลที่ไม่อยู่ใน Master Data → ตรวจว่าเข้าหน้า Needs Review
- [ ] เว็บ: login, เปิดไฟล์แนบจากหน้ารายละเอียดอีเมล, กด "ส่งต่ออีกครั้ง", บันทึกการโทรในหน้า "ติดตามลูกค้า"

## 9. หลังส่งมอบ: ยกเลิกสิทธิ์ของบัญชีส่วนตัว

- [ ] ลบ JSON key ของ Service Account เดิมใน Google Cloud ส่วนตัว (หรือลบ Service Account ทั้งตัว)
- [ ] ยกเลิก App Password ของอีเมลส่วนตัวที่ใช้ทดสอบ
- [ ] ลบอีเมลส่วนตัวออกจากการแชร์ Sheet และจาก `USER_ACCESS`
- [ ] ลบ `.env` และ credential ของ n8n บนเครื่องผู้พัฒนาที่ชี้ไปบัญชีส่วนตัว
