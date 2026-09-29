/** @type {import('next').NextConfig} */
// upgrade-insecure-requests solo cuando la app corre en https: en localhost
// (http) el navegador intentaba subir a https y fallaba un recurso por página.
// sharp (reduce las imágenes del Radar) es un módulo nativo: con pnpm sus binarios de Linux quedan en
// node_modules/.pnpm y el empaquetado de las funciones no los encuentra solo. Se los incluye a mano en las
// dos rutas que bajan imágenes.
const SHARP_LINUX = ["./node_modules/.pnpm/@img+sharp-linux*/**/*", "./node_modules/.pnpm/@img+sharp-libvips-linux*/**/*", "./node_modules/.pnpm/sharp@*/**/*"]

const nextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/radar-sync": SHARP_LINUX,
    "/api/radar/accion": SHARP_LINUX,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; media-src 'self' blob:; worker-src 'self' blob:" + (process.env.NEXT_PUBLIC_APP_URL?.startsWith("https") ? "; upgrade-insecure-requests" : "") },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      ],
    }, {
      // El Panel del negocio (public/panel) se muestra adentro de un iframe
      // del propio CRM: solo acá se permite el embebido, y solo desde el
      // mismo origen. El micrófono es para el Service JARVIS.
      source: "/panel/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
      ],
    }, {
      // El Radar de contenido (public/radar/index.html) también va adentro de un iframe del CRM. Solo ese
      // archivo: la página /radar que lo contiene sigue con la política general. Las miniaturas salen del
      // bucket de Supabase (https) y la tipografía Inter, de Google Fonts.
      source: "/radar/index.html",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; media-src 'self' blob:" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    }]
  },
}

export default nextConfig
