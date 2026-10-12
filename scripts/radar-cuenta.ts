// radar-cuenta.ts — suma una cuenta al Radar (con historias) y la lee a fondo de una vez: reels y posts de los últimos
// `dias`, perfil e historias activas. Después el ciclo normal transcribe y analiza. Pedido de Alex del 12/10/2026
// («analizá la estrategia de este creador en los últimos 30 días y sumalo a mi tracker de historias»).
//
//   npx tsx scripts/radar-cuenta.ts <handle> [dias=30] [tope=60]
//   npx tsx scripts/radar-cuenta.ts <handle> --solo-ciclo      corre el ciclo (transcribir + analizar) sin leer de nuevo
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const [handleCrudo, diasTxt, topeTxt] = process.argv.slice(2)
  const handle = String(handleCrudo || "").replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/[/?].*$/, "").toLowerCase()
  if (!handle) throw new Error("uso: npx tsx scripts/radar-cuenta.ts <handle> [dias] [tope]")
  const soloCiclo = process.argv.includes("--solo-ciclo")
  const dias = Number(diasTxt) || 30
  const tope = Number(topeTxt) || 60
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } })
  const { ACTORES, lanzarActor, leerCorrida, presupuesto } = await import("../lib/radar/apify")
  const { correrPaso } = await import("../lib/radar/ciclo")

  const ciclo = async (nombre: string) => {
    const r = await correrPaso(db, "ciclo", { pedidaPor: `cuenta ${handle}`, segundos: 240 })
    console.log(`${nombre} · ciclo:`, JSON.stringify(r).slice(0, 400))
  }

  if (!soloCiclo) {
    console.log("Apify:", JSON.stringify(await presupuesto()))
    // 1) semilla con historias activadas (si ya estaba pausada, se reactiva)
    const { data: ya } = await db.from("radar_semillas").select("handle,activa,historias").eq("handle", handle).maybeSingle()
    if (!ya) {
      const { error } = await db.from("radar_semillas").insert({ handle, tags: ["referente"], historias: true, activa: true, creado_por: "Claude (pedido de Alex)", nota: `Sumada el ${new Date().toISOString().slice(0, 10)}: estrategia de los últimos ${dias} días, ángulos y avatar.` })
      if (error) throw new Error(error.message)
      console.log(`semilla: @${handle} sumada con historias`)
    } else {
      await db.from("radar_semillas").update({ activa: true, historias: true }).eq("handle", handle)
      console.log(`semilla: @${handle} ya estaba (activa y con historias)`)
    }

    // 2) lecturas puntuales de esta cuenta, una por vez (el ciclo recoge cada una antes de lanzar la siguiente)
    const lecturas: Array<{ tipo: string; actor: string; input: unknown; detalle?: unknown; segundos?: number }> = [
      { tipo: "piezas", actor: ACTORES.piezas(), input: { directUrls: [`https://www.instagram.com/${handle}/reels/`], resultsType: "reels", resultsLimit: tope, onlyPostsNewerThan: `${dias} days`, addParentData: false }, detalle: { resultsType: "reels", dias } },
      { tipo: "piezas", actor: ACTORES.piezas(), input: { directUrls: [`https://www.instagram.com/${handle}/`], resultsType: "posts", resultsLimit: tope, onlyPostsNewerThan: `${dias} days`, addParentData: false }, detalle: { resultsType: "posts", dias } },
      { tipo: "perfiles", actor: ACTORES.perfiles(), input: { usernames: [handle] }, segundos: 600 },
      { tipo: "historias", actor: ACTORES.historias(), input: { usernames: [handle] }, segundos: 900 },
    ]
    for (const l of lecturas) {
      const run = await lanzarActor(l.actor, l.input, { segundos: l.segundos })
      const { error } = await db.from("radar_corridas").insert({ tipo: l.tipo, actor: l.actor, apify_run_id: run.id, apify_dataset_id: run.defaultDatasetId, cuentas: [handle], pedida_por: `cuenta ${handle}`, detalle: l.detalle || null })
      if (error) throw new Error(error.message)
      for (;;) {
        const r = await leerCorrida(run.id) as { status: string }
        if (!["READY", "RUNNING"].includes(r.status)) { console.log(`${l.tipo}: ${r.status}`); break }
        await espera(15000)
      }
      await ciclo(l.tipo)
    }
  }

  // 3) transcribir y analizar lo nuevo (el ciclo hace un poco por vez: se repite mientras quede trabajo)
  for (let i = 0; i < 8; i++) {
    const { count } = await db.from("radar_piezas").select("id", { count: "exact", head: true }).eq("cuenta_fuente", handle).is("analisis", null)
    console.log(`pendientes de análisis: ${count}`)
    if (!count) break
    await ciclo(`vuelta ${i + 1}`)
  }
  const { data: piezas } = await db.from("radar_piezas").select("id,tipo_media,fecha,views").eq("cuenta_fuente", handle).order("fecha", { ascending: false })
  console.log(`@${handle}: ${piezas?.length || 0} piezas guardadas`)
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
