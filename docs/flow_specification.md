# สเปก Flow การทำงาน (จากเอกสาร Flow Auto send email)

## 1. Flow Auto Send Email (Google Sheets -> Outbound Email + รายงานผล)
1. **เข้าถึง Google Sheet:** ผ่าน URL/ID และระบุชื่อ Sheet ที่กำหนด
2. **กรองข้อมูล (Filter Data):**
   - ตรวจสอบคอลัมน์ `due_date_to` ว่าอยู่ในเงื่อนไข (หลังจากวันนี้อีก 3 เดือน)
   - ตรวจสอบสถานะว่ายังไม่ได้ส่ง (ป้องกันการส่งซ้ำ)
3. **Loop แต่ละรายการ:**
   - ดึง "ชื่อ" และ "email" มาประกอบร่างเข้ากับ **Mail Body Template** ที่เตรียมไว้
4. **ส่ง Email & ตรวจสอบผลลัพธ์ (Try / Catch หรือ Continue on Fail):**
   - **4.3.T (สำเร็จ):** บันทึกสถานะลง Google Sheet ว่า `"สำเร็จ"` พร้อมบันทึก `email_id` (Message-ID) สำหรับใช้อ้างอิงการ Reply ใน Workflow อื่น
   - **4.3.F (ไม่สำเร็จ):** บันทึกสถานะลง Google Sheet ว่า `"ไม่สำเร็จ"` พร้อมบันทึกเหตุผล/ข้อผิดพลาด (`error_reason`)
5. **รายงานผลสรุป (Summary Report):**
   - รวบรวมผลการส่งทั้งหมดในรอบนั้น (จำนวนที่สำเร็จ, ไม่สำเร็จ, รายละเอียด)
   - ส่งอีเมลแจ้งเตือนสรุปผลไปยังอีเมลเป้าหมาย (มี Config รายชื่ออีเมลผู้รับรายงาน)

---

## 2. Flow Auto Forward on New Email or Reply Email (Listener Flow)
ทำงานตลอดเวลา (Listener) เพื่อตรวจจับและ Forward อีเมล:
1. **Triggers / กรองอีเมลขาเข้า:**
   - **กรณีที่ 1 (Reply Email):** มีการตอบกลับที่ตรงกับ `email_id` ที่ Flow Auto Send Email เคยบันทึกไว้ (ตรวจสอบจาก Header `In-Reply-To` หรือ `References`)
   - **กรณีที่ 2 (New Email with Prefix):** หัวข้ออีเมล (`Subject`) มี Prefix ตามที่กำหนดไว้ (เช่น `[SUPPORT]`, `[CONTRACT]` เป็นต้น)
2. **Forward อีเมล:**
   - นำเนื้อหาอีเมลและข้อมูลผู้ส่ง Forward ไปยังอีเมลเป้าหมายที่กำหนดไว้
