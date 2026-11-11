# คู่มือเตรียมบัญชีสำหรับ Setup ระบบ AutoMail Insurance

2026-11-10

ก่อน Setup ฝั่งลูกค้าต้องเตรียม 3 อย่าง: อีเมลกลางพร้อม App Password (ใช้ส่งและรับอีเมลผ่าน Gmail), Service Account ของ Google Cloud (ให้ระบบเข้าถึง Google Sheet และ Drive) และ Google Sheet ที่เป็นฐานข้อมูล ขาดอย่างใดอย่างหนึ่ง ระบบจะทำงานไม่ครบ

## 1. ภาพรวม: บัญชีที่ต้องเตรียมและใช้ทำอะไร

ระบบมี 2 ส่วนที่ทำงานร่วมกัน คือ workflow อัตโนมัติบน n8n (ส่งอีเมลแจ้งเตือนก่อนกรมธรรม์หมดอายุ และส่งต่ออีเมลตอบกลับให้ AIA) กับเว็บจัดการ (Management Website) ทั้งสองส่วนใช้ Google Sheet เป็นฐานข้อมูลเดียวกัน

| สิ่งที่ต้องเตรียม | ใช้ทำอะไรในระบบ | ใช้โดย |
| --- | --- | --- |
| อีเมลกลาง (Gmail หรือ Google Workspace) | ส่งอีเมลแจ้งเตือนถึงลูกค้า (SMTP) และรับอีเมลตอบกลับเพื่อส่งต่อให้ AIA (IMAP) อีเมลนี้คือชื่อผู้ส่งที่ลูกค้าเห็น | n8n (SMTP, IMAP), เว็บ (IMAP) |
| App Password | รหัสผ่านเฉพาะแอปสำหรับ SMTP/IMAP ใช้แทนรหัสผ่านจริงของอีเมล | n8n, เว็บ |
| Service Account (Google Cloud) | ให้ระบบอ่าน/เขียน Google Sheet และดึงไฟล์แนบจาก Google Drive โดยไม่ต้องมีคนล็อกอิน | n8n, เว็บ |
| Google Sheet | ฐานข้อมูลของระบบ: Master_Data, Email_Logs, Call_Logs, Templates, config | n8n, เว็บ |
| อีเมลปลายทางของ AIA | รับอีเมลที่ระบบส่งต่อ (กำหนดในชีต config) | n8n |

## 2. อีเมลกลาง: Gmail SMTP/IMAP และ App Password

ระบบใช้ Gmail เป็นตัวส่งและรับอีเมล เพราะตั้งค่าง่ายและไม่มีค่าใช้จ่ายเพิ่ม แต่มีข้อจำกัด 3 ข้อที่ต้องรู้ก่อนเลือกอีเมล

**ข้อจำกัดของ Gmail**

1. **ชื่อผู้ส่งผูกกับบัญชีที่ล็อกอิน** อีเมลที่ลูกค้าเห็นเป็นผู้ส่งคือบัญชีที่ระบบใช้ล็อกอิน SMTP จึงต้องเป็นอีเมลที่ใช้ติดต่อลูกค้าและ AIA โดยตรง ระบบตั้งให้แสดงเป็นอีเมลอื่นไม่ได้ (ถ้าต้องการใช้ที่อยู่อื่น ต้องให้ทีมพัฒนาทดสอบการตั้ง alias "Send mail as" ของ Gmail ก่อน ซึ่งยังไม่ได้ทดสอบกับระบบนี้)
2. **ต้องเปิด 2-Step Verification** Google ให้สร้าง App Password ได้เฉพาะบัญชีที่เปิด 2-Step Verification แล้ว
3. **Gmail จำกัดจำนวนการส่งต่อวัน** Google Workspace ส่งได้ 2,000 ข้อความต่อผู้ใช้ต่อวัน (ไม่เกิน 100 ผู้รับต่อข้อความ) ส่วน Gmail ส่วนตัวประมาณ 500 ข้อความต่อวัน (หน้า help ของ Google ไม่ได้ระบุตัวเลขล่าสุด ให้ตรวจก่อนใช้งานจริง) และ Google ระบุว่าอาจปรับ limit โดยไม่แจ้งล่วงหน้า

