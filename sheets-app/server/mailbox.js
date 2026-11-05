// ดึงไฟล์แนบของอีเมลขาเข้าจากกล่องจดหมายโดยตรงด้วย Message-ID (IMAP) ไม่ต้องเก็บสำเนาไว้ใน Google Drive
// ตั้งค่าใน .env: IMAP_USER, IMAP_PASSWORD (App Password), IMAP_HOST (ค่าเริ่มต้น imap.gmail.com), IMAP_PORT (ค่าเริ่มต้น 993)
const { ImapFlow } = require('imapflow');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function imapConfig() {
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;
  if (!user || !pass) throw httpError(503, 'ยังไม่ได้ตั้งค่า IMAP_USER / IMAP_PASSWORD ใน .env ของ server');
  return {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, '') }, // App Password ของ Gmail แสดงแบบมีเว้นวรรค
    logger: false
  };
}

// ส่วนของอีเมลที่เป็นไฟล์แนบ เรียงตามลำดับในอีเมล (ลำดับเดียวกับ attachment_0, attachment_1 ... ใน n8n)
function attachmentParts(node, out = []) {
  if (!node) return out;
  if (node.childNodes && node.childNodes.length) {
    node.childNodes.forEach(child => attachmentParts(child, out));
    return out;
  }
  const name = node.dispositionParameters?.filename || node.parameters?.name;
  if (node.disposition === 'attachment' || name) {
    out.push({ part: node.part || '1', name: name || 'file', mimeType: node.type || 'application/octet-stream', size: node.size });
  }
  return out;
}

// เปิดไฟล์แนบ 1 ไฟล์: หาตามชื่อไฟล์ก่อน ไม่เจอค่อยใช้ลำดับ
// คืน stream ของเนื้อไฟล์ (ถอดรหัส base64 แล้ว) และ close() ที่ต้องเรียกเมื่อส่งไฟล์เสร็จ
async function openMailAttachment(messageId, { index, name }) {
  const id = String(messageId || '').replace(/[<>]/g, '').trim();
  if (!id) throw httpError(404, 'รายการนี้ไม่มี Message-ID');

  const client = new ImapFlow(imapConfig());
  await client.connect();
  let lock;
  try {
    // Gmail: โฟลเดอร์ "All Mail" (special-use \All) รวมอีเมลที่เก็บถาวรแล้ว ชื่อโฟลเดอร์เปลี่ยนตามภาษาบัญชี จึงหาจาก flag
    const boxes = await client.list();
    const all = boxes.find(b => b.specialUse === '\\All');
    lock = await client.getMailboxLock(all ? all.path : 'INBOX');

    const uids = await client.search({ header: { 'message-id': id } }, { uid: true });
    if (!uids || !uids.length) throw httpError(404, 'ไม่พบอีเมลนี้ในกล่องจดหมาย (อาจถูกลบไปแล้ว)');
    const uid = String(uids[uids.length - 1]);

    const msg = await client.fetchOne(uid, { bodyStructure: true }, { uid: true });
    const parts = attachmentParts(msg && msg.bodyStructure);
    const target = (name && parts.find(p => p.name === name)) || parts[index];
    if (!target) throw httpError(404, 'ไม่พบไฟล์แนบนี้ในอีเมล');

    const { content } = await client.download(uid, target.part, { uid: true });
    const close = async () => {
      try { lock.release(); } catch { /* ปล่อยแล้ว */ }
      await client.logout().catch(() => {});
    };
    return { name: target.name, mimeType: target.mimeType, stream: content, close };
  } catch (err) {
    if (lock) lock.release();
    await client.logout().catch(() => {});
    throw err;
  }
}

module.exports = { openMailAttachment, attachmentParts };
