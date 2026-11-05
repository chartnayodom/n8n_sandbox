const { google } = require('googleapis');
require('dotenv').config();

// ponytail: activity log อยู่ใน memory (หายเมื่อรีสตาร์ท, ไม่มีแท็บในชีต) ย้ายลงชีตเมื่อต้องการเก็บถาวร
const activityLogs = [];

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
  if (!sheets) throw new Error('Google Sheets credentials not configured');

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

// ---- ตรวจความถูกต้องของข้อมูลลูกค้า (Flow ขั้นตอน 2) ----
// อีเมลรูปแบบถูกต้อง + มีวันหมดอายุที่อ่านได้ จึงจะส่งอีเมลแจ้งเตือนได้ ไม่ผ่าน = 'ข้อมูลไม่ครบ' พร้อมเหตุผลใน Review_Reason
const DATA_INCOMPLETE = 'ข้อมูลไม่ครบ';

function isReadableDate(value) {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let d, mo;
  if (m) { mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) {
    d = +m[1]; mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
  } else return false;
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

function dataIssues({ email, expiry }) {
  const issues = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) issues.push('อีเมลไม่ถูกต้อง');
  if (!String(expiry || '').trim()) issues.push('ไม่มีวันหมดอายุ');
  else if (!isReadableDate(expiry)) issues.push('รูปแบบวันหมดอายุไม่ถูกต้อง');
  return issues;
}

// คืนค่า [Data_Status, Review_Reason]: ข้อมูลไม่ผ่าน = ข้อมูลไม่ครบ / ผ่าน = คง Invalid ที่เจ้าหน้าที่ตั้ง (ห้ามส่ง) ไม่เช่นนั้น Valid
function resolveDataStatus(chosen, issues) {
  if (issues.length) return [DATA_INCOMPLETE, issues.join(', ')];
  return [chosen === 'Invalid' ? 'Invalid' : 'Valid', ''];
}

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
    dataStatus: r[7] || '',
    reviewReason: r[8] || '',
    mailR1Status: r[9] || '',
    mailR1Date: r[10] || '',
    mailR2Status: r[11] || '',
    mailR2Date: r[12] || '',
    customerStatus: r[13] || '',
    nextFollowup: r[14] || '',
    assignedAgent: r[15] || '',
    notes: r[16] || '',
    dataIssues: dataIssues({ email: r[2], expiry: r[6] }), // ตรวจตอนอ่านด้วย เผื่อมีการแก้ในชีตโดยตรง
    _rowIndex: idx + 2
  }));
}

