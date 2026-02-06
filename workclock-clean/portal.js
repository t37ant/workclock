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

let currentUser = null;
let hoursData = [];
let payData = null;
let teamData = [];
let sitesData = [];
let refreshInterval = null;

// ===== INIT =====
async function init() {
  try {
    const data = await API.fetch('/api/me');
    currentUser = data.user;
    showPortal();
  } catch (e) {
    showScreen('loginScreen');
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== LOGIN =====
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('loginError');
  err.textContent = '';

  try {
    const data = await API.fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: document.getElementById('loginCompany').value.trim(),
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value
      })
    });
    currentUser = data.user;
    showPortal();
  } catch (e) {
    err.textContent = e.message;
  }
});

// ===== SHOW PORTAL =====
function showPortal() {
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userRole').textContent = currentUser.role;

  if (currentUser.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    document.querySelectorAll('.employee-only').forEach(el => el.style.display = 'none');
  } else {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.employee-only').forEach(el => el.style.display = '');
  }

  showScreen('portalScreen');
  setDefaultDates();
  loadOverview();

  // Live updates every 30 seconds
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    loadOverview();
    // Refresh active tab data
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab === 'team') loadTeam();
    if (activeTab === 'sites') loadSites();
  }, 30000);
}

// ===== TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');

    // Load data when switching tabs
    const tab = btn.dataset.tab;
    if (tab === 'team') loadTeam();
    if (tab === 'sites') loadSites();
    if (tab === 'overview') loadOverview();
  });
});

// ===== THEME =====
const theme = localStorage.getItem('portalTheme') || 'light';
document.body.classList.toggle('dark-mode', theme === 'dark');

document.getElementById('themeToggle').addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('portalTheme', isDark ? 'dark' : 'light');
});

// ===== LOGOUT =====
document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (refreshInterval) clearInterval(refreshInterval);
  await API.fetch('/api/logout', { method: 'POST' });
  location.reload();
});

// ===== DEFAULT DATES =====
function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  document.getElementById('hoursStart').value = weekAgo;
  document.getElementById('hoursEnd').value = today;
  document.getElementById('payStart').value = weekAgo;
  document.getElementById('payEnd').value = today;

  if (document.getElementById('reportStart')) {
    document.getElementById('reportStart').value = weekAgo;
    document.getElementById('reportEnd').value = today;
  }
}

