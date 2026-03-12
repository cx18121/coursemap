/** @type {import('next').NextConfig} */
const nextConfig = {
  // node-ical uses native Node modules (node-rrule, BigInt) that Turbopack/webpack cannot bundle.
  // Mark it as an external so it's required at runtime from node_modules, not bundled.
  serverExternalPackages: ['node-ical'],
};

module.exports = nextConfig;
