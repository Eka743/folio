/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === "development";
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://127.0.0.1:17392 http://127.0.0.1:17391 http://localhost:3000 https://localhost:3000",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

if (!isDevelopment) {
  // Do not teach browsers to upgrade the plain HTTP localhost development app.
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        // Loopback bridge must stay reachable: connect-src allows https and
        // http loopback explicitly; nothing else is whitelisted globally.
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
