// Público de Meta «Agendas pendientes»: solo las personas con una llamada agendada que todavía no ocurrió.
// Pedido de Alex del 13/10/2026 para retargeting de show-up. Lo reconcilia /api/hammer-audience-sync cada 15 minutos:
// arma la lista que tiene que haber, sube a quien falta y saca a quien ya tuvo la llamada o la canceló.
// El estado (id del público y las filas subidas de cada persona) vive en crm_integration_assets, así se puede
// sacar a alguien con las mismas filas con las que entró. A Meta solo llegan datos con hash SHA-256.
import crypto from "node:crypto"
import { shouldRemainInHammerAudience } from "@/lib/meta-hammer-audience"

const API = "https://graph.facebook.com/v23.0"
const ESTADO = { source: "meta", asset_type: "audiencia", source_id: "agendas-pendientes" }
const NOMBRE = "EXPOSURE · Agendas pendientes (sync CRM)"
const SCHEMA = ["EMAIL", "PHONE", "FN", "LN"]
const LOTE = 50

type Fila = string[]
type Estado = { audience_id?: string; miembros?: Record<string, Fila[]>; ultima?: Record<string, unknown> }
type DB = { from: (t: string) => any }

const sha = (v: string) => (v ? crypto.createHash("sha256").update(v).digest("hex") : "")
const limpiarNombre = (v: string) => v.normalize("NFC").toLowerCase().replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " ").trim()

// Variantes de celular que Meta puede tener guardadas: Argentina con y sin el 9, México con y sin el 1.
export function variantesTelefono(crudo: unknown): string[] {
  const d = String(crudo || "").replace(/\D/g, "").replace(/^00/, "")
  if (d.length < 8) return []
  const out = new Set([d])
  if (/^54\d{10}$/.test(d)) out.add(`549${d.slice(2)}`)
  if (/^549\d{10}$/.test(d)) out.add(`54${d.slice(3)}`)
  if (/^52\d{10}$/.test(d)) out.add(`521${d.slice(2)}`)
  if (/^521\d{10}$/.test(d)) out.add(`52${d.slice(3)}`)
  return [...out]
}

export function filasDePersona(p: { email?: unknown; telefono?: unknown; nombre?: unknown }): Fila[] {
  const email = String(p.email || "").trim().toLowerCase()
  const partes = limpiarNombre(String(p.nombre || "")).split(" ").filter(Boolean)
  const fn = sha(partes[0] || ""), ln = sha(partes.length > 1 ? partes[partes.length - 1] : "")
  const tels = variantesTelefono(p.telefono)
  if (!email && !tels.length) return []
  return (tels.length ? tels : [""]).map((t) => [sha(email), sha(t), fn, ln])
}

