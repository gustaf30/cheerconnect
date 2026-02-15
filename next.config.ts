import type { NextConfig } from "next";

// --- Content Security Policy (built from parts for readability) ---
const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",

  // 'unsafe-inline': Required by Next.js for inline scripts
  // 'unsafe-eval': Required in dev for Fast Refresh / hot-reload
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,

  // 'unsafe-inline': Required for Tailwind/CSS-in-JS
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

  "font-src 'self' https://fonts.gstatic.com",
  [
    "img-src 'self'",
    "https://res.cloudinary.com",
    "https://i.pravatar.cc",
    "https://picsum.photos",
    "https://fastly.picsum.photos",
    "https://api.dicebear.com",
    "https://lh3.googleusercontent.com",
    // blob: Used for image previews before upload
    "data: blob:",
  ].join(" "),
  "media-src 'self' https://res.cloudinary.com",
  "connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com https://servicodados.ibge.gov.br https://vitals.vercel-analytics.com https://va.vercel-scripts.com",

  // Prevents clickjacking by restricting who can embed this site in an iframe
  "frame-ancestors 'self'",

  "base-uri 'self'",
  "form-action 'self'",
];

const cspValue = cspDirectives.join("; ") + ";";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: cspValue,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