async function addMasterData(item) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  if (!item.email) throw new Error('กรุณาระบุอีเมล');
  const currentRows = await getMasterData();
  assertEmailUnique(currentRows, item.email);
  const nextId = String(currentRows.length + 1);
  const [dataStatus, reviewReason] = resolveDataStatus(item.dataStatus, dataIssues(item));

  // เขียนเฉพาะค่าที่ผู้ใช้กรอก ช่องที่ไม่ได้กรอกเป็นค่าว่าง (ไม่เติมค่าแทน เพราะ n8n ใช้ชีตนี้ส่งอีเมลจริง)
  const newRow = [
    item.id || nextId,
    item.name || '',
    item.email,
    item.phone || '',
    item.type || '',
    item.policy || '',
    item.expiry || '',
    dataStatus,
    reviewReason,
    item.mailR1Status || '',
    item.mailR1Date || '',
    item.mailR2Status || '',
    item.mailR2Date || '',
    item.customerStatus || '',
    item.nextFollowup || '',
    item.assignedAgent || '',
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

// 1 Customer = 1 บริษัท: อีเมลห้ามซ้ำกับแถวอื่น
function assertEmailUnique(rows, email, exceptId) {
  const e = email.trim().toLowerCase();
  const dup = rows.find(r => r.id !== exceptId && r.email.trim().toLowerCase() === e);
  if (dup) throw new Error(`อีเมล ${email} มีอยู่แล้วใน Master Data (ID ${dup.id})`);
}

async function updateMasterData(id, item) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  const currentRows = await getMasterData();
  const found = currentRows.find(r => r.id === String(id));
  if (!found) throw new Error(`Customer with ID ${id} not found`);
  if (item.email !== undefined) {
    if (!item.email) throw new Error('กรุณาระบุอีเมล');
    assertEmailUnique(currentRows, item.email, found.id);
  }
  // ตรวจเฉพาะเมื่อเปลี่ยนค่า (ค่าเดิมในชีตที่แก้มือจะไม่ทำให้บันทึกฟอร์มล้มเหลว)
  if (item.customerStatus && item.customerStatus !== found.customerStatus) assertCustomerStatus(item.customerStatus);

  const email = item.email !== undefined ? item.email : found.email;
  const [dataStatus, reviewReason] = resolveDataStatus(
    item.dataStatus !== undefined ? item.dataStatus : found.dataStatus,
    dataIssues({ email, expiry: found.expiry })
  );

  // วันหมดอายุของลูกค้าเดิมแก้ผ่านปุ่ม "ต่ออายุ" เท่านั้น (renewMasterData) เพื่อให้ reset สถานะ R1/R2 เสมอ
  const updatedRow = [
    found.id,
    item.name !== undefined ? item.name : found.name,
    email,
    item.phone !== undefined ? item.phone : found.phone,
    item.type !== undefined ? item.type : found.type,
    item.policy !== undefined ? item.policy : found.policy,
    found.expiry,
    dataStatus,
    reviewReason,
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

// สถานะลูกค้าหลังโทรติดตาม (ตรงกับค่าในชีต Master_Data) n8n filter อ่านค่านี้แบบ includes:
// มีคำว่า 'ไม่สนใจ' → หยุดส่ง R2, มีคำว่า 'ปิดงาน' → หยุดส่งทุกรอบ
const CUSTOMER_STATUSES = ['รอดำเนินการ', 'สนใจ / ดำเนินการต่อ', 'นัดหมายติดตาม', 'ยังไม่สนใจ', 'ไม่ติดต่อ / ปิดงาน'];

function assertCustomerStatus(status) {
  if (!CUSTOMER_STATUSES.includes(status)) {
    throw new Error(`สถานะลูกค้าไม่ถูกต้อง: ${status} (ใช้ได้: ${CUSTOMER_STATUSES.join(', ')})`);
  }
}

// ต่ออายุ: เจ้าหน้าที่กรอกวันหมดอายุใหม่เอง (ISO yyyy-mm-dd) แล้ว reset รอบส่งเมลและสถานะติดตามเพื่อเริ่มรอบใหม่
// เขียนเฉพาะเซลล์ที่เกี่ยวข้อง ไม่เขียนทับทั้งแถว เพื่อไม่ชนกับที่ n8n อัปเดตสถานะส่งเมลพร้อมกัน
async function renewMasterData(id, expiry) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry || '') || isNaN(new Date(expiry).getTime())) {
    throw new Error('กรุณาระบุวันหมดอายุกรมธรรม์ใหม่ให้ถูกต้อง');
  }
  const todayBkk = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  if (expiry <= todayBkk) throw new Error('วันหมดอายุใหม่ต้องเป็นวันในอนาคต');

  const found = (await getMasterData()).find(r => r.id === String(id));
  if (!found) throw new Error(`Customer with ID ${id} not found`);

  const row = found._rowIndex;
  const [dataStatus, reviewReason] = resolveDataStatus(found.dataStatus, dataIssues({ email: found.email, expiry }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID(),
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Master_Data!G${row}:I${row}`, values: [[expiry, dataStatus, reviewReason]] },
        { range: `Master_Data!J${row}:M${row}`, values: [['Pending', '', 'Pending', '']] },
        { range: `Master_Data!N${row}:O${row}`, values: [['รอดำเนินการ', '']] }
      ]
    }
  });

  logActivity('MASTER_DATA_RENEW', `ต่ออายุลูกค้า ID ${id} (${found.email}) วันหมดอายุ ${found.expiry || '-'} → ${expiry}`, 'Admin');
  return { success: true, expiry };
}

// ==========================================
// 3.5 CALL LOGS (โทรติดตามลูกค้า: Flow ขั้นตอน 4-5)
// ==========================================
const CALL_RESULTS = ['ติดต่อได้', 'ไม่รับสาย', 'เบอร์ไม่ถูกต้อง'];

async function getCallLogs() {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'Call_Logs!A2:J'
  });

  return (res.data.values || [])
    .map(r => ({
      id: r[0] || '',
      timestamp: r[1] || '',
      customerId: r[2] || '',
      customerName: r[3] || '',
      phone: r[4] || '',
      agentName: r[5] || '',
      callResult: r[6] || '',
      customerInterest: r[7] || '',
      nextAppointment: r[8] || '',
      notes: r[9] || ''
    }))
    .filter(c => c.id || c.customerId);
}

// บันทึกการโทร 1 ครั้งลง Call_Logs แล้วอัปเดตลูกค้าใน Master_Data เฉพาะเซลล์ N:P
// (Customer_Status, Next_Followup_Date, Assigned_Agent) ไม่เขียนทับทั้งแถว เพื่อไม่ชนกับที่ n8n อัปเดตสถานะส่งเมล
async function addCallLog(item) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  if (!CALL_RESULTS.includes(item.callResult)) throw new Error('กรุณาเลือกผลการโทร');
  if (item.customerStatus) assertCustomerStatus(item.customerStatus);
  const next = String(item.nextFollowup || '').trim();
  if (next && (!/^\d{4}-\d{2}-\d{2}$/.test(next) || isNaN(new Date(next).getTime()))) throw new Error('วันนัดครั้งถัดไปไม่ถูกต้อง');

  const found = (await getMasterData()).find(r => r.id === String(item.customerId));
  if (!found) throw new Error(`Customer with ID ${item.customerId} not found`);

  const agent = String(item.assignedAgent || '').trim();
  const status = item.customerStatus || found.customerStatus;
  const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }); // yyyy-mm-dd HH:mm:ss
  const log = [`CALL-${Date.now()}`, timestamp, found.id, found.name, found.phone, agent, item.callResult, status, next, String(item.notes || '').trim()];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID(),
    range: 'Call_Logs!A:J',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [log] }
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID(),
    range: `Master_Data!N${found._rowIndex}:P${found._rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status, next, agent || found.assignedAgent]] }
  });

  logActivity('CALL_LOG_ADD', `บันทึกการโทร ${found.name || found.email} (${item.callResult}) สถานะ ${status || '-'}`, agent || 'Admin');
  return { success: true, log };
}

