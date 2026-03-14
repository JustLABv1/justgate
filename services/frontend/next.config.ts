import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("./package.json") as { version: string };

const backendURL = process.env.BACKEND_URL || "http://localhost:9090";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  async rewrites() {
    return [
      {
        source: "/app/:path*",
        destination: `${backendURL}/app/:path*`,
      },
    ];
  },
};

export default nextConfig;
