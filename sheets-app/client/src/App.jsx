import React, { useState, useEffect } from 'react';

const INSURANCE_TYPES = ['ประกันสุขภาพกลุ่ม', 'ประกันชีวิตกลุ่ม', 'ประกันอุบัติเหตุกลุ่ม'];
// ต้องตรงกับ CUSTOMER_STATUSES ฝั่ง server และค่าในชีต ('ยังไม่สนใจ' หยุด R2, 'ไม่ติดต่อ / ปิดงาน' หยุดทุกรอบ)
const CUSTOMER_STATUSES = ['รอดำเนินการ', 'สนใจ / ดำเนินการต่อ', 'นัดหมายติดตาม', 'ยังไม่สนใจ', 'ไม่ติดต่อ / ปิดงาน'];
const PREVIEW_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const PREVIEW_FRAME_TYPES = ['application/pdf', 'text/plain'];
const CUSTOMER_STATUS_HINTS = { 'ยังไม่สนใจ': ' (หยุดส่งอีเมลรอบ 3 เดือน)', 'ไม่ติดต่อ / ปิดงาน': ' (หยุดส่งอีเมลทุกรอบ)' };
// Session Timeout: ไม่มีการใช้งาน (คลิก/พิมพ์) 2 ชม. = ออกจากระบบ เตือนก่อน 5 นาที ต่ออายุที่ server ไม่เกินทุก 5 นาที
// เวลาใช้งานล่าสุดเก็บใน localStorage เพื่อให้ทุกแท็บใช้ค่าเดียวกัน (ใช้แท็บไหนก็ไม่ถูกออก)
const IDLE_MS = 2 * 60 * 60 * 1000;
const IDLE_WARN_MS = 5 * 60 * 1000;
const PING_MS = 5 * 60 * 1000;
const ACTIVITY_KEY = 'automail_last_activity';
const ADMIN_TABS = ['templates', 'settings'];

