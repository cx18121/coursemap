import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical uses native Node modules (node-rrule, BigInt) that Turbopack/webpack cannot bundle.
  // Mark it as an external so it's required at runtime from node_modules, not bundled.
  serverExternalPackages: ['node-ical'],
};

export default nextConfig;