// ==========================================
// 3. EMAIL LOGS & RE-FORWARD
// ==========================================

async function getEmailLogs() {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');

  // A:J = ข้อมูลหลัก, L = Attachments (JSON จาก workflow 02) ข้ามคอลัมน์ K (Original_Body) ที่ยาวมาก
  const [res, attRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID(), range: 'Email_Logs!A2:J' }),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID(), range: 'Email_Logs!L2:L' })
  ]);

  const rows = res.data.values || [];
  const attRows = attRes.data.values || [];
  return rows.map((r, idx) => ({
    id: r[0] || '',
    timestamp: r[1] || '',
    customerId: r[2] || '',
    customerName: r[3] || '',
    recipientEmail: r[4] || '',
    mailRound: r[5] || '',
    subject: r[6] || '',
    messageId: r[7] || '',
    status: (r[8] || '').trim(),
    errorDetail: r[9] || '',
    attachments: parseAttachments(attRows[idx]?.[0]),
    _rowIndex: idx + 2
  }));
}

function parseAttachments(text) {
  try {
    const list = JSON.parse(text || '[]');
    // { id } = ไฟล์ใน Google Drive, ไม่มี id = ไฟล์แนบในอีเมล ดึงจากกล่องจดหมายด้วย Message-ID ตามลำดับ
    return Array.isArray(list) ? list.filter(a => a && (a.id || a.name)) : [];
  } catch {
    return [];
  }
}

// ชนิดไฟล์ที่ให้เปิดแสดงในหน้าเว็บได้ (ไฟล์มาจากผู้ส่งภายนอก จึงไม่เปิด html/svg/ไฟล์อื่นแบบ inline เพื่อกันสคริปต์)
const INLINE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];

