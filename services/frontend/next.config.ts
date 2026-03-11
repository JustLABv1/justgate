import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
