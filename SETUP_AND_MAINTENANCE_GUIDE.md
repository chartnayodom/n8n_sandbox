# คู่มือการติดตั้ง ย้ายเครื่อง และดูแลรักษาระบบ (Setup, Migration & Maintenance Guide)
**โครงการ:** n8n Auto-Email & Google Sheets / SQLite Automation

---

## 📌 สารบัญ (Table of Contents)
1. [ภาพรวมของระบบและ Workflows](#1-ภาพรวมของระบบและ-workflows)
2. [ขั้นตอนการ Setup / Clone ลงเครื่องใหม่แบบ Step-by-Step](#2-ขั้นตอนการ-setup--clone-ลงเครื่องใหม่)
3. [การจัดการความปลอดภัยและ Credentials (กุญแจเข้ารหัส)](#3-การจัดการ-credentials-และกุญแจเข้ารหัส)
4. [การจัดการฐานข้อมูล (SQLite vs n8n Data Table)](#4-การจัดการฐานข้อมูล-sqlite-vs-n8n-data-table)
5. [ปัญหาที่พบบ่อยและวิธีแก้ไข (Troubleshooting & Gotchas)](#5-ปัญหาที่พบบ่อยและวิธีแก้ไข)
6. [รวมคำสั่ง CLI สำคัญ (Cheat Sheet)](#6-รวมคำสั่ง-cli-สำคัญ-cheat-sheet)

---

## 1. ภาพรวมของระบบและ Workflows

ระบบประกอบด้วย 2 Workflows หลักที่ทำงานร่วมกัน:

### 📤 Workflow 1: Outbound Auto Send Email & Summary Report
* **ไฟล์:** `workflows/c7AnideudYIbfvmK.json`
* **การทำงาน:**
  1. ดึงข้อมูลรายการจาก **Google Sheets (Service Account)** หรือ **SQLite / Data Table**
  2. กรองข้อมูลเฉพาะรายการที่ครบกำหนดล่วงหน้า 3 เดือน (`due_date_to` / `insurance_date_to`) และสถานะยังไม่เคยส่ง
  3. **ดึง Template อีเมลจากชีต `Templates`** (เลือกตามรอบ R1/R2 ด้วยชื่อ — รูปแบบชีตและตัวแปรดู [docs/PROJECT_HANDOVER_AND_MIGRATION_GUIDE.md](docs/PROJECT_HANDOVER_AND_MIGRATION_GUIDE.md) หัวข้อ 3.3) ถ้าไม่พบ template workflow จะหยุดและแจ้ง error
  4. **Parallel Download:** ดาวน์โหลดเอกสารแนบคู่ขนานจาก Google Drive 2 ไฟล์ และส่งต่อ Binary Data เข้าสู่ลูป
  5. วนลูปส่งอีเมลรายบุคคลผ่าน **SMTP** พร้อมสร้าง Unique `Message-ID` (`mail_id`) สำหรับใช้อ้างอิงการตอบกลับ
  6. **Error Branching:**
     * **สำเร็จ (4.3.T):** อัปเดตสถานะเป็น `complete` / `สำเร็จ` และบันทึก `mail_id`
     * **ไม่สำเร็จ (4.3.F):** อัปเดตสถานะเป็น `failed` และบันทึกข้อความผิดพลาด
  7. **Summary Report:** รวมสถิติการส่งรอบนั้น แล้วส่งอีเมลสรุปรายงานไปยังผู้ดูแลระบบ (Admin)

### 📥 Workflow 2: Inbound Monitor & Auto-Forward (Listener Flow)
* **ไฟล์:** `workflows/a14U6Ep5Yxt4eZH1.json`
* **การทำงาน:**
  1. ดักจับอีเมลใหม่ใน `INBOX` ตลอดเวลาผ่าน **IMAP Trigger**
  2. กรองเงื่อนไข 2 ข้อ (เข้าข้อใดข้อหนึ่ง):
     * **เงื่อนไข A:** มี Subject Prefix ที่กำหนด เช่น `[PorInsurance]`, `[แจ้งเตือนครบกำหนด]`
     * **เงื่อนไข B:** เป็นอีเมลตอบกลับ (Reply) จาก `mail_id` ที่ระบบเคยส่งออกไป
  3. ตรวจสอบข้อมูลในฐานข้อมูล SQLite / Data Table เพื่อดึงชื่อและสถานะกรมธรรม์ของลูกค้า
  4. ทำการ **Forward อีเมล** พร้อมแนบข้อมูลสรุปของลูกค้า และแนบไฟล์เดิมของผู้ส่ง (ถ้ามี) ไปยังอีเมลปลายทาง

---

## 2. ขั้นตอนการ Setup / Clone ลงเครื่องใหม่

เมื่อต้องการนำโค้ดไปรันบน PC เครื่องอื่น ให้ปฏิบัติตามลำดับดังนี้:

### ขั้นตอนที่ 1: เตรียมสภาพแวดล้อม (Prerequisites)
* ติดตั้ง **Node.js** (เวอร์ชันแนะนำ: v20.19 – v24.x)
* ตรวจสอบความพร้อมผ่าน Terminal:
  ```bash
  node -v
  npm -v
  ```
* ติดตั้ง n8n แบบ Global (ถ้ายังไม่มี):
  ```bash
  npm install -g n8n
  ```

### ขั้นตอนที่ 2: Clone Repository
```bash
git clone https://github.com/chartnayodom/n8n_sandbox.git
cd n8n_sandbox
```

### ขั้นตอนที่ 3: สร้างและเตรียมฐานข้อมูล SQLite
รันคำสั่ง Node เพื่อสร้างตาราง `mail_records` ในโฟลเดอร์ `n8n_data`:
```bash
node --experimental-sqlite ./scripts/init-sqlite.js
```
*(ระบบจะสร้างไฟล์ `n8n_data/automail.sqlite` พร้อม Seed ข้อมูลทดสอบ 2 แถวให้ทันที)*

### ขั้นตอนที่ 4: ตั้งค่า Environment Variables (`.env`)
คัดลอกไฟล์แม่แบบและใส่กุญแจเข้ารหัส:
```powershell
Copy-Item .env.example .env
```
เปิดไฟล์ `.env` และระบุ `N8N_ENCRYPTION_KEY` ให้ตรงกับเครื่องต้นทาง (ถ้าต้องการใช้ไฟล์ `credentials.json` เดิม)

### ขั้นตอนที่ 5: นำเข้า Workflows สู่ n8n
```powershell
n8n import:workflow --separate --input=./workflows/
```

### ขั้นตอนที่ 6: นำเข้าหรือตั้งค่า Credentials
* **กรณีมีไฟล์ `credentials.json` จากเครื่องเดิม:**
  ```powershell
  n8n import:credentials --input=./credentials.json
  ```
* **กรณีต้องการตั้งค่าใหม่บน UI:**
  เปิด n8n (`n8n start`) แล้วเข้าไปผูกบัญชีใน UI:
  * Google Service Account (`apU1LNQcR7cMOpnJ`)
  * SMTP Account (`tX1RzY0kvRotVojr`)
  * IMAP Account (`2HMSsaztmuB5CTzy`)

---

## 3. การจัดการ Credentials และกุญแจเข้ารหัส

> [!WARNING]
> **ความปลอดภัยสำคัญสูงสุด:** ห้ามนำไฟล์ `credentials.json` หรือไฟล์ `.env` ที่มีรหัสผ่านจริง commit ขึ้น Git เด็ดขาด (ระบบได้เพิ่มไว้ใน `.gitignore` เรียบร้อยแล้ว)

* **กุญแจเข้ารหัส (`N8N_ENCRYPTION_KEY`):**  
  n8n จะใช้กุญแจนี้ในการเข้ารหัสรหัสผ่านทุกตัวในระบบ หากย้ายเครื่องและต้องการนำเข้าไฟล์ `credentials.json` ข้ามเครื่อง จะต้องใช้ค่า `N8N_ENCRYPTION_KEY` เดียวกันในไฟล์ `.env` เท่านั้น
* **การสำรอง Credentials ออกมาใช้งาน:**
  ```powershell
  n8n export:credentials --all --output=./credentials.json
  ```

---

## 4. การจัดการฐานข้อมูล (SQLite vs n8n Data Table)

### ทางเลือกที่ 1: SQLite Database (`n8n_data/automail.sqlite`)
* **จุดเด่น:** รวดเร็วระดับ Millisecond, รองรับปริมาณข้อมูลสูง, Query ได้อิสระผ่าน SQL
* **ที่เก็บไฟล์:**
  * Local Windows: `E:/GitHub/n8n_sandbox/n8n_data/automail.sqlite`
  * Docker: `/home/node/.n8n/automail.sqlite`

### ทางเลือกที่ 2: n8n Built-in Data Table
* **จุดเด่น:** ใช้งานง่ายผ่านหน้าเว็บ n8n โดยตรง ไม่ต้องพึ่งพาไดรเวอร์ฐานข้อมูลภายนอก เหมาะสำหรับแสดงผลในทีม
* **การนำไปใช้:** ใช้ Node `n8n-nodes-base.dataTable` เพื่อ Read/Insert/Update แถว

---

## 5. ปัญหาที่พบบ่อยและวิธีแก้ไข (Troubleshooting)

### ❓ 1. เจอปัญหา `Unrecognized node type: n8n-nodes-base.sqlite`
* **สาเหตุ:** n8n เวอร์ชันใหม่บางเวอร์ชัน (เช่น 2.x) ปิดการใช้งาน Node SQLite เริ่มต้นเพื่อความปลอดภัยของระบบภายใน
* **วิธีแก้ไข:**
  1. ใช้ **n8n Built-in Data Table** (`n8n-nodes-base.dataTable`) แทน ซึ่งทำงานได้เสถียรและแสดงผลบน UI สวยงาม
  2. หรือติดตั้ง Community Node สำหรับ SQLite เพิ่มเติมผ่านเมนู Settings > Community Nodes

### ❓ 2. เจอปัญหา `The item has no binary field 'attachment_0'`
* **สาเหตุ:** ใน Node Send Email (SMTP) มีการระบุชื่อไฟล์แนบเป็น `attachment_0` แต่ในอีเมลที่ได้รับมาจริง **ผู้ส่งไม่ได้แนบไฟล์มาด้วย** หรือ Node IMAP ไม่ได้เปิดตัวเลือกดาวน์โหลดไฟล์
* **วิธีแก้ไข:**
  * ใน Node **IMAP Trigger**: ตรวจสอบว่าเปิด Option `Download Attachments: ON` และ `Prefix Name: attachment_`
  * ใน Node **ก่อนหน้า Send Email**: เพิ่ม Logic ตรวจสอบว่ามี Binary หรือไม่ หากไม่มีไฟล์แนบ ไม่ต้องส่งตัวแปร attachment เข้าไป

### ❓ 3. ปัญหา IMAP Trigger อีเมลเดิมซ้ำๆ ไม่รู้จบ (Infinite Loop)
* **สาเหตุ:** ตั้งค่า `customEmailConfig: ["UNSEEN"]` แต่ช่อง `Post Process Action` ตั้งเป็น `nothing` ทำให้อีเมลฉบับเดิมยังคงสถานะไม่ได้อ่าน พอย้อนกลับมาตรวจใหม่จึงหยิบมาประมวลผลซ้ำ
* **วิธีแก้ไข:**
  * ใน Node IMAP ให้เปลี่ยน **`Post Process Action`** เป็น **`Mark as Read` (ทำเครื่องหมายว่าอ่านแล้ว)**

### ❓ 4. `npm install` ล้มเหลวด้วย `gyp ERR! find VS` (isolated-vm) หรือ `EBADENGINE`
* **สาเหตุ:** n8n รุ่น 1.123.51+ และ 2.9.0+ ต้องใช้ Node 22 ขึ้นไป (ผ่าน `isolated-vm` 6.x) ถ้ารันบน Node 20 npm จะพยายาม compile จาก source แล้วล้มเหลวเพราะไม่มี Visual Studio C++
* **วิธีแก้ไข:** โปรเจกต์นี้ pin `n8n` เป็น **2.8.4** (รุ่นล่าสุดที่รองรับ Node 20.19+ และยังใช้ได้กับ Node 22/24) ห้ามเปลี่ยนเป็น `^` หรือ `latest` ถ้ายังใช้ Node 20
  * `overrides` ใน `package.json` (`@zenfs/core`, `utilium`) มีไว้ล็อก dependency ย่อยที่ลอยขึ้นไปรุ่นที่ต้องใช้ Node 22 ห้ามลบ
  * เมื่อย้ายไป Node 22 ขึ้นไปทั้งหมดแล้ว สามารถอัปเกรด n8n และลบ `overrides` ได้

---

## 6. รวมคำสั่ง CLI สำคัญ (Cheat Sheet)

| การทำงาน | คำสั่ง (Command) |
| :--- | :--- |
| **เริ่มรัน n8n ในเครื่อง** | `n8n start` |
| **สร้างตาราง SQLite** | `node --experimental-sqlite ./scripts/init-sqlite.js` |
| **Export Workflows ลงโฟลเดอร์** | `.\scripts\export-workflows.ps1` |
| **Import Workflows เข้า n8n** | `n8n import:workflow --separate --input=./workflows/` |
| **Export Credentials ทั้งหมด** | `n8n export:credentials --all --output=./credentials.json` |
| **Import Credentials เข้า n8n** | `n8n import:credentials --input=./credentials.json` |
| **ดูรายชื่อ Workflows ในระบบ** | `n8n list:workflow` |
| **Deploy บน Docker Server** | `docker compose up -d --build` |
