import withPWA from "@ducanh2912/next-pwa";

/** Upstream del paquete hr-mcp-server (Streamable HTTP + OAuth). */
const MCP_UPSTREAM = (
  process.env.MCP_UPSTREAM_URL?.trim() || "http://127.0.0.1:4101"
).replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Binario nativo de ArcFace server-side: fuera del bundle de webpack.
    serverComponentsExternalPackages: ["onnxruntime-node"],
  },
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  /**
   * Expone MCP/OAuth en el mismo origen que la app (túnel :7578 / Cloudflare).
   * ChatGPT/Claude descubren OAuth en https://host/mcp sin apuntar al :4101.
   */
  async rewrites() {
    return [
      { source: "/mcp", destination: `${MCP_UPSTREAM}/mcp` },
      { source: "/mcp/:path*", destination: `${MCP_UPSTREAM}/mcp/:path*` },
      {
        source: "/.well-known/:path*",
        destination: `${MCP_UPSTREAM}/.well-known/:path*`,
      },
      { source: "/authorize", destination: `${MCP_UPSTREAM}/authorize` },
      { source: "/token", destination: `${MCP_UPSTREAM}/token` },
      { source: "/register", destination: `${MCP_UPSTREAM}/register` },
      { source: "/revoke", destination: `${MCP_UPSTREAM}/revoke` },
      { source: "/health/mcp", destination: `${MCP_UPSTREAM}/health` },
    ];
  },
  // Evita EMFILE de inotify: polling + ignorar árboles pesados.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
        ignored:
          /node_modules|\.git|\.next|openspec|\.atl|scripts|tsbuildinfo|packages\/marketing/,
      };
    }
    return config;
  },
};

const config = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  extendDefaultRuntimeCaching: true,
  /**
   * MediaPipe + ArcFace ONNX + ORT WASM. Precargarlos al instalar el SW
   * forzaría ~30 MB; se cachean al primer uso.
   */
  publicExcludes: ["!noprecache/**/*", "!models/**/*", "!ort/**/*", "!mediapipe/**/*"],
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /\/(models|ort|mediapipe)\/.+\.(onnx|wasm|mjs|bin|json|task)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "face-engine",
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 90 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})(nextConfig);

export default config;
