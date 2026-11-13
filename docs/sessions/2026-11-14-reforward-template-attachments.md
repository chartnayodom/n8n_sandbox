# Session Log — 2026-11-14: Re-forward ใช้ Forward Template + แนบไฟล์เดิมของลูกค้า

* **Agent:** Claude Code (Opus 5.5) ใน VS Code บนเครื่อง Windows (`D:\n8n_sandbox`)
* **คำขอ:** workflow `R3pXov64UiK0AkDL` (02 - AutoMail Inbound Router) — ส่วน Re-forward ให้ส่งตาม Mail Template ไปบริษัทประกัน และต้องแนบไฟล์จากอีเมลลูกค้าไปด้วย
* **Skills ที่ใช้:** `grill-with-docs`, `karpathy-guidelines`, `caveman`, `ponytail`
* **MCP ที่ใช้:** ไม่มี (ไม่ได้ทดสอบหน้าเว็บด้วย Chrome MCP — ทดสอบด้วยการเรียก webhook ตรงและอ่านผล execution จากฐานข้อมูล n8n)
* **Transcript (traceback):** `C:\Users\It_Chartnayodom\.claude\projects\d--n8n-sandbox\c530495d-420c-41f1-8bfd-2acc8d1d5582.jsonl`

## 1. สิ่งที่พบก่อนแก้

| จุด | สถานะเดิม |
| :--- | :--- |
| Workflow ใน n8n local กับไฟล์ใน repo | ตรงกัน (ต่างกันแค่ลำดับ key ของ node `Forward to Insurance (SMTP)`) |
| ชีต Templates | มี `TPL-03 ส่งต่อบริษัทประกัน` (ส่งถึงบริษัทประกัน, Active) แต่ workflow 02 ไม่เคยอ่าน |
| Listener IMAP → `Forward to Insurance (SMTP)` | แนบไฟล์อยู่แล้ว (`attachments = attach_names`) |
| Webhook Re-forward (`Build Re-forward`) | ไม่แนบไฟล์ — โค้ดเขียนไว้ว่า "ไฟล์แนบเดิมไม่ได้ถูกส่งซ้ำ" |
| `Split Attachments → Upload to Drive → Collect Attachments` | ไม่มีเส้นเชื่อมเข้ากับ flow หลัก (branch ตาย) — ไม่ได้แตะ |

## 2. การตัดสินใจ (grill-with-docs)

| # | คำถาม | คำตอบผู้ใช้ |
| :--- | :--- | :--- |
| 1 | "Hook reply" คือเส้นไหน | **Webhook Re-forward อย่างเดียว** |
| 2 | ไฟล์แนบเดิมเอามาจากไหน | **เว็บดึงจาก IMAP ด้วย Message-ID** (ใช้ `mailbox.js` ที่มีอยู่) ส่งเป็น base64 ไป webhook |
| 3 | ดึงไฟล์ไม่ครบ | **ไม่ส่งเลย** (แนวเดียวกับ Reminder Attachment) |
| 4 | ข้อความเดิมของลูกค้า | **ต่อท้าย Template** เป็นกล่อง "ข้อความจากลูกค้า" |
| 5 | หัวข้ออีเมล | **ใช้ Subject จาก Template** (เติม placeholder) |
| — | เลือก Template | Agent ตัดสินใจ: ใช้ชื่อใน `Re-forward Config.template_name_forward` แบบเดียวกับ `template_name_r1/r2` ของ workflow 01 |

## 3. ไฟล์ที่แก้

| ไฟล์ | การเปลี่ยนแปลง |
| :--- | :--- |
| `sheets-app/server/mailbox.js` | แยก `openMessage()` เพื่อใช้ร่วมกัน + เพิ่ม `fetchMailAttachments(messageId, metas)` ดึงไฟล์ครบทุกไฟล์เป็น base64 ขาดไฟล์ใด = throw |
| `sheets-app/server/googleSheets.js` | `reForwardEmail()` ดึงไฟล์ก่อนเรียก webhook แล้วส่ง `attachments` ไปด้วย ถ้าดึงไม่ได้จะ throw และไม่เขียน log |
| `workflows/R3pXov64UiK0AkDL.json` | เพิ่ม `template_name_forward` ใน `Re-forward Config` + node `Read Templates (Re-forward)` และ `Read Master_Data (Re-forward)` (executeOnce) + `Build Re-forward` ใช้ Template + ตรวจจำนวนไฟล์กับคอลัมน์ Attachments + `Send Re-forward (SMTP)` แนบ `attach_names` |
| `CONTEXT.md` | เพิ่มคำว่า **Re-forward** และ **Forward Template** |