// ===== OVERVIEW =====
async function loadOverview() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  try {
    if (currentUser.role === 'admin') {
      // Admin sees company-wide stats
      const weekData = await API.fetch(`/api/payroll?start=${weekAgo}&end=${today}`);
      const monthData = await API.fetch(`/api/payroll?start=${monthAgo}&end=${today}`);

      const weekHours = parseFloat(weekData.totals.hours) || 0;
      const weekPay = parseFloat(weekData.totals.pay) || 0;
      const monthHours = parseFloat(monthData.totals.hours) || 0;
      const monthPay = parseFloat(monthData.totals.pay) || 0;

      document.getElementById('weekHours').textContent = weekHours.toFixed(1);
      document.getElementById('weekPay').textContent = '$' + weekPay.toFixed(0);
      document.getElementById('monthHours').textContent = monthHours.toFixed(1);
      document.getElementById('monthPay').textContent = '$' + monthPay.toFixed(0);

      // Update stat labels for admin
      document.querySelector('.stat-card.blue .stat-label').textContent = 'Team Hours This Week';
      document.querySelector('.stat-card.green .stat-label').textContent = 'Team Payroll This Week';
      document.querySelector('.stat-card.purple .stat-label').textContent = 'Team Hours This Month';
      document.querySelector('.stat-card.orange .stat-label').textContent = 'Team Payroll This Month';

      // Load admin quick stats
      await loadAdminData();
    } else {
      // Employee sees own stats
      const weekData = await API.fetch(`/api/payroll?start=${weekAgo}&end=${today}&userId=${currentUser.id}`);
      const monthData = await API.fetch(`/api/payroll?start=${monthAgo}&end=${today}&userId=${currentUser.id}`);

      const weekEmp = weekData.employees[0];
      const weekHours = weekEmp ? parseFloat(weekEmp.totalHours) : 0;
      const weekRate = weekEmp ? parseFloat(weekEmp.hourlyRate) : 0;
      const weekPay = weekHours * weekRate;

      const monthEmp = monthData.employees[0];
      const monthHours = monthEmp ? parseFloat(monthEmp.totalHours) : 0;
      const monthPay = monthHours * weekRate;

      document.getElementById('weekHours').textContent = weekHours.toFixed(1);
      document.getElementById('weekPay').textContent = '$' + weekPay.toFixed(0);
      document.getElementById('monthHours').textContent = monthHours.toFixed(1);
      document.getElementById('monthPay').textContent = '$' + monthPay.toFixed(0);

      // Update employee quick info panel
      const rateEl = document.getElementById('overviewRate');
      if (rateEl) {
        rateEl.textContent = '$' + weekRate.toFixed(2) + '/hr';
        document.getElementById('overviewWeekGross').textContent = '$' + weekPay.toFixed(2);
        document.getElementById('overviewMonthGross').textContent = '$' + monthPay.toFixed(2);
      }
    }

    // Recent activity
    const segments = await API.fetch('/api/today-segments');
    const list = document.getElementById('recentActivity');

    if (segments.length === 0) {
      list.innerHTML = '<div class="activity-item" style="justify-content:center;color:var(--text-tertiary)">No activity today</div>';
    } else {
      list.innerHTML = segments.slice(0, 10).map(s => `
        <div class="activity-item">
          <div>
            <div class="activity-site">${escapeHtml(s.site_name)}</div>
            <div class="activity-time">${formatTime(s.start_at)}${s.end_at ? ' — ' + formatTime(s.end_at) : ''}</div>
          </div>
          <div style="font-weight:600;color:${s.end_at ? 'var(--text-primary)' : 'var(--green)'}">${s.end_at ? calcHours(s.start_at, s.end_at) : '● Active'}</div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Overview error:', e);
  }
}

async function loadAdminData() {
  try {
    const users = await API.fetch('/api/users?limit=1000');
    const sites = await API.fetch('/api/sites');
    const active = await API.fetch('/api/active-now');

    document.getElementById('totalEmployees').textContent = users.users.filter(u => u.is_active).length;
    document.getElementById('totalSites').textContent = sites.length;
    document.getElementById('currentlyActive').textContent = active.length;

    // Show active employees list in overview
    const activeList = document.getElementById('activeEmployeesList');
    if (activeList) {
      if (active.length === 0) {
        activeList.innerHTML = '<div style="color:var(--text-tertiary);text-align:center;padding:12px">No one clocked in right now</div>';
      } else {
        activeList.innerHTML = active.map(a => `
          <div class="activity-item">
            <div>
              <div class="activity-site">${escapeHtml(a.user_name)}</div>
              <div class="activity-time">${a.site_name ? escapeHtml(a.site_name) : 'No site'}</div>
            </div>
            <div style="font-weight:600;color:var(--green)">● Active since ${formatTime(a.clock_in_at)}</div>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    console.error('Admin data error:', e);
  }
}

// ===== HOURS TAB =====
document.getElementById('loadHours').addEventListener('click', loadHoursData);

async function loadHoursData() {
  const start = document.getElementById('hoursStart').value;
  const end = document.getElementById('hoursEnd').value;
  if (!start || !end) return;

  try {
    const url = currentUser.role === 'admin'
      ? `/api/shifts?start=${start}&end=${end}&userId=${currentUser.id}`
      : `/api/shifts?start=${start}&end=${end}`;

    const response = await fetch(url, { credentials: 'include' });
    const data = await response.json();

    hoursData = data.shifts || [];
    const tbody = document.getElementById('hoursTableBody');
    let total = 0;

    if (hoursData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No hours logged in this period</td></tr>';
    } else {
      tbody.innerHTML = hoursData.map(shift => {
        const hours = shift.hours_worked ? parseFloat(shift.hours_worked) : 0;
        total += hours;
        return `
          <tr>
            <td>${formatDate(shift.clock_in_at)}</td>
            <td>${escapeHtml(shift.site_name || 'Unknown')}</td>
            <td>${formatTime(shift.clock_in_at)}</td>
            <td>${shift.clock_out_at ? formatTime(shift.clock_out_at) : '<span style="color:var(--green)">● Active</span>'}</td>
            <td>${hours.toFixed(2)} hrs</td>
          </tr>
        `;
      }).join('');
    }

    document.getElementById('hoursTotal').textContent = total.toFixed(1) + ' hrs';
  } catch (e) {
    console.error('Hours error:', e);
  }
}

// ===== PAY TAB =====
document.getElementById('loadPay').addEventListener('click', loadPayData);

async function loadPayData() {
  const start = document.getElementById('payStart').value;
  const end = document.getElementById('payEnd').value;
  if (!start || !end) return;

  try {
    const data = await API.fetch(`/api/payroll?start=${start}&end=${end}&userId=${currentUser.id}`);
    payData = data;

    const emp = data.employees[0];
    if (!emp) {
      document.getElementById('payHours').textContent = '0.0 hrs';
      document.getElementById('payRate').textContent = '$0.00/hr';
      document.getElementById('payGross').textContent = '$0.00';
      document.getElementById('payTax').textContent = '-$0.00';
      document.getElementById('payNet').textContent = '$0.00';
      document.getElementById('paySiteBody').innerHTML = '<tr><td colspan="3" class="empty">No data for this period</td></tr>';
      return;
    }

    const hours = parseFloat(emp.totalHours);
    const rate = parseFloat(emp.hourlyRate);
    const gross = hours * rate;
    const tax = gross * 0.22;
    const net = gross - tax;

    document.getElementById('payHours').textContent = hours.toFixed(1) + ' hrs';
    document.getElementById('payRate').textContent = '$' + rate.toFixed(2) + '/hr';
    document.getElementById('payGross').textContent = '$' + gross.toFixed(2);
    document.getElementById('payTax').textContent = '-$' + tax.toFixed(2);
    document.getElementById('payNet').textContent = '$' + net.toFixed(2);

    // Load site breakdown
    try {
      const report = await API.fetch(`/api/report?start=${start}&end=${end}`);
      const siteMap = {};

      // Filter segments for current user if not admin
      const userSegments = report.segments.filter(s =>
        currentUser.role === 'admin' || s.user_id === currentUser.id
      );

      userSegments.forEach(s => {
        if (!siteMap[s.site_name]) siteMap[s.site_name] = 0;
        siteMap[s.site_name] += parseFloat(s.hours) || 0;
      });

      const siteEntries = Object.entries(siteMap);
      if (siteEntries.length === 0) {
        document.getElementById('paySiteBody').innerHTML = '<tr><td colspan="3" class="empty">No site data</td></tr>';
      } else {
        document.getElementById('paySiteBody').innerHTML = siteEntries.map(([site, hrs]) => `
          <tr>
            <td>${escapeHtml(site)}</td>
            <td>${hrs.toFixed(1)} hrs</td>
            <td>$${(hrs * rate).toFixed(2)}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      // If report endpoint fails (employee without admin access), show simple message
      document.getElementById('paySiteBody').innerHTML = '<tr><td colspan="3" class="empty">Site breakdown requires admin access</td></tr>';
    }
  } catch (e) {
    console.error('Pay error:', e);
  }
}

// ===== TEAM TAB (Admin) =====
async function loadTeam(search = '') {
  try {
    const url = search
      ? `/api/users?limit=1000&search=${encodeURIComponent(search)}`
      : '/api/users?limit=1000';
    const data = await API.fetch(url);
    teamData = data.users || [];

    const tbody = document.getElementById('teamTableBody');
    if (teamData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No employees found</td></tr>';
      return;
    }

    tbody.innerHTML = teamData.map(u => `
      <tr>
        <td>
          <strong>${escapeHtml(u.name)}</strong>
          ${u.role === 'admin' ? '<span style="color:var(--purple);font-size:11px;margin-left:4px">ADMIN</span>' : ''}
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td>$${parseFloat(u.hourly_rate).toFixed(2)}/hr</td>
        <td>
          <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;
            background:${u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};
            color:${u.is_active ? 'var(--green)' : 'var(--red)'}">
            ${u.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <button class="btn-secondary" style="height:28px;padding:0 10px;font-size:12px;margin-right:4px" onclick="editEmployee(${u.id})">Edit</button>
          ${u.id !== currentUser.id ? `<button class="btn-secondary" style="height:28px;padding:0 10px;font-size:12px;color:var(--red)" onclick="toggleEmployee(${u.id}, ${u.is_active})">${u.is_active ? 'Deactivate' : 'Activate'}</button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Team error:', e);
  }
}

// Team search
document.getElementById('teamSearch')?.addEventListener('input', debounce((e) => {
  loadTeam(e.target.value);
}, 300));

// Add Employee
document.getElementById('addEmployee')?.addEventListener('click', () => {
  showModal('employeeModal');
  document.getElementById('employeeModalTitle').textContent = 'Add Employee';
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
  document.getElementById('employeePassword').required = true;
  document.getElementById('employeePasswordHint').style.display = 'none';
});

// Edit Employee
window.editEmployee = async function(id) {
  const user = teamData.find(u => u.id === id);
  if (!user) return;

  showModal('employeeModal');
  document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
  document.getElementById('employeeId').value = user.id;
  document.getElementById('employeeName').value = user.name;
  document.getElementById('employeeEmail').value = user.email;
  document.getElementById('employeeRate').value = user.hourly_rate;
  document.getElementById('employeeRole').value = user.role;
  document.getElementById('employeePassword').value = '';
  document.getElementById('employeePassword').required = false;
  document.getElementById('employeePasswordHint').style.display = 'block';
};

// Toggle Employee active/inactive
window.toggleEmployee = async function(id, isActive) {
  const action = isActive ? 'deactivate' : 'reactivate';
  if (!confirm(`Are you sure you want to ${action} this employee?`)) return;

  try {
    if (isActive) {
      await API.fetch(`/api/users/${id}`, { method: 'DELETE' });
    } else {
      await API.fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      });
    }
    loadTeam(document.getElementById('teamSearch')?.value || '');
    loadOverview();
  } catch (e) {
    alert('Error: ' + e.message);
  }
};

// Save Employee (create or update)
document.getElementById('employeeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('employeeId').value;
  const payload = {
    name: document.getElementById('employeeName').value.trim(),
    email: document.getElementById('employeeEmail').value.trim(),
    hourlyRate: parseFloat(document.getElementById('employeeRate').value) || 0,
    role: document.getElementById('employeeRole').value
  };

  const password = document.getElementById('employeePassword').value;
  if (password) payload.password = password;

  try {
    if (id) {
      await API.fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      if (!password) {
        alert('Password is required for new employees');
        return;
      }
      payload.password = password;
      await API.fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    hideModal('employeeModal');
    loadTeam();
    loadOverview();
  } catch (e) {
    alert('Error: ' + e.message);
  }
});

// ===== SITES TAB (Admin) =====
async function loadSites(search = '') {
  try {
    const data = await API.fetch('/api/sites');
    sitesData = data;

    // Client-side search filter
    let filtered = sitesData;
    if (search) {
      const q = search.toLowerCase();
      filtered = sitesData.filter(s =>
        s.name.toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById('sitesTableBody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty">No sites found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.address || '—')}</td>
        <td>
          <button class="btn-secondary" style="height:28px;padding:0 10px;font-size:12px;margin-right:4px" onclick="editSite(${s.id})">Edit</button>
          <button class="btn-secondary" style="height:28px;padding:0 10px;font-size:12px;color:var(--red)" onclick="deleteSite(${s.id}, '${escapeHtml(s.name)}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Sites error:', e);
  }
}

// Sites search
document.getElementById('sitesSearch')?.addEventListener('input', debounce((e) => {
  loadSites(e.target.value);
}, 300));

// Add Site
document.getElementById('addSite')?.addEventListener('click', () => {
  showModal('siteModal');
  document.getElementById('siteModalTitle').textContent = 'Add Job Site';
  document.getElementById('siteForm').reset();
  document.getElementById('siteId').value = '';
});

// Edit Site
window.editSite = function(id) {
  const site = sitesData.find(s => s.id === id);
  if (!site) return;

  showModal('siteModal');
  document.getElementById('siteModalTitle').textContent = 'Edit Job Site';
  document.getElementById('siteId').value = site.id;
  document.getElementById('siteName').value = site.name;
  document.getElementById('siteAddress').value = site.address || '';
};

// Delete Site
window.deleteSite = async function(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

  try {
    await API.fetch(`/api/sites/${id}`, { method: 'DELETE' });
    loadSites(document.getElementById('sitesSearch')?.value || '');
    loadOverview();
  } catch (e) {
    alert('Error: ' + e.message);
  }
};

// Save Site (create or update)
document.getElementById('siteForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('siteId').value;
  const payload = {
    name: document.getElementById('siteName').value.trim(),
    address: document.getElementById('siteAddress').value.trim()
  };

  try {
    if (id) {
      await API.fetch(`/api/sites/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await API.fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    hideModal('siteModal');
    loadSites();
    loadOverview();
  } catch (e) {
    alert('Error: ' + e.message);
  }
});

// ===== REPORTS TAB (Admin) =====
document.getElementById('generateReport')?.addEventListener('click', async () => {
  const start = document.getElementById('reportStart').value;
  const end = document.getElementById('reportEnd').value;
  if (!start || !end) return;

  try {
    const data = await API.fetch(`/api/payroll?start=${start}&end=${end}`);

    let totalHours = 0;
    let totalPay = 0;

    const tbody = document.getElementById('reportTableBody');

    if (data.employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No data for this period</td></tr>';
      document.getElementById('reportTotalHours').textContent = '0';
      document.getElementById('reportTotalPay').textContent = '$0';
      return;
    }

    tbody.innerHTML = data.employees.map(emp => {
      const hours = parseFloat(emp.totalHours);
      const rate = parseFloat(emp.hourlyRate);
      const gross = hours * rate;
      const tax = gross * 0.22;
      const net = gross - tax;

      totalHours += hours;
      totalPay += net;

      return `
        <tr>
          <td><strong>${escapeHtml(emp.name)}</strong></td>
          <td>${hours.toFixed(1)}</td>
          <td>$${rate.toFixed(2)}</td>
          <td>$${gross.toFixed(2)}</td>
          <td style="color:var(--red)">-$${tax.toFixed(2)}</td>
          <td style="font-weight:700">$${net.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('reportTotalHours').textContent = totalHours.toFixed(1);
    document.getElementById('reportTotalPay').textContent = '$' + totalPay.toFixed(2);
  } catch (e) {
    console.error('Report error:', e);
  }
});

// ===== EXPORTS =====

// Hours Excel
document.getElementById('exportHoursExcel').addEventListener('click', () => {
  if (hoursData.length === 0) return alert('Load hours data first');

  const ws_data = [
    ['Date', 'Job Site', 'Clock In', 'Clock Out', 'Hours'],
    ...hoursData.map(s => [
      formatDate(s.clock_in_at),
      s.site_name || 'Unknown',
      formatTime(s.clock_in_at),
      s.clock_out_at ? formatTime(s.clock_out_at) : '—',
      s.hours_worked ? parseFloat(s.hours_worked).toFixed(2) : '0.00'
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, 'Hours');
  XLSX.writeFile(wb, `Hours_${currentUser.name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

// Hours PDF
document.getElementById('exportHoursPDF').addEventListener('click', () => {
  if (hoursData.length === 0) return alert('Load hours data first');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text('Hours Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Employee: ${currentUser.name}`, 14, 22);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  const tableData = hoursData.map(s => [
    formatDate(s.clock_in_at),
    s.site_name || 'Unknown',
    formatTime(s.clock_in_at),
    s.clock_out_at ? formatTime(s.clock_out_at) : '—',
    s.hours_worked ? parseFloat(s.hours_worked).toFixed(2) : '0.00'
  ]);

  doc.autoTable({
    startY: 35,
    head: [['Date', 'Job Site', 'Clock In', 'Clock Out', 'Hours']],
    body: tableData
  });

  doc.save(`Hours_${currentUser.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
});

// Hours CSV
document.getElementById('exportHoursCSV').addEventListener('click', () => {
  if (hoursData.length === 0) return alert('Load hours data first');

  const csv = [
    ['Date', 'Job Site', 'Clock In', 'Clock Out', 'Hours'].join(','),
    ...hoursData.map(s => [
      formatDate(s.clock_in_at),
      `"${s.site_name || 'Unknown'}"`,
      formatTime(s.clock_in_at),
      s.clock_out_at ? formatTime(s.clock_out_at) : '—',
      s.hours_worked ? parseFloat(s.hours_worked).toFixed(2) : '0.00'
    ].join(','))
  ].join('\n');

  downloadCSV(csv, `Hours_${currentUser.name}_${new Date().toISOString().slice(0, 10)}.csv`);
});

// Pay Excel
document.getElementById('exportPayExcel').addEventListener('click', () => {
  if (!payData || !payData.employees[0]) return alert('Load pay data first');

  const emp = payData.employees[0];
  const hours = parseFloat(emp.totalHours);
  const rate = parseFloat(emp.hourlyRate);
  const gross = hours * rate;
  const tax = gross * 0.22;
  const net = gross - tax;

  const ws_data = [
    ['Pay Summary'],
    ['Employee', emp.name],
    ['Period', document.getElementById('payStart').value + ' to ' + document.getElementById('payEnd').value],
    [],
    ['Total Hours', hours.toFixed(2)],
    ['Hourly Rate', '$' + rate.toFixed(2)],
    ['Gross Pay', '$' + gross.toFixed(2)],
    ['Est. Tax (22%)', '$' + tax.toFixed(2)],
    ['Net Pay', '$' + net.toFixed(2)]
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, 'Pay');
  XLSX.writeFile(wb, `Pay_${currentUser.name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

// Pay PDF
document.getElementById('exportPayPDF').addEventListener('click', () => {
  if (!payData || !payData.employees[0]) return alert('Load pay data first');

  const emp = payData.employees[0];
  const hours = parseFloat(emp.totalHours);
  const rate = parseFloat(emp.hourlyRate);
  const gross = hours * rate;
  const tax = gross * 0.22;
  const net = gross - tax;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text('Pay Summary', 14, 15);
  doc.setFontSize(10);
  doc.text(`Employee: ${emp.name}`, 14, 25);
  doc.text(`Period: ${document.getElementById('payStart').value} to ${document.getElementById('payEnd').value}`, 14, 31);

  doc.autoTable({
    startY: 40,
    head: [['Item', 'Amount']],
    body: [
      ['Total Hours', hours.toFixed(2) + ' hrs'],
      ['Hourly Rate', '$' + rate.toFixed(2) + '/hr'],
      ['Gross Pay', '$' + gross.toFixed(2)],
      ['Est. Tax (22%)', '-$' + tax.toFixed(2)],
      ['Net Pay', '$' + net.toFixed(2)]
    ]
  });

  doc.save(`Pay_${currentUser.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
});

// Report exports (Admin)
document.getElementById('exportReportExcel')?.addEventListener('click', async () => {
  const start = document.getElementById('reportStart').value;
  const end = document.getElementById('reportEnd').value;

  try {
    const data = await API.fetch(`/api/payroll?start=${start}&end=${end}`);

    const ws_data = [
      ['Payroll Report'],
      ['Period', start + ' to ' + end],
      [],
      ['Employee', 'Hours', 'Rate', 'Gross Pay', 'Est. Tax', 'Net Pay'],
      ...data.employees.map(emp => {
        const hours = parseFloat(emp.totalHours);
        const rate = parseFloat(emp.hourlyRate);
        const gross = hours * rate;
        const tax = gross * 0.22;
        const net = gross - tax;
        return [emp.name, hours.toFixed(2), '$' + rate.toFixed(2), '$' + gross.toFixed(2), '$' + tax.toFixed(2), '$' + net.toFixed(2)];
      })
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    XLSX.writeFile(wb, `Payroll_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) {
    console.error('Export error:', e);
  }
});

document.getElementById('exportReportPDF')?.addEventListener('click', async () => {
  const start = document.getElementById('reportStart').value;
  const end = document.getElementById('reportEnd').value;

  try {
    const data = await API.fetch(`/api/payroll?start=${start}&end=${end}`);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text('Payroll Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${start} to ${end}`, 14, 22);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

    const tableData = data.employees.map(emp => {
      const hours = parseFloat(emp.totalHours);
      const rate = parseFloat(emp.hourlyRate);
      const gross = hours * rate;
      const tax = gross * 0.22;
      const net = gross - tax;
      return [emp.name, hours.toFixed(1), '$' + rate.toFixed(2), '$' + gross.toFixed(2), '$' + tax.toFixed(2), '$' + net.toFixed(2)];
    });

    doc.autoTable({
      startY: 35,
      head: [['Employee', 'Hours', 'Rate', 'Gross', 'Tax', 'Net']],
      body: tableData
    });

    doc.save(`Payroll_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    console.error('Export error:', e);
  }
});

// ===== MODALS =====
function showModal(id) {
  document.getElementById(id).classList.add('active');
}

function hideModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ===== HELPERS =====
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString();
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function calcHours(start, end) {
  const s = new Date(start.replace(' ', 'T') + 'Z');
  const e = new Date(end.replace(' ', 'T') + 'Z');
  const hours = (e - s) / 3600000;
  return hours.toFixed(1) + ' hrs';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== START =====
init();

// ========== INSIGHTS TAB FUNCTIONS ==========
const INSIGHTS_API = 'http://127.0.0.1:8001';

// Load all insights data
async function loadInsightsData() {
  try {
    // Load today's summary
    const todayData = await fetch(`${INSIGHTS_API}/today`).then(r => r.json());
    document.getElementById('insightsTodayHours').textContent = todayData.total_hours.toFixed(1);
    document.getElementById('insightsTodayPay').textContent = `$${todayData.total_pay.toFixed(0)}`;
    document.getElementById('insightsActiveNow').textContent = todayData.currently_active;

    // Load weekly payroll total
    const weeklyData = await fetch(`${INSIGHTS_API}/payroll?days=7`).then(r => r.json());
    const weeklyTotal = weeklyData.reduce((sum, emp) => sum + emp.total_pay, 0);
    document.getElementById('insightsWeeklyPay').textContent = `$${weeklyTotal.toFixed(0)}`;

    // Load active employees
    const activeData = await fetch(`${INSIGHTS_API}/active`).then(r => r.json());
    const activeList = document.getElementById('insightsActiveList');
    if (activeData.length === 0) {
      activeList.innerHTML = '<div style="color:var(--text-tertiary);text-align:center;padding:12px">Nobody is currently clocked in</div>';
    } else {
      activeList.innerHTML = activeData.map(emp => `
        <div class="activity-item">
          <div class="activity-main">
            <span class="activity-label">👤 ${emp.name}</span>
            <span class="activity-time">${emp.hours_today.toFixed(1)} hrs</span>
          </div>
          <div class="activity-detail">📍 ${emp.site_name}</div>
        </div>
      `).join('');
    }

    // Load site activity
    const sitesData = await fetch(`${INSIGHTS_API}/sites/busy`).then(r => r.json());
    const siteActivity = document.getElementById('insightsSiteActivity');
    siteActivity.innerHTML = sitesData.map(site => `
      <div class="activity-item">
        <div class="activity-main">
          <span class="activity-label">📍 ${site.site_name}</span>
          <span class="activity-time">${site.total_hours_today.toFixed(1)} hrs</span>
        </div>
        <div class="activity-detail">👥 ${site.active_employees} active now</div>
      </div>
    `).join('');

    // Load payroll breakdown
    const payrollBody = document.getElementById('insightsPayrollBody');
    if (weeklyData.length === 0) {
      payrollBody.innerHTML = '<tr><td colspan="4" class="empty">No shifts this week</td></tr>';
    } else {
      payrollBody.innerHTML = weeklyData.map(emp => `
        <tr>
          <td>${emp.name}</td>
          <td>${emp.total_hours.toFixed(2)}</td>
          <td>$${emp.hourly_rate.toFixed(2)}</td>
          <td><strong>$${emp.total_pay.toFixed(2)}</strong></td>
        </tr>
      `).join('');
    }

  } catch (error) {
    console.error('Failed to load insights:', error);
    const activeList = document.getElementById('insightsActiveList');
    activeList.innerHTML = `
      <div style="color:var(--red);text-align:center;padding:20px">
        ❌ Could not connect to Insights API<br>
        <small style="color:var(--text-tertiary)">Make sure the API is running: python calprotrack_api_fixed.py</small>
      </div>
    `;
  }
}

// Refresh insights button handler
document.getElementById('refreshInsights')?.addEventListener('click', () => {
  loadInsightsData();
});

// Load insights when tab is shown
document.querySelector('[data-tab="insights"]')?.addEventListener('click', () => {
  setTimeout(loadInsightsData, 100);
});

// Auto-refresh insights every 30 seconds when tab is active
let insightsInterval;
const insightsTabObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.target.classList.contains('active') && 
        mutation.target.id === 'insightsTab') {
      loadInsightsData();
      insightsInterval = setInterval(loadInsightsData, 30000);
    } else if (!mutation.target.classList.contains('active') && 
               mutation.target.id === 'insightsTab') {
      if (insightsInterval) {
        clearInterval(insightsInterval);
      }
    }
  });
});

const insightsTab = document.getElementById('insightsTab');
if (insightsTab) {
  insightsTabObserver.observe(insightsTab, { attributes: true, attributeFilter: ['class'] });
}
