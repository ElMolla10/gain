# GAIN draft site (docs/site)

Static pages, no JavaScript, no external requests, no analytics: `public/index.html`, `privacy.html`, `terms.html`, `delete-account.html`, `support.html`, `pilot-guide.html` (each English then Arabic on one page), `style.css`, `_headers`, `robots.txt`.

**Everything here is a DRAFT.** The privacy policy and terms have not been reviewed by a lawyer (decision D6); the Arabic is a builder's draft nobody native has read; the operator name/address and support email are placeholders (`[... not set yet]`, orange in the page). Each page carries a DRAFT banner, `<meta name="robots" content="noindex">`, an `X-Robots-Tag: noindex` header and a `robots.txt` that disallows everything, so the drafts are not meant to be found by search engines. The privacy text is the page version of [../PRIVACY-POLICY-DRAFT.md](../PRIVACY-POLICY-DRAFT.md) and is checked against the code by `apps/mobile/test/siteDraft.test.ts` (permissions, hosts, retention, "no analytics", draft banners, no scripts).

## Where it is hosted
See "Hosting record" at the end of this file (the URL and date are recorded there after each deploy).

## Fill in the contact (once Mohamed decides)
```
node docs/site/fill-contact.mjs --email support@YOURDOMAIN --operator "Name or company, address" --contact "WhatsApp +20..." 
```
This writes a copy to `docs/site/dist/` (git-ignored) with the placeholders replaced; the committed pages keep the visible markers. Then deploy `dist` instead of `public` (change `assets.directory` or copy over `public`). The script does not remove the DRAFT banners or noindex: that is a deliberate human step.

## Deploy (Cloudflare Workers static assets, free plan)
```
cd docs/site
npx wrangler@4.147.0 deploy          # needs `wrangler login` / an authed Cloudflare account
```
Uses `wrangler.jsonc` (Worker name `gain-site`, assets from `./public`). GitHub Pages also works (publish `docs/site/public`), but the `_headers` file (CSP, noindex header) is Cloudflare-specific; on GitHub Pages only the meta tags apply.

## Before publishing as final (none of this is done)
- [ ] A lawyer or a reputable template service reviews privacy and terms (D6); Egyptian and EU applicability confirmed.
- [ ] Operator identity and support email filled in; same email in the Play listing.
- [ ] A native Egyptian-Arabic reader reviews the Arabic text.
- [ ] Delete-account page: a request path that works without the app ([../ACCOUNT-DELETION-SPEC.md](../ACCOUNT-DELETION-SPEC.md)).
- [ ] Remove DRAFT banners, `noindex` (meta, header, robots.txt) on purpose; update `siteDraft.test.ts` accordingly.
- [ ] Re-check against the code at submission; every new data flow updates the page first.

## Hosting record
| When (Cairo) | What | Where |
| --- | --- | --- |
| 2026-10-04 04:29 | First deploy of the six DRAFT pages from `main` at PR #131 (placeholders unfilled, noindex), with `npx wrangler@4.147.0 deploy` from `docs/site` using the wrangler login already on the build box (Cloudflare account of Mohamed, free plan, Worker `gain-site`, static assets only) | https://gain-site.elmolla10.workers.dev (pages: `/privacy`, `/terms`, `/delete-account`, `/support`, `/pilot-guide`; `.html` URLs redirect to these) |

Note: wrangler needs a `node_modules` folder to exist under `docs/site` for its cache (`mkdir docs/site/node_modules`; git-ignored). To take the site down: `npx wrangler@4.147.0 delete gain-site`. Re-deploy after any change to `public/`; nothing is deployed automatically.
