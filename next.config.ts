import type { NextConfig } from "next";

/** A year, in seconds — the standard `immutable` lifetime. */
const YEAR = 31536000;

const nextConfig: NextConfig = {
  images: {
    // AVIF first, WebP behind it. Order matters: the first format the
    // browser's Accept header matches is the one served, and AVIF lands this
    // site's photographic service artwork roughly 30% smaller than WebP at
    // matching quality. Anything that understands neither still gets the
    // original bytes.
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90, 100],
    // Optimised derivatives are keyed by content, so there is no reason to
    // re-derive them every four hours (the default). A month of TTL turns a
    // cold optimizer pass into a once-per-deploy cost instead of a recurring
    // one on every CDN edge.
    minimumCacheTTL: 2678400,
  },

  // Only the two directories that need it. A catch-all `/:path*` rule is
  // tempting here, but it also matches `/_next/static/*`, whose filenames are
  // already content-hashed and which Next serves `immutable` by default — a
  // catch-all silently downgrades every JS and CSS chunk on the site to
  // must-revalidate. Scoped rules only.
  async headers() {
    return [
      {
        // Files under /public are served with `max-age=0` by default, so every
        // visit re-validates the splash videos before it can start playing
        // them. They are large and never change in place — cache them hard.
        //
        // NOTE: `immutable` means a browser that has one will not check for a
        // new version. Change the *filename* when you re-encode these, or
        // returning visitors will keep the old cut indefinitely. This is why
        // scripts/encode-media.mjs writes new names (video1x-720.webm) rather
        // than overwriting the masters.
        source: "/videos/:path*",
        headers: [
          { key: "Cache-Control", value: `public, max-age=${YEAR}, immutable` },
        ],
      },
      {
        // Same reasoning for the raw images. Two of them are consumed outside
        // the next/image pipeline entirely — the hero plate is rendered
        // `unoptimized` so its bytes match what the splash preloaded, and
        // Feather.png is uploaded straight to the GPU as a texture — so
        // neither gets next/image's own content-hashed immutable URL. Without
        // this they revalidate on every single navigation.
        //
        // Same warning applies: these are versioned by filename, not by hash.
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: `public, max-age=${YEAR}, immutable` },
        ],
      },
    ];
  },
};

export default nextConfig;
