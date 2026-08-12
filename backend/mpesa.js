/**
 * GRIGA Events FZE – M-Pesa STK Push (Safaricom Daraja API)
 *
 * Endpoints (mounted in index.js):
 *   POST /mpesa/stk-push            – trigger an STK push to the buyer's phone
 *   POST /mpesa/callback            – Daraja result callback (must be publicly reachable)
 *   GET  /mpesa/status/:requestId   – frontend polls payment status
 *
 * Required env vars (see .env.example):
 *   MPESA_ENV               sandbox | production
 *   MPESA_CONSUMER_KEY      Daraja app consumer key
 *   MPESA_CONSUMER_SECRET   Daraja app consumer secret
 *   MPESA_SHORTCODE         Paybill or Till number (business shortcode)
 *   MPESA_PASSKEY           Lipa na M-Pesa Online passkey
 *   MPESA_TRANSACTION_TYPE  CustomerPayBillOnline (Paybill) | CustomerBuyGoodsOnline (Till)
 *   MPESA_CALLBACK_BASE_URL Public HTTPS base URL of this backend (no trailing slash)
 *   MPESA_ALLOWED_ORIGINS   Comma-separated origins allowed to call the API (CORS)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';
const BASE_URL =
  MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;
const TRANSACTION_TYPE = process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline';
// For Buy Goods (Till): SHORTCODE is the store number, PARTYB is the till number.
// For Paybill both are the same shortcode, so PARTYB defaults to SHORTCODE.
const PARTYB = process.env.MPESA_PARTYB || SHORTCODE;
const CALLBACK_BASE_URL = process.env.MPESA_CALLBACK_BASE_URL;
const ACCOUNT_REF_PREFIX = process.env.MPESA_ACCOUNT_REF || 'GRIGA';

const ordersDir = path.join(__dirname, process.env.TICKET_DATA_DIR || 'data');
const ordersFile = path.join(ordersDir, 'mpesa-orders.json');

function isConfigured() {
  return Boolean(CONSUMER_KEY && CONSUMER_SECRET && SHORTCODE && PASSKEY && CALLBACK_BASE_URL);
}

/* ── Order store (file-backed, keyed by CheckoutRequestID) ── */

function loadOrders() {
  try {
    if (!fs.existsSync(ordersFile)) return {};
    return JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '{}');
  } catch (err) {
    console.error('[mpesa] Failed to load order store:', err.message);
    return {};
  }
}

const orders = loadOrders();

function persistOrders() {
  try {
    if (!fs.existsSync(ordersDir)) fs.mkdirSync(ordersDir, { recursive: true });
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('[mpesa] Failed to persist order store:', err.message);
  }
}

/* ── OAuth token (cached until near expiry) ── */

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }
  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` }
  });
  if (!res.ok) {
    throw new Error(`Daraja auth failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

/* ── Helpers ── */

function darajaTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/**
 * Normalize Kenyan phone input to 2547XXXXXXXX / 2541XXXXXXXX.
 * Accepts 07.., 01.., +254.., 254.. formats.
 */
function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  let msisdn = digits;
  if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
  if (msisdn.startsWith('7') || msisdn.startsWith('1')) msisdn = '254' + msisdn;
  if (!/^254(7|1)\d{8}$/.test(msisdn)) return null;
  return msisdn;
}

/* ── CORS for the static site ── */

const allowedOrigins = (process.env.MPESA_ALLOWED_ORIGINS || '*')
  .split(',')
  .map((o) => o.trim())
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

/* ── Routes ── */

router.post('/stk-push', async (req, res) => {
  if (!isConfigured()) {
    return res
      .status(503)
      .json({ message: 'M-Pesa is not configured on the server yet. Please pay manually.' });
  }

  const { phone, amount, orderId, source, description } = req.body || {};

  const msisdn = normalizePhone(phone);
  if (!msisdn) {
    return res
      .status(400)
      .json({ message: 'Enter a valid Safaricom number, e.g. 0712 345 678.' });
  }

  const amountKsh = Math.ceil(Number(amount));
  if (!Number.isFinite(amountKsh) || amountKsh < 1) {
    return res.status(400).json({ message: 'Invalid amount.' });
  }

  const accountRef = `${ACCOUNT_REF_PREFIX}-${(orderId || 'ORDER').slice(0, 20)}`.slice(0, 24);
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

  try {
    const token = await getAccessToken();
    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: TRANSACTION_TYPE,
        Amount: amountKsh,
        PartyA: msisdn,
        PartyB: PARTYB,
        PhoneNumber: msisdn,
        CallBackURL: `${CALLBACK_BASE_URL}/mpesa/callback`,
        AccountReference: accountRef,
        TransactionDesc: (description || 'GRIGA Events order').slice(0, 13)
      })
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== '0') {
      console.error('[mpesa] STK push rejected:', stkData);
      return res.status(502).json({
        message:
          stkData.errorMessage || stkData.ResponseDescription || 'M-Pesa rejected the request. Try again.'
      });
    }

    const checkoutRequestId = stkData.CheckoutRequestID;
    orders[checkoutRequestId] = {
      checkoutRequestId,
      merchantRequestId: stkData.MerchantRequestID,
      orderId: orderId || null,
      source: source || 'unknown',
      phone: msisdn,
      amount: amountKsh,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    persistOrders();

    return res.json({ checkoutRequestId });
  } catch (err) {
    console.error('[mpesa] STK push failed:', err.message);
    return res.status(502).json({ message: 'Could not reach M-Pesa. Please try again.' });
  }
});

router.post('/callback', (req, res) => {
  // Always ack Daraja so it doesn't retry indefinitely.
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const stkCallback = req.body && req.body.Body && req.body.Body.stkCallback;
  if (!stkCallback) {
    console.error('[mpesa] Malformed callback payload:', JSON.stringify(req.body || {}));
    return;
  }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
  const order = orders[CheckoutRequestID];
  if (!order) {
    console.warn('[mpesa] Callback for unknown CheckoutRequestID:', CheckoutRequestID);
    return;
  }

  if (Number(ResultCode) === 0) {
    const meta = {};
    ((CallbackMetadata && CallbackMetadata.Item) || []).forEach((item) => {
      meta[item.Name] = item.Value;
    });
    order.status = 'success';
    order.receipt = meta.MpesaReceiptNumber || null;
    order.paidAmount = meta.Amount || order.amount;
    order.paidPhone = meta.PhoneNumber || order.phone;
    order.completedAt = new Date().toISOString();
    console.log('[mpesa] Payment confirmed:', CheckoutRequestID, order.receipt);
  } else {
    order.status = 'failed';
    order.failureReason = ResultDesc || 'Payment was not completed.';
    order.completedAt = new Date().toISOString();
    console.log('[mpesa] Payment failed:', CheckoutRequestID, ResultDesc);
  }
  persistOrders();
});

router.get('/status/:requestId', (req, res) => {
  const order = orders[req.params.requestId];
  if (!order) {
    return res.status(404).json({ status: 'unknown' });
  }
  return res.json({
    status: order.status,
    receipt: order.receipt || null,
    message: order.failureReason || null
  });
});

module.exports = router;
