/* -----------------------------------------------------------------------
   encode-media.mjs — build the video ladder and publish it to the manifest
   ─────────────────────────────────────────────────────────────────────
   The two splash clips ship as 14.5MB and 16MB H.264 masters. While the
   splash is on screen it IS the largest-contentful paint, so those bytes are
   not "background loading" — they are the load. At roughly 11 Mbps sustained
   they are a stall on anything short of good fixed-line broadband.

   This script builds a proper ladder:

       1080 / 720 / 480   x   AV1  ->  VP9  ->  H.264

   AV1 and VP9 typically land this kind of soft, slow, full-frame footage at
   a quarter to a third of the original H.264 bitrate; the 720 rung halves it
   again for phones, which cannot resolve 1080 anyway. Each clip also gets a
   poster JPEG of frame 0, so the splash paints its opening image before a
   single byte of video has been decoded — today it shows black until the
   decoder catches up.

   Output filenames are NEW (video1x-720.webm, not video1x.mp4). That is
   deliberate: /videos/* is served `immutable`, so re-encoding in place would
   leave returning visitors on the old cut forever. New names, new cache
   entries, no invalidation problem.

   When it finishes it rewrites the GENERATED block of lib/mediaManifest.ts
   with exactly the files that were produced — the runtime never guesses at
   what exists, and a partial run degrades to a shorter ladder rather than a
   broken source element.

   Needs ffmpeg, which is deliberately NOT a dependency of this project: it is
   an ~80MB binary that only matters when the source clips change, and the
   encodes it produces are committed. Provide it either way:

     · a system ffmpeg on PATH  (winget install Gyan.FFmpeg / brew install ffmpeg)
     · or, temporarily,  npm i --no-save ffmpeg-static

   The script finds either. Everything else in the build works without it.

     Usage:  npm run media:video
             node scripts/encode-media.mjs --only=480
   ----------------------------------------------------------------------- */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* Use ffmpeg-static's prebuilt binary if someone has installed it, otherwise
   fall through to whatever is on PATH. A system ffmpeg is generally preferable
   — it is usually newer and more likely to carry SVT-AV1 rather than libaom. */
function resolveFfmpeg() {
  try {
    const require = createRequire(import.meta.url);
    const bundled = require("ffmpeg-static");
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    /* not installed — fall through to PATH */
  }
  return "ffmpeg";
}

const FFMPEG = resolveFfmpeg();

const VIDEO_DIR = "public/videos";
const MANIFEST = "lib/mediaManifest.ts";
/* Masters live outside public/ once they have been encoded: they are the
   source for future re-encodes, not something to deploy. Leaving them in
   public/ would ship 30MB nothing ever requests. */
const MASTERS = ".media-originals/videos";

/** Manifest key -> the master file it is encoded from. */
const SOURCES = {
  splashOne: "video1x.mp4",
  splashTwo: "video2x.mp4",
};

const RUNGS = [1080, 720, 480];

// Full MIME types including the codec string. Without the codec parameter
// Safari will happily claim it can play a WebM it cannot decode.
const AV1_TYPE = "video/webm; codecs=\"av01.0.05M.08\"";
const VP9_TYPE = "video/webm; codecs=\"vp9\"";
const H264_TYPE = "video/mp4; codecs=\"avc1.640028\"";

