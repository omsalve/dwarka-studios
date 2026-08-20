import { chromium } from "playwright";
const PORT = process.argv[2] || "3000";
const OUT = process.argv[3];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`${Date.now()} [${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`${Date.now()} [pageerror] ${String(e)}`));
await page.addInitScript(() => {
  window.__ctx = [];
  window.__t0 = Date.now();
  const orig = HTMLCanvasElement.prototype.getContext;
  let n = 0;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = orig.call(this, type, ...rest);
    if (String(type).startsWith("webgl")) {
      if (!this.__id) this.__id = "cv" + (++n);
      window.__ctx.push({ id: this.__id, ev: "create", t: Date.now() - window.__t0 });
      this.addEventListener("webglcontextlost", () => window.__ctx.push({ id: this.__id, ev: "LOST", t: Date.now() - window.__t0 }));
      this.__gl = c;
    }
    return c;
  };
});
await page.goto(`http://localhost:${PORT}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const skip = page.locator('text=/skip intro/i').first();
if (await skip.count()) await skip.click({ force: true }).catch(()=>{});
await page.waitForTimeout(2000);
await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
const secTop = await page.evaluate(() => {
  const s = Array.from(document.querySelectorAll("section")).find(x => x.textContent.includes("build something worth remembering"));
  return s.getBoundingClientRect().top + window.scrollY;
});
// jump close so the near-viewport gate fires
await page.evaluate((y) => window.scrollTo(0, y - 1200), secTop);
await page.waitForTimeout(1500);
await page.evaluate((y) => window.scrollTo(0, y + 450), secTop);

for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll("section")).find(x => x.textContent.includes("build something worth remembering"));
    const c = s.querySelector("canvas");
    let nz = 0;
    if (c && c.__gl && !c.__gl.isContextLost()) {
      const gl = c.__gl; const px = new Uint8Array(4*400);
      gl.readPixels(Math.floor(c.width/2)-10, Math.floor(c.height/2)-10, 20, 20, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let i=3;i<px.length;i+=4) if (px[i]>0) nz++;
    }
    return { t: Date.now()-window.__t0, id: c&&c.__id, lost: c&&c.__gl?c.__gl.isContextLost():null, nz };
  });
  console.log(JSON.stringify(r));
  if (i === 0 || i === 3 || i === 13) await page.screenshot({ path: `${OUT}/t-${PORT}-${i}.png` });
}
console.log("ctxLog:", JSON.stringify(await page.evaluate(() => window.__ctx)));
console.log("--- console ---\n" + logs.slice(-15).join("\n"));
await browser.close();
