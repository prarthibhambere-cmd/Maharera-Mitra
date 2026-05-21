import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse depends on pdfjs-dist which loads its worker via dynamic import.
  // Bundling pdfjs-dist breaks that worker resolution. Leave it as an external
  // node_modules import so the worker file resolves at runtime.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
