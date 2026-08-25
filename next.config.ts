import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/", headers: securityHeaders }];
  },
};

export default nextConfig;
