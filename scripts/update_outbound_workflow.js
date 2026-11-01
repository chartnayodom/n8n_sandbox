const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'workflows', '01 - Google Sheets Outbound Email (Service Account) (3).json');
const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// 1. Update Filter Node
const filterNode = wf.nodes.find(n => n.name === '3. Filter due_date_to (3 Months) & Unsent');
if (filterNode) {
  filterNode.parameters.jsCode = `// 3. กรองข้อมูล: ตรวจสอบวันหมดอายุ (Expiry_Date) รอบ 6 เดือน และรอบ 3 เดือน
const results = [];
const today = new Date();
today.setHours(0, 0, 0, 0);

for (const item of $input.all()) {
  const row = item.json;
  
  const name = row['Customer_Name'] || row['Name'] || row['ชื่อ'] || row['name'] || '';
  const email = row['Email'] || row['email'] || row['อีเมล'] || '';
  const expiryDateRaw = row['Expiry_Date'] || row['due_date_to'] || row['dueDate'] || row['insurance_date_to'] || '';
  const policyNo = row['Policy_No'] || row['policy'] || '';
  const insuranceType = row['Insurance_Type'] || row['type'] || 'ประกันภัย';
  
  const r1Status = (row['Mail_R1_Status'] || '').trim();
  const r2Status = (row['Mail_R2_Status'] || '').trim();
  const dataStatus = (row['Data_Status'] || 'Valid').trim();
  
  // ข้ามรายการที่ไม่มี email หรือถูกระบุว่า Invalid
  if (!email || dataStatus === 'Invalid') {
    continue;
  }
  
  if (!expiryDateRaw) continue;
  const expiryDate = new Date(expiryDateRaw);
  if (isNaN(expiryDate.getTime())) continue;
  expiryDate.setHours(0, 0, 0, 0);
  
  // คำนวณจำนวนวันก่อนหมดอายุ
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let targetRound = null;
  let roundLabel = '';
  let monthsAhead = 0;
  
  // เกณฑ์รอบ 6 เดือน (R1): เหลือวันหมดอายุ 91 - 180 วัน (~3 ถึง 6 เดือน) และยังไม่เคยส่งรอบ R1
  if (diffDays > 90 && diffDays <= 180) {
    if (r1Status !== 'Sent' && r1Status !== 'สำเร็จ') {
      targetRound = 'R1';
      roundLabel = 'ล่วงหน้า 6 เดือน';
      monthsAhead = 6;
    }
  }
  // เกณฑ์รอบ 3 เดือน (R2): เหลือวันหมดอายุ 1 - 90 วัน (ภายใน 3 เดือน) และยังไม่เคยส่งรอบ R2
  else if (diffDays > 0 && diffDays <= 90) {
    if (r2Status !== 'Sent' && r2Status !== 'สำเร็จ') {
      targetRound = 'R2';
      roundLabel = 'ล่วงหน้า 3 เดือน';
      monthsAhead = 3;
    }
  }
  
  if (targetRound) {
    results.push({
      json: {
        ...row,
        resolved_name: name || 'คุณลูกค้า',
        resolved_email: email,
        resolved_due_date: expiryDateRaw,
        policy_no: policyNo,
        insurance_type: insuranceType,
        mail_round: targetRound,
        round_label: roundLabel,
        months_ahead: monthsAhead,
        days_remaining: diffDays,
        row_number: row.row_number || item.pairedItem?.item || null
      }
    });
  }
}

return results;`;
}

