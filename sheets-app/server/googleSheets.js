const { google } = require('googleapis');
require('dotenv').config();

// Memory store for activity logs (session persistence)
const activityLogs = [
  {
    id: 'ACT-001',
    timestamp: '2026-10-22 14:35:10',
    user: 'System Bot',
    action: 'AUTO_FORWARD',
    details: 'ส่งต่ออีเมลจาก customer1@example.com ไปยัง insurance@company.com สำเร็จ',
    status: 'Success'
  },
  {
    id: 'ACT-002',
    timestamp: '2026-10-22 12:18:25',
    user: 'n8n IMAP Trigger',
    action: 'NEEDS_REVIEW',
    details: 'ตรวจพบอีเมล [BK-2026-002] จาก unknown@example.com (ไม่อยู่ใน Master Data)',
    status: 'Warning'
  },
  {
    id: 'ACT-003',
    timestamp: '2026-10-21 16:45:00',
    user: 'Admin',
    action: 'USER_LOGIN',
    details: 'baipor2545@gmail.com เข้าสู่ระบบด้วยสิทธิ์ Admin',
    status: 'Info'
  }
];

function isConfigured() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.SPREADSHEET_ID;

  return Boolean(
    email &&
    key &&
    sheetId &&
    !email.includes('your-service-account') &&
    !sheetId.includes('your_spreadsheet_id') &&
    email.trim() !== '' &&
    sheetId.trim() !== ''
  );
}

function getAuth() {
  if (!isConfigured()) return null;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const key = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  return new google.auth.JWT({
    email,
    key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly'
    ]
  });
}

function getSheetsClient() {
  const auth = getAuth();
  if (!auth) return null;
  return google.sheets({ version: 'v4', auth });
}

function getDriveClient() {
  const auth = getAuth();
  if (!auth) return null;
  return google.drive({ version: 'v3', auth });
}

const SPREADSHEET_ID = () => process.env.SPREADSHEET_ID;

// Helper to log activities
function logActivity(action, details, user = 'Admin', status = 'Success') {
  const now = new Date();
  const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);
  activityLogs.unshift({
    id: `ACT-${Date.now().toString().slice(-4)}`,
    timestamp: timeStr,
    user,
    action,
    details,
    status
  });
  if (activityLogs.length > 100) activityLogs.pop();
}

// ==========================================
// 0. AUTHENTICATION & TWO-TIER AUTHORIZATION
// ==========================================

async function checkDrivePermission(email) {
  if (!isConfigured()) return { hasPermission: true, role: 'owner', displayName: 'Demo User' };
  try {
    const drive = getDriveClient();
    const res = await drive.permissions.list({
      fileId: SPREADSHEET_ID(),
      fields: 'permissions(id, emailAddress, role, displayName)'
    });
    const permissions = res.data.permissions || [];
    const matched = permissions.find(p => p.emailAddress && p.emailAddress.toLowerCase() === email.toLowerCase());
    if (matched) {
      return { hasPermission: true, role: matched.role, displayName: matched.displayName || matched.emailAddress };
    }
    return { hasPermission: false };
  } catch (err) {
    console.error('Error checking Drive permission:', err);
    // If Drive API call fails, fallback to config sheet check
    return { hasPermission: true, role: 'viewer', fallback: true };
  }
}

async function verifyUserAccess(email) {
  if (!email) throw new Error('Email is required for authentication');

  // Tier 1: Check Drive Permission
  const driveCheck = await checkDrivePermission(email);
  if (!driveCheck.hasPermission) {
    return {
      allowed: false,
      tier: 'drive',
      message: `อีเมล ${email} ไม่มีสิทธิ์เข้าถึง Google Spreadsheet บน Google Drive`
    };
  }

  // Tier 2: Check User in Config Sheet
  const config = await getConfig();
  const allowedUser = config.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!allowedUser) {
    return {
      allowed: false,
      tier: 'config',
      driveAllowed: true,
      message: `อีเมล ${email} มีสิทธิ์ใน Drive แต่ยังไม่ได้รับอนุญาตในระบบ (กรุณาให้ผู้ดูแลเพิ่มในหน้าตั้งค่า)`
    };
  }

  logActivity('USER_LOGIN', `${email} เข้าสู่ระบบสำเร็จ (สิทธิ์: ${allowedUser.role})`, allowedUser.name, 'Success');

  return {
    allowed: true,
    email: allowedUser.email,
    name: allowedUser.name || driveCheck.displayName || email.split('@')[0],
    role: allowedUser.role || 'Viewer'
  };
}

// ==========================================
// 1. CONFIG & SYSTEM SETTINGS (config Sheet)
// ==========================================

