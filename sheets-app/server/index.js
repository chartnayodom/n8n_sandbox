const express = require('express');
const cors = require('cors');
require('dotenv').config();

const {
  isConfigured,
  verifyUserAccess,
  checkDrivePermission,
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
  getActivityLogs
} = require('./googleSheets');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 0. Status check
app.get('/api/status', (req, res) => {
  const configured = isConfigured();
  res.json({
    status: 'ok',
    configured,
    mode: configured ? 'live' : 'mock',
    message: configured
      ? 'Connected to Google Sheets API & Drive API'
      : 'Running in Demo Mode'
  });
});

// ==========================================
// A. AUTHENTICATION & TWO-TIER AUTHORIZATION
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุอีเมล' });
    }

    const verification = await verifyUserAccess(email);
    if (!verification.allowed) {
      return res.status(403).json(verification);
    }

    res.json({
      success: true,
      user: {
        email: verification.email,
        name: verification.name,
        role: verification.role
      },
      token: `jwt_session_${Date.now()}`
    });
  } catch (err) {
    console.error('Authentication Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Drive Permission Check only
app.get('/api/auth/check-drive', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email parameter required' });
    const result = await checkDrivePermission(email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 1. DASHBOARD SUMMARY
// ==========================================
app.get('/api/dashboard', async (req, res) => {
  try {
    const summary = await getDashboardSummary();
    res.json(summary);
  } catch (err) {
    console.error('Error fetching dashboard summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. MASTER DATA (Customers & Whitelist)
// ==========================================
app.get('/api/master-data', async (req, res) => {
  try {
    const data = await getMasterData();
    res.json({ data });
  } catch (err) {
    console.error('Error fetching master data:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/master-data', async (req, res) => {
  try {
    const result = await addMasterData(req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error adding master data:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/master-data/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateMasterData(id, req.body);
    res.json(result);
  } catch (err) {
    console.error('Error updating master data:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. EMAIL LOGS & ACTIONS
// ==========================================
app.get('/api/emails', async (req, res) => {
  try {
    const logs = await getEmailLogs();
    res.json({ data: logs });
  } catch (err) {
    console.error('Error fetching email logs:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/emails', async (req, res) => {
  try {
    const result = await addEmailLog(req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error adding email log:', err);
    res.status(500).json({ error: err.message });
  }
});

// Re-forward Email
app.post('/api/emails/re-forward', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Email Log ID is required' });
    const result = await reForwardEmail(id);
    res.json(result);
  } catch (err) {
    console.error('Error re-forwarding email:', err);
    res.status(500).json({ error: err.message });
  }
});

// Quick Whitelist sender from Needs Review
app.post('/api/emails/whitelist', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Sender email is required' });
    const result = await quickWhitelistSender(email, name);
    res.json(result);
  } catch (err) {
    console.error('Error quick whitelisting sender:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. TEMPLATES (CRUD)
// ==========================================
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await getTemplates();
    res.json({ data: templates });
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const result = await saveTemplate(req.body);
    res.json(result);
  } catch (err) {
    console.error('Error saving template:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteTemplate(id);
    res.json(result);
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. CONFIG / SYSTEM SETTINGS (sheet config)
// ==========================================
app.get('/api/config', async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ data: config });
  } catch (err) {
    console.error('Error fetching config:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { category, key, value, permissionRole, description } = req.body;
    if (!category || !key) {
      return res.status(400).json({ error: 'Category and Key are required' });
    }
    const result = await saveConfigItem({ category, key, value, permissionRole, description });
    res.json(result);
  } catch (err) {
    console.error('Error saving config item:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/config/:category/:key', async (req, res) => {
  try {
    const { category, key } = req.params;
    const result = await deleteConfigItem(category, key);
    res.json(result);
  } catch (err) {
    console.error('Error deleting config item:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ACTIVITY LOGS
// ==========================================
app.get('/api/activity-logs', (req, res) => {
  res.json({ data: getActivityLogs() });
});

// Legacy backward-compatibility endpoint
app.get('/api/sheets', async (req, res) => {
  try {
    const data = await getMasterData();
    res.json({ isMock: false, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AutoMail Insurance Backend running on http://localhost:${PORT}`);
  console.log(`📡 Google Sheets Config Status: ${isConfigured() ? 'LIVE (Google Sheets & Drive Connected)' : 'DEMO MODE'}`);
});
