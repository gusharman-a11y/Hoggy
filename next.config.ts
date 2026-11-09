import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Migrations are read from disk at runtime (src/db/migrate.ts), so ship them with every server route.
  outputFileTracingIncludes: { "/**/*": ["./src/db/migrations/*.sql"] },
};

export default nextConfig;
