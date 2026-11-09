// Self-check: no fabricated values are written to the sheet. Run: node googleSheets.check.js
// Uses an in-memory fake of googleapis + fetch, never touches the real spreadsheet.
const assert = require('assert');

process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'check@test.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = 'fake';
process.env.SPREADSHEET_ID = 'fake-sheet';

const tabs = { Master_Data: [], Email_Logs: [], Templates: [], config: [] };
const tabOf = range => range.split('!')[0];
const rowOf = range => Number(range.match(/![A-Z]+(\d+)/)[1]);
const values = {
  get: async ({ range }) => ({ data: { values: tabs[tabOf(range)].map(r => [...r]) } }),
  append: async ({ range, requestBody }) => { tabs[tabOf(range)].push(...requestBody.values); },
  update: async ({ range, requestBody }) => { tabs[tabOf(range)][rowOf(range) - 2] = requestBody.values[0]; },
  clear: async ({ range }) => { tabs[tabOf(range)][rowOf(range) - 2] = []; }
};
require.cache[require.resolve('googleapis')] = {
  exports: { google: { auth: { JWT: function () {} }, sheets: () => ({ spreadsheets: { values } }), drive: () => ({}) } }
};
let webhookStatus = 500;
global.fetch = async () => ({ ok: webhookStatus < 300, status: webhookStatus, statusText: 'x' });

const g = require('./googleSheets');

(async () => {
  // 1. add with only name+email -> no fabricated values; missing expiry is flagged as ข้อมูลไม่ครบ with a reason
  await g.addMasterData({ name: 'บริษัท ก', email: 'hr@a.co' });
  assert.deepStrictEqual(tabs.Master_Data[0], ['1', 'บริษัท ก', 'hr@a.co', '', '', '', '', 'ข้อมูลไม่ครบ', 'ไม่มีวันหมดอายุ', ...Array(9).fill('')]); // A:R (R = Current_Insurer)

  // 2. duplicate email rejected on add (case-insensitive) and via quick-whitelist
  await assert.rejects(g.addMasterData({ name: 'x', email: 'HR@a.co' }), /มีอยู่แล้ว/);
  await assert.rejects(g.quickWhitelistSender('hr@a.co', ''), /มีอยู่แล้ว/);

  // 3. quick-whitelist writes only email + note; no guessed name/type/expiry -> flagged ข้อมูลไม่ครบ
  await g.quickWhitelistSender('hr@b.co', '');
  const b = tabs.Master_Data[1];
  assert.strictEqual(b[1], ''); assert.strictEqual(b[4], ''); assert.strictEqual(b[6], ''); assert.strictEqual(b[7], 'ข้อมูลไม่ครบ');

  // 4. edit round-trip keeps blank cells blank (no read-side defaults leaking back)
  await g.updateMasterData('1', { notes: 'n' });
  assert.deepStrictEqual(tabs.Master_Data[0].slice(7, 16), ['ข้อมูลไม่ครบ', 'ไม่มีวันหมดอายุ', ...Array(7).fill('')]);
  await assert.rejects(g.updateMasterData('1', { email: 'hr@b.co' }), /มีอยู่แล้ว/);
  await g.updateMasterData('1', { email: 'HR@A.co' }); // own email, different case -> allowed

  // 4.1 Current_Insurer (R) round-trips and is kept when another field is edited
  await g.updateMasterData('1', { currentInsurer: 'XYZ' });
  await g.updateMasterData('1', { notes: 'n2' });
  assert.strictEqual(tabs.Master_Data[0][17], 'XYZ');
  assert.strictEqual((await g.getMasterData())[0].currentInsurer, 'XYZ');

  // 5. re-forward: no webhook URL / failing webhook -> error and NO log row; ok webhook -> one row, blank Message_ID
  tabs.Email_Logs.push(['LOG-1', 't', '1', 'บริษัท ก', 'hr@a.co', 'R1', 'subj', '<m>', 'Sent', '']);
  await assert.rejects(g.reForwardEmail('LOG-1'), /Webhook URL/);
  tabs.config.push(['SYSTEM', 'n8n_webhook_url', 'http://n8n/webhook', '', ''], ['SYSTEM', 'insurance_email', 'ins@x.co', '', '']);
  await assert.rejects(g.reForwardEmail('LOG-1'), /500/);
  assert.strictEqual(tabs.Email_Logs.length, 1);
  webhookStatus = 200;
  await g.reForwardEmail('LOG-1');
  assert.strictEqual(tabs.Email_Logs.length, 2);
  assert.strictEqual(tabs.Email_Logs[1][7], '');

  // 6. templates: no default HTML, cleared rows hidden, new id never collides
  tabs.Templates.push(['TPL-01', 'a', 's', '', '', ''], ['TPL-02', 'b', 's', '', '', ''], ['TPL-03', 'c', 's', '', '', '']);
  await g.deleteTemplate('TPL-02');
  const list = await g.getTemplates();
  assert.deepStrictEqual(list.map(t => t.id), ['TPL-01', 'TPL-03']);
  assert.strictEqual(list[0].htmlContent, '');
  await g.saveTemplate({ name: 'd', subject: 's' });
  assert.strictEqual(tabs.Templates[3][0], 'TPL-04');

  console.log('googleSheets.check: all passed');
})().catch(e => { console.error(e); process.exit(1); });
