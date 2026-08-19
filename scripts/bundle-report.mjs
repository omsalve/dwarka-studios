/* -----------------------------------------------------------------------
   bundle-report.mjs — what each route actually makes a browser download
   ─────────────────────────────────────────────────────────────────────
   `next build` prints route sizes, but the number that matters for this site
   is narrower: how many bytes of JavaScript are in the *initial* script set
   of the landing page, before anything lazy has been asked for. That is what
   competes with the hero image and delays hydration.

   This reads the built HTML for each prerendered route, resolves every
   script it references to a file on disk, and reports both raw and gzipped
   totals. Run it before and after a change to see whether the change moved
   the number or just moved code around.

     Usage:  npm run analyze          (after `npm run build`)
   ----------------------------------------------------------------------- */

import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = ".next/server/app";

if (!existsSync(APP_DIR)) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}

const kb = (n) => (n / 1024).toFixed(1).padStart(8) + " KB";

function htmlFiles(dir, prefix = "") {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...htmlFiles(path, prefix + "/" + entry.name));
    } else if (entry.name.endsWith(".html")) {
      const route = prefix + "/" + entry.name.replace(/\.html$/, "");
      found.push({ route: route.replace(/\/index$/, "/"), path });
    }
  }
  return found;
}

let grandTotal = 0;

for (const { route, path } of htmlFiles(APP_DIR).sort((a, b) => a.route.localeCompare(b.route))) {
  const html = readFileSync(path, "utf8");
  const urls = [...new Set(html.match(/\/_next\/static\/[^"')\s]+\.js/g) ?? [])];

  let raw = 0;
  let gzip = 0;
  const rows = [];

  for (const url of urls) {
    const file = ".next" + url.slice("/_next".length);
    if (!existsSync(file)) continue;
    const bytes = statSync(file).size;
    const zipped = gzipSync(readFileSync(file)).length;
    raw += bytes;
    gzip += zipped;
    rows.push({ url, bytes, zipped });
  }

  rows.sort((a, b) => b.bytes - a.bytes);
  grandTotal += gzip;

  console.log(`\n${route}`);
  console.log(`  initial JS: ${kb(raw)} raw  ${kb(gzip)} gzipped  (${rows.length} files)`);
  for (const row of rows.slice(0, 5)) {
    console.log(`    ${kb(row.bytes)} ${kb(row.zipped)}  ${row.url.replace("/_next/static/", "")}`);
  }
}

console.log(`\nAll routes, initial JS gzipped: ${kb(grandTotal)}`);
