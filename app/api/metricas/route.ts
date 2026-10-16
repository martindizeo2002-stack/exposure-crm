import { leerArquetipoCrm, esAgendaCalificada, type MacroArquetipo } from "@/lib/arquetipos-closing"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getMetaSpend } from "@/lib/meta-spend"
import { BECCPP_TYPES, BECCU_TYPES, FECCPP_TYPES, FECCU_TYPES, frontendCohort, withinSetterWindow } from "@/lib/commission-scheme"
import { ALL_SALE_TYPES, BACK_END_SALE_TYPES, CLOSED_IN_CALL_TYPES, FRONT_END_SALE_TYPES } from "@/lib/revenue"
import { FEE_TIPOS, FRONT_END_FEE_TIPOS } from "@/lib/cash-collected"
import { nombreCanonico } from "@/lib/equipo"
import { armarEnlazador, cargarAgendasEnlace, embudoDe, EMBUDOS, leerEmbudos, nombreEmbudos, type Embudo } from "@/lib/embudo-atribucion"
import { metricasVentas } from "@/lib/metricas-ventas"
import { gastoAdsPorEmbudo } from "@/lib/ads-embudos"
import { seguidoresPeriodo } from "@/lib/seguidores"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Missing Supabase config")
  return createClient(url, key)
}

const SEMANAS: Record<string, Array<[number, number]>> = {
  "2025-12": [[1,7],[8,14],[15,21],[22,28],[29,31]],
  "2026-01": [[1,4],[5,11],[12,18],[19,25],[26,31]],
  "2026-02": [[2,8],[9,15],[16,22],[23,28]],
  "2026-03": [[1,8],[9,15],[16,22],[23,31]],
  "2026-04": [[1,5],[6,12],[13,19],[20,26],[27,30]],
  "2026-05": [[1,3],[4,10],[11,17],[18,24],[25,31]],
  "2026-06": [[1,7],[8,14],[15,21],[22,30]],
  "2026-07": [[1,5],[6,12],[13,19],[20,26],[27,31]],
  "2026-08": [[1,9],[10,16],[17,23],[24,31]],
  "2026-09": [[1,6],[7,13],[14,20],[21,27],[28,30]],
  "2026-10": [[1,4],[5,11],[12,18],[19,25],[26,31]],
  "2026-11": [[1,8],[9,15],[16,22],[23,30]],
  "2026-12": [[1,6],[7,13],[14,20],[21,27],[28,31]],
}

// Setters que ya no trabajan con el equipo — se excluyen de la tabla de
// Setting (conversaciones asignadas) en los meses indicados, sin tocar las
// agendas historicas reales (esos registros siguen intactos en la base).
// En EXPOSURE los setters históricos (Lukas, Cesar, Santi, Andres) no tienen
// conversaciones asignadas en los meses en que ya no setean, así que no hace
// falta excluirlos a mano. Se deja el mecanismo por si hiciera falta.
const SETTERS_EXCLUIDOS: Record<string, string[]> = {}
// Personas que no son setters activos. Sus registros históricos permanecen
// intactos para auditoría, pero nunca deben aparecer en la tabla de Setting.
const SETTERS_NO_ACTIVOS = new Set<string>()

// Closers que ya no son closers activos — se sacan de la tabla de Cash
// Collected por Closer para siempre, sin tocar sus pagos/agendas historicos
// (esos registros siguen intactos en la base, solo se ocultan de este cuadro).
// Claves en minúsculas y sin tildes (ver closerKey). El CEO de EXPOSURE cierra.
const CLOSERS_EXCLUIDOS = new Set<string>()

// Definición operativa (Alex, 11/09/2026): una agenda calificada es LEAD A, B o C; LEAD D no.
const CALIFS_AB = new Set(["S", "A", "B", "C", "LEAD S", "LEAD A", "LEAD B", "LEAD C"])  // Lead S/A/B/C (regla única, 15/10/2026)  // EXPOSURE: A, B y C califican; D no

// Conjuntos compartidos (lib/commission-scheme.ts, lib/revenue.ts,
// lib/cash-collected.ts) con el vocabulario de EXPOSURE.
const FECCU_TIPOS = FECCU_TYPES
const FECCP_TIPOS = FECCPP_TYPES
const BECCU_TIPOS = BECCU_TYPES
const BECCPP_TIPOS = BECCPP_TYPES
// Cierres = pagos que dan acceso (FE + BE). Un Fee no es cierre.
const CIERRES_TIPOS = ALL_SALE_TYPES
// Revenue contractual de ventas nuevas externas (front end: fee + venta que
// da acceso). Se conserva como métrica separada, pero NO es la base del ROAS.
const VENTA_NUEVA_EXTERNA = FECCU_TYPES
const CALIFS_SABCD = ["S", "A", "B", "C", "D"]

