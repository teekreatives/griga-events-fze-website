document.addEventListener('DOMContentLoaded', function () {
  const ticketRecords = [
    {
      id: 'MNZ4H82',
      name: 'Nia Kamau',
      email: 'nia@murima.net',
      phone: '+971 50 123 4567',
      method: 'Stripe',
      timestamp: '2025-11-19T15:24:00+04:00',
      qr: 'MNZ4H82|Nia'
    },
    {
      id: 'MNP0QW1',
      name: 'Joseph Mwangi',
      email: 'joseph@grigaevents.ae',
      phone: '+971 52 345 6789',
      method: 'M-Pesa',
      timestamp: '2025-11-18T22:05:00+04:00',
      qr: 'MNP0QW1|Joseph'
    },
    {
      id: 'MNJ8LZ3',
      name: 'Asha Oloo',
      email: 'asha.culture@gmail.com',
      phone: '+971 58 777 4321',
      method: 'Stripe',
      timestamp: '2025-11-18T09:12:00+04:00',
      qr: 'MNJ8LZ3|Asha'
    }
  ];

  const tableBody = document.querySelector('#admin-table tbody');
  const searchInput = document.getElementById('ticket-search');
  const exportButton = document.getElementById('export-csv');
  const detailName = document.getElementById('detail-name');
  const detailEmail = document.getElementById('detail-email');
  const detailMethod = document.getElementById('detail-method');
  const detailQr = document.getElementById('admin-qr');

  function renderTable(records) {
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
  }

  function filterRecords(value) {
    const query = value.toLowerCase().trim();
    return ticketRecords.filter(function (ticket) {
      return (
        ticket.id.toLowerCase().includes(query) ||
        ticket.name.toLowerCase().includes(query) ||
        ticket.email.toLowerCase().includes(query)
      );
    });
  }

  function exportCsv() {
    const header = 'Ticket ID,Name,Email,Method,Timestamp\n';
    const rows = ticketRecords.map(function (ticket) {
      return `${ticket.id},${ticket.name},${ticket.email},${ticket.method},${ticket.timestamp}`;
    });
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'griga-tickets.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  exportButton.addEventListener('click', exportCsv);

  searchInput.addEventListener('input', function () {
    const filtered = filterRecords(this.value);
    renderTable(filtered);
  });

  renderTable(ticketRecords);
});
