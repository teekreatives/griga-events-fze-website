/**
 * Tabby test checkout. The secret key never comes to the browser.
 */
(function (global) {
  'use strict';

  function isLocalHost(host) {
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    var match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
    if (!match) return false;
    var block = Number(match[1]);
    return block >= 16 && block <= 31;
  }

  function apiOrigin() {
    if (global.GRIGA_TABBY_API_ORIGIN) {
      return String(global.GRIGA_TABBY_API_ORIGIN).replace(/\/$/, '');
    }
    var host = global.location && global.location.hostname;
    if (isLocalHost(host)) return global.location.protocol + '//' + host + ':8090';
    if (global.GRIGA_MPESA_API_ORIGIN) {
      return String(global.GRIGA_MPESA_API_ORIGIN).replace(/\/$/, '');
    }
    return '';
  }

  function escapeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (err) {
      return {};
    }
  }

  var configPromise = null;
  var scriptPromises = {};

  function money(amount) {
    var value = Number(amount);
    if (!isFinite(value) || value <= 0) return '';
    return value.toFixed(2);
  }

  function loadConfig() {
    if (!configPromise) {
      configPromise = fetch(apiOrigin() + '/tabby/config')
        .then(readJson)
        .catch(function () {
          configPromise = null;
          return {};
        });
    }
    return configPromise;
  }

  function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        delete scriptPromises[src];
        reject(new Error('script'));
      };
      document.head.appendChild(script);
    });
    return scriptPromises[src];
  }

  function mountPromo(options) {
    var el = options && options.selector ? document.querySelector(options.selector) : null;
    if (!el) return;
    var price = money(options.price);
    var token = String(Date.now()) + Math.random();
    el.setAttribute('data-promo-token', token);
    if (!price) {
      el.innerHTML = '';
      el.hidden = true;
      return;
    }
    el.hidden = true;
    loadConfig()
      .then(function (config) {
        if (el.getAttribute('data-promo-token') !== token) return;
        if (!config.publicKey || !config.merchantCode || !config.publicKey.startsWith('pk_')) return;
        return loadScript('https://checkout.tabby.ai/tabby-promo.js').then(function () {
          if (el.getAttribute('data-promo-token') !== token) return;
          if (typeof global.TabbyPromo !== 'function') return;
          el.innerHTML = '';
          if (options.note !== false) {
            var note = document.createElement('p');
            note.className = 'griga-tabby-context';
            note.textContent =
              options.note || 'The price above does not change. Tabby can split it into 4 payments.';
            el.appendChild(note);
          }
          var host = document.createElement('div');
          host.className = 'griga-tabby-promo-host';
          host.id = 'griga-tabby-promo-host-' + Math.random().toString(36).slice(2, 10);
          el.appendChild(host);
          el.hidden = false;
          new global.TabbyPromo({
            selector: '#' + host.id,
            currency: 'AED',
            price: price,
            lang: 'en',
            source: options.source === 'cart' ? 'cart' : 'product',
            shouldInheritBg: Boolean(options.inheritBackground),
            publicKey: config.publicKey,
            merchantCode: config.merchantCode
          });
        });
      })
      .catch(function () {});
  }

  function mountCard(container, price) {
    if (!container) return;
    var amount = money(price);
    var token = String(Date.now()) + Math.random();
    container.setAttribute('data-card-token', token);
    if (!amount) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;
    loadConfig()
      .then(function (config) {
        if (container.getAttribute('data-card-token') !== token) return;
        if (!config.publicKey || !config.merchantCode || !config.publicKey.startsWith('pk_')) return;
        return loadScript('https://checkout.tabby.ai/tabby-card.js').then(function () {
          if (container.getAttribute('data-card-token') !== token) return;
          if (typeof global.TabbyCard !== 'function') return;
          container.innerHTML = '';
          var host = document.createElement('div');
          host.id = 'griga-tabby-card-host-' + Math.random().toString(36).slice(2, 10);
          container.appendChild(host);
          new global.TabbyCard({
            selector: '#' + host.id,
            currency: 'AED',
            price: amount,
            lang: 'en',
            shouldInheritBg: false,
            publicKey: config.publicKey,
            merchantCode: config.merchantCode
          });
        });
      })
      .catch(function () {});
  }

  function mount(options) {
    var slot = options.slot;
    if (!slot) return;

    slot.innerHTML =
      '<article class="payment-option payment-option--tabby shop-checkout-payment">' +
      '<div class="payment-option__heading">' +
      '<img class="payment-option__logo" src="/assets/media/logos/Tabby.png" alt="Tabby logo" />' +
      '<h3>Pay later with Tabby</h3></div>' +
      '<p id="' +
      options.statusId +
      '-lead">Pay in 4 with Tabby. You leave this page, finish on Tabby, then come back here.</p>' +
      '<dl class="payment-details"><div><dt>Order total</dt><dd>' +
      escapeText(options.amountLabel) +
      '</dd></div></dl>' +
      '<div class="griga-tabby-card" id="' +
      options.statusId +
      '-card"></div>' +
      '<label class="tabby-field">Email<input type="email" id="' +
      options.emailId +
      '" autocomplete="email" value="' +
      escapeText(options.defaultEmail || '') +
      '" /></label>' +
      '<label class="tabby-field">Phone<input type="tel" id="' +
      options.phoneId +
      '" autocomplete="tel" value="+971500000001" /></label>' +
      '<div class="payment-actions">' +
      '<button type="button" class="btn btn-primary" id="' +
      options.buttonId +
      '">Continue to Tabby</button>' +
      '</div>' +
      '<p class="shop-payment-panel-note" id="' +
      options.noteId +
      '">This test does not send a ticket. No real money is taken.</p>' +
      '<p class="tabby-status" id="' +
      options.statusId +
      '" role="status" aria-live="polite"></p>' +
      '</article>';

    mountCard(document.getElementById(options.statusId + '-card'), options.price);

    var lead = document.getElementById(options.statusId + '-lead');
    var note = document.getElementById(options.noteId);
    loadConfig()
      .then(function (config) {
        var emailInput = document.getElementById(options.emailId);
        if (config.testMode && emailInput && !emailInput.value.trim()) {
          emailInput.value = 'otp.success@tabby.ai';
        }
        if (config.testMode) {
          if (lead) {
            lead.textContent =
              'This is a Tabby test. No real charge. Use the email and phone below, then enter OTP 8888 on the Tabby page.';
          }
          if (note) {
            note.textContent =
              'Success test: otp.success@tabby.ai and +971500000001. OTP is 8888. A ticket is not issued by this test.';
          }
        }
        if (typeof options.onContactChange === 'function') options.onContactChange();
      })
      .catch(function () {});

    var emailInput = document.getElementById(options.emailId);
    var phoneInput = document.getElementById(options.phoneId);
    if (emailInput && typeof options.onContactChange === 'function') {
      emailInput.addEventListener('input', options.onContactChange);
    }
    if (phoneInput && typeof options.onContactChange === 'function') {
      phoneInput.addEventListener('input', options.onContactChange);
    }

    var button = document.getElementById(options.buttonId);
    if (!button) return;
    button.addEventListener('click', function () {
      start(options, button);
    });
  }

  async function start(options, button) {
    var status = document.getElementById(options.statusId);
    var email = document.getElementById(options.emailId);
    var phone = document.getElementById(options.phoneId);
    var order = options.getOrder();
    if (!order) return;

    button.disabled = true;
    if (status) status.textContent = 'Opening Tabby…';

    try {
      var response = await fetch(apiOrigin() + '/tabby/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: order.name,
          email: email ? email.value.trim() : '',
          phone: phone ? phone.value.trim() : '',
          source: order.source,
          page: order.page,
          origin: global.location.origin,
          currency: 'AED',
          quantity: order.quantity,
          items: order.items || []
        })
      });
      var data = await readJson(response);
      if (!response.ok || data.status === 'rejected' || !data.webUrl) {
        if (status) status.textContent = data.message || 'Tabby did not open the checkout.';
        button.disabled = false;
        return;
      }
      global.location.assign(data.webUrl);
    } catch (err) {
      if (status) status.textContent = 'Could not reach the payment server. Is the local backend running?';
      button.disabled = false;
    }
  }

  function consumeReturn(options) {
    var params = new URLSearchParams(global.location.search);
    var result = params.get('tabby');
    if (!result) return;

    var host = document.createElement('div');
    host.className = 'tabby-return';
    host.setAttribute('role', 'status');
    document.body.appendChild(host);

    if (result === 'cancel') {
      host.textContent = 'You aborted the payment. Please retry or choose another payment method.';
      return;
    }
    if (result === 'failure') {
      host.textContent = 'Sorry, Tabby is unable to approve this purchase. Please use an alternative payment method for your order.';
      return;
    }

    var paymentId = params.get('payment_id');
    if (result !== 'success' || !paymentId) {
      host.textContent = 'Tabby sent the browser back without a payment to check.';
      return;
    }

    host.textContent = 'Checking the Tabby test payment…';
    fetch(apiOrigin() + '/tabby/payments/' + encodeURIComponent(paymentId))
      .then(readJson)
      .then(function (data) {
        if (data.captured || data.status === 'CLOSED') {
          host.textContent =
            'Tabby test payment is confirmed' +
            (data.referenceId ? ' (' + data.referenceId + ')' : '') +
            '. No real money was taken, and no ticket was sent.';
          return;
        }
        host.textContent = data.message || 'Tabby has not confirmed this payment yet. Status: ' + (data.status || 'unknown') + '.';
      })
      .catch(function () {
        host.textContent = 'The browser came back from Tabby, but the payment server could not be checked.';
      });

    if (options && typeof options.onChecked === 'function') {
      options.onChecked();
    }
  }

  function renderResult(root) {
    if (!root) return;
    var params = new URLSearchParams(global.location.search);
    var result = params.get('result') || params.get('tabby') || '';
    var paymentId = params.get('payment_id');
    var backHref = params.get('return') === 'shop' ? 'shop.html' : 'tickets.html';
    var backLabel = backHref === 'shop.html' ? 'Back to shop' : 'Back to tickets';

    function show(title, text, kind) {
      root.innerHTML =
        '<article class="tabby-result-card tabby-result-card--' + kind + '">' +
        '<header><img src="/assets/media/logos/Tabby.png" alt="Tabby logo" /></header>' +
        '<div class="tabby-result-body">' +
        '<h1>' + escapeText(title) + '</h1>' +
        '<p>' + escapeText(text) + '</p>' +
        '<a class="btn btn-primary" href="' + backHref + '">' + backLabel + '</a>' +
        '</div></article>';
    }

    if (result === 'cancel') {
      show('Payment cancelled', 'You aborted the payment. Please retry or choose another payment method.', 'cancel');
      return;
    }
    if (result === 'failure') {
      show(
        'Payment not approved',
        'Sorry, Tabby is unable to approve this purchase. Please use an alternative payment method for your order.',
        'failure'
      );
      return;
    }
    if (result !== 'success' || !paymentId) {
      show('Payment not confirmed', 'Tabby sent you back without a payment we can verify.', 'failure');
      return;
    }

    show('Checking your payment', 'Please wait. We are confirming this payment with Tabby.', 'pending');
    fetch(apiOrigin() + '/tabby/payments/' + encodeURIComponent(paymentId))
      .then(readJson)
      .then(function (data) {
        if (data.captured || data.status === 'CLOSED') {
          if (params.get('return') === 'shop') {
            try {
              global.localStorage.removeItem('griga_shop_cart');
            } catch (err) {}
          }
          var text = 'Tabby has approved this payment';
          if (data.referenceId) text += '. Reference ' + data.referenceId;
          text += data.testMode
            ? '. This was a test, so no real money was taken and no ticket was sent.'
            : '. Your payment is confirmed.';
          show('Payment successful', text, 'success');
          return;
        }
        show(
          'Payment not confirmed',
          data.message || 'Tabby has not confirmed this payment yet.',
          'failure'
        );
      })
      .catch(function () {
        show('Payment not confirmed', 'We could not reach the payment server to verify this payment.', 'failure');
      });
  }

  var eligibilityToken = 0;

  function checkEligibility(options) {
    var email = String((options && options.email) || '').trim();
    var phone = String((options && options.phone) || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, '').length < 8) {
      return Promise.resolve({ eligible: true, skipped: true });
    }
    return fetch(apiOrigin() + '/tabby/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        phone: phone,
        source: options.source,
        quantity: options.quantity,
        items: options.items || [],
        origin: global.location.origin
      })
    })
      .then(function (response) {
        return readJson(response).then(function (data) {
          if (!response.ok) return { eligible: true, skipped: true };
          return data;
        });
      })
      .catch(function () {
        return { eligible: true, skipped: true };
      });
  }

  function applyEligibility(options) {
    var card = document.querySelector(options.cardSelector);
    var note = document.querySelector(options.noteSelector);
    if (!card) return;
    var token = ++eligibilityToken;
    checkEligibility(options).then(function (result) {
      if (token !== eligibilityToken) return;
      if (result && result.eligible === false) {
        card.hidden = true;
        var input = card.querySelector('input');
        var wasSelected = input && input.checked;
        if (input) input.checked = false;
        card.classList.remove('is-selected');
        if (note) {
          note.hidden = false;
          note.textContent = result.message || 'Sorry, Tabby is unable to approve this purchase. Please use an alternative payment method for your order.';
        }
        if (wasSelected && typeof options.onHidden === 'function') options.onHidden();
        return;
      }
      card.hidden = false;
      if (note) {
        note.hidden = true;
        note.textContent = '';
      }
    });
  }

  global.GRIGA_TABBY = {
    mount: mount,
    mountPromo: mountPromo,
    applyEligibility: applyEligibility,
    consumeReturn: consumeReturn,
    renderResult: renderResult
  };
})(window);
