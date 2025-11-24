document.addEventListener('DOMContentLoaded', function () {
  const ADMIN_API_ORIGIN = window.GRIGA_ADMIN_API_ORIGIN || '';
  const TOKEN_KEY = 'griga-admin-token';
  let currentTickets = [];

  const loginSection = document.getElementById('admin-login');
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('admin-login-error');
  const dashboard = document.getElementById('admin-dashboard');
  const exportButton = document.getElementById('export-csv');
  const searchInput = document.getElementById('ticket-search');
  const detailName = document.getElementById('detail-name');
  const detailEmail = document.getElementById('detail-email');
  const detailMethod = document.getElementById('detail-method');
  const detailQr = document.getElementById('admin-qr');
  const tableBody = document.querySelector('#admin-table tbody');
  const signOutButton = document.getElementById('admin-signout');

  const setToken = (value) => {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  const getToken = () => localStorage.getItem(TOKEN_KEY);

  const showLogin = (message) => {
    if (loginSection) loginSection.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    if (message && loginError) {
      loginError.textContent = message;
    }
  };

  const showDashboard = () => {
    if (loginSection) loginSection.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    if (loginError) loginError.textContent = '';
  };

  const logout = (message) => {
    setToken(null);
    showLogin(message || 'You have been signed out.');
  };

  const renderTable = (records) => {
    tableBody.innerHTML = '';
    records.forEach(function (ticket) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${ticket.id}</td>
        <td>${ticket.name}</td>
        <td>${ticket.email}</td>
        <td>${ticket.method}</td>
        <td>${new Date(ticket.timestamp).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</td>
      `;
      row.addEventListener('click', function () {
        detailName.textContent = ticket.name;
        detailEmail.textContent = ticket.email;
        detailMethod.textContent = ticket.method;
        if (typeof QRCode !== 'undefined') {
          detailQr.innerHTML = '';
          new QRCode(detailQr, { text: ticket.qr, width: 160, height: 160, colorDark: '#0c0c0c', colorLight: '#ffffff' });
        }
      });
      tableBody.appendChild(row);
    });
  };

  const filterRecords = (value) => {
    const query = value.toLowerCase().trim();
    return currentTickets.filter(function (ticket) {
      return (
        ticket.id.toLowerCase().includes(query) ||
        ticket.name.toLowerCase().includes(query) ||
        ticket.email.toLowerCase().includes(query)
      );
    });
  };

  const exportCsv = () => {
    const header = 'Ticket ID,Name,Email,Method,Timestamp\n';
    const rows = currentTickets.map(function (ticket) {
      return `${ticket.id},${ticket.name},${ticket.email},${ticket.method},${ticket.timestamp}`;
    });
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'griga-tickets.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const fetchTickets = async () => {
    const token = getToken();
    if (!token) {
      showLogin();
      return;
    }
    try {
      const response = await fetch(`${ADMIN_API_ORIGIN}/admin/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        return logout('Session expired. Please sign in again.');
      }
      if (!response.ok) {
        throw new Error('Unable to load tickets.');
      }
      const data = await response.json();
      currentTickets = data;
      renderTable(data);
      showDashboard();
    } catch (error) {
      console.error('Admin fetch failed', error);
      showLogin('Unable to reach the backend.');
    }
  };

  const loginWithCredentials = async (email, password) => {
    const response = await fetch(`${ADMIN_API_ORIGIN}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Invalid credentials.');
    }
    const body = await response.json();
    setToken(body.token);
  };

  if (exportButton) {
    exportButton.addEventListener('click', exportCsv);
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderTable(filterRecords(this.value));
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!loginForm.email || !loginForm.password) return;
      if (loginError) loginError.textContent = '';
      try {
        await loginWithCredentials(loginForm.email.value.trim(), loginForm.password.value);
        await fetchTickets();
      } catch (error) {
        if (loginError) {
          loginError.textContent = error.message;
        }
      }
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener('click', () => logout('Signed out.'));
  }

  if (getToken()) {
    fetchTickets();
  } else {
    showLogin();
  }
});