function r2(n: number) { return Math.round(n * 100) / 100 }
function pct(a: number, b: number): number | null { return b > 0 ? r2((a / b) * 100) : null }
function firstWord(s: string) { return (s || "").trim().split(/\s+/)[0] }
function identityKey(row: { person_id?: string | null; telefono?: string | null; cliente?: string | null }): string {
  if (row.person_id) return `p:${row.person_id}`
  const phone = String(row.telefono || "").replace(/\D/g, "")
  if (phone) return `t:${phone}`
  const name = String(row.cliente || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
  return `n:${name}`
}
type PagoBucket = { tipo?: string | null; operacion?: string | null }
function isBackendContext(p: PagoBucket) {
  return BECCU_TIPOS.has(p.tipo || "")
    || BECCPP_TIPOS.has(p.tipo || "")
}
function isBeccpp(p: PagoBucket) { return BECCPP_TIPOS.has(p.tipo || "") }
function isBeccu(p: PagoBucket) { return isBackendContext(p) && !isBeccpp(p) }

function getDateRange(mes: string, weekIdx: number): { start: string; end: string } {
  const [year, mon] = mes.split("-").map(Number)
  const lastDay = new Date(year, mon, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, "0")
  if (weekIdx > 0) {
    const weeks = SEMANAS[mes]
    if (weeks && weeks[weekIdx - 1]) {
      const [s, e] = weeks[weekIdx - 1]
      return { start: `${mes}-${pad(s)}`, end: `${mes}-${pad(Math.min(e, lastDay))}` }
    }
  }
  return { start: `${mes}-01`, end: `${mes}-${pad(lastDay)}` }
}

// iClosed persiste fecha_agenda en UTC sin sufijo de zona. Los cortes de las
// semanas comerciales se interpretan en Argentina (UTC-3), no a medianoche UTC.

function detectarPais(telefono?: string | null, textoExtra?: string | null) {
  const t = String(telefono || "").replace(/\D/g, "")
  const extra = String(textoExtra || "").toLowerCase()

  if (extra.includes("argentina")) return { pais: "Argentina", codigo: "AR", bandera: "🇦🇷" }
  if (extra.includes("chile")) return { pais: "Chile", codigo: "CL", bandera: "🇨🇱" }
  if (extra.includes("mexico") || extra.includes("méxico")) return { pais: "México", codigo: "MX", bandera: "🇲🇽" }
  if (extra.includes("colombia")) return { pais: "Colombia", codigo: "CO", bandera: "🇨🇴" }
  if (extra.includes("españa") || extra.includes("espana") || extra.includes("spain")) return { pais: "España", codigo: "ES", bandera: "🇪🇸" }
  if (extra.includes("uruguay")) return { pais: "Uruguay", codigo: "UY", bandera: "🇺🇾" }
  if (extra.includes("peru") || extra.includes("perú")) return { pais: "Perú", codigo: "PE", bandera: "🇵🇪" }
  if (extra.includes("ecuador")) return { pais: "Ecuador", codigo: "EC", bandera: "🇪🇨" }
  if (extra.includes("paraguay")) return { pais: "Paraguay", codigo: "PY", bandera: "🇵🇾" }
  if (extra.includes("bolivia")) return { pais: "Bolivia", codigo: "BO", bandera: "🇧🇴" }

  if (!t || t.length < 7) return { pais: "Sin país identificado", codigo: "OTRO", bandera: "🌐" }

  if (t.startsWith("54")) return { pais: "Argentina", codigo: "AR", bandera: "🇦🇷" }
  if (t.startsWith("56")) return { pais: "Chile", codigo: "CL", bandera: "🇨🇱" }
  if (t.startsWith("52")) return { pais: "México", codigo: "MX", bandera: "🇲🇽" }
  if (t.startsWith("57")) return { pais: "Colombia", codigo: "CO", bandera: "🇨🇴" }
  if (t.startsWith("34")) return { pais: "España", codigo: "ES", bandera: "🇪🇸" }
  if (t.startsWith("598")) return { pais: "Uruguay", codigo: "UY", bandera: "🇺🇾" }
  if (t.startsWith("51")) return { pais: "Perú", codigo: "PE", bandera: "🇵🇪" }
  if (t.startsWith("593")) return { pais: "Ecuador", codigo: "EC", bandera: "🇪🇨" }
  if (t.startsWith("595")) return { pais: "Paraguay", codigo: "PY", bandera: "🇵🇾" }
  if (t.startsWith("591")) return { pais: "Bolivia", codigo: "BO", bandera: "🇧🇴" }
  if (t.startsWith("58")) return { pais: "Venezuela", codigo: "VE", bandera: "🇻🇪" }
  if (t.startsWith("506")) return { pais: "Costa Rica", codigo: "CR", bandera: "🇨🇷" }
  if (t.startsWith("507")) return { pais: "Panamá", codigo: "PA", bandera: "🇵🇦" }
  if (t.startsWith("502")) return { pais: "Guatemala", codigo: "GT", bandera: "🇬🇹" }
  if (t.startsWith("503")) return { pais: "El Salvador", codigo: "SV", bandera: "🇸🇻" }
  if (t.startsWith("504")) return { pais: "Honduras", codigo: "HN", bandera: "🇭🇳" }
  if (t.startsWith("505")) return { pais: "Nicaragua", codigo: "NI", bandera: "🇳🇮" }
  if (t.startsWith("55")) return { pais: "Brasil", codigo: "BR", bandera: "🇧🇷" }
  if (t.startsWith("1")) {
    if (t.startsWith("1809") || t.startsWith("1829") || t.startsWith("1849")) {
      return { pais: "República Dominicana", codigo: "DO", bandera: "🇩🇴" }
    }
    if (t.startsWith("1787") || t.startsWith("1939")) {
      return { pais: "Puerto Rico", codigo: "PR", bandera: "🇵🇷" }
    }
    return { pais: "Estados Unidos", codigo: "US", bandera: "🇺🇸" }
  }
  if (t.startsWith("44")) return { pais: "Reino Unido", codigo: "GB", bandera: "🇬🇧" }
  if (t.startsWith("49")) return { pais: "Alemania", codigo: "DE", bandera: "🇩🇪" }
  if (t.startsWith("39")) return { pais: "Italia", codigo: "IT", bandera: "🇮🇹" }
  if (t.startsWith("33")) return { pais: "Francia", codigo: "FR", bandera: "🇫🇷" }

  if ((t.startsWith("11") || t.startsWith("15") || t.startsWith("911")) && t.length === 10) {
    return { pais: "Argentina", codigo: "AR", bandera: "🇦🇷" }
  }

  return { pais: "Otros países", codigo: "OTRO", bandera: "🌍" }
}

function argentinaAgendaBoundary(date: string, end = false): string {
  return new Date(`${date}T${end ? "23:59:59" : "00:00:00"}-03:00`).toISOString().slice(0, 19)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const currentMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const mes = searchParams.get("month") || currentMes
    const weekIdx = parseInt(searchParams.get("week") || "0")

    // Vista General filtra por rango libre (hoy, esta semana, rango custom,
    // etc.) en vez de mes+semana fijos — si vienen start/end directos, se usan
    // tal cual en lugar de derivarlos de mes+semana.
    const startParam = searchParams.get("start")
    const endParam = searchParams.get("end")
    const { start, end } = (startParam && endParam) ? { start: startParam, end: endParam } : getDateRange(mes, weekIdx)
    const sb = getSupabase()
    // ?embudo=Webinar|Orgánico|Outbound|Sin fuente, uno o varios separados por coma: todo se recorta a esos embudos
    // (misma regla que Ventas → Embudos). Agendas por su fuente; pagos y planes por la agenda del cliente. Con varios
    // (Alex, 01/10/2026: "orgánico y outbound juntos"), se suman y las tasas salen de los totales. Sin el parámetro, todos.
    const embudos = leerEmbudos(searchParams.get("embudo"))
    const embudo = nombreEmbudos(embudos)
    const enEmb = (e: Embudo) => !embudos || embudos.includes(e)

    const [
      { data: pagos, error: pErr },
      { data: planesRaw, error: plansErr },
      { data: agendasRaw, error: aErr },
      { data: agendasSetterRaw, error: asErr },
      metaSpend,
    ] = await Promise.all([
      sb.from("pagos").select("fecha,cliente,tipo,operacion,ppp,monto,closer,setter,calificacion,person_id,telefono,fuente").eq("record_status", "active").gte("fecha", start).lte("fecha", end),
      // Fuente de verdad igual a producción: contrato estructurado cargado en
      // el período, sumando los ítems del plan, estén pagos o pendientes.
      sb.from("planes_pago")
        .select("id,cliente,operacion,closer,person_id,telefono,fecha_alta,created_at,plan_pago_items(monto,concepto)")
        .gte("created_at", `${start}T00:00:00`)
        .lte("created_at", `${end}T23:59:59.999`),
      sb.from("agendas")
        .select("id,person_id,nombre,telefono,cuenta,fuente,closer,setter,show,cerro,estado,calificacion,lead_score,lead_score_grade,fecha_closer,created_at,call_confirmer,calificaba_realmente,ocupacion,recurso,angulo_entrada,manychat,campaign_id,ad_id,creative_id,motivo_no_cierre")
        .or("estado.is.null,estado.neq.Archivada manualmente")
        .gte("fecha_closer", `${start}T00:00:00`)
        .lte("fecha_closer", `${end}T23:59:59`),
      // Setting (agendas por setter) y Volumen (cuenta/fuente/ocupacion/manychat)
      // se miden por fecha_agenda (cuando se agendo), no por fecha_closer (cuando
      // cae la llamada) — asi coincide con como lo mide el Sheet y evita que
      // agendas de fin de mes "salten" al mes siguiente.
      sb.from("agendas")
        .select("id,person_id,nombre,telefono,setter,cuenta,fuente,ocupacion,manychat,calificacion,estado,fecha_agenda")
        .or("estado.is.null,estado.neq.Archivada manualmente")
        .gte("fecha_agenda", argentinaAgendaBoundary(start))
        .lte("fecha_agenda", argentinaAgendaBoundary(end, true)),
      getMetaSpend(start, end),
    ])

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (plansErr) return NextResponse.json({ error: plansErr.message }, { status: 500 })
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
    if (asErr) return NextResponse.json({ error: asErr.message }, { status: 500 })

    // EXPOSURE opera una sola cuenta (@alexmcarrera): se toman todos los pagos (o los del embudo elegido).
    // El enlace pago → embudo se arma siempre: ROAS y CAC se calculan embudo por embudo y nunca se mezclan.
    const enlace = armarEnlazador(await cargarAgendasEnlace(sb))
    const p = (pagos || []).filter((x) => enEmb(enlace.embudoDePago(x)))
    // Inversión en Meta separada por embudo, campaña por campaña (lib/ads-embudos.ts): las campañas de la masterclass
    // (exp-…, "masterclass", "webinar") → Webinar; FM ADS → Orgánico. Con embudo elegido, la inversión es la de ese
    // embudo; sin embudo, la de toda la cuenta (solo como total: el ROAS y el CAC van por embudo en `por_embudo`).
    const gastoEmbudos = await gastoAdsPorEmbudo(sb, start, end).catch(() => null)
    // costo por seguidor del período (Follow Me Ads = campañas del embudo orgánico ÷ seguidores nuevos de ManyChat)
    const seguidoresP = seguidoresPeriodo(sb, start, end).catch(() => null)
    if (embudos) Object.assign(metaSpend, gastoEmbudos
      ? { spend: r2(embudos.reduce((s, e) => s + (gastoEmbudos[e] || 0), 0)), available: true, source: "meta", estimated: false }
      : { spend: 0, available: false, source: "unavailable", estimated: false })

    // La ventana del setter se cuenta desde el primer pago frontend histórico
    // de cada cliente, aunque el período visible empiece después.
    const paymentHistory: Array<{ fecha: string | null; tipo: string | null; person_id: string | null; telefono: string | null; cliente: string | null }> = []
    for (let from = 0; ; from += 1000) {
      const { data: page, error: historyError } = await sb
        .from("pagos")
        .select("fecha,tipo,person_id,telefono,cliente")
        .eq("record_status", "active")
        .not("fecha", "is", null)
        .order("fecha", { ascending: true })
        .range(from, from + 999)
      if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 })
      paymentHistory.push(...(page || []))
      if (!page || page.length < 1000) break
    }
    const firstFrontendPayment = new Map<string, string>()
    for (const payment of paymentHistory) {
      if (!frontendCohort(payment.tipo)) continue
      const key = identityKey(payment)
      if (!firstFrontendPayment.has(key) && payment.fecha) firstFrontendPayment.set(key, payment.fecha)
    }
    // Deduplicación por identidad para que ninguna métrica cuente con leads duplicados
    const closingAgendaSeen = new Set<string>()
    const a = (agendasRaw || []).filter((agenda: any) => {
      const phone = String(agenda.telefono || "").replace(/\D/g, "")
      const identity = agenda.person_id ? `person:${agenda.person_id}` : phone && phone.length >= 7 ? `phone:${phone}` : `id:${agenda.id}`
      if (closingAgendaSeen.has(identity)) return false
      closingAgendaSeen.add(identity)
      return true
    }).filter((x) => enEmb(embudoDe(x.fuente)))
    const setterAgendaSeen = new Set<string>()
    // primero se sacan los repetidos (mismo setter + misma persona) y después se recorta al embudo: así los embudos suman el total
    const aBySetterFecha = (agendasSetterRaw || []).filter((agenda: any) => {
      const phone = String(agenda.telefono || "").replace(/\D/g, "")
      const name = String(agenda.nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
      const identity = agenda.person_id ? `person:${agenda.person_id}` : phone ? `phone:${phone}` : `name:${name}`
      const key = `${firstWord(agenda.setter || "").toLowerCase()}:${identity}`
      if (setterAgendaSeen.has(key)) return false
      setterAgendaSeen.add(key)
      return true
    }).filter((agenda: any) => enEmb(embudoDe(agenda.fuente)))
    const planes = (planesRaw || []).filter((plan: any) => enEmb(enlace.embudoDePago({ person_id: plan.person_id, telefono: plan.telefono, fecha: plan.fecha_alta || plan.created_at })))
    const revenue = r2(planes.reduce((total, plan: any) =>
      total + (plan.plan_pago_items || []).reduce(
        (subtotal: number, item: any) => subtotal + Number(item.monto || 0),
        0,
      ), 0))
    const ventas_nuevas_revenue = r2(planes.reduce((total, plan: any) =>
      total + (plan.plan_pago_items || []).reduce(
        (subtotal: number, item: any) =>
          subtotal + (VENTA_NUEVA_EXTERNA.has(item.concepto || "") ? Number(item.monto || 0) : 0),
        0,
      ), 0))
    // FUNNEL
    const total_agendas = a.length
    const calificadas = a.filter(x => CALIFS_AB.has(x.calificacion || "")).length
    const nowMs = Date.now()
    // `show=null` no equivale a no-show, pero tampoco se puede excluir del
    // denominador una vez que la llamada ya ocurrió: eso infla artificialmente
    // el show. Las llamadas ocurridas sin resultado se exponen por separado.
    const callsOccurred = a.filter(x => {
      const scheduled = x.fecha_closer ? new Date(x.fecha_closer).getTime() : NaN
      return Number.isFinite(scheduled) && scheduled <= nowMs
    })
    const presentadas = callsOccurred.filter(x => x.show === true).length
    const calificadasOcurridas = callsOccurred.filter(x => CALIFS_AB.has(x.calificacion || ""))
    const calif_presentadas = calificadasOcurridas.filter(x => x.show === true).length
    const cierres = p.filter(x => CIERRES_TIPOS.has(x.tipo)).length
    const cierres_fe = p.filter(x => FRONT_END_SALE_TYPES.has(x.tipo)).length
    const cierres_be = p.filter(x => BACK_END_SALE_TYPES.has(x.tipo)).length
    // Cerro en la llamada original (Venta Nueva) vs cerro despues via seguimiento
    // (Adentro en Seguimiento / Completó PIF / venta interna, que siempre se
    // cierran aparte).
    const cierres_llamada = p.filter(x => CLOSED_IN_CALL_TYPES.has(x.tipo)).length
    const cierres_seguimiento = p.filter(x => CIERRES_TIPOS.has(x.tipo) && !CLOSED_IN_CALL_TYPES.has(x.tipo)).length

    // PAGOS TOTALES vs UNIDADES CERRADAS: dos formas distintas de medir "tasa
    // de cierre". Pagos totales = Unidades Cerradas + Fees (fees SI cuentan
    // porque son el pago del día 1, ligado a la llamada) — pero NO cuotas,
    // que se cobran después sin que exista una llamada nueva ese período.
    // Unidades cerradas = solo gente que efectivamente entró al programa
    // (Venta Nueva / Adentro en Seguimiento / Completó PIF / Interna), FE + BE combinados.
    const unidades_cerradas = cierres
    const PAGOS_TOTALES_TIPOS = new Set([...CIERRES_TIPOS, ...FEE_TIPOS])
    const pagos_totales = p.filter(x => PAGOS_TOTALES_TIPOS.has(x.tipo)).length

    // No shows: call_confirmer distingue por que no hubo show.
    // Cancelado es un resultado válido: no es no-show ni resultado pendiente.
    const noShows = callsOccurred.filter(x => x.show !== true && x.estado !== "Cancelado" && x.estado !== "Cancelado en precall")
    const canceladas_triage = noShows.filter(x => (x.call_confirmer || "").includes("Triage")).length
    const canceladas_triage_calif = noShows.filter(x =>
      CALIFS_AB.has(x.calificacion || "") && (x.call_confirmer || "").includes("Triage")
    ).length
    const no_response = noShows.filter(x => x.call_confirmer === "No Respondió").length
    const no_show = noShows.filter(x =>
      x.show === false
      && x.call_confirmer !== "No Respondió"
      && !(x.call_confirmer || "").includes("Triage")
    ).length
    const sin_resultado = callsOccurred.filter(x => x.show == null
      && x.estado !== "Cancelado" && x.estado !== "Cancelado en precall"
      && x.call_confirmer !== "No Respondió"
      && !(x.call_confirmer || "").includes("Triage")
    ).length

    // Calificaban de verdad audita exclusivamente si el scoring S/A/B estuvo
    // bien asignado. C/D no entran: ya estaban declaradas como no calificadas.
    const presentadasArr = callsOccurred.filter(x => x.show === true && CALIFS_AB.has(x.calificacion || ""))
    const con_calificaba_realmente = presentadasArr.filter(x => x.calificaba_realmente === "Si" || x.calificaba_realmente === "No").length
    const calificaron_si_realmente = presentadasArr.filter(x => x.calificaba_realmente === "Si").length

    // CASH
    const feccuDe = (lista: typeof p) => r2(lista.filter(x => !isBackendContext(x) && FECCU_TIPOS.has(x.tipo)).reduce((s, x) => s + (x.monto || 0), 0))
    const feccu = feccuDe(p)
    // Definición vigente confirmada por Alex (08/08/2026): ROAS usa solo
    // FECCU efectivamente cobrado en el período. No entran cuotas/FECCP,
    // ventas internas/backend ni revenue contractual pendiente.
    // Alex (01/10/2026): el ROAS y el CAC no se mezclan entre embudos. Sin embudo elegido no hay un ROAS "de todo":
    // cada embudo tiene el suyo en `por_embudo` (su FECCU sobre lo invertido en sus campañas). Con varios embudos
    // elegidos a propósito, el ROAS es el de esa combinación: su FECCU sobre lo invertido en sus campañas.
    const roas = embudo && metaSpend.available && metaSpend.spend > 0 ? r2(feccu / metaSpend.spend) : null
    const por_embudo = Object.fromEntries(EMBUDOS.map((e) => {
      const pe = (pagos || []).filter((x) => enlace.embudoDePago(x) === e)
      const inversion = gastoEmbudos ? r2(gastoEmbudos[e] || 0) : null
      const feccuE = feccuDe(pe)
      const cierresE = pe.filter(x => FRONT_END_SALE_TYPES.has(x.tipo)).length
      return [e, {
        inversion, feccu: feccuE, cierres_fe: cierresE,
        roas: inversion ? r2(feccuE / inversion) : null,
        cac: inversion && cierresE > 0 ? r2(inversion / cierresE) : null,
      }]
    })) as Record<string, { inversion: number | null; feccu: number; cierres_fe: number; roas: number | null; cac: number | null }>
    const feccp = r2(p.filter(x => !isBackendContext(x) && FECCP_TIPOS.has(x.tipo)).reduce((s, x) => s + (x.monto || 0), 0))
    const beccu = r2(p.filter(isBeccu).reduce((s, x) => s + (x.monto || 0), 0))
    const beccpp = r2(p.filter(isBeccpp).reduce((s, x) => s + (x.monto || 0), 0))
    const cc_total = r2(feccu + feccp + beccu + beccpp)

    const fees_arr = p.filter(x => FRONT_END_FEE_TIPOS.has(x.tipo))
    const fees_sum = r2(fees_arr.reduce((s, x) => s + (x.monto || 0), 0))

    // AOV día 1 = lo que se cobra en la llamada misma: Venta Nueva o Fee.
    const aov_d1_arr = p.filter(x => CLOSED_IN_CALL_TYPES.has(x.tipo) || x.tipo === "Fee")
    const aov_dia1 = aov_d1_arr.length > 0
      ? r2(aov_d1_arr.reduce((s, x) => s + (x.monto || 0), 0) / aov_d1_arr.length) : null

    const aov_tc_arr = p.filter(x => CIERRES_TIPOS.has(x.tipo))
    const aov_tc = aov_tc_arr.length > 0
      ? r2(aov_tc_arr.reduce((s, x) => s + (x.monto || 0), 0) / aov_tc_arr.length) : null

    // CAC (costo de adquisicion): mismo gasto de ads que ROAS, pero como costo
    // por unidad en vez de retorno. Denominador = mismo universo de "ventas
    // nuevas del mes" que usa ROAS (Front End, sin ventas internas) contado
    // como unidades, no como monto — usa cierres_fe (ya calculado en FUNNEL,
    // mismo set de tipos que FRONT_END_SALE_TYPES/newSalesRevenue).
    const cac = metaSpend.available && cierres_fe > 0 ? r2(metaSpend.spend / cierres_fe) : null

    // CASH COLLECTED POR CALIFICACIÓN DE LEAD, con atribución por cohorte.
    // Un pago no hereda su score desde pagos.calificacion: se ata por identidad
    // a la agenda del período y conserva score + closer de esa call. Incluye
    // todo el Cash Collected real cobrado en el período (fees, ventas, cuotas,
    // refuerzos y backend); cada pago se cuenta una sola vez. Así coincide con
    // la auditoría de Lead Scoring y no mezcla cash sin agenda atribuible.
    const agendaByIdentity = new Map<string, any>()
    const sortedAgendas = [...a].sort((x, y) => {
      if (Boolean(x.show) !== Boolean(y.show)) return x.show ? -1 : 1
      return new Date(y.fecha_closer || y.created_at || 0).getTime() - new Date(x.fecha_closer || x.created_at || 0).getTime()
    })
    for (const agenda of sortedAgendas) {
      for (const key of [agenda.person_id ? `p:${agenda.person_id}` : "", agenda.telefono ? `t:${String(agenda.telefono).replace(/\D/g, "")}` : ""].filter(Boolean)) {
        if (!agendaByIdentity.has(key)) agendaByIdentity.set(key, agenda)
      }
    }
    const attributedPayments = p.map((payment) => {
      const keys = [payment.person_id ? `p:${payment.person_id}` : "", payment.telefono ? `t:${String(payment.telefono).replace(/\D/g, "")}` : ""].filter(Boolean)
      const agenda = keys.map(key => agendaByIdentity.get(key)).find(Boolean)
      return agenda ? { payment, agenda } : null
    }).filter(Boolean) as Array<{ payment: any; agenda: any }>

    const cash_por_calificacion = CALIFS_SABCD.map((tier) => {
      const label = `LEAD ${tier}`
      const callsTier = a.filter(x => x.calificacion === label)
      const presentadasTier = callsTier.filter(x => x.show).length
      const pagosTier = attributedPayments.filter(x => x.agenda.calificacion === label)
      const ccTier = r2(pagosTier.reduce((s, x) => s + Number(x.payment.monto || 0), 0))
      return {
        calificacion: label,
        cc_total: ccTier,
        llamadas: callsTier.length,
        presentadas: presentadasTier,
        pagaron: new Set(pagosTier.map(x => identityKey(x.payment))).size,
        cc_por_call: presentadasTier > 0 ? r2(ccTier / presentadasTier) : null,
      }
    })

    // CASH COLLECTED POR CALIFICACIÓN, DESGLOSADO POR CLOSER. Los apodos
    // (Nawe → Nahuel, Cris → Cristian, Bener) se unifican con
    // lib/equipo.ts para que una misma persona no aparezca dos veces.
    function closerKey(s: string | null | undefined): string {
      return nombreCanonico(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    }
    function closerLabel(_key: string, raw: string | null | undefined): string {
      return nombreCanonico(raw) || firstWord(raw || "")
    }
    const closerLabels = new Map<string, string>()
    for (const x of a) {
      const k = closerKey(x.closer)
      if (k && k !== "sin" && !CLOSERS_EXCLUIDOS.has(k) && !closerLabels.has(k)) closerLabels.set(k, closerLabel(k, x.closer))
    }
    for (const x of p) {
      const k = closerKey(x.closer)
      if (k && k !== "sin" && !CLOSERS_EXCLUIDOS.has(k)) closerLabels.set(k, closerLabel(k, x.closer))
    }
    const cash_por_closer = Array.from(closerLabels.entries())
      .map(([key, label]) => ({
        closer: label,
        tiers: CALIFS_SABCD.map((tier) => {
          const lbl = `LEAD ${tier}`
          const callsTier = a.filter(x => closerKey(x.closer) === key && x.calificacion === lbl)
          const presentadasTier = callsTier.filter(x => x.show).length
          const pagosTier = attributedPayments.filter(x => closerKey(x.agenda.closer) === key && x.agenda.calificacion === lbl)
          const ccTier = r2(pagosTier.reduce((s, x) => s + Number(x.payment.monto || 0), 0))
          return {
            calificacion: lbl,
            cc_total: ccTier,
            llamadas: callsTier.length,
            presentadas: presentadasTier,
            pagaron: new Set(pagosTier.map(x => identityKey(x.payment))).size,
            cc_por_call: presentadasTier > 0 ? r2(ccTier / presentadasTier) : null,
          }
        }),
      }))
      .sort((x, y) => x.closer.localeCompare(y.closer))

    // SETTING
    const excluidos = new Set(SETTERS_EXCLUIDOS[mes] || [])
    const setterData = new Map<string, { conv_asig: number; agendas: number; calendarios_enviados: number; agendas_calificadas: number; cash_collected: number }>()
    for (const ag of aBySetterFecha) {
      const s = firstWord(ag.setter || "")
      if (!s || s === "Sin" || excluidos.has(s) || SETTERS_NO_ACTIVOS.has(s)) continue
      if (!setterData.has(s)) setterData.set(s, { conv_asig: 0, agendas: 0, calendarios_enviados: 0, agendas_calificadas: 0, cash_collected: 0 })
      const d = setterData.get(s)!
      d.agendas++
      if (CALIFS_AB.has(ag.calificacion || "")) d.agendas_calificadas++
    }

    // Cash comisionable del setter: solo frontend efectivamente cobrado entre
    // el primer pago y el día 30 inclusive. Backend y cuotas posteriores no
    // pertenecen al setter.
    for (const pago of p) {
      const s = firstWord(pago.setter || "")
      if (!s || s === "Sin" || excluidos.has(s) || SETTERS_NO_ACTIVOS.has(s)) continue
      const cohort = frontendCohort(pago.tipo)
      if (!cohort || !withinSetterWindow(pago.fecha, firstFrontendPayment.get(identityKey(pago)))) continue
      if (!setterData.has(s)) setterData.set(s, { conv_asig: 0, agendas: 0, calendarios_enviados: 0, agendas_calificadas: 0, cash_collected: 0 })
      setterData.get(s)!.cash_collected += Number(pago.monto || 0)
    }

    // Metricas cargadas a mano (conversaciones asignadas, calendarios enviados,
    // nuevos leads). Se guardan por semana real (columna "semana") para que un
    // valor cargado en una semana no se arrastre a las semanas siguientes.
    // En vista "Mes completo" (weekIdx 0) se suman todas las semanas del mes.
    let nuevos_leads: number | null = null
    try {
      let q = sb.from("metricas_manual")
        .select("persona,valor,tipo")
        .eq("mes", mes)
        .in("tipo", ["conversaciones_asignadas", "calendarios_enviados", "nuevos_leads"])
      q = weekIdx > 0 ? q.eq("semana", weekIdx) : q.not("semana", "is", null)
      const { data: manualData } = await q
      for (const row of manualData || []) {
        if (row.tipo === "nuevos_leads") {
          nuevos_leads = (nuevos_leads || 0) + (row.valor || 0)
          continue
        }
        const nombre = firstWord(row.persona || "")
        if (excluidos.has(nombre) || SETTERS_NO_ACTIVOS.has(nombre)) continue
        if (!setterData.has(nombre)) setterData.set(nombre, { conv_asig: 0, agendas: 0, calendarios_enviados: 0, agendas_calificadas: 0, cash_collected: 0 })
        const d = setterData.get(nombre)!
        if (row.tipo === "conversaciones_asignadas") d.conv_asig += row.valor || 0
        else if (row.tipo === "calendarios_enviados") d.calendarios_enviados += row.valor || 0
      }
    } catch { /* table may not exist yet */ }

    const setters = Array.from(setterData.entries())
      .map(([nombre, d]) => ({
        nombre,
        conv_asig: d.conv_asig || null,
        calendarios_enviados: d.calendarios_enviados || null,
        agendas: d.agendas,
        agendas_calificadas: d.agendas_calificadas,
        cash_collected: r2(d.cash_collected),
        t_agenda: d.conv_asig > 0 ? r2((d.agendas / d.conv_asig) * 100) : null,
      }))
      .sort((a, b) => b.agendas - a.agendas)
    const conversaciones_asignadas_total = setters.reduce((total, setter) => total + (setter.conv_asig || 0), 0)

    const weekCount = (SEMANAS[mes] || []).length

    // VOLUMEN — agregaciones de agendas por dimensión
    type Row = { cuenta?: string | null; fuente?: string | null; ocupacion?: string | null; manychat?: string | null }
    const SIN = "Sin dato"
    function tally(rows: Row[], field: keyof Row, opts: { normalize?: (v: string) => string; emptyLabel?: string } = {}) {
      const fallback = opts.emptyLabel || SIN
      const map = new Map<string, number>()
      for (const r of rows) {
        let v = (r[field] || "").toString().trim()
        if (!v || v === "-" || v === "No se le envió") v = fallback
        else if (opts.normalize) v = opts.normalize(v)
        map.set(v, (map.get(v) || 0) + 1)
      }
      return Array.from(map.entries())
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((x, y) => y.cantidad - x.cantidad)
    }

    // EXPOSURE opera una sola cuenta: todo lo cargado en "cuenta" se agrupa
    // bajo la cuenta real del negocio (misma regla que en detalle/route.ts).
    const cuentaNorm = () => "EXPOSURE (@alexmcarrera)"

    const volumen = {
      total: aBySetterFecha.length,
      por_cuenta: tally(aBySetterFecha as Row[], "cuenta", { normalize: cuentaNorm }),
      por_ocupacion: tally(aBySetterFecha as Row[], "ocupacion", { emptyLabel: "No se le envió" }),
      por_fuente: tally(aBySetterFecha as Row[], "fuente").slice(0, 15),
      por_manychat: tally(aBySetterFecha as Row[], "manychat", { emptyLabel: "No se le envió" }),
    }

    // ==========================================
    // TRAZABILIDAD COMERCIAL DETALLADA (6 PUNTOS)
    // ==========================================
    // 1. Cuántas llamadas calificadas vamos
    const totalProgTraz = a.length
    const califProgTraz = a.filter(x => esAgendaCalificada(x.calificacion, x.lead_score_grade)).length
    const totalShowTraz = a.filter(x => x.show === true).length
    const califShowTraz = a.filter(x => x.show === true && esAgendaCalificada(x.calificacion, x.lead_score_grade)).length
    const cierresCalifTraz = a.filter(x => (x.cerro === true || x.estado === "Adentro en Call" || x.estado === "Adentro en FUP" || x.estado === "Cerrado") && esAgendaCalificada(x.calificacion, x.lead_score_grade)).length

    const llamadas_calificadas = {
      total_programadas: totalProgTraz,
      calificadas_programadas: califProgTraz,
      pct_calificadas_programadas: pct(califProgTraz, totalProgTraz),
      presentadas_total: totalShowTraz,
      calificadas_presentadas: califShowTraz,
      pct_show_calificadas: pct(califShowTraz, califProgTraz),
      cierres_calificados: cierresCalifTraz,
      tc_calificadas_pct: pct(cierresCalifTraz, califShowTraz),
    }

    // 2. De qué país están viniendo las ventas o los leads
    const cashPorIdentityPais = new Map<string, number>()
    for (const pago of p) {
      const k = identityKey(pago)
      cashPorIdentityPais.set(k, (cashPorIdentityPais.get(k) || 0) + Number(pago.monto || 0))
    }

    const paisMap = new Map<string, { pais: string; codigo: string; bandera: string; leads: number; presentadas: number; ventas: number; cash_collected: number }>()

    for (const agenda of a) {
      const infoPais = detectarPais(agenda.telefono, agenda.fuente)
      const key = infoPais.pais
      if (!paisMap.has(key)) {
        paisMap.set(key, { ...infoPais, leads: 0, presentadas: 0, ventas: 0, cash_collected: 0 })
      }
      const entry = paisMap.get(key)!
      entry.leads++
      if (agenda.show === true) entry.presentadas++
      const cerroLead = agenda.cerro === true || agenda.estado === "Adentro en Call" || agenda.estado === "Adentro en FUP" || agenda.estado === "Cerrado"
      if (cerroLead) entry.ventas++

      const idKey = identityKey(agenda)
      if (cashPorIdentityPais.has(idKey)) {
        entry.cash_collected += cashPorIdentityPais.get(idKey)!
        cashPorIdentityPais.delete(idKey)
      }
    }

    for (const pago of p) {
      const idKey = identityKey(pago)
      if (cashPorIdentityPais.has(idKey)) {
        const infoPais = detectarPais(pago.telefono, pago.fuente)
        const key = infoPais.pais
        if (!paisMap.has(key)) {
          paisMap.set(key, { ...infoPais, leads: 0, presentadas: 0, ventas: 0, cash_collected: 0 })
        }
        const entry = paisMap.get(key)!
        entry.ventas++
        entry.cash_collected += cashPorIdentityPais.get(idKey)!
        cashPorIdentityPais.delete(idKey)
      }
    }

    const paises = Array.from(paisMap.values())
      .map(item => ({
        ...item,
        pct_leads: pct(item.leads, totalProgTraz) || 0,
        tc_pct: item.presentadas > 0 ? pct(item.ventas, item.presentadas) : (item.leads > 0 ? pct(item.ventas, item.leads) : null),
      }))
      .sort((x, y) => y.leads - x.leads || y.ventas - x.ventas || y.cash_collected - x.cash_collected)

    // 3, 4, 5. Arquetipos (cuál llega más, show rate, cuál se cierra más)
    const arqStats: Record<MacroArquetipo, {
      macro: MacroArquetipo
      programadas: number
      presentadas: number
      cierres: number
      cash_collected: number
      subarquetipos: Map<string, number>
    }> = {
      "DUEÑO DE NEGOCIO": { macro: "DUEÑO DE NEGOCIO", programadas: 0, presentadas: 0, cierres: 0, cash_collected: 0, subarquetipos: new Map() },
      "EMPLEADO": { macro: "EMPLEADO", programadas: 0, presentadas: 0, cierres: 0, cash_collected: 0, subarquetipos: new Map() },
      "ESTUDIANTE": { macro: "ESTUDIANTE", programadas: 0, presentadas: 0, cierres: 0, cash_collected: 0, subarquetipos: new Map() },
      "SIN CLASIFICAR": { macro: "SIN CLASIFICAR", programadas: 0, presentadas: 0, cierres: 0, cash_collected: 0, subarquetipos: new Map() },
    }

    const cashPorIdentityArq = new Map<string, number>()
    for (const pago of p) {
      const k = identityKey(pago)
      cashPorIdentityArq.set(k, (cashPorIdentityArq.get(k) || 0) + Number(pago.monto || 0))
    }

    for (const agenda of a) {
      const arq = leerArquetipoCrm(agenda.ocupacion)
      const st = arqStats[arq.macro]
      st.programadas++
      if (agenda.show === true) st.presentadas++
      const cerroLead = agenda.cerro === true || agenda.estado === "Adentro en Call" || agenda.estado === "Adentro en FUP" || agenda.estado === "Cerrado"
      if (cerroLead) st.cierres++
      if (arq.subarquetipo) {
        st.subarquetipos.set(arq.subarquetipo, (st.subarquetipos.get(arq.subarquetipo) || 0) + 1)
      }
      const idKey = identityKey(agenda)
      if (cashPorIdentityArq.has(idKey)) {
        st.cash_collected += cashPorIdentityArq.get(idKey)!
      }
    }

    const ranking_llegada = Object.values(arqStats)
      .map(st => ({
        macro: st.macro,
        leads: st.programadas,
        pct_total: pct(st.programadas, totalProgTraz) || 0,
        subarquetipos_top: Array.from(st.subarquetipos.entries())
          .map(([nombre, cantidad]) => ({ nombre, cantidad }))
          .sort((x, y) => y.cantidad - x.cantidad)
          .slice(0, 5),
      }))
      .sort((x, y) => y.leads - x.leads)

    const show_rate_arquetipos = Object.values(arqStats)
      .map(st => ({
        macro: st.macro,
        programadas: st.programadas,
        presentadas: st.presentadas,
        show_rate_pct: pct(st.presentadas, st.programadas),
      }))
      .sort((x, y) => (y.show_rate_pct ?? -1) - (x.show_rate_pct ?? -1))

    const cierres_arquetipos = Object.values(arqStats)
      .map(st => ({
        macro: st.macro,
        presentadas: st.presentadas,
        cierres: st.cierres,
        tc_pct: pct(st.cierres, st.presentadas),
        cash_collected: st.cash_collected,
      }))
      .sort((x, y) => (y.tc_pct ?? -1) - (x.tc_pct ?? -1) || y.cierres - x.cierres)

    // 6. De qué anuncio están llegando los leads y qué tipo de leads
    const adsMap = new Map<string, {
      anuncio: string
      leads: number
      calificados: number
      calificacion_desglose: { S: number; A: number; B: number; C: number; D: number; sin_scoring: number }
      arquetipos_desglose: Record<string, number>
      presentadas: number
      cierres: number
      cash_collected: number
    }>()

    const cashPorIdentityAds = new Map<string, number>()
    for (const pago of p) {
      const k = identityKey(pago)
      cashPorIdentityAds.set(k, (cashPorIdentityAds.get(k) || 0) + Number(pago.monto || 0))
    }

    for (const agenda of a) {
      const nombreAnuncio = (agenda.recurso || agenda.angulo_entrada || agenda.manychat || agenda.fuente || "Sin anuncio identificado").trim()
      if (!adsMap.has(nombreAnuncio)) {
        adsMap.set(nombreAnuncio, {
          anuncio: nombreAnuncio,
          leads: 0,
          calificados: 0,
          calificacion_desglose: { S: 0, A: 0, B: 0, C: 0, D: 0, sin_scoring: 0 },
          arquetipos_desglose: {},
          presentadas: 0,
          cierres: 0,
          cash_collected: 0,
        })
      }
      const entry = adsMap.get(nombreAnuncio)!
      entry.leads++
      const esCalif = esAgendaCalificada(agenda.calificacion, agenda.lead_score_grade)
      if (esCalif) entry.calificados++

      const califGrade = String(agenda.lead_score_grade || agenda.calificacion || "").replace(/LEAD\s*/i, "").trim().slice(0, 1).toUpperCase()
      if (["S", "A", "B", "C", "D"].includes(califGrade)) {
        (entry.calificacion_desglose as any)[califGrade]++
      } else {
        entry.calificacion_desglose.sin_scoring++
      }

      const arq = leerArquetipoCrm(agenda.ocupacion)
      entry.arquetipos_desglose[arq.macro] = (entry.arquetipos_desglose[arq.macro] || 0) + 1

      if (agenda.show === true) entry.presentadas++
      const cerroLead = agenda.cerro === true || agenda.estado === "Adentro en Call" || agenda.estado === "Adentro en FUP" || agenda.estado === "Cerrado"
      if (cerroLead) entry.cierres++

      const idKey = identityKey(agenda)
      if (cashPorIdentityAds.has(idKey)) {
        entry.cash_collected += cashPorIdentityAds.get(idKey)!
      }
    }

    const anuncios = Array.from(adsMap.values())
      .map(ad => {
        let arqMax = "SIN CLASIFICAR"
        let maxCount = -1
        for (const [m, count] of Object.entries(ad.arquetipos_desglose)) {
          if (count > maxCount) {
            maxCount = count
            arqMax = m
          }
        }
        return {
          ...ad,
          pct_calificados: pct(ad.calificados, ad.leads),
          arquetipo_principal: arqMax,
          tc_pct: pct(ad.cierres, ad.presentadas),
        }
      })
      .sort((x, y) => y.leads - x.leads)

    const trazabilidad = {
      llamadas_calificadas,
      paises,
      arquetipos: {
        ranking_llegada,
        show_rate: show_rate_arquetipos,
        cierres: cierres_arquetipos,
      },
      anuncios,
    }

    // Embudo de llamadas, cierres, fees, tasas y cash: la regla única de lib/metricas-ventas (la misma que Home y
    // Resumen de ventas, definida con Alex el 15/10/2026). El resto de los bloques sigue con su cálculo.
    const u = await metricasVentas(sb, { desde: start, hasta: end, embudos })
    const roasU = metaSpend.spend > 0 ? r2(u.cash.feccu / metaSpend.spend) : null

    return NextResponse.json({
      mes, weekIdx, weekCount, volumen, embudo, embudos,
      ventas: searchParams.get("detalle") === "1" ? u : { ...u, llamadas: undefined, lista_pagos: undefined },
      // ?detalle=1: las filas que suman cada tarjeta del Home (mismas variables que los totales de abajo)
      detalle: searchParams.get("detalle") === "1" ? {
        planes: planes.map((plan: any) => ({
          id: plan.id, cliente: plan.cliente || "Sin nombre", operacion: plan.operacion || "", closer: plan.closer || "",
          fecha: String(plan.created_at || "").slice(0, 10),
          total: r2((plan.plan_pago_items || []).reduce((t: number, i: any) => t + Number(i.monto || 0), 0)),
          ventas_nuevas: r2((plan.plan_pago_items || []).reduce((t: number, i: any) => t + (VENTA_NUEVA_EXTERNA.has(i.concepto || "") ? Number(i.monto || 0) : 0), 0)),
          cuotas: (plan.plan_pago_items || []).length,
        })),
        aov_tc: aov_tc_arr.map((x: any) => ({ fecha: x.fecha, cliente: x.cliente, tipo: x.tipo, monto: r2(x.monto || 0), closer: x.closer })),
        aov_dia1: aov_d1_arr.map((x: any) => ({ fecha: x.fecha, cliente: x.cliente, tipo: x.tipo, monto: r2(x.monto || 0), closer: x.closer })),
        ad_spend: { spend: metaSpend.spend, source: metaSpend.source, estimated: metaSpend.estimated, available: metaSpend.available, por_embudo: gastoEmbudos },
      } : undefined,
      trazabilidad,
      funnel: {
        total_agendas: u.agendas, calls_evaluables: u.ocurridas, calificadas: u.calificadas, presentadas: u.presentadas, calif_presentadas: u.calif_presentadas,
        cierres: u.cierres, cierres_fe: u.cierres, cierres_be: u.cierres_back_end, cierres_llamada, cierres_seguimiento,
        cierres_calificados: u.cierres_calificados, fees: u.fees, pendientes: u.pendientes, canceladas: u.canceladas,
        canceladas_triage, no_show: u.no_show, no_response, sin_resultado: u.sin_resultado,
        pct_calificadas: pct(u.calificadas, u.agendas),
        show_total: u.show_rate,
        show_calif: u.show_rate_calif,
        // Si no hubo triage, esta tasa sería idéntica al show calificado y no
        // agrega información. Se devuelve null para que la UI diga "No aplica"
        // en vez de mostrar dos porcentajes iguales que parecen un error.
        show_sin_triage: canceladas_triage_calif > 0
          ? pct(calif_presentadas, calificadasOcurridas.length - canceladas_triage_calif)
          : null,
        pct_canceladas_triage: pct(canceladas_triage, u.ocurridas + canceladas_triage),
        pct_no_show: pct(u.no_show, u.ocurridas),
        pct_no_response: pct(no_response, u.ocurridas + no_response),
        pct_sin_resultado: pct(u.sin_resultado, u.ocurridas),
        con_calificaba_realmente, calificaron_si_realmente,
        pct_calificaba_realmente: pct(calificaron_si_realmente, con_calificaba_realmente),
        // TC (tasa de cierre) del funnel de Front End: solo unidades FE.
        // Las ventas internas (Venta Nueva Interna / BE) no cuentan acá.
        tc_total: pct(u.cierres, u.agendas),
        tc_presentadas: u.tasa_cierre,
        tc_calificadas: u.tasa_cierre_calif,
      },
      cash: {
        feccu: u.cash.feccu, feccp: u.cash.feccp, beccu: u.cash.beccu, beccpp: u.cash.beccpp, cc_total: u.cash.total, otros: u.cash.otros,
        ventas_nuevas: u.cash.ventas_nuevas, fees_count: u.fees,
        fees_sum: u.fees_monto, aov_dia1, aov_tc, revenue, ventas_nuevas_revenue,
        roas: roas ?? roasU, cac: metaSpend.spend > 0 && u.cierres > 0 ? r2(metaSpend.spend / u.cierres) : cac,
        ad_spend: metaSpend.spend, ad_spend_available: metaSpend.available,
        ad_spend_source: metaSpend.source, ad_spend_estimated: metaSpend.estimated,
      },
      cash_por_calificacion,
      cash_por_closer,
      comparacion_cierre: {
        pagos_totales,
        unidades_cerradas: u.cierres,
        tc_pagos_totales_agendas: pct(pagos_totales, total_agendas),
        tc_pagos_totales_presentadas: pct(pagos_totales, presentadas),
        tc_pagos_totales_calificadas: pct(pagos_totales, calif_presentadas),
        tc_unidades_agendas: pct(u.cierres, u.agendas),
        tc_unidades_presentadas: u.tasa_cierre,
        tc_unidades_calificadas: u.tasa_cierre_calif,
      },
      seguidores: await seguidoresP.then((x) => x && { nuevos: x.nuevos, gasto: x.gasto, costo_por_seguidor: x.costo_por_seguidor, neto: x.neto, costo_por_seguidor_neto: x.costo_por_seguidor_neto }),
      setters,
      nuevos_leads,
      conversaciones_asignadas_total,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 })
  }
}
