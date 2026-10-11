// ads-creativos.ts — transcribe los videos de los anuncios (Follow Me Ads) para poder leer de qué habla cada creativo.
// Los anuncios son publicaciones solo de anuncio de @alexmcarrera: el video se pide por la API de Instagram
// (effective_instagram_media_id → media_url) y se transcribe con el motor del Radar (Groq).
//   npx tsx scripts/ads-creativos.ts "<Central Negocio>/datos/ads"
// Lee anuncios.json y anuncios-dia.json de esa carpeta y escribe creativos.json (no repite lo ya transcripto).
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

for (const archivo of [".env.local", "../exposure-crm-secrets/ig-insights.env"]) {
  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
  }
}

async function main() {
  const carpeta = process.argv[2]
  if (!carpeta) throw new Error("uso: npx tsx scripts/ads-creativos.ts <carpeta datos/ads>")
  const { transcribirUrl } = await import("../lib/radar/transcribir")
  const anuncios = JSON.parse(readFileSync(join(carpeta, "anuncios.json"), "utf8")) as Array<Record<string, any>>
  const dias = JSON.parse(readFileSync(join(carpeta, "anuncios-dia.json"), "utf8")) as Array<Record<string, any>>
  const conGasto = new Set(dias.filter((d) => d.spend > 0).map((d) => d.ad_id))
  const salida = join(carpeta, "creativos.json")
  const hechos: Record<string, any> = existsSync(salida) ? JSON.parse(readFileSync(salida, "utf8")) : {}
  for (const a of anuncios) {
    if (!conGasto.has(a.id) || !String(a.campana || "").startsWith("FM ADS") || hechos[a.id]?.transcripcion) continue
    const item: Record<string, any> = { nombre: a.nombre, texto: a.texto, ig_media: a.ig_media }
    if (a.ig_media) {
      const r = await fetch(`https://graph.facebook.com/v21.0/${a.ig_media}?` + new URLSearchParams({ fields: "media_url,permalink", access_token: process.env.IG_INSIGHTS_TOKEN || "" }))
      const m = await r.json() as Record<string, any>
      item.permalink = m.permalink || null
      if (m.media_url) {
        try { item.transcripcion = await transcribirUrl(m.media_url) } catch (e) { item.error = (e as Error).message.slice(0, 200) }
      } else item.error = "sin video en la API"
    }
    hechos[a.id] = item
    console.log(`${a.nombre}: ${item.transcripcion ? `${String(item.transcripcion).length} caracteres` : item.error}`)
  }
  writeFileSync(salida, JSON.stringify(hechos, null, 1))
}

main().catch((e) => { console.error(e); process.exit(1) })
