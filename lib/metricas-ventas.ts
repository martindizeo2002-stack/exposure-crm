// Métricas de ventas: UNA sola regla para Métricas, Home y Resumen de ventas (definida con Alex el 15/10/2026).
//
//  · Llamadas (agendas, presentadas, no show): por la fecha de la llamada (fecha_closer, hora de Argentina, que
//    es como se guarda), sin archivadas, un lead por persona en el período (persona → teléfono → Instagram →
//    nombre; queda la fila más completa). Las reprogramadas cuentan en el día nuevo como pendientes y en el día
//    original como no show (evento agenda_reprogramada, lib/reprogramaciones).
//  · Presentada = show, cerró o tiene fee. Tasa de show = presentadas ÷ llamadas que ya pasaron, sin canceladas
//    ni futuras.
//  · Cierre = 1 por persona: el primer pago de venta nueva (front end: Venta Nueva, Adentro en Seguimiento,
//    Post Fee, Completó PIF), en el día del pago. Los fees no son cierres (se cuentan aparte), ni las cuotas, ni
//    las ventas internas o upsells. Si esa persona ya tenía un pago de venta nueva antes del período, no es un
//    cierre nuevo.
//  · Tasa de cierre = cierres del período ÷ presentadas del período.
//  · Calificada = Lead S, A, B o C del scoring (calificacion o lead_score_grade).
//  · Cash collected = todos los pagos activos del período por fecha de pago, con el desglose FECCU (ventas
//    nuevas y fees) · FECCP (cuotas) · BECCU (back end) · BECCPP (cuotas back end).
//  · El cierre, el cash y el fee de cada pago van al closer de la llamada de esa persona; si el pago no tiene
//    llamada enlazada, al closer cargado en el pago.

import type { SupabaseClient } from "@supabase/supabase-js"
import { FRONT_END_SALE_TYPES, BACK_END_SALE_TYPES } from "@/lib/revenue"
import { FECCU_TYPES, FECCPP_TYPES, BECCU_TYPES, BECCPP_TYPES } from "@/lib/commission-scheme"
import { FRONT_END_FEE_TIPOS } from "@/lib/cash-collected"
import { esAgendaCalificada } from "@/lib/arquetipos-closing"
import { nombreCanonico } from "@/lib/equipo"
import { armarEnlazador, embudoDe, tel9, tokens, type Embudo } from "@/lib/embudo-atribucion"
import { REPROGRAMADA_EVENT } from "@/lib/reprogramaciones"

export type FiltroMetricasVentas = { desde: string; hasta: string; closer?: string | null; embudos?: Embudo[] | null; ahora?: Date }

export type LlamadaClasificada = {
  agenda_id: string; nombre: string; closer: string; fecha_closer: string | null; persona: string
  estado_llamada: "presentada" | "no_show" | "cancelada" | "pendiente" | "sin_resultado"
  calificada: boolean; reprogramada_a: string | null; embudo: Embudo
  agenda_ids?: string[] // todas las agendas de esa persona en el período (la de arriba es la que quedó)
}
export type CierreVentas = { persona: string; nombre: string; closer: string; fecha: string; monto: number; agenda_id: string | null; calificada: boolean; via: string }

export type MetricasVentas = {
  desde: string; hasta: string
  agendas: number; ocurridas: number; presentadas: number; no_show: number; canceladas: number; pendientes: number; sin_resultado: number
  calificadas: number; calif_ocurridas: number; calif_presentadas: number
  cierres: number; cierres_calificados: number; cierres_back_end: number
  fees: number; fees_monto: number
  cash: { total: number; feccu: number; feccp: number; beccu: number; beccpp: number; otros: number; ventas_nuevas: number }
  show_rate: number | null; show_rate_calif: number | null; tasa_cierre: number | null; tasa_cierre_calif: number | null
  por_closer: Record<string, { agendas: number; ocurridas: number; presentadas: number; no_show: number; cierres: number; fees: number; cash_total: number; cash_ventas_nuevas: number; show_rate: number | null; tasa_cierre: number | null }>
  llamadas: LlamadaClasificada[]
  lista_cierres: CierreVentas[]
  lista_fees: CierreVentas[]
}

