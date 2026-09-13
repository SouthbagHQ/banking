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

## Slack bot

The Slack bot that used to live in `../slack` (Bolt + Socket Mode + Convex) now runs inside this Worker. It is a plain Events API app: Slack POSTs to `https://banking.southbag.cc/slack/events` for events, slash commands and interactivity, the Worker verifies the signing secret, acks within 3 seconds, and does the real work in `ctx.waitUntil()` against the same D1 economy the website uses.

### Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest**, and paste `slack-manifest.json`. (If you are reusing the old app: turn **Socket Mode off**, then set the Request URL under Event Subscriptions, Interactivity & Shortcuts, and every slash command to `https://banking.southbag.cc/slack/events`. The manifest editor is the fast way to do all 30 commands at once.)
2. Install the app to the workspace and copy the **Bot User OAuth Token** (`xoxb-…`) and the **Signing Secret**.
3. Put them in Wrangler alongside the existing secrets:

```sh
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_SIGNING_SECRET
npx wrangler secret put HCAI               # Hack Club AI key: support chat, combine, use, warnings (tried first)
npx wrangler secret put OPENROUTER_API_KEY # OpenRouter key, used automatically when Hack Club AI fails
npx wrangler secret put SLACK_ADMIN_IDS    # optional, comma-separated Slack user ids that see the admin panel
npx wrangler secret put SLACK_ALLOWED_CHANNEL  # optional, channel id the bot answers in (defaults to the old #southbag channel)
npx wrangler secret put SLACK_LINK_URL         # optional, where unlinked users are sent (defaults to https://southbag.cc/onboarding?flow=slack-banking)
```

   Models default to `google/gemini-3-flash-preview` on both; override with `HCAI_MODEL` / `OPENROUTER_MODEL`. The web chat at `/api/chat` uses the same provider chain.

   For local dev add the same keys to `.dev.vars` and expose `wrangler dev` with `npx cloudflared tunnel --url http://localhost:8787`, then point the Slack Request URLs at the tunnel.

4. Apply migrations (`npm run db:migrate:remote`). Migration `0005` adds moderation columns, Slack chat history, and event de-duplication.

### How Slack users map to bank accounts

- A Slack user who has linked on the web (**Link Slack** page) uses their real account. Slack commands and the website move the same money.
- Everyone else plays as a shadow customer (`slack:U…`). `/south-open-account` creates one with a pathetic starting balance; if the old bot's Convex dump knows the Slack user, their old balance, jobs, loans, inventory and fees are imported automatically the first time they run a command.
- When a shadow customer later links on the web, the shadow account is merged into their web account (balance, transactions, jobs, loans, insurance, crypto, investments, lottery tickets, heists). The web account's previous data is overwritten, as before.
- Anyone who is not linked is nudged on every action — slash command responses, shop/modal replies, App Home, and the first message of each support thread — to sign up at `https://southbag.cc/onboarding?flow=slack-banking` and link Slack. Linked customers never see it.
- Ban/warn/admin state lives on `accounts` (`is_admin`, `is_banned`, `ban_expiry`, `ban_reason`, `strikes`). `SLACK_ADMIN_IDS` also grants the admin panel.

### What the bot does

- Mentions in the allowed channel, thread replies where the bot was summoned, and DMs get the Southbag Support AI (with the roast-from-profile, banking and inventory context, Kevin takeovers, `[FEE:…]`/`[HOLD:…]`/`[TICKET:…]` command tags, and image uploads). History is stored per channel/thread in `slack_messages`.
- All 30 `/south-*` slash commands run through `handleEconomy` in `economy.js` and render as Block Kit. `/south-heist`, `/south-leaderboard` and `/south-audit` post in-channel; everything else is ephemeral. Balance changes DM users who turned on `/south-notifs`.
- `/south-shop` opens the gift shop modal (buy, buy multiple, gift to someone, tribute to Kevin; window shopping fee on close). `/south-combine` and `/south-use` open modals; recipes in `economy.js` win, otherwise the AI invents the result and the target's reaction.
- App Home shows the account overview; admins also get the panel (inspect, warn, ban with AI-written Kevin letters, create/draw/cancel lotteries).

Module map: `slack-bot.js` (HTTP entry, events, commands, modals, home), `slack-api.js` (signature check + Web API client), `slack-commands.js` (AI command tags), `slack-prompt.js` (persona), `ai.js` (Hack Club AI proxy), `slack-link.js` (Sign in with Slack + shadow merge).

## Features
- Dynamic OAuth client registration
- D1-backed accounts, transactions, sessions, and chat history
- Slack-bot-style products: mystery fees, jobs, gambling, shop, heists, loans
- Sign in with Slack account linking that overwrites the web account from the Slack-bot dump
- The Southbag Support Slack bot (AI support chat, 30 slash commands, shop/lottery modals, admin panel) served from the same Worker
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
