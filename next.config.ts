import type { NextConfig } from "next";

const allowedDevOrigins = (
  process.env.NEXT_DEV_ALLOWED_ORIGINS ??
  "localhost,127.0.0.1,100.105.126.106"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";

function buildContentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https: wss:${isProduction ? "" : " http: ws:"}`,
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "manifest-src 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

function buildSecurityHeaders() {
  const headers = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(),
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "off",
    },
    {
      key: "X-Permitted-Cross-Domain-Policies",
      value: "none",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=()",
    },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  allowedDevOrigins,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