const ARCHIVADA = new Set(["Archivada manualmente", "Archivada"])
const TRIAGE = new Set(["cancelada por triage", "se cancelo por triage", "se cancelo", "no respondio"])
const sinAcentos = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (a: number, b: number) => (b > 0 ? r2((a / b) * 100) : null)
const dia = (s: unknown) => String(s || "").slice(0, 10)
const normIg = (s: unknown) => String(s || "").replace(/[@\s]/g, "").toLowerCase()

export function closerCanonico(v: unknown): string {
  const c = nombreCanonico(v)
  if (!c) return "Sin closer"
  return sinAcentos(c) === "exposure" ? "Nahuel" : c.charAt(0).toUpperCase() + c.slice(1)
}

async function todasLasFilas<T>(armar: (desde: number, hasta: number) => any): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < 20000; i += 1000) {
    const { data, error } = await armar(i, i + 999)
    if (error) throw new Error(error.message)
    out.push(...((data || []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

const AG_COLS = "id,person_id,nombre,telefono,instagram,fecha_agenda,fecha_closer,closer,setter,calificacion,lead_score_grade,show,cerro,estado,call_confirmer,fuente,motivo_no_cierre,link_fathom,operacion,cc_dia_1,resumen_chat,created_at"

// Clave de persona estable: la misma regla en llamadas y pagos
function clavesDe(a: { person_id?: string | null; telefono?: string | null; instagram?: string | null; nombre?: string | null; cliente?: string | null }) {
  const out: string[] = []
  if (a.person_id) out.push(`p:${a.person_id}`)
  const t = tel9(a.telefono); if (t) out.push(`t:${t}`)
  const ig = normIg(a.instagram); if (ig.length >= 3) out.push(`i:${ig}`)
  const n = tokens(a.nombre ?? a.cliente).join(" "); if (n.length >= 5 && n.includes(" ")) out.push(`n:${n}`)
  return out
}

function completitud(a: any) {
  return (a.cerro ? 50 : 0) + (a.show === true ? 30 : 0) + (a.show === false ? 10 : 0) + (a.estado ? 5 : 0)
    + (a.motivo_no_cierre ? 5 : 0) + (a.link_fathom ? 10 : 0) + (a.operacion ? 10 : 0) + (a.calificacion ? 5 : 0) + (a.resumen_chat ? 5 : 0)
}

export async function metricasVentas(sb: SupabaseClient, f: FiltroMetricasVentas): Promise<MetricasVentas> {
  const ahora = f.ahora || new Date()
  // "ahora" en hora de Argentina, comparable con fecha_closer (que se guarda en hora de Argentina sin zona)
  const ahoraAr = new Date(ahora.getTime() - 3 * 3600e3).toISOString().slice(0, 19)
  const filtroCloser = f.closer && sinAcentos(f.closer) !== "todos" ? closerCanonico(f.closer) : null
  const enEmbudo = (e: Embudo) => !f.embudos || f.embudos.includes(e)

  // ── Llamadas del período ──
  const crudas = await todasLasFilas<any>((i, j) => sb.from("agendas").select(AG_COLS)
    .gte("fecha_closer", `${f.desde}T00:00:00`).lte("fecha_closer", `${f.hasta}T23:59:59`)
    .order("fecha_closer", { ascending: true }).order("id", { ascending: true }).range(i, j))
  const delPeriodo = crudas.filter((a) => !ARCHIVADA.has(String(a.estado || "")))
  const idsDelPeriodo = new Set(delPeriodo.map((a) => String(a.id)))

  // Reprogramadas: en el día nuevo están pendientes; en el día original cuentan como no show
  const eventosNuevos = idsDelPeriodo.size ? await todasLasFilas<any>((i, j) => sb.from("crm_events").select("source_record_id,metadata")
    .eq("event_type", REPROGRAMADA_EVENT).in("source_record_id", [...idsDelPeriodo].slice(0, 900)).range(i, j)) : []
  const llegoReprogramada = new Set(eventosNuevos.filter((e) => {
    const a = delPeriodo.find((x) => String(x.id) === String(e.source_record_id))
    return a && dia(e.metadata?.fecha_nueva) === dia(a.fecha_closer) && sinAcentos(a.estado).includes("reprogram")
  }).map((e) => String(e.source_record_id)))
  const eventosOrigen = await todasLasFilas<any>((i, j) => sb.from("crm_events").select("source_record_id,metadata")
    .eq("event_type", REPROGRAMADA_EVENT).gte("occurred_at", `${f.desde}T00:00:00-03:00`).lte("occurred_at", `${f.hasta}T23:59:59-03:00`).range(i, j))
  const origenPorAgenda = new Map<string, any>()
  for (const e of eventosOrigen) {
    const id = String(e.source_record_id)
    const d = dia(e.metadata?.fecha_original)
    if (!d || d < f.desde || d > f.hasta || idsDelPeriodo.has(id)) continue
    origenPorAgenda.set(id, e.metadata)
  }
  if (origenPorAgenda.size) {
    const originales = await todasLasFilas<any>((i, j) => sb.from("agendas").select(AG_COLS).in("id", [...origenPorAgenda.keys()].slice(0, 900)).range(i, j))
    // si la persona ya tiene una llamada en el período, esa es la que cuenta (no se duplica el lead)
    const vistas = new Set(delPeriodo.flatMap(clavesDe))
    for (const a of originales) {
      if (ARCHIVADA.has(String(a.estado || ""))) continue
      const claves = clavesDe(a)
      if (claves.some((k) => vistas.has(k))) continue
      claves.forEach((k) => vistas.add(k))
      const m = origenPorAgenda.get(String(a.id))
      delPeriodo.push({ ...a, fecha_closer: m.fecha_original, show: false, cerro: false, estado: "No Show", _reprogramada_a: m.fecha_nueva })
    }
  }

  // Un lead por persona en el período: queda la fila más completa y se llenan sus vacíos con las otras
  const grupos: any[][] = []
  const grupoDe = new Map<string, number>()
  for (const a of delPeriodo) {
    const claves = clavesDe(a)
    const existente = claves.map((k) => grupoDe.get(k)).find((g) => g !== undefined)
    const g = existente ?? grupos.push([]) - 1
    grupos[g].push(a)
    for (const k of claves) if (!grupoDe.has(k)) grupoDe.set(k, g)
  }
  const llamadasBase = grupos.map((filas) => {
    const orden = [...filas].sort((x, y) => completitud(y) - completitud(x))
    const w: any = { ...orden[0] }
    for (const o of orden.slice(1)) for (const [k, v] of Object.entries(o)) if ((w[k] == null || w[k] === "") && v != null && v !== "") w[k] = v
    w._claves = [...new Set(filas.flatMap(clavesDe))]
    w._ids = filas.map((x) => String(x.id))
    return w
  })

  const llamadas: LlamadaClasificada[] = llamadasBase.map((a) => {
    const estado = sinAcentos(a.estado)
    const cancelada = estado.includes("cancelad") || TRIAGE.has(sinAcentos(a.call_confirmer))
    const pendienteRepro = llegoReprogramada.has(String(a.id)) && !a._reprogramada_a
    const presentada = !cancelada && (a.show === true || a.cerro === true || estado.includes("adentro") || estado === "fee")
    const noShow = !cancelada && !presentada && !pendienteRepro && (a.show === false || estado === "no show")
    const futura = !presentada && !noShow && String(a.fecha_closer || "") > ahoraAr
    const estado_llamada: LlamadaClasificada["estado_llamada"] = cancelada ? "cancelada" : presentada ? "presentada" : noShow ? "no_show"
      : futura || pendienteRepro ? "pendiente" : "sin_resultado"
    return {
      agenda_id: String(a.id), nombre: a.nombre || "Sin nombre", closer: closerCanonico(a.closer), fecha_closer: a.fecha_closer || null,
      persona: a._claves[0] || `id:${a.id}`, estado_llamada, calificada: esAgendaCalificada(a.calificacion, a.lead_score_grade),
      reprogramada_a: a._reprogramada_a || null, embudo: embudoDe(a.fuente),
      _claves: a._claves, _ids: a._ids,
    } as LlamadaClasificada & { _claves: string[]; _ids: string[] }
  }).filter((l) => enEmbudo(l.embudo) && (!filtroCloser || l.closer === filtroCloser))

  // ── Pagos: cash del período y cierres (1 por persona, primer pago de venta nueva) ──
  // Para saber si una venta nueva es la primera de esa persona se miran 6 meses hacia atrás.
  const desdeHistoria = new Date(Date.parse(f.desde) - 183 * 864e5).toISOString().slice(0, 10)
  const pagos = await todasLasFilas<any>((i, j) => sb.from("pagos")
    .select("id,person_id,cliente,telefono,fecha,monto,tipo,closer,fuente,record_status")
    .eq("record_status", "active").gte("fecha", desdeHistoria).lte("fecha", f.hasta)
    .order("fecha", { ascending: true }).order("id", { ascending: true }).range(i, j))
  const agendasEnlace = await todasLasFilas<any>((i, j) => sb.from("agendas").select("id,person_id,nombre,telefono,fuente,fecha_closer,closer,calificacion,lead_score_grade,instagram,estado")
    .gte("created_at", new Date(Date.parse(desdeHistoria) - 60 * 864e5).toISOString()).order("id", { ascending: true }).range(i, j))
  const { agendaDe } = armarEnlazador(agendasEnlace.filter((a) => !ARCHIVADA.has(String(a.estado || ""))).map((a) => ({ id: String(a.id), person_id: a.person_id, nombre: a.nombre, telefono: a.telefono, fuente: a.fuente, fecha_closer: a.fecha_closer })))
  const agendaPorId = new Map(agendasEnlace.map((a) => [String(a.id), a]))
  // Llamada del período de esa persona (para que el cierre vaya al mismo closer que la llamada)
  const llamadaPorClave = new Map<string, any>()
  for (const l of llamadas as any[]) for (const k of l._claves) if (!llamadaPorClave.has(k)) llamadaPorClave.set(k, l)

  type PagoEnlazado = { p: any; persona: string; closer: string; calificada: boolean; agenda_id: string | null; embudo: Embudo; via: string }
  const enlazar = (p: any): PagoEnlazado => {
    const enl = agendaDe(p)
    const ag = enl ? agendaPorId.get(String(enl.a.id)) : null
    const claves = [...clavesDe({ person_id: p.person_id, telefono: p.telefono, cliente: p.cliente }), ...(ag ? clavesDe(ag) : [])]
    const llamada = claves.map((k) => llamadaPorClave.get(k)).find(Boolean)
    const persona = llamada?.persona || claves[0] || `pago:${p.id}`
    return {
      p, persona,
      closer: llamada ? llamada.closer : ag ? closerCanonico(ag.closer) : closerCanonico(p.closer),
      calificada: llamada ? llamada.calificada : ag ? esAgendaCalificada(ag.calificacion, ag.lead_score_grade) : false,
      agenda_id: llamada?.agenda_id || (ag ? String(ag.id) : null),
      embudo: llamada ? llamada.embudo : embudoDe(ag ? ag.fuente : p.fuente),
      via: llamada ? "llamada del período" : enl ? `agenda por ${enl.via}` : "sin agenda",
    }
  }
  const enlazados = pagos.map(enlazar).filter((x) => enEmbudo(x.embudo) && (!filtroCloser || x.closer === filtroCloser))
  const delPeriodoPagos = enlazados.filter((x) => dia(x.p.fecha) >= f.desde)

  const cash = { total: 0, feccu: 0, feccp: 0, beccu: 0, beccpp: 0, otros: 0, ventas_nuevas: 0 }
  for (const { p } of delPeriodoPagos) {
    const m = Number(p.monto) || 0, t = String(p.tipo || "")
    cash.total += m
    if (BECCPP_TYPES.has(t)) cash.beccpp += m
    else if (BECCU_TYPES.has(t)) cash.beccu += m
    else if (FECCU_TYPES.has(t)) cash.feccu += m
    else if (FECCPP_TYPES.has(t)) cash.feccp += m
    else cash.otros += m
    if (FRONT_END_SALE_TYPES.has(t)) cash.ventas_nuevas += m
  }
  for (const k of Object.keys(cash) as Array<keyof typeof cash>) cash[k] = r2(cash[k])

  // primer pago de venta nueva de cada persona (en todo el historial cargado)
  const primeraVenta = new Map<string, PagoEnlazado>()
  for (const x of enlazados) if (FRONT_END_SALE_TYPES.has(String(x.p.tipo || "")) && !primeraVenta.has(x.persona)) primeraVenta.set(x.persona, x)
  const aCierre = (x: PagoEnlazado, monto: number): CierreVentas => ({
    persona: x.persona, nombre: String(x.p.cliente || "Sin nombre"), closer: x.closer, fecha: dia(x.p.fecha), monto: r2(monto),
    agenda_id: x.agenda_id, calificada: x.calificada, via: x.via,
  })
  const lista_cierres = [...primeraVenta.values()].filter((x) => dia(x.p.fecha) >= f.desde && dia(x.p.fecha) <= f.hasta)
    .map((x) => aCierre(x, delPeriodoPagos.filter((y) => y.persona === x.persona && dia(y.p.fecha) === dia(x.p.fecha) && FRONT_END_SALE_TYPES.has(String(y.p.tipo || ""))).reduce((s, y) => s + (Number(y.p.monto) || 0), 0)))
  const cerradas = new Set(lista_cierres.map((c) => c.persona))
  const feesPorPersona = new Map<string, { x: PagoEnlazado; monto: number }>()
  for (const x of delPeriodoPagos) if (FRONT_END_FEE_TIPOS.has(String(x.p.tipo || ""))) {
    const prev = feesPorPersona.get(x.persona)
    feesPorPersona.set(x.persona, { x: prev?.x || x, monto: (prev?.monto || 0) + (Number(x.p.monto) || 0) })
  }
  const lista_fees = [...feesPorPersona.values()].map(({ x, monto }) => aCierre(x, monto))
  const backEnd = new Set(delPeriodoPagos.filter((x) => BACK_END_SALE_TYPES.has(String(x.p.tipo || ""))).map((x) => x.persona))

  // ── Totales y por closer ──
  const ocurridasDe = (ls: LlamadaClasificada[]) => ls.filter((l) => l.estado_llamada === "presentada" || l.estado_llamada === "no_show" || l.estado_llamada === "sin_resultado")
  const presentadasDe = (ls: LlamadaClasificada[]) => ls.filter((l) => l.estado_llamada === "presentada")
  const ocurridas = ocurridasDe(llamadas), presentadas = presentadasDe(llamadas)
  const calif = llamadas.filter((l) => l.calificada)
  const por_closer: MetricasVentas["por_closer"] = {}
  const closers = new Set([...llamadas.map((l) => l.closer), ...lista_cierres.map((c) => c.closer), ...delPeriodoPagos.map((x) => x.closer)])
  for (const c of closers) {
    const ls = llamadas.filter((l) => l.closer === c)
    const pres = presentadasDe(ls).length, oc = ocurridasDe(ls).length
    const cierresC = lista_cierres.filter((x) => x.closer === c).length
    por_closer[c] = {
      agendas: ls.length, ocurridas: oc, presentadas: pres, no_show: ls.filter((l) => l.estado_llamada === "no_show").length,
      cierres: cierresC, fees: lista_fees.filter((x) => x.closer === c).length,
      cash_total: r2(delPeriodoPagos.filter((x) => x.closer === c).reduce((s, x) => s + (Number(x.p.monto) || 0), 0)),
      cash_ventas_nuevas: r2(delPeriodoPagos.filter((x) => x.closer === c && FRONT_END_SALE_TYPES.has(String(x.p.tipo || ""))).reduce((s, x) => s + (Number(x.p.monto) || 0), 0)),
      show_rate: pct(pres, oc), tasa_cierre: pct(cierresC, pres),
    }
  }
  const califPres = presentadasDe(calif).length
  const cierresCalif = lista_cierres.filter((c) => c.calificada).length

  return {
    desde: f.desde, hasta: f.hasta,
    agendas: llamadas.length, ocurridas: ocurridas.length, presentadas: presentadas.length,
    no_show: llamadas.filter((l) => l.estado_llamada === "no_show").length,
    canceladas: llamadas.filter((l) => l.estado_llamada === "cancelada").length,
    pendientes: llamadas.filter((l) => l.estado_llamada === "pendiente").length,
    sin_resultado: llamadas.filter((l) => l.estado_llamada === "sin_resultado").length,
    calificadas: calif.length, calif_ocurridas: ocurridasDe(calif).length, calif_presentadas: califPres,
    cierres: lista_cierres.length, cierres_calificados: cierresCalif, cierres_back_end: [...backEnd].filter((p) => !cerradas.has(p)).length,
    fees: lista_fees.length, fees_monto: r2(lista_fees.reduce((s, x) => s + x.monto, 0)),
    cash,
    show_rate: pct(presentadas.length, ocurridas.length), show_rate_calif: pct(califPres, ocurridasDe(calif).length),
    tasa_cierre: pct(lista_cierres.length, presentadas.length), tasa_cierre_calif: pct(cierresCalif, califPres),
    por_closer,
    llamadas: llamadas.map(({ _claves, _ids, ...l }: any) => ({ ...l, agenda_ids: _ids })),
    lista_cierres, lista_fees,
  }
}
