# GAIN site (docs/site)

Static pages, no JavaScript, no external requests, no analytics: `public/index.html`, `privacy.html`, `terms.html`, `delete-account.html`, `support.html`, `pilot-guide.html` (each English then Arabic on one page), `style.css`, `_headers`, `robots.txt`.

**Status (2026-10-27): published for the App Store listing.** The DRAFT banners, the `noindex` meta tags, the `X-Robots-Tag` header and the disallow-all `robots.txt` were removed on purpose. The policy text has still not been reviewed by a lawyer; the Arabic has not been read by a native speaker. The privacy text is checked against the code by `apps/mobile/test/siteDraft.test.ts`. The operator name and support email stay as placeholders in git and are filled at deploy time (below).

## Where it is hosted
See "Hosting record" at the end of this file (the URL and date are recorded there after each deploy).

## Fill in the contact (once Mohamed decides)
```
node docs/site/fill-contact.mjs --email support@YOURDOMAIN --operator "Name or company, address" --contact "WhatsApp +20..." 
```
This writes a copy to `docs/site/dist/` (git-ignored) with the placeholders replaced; the committed pages keep the visible markers. Then deploy `dist`: `npx wrangler@4.147.0 deploy --assets ./dist`.

## Deploy (Cloudflare Workers static assets, free plan)
```
cd docs/site
npx wrangler@4.147.0 deploy          # needs `wrangler login` / an authed Cloudflare account
```
Uses `wrangler.jsonc` (Worker name `gain-site`, assets from `./public`). GitHub Pages also works (publish `docs/site/public`), but the `_headers` file (CSP, noindex header) is Cloudflare-specific; on GitHub Pages only the meta tags apply.

## Open items
- [ ] A lawyer or reputable template service reviews privacy and terms (D6).
- [ ] A native Egyptian-Arabic reader reviews the Arabic text.
- [ ] Email sign-in is described conditionally: the server has no email provider configured yet (answers 501). Update the page when Resend is set up and verified.
- [ ] Re-check against the code at each submission; every new data flow updates the page first.

## Hosting record
| When (Cairo) | What | Where |
| --- | --- | --- |
| 2026-10-04 04:29 | First deploy of the six DRAFT pages from `main` at PR #131 (placeholders unfilled, noindex), with `npx wrangler@4.147.0 deploy` from `docs/site` using the wrangler login already on the build box (Cloudflare account of Mohamed, free plan, Worker `gain-site`, static assets only) | https://gain-site.elmolla10.workers.dev (pages: `/privacy`, `/terms`, `/delete-account`, `/support`, `/pilot-guide`; `.html` URLs redirect to these) |
| 2026-10-27 15:20 | Redeployed with the contact filled (`fill-contact.mjs --email imody101@gmail.com --operator "Mohamed Ehab" --contact imody101@gmail.com`, deploying `dist` with `npx wrangler@4.147.0 deploy --assets ./dist`), after updating the pages for the iPhone app ("GAIN: Workout Tracker"), optional email sign-in and the deletion paths. Still DRAFT + noindex | https://gain-site.elmolla10.workers.dev/privacy , `/support`, `/terms`, `/delete-account` |

Note: wrangler needs a `node_modules` folder to exist under `docs/site` for its cache (`mkdir docs/site/node_modules`; git-ignored). To take the site down: `npx wrangler@4.147.0 delete gain-site`. Re-deploy after any change to `public/`; nothing is deployed automatically.
