// ===== API HELPER =====
const API = {
  async fetch(url, opts = {}) {
    const res = await fetch(url, { credentials: 'include', ...opts });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }
};

// ===== STATE =====
let currentUser = null;
let sites = [];
let timerInterval = null;
let clockInTime = null;
let currentEditUser = null;
let currentEditSite = null;

// ===== THEME =====
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.classList.toggle('dark-mode', savedTheme === 'dark');

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const checkbox = document.getElementById('themeToggleCheckbox');
  if (checkbox) checkbox.checked = isDark;
}

// ===== NAVIGATION =====
function showScreen(screenId) {
  // If logged in, block access to login and register screens
  if (currentUser && (screenId === 'loginScreen' || screenId === 'registerScreen')) {
    return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function switchTab(tabName) {
  // Block employees from accessing admin tab
  if (tabName === 'admin' && currentUser && currentUser.role !== 'admin') return;
  
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(tabName + 'Tab').classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (navBtn) navBtn.classList.add('active');
  
  if (tabName === 'settings') loadSettings();
  if (tabName === 'admin' && currentUser?.role === 'admin') loadAdminData();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ===== MODAL HELPERS =====
window.showModal = function(modalId) {
  document.getElementById(modalId).classList.add('active');
};

window.hideModal = function(modalId) {
  document.getElementById(modalId).classList.remove('active');
};

// ===== INIT =====
async function init() {
  try {
    const data = await API.fetch('/api/me');
    currentUser = data.user;
    showDashboard();
  } catch (e) {
    showScreen('loginScreen');
  }
}

// ===== REGISTER/LOGIN TOGGLE =====
document.getElementById('showRegister')?.addEventListener('click', () => showScreen('registerScreen'));
document.getElementById('showLogin')?.addEventListener('click', () => showScreen('loginScreen'));

// ===== LOGIN =====
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginErr = document.getElementById('loginErr');
  loginErr.textContent = '';
  
  try {
    const data = await API.fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: document.getElementById('companyName').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value
      })
    });
    currentUser = data.user;
    showDashboard();
  } catch (e) {
    loginErr.textContent = e.message;
  }
});

// ===== REGISTER =====
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const registerErr = document.getElementById('registerErr');
  registerErr.textContent = '';
  
  try {
    const data = await API.fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: document.getElementById('regCompanyName').value.trim(),
        adminName: document.getElementById('regAdminName').value.trim(),
        adminEmail: document.getElementById('regAdminEmail').value.trim(),
        adminPassword: document.getElementById('regAdminPassword').value
      })
    });
    currentUser = data.user;
    showDashboard();
  } catch (e) {
    registerErr.textContent = e.message;
  }
});

// ===== LOGOUT =====
async function logout() {
  try { await API.fetch('/api/logout', { method: 'POST' }); } catch(e) {}
  currentUser = null;
  if (timerInterval) clearInterval(timerInterval);
  showScreen('loginScreen');
}

document.getElementById('btnLogoutSettings').addEventListener('click', logout);

// ===== SHOW DASHBOARD =====
function showDashboard() {
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  
  // Admin-only elements: show for admin, force hide for employees
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = currentUser.role === 'admin' ? '' : 'none';
  });
  
  if (currentUser.role === 'admin') {
    document.getElementById('adminNavBtn').style.display = 'flex';
    const portalSection = document.getElementById('portalLinkSection');
    if (portalSection) portalSection.style.display = 'block';
  } else {
    document.getElementById('adminNavBtn').style.display = 'none';
  }
  
  showScreen('dashboardScreen');
  loadSites();
  loadEmployeeStatus();
  loadTodayActivity();
  loadEarnings();
  setDefaultDates();
}