/* Codec ladder, best-compression first. */
const CODECS = [
  {
    ext: "webm",
    suffix: "",
    type: AV1_TYPE,
    // SVT-AV1 where the build has it; libaom otherwise. libaom is far slower,
    // but these clips are 7s and 5s, so even the slow path is a minute or two.
    encoder: "libsvtav1",
    fallbackEncoder: "libaom-av1",
    args: (crf, encoder) =>
      encoder === "libsvtav1"
        ? ["-c:v", "libsvtav1", "-crf", String(crf), "-preset", "6"]
        : ["-c:v", "libaom-av1", "-crf", String(crf), "-b:v", "0", "-cpu-used", "6", "-row-mt", "1"],
    crf: { 1080: 38, 720: 36, 480: 34 },
  },
  {
    ext: "webm",
    suffix: "-vp9",
    type: VP9_TYPE,
    encoder: "libvpx-vp9",
    args: (crf) => [
      "-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0",
      "-row-mt", "1", "-deadline", "good", "-cpu-used", "2",
    ],
    fallbackEncoder: null,
    crf: { 1080: 36, 720: 34, 480: 33 },
  },
  {
    ext: "mp4",
    suffix: "",
    type: H264_TYPE,
    encoder: "libx264",
    args: (crf) => [
      "-c:v", "libx264", "-crf", String(crf), "-preset", "slow",
      "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    ],
    fallbackEncoder: null,
    crf: { 1080: 24, 720: 23, 480: 23 },
  },
];

const only = process.argv.find((a) => a.startsWith("--only="));
const wanted = only ? [Number(only.split("=")[1])] : RUNGS;

function ffmpeg(args) {
  const result = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  return result.status === 0;
}

function haveFfmpeg() {
  return spawnSync(FFMPEG, ["-version"], { stdio: "ignore" }).status === 0;
}

let encoderList = null;
function hasEncoder(name) {
  if (encoderList === null) {
    const out = spawnSync(FFMPEG, ["-hide_banner", "-encoders"], { encoding: "utf8" });
    encoderList = typeof out.stdout === "string" ? out.stdout : "";
  }
  return encoderList.includes(name);
}

/** ffmpeg-static ships no ffprobe, so parse the dimensions off ffmpeg itself. */
function sourceHeight(file) {
  const out = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const text = String(out.stderr ?? "") + String(out.stdout ?? "");
  const match = text.match(/,\s(\d{2,5})x(\d{2,5})[\s,]/);
  const value = match ? Number(match[2]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 1080;
}

const kb = (n) => (n / 1024).toFixed(0) + "KB";

function main() {
  if (!haveFfmpeg()) {
    console.error(
      [
        "No ffmpeg found. Install one of:",
        "  Windows : winget install Gyan.FFmpeg",
        "  macOS   : brew install ffmpeg",
        "  Linux   : apt install ffmpeg",
        "  any OS  : npm i --no-save ffmpeg-static",
        "",
        "Nothing else in the build needs it — the encodes already in",
        "public/videos keep being served until this runs again.",
      ].join("\n")
    );
    process.exit(1);
  }

  const available = [];
  for (const codec of CODECS) {
    if (hasEncoder(codec.encoder)) {
      available.push({ ...codec, resolved: codec.encoder });
    } else if (codec.fallbackEncoder && hasEncoder(codec.fallbackEncoder)) {
      console.log("~ " + codec.encoder + " unavailable, using " + codec.fallbackEncoder);
      available.push({ ...codec, resolved: codec.fallbackEncoder });
    } else {
      console.warn("! " + codec.encoder + " is not built into this ffmpeg — skipping that codec");
    }
  }

  mkdirSync(VIDEO_DIR, { recursive: true });
  const manifest = {};

  mkdirSync(MASTERS, { recursive: true });

  for (const [key, filename] of Object.entries(SOURCES)) {
    // Prefer the retired master; fall back to public/ on a first run, and
    // retire it once this pass has finished reading from it.
    const retired = join(MASTERS, filename);
    const published = join(VIDEO_DIR, filename);
    const master = existsSync(retired) ? retired : published;
    if (!existsSync(master)) {
      console.warn("! missing " + filename + " — skipping " + key);
      continue;
    }
    const base = filename.replace(/\.[^.]+$/, "");
    const nativeHeight = sourceHeight(master);
    const variants = [];

    // Poster: frame 0, the exact image the clip opens on. It only has to
    // cover the few hundred milliseconds before the decoder reaches that same
    // frame, so 1600px wide at q6 is generous — a full-resolution poster
    // would be a third the weight of the entire AV1 encode behind it.
    const poster = join(VIDEO_DIR, base + "-poster.jpg");
    let posterPath;
    if (ffmpeg(["-i", master, "-frames:v", "1", "-vf", "scale=1600:-2", "-q:v", "6", poster])) {
      posterPath = "/videos/" + base + "-poster.jpg";
      console.log("  + " + poster + "  " + kb(statSync(poster).size));
    }

    for (const height of wanted) {
      if (height > nativeHeight) continue;
      for (const codec of available) {
        const name = base + "-" + height + codec.suffix + "." + codec.ext;
        const out = join(VIDEO_DIR, name);
        const args = [
          "-i", master,
          "-vf", "scale=-2:" + height,
          ...codec.args(codec.crf[height], codec.resolved),
          "-an",
          out,
        ];
        console.log("  … encoding " + name + " with " + codec.resolved);
        if (!ffmpeg(args)) {
          console.warn("  ! failed " + out);
          continue;
        }
        const bytes = statSync(out).size;
        variants.push({ src: "/videos/" + name, type: codec.type, height, bytes });
        console.log("  + " + out + "  " + kb(bytes));
      }
    }

    // The H.264 rung generated above is already the universal floor — every
    // browser that can play video at all can play it — so the master is not
    // referenced. Retire it out of public/ so it stops being deployed.
    if (master === published && variants.length > 0) {
      renameSync(published, retired);
      console.log("  → retired master " + published + " to " + retired);
    }

    manifest[key] = { poster: posterPath, variants };
  }

  writeManifest(manifest);
}

function writeManifest(manifest) {
  const body = Object.entries(manifest)
    .map(([key, asset]) => {
      const lines = asset.variants
        .map(
          (v) =>
            "      { src: " + JSON.stringify(v.src) +
            ", type: " + JSON.stringify(v.type) +
            ", height: " + v.height +
            ", bytes: " + v.bytes + " },"
        )
        .join("\n");
      const poster = asset.poster ? "    poster: " + JSON.stringify(asset.poster) + ",\n" : "";
      return "  " + key + ": {\n" + poster + "    variants: [\n" + lines + "\n    ],\n  },";
    })
    .join("\n");

  const generated =
    "/* --- GENERATED BELOW: edited by scripts/encode-media.mjs --- */\n" +
    "export const VIDEOS: Record<VideoKey, VideoAsset> = {\n" +
    body +
    "\n};\n/* --- END GENERATED --- */";

  const current = readFileSync(MANIFEST, "utf8");
  const crlf = current.includes("\r\n");
  const normalised = crlf ? current.split("\r\n").join("\n") : current;
  const start = normalised.indexOf("/* --- GENERATED BELOW");
  const endMarker = "/* --- END GENERATED --- */";
  const end = normalised.indexOf(endMarker);
  if (start === -1 || end === -1) {
    console.error("Could not find the generated block in " + MANIFEST + "; leaving it alone.");
    return;
  }
  const next = normalised.slice(0, start) + generated + normalised.slice(end + endMarker.length);
  writeFileSync(MANIFEST, crlf ? next.split("\n").join("\r\n") : next);
  console.log("\nUpdated " + MANIFEST);
}

main();
