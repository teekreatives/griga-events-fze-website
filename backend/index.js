const express = require('express');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// expose a health/router for other fetches
app.get('/', (req, res) => res.send('GRIGA ticketing backend'));

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
    }

    res.json({ received: true });
  }
);

const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});