// ===== SETTINGS =====
function loadSettings() {
  document.getElementById('settingsName').textContent = currentUser.name;
  document.getElementById('settingsEmail').textContent = currentUser.email;
  document.getElementById('settingsRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  
  // Pre-fill edit form with current name
  document.getElementById('editName').value = currentUser.name;
  document.getElementById('editPassword').value = '';
  document.getElementById('editPasswordConfirm').value = '';
  document.getElementById('editAccountErr').textContent = '';
  document.getElementById('editAccountSuccess').textContent = '';
  
  API.fetch(`/api/users/${currentUser.id}`).then(user => {
    document.getElementById('settingsRate').textContent = user.hourly_rate ? `$${parseFloat(user.hourly_rate).toFixed(2)}/hr` : 'N/A';
    document.getElementById('settingsStatus').innerHTML = user.is_active ? 
      '<span class="badge active">Active</span>' : '<span class="badge inactive">Inactive</span>';
  }).catch(() => {
    document.getElementById('settingsRate').textContent = '—';
    document.getElementById('settingsStatus').textContent = '—';
  });
  
  const checkbox = document.getElementById('themeToggleCheckbox');
  checkbox.checked = document.body.classList.contains('dark-mode');
  checkbox.onchange = toggleTheme;
}

// ===== SAVE ACCOUNT (name + password) =====
document.getElementById('btnSaveAccount')?.addEventListener('click', async () => {
  const name = document.getElementById('editName').value.trim();
  const password = document.getElementById('editPassword').value;
  const confirmPassword = document.getElementById('editPasswordConfirm').value;
  const err = document.getElementById('editAccountErr');
  const success = document.getElementById('editAccountSuccess');
  
  err.textContent = '';
  success.textContent = '';
  
  if (!name) {
    err.textContent = 'Name is required';
    return;
  }
  
  if (password && password.length < 6) {
    err.textContent = 'Password must be at least 6 characters';
    return;
  }
  
  if (password && password !== confirmPassword) {
    err.textContent = 'Passwords do not match';
    return;
  }
  
  try {
    const body = { name };
    if (password) body.password = password;
    
    await API.fetch(`/api/users/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    // Update local user data
    currentUser.name = name;
    document.getElementById('userName').textContent = name;
    document.getElementById('settingsName').textContent = name;
    
    success.textContent = 'Account updated successfully!';
    document.getElementById('editPassword').value = '';
    document.getElementById('editPasswordConfirm').value = '';
    
    // Clear success message after 3 seconds
    setTimeout(() => { success.textContent = ''; }, 3000);
  } catch (e) {
    err.textContent = e.message;
  }
});

// ===== SITES =====
async function loadSites() {
  try {
    sites = await API.fetch('/api/sites');
    const select = document.getElementById('siteSelect');
    select.innerHTML = '<option value="">Choose a site...</option>';
    sites.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('Failed to load sites:', e);
  }
}

// ===== CLOCK IN/OUT STATUS =====
async function loadEmployeeStatus() {
  try {
    const status = await API.fetch('/api/status');
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const currentSiteDisplay = document.getElementById('currentSiteDisplay');
    const currentSiteName = document.getElementById('currentSiteName');
    const btnClockAction = document.getElementById('btnClockAction');
    const btnSwitchSite = document.getElementById('btnSwitchSite');
    
    if (status.clockedIn) {
      indicator.classList.add('active');
      statusText.textContent = 'Clocked In';
      currentSiteName.textContent = status.currentSite?.name || 'Unknown';
      currentSiteDisplay.style.display = 'flex';
      btnClockAction.classList.add('clocked-in');
      btnClockAction.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <rect x="9" y="9" width="6" height="6"></rect>
        </svg>
        Clock Out
      `;
      btnSwitchSite.style.display = 'block';
      document.getElementById('siteSelect').value = status.currentSite?.id || '';
      clockInTime = new Date(status.clockInAt.replace(' ', 'T') + 'Z');
      startTimer();
    } else {
      indicator.classList.remove('active');
      statusText.textContent = 'Not Clocked In';
      currentSiteDisplay.style.display = 'none';
      btnClockAction.classList.remove('clocked-in');
      btnClockAction.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Clock In
      `;
      btnSwitchSite.style.display = 'none';
      document.getElementById('timerDisplay').textContent = '00:00:00';
      if (timerInterval) clearInterval(timerInterval);
    }
  } catch (e) {
    console.error('Failed to load status:', e);
  }
}

// ===== TIMER =====
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  function updateTimer() {
    if (!clockInTime) return;
    const now = new Date();
    const diff = now - clockInTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    document.getElementById('timerDisplay').textContent = 
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

// ===== CLOCK ACTION =====
document.getElementById('btnClockAction').addEventListener('click', async () => {
  const clockErr = document.getElementById('clockErr');
  clockErr.textContent = '';
  
  try {
    const status = await API.fetch('/api/status');
    
    if (status.clockedIn) {
      await API.fetch('/api/clock-out', { method: 'POST' });
    } else {
      const siteId = document.getElementById('siteSelect').value;
      if (!siteId) {
        clockErr.textContent = 'Please select a job site';
        return;
      }
      await API.fetch('/api/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: parseInt(siteId) })
      });
    }
    
    loadEmployeeStatus();
    loadTodayActivity();
    loadEarnings();
  } catch (e) {
    clockErr.textContent = e.message;
  }
});

// ===== SWITCH SITE =====
document.getElementById('btnSwitchSite').addEventListener('click', async () => {
  const clockErr = document.getElementById('clockErr');
  clockErr.textContent = '';
  
  const siteId = document.getElementById('siteSelect').value;
  if (!siteId) {
    clockErr.textContent = 'Please select a different site';
    return;
  }
  
  try {
    await API.fetch('/api/switch-site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: parseInt(siteId) })
    });
    loadEmployeeStatus();
    loadTodayActivity();
  } catch (e) {
    clockErr.textContent = e.message;
  }
});

// ===== TODAY'S ACTIVITY =====
async function loadTodayActivity() {
  try {
    const segments = await API.fetch('/api/today-segments');
    const list = document.getElementById('todayActivity');
    
    if (!segments || segments.length === 0) {
      list.innerHTML = '<div class="empty-state">No activity today</div>';
    } else {
      list.innerHTML = segments.map(s => `
        <div class="activity-item">
          <div class="activity-item-left">
            <div class="activity-site">${s.site_name}</div>
            <div class="activity-time">${formatTime(s.start_at)}${s.end_at ? ' - ' + formatTime(s.end_at) : ''}</div>
          </div>
          <div class="activity-duration">${s.end_at ? calcDuration(s.start_at, s.end_at) : 'Active'}</div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Failed to load activity:', e);
  }
}

// ===== EARNINGS =====
async function loadEarnings() {
  try {
    const data = await API.fetch('/api/earnings');
    document.getElementById('periodHours').textContent = data.periodHours;
    document.getElementById('hourlyRate').textContent = '$' + data.hourlyRate;
    document.getElementById('grossPay').textContent = '$' + data.grossPay;
    document.getElementById('taxAmount').textContent = '-$' + data.taxAmount;
    document.getElementById('netPay').textContent = '$' + data.netPay;
  } catch (e) {
    console.error('Failed to load earnings:', e);
  }
}

// ===== ADMIN DATA =====
async function loadAdminData() {
  if (currentUser.role !== 'admin') return;
  
  try {
    // Load currently active employees
    const active = await API.fetch('/api/active-now');
    document.getElementById('activeCount').textContent = active.length;
    const activeList = document.getElementById('activeList');
    if (active.length === 0) {
      activeList.innerHTML = '<div class="empty-state">No one clocked in</div>';
    } else {
      activeList.innerHTML = active.map(a => `
        <div class="user-item">
          <div class="user-item-info">
            <div class="user-name">${a.user_name}</div>
            <div class="user-details">${a.site_name || 'Unknown site'} • Since ${formatTime(a.clock_in_at)}</div>
          </div>
          <span class="badge active">Active</span>
        </div>
      `).join('');
    }
    
    // Load users
    const usersData = await API.fetch('/api/users?limit=100');
    const userList = document.getElementById('userList');
    userList.innerHTML = usersData.users.slice(0, 10).map(u => `
      <div class="user-item" onclick="editUser(${u.id})">
        <div class="user-item-info">
          <div class="user-name">${u.name}</div>
          <div class="user-details">${u.email} • $${parseFloat(u.hourly_rate || 0).toFixed(2)}/hr</div>
        </div>
        <span class="badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
      </div>
    `).join('');
    
    // Load sites
    const siteList = document.getElementById('siteList');
    siteList.innerHTML = sites.map(s => `
      <div class="site-item" onclick="editSite(${s.id})">
        <div class="user-item-info">
          <div class="site-name">${s.name}</div>
          <div class="site-address">${s.address || 'No address'}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load admin data:', e);
  }
}

// ===== EDIT USER =====
window.editUser = async function(userId) {
  try {
    const user = await API.fetch(`/api/users/${userId}`);
    currentEditUser = user;
    
    document.getElementById('userModalTitle').textContent = 'Edit Employee';
    document.getElementById('modalUserName').value = user.name;
    document.getElementById('modalUserEmail').value = user.email;
    document.getElementById('modalUserPassword').value = '';
    document.getElementById('modalUserRate').value = user.hourly_rate || '';
    document.getElementById('modalUserRole').value = user.role || 'employee';
    document.getElementById('modalUserActive').checked = user.is_active === 1;
    document.getElementById('passwordGroup').style.display = 'block';
    
    showModal('userModal');
  } catch (e) {
    console.error('Failed to load user:', e);
  }
};

// ===== EDIT SITE =====
window.editSite = function(siteId) {
  const site = sites.find(s => s.id === siteId);
  if (!site) return;
  
  currentEditSite = site;
  document.getElementById('siteModalTitle').textContent = 'Edit Job Site';
  document.getElementById('modalSiteName').value = site.name;
  document.getElementById('modalSiteAddress').value = site.address || '';
  
  showModal('siteModal');
};

// ===== SEARCH USERS =====
document.getElementById('userSearch')?.addEventListener('input', async (e) => {
  const search = e.target.value;
  const data = await API.fetch(`/api/users?search=${encodeURIComponent(search)}&limit=100`);
  
  const userList = document.getElementById('userList');
  userList.innerHTML = data.users.slice(0, 10).map(u => `
    <div class="user-item" onclick="editUser(${u.id})">
      <div class="user-item-info">
        <div class="user-name">${u.name}</div>
        <div class="user-details">${u.email} • $${parseFloat(u.hourly_rate || 0).toFixed(2)}/hr</div>
      </div>
      <span class="badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
    </div>
  `).join('');
});

// ===== ADD USER =====
document.getElementById('btnAddUser')?.addEventListener('click', () => {
  currentEditUser = null;
  document.getElementById('userModalTitle').textContent = 'Add Employee';
  document.getElementById('modalUserName').value = '';
  document.getElementById('modalUserEmail').value = '';
  document.getElementById('modalUserPassword').value = '';
  document.getElementById('modalUserRate').value = '';
  document.getElementById('modalUserRole').value = 'employee';
  document.getElementById('modalUserActive').checked = true;
  document.getElementById('passwordGroup').style.display = 'block';
  showModal('userModal');
});

// ===== SAVE USER =====
document.getElementById('btnSaveUser')?.addEventListener('click', async () => {
  const name = document.getElementById('modalUserName').value.trim();
  const email = document.getElementById('modalUserEmail').value.trim();
  const password = document.getElementById('modalUserPassword').value.trim();
  const hourlyRate = document.getElementById('modalUserRate').value.trim();
  const role = document.getElementById('modalUserRole').value;
  const isActive = document.getElementById('modalUserActive').checked;
  
  const err = document.getElementById('userModalErr');
  err.textContent = '';
  
  if (!name || !email) {
    err.textContent = 'Name and email required';
    return;
  }
  
  if (!currentEditUser && !password) {
    err.textContent = 'Password required for new user';
    return;
  }
  
  try {
    if (currentEditUser) {
      const body = { name, email, hourlyRate, isActive, role };
      if (password) body.password = password;
      await API.fetch(`/api/users/${currentEditUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } else {
      await API.fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, hourlyRate, role })
      });
    }
    hideModal('userModal');
    loadAdminData();
  } catch (e) {
    err.textContent = e.message;
  }
});

