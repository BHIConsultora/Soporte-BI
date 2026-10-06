import type { NextConfig } from "next";
import { assertDemoModeAllowed } from "./src/infra/demo-guard";

// Corta el build si alguien deja DEMO_MODE=true en el entorno de producción de Vercel.
assertDemoModeAllowed(process.env);

/** Headers de seguridad para todo (la CSP con nonce la pone `src/proxy.ts`). */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Las respuestas de la API son JSON o descargas: no cargan nada.
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }] },
    ];
  },
};

export default nextConfig;
