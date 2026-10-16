/**
 * Tabby test checkout.
 *
 * The secret key stays on the server. The browser receives the public key
 * only, so the split-into-4 snippets can load.
 *
 *   POST /tabby/session                 create a hosted checkout
 *   GET  /tabby/config                  public snippet settings
 *   GET  /tabby/payments/:id            read status and capture an authorized payment
 *   POST /tabby/payments/:id/refund     admin refund of a captured payment
 *   POST /tabby/webhook                 Tabby notification
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const router = express.Router();

const API_BASE = 'https://api.tabby.ai';
const SECRET_KEY = process.env.TABBY_SECRET_KEY || '';
const PUBLIC_KEY = process.env.TABBY_PUBLIC_KEY || '';
const MERCHANT_CODE = process.env.TABBY_MERCHANT_CODE || '';
const WEBHOOK_SECRET = process.env.TABBY_WEBHOOK_SECRET || '';
const TICKET_PRICE_AED = 150;
const TEST_MODE = SECRET_KEY.startsWith('sk_test_');

const ordersDir = path.join(__dirname, process.env.TICKET_DATA_DIR || 'data');
const ordersFile = path.join(ordersDir, 'tabby-orders.json');

function isConfigured() {
  return Boolean(SECRET_KEY && MERCHANT_CODE);
}

function loadOrders() {
  try {
    if (!fs.existsSync(ordersFile)) return {};
    return JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '{}');
  } catch (err) {
    console.error('[tabby] Could not read the order file:', err.message);
    return {};
  }
}

const orders = loadOrders();

function persistOrders() {
  try {
    if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir, { recursive: true });
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('[tabby] Could not save the order file:', err.message);
  }
}

function authHeaders() {
  return {
    Authorization: 'Bearer ' + SECRET_KEY,
    'Content-Type': 'application/json'
  };
}

function money(amount) {
  return Number(amount).toFixed(2);
}

function isLocalHostname(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
  if (!match) return false;
  const block = Number(match[1]);
  return block >= 16 && block <= 31;
}

function allowedOrigin(origin) {
  if (!origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch (err) {
    return false;
  }
  if (TEST_MODE && isLocalHostname(url.hostname)) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }
  const allowed = (process.env.MPESA_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

const allowedOrigins = (process.env.MPESA_ALLOWED_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

router.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigin(origin) || allowedOrigins.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

function rejectionMessage(reason) {
  if (reason === 'order_amount_too_low') {
    return 'The purchase amount is below the minimum amount required to use Tabby, try adding more items or use another payment method.';
  }
  if (reason === 'order_amount_too_high') {
    return 'This purchase is above your current spending limit with Tabby, try a smaller cart or use another payment method.';
  }
  return 'Sorry, Tabby is unable to approve this purchase. Please use an alternative payment method for your order.';
}

function rejectionReason(data) {
  return (
    data &&
    data.configuration &&
    data.configuration.products &&
    data.configuration.products.installments &&
    data.configuration.products.installments.rejection_reason
  );
}

async function tabbyRequest(path, options) {
  const response = await fetch(API_BASE + path, options);
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { message: 'Tabby returned an unreadable response.' };
    }
  }
  return { response, data };
}

function cleanItems(items, source, quantity) {
  if (source === 'tickets') {
    const count = Math.min(10, Math.max(1, Number(quantity) || 1));
    return {
      amount: money(TICKET_PRICE_AED * count),
      items: [
        {
          title: "Where There's Smoke Edition 8 ticket",
          quantity: count,
          unit_price: money(TICKET_PRICE_AED),
          category: 'Events'
        }
      ],
      quantity: count
    };
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    return null;
  }

  let total = 0;
  const cleaned = [];
  for (const item of items) {
    const qty = Math.min(20, Math.max(1, Number(item.quantity) || 0));
    const unit = Number(item.unitPrice);
    const title = String(item.title || '').trim().slice(0, 120);
    if (!title || !Number.isFinite(unit) || unit <= 0 || unit > 20000) return null;
    total += unit * qty;
    cleaned.push({
      title: title,
      quantity: qty,
      unit_price: money(unit),
      category: 'Merchandise'
    });
  }
  if (total <= 0 || total > 50000) return null;
  return { amount: money(total), items: cleaned, quantity: cleaned.length };
}

router.get('/config', (req, res) => {
  const publicKey = PUBLIC_KEY.startsWith('pk_') ? PUBLIC_KEY : '';
  res.json({
    enabled: isConfigured(),
    testMode: TEST_MODE,
    currency: 'AED',
    publicKey: publicKey,
    merchantCode: publicKey ? MERCHANT_CODE : ''
  });
});

router.post('/eligibility', async (req, res) => {
  if (!isConfigured()) {
    return res.json({ eligible: true });
  }

  const body = req.body || {};
  const email = String(body.email || '').trim().slice(0, 120);
  const phone = String(body.phone || '').trim().slice(0, 20);
  const origin = String(body.origin || '').replace(/\/$/, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, '').length < 8) {
    return res.json({ eligible: true });
  }
  if (!allowedOrigin(origin)) {
    return res.status(400).json({ message: 'This site address is not allowed to start Tabby.' });
  }

  const order = cleanItems(body.items, body.source, body.quantity);
  if (!order) {
    return res.json({ eligible: true });
  }

  try {
    const { response, data } = await tabbyRequest('/api/v2/checkout', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        payment: {
          amount: order.amount,
          currency: 'AED',
          buyer: { email: email, phone: phone }
        },
        merchant_code: MERCHANT_CODE
      })
    });

    if (!response.ok) {
      return res.json({ eligible: true });
    }
    if (String(data.status || '').toLowerCase() === 'rejected') {
      return res.json({
        eligible: false,
        message: rejectionMessage(rejectionReason(data))
      });
    }
    return res.json({ eligible: true });
  } catch (err) {
    return res.json({ eligible: true });
  }
});

router.post('/session', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Tabby is not configured on the server yet.' });
  }

  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().slice(0, 120);
  const phone = String(body.phone || '').trim().slice(0, 20);
  const page = body.page === 'shop.html' ? 'shop.html' : 'tickets.html';
  const origin = String(body.origin || '').replace(/\/$/, '');

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ message: 'Enter a name, a valid email, and a phone number.' });
  }
  if (!allowedOrigin(origin)) {
    return res.status(400).json({ message: 'This site address is not allowed to start Tabby.' });
  }

  const order = cleanItems(body.items, body.source, body.quantity);
  if (!order) {
    return res.status(400).json({ message: 'This order cannot be sent to Tabby.' });
  }
  if (body.currency && String(body.currency).toUpperCase() !== 'AED') {
    return res.status(400).json({ message: 'Tabby checkout accepts AED only.' });
  }

  const referenceId = 'GRIGA-' + Date.now().toString(36).toUpperCase();

  try {
    const { response, data } = await tabbyRequest('/api/v2/checkout', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        payment: {
          amount: order.amount,
          currency: 'AED',
          buyer: { name: name, email: email, phone: phone },
          shipping_address: {
            city: 'Fujairah',
            address: 'Isfini Street, MOUNTAIN RESORT BY ESCAPE TIME',
            zip: '00000'
          },
          order: {
            reference_id: referenceId,
            items: order.items
          }
        },
        lang: 'en',
        merchant_code: MERCHANT_CODE,
        merchant_urls: {
          success: origin + '/tabby-result.html?result=success&return=' + (page === 'shop.html' ? 'shop' : 'tickets'),
          cancel: origin + '/tabby-result.html?result=cancel&return=' + (page === 'shop.html' ? 'shop' : 'tickets'),
          failure: origin + '/tabby-result.html?result=failure&return=' + (page === 'shop.html' ? 'shop' : 'tickets')
        }
      })
    });

    if (!response.ok) {
      console.error('[tabby] Session was refused. Status:', response.status);
      return res.status(502).json({ message: 'Tabby did not start the checkout. Try again.' });
    }

    const status = String(data.status || '').toLowerCase();
    const webUrl =
      data.configuration &&
      data.configuration.available_products &&
      data.configuration.available_products.installments &&
      data.configuration.available_products.installments[0] &&
      data.configuration.available_products.installments[0].web_url;
    const paymentId = data.payment && data.payment.id;

    if (status !== 'created' || !webUrl || !paymentId) {
      return res.status(200).json({
        status: 'rejected',
        message: rejectionMessage(rejectionReason(data))
      });
    }

    orders[paymentId] = {
      paymentId: paymentId,
      referenceId: referenceId,
      amount: order.amount,
      currency: 'AED',
      source: body.source === 'shop' ? 'shop' : 'tickets',
      page: page,
      name: name,
      email: email,
      status: 'created',
      testMode: TEST_MODE,
      createdAt: new Date().toISOString()
    };
    persistOrders();

    return res.json({
      status: 'created',
      paymentId: paymentId,
      webUrl: webUrl,
      testMode: TEST_MODE
    });
  } catch (err) {
    console.error('[tabby] Session request failed:', err.message);
    return res.status(502).json({ message: 'Could not reach Tabby. Try again.' });
  }
});

async function retrievePayment(paymentId) {
  return tabbyRequest('/api/v2/payments/' + encodeURIComponent(paymentId), {
    headers: { Authorization: 'Bearer ' + SECRET_KEY }
  });
}

const OUR_REFERENCE = /^GRIGA-[A-Z0-9]{4,20}$/;

/**
 * Rebuild an order record from Tabby's own payment data when the local
 * order file no longer has it, for example after the server restarted.
 * Only payments this website created are accepted: the order reference
 * must be ours, the currency AED, and the amount a real number.
 */