// ===== ADD SITE =====
document.getElementById('btnAddSite')?.addEventListener('click', () => {
  currentEditSite = null;
  document.getElementById('siteModalTitle').textContent = 'Add Job Site';
  document.getElementById('modalSiteName').value = '';
  document.getElementById('modalSiteAddress').value = '';
  showModal('siteModal');
});

// ===== SAVE SITE =====
document.getElementById('btnSaveSite')?.addEventListener('click', async () => {
  const name = document.getElementById('modalSiteName').value.trim();
  const address = document.getElementById('modalSiteAddress').value.trim();
  
  const err = document.getElementById('siteModalErr');
  err.textContent = '';
  
  if (!name) {
    err.textContent = 'Site name required';
    return;
  }
  
  try {
    if (currentEditSite) {
      await API.fetch(`/api/sites/${currentEditSite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address })
      });
    } else {
      await API.fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address })
      });
    }
    hideModal('siteModal');
    loadSites();
    loadAdminData();
  } catch (e) {
    err.textContent = e.message;
  }
});

// ===== PAYROLL =====
document.getElementById('btnRunPayroll')?.addEventListener('click', async () => {
  const start = document.getElementById('payrollStart').value;
  const end = document.getElementById('payrollEnd').value;
  
  if (!start || !end) return;
  
  try {
    const data = await API.fetch(`/api/payroll?start=${start}&end=${end}`);
    
    const summary = document.getElementById('payrollSummary');
    summary.innerHTML = `
      <div class="earnings-grid" style="margin-top: var(--space-md);">
        <div class="earning-item total">
          <span class="label">Total Hours</span>
          <span class="value">${data.totals.hours}</span>
        </div>
        <div class="earning-item total">
          <span class="label">Total Payroll</span>
          <span class="value">$${data.totals.pay}</span>
        </div>
      </div>
      <div class="activity-list" style="margin-top: var(--space-lg);">
        ${data.employees.map(emp => `
          <div class="activity-item">
            <div class="activity-item-left">
              <div class="activity-site">${emp.name}</div>
              <div class="activity-time">${emp.totalHours} hrs @ $${emp.hourlyRate}/hr</div>
            </div>
            <div class="activity-duration">$${emp.totalPay}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    console.error('Payroll error:', e);
  }
});

// ===== SET DEFAULT DATES =====
function setDefaultDates() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const todayStr = today.toISOString().slice(0, 10);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  
  const payrollStart = document.getElementById('payrollStart');
  const payrollEnd = document.getElementById('payrollEnd');
  if (payrollStart) payrollStart.value = weekAgoStr;
  if (payrollEnd) payrollEnd.value = todayStr;
}

// ===== UTILITIES =====
function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function calcDuration(start, end) {
  const s = new Date(start.replace(' ', 'T') + 'Z');
  const e = new Date(end.replace(' ', 'T') + 'Z');
  const hours = (e - s) / 3600000;
  return `${hours.toFixed(2)} hrs`;
}

// ===== START =====
init();
