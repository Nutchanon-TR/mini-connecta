import type { NextConfig } from 'next';

const config: NextConfig = {
  // The dev badge otherwise covers the profile button at the bottom of Discover.
  devIndicators: false,
  // A reused dev cache caused an HMR reload loop after a restart.
  experimental: { turbopackFileSystemCacheForDev: false },
};

export default config;
