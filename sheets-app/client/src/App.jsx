import React, { useState, useEffect } from 'react';

export default function App() {
  // Current User & Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('automail_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authEmailInput, setAuthEmailInput] = useState('baipor2545@gmail.com');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Navigation Tabs: dashboard | inbox | needs-review | master-data | templates | settings | activity-logs
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState('insurance'); // general | insurance | drive-links | users
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [dashboardData, setDashboardData] = useState({
    metrics: { total: 128, forwarded: 89, review: 24, pending: 15 },
    recentEmails: []
  });
  const [masterData, setMasterData] = useState([]);
  const [emails, setEmails] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [config, setConfig] = useState({
    system: {
      insurance_name: 'บริษัทประกัน จำกัด',
      insurance_email: 'insurance@company.com',
      auto_forward: 'true',
      n8n_webhook_url: 'http://localhost:5678/webhook/re-forward'
    },
    driveLinks: [],
    users: []
  });

  // Selected Email for Detail Modal
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [detailTab, setDetailTab] = useState('body'); // body | attachments | chain
  const [bodyFormat, setBodyFormat] = useState('preview'); // preview | text
  const [reforwarding, setReforwarding] = useState(false);

  // Inbox status filter
  const [inboxFilter, setInboxFilter] = useState('ALL');

  // Customer Modal (Add & Edit)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'รถยนต์ (ชั้น 1)',
    dataStatus: 'Active',
    notes: '',
    expiry: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
  });

  // Template Modal (Add & Edit)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateEditorMode, setTemplateEditorMode] = useState('simple'); // 'simple' | 'visual' | 'html'
  const [templateForm, setTemplateForm] = useState({
    id: '',
    name: '',
    subject: '',
    recipientType: 'ส่งถึงลูกค้า',
    status: 'Active',
    description: '',
    htmlContent: ''
  });

  // Simple Form Fields for users without HTML knowledge
  const [simpleTemplate, setSimpleTemplate] = useState({
    title: 'แจ้งข้อมูลการทำประกันภัย',
    titleColor: '#2563eb',
    greeting: 'เรียน คุณ {{customerName}},',
    messageBody: 'ระบบได้รับข้อมูลการจองทำประกันภัยของท่านเรียบร้อยแล้ว รายละเอียดความคุ้มครองและเอกสารประกอบมีดังต่อไปนี้ หากมีข้อสงสัยหรือต้องการสอบถามเพิ่มเติม สามารถติดต่อเจ้าหน้าที่ได้ตลอดเวลา ขอบคุณค่ะ',
    showBooking: true,
    showExpiry: true,
    showDrive: true,
    footer: 'AutoMail Insurance Automation System • ติดต่อฝ่ายบริการลูกค้า โทร 02-xxx-xxxx'
  });

  // New User Access Modal (inside Settings)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', name: '', role: 'Viewer', description: '' });

  // New Drive Link Modal (inside Settings)
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveForm, setDriveForm] = useState({ name: '', url: '', description: '' });

  // Notification Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  };

  // Fetch All Initial Data
  const fetchAllData = async () => {
    try {
      setRefreshing(true);
      const [dashRes, masterRes, emailRes, tplRes, confRes, logRes] = await Promise.all([
        fetch('/api/dashboard').catch(() => null),
        fetch('/api/master-data').catch(() => null),
        fetch('/api/emails').catch(() => null),
        fetch('/api/templates').catch(() => null),
        fetch('/api/config').catch(() => null),
        fetch('/api/activity-logs').catch(() => null)
      ]);

      if (dashRes && dashRes.ok) {
        const d = await dashRes.json();
        setDashboardData(d);
      }
      if (masterRes && masterRes.ok) {
        const m = await masterRes.json();
        if (m.data) setMasterData(m.data);
      }
      if (emailRes && emailRes.ok) {
        const e = await emailRes.json();
        if (e.data) setEmails(e.data);
      }
      if (tplRes && tplRes.ok) {
        const t = await tplRes.json();
        if (t.data) setTemplates(t.data);
      }
      if (confRes && confRes.ok) {
        const c = await confRes.json();
        if (c.data) setConfig(c.data);
      }
      if (logRes && logRes.ok) {
        const l = await logRes.json();
        if (l.data) setActivityLogs(l.data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    }
  }, [currentUser]);

  // Handle Google Auth Login
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmailInput.trim() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.message || 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบสิทธิ์');
        return;
      }

      setCurrentUser(data.user);
      localStorage.setItem('automail_user', JSON.stringify(data.user));
      showToast(`ยินดีต้อนรับคุณ ${data.user.name} (${data.user.role})`);
    } catch (err) {
      setAuthError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('automail_user');
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  // Re-forward Email
  const handleReForward = async (logId) => {
    try {
      setReforwarding(true);
      const res = await fetch('/api/emails/re-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: logId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('ส่งต่ออีเมลไปยังบริษัทประกันผ่าน n8n สำเร็จ!');
        fetchAllData();
      } else {
        showToast(data.error || 'ส่งต่อไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      setReforwarding(false);
    }
  };

  // Quick Whitelist sender from Needs Review
  const handleQuickWhitelist = async (senderEmail, customerName) => {
    try {
      const res = await fetch('/api/emails/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: senderEmail, name: customerName })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`อนุมัติ Whitelist อีเมล ${senderEmail} สำเร็จ!`);
        fetchAllData();
      } else {
        showToast(data.error || 'อนุมัติไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // Customer Management (Add/Edit)
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        const res = await fetch(`/api/master-data/${editingCustomer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerForm)
        });
        if (res.ok) {
          showToast('แก้ไขข้อมูลลูกค้าสำเร็จ');
          setIsCustomerModalOpen(false);
          fetchAllData();
        }
      } else {
        const res = await fetch('/api/master-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerForm)
        });
        if (res.ok) {
          showToast('เพิ่มลูกค้าใหม่ลง Master Data เรียบร้อย');
          setIsCustomerModalOpen(false);
          fetchAllData();
        }
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // Template Management (Save & Delete)
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm)
      });
      if (res.ok) {
        showToast('บันทึกเทมเพลตอีเมลสำเร็จ');
        setIsTemplateModalOpen(false);
        fetchAllData();
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบเทมเพลตนี้?')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบเทมเพลตเรียบร้อย');
        fetchAllData();
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // Config Management (System, Drive links, Users)
  const handleSaveSystemConfig = async () => {
    try {
      await Promise.all([
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'insurance_name', value: config.system.insurance_name, description: 'ชื่อบริษัทประกัน' })
        }),
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'insurance_email', value: config.system.insurance_email, description: 'อีเมลบริษัทประกัน' })
        }),
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'auto_forward', value: String(config.system.auto_forward), description: 'Auto forward status' })
        }),
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'n8n_webhook_url', value: config.system.n8n_webhook_url, description: 'n8n Webhook URL' })
        })
      ]);
      showToast('บันทึกการตั้งค่าระบบลงชีต config เรียบร้อย');
      fetchAllData();
    } catch (err) {
      showToast('บันทึกการตั้งค่าไม่สำเร็จ: ' + err.message, 'error');
    }
  };

  const handleAddUserAccess = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'USER_ACCESS',
          key: userForm.email.trim(),
          value: userForm.name.trim(),
          permissionRole: userForm.role,
          description: userForm.description
        })
      });
      if (res.ok) {
        showToast(`เพิ่มสิทธิ์ผู้ใช้งาน ${userForm.email} สำเร็จ`);
        setIsUserModalOpen(false);
        setUserForm({ email: '', name: '', role: 'Viewer', description: '' });
        fetchAllData();
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleDeleteUserAccess = async (email) => {
    if (!window.confirm(`คุณต้องการลบสิทธิ์ผู้ใช้ ${email} หรือไม่?`)) return;
    try {
      const res = await fetch(`/api/config/USER_ACCESS/${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบสิทธิ์ผู้ใช้เรียบร้อย');
        fetchAllData();
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleAddDriveLink = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'DRIVE_LINK',
          key: driveForm.name.trim(),
          value: driveForm.url.trim(),
          description: driveForm.description
        })
      });
      if (res.ok) {
        showToast(`บันทึกลิงก์ Google Drive ${driveForm.name} สำเร็จ`);
        setIsDriveModalOpen(false);
        setDriveForm({ name: '', url: '', description: '' });
        fetchAllData();
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleDeleteDriveLink = async (name) => {
    if (!window.confirm(`ต้องการลบลิงก์ ${name} หรือไม่?`)) return;
    try {
      const res = await fetch(`/api/config/DRIVE_LINK/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบลิงก์สำเร็จ');
        fetchAllData();
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // Filter Emails
  const filteredEmails = emails.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (item.customerName || '').toLowerCase().includes(q) ||
      (item.recipientEmail || '').toLowerCase().includes(q) ||
      (item.subject || '').toLowerCase().includes(q) ||
      (item.id || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (inboxFilter === 'FORWARDED') return item.status === 'Sent' || item.status === 'Forwarded';
    if (inboxFilter === 'REVIEW') return item.status === 'Needs Review' || item.status === 'Failed';
    if (inboxFilter === 'PENDING') return item.status === 'Pending';

    return true;
  });

  // Needs Review emails (emails whose sender is not in Master Data)
  const masterEmailSet = new Set(masterData.map(m => (m.email || '').toLowerCase()));
  const needsReviewEmails = emails.filter(item => {
    const isNeedsReviewStatus = item.status === 'Needs Review' || item.status === 'Failed';
    const notInMaster = !masterEmailSet.has((item.recipientEmail || '').toLowerCase());
    return isNeedsReviewStatus || notInMaster;
  });

  // ==========================================
  // TEMPLATE BUILDER & EASY EDITOR HELPERS
  // ==========================================
  const buildHtmlFromSimple = (st) => {
    return `<!DOCTYPE html>
<html>
<body style="font-family: 'Plus Jakarta Sans', Arial, Helvetica, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="border-bottom: 2px solid ${st.titleColor || '#2563eb'}; padding-bottom: 12px; margin-bottom: 18px;">
      <h2 style="margin: 0; color: ${st.titleColor || '#2563eb'}; font-size: 19px; font-weight: 700;">${st.title || 'แจ้งข้อมูลการทำประกันภัย'}</h2>
    </div>
    <p style="margin: 0 0 14px 0; font-weight: 600; color: #334155; font-size: 14px;">${st.greeting || 'เรียน คุณ {{customerName}},'}</p>
    <div style="margin: 0 0 18px 0; color: #475569; font-size: 13px; white-space: pre-line;">${st.messageBody || ''}</div>
    ${(st.showBooking || st.showExpiry || st.showDrive) ? `
    <div style="background-color: #f8fafc; border-radius: 10px; padding: 14px 18px; margin: 18px 0; border-left: 4px solid ${st.titleColor || '#2563eb'}; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
      <div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase;">ข้อมูลสำคัญ</div>
      ${st.showBooking ? `<div style="font-size: 13px; margin-bottom: 5px; color: #1e293b;">📋 <strong>หมายเลขการจอง / กรมธรรม์:</strong> {{bookingNo}}</div>` : ''}
      ${st.showExpiry ? `<div style="font-size: 13px; margin-bottom: 5px; color: #1e293b;">📅 <strong>วันหมดอายุความคุ้มครอง:</strong> {{policyExpiry}}</div>` : ''}
      ${st.showDrive ? `<div style="font-size: 13px; color: #1e293b;">📎 <strong>เอกสารแนบที่เกี่ยวข้อง:</strong> {{driveLinks}}</div>` : ''}
    </div>` : ''}
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 14px 0;" />
    <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center;">${st.footer || 'AutoMail Insurance Automation System'}</p>
  </div>
</body>
</html>`;
  };

  const extractSimpleFromHtml = (html) => {
    if (!html) {
      return {
        title: 'แจ้งข้อมูลการทำประกันภัย',
        titleColor: '#2563eb',
        greeting: 'เรียน คุณ {{customerName}},',
        messageBody: 'ขอส่งข้อมูลสำหรับการทำประกันภัยเพิ่มเติม รายละเอียดตามเอกสารแนบ',
        showBooking: true,
        showExpiry: true,
        showDrive: true,
        footer: 'AutoMail Insurance Automation System • ติดต่อฝ่ายบริการลูกค้า'
      };
    }

    const titleMatch = html.match(/<h2[^>]*>(.*?)<\/h2>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'แจ้งข้อมูลการทำประกันภัย';

    const colorMatch = html.match(/color:\s*(#[a-fA-F0-9]{3,6})/i);
    const titleColor = colorMatch ? colorMatch[1] : '#2563eb';

    const greetingMatch = html.match(/<p[^>]*>\s*(เรียน[^<]*?)<\/p>/i);
    const greeting = greetingMatch ? greetingMatch[1].replace(/<[^>]+>/g, '').trim() : 'เรียน คุณ {{customerName}},';

    const showBooking = html.includes('{{bookingNo}}');
    const showExpiry = html.includes('{{policyExpiry}}');
    const showDrive = html.includes('{{driveLinks}}');

    let cleanBody = '';
    const bodyDivMatch = html.match(/<div[^>]*white-space:\s*pre-line[^>]*>(.*?)<\/div>/i);
    if (bodyDivMatch) {
      cleanBody = bodyDivMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    } else {
      const paragraphs = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      const filtered = paragraphs.filter(p => !p.startsWith('เรียน') && !p.includes('AutoMail') && !p.includes('<!DOCTYPE'));
      cleanBody = filtered.join('\n\n') || 'ขอส่งข้อมูลสำหรับการทำประกันภัยเพิ่มเติม รายละเอียดตามเอกสารแนบ';
    }

    const footerMatch = html.match(/<p[^>]*font-size:\s*1[0-2]px[^>]*>(.*?)<\/p>/i) || html.match(/<hr[^>]*>\s*<p[^>]*>(.*?)<\/p>/i);
    const footer = footerMatch ? footerMatch[1].replace(/<[^>]+>/g, '').trim() : 'AutoMail Insurance Automation System • ติดต่อฝ่ายบริการลูกค้า';

    return {
      title,
      titleColor,
      greeting,
      messageBody: cleanBody,
      showBooking,
      showExpiry,
      showDrive,
      footer
    };
  };

  const handleSimpleChange = (field, value) => {
    const updated = { ...simpleTemplate, [field]: value };
    setSimpleTemplate(updated);
    setTemplateForm(prev => ({
      ...prev,
      htmlContent: buildHtmlFromSimple(updated)
    }));
  };

  const templatePresets = [
    {
      name: 'แจ้งข้อมูลทำประกัน',
      title: 'แจ้งข้อมูลการทำประกันภัย',
      titleColor: '#2563eb',
      greeting: 'เรียน คุณ {{customerName}},',
      subject: 'ขอข้อมูลเพื่อดำเนินการของทำประกัน [{{bookingNo}}]',
      messageBody: 'ระบบได้รับข้อมูลการจองทำประกันภัยของท่านเรียบร้อยแล้ว รายละเอียดความคุ้มครองและเอกสารประกอบมีดังต่อไปนี้ หากมีข้อสงสัยหรือต้องการสอบถามเพิ่มเติม สามารถติดต่อเจ้าหน้าที่ได้ตลอดเวลา ขอบคุณค่ะ',
      showBooking: true,
      showExpiry: true,
      showDrive: true,
      footer: 'AutoMail Insurance Automation System • ติดต่อฝ่ายบริการลูกค้า โทร 02-xxx-xxxx'
    },
    {
      name: 'ขอบคุณและยืนยันรับเอกสาร',
      title: 'ขอบคุณที่ไว้วางใจทำประกันภัยกับเรา',
      titleColor: '#059669',
      greeting: 'เรียน คุณ {{customerName}},',
      subject: 'ได้รับข้อมูลและเอกสารของท่านเรียบร้อยแล้ว [{{bookingNo}}]',
      messageBody: 'เจ้าหน้าที่ได้รับเอกสารและหลักฐานการสมัครทำประกันภัยของท่านเรียบร้อยแล้ว ขณะนี้อยู่ระหว่างการตรวจสอบความถูกต้องและออกกรมธรรม์ โดยจะแจ้งผลให้ทราบภายใน 1-2 วันทำการ ขอบคุณค่ะ',
      showBooking: true,
      showExpiry: true,
      showDrive: false,
      footer: 'ฝ่ายบริการลูกค้าและรับประกันภัย • AutoMail Insurance'
    },
    {
      name: 'ขอเอกสารเพิ่มเติม',
      title: 'แจ้งขอเอกสารเพิ่มเติมสำหรับการทำประกันภัย',
      titleColor: '#d97706',
      greeting: 'เรียน คุณ {{customerName}},',
      subject: 'แจ้งขอเอกสารเพิ่มเติมสำหรับการทำประกันภัย [{{bookingNo}}]',
      messageBody: 'จากการตรวจสอบข้อมูลเบื้องต้น เจ้าหน้าที่ขอความอนุเคราะห์ให้ท่านจัดส่งเอกสารเพิ่มเติม (สำเนาบัตรประชาชน หรือ รายการตรวจสภาพ) เพื่อนำไปประกอบการพิจารณาอนุมัติความคุ้มครอง ขอบคุณค่ะ',
      showBooking: true,
      showExpiry: true,
      showDrive: true,
      footer: 'ฝ่ายพิจารณารับประกันภัย • AutoMail Insurance'
    },
    {
      name: 'ส่งต่อบริษัทประกัน (Fwd)',
      title: 'ส่งต่อข้อมูลลูกค้าและเอกสารเพื่อออกกรมธรรม์',
      titleColor: '#7c3aed',
      greeting: 'เรียน เจ้าหน้าที่ฝ่ายพิจารณารับประกันภัย,',
      subject: 'Fwd: ข้อมูลลูกค้าและเอกสาร [{{bookingNo}}]',
      messageBody: 'ขอส่งต่อข้อมูลการทำประกันภัยของลูกค้าที่ผ่านการตรวจสอบ Whitelist กับ Master Data เรียบร้อยแล้ว รายละเอียดและลิงก์เอกสารจาก Google Drive แนบมาพร้อมนี้ รบกวนดำเนินการออกกรมธรรม์ต่อไปค่ะ',
      showBooking: true,
      showExpiry: true,
      showDrive: true,
      footer: 'ระบบส่งต่ออัตโนมัติ AutoMail Insurance & Routing System'
    }
  ];

  const applyTemplatePreset = (preset) => {
    setSimpleTemplate({
      title: preset.title,
      titleColor: preset.titleColor,
      greeting: preset.greeting,
      messageBody: preset.messageBody,
      showBooking: preset.showBooking,
      showExpiry: preset.showExpiry,
      showDrive: preset.showDrive,
      footer: preset.footer
    });
    setTemplateForm(prev => ({
      ...prev,
      name: preset.name,
      subject: preset.subject,
      htmlContent: buildHtmlFromSimple(preset)
    }));
    showToast(`โหลดข้อความแม่แบบ: ${preset.name}`);
  };

  // Placeholder insertion for Template Editor
  const insertPlaceholder = (ph) => {
    if (templateEditorMode === 'simple') {
      const newBody = simpleTemplate.messageBody + ' ' + ph;
      handleSimpleChange('messageBody', newBody);
    } else {
      setTemplateForm(prev => ({
        ...prev,
        htmlContent: prev.htmlContent + ph
      }));
    }
    showToast(`แทรกตัวแปร ${ph} เรียบร้อย`);
  };

  // ==========================================
  // RENDER: LOGIN SCREEN (Page A)
  // ==========================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
          {/* Left Branding Hero */}
          <div className="bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 p-10 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/20 shadow-inner">
                <span className="text-3xl">✉️</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">AutoMail Insurance</h1>
              <p className="text-blue-100 font-medium text-sm leading-relaxed mb-6">
                Insurance Email Automation & Routing System<br />
                ระบบตรวจสอบอีเมลจาก Master Data และส่งต่อไปยังบริษัทประกันภัยอัตโนมัติ
              </p>

              <div className="space-y-3 pt-4 border-t border-white/15 text-xs text-blue-50">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/40 flex items-center justify-center font-bold">⚡</span>
                  <span>ตรวจจับอีเมลเข้าอัตโนมัติผ่าน IMAP Trigger</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/40 flex items-center justify-center font-bold">🛡️</span>
                  <span>ตรวจสอบสิทธิ์ Whitelist กับ Master Data</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/40 flex items-center justify-center font-bold">✈️</span>
                  <span>ส่งต่อข้อมูลและไฟล์แนบไปยังบริษัทประกันทันที</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-8 text-[11px] text-blue-200">
              🔒 Two-tier Authorization: Google Drive API & Config Whitelist
            </div>
          </div>

          {/* Right Login Action Card */}
          <div className="p-10 flex flex-col justify-center">
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                Management Portal
              </span>
              <h2 className="text-2xl font-bold text-slate-800 mt-2">เข้าสู่ระบบ</h2>
              <p className="text-xs text-slate-500 mt-1">
                ลงชื่อเข้าใช้ด้วยบัญชี Google ที่ได้รับสิทธิ์เข้าถึง Google Spreadsheet
              </p>
            </div>

            {authError && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5">
                <span className="text-base">⚠️</span>
                <div>
                  <div className="font-bold">เข้าสู่ระบบไม่สำเร็จ</div>
                  <div className="text-[11px] mt-0.5">{authError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Google Account Email
                </label>
                <input
                  type="email"
                  required
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  placeholder="name@gmail.com หรือ email บริษัท"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-xs"
                />
              </div>

              {/* Quick Select Buttons for demo / testing */}
              <div className="pt-1">
                <div className="text-[11px] text-slate-400 font-medium mb-1.5">เลือกบัญชีทดสอบที่ได้รับสิทธิ์:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAuthEmailInput('baipor2545@gmail.com')}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-colors"
                  >
                    👑 baipor2545@gmail.com (Owner/Admin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthEmailInput('admin@company.com')}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-colors"
                  >
                    🛡️ admin@company.com (Admin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthEmailInput('staff@company.com')}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-colors"
                  >
                    👤 staff@company.com (Viewer)
                  </button>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {authLoading ? (
                    <span>กำลังตรวจสอบสิทธิ์ Drive & Config...</span>
                  ) : (
                    <>
                      <span>เข้าสู่ระบบด้วย Google Authentication</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-400">
                ระบบรักษาความปลอดภัยแบบ 2 ชั้น (Drive API + Sheet Config)
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN APPLICATION (Logged In)
  // ==========================================
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2.5 transition-all transform animate-bounce ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <span className="text-xl">✉️</span>
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-tight leading-none">AutoMail Insurance</div>
              <div className="text-[10px] text-slate-400 mt-1">Management Portal</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 text-xs font-medium">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <span className="text-base">📊</span>
              <span>หน้าแรก (Dashboard)</span>
            </button>

            <button
              onClick={() => setCurrentTab('inbox')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'inbox' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">📥</span>
                <span>รายการอีเมล (Inbox)</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                {emails.length || 128}
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('needs-review')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'needs-review' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">⚠️</span>
                <span>Needs Review</span>
              </div>
              {needsReviewEmails.length > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  {needsReviewEmails.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('master-data')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'master-data' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <span className="text-base">👥</span>
              <span>Master Data (ลูกค้า)</span>
            </button>

            <button
              onClick={() => setCurrentTab('templates')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'templates' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <span className="text-base">📝</span>
              <span>เทมเพลตอีเมล (Template)</span>
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'settings' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <span className="text-base">⚙️</span>
              <span>ตั้งค่าระบบ (Settings)</span>
            </button>

            <button
              onClick={() => setCurrentTab('activity-logs')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                currentTab === 'activity-logs' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <span className="text-base">🕒</span>
              <span>ประวัติการทำงาน</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer / User Profile */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-slate-400">Google Sheets Live</span>
            </div>
            <button
              onClick={fetchAllData}
              disabled={refreshing}
              className="text-[10px] text-blue-400 hover:underline cursor-pointer"
            >
              {refreshing ? 'ซิงค์ข้อมูล...' : '↻ รีเฟรช'}
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* TOP HEADER BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
              <input
                type="text"
                placeholder="ค้นหา Booking No., อีเมล, หัวข้อ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs text-slate-600 font-medium">
              <span>📅</span>
              <span>01/10/2026 - 31/10/2026</span>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <span className="text-xs font-bold text-slate-700">{currentUser.name}</span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                {currentUser.role}
              </span>
            </div>
          </div>
        </header>

        {/* VIEW CONTENTS */}
        <main className="p-8 space-y-6 flex-1">

          {/* ========================================================================= */}
          {/* TAB 1: DASHBOARD (หน้าแรก)                                                */}
          {/* ========================================================================= */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">ภาพรวมระบบ (Dashboard)</h2>
                <p className="text-xs text-slate-500 mt-0.5">สรุปสถานะการรับและส่งต่ออีเมลประกันภัยอัตโนมัติ</p>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">อีเมลทั้งหมด</div>
                    <div className="text-2xl font-black text-slate-800 mt-1">{dashboardData.metrics.total}</div>
                    <div className="text-[11px] text-emerald-600 font-semibold mt-1">↑ 12% รับจาก Gmail</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                    📧
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">ส่งต่อบริษัทประกันแล้ว</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">{dashboardData.metrics.forwarded}</div>
                    <div className="text-[11px] text-slate-400 mt-1">69.5% ของทั้งหมด</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                    ✅
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">Needs Review</div>
                    <div className="text-2xl font-black text-amber-500 mt-1">{needsReviewEmails.length || 24}</div>
                    <div className="text-[11px] text-amber-600 font-medium mt-1">ไม่อยู่ใน Master Data</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
                    ⚠️
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">รอดำเนินการ</div>
                    <div className="text-2xl font-black text-blue-600 mt-1">{dashboardData.metrics.pending}</div>
                    <div className="text-[11px] text-slate-400 mt-1">11.7% ของทั้งหมด</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-xl">
                    ⏳
                  </div>
                </div>
              </div>

              {/* Recent Emails Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">รายการอีเมลล่าสุด</h3>
                    <p className="text-[11px] text-slate-400">อีเมลที่เข้ามาในระบบล่าสุดผ่าน IMAP Listener</p>
                  </div>
                  <button
                    onClick={() => setCurrentTab('inbox')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    ดูทั้งหมดใน Inbox →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5 pl-5">วันที่/เวลา</th>
                        <th className="p-3.5">ผู้ส่ง</th>
                        <th className="p-3.5">หัวข้อ</th>
                        <th className="p-3.5">สถานะ</th>
                        <th className="p-3.5 text-right pr-5">การดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(filteredEmails.length > 0 ? filteredEmails.slice(0, 6) : emails.slice(0, 6)).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 pl-5 text-slate-500 whitespace-nowrap">{item.timestamp || '2026-10-22 14:32'}</td>
                          <td className="p-3.5 font-medium text-slate-800">{item.recipientEmail || 'customer@example.com'}</td>
                          <td className="p-3.5 text-slate-700 font-medium truncate max-w-xs">{item.subject || 'ขอข้อมูลทำประกัน [BK-2026-001]'}</td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              item.status === 'Sent' || item.status === 'Forwarded' ? 'badge-sent' :
                              item.status === 'Needs Review' ? 'badge-review' : 'badge-pending'
                            }`}>
                              {item.status === 'Sent' || item.status === 'Forwarded' ? 'ส่งต่อแล้ว' :
                               item.status === 'Needs Review' ? 'Needs Review' : 'รอดำเนินการ'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right pr-5">
                            <button
                              onClick={() => setSelectedEmail(item)}
                              className="px-3 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-lg font-medium transition-colors cursor-pointer"
                            >
                              ดูรายละเอียด
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: INBOX (รายการอีเมล)                                                 */}
          {/* ========================================================================= */}
          {currentTab === 'inbox' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">รายการอีเมล (Inbox)</h2>
                  <p className="text-xs text-slate-500">จัดการอีเมลขาเข้าทั้งหมดและตรวจสอบสถานะการส่งต่อ</p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setInboxFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      inboxFilter === 'ALL' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ทั้งหมด ({emails.length})
                  </button>
                  <button
                    onClick={() => setInboxFilter('FORWARDED')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      inboxFilter === 'FORWARDED' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ส่งต่อแล้ว ({emails.filter(e => e.status === 'Sent' || e.status === 'Forwarded').length})
                  </button>
                  <button
                    onClick={() => setInboxFilter('REVIEW')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      inboxFilter === 'REVIEW' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Needs Review ({needsReviewEmails.length})
                  </button>
                  <button
                    onClick={() => setInboxFilter('PENDING')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      inboxFilter === 'PENDING' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    รอดำเนินการ ({emails.filter(e => e.status === 'Pending').length})
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 pl-5">วันที่/เวลา</th>
                      <th className="p-3.5">ผู้ส่ง</th>
                      <th className="p-3.5">หัวข้อ</th>
                      <th className="p-3.5">สถานะ</th>
                      <th className="p-3.5 text-right pr-5">การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 text-slate-500 whitespace-nowrap">{item.timestamp}</td>
                        <td className="p-3.5 font-bold text-slate-800">{item.recipientEmail}</td>
                        <td className="p-3.5 text-slate-700 font-medium truncate max-w-sm">{item.subject}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            item.status === 'Sent' || item.status === 'Forwarded' ? 'badge-sent' :
                            item.status === 'Needs Review' ? 'badge-review' : 'badge-pending'
                          }`}>
                            {item.status === 'Sent' || item.status === 'Forwarded' ? 'ส่งต่อแล้ว' :
                             item.status === 'Needs Review' ? 'Needs Review' : 'รอดำเนินการ'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right pr-5">
                          <button
                            onClick={() => setSelectedEmail(item)}
                            className="px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-semibold transition-all cursor-pointer"
                          >
                            ดูรายละเอียด
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: NEEDS REVIEW (คัดกรองเมลไม่อยู่ใน Whitelist)                         */}
          {/* ========================================================================= */}
          {currentTab === 'needs-review' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Needs Review (ไม่พบใน Master Data)</h2>
                  <p className="text-xs text-slate-500">อีเมลที่มีหัวข้อตรงตามเงื่อนไขทำประกัน แต่ผู้ส่งยังไม่ได้อยู่ใน Whitelist</p>
                </div>
                <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                  {needsReviewEmails.length} รายการรอการตรวจสอบ
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 pl-5">วันที่/เวลา</th>
                      <th className="p-3.5">ผู้ส่ง (ยังไม่อยู่ใน Whitelist)</th>
                      <th className="p-3.5">หัวข้ออีเมล</th>
                      <th className="p-3.5 text-right pr-5">การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {needsReviewEmails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 text-slate-500 whitespace-nowrap">{item.timestamp}</td>
                        <td className="p-3.5 font-bold text-red-600">{item.recipientEmail}</td>
                        <td className="p-3.5 text-slate-700 font-medium truncate max-w-sm">{item.subject}</td>
                        <td className="p-3.5 text-right pr-5 space-x-2">
                          <button
                            onClick={() => setSelectedEmail(item)}
                            className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
                          >
                            ตรวจสอบ
                          </button>
                          <button
                            onClick={() => handleQuickWhitelist(item.recipientEmail, item.customerName)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                          >
                            + เพิ่มเข้า Master Data ทันที
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: MASTER DATA (รายการลูกค้าที่ได้รับอนุญาต)                             */}
          {/* ========================================================================= */}
          {currentTab === 'master-data' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Master Data (รายการอีเมลที่อนุญาต)</h2>
                  <p className="text-xs text-slate-500">รายชื่อลูกค้าและคู่ค้าที่ระบบอนุญาตให้ Auto Forward ไปยังบริษัทประกัน</p>
                </div>
                <button
                  onClick={() => {
                    setEditingCustomer(null);
                    setCustomerForm({
                      name: '',
                      email: '',
                      phone: '',
                      type: 'รถยนต์ (ชั้น 1)',
                      dataStatus: 'Active',
                      notes: '',
                      expiry: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
                    });
                    setIsCustomerModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  + เพิ่มรายการ
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 pl-5">No.</th>
                      <th className="p-3.5">อีเมล (Whitelist)</th>
                      <th className="p-3.5">ชื่อ / หมายเหตุ</th>
                      <th className="p-3.5">ประเภทประกัน</th>
                      <th className="p-3.5 text-center">สถานะ</th>
                      <th className="p-3.5 text-right pr-5">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3.5 font-bold text-slate-800">{item.email}</td>
                        <td className="p-3.5 text-slate-700">{item.name || item.notes || '-'}</td>
                        <td className="p-3.5 text-slate-600">{item.type || 'รถยนต์ (ชั้น 1)'}</td>
                        <td className="p-3.5 text-center">
                          <span className="badge-sent px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                            {item.dataStatus || 'Active'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right pr-5">
                          <button
                            onClick={() => {
                              setEditingCustomer(item);
                              setCustomerForm({
                                name: item.name,
                                email: item.email,
                                phone: item.phone,
                                type: item.type,
                                dataStatus: item.dataStatus || 'Active',
                                notes: item.notes,
                                expiry: item.expiry
                              });
                              setIsCustomerModalOpen(true);
                            }}
                            className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold cursor-pointer"
                          >
                            แก้ไข
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: EMAIL TEMPLATES (เทมเพลตอีเมล HTML)                                  */}
          {/* ========================================================================= */}
          {currentTab === 'templates' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">เทมเพลตอีเมล (Email Templates)</h2>
                  <p className="text-xs text-slate-500">จัดการเนื้อหาอีเมลและโค้ด HTML สำหรับส่งแจ้งลูกค้าและบริษัทประกัน</p>
                </div>
                <button
                  onClick={() => {
                    const defaultSimple = {
                      title: 'แจ้งข้อมูลการทำประกันภัย',
                      titleColor: '#2563eb',
                      greeting: 'เรียน คุณ {{customerName}},',
                      messageBody: 'ระบบได้รับข้อมูลการจองทำประกันภัยของท่านเรียบร้อยแล้ว รายละเอียดความคุ้มครองและเอกสารประกอบมีดังต่อไปนี้ หากมีข้อสงสัยหรือต้องการสอบถามเพิ่มเติม สามารถติดต่อเจ้าหน้าที่ได้ตลอดเวลา ขอบคุณค่ะ',
                      showBooking: true,
                      showExpiry: true,
                      showDrive: true,
                      footer: 'AutoMail Insurance Automation System • ติดต่อฝ่ายบริการลูกค้า โทร 02-xxx-xxxx'
                    };
                    setSimpleTemplate(defaultSimple);
                    setTemplateEditorMode('simple');
                    setTemplateForm({
                      id: '',
                      name: '',
                      subject: 'ขอข้อมูลเพื่อดำเนินการของทำประกัน [{{bookingNo}}]',
                      recipientType: 'ส่งถึงลูกค้า',
                      status: 'Active',
                      description: 'เทมเพลตสำหรับส่งแจ้งข้อมูลลูกค้า',
                      htmlContent: buildHtmlFromSimple(defaultSimple)
                    });
                    setIsTemplateModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  + สร้างเทมเพลต
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 pl-5">ชื่อเทมเพลต</th>
                      <th className="p-3.5">หัวข้อ (Subject)</th>
                      <th className="p-3.5">ประเภท</th>
                      <th className="p-3.5 text-center">สถานะ</th>
                      <th className="p-3.5 text-right pr-5">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {templates.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 font-bold text-slate-800">{t.name}</td>
                        <td className="p-3.5 text-slate-700 font-medium">{t.subject}</td>
                        <td className="p-3.5">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                            {t.recipientType}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="badge-sent px-2 py-0.5 rounded-full font-bold text-[11px]">
                            {t.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right pr-5 space-x-2">
                          <button
                            onClick={() => {
                              const parsed = extractSimpleFromHtml(t.htmlContent);
                              setSimpleTemplate(parsed);
                              setTemplateEditorMode('simple');
                              setTemplateForm(t);
                              setIsTemplateModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg font-semibold cursor-pointer transition-colors"
                          >
                            ✏️ แก้ไขเทมเพลต
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="px-2.5 py-1 text-red-500 hover:bg-red-50 rounded-lg font-medium cursor-pointer"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: SYSTEM SETTINGS (ตั้งค่าระบบ - ชีต config)                            */}
          {/* ========================================================================= */}
          {currentTab === 'settings' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">ตั้งค่าระบบ (System Settings)</h2>
                <p className="text-xs text-slate-500">ซิงค์การตั้งค่าทั้งหมดลงใน Google Sheet แผ่นงาน: <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">config</code></p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-4">
                {/* Left Sub-tabs */}
                <div className="p-4 bg-slate-50 border-r border-slate-200 space-y-1 text-xs font-medium">
                  <button
                    onClick={() => setSettingsSubTab('insurance')}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                      settingsSubTab === 'insurance' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    อีเมลบริษัทประกัน
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('general')}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                      settingsSubTab === 'general' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    ข้อมูลทั่วไป & Webhook
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('drive-links')}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                      settingsSubTab === 'drive-links' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    ไฟล์แนบ Google Drive
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('users')}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                      settingsSubTab === 'users' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    จัดการสิทธิ์ผู้ใช้งาน (Users)
                  </button>
                </div>

                {/* Subtab Contents */}
                <div className="p-6 md:col-span-3 space-y-5">
                  {/* Subtab 1: Insurance Email */}
                  {settingsSubTab === 'insurance' && (
                    <div className="space-y-4 max-w-lg">
                      <div className="border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-sm text-slate-800">อีเมลบริษัทประกัน (กำหนดเพียง 1 รายการ)</h3>
                        <p className="text-xs text-slate-500">สำหรับส่งต่อ (Auto Forward) อีเมลที่ผ่านการตรวจสอบจาก Master Data</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อบริษัทประกัน</label>
                        <input
                          type="text"
                          value={config.system.insurance_name || ''}
                          onChange={(e) => setConfig({ ...config, system: { ...config.system, insurance_name: e.target.value } })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมลผู้รับ</label>
                        <input
                          type="email"
                          value={config.system.insurance_email || ''}
                          onChange={(e) => setConfig({ ...config, system: { ...config.system, insurance_email: e.target.value } })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">กำหนดค่าอีเมลระบบปลายทาง</span>
                      </div>

                      <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                        <div>
                          <div className="text-xs font-bold text-slate-800">เปิดใช้งาน Auto Forward</div>
                          <div className="text-[11px] text-slate-500">ส่งต่ออัตโนมัติเมื่อมีเมลตรงกับ Master Data</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={config.system.auto_forward === 'true' || config.system.auto_forward === true}
                          onChange={(e) => setConfig({ ...config, system: { ...config.system, auto_forward: e.target.checked ? 'true' : 'false' } })}
                          className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                        />
                      </div>

                      <div className="pt-3">
                        <button
                          onClick={handleSaveSystemConfig}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                        >
                          บันทึกการตั้งค่า
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Subtab 2: General & Webhook */}
                  {settingsSubTab === 'general' && (
                    <div className="space-y-4 max-w-lg">
                      <div className="border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-sm text-slate-800">ข้อมูลระบบและ n8n Webhook</h3>
                        <p className="text-xs text-slate-500">ตั้งค่า Endpoint สำหรับสั่ง Re-forward และ Timezone</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">n8n Re-forward Webhook URL</label>
                        <input
                          type="url"
                          value={config.system.n8n_webhook_url || ''}
                          onChange={(e) => setConfig({ ...config, system: { ...config.system, n8n_webhook_url: e.target.value } })}
                          placeholder="http://localhost:5678/webhook/re-forward"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Timezone</label>
                        <input
                          type="text"
                          disabled
                          value="Asia/Bangkok (UTC+7)"
                          className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 rounded-lg text-slate-500 font-mono"
                        />
                      </div>

                      <div className="pt-3">
                        <button
                          onClick={handleSaveSystemConfig}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                        >
                          บันทึกการตั้งค่า
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Subtab 3: Google Drive Links */}
                  {settingsSubTab === 'drive-links' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="font-bold text-sm text-slate-800">ลิงก์ Google Drive สำหรับแนบใน Automail</h3>
                          <p className="text-xs text-slate-500">จัดเก็บลิงก์เอกสารกลางที่จะนำไปแทนค่าในเทมเพลตอีเมล</p>
                        </div>
                        <button
                          onClick={() => setIsDriveModalOpen(true)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          + เพิ่มลิงก์ Drive
                        </button>
                      </div>

                      <table className="w-full text-left text-xs border border-slate-100 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50 font-semibold text-slate-500">
                          <tr>
                            <th className="p-3">ชื่อเอกสาร</th>
                            <th className="p-3">URL บน Google Drive</th>
                            <th className="p-3">คำอธิบาย</th>
                            <th className="p-3 text-right">ลบ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {config.driveLinks.map((d, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-800">{d.name}</td>
                              <td className="p-3 text-blue-600 font-mono truncate max-w-xs">
                                <a href={d.url} target="_blank" rel="noreferrer" className="hover:underline">
                                  {d.url}
                                </a>
                              </td>
                              <td className="p-3 text-slate-500">{d.description}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteDriveLink(d.name)}
                                  className="text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                                >
                                  ลบ
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Subtab 4: User Access Management */}
                  {settingsSubTab === 'users' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="font-bold text-sm text-slate-800">จัดการสิทธิ์บุคคลที่เข้าถึงได้ (User Permissions)</h3>
                          <p className="text-xs text-slate-500">กำหนดรายชื่ออีเมลและ Role (Admin / Viewer) ที่สามารถล็อกอินเข้าระบบได้</p>
                        </div>
                        <button
                          onClick={() => setIsUserModalOpen(true)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          + เพิ่มผู้ใช้งาน
                        </button>
                      </div>

                      <table className="w-full text-left text-xs border border-slate-100 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50 font-semibold text-slate-500">
                          <tr>
                            <th className="p-3">อีเมล</th>
                            <th className="p-3">ชื่อผู้ใช้งาน</th>
                            <th className="p-3">ระดับสิทธิ์ (Role)</th>
                            <th className="p-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {config.users.map((u, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-800">{u.email}</td>
                              <td className="p-3 text-slate-700">{u.name}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  u.role === 'Admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {u.email !== currentUser.email && (
                                  <button
                                    onClick={() => handleDeleteUserAccess(u.email)}
                                    className="text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                                  >
                                    ลบสิทธิ์
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: ACTIVITY LOGS (ประวัติการทำงาน)                                      */}
          {/* ========================================================================= */}
          {currentTab === 'activity-logs' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">ประวัติการทำงาน (Activity Logs)</h2>
                <p className="text-xs text-slate-500">Audit trail บันทึกทุกเหตุการณ์ การล็อกอิน การส่งต่ออีเมล และการปรับแต่งค่าในระบบ</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 pl-5">เวลา</th>
                      <th className="p-3.5">ผู้ทำรายการ</th>
                      <th className="p-3.5">ประเภท Action</th>
                      <th className="p-3.5">รายละเอียด</th>
                      <th className="p-3.5 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {activityLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 text-slate-400 font-mono whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-3.5 font-bold text-slate-800">{log.user}</td>
                        <td className="p-3.5">
                          <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-600">{log.details}</td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'Success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            log.status === 'Warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: EMAIL DETAIL VIEW / CHAIN MODAL (Page 3)                         */}
      {/* ========================================================================= */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                >
                  ← กลับ
                </button>
                <h3 className="font-bold text-slate-800 text-sm truncate max-w-lg">
                  {selectedEmail.subject}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedEmail.status === 'Sent' || selectedEmail.status === 'Forwarded' ? 'badge-sent' :
                  selectedEmail.status === 'Needs Review' ? 'badge-review' : 'badge-pending'
                }`}>
                  {selectedEmail.status === 'Sent' || selectedEmail.status === 'Forwarded' ? 'ส่งต่อแล้ว' : selectedEmail.status}
                </span>
                <button
                  onClick={() => handleReForward(selectedEmail.id)}
                  disabled={reforwarding}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {reforwarding ? 'กำลังส่งต่อผ่าน n8n...' : 'ส่งต่ออีกครั้ง'}
                </button>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Meta Grid */}
            <div className="p-5 border-b border-slate-100 bg-white grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">จาก:</span>
                <span className="text-slate-800 font-bold ml-1.5">{selectedEmail.recipientEmail}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">ถึง:</span>
                <span className="text-slate-800 font-bold ml-1.5">{config.system.insurance_email}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">วันที่:</span>
                <span className="text-slate-700 ml-1.5">{selectedEmail.timestamp}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Thread ID:</span>
                <span className="text-slate-700 font-mono ml-1.5">{selectedEmail.threadId}</span>
              </div>
              <div className="col-span-2 md:col-span-4">
                <span className="text-slate-400 font-medium">Message ID:</span>
                <span className="text-slate-700 font-mono ml-1.5 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  {selectedEmail.messageId || `<${selectedEmail.id}@mail.gmail.com>`}
                </span>
              </div>
            </div>

            {/* Sub-tabs: Body | Attachments | Chain */}
            <div className="px-5 pt-3 bg-slate-50 border-b border-slate-200 flex gap-2 text-xs font-bold">
              <button
                onClick={() => setDetailTab('body')}
                className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'body' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                เนื้อหาอีเมล (Body)
              </button>
              <button
                onClick={() => setDetailTab('attachments')}
                className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'attachments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ไฟล์แนบ ({selectedEmail.attachments ? selectedEmail.attachments.length : 2})
              </button>
              <button
                onClick={() => setDetailTab('chain')}
                className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
                  detailTab === 'chain' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ประวัติการทำงาน & Reply Chain
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {detailTab === 'body' && (
                <div className="space-y-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setBodyFormat('preview')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        bodyFormat === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      HTML Preview
                    </button>
                    <button
                      onClick={() => setBodyFormat('text')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        bodyFormat === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Plain Text
                    </button>
                  </div>

                  {bodyFormat === 'preview' ? (
                    <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-2xs text-xs text-slate-700 leading-relaxed">
                      <p className="font-bold text-slate-800">เรียน เจ้าหน้าที่ประกันภัย,</p>
                      <p className="mt-2">ขอส่งข้อมูลและเอกสารสำหรับการทำประกันภัยเพิ่มเติมตามหมายเลข <strong>{selectedEmail.subject}</strong> รายละเอียดและสำเนาเอกสารแนบตามด้านล่างนี้</p>
                      <p className="mt-2">หากต้องการข้อมูลเพิ่มเติมประการใด สามารถแจ้งกลับมาได้เลยค่ะ</p>
                      <div className="mt-4 pt-4 border-t border-slate-100 text-slate-500 text-[11px]">
                        ขอบคุณค่ะ<br />
                        ผู้ส่ง: {selectedEmail.recipientEmail}
                      </div>
                    </div>
                  ) : (
                    <pre className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-xs font-mono whitespace-pre-wrap">
                      {`From: ${selectedEmail.recipientEmail}
To: ${config.system.insurance_email}
Date: ${selectedEmail.timestamp}
Subject: ${selectedEmail.subject}

เรียน เจ้าหน้าที่ประกันภัย,
ขอส่งข้อมูลและเอกสารสำหรับการทำประกันภัยเพิ่มเติมตามหมายเลข ${selectedEmail.subject}
ขอบคุณค่ะ`}
                    </pre>
                  )}
                </div>
              )}

              {detailTab === 'attachments' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500">
                    ไฟล์แนบที่ตรวจพบจากอีเมล (จัดเก็บบน Google Drive ตามนโยบาย):
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-slate-200 rounded-2xl bg-white flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 font-bold flex items-center justify-center text-xs">
                          PDF
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">ID_Card.pdf</div>
                          <div className="text-[11px] text-slate-400">1.2 MB • บัตรประชาชน</div>
                        </div>
                      </div>
                      <a
                        href="https://drive.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold"
                      >
                        เปิดใน Drive
                      </a>
                    </div>

                    <div className="p-4 border border-slate-200 rounded-2xl bg-white flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs">
                          DOC
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Policy_Form.docx</div>
                          <div className="text-[11px] text-slate-400">450 KB • แบบฟอร์มขอทำประกัน</div>
                        </div>
                      </div>
                      <a
                        href="https://drive.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold"
                      >
                        เปิดใน Drive
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'chain' && (
                <div className="space-y-4 text-xs">
                  <div className="text-slate-500">ไทม์ไลน์และห่วงโซ่อีเมล (Email Reply Chain):</div>
                  <div className="relative pl-6 border-l-2 border-blue-500 space-y-6">
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-600 border-2 border-white"></span>
                      <div className="font-bold text-slate-800">ได้รับอีเมลขาเข้า (Inbound)</div>
                      <div className="text-[11px] text-slate-400">จาก: {selectedEmail.recipientEmail} • {selectedEmail.timestamp}</div>
                      <div className="mt-1 text-slate-600 font-mono text-[11px] bg-slate-100 p-2 rounded-lg">
                        Message-ID: {selectedEmail.messageId || '<inbound-1@gmail.com>'}
                      </div>
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></span>
                      <div className="font-bold text-slate-800">ตรวจสอบ Master Data และส่งต่อ (Auto Forward)</div>
                      <div className="text-[11px] text-slate-400">ไปยัง: {config.system.insurance_email} • {selectedEmail.timestamp}</div>
                      <div className="mt-1 text-slate-600 font-mono text-[11px] bg-slate-100 p-2 rounded-lg">
                        In-Reply-To: {selectedEmail.messageId || '<inbound-1@gmail.com>'}<br />
                        Status: Successfully Forwarded via n8n
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CUSTOMER MODAL (Add / Edit)                                      */}
      {/* ========================================================================= */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-800">
                {editingCustomer ? 'แก้ไขข้อมูลลูกค้า Master Data' : 'เพิ่มลูกค้าใหม่ลง Master Data'}
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อ-นามสกุล / บริษัท *</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="เช่น คุณสมชาย เจริญสุข หรือ บริษัท คู่ค้า จำกัด"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">อีเมล Whitelist *</label>
                <input
                  type="email"
                  required
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="081-234-5678"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ประเภทประกัน</label>
                <select
                  value={customerForm.type}
                  onChange={(e) => setCustomerForm({ ...customerForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option>รถยนต์ (ชั้น 1)</option>
                  <option>รถยนต์ (ชั้น 2+)</option>
                  <option>ประกันสุขภาพ</option>
                  <option>ประกันอัคคีภัย/บ้าน</option>
                  <option>ประกันชีวิต</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">วันหมดอายุความคุ้มครอง</label>
                <input
                  type="date"
                  value={customerForm.expiry}
                  onChange={(e) => setCustomerForm({ ...customerForm, expiry: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  บันทึกลง Google Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TEMPLATE SPLIT HTML EDITOR & LIVE PREVIEW MODAL (Page 6)          */}
      {/* ========================================================================= */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-sm text-slate-800">
                  {templateForm.id ? `แก้ไขเทมเพลต: ${templateForm.name}` : 'สร้างเทมเพลตอีเมลใหม่'}
                </h3>
                <span className="text-[11px] bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-bold">
                  {templateEditorMode === 'simple' ? 'โหมดแก้ไขแบบง่าย (No HTML)' : 'โหมดโค้ด HTML ขั้นสูง'}
                </span>
              </div>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            {/* Template Form Meta */}
            <div className="p-5 border-b border-slate-100 bg-white grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อเทมเพลต *</label>
                <input
                  type="text"
                  required
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="เช่น ส่งข้อมูลลูกค้า หรือ แจ้งเอกสารเพิ่ม"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">หัวข้ออีเมล (Subject) *</label>
                <input
                  type="text"
                  required
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  placeholder="เช่น ขอข้อมูลเพื่อดำเนินการทำประกัน [{{bookingNo}}]"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ประเภทผู้รับ</label>
                <select
                  value={templateForm.recipientType}
                  onChange={(e) => setTemplateForm({ ...templateForm, recipientType: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option>ส่งถึงลูกค้า</option>
                  <option>ส่งถึงบริษัทประกัน</option>
                </select>
              </div>
            </div>

            {/* Editor Mode Tabs & Quick Presets Toolbar */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
              {/* Mode Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTemplateEditorMode('simple')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    templateEditorMode === 'simple'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🎨</span>
                  <span>แก้ไขแบบง่าย (ไม่ต้องใช้ HTML)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateEditorMode('html')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    templateEditorMode === 'html'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>💻</span>
                  <span>โค้ด HTML ขั้นสูง</span>
                </button>
              </div>

              {/* Quick Presets for non-technical users */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-slate-500 text-[11px]">เลือกข้อความแม่แบบ:</span>
                {templatePresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyTemplatePreset(preset)}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Split View: Editor Pane (Left) vs Live HTML Preview (Right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-[420px] overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">

              {/* LEFT PANE: SIMPLE FORM OR RAW HTML */}
              {templateEditorMode === 'simple' ? (
                <div className="p-5 flex flex-col bg-slate-50/70 overflow-y-auto space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span>📝</span>
                      <span>กรอกข้อความที่ต้องการ (ระบบจะจัดรูปแบบ HTML ให้สวยงามอัตโนมัติ)</span>
                    </span>
                  </div>

                  {/* 1. Header Title & Color */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      1. หัวเรื่องหลักในอีเมล
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={simpleTemplate.title}
                        onChange={(e) => handleSimpleChange('title', e.target.value)}
                        placeholder="เช่น แจ้งข้อมูลการทำประกันภัย"
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                      />
                      {/* Color Palette */}
                      <div className="flex items-center gap-1 bg-white border border-slate-200 p-1.5 rounded-xl">
                        {[
                          { color: '#2563eb', label: 'น้ำเงิน' },
                          { color: '#059669', label: 'เขียว' },
                          { color: '#d97706', label: 'ส้ม' },
                          { color: '#dc2626', label: 'แดง' },
                          { color: '#7c3aed', label: 'ม่วง' }
                        ].map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            title={c.label}
                            onClick={() => handleSimpleChange('titleColor', c.color)}
                            className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                              simpleTemplate.titleColor === c.color ? 'ring-2 ring-offset-1 ring-slate-700 scale-110' : 'opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 2. Greeting */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">2. คำขึ้นต้นจดหมาย</label>
                      <button
                        type="button"
                        onClick={() => handleSimpleChange('greeting', 'เรียน คุณ {{customerName}},')}
                        className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        + ใส่ชื่อลูกค้าอัตโนมัติ
                      </button>
                    </div>
                    <input
                      type="text"
                      value={simpleTemplate.greeting}
                      onChange={(e) => handleSimpleChange('greeting', e.target.value)}
                      placeholder="เช่น เรียน คุณ {{customerName}}, หรือ เรียน ท่านผู้เอาประกันภัย,"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  {/* 3. Message Content */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">3. ข้อความรายละเอียดอีเมล</label>
                      <span className="text-[10px] text-slate-400">พิมพ์ภาษาไทยธรรมดา เคาะขึ้นบรรทัดใหม่ได้เลย</span>
                    </div>
                    <textarea
                      rows={5}
                      value={simpleTemplate.messageBody}
                      onChange={(e) => handleSimpleChange('messageBody', e.target.value)}
                      placeholder="พิมพ์ข้อความที่ต้องการแจ้งลูกค้าที่นี่..."
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 leading-relaxed text-slate-700 resize-none font-normal"
                    />
                  </div>

                  {/* 4. Highlighted Data Cards Options */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <label className="block font-semibold text-slate-700 text-xs">
                      4. ข้อมูลสำคัญที่จะแสดงในกล่องไฮไลท์ (เปิด/ปิด ได้ตามต้องการ)
                    </label>
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={simpleTemplate.showBooking}
                          onChange={(e) => handleSimpleChange('showBooking', e.target.checked)}
                          className="w-4 h-4 accent-blue-600 rounded"
                        />
                        <span>📋 แสดงหมายเลขการจอง / กรมธรรม์: <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded font-mono">{'{{bookingNo}}'}</code></span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={simpleTemplate.showExpiry}
                          onChange={(e) => handleSimpleChange('showExpiry', e.target.checked)}
                          className="w-4 h-4 accent-blue-600 rounded"
                        />
                        <span>📅 แสดงวันหมดอายุความคุ้มครอง: <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded font-mono">{'{{policyExpiry}}'}</code></span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={simpleTemplate.showDrive}
                          onChange={(e) => handleSimpleChange('showDrive', e.target.checked)}
                          className="w-4 h-4 accent-blue-600 rounded"
                        />
                        <span>📎 แสดงลิงก์เอกสารจาก Google Drive: <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded font-mono">{'{{driveLinks}}'}</code></span>
                      </label>
                    </div>
                  </div>

                  {/* 5. Footer */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      5. ข้อความปิดท้าย / ลายเซ็นต์
                    </label>
                    <input
                      type="text"
                      value={simpleTemplate.footer}
                      onChange={(e) => handleSimpleChange('footer', e.target.value)}
                      placeholder="เช่น AutoMail Insurance Automation System • ติดต่อฝ่ายบริการลูกค้า"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-600"
                    />
                  </div>

                  {/* Placeholders Toolbar */}
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-500 text-[11px]">แทรกตัวแปรลงในข้อความ:</span>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{customerName}}')}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                    >
                      + {'{{customerName}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{bookingNo}}')}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                    >
                      + {'{{bookingNo}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{policyExpiry}}')}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                    >
                      + {'{{policyExpiry}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{driveLinks}}')}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                    >
                      + {'{{driveLinks}}'}
                    </button>
                  </div>
                </div>
              ) : (
                /* RAW HTML SOURCE CODE EDITOR */
                <div className="p-4 flex flex-col bg-slate-900 text-slate-100">
                  <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center justify-between">
                    <span>HTML SOURCE CODE EDITOR</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Live code</span>
                  </div>
                  <textarea
                    value={templateForm.htmlContent}
                    onChange={(e) => setTemplateForm({ ...templateForm, htmlContent: e.target.value })}
                    placeholder="เขียนโค้ด HTML ที่นี่..."
                    className="flex-1 w-full bg-slate-950 text-emerald-300 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-mono">แทรกตัวแปร:</span>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{customerName}}')}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-blue-600 hover:text-white cursor-pointer"
                    >
                      + {'{{customerName}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{bookingNo}}')}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-blue-600 hover:text-white cursor-pointer"
                    >
                      + {'{{bookingNo}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{policyExpiry}}')}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-blue-600 hover:text-white cursor-pointer"
                    >
                      + {'{{policyExpiry}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{driveLinks}}')}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-blue-600 hover:text-white cursor-pointer"
                    >
                      + {'{{driveLinks}}'}
                    </button>
                  </div>
                </div>
              )}

              {/* RIGHT PANE: LIVE HTML PREVIEW */}
              <div className="p-5 flex flex-col bg-slate-100/60 overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-500 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>👁️</span>
                    <span>LIVE PREVIEW (ตัวอย่างอีเมลจริงที่จะถูกส่งออก)</span>
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    อัปเดตเรียลไทม์
                  </span>
                </div>
                <div
                  className="flex-1 p-5 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-y-auto"
                  dangerouslySetInnerHTML={{
                    __html: (templateForm.htmlContent || '')
                      .replace(/{{customerName}}/g, 'คุณสมชาย เจริญสุข')
                      .replace(/{{bookingNo}}/g, 'BK-2026-001')
                      .replace(/{{policyExpiry}}/g, '31/12/2026')
                      .replace(/{{driveLinks}}/g, '<a href="https://drive.google.com" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: bold;">คลิกเปิดดูเอกสารแบบฟอร์ม (Google Drive)</a>')
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <span className="text-[11px] text-slate-500">
                💡 ข้อความทั้งหมดจะถูกแปลงเป็น HTML คุณภาพสูงและบันทึกลง Google Sheet
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-white cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  บันทึกเทมเพลต
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD USER ACCESS MODAL (Settings)                                 */}
      {/* ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="font-bold text-sm text-slate-800 mb-4">เพิ่มสิทธิ์ผู้ใช้งานใหม่ (Sheet config)</h3>
            <form onSubmit={handleAddUserAccess} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">อีเมล Google *</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้ใช้งาน *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล หรือตำแหน่ง"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ระดับสิทธิ์ (Role)</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Viewer">Viewer (ดูข้อมูลได้อย่างเดียว)</option>
                  <option value="Admin">Admin (จัดการระบบและสิทธิ์ได้)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  เพิ่มสิทธิ์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADD DRIVE LINK MODAL (Settings)                                  */}
      {/* ========================================================================= */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="font-bold text-sm text-slate-800 mb-4">เพิ่มลิงก์ Google Drive (Sheet config)</h3>
            <form onSubmit={handleAddDriveLink} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อเอกสาร / คีย์ *</label>
                <input
                  type="text"
                  required
                  value={driveForm.name}
                  onChange={(e) => setDriveForm({ ...driveForm, name: e.target.value })}
                  placeholder="เช่น Policy_Form.docx"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">URL Google Drive *</label>
                <input
                  type="url"
                  required
                  value={driveForm.url}
                  onChange={(e) => setDriveForm({ ...driveForm, url: e.target.value })}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">คำอธิบาย</label>
                <input
                  type="text"
                  value={driveForm.description}
                  onChange={(e) => setDriveForm({ ...driveForm, description: e.target.value })}
                  placeholder="เช่น แบบฟอร์มขอทำประกันฉบับปี 2026"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  บันทึกลิงก์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
