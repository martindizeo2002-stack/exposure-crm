import { RadarEmbed } from "@/components/radar-embed"

export const dynamic = "force-dynamic"
export const metadata = { title: "Radar de contenido | Exposure OS" }

// Marketing → Radar: las cuentas de Instagram que seguimos, lo que publican (reels, carruseles, posts e
// historias) con sus métricas, el análisis de cada pieza y la versión para EXPOSURE.
export default function RadarPage() {
  return <RadarEmbed />
}
