/**
 * Botim Money hosted PayPage.
 *
 * BOTIM_MODE=uat talks to the test address and uses the test keys.
 * BOTIM_MODE=production talks to the live address and uses the production keys.
 * The default is uat. A production payment charges a real customer.
 *
 *   POST /botim/checkout          create an order and return the pay page
 *   GET  /botim/orders/:orderNo   ask Botim for the result
 *   POST /botim/notify            Botim payment notice; reply SUCCESS
 *   GET  /botim/config            whether the keys for the active mode are present
 *
 * Test keys: BOTIM_PARTNER_ID, BOTIM_PRIVATE_KEY, BOTIM_PUBLIC_KEY
 * Live keys: BOTIM_PROD_PARTNER_ID, BOTIM_PROD_PRIVATE_KEY, BOTIM_PROD_PUBLIC_KEY
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const UAT_BASE = 'https://uat.test2pay.com/sgs/api/acquire2';
const PROD_BASE = 'https://api.payby.com/sgs/api/acquire2';
const TICKET_PRICE_AED = 150;
const API_ORIGIN = 'https://griga-events-fze-website.onrender.com';
const SITE_ORIGIN = 'https://www.grigaeventsfze.com';

const ordersDir = path.join(__dirname, process.env.TICKET_DATA_DIR || 'data');
const ordersFile = path.join(ordersDir, 'botim-orders.json');

function normalizePem(value) {
  let text = String(value || '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }
  return text.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}

function paymentMode() {
  return String(process.env.BOTIM_MODE || 'uat').trim().toLowerCase() === 'production' ? 'production' : 'uat';
}

function accountFrom(mode) {
  const production = mode === 'production';
  return {
    mode: production ? 'production' : 'uat',
    base: production ? PROD_BASE : UAT_BASE,
    partnerId: String(process.env[production ? 'BOTIM_PROD_PARTNER_ID' : 'BOTIM_PARTNER_ID'] || '').trim(),
    privateKey: normalizePem(process.env[production ? 'BOTIM_PROD_PRIVATE_KEY' : 'BOTIM_PRIVATE_KEY'] || ''),
    publicKey: normalizePem(process.env[production ? 'BOTIM_PROD_PUBLIC_KEY' : 'BOTIM_PUBLIC_KEY'] || '')
  };
}

function activeAccount() {
  return accountFrom(paymentMode());
}

function ticketPriceAed() {
  return TICKET_PRICE_AED;
}

function accountReady(account) {
  return Boolean(
    account.partnerId &&
      account.privateKey.includes('BEGIN') &&
      account.privateKey.includes('PRIVATE KEY') &&
      account.publicKey.includes('BEGIN PUBLIC KEY')
  );
}

function loadOrders() {
  try {
    if (!fs.existsSync(ordersFile)) return {};
    return JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '{}');
  } catch (err) {
    console.error('[botim] Could not read the order file:', err.message);
    return {};
  }
}

const orders = loadOrders();

function persistOrders() {
  try {
    if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir, { recursive: true });
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('[botim] Could not save the order file:', err.message);
  }
}

function signBody(body, privateKey) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(body, 'utf8');
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function verifyWithKey(body, signature, publicKey) {
  if (!signature || !publicKey) return false;
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(body, 'utf8');
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  } catch (err) {
    console.error('[botim] Could not check the reply signature:', err.message);
    return false;
  }
}

function verifyNotice(body, signature) {
  const uatKey = accountFrom('uat').publicKey;
  const prodKey = accountFrom('production').publicKey;
  return verifyWithKey(body, signature, uatKey) || verifyWithKey(body, signature, prodKey);
}

function orderNumber() {
  return ('GRIGA' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}

async function botimPost(pathName, bizContent) {
  const account = activeAccount();
  const body = JSON.stringify({
    requestTime: Date.now(),
    bizContent: bizContent
  });
  const response = await fetch(account.base + pathName, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Language': 'en',
      sign: signBody(body, account.privateKey),
      'Partner-Id': account.partnerId
    },
    body: body
  });
  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (err) {
    payload = {};
  }
  const signature = response.headers.get('sign') || response.headers.get('Sign') || '';
  return {
    httpStatus: response.status,
    payload: payload,
    signatureVerified: verifyWithKey(raw, signature, account.publicKey)
  };
}

function headOf(payload) {
  return (payload && payload.head) || {};
}

function paidStatus(status) {
  return status === 'PAID_SUCCESS' || status === 'SETTLED';
}

function customerMessage(status, trusted) {
  if (trusted && paidStatus(status)) return 'Botim payment succeeded.';
  if (trusted && status === 'FAILURE') return 'Botim payment failed.';
  return 'Botim has not confirmed the payment yet.';
}

const QUERY_INTERVAL_MS = 3000;
const CANCEL_NOT_BEFORE_MS = 20000;
const CANCEL_DEADLINE_MS = 120000;
const CANCEL_GAP_MS = 5000;
const PAY_PAGE_WATCH_MS = 10 * 60 * 1000;
const watching = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function remember(merchantOrderNo, patch) {
  if (!orders[merchantOrderNo]) return;
  Object.assign(orders[merchantOrderNo], patch);
  persistOrders();
}

async function tellPerson(merchantOrderNo, reason) {
  const order = orders[merchantOrderNo];
  if (order && order.alert === reason) return;
  remember(merchantOrderNo, { alert: reason, alertedAt: new Date().toISOString() });
  console.error('[botim] A person needs to check order', merchantOrderNo + ':', reason);
  const to = process.env.ADMIN_EMAIL;
  if (!to || !process.env.EMAIL_SMTP_HOST || !process.env.EMAIL_SMTP_USER) {
    console.error('[botim] The alert is in the server log. Mail settings are not configured.');
    return;
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || to,
      to: to,
      subject: 'Botim test order needs a person',
      text: 'Order ' + merchantOrderNo + ' needs a person. ' + reason
    });
  } catch (err) {
    console.error('[botim] Could not email the alert:', err.message);
  }
}

async function noteQueryFailure(merchantOrderNo, order, queryCount) {
  const queryFailures = (order.queryFailures || 0) + 1;
  const queryFailedSince = order.queryFailedSince || new Date().toISOString();
  remember(merchantOrderNo, {
    queryCount: queryCount,
    queryFailures: queryFailures,
    queryFailedSince: queryFailedSince,
    lastQueryAt: new Date().toISOString()
  });
  const failedFor = Date.now() - Date.parse(queryFailedSince);
  if (queryFailures > 3 || failedFor > 10000) {
    await tellPerson(merchantOrderNo, 'Status checks kept failing. A person needs to check this order with Botim.');
  }
}

async function readOrder(merchantOrderNo) {
  const order = orders[merchantOrderNo] || {};
  const queryCount = (order.queryCount || 0) + 1;
  try {
    const result = await botimPost('/getOrder', { merchantOrderNo: merchantOrderNo });
    const remote = (result.payload.body && result.payload.body.acquireOrder) || {};
    const status = remote.status || '';
    if (!result.signatureVerified) {
      console.error('[botim]', merchantOrderNo, 'query', queryCount, 'signature did not match');
      await noteQueryFailure(merchantOrderNo, order, queryCount);
      return 'error';
    }
    remember(merchantOrderNo, {
      status: status,
      orderNo: remote.orderNo || order.orderNo || '',
      queryCount: queryCount,
      queryFailures: 0,
      queryFailedSince: '',
      lastQueryAt: new Date().toISOString()
    });
    console.log('[botim]', merchantOrderNo, 'query', queryCount, status || 'no status');
    if (paidStatus(status)) return 'paid';
    if (status === 'FAILURE') return 'failed';
    return 'open';
  } catch (err) {
    console.error('[botim]', merchantOrderNo, 'query', queryCount, 'failed:', err.message);
    await noteQueryFailure(merchantOrderNo, order, queryCount);
    return 'error';
  }
}

async function cancelOrder(merchantOrderNo) {
  if (!orders[merchantOrderNo]) return 'retry';
  const attempt = (orders[merchantOrderNo].cancelCount || 0) + 1;
  try {
    const result = await botimPost('/cancelOrder', { merchantOrderNo: merchantOrderNo });
    const head = headOf(result.payload);
    const remote = (result.payload.body && result.payload.body.acquireOrder) || {};
    const accepted = String(head.applyStatus || '').toUpperCase() === 'SUCCESS' && String(head.code) === '0';
    remember(merchantOrderNo, {
      cancelCount: attempt,
      lastCancelAt: new Date().toISOString(),
      lastCancelCode: result.signatureVerified ? head.code || '' : orders[merchantOrderNo].lastCancelCode || '',
      status: result.signatureVerified ? remote.status || orders[merchantOrderNo].status || '' : orders[merchantOrderNo].status || ''
    });
    console.log('[botim]', merchantOrderNo, 'cancel', attempt, head.applyStatus || '', head.code || '', result.signatureVerified ? 'signed' : 'unsigned');
    if (!result.signatureVerified) return 'retry';
    if (accepted) return 'done';
    if (String(head.code) === '62002') {
      const state = await readOrder(merchantOrderNo);
      if (state === 'paid') return 'paid';
      if (state === 'failed') return 'failed';
    }
    return 'retry';
  } catch (err) {
    remember(merchantOrderNo, { cancelCount: attempt, lastCancelAt: new Date().toISOString() });
    console.error('[botim]', merchantOrderNo, 'cancel', attempt, 'failed:', err.message);
    return 'retry';
  }
}

async function cancelUnopenedOrder(merchantOrderNo, started) {
  while (Date.now() < started + CANCEL_NOT_BEFORE_MS) {
    const queryStarted = Date.now();
    const state = await readOrder(merchantOrderNo);
    if (state === 'paid' || state === 'failed') return;
    const remaining = started + CANCEL_NOT_BEFORE_MS - Date.now();
    if (remaining <= 0) break;
    const elapsed = Date.now() - queryStarted;
    await sleep(Math.min(Math.max(QUERY_INTERVAL_MS - elapsed, 0), remaining));
  }
  const deadline = started + CANCEL_DEADLINE_MS;
  while (Date.now() < deadline) {
    const result = await cancelOrder(merchantOrderNo);
    if (result === 'paid' || result === 'failed') return;
    if (result === 'done') {
      await readOrder(merchantOrderNo);
      return;
    }
    const count = (orders[merchantOrderNo] && orders[merchantOrderNo].cancelCount) || 0;
    if (count >= 3) {
      await tellPerson(merchantOrderNo, 'Cancel was refused three times. A person needs to check this order with Botim.');
      return;
    }
    await sleep(CANCEL_GAP_MS);
  }
  await tellPerson(merchantOrderNo, 'Cancel was not accepted within 120 seconds. A person needs to check this order with Botim.');
}

async function followOrder(merchantOrderNo) {
  // Cancelling while the card page is open closed a real test payment.
  // Cancel only when Botim never returned a pay page.
  const existing = orders[merchantOrderNo];
  const started = Date.parse(existing && existing.createdAt) || Date.now();
  if (!(existing && existing.payPageOpened)) {
    await cancelUnopenedOrder(merchantOrderNo, started);
    return;
  }
  const watchUntil = started + PAY_PAGE_WATCH_MS;
  while (Date.now() < watchUntil) {
    const queryStarted = Date.now();
    const state = await readOrder(merchantOrderNo);
    if (state === 'paid' || state === 'failed') return;
    const elapsed = Date.now() - queryStarted;
    const wait = QUERY_INTERVAL_MS - elapsed;
    if (wait > 0) await sleep(wait);
  }
  const latest = orders[merchantOrderNo];
  if (latest && !paidStatus(latest.status) && latest.status !== 'FAILURE') {
    await tellPerson(merchantOrderNo, 'The pay page stayed open for 10 minutes and Botim has not confirmed the payment.');
  }
}

function watchOrder(merchantOrderNo) {
  if (!merchantOrderNo || watching.has(merchantOrderNo) || !orders[merchantOrderNo]) return;
  watching.add(merchantOrderNo);
  remember(merchantOrderNo, { watching: true });
  followOrder(merchantOrderNo)
    .catch((err) => console.error('[botim] Could not follow the order:', err.message))
    .finally(() => {
      watching.delete(merchantOrderNo);
      remember(merchantOrderNo, { watching: false });
    });
}

const allowedOrigins = (process.env.MPESA_ALLOWED_ORIGINS || '*')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

router.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

router.get('/config', (req, res) => {
  const account = activeAccount();
  res.json({
    enabled: accountReady(account),
    mode: account.mode,
    productionReady: accountReady(accountFrom('production')),
    currency: 'AED',
    ticketPrice: ticketPriceAed()
  });
});

function allowedSite(origin) {
  try {
    const url = new URL(String(origin || ''));
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return url.origin;
    if (host === 'www.grigaeventsfze.com' || host === 'grigaeventsfze.com') return url.origin;
  } catch (err) {
    return SITE_ORIGIN;
  }
  return SITE_ORIGIN;
}

router.post('/checkout', async (req, res) => {
  if (!accountReady(activeAccount())) {
    const live = paymentMode() === 'production';
    return res.status(503).json({
      message: live
        ? 'Botim production keys are not on this payment server.'
        : 'Botim test keys are not on this payment server.'
    });
  }
  let quantity = Number(req.body && req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) quantity = 1;
  const merchantOrderNo = orderNumber();
  const amount = ticketPriceAed() * quantity;
  const site = allowedSite(req.body && req.body.returnOrigin);
  const returnUrl = site + '/tickets.html?botimOrder=' + encodeURIComponent(merchantOrderNo);
  try {
    const result = await botimPost('/placeOrder', {
      merchantOrderNo: merchantOrderNo,
      subject: paymentMode() === 'production' ? 'WTS Edition 8 ticket' : 'WTS Edition 8 test ticket',
      totalAmount: { currency: 'AED', amount: amount },
      paySceneCode: 'PAYPAGE',
      paySceneParams: { redirectUrl: returnUrl },
      notifyUrl: API_ORIGIN + '/botim/notify'
    });
    const head = headOf(result.payload);
    const order = (result.payload.body && result.payload.body.acquireOrder) || {};
    const tokenUrl =
      (result.payload.body &&
        result.payload.body.interActionParams &&
        result.payload.body.interActionParams.tokenUrl) ||
      '';
    const accepted = String(head.applyStatus || '').toUpperCase() === 'SUCCESS' && String(head.code) === '0';
    const payPageOpened = Boolean(accepted && tokenUrl && result.signatureVerified);
    orders[merchantOrderNo] = {
      merchantOrderNo: merchantOrderNo,
      amount: amount,
      currency: 'AED',
      status: order.status || '',
      orderNo: order.orderNo || '',
      payPageOpened: payPageOpened,
      createdAt: new Date().toISOString()
    };
    persistOrders();
    watchOrder(merchantOrderNo);
    if (!accepted || !tokenUrl) {
      console.error('[botim] Test order was not created:', head.code || '', head.msg || '');
      return res.status(502).json({
        message: head.msg || 'Botim did not open a test payment.',
        code: head.code || '',
        signatureVerified: result.signatureVerified
      });
    }
    if (!result.signatureVerified) {
      console.error('[botim] Test order was created, but the public key did not match the reply.');
      return res.status(502).json({
        message: 'Botim replied, but the saved public key did not match that reply.',
        code: head.code || '',
        signatureVerified: false
      });
    }
    return res.json({
      merchantOrderNo: merchantOrderNo,
      payUrl: tokenUrl,
      amount: amount,
      currency: 'AED',
      testMode: paymentMode() !== 'production'
    });
  } catch (err) {
    console.error('[botim] Test order failed:', err.message);
    if (!orders[merchantOrderNo]) {
      orders[merchantOrderNo] = {
        merchantOrderNo: merchantOrderNo,
        amount: amount,
        currency: 'AED',
        status: '',
        payPageOpened: false,
        createdAt: new Date().toISOString()
      };
      persistOrders();
    }
    watchOrder(merchantOrderNo);
    return res.status(502).json({ message: 'Botim test payment could not be started.' });
  }
});

router.get('/orders/:merchantOrderNo', async (req, res) => {
  if (!accountReady(activeAccount())) {
    return res.status(503).json({ message: 'Botim keys are not configured.' });
  }
  const merchantOrderNo = String(req.params.merchantOrderNo || '').trim();
  if (!/^GRIGA[A-Z0-9]+$/.test(merchantOrderNo)) {
    return res.status(400).json({ message: 'Unknown test order.' });
  }
  try {
    const result = await botimPost('/getOrder', { merchantOrderNo: merchantOrderNo });
    const head = headOf(result.payload);
    const order = (result.payload.body && result.payload.body.acquireOrder) || {};
    const status = order.status || '';
    const trusted = result.signatureVerified;
    if (trusted && orders[merchantOrderNo]) {
      orders[merchantOrderNo].status = status;
      orders[merchantOrderNo].orderNo = order.orderNo || orders[merchantOrderNo].orderNo;
      orders[merchantOrderNo].checkedAt = new Date().toISOString();
      persistOrders();
    }
    return res.json({
      merchantOrderNo: merchantOrderNo,
      status: trusted ? status : '',
      paid: trusted && paidStatus(status),
      failed: trusted && status === 'FAILURE',
      amount: order.totalAmount ? order.totalAmount.amount : TICKET_PRICE_AED,
      currency: 'AED',
      code: trusted ? head.code || '' : '',
      message: customerMessage(status, trusted),
      signatureVerified: trusted,
      testMode: paymentMode() !== 'production'
    });
  } catch (err) {
    console.error('[botim] Order check failed:', err.message);
    return res.status(502).json({ message: 'Botim order could not be checked.' });
  }
});

router.post('/notify', (req, res) => {
  const raw = typeof req.rawBody === 'string' ? req.rawBody : '';
  const signature = req.get('sign') || '';
  if (!verifyNotice(raw, signature)) {
    console.error('[botim] Payment notice signature did not match.');
    return res.status(400).type('text/plain').send('FAIL');
  }
  const body = req.body || {};
  const merchantOrderNo =
    body.acquireOrder && body.acquireOrder.merchantOrderNo
      ? String(body.acquireOrder.merchantOrderNo)
      : '';
  const noticeStatus = body.acquireOrder && body.acquireOrder.status ? String(body.acquireOrder.status) : '';
  console.log('[botim] Payment notice verified:', merchantOrderNo || 'unknown', noticeStatus || 'no status');
  if (merchantOrderNo && orders[merchantOrderNo]) {
    const status = body.acquireOrder.status || orders[merchantOrderNo].status;
    orders[merchantOrderNo].status = status;
    orders[merchantOrderNo].notifiedAt = new Date().toISOString();
    persistOrders();
  }
  res.type('text/plain').send('SUCCESS');
});

module.exports = router;