// ดึงไฟล์แนบจาก Google Drive ด้วย Service Account เฉพาะไฟล์ที่ถูกบันทึกไว้ใน Email_Logs เท่านั้น
async function getAttachment(fileId) {
  const drive = getDriveClient();
  if (!drive) throw new Error('Google Drive credentials not configured');

  const logs = await getEmailLogs();
  if (!logs.some(l => l.attachments.some(a => a.id === fileId))) {
    const err = new Error('ไม่พบไฟล์แนบนี้ใน Email_Logs');
    err.status = 404;
    throw err;
  }

  const meta = await drive.files.get({ fileId, fields: 'name,mimeType,size', supportsAllDrives: true });
  const media = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
  const mimeType = meta.data.mimeType || 'application/octet-stream';
  return { name: meta.data.name || 'file', mimeType, size: meta.data.size, inline: INLINE_TYPES.includes(mimeType), stream: media.data };
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
    item.mailRound || '',
    item.subject || '',
    item.messageId || '',
    item.status || '',
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

// เปลี่ยนสถานะของแถวใน Email_Logs (คอลัมน์ I = Send_Status) ใช้ปิดรายการ Needs Review
const MANUAL_LOG_STATUSES = ['Closed', 'Manually Forwarded'];

async function setEmailLogStatus(id, status) {
  const sheets = getSheetsClient();
  if (!sheets) throw new Error('Google Sheets credentials not configured');
  if (!MANUAL_LOG_STATUSES.includes(status)) throw new Error(`สถานะไม่ถูกต้อง: ${status}`);

  const target = (await getEmailLogs()).find(l => l.id === id);
  if (!target) throw new Error(`Email Log ${id} not found`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID(),
    range: `Email_Logs!I${target._rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] }
  });

  logActivity('EMAIL_LOG_STATUS', `เปลี่ยนสถานะอีเมล ID ${id} (${target.subject}) เป็น ${status}`, 'Admin');
  return { success: true, id, status };
}

async function reForwardEmail(id) {
  const logs = await getEmailLogs();
  const target = logs.find(l => l.id === id);
  if (!target) throw new Error(`Email Log ${id} not found`);

  // 1. Fetch n8n Webhook URL from Config
  const config = await getConfig();
  const webhookUrl = config.system.n8n_webhook_url;

  if (!webhookUrl || !webhookUrl.startsWith('http')) throw new Error('ยังไม่ได้ตั้งค่า n8n Webhook URL (หน้า ตั้งค่าระบบ)');
  if (!config.system.insurance_email) throw new Error('ยังไม่ได้ตั้งค่าอีเมลบริษัทประกัน (หน้า ตั้งค่าระบบ)');

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 're-forward',
      logId: id,
      recipientEmail: target.recipientEmail,
      subject: target.subject,
      messageId: target.messageId,
      targetInsuranceEmail: config.system.insurance_email
    })
  });
  if (!res.ok) throw new Error(`n8n webhook ตอบกลับ ${res.status} ${res.statusText}`);

  // 2. บันทึก log เฉพาะเมื่อ n8n รับคำสั่งสำเร็จ (Message_ID จริงอยู่ฝั่ง n8n จึงเว้นว่าง)
  await addEmailLog({
    customerId: target.customerId || target.id,
    customerName: target.customerName,
    recipientEmail: target.recipientEmail,
    mailRound: 'ส่งต่อบริษัทประกัน (Re-forward)',
    subject: `Fwd: ${target.subject}`,
    status: 'Sent'
  });

  // ส่งต่อจากรายการ Needs Review = เจ้าหน้าที่ยืนยันส่งต่อเอง → ปิดรายการเดิมเป็น Manually Forwarded
  if (target.status === 'Needs Review') await setEmailLogStatus(id, 'Manually Forwarded');

  logActivity('RE_FORWARD', `ส่งต่ออีเมล ID ${id} (${target.subject}) ซ้ำไปยังบริษัทประกัน`, 'Admin');
  return { success: true, message: `ส่งต่ออีเมล ${id} สำเร็จ` };
}

async function quickWhitelistSender(senderEmail, customerName) {
  if (!senderEmail) throw new Error('Sender email is required');

  // Add to Master Data
  await addMasterData({
    name: customerName || '',
    email: senderEmail,
    notes: 'อนุมัติผ่านหน้า Needs Review' // ยังไม่มีวันหมดอายุ ระบบจะตั้งเป็น ข้อมูลไม่ครบ ให้เจ้าหน้าที่ติดต่อขอข้อมูลเพิ่ม
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
  return rows
    .map((r, idx) => ({
      id: r[0] || '',
      name: r[1] || '',
      subject: r[2] || '',
      recipientType: r[3] || '',
      status: r[4] || '',
      description: r[5] || '',
      htmlContent: r[6] || '',
      _rowIndex: idx + 2
    }))
    .filter(t => t.id || t.name); // แถวที่ถูกลบ (clear) จะเหลือว่าง ไม่ต้องแสดง
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
    const maxNo = Math.max(0, ...templates.map(t => parseInt(t.id.replace(/\D/g, ''), 10) || 0));
    const nextId = `TPL-${String(maxNo + 1).padStart(2, '0')}`;
    const newRow = [
      template.id || nextId,
      template.name || '',
      template.subject || '',
      template.recipientType || '',
      template.status || '',
      template.description || '',
      template.htmlContent || ''
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
  // Needs Review = รายการสถานะ Needs Review ที่เจ้าหน้าที่ยังไม่ได้ส่งต่อ (Manually Forwarded) หรือปิด (Closed)
  // รอดำเนินการ = Pending + Failed (ค้างส่ง / รอ Retry)
  const forwarded = logs.filter(l => ['Sent', 'Forwarded', 'Manually Forwarded'].includes(l.status)).length;
  const review = logs.filter(l => l.status === 'Needs Review').length;
  const pending = logs.filter(l => l.status === 'Pending' || l.status === 'Failed').length;

  return {
    metrics: { total, forwarded, review, pending },
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
  renewMasterData,
  getEmailLogs,
  addEmailLog,
  reForwardEmail,
  setEmailLogStatus,
  getAttachment,
  getCallLogs,
  addCallLog,
  INLINE_TYPES,
  quickWhitelistSender,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getDashboardSummary,
  getActivityLogs: () => activityLogs
};