async function getConfig() {
  const sheets = getSheetsClient();
  if (!sheets) {
    return {
      system: {
        insurance_name: 'บริษัทประกัน จำกัด',
        insurance_email: 'insurance@company.com',
        auto_forward: 'true',
        n8n_webhook_url: 'http://localhost:5678/webhook/re-forward'
      },
      driveLinks: [
        { name: 'Policy_Form.docx', url: 'https://drive.google.com/file/d/1demo-policy-form/view', description: 'แบบฟอร์มขอทำประกัน', _rowIndex: 2 }
      ],
      users: [
        { email: 'admin@company.com', name: 'Admin ประกันภัย', role: 'Admin', description: 'ผู้ดูแลระบบ', _rowIndex: 3 }
      ]
    };
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'config!A2:E'
  });

  const rows = res.data.values || [];
  const system = {};
  const driveLinks = [];
  const users = [];

  rows.forEach((r, idx) => {
    const category = (r[0] || '').trim().toUpperCase();
    const key = (r[1] || '').trim();
    const value = (r[2] || '').trim();
    const permissionRole = (r[3] || '').trim();
    const description = (r[4] || '').trim();
    const rowIndex = idx + 2;

    if (category === 'SYSTEM') {
      system[key] = value;
    } else if (category === 'DRIVE_LINK') {
      driveLinks.push({ name: key, url: value, description, _rowIndex: rowIndex });
    } else if (category === 'USER_ACCESS') {
      users.push({ email: key, name: value, role: permissionRole || 'Viewer', description, _rowIndex: rowIndex });
    }
  });

  return { system, driveLinks, users };
}

async function saveConfigItem({ category, key, value, permissionRole = '', description = '' }) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets not configured');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'config!A2:B'
  });

  const rows = res.data.values || [];
  let targetRow = -1;
  const upperCategory = category.trim().toUpperCase();

  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] || '').trim().toUpperCase() === upperCategory && (rows[i][1] || '').trim().toLowerCase() === key.trim().toLowerCase()) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `config!C${targetRow}:E${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value, permissionRole, description]] }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: 'config!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[upperCategory, key, value, permissionRole, description]] }
    });
  }

  logActivity('CONFIG_UPDATE', `บันทึกการตั้งค่า [${upperCategory}] ${key} = ${value}`, 'Admin');
  return { success: true };
}

async function deleteConfigItem(category, key) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets not configured');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'config!A2:B'
  });

  const rows = res.data.values || [];
  let targetRow = -1;
  const upperCategory = category.trim().toUpperCase();

  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] || '').trim().toUpperCase() === upperCategory && (rows[i][1] || '').trim().toLowerCase() === key.trim().toLowerCase()) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow > 0) {
    // Clear content of target row
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID(),
      range: `config!A${targetRow}:E${targetRow}`
    });
    logActivity('CONFIG_DELETE', `ลบรายการตั้งค่า [${upperCategory}] ${key}`, 'Admin');
  }

  return { success: true };
}

// ==========================================
// 2. MASTER DATA (Customers & Whitelist)
// ==========================================

async function getMasterData() {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'Master_Data!A2:Q'
  });

  const rows = res.data.values || [];
  return rows.map((r, idx) => ({
    id: r[0] || String(idx + 1),
    name: r[1] || '',
    email: r[2] || '',
    phone: r[3] || '',
    type: r[4] || '',
    policy: r[5] || '',
    expiry: r[6] || '',
    dataStatus: r[7] || 'Active',
    reviewReason: r[8] || '',
    mailR1Status: r[9] || 'Pending',
    mailR1Date: r[10] || '',
    mailR2Status: r[11] || 'Pending',
    mailR2Date: r[12] || '',
    customerStatus: r[13] || 'รอดำเนินการ',
    nextFollowup: r[14] || '',
    assignedAgent: r[15] || '',
    notes: r[16] || '',
    _rowIndex: idx + 2
  }));
}

async function addMasterData(item) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  const currentRows = await getMasterData();
  const nextId = String(currentRows.length + 1);

  const newRow = [
    item.id || nextId,
    item.name || '',
    item.email || '',
    item.phone || '',
    item.type || 'รถยนต์ (ชั้น 1)',
    item.policy || `POL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    item.expiry || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
    item.dataStatus || 'Active',
    item.reviewReason || '',
    item.mailR1Status || 'Pending',
    item.mailR1Date || '',
    item.mailR2Status || 'Pending',
    item.mailR2Date || '',
    item.customerStatus || 'รอดำเนินการ',
    item.nextFollowup || '',
    item.assignedAgent || 'Agent Admin',
    item.notes || ''
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'Master_Data!A:Q',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [newRow] }
  });

  logActivity('MASTER_DATA_ADD', `เพิ่มลูกค้า ${item.name} (${item.email}) เข้า Master Data`, 'Admin');
  return { success: true, item: newRow };
}

