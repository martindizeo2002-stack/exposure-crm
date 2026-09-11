// Espejo unidireccional CRM → Google Sheet "CRM CENTRAL 2026".
// Cada pago y cada agenda del CRM se escribe en la pestaña del mes que le corresponde
// (💰 PAGOS <MES> / 📆 AGENDAS <MES>), en la misma fila donde ya estaba si fue importada
// del sheet, o en la primera fila libre si nació en el CRM. El mapa fila ↔ registro vive en
// crm_integration_assets (source = "gsheet"). Nunca lee del sheet hacia el CRM.
import { createHash } from "node:crypto"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { a1, clearValues, columnLetter, duplicateTab, getValues, listTabs, sheetsConfigured, writeValues, type SheetTab } from "@/lib/google-sheets"

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]
const MES_CAP = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

type Kind = "pagos" | "agendas"
const PREFIJO: Record<Kind, string> = { pagos: "PAGOS", agendas: "AGENDAS" }
const TITULO: Record<Kind, string> = { pagos: "💰 PAGOS", agendas: "📆 AGENDAS" }
const ASSET: Record<Kind, string> = { pagos: "pago", agendas: "agenda" }
// Columna (0-based) que define si una fila está ocupada: Nombre Cliente (I) en pagos, Nombres (A) en agendas.
const COL_OCUPADA: Record<Kind, number> = { pagos: 8, agendas: 0 }
const PRIMERA_FILA_DATOS = 3

export type ResultadoEspejo = {
  ok: boolean
  motivo?: string
  agregados: number
  actualizados: number
  sinCambios: number
  historicosSinMapa: number
  pestanasCreadas: string[]
  errores: string[]
  hasta?: string
}

type Registro = Record<string, unknown> & { id: string; created_at: string; updated_at: string }
type Mapa = { tab: string; row: number; hash?: string; ym?: string }

function normTitulo(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().toUpperCase()
}