// 2. Update Build Mail Template Node
const templateNode = wf.nodes.find(n => n.name === '4.1-4.2 Build Mail Template');
if (templateNode) {
  templateNode.parameters.jsCode = `// 4.1-4.2 เตรียม Mail Body Template โดยใส่ "ชื่อ", รอบการส่ง, และรายละเอียดกรมธรรม์
const record = $input.item.json;
const name = record.resolved_name;
const email = record.resolved_email;
const dueDate = record.resolved_due_date;
const policyNo = record.policy_no || 'POL-REF';
const insuranceType = record.insurance_type || 'ประกันภัย';
const mailRound = record.mail_round; // 'R1' หรือ 'R2'
const roundLabel = record.round_label; // 'ล่วงหน้า 6 เดือน' หรือ 'ล่วงหน้า 3 เดือน'
const monthsAhead = record.months_ahead; // 6 หรือ 3

// สร้าง Message-ID เฉพาะสำหรับใช้อ้างอิง
const domain = 'automail.internal';
const customMessageId = \`<n8n-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}@\${domain}>\`;

const todayStr = new Date().toISOString().split('T')[0];

const subject = \`[แจ้งเตือนครบกำหนด\${roundLabel}] เรียน \${name} กรมธรรม์ของท่านใกล้ครบกำหนดในอีก \${monthsAhead} เดือน [\${policyNo}]\`;

const urgencyNote = mailRound === 'R2' 
  ? \`<p style="color: #d93025; font-weight: bold;">⚠️ กรมธรรม์ของท่านใกล้หมดอายุความคุ้มครองในอีกประมาณ 3 เดือน กรุณาเตรียมเอกสารหรือติดต่อเจ้าหน้าที่เพื่อดำเนินการต่ออายุความคุ้มครองอย่างต่อเนื่องครับ</p>\`
  : \`<p style="color: #1a73e8;">แจ้งเตือนล่วงหน้า 6 เดือน เพื่อให้ท่านมีเวลาตรวจสอบรายละเอียดความคุ้มครองและเตรียมพร้อมการต่ออายุกรมธรรม์ครับ</p>\`;

const htmlBody = \`
<div style="font-family: 'Sarabun', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px;">
  <h2 style="color: #1a73e8; margin-top: 0;">แจ้งเตือนกำหนดการต่ออายุกรมธรรม์ (\${roundLabel})</h2>
  <p>เรียนคุณ <strong>\${name}</strong>,</p>
  <p>ระบบขอแจ้งเตือนว่ากรมธรรม์ <strong>\${insuranceType}</strong> เลขที่ <strong>\${policyNo}</strong> ของท่านมีกำหนดครบกำหนดในวันที่: <strong>\${dueDate}</strong> (อีกประมาณ \${monthsAhead} เดือนข้างหน้า)</p>
  \${urgencyNote}
  <div style="background-color: #f8f9fa; border-left: 4px solid #1a73e8; padding: 12px 16px; margin: 16px 0;">
    <p style="margin: 0; font-size: 13px;">📋 <strong>หมายเลขกรมธรรม์:</strong> \${policyNo}</p>
    <p style="margin: 4px 0 0 0; font-size: 13px;">📅 <strong>วันหมดอายุความคุ้มครอง:</strong> \${dueDate}</p>
    <p style="margin: 4px 0 0 0; font-size: 13px;">รอบการแจ้งเตือน: \${roundLabel}</p>
  </div>
  <p>หากท่านมีข้อสงสัยหรือต้องการดำเนินการต่ออายุความคุ้มครอง สามารถตอบกลับ (Reply) อีเมลฉบับนี้ได้ทันทีครับ</p>
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
  <p style="font-size: 12px; color: #777;">อีเมลนี้ถูกส่งโดยระบบอัตโนมัติ AutoMail Insurance (Reference ID: \${customMessageId})</p>
</div>
\`;

const file1 = $('Download file1').first().binary?.data;
const file2 = $('Download file').first().binary?.data1;
return {
  json: {
    ...record,
    mail_subject: subject,
    mail_html: htmlBody,
    generated_message_id: customMessageId,
    sent_date: todayStr
  },
  binary: {
    data: file1,
    data1: file2
  }
};`;
}