// ---- หน้าอ่านอีเมล (แบบ Outlook: รายการซ้าย + อ่านขวา) ----
// เนื้อหาอีเมลมาจากผู้ส่งภายนอก จึงแสดงใน iframe sandbox (ไม่รัน script, เข้าถึงหน้าเว็บ/cookie ไม่ได้) + CSP ห้ามโหลดอะไรจากภายนอก
// รูปจากภายนอกถูกบล็อกจนผู้ใช้กด "แสดงรูปภาพ" (กัน tracking pixel แจ้งผู้ส่งว่าเปิดอ่าน)
const REMOTE_IMG = /<img\b[^>]*\bsrc\s*=\s*["']?\s*(https?:)?\/\/|url\(\s*["']?\s*(https?:)?\/\//i;
const MAIL_BODY_LIMIT = 40000; // workflow 02 ตัดเนื้อหาที่ความยาวนี้ (ขีดจำกัดเซลล์ Google Sheets)
const mailDoc = (html, allowImages) => `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:${allowImages ? ' https: http:' : ''}">
<base target="_blank"><style>body{margin:0;padding:20px 24px;font:14px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;color:#1e293b;overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{white-space:pre-wrap}</style>
</head><body>${String(html).replace(/<meta[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, '')}</body></html>`;
const AVATAR_COLORS = ['bg-slate-900', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600', 'bg-cyan-700', 'bg-fuchsia-600', 'bg-teal-600'];
const avatarColor = s => AVATAR_COLORS[[...String(s || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];
const isInbound = item => String(item.mailRound || '').includes('ขาเข้า');
// ไอคอนเส้น (stroke) จาก mockup "AIA by ใบปอ" — ใช้แทน emoji ในเมนูหลัก
const ICON = {
  dashboard: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
  'needs-review': 'M12 3l9.5 17h-19zM12 10v4M12 17.5v.01',
  'master-data': 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  'follow-up': 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  templates: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  'activity-logs': 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  check: 'M20 6L9 17l-5-5'
};
const Icon = ({ name, size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={ICON[name]} /></svg>
);
// เวลาในรายการแบบ Gmail: วันนี้ = HH:mm, วันอื่น = วัน เดือนย่อ (timestamp ในชีตเป็น "yyyy-m-d H:mm:ss")
const listTime = ts => {
  const m = String(ts || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return ts || '';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  if (`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` === today) return `${m[4].padStart(2, '0')}:${m[5]}`;
  return new Date(+m[1], m[2] - 1, +m[3]).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
};

// ค่าเริ่มต้นของโหมดแก้ไขแบบง่าย (ใช้ตอนสร้างใหม่ และตอนแถวในชีตยังไม่มี HTML_Content)
const DEFAULT_SIMPLE = {
  title: 'แจ้งข้อมูลการทำประกันภัย',
  titleColor: '#2563eb',
  greeting: 'เรียน คุณ {{customerName}},',
  messageBody: 'ระบบได้รับข้อมูลการจองทำประกันภัยของท่านเรียบร้อยแล้ว รายละเอียดความคุ้มครองและเอกสารประกอบมีดังต่อไปนี้ หากมีข้อสงสัยหรือต้องการสอบถามเพิ่มเติม สามารถติดต่อเจ้าหน้าที่ได้ตลอดเวลา ขอบคุณค่ะ',
  showBooking: true,
  showExpiry: true,
  showDrive: true,
  footer: 'AutoMail Insurance Automation System • ติดต่อฝ่ายบริการลูกค้า โทร 02-xxx-xxxx'
};

export default function App() {
  // Current User & Auth State: undefined = กำลังตรวจ session, null = ยังไม่ login
  const [currentUser, setCurrentUser] = useState(undefined);
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const isAdmin = currentUser?.role === 'Admin';
  const canEdit = !!currentUser && currentUser.role !== 'Viewer';

  // Loading overlay: นับ request เขียนข้อมูลที่ยังรอผล (> 0 = แสดง overlay กันกดซ้ำ)
  const [busyCount, setBusyCount] = useState(0);
  const [idleWarning, setIdleWarning] = useState(false);

  const endSession = (message) => {
    setCurrentUser(null);
    setIdleWarning(false);
    if (message) setAuthError(message);
  };

  // ทุก request ไป /api ผ่านตัวนี้: request เขียนข้อมูลแสดง overlay, 401 = session หมด → กลับหน้า login
  const api = async (url, opts = {}) => {
    const write = (opts.method || 'GET') !== 'GET' && url !== '/api/auth/ping';
    if (write) setBusyCount(n => n + 1);
    try {
      const res = await fetch(url, opts);
      if (res.status === 401 && url !== '/api/auth/login') {
        const data = await res.clone().json().catch(() => ({}));
        endSession(data.error || 'หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่');
      }
      return res;
    } finally {
      if (write) setBusyCount(n => n - 1);
    }
  };

  // เปิดหน้าเว็บ: ถาม server ว่ายังมี session อยู่ไหม
  useEffect(() => {
    fetch('/api/auth/ping', { method: 'POST' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setCurrentUser(d?.user || null))
      .catch(() => setCurrentUser(null));
  }, []);

  // จับการใช้งาน → ต่ออายุ session, ตรวจเวลาว่างทุก 15 วินาที
  useEffect(() => {
    if (!currentUser) return;
    let lastPing = Date.now();
    const lastActivity = () => Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now();
    const onActivity = () => {
      const now = Date.now();
      localStorage.setItem(ACTIVITY_KEY, String(now));
      setIdleWarning(false);
      if (now - lastPing < PING_MS) return;
      lastPing = now;
      api('/api/auth/ping', { method: 'POST' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => d && setCurrentUser(u => (u && (u.role !== d.user.role || u.name !== d.user.name) ? d.user : u)))
        .catch(() => {});
    };
    onActivity();
    const timer = setInterval(() => {
      const idle = Date.now() - lastActivity();
      if (idle >= IDLE_MS) {
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        endSession('หมดเวลาใช้งานเนื่องจากไม่มีการใช้งานเกิน 2 ชั่วโมง กรุณาเข้าสู่ระบบใหม่');
      } else {
        setIdleWarning(idle >= IDLE_MS - IDLE_WARN_MS);
      }
    }, 15000);
    window.addEventListener('click', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      clearInterval(timer);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [currentUser?.email]);

  // Navigation Tabs: dashboard | inbox | needs-review | master-data | templates | settings | activity-logs
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState('insurance'); // general | insurance | drive-links | users
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [dashboardData, setDashboardData] = useState({
    metrics: { total: 0, forwarded: 0, review: 0, pending: 0 },
    recentEmails: []
  });
  const [masterData, setMasterData] = useState([]);
  const [emails, setEmails] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [config, setConfig] = useState({
    system: {},
    driveLinks: [],
    users: []
  });

  // Selected Email for Detail Modal
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [reforwarding, setReforwarding] = useState(false);

  // Inbox status filter
  const [inboxFilter, setInboxFilter] = useState('ALL');

  // เนื้อหาอีเมลที่เปิดอ่าน (โหลดทีละฉบับจาก /api/emails/:id/body)
  const [mailBody, setMailBody] = useState({ id: null, html: '', loading: false, error: '' });
  const [showImages, setShowImages] = useState(false);
  useEffect(() => {
    const id = selectedEmail?.id;
    setShowImages(false);
    if (!id) return;
    let cancelled = false;
    setMailBody({ id, html: '', loading: true, error: '' });
    api(`/api/emails/${encodeURIComponent(id)}/body`)
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (!cancelled) setMailBody({ id, html: d.html || '', loading: false, error: r.ok ? '' : d.error || 'โหลดเนื้อหาอีเมลไม่สำเร็จ' });
      })
      .catch(err => !cancelled && setMailBody({ id, html: '', loading: false, error: err.message }));
    return () => { cancelled = true; };
  }, [selectedEmail?.id]);

  // Customer Modal (Add & Edit)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const emptyCustomerForm = { name: '', email: '', phone: '', type: '', policy: '', currentInsurer: '', dataStatus: 'Valid', customerStatus: '', notes: '', expiry: '' };
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [masterFilter, setMasterFilter] = useState('ALL'); // ALL | INCOMPLETE | INVALID

  // Renew Modal (ต่ออายุกรมธรรม์: เจ้าหน้าที่กรอกวันหมดอายุใหม่เอง)
  const [renewTarget, setRenewTarget] = useState(null);
  const [renewExpiry, setRenewExpiry] = useState('');

  // ตัวอย่างไฟล์แนบ (ดึงจาก Google Drive ผ่าน /api/attachments โดยไม่ต้องเปิดหน้า Google Drive)
  const [previewFile, setPreviewFile] = useState(null);
  const attachmentUrl = (log, file, index) => (file.id
    ? `/api/attachments/${encodeURIComponent(file.id)}`
    : `/api/emails/${encodeURIComponent(log.id)}/attachments/${index}`);

  // ติดตามลูกค้า (คิวโทร + บันทึกการโทร)
  const [callLogs, setCallLogs] = useState([]);
  const [followFilter, setFollowFilter] = useState('ALL'); // ALL | TODAY | OVERDUE | NEVER | R1 | R2
  const [followSelectedId, setFollowSelectedId] = useState(null);
  const [callForm, setCallForm] = useState({ callResult: 'ติดต่อได้', customerStatus: 'รอดำเนินการ', nextFollowup: '', assignedAgent: '', notes: '' });

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
  const [simpleTemplate, setSimpleTemplate] = useState(DEFAULT_SIMPLE);

  // New User Access Modal (inside Settings)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', name: '', role: 'Viewer', description: '' });
  const [editingUserEmail, setEditingUserEmail] = useState(null); // null = เพิ่มใหม่, อีเมล = แก้ไขแถวนั้น
  const openUserModal = (u) => {
    setEditingUserEmail(u ? u.email : null);
    setUserForm(u ? { email: u.email, name: u.name || '', role: u.role, description: u.description || '' } : { email: '', name: '', role: 'Viewer', description: '' });
    setIsUserModalOpen(true);
  };

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
      // config / templates เป็นของ Admin เท่านั้น (server ตอบ 403) role อื่นไม่ต้องดึง
      const SKIP = 'skip';
      const [dashRes, masterRes, emailRes, tplRes, confRes, logRes, callRes] = await Promise.all([
        api('/api/dashboard').catch(() => null),
        api('/api/master-data').catch(() => null),
        api('/api/emails').catch(() => null),
        isAdmin ? api('/api/templates').catch(() => null) : SKIP,
        isAdmin ? api('/api/config').catch(() => null) : SKIP,
        api('/api/activity-logs').catch(() => null),
        api('/api/call-logs').catch(() => null)
      ]);
      setLoadError([dashRes, masterRes, emailRes, tplRes, confRes, logRes, callRes].some(r => r !== SKIP && (!r || !r.ok)));
      if (!isAdmin) {
        // ล้างข้อมูลของ Admin คนก่อนที่อาจค้างใน state (login สลับคนบนเครื่องเดียวกัน)
        setTemplates([]);
        setConfig({ system: {}, driveLinks: [], users: [] });
      }

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
      if (callRes && callRes.ok) {
        const c = await callRes.json();
        if (c.data) setCallLogs(c.data);
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
  }, [currentUser?.email, currentUser?.role]);

  // role ถูกลดสิทธิ์ระหว่างเปิดหน้า Settings/Template อยู่ → กลับหน้าแรก
  useEffect(() => {
    if (currentUser && !isAdmin && ADMIN_TABS.includes(currentTab)) setCurrentTab('dashboard');
  }, [currentUser?.role, currentTab]);

  // Handle Google Auth Login
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await api('/api/auth/login', {
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
      showToast(`ยินดีต้อนรับคุณ ${data.user.name} (${data.user.role})`);
    } catch (err) {
      setAuthError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    endSession(null);
  };

  // Re-forward Email
  const handleReForward = async (logId) => {
    try {
      setReforwarding(true);
      const res = await api('/api/emails/re-forward', {
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

  // ปิดรายการ Needs Review (ไม่ส่งต่อ ไม่เพิ่มเข้า Master Data)
  const handleCloseEmail = async (logId) => {
    if (!window.confirm('ปิดรายการนี้โดยไม่ส่งต่อและไม่เพิ่มผู้ส่งเข้า Master Data ใช่หรือไม่?')) return;
    try {
      const res = await api(`/api/emails/${encodeURIComponent(logId)}/close`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast('ปิดรายการเรียบร้อย');
        fetchAllData();
      } else {
        showToast(data.error || 'ปิดรายการไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // Quick Whitelist sender from Needs Review
  const handleQuickWhitelist = async (senderEmail, customerName) => {
    try {
      const res = await api('/api/emails/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: senderEmail, name: customerName })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`เพิ่ม ${senderEmail} เข้า Master Data แล้ว อีเมลครั้งถัดไปจะส่งต่ออัตโนมัติ (ฉบับนี้ยังต้องกดส่งต่อหรือปิดรายการ)`);
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
      const res = await api(editingCustomer ? `/api/master-data/${editingCustomer.id}` : '/api/master-data', {
        method: editingCustomer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'บันทึกไม่สำเร็จ', 'error');
        return;
      }
      showToast(editingCustomer ? 'แก้ไขข้อมูลลูกค้าสำเร็จ' : 'เพิ่มลูกค้าใหม่ลง Master Data เรียบร้อย');
      setIsCustomerModalOpen(false);
      fetchAllData();
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleRenew = async (e) => {
    e.preventDefault();
    try {
      const res = await api(`/api/master-data/${renewTarget.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiry: renewExpiry })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'ต่ออายุไม่สำเร็จ', 'error');
        return;
      }
      showToast(`ต่ออายุ ${renewTarget.name || renewTarget.email} สำเร็จ ระบบจะเริ่มรอบแจ้งเตือนใหม่`);
      setRenewTarget(null);
      fetchAllData();
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // Template Management (Save & Delete)
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      const res = await api('/api/templates', {
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
      const res = await api(`/api/templates/${id}`, { method: 'DELETE' });
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
    // เกณฑ์รอบเดียวกับที่ workflow 01 ตรวจ (ว่างทั้งคู่ = ยังไม่ตั้ง, workflow จะหยุดและแจ้ง error)
    const r1 = String(config.system.r1_days_before ?? '').trim();
    const r2 = String(config.system.r2_days_before ?? '').trim();
    if ((r1 || r2) && !(/^\d+$/.test(r1) && /^\d+$/.test(r2) && +r2 >= 1 && +r2 < +r1)) {
      showToast('จำนวนวัน R1/R2 ต้องเป็นจำนวนเต็มบวก และ R2 ต้องน้อยกว่า R1 (แท็บ ข้อมูลระบบ)', 'error');
      return;
    }
    try {
      const results = await Promise.all([
        ...[
          ['r1_days_before', r1, 'R1: ส่งเมลแจ้งเตือนเมื่อเหลือไม่เกินกี่วันก่อนหมดอายุ'],
          ['r2_days_before', r2, 'R2: ส่งเมลแจ้งเตือนเมื่อเหลือไม่เกินกี่วันก่อนหมดอายุ'],
          ['admin_report_email', config.system.admin_report_email || '', 'ผู้รับรายงานสรุปการส่งประจำวัน (คั่นด้วย , ว่าง = ไม่ส่ง)'],
          ['review_alert_email', config.system.review_alert_email || '', 'ผู้รับแจ้งเตือนเมื่อมีอีเมล Needs Review (คั่นด้วย , ว่าง = ไม่ส่ง)']
        ].map(([key, value, description]) => api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key, value, description })
        })),
        api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'insurance_name', value: config.system.insurance_name, description: 'ชื่อบริษัทประกัน' })
        }),
        api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'insurance_email', value: config.system.insurance_email, description: 'อีเมลบริษัทประกัน' })
        }),
        api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'auto_forward', value: String(config.system.auto_forward), description: 'Auto forward status' })
        }),
        api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'n8n_webhook_url', value: config.system.n8n_webhook_url, description: 'n8n Webhook URL' })
        }),
        api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'subject_prefixes', value: config.system.subject_prefixes || '', description: 'prefix หัวข้ออีเมลที่ส่งต่อบริษัทประกันได้ (คั่นด้วย ,)' })
        }),
        api('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'SYSTEM', key: 'attachment_folder_id', value: config.system.attachment_folder_id || '', description: 'ID โฟลเดอร์ Google Drive เก็บไฟล์แนบอีเมลขาเข้า' })
        })
      ]);
      if (results.some(r => !r.ok)) throw new Error('บางรายการบันทึกไม่สำเร็จ');
      showToast('บันทึกการตั้งค่าระบบลงชีต config เรียบร้อย');
      fetchAllData();
    } catch (err) {
      showToast('บันทึกการตั้งค่าไม่สำเร็จ: ' + err.message, 'error');
    }
  };

  // เพิ่ม/แก้ไขสิทธิ์: server บันทึกแบบ upsert ตามอีเมล (category USER_ACCESS) จึงใช้ endpoint เดียวกัน
  const handleAddUserAccess = async (e) => {
    e.preventDefault();
    const email = userForm.email.trim().toLowerCase();
    if (!editingUserEmail && config.users.some(u => u.email.toLowerCase() === email)) {
      showToast(`${userForm.email} มีในรายชื่ออยู่แล้ว กด "แก้ไข" ที่แถวนั้นแทน`, 'error');
      return;
    }
    try {
      const res = await api('/api/config', {
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
        showToast(editingUserEmail
          ? `แก้ไขสิทธิ์ ${userForm.email} เป็น ${userForm.role} แล้ว (ถ้าผู้ใช้ login อยู่ จะมีผลภายใน 5 นาที)`
          : `เพิ่มสิทธิ์ผู้ใช้งาน ${userForm.email} สำเร็จ`);
        setIsUserModalOpen(false);
        fetchAllData();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'บันทึกสิทธิ์ไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const handleDeleteUserAccess = async (email) => {
    if (!window.confirm(`คุณต้องการลบสิทธิ์ผู้ใช้ ${email} หรือไม่?`)) return;
    try {
      const res = await api(`/api/config/USER_ACCESS/${encodeURIComponent(email)}`, { method: 'DELETE' });
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
      const res = await api('/api/config', {
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
      const res = await api(`/api/config/DRIVE_LINK/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบลิงก์สำเร็จ');
        fetchAllData();
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // ==========================================
  // ติดตามลูกค้า (Flow ขั้นตอน 4-5): คิวโทรหลังส่งอีเมล R1/R2 + บันทึกผลการโทร
  // ==========================================
  const [todayIso] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })); // วันนี้ (เวลาไทย) ณ ตอนเปิดหน้า
  // วันที่ในชีตอาจเป็น yyyy-mm-dd หรือ dd/mm/yyyy (พ.ศ. ได้) แปลงเป็น yyyy-mm-dd เพื่อเทียบกับวันนี้
  const toIsoDate = value => {
    const s = String(value || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (!m) return '';
    const year = +m[3] > 2400 ? +m[3] - 543 : +m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  };
  const isMailSent = status => ['Sent', 'สำเร็จ'].includes((status || '').trim());
  const DUE_ORDER = { OVERDUE: 0, TODAY: 1, NEVER: 2, LATER: 3, NONE: 4 };
  // คิวโทร = ลูกค้าที่ได้รับอีเมล R1/R2 แล้ว และยังไม่ปิดงาน เรียง เลยกำหนด → วันนี้ → ยังไม่เคยโทร → นัดล่วงหน้า
  const followQueue = masterData
    .filter(m => (isMailSent(m.mailR1Status) || isMailSent(m.mailR2Status)) && !(m.customerStatus || '').includes('ปิดงาน'))
    .map(m => {
      const next = toIsoDate(m.nextFollowup);
      const calls = callLogs.filter(c => c.customerId === m.id);
      const due = !next ? (calls.length ? 'NONE' : 'NEVER') : next < todayIso ? 'OVERDUE' : next === todayIso ? 'TODAY' : 'LATER';
      const round = isMailSent(m.mailR2Status) ? 'R2' : 'R1';
      const mailDate = round === 'R2' ? m.mailR2Date : m.mailR1Date;
      return { ...m, next, due, calls, round, lastMail: `${round} ส่งแล้ว${mailDate ? ` · ${mailDate}` : ''}` };
    })
    .sort((a, b) => DUE_ORDER[a.due] - DUE_ORDER[b.due] || (a.next || '').localeCompare(b.next || ''));
  const followCounts = {
    ALL: followQueue.length,
    TODAY: followQueue.filter(f => f.due === 'TODAY').length,
    OVERDUE: followQueue.filter(f => f.due === 'OVERDUE').length,
    NEVER: followQueue.filter(f => f.due === 'NEVER').length
  };
  const followRows = followQueue.filter(f => {
    const q = searchQuery.toLowerCase();
    if (q && !`${f.name} ${f.phone} ${f.email}`.toLowerCase().includes(q)) return false;
    if (followFilter === 'R1' || followFilter === 'R2') return f.round === followFilter;
    return followFilter === 'ALL' || f.due === followFilter;
  });
  const followSelected = followQueue.find(f => f.id === followSelectedId) || null;
  // ประวัติลูกค้า = การโทร + อีเมลที่เกี่ยวกับลูกค้ารายนี้ เรียงล่าสุดก่อน
  const followHistory = followSelected
    ? [
        ...followSelected.calls.map(c => ({
          key: c.id,
          time: c.timestamp,
          kind: 'call',
          title: `โทร: ${c.callResult || '-'}${c.customerInterest ? ` → ${c.customerInterest}` : ''}`,
          detail: [c.agentName, c.nextAppointment ? `นัด ${c.nextAppointment}` : '', c.notes].filter(Boolean).join(' · ')
        })),
        ...emails
          .filter(e => e.customerId === followSelected.id || (e.recipientEmail || '').toLowerCase() === (followSelected.email || '').toLowerCase())
          .map(e => ({ key: e.id, time: e.timestamp, kind: 'mail', title: `อีเมล: ${e.mailRound || e.subject} (${e.status || '-'})`, detail: e.subject }))
      ].sort((a, b) => String(b.time).localeCompare(String(a.time)))
    : [];
  const customerStatusBadge = status => {
    const s = status || '';
    if (s.includes('ปิดงาน')) return 'bg-red-100 text-red-800';
    if (s.includes('ไม่สนใจ')) return 'bg-orange-100 text-orange-800';
    if (s.includes('นัดหมาย')) return 'bg-rose-100 text-rose-800';
    if (s.includes('สนใจ')) return 'bg-emerald-100 text-emerald-800';
    return 'bg-slate-100 text-slate-700';
  };
  const dueLabel = f =>
    f.due === 'OVERDUE' ? { text: `เลยกำหนด ${f.next}`, cls: 'bg-red-100 text-red-800' }
    : f.due === 'TODAY' ? { text: 'วันนี้', cls: 'bg-amber-100 text-amber-800' }
    : f.due === 'LATER' ? { text: f.next, cls: 'bg-slate-100 text-slate-700' }
    : f.due === 'NEVER' ? { text: 'ยังไม่เคยโทร', cls: 'bg-rose-100 text-rose-800' }
    : { text: '-', cls: 'text-slate-400' };

  const openCallForm = f => {
    setFollowSelectedId(f.id);
    setCallForm({
      callResult: 'ติดต่อได้',
      customerStatus: f.customerStatus || 'รอดำเนินการ',
      nextFollowup: '',
      assignedAgent: f.assignedAgent || currentUser?.name || '',
      notes: ''
    });
  };

  const handleSaveCall = async (e) => {
    e.preventDefault();
    if (!followSelected) return;
    try {
      const res = await api('/api/call-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...callForm, customerId: followSelected.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showToast(data.error || 'บันทึกการโทรไม่สำเร็จ', 'error');
        return;
      }
      showToast(`บันทึกการโทรของ ${followSelected.name || followSelected.email} แล้ว`);
      setCallForm(form => ({ ...form, notes: '' }));
      fetchAllData();
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  const masterEmailSet = new Set(masterData.map(m => (m.email || '').trim().toLowerCase()));
  const isForwarded = status => ['Sent', 'Forwarded', 'Manually Forwarded'].includes(status);
  // Needs Review = อีเมลขาเข้าที่ไม่ผ่านเงื่อนไขส่งต่ออัตโนมัติ (ผู้ส่งไม่อยู่ใน Master Data หรือไม่ใช่การตอบกลับและหัวข้อไม่มี prefix)
  // ออกจากรายการเมื่อเจ้าหน้าที่ส่งต่อเอง (Manually Forwarded) หรือปิดรายการ (Closed)
  const isNeedsReview = item => item.status === 'Needs Review';
  const inMaster = email => masterEmailSet.has((email || '').trim().toLowerCase());
  const dataProblems = item => item.reviewReason || (item.dataIssues || []).join(', ');
  const isIncomplete = item => item.dataStatus === 'ข้อมูลไม่ครบ' || (item.dataIssues || []).length > 0;
  const dataBadge = item => (isIncomplete(item) ? 'badge-review' : item.dataStatus === 'Invalid' ? 'badge-failed' : 'badge-sent');
  const filteredMaster = masterData.filter(item =>
    masterFilter === 'INCOMPLETE' ? isIncomplete(item) : masterFilter === 'INVALID' ? item.dataStatus === 'Invalid' : true
  );
  const isPendingStatus = status => status === 'Pending' || status === 'Failed'; // ค้างส่ง / รอ Retry

  // Filter Emails
  const filteredEmails = emails.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (item.customerName || '').toLowerCase().includes(q) ||
      (item.recipientEmail || '').toLowerCase().includes(q) ||
      (item.subject || '').toLowerCase().includes(q) ||
      (item.id || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (inboxFilter === 'FORWARDED') return isForwarded(item.status);
    if (inboxFilter === 'REVIEW') return isNeedsReview(item);
    if (inboxFilter === 'PENDING') return isPendingStatus(item.status);

    return true;
  });

  const needsReviewEmails = emails.filter(isNeedsReview);

  const pct = n => (dashboardData.metrics.total ? `${((n / dashboardData.metrics.total) * 100).toFixed(1)}%` : '0%');

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

  // อ่านค่ากลับจาก HTML ที่ buildHtmlFromSimple สร้าง (ค่าที่บันทึกในชีต Templates)
  // คืน null ถ้าโหมดง่ายแสดง HTML นี้ได้ไม่ครบ (HTML เขียนเอง) — ตรวจโดยสร้างกลับแล้วต้องได้ HTML เดิมเป๊ะ
  const extractSimpleFromHtml = (html) => {
    const pick = re => (html.match(re) || [])[1] ?? '';
    const st = {
      title: pick(/<h2[^>]*>([\s\S]*?)<\/h2>/i),
      titleColor: pick(/<h2[^>]*color:\s*(#[0-9a-f]{3,6})/i),
      greeting: pick(/<\/h2>\s*<\/div>\s*<p[^>]*>([\s\S]*?)<\/p>/i),
      messageBody: pick(/<div[^>]*white-space:\s*pre-line[^>]*>([\s\S]*?)<\/div>/i),
      showBooking: html.includes('หมายเลขการจอง / กรมธรรม์:</strong>'),
      showExpiry: html.includes('วันหมดอายุความคุ้มครอง:</strong>'),
      showDrive: html.includes('เอกสารแนบที่เกี่ยวข้อง:</strong>'),
      footer: pick(/<hr[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i)
    };
    return buildHtmlFromSimple(st) === html ? st : null;
  };

  // เปิดโหมดง่ายพร้อมค่าจาก HTML; ถ้า HTML เป็นแบบเขียนเอง ให้อยู่โหมด HTML เพื่อไม่ให้ถูกเขียนทับ
  // HTML ว่าง (แถวในชีตยังไม่มี HTML_Content / ลบในโหมด HTML จนหมด) = เริ่มจากค่าเริ่มต้น และใส่ HTML ให้ตรงกับฟอร์ม
  const openSimpleEditor = (html) => {
    const parsed = html ? extractSimpleFromHtml(html) : DEFAULT_SIMPLE;
    if (!parsed) {
      setTemplateEditorMode('html');
      showToast('เทมเพลตนี้เป็น HTML ที่เขียนเอง แก้แบบง่ายไม่ได้ — เปิดในโหมด HTML แทน', 'info');
      return;
    }
    if (!html) setTemplateForm(prev => ({ ...prev, htmlContent: buildHtmlFromSimple(DEFAULT_SIMPLE) }));
    setSimpleTemplate(parsed);
    setTemplateEditorMode('simple');
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
    { ...DEFAULT_SIMPLE, name: 'แจ้งข้อมูลทำประกัน', subject: 'ขอข้อมูลเพื่อดำเนินการของทำประกัน [{{bookingNo}}]' },
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
    const html = templateForm.htmlContent;
    if (html && !extractSimpleFromHtml(html) && !window.confirm('HTML ที่เขียนเองของเทมเพลตนี้จะถูกแทนที่ด้วยแม่แบบ ต้องการดำเนินการต่อหรือไม่?')) return;
    setTemplateEditorMode('simple');
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

  // Loading overlay ระหว่างรอผล API ของปุ่ม action (กันกดซ้ำ)
  const spinner = <span aria-hidden="true" className="w-6 h-6 border-[3px] border-rose-600 border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />;
  const loadingOverlay = (message) => (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl px-6 py-5 shadow-xl flex items-center gap-3 text-sm font-semibold text-slate-700">
        {spinner}
        <span>{message}</span>
      </div>
    </div>
  );
  const busyOverlay = busyCount > 0 && loadingOverlay('กำลังดำเนินการ กรุณารอสักครู่...');

  // ---- กล่องอีเมลแบบ Outlook: รายการซ้าย + อ่านขวา (จอเล็กแสดงทีละฝั่ง) ใช้ทั้งหน้า Inbox และ Needs Review ----
  const statusBadge = s => (isForwarded(s) ? 'badge-sent' : s === 'Needs Review' ? 'badge-review' : s === 'Failed' ? 'badge-failed' : 'badge-pending');
  const openEmail = selectedEmail && (emails.find(e => e.id === selectedEmail.id) || selectedEmail); // ใช้สถานะล่าสุดหลังรีเฟรช
  const mailbox = (list, emptyText) => {
    const m = openEmail;
    const items = [...list].reverse(); // ชีตเรียงเก่า → ใหม่ แสดงใหม่สุดก่อน
    const nameOf = item => item.customerName || item.recipientEmail || '(ไม่ทราบชื่อ)';
    const bodyReady = m && mailBody.id === m.id && !mailBody.loading;
    const blockedImages = bodyReady && !showImages && REMOTE_IMG.test(mailBody.html);
    return (
      <div className="flex-1 min-h-0 flex bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <ul aria-label="รายการอีเมล" className={`${m ? 'hidden lg:block' : 'block'} w-full lg:w-[360px] shrink-0 lg:border-r border-slate-200 overflow-y-auto divide-y divide-slate-100`}>
          {items.length === 0 && <li className="p-8 text-center text-xs text-slate-500">{emptyText}</li>}
          {items.map(item => {
            const active = m?.id === item.id;
            const name = nameOf(item);
            return (
              <li key={item.id || item._rowIndex}>
                <button
                  onClick={() => setSelectedEmail(item)}
                  aria-current={active || undefined}
                  className={`w-full text-left pl-3 pr-4 py-3 flex gap-3 border-l-4 cursor-pointer transition-colors ${active ? 'bg-rose-50 border-rose-600' : 'border-transparent hover:bg-slate-50'}`}
                >
                  <span aria-hidden="true" className={`w-9 h-9 rounded-full ${avatarColor(item.recipientEmail)} text-white font-bold text-sm flex items-center justify-center shrink-0`}>
                    {name[0].toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`text-[13px] truncate ${isNeedsReview(item) ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{name}</span>
                      <span className="text-[11px] text-slate-500 shrink-0">{listTime(item.timestamp)}</span>
                    </span>
                    <span className="block text-xs text-slate-800 truncate">{item.subject || '(ไม่มีหัวข้อ)'}</span>
                    <span className="flex items-center gap-1.5 mt-1 min-w-0">
                      <span className={`${statusBadge(item.status)} px-1.5 rounded text-[10px] font-bold shrink-0`}>{item.status || '-'}</span>
                      {(item.attachments || []).length > 0 && <span className="text-[11px] text-slate-500 shrink-0" title="มีไฟล์แนบ">📎 {item.attachments.length}</span>}
                      <span className="text-[11px] text-slate-500 truncate">{item.errorDetail || item.mailRound}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <section aria-label="อ่านอีเมล" className={`${m ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 flex-col`}>
          {!m ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
              <span className="text-4xl" aria-hidden="true">✉️</span>
              <span className="text-sm">เลือกอีเมลจากรายการเพื่ออ่าน</span>
            </div>
          ) : (
            <>
              <div className="px-6 pt-4 pb-3 border-b border-slate-200 space-y-3">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <button onClick={() => setSelectedEmail(null)} className="lg:hidden px-3 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer">← กลับ</button>
                  <div className="flex-1" />
                  {canEdit && isNeedsReview(m) && !inMaster(m.recipientEmail) && (
                    <button onClick={() => handleQuickWhitelist(m.recipientEmail, m.customerName)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer">+ เพิ่มผู้ส่งเข้า Master Data</button>
                  )}
                  {canEdit && isNeedsReview(m) && (
                    <button onClick={() => handleCloseEmail(m.id)} className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer">ปิดรายการ</button>
                  )}
                  {canEdit && (
                    <button onClick={() => handleReForward(m.id)} disabled={reforwarding} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50">
                      {reforwarding ? 'กำลังส่งต่อ...' : 'ส่งต่อบริษัทประกัน'}
                    </button>
                  )}
                  <button onClick={() => setSelectedEmail(null)} aria-label="ปิดหน้าอ่านอีเมล" className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">✕</button>
                </div>

                <div className="flex items-start gap-3">
                  <h3 className="flex-1 min-w-0 text-lg font-bold text-slate-900 break-words">{m.subject || '(ไม่มีหัวข้อ)'}</h3>
                  <span className={`${statusBadge(m.status)} px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 mt-1`}>{m.status || '-'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className={`w-10 h-10 rounded-full ${avatarColor(m.recipientEmail)} text-white font-bold flex items-center justify-center shrink-0`}>
                    {nameOf(m)[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate">
                      <span className="font-bold text-sm text-slate-900">{nameOf(m)}</span>{' '}
                      <span className="text-slate-500">&lt;{m.recipientEmail || '-'}&gt;</span>
                    </div>
                    <div className="text-slate-500 truncate">{isInbound(m) ? 'ผู้ส่ง · อีเมลขาเข้า' : `ส่งถึงลูกค้า · ${m.mailRound || '-'}`}</div>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0">{m.timestamp}</div>
                </div>

                {m.errorDetail && (
                  <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">เหตุผล: {m.errorDetail}</div>
                )}

                {(m.attachments || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.attachments.map((file, index) => (
                      <div key={file.id || `${file.name}-${index}`} className="flex items-center gap-2 border border-slate-200 rounded-lg pl-3 pr-1 py-1 text-xs max-w-full">
                        <span aria-hidden="true">📎</span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-800 truncate max-w-[220px]">{file.name}</span>
                          <span className="block text-[10px] text-slate-500">{file.mimeType}{file.size ? ` • ${file.size}` : ''}</span>
                        </span>
                        <button onClick={() => setPreviewFile({ ...file, url: attachmentUrl(m, file, index) })} className="px-2 py-1 text-rose-700 hover:bg-rose-50 rounded font-semibold cursor-pointer">ดู</button>
                        <a href={`${attachmentUrl(m, file, index)}?download=1`} className="px-2 py-1 text-slate-700 hover:bg-slate-100 rounded font-semibold">ดาวน์โหลด</a>
                      </div>
                    ))}
                  </div>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-700">ข้อมูลระบบ</summary>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 mt-2">
                    {[['Log ID', m.id], ['Customer ID', m.customerId], ['รอบการส่ง', m.mailRound], ['Message ID', m.messageId]].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="text-slate-800 font-mono break-all">{value || '-'}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>

              {blockedImages && (
                <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center gap-3">
                  <span className="flex-1">บล็อกรูปภาพจากภายนอกไว้ เพื่อไม่ให้ผู้ส่งรู้ว่าเปิดอ่านอีเมลนี้แล้ว</span>
                  <button onClick={() => setShowImages(true)} className="px-3 py-1 border border-slate-300 bg-white hover:bg-slate-100 rounded-lg font-semibold cursor-pointer">แสดงรูปภาพ</button>
                </div>
              )}
              {bodyReady && mailBody.html.length >= MAIL_BODY_LIMIT && (
                <div className="px-6 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900">เนื้อหาถูกตัดที่ 40,000 ตัวอักษร (ขีดจำกัดเซลล์ Google Sheets) ส่วนท้ายอาจแสดงไม่ครบ</div>
              )}

              <div className="flex-1 min-h-0 flex">
                {!bodyReady ? (
                  <div role="status" className="flex-1 flex items-center justify-center gap-3 text-sm text-slate-500">{spinner} กำลังโหลดเนื้อหาอีเมล...</div>
                ) : mailBody.error ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-red-600 p-6 text-center">{mailBody.error}</div>
                ) : !mailBody.html ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-500">ไม่มีเนื้อหาอีเมลบันทึกไว้ในชีต</div>
                ) : (
                  <iframe
                    key={`${m.id}-${showImages}`}
                    title={`เนื้อหาอีเมล: ${m.subject || ''}`}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={mailDoc(mailBody.html, showImages)}
                    className="flex-1 w-full border-0 bg-white"
                  />
                )}
              </div>
            </>
          )}
        </section>
      </div>
    );
  };

  // ==========================================
  // RENDER: CHECKING SESSION
  // ==========================================
  if (currentUser === undefined) {
    return <div className="min-h-screen bg-rose-50">{loadingOverlay('กำลังตรวจสอบการเข้าสู่ระบบ...')}</div>;
  }

  // ==========================================
  // RENDER: LOGIN SCREEN (Page A)
  // ==========================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-rose-50 flex items-center justify-center p-4">
        {busyOverlay}
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl shadow-[0_20px_60px_rgba(225,29,72,.12)] overflow-hidden">
          {/* Left Branding Hero */}
          <div className="bg-rose-600 p-10 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/20 shadow-inner">
                <span className="text-3xl">✉️</span>
              </div>
              <h1 className="font-display text-3xl font-bold mb-2">AutoMail Insurance</h1>
              <p className="text-rose-100 font-medium text-sm leading-relaxed mb-6">
                Insurance Email Automation & Routing System<br />
                ระบบตรวจสอบอีเมลจาก Master Data และส่งต่อไปยังบริษัทประกันภัยอัตโนมัติ
              </p>

              <div className="space-y-3 pt-4 border-t border-white/15 text-xs text-rose-50">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-500/40 flex items-center justify-center font-bold">⚡</span>
                  <span>ตรวจจับอีเมลเข้าอัตโนมัติผ่าน IMAP Trigger</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-500/40 flex items-center justify-center font-bold">🛡️</span>
                  <span>ตรวจสอบสิทธิ์ Whitelist กับ Master Data</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-500/40 flex items-center justify-center font-bold">✈️</span>
                  <span>ส่งต่อข้อมูลและไฟล์แนบไปยังบริษัทประกันทันที</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-8 text-[11px] text-rose-200">
              🔒 สิทธิ์เข้าใช้งานตามรายชื่อ User Access ในชีต config
            </div>
          </div>

          {/* Right Login Action Card */}
          <div className="p-10 flex flex-col justify-center">
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md">
                Management Portal
              </span>
              <h2 className="text-2xl font-bold text-slate-800 mt-2">เข้าสู่ระบบ</h2>
              <p className="text-xs text-slate-500 mt-1">
                ลงชื่อเข้าใช้ด้วยอีเมลที่ Admin เพิ่มไว้ในรายชื่อ User Access
              </p>
            </div>

            {authError && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5">
                <span className="text-base">⚠️</span>
                <div>
                  <div className="font-bold">แจ้งเตือนการเข้าสู่ระบบ</div>
                  <div className="text-[11px] mt-0.5">{authError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  อีเมลเจ้าหน้าที่
                </label>
                <input
                  type="email"
                  required
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  placeholder="name@gmail.com หรือ email บริษัท"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all shadow-xs"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {authLoading ? (
                    <span>กำลังตรวจสอบสิทธิ์...</span>
                  ) : (
                    <>
                      <span>เข้าสู่ระบบ</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-400">
                ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งานเกิน 2 ชั่วโมง
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
    <div className="flex min-h-screen bg-rose-50 font-sans text-slate-800">
      {busyOverlay}

      {/* เตือนก่อน Session Timeout 5 นาที (คลิกที่ไหนก็ได้ = ใช้งานต่อ) */}
      {idleWarning && (
        <div role="alert" className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] max-w-[calc(100%-2rem)] bg-amber-50 border border-amber-300 text-amber-900 rounded-xl shadow-lg px-4 py-3 text-xs flex items-center gap-3">
          <span>ไม่มีการใช้งานเกือบ 2 ชั่วโมง ระบบจะออกจากระบบอัตโนมัติภายใน 5 นาที</span>
          <button className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer">ใช้งานต่อ</button>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2.5 transition-all transform animate-bounce ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          <span>{{ error: '⚠️', info: 'ℹ️' }[toast.type] || '✅'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-72 shrink-0 sticky top-0 h-screen p-[18px] pr-0">
        <div className="h-full overflow-y-auto bg-white rounded-[30px] px-4 py-[22px] flex flex-col gap-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-[46px] h-[46px] rounded-2xl bg-rose-600 flex items-center justify-center text-white -rotate-[8deg] shadow-[0_8px_18px_rgba(225,29,72,.35)] shrink-0">
              <Icon name="mail" size={24} />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-[21px] text-slate-900">Auto<span className="text-rose-600">Mail</span></div>
              <div className="text-xs text-slate-500">Insurance Portal</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav aria-label="เมนูหลัก" className="flex flex-col gap-1 text-sm font-medium">
            {[
              { key: 'dashboard', label: 'หน้าแรก (Dashboard)' },
              { key: 'inbox', label: 'รายการอีเมล (Inbox)', count: emails.length },
              { key: 'needs-review', label: 'Needs Review', count: needsReviewEmails.length, hot: true },
              { key: 'master-data', label: 'Master Data (ลูกค้า)' },
              { key: 'follow-up', label: 'ติดตามลูกค้า', count: followCounts.TODAY + followCounts.OVERDUE, hot: true },
              { key: 'templates', label: 'เทมเพลตอีเมล (Template)', admin: true },
              { key: 'settings', label: 'ตั้งค่าระบบ (Settings)', admin: true },
              { key: 'activity-logs', label: 'ประวัติการทำงาน' }
            ].filter(n => !n.admin || isAdmin).map(n => {
              const on = currentTab === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => setCurrentTab(n.key)}
                  aria-current={on ? 'page' : undefined}
                  className={`w-full h-[46px] flex items-center gap-3 px-3.5 rounded-full transition-colors cursor-pointer text-left ${
                    on ? 'bg-rose-600 text-white font-semibold shadow-[0_8px_20px_rgba(225,29,72,.35)]' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <span className={`w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 ${on ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'}`}>
                    <Icon name={n.key} />
                  </span>
                  <span className="flex-1 min-w-0 truncate">{n.label}</span>
                  {n.count > 0 && (
                    <span className={`text-xs font-bold leading-[22px] px-[9px] rounded-full ${
                      on ? 'bg-white text-rose-600' : n.hot ? 'bg-slate-900 text-white' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {n.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer / User Profile */}
          <div className="mt-auto flex flex-col gap-3.5">
            {followCounts.OVERDUE > 0 && (
              <div className="relative overflow-hidden rounded-3xl bg-rose-600 text-white p-[18px] flex flex-col gap-2.5">
                <div aria-hidden="true" className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/15"></div>
                <span className="relative font-display text-[30px] font-bold leading-none">{followCounts.OVERDUE}</span>
                <span className="relative font-semibold leading-snug">ลูกค้าเลยกำหนดนัดโทร<br />รอคุณติดตามอยู่</span>
                <button
                  onClick={() => setCurrentTab('follow-up')}
                  className="relative self-start h-[38px] px-4 rounded-full bg-white text-rose-600 hover:bg-rose-50 text-[13px] font-semibold cursor-pointer"
                >
                  ไปที่คิวโทร →
                </button>
              </div>
            )}

            <div className="flex items-center gap-2.5 px-1.5 py-1">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-display font-bold flex items-center justify-center text-[15px] shrink-0">
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-sm font-semibold text-slate-900 truncate" title={currentUser.email}>{currentUser.name}</div>
                <button
                  onClick={fetchAllData}
                  disabled={refreshing}
                  title="รีเฟรชข้อมูลจาก Google Sheets"
                  className={`max-w-full flex items-center gap-1.5 text-xs cursor-pointer hover:text-rose-600 ${loadError ? 'text-red-600' : 'text-slate-500'}`}
                >
                  <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${loadError ? 'bg-red-500' : 'bg-emerald-600'}`}></span>
                  <span className="truncate">
                    {loadError ? 'โหลด Sheets ไม่สำเร็จ' : refreshing ? 'กำลังซิงค์...' : 'Sheets ซิงก์แล้ว'}
                  </span>
                  <Icon name="refresh" size={12} className={`shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <button
                onClick={handleLogout}
                title="ออกจากระบบ"
                aria-label="ออกจากระบบ"
                className="w-[38px] h-[38px] shrink-0 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <Icon name="logout" size={17} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* TOP HEADER BAR */}
        <header className="h-16 bg-rose-50/90 backdrop-blur px-8 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="relative flex-1 max-w-[520px] flex items-center">
            <Icon name="search" size={18} className="absolute left-[18px] text-rose-600" />
            <input
              type="search"
              aria-label="ค้นหา"
              placeholder="ค้นหา Booking No., อีเมล, หัวข้อ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[46px] pl-12 pr-[18px] bg-white border-2 border-transparent rounded-full text-sm focus:border-rose-300 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden md:inline text-sm font-semibold text-slate-700">{currentUser.name}</span>
            <span className="h-[46px] px-[18px] inline-flex items-center rounded-full bg-slate-900 text-white text-[13.5px] font-semibold">
              {currentUser.role}
            </span>
          </div>
        </header>

        {/* VIEW CONTENTS */}
        <main className="p-8 space-y-6 flex-1">

          {/* ========================================================================= */}
          {/* TAB 1: DASHBOARD (หน้าแรก)                                                */}
          {/* ========================================================================= */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              <section aria-labelledby="pg-title" className="relative overflow-hidden rounded-3xl bg-rose-600 text-white px-8 py-7">
                <div aria-hidden="true" className="absolute -right-[60px] -top-[90px] w-[280px] h-[280px] rounded-full bg-white/10"></div>
                <div aria-hidden="true" className="absolute right-[220px] top-[34px] w-16 h-16 rounded-full border-[10px] border-white/15"></div>
                <div className="relative">
                  <span className="inline-flex items-center h-7 px-3 rounded-full bg-white/20 text-[12.5px] font-semibold">ภาพรวม</span>
                  <h2 id="pg-title" className="font-display mt-3 text-[38px] font-bold leading-tight">ภาพรวมระบบ (Dashboard)</h2>
                  <p className="mt-1.5 text-[15px]">สรุปสถานะการรับและส่งต่ออีเมลประกันภัยอัตโนมัติ</p>
                </div>
              </section>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">อีเมลทั้งหมด</div>
                    <div className="font-display text-[28px] font-bold leading-tight text-slate-800 mt-1">{dashboardData.metrics.total}</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
                    <Icon name="mail" size={22} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">ส่งต่อบริษัทประกันแล้ว</div>
                    <div className="font-display text-[28px] font-bold leading-tight text-emerald-600 mt-1">{dashboardData.metrics.forwarded}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{pct(dashboardData.metrics.forwarded)} ของทั้งหมด</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                    <Icon name="check" size={22} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">Needs Review</div>
                    <div className="font-display text-[28px] font-bold leading-tight text-amber-500 mt-1">{needsReviewEmails.length}</div>
                    <div className="text-[11px] text-amber-600 font-medium mt-1">ไม่อยู่ใน Master Data</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
                    <Icon name="needs-review" size={22} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">รอดำเนินการ</div>
                    <div className="font-display text-[28px] font-bold leading-tight text-rose-600 mt-1">{dashboardData.metrics.pending}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{pct(dashboardData.metrics.pending)} ของทั้งหมด</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-xl">
                    <Icon name="activity-logs" size={22} />
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
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    ดูทั้งหมดใน Inbox →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5 pl-5">วันที่/เวลา</th>
                        <th className="p-3.5">อีเมลผู้รับ</th>
                        <th className="p-3.5">หัวข้อ</th>
                        <th className="p-3.5">สถานะ</th>
                        <th className="p-3.5 text-right pr-5">การดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(filteredEmails.length > 0 ? filteredEmails.slice(0, 6) : emails.slice(0, 6)).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 pl-5 text-slate-500 whitespace-nowrap">{item.timestamp}</td>
                          <td className="p-3.5 font-medium text-slate-800">{item.recipientEmail}</td>
                          <td className="p-3.5 text-slate-700 font-medium truncate max-w-xs">{item.subject}</td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isForwarded(item.status) ? 'badge-sent' :
                              item.status === 'Needs Review' ? 'badge-review' : 'badge-pending'
                            }`}>
                              {item.status || '-'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right pr-5">
                            <button
                              onClick={() => { setInboxFilter('ALL'); setSelectedEmail(item); setCurrentTab('inbox'); }}
                              className="px-3 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-lg font-medium transition-colors cursor-pointer"
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
            <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="page-title">รายการอีเมล (Inbox)</h2>
                  <p className="text-xs text-slate-500">จัดการอีเมลขาเข้าทั้งหมดและตรวจสอบสถานะการส่งต่อ</p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setInboxFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      inboxFilter === 'ALL' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
                    ส่งต่อแล้ว ({emails.filter(e => isForwarded(e.status)).length})
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
                      inboxFilter === 'PENDING' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    รอดำเนินการ ({emails.filter(e => isPendingStatus(e.status)).length})
                  </button>
                </div>
              </div>

              {mailbox(filteredEmails, 'ไม่มีอีเมลในตัวกรองนี้')}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: NEEDS REVIEW (คัดกรองเมลไม่อยู่ใน Whitelist)                         */}
          {/* ========================================================================= */}
          {currentTab === 'needs-review' && (
            <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="page-title">Needs Review (ไม่พบใน Master Data)</h2>
                  <p className="text-xs text-slate-500">อีเมลขาเข้าที่ระบบไม่ส่งต่ออัตโนมัติ เจ้าหน้าที่ต้องตรวจสอบก่อน (ตรวจสอบ → ส่งต่ออีกครั้ง / เพิ่มผู้ส่งเข้า Master Data / ปิดรายการ)</p>
                </div>
                <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                  {needsReviewEmails.length} รายการรอการตรวจสอบ
                </div>
              </div>

              {mailbox(needsReviewEmails, 'ไม่มีอีเมลที่รอตรวจสอบ')}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: MASTER DATA (รายการลูกค้าที่ได้รับอนุญาต)                             */}
          {/* ========================================================================= */}
          {currentTab === 'master-data' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="page-title">Master Data (รายการอีเมลที่อนุญาต)</h2>
                  <p className="text-xs text-slate-500">รายชื่อลูกค้าและคู่ค้าที่ระบบอนุญาตให้ Auto Forward ไปยังบริษัทประกัน</p>
                </div>
                {canEdit && (
                <button
                  onClick={() => {
                    setEditingCustomer(null);
                    setCustomerForm(emptyCustomerForm);
                    setIsCustomerModalOpen(true);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  + เพิ่มรายการ
                </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  ['ALL', `ทั้งหมด (${masterData.length})`],
                  ['INCOMPLETE', `ข้อมูลไม่ครบ (${masterData.filter(isIncomplete).length})`],
                  ['INVALID', `Invalid (${masterData.filter(m => m.dataStatus === 'Invalid').length})`]
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMasterFilter(key)}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer border ${masterFilter === key ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
                {masterFilter === 'INCOMPLETE' && (
                  <span className="self-center text-slate-500">ลูกค้ากลุ่มนี้จะไม่ได้รับอีเมลแจ้งเตือนจนกว่าจะแก้อีเมลหรือเพิ่มวันหมดอายุ (กดปุ่ม ต่ออายุ เพื่อใส่วันหมดอายุ)</span>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 pl-5">No.</th>
                      <th className="p-3.5">อีเมล (Whitelist)</th>
                      <th className="p-3.5">เบอร์โทร</th>
                      <th className="p-3.5">ชื่อ / หมายเหตุ</th>
                      <th className="p-3.5">ประเภทประกัน</th>
                      <th className="p-3.5">วันหมดอายุ</th>
                      <th className="p-3.5 text-center">สถานะ</th>
                      <th className="p-3.5 text-center">สถานะลูกค้า</th>
                      <th className="p-3.5 text-right pr-5">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMaster.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 text-slate-400 font-mono">{item.id || idx + 1}</td>
                        <td className="p-3.5 font-bold text-slate-800">{item.email}</td>
                        <td className="p-3.5 text-slate-600 whitespace-nowrap">{item.phone || '-'}</td>
                        <td className="p-3.5 text-slate-700">{item.name || item.notes || '-'}</td>
                        <td className="p-3.5 text-slate-600">{item.type || '-'}</td>
                        <td className="p-3.5 text-slate-600">{item.expiry || '-'}</td>
                        <td className="p-3.5 text-center">
                          <span className={`${dataBadge(item)} px-2.5 py-0.5 rounded-full font-bold text-[11px] whitespace-nowrap`}>
                            {isIncomplete(item) ? 'ข้อมูลไม่ครบ' : item.dataStatus || 'Valid'}
                          </span>
                          {isIncomplete(item) && <div className="text-[11px] text-amber-700 mt-1">{dataProblems(item)}</div>}
                        </td>
                        <td className="p-3.5 text-center text-slate-700">{item.customerStatus || '-'}</td>
                        <td className="p-3.5 text-right pr-5">
                          {canEdit && (<>
                          <button
                            onClick={() => {
                              setRenewTarget(item);
                              setRenewExpiry('');
                            }}
                            className="px-3 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg font-semibold cursor-pointer"
                          >
                            ต่ออายุ
                          </button>
                          <button
                            onClick={() => {
                              setEditingCustomer(item);
                              setCustomerForm({
                                name: item.name,
                                email: item.email,
                                phone: item.phone,
                                type: item.type,
                                policy: item.policy,
                                currentInsurer: item.currentInsurer,
                                dataStatus: item.dataStatus,
                                customerStatus: item.customerStatus,
                                notes: item.notes,
                                expiry: item.expiry
                              });
                              setIsCustomerModalOpen(true);
                            }}
                            className="px-3 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold cursor-pointer"
                          >
                            แก้ไข
                          </button>
                          </>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: FOLLOW-UP (ติดตามลูกค้า: คิวโทร + บันทึกการโทร)                        */}
          {/* ========================================================================= */}
          {currentTab === 'follow-up' && (
            <div className="space-y-5">
              <div>
                <h2 className="page-title">ติดตามลูกค้า</h2>
                <p className="text-xs text-slate-500">คิวโทรหลังส่งอีเมลแจ้งเตือน R1/R2 และบันทึกผลการโทร (บันทึกลงชีต Call_Logs และอัปเดตสถานะลูกค้าใน Master Data)</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ['TODAY', 'ต้องโทรวันนี้', 'text-amber-600'],
                  ['OVERDUE', 'เลยกำหนดนัด', 'text-red-600'],
                  ['NEVER', 'ยังไม่เคยโทร (หลังส่งอีเมล)', 'text-rose-600'],
                  ['ALL', 'ลูกค้าในคิวทั้งหมด', 'text-slate-800']
                ].map(([key, label, color]) => (
                  <button
                    key={key}
                    onClick={() => setFollowFilter(key)}
                    className={`text-left bg-white border rounded-2xl p-4 cursor-pointer ${followFilter === key ? 'border-rose-500 ring-2 ring-rose-100' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className={`text-2xl font-black mt-1 ${color}`}>{followCounts[key]}</div>
                  </button>
                ))}
              </div>

              <div className="flex flex-col xl:flex-row gap-5 items-start">
                <div className="flex-1 min-w-0 w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="flex flex-wrap gap-1.5 p-3 border-b border-slate-200 text-xs">
                    {[
                      ['ALL', `ทั้งหมด (${followCounts.ALL})`],
                      ['TODAY', `ต้องโทรวันนี้ (${followCounts.TODAY})`],
                      ['OVERDUE', `เลยกำหนด (${followCounts.OVERDUE})`],
                      ['NEVER', `ยังไม่เคยโทร (${followCounts.NEVER})`],
                      ['R1', 'หลังส่ง R1'],
                      ['R2', 'หลังส่ง R2']
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFollowFilter(key)}
                        className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer border ${followFilter === key ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[720px]">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3.5 pl-5">ลูกค้า</th>
                          <th className="p-3.5">เบอร์โทร</th>
                          <th className="p-3.5">อีเมลล่าสุด</th>
                          <th className="p-3.5">วันหมดอายุ</th>
                          <th className="p-3.5">สถานะลูกค้า</th>
                          <th className="p-3.5">นัดครั้งถัดไป</th>
                          <th className="p-3.5 pr-5"><span className="sr-only">การดำเนินการ</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {followRows.length === 0 && (
                          <tr><td colSpan={7} className="p-6 text-center text-slate-400">ไม่มีลูกค้าในคิวนี้</td></tr>
                        )}
                        {followRows.map(f => {
                          const due = dueLabel(f);
                          return (
                            <tr key={f.id} className={followSelectedId === f.id ? 'bg-rose-50/70' : 'hover:bg-slate-50/80'}>
                              <td className="p-3.5 pl-5">
                                <div className="font-bold text-slate-800">{f.name || f.email}</div>
                                <div className="text-[11px] text-slate-500">{f.type || '-'}</div>
                              </td>
                              <td className="p-3.5 whitespace-nowrap">{f.phone || '-'}</td>
                              <td className="p-3.5 whitespace-nowrap">{f.lastMail}</td>
                              <td className="p-3.5 whitespace-nowrap">{f.expiry || '-'}</td>
                              <td className="p-3.5"><span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] whitespace-nowrap ${customerStatusBadge(f.customerStatus)}`}>{f.customerStatus || 'รอดำเนินการ'}</span></td>
                              <td className="p-3.5 whitespace-nowrap"><span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${due.cls}`}>{due.text}</span></td>
                              <td className="p-3.5 pr-5 text-right">
                                {canEdit && <button
                                  onClick={() => openCallForm(f)}
                                  className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap cursor-pointer ${followSelectedId === f.id ? 'bg-rose-600 text-white' : 'border border-rose-200 text-rose-700 hover:bg-rose-50'}`}
                                >
                                  บันทึกการโทร
                                </button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-4 py-3 border-t border-slate-200 text-[11px] text-slate-500">แสดงลูกค้าที่ได้รับอีเมล R1/R2 แล้ว และสถานะยังไม่ใช่ "ไม่ติดต่อ / ปิดงาน" เรียง เลยกำหนด → วันนี้ → ยังไม่เคยโทร → นัดล่วงหน้า</p>
                </div>

                {followSelected && (
                  <aside className="w-full xl:w-[400px] shrink-0 bg-white rounded-2xl border border-slate-200 shadow-xs">
                    <div className="p-4 border-b border-slate-200 flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500">บันทึกการโทร</div>
                        <div className="text-base font-bold text-slate-800">{followSelected.name || followSelected.email}</div>
                        <div className="text-xs text-slate-600">{followSelected.phone || 'ไม่มีเบอร์โทร'} · {followSelected.policy || '-'} · หมดอายุ {followSelected.expiry || '-'}</div>
                      </div>
                      <button onClick={() => setFollowSelectedId(null)} aria-label="ปิดแผงบันทึกการโทร" className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
                    </div>

                    <form onSubmit={handleSaveCall} className="p-4 space-y-3 text-xs">
                      <fieldset>
                        <legend className="font-semibold text-slate-700 mb-1.5">ผลการโทร</legend>
                        <div className="flex flex-wrap gap-1.5">
                          {['ติดต่อได้', 'ไม่รับสาย', 'เบอร์ไม่ถูกต้อง'].map(r => (
                            <button
                              key={r}
                              type="button"
                              aria-pressed={callForm.callResult === r}
                              onClick={() => setCallForm({ ...callForm, callResult: r })}
                              className={`px-3 py-1.5 rounded-lg border cursor-pointer ${callForm.callResult === r ? 'border-rose-600 bg-rose-50 text-rose-700 font-bold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <div>
                        <label htmlFor="call-status" className="block font-semibold text-slate-700 mb-1">สถานะลูกค้า</label>
                        <select
                          id="call-status"
                          value={callForm.customerStatus}
                          onChange={(e) => setCallForm({ ...callForm, customerStatus: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                        >
                          {CUSTOMER_STATUSES.map(st => (
                            <option key={st} value={st}>{st}{CUSTOMER_STATUS_HINTS[st] || ''}</option>
                          ))}
                          {callForm.customerStatus && !CUSTOMER_STATUSES.includes(callForm.customerStatus) && <option>{callForm.customerStatus}</option>}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="call-next" className="block font-semibold text-slate-700 mb-1">นัดครั้งถัดไป</label>
                          <input
                            id="call-next"
                            type="date"
                            min={todayIso}
                            value={callForm.nextFollowup}
                            onChange={(e) => setCallForm({ ...callForm, nextFollowup: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="call-agent" className="block font-semibold text-slate-700 mb-1">ผู้รับผิดชอบ</label>
                          <input
                            id="call-agent"
                            type="text"
                            value={callForm.assignedAgent}
                            onChange={(e) => setCallForm({ ...callForm, assignedAgent: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="call-notes" className="block font-semibold text-slate-700 mb-1">บันทึก</label>
                        <textarea
                          id="call-notes"
                          rows={3}
                          value={callForm.notes}
                          onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
                          placeholder="สรุปสิ่งที่คุยกับลูกค้า"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">ไม่ใส่วันนัด = ล้างวันนัดเดิมของลูกค้ารายนี้</p>
                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setFollowSelectedId(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer">ยกเลิก</button>
                        <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs cursor-pointer">บันทึกผลการโทร</button>
                      </div>
                    </form>

                    <div className="p-4 border-t border-slate-200">
                      <h3 className="text-xs font-bold text-slate-700 mb-2">ประวัติลูกค้า</h3>
                      {followHistory.length === 0 ? (
                        <p className="text-xs text-slate-400">ยังไม่มีประวัติ</p>
                      ) : (
                        <ol className="space-y-2.5">
                          {followHistory.map(h => (
                            <li key={h.key} className="flex gap-2.5 text-xs">
                              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${h.kind === 'call' ? 'bg-rose-600' : 'bg-emerald-600'}`}></span>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800">{h.title}</div>
                                <div className="text-[11px] text-slate-500 break-words">{h.time}{h.detail ? ` · ${h.detail}` : ''}</div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: EMAIL TEMPLATES (เทมเพลตอีเมล HTML)                                  */}
          {/* ========================================================================= */}
          {currentTab === 'templates' && isAdmin && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="page-title">เทมเพลตอีเมล (Email Templates)</h2>
                  <p className="text-xs text-slate-500">จัดการเนื้อหาอีเมลและโค้ด HTML สำหรับส่งแจ้งลูกค้าและบริษัทประกัน</p>
                </div>
                <button
                  onClick={() => {
                    setSimpleTemplate(DEFAULT_SIMPLE);
                    setTemplateEditorMode('simple');
                    setTemplateForm({
                      id: '',
                      name: '',
                      subject: 'ขอข้อมูลเพื่อดำเนินการของทำประกัน [{{bookingNo}}]',
                      recipientType: 'ส่งถึงลูกค้า',
                      status: 'Active',
                      description: 'เทมเพลตสำหรับส่งแจ้งข้อมูลลูกค้า',
                      htmlContent: buildHtmlFromSimple(DEFAULT_SIMPLE)
                    });
                    setIsTemplateModalOpen(true);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
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
                          <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-xs font-medium">
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
                              setTemplateForm(t);
                              openSimpleEditor(t.htmlContent);
                              setIsTemplateModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg font-semibold cursor-pointer transition-colors"
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
          {currentTab === 'settings' && isAdmin && (
            <div className="space-y-5">
              <div>
                <h2 className="page-title">ตั้งค่าระบบ (System Settings)</h2>
                <p className="text-xs text-slate-500">ซิงค์การตั้งค่าทั้งหมดลงใน Google Sheet แผ่นงาน: <code className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-mono font-bold">config</code></p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-4">
                {/* Left Sub-tabs */}
                <div className="p-2.5 border-r border-slate-200 space-y-1 text-[13.5px] font-semibold">
                  <button
                    onClick={() => setSettingsSubTab('insurance')}
                    className={`w-full text-left min-h-11 px-4 py-2.5 rounded-full transition-colors cursor-pointer ${
                      settingsSubTab === 'insurance' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                    }`}
                  >
                    อีเมลบริษัทประกัน
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('general')}
                    className={`w-full text-left min-h-11 px-4 py-2.5 rounded-full transition-colors cursor-pointer ${
                      settingsSubTab === 'general' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                    }`}
                  >
                    ข้อมูลทั่วไป & Webhook
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('drive-links')}
                    className={`w-full text-left min-h-11 px-4 py-2.5 rounded-full transition-colors cursor-pointer ${
                      settingsSubTab === 'drive-links' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                    }`}
                  >
                    ไฟล์แนบ Google Drive
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('users')}
                    className={`w-full text-left min-h-11 px-4 py-2.5 rounded-full transition-colors cursor-pointer ${
                      settingsSubTab === 'users' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
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
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมลผู้รับ</label>
                        <input
                          type="email"
                          value={config.system.insurance_email || ''}
                          onChange={(e) => setConfig({ ...config, system: { ...config.system, insurance_email: e.target.value } })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
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
                          checked={String(config.system.auto_forward).toLowerCase() === 'true'}
                          onChange={(e) => setConfig({ ...config, system: { ...config.system, auto_forward: e.target.checked ? 'true' : 'false' } })}
                          className="w-5 h-5 accent-rose-600 rounded cursor-pointer"
                        />
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix หัวข้ออีเมลที่ส่งต่อได้</label>
                        <input
                          type="text"
                          value={config.system.subject_prefixes || ''}
                          onChange={(e) => setConfig({ ...config, system: { ...config.system, subject_prefixes: e.target.value } })}
                          placeholder="[PorInsurance], [แจ้งเตือนครบกำหนด"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 font-mono"
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">คั่นด้วยเครื่องหมาย , ใช้กับผู้ส่งที่อยู่ใน Master Data และไม่ใช่การตอบกลับอีเมลของระบบ ถ้าหัวข้อไม่มี prefix จะเข้า Needs Review</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">ID โฟลเดอร์ Google Drive เก็บไฟล์แนบ</label>
                        <input
                          type="text"
                          value={config.system.attachment_folder_id || ''}
                          onChange={(e) => setConfig({ ...config, system: { ...config.system, attachment_folder_id: e.target.value } })}
                          placeholder="ส่วนท้ายของลิงก์โฟลเดอร์ เช่น drive.google.com/drive/folders/<ID>"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 font-mono"
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">ต้องแชร์โฟลเดอร์ให้อีเมล Service Account ของระบบ (ผู้มีสิทธิ์อ่าน) เพื่อให้เปิดดูไฟล์ในเว็บได้ ว่าง = ไม่เก็บไฟล์แนบ</span>
                      </div>

                      <div className="pt-3">
                        <button
                          onClick={handleSaveSystemConfig}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
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
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 font-mono"
                        />
                      </div>

                      <div className="pt-3 border-t border-slate-100 space-y-4">
                        <h4 className="font-bold text-xs text-slate-800">รอบแจ้งเตือนและอีเมลแจ้งเจ้าหน้าที่</h4>
                        {[
                          ['r1_days_before', 'R1: ส่งเมื่อเหลือไม่เกิน (วัน)', 'number', '180', 'ค่าแนะนำ 180 วัน (≈ 6 เดือน) ลูกค้าที่เพิ่มเข้ามาหลังช่วง R1 จะได้แค่ R2'],
                          ['r2_days_before', 'R2: ส่งเมื่อเหลือไม่เกิน (วัน)', 'number', '90', 'ค่าแนะนำ 90 วัน (≈ 3 เดือน) ต้องน้อยกว่า R1'],
                          ['admin_report_email', 'ผู้รับรายงานสรุปการส่งประจำวัน', 'text', 'admin@example.com, boss@example.com', 'คั่นด้วย , ได้หลายอีเมล ว่าง = ไม่ส่งรายงาน'],
                          ['review_alert_email', 'ผู้รับแจ้งเตือนอีเมล Needs Review', 'text', 'staff@example.com', 'คั่นด้วย , ได้หลายอีเมล ว่าง = ไม่ส่งแจ้งเตือน']
                        ].map(([key, label, type, placeholder, hint]) => (
                          <div key={key}>
                            <label htmlFor={`cfg-${key}`} className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
                            <input
                              id={`cfg-${key}`}
                              type={type}
                              min={type === 'number' ? 1 : undefined}
                              value={config.system[key] ?? ''}
                              onChange={(e) => setConfig({ ...config, system: { ...config.system, [key]: e.target.value } })}
                              placeholder={placeholder}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 font-mono"
                            />
                            <span className="text-[11px] text-slate-400 mt-1 block">{hint}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3">
                        <button
                          onClick={handleSaveSystemConfig}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
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
                          <h3 className="font-bold text-sm text-slate-800">เอกสารแนบเมลแจ้งเตือน (Google Drive)</h3>
                          <p className="text-xs text-slate-500">ทุกไฟล์ในรายการนี้ถูกแนบเป็นไฟล์ไปกับเมล R1 และ R2 ทุกฉบับ ต้องแชร์ไฟล์ให้อีเมล Service Account ถ้าดึงไฟล์ใดไม่ได้ ระบบจะไม่ส่งเมลรอบนั้น</p>
                        </div>
                        <button
                          onClick={() => setIsDriveModalOpen(true)}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
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
                              <td className="p-3 text-rose-600 font-mono truncate max-w-xs">
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
                          <p className="text-xs text-slate-500">กำหนดรายชื่ออีเมลและ Role (Admin / Staff / Viewer) ที่สามารถล็อกอินเข้าระบบได้</p>
                        </div>
                        <button
                          onClick={() => openUserModal(null)}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
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
                                  u.role === 'Admin' ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : u.role === 'Staff' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="p-3 text-right space-x-3">
                                <button
                                  onClick={() => openUserModal(u)}
                                  className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                                >
                                  แก้ไข
                                </button>
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
                <h2 className="page-title">ประวัติการทำงาน (Activity Logs)</h2>
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
                            'bg-rose-50 text-rose-700 border border-rose-200'
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
                <label className="block font-semibold text-slate-700 mb-1">ชื่อบริษัท / องค์กร *</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="เช่น คุณสมชาย เจริญสุข หรือ บริษัท คู่ค้า จำกัด"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="081-234-5678"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ประเภทประกัน</label>
                <select
                  value={customerForm.type || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">— ไม่ระบุ —</option>
                  {/* คงค่าเดิมในชีตที่ไม่อยู่ในรายการไว้ ไม่ให้ถูกทับตอนบันทึก */}
                  {[...new Set([...INSURANCE_TYPES, customerForm.type].filter(Boolean))].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">เลขที่กรมธรรม์ (Policy No)</label>
                <input
                  type="text"
                  value={customerForm.policy || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, policy: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">บริษัทประกันปัจจุบัน (Current Insurer)</label>
                <input
                  type="text"
                  value={customerForm.currentInsurer || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, currentInsurer: e.target.value })}
                  placeholder="บริษัทที่ลูกค้าถือกรมธรรม์อยู่ตอนนี้ (ไม่บังคับ)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">สถานะข้อมูล (Data Status)</label>
                <select
                  value={customerForm.dataStatus || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, dataStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                >
                  {!customerForm.dataStatus && <option value="">— ไม่ระบุ —</option>}
                  <option value="Valid">Valid (ส่งอีเมลแจ้งเตือนได้)</option>
                  <option value="Invalid">Invalid (ห้ามส่งอีเมล)</option>
                  {!['', 'Valid', 'Invalid'].includes(customerForm.dataStatus || '') && <option>{customerForm.dataStatus}</option>}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">ถ้าอีเมลไม่ถูกต้องหรือไม่มีวันหมดอายุ ระบบจะตั้งเป็น "ข้อมูลไม่ครบ" ให้อัตโนมัติ และกลับเป็น Valid เมื่อข้อมูลครบ</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={customerForm.notes || ''}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {editingCustomer && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">สถานะลูกค้า (หลังโทรติดตาม)</label>
                  <select
                    value={customerForm.customerStatus || ''}
                    onChange={(e) => setCustomerForm({ ...customerForm, customerStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">— ยังไม่ระบุ —</option>
                    {CUSTOMER_STATUSES.map(st => (
                      <option key={st} value={st}>{st}{CUSTOMER_STATUS_HINTS[st] || ''}</option>
                    ))}
                    {customerForm.customerStatus && !CUSTOMER_STATUSES.includes(customerForm.customerStatus) && (
                      <option>{customerForm.customerStatus}</option>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">วันหมดอายุความคุ้มครอง</label>
                {editingCustomer ? (
                  <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                    {customerForm.expiry || '-'} <span className="text-slate-400">(แก้ไขผ่านปุ่ม "ต่ออายุ" ในตารางเท่านั้น)</span>
                  </p>
                ) : (
                  <input
                    type="date"
                    value={customerForm.expiry}
                    onChange={(e) => setCustomerForm({ ...customerForm, expiry: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                  />
                )}
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
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  บันทึกลง Google Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ATTACHMENT PREVIEW (แสดงไฟล์แนบจาก Google Drive ภายในเว็บ)            */}
      {/* ========================================================================= */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/70 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-800 truncate">{previewFile.name}</div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`${previewFile.url}?download=1`} className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold">ดาวน์โหลด</a>
                <button onClick={() => setPreviewFile(null)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto">
              {PREVIEW_IMAGE_TYPES.includes(previewFile.mimeType) ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain" />
              ) : PREVIEW_FRAME_TYPES.includes(previewFile.mimeType) ? (
                <iframe src={previewFile.url} title={previewFile.name} className="w-full h-full bg-white" />
              ) : (
                <div className="text-center text-xs text-slate-500 p-6">
                  <p className="mb-3">ไฟล์ชนิดนี้ ({previewFile.mimeType}) แสดงตัวอย่างในเว็บไม่ได้</p>
                  <a href={`${previewFile.url}?download=1`} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold">ดาวน์โหลดไฟล์</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RENEW (ต่ออายุกรมธรรม์)                                              */}
      {/* ========================================================================= */}
      {renewTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-800">ต่ออายุกรมธรรม์: {renewTarget.name || renewTarget.email}</h3>
              <button onClick={() => setRenewTarget(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleRenew} className="space-y-3 text-xs">
              <p className="text-slate-500">วันหมดอายุปัจจุบัน: <strong className="text-slate-700">{renewTarget.expiry || '-'}</strong></p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">วันหมดอายุกรมธรรม์ใหม่ *</label>
                <input
                  type="date"
                  required
                  value={renewExpiry}
                  onChange={(e) => setRenewExpiry(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2">
                การต่ออายุจะล้างสถานะการส่งอีเมลรอบ 6 และ 3 เดือน, สถานะลูกค้า และวันนัดติดตาม เพื่อเริ่มรอบแจ้งเตือนใหม่
              </p>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRenewTarget(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  ยืนยันต่ออายุ
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
                <span className="text-[11px] bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full font-bold">
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
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
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
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ประเภทผู้รับ</label>
                <select
                  value={templateForm.recipientType}
                  onChange={(e) => setTemplateForm({ ...templateForm, recipientType: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
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
                  onClick={() => templateEditorMode !== 'simple' && openSimpleEditor(templateForm.htmlContent)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    templateEditorMode === 'simple'
                      ? 'bg-white text-rose-600 shadow-xs'
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
                      ? 'bg-white text-rose-600 shadow-xs'
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
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
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
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 font-semibold text-slate-800"
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
                        className="text-[10px] text-rose-600 hover:underline font-semibold cursor-pointer"
                      >
                        + ใส่ชื่อลูกค้าอัตโนมัติ
                      </button>
                    </div>
                    <input
                      type="text"
                      value={simpleTemplate.greeting}
                      onChange={(e) => handleSimpleChange('greeting', e.target.value)}
                      placeholder="เช่น เรียน คุณ {{customerName}}, หรือ เรียน ท่านผู้เอาประกันภัย,"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 font-medium"
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
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 leading-relaxed text-slate-700 resize-none font-normal"
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
                          className="w-4 h-4 accent-rose-600 rounded"
                        />
                        <span>📋 แสดงหมายเลขการจอง / กรมธรรม์: <code className="bg-slate-100 text-rose-600 px-1 py-0.5 rounded font-mono">{'{{bookingNo}}'}</code></span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={simpleTemplate.showExpiry}
                          onChange={(e) => handleSimpleChange('showExpiry', e.target.checked)}
                          className="w-4 h-4 accent-rose-600 rounded"
                        />
                        <span>📅 แสดงวันหมดอายุความคุ้มครอง: <code className="bg-slate-100 text-rose-600 px-1 py-0.5 rounded font-mono">{'{{policyExpiry}}'}</code></span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={simpleTemplate.showDrive}
                          onChange={(e) => handleSimpleChange('showDrive', e.target.checked)}
                          className="w-4 h-4 accent-rose-600 rounded"
                        />
                        <span>📎 แสดงชื่อไฟล์เอกสารที่แนบไปกับเมล: <code className="bg-slate-100 text-rose-600 px-1 py-0.5 rounded font-mono">{'{{driveLinks}}'}</code></span>
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
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-600"
                    />
                  </div>

                  {/* Placeholders Toolbar */}
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-500 text-[11px]">แทรกตัวแปรลงในข้อความ:</span>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{customerName}}')}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      + {'{{customerName}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{bookingNo}}')}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      + {'{{bookingNo}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{policyExpiry}}')}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      + {'{{policyExpiry}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{driveLinks}}')}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      + {'{{driveLinks}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{daysRemaining}}')}
                      title="จำนวนวันที่เหลือก่อนกรมธรรม์หมดอายุ ณ วันที่ส่ง"
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      + {'{{daysRemaining}}'}
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
                    className="flex-1 w-full bg-slate-950 text-emerald-300 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                  />
                  <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-mono">แทรกตัวแปร:</span>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{customerName}}')}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-rose-600 hover:text-white cursor-pointer"
                    >
                      + {'{{customerName}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{bookingNo}}')}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-rose-600 hover:text-white cursor-pointer"
                    >
                      + {'{{bookingNo}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{policyExpiry}}')}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-rose-600 hover:text-white cursor-pointer"
                    >
                      + {'{{policyExpiry}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{driveLinks}}')}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-rose-600 hover:text-white cursor-pointer"
                    >
                      + {'{{driveLinks}}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{{daysRemaining}}')}
                      title="จำนวนวันที่เหลือก่อนกรมธรรม์หมดอายุ ณ วันที่ส่ง"
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono hover:bg-rose-600 hover:text-white cursor-pointer"
                    >
                      + {'{{daysRemaining}}'}
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
                      .replace(/{{daysRemaining}}/g, '172')
                      .replace(/{{driveLinks}}/g, (config.driveLinks.map(d => d.name).join(', ') || 'แบบฟอร์ม.pdf') + ' (แนบเป็นไฟล์)')
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
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
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
            <h3 className="font-bold text-sm text-slate-800 mb-4">{editingUserEmail ? 'แก้ไขสิทธิ์ผู้ใช้งาน (Sheet config)' : 'เพิ่มสิทธิ์ผู้ใช้งานใหม่ (Sheet config)'}</h3>
            <form onSubmit={handleAddUserAccess} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">อีเมล *</label>
                <input
                  type="email"
                  required
                  readOnly={!!editingUserEmail}
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 read-only:bg-slate-100 read-only:text-slate-500"
                />
                {editingUserEmail && <p className="text-[11px] text-slate-500 mt-1">อีเมลแก้ไม่ได้ ถ้าต้องการเปลี่ยนอีเมล ให้ลบสิทธิ์แล้วเพิ่มใหม่</p>}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้ใช้งาน *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล หรือตำแหน่ง"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ระดับสิทธิ์ (Role)</label>
                <select
                  value={userForm.role}
                  disabled={editingUserEmail === currentUser.email}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="Viewer">Viewer (ดูข้อมูลได้อย่างเดียว)</option>
                  <option value="Staff">Staff (ทำงานประจำวันได้ ยกเว้นตั้งค่าและเทมเพลต)</option>
                  <option value="Admin">Admin (จัดการระบบและสิทธิ์ได้)</option>
                </select>
                {editingUserEmail === currentUser.email && (
                  <p className="text-[11px] text-slate-500 mt-1">เปลี่ยน Role ของตัวเองไม่ได้ เพื่อกันไม่ให้ระบบไม่เหลือ Admin ให้ Admin คนอื่นเปลี่ยนให้</p>
                )}
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
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {editingUserEmail ? 'บันทึกการแก้ไข' : 'เพิ่มสิทธิ์'}
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">คำอธิบาย</label>
                <input
                  type="text"
                  value={driveForm.description}
                  onChange={(e) => setDriveForm({ ...driveForm, description: e.target.value })}
                  placeholder="เช่น แบบฟอร์มขอทำประกันฉบับปี 2026"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
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
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
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
