import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Migrations are read from disk at runtime (src/db/migrate.ts), so ship them with every server route.
  outputFileTracingIncludes: { "/**/*": ["./src/db/migrations/*.sql"] },
  // Receipt uploads are up to 10 MB (checked again in src/lib/receipt-uploads.ts); default is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
