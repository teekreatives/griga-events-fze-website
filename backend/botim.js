/**
 * Botim Money test checkout (PayBy hosted PayPage).
 *
 * This talks only to Botim's test address. It does not replace the ticket
 * page, and it does not take a live customer payment.
 *
 *   POST /botim/checkout          create a test order and return the pay page
 *   GET  /botim/orders/:orderNo   ask Botim for the result
 *   POST /botim/notify            Botim payment notice; reply SUCCESS
 *   GET  /botim/config            whether the test keys are present
 *
 * Keys stay in the server environment:
 *   BOTIM_PARTNER_ID, BOTIM_PRIVATE_KEY, BOTIM_PUBLIC_KEY
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const UAT_BASE = 'https://uat.test2pay.com/sgs/api/acquire2';
const TICKET_PRICE_AED = 150;
const API_ORIGIN = 'https://griga-events-fze-website.onrender.com';
const SITE_ORIGIN = 'https://www.grigaeventsfze.com';

const PARTNER_ID = String(process.env.BOTIM_PARTNER_ID || '').trim();
const PRIVATE_KEY = normalizePem(process.env.BOTIM_PRIVATE_KEY || '');
const PUBLIC_KEY = normalizePem(process.env.BOTIM_PUBLIC_KEY || '');

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

function isConfigured() {
  return Boolean(
    PARTNER_ID &&
      PRIVATE_KEY.includes('BEGIN') &&
      PRIVATE_KEY.includes('PRIVATE KEY') &&
      PUBLIC_KEY.includes('BEGIN PUBLIC KEY')
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

function signBody(body) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(body, 'utf8');
  signer.end();
  return signer.sign(PRIVATE_KEY, 'base64');
}

function verifyBody(body, signature) {
  if (!signature) return false;
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(body, 'utf8');
    verifier.end();
    return verifier.verify(PUBLIC_KEY, signature, 'base64');
  } catch (err) {
    console.error('[botim] Could not check the reply signature:', err.message);
    return false;
  }
}

function orderNumber() {
  return ('GRIGA' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}

async function botimPost(pathName, bizContent) {
  const body = JSON.stringify({
    requestTime: Date.now(),
    bizContent: bizContent
  });
  const response = await fetch(UAT_BASE + pathName, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Language': 'en',
      sign: signBody(body),
      'Partner-Id': PARTNER_ID
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
    signatureVerified: verifyBody(raw, signature)
  };
}

function headOf(payload) {
  return (payload && payload.head) || {};
}

function paidStatus(status) {
  return status === 'PAID_SUCCESS' || status === 'SETTLED';
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
  res.json({
    enabled: isConfigured(),
    mode: 'uat',
    currency: 'AED',
    ticketPrice: TICKET_PRICE_AED
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
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Botim test keys are not on this payment server.' });
  }
  let quantity = Number(req.body && req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) quantity = 1;
  const merchantOrderNo = orderNumber();
  const amount = TICKET_PRICE_AED * quantity;
  const site = allowedSite(req.body && req.body.returnOrigin);
  const returnUrl = site + '/tickets.html?botimOrder=' + encodeURIComponent(merchantOrderNo);
  try {
    const result = await botimPost('/placeOrder', {
      merchantOrderNo: merchantOrderNo,
      subject: 'WTS Edition 8 test ticket',
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
    orders[merchantOrderNo] = {
      merchantOrderNo: merchantOrderNo,
      amount: amount,
      currency: 'AED',
      status: order.status || '',
      orderNo: order.orderNo || '',
      createdAt: new Date().toISOString()
    };
    persistOrders();
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
      testMode: true
    });
  } catch (err) {
    console.error('[botim] Test order failed:', err.message);
    return res.status(502).json({ message: 'Botim test payment could not be started.' });
  }
});

router.get('/orders/:merchantOrderNo', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Botim test keys are not configured.' });
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
    if (orders[merchantOrderNo]) {
      orders[merchantOrderNo].status = status;
      orders[merchantOrderNo].orderNo = order.orderNo || orders[merchantOrderNo].orderNo;
      orders[merchantOrderNo].checkedAt = new Date().toISOString();
      persistOrders();
    }
    return res.json({
      merchantOrderNo: merchantOrderNo,
      status: status,
      paid: paidStatus(status),
      failed: status === 'FAILURE',
      amount: order.totalAmount ? order.totalAmount.amount : TICKET_PRICE_AED,
      currency: 'AED',
      code: head.code || '',
      message: head.msg || '',
      signatureVerified: result.signatureVerified,
      testMode: true
    });
  } catch (err) {
    console.error('[botim] Order check failed:', err.message);
    return res.status(502).json({ message: 'Botim order could not be checked.' });
  }
});

router.post('/notify', (req, res) => {
  const raw = typeof req.rawBody === 'string' ? req.rawBody : '';
  const signature = req.get('sign') || '';
  if (!verifyBody(raw, signature)) {
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
