/**
 * GRIGA Events FZE – M-Pesa STK Push frontend helper
 *
 * Renders a phone input + "Pay via M-Pesa" button inside the M-Pesa payment
 * panel (tickets and shop checkouts) and drives the STK push flow against the
 * backend (backend/mpesa.js).
 *
 * To enable, set the deployed backend origin BEFORE this script loads:
 *   <script>window.GRIGA_MPESA_API_ORIGIN = 'https://api.grigaeventsfze.com';</script>
 * When the origin is not set, the block is not rendered and buyers use the
 * manual pay + WhatsApp-proof flow as before.
 */
(function (global) {
  var POLL_INTERVAL_MS = 3000;
  var POLL_TIMEOUT_MS = 120000;

  function apiOrigin() {
    var origin = global.GRIGA_MPESA_API_ORIGIN;
    return typeof origin === 'string' && origin ? origin.replace(/\/$/, '') : null;
  }

  function isEnabled() {
    return apiOrigin() !== null;
  }

  function looksLikeKenyanNumber(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.indexOf('0') === 0) digits = '254' + digits.slice(1);
    if (digits.indexOf('7') === 0 || digits.indexOf('1') === 0) digits = '254' + digits;
    return /^254(7|1)\d{8}$/.test(digits);
  }

  /**
   * opts: {
   *   container   – element to render into
   *   idPrefix    – 'ticket' | 'shop' (unique element ids)
   *   amountKsh   – integer amount to charge in KES
   *   amountLabel – display string, e.g. 'KSH 5,500'
   *   orderId     – order reference
   *   source      – 'tickets' | 'shop'
   *   description – short transaction description
   *   lead        – optional intro sentence above the input
   *   prefillPhone – optional phone number to pre-fill (from checkout step 1)
   *   onSuccess(receipt) – called when payment is confirmed
   * }
   */
  function attach(opts) {
    var container = opts.container;
    if (!container || !isEnabled()) return;

    var p = opts.idPrefix;

    var lead =
      opts.lead ||
      'Or pay automatically: enter your M-Pesa number and we will send a payment request to your phone.';

    container.innerHTML =
      '<div class="mpesa-stk">' +
      '<p class="mpesa-stk-lead">' + lead + '</p>' +
      '<div class="mpesa-stk-row">' +
      '<input type="tel" id="' + p + '-mpesa-phone" class="mpesa-stk-input" inputmode="tel" placeholder="e.g. 0712 345 678" autocomplete="tel" />' +
      '<button type="button" class="btn btn-primary mpesa-stk-btn" id="' + p + '-mpesa-pay">Pay ' + opts.amountLabel + ' via M-Pesa</button>' +
      '</div>' +
      '<p class="mpesa-stk-status" id="' + p + '-mpesa-status" role="status" aria-live="polite"></p>' +
      '</div>';

    if (opts.prefillPhone) {
      document.getElementById(p + '-mpesa-phone').value = opts.prefillPhone;
    }

    var phoneInput = document.getElementById(p + '-mpesa-phone');
    var payBtn = document.getElementById(p + '-mpesa-pay');
    var statusEl = document.getElementById(p + '-mpesa-status');
    var polling = null;

    // Re-rendered panel after a completed payment (e.g. quantity tweak): show paid state.
    if (opts.paidReceipt) {
      payBtn.disabled = true;
      payBtn.textContent = 'Paid ✓';
      phoneInput.disabled = true;
      statusEl.textContent = 'Payment received! M-Pesa receipt: ' + opts.paidReceipt;
      statusEl.className = 'mpesa-stk-status mpesa-stk-status--success';
      return;
    }

    function setStatus(text, kind) {
      statusEl.textContent = text || '';
      statusEl.className = 'mpesa-stk-status' + (kind ? ' mpesa-stk-status--' + kind : '');
    }

    function stopPolling() {
      if (polling) {
        clearInterval(polling);
        polling = null;
      }
    }

    function pollStatus(checkoutRequestId) {
      var startedAt = Date.now();
      polling = setInterval(function () {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopPolling();
          payBtn.disabled = false;
          setStatus(
            'We have not received a confirmation yet. Tap Pay to try again, or message us on WhatsApp if the amount was already deducted.',
            'warn'
          );
          return;
        }

        fetch(apiOrigin() + '/mpesa/status/' + encodeURIComponent(checkoutRequestId))
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.status === 'success') {
              stopPolling();
              setStatus(
                'Payment received!' + (data.receipt ? ' M-Pesa receipt: ' + data.receipt : ''),
                'success'
              );
              payBtn.textContent = 'Paid ✓';
              if (typeof opts.onSuccess === 'function') opts.onSuccess(data.receipt || null);
            } else if (data.status === 'failed') {
              stopPolling();
              payBtn.disabled = false;
              setStatus(data.message || 'Payment was not completed. Please try again.', 'error');
            }
            // 'pending' → keep polling
          })
          .catch(function () {
            /* transient network error – keep polling until timeout */
          });
      }, POLL_INTERVAL_MS);
    }

    payBtn.addEventListener('click', function () {
      var phone = phoneInput.value.trim();
      if (!looksLikeKenyanNumber(phone)) {
        setStatus('Enter a valid Safaricom number, e.g. 0712 345 678.', 'error');
        phoneInput.focus();
        return;
      }

      stopPolling();
      payBtn.disabled = true;
      setStatus('Sending payment request to your phone…');

      fetch(apiOrigin() + '/mpesa/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          amount: opts.amountKsh,
          orderId: opts.orderId,
          source: opts.source,
          description: opts.description
        })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            payBtn.disabled = false;
            setStatus(result.data.message || 'Could not start the M-Pesa payment. Try again.', 'error');
            return;
          }
          setStatus('Check your phone and enter your M-Pesa PIN to complete the payment…');
          pollStatus(result.data.checkoutRequestId);
        })
        .catch(function () {
          payBtn.disabled = false;
          setStatus('Could not reach the payment server. Check your connection and try again.', 'error');
        });
    });
  }

  global.GRIGA_MPESA_STK = {
    isEnabled: isEnabled,
    attach: attach
  };
})(typeof window !== 'undefined' ? window : this);
