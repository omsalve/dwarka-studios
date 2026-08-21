import { chromium } from "playwright";
const OUT = process.env.SP;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200)); });
await page.goto("http://localhost:3000", { waitUntil: "load" });

for (const t of [1000, 3000, 6000, 10000, 15000]) {
  await page.waitForTimeout(t === 1000 ? 1000 : 3000);
  const info = await page.evaluate(() => ({
    t: Math.round(performance.now()),
    bodyH: document.body.scrollHeight,
    docH: document.documentElement.scrollHeight,
    overflow: getComputedStyle(document.body).overflow,
    sections: document.querySelectorAll("section").length,
    canvases: document.querySelectorAll("canvas").length,
    buttons: [...document.querySelectorAll("button")].map((b) => b.textContent?.trim().slice(0, 24)),
  }));
  console.log(JSON.stringify(info));
}
await page.screenshot({ path: `${OUT}/probe.png` });
await browser.close();
