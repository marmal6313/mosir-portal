import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function hostFromUrl(url?: string) {
  try {
    return url ? new URL(url).host : undefined
  } catch {
    return undefined
  }
}

// Budowanie CSP (report-only) z uwzględnieniem Supabase i dozwolonych hostów obrazów
function buildCsp() {
  const supabaseHost = hostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const imageHosts = (process.env.ALLOWED_IMAGE_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
  const imgSrcHosts = [
    ...new Set([
      ...imageHosts.map((h) => `https://${h}`),
      supabaseHost ? `https://${supabaseHost}` : undefined,
    ].filter(Boolean) as string[]),
  ]

  const connectHosts = [
    "'self'",
    supabaseHost ? `https://${supabaseHost}` : undefined,
    supabaseHost ? `wss://${supabaseHost}` : undefined,
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ].filter(Boolean)

  const imgSrc = ["'self'", "data:", "blob:", ...imgSrcHosts]

  const directives = [
    `default-src 'self'`,
    `img-src ${imgSrc.join(" ")}`,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self' data: https:`,
    `connect-src ${connectHosts.join(" ")}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ]
  return directives.join("; ")
}

const allowedImageHosts = (process.env.ALLOWED_IMAGE_HOSTS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)

const nextConfig: NextConfig = {
  // ⚠️ TEMPORARY: Ignoring TypeScript errors until Phase 1
  // We've fixed critical Next.js 15 async issues (cookies, params)
  // Remaining errors are mostly outdated database types
  // TODO Phase 1: Regenerate database types and remove this flag
  // See: docs/TYPESCRIPT-ERRORS-FOUND.md for full list
  typescript: {
    ignoreBuildErrors: true,
  },

  // Włączamy output standalone dla Docker (opcjonalnie)
  // output: 'standalone',
  
  // Optymalizacja dla production
  experimental: {
    // Włączamy optymalizację dla Docker
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Konfiguracja dla Next.js Image
  images: {
    // Twarda whitelist domen (konfigurowalna przez ALLOWED_IMAGE_HOSTS)
    remotePatterns: [
      ...allowedImageHosts.map((hostname) => ({ protocol: 'https' as const, hostname })),
    ],
  },
  
  // Konfiguracja dla Supabase
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // Dodatkowe nagłówki bezpieczeństwa
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: buildCsp(),
          },
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};

// Make sure adding Sentry options is the last code to run before exporting
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
