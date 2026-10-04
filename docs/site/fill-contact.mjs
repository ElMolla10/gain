#!/usr/bin/env node
// Fills the three contact placeholders in docs/site/public/*.html into a COPY (default docs/site/dist), so the committed pages keep their
// visible "[... not set yet]" markers until the operator decides. It does NOT remove the DRAFT banners or the noindex tags: that is a human
// act after review (see README.md "Before publishing as final").
//   node docs/site/fill-contact.mjs --email support@example.org --operator "Name, address" --contact "WhatsApp +20..." [--out docs/site/dist]
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const out = args.out ?? join(here, "dist");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
if (args.email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(args.email)) {
  console.error("not an email address: " + args.email);
  process.exit(2);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(here, "public"), out, { recursive: true });
const subs = {
  "support-email": args.email ? `<a href="mailto:${esc(args.email)}">${esc(args.email)}</a>` : null,
  operator: args.operator ? esc(args.operator) : null,
  contact: args.contact ? esc(args.contact) : null,
};
let n = 0;
for (const f of readdirSync(out).filter((x) => x.endsWith(".html"))) {
  const p = join(out, f);
  const html = readFileSync(p, "utf8").replace(/<span class="ph" data-ph="([a-z-]+)">[^<]*<\/span>/g, (m, k) => {
    if (subs[k]) { n++; return subs[k]; }
    return m;
  });
  writeFileSync(p, html);
}
console.log(`wrote ${out} (${n} placeholders filled)`);
