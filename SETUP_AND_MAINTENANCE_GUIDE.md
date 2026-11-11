# คู่มือการติดตั้ง Deploy และดูแลรักษาระบบ (Setup, Deploy & Maintenance Guide)
**โครงการ:** AutoMail Insurance — n8n + เว็บจัดการระบบ (sheets-app) + Google Sheets

> อัปเดตให้ตรงกับ source code ล่าสุด: 2026-11-11 (อ้างอิง `Dockerfile`, `docker-compose.yml`, `Jenkinsfile`, `.env.example`, `sheets-app/`, `workflows/`)

---

## 📌 สารบัญ
1. [ภาพรวมของระบบ](#1-ภาพรวมของระบบ)
2. [Deploy ด้วย Docker Compose (Production)](#2-deploy-ด้วย-docker-compose-production)
3. [Deploy ผ่าน Jenkins (CI/CD)](#3-deploy-ผ่าน-jenkins-cicd)
4. [รันบนเครื่องสำหรับพัฒนา (Local Development)](#4-รันบนเครื่องสำหรับพัฒนา-local-development)
5. [Credentials และกุญแจเข้ารหัส](#5-credentials-และกุญแจเข้ารหัส)
6. [ตัวแปร Environment ทั้งหมด](#6-ตัวแปร-environment-ทั้งหมด)
7. [ปัญหาที่พบบ่อยและวิธีแก้ไข](#7-ปัญหาที่พบบ่อยและวิธีแก้ไข)
8. [รวมคำสั่งสำคัญ (Cheat Sheet)](#8-รวมคำสั่งสำคัญ-cheat-sheet)

---

## 1. ภาพรวมของระบบ

```text
                ┌──────────────────────── docker compose ────────────────────────┐
 เบราว์เซอร์ ──▶ │ web (automail_web) :5000                                        │
                │   Express เสิร์ฟหน้าเว็บ (React build) + /api                     │
                │   └─ POST http://n8n:5678/webhook/re-forward ──┐                 │
                │ n8n (n8n_auto_email) :5678  ◀──────────────────┘                 │
                │   workflow 01 Outbound R1/R2 (ทุก 24 ชม.)                         │
                │   workflow 02 Inbound Router (IMAP) + Webhook re-forward         │
                └─────────────────────────────────────────────────────────────────┘
                       │ Google Sheets / Drive API (Service Account)   │ SMTP / IMAP
                       ▼                                                ▼
              Google Spreadsheet (Master_Data, Email_Logs,       กล่องจดหมายกลาง
              Call_Logs, Templates, config)
```

| ส่วน | ไฟล์ | หน้าที่ |
| :--- | :--- | :--- |
| Workflow 01 | `workflows/AutoMailOutbound.json` (id `AutoMailOutbound`) | Schedule ทุก 24 ชม. + Manual Trigger: อ่าน `Master_Data` และชีต `config` เลือกลูกค้าที่เข้ารอบ R1/R2 (`r1_days_before` / `r2_days_before`) ส่งอีเมลจาก template ในชีต `Templates` พร้อมไฟล์แนบจากหมวด `DRIVE_LINK` อัปเดตสถานะกลับ `Master_Data`, เขียน `Email_Logs` และส่งรายงานสรุปไป `admin_report_email` |
| Workflow 02 | `workflows/R3pXov64UiK0AkDL.json` (id `R3pXov64UiK0AkDL`) | **Flow A** IMAP Trigger (UNSEEN): ส่งต่อไป `insurance_email` เมื่อผู้ส่งอยู่ใน `Master_Data` และเป็นการตอบกลับ/หัวข้อมี prefix นอกนั้นบันทึก `Needs Review` / **Flow B** Webhook `POST /webhook/re-forward` สำหรับปุ่ม "ส่งต่ออีกครั้ง" บนเว็บ |
| เว็บ | `sheets-app/` (`server/` Express, `client/` React + Vite) | หน้าจัดการ Master Data, Inbox, Needs Review, Template, Settings, ติดตามลูกค้า เปิดไฟล์แนบจากกล่องจดหมายผ่าน IMAP ด้วย Message-ID |

> รายละเอียดเงื่อนไขของแต่ละ workflow และหัวคอลัมน์ของชีตดู [docs/PROJECT_HANDOVER_AND_MIGRATION_GUIDE.md](docs/PROJECT_HANDOVER_AND_MIGRATION_GUIDE.md) หัวข้อ 3.3–3.4
>
> ไฟล์ที่ขึ้นต้นด้วย `UNUSED_` ในโฟลเดอร์ `workflows/` เป็นเวอร์ชันเก่า (ใช้ SQLite / n8n Data Table) **ห้าม import เข้า production** — `Dockerfile` คัดลอกเข้า image เฉพาะ 2 ไฟล์ข้างบน

---

## 2. Deploy ด้วย Docker Compose (Production)

### 2.1 สิ่งที่ต้องมีบน Host Server
* Docker Engine + **Docker Compose v2.24 ขึ้นไป** (`docker-compose.yml` ใช้ `env_file` แบบ `path` / `required: false` ซึ่งรุ่นเก่ากว่านี้ไม่รองรับ)
* พอร์ตว่าง `5678` (n8n) และ `5000` (เว็บ) หรือเปลี่ยนได้ด้วย `N8N_PORT` / `WEB_PORT`

### 2.2 เตรียมไฟล์ค่าลับ 2 ไฟล์ (ไม่อยู่ใน Git)

**ไฟล์ที่ 1: `.env` ที่โฟลเดอร์ราก** (ใช้กับ service `n8n`)
```bash
cp .env.example .env
```
แก้อย่างน้อย:
* `N8N_ENCRYPTION_KEY` = สตริงสุ่มยาว (เช่น `openssl rand -hex 32`) **ต้องคงค่าเดิมทุกครั้งที่ deploy** ไม่งั้น credential ใน n8n จะถอดรหัสไม่ได้
* `WEBHOOK_URL` = URL ที่ภายนอกใช้เรียก n8n (เช่น `https://n8n.example.com/`)
* `N8N_HOST`, `N8N_PROTOCOL` ให้ตรงกับโดเมนจริง

**ไฟล์ที่ 2: `sheets-app/server/.env`** (ใช้กับ service `web`)
```bash
cp sheets-app/server/.env.example sheets-app/server/.env
```
กรอก `SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (คง `\n` และเครื่องหมายคำพูดไว้), `IMAP_HOST` / `IMAP_PORT` / `IMAP_USER` / `IMAP_PASSWORD`
* ค่า `PORT` ในไฟล์นี้ **ไม่มีผลใน Docker** เพราะ `docker-compose.yml` บังคับ `PORT=5000`
* ถ้าไม่มีไฟล์นี้ container `web` ยังเริ่มได้ แต่จะอยู่ใน **Demo Mode** (ต่อ Google Sheets ไม่ได้) ตรวจได้ที่ `GET /api/status` → `"mode": "live"` / `"mock"`

### 2.3 Build และรัน
```bash
mkdir -p n8n_data local-files
sudo chown -R 1000:1000 n8n_data local-files   # Linux: ให้ user node (UID 1000) ใน container เขียนได้
docker compose up -d --build
```
ผลลัพธ์:
| Service | Container | Image | พอร์ต | Volume |
| :--- | :--- | :--- | :--- | :--- |
| `n8n` | `n8n_auto_email` | `custom-n8n-email-automation:latest` (n8n **2.8.4** — เปลี่ยนด้วย `--build-arg N8N_VERSION=...`) | `${N8N_PORT:-5678}` | `./n8n_data` → `/home/node/.n8n`, `./local-files` → `/files` |
| `web` | `automail_web` | `automail-insurance-web:latest` (node:22-alpine, multi-stage build) | `${WEB_PORT:-5000}` | ไม่มี (มี HEALTHCHECK ที่ `/api/status`) |

### 2.4 ตั้งค่าครั้งแรกบน instance ใหม่ (ทำครั้งเดียว)
1. เปิด `http://<host>:5678` สร้างบัญชีเจ้าของ (owner) — **ต้องทำก่อน** CLI import ถึงจะทำงาน
2. Import workflow ที่อยู่ใน image แล้ว:
   ```bash
   docker exec -u node n8n_auto_email n8n import:workflow --separate --input=/home/node/workflows/
   docker restart n8n_auto_email
   ```
   ทั้งสองไฟล์มี id คงที่ import ซ้ำจะอัปเดต workflow เดิม ไม่สร้างใหม่
3. สร้าง credential 3 ตัวใน n8n (ชื่อต้องตรงกับใน workflow ถ้าไม่ตรงให้เลือกใหม่ในทุก node ที่ขึ้นเตือน):
   | ชื่อ credential | ชนิด | ใช้ใน |
   | :--- | :--- | :--- |
   | `Google Service Account account` | Google API (Service Account) | Google Sheets / Drive ทั้ง 2 workflow |
   | `SMTP account` | SMTP (Gmail: `smtp.gmail.com` 465 SSL + App Password) | ส่งอีเมล ทั้ง 2 workflow |
   | `IMAP account` | IMAP (Gmail: `imap.gmail.com` 993 SSL + App Password) | workflow 02 |
4. ตรวจ Spreadsheet ID ในทุก node Google Sheets (workflow 01: 7 node, workflow 02: 8 node) ให้ตรงกับ Sheet ที่ใช้งานจริง
5. ในชีต `config` ตั้ง `n8n_webhook_url` = `http://n8n:5678/webhook/re-forward` (เว็บเรียก n8n ผ่าน network ภายในของ compose)
6. ทดสอบด้วยโหมดทดสอบ (`test_recipient_email` / `test_forward_email` ใน node `Global Config` และ `Re-forward Config`) แล้วค่อย **เปิด Active** ทั้ง 2 workflow — workflow ที่ import มาจะปิดอยู่เสมอ (`active: false`) เปิดได้จาก UI หรือ `n8n publish:workflow --id=<WORKFLOW_ID>`

> ขั้นตอนเตรียมบัญชี Google Cloud / Sheet / อีเมลกลางของลูกค้า ดู [docs/CUSTOMER_HANDOVER_CHECKLIST.md](docs/CUSTOMER_HANDOVER_CHECKLIST.md)

### 2.5 อัปเดตเวอร์ชัน (Redeploy)
```bash
git pull
docker compose up -d --build
docker exec -u node n8n_auto_email n8n import:workflow --separate --input=/home/node/workflows/
docker restart n8n_auto_email
```
ข้อมูลใน `n8n_data/` (credential, ประวัติการรัน, สถานะ Active) คงอยู่ข้ามการ redeploy

---

## 3. Deploy ผ่าน Jenkins (CI/CD)

`Jenkinsfile` ทำงานตามลำดับ (รองรับทั้ง agent Linux `sh` และ Windows `bat`):

| Stage | ทำอะไร |
| :--- | :--- |
| Checkout Source | `checkout scm` |
| Validate Workflow JSONs | สร้าง/แสดงรายการ `./workflows` |
| prepare Environment & Volumes | เขียน `.env` ที่ราก **เฉพาะ 4 ค่า**: `N8N_PORT=5678`, `GENERIC_TIMEZONE`, `TZ` (`Asia/Bangkok`), `N8N_ENCRYPTION_KEY` แล้วสร้าง `n8n_data/`, `local-files/` (Linux: `chown 1000:1000`) |
| Build & Deploy Docker Container | `docker compose up -d --build` (ทั้ง service `n8n` และ `web`) |
| Import Workflows & Restart Service | รอ 5 วินาที → `n8n import:workflow --separate --input=/home/node/workflows/` → `docker restart n8n_auto_email` |
| post / always | ลบ `.env` ที่รากออกจาก workspace |

**Jenkins Credentials ที่ต้องมี:** `N8N_ENCRYPTION_KEY` (Secret text)

> [!WARNING]
> **ข้อจำกัดของ Jenkinsfile ปัจจุบัน**
> * ไม่ได้สร้าง `sheets-app/server/.env` → service `web` จะรันใน Demo Mode จนกว่าจะวางไฟล์นี้ไว้ใน Jenkins workspace เอง (ไฟล์นี้ไม่ถูกลบโดย `cleanWs` เพราะ pattern ลบเฉพาะ `.env` ที่ราก)
> * `.env` ที่ Jenkins เขียนไม่มี `WEBHOOK_URL`, `N8N_HOST`, `N8N_PROTOCOL`, `WEB_PORT` → ใช้ค่า default (`5000` สำหรับเว็บ, webhook URL ของ n8n เป็น localhost) ถ้าต้องใช้ค่าอื่นต้องเพิ่มใน stage `prepare Environment & Volumes`
> * ครั้งแรกบน instance ใหม่ stage import อาจล้มเหลวจนกว่าจะสร้างบัญชี owner (หัวข้อ 2.4 ข้อ 1)

---

## 4. รันบนเครื่องสำหรับพัฒนา (Local Development)

### 4.1 Prerequisites
* **Node.js 20.19 – 24.x** (`package.json` → `engines`) แนะนำ 22 LTS (ตรงกับ image ของเว็บ)
* Git

### 4.2 n8n (โฟลเดอร์ราก)
```bash
npm install          # ติดตั้ง n8n 2.8.4 ตาม package.json (ไม่ต้อง install -g)
cp .env.example .env # ใส่ N8N_ENCRYPTION_KEY
npm start            # = n8n start → http://localhost:5678
```
Import เฉพาะ workflow ที่ใช้งานจริง (**อย่าใช้** `npm run import:workflows` เพราะจะ import ไฟล์ `UNUSED_` ด้วย):
```bash
npx n8n import:workflow --input=./workflows/AutoMailOutbound.json
npx n8n import:workflow --input=./workflows/R3pXov64UiK0AkDL.json
```

### 4.3 เว็บ (sheets-app) — 2 terminal
```bash
# terminal 1: API
cd sheets-app/server
cp .env.example .env   # คง PORT=3001 ไว้
npm install
npm run dev            # node --watch index.js → http://localhost:3001

# terminal 2: หน้าเว็บ
cd sheets-app/client
npm install
npm run dev            # Vite → http://localhost:3000 (proxy /api → http://localhost:3001)
```
> [!IMPORTANT]
> Vite proxy ชี้ไป **พอร์ต 3001** (`sheets-app/client/vite.config.js`) ดังนั้นตอนพัฒนา `PORT` ใน `sheets-app/server/.env` ต้องเป็น `3001` ถ้าไม่ตั้ง server จะใช้ 5000 แล้วหน้าเว็บเรียก API ไม่ได้
>
> ตัวแปร `SHEET_NAME` ใน `.env.example` ไม่ถูกใช้ใน code แล้ว (ชื่อชีตถูกกำหนดตายตัวใน `googleSheets.js`)

ทดสอบรูปแบบเว็บแบบเดียวกับ production บนเครื่อง: `cd sheets-app/client && npm run build` แล้วรัน server ด้วย `STATIC_DIR=../client/dist` จะได้ทั้งหน้าเว็บและ API ที่พอร์ตเดียว

### 4.4 Export workflow ก่อน commit
```powershell
.\scripts\export-workflows.ps1      # Windows
./scripts/export-workflows.sh       # Linux / macOS / Git Bash
```
`--backup` จะ export **ทุก** workflow ในเครื่องเป็น `<ID>.json` — commit เฉพาะ `AutoMailOutbound.json` และ `R3pXov64UiK0AkDL.json` ที่เปลี่ยนจริง ถ้าเพิ่ม workflow ใหม่ที่ต้องขึ้น production ต้องเพิ่มชื่อไฟล์ในบรรทัด `COPY` ของ `Dockerfile` ด้วย

---

## 5. Credentials และกุญแจเข้ารหัส

> [!WARNING]
> ห้าม commit `.env`, `sheets-app/server/.env`, `credentials.json` ขึ้น Git (อยู่ใน `.gitignore` แล้ว) — `.dockerignore` ที่รากส่งเฉพาะ `workflows/` เข้า build context และ `sheets-app/.dockerignore` กัน `server/.env` ไม่ให้เข้า image

* **`N8N_ENCRYPTION_KEY`:** n8n ใช้เข้ารหัส credential ทุกตัว ย้ายเครื่องแล้วจะใช้ `credentials.json` เดิมได้ต่อเมื่อใช้ key เดียวกันเท่านั้น (ส่งมอบให้ลูกค้า = สร้าง key และ credential ใหม่ ดู CUSTOMER_HANDOVER_CHECKLIST)
* **สำรอง / กู้คืน credential:**
  ```bash
  docker exec -u node n8n_auto_email n8n export:credentials --all --output=/files/credentials.json   # ได้ไฟล์ที่ ./local-files/
  docker exec -u node n8n_auto_email n8n import:credentials --input=/files/credentials.json
  ```
* **สำรองข้อมูล n8n ทั้งหมด:** หยุด container แล้ว copy โฟลเดอร์ `n8n_data/` (SQLite ภายในของ n8n + config)

---

## 6. ตัวแปร Environment ทั้งหมด

| ตัวแปร | ไฟล์ | ใช้โดย | ค่า default / หมายเหตุ |
| :--- | :--- | :--- | :--- |
| `N8N_PORT` | `.env` | compose (พอร์ต host ของ n8n) | `5678` |
| `N8N_HOST`, `N8N_PROTOCOL` | `.env` | n8n | `localhost`, `http` |
| `WEBHOOK_URL` | `.env` | n8n (สร้าง production URL ของ webhook) | `http://localhost:5678/` |
| `GENERIC_TIMEZONE`, `TZ` | `.env` | n8n (เวลาของ Schedule Trigger) | `Asia/Bangkok` |
| `N8N_ENCRYPTION_KEY` | `.env` / Jenkins Credential | n8n | **บังคับ** คงค่าเดิมทุก deploy |
| `WEB_PORT` | `.env` | compose (พอร์ต host ของเว็บ) | `5000` |
| `PORT` | `sheets-app/server/.env` | Express | Docker บังคับ `5000`; local dev ใช้ `3001`; ไม่ตั้ง = `5000` |
| `SPREADSHEET_ID` | `sheets-app/server/.env` | Express | ไม่มี = Demo Mode |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | `sheets-app/server/.env` | Express (Sheets + Drive API) | ไม่มี = Demo Mode |
| `IMAP_HOST`, `IMAP_PORT` | `sheets-app/server/.env` | Express (`mailbox.js`) | `imap.gmail.com`, `993` |
| `IMAP_USER`, `IMAP_PASSWORD` | `sheets-app/server/.env` | Express (เปิดไฟล์แนบ) | ไม่มี = เปิดไฟล์แนบไม่ได้ |
| `STATIC_DIR` | (ไม่บังคับ) | Express | `server/public` (ใน image คือหน้าเว็บที่ build แล้ว) |

---

## 7. ปัญหาที่พบบ่อยและวิธีแก้ไข

### ❓ 1. หน้าเว็บ dev ขึ้น error เรียก `/api` ไม่ได้ (ECONNREFUSED)
* **สาเหตุ:** server ไม่ได้รันที่พอร์ต 3001 (เช่นตั้ง `PORT=5000` ตามคู่มือเก่า)
* **วิธีแก้:** ตั้ง `PORT=3001` ใน `sheets-app/server/.env` แล้วรีสตาร์ท server

### ❓ 2. เว็บใน Docker ขึ้น Demo Mode
* **สาเหตุ:** ไม่มี `sheets-app/server/.env` บน host หรือค่า Service Account ผิด (มักเป็น `\n` ใน `GOOGLE_PRIVATE_KEY` หาย)
* **วิธีแก้:** สร้างไฟล์ตามหัวข้อ 2.2 แล้ว `docker compose up -d web` ตรวจด้วย `curl http://localhost:5000/api/status`

### ❓ 3. ปุ่ม "ส่งต่ออีกครั้ง" บนเว็บไม่ทำงาน
* **สาเหตุ:** `n8n_webhook_url` ในชีต `config` ชี้ `localhost` (ภายใน container `web` คือตัวมันเอง) หรือ workflow 02 ยังไม่ Active (webhook production ใช้ได้เฉพาะ workflow ที่ Active)
* **วิธีแก้:** ตั้ง `http://n8n:5678/webhook/re-forward` และเปิด Active workflow 02

### ❓ 4. เปิด n8n ผ่าน `http://<IP>` แล้ว login ไม่ได้ (secure cookie)
* **สาเหตุ:** n8n ตั้ง secure cookie เป็นค่าเริ่มต้น ใช้ได้เฉพาะ HTTPS หรือ localhost
* **วิธีแก้:** ทำ HTTPS (reverse proxy) ซึ่งแนะนำ หรือชั่วคราวเพิ่ม `N8N_SECURE_COOKIE=false` ใน `.env`

### ❓ 5. Import workflow แล้วได้ workflow เก่าปนมา / มี SQLite / Data Table node
* **สาเหตุ:** import ทั้งโฟลเดอร์ `./workflows/` ซึ่งมีไฟล์ `UNUSED_*` (เวอร์ชันเก่า ต้องใช้ SQLite node ที่ n8n 2.x ปิดไว้ และ path `E:/GitHub/...`)
* **วิธีแก้:** archive/ลบ workflow เก่าใน UI แล้ว import เฉพาะ 2 ไฟล์ตามหัวข้อ 4.2 — `scripts/init-sqlite.js` และฐาน `n8n_data/automail.sqlite` เป็นของระบบเก่า ไม่จำเป็นต่อ workflow ปัจจุบัน

### ❓ 6. `npm install` ล้มเหลวด้วย `gyp ERR! find VS` (isolated-vm) หรือ `EBADENGINE`
* **สาเหตุ:** n8n 1.123.51+ และ 2.9.0+ ต้องใช้ Node 22 ขึ้นไป บน Node 20 npm จะ compile `isolated-vm` จาก source แล้วล้มเหลว
* **วิธีแก้:** โปรเจกต์ pin `n8n` เป็น **2.8.4** (ทั้ง `package.json` และ `Dockerfile`) ห้ามเปลี่ยนเป็น `^` / `latest` ถ้ายังใช้ Node 20 และห้ามลบ `overrides` (`@zenfs/core`, `utilium`) จนกว่าจะย้ายไป Node 22+ ทั้งหมด

### ❓ 7. IMAP Trigger ดึงอีเมลเดิมซ้ำ
* **สาเหตุ:** อ่านด้วย `UNSEEN` แต่ Post Process Action ไม่ใช่ Mark as Read
* **วิธีแก้:** ใน node `Listener: IMAP Email Trigger` ตรวจว่า Action = **Mark as Read** (workflow 02 ยังกันซ้ำอีกชั้นด้วย Message-ID ที่อยู่ใน `Email_Logs` แล้ว)

### ❓ 8. `The item has no binary field 'attachment_0'`
* **สาเหตุ:** node ส่งอีเมลอ้างถึงไฟล์แนบ แต่อีเมลขาเข้าไม่มีไฟล์แนบ
* **วิธีแก้:** workflow 02 ปัจจุบันส่งชื่อไฟล์แนบจาก `attach_names` ที่คำนวณจาก binary จริงแล้ว ถ้ายังเจอแปลว่ากำลังใช้ workflow `UNUSED_` อยู่

---

## 8. รวมคำสั่งสำคัญ (Cheat Sheet)

| การทำงาน | คำสั่ง |
| :--- | :--- |
| Deploy / redeploy ทั้งระบบ | `docker compose up -d --build` |
| Import workflow ใน container | `docker exec -u node n8n_auto_email n8n import:workflow --separate --input=/home/node/workflows/` |
| รีสตาร์ท n8n | `docker restart n8n_auto_email` |
| ดู log | `docker logs -f n8n_auto_email` / `docker logs -f automail_web` |
| ตรวจสถานะเว็บ | `curl http://localhost:5000/api/status` |
| ดูรายชื่อ workflow | `docker exec -u node n8n_auto_email n8n list:workflow` |
| เปิด Active workflow | `docker exec -u node n8n_auto_email n8n publish:workflow --id=<WORKFLOW_ID>` |
| รัน n8n บนเครื่อง | `npm start` (หรือ `npm run dev` = `--tunnel`) |
| Export workflow (Windows) | `.\scripts\export-workflows.ps1` |
| Export credential | `n8n export:credentials --all --output=./credentials.json` |
| Import credential | `n8n import:credentials --input=./credentials.json` |
