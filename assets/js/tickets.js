/**
 * GRIGA Events FZE – Tickets checkout
 * Multi-step checkout with Stripe + WhatsApp proof (mirrors shop flow).
 */
(function () {
  'use strict';

  var state = {
    quantity: 1,
    checkoutStep: 1,
    paymentMethod: null,
    order: null,
    customer: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function formatPriceAed(amount) {
    if (window.TICKET_PAYMENTS) {
      return TICKET_PAYMENTS.formatAmount(amount, 'AED');
    }
    return 'AED ' + amount;
  }

  function getDefaultTotal() {
    return state.quantity * (window.TICKET_PAYMENTS ? TICKET_PAYMENTS.priceAed : 150);
  }

  function getCheckoutAmountLabel() {
    if (!window.TICKET_PAYMENTS) {
      return formatPriceAed(getDefaultTotal());
    }
    return TICKET_PAYMENTS.formatAmountForMethod(state.paymentMethod || 'stripe', state.quantity);
  }

  function generateOrderId() {
    if (window.TICKET_PAYMENTS) {
      var method = TICKET_PAYMENTS.getMethod(state.paymentMethod);
      return TICKET_PAYMENTS.generateOrderId(method && method.prefix ? method.prefix : 'TKT');
    }
    return 'TKT-' + Date.now().toString(36).toUpperCase();
  }

  function showToast(message) {
    var toast = $('ticket-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3200);
  }

  function scrollToPaymentDetails() {
    var checkout = $('ticket-checkout');
    var panel = $('ticket-payment-detail-panel');
    var footer = $('ticket-checkout-footer');
    var scrollContainer = checkout ? checkout.querySelector('.shop-checkout-panel') : null;
    if (!panel || panel.hidden || !scrollContainer || !footer) return;

    requestAnimationFrame(function () {
      setTimeout(function () {
        var detailCard = panel.querySelector('.shop-checkout-payment') || panel;
        var padding = 16;
        var maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        var containerTop = scrollContainer.getBoundingClientRect().top;
        var cardTop = detailCard.getBoundingClientRect().top - containerTop + scrollContainer.scrollTop;
        var footerBottom = footer.getBoundingClientRect().bottom - containerTop + scrollContainer.scrollTop;
        var blockHeight = footerBottom - cardTop + padding;
        var viewport = scrollContainer.clientHeight;
        var target = blockHeight <= viewport ? cardTop - padding : footerBottom - viewport + padding;

        scrollContainer.scrollTo({
          top: Math.max(0, Math.min(target, maxScroll)),
          behavior: 'smooth'
        });
      }, 180);
    });
  }

  function syncQuantityUI() {
    var qtyInput = $('ticket-quantity');
    if (qtyInput) qtyInput.value = state.quantity;
    var totalEl = $('ticket-card-total');
    if (totalEl) totalEl.textContent = formatPriceAed(getDefaultTotal());
  }

  function openCheckoutModal(preselectedMethod) {
    state.checkoutStep = 1;
    state.order = null;
    state.customer = null;
    state.paymentMethod = preselectedMethod || null;

    ['ticket-customer-name', 'ticket-customer-email', 'ticket-customer-phone'].forEach(function (id) {
      var field = $(id);
      if (field) field.value = '';
    });
    var err = $('ticket-form-error');
    if (err) err.textContent = '';

    var panel = $('ticket-payment-detail-panel');
    if (panel) {
      panel.innerHTML = '';
      panel.hidden = true;
    }

    document.querySelectorAll('#ticket-checkout .shop-payment-card input').forEach(function (input) {
      input.checked = input.value === state.paymentMethod;
    });
    document.querySelectorAll('#ticket-checkout .shop-payment-card').forEach(function (card) {
      var input = card.querySelector('input');
      card.classList.toggle('is-selected', input && input.value === state.paymentMethod);
    });

    renderCheckoutStep();

    var checkout = $('ticket-checkout');
    if (checkout) {
      checkout.classList.add('is-open');
      checkout.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('shop-checkout-open');
    if (window.grigaScrollLock) window.grigaScrollLock.lock();
  }

  function closeCheckoutModal() {
    var checkout = $('ticket-checkout');
    if (checkout) {
      checkout.classList.remove('is-open');
      checkout.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('shop-checkout-open');
    if (window.grigaScrollLock) window.grigaScrollLock.unlock();
  }

  function renderCheckoutStep() {
    document.querySelectorAll('#ticket-checkout .shop-step').forEach(function (step) {
      var n = parseInt(step.dataset.step, 10);
      step.classList.toggle('is-active', n === state.checkoutStep);
      step.classList.toggle('is-complete', n < state.checkoutStep);
    });

    document.querySelectorAll('#ticket-checkout .shop-checkout-step').forEach(function (panel) {
      panel.classList.toggle('is-active', parseInt(panel.dataset.step, 10) === state.checkoutStep);
    });

    if (state.checkoutStep === 2) renderOrderReview();
    if (state.checkoutStep === 3) renderPaymentPanel();
    if (state.checkoutStep === 4) renderConfirmation();

    var backBtn = $('ticket-checkout-back');
    var nextBtn = $('ticket-checkout-next');
    if (backBtn) {
      backBtn.style.visibility =
        state.checkoutStep > 1 && state.checkoutStep < 4 ? 'visible' : 'hidden';
    }
    if (nextBtn) {
      nextBtn.classList.add('btn-primary');
      nextBtn.classList.remove('btn-secondary');
      var showWhatsAppProof = state.checkoutStep === 3 && !!state.paymentMethod;
      nextBtn.classList.toggle('shop-whatsapp-proof-btn', showWhatsAppProof);
      if (state.checkoutStep === 3) {
        nextBtn.style.display = '';
        nextBtn.textContent = state.paymentMethod ? 'Send proof via WhatsApp' : 'Place Order';
      } else if (state.checkoutStep >= 4) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = '';
        nextBtn.textContent = 'Continue';
      }
    }
  }

  function renderPaymentPanel() {
    var panel = $('ticket-payment-detail-panel');
    if (!panel || !window.TICKET_PAYMENTS) return;

    if (!state.paymentMethod) {
      panel.innerHTML = '';
      panel.hidden = true;
      return;
    }

    var method = TICKET_PAYMENTS.getMethod(state.paymentMethod);
    if (!method) {
      panel.innerHTML = '';
      panel.hidden = true;
      return;
    }

    var amount = getCheckoutAmountLabel();
    panel.hidden = false;

    if (method.type === 'stripe') {
      panel.innerHTML =
        '<article class="payment-option payment-option--stripe shop-checkout-payment">' +
        '<h3>Stripe Checkout</h3>' +
        '<p>' +
        method.description +
        '</p>' +
        '<dl class="payment-details"><div><dt>Order Total</dt><dd>' +
        amount +
        '</dd></div></dl>' +
        '<div class="payment-actions">' +
        '<button type="button" class="btn btn-secondary shop-stripe-pay-btn" id="ticket-stripe-pay">Pay via Card</button>' +
        '</div>' +
        '<p class="shop-payment-panel-note">Complete payment on Stripe, then click <strong>Send proof via WhatsApp</strong> below with your Stripe confirmation so we can deliver your ticket.</p>' +
        '</article>';
      bindStripePayButton();
      scrollToPaymentDetails();
      return;
    }

    var details = method.details ? method.details() : [];
    var detailsHtml = details
      .map(function (row) {
        return '<div><dt>' + row.dt + '</dt><dd>' + row.dd + '</dd></div>';
      })
      .join('');

    if (method.amountDetail) {
      detailsHtml += '<div><dt>Amount</dt><dd>' + amount + '</dd></div>';
    }

    var heading = '<h3>' + method.label + '</h3>';
    if (method.logo && method.title) {
      heading =
        '<div class="payment-option__heading">' +
        '<img class="payment-option__logo" src="' +
        method.logo +
        '" alt="' +
        (method.logoAlt || '') +
        '" />' +
        '<span class="payment-option__title">' +
        method.title +
        '</span></div>';
    } else if (method.logo) {
      heading =
        '<div class="payment-option__heading">' +
        '<img class="payment-option__logo" src="' +
        method.logo +
        '" alt="' +
        (method.logoAlt || '') +
        '" />' +
        '<h3>' +
        method.label +
        '</h3></div>';
    }

    var copyInfo = method.copyInfo ? method.copyInfo(amount) : '';

    panel.innerHTML =
      '<article class="payment-option ' +
      method.cardClass +
      ' shop-checkout-payment">' +
      heading +
      '<p>' +
      method.intro(amount) +
      '</p>' +
      '<dl class="payment-details">' +
      detailsHtml +
      '</dl>' +
      '<div class="payment-actions">' +
      '<button type="button" class="btn btn-secondary" id="ticket-copy-payment" data-payment-info="' +
      copyInfo.replace(/"/g, '&quot;') +
      '">Copy Details</button>' +
      '</div>' +
      '<p class="shop-payment-panel-note">After paying, click <strong>Send proof via WhatsApp</strong> below. We will verify and confirm your ticket.</p>' +
      '</article>';

    bindCopyPaymentButton();
    scrollToPaymentDetails();
  }

  function bindStripePayButton() {
    var payBtn = $('ticket-stripe-pay');
    if (!payBtn) return;
    payBtn.addEventListener('click', openStripeCheckout);
  }

  function bindCopyPaymentButton() {
    var copyBtn = $('ticket-copy-payment');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', function () {
      var payload = copyBtn.getAttribute('data-payment-info');
      if (!payload) return;

      var original = copyBtn.textContent;
      var onCopied = function () {
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.textContent = original;
          copyBtn.classList.remove('copied');
        }, 2000);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(onCopied).catch(function () {
          fallbackCopy(payload);
          onCopied();
        });
      } else {
        fallbackCopy(payload);
        onCopied();
      }
    });
  }

  function fallbackCopy(value) {
    var temp = document.createElement('textarea');
    temp.value = value;
    temp.setAttribute('readonly', '');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
  }

  function getPaymentMethodLabel(methodId) {
    var method = window.TICKET_PAYMENTS ? TICKET_PAYMENTS.getMethod(methodId) : null;
    return method ? method.label : methodId;
  }

  function renderOrderReview() {
    var container = $('ticket-order-review');
    if (!container || !window.TICKET_PAYMENTS) return;

    var total = TICKET_PAYMENTS.getOrderTotal(state.paymentMethod || 'stripe', state.quantity);

    container.innerHTML =
      '<div class="shop-order-review-row shop-order-review-row--product">' +
      '<span class="shop-order-review-label">Event</span>' +
      '<span class="shop-order-review-value">' +
      TICKET_PAYMENTS.eventName +
      '</span></div>' +
      '<div class="shop-order-review-row">' +
      '<span class="shop-order-review-label">Quantity</span>' +
      '<span class="shop-order-review-value">' +
      state.quantity +
      '</span></div>' +
      '<div class="shop-order-review-row">' +
      '<span class="shop-order-review-label">Price (AED)</span>' +
      '<span class="shop-order-review-value">' +
      TICKET_PAYMENTS.formatAmount(getDefaultTotal(), 'AED') +
      '</span></div>' +
      '<div class="shop-order-review-row">' +
      '<span class="shop-order-review-label">M-Pesa equivalent</span>' +
      '<span class="shop-order-review-value">' +
      TICKET_PAYMENTS.formatAmount(TICKET_PAYMENTS.priceMpesaKsh * state.quantity, 'KSH') +
      '</span></div>' +
      '<div class="shop-order-review-row">' +
      '<span class="shop-order-review-label">Checkout amount</span>' +
      '<span class="shop-order-review-value">' +
      TICKET_PAYMENTS.formatAmount(total.amount, total.currency) +
      ' <span style="font-size:0.85em;opacity:0.75;">(based on payment method)</span></span></div>';
  }

  function renderConfirmation() {
    if (!state.order) return;
    var o = state.order;
    var container = $('ticket-confirmation-content');
    if (!container) return;

    var isStripe = o.paymentMethod === 'stripe';
    var lead = isStripe
      ? 'Your ticket details have been sent via WhatsApp. Our team will verify your Stripe payment and confirm your ticket shortly.'
      : 'Your payment proof has been sent via WhatsApp. Our team will verify and confirm your ticket shortly.';

    container.innerHTML =
      '<div class="shop-confirmation">' +
      '<div class="shop-confirmation-icon" aria-hidden="true">✓</div>' +
      '<h3>Thank You</h3>' +
      '<p>' +
      lead +
      '</p>' +
      '<div class="shop-confirmation-summary">' +
      '<div><strong>Order Number</strong><span>' +
      o.orderId +
      '</span></div>' +
      '<div><strong>Customer</strong><span>' +
      o.customerName +
      '</span></div>' +
      '<div><strong>Event</strong><span>' +
      o.eventName +
      '</span></div>' +
      '<div><strong>Tickets</strong><span>' +
      o.quantity +
      '</span></div>' +
      '<div><strong>Payment</strong><span>' +
      getPaymentMethodLabel(o.paymentMethod) +
      '</span></div>' +
      '<div><strong>Total</strong><span>' +
      TICKET_PAYMENTS.formatAmount(o.total, o.currency) +
      '</span></div>' +
      '</div>' +
      '<p class="shop-confirmation-notice">Your ticket with QR verification will be sent to <strong>' +
      o.email +
      '</strong> once payment is verified.</p>' +
      '<div class="shop-confirmation-actions">' +
      (isStripe
        ? '<a href="' +
          TICKET_PAYMENTS.stripeUrl +
          '" class="btn btn-primary" target="_blank" rel="noopener noreferrer">Open Stripe Again</a>'
        : '') +
      '<a href="#ticket-card" class="btn btn-secondary" id="ticket-continue-browsing">Back to Tickets</a>' +
      '<a href="shop.html" class="btn btn-primary ticket-buy-merch-btn">Buy Merch</a>' +
      '</div>' +
      '</div>';

    var contBtn = $('ticket-continue-browsing');
    if (contBtn) {
      contBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeCheckoutModal();
        var card = document.getElementById('ticket-card');
        if (card) card.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  function validateStep1() {
    var name = $('ticket-customer-name').value.trim();
    var email = $('ticket-customer-email').value.trim();
    var phone = $('ticket-customer-phone').value.trim();
    var err = $('ticket-form-error');

    if (!name || !email || !phone) {
      if (err) err.textContent = 'Please complete all fields.';
      return null;
    }
    if (!$('ticket-customer-email').checkValidity()) {
      if (err) err.textContent = 'Please enter a valid email address.';
      return null;
    }
    if (err) err.textContent = '';
    return { name: name, email: email, phone: phone };
  }

  function buildOrderPayload() {
    if (!state.customer || !window.TICKET_PAYMENTS) return null;
    var total = TICKET_PAYMENTS.getOrderTotal(state.paymentMethod, state.quantity);
    return {
      orderId: generateOrderId(),
      customerName: state.customer.name,
      email: state.customer.email,
      phone: state.customer.phone,
      eventName: TICKET_PAYMENTS.eventName,
      quantity: state.quantity,
      total: total.amount,
      currency: total.currency
    };
  }

  function finalizeOrder(customer, paymentMethod, orderId) {
    if (!window.TICKET_PAYMENTS) return;
    var total = TICKET_PAYMENTS.getOrderTotal(paymentMethod, state.quantity);

    state.order = {
      orderId: orderId || generateOrderId(),
      customerName: customer.name,
      email: customer.email,
      phone: customer.phone,
      eventName: TICKET_PAYMENTS.eventName,
      quantity: state.quantity,
      total: total.amount,
      currency: total.currency,
      paymentMethod: paymentMethod,
      createdAt: new Date().toISOString()
    };

    console.info('[GRIGA Tickets] Order submitted:', state.order);

    state.checkoutStep = 4;
    renderCheckoutStep();
  }

  function validateCheckoutReady() {
    if (!state.paymentMethod) {
      showToast('Please select a payment method.');
      return false;
    }
    if (!state.customer) {
      showToast('Please complete your customer details.');
      state.checkoutStep = 1;
      renderCheckoutStep();
      return false;
    }
    return true;
  }

  function openStripeCheckout() {
    if (!validateCheckoutReady()) return;
    if (window.TICKET_PAYMENTS && TICKET_PAYMENTS.stripeUrl) {
      window.open(TICKET_PAYMENTS.stripeUrl, '_blank', 'noopener,noreferrer');
      showToast('Complete payment on Stripe, then send proof via WhatsApp.');
    }
  }

  function sendPaymentProofViaWhatsApp() {
    if (!validateCheckoutReady()) return;
    if (!window.TICKET_PAYMENTS) {
      showToast('Payment configuration unavailable.');
      return;
    }

    var orderPayload = buildOrderPayload();
    if (!orderPayload) return;

    var message = TICKET_PAYMENTS.buildWhatsAppMessage(state.paymentMethod, orderPayload);
    var url = 'https://wa.me/' + TICKET_PAYMENTS.whatsappNumber + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank', 'noopener,noreferrer');
    finalizeOrder(state.customer, state.paymentMethod, orderPayload.orderId);
  }

  function handleCheckoutNext() {
    if (state.checkoutStep === 1) {
      var customer = validateStep1();
      if (!customer) return;
      state.customer = customer;
      state.checkoutStep = 2;
      renderCheckoutStep();
      return;
    }

    if (state.checkoutStep === 2) {
      state.checkoutStep = 3;
      renderCheckoutStep();
      return;
    }

    if (state.checkoutStep === 3) {
      sendPaymentProofViaWhatsApp();
    }
  }

  function handleCheckoutBack() {
    if (state.checkoutStep > 1 && state.checkoutStep < 4) {
      state.checkoutStep -= 1;
      renderCheckoutStep();
    }
  }

  function changeQuantity(delta) {
    state.quantity = Math.min(10, Math.max(1, state.quantity + delta));
    syncQuantityUI();
    if (state.checkoutStep === 2) renderOrderReview();
    if (state.checkoutStep === 3) renderPaymentPanel();
  }

  function bindPaymentMethodInputs() {
    document.querySelectorAll('#ticket-checkout .shop-payment-card input').forEach(function (input) {
      input.addEventListener('change', function () {
        state.paymentMethod = input.value;
        document.querySelectorAll('#ticket-checkout .shop-payment-card').forEach(function (card) {
          card.classList.toggle('is-selected', card.contains(input));
        });
        if (state.checkoutStep === 3) {
          renderPaymentPanel();
          renderCheckoutStep();
        }
      });
    });
  }

  function scrollToTicketCard(behavior) {
    var card = document.getElementById('ticket-card');
    if (!card) return;

    var header = document.getElementById('site-header');
    var offset = header ? header.offsetHeight + 16 : 96;
    var top = card.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: behavior || 'smooth'
    });
  }

  function scrollToTicketCardOnLoad() {
    var hash = window.location.hash;
    if (hash && hash !== '#ticket-card') return;

    window.requestAnimationFrame(function () {
      scrollToTicketCard('smooth');
    });
  }

  function initTicketCardBorderLight() {
    var card = document.querySelector('.ticket-card');
    if (!card) return;

    var svg = card.querySelector('.ticket-card-border');
    var motionPath = document.getElementById('ticket-border-motion-path');
    if (!svg || !motionPath) return;

    function getInset() {
      return window.matchMedia('(max-width: 768px)').matches ? 8 : 12;
    }

    function getRadius() {
      return window.matchMedia('(max-width: 768px)').matches ? 14 : 22;
    }

    function updatePath() {
      var inset = getInset();
      var radius = getRadius();
      var w = card.clientWidth;
      var h = card.clientHeight;
      var x = inset;
      var y = inset;
      var iw = w - inset * 2;
      var ih = h - inset * 2;
      var r = Math.min(radius, iw / 2, ih / 2);

      var d =
        'M ' +
        (x + r) +
        ' ' +
        y +
        ' H ' +
        (x + iw - r) +
        ' A ' +
        r +
        ' ' +
        r +
        ' 0 0 1 ' +
        (x + iw) +
        ' ' +
        (y + r) +
        ' V ' +
        (y + ih - r) +
        ' A ' +
        r +
        ' ' +
        r +
        ' 0 0 1 ' +
        (x + iw - r) +
        ' ' +
        (y + ih) +
        ' H ' +
        (x + r) +
        ' A ' +
        r +
        ' ' +
        r +
        ' 0 0 1 ' +
        x +
        ' ' +
        (y + ih - r) +
        ' V ' +
        (y + r) +
        ' A ' +
        r +
        ' ' +
        r +
        ' 0 0 1 ' +
        (x + r) +
        ' ' +
        y +
        ' Z';

      motionPath.setAttribute('d', d);
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    }

    updatePath();
    window.requestAnimationFrame(updatePath);
    window.setTimeout(updatePath, 150);

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(updatePath).observe(card);
    } else {
      window.addEventListener('resize', updatePath);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var light = svg.querySelector('.ticket-card-border-light');
      if (light) light.style.display = 'none';
    }
  }

  function init() {
    if (typeof AOS !== 'undefined') {
      AOS.init({ duration: 800, once: true, offset: 80 });
    }

    initTicketCardBorderLight();
    scrollToTicketCardOnLoad();

    syncQuantityUI();

    var qtyMinus = $('ticket-qty-minus');
    var qtyPlus = $('ticket-qty-plus');
    if (qtyMinus) qtyMinus.addEventListener('click', function () { changeQuantity(-1); });
    if (qtyPlus) qtyPlus.addEventListener('click', function () { changeQuantity(1); });

    document.querySelectorAll('[data-ticket-checkout-open]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openCheckoutModal();
      });
    });

    if ($('ticket-checkout-close')) {
      $('ticket-checkout-close').addEventListener('click', closeCheckoutModal);
    }
    if ($('ticket-checkout-backdrop')) {
      $('ticket-checkout-backdrop').addEventListener('click', closeCheckoutModal);
    }
    if ($('ticket-checkout-next')) {
      $('ticket-checkout-next').addEventListener('click', handleCheckoutNext);
    }
    if ($('ticket-checkout-back')) {
      $('ticket-checkout-back').addEventListener('click', handleCheckoutBack);
    }

    bindPaymentMethodInputs();

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var checkout = $('ticket-checkout');
        if (checkout && checkout.classList.contains('is-open')) closeCheckoutModal();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
