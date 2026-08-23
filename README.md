 go,# pay-none
[!contacts , !mcockery == (SLACK-corrections/Outflow(Formats))]
A Vite + React + TypeScript app implementing a token-based credits system:
- Users can buy tokens (Stripe / Razorpay)
- Spend tokens in chat/comments (tokens deducted via server RPC)
- Transfer tokens between users (chat flow)

This README describes how to set up and run the project locally, how to deploy Supabase functions and migrations, and important security/compliance notes for payment/token flows.

## Quick start (short)
1. Create a `.env.local` with the values listed below.
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Deploy Supabase functions & run DB migrations (see Supabase section below) before using payments or token flows.

## Prerequisites
- Node.js 18+ (or latest LTS)
- npm (or bun/pnpm if you prefer — the repo uses npm in examples)
- A Supabase project (for auth, database, and Edge Functions)
- Stripe account and/or Razorpay account for payments (use test keys for local dev)
- (Optional) Supabase CLI for deploying functions & pushing migrations

## Environment variables
Create `.env.local` (or `.env`) in repo root and add at least the following keys:

Required for Supabase & app
- SUPABASE_URL=<your-supabase-url>
- SUPABASE_ANON_KEY=<your-supabase-anon-key>
- SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # server-only, DO NOT expose to client
- NEXT_PUBLIC_SUPABASE_URL or other client-prefixed envs if used by functions

Payments & provider keys (test keys in dev)
- VITE_PAYMENTS_CLIENT_TOKEN=<used in src/lib/stripe.ts to choose environment>
- STRIPE_PUBLISHABLE_KEY=<pk_test_...>
- STRIPE_SECRET_KEY=<sk_test_...>  # server-only
- RAZORPAY_KEY_ID=<rzp_test_...>
- RAZORPAY_KEY_SECRET=<rzp_test_secret...>
- STRIPE_WEBHOOK_SECRET=<stripe webhook signing secret>  # used for local verification if running webhook handlers
- RAZORPAY_WEBHOOK_SECRET=<razorpay webhook secret>  # if used

Other
- NODE_ENV=development

Important: Never commit `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or any secret keys to source control.

## Install & run (local)
Install deps and start dev server:

```bash
# install
npm install

# run dev server
npm run dev

# build production bundle
npm run build

# preview production build locally
npm run preview

# run tests
npm run test
```

If package.json scripts look broken or contain stray entries, correct the scripts section so the above commands exist (common scripts: `dev`, `build`, `preview`, `test`).

## Supabase: migrations & functions
This app relies on Supabase for auth, DB and server functions (Edge Functions or Supabase Functions) that perform sensitive operations (e.g., `spend_tokens`, payment verification). Deploy these before using token or payments features.

1. Install Supabase CLI (if not installed):
   - npm: `npm install -g supabase`
   - Homebrew: `brew install supabase/tap/supabase`

2. Authenticate & link to project:
```bash
supabase login
# in repo root, if you have a project ref:
supabase link --project-ref <your-project-ref>
```

3. Deploy Edge Functions (from `supabase/functions/`):
```bash
# deploy a function (repeat per function or deploy directory depending on your setup)
supabase functions deploy razorpay-create-order --project-ref <your-project-ref>
supabase functions deploy razorpay-verify-payment --project-ref <your-project-ref>
# ...other functions
```

4. Apply DB migrations / SQL:
- If `supabase/migrations` contains SQL files, apply them to your DB. Options:
  - Use supabase CLI (if using the newer DB push workflow):
    - `supabase db push` (ensure you're linked and have a working schema)
  - Or run SQL files directly against your Postgres database:
    - `psql <connection-string> -f supabase/migrations/001_create_tables.sql`
  - Ensure RPCs like `spend_tokens` and transaction tables (token_transactions) exist and are audited.

5. Webhooks & local testing:
- For Stripe webhooks you can use `stripe listen --forward-to localhost:...` and set `STRIPE_WEBHOOK_SECRET` from the listener.
- For Razorpay, set up test webhooks in their dashboard and configure the secret in your functions.

## Key files to review for security & correctness
- `src/lib/tokens.ts` — client helper that calls server RPCs like `spend_tokens`
- `supabase/migrations/*` — DB schema and RPC definitions
- `supabase/functions/*` — server functions that create/verify payment orders and webhooks
- `src/components/TokenCard.tsx` — token purchase UI
- `src/components/TokenTextarea.tsx` — client meter + spend flow (spends tokens before calling onSubmit)
- `src/pages/Chat.tsx` — token transfer semantics (sender spends, recipient credited)
- `src/lib/stripe.ts` — stripe client helper

## Recommended developer checks before enabling payments in production
- Audit RPC `spend_tokens`: ensure atomicity, non-negative balances, correct permission checks (Row Level Security), and idempotency.
- Log every token transaction with: actor_id, counterparty_id, amount, reason, timestamp, payment_provider_order_id, verification payload.
- Use provider-hosted, PCI-compliant flows (Stripe Checkout / Elements or Razorpay hosted checkout). Never accept raw card data on your servers.
- Add automated tests for concurrent spends, idempotent webhooks, and rollback on payment failures.
- Add monitoring & alerts for anomalous token activity.
- Consult legal counsel if tokens represent monetary value (KYC / AML / tax implications).

## Troubleshooting
- Dev server not starting:
  - Check that `npm run dev` script is present in `package.json`.
  - Check for missing or malformed environment variables; the app expects SUPABASE_* and payment keys.
- Payments failing:
  - Ensure you deployed server-side verification functions and that they use the correct provider secrets.
  - Ensure webhooks are configured and the webhook secret is set in function environment.
- RPCs or DB errors:
  - Verify that DB migrations were applied and that required tables/RPCs exist in the Supabase project.

## Security & input-safety notes
- Do not accept or log sensitive user data unnecessarily.
- Validate all inputs server-side (e.g., prevent clients from calling `spend_tokens` with negative amounts or spoofed reasons).
- Rate limit token operations and protect RPC endpoints with proper auth.
- If your app accepts any form of PIN or secrets, always treat them as sensitive and store only hashed/salted values where applicable. The app should not accept or permit arbitrary "PIN-format" strings to be processed as secrets without validation.

## Contributing
- Fork the repo and open a PR.
- For changes that affect payments or token accounting, include tests and a short compliance/security note explaining how the change preserves auditability and safety.

## Where to go next (dev tasks)
- Add COMPLIANCE/PRIVACY.md and COMPLIANCE/PAYMENTS.md describing PCI approach, retention, and audit logs.
- Add a `token_transactions` view and an admin dashboard for auditing.
- Add tests for idempotency and concurrent spending behavior.
