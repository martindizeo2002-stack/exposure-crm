// radar-propias-angulos.ts — completa el ángulo de las piezas propias (@alexmcarrera) hacia atrás, para cruzarlas con
// las agendas de cada día (Marketing → Tipos de agenda). El ciclo normal del Radar solo analiza los últimos 30 días y
// el link del video que da Apify vence: por eso las de agosto quedaron sin transcripción ni ángulo.
//
//   npx tsx scripts/radar-propias-angulos.ts lanzar [dias]     relee con Apify la pestaña de reels y la de posts
//   npx tsx scripts/radar-propias-angulos.ts procesar [desde]  transcribe y analiza las propias sin análisis desde esa fecha
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

// .env.local + el token de Instagram (no está en .env.local: vive en exposure-crm-secrets/ig-insights.env)
for (const archivo of [".env.local", "../exposure-crm-secrets/ig-insights.env"]) {
  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
  }
}

const HANDLE = "alexmcarrera"
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const [comando, arg] = process.argv.slice(2)
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } })
  const { lanzarReelsPropios, lanzarPiezas } = await import("../lib/radar/ingesta")
  const { leerCorrida } = await import("../lib/radar/apify")
  const { correrPaso } = await import("../lib/radar/ciclo")

  if (comando === "lanzar") {
    const dias = Number(arg) || 75
    for (const [nombre, lanzar] of [
      ["reels", () => lanzarReelsPropios(db, { handle: HANDLE, dias, limite: 200, pedidaPor: "ángulos de agendas" })],
      ["posts", () => lanzarPiezas(db, { cuentas: [HANDLE], dias, porCuenta: 200, pedidaPor: "ángulos de agendas" })],
    ] as const) {
      const r = await lanzar() as { ok: boolean; corrida?: string; motivo?: string }
      if (!r.ok) throw new Error(`${nombre}: ${r.motivo}`)
      const { data: corrida } = await db.from("radar_corridas").select("apify_run_id").eq("id", r.corrida).single()
      for (;;) {
        const run = await leerCorrida(corrida!.apify_run_id) as { status: string }
        process.stdout.write(`${nombre}: ${run.status}\n`)
        if (!["READY", "RUNNING"].includes(run.status)) break
        await espera(15000)
      }
      // el ciclo recoge la corrida terminada (y baja miniaturas y slides); hay que liberarla antes de lanzar la siguiente
      const c = await correrPaso(db, "ciclo", { pedidaPor: "ángulos de agendas", segundos: 200 })
      console.log(`${nombre} recogida:`, JSON.stringify(c).slice(0, 300))
    }
    return
  }

  if (comando === "graph") {
    // Fuente preferida para la cuenta propia (pedido de Alex, 10/10/2026): la API de Instagram trae todas las
    // publicaciones, sin el tope de la primera página de Apify, con el video y los slides originales.
    const desde = arg || "2026-07-25"
    const { sincronizarMediaPropia } = await import("../lib/radar/media-propia")
    const { get, resolverCuenta } = await import("../lib/radar/graph")
    const dias = Math.ceil((Date.now() - new Date(desde).getTime()) / 864e5) + 1
    const alta = await sincronizarMediaPropia(db, { dias })
    console.log("alta y métricas:", JSON.stringify(alta).slice(0, 300))
    const cuenta = await resolverCuenta()
    const media: Array<Record<string, unknown>> = []
    let despues = ""
    for (let pagina = 0; pagina < 10; pagina++) {
      const r = await get(cuenta.host, `${cuenta.id}/media`, { fields: "id,shortcode,media_type,media_product_type,media_url,timestamp", limit: "50", ...(despues ? { after: despues } : {}) })
      const datos = (r.data as Array<Record<string, unknown>> | undefined) || []
      media.push(...datos.filter((m) => String(m.timestamp) >= desde))
      const sig = ((r.paging as Record<string, unknown> | undefined)?.cursors as Record<string, unknown> | undefined)?.after
      if (!sig || !datos.length || String(datos[datos.length - 1].timestamp) < desde) break
      despues = String(sig)
    }
    const { data: piezas } = await db.from("radar_piezas").select("id,tipo_media,transcript,slides,slides_remotas,analisis").eq("cuenta_fuente", HANDLE).gte("fecha", desde)
    const porId = new Map((piezas || []).map((p) => [p.id, p]))
    let videos = 0, carruseles = 0
    for (const m of media) {
      const p = porId.get(`ig_${m.shortcode}`)
      if (!p || p.analisis) continue
      if (p.tipo_media === "reel" && !p.transcript && m.media_url) {
        await db.from("radar_piezas").update({ video_url: m.media_url, video_url_at: new Date().toISOString() }).eq("id", p.id)
        videos += 1
      }
      if (m.media_type === "CAROUSEL_ALBUM" && !p.slides && !p.slides_remotas) {
        const hijos = await get(cuenta.host, `${m.id}/children`, { fields: "media_url,thumbnail_url,media_type" })
        const urls = ((hijos.data as Array<Record<string, unknown>> | undefined) || []).map((h) => String(h.media_type === "VIDEO" ? h.thumbnail_url || "" : h.media_url || "")).filter(Boolean)
        if (urls.length) {
          await db.from("radar_piezas").update({ slides_remotas: urls }).eq("id", p.id)
          carruseles += 1
        }
      }
    }
    console.log(`${media.length} publicaciones por la API desde ${desde} · ${videos} reels con video · ${carruseles} carruseles con slides`)
    const c = await correrPaso(db, "ciclo", { pedidaPor: "ángulos de agendas", segundos: 240 })
    console.log("medios:", JSON.stringify((c as Record<string, unknown>).medios))
    return
  }

  if (comando === "procesar") {
    const desde = arg || "2026-07-25"
    const { analizarPieza, usoVacio } = await import("../lib/radar/analisis")
    const { transcribirUrl } = await import("../lib/radar/transcribir")
    const { leerBanco } = await import("../lib/radar/contexto")
    const { baselines } = await import("../lib/radar/metricas")
    const { data: piezas, error } = await db.from("radar_piezas").select("*").eq("cuenta_fuente", HANDLE).is("analisis", null).gte("fecha", desde).order("fecha")
    if (error) throw error
    const [banco, semillas, historia] = await Promise.all([
      leerBanco(db),
      db.from("radar_semillas").select("*").eq("handle", HANDLE).then((r) => r.data || []),
      db.from("radar_piezas").select("id,cuenta_fuente,fecha,views,likes,comentarios,fijado").eq("cuenta_fuente", HANDLE).limit(2000).then((r) => r.data || []),
    ])
    const medViews = baselines(historia as never).get(HANDLE)?.med_views ?? null
    const uso = usoVacio()
    let hechas = 0, fallidas = 0
    // de a 5 piezas en paralelo: cada análisis tarda alrededor de un minuto
    const cola = [...(piezas || [])]
    const trabajador = async () => { for (let p = cola.shift(); p; p = cola.shift()) await procesarUna(p) }
    const procesarUna = async (p: Record<string, any>) => {
      try {
        if (p.tipo_media === "reel" && !p.transcript && p.video_url) {
          const texto = await transcribirUrl(p.video_url).catch(() => null)
          if (texto !== null) {
            p.transcript = texto
            await db.from("radar_piezas").update({ transcript: texto, transcript_error: texto ? null : "sin voz" }).eq("id", p.id)
          }
        }
        const r = await analizarPieza(p as never, semillas[0] as never, medViews, banco, uso)
        const cambios: Record<string, unknown> = { analisis: r.analisis, objetivo: r.objetivo, analisis_at: new Date().toISOString(), analisis_error: null }
        if (r.guion) cambios.guion = r.guion
        if (r.lectura) cambios.lectura = r.lectura
        if (r.slides) cambios.slides = r.slides
        await db.from("radar_piezas").update(cambios).eq("id", p.id)
        hechas += 1
        console.log(`${String(p.fecha).slice(0, 10)} ${p.tipo_media} → ${(r.analisis as { angulo_bm_nombre?: string })?.angulo_bm_nombre}`)
      } catch (e) {
        fallidas += 1
        console.error(`${p.id}: ${(e as Error).message.slice(0, 200)}`)
      }
    }
    await Promise.all(Array.from({ length: 5 }, trabajador))
    console.log(`${hechas} analizadas · ${fallidas} fallidas de ${(piezas || []).length} · uso ${JSON.stringify(uso)}`)
    return
  }
  throw new Error("uso: npx tsx scripts/radar-propias-angulos.ts lanzar [dias] | procesar [desde]")
}

main().catch((e) => { console.error(e); process.exit(1) })