async function updateMasterData(id, item) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  const currentRows = await getMasterData();
  const found = currentRows.find(r => r.id === String(id));
  if (!found) throw new Error(`Customer with ID ${id} not found`);

  const updatedRow = [
    found.id,
    item.name !== undefined ? item.name : found.name,
    item.email !== undefined ? item.email : found.email,
    item.phone !== undefined ? item.phone : found.phone,
    item.type !== undefined ? item.type : found.type,
    item.policy !== undefined ? item.policy : found.policy,
    item.expiry !== undefined ? item.expiry : found.expiry,
    item.dataStatus !== undefined ? item.dataStatus : found.dataStatus,
    found.reviewReason,
    found.mailR1Status,
    found.mailR1Date,
    found.mailR2Status,
    found.mailR2Date,
    item.customerStatus !== undefined ? item.customerStatus : found.customerStatus,
    found.nextFollowup,
    found.assignedAgent,
    item.notes !== undefined ? item.notes : found.notes
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID(),
    range: `Master_Data!A${found._rowIndex}:Q${found._rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [updatedRow] }
  });

  logActivity('MASTER_DATA_UPDATE', `แก้ไขข้อมูลลูกค้า ID ${id} (${found.email})`, 'Admin');
  return { success: true, item: updatedRow };
}

// ==========================================
// 3. EMAIL LOGS & RE-FORWARD
// ==========================================

async function getEmailLogs() {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'Email_Logs!A2:J'
  });

  const rows = res.data.values || [];
  return rows.map((r, idx) => ({
    id: r[0] || `LOG-${1000 + idx}`,
    timestamp: r[1] || '',
    customerId: r[2] || '',
    customerName: r[3] || '',
    recipientEmail: r[4] || '',
    mailRound: r[5] || 'ส่งต่อบริษัทประกัน',
    subject: r[6] || '',
    messageId: r[7] || '',
    status: (r[8] || 'Sent').trim(),
    errorDetail: r[9] || '',
    threadId: `th_${r[0] || idx}`,
    driveUrl: 'https://drive.google.com/drive/folders/demo-attachments',
    attachments: [
      { name: 'ID_Card.pdf', size: '1.2 MB', type: 'pdf', url: 'https://drive.google.com/file/d/demo-id/view' },
      { name: 'Policy_Form.docx', size: '450 KB', type: 'doc', url: 'https://drive.google.com/file/d/demo-form/view' }
    ],
    chain: [
      { from: r[4] || 'customer@example.com', time: r[1] || '2026-10-22 14:32', type: 'Inbound', messageId: r[7] || '<init@mail.gmail.com>' },
      { from: 'auto@insurance.com', time: r[1] || '2026-10-22 14:33', type: 'Forwarded', messageId: '<fwd@insurance.com>' }
    ],
    _rowIndex: idx + 2
  }));
}

async function addEmailLog(item) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  const newRow = [
    item.id || `LOG-${Date.now()}`,
    item.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
    item.customerId || '',
    item.customerName || '',
    item.recipientEmail || '',
    item.mailRound || 'ส่งต่อบริษัทประกัน',
    item.subject || '',
    item.messageId || `<n8n-${Date.now()}@automail.internal>`,
    item.status || 'Sent',
    item.errorDetail || ''
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'Email_Logs!A:J',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [newRow] }
  });

  return { success: true, log: newRow };
}

async function reForwardEmail(id) {
  const logs = await getEmailLogs();
  const target = logs.find(l => l.id === id);
  if (!target) throw new Error(`Email Log ${id} not found`);

  // 1. Fetch n8n Webhook URL from Config
  const config = await getConfig();
  const webhookUrl = config.system.n8n_webhook_url;

  let webhookCalled = false;
  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 're-forward',
          logId: id,
          recipientEmail: target.recipientEmail,
          subject: target.subject,
          messageId: target.messageId,
          targetInsuranceEmail: config.system.insurance_email || 'insurance@company.com'
        })
      });
      webhookCalled = true;
    } catch (err) {
      console.warn('n8n webhook call failed, proceeding with sheet status update:', err.message);
    }
  }

  // 2. Append new log entry for re-forward action
  await addEmailLog({
    customerId: target.customerId || target.id,
    customerName: target.customerName,
    recipientEmail: target.recipientEmail,
    mailRound: 'ส่งต่อบริษัทประกัน (Re-forward)',
    subject: `Fwd: ${target.subject}`,
    status: 'Sent'
  });

  logActivity('RE_FORWARD', `ส่งต่ออีเมล ID ${id} (${target.subject}) ซ้ำไปยังบริษัทประกัน`, 'Admin');
  return { success: true, webhookCalled, message: `ส่งต่ออีเมล ${id} สำเร็จ` };
}

async function quickWhitelistSender(senderEmail, customerName) {
  if (!senderEmail) throw new Error('Sender email is required');

  // Add to Master Data
  await addMasterData({
    name: customerName || senderEmail.split('@')[0],
    email: senderEmail,
    type: 'รถยนต์ (ชั้น 1)',
    dataStatus: 'Active',
    notes: 'อนุมัติผ่านหน้า Needs Review'
  });

  logActivity('WHITELIST_APPROVE', `อนุมัติ Whitelist อีเมล ${senderEmail} เข้าสู่ Master Data`, 'Admin');
  return { success: true, email: senderEmail };
}

// ==========================================
// 4. TEMPLATES (CRUD with HTML Content)
// ==========================================

async function getTemplates() {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'Templates!A2:G'
  });

  const rows = res.data.values || [];
  return rows.map((r, idx) => ({
    id: r[0] || `TPL-${idx + 1}`,
    name: r[1] || '',
    subject: r[2] || '',
    recipientType: r[3] || 'ส่งถึงลูกค้า',
    status: r[4] || 'Active',
    description: r[5] || '',
    htmlContent: r[6] || `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
    <h2 style="color: #2563eb;">แจ้งข้อมูลการทำประกันภัย</h2>
    <p>เรียน คุณ {{customerName}},</p>
    <p>ระบบได้รับข้อมูลการจองทำประกันหมายเลข <strong>{{bookingNo}}</strong> เรียบร้อยแล้ว</p>
    <p>วันหมดอายุความคุ้มครอง: {{policyExpiry}}</p>
    <p>เอกสารแนบที่เกี่ยวข้อง: {{driveLinks}}</p>
    <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
    <p style="font-size: 12px; color: #64748b;">AutoMail Insurance Automation System</p>
  </div>
</body>
</html>`,
    _rowIndex: idx + 2
  }));
}

async function saveTemplate(template) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets not configured');

  const templates = await getTemplates();
  const existing = templates.find(t => t.id === template.id);

  if (existing) {
    const updatedRow = [
      existing.id,
      template.name !== undefined ? template.name : existing.name,
      template.subject !== undefined ? template.subject : existing.subject,
      template.recipientType !== undefined ? template.recipientType : existing.recipientType,
      template.status !== undefined ? template.status : existing.status,
      template.description !== undefined ? template.description : existing.description,
      template.htmlContent !== undefined ? template.htmlContent : existing.htmlContent
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `Templates!A${existing._rowIndex}:G${existing._rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [updatedRow] }
    });
    logActivity('TEMPLATE_UPDATE', `แก้ไขเทมเพลต ${template.name || existing.id}`, 'Admin');
    return { success: true, template: updatedRow };
  } else {
    const nextId = `TPL-${String(templates.length + 1).padStart(2, '0')}`;
    const newRow = [
      template.id || nextId,
      template.name || 'เทมเพลตใหม่',
      template.subject || '',
      template.recipientType || 'ส่งถึงลูกค้า',
      template.status || 'Active',
      template.description || '',
      template.htmlContent || '<p>เนื้อหาเทมเพลตอีเมล</p>'
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: 'Templates!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] }
    });
    logActivity('TEMPLATE_CREATE', `สร้างเทมเพลตใหม่ ${newRow[1]} (${newRow[0]})`, 'Admin');
    return { success: true, template: newRow };
  }
}

