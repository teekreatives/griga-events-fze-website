# GRIGA Events Ticketing Backend

This lightweight Node.js backend handles Stripe webhook events, generates QR-based tickets, and sends confirmation emails.

## Stack
- `express` for routing.
- `stripe` for signature verification and optional Session lookup.
- `nodemailer` (or any transactional provider SDK) for sending emails.
- `qrcode` for generating the PNG data that gets embedded in the ticket email.

## Workflow
1. The front-end posts attendee details to `POST /stripe/session` (optional) to attach metadata to a Stripe Checkout session.
2. Stripe redirects the guest to the hosted payment link you already control (`https://buy.stripe.com/...`).
3. Stripe calls `POST /stripe/webhook` with `checkout.session.completed` when payment succeeds.
4. The webhook handler:
   - Verifies the payload using the webhook signing secret.
   - Reads customer details (`email`, `metadata.name`, `metadata.phone`).
   - Generates a unique ticket ID and renders a QR code PNG containing the ticket data.
   - (Optional) Stores the ticket record in your preferred datastore.
   - Sends an email to the buyer with event details and the QR image.

## Environment variables
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_SMTP_HOST=smtp.example.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=...
EMAIL_SMTP_PASS=...
EMAIL_FROM="GRIGA Events" <tickets@grigaeventsfze.com>
EVENT_NAME="Murima Night – Second Edition"
EVENT_PRICE=150
EVENT_LOCATION="BASSATA VILLAGE - RAS AL KHAIMAH"
```

## Running
1. `npm install`
2. `node index.js` (or use `nodemon` during development)
3. Deploy to any HTTPS platform and configure the Stripe webhook URL (e.g., `https://your-domain.com/stripe/webhook`).

When you have the real credentials ready, you can customize the `index.js` handler below to plug into your infrastructure.