async function meta(ruta: string, metodo: "GET" | "POST" | "DELETE", params: Record<string, string>) {
  const token = process.env.META_ADS_ACCESS_TOKEN
  if (!token) throw new Error("falta META_ADS_ACCESS_TOKEN")
  const qs = new URLSearchParams({ ...params, access_token: token })
  const r = metodo === "POST"
    ? await fetch(`${API}/${ruta}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs })
    : await fetch(`${API}/${ruta}?${qs}`, { method: metodo })
  const j = await r.json().catch(() => null)
  if (!r.ok || j?.error) {
    const e = j?.error || {}
    throw new Error(`Meta ${r.status}: ${e.error_user_msg || e.message || "error"}`)
  }
  return j
}

async function leerEstado(db: DB): Promise<Estado> {
  const { data } = await db.from("crm_integration_assets").select("metadata").match(ESTADO).maybeSingle()
  return (data?.metadata || {}) as Estado
}

async function guardarEstado(db: DB, estado: Estado) {
  const { error } = await db.from("crm_integration_assets").upsert(
    { ...ESTADO, name: NOMBRE, metadata: estado, last_seen_at: new Date().toISOString() },
    { onConflict: "source,asset_type,source_id" },
  )
  if (error) throw new Error(error.message)
}

// Crea el público la primera vez. Exige que la cuenta haya aceptado las Condiciones de los públicos personalizados.
async function asegurarPublico(estado: Estado) {
  if (estado.audience_id) return estado.audience_id
  const cuenta = String(process.env.META_ADS_ACCOUNT_ID || "").replace(/^act_/, "")
  if (!cuenta) throw new Error("falta META_ADS_ACCOUNT_ID")
  const r = await meta(`act_${cuenta}/customaudiences`, "POST", {
    name: NOMBRE,
    subtype: "CUSTOM",
    customer_file_source: "USER_PROVIDED_ONLY",
    description: "Personas con llamada agendada que todavía no ocurrió. La sincroniza el CRM cada 15 minutos: entra al agendar, sale cuando termina la llamada o se cancela. No editar a mano.",
  })
  return String(r.id)
}

// Quiénes tienen que estar: agenda no cancelada ni archivada cuya llamada (hora de Argentina + 1 h) todavía no terminó.
async function personasPendientes(db: DB, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 6 * 3600e3 - 3 * 3600e3).toISOString().slice(0, 19)   // pared ART con margen
  const { data, error } = await db.from("agendas")
    .select("id,person_id,nombre,email,telefono,fecha_closer,estado,call_confirmer,cerro,crm_people(primary_email)")
    .gte("fecha_closer", desde)
  if (error) throw new Error(error.message)
  const porPersona = new Map<string, { filas: Fila[]; nombre: string; llamada: string }>()
  for (const a of (data || []) as any[]) {
    if (a.cerro === true || !shouldRemainInHammerAudience(a, ahora)) continue
    const email = a.email || a.crm_people?.primary_email
    const filas = filasDePersona({ email, telefono: a.telefono, nombre: a.nombre })
    if (!filas.length) continue
    const clave = a.person_id ? `p:${a.person_id}` : `t:${variantesTelefono(a.telefono)[0] || ""}|e:${String(email || "").toLowerCase()}`
    if (!porPersona.has(clave)) porPersona.set(clave, { filas, nombre: String(a.nombre || ""), llamada: String(a.fecha_closer || "") })
  }
  return porPersona
}

export async function sincronizarAudienciaPendientes(db: DB, opciones: { prueba?: boolean } = {}) {
  const estado = await leerEstado(db)
  const deseadas = await personasPendientes(db)
  const actuales = estado.miembros || {}
  const entran = [...deseadas.keys()].filter((k) => !actuales[k])
  const salen = Object.keys(actuales).filter((k) => !deseadas.has(k))
  const resumen = {
    pendientes: deseadas.size,
    entran: entran.length,
    salen: salen.length,
    personas: [...deseadas.values()].map((p) => ({ nombre: p.nombre, llamada: p.llamada })),
  }
  if (opciones.prueba) return { ok: true, prueba: true, audience_id: estado.audience_id || null, ...resumen }

  const audienceId = await asegurarPublico(estado)
  estado.audience_id = audienceId
  const miembros = { ...actuales }
  const subir = async (claves: string[], metodo: "POST" | "DELETE", filasDe: (k: string) => Fila[]) => {
    const filas = claves.flatMap((k) => filasDe(k).map((f) => ({ k, f })))
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE)
      await meta(`${audienceId}/users`, metodo, { payload: JSON.stringify({ schema: SCHEMA, data: lote.map((x) => x.f) }) })
    }
  }
  await subir(entran, "POST", (k) => deseadas.get(k)!.filas)
  for (const k of entran) miembros[k] = deseadas.get(k)!.filas
  await subir(salen, "DELETE", (k) => actuales[k])
  for (const k of salen) delete miembros[k]

  estado.miembros = miembros
  estado.ultima = { at: new Date().toISOString(), pendientes: deseadas.size, entraron: entran.length, salieron: salen.length }
  await guardarEstado(db, estado)
  return { ok: true, audience_id: audienceId, ...resumen }
}
