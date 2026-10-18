const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '..', 'n8n_data', 'automail.sqlite');
console.log(`Initializing SQLite database at: ${dbPath}`);

const db = new DatabaseSync(dbPath);

// Create table mail_records
db.exec(`
  CREATE TABLE IF NOT EXISTS mail_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    insurance_status TEXT DEFAULT 'active',
    insurance_date_to TEXT NOT NULL,
    mail_send_status TEXT DEFAULT 'pending',
    mail_id TEXT,
    error_message TEXT,
    sent_at DATETIME,
    reply_received_at DATETIME,
    reply_forwarded_to TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_mail_id ON mail_records(mail_id);
  CREATE INDEX IF NOT EXISTS idx_email ON mail_records(email);
  CREATE INDEX IF NOT EXISTS idx_send_status ON mail_records(mail_send_status);
`);

// Insert initial demo records if table is empty
const rowCount = db.prepare('SELECT COUNT(*) as count FROM mail_records').get();
if (rowCount.count === 0) {
  // Create 2 test rows with due dates ~3 months from today
  const d1 = new Date();
  d1.setMonth(d1.getMonth() + 3);
  const dateStr1 = d1.toISOString().split('T')[0];

  const d2 = new Date();
  d2.setMonth(d2.getMonth() + 3);
  d2.setDate(d2.getDate() + 5);
  const dateStr2 = d2.toISOString().split('T')[0];

  const insert = db.prepare(`
    INSERT INTO mail_records (no, name, email, insurance_status, insurance_date_to, mail_send_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insert.run('1', 'คุณสมชาย ใจดี', 'somchai.demo@example.com', 'active', dateStr1, 'pending');
  insert.run('2', 'คุณวิภาวรรณ สดใส', 'wipawan.demo@example.com', 'active', dateStr2, 'pending');

  console.log('Seeded 2 sample records into mail_records.');
} else {
  console.log(`Table mail_records already has ${rowCount.count} records.`);
}

console.log('SQLite database initialized successfully!');
