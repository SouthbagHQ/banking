# southbag online banking

A ***deliberately terrible*** 'online banking' website made for Borked, a bad site jam as a satirical version of my banks online banking system. I dont like it that much.

## What's Wrong Here?

This site intentionally has security vulnerabilities, performance nightmares, and UX disasters. Do NOT use any of these practices in production!

## Development

This now runs as a Cloudflare Worker with static assets, D1 storage, and OIDC login through `identity.southbag.cc`.

The dashboard also has the Slack bot's banking products — jobs, gambling, crypto, the gift shop, heists, and loans that should be illegal — stored in the same D1 database.

```sh
npm install
npm run db:migrate:local
npm run dev
```

The first login dynamically registers an OAuth client for the current origin and stores it in D1. Apply migrations before deploying with `npm run deploy`.

## Features
- Dynamic OAuth client registration
- D1-backed accounts, transactions, sessions, and chat history
- Slack-bot-style products: mystery fees, jobs, gambling, shop, heists, loans
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
