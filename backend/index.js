require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, '../assets')));
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const adminEmail = process.env.ADMIN_EMAIL;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
const adminTokenTTL = process.env.ADMIN_TOKEN_TTL || '1h';
const adminBasicRealm = process.env.ADMIN_BASIC_REALM || 'GRIGA Admin';

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

const addTicketRecord = (record) => {
  ticketRecords.unshift(record);
  if (ticketRecords.length > 300) {
    ticketRecords.splice(300);
  }
};

const resolvePaymentLabel = (method) => {
  const normalized = (method || '').toLowerCase();
  if (normalized.includes('mpesa')) return 'M-Pesa';
  return 'Stripe';
};

const respondWithBasicChallenge = (res, message) => {
  res.setHeader('WWW-Authenticate', `Basic realm="${adminBasicRealm}"`);
  return res.status(401).send(message || 'Authentication required.');
};

const requireAdminPageAuth = async (req, res, next) => {
  if (!adminEmail || !adminPasswordHash) {
    return res.status(500).send('Admin authentication is not configured.');
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    return respondWithBasicChallenge(res);
  }
  const encoded = header.split(' ')[1] || '';
  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString();
  } catch (err) {
    return respondWithBasicChallenge(res);
  }
  const [username, password] = decoded.split(':');
  if (!username || password === undefined) {
    return respondWithBasicChallenge(res);
  }
  if (username.toLowerCase() !== adminEmail.toLowerCase()) {
    return respondWithBasicChallenge(res);
  }
  const match = await bcrypt.compare(password, adminPasswordHash);
  if (!match) {
    return respondWithBasicChallenge(res);
  }
  req.adminEmail = adminEmail;
  return next();
};

const requireAdminAuth = (req, res, next) => {
  if (!adminEmail || !adminPasswordHash || !adminJwtSecret) {
    return res.status(500).json({ message: 'Admin authentication is not configured.' });
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }
  const token = header.replace('Bearer ', '').trim();
  try {
    const payload = jwt.verify(token, adminJwtSecret);
    req.adminEmail = payload.sub;
    return next();
  } catch (err) {
    console.error('Invalid admin token', err.message);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// expose a health/router for other fetches
app.get('/', (req, res) => res.send('GRIGA ticketing backend'));

app.get('/admin', requireAdminPageAuth, (req, res) => {
  return res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/admin/login', async (req, res) => {
  if (!adminEmail || !adminPasswordHash || !adminJwtSecret) {
    return res.status(500).json({ message: 'Admin authentication is not configured.' });
  }
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  if (email.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  const isMatch = await bcrypt.compare(password, adminPasswordHash);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  const token = jwt.sign({ sub: adminEmail }, adminJwtSecret, { expiresIn: adminTokenTTL });
  res.json({ token, expiresIn: adminTokenTTL });
});

app.get('/admin/tickets', requireAdminAuth, (req, res) => {
  return res.json(ticketRecords);
});

app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const ticketId = `MN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
      const attendeeEmail = session.customer_details?.email ?? session.customer_email;
      const attendeeName = session.metadata?.name ?? 'Murima Guest';
      const attendeePhone = session.metadata?.phone ?? session.metadata?.contact ?? 'N/A';

      const qrPayload = JSON.stringify({ ticketId, event: process.env.EVENT_NAME, email: attendeeEmail });
      const qrBuffer = await QRCode.toBuffer(qrPayload, { type: 'png', width: 240 });

      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST,
        port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
        secure: false,
        auth: {
          user: process.env.EMAIL_SMTP_USER,
          pass: process.env.EMAIL_SMTP_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: attendeeEmail,
        subject: `${process.env.EVENT_NAME} Ticket #${ticketId}`,
        text: `${attendeeName}, thank you for booking your spot. Please see the attached QR code for entry.`,
        html: `<p>Hi ${attendeeName},</p>
          <p>Payment of <strong>${process.env.EVENT_PRICE ?? '150'} AED</strong> is confirmed for <strong>${process.env.EVENT_NAME}</strong>.</p>
          <p>Event location: ${process.env.EVENT_LOCATION}</p>
          <p>Show the QR below at the gate for contactless entry.</p>
          <img src="cid:qr" alt="QR ticket" style="max-width:240px;display:block;margin:16px auto;" />
          <p>See you there!</p>`,
        attachments: [
          {
            filename: `${ticketId}-qr.png`,
            content: qrBuffer,
            cid: 'qr'
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      console.log('Ticket email sent for', ticketId, attendeeEmail);
      addTicketRecord({
        id: ticketId,
        name: attendeeName,
        email: attendeeEmail,
        phone: attendeePhone,
        method: resolvePaymentLabel(session.payment_method_types?.[0]),
        timestamp: new Date().toISOString(),
        qr: qrPayload
      });
    }

    res.json({ received: true });
  }
);

const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});