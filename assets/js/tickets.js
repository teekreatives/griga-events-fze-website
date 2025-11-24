document.addEventListener('DOMContentLoaded', function () {
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 800, once: true, offset: 80 });
  }

  const paymentButtons = document.querySelectorAll('[data-payment]');
  const successPanel = document.getElementById('ticket-success');
  const ticketIdEl = document.getElementById('ticket-id');
  const ticketMethodEl = document.getElementById('ticket-method');
  const ticketEmailEl = document.getElementById('ticket-email');
  const ticketTimeEl = document.getElementById('ticket-timestamp');
  const ticketPriceEl = document.getElementById('ticket-price');
  const qrContainer = document.getElementById('ticket-qr');
  const statusLine = document.getElementById('payment-status');
  const downloadButton = document.getElementById('download-ticket');

  function randomTicketId() {
    return 'MN' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100);
  }

  function pad(value) {
    return value.toString().padStart(2, '0');
  }

  function formatTimestamp(date) {
    return date.toLocaleString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function clearQRCode() {
    if (qrContainer) {
      qrContainer.innerHTML = '';
    }
  }

  function renderQRCode(content) {
    clearQRCode();
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text: content,
        width: 160,
        height: 160,
        colorDark: '#d11f26',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L
      });
    }
  }

  function flushPayment(method) {
    const form = document.getElementById('ticket-form');
    const nameField = form?.querySelector('[name="name"]');
    const emailField = form?.querySelector('[name="email"]');
    const phoneField = form?.querySelector('[name="phone"]');
    const name = nameField?.value.trim() || 'Guest Attendee';
    const email = emailField?.value.trim() || 'you@example.com';
    const phone = phoneField?.value.trim() || '971 5XX XXX XXX';
    const id = randomTicketId();
    const now = new Date();

    if (ticketIdEl) ticketIdEl.textContent = id;
    if (ticketMethodEl) ticketMethodEl.textContent = method === 'mpesa' ? 'M-Pesa STK Push' : 'Stripe Checkout';
    if (ticketEmailEl) ticketEmailEl.textContent = email;
    if (ticketTimeEl) ticketTimeEl.textContent = formatTimestamp(now);
    if (ticketPriceEl) ticketPriceEl.textContent = '150 AED';
    if (statusLine) {
      statusLine.textContent = `Payment success via ${method === 'mpesa' ? 'M-Pesa' : 'Stripe'}`;
    }

    renderQRCode(`${id}|Murima Night Second Edition|${email}`);

    successPanel.classList.add('is-visible');
    successPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    console.info('Ticket record', {
      ticketId: id,
      name,
      email,
      phone,
      paymentMethod: method,
      timestamp: now
    });

    if (downloadButton) {
      downloadButton.disabled = false;
    }
  }

  function handlePayment(event) {
    event.preventDefault();
    const method = event.currentTarget.dataset.payment;
    if (statusLine) {
      statusLine.textContent = 'Processing payment...';
    }
    setTimeout(function () {
      flushPayment(method);
    }, 1200);
  }

  paymentButtons.forEach(function (button) {
    button.addEventListener('click', handlePayment);
  });

  if (downloadButton) {
    downloadButton.addEventListener('click', function () {
      const ticketId = ticketIdEl ? ticketIdEl.textContent : 'MN000';
      const now = formatTimestamp(new Date());
      const csv = `Ticket ID,${ticketId}\nStatus,Confirmed\nTimestamp,${now}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ticketId}-ticket.txt`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
});
