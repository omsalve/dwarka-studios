/* -----------------------------------------------------------------------
   optimize-images.mjs — shrink every image the site actually ships
   ─────────────────────────────────────────────────────────────────────
   public/images was 20MB of PNG. Some of it was dead (a 9MB hero plate no
   module references), some was enormously over-specified (2048x2048 logos
   drawn at 36px tall, 1254x1254 PNG artwork that next/image re-encodes on
   every cold cache anyway, a 2048x2048 alpha PNG uploaded to the GPU as a
   16MB texture for a feather two inches tall).

   Two rules make this safe to run repeatedly:

     1. The first run copies each original into .media-originals/ (gitignored,
        outside public/, never deployed). Every later run reads from *there*,
        so quality never compounds and the pristine file is always one copy
        away.
     2. Nothing is deleted. Files no module references are MOVED to
        .media-originals/unused/ rather than removed, so a design decision
        later can always bring them back.

   Usage:  node scripts/optimize-images.mjs
           node scripts/optimize-images.mjs --dry-run
   ----------------------------------------------------------------------- */

import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync, copyFileSync, unlinkSync } from "node:fs";
import { dirname, join, basename } from "node:path";

const DRY = process.argv.includes("--dry-run");
const ORIGINALS = ".media-originals/images";
const UNUSED = ".media-originals/unused";

/* --- What each referenced image is actually FOR ----------------------- */
const PLAN = [
  {
    file: "public/images/heroimage.jpg",
    // The hero plate and the splash's final frame. It is the LCP element once
    // the overlay clears, it is rendered `unoptimized` so the bytes the video
    // dissolves into are byte-identical to the ones preloaded, and it is
    // displayed at exactly viewport size. 1920x1080 is right; 1MB is not.
    resize: { width: 1920 },
    // Baseline, not progressive: this plate is revealed by a 340ms crossfade
    // out of the splash video, and a progressive decode would let a soft
    // early scan show through that dissolve.
    encode: (p) => p.jpeg({ quality: 82, progressive: false, mozjpeg: true, chromaSubsampling: "4:4:4" }),
  },
  {
    file: "public/images/PrimaryLogo_Sandalwood.png",
    // Statically imported into <Nav>, drawn at 36px tall. next/image builds a
    // srcset from this, so the source only needs to cover the largest rung.
    resize: { width: 900 },
    encode: (p) => p.png({ compressionLevel: 9, palette: true, quality: 90 }),
  },
  {
    file: "public/images/Wordmark_Realistic_trimmed.png",
    // Statically imported into <Footer>, drawn at 32px tall.
    resize: { width: 800 },
    encode: (p) => p.png({ compressionLevel: 9, palette: true, quality: 90 }),
  },
  {
    file: "public/images/Feather.png",
    // Uploaded straight to the GPU by useTexture — next/image never sees it,
    // so its on-disk size IS its download size, and its dimensions ARE its
    // VRAM cost. At 2048^2 RGBA that is 16MB of texture memory (plus mipmaps)
    // for a decoration roughly 200px tall on screen. 512 is generous.
    resize: { width: 512 },
    encode: (p) => p.png({ compressionLevel: 9, quality: 92 }),
  },
  {
    file: "public/images/gate.png",
    resize: { width: 1280 },
    encode: (p) => p.png({ compressionLevel: 9, palette: true, quality: 88 }),
  },
  {
    file: "public/images/gate-idle.png",
    resize: { width: 1280 },
    encode: (p) => p.png({ compressionLevel: 9, palette: true, quality: 88 }),
  },
];

/* Service artwork: opaque photographic panels rendered through next/image at
   38vw. Shipping them as PNG costs ~2.8MB each in the repo and in every cold
   optimizer pass. WebP at q82 is visually identical for this content. The
   .png sources are retired to .media-originals/unused/ and the code now
   points at the .webp. */
const SERVICE_ART = [
  "AI Visualisation",
  "ARVRMRXR",
  "GamingDS",
  "VFX",
];

/* Referenced by nothing in app/, components/ or lib/ (verified by grep).
   Retired, not deleted. */
const UNREFERENCED = [
  "public/images/heroimage.png",
  "public/images/Brandmark_Sandalwood.png",
  "public/images/Wordmark_Realistic.png",
  "public/images/temple-hero.png",
];

const kb = (n) => (n / 1024).toFixed(0) + "KB";

function ensure(dir) {
  if (!DRY) mkdirSync(dir, { recursive: true });
}

/** Return the pristine source for `file`, seeding the backup on first run. */
function source(file) {
  const backup = join(ORIGINALS, basename(file));
  if (existsSync(backup)) return backup;
  if (!existsSync(file)) return null;
  ensure(ORIGINALS);
  if (!DRY) copyFileSync(file, backup);
  return DRY ? file : backup;
}

let saved = 0;

async function run() {
  for (const task of PLAN) {
    if (!existsSync(task.file)) continue;
    const src = source(task.file);
    if (!src) continue;

    const before = statSync(task.file).size;
    let pipeline = sharp(src);
    if (task.resize) pipeline = pipeline.resize({ ...task.resize, withoutEnlargement: true });
    const buffer = await task.encode(pipeline).toBuffer();

    if (buffer.length >= before && existsSync(join(ORIGINALS, basename(task.file)))) {
      console.log(`  = ${task.file} already optimal (${kb(before)})`);
      continue;
    }
    if (!DRY) writeFileSync(task.file, buffer);
    saved += before - buffer.length;
    console.log(`  ↓ ${task.file}  ${kb(before)} → ${kb(buffer.length)}`);
  }

  for (const name of SERVICE_ART) {
    const png = `public/images/services/${name}.png`;
    const webp = `public/images/services/${name}.webp`;
    if (!existsSync(png) && existsSync(webp)) {
      console.log(`  = ${webp} already converted`);
      continue;
    }
    if (!existsSync(png)) continue;

    const before = statSync(png).size;
    const buffer = await sharp(png)
      .resize({ width: 1100, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toBuffer();

    if (!DRY) {
      writeFileSync(webp, buffer);
      ensure(UNUSED);
      renameSync(png, join(UNUSED, basename(png)));
    }
    saved += before - buffer.length;
    console.log(`  ↓ ${png} → ${webp}  ${kb(before)} → ${kb(buffer.length)}`);
  }

  for (const file of UNREFERENCED) {
    if (!existsSync(file)) continue;
    const size = statSync(file).size;
    if (!DRY) {
      ensure(UNUSED);
      renameSync(file, join(UNUSED, basename(file)));
    }
    saved += size;
    console.log(`  → retired ${file} (${kb(size)}) to ${UNUSED}/`);
  }

  console.log(`\n${DRY ? "[dry run] would save" : "saved"} ${(saved / 1048576).toFixed(2)}MB`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