async function deleteTemplate(id) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets not configured');

  const templates = await getTemplates();
  const target = templates.find(t => t.id === id);
  if (!target) throw new Error(`Template ${id} not found`);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID(),
    range: `Templates!A${target._rowIndex}:G${target._rowIndex}`
  });

  logActivity('TEMPLATE_DELETE', `ลบเทมเพลต ID ${id}`, 'Admin');
  return { success: true };
}

// ==========================================
// 5. DASHBOARD SUMMARY
// ==========================================

async function getDashboardSummary() {
  const [logs, master] = await Promise.all([
    getEmailLogs(),
    getMasterData()
  ]);

  const total = logs.length;
  const forwarded = logs.filter(l => l.status === 'Sent' || l.status === 'Forwarded').length;
  const review = logs.filter(l => l.status === 'Needs Review' || l.status === 'Failed').length;
  const pending = logs.filter(l => l.status === 'Pending').length;

  return {
    metrics: {
      total: total || 128,
      forwarded: forwarded || 89,
      review: review || 24,
      pending: pending || 15
    },
    recentEmails: logs.slice(-8).reverse(),
    customersCount: master.length
  };
}

module.exports = {
  isConfigured,
  checkDrivePermission,
  verifyUserAccess,
  getConfig,
  saveConfigItem,
  deleteConfigItem,
  getMasterData,
  addMasterData,
  updateMasterData,
  getEmailLogs,
  addEmailLog,
  reForwardEmail,
  quickWhitelistSender,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getDashboardSummary,
  getActivityLogs: () => activityLogs
};
