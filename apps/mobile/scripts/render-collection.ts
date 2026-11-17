import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COLLECTION_CATALOG } from "@gain/engine";
import { collectionSvg } from "../src/components/achievements/collectionArt";
import { en } from "../src/i18n/strings";
const out = resolve(process.cwd(), "../../docs/qa/collection-v2");
mkdirSync(out, { recursive: true });
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
for (const theme of ["dark", "light"]) for (const size of [32, 200]) {
 const cellW = size === 32 ? 170 : 240, cellH = size + 78, width = cellW*7, height = 70+cellH*3;
 const bg = theme === "dark" ? "#151813" : "#f3f4ee", ink = theme === "dark" ? "#e5e8de" : "#20251e";
 const cells = COLLECTION_CATALOG.map((d,i) => {
  const x=(i%7)*cellW+(cellW-size)/2, y=70+Math.floor(i/7)*cellH;
  const svg=collectionSvg(d.id, "earned", `qa${i}`)!.replace('width="100" height="100"',`x="${x}" y="${y}" width="${size}" height="${size}"`);
  const name = en[d.i18nKey as keyof typeof en];
  return `${svg}<text x="${(i%7)*cellW+cellW/2}" y="${y+size+19}" text-anchor="middle" font-family="sans-serif" font-size="${size===32?10:11}" fill="${ink}">${escape(name)}</text><text x="${(i%7)*cellW+cellW/2}" y="${y+size+35}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="${ink}" opacity=".65">${d.id}</text>`;
 }).join("");
 const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${bg}"/><text x="24" y="30" font-family="sans-serif" font-size="18" fill="${ink}">GAIN - 21 permanent milestones - ${size}px actual app artwork - ${theme}</text><text x="24" y="49" font-family="sans-serif" font-size="11" fill="${ink}">SVG source shared with native MilestoneArt. Artwork export, not a simulator screenshot.</text>${cells}</svg>`;
 writeFileSync(resolve(out,`collection-${size}-${theme}.svg`),sheet);
}
console.log(out);
