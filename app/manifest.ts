import type { MetadataRoute } from "next"

// Next.js App Router metadata file convention: esto genera automáticamente
// /manifest.webmanifest servido en el edge, sin pasar por el middleware de
// autenticación (queda excluido explícitamente en middleware.ts config).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRM Base CRM",
    short_name: "CRM Base CRM",
    description: "Centro de operación comercial: agendas, pagos, cobranza, leaderboard y finanzas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg?v=2", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