ปริมาณที่ระบบส่งต่อวันประกอบด้วย อีเมลแจ้งเตือน R1/R2 (ลูกค้าแต่ละรายได้รับแต่ละรอบไม่เกิน 1 ครั้ง), อีเมลส่งต่อให้ AIA และรายงานสรุป ทีมพัฒนาประเมินว่ายังต่ำกว่า limit แนะนำให้ใช้ Google Workspace ถ้าลูกค้ามี เพราะ limit สูงกว่าและ admin ควบคุมสิทธิ์ได้

**ขั้นตอนเตรียม**

1. เลือกอีเมลกลางที่ใช้ติดต่อลูกค้าและ AIA โดยตรง (เช่น insurance-desk@โดเมนลูกค้า) ใช้ทั้งส่งและรับ
2. เปิด 2-Step Verification ที่ Google Account → Security → 2-Step Verification
3. ถ้าเป็น Google Workspace ให้ admin อนุญาต IMAP และ App Password ในโดเมน
4. สร้าง App Password (รหัส 16 หลัก) ที่ Google Account → Security → 2-Step Verification → App passwords แนะนำสร้าง 2 ตัว ตั้งชื่อ n8n และ web เพื่อยกเลิกแยกกันได้
5. ส่ง App Password ให้ทีมพัฒนาผ่านช่องทางที่ปลอดภัย Google แสดงรหัสให้ดูครั้งเดียว ถ้าทำหายต้องสร้างใหม่

**ค่าที่ใช้ตั้งค่าในระบบ**

| | SMTP (ส่ง) | IMAP (รับ) |
| --- | --- | --- |
| เซิร์ฟเวอร์ | smtp.gmail.com | imap.gmail.com |
| พอร์ต | 465 (SSL) | 993 (SSL) |
| User | อีเมลกลาง | อีเมลกลาง |
| Password | App Password | App Password |

**ถ้าไม่เห็นตัวเลือก App passwords** Google ระบุสาเหตุหลัก 3 ข้อ คือ ตั้ง 2-Step Verification ไว้เฉพาะ security key, เป็นบัญชีงานหรือโรงเรียนที่ admin จำกัดสิทธิ์ไว้ หรือเปิด Advanced Protection Program (การเปิดโปรแกรมนี้จะบล็อกและยกเลิก App Password ทั้งหมด) ทางแก้คือให้ admin ปรับนโยบาย หรือเปลี่ยนไปใช้อีเมลอื่น

## 3. Google Cloud: Service Account สำหรับ Sheets API และ Drive API

ระบบเข้าถึง Google Sheet และ Google Drive ผ่าน Service Account (บัญชีสำหรับโปรแกรม) แทนการล็อกอินด้วยคน ทั้ง n8n workflow และเว็บจัดการใช้ credential ชุดนี้ ถ้าไม่มี ระบบจะอ่านรายชื่อลูกค้า เขียน log และเปิดไฟล์แนบไม่ได้ ระบบขอสิทธิ์ 2 ตัว คือ `spreadsheets` (อ่าน/เขียน Sheet) และ `drive.readonly` (อ่านไฟล์ใน Drive อย่างเดียว)

**ขั้นตอน** (ล็อกอินด้วยบัญชี Google ของลูกค้าที่ console.cloud.google.com)

1. สร้าง project ใหม่ใน Google Cloud Console
2. APIs & Services → Library → เปิด **Google Sheets API** และ **Google Drive API**
3. IAM & Admin → Service Accounts → Create service account ตั้งชื่อ เช่น automail-service
4. เปิด Service Account นั้น → Keys → Add key → Create new key → เลือก JSON ไฟล์จะดาวน์โหลดทันที
5. จดอีเมลของ Service Account (รูปแบบ ชื่อ@project.iam.gserviceaccount.com) ไว้แชร์สิทธิ์ใน Google Sheet (หัวข้อ 4)
6. เก็บไฟล์ JSON ไว้ในที่ปลอดภัย ห้ามส่งทางแชทหรืออีเมลทั่วไป และห้าม commit เข้า Git

