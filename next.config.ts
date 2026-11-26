import type { NextConfig } from "next";

/**
 * Static export for Cloudflare Pages (architecture decision #1).
 * No server runtime: no Server Actions, no API routes, no middleware.
 * Live features run in the browser against Supabase RLS/RPCs; secrets live
 * only in Cloudflare Pages Functions (functions/api/*).
 *
 * Client-only dynamic routes (/exams/:id, /attempts/:id, /certificates/:id)
 * are exported once as a shell at /<route>/_/ and mapped by public/_redirects
 * on Cloudflare. `next dev` does not read _redirects, so the same mapping is
 * mirrored here as dev-only rewrites.
 */
const isDev = process.env.NODE_ENV === "development";

const CLIENT_SHELL_ROUTES = ["exams", "attempts", "certificates"] as const;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  ...(isDev
    ? {
        async rewrites() {
          return CLIENT_SHELL_ROUTES.map((r) => ({ source: `/${r}/:id((?!_$)[^/]+)/`, destination: `/${r}/_/` }));
        },
      }
    : {}),
};

export default nextConfig;
