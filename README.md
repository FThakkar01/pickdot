# Pickdot

Two images in, a hedged pick out. Pickdot tells you which of two images is more
likely to perform better with *your* audience — and why — without anything
leaving your browser.

- **Measured:** attention maps, text size at real feed scale, WCAG contrast,
  face size, clutter, palette. Stated as facts with units.
- **Judged:** a short, readable rule set weighted by your audience profile.
  Always hedged; "too close to call" when it is. Roughly one pick in three is wrong.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5288
```

## Deploy

| Host | How |
| --- | --- |
| GitHub Pages | Push to `main`; `.github/workflows/pages.yml` builds and publishes. |
| Cloudflare Pages | `npx wrangler login` once, then `npm run deploy:cloudflare`. |
| Hugging Face Space | `hf auth login` once, then `npm run deploy:hf`. |

## Analytics

- Microsoft Clarity: set `CLARITY_ID` in `src/config.ts` (one project covers all hosts; filter by the `host` tag).
- Owner push notifications: subscribe to the `NTFY_TOPIC` in `src/config.ts` with the ntfy app.
