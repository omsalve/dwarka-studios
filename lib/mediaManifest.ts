/* -----------------------------------------------------------------------
   mediaManifest — which encodes of each video actually exist on disk
   ─────────────────────────────────────────────────────────────────────
   A <video> element picks the first <source> whose `type` it can play. It
   does NOT skip a 404 — a listed file that isn't there is a broken video,
   not a graceful fallback. So the list of variants can never be guessed at
   runtime; it has to be a fact about the build.

   `npm run media` (scripts/encode-media.mjs) rewrites the VIDEOS table
   below from whatever it managed to encode, newest-first. Until it has been
   run, the table lists only the original H.264 files, which is exactly the
   behaviour the site had before — adding this indirection cannot break
   anything, it just gives the encoder somewhere to publish its results.

   Ordering contract, per quality rung: AV1 → VP9 → H.264. The browser takes
   the first it understands, so modern browsers get the small file and older
   ones fall through to the universally-playable mp4.
   ----------------------------------------------------------------------- */

export interface VideoVariant {
  src: string;
  /** Full MIME type including codec, so the browser can decide without a fetch. */
  type: string;
  /** Encoded height in pixels — the rung this variant belongs to. */
  height: number;
  /** File size in bytes, for logging and budget decisions. */
  bytes: number;
}

export interface VideoAsset {
  /** First frame, as an image. Paints before a single byte of video arrives. */
  poster?: string;
  /** Every encode that exists, ordered best-quality-first within each rung. */
  variants: VideoVariant[];
}

/** Every video the site can play. Keys are stable; variants are generated. */
export type VideoKey = "splashOne" | "splashTwo";

/* --- GENERATED BELOW: edited by scripts/encode-media.mjs --- */
export const VIDEOS: Record<VideoKey, VideoAsset> = {
  splashOne: {
    poster: "/videos/video1x-poster.jpg",
    variants: [
      { src: "/videos/video1x-1080.webm", type: "video/webm; codecs=\"av01.0.05M.08\"", height: 1080, bytes: 780166 },
      { src: "/videos/video1x-1080-vp9.webm", type: "video/webm; codecs=\"vp9\"", height: 1080, bytes: 1072283 },
      { src: "/videos/video1x-1080.mp4", type: "video/mp4; codecs=\"avc1.640028\"", height: 1080, bytes: 1716899 },
      { src: "/videos/video1x-720.webm", type: "video/webm; codecs=\"av01.0.05M.08\"", height: 720, bytes: 445064 },
      { src: "/videos/video1x-720-vp9.webm", type: "video/webm; codecs=\"vp9\"", height: 720, bytes: 617411 },
      { src: "/videos/video1x-720.mp4", type: "video/mp4; codecs=\"avc1.640028\"", height: 720, bytes: 853483 },
      { src: "/videos/video1x-480.webm", type: "video/webm; codecs=\"av01.0.05M.08\"", height: 480, bytes: 235473 },
      { src: "/videos/video1x-480-vp9.webm", type: "video/webm; codecs=\"vp9\"", height: 480, bytes: 342886 },
      { src: "/videos/video1x-480.mp4", type: "video/mp4; codecs=\"avc1.640028\"", height: 480, bytes: 399264 },
    ],
  },
  splashTwo: {
    poster: "/videos/video2x-poster.jpg",
    variants: [
      { src: "/videos/video2x-1080.webm", type: "video/webm; codecs=\"av01.0.05M.08\"", height: 1080, bytes: 1305261 },
      { src: "/videos/video2x-1080-vp9.webm", type: "video/webm; codecs=\"vp9\"", height: 1080, bytes: 2119617 },
      { src: "/videos/video2x-1080.mp4", type: "video/mp4; codecs=\"avc1.640028\"", height: 1080, bytes: 2815805 },
      { src: "/videos/video2x-720.webm", type: "video/webm; codecs=\"av01.0.05M.08\"", height: 720, bytes: 832880 },
      { src: "/videos/video2x-720-vp9.webm", type: "video/webm; codecs=\"vp9\"", height: 720, bytes: 1362633 },
      { src: "/videos/video2x-720.mp4", type: "video/mp4; codecs=\"avc1.640028\"", height: 720, bytes: 1619204 },
      { src: "/videos/video2x-480.webm", type: "video/webm; codecs=\"av01.0.05M.08\"", height: 480, bytes: 553368 },
      { src: "/videos/video2x-480-vp9.webm", type: "video/webm; codecs=\"vp9\"", height: 480, bytes: 845091 },
      { src: "/videos/video2x-480.mp4", type: "video/mp4; codecs=\"avc1.640028\"", height: 480, bytes: 893988 },
    ],
  },
};
/* --- END GENERATED --- */

/**
 * The tallest encode we are willing to download, given the device budget.
 *
 * A 1080p master on a 390pt phone is ~3x more pixels than the panel can show
 * and several times the bytes; a 480p rung on a 4K desktop would be visibly
 * soft. This maps the budget onto the rung that actually matches the screen.
 */
export function targetHeight(opts: {
  tier: "low" | "mid" | "high";
  frugalNetwork: boolean;
  viewportHeight: number;
  dpr: number;
}): number {
  if (opts.frugalNetwork) return 480;
  if (opts.tier === "low") return 480;
  // What the display can actually resolve, capped by the tier.
  const needed = opts.viewportHeight * Math.min(opts.dpr, 2);
  if (opts.tier === "mid") return needed > 800 ? 720 : 480;
  return needed > 1000 ? 1080 : 720;
}

/**
 * Ordered <source> list for an asset: every variant at or below the target
 * rung, tallest first, so the browser takes the best it can play without ever
 * exceeding the budget. Falls back to the full list if nothing qualifies, so
 * a manifest that only holds a 1080p master still plays.
 */
export function sourcesFor(asset: VideoAsset, maxHeight: number): VideoVariant[] {
  const withinBudget = asset.variants
    .filter((v) => v.height <= maxHeight)
    .sort((a, b) => b.height - a.height);
  return withinBudget.length > 0 ? withinBudget : [...asset.variants];
}
