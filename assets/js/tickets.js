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
  const manualFlows = {
    botim: {
      button: document.getElementById('botim-show-form'),
      form: document.getElementById('botim-form'),
      nameInput: document.getElementById('botim-name'),
      phoneInput: document.getElementById('botim-phone'),
      whatsappNumber: '971529948589',
      amountLabel: '150 AED',
      methodLabel: 'BOTIM Money',
      prefix: 'BOTIM'
    },
    mpesa: {
      button: document.getElementById('mpesa-show-form'),
      form: document.getElementById('mpesa-form'),
      nameInput: document.getElementById('mpesa-name'),
      phoneInput: document.getElementById('mpesa-phone'),
      whatsappNumber: '971529948589',
      amountLabel: '5,550 KSH',
      methodLabel: 'M-PESA PAYMENT',
      prefix: 'MPESA'
    },
    bank: {
      button: document.getElementById('bank-show-form'),
      form: document.getElementById('bank-form'),
      nameInput: document.getElementById('bank-name'),
      phoneInput: document.getElementById('bank-phone'),
      whatsappNumber: '971529948589',
      amountLabel: '150 AED',
      methodLabel: 'Bank Transfer',
      prefix: 'BANK'
    }
  };

  Object.values(manualFlows).forEach((flow) => {
    flow.submitButton = flow.form?.querySelector('button[type="submit"]');
    const inputs = [flow.nameInput, flow.phoneInput];
    inputs.forEach((input) => {
      input?.addEventListener('input', () => {
        updateManualButtonState(flow);
      });
    });
    updateManualButtonState(flow);
  });

  function randomTicketId() {
    return 'MN' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100);
  }

  function generateManualOrderId(prefix) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  function pad(value) {
    return value.toString().padStart(2, '0');
  }

  function updateManualButtonState(flow) {
    const hasName = flow.nameInput?.value.trim();
    const hasPhone = flow.phoneInput?.value.trim();
    const ready = Boolean(hasName && hasPhone);
    flow.submitButton?.classList.toggle('ready', ready);
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
    if (ticketMethodEl) ticketMethodEl.textContent = method === 'mpesa' ? 'M-PESA PAYMENT' : 'Stripe Checkout';
    if (ticketEmailEl) ticketEmailEl.textContent = email;
    if (ticketTimeEl) ticketTimeEl.textContent = formatTimestamp(now);
    if (ticketPriceEl) ticketPriceEl.textContent = '150 AED';
    if (statusLine) {
      statusLine.textContent = `Payment success via ${method === 'mpesa' ? 'M-PESA PAYMENT' : 'Stripe'}`;
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

  function closeManualForm(flow) {
    flow.form?.classList.remove('is-visible');
    flow.button?.setAttribute('aria-expanded', 'false');
  }

  function toggleManualForm(key) {
    const flow = manualFlows[key];
    if (!flow || !flow.form) return;
    const isVisible = flow.form.classList.contains('is-visible');
    if (isVisible) {
      closeManualForm(flow);
      return;
    }
    Object.values(manualFlows).forEach(closeManualForm);
    flow.form.classList.add('is-visible');
    flow.button?.setAttribute('aria-expanded', 'true');
    flow.nameInput?.focus();
  }

  function resetManualForm(flow) {
    flow.form?.classList.remove('is-visible');
    if (flow.nameInput) flow.nameInput.value = '';
    if (flow.phoneInput) flow.phoneInput.value = '';
    flow.button?.setAttribute('aria-expanded', 'false');
    updateManualButtonState(flow);
  }

  function handleManualSubmit(key, event) {
    event.preventDefault();
    const flow = manualFlows[key];
    if (!flow) return;
    const buyerName = flow.nameInput?.value.trim();
    const buyerPhone = flow.phoneInput?.value.trim();
    if (!buyerName || !buyerPhone) {
      window.alert('Please provide both a name and phone number.');
      return;
    }
    const orderId = generateManualOrderId(flow.prefix);
    const message = buildManualMessage(flow, buyerName, buyerPhone, orderId);
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${flow.whatsappNumber}?text=${encodedMessage}`;
    window.open(url, '_blank');
    if (statusLine) {
      statusLine.textContent = `${flow.methodLabel} confirmation initiated (Order ID ${orderId}).`;
    }
    resetManualForm(flow);
  }

  function buildManualMessage(flow, name, phone, orderId) {
    return `Hello, I have paid for my ticket via ${flow.methodLabel}.
Name: ${name}
Phone: ${phone}
Amount: ${flow.amountLabel}
Order ID: ${orderId}
I'm attaching a screenshot to proof the payment.
Kindly confirm and send my ticket. Thank you.`;
  }

  paymentButtons.forEach(function (button) {
    button.addEventListener('click', handlePayment);
  });
  Object.keys(manualFlows).forEach(function (key) {
    const flow = manualFlows[key];
    flow.button?.addEventListener('click', function () {
      toggleManualForm(key);
    });
    flow.form?.addEventListener('submit', function (event) {
      handleManualSubmit(key, event);
    });
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