function recoverOrder(paymentId, payment) {
  if (!payment || !payment.order) return null;
  const referenceId = String(payment.order.reference_id || '');
  if (!OUR_REFERENCE.test(referenceId)) return null;
  if (String(payment.currency || '').toUpperCase() !== 'AED') return null;
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (typeof payment.is_test === 'boolean' && payment.is_test !== TEST_MODE) return null;

  const order = {
    paymentId: paymentId,
    referenceId: referenceId,
    amount: money(amount),
    currency: 'AED',
    status: String(payment.status || 'created').toUpperCase(),
    testMode: TEST_MODE,
    recovered: true,
    createdAt: payment.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  orders[paymentId] = order;
  persistOrders();
  console.log('[tabby] Recovered order ' + referenceId + ' from Tabby.');
  return order;
}

/**
 * Fetch the payment from Tabby and find the matching order, recovering it
 * when the local list does not have it.
 */
async function lookupOrder(paymentId) {
  const lookup = await retrievePayment(paymentId);
  const payment = lookup.data || {};
  let order = orders[paymentId] || null;
  if (!order && lookup.response.ok) {
    order = recoverOrder(paymentId, payment);
  }
  return { lookup: lookup, payment: payment, order: order };
}

async function capturePayment(order, payment) {
  const status = String(payment.status || '').toUpperCase();
  if (status === 'CLOSED') return { status: 'CLOSED', captured: true };
  if (status !== 'AUTHORIZED') return { status: status || 'UNKNOWN', captured: false };
  if (String(payment.currency || '').toUpperCase() !== 'AED') {
    return { status: status, captured: false, message: 'Currency did not match this order.' };
  }
  if (Number(payment.amount) !== Number(order.amount)) {
    return { status: status, captured: false, message: 'Amount did not match this order.' };
  }

  const captured = await postCapture(order, payment.id);
  if (captured && captured.response && captured.response.ok) {
    return { status: 'CLOSED', captured: true };
  }

  const again = await retrievePayment(payment.id);
  const againStatus = String((again.data && again.data.status) || '').toUpperCase();
  if (again.response.ok && againStatus === 'CLOSED') {
    return { status: 'CLOSED', captured: true };
  }
  if (again.response.ok && againStatus === 'AUTHORIZED') {
    const retry = await postCapture(order, payment.id);
    if (retry && retry.response && retry.response.ok) {
      return { status: 'CLOSED', captured: true };
    }
    const afterRetry = await retrievePayment(payment.id);
    const afterStatus = String((afterRetry.data && afterRetry.data.status) || '').toUpperCase();
    if (afterRetry.response.ok && afterStatus === 'CLOSED') {
      return { status: 'CLOSED', captured: true };
    }
  }
  console.error('[tabby] Capture was refused. Status:', captured && captured.response ? captured.response.status : 'timeout');
  return { status: status, captured: false, message: 'Tabby authorized the payment, but capture did not finish.' };
}

async function postCapture(order, paymentId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await tabbyRequest('/api/v2/payments/' + encodeURIComponent(paymentId) + '/captures', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        amount: order.amount,
        reference_id: order.referenceId
      }),
      signal: controller.signal
    });
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