// 3. Update Success Record Node (4.3.T)
const successNode = wf.nodes.find(n => n.name === '4.3.T Record Success (Service Account)');
if (successNode) {
  successNode.parameters.columns = {
    mappingMode: 'defineBelow',
    value: {
      Mail_R1_Status: "={{ $json.mail_round === 'R1' ? 'Sent' : ($('4. For Loop Each Record').item.json.Mail_R1_Status || '') }}",
      Mail_R1_Date: "={{ $json.mail_round === 'R1' ? $json.sent_date : ($('4. For Loop Each Record').item.json.Mail_R1_Date || '') }}",
      Mail_R2_Status: "={{ $json.mail_round === 'R2' ? 'Sent' : ($('4. For Loop Each Record').item.json.Mail_R2_Status || '') }}",
      Mail_R2_Date: "={{ $json.mail_round === 'R2' ? $json.sent_date : ($('4. For Loop Each Record').item.json.Mail_R2_Date || '') }}",
      row_number: "={{ $('4. For Loop Each Record').item.json.row_number }}"
    },
    matchingColumns: ['row_number'],
    schema: [
      { id: 'Mail_R1_Status', displayName: 'Mail_R1_Status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false },
      { id: 'Mail_R1_Date', displayName: 'Mail_R1_Date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false },
      { id: 'Mail_R2_Status', displayName: 'Mail_R2_Status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false },
      { id: 'Mail_R2_Date', displayName: 'Mail_R2_Date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false },
      { id: 'row_number', displayName: 'row_number', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true, readOnly: true, removed: false }
    ],
    attemptToConvertTypes: false,
    convertFieldsToString: false
  };
}

// 4. Update Success/Failure Logging Nodes
const logSuccess = wf.nodes.find(n => n.name === 'Log Success Result');
if (logSuccess) {
  logSuccess.parameters.jsCode = `// บันทึก log สถานะสำเร็จเพื่อนำไปรวมส่งรายงานสรุป
const template = $('4.1-4.2 Build Mail Template').item.json;
return {
  json: {
    is_success: true,
    name: template.resolved_name,
    email: template.resolved_email,
    message_id: template.generated_message_id,
    mail_round: template.mail_round,
    round_label: template.round_label,
    reason: 'Success'
  }
};`;
}

const logFail = wf.nodes.find(n => n.name === 'Log Failure Result');
if (logFail) {
  logFail.parameters.jsCode = `// บันทึก log สถานะไม่สำเร็จเพื่อนำไปรวมส่งรายงานสรุป
const template = $('4.1-4.2 Build Mail Template').item.json;
const errMsg = $input.item.json.error?.message || 'SMTP Error';
return {
  json: {
    is_success: false,
    name: template.resolved_name,
    email: template.resolved_email,
    message_id: template.generated_message_id,
    mail_round: template.mail_round,
    round_label: template.round_label,
    reason: errMsg
  }
};`;
}

// 5. Update Aggregate Summary Report Node
const reportNode = wf.nodes.find(n => n.name === '5. Aggregate Summary Report');
if (reportNode) {
  reportNode.parameters.jsCode = `// 5. สรุปผลการส่ง Auto Email ทั้งหมดในรอบนี้ แยกตามรอบ 6 เดือน และ 3 เดือน
let successLogs = [];
let failLogs = [];

try {
  successLogs = $('Log Success Result').all().map(i => i.json);
} catch (e) {}

try {
  failLogs = $('Log Failure Result').all().map(i => i.json);
} catch (e) {}

const totalSuccess = successLogs.length;
const totalFailed = failLogs.length;
const totalProcessed = totalSuccess + totalFailed;

const r1Count = successLogs.filter(l => l.mail_round === 'R1').length;
const r2Count = successLogs.filter(l => l.mail_round === 'R2').length;

const nowStr = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

let htmlReport = \`
<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
  <h2>📊 รายงานผลการส่ง Auto Email ประจำรอบ (รอบ 6 เดือน & 3 เดือน)</h2>
  <p><strong>เวลาประมวลผล:</strong> \${nowStr}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px;">
    <tr style="background-color: #f2f2f2;"><th>รายการ</th><th>จำนวน</th></tr>
    <tr><td>ทั้งหมดที่เข้าเงื่อนไข</td><td><strong>\${totalProcessed}</strong></td></tr>
    <tr style="color: #1a73e8;"><td>รอบ 6 เดือน (R1) ส่งสำเร็จ</td><td><strong>\${r1Count}</strong></td></tr>
    <tr style="color: #d93025;"><td>รอบ 3 เดือน (R2) ส่งสำเร็จ</td><td><strong>\${r2Count}</strong></td></tr>
    <tr style="color: green;"><td>ส่งสำเร็จรวม</td><td><strong>\${totalSuccess}</strong></td></tr>
    <tr style="color: red;"><td>ไม่สำเร็จ</td><td><strong>\${totalFailed}</strong></td></tr>
  </table>
\`;

if (totalFailed > 0) {
  htmlReport += \`
  <h3 style="color: red; margin-top: 20px;">⚠️ รายการที่ไม่สำเร็จ:</h3>
  <ul>
    \${failLogs.map(f => \`<li><strong>\${f.name}</strong> (\${f.email}) [\${f.round_label || ''}] - เหตุผล: \${f.reason}</li>\`).join('')}
  </ul>
  \`;
}

htmlReport += \`
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #ccc;" />
  <p style="font-size: 12px; color: #666;">รายงานนี้สร้างขึ้นโดยระบบอัตโนมัติ n8n AutoMail</p>
</div>
\`;

return {
  json: {
    total_processed: totalProcessed,
    total_success: totalSuccess,
    total_failed: totalFailed,
    r1_success: r1Count,
    r2_success: r2Count,
    report_html: htmlReport,
    report_subject: \`[Auto Mail Report] สรุปผลส่งอีเมล 6M & 3M (สำเร็จ: \${totalSuccess}, ล้มเหลว: \${totalFailed})\`
  }
};`;
}

fs.writeFileSync(filePath, JSON.stringify(wf, null, 2), 'utf8');
console.log('SUCCESS: Workflow updated with 6-month and 3-month checking logic!');
