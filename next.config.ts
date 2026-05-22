import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse depends on pdfjs-dist which loads its worker via dynamic import.
  // Bundling pdfjs-dist breaks that worker resolution. Leave it as an external
  // node_modules import so the worker file resolves at runtime.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  // Disable the floating Next.js dev indicator button — it has no end-user
  // function and clutters the UI in dev preview screenshots.
  devIndicators: false,
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