router.get('/payments/:paymentId', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Tabby is not configured on the server yet.' });
  }

  const paymentId = String(req.params.paymentId || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(paymentId)) {
    return res.status(400).json({ message: 'Unknown payment.' });
  }

  try {
    const { lookup, payment, order } = await lookupOrder(paymentId);
    if (!lookup.response.ok) {
      if (lookup.response.status === 404) {
        return res.status(404).json({ message: 'Unknown payment.' });
      }
      console.error('[tabby] Payment lookup failed. Status:', lookup.response.status);
      return res.status(502).json({ message: 'Could not check this Tabby payment.' });
    }
    if (!order) {
      return res.status(404).json({ message: 'This payment was not started on this website.' });
    }

    const result = await capturePayment(order, payment);
    order.status = result.status;
    order.updatedAt = new Date().toISOString();
    persistOrders();

    return res.json({
      status: result.status,
      captured: result.captured,
      testMode: Boolean(payment.is_test) || TEST_MODE,
      message: result.message || null,
      referenceId: order.referenceId
    });
  } catch (err) {
    console.error('[tabby] Payment check failed:', err.message);
    return res.status(502).json({ message: 'Could not check this Tabby payment.' });
  }
});

function fils(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function byCreatedAt(list) {
  return (Array.isArray(list) ? list.slice() : []).sort((a, b) =>
    String((a && a.created_at) || '').localeCompare(String((b && b.created_at) || ''))
  );
}

function refundedFils(payment) {
  return byCreatedAt(payment && payment.refunds).reduce((sum, item) => sum + fils(item && item.amount), 0);
}

function capturedFils(payment) {
  if (!payment) return 0;
  if (Array.isArray(payment.captures)) {
    return byCreatedAt(payment.captures).reduce((sum, item) => sum + fils(item && item.amount), 0);
  }
  return fils(payment.amount);
}

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Admin authentication is not configured.' });
  }
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }
  try {
    const payload = jwt.verify(header.slice(7).trim(), secret);
    req.adminEmail = payload.sub;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

router.post('/payments/:paymentId/refund', requireAdmin, async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Tabby is not configured on the server yet.' });
  }

  const paymentId = String(req.params.paymentId || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(paymentId)) {
    return res.status(400).json({ message: 'Unknown payment.' });
  }

  try {
    const { lookup, payment, order } = await lookupOrder(paymentId);
    if (!lookup.response.ok) {
      console.error('[tabby] Refund lookup failed. Status:', lookup.response.status);
      return res.status(502).json({ message: 'Could not check this Tabby payment.' });
    }
    if (!order) {
      return res.status(404).json({ message: 'This payment was not started on this website.' });
    }

    const status = String(payment.status || '').toUpperCase();
    if (status !== 'CLOSED') {
      return res.status(409).json({ message: 'Only a captured Tabby payment can be refunded.' });
    }
    if (String(payment.currency || '').toUpperCase() !== 'AED') {
      return res.status(409).json({ message: 'Currency did not match this order.' });
    }
    if (capturedFils(payment) !== fils(order.amount)) {
      return res.status(409).json({ message: 'Amount did not match this order.' });
    }

    const already = Math.max(refundedFils(payment), fils(order.refundedAmount));
    const captured = capturedFils(payment);
    const remaining = captured - already;
    if (remaining <= 0) {
      return res.status(409).json({ message: 'This payment is already fully refunded.' });
    }

    const requested = req.body && req.body.amount;
    let refundFils = remaining;
    if (requested !== undefined && requested !== null && requested !== '') {
      refundFils = fils(requested);
      if (refundFils <= 0 || refundFils > remaining || Math.abs(Number(requested) * 100 - refundFils) > 0.001) {
        return res.status(400).json({ message: 'Enter a refund amount that is left on this payment.' });
      }
    }

    const referenceId = 'GRIGA-R' + Date.now().toString(36).toUpperCase();
    const reason = String((req.body && req.body.reason) || 'Refund requested by the merchant').trim().slice(0, 200);
    const refunded = await tabbyRequest('/api/v2/payments/' + encodeURIComponent(paymentId) + '/refunds', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        amount: money(refundFils / 100),
        reference_id: referenceId,
        reason: reason
      })
    });

    if (!refunded.response.ok) {
      console.error('[tabby] Refund was refused. Status:', refunded.response.status);
      return res.status(502).json({ message: 'Tabby did not complete this refund.' });
    }

    const nextStatus = String((refunded.data && refunded.data.status) || status).toUpperCase();
    const nextRefunded = Math.max(refundedFils(refunded.data), already + refundFils);
    order.status = nextStatus || status;
    order.refundedAmount = money(nextRefunded / 100);
    order.refunds = Array.isArray(order.refunds) ? order.refunds : [];
    order.refunds.push({
      referenceId: referenceId,
      amount: money(refundFils / 100),
      reason: reason,
      createdAt: new Date().toISOString()
    });
    order.updatedAt = new Date().toISOString();
    persistOrders();

    return res.json({
      status: order.status,
      referenceId: referenceId,
      refundedAmount: order.refundedAmount,
      remainingAmount: money((captured - nextRefunded) / 100)
    });
  } catch (err) {
    console.error('[tabby] Refund failed:', err.message);
    return res.status(502).json({ message: 'Could not refund this Tabby payment.' });
  }
});

