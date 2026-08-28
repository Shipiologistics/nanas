import type { NextConfig } from "next";

const cloudinaryCloudName =
  process.env.CLOUDINARY_CLOUD_NAME ??
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: cloudinaryCloudName
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: "res.cloudinary.com",
            pathname: `/${cloudinaryCloudName}/image/upload/**`,
          },
        ],
      }
    : undefined,
};

export default nextConfig;
