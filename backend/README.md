# GRIGA Events Ticketing Backend

This lightweight Node.js backend handles Stripe webhook events, generates QR-based tickets, and sends confirmation emails.

## Stack
- `express` for routing.
- `stripe` for signature verification and optional Session lookup.
- `nodemailer` (or any transactional provider SDK) for sending emails.
- `qrcode` for generating the PNG data that gets embedded in the ticket email.
- `jsonwebtoken` for issuing admin tokens.
- `bcrypt` for securely verifying passwords.

## Workflow
1. The front-end posts attendee details to `POST /stripe/session` (optional) to attach metadata to a Stripe Checkout session.
2. Stripe redirects the guest to the hosted payment link you already control (`https://buy.stripe.com/...`).
3. Stripe calls `POST /stripe/webhook` with `checkout.session.completed` when payment succeeds.
4. The webhook handler:
   - Verifies the payload using the webhook signing secret.
   - Reads customer details (`email`, `metadata.name`, `metadata.phone`).
   - Generates a unique ticket ID and renders a QR code PNG containing the ticket data.
   - Records the ticket in an in-memory audit log so the authenticated dashboard can review it.
   - (Optional) Stores the ticket record in your preferred datastore.
   - Sends an email to the buyer with event details and the QR image.

   The webhook now appends every ticket to `data/tickets.json` (configurable via `TICKET_DATA_DIR`/`TICKET_DATA_FILE`) so the dashboard can survive restarts. The endpoint still keeps only `TICKET_MEMORY_CAP` entries in memory and returns the most recent `TICKET_LOG_LIMIT` records to `/admin/tickets`.

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
EVENT_LOCATION="MOUNTAIN RESORT - RAS AL KHAIMAH"
ADMIN_EMAIL=admin@grigaeventsfze.com
ADMIN_PASSWORD_HASH=$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ADMIN_JWT_SECRET=replace-with-long-random-string
ADMIN_TOKEN_TTL=1h
ADMIN_BASIC_REALM=GRIGA Admin
TICKET_DATA_DIR=data
TICKET_DATA_FILE=data/tickets.json
TICKET_MEMORY_CAP=5000
TICKET_LOG_LIMIT=2000
```

Copy these values into a local `.env` file before running the backend. A sample with placeholder values is available as `.env.example`, and `.env` is already excluded in `.gitignore`, so your secrets can stay private. Never commit the real `.env` file—only the example file should be tracked.

Generate `ADMIN_PASSWORD_HASH` with:
```
npx node -e "const bcrypt=require('bcrypt');console.log(bcrypt.hashSync('your-password',10));"
```

## Admin dashboard
- `GET /admin` (protected by HTTP Basic auth using `ADMIN_EMAIL` + the password whose hash is stored in `ADMIN_PASSWORD_HASH`, realm defined by `ADMIN_BASIC_REALM`): returns the same dashboard HTML so you can load the login form.
- `POST /admin/login` (JSON body: `{ email, password }`): verifies the credentials and returns a JWT signed with `ADMIN_JWT_SECRET`.
- `GET /admin/tickets` (requires `Authorization: Bearer <token>`): returns the ticket audit log recorded by the webhook handler.

The dashboard HTML is now served from the backend (`/admin`). Once you successfully pass Basic auth the page loads and stores the JWT returned by `/admin/login` in `localStorage`. If you ever host the dashboard on its own origin again, keep the `window.GRIGA_ADMIN_API_ORIGIN` assignment inside the HTML so the login form knows where to send the API calls.

## Running
1. `npm install`
2. `node index.js` (or use `nodemon` during development)
3. Deploy to any HTTPS platform and configure the Stripe webhook URL (e.g., `https://your-domain.com/stripe/webhook`).

When you have the real credentials ready, you can customize the `index.js` handler below to plug into your infrastructure.