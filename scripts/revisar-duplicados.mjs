// revisar-duplicados.mjs — busca agendas duplicadas en el CRM. SOLO LECTURA: no modifica nada.
//   node scripts/revisar-duplicados.mjs            (últimos 60 días por fecha de llamada)
//   node scripts/revisar-duplicados.mjs 2026-09-01 (desde esa fecha)
// Agrupa las agendas no archivadas por persona, teléfono e Instagram, y avisa cuando una misma
// persona tiene más de una agenda el mismo día (duplicado casi seguro) o en el período (revisar:
// puede ser una reprogramación legítima).
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }),
)
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || key.length < 40) { console.error("Falta la SUPABASE_SERVICE_ROLE_KEY real en .env.local"); process.exit(1) }
const sb = createClient(url, key)

const desde = process.argv[2] || new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)
const filas = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("agendas")
    .select("id,person_id,nombre,telefono,instagram,fecha_closer,fecha_agenda,closer,estado,show,cerro,created_at")
    .gte("fecha_closer", `${desde}T00:00:00`).or("estado.is.null,estado.neq.Archivada manualmente")
    .order("fecha_closer").range(from, from + 999)
  if (error) { console.error(error.message); process.exit(2) }
  filas.push(...data)
  if (data.length < 1000) break
}

const tel = t => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-10) : "" }
const ig = i => String(i || "").trim().replace(/^@/, "").toLowerCase()
// Une por persona, teléfono o Instagram (si dos agendas comparten cualquiera, son la misma persona).
const padre = new Map()
const raiz = x => { while (padre.get(x) !== x) x = padre.get(x); return x }
const unir = (a, b) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) padre.set(rb, ra) }
const porClave = new Map()
for (const f of filas) {
  padre.set(f.id, f.id)
  for (const k of [f.person_id && `p:${f.person_id}`, tel(f.telefono) && `t:${tel(f.telefono)}`, ig(f.instagram).length >= 3 && `i:${ig(f.instagram)}`].filter(Boolean)) {
    if (porClave.has(k)) unir(porClave.get(k), f.id); else porClave.set(k, f.id)
  }
}
const grupos = new Map()
for (const f of filas) { const r = raiz(f.id); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(f) }

const mismoDia = [], periodo = []
for (const g of grupos.values()) {
  if (g.length < 2) continue
  const dias = new Map()
  for (const f of g) { const d = String(f.fecha_closer || "").slice(0, 10); dias.set(d, (dias.get(d) || 0) + 1) }
  ;([...dias.values()].some(n => n > 1) ? mismoDia : periodo).push(g)
}
const linea = f => `    #${f.id} · ${f.nombre} · ${String(f.fecha_closer || "").slice(0, 16).replace("T", " ")} · ${f.closer || "sin closer"} · ${f.estado || (f.show === true ? "show" : f.show === false ? "no show" : "pendiente")}${f.cerro ? " · CERRÓ" : ""} · tel ${f.telefono || "-"} · ig ${f.instagram || "-"}`
console.log(`Agendas no archivadas desde ${desde}: ${filas.length}`)
console.log(`\nDUPLICADOS EL MISMO DÍA (casi seguro, revisar y archivar el sobrante): ${mismoDia.length}`)
for (const g of mismoDia) { console.log(`  · ${g[0].nombre} (${g.length})`); g.forEach(f => console.log(linea(f))) }
console.log(`\nMISMA PERSONA, VARIAS AGENDAS EN EL PERÍODO (puede ser reprogramación): ${periodo.length}`)
for (const g of periodo) { console.log(`  · ${g[0].nombre} (${g.length})`); g.forEach(f => console.log(linea(f))) }
