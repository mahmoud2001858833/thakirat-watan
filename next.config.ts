import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // صور الصف (بعد ضغطها في المتصفح) وتسجيلات حتى 3 دقائق. حد Vercel للطلب 4.5MB
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};

export default nextConfig;