Placeholder ที่ใช้ได้ใน Forward Template: `{{customerName}} {{insuranceName}}` (= `insurance_name` ในชีต config, เพิ่มตามคำขอผู้ใช้ให้ใช้ขึ้นต้น "เรียน {{insuranceName}}" แทนชื่อลูกค้า; หน้า preview Template บนเว็บแทนค่าให้ด้วย) `{{policyNo}} {{bookingNo}} {{policyExpiry}} {{insuranceType}} {{driveLinks}}` (= รายชื่อไฟล์แนบ) `{{referenceId}}` (= Message-ID เดิม)

## 4. Timeline การทดสอบ / deploy

| # | การทดสอบ / คำสั่ง | ผล |
| :--- | :--- | :--- |
| 1 | `node googleSheets.check.js` | all passed ✅ |
| 2 | ทดสอบ `Build Re-forward` แบบ offline ด้วย mock `$()` (8 กรณี: ครบ, ขาดไฟล์ 1 ไฟล์, ไม่มี attachments, ไม่มีไฟล์ใน log, template ไม่เจอ, Inactive, โหมดทดสอบ, หาลูกค้าด้วยอีเมล, เนื้อหามี `$&`) | all passed ✅ |
| 3 | `fetchMailAttachments` กับกล่องจดหมายจริง (2 log) | ได้ PDF ครบ 1/1 และ 2/2 ไฟล์ (เคสชื่อใน log เพี้ยน encoding ใช้ลำดับแทนได้) ✅; Message-ID ที่ไม่มี → "ไม่พบอีเมลนี้ในกล่องจดหมาย" ✅ |
| 4 | `npx n8n import:workflow --input=./workflows/R3pXov64UiK0AkDL.json` + `npx n8n publish:workflow --id=R3pXov64UiK0AkDL` | import สำเร็จ (ถูกปิดไว้ระหว่างรอ restart) |
| 5 | ผู้ใช้ restart n8n (`npm start`) และ sheets-app server | n8n PID ใหม่, active = 1, activeVersionId = versionId ✅ |
| 6 | E2E: เรียก webhook ตรงด้วย `LOG-1794327060065-d5gpf` แต่ตัดไฟล์ทิ้ง 1 ไฟล์ | HTTP 500, execution #77 error "ไฟล์แนบไม่ครบ (ได้ 1 จาก 2 ไฟล์) จึงไม่ส่งต่อ" — ไม่ส่ง ✅ |
| 7 | E2E: log เดียวกัน ไฟล์ครบ 2 PDF | HTTP 200, execution #78 success, SMTP accepted `chartnuyodom.wib@sbac.ac.th` (insurance_email ในชีตทดสอบ), messageSize 3.7MB (≈ 2.7MB ไฟล์หลัง base64) ✅ |

สคริปต์ทดสอบเก็บไว้ใน scratchpad ของ session (ไม่ได้ commit): `patch-reforward.js`, `build-reforward.js`, `test-build.js`, `e2e.js`

## 5. งานค้าง / ข้อสังเกต

* **TPL-03 Subject** ยังเป็นข้อความตายตัว `Fwd: ข้อมูลลูกค้า [BK-xxxx]` → Admin ควรแก้ในหน้า Template เป็น `Fwd: ข้อมูลลูกค้า {{customerName}} [{{bookingNo}}]`
* **TPL-03 คำขึ้นต้น** "เรียน คุณ {{customerName}}" เป็นชื่อลูกค้า แต่คนรับคือ Forward Insurer
* **ขนาดไฟล์:** รวมได้ประมาณ 12MB (n8n รับ payload 16MB) ถ้าเกิน n8n จะตอบ 413 และไม่ส่ง
* **Log ของเว็บ:** แถว Re-forward ยังบันทึกหัวข้อเป็น `Fwd: <หัวข้อเดิม>` ไม่ใช่หัวข้อจาก Template
* **Listener auto-forward** ยังใช้ HTML ตายตัวแบบเดิม (อยู่นอก scope ตามที่ผู้ใช้เลือก)
* **VPS (production)** ยังไม่ได้ deploy ต้อง build web ใหม่ + import/publish workflow 02 + restart `n8n_auto_email`
* ยังไม่ได้ commit
