import type { NextConfig } from "next";

// e.g. "/bot" to serve the dashboard at jacksonmagnabosco.dev/bot. Empty = domain root (local dev).
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  ...(basePath && {
    basePath,
    // The domain root has no page of its own: send visitors to the dashboard (its login).
    redirects: async () => [{ source: "/", destination: basePath, basePath: false, permanent: false }],
  }),
};

export default nextConfig;
