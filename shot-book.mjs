import { chromium } from "playwright";

const outDir = process.argv[2] || ".";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

// locate the sticky scroll wrapper around the 3D book (170vh tall div)
const info = await page.evaluate(() => {
  const divs = Array.from(document.querySelectorAll("div"));
  const wrapper = divs.find((d) => d.style.height === "170vh");
  if (!wrapper) return null;
  const rect = wrapper.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    height: wrapper.offsetHeight,
    viewport: window.innerHeight,
  };
});

if (!info) {
  console.error("Could not find the FoundersNoteBook wrapper (170vh div)");
  await page.screenshot({ path: `${outDir}/debug-no-wrapper.png`, fullPage: false });
  await browser.close();
  process.exit(1);
}

const pinRange = info.height - info.viewport;

async function shot(name, progress) {
  const y = info.top + pinRange * progress;
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(1200); // let scroll-driven damping settle
  await page.screenshot({ path: `${outDir}/book-${name}.png` });
  console.log(`captured ${name} at progress=${progress} scrollY=${y}`);
}

await shot("closed", 0);
await shot("mid-open", 0.15);
await shot("settled-open", 0.55);

console.log("Console errors:", errors.length ? errors : "none");

await browser.close();
