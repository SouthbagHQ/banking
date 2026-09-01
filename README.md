# southbag online banking

A ***deliberately terrible*** 'online banking' website made for Borked, a bad site jam as a satirical version of my banks online banking system. I dont like it that much.

## What's Wrong Here?

This site intentionally has security vulnerabilities, performance nightmares, and UX disasters. Do NOT use any of these practices in production!

## Development

This now runs as a Cloudflare Worker with static assets, D1 storage, and OIDC login through `identity.southbag.cc`.

The dashboard also has the Slack bot's banking products — jobs, gambling, crypto, the gift shop, heists, and loans that should be illegal — stored in the same D1 database. Logged-in customers can link Sign in with Slack; if that Slack user exists in the imported bot dump, their web account is overwritten with the Slack data.

```sh
npm install
npm run db:migrate:local
npm run dev
```

The first login dynamically registers an OAuth client for the current origin and stores it in D1. Apply migrations before deploying with `npm run deploy`.

## Slack account linking

1. Create (or reuse) a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Under **Sign in with Slack**, turn on the OpenID Connect flow.
3. Under **OAuth & Permissions**, add these redirect URLs:
   - `https://banking.southbag.cc/auth/slack/callback`
   - `http://localhost:8787/auth/slack/callback` for `wrangler dev`
4. Request only `openid`, `email`, and `profile` in this flow (do not mix bot scopes into the same authorize request).
5. Put the app credentials in Wrangler:

```sh
npx wrangler secret put SLACK_CLIENT_ID
npx wrangler secret put SLACK_CLIENT_SECRET
```

For local dev, create `.dev.vars` in this repo:

```
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
```

6. Apply D1 migrations (`npm run db:migrate:local` / `npm run db:migrate:remote`). Migration `0004` loads the Slack-bot snapshot (dollar amounts converted to cents).
7. Customers log in with Southbag Identity, open **Link Slack**, and complete Sign in with Slack. Matching dump rows replace their current balance, transactions, job, loans, insurance, crypto, investments, inventory, and lottery tickets.

To rebuild `migrations/0004_slack_legacy_data.sql` from a Convex zip:

```sh
npm run db:build-slack-legacy -- /path/to/snapshot.zip
```

## Features
- Dynamic OAuth client registration
- D1-backed accounts, transactions, sessions, and chat history
- Slack-bot-style products: mystery fees, jobs, gambling, shop, heists, loans
- Sign in with Slack account linking that overwrites the web account from the Slack-bot dump
- GET parameters for 'sensitive data'
- Render-blocking scripts
- Super genuine "hacked" warnings
- Anti-accessibility CSS 
- Anti Mobile User CSS
- Real human

## Security Notes

Passwords are owned by Southbag Identity. This app stores only hashed opaque session tokens and uses a PKCE-only public OAuth client.

---
*This is satire. Please don't actually build websites like this.*