**ข้อควรระวัง**

- Google Workspace ที่สร้างใหม่อาจบล็อกการสร้าง key ด้วยนโยบาย `iam.disableServiceAccountKeyCreation` ต้องให้ admin ยกเว้นให้ project นี้
- Service Account อัปโหลดไฟล์เข้า My Drive ไม่ได้ (โควต้า 0 ไบต์) ระบบปัจจุบันจึงไม่อัปโหลดไฟล์ลง Drive ไฟล์แนบจากอีเมลขาเข้าเปิดดูจากกล่องจดหมายโดยตรง
- JSON key เทียบเท่ารหัสผ่านของระบบ ถ้าหลุดต้องลบ key นั้นแล้วสร้างใหม่ทันที

## 4. Google Sheet และไฟล์แนบ

Google Sheet ต้องอยู่ใน Drive ของบัญชีลูกค้าและแชร์ให้ Service Account ระบบจึงจะอ่านเขียนได้

1. ทีมพัฒนาแชร์ Sheet ต้นแบบให้ ลูกค้าทำสำเนาด้วย File → Make a copy ไปไว้ใน Drive ของอีเมลกลาง (ได้ทุกแท็บและหัวคอลัมน์ครบ)
2. ลบข้อมูลทดสอบใน Master_Data, Email_Logs และ Call_Logs (เก็บแถวหัวคอลัมน์ไว้)
3. แชร์ Sheet ให้อีเมลของ Service Account สิทธิ์ **Editor**
4. จด Spreadsheet ID ซึ่งอยู่กลาง URL `docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
5. อัปโหลดไฟล์ที่แนบไปกับอีเมลแจ้งเตือน R1/R2 ลง Drive แล้วแชร์ให้ Service Account สิทธิ์ **Viewer** แล้วใส่ลิงก์ในหน้า Settings → เอกสารแนบ ถ้าระบบดึงไฟล์ใดไม่ได้ จะไม่ส่งอีเมลรอบนั้นเลย เพื่อไม่ให้ลูกค้าได้รับเอกสารไม่ครบ

**ค่าในชีต config ที่ลูกค้าต้องกำหนด**

| ค่า | ความหมาย | หมายเหตุ |
| --- | --- | --- |
| `insurance_email`, `insurance_name` | อีเมลและชื่อของ AIA ที่รับอีเมลส่งต่อ (ปลายทางเดียวสำหรับลูกค้าทุกราย) | ตอนนี้เป็นค่าตัวอย่าง ต้องแก้เป็นค่าจริง |
| `USER_ACCESS` | อีเมลเจ้าหน้าที่ที่เข้าเว็บได้ พร้อม Role (Admin / Staff / Viewer) | ไม่ต้องแชร์ไฟล์ Sheet ให้เจ้าหน้าที่ |
| `r1_days_before`, `r2_days_before` | จำนวนวันก่อนหมดอายุที่ส่งแจ้งเตือนรอบ R1 และ R2 | ค่าแนะนำ 180 / 90 วัน ถ้าไม่ตั้ง workflow จะหยุดและแจ้ง error |
| `admin_report_email`, `review_alert_email` | อีเมลผู้ดูแลที่รับรายงานสรุปและแจ้งเตือนรายการ Needs Review | คั่นหลายอีเมลด้วย , ถ้าเว้นว่างจะไม่ส่ง |
| `subject_prefixes` | prefix หัวข้ออีเมลที่ระบบส่งต่อให้ AIA อัตโนมัติ | ลูกค้ากำหนดตามที่ใช้จริง |

## 5. รายการที่ลูกค้าต้องส่งมอบให้ทีมพัฒนา

- [ ] อีเมลกลางสำหรับส่ง/รับ และ App Password (ชื่อ n8n และ web)
- [ ] อีเมลปลายทางของ AIA สำหรับรับอีเมลส่งต่อ
- [ ] อีเมลของ Service Account และไฟล์ JSON key
- [ ] Spreadsheet ID ของ Sheet ที่ทำสำเนาแล้ว (แชร์ให้ Service Account สิทธิ์ Editor แล้ว)
- [ ] ไฟล์แนบอีเมลแจ้งเตือน R1/R2 (แชร์ให้ Service Account สิทธิ์ Viewer แล้ว)
- [ ] รายชื่ออีเมลเจ้าหน้าที่ที่ใช้เว็บ พร้อม Role
- [ ] อีเมลผู้ดูแลที่รับรายงานสรุปและแจ้งเตือน Needs Review

ส่ง App Password และไฟล์ JSON key แยกกันผ่านช่องทางที่ปลอดภัย (เช่น password manager) ไม่ส่งในแชทกลุ่ม

## 6. ประเด็นที่ System Analyst ต้องยืนยันกับลูกค้าก่อน Setup

- ลูกค้าใช้ Google Workspace หรือ Gmail ส่วนตัว เพราะกระทบ limit การส่ง (2,000 เทียบกับประมาณ 500 ข้อความต่อวัน) และการอนุญาต IMAP / App Password
- จำนวนลูกค้าใน Master_Data และจำนวนอีเมลสูงสุดต่อวันเมื่อเทียบกับ limit ถ้าใกล้ limit ต้องพิจารณา SMTP relay ของ Google Workspace หรือบริการส่งอีเมลเฉพาะทาง
- ต้องการให้ผู้รับเห็นผู้ส่งเป็นอีเมลอื่นนอกจากอีเมลกลางหรือไม่ ถ้าใช่ ต้องทดสอบ alias "Send mail as" ก่อน
- นโยบายองค์กรของลูกค้าบล็อก App Password หรือการสร้าง Service Account key หรือไม่ ให้ admin ลูกค้าตรวจก่อนนัด Setup
- ใครเป็นเจ้าของและผู้ดูแลอีเมลกลาง, Google Cloud project และ Google Sheet หลังส่งมอบ ควรเป็นบัญชีขององค์กร ไม่ใช่บัญชีส่วนตัว
- เมื่อย้ายมาใช้บัญชีลูกค้าครบแล้ว ต้องยกเลิกสิทธิ์ของบัญชีส่วนตัวของผู้พัฒนา (ลบ JSON key เดิม, ยกเลิก App Password ที่ใช้ทดสอบ, ลบอีเมลส่วนตัวออกจาก Sheet และ `USER_ACCESS`)

## แหล่งอ้างอิงและบันทึกการจัดทำ

ตัวเลข limit และเงื่อนไขของ Google อาจเปลี่ยนได้ ให้ตรวจที่หน้าทางการก่อนใช้งานจริง

- [Gmail sending limits in Google Workspace](https://support.google.com/a/answer/166852)
- [Limits for sending & getting mail – Gmail Help](https://support.google.com/mail/answer/22839)
- [Sign in with app passwords – Google Account Help](https://support.google.com/accounts/answer/185833)
- [How 2-Step Verification works with legacy apps – Google Workspace Help](https://support.google.com/a/answer/9176599)

**บันทึกการจัดทำ** (ตาม Document Rules ของโปรเจกต์)

- Skill ที่ใช้: documentation-generation-doc-generate
- Connector / MCP ที่ใช้: Claude Docs (สร้างและแก้เอกสารต้นฉบับ), WebSearch (ตรวจ limit และเงื่อนไข App Password ของ Google)
- ไฟล์ใน repo ที่อ่านประกอบ: docs/CUSTOMER_HANDOVER_CHECKLIST.md, CONTEXT.md, docs/flow_specification.md, .env.example, sheets-app/server/.env.example, sheets-app/server/googleSheets.js
- ร่างต้นฉบับ: ข้อความอธิบายโดยคร่าวของผู้พัฒนา นำมาเรียบเรียงใหม่และเพิ่มขั้นตอน
