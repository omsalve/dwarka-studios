import { chromium } from "playwright";

const OUT = process.env.SP;

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

await page.goto("http://localhost:3000", { waitUntil: "load" });
console.log(
  "renderer:",
  await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    const d = gl.getExtension("WEBGL_debug_renderer_info");
    return gl.getParameter(d.UNMASKED_RENDERER_WEBGL);
  })
);

// The splash pins body overflow; skip it, then kill smooth scrolling so
// scrollY reads true immediately after a scroll call.
// There are two gates (SplashScreen, then OpeningSequence), each with its own
// skip that only arms after a delay, so keep dismissing until the document
// actually grows past one viewport.
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(1000);
  const h = await page.evaluate(() => document.body.scrollHeight);
  if (h > 2000) break;
  await page.keyboard.press("Escape").catch(() => {});
  const btn = page.getByRole("button", { name: /skip/i });
  if (await btn.count()) await btn.first().click({ timeout: 2000 }).catch(() => {});
}
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  document.body.style.overflow = "auto";
});

// Walk to the bottom so DeferredBook swaps in the real book and the document
// stops growing, then come back and measure offsets against the final layout.
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, document.body.scrollHeight);
});
await page.waitForTimeout(4000);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);
console.log("scrollHeight:", await page.evaluate(() => document.body.scrollHeight));

const top = await page.evaluate(() => {
  const canvas = [...document.querySelectorAll("canvas")].find((c) =>
    c.closest("section")?.textContent?.includes("Founder")
  );
  const section = canvas?.closest("section");
  return section ? section.getBoundingClientRect().top + window.scrollY : null;
});
console.log("founder section top:", top);
if (top == null) throw new Error("founder section not found");

// The book opens across its pinned range; sample several depths into it.
for (const frac of [0.25, 0.4, 0.55, 0.7]) {
  const y = Math.round(top + 900 * frac * 2);
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/book-${frac}.png` });
  console.log("shot", frac, "at", y, "scrollY", await page.evaluate(() => window.scrollY));
}

await browser.close();