router.post('/payments/:paymentId/close', requireAdmin, async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Tabby is not configured on the server yet.' });
  }

  const paymentId = String(req.params.paymentId || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(paymentId)) {
    return res.status(400).json({ message: 'Unknown payment.' });
  }
  try {
    const { lookup, payment, order } = await lookupOrder(paymentId);
    if (!lookup.response.ok) {
      console.error('[tabby] Close lookup failed. Status:', lookup.response.status);
      return res.status(502).json({ message: 'Could not check this Tabby payment.' });
    }
    if (!order) {
      return res.status(404).json({ message: 'This payment was not started on this website.' });
    }
    const status = String(payment.status || '').toUpperCase();
    if (status === 'CLOSED') {
      order.status = 'CLOSED';
      order.updatedAt = new Date().toISOString();
      persistOrders();
      return res.json({ status: 'CLOSED', closed: true });
    }
    if (status !== 'AUTHORIZED') {
      return res.status(409).json({ message: 'Only an authorized Tabby payment can be closed without capture.' });
    }

    const closed = await tabbyRequest('/api/v2/payments/' + encodeURIComponent(paymentId) + '/close', {
      method: 'POST',
      headers: authHeaders()
    });
    if (!closed.response.ok) {
      console.error('[tabby] Close was refused. Status:', closed.response.status);
      return res.status(502).json({ message: 'Tabby did not close this payment.' });
    }
    order.status = 'CLOSED';
    order.closedWithoutCapture = true;
    order.updatedAt = new Date().toISOString();
    persistOrders();
    return res.json({ status: 'CLOSED', closed: true });
  } catch (err) {
    console.error('[tabby] Close failed:', err.message);
    return res.status(502).json({ message: 'Could not close this Tabby payment.' });
  }
});

router.post('/webhook', async (req, res) => {
  if (WEBHOOK_SECRET && req.get('x-auth-key') !== WEBHOOK_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  res.status(200).json({ received: true });

  const paymentId = String((req.body && req.body.id) || '');
  if (!isConfigured() || !/^[A-Za-z0-9_-]{8,80}$/.test(paymentId)) return;

  try {
    const { lookup, payment, order } = await lookupOrder(paymentId);
    if (!lookup.response.ok || !order) return;
    const result = await capturePayment(order, payment);
    order.status = result.status;
    order.updatedAt = new Date().toISOString();
    persistOrders();
  } catch (err) {
    console.error('[tabby] Webhook handling failed:', err.message);
  }
});

module.exports = router;