function texto(v: unknown): string {
  if (v === null || v === undefined) return ""
  const s = String(v)
  return /^[=+\-@']/.test(s) ? `'${s}` : s
}

function numero(v: unknown): number | "" {
  if (v === null || v === undefined || v === "") return ""
  const n = Number(v)
  return Number.isFinite(n) ? n : ""
}

function fecha(v: unknown): string {
  if (!v) return ""
  const s = String(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (!m) return s
  const base = `${m[3]}/${m[2]}/${m[1]}`
  return m[4] && !(m[4] === "00" && m[5] === "00") ? `${base} ${m[4]}:${m[5]}` : base
}

function mesDe(v: unknown, fallback: string): string {
  const s = v ? String(v) : ""
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : fallback.slice(0, 7)
}

function bandera(v: unknown): number {
  return v === true || v === 1 || v === "1" || v === "true" ? 1 : 0
}

// Pestaña del mes: "💰 PAGOS AGOSTO", "💰 PAGOS FEB", "💰 PAGOS ABRIL 2026", "📆 AGENDAS Junio"…
// La pestaña sin mes ("💰 PAGOS") es la del mes en curso.
export function pestanaDelMes(tabs: SheetTab[], kind: Kind, ym: string, hoy: string): SheetTab | null {
  const [y, m] = ym.split("-").map(Number)
  const mes = MESES[m - 1]
  const pref = PREFIJO[kind]
  const candidatas = tabs.filter(t => normTitulo(t.title).startsWith(pref))
  const conMes = candidatas.find(t => {
    const resto = normTitulo(t.title).slice(pref.length).trim().split(" ").filter(Boolean)
    const tok = resto[0] || ""
    const anio = resto.find(x => /^\d{4}$/.test(x))
    return tok.length >= 3 && mes.startsWith(tok) && (!anio || Number(anio) === y)
  })
  if (conMes) return conMes
  if (ym === hoy.slice(0, 7)) return candidatas.find(t => normTitulo(t.title) === pref) || null
  return null
}

async function crearPestana(tabs: SheetTab[], kind: Kind, ym: string, hoy: string): Promise<SheetTab> {
  const [, m] = ym.split("-").map(Number)
  const candidatas = tabs.filter(t => normTitulo(t.title).startsWith(PREFIJO[kind]))
  const fuente = pestanaDelMes(tabs, kind, hoy, hoy) || candidatas.sort((a, b) => a.index - b.index)[0]
  if (!fuente) throw new Error(`No hay ninguna pestaña ${TITULO[kind]} para duplicar`)
  const titulo = `${TITULO[kind]} ${MESES[m - 1]}`
  const nueva = await duplicateTab(fuente.sheetId, titulo, fuente.index)
  // se limpian solo las columnas que escribe el espejo, desde la primera fila de datos
  const [desde, hasta] = kind === "pagos" ? ["E", "W"] : ["A", "AJ"]
  await clearValues(a1(nueva.title, `${desde}${PRIMERA_FILA_DATOS}:${hasta}`))
  tabs.push(nueva)
  return nueva
}

function filaPago(p: Registro): Array<{ desde: number; valores: unknown[] }> {
  const ym = mesDe(p.fecha, p.created_at)
  const anulado = Boolean(p.voided_at) || (p.record_status && p.record_status !== "active")
  const tipo = anulado ? `ANULADO · ${p.tipo || ""}` : (p.tipo as string) || ""
  return [{
    desde: 4, valores: [
      MES_CAP[Number(ym.slice(5, 7)) - 1] || "", fecha(p.fecha), fecha(p.fecha_alta), fecha(p.fecha_baja), texto(p.cliente), texto(p.telefono),
      texto(tipo), texto(p.operacion), texto(p.closer), texto(p.setter), texto(p.calificacion), anulado ? 0 : numero(p.monto), anulado ? 0 : numero(p.cc_ars),
      texto(p.comprobante), texto(p.ppp), texto(p.fuente), texto(p.contenido_contestado), texto(p.medio_de_pago), numero(p.tipo_cambio_usd),
    ],
  }]
}

function filaAgenda(a: Registro): Array<{ desde: number; valores: unknown[] }> {
  const ig = a.instagram ? (String(a.instagram).startsWith("@") ? String(a.instagram) : `@${a.instagram}`) : ""
  return [
    { desde: 0, valores: [texto(a.nombre), texto(a.telefono), texto(ig), fecha(a.fecha_agenda), fecha(a.fecha_closer), fecha(a.fecha_lead), texto(a.edad), texto(a.closer)] },
    { desde: 9, valores: [
      texto(a.setter), texto(a.calificacion), texto(a.fuente), texto(a.resumen_chat), texto(a.call_confirmer), texto(a.info_call_triage),
      bandera(a.show), bandera(a.cerro), texto(a.estado), texto(a.motivo_no_cierre), texto(a.link_fathom), texto(a.operacion), texto(a.puntos_contacto),
      texto(a.plan_de_pago), texto(a.medio_de_pago), texto(a.comprobante), numero(a.cc_dia_1), texto(a.ia_analisis), fecha(a.fecha_tc), fecha(a.fecha_baja),
    ] },
    { desde: 30, valores: [texto(a.ocupacion), texto(a.ingresos), texto(a.inversion)] },
    { desde: 34, valores: [texto(a.intentos_previos), texto(a.motivo_urgencia)] },
  ]
}

function hashDe(bloques: Array<{ desde: number; valores: unknown[] }>): string {
  return createHash("sha1").update(JSON.stringify(bloques)).digest("hex")
}

type Cursor = { desde: string | null; ultimo: string | null; lock?: string | null }

async function tomarCursor(admin: ReturnType<typeof createSupabaseAdmin>): Promise<{ cursor: Cursor; existe: boolean } | null> {
  const { data } = await admin.from("crm_integration_assets").select("metadata").eq("source", "gsheet").eq("asset_type", "config").eq("source_id", "cursor").maybeSingle()
  const cursor = ((data?.metadata as Cursor) || { desde: null, ultimo: null })
  const ahora = Date.now()
  if (cursor.lock && ahora - Date.parse(cursor.lock) < 90_000) return null
  const conLock = { ...cursor, lock: new Date(ahora).toISOString() }
  const { error } = await admin.from("crm_integration_assets").upsert(
    { source: "gsheet", asset_type: "config", source_id: "cursor", name: "Espejo Google Sheet", metadata: conLock, last_seen_at: conLock.lock },
    { onConflict: "source,asset_type,source_id" },
  )
  if (error) throw error
  return { cursor: conLock, existe: Boolean(data) }
}

async function guardarCursor(admin: ReturnType<typeof createSupabaseAdmin>, cursor: Cursor) {
  await admin.from("crm_integration_assets").upsert(
    { source: "gsheet", asset_type: "config", source_id: "cursor", name: "Espejo Google Sheet", metadata: { ...cursor, lock: null }, last_seen_at: new Date().toISOString() },
    { onConflict: "source,asset_type,source_id" },
  )
}

export async function sincronizarSheet(opts: { limite?: number } = {}): Promise<ResultadoEspejo> {
  const vacio: ResultadoEspejo = { ok: true, agregados: 0, actualizados: 0, sinCambios: 0, historicosSinMapa: 0, pestanasCreadas: [], errores: [] }
  if (!sheetsConfigured()) return { ...vacio, ok: false, motivo: "Faltan GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SHEET_ID" }
  const admin = createSupabaseAdmin()
  const tomado = await tomarCursor(admin)
  if (!tomado) return { ...vacio, ok: false, motivo: "Otra sincronización está en curso" }
  const cursor = tomado.cursor
  const ahoraIso = new Date().toISOString()
  // primera corrida: lo anterior a este momento solo se actualiza si el importador dejó su mapa de filas
  if (!cursor.desde) cursor.desde = ahoraIso
  const limite = opts.limite ?? 150
  const hoy = ahoraIso.slice(0, 10)
  const resultado = { ...vacio }
  try {
    const tabs = await listTabs()
    const desdeConsulta = cursor.ultimo ? new Date(Date.parse(cursor.ultimo) - 120_000).toISOString() : cursor.desde
    const escrituras: Array<{ range: string; values: unknown[][] }> = []
    const mapasNuevos: Array<Record<string, unknown>> = []
    const siguienteFila = new Map<string, number>()
    let hasta = cursor.ultimo || cursor.desde

    for (const kind of ["pagos", "agendas"] as Kind[]) {
      const { data: filas, error } = await admin.from(kind).select("*").gt("updated_at", desdeConsulta).order("updated_at", { ascending: true }).limit(limite)
      if (error) throw error
      const registros = (filas || []) as Registro[]
      if (!registros.length) continue
      const { data: mapas } = await admin.from("crm_integration_assets").select("source_id,metadata")
        .eq("source", "gsheet").eq("asset_type", ASSET[kind]).in("source_id", registros.map(r => r.id))
      const mapaPor = new Map<string, Mapa>((mapas || []).map(m => [m.source_id as string, m.metadata as Mapa]))

      for (const r of registros) {
        try {
          const bloques = kind === "pagos" ? filaPago(r) : filaAgenda(r)
          const hash = hashDe(bloques)
          const mapa = mapaPor.get(r.id)
          let tab: SheetTab | undefined
          let row: number
          if (mapa && tabs.some(t => t.title === mapa.tab)) {
            if (mapa.hash === hash) { resultado.sinCambios++; continue }
            tab = tabs.find(t => t.title === mapa.tab)!
            row = mapa.row
            resultado.actualizados++
          } else {
            if (Date.parse(r.created_at) < Date.parse(cursor.desde) && !mapa) { resultado.historicosSinMapa++; continue }
            const ym = kind === "pagos" ? mesDe(r.fecha, r.created_at) : mesDe(r.fecha_agenda || r.fecha_closer, r.created_at)
            tab = pestanaDelMes(tabs, kind, ym, hoy) || undefined
            if (!tab) { tab = await crearPestana(tabs, kind, ym, hoy); resultado.pestanasCreadas.push(tab.title) }
            if (!siguienteFila.has(tab.title)) {
              const col = columnLetter(COL_OCUPADA[kind])
              const ocupadas = await getValues(a1(tab.title, `${col}${PRIMERA_FILA_DATOS}:${col}`))
              let ultima = 0
              ocupadas.forEach((fila, i) => { if (fila[0] !== undefined && fila[0] !== null && String(fila[0]).trim() !== "") ultima = i + 1 })
              siguienteFila.set(tab.title, PRIMERA_FILA_DATOS + ultima)
            }
            row = siguienteFila.get(tab.title)!
            siguienteFila.set(tab.title, row + 1)
            resultado.agregados++
          }
          for (const b of bloques) {
            escrituras.push({ range: a1(tab.title, `${columnLetter(b.desde)}${row}:${columnLetter(b.desde + b.valores.length - 1)}${row}`), values: [b.valores] })
          }
          mapasNuevos.push({
            source: "gsheet", asset_type: ASSET[kind], source_id: r.id, name: String(r.cliente || r.nombre || r.id),
            metadata: { tab: tab.title, row, hash, ym: kind === "pagos" ? mesDe(r.fecha, r.created_at) : mesDe(r.fecha_agenda || r.fecha_closer, r.created_at) } satisfies Mapa,
            last_seen_at: ahoraIso,
          })
        } catch (e) {
          resultado.errores.push(`${kind} ${r.id}: ${(e as Error).message}`)
        }
        if (r.updated_at > (hasta || "")) hasta = r.updated_at
      }
    }

    if (escrituras.length) await writeValues(escrituras)
    if (mapasNuevos.length) {
      const { error } = await admin.from("crm_integration_assets").upsert(mapasNuevos, { onConflict: "source,asset_type,source_id" })
      if (error) throw error
    }
    cursor.ultimo = hasta || ahoraIso
    resultado.hasta = cursor.ultimo
    return resultado
  } catch (e) {
    return { ...resultado, ok: false, motivo: (e as Error).message }
  } finally {
    await guardarCursor(admin, cursor)
  }
}
