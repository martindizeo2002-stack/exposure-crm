// atribucion-resumenes.ts — genera los eventos de contenido (crm_events content_replied) de agendas cuyo
// resumen_chat se cargó por fuera de la pantalla (p. ej. Central Negocio/scripts/whatsapp/setting-a-crm.py).
// Usa la misma función que /api/agendas al guardar un resumen, así que el resultado es idéntico.
//   npx tsx scripts/atribucion-resumenes.ts <ids.json>   (lista de ids de agenda)
//   npx tsx scripts/atribucion-resumenes.ts --desde 2026-08-01   (todas las agendas con resumen desde esa fecha)
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } })
  const { persistChatSummaryAttribution } = await import("../lib/chat-summary-attribution")
  const arg = process.argv[2]
  let consulta = db.from("agendas").select("id,person_id,fecha_agenda,created_at,resumen_chat").not("resumen_chat", "is", null)
  if (arg === "--desde") consulta = consulta.gte("fecha_agenda", process.argv[3])
  else if (arg) consulta = consulta.in("id", JSON.parse(readFileSync(arg, "utf8")))
  else throw new Error("uso: npx tsx scripts/atribucion-resumenes.ts <ids.json> | --desde AAAA-MM-DD")
  const { data, error } = await consulta
  if (error) throw error
  let total = { detected: 0, persisted: 0 }
  for (let i = 0; i < (data || []).length; i += 50) {
    const r = await persistChatSummaryAttribution(db, (data || []).slice(i, i + 50))
    total = { detected: total.detected + r.detected, persisted: total.persisted + r.persisted }
  }
  console.log(`${(data || []).length} agendas · ${total.detected} contactos con contenido detectados · ${total.persisted} eventos guardados`)
}

main().catch((e) => { console.error(e); process.exit(1) })
