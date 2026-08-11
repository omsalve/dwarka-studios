import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90, 100],
  },
  // Files under /public are served with `max-age=0` by default, so every
  // visit re-validates the splash videos before it can start playing them.
  // They are large and never change in place — cache them hard.
  //
  // NOTE: `immutable` means a browser that has one will not check for a new
  // version. Change the *filename* when you re-encode these, or returning
  // visitors will keep the old cut indefinitely.
  async headers() {
    return [
      {
        source: "/videos/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
