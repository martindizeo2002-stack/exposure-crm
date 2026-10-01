import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { inversionAds } from "@/lib/ads-embudos"

export const dynamic = "force-dynamic"

// Métricas por embudo: Webinar / Orgánico (incluye Ads: es el mismo embudo orgánico potenciado con Meta Ads) /
// Outbound / Sin fuente. Criterio de Alex (24/09/2026):
//  - Cierre = cliente que entró al programa (Venta Nueva, Adentro en Seguimiento, Completó PIF…). Un fee NO es cierre.
//  - AOV Trato Cerrado = lo que pagó cada cliente el día que entró (sumando los pagos de ese día).
//  - AOV Día 1 = lo recibido el día del cierre, promediado sobre todos los compromisos (clientes que entraron + fees).
//  - Cash collected = tabla pagos (nunca agendas.cc_dia_1 ni el plan de pagos), solo front end, atribuido al embudo de la
//    agenda del cliente. Las ventas internas / back end (clientes que ya estaban) no entran en ningún embudo: van aparte.
// Cada pago se enlaza a su agenda por persona, por teléfono o por nombre (nombre de pila igual + un apellido igual).

const EMBUDOS = ["Webinar", "Orgánico", "Outbound", "Sin fuente"] as const
type Embudo = (typeof EMBUDOS)[number]
const CAL = new Set(["LEAD S", "LEAD A", "LEAD B", "LEAD C"])
const FE = new Set(["Venta Nueva", "Adentro en Seguimiento", "Adentro en Seguimiento y Post Fee", "Completó PIF", "Venta Nueva (En Call)", "Venta Nueva (Post Fee)", "Completó PIF (Post Fee)", "Completó PIF + Acceso Total Consulting", "Completa Total (Post Venta)"])
const BE = new Set(["Venta Interna", "Venta Nueva Interna", "Upsell (Agency)", "Upsell /Agency)", "Venta Nueva Interna (Post Fee)", "Cuota Venta Interna", "Fee Venta Interna"])
const FEE = new Set(["Fee", "Refuerzo de Fee"])

const minus = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
const tokens = (s: unknown) => minus(s).replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean)
const tel9 = (s: unknown) => { const d = String(s ?? "").replace(/\D/g, ""); return d.length >= 9 ? d.slice(-9) : "" }
function embudoDe(fuente: unknown): Embudo {
  const f = minus(fuente).trim()
  if (!f) return "Sin fuente"
  if (/webinar|masterclass/.test(f)) return "Webinar"
  if (/outbound|prospecci/.test(f)) return "Outbound"
  return "Orgánico"
}
const r0 = (n: number) => Math.round(n)
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)
const prom = (xs: number[]) => (xs.length ? r0(xs.reduce((s, x) => s + x, 0) / xs.length) : null)

type Agenda = { id: string; person_id: string | null; nombre: string; telefono: string | null; fuente: string | null; setter: string | null; closer: string | null; calificacion: string | null; show: boolean | null; cerro: boolean; estado: string | null; motivo_no_cierre: string | null; fecha_closer: string | null; recurso: string | null }
type Pago = { id: string; fecha: string; cliente: string | null; telefono: string | null; tipo: string | null; monto: number | null; fuente: string | null; person_id: string | null; closer: string | null }
type Cliente = { clave: string; nombre: string; fuente: string | null; embudo: Embudo; via: string; fecha_closer: string | null; agenda_id: string | null; pagos: Pago[] }

function nuevoBloque() {
  return { agendas: 0, presentadas: 0, no_show: 0, sin_resultado: 0, futuras: 0, calificadas: 0, calif_presentadas: 0, calif_con_resultado: 0,
    cierres: [] as Array<{ cliente: string; dia: string; cobrado: number; pagos_del_dia: string; fuente: string | null; via: string }>,
    fees: [] as Array<{ cliente: string; dia: string; monto: number; pagos_del_dia: string; fuente: string | null }>,
    fees_sin_pago: [] as Array<{ nombre: string; closer: string | null; fecha: string | null }>,
    dia1: [] as number[], cash_total: 0, cash_leads_mes: 0, cuotas: 0, back_end: 0 }
}
type Bloque = ReturnType<typeof nuevoBloque>

function resumen(b: Bloque) {
  const cierres = b.cierres.length
  return {
    agendas: b.agendas, presentadas: b.presentadas, no_show: b.no_show, sin_resultado: b.sin_resultado, futuras: b.futuras,
    show_up: pct(b.presentadas, b.presentadas + b.no_show),
    calificadas: b.calificadas, calif_presentadas: b.calif_presentadas, show_up_calif: pct(b.calif_presentadas, b.calif_con_resultado),
    cierres, tc_calif_presentadas: pct(cierres, b.calif_presentadas), tc_presentadas: pct(cierres, b.presentadas),
    fees: b.fees.length, fees_usd: r0(b.fees.reduce((s, f) => s + f.monto, 0)), fees_sin_pago: b.fees_sin_pago.length,
    // AOV Trato Cerrado = promedio de lo cobrado el día que entró cada cliente; AOV Día 1 = lo mismo sobre clientes + fees. Solo pagos, nunca el plan.
    aov_trato_cerrado: prom(b.cierres.map((c) => c.cobrado)), aov_dia_1: prom(b.dia1),
    cash_total: r0(b.cash_total), cash_leads_mes: r0(b.cash_leads_mes), cuotas: r0(b.cuotas), back_end: r0(b.back_end),
    detalle: { cierres: b.cierres, fees: b.fees, fees_sin_pago: b.fees_sin_pago },
  }
}

export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams
    const hoy = new Date().toISOString().slice(0, 10)
    const mes = /^\d{4}-\d{2}$/.test(p.get("mes") || "") ? (p.get("mes") as string) : hoy.slice(0, 7)
    const [y, m] = mes.split("-").map(Number)
    const desde = `${mes}-01`
    const hasta = `${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, "0")}-01`
    const ahora = new Date().toISOString().replace("Z", "")
    const sb = createSupabaseAdmin()

    const [agMes, agTodas, pagosMes] = await Promise.all([
      sb.from("agendas").select("id,person_id,nombre,telefono,fuente,setter,closer,calificacion,show,cerro,estado,motivo_no_cierre,fecha_closer,recurso")
        .gte("fecha_closer", desde).lt("fecha_closer", hasta).or("estado.is.null,estado.neq.Archivada manualmente").order("fecha_closer").limit(3000),
      // todas las agendas de los últimos 13 meses (por fecha de alta: también las que no tienen fecha de call) para enlazar pagos
      sb.from("agendas").select("id,person_id,nombre,telefono,fuente,fecha_closer").gte("created_at", new Date(Date.now() - 400 * 86400000).toISOString()).limit(8000),
      sb.from("pagos").select("id,fecha,cliente,telefono,tipo,monto,fuente,person_id,closer").eq("record_status", "active").gte("fecha", desde).lt("fecha", hasta).order("fecha").limit(3000),
    ])
    for (const r of [agMes, agTodas, pagosMes]) if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
    const agendas = (agMes.data || []) as Agenda[]
    const todas = (agTodas.data || []) as Array<{ id: string; person_id: string | null; nombre: string; telefono: string | null; fuente: string | null; fecha_closer: string | null }>
    const pagos = (pagosMes.data || []) as Pago[]

    // índices de agendas (todas, últimos 13 meses) para enlazar pagos
    const porPersona = new Map<string, typeof todas[number]>(), porTel = new Map<string, typeof todas[number]>()
    const porNombre: Array<{ t: string[]; a: typeof todas[number] }> = []
    for (const a of todas) {
      if (a.person_id && !porPersona.has(a.person_id)) porPersona.set(a.person_id, a)
      const t = tel9(a.telefono); if (t && !porTel.has(t)) porTel.set(t, a)
      const tk = tokens(a.nombre); if (tk.length >= 2) porNombre.push({ t: tk, a })
    }
    // misma persona si comparten nombre de pila y un apellido, o dos palabras de más de 2 letras ("Tiago Agustin Alegre" = "Agustín Alegre")
    const mismoNombre = (x: string[], y: string[]) => {
      if (x.length < 2 || y.length < 2) return false
      if (x[0] === y[0] && x.slice(1).some((s) => s.length > 2 && y.slice(1).includes(s))) return true
      const largas = x.filter((s) => s.length > 2 && y.includes(s))
      return largas.length >= 2
    }
    function agendaDe(pg: Pago) {
      if (pg.person_id && porPersona.has(pg.person_id)) return { a: porPersona.get(pg.person_id)!, via: "persona" }
      const t = tel9(pg.telefono); if (t && porTel.has(t)) return { a: porTel.get(t)!, via: "teléfono" }
      const tk = tokens(pg.cliente)
      // preferimos la agenda más cercana a la fecha del pago entre las que coinciden por nombre
      let cand = porNombre.filter((x) => mismoNombre(tk, x.t)).map((x) => x.a)
      // nombre con una sola palabra útil ("Jeyson R"): se acepta solo si hay una única agenda con ese nombre de pila
      if (!cand.length && tk.length && tk.filter((s) => s.length > 2).length === 1 && tk[0].length > 3) {
        const unicos = porNombre.filter((x) => x.t[0] === tk[0]).map((x) => x.a)
        if (unicos.length === 1) cand = unicos
      }
      cand = cand.sort((a, b) => Math.abs(Date.parse(a.fecha_closer || "") - Date.parse(pg.fecha)) - Math.abs(Date.parse(b.fecha_closer || "") - Date.parse(pg.fecha)))
      if (cand.length) return { a: cand[0], via: "nombre" }
      return null
    }

    // pagos agrupados por cliente
    const clientes = new Map<string, Cliente>()
    for (const pg of pagos) {
      const enl = agendaDe(pg)
      const clave = enl ? (enl.a.person_id ? `p:${enl.a.person_id}` : `a:${enl.a.id}`) : (pg.person_id ? `p:${pg.person_id}` : `n:${tokens(pg.cliente).join(" ")}`)
      if (!clientes.has(clave)) {
        const fuente = enl ? enl.a.fuente : pg.fuente
        clientes.set(clave, { clave, nombre: enl ? enl.a.nombre : String(pg.cliente || ""), fuente, embudo: embudoDe(fuente), via: enl ? enl.via : (pg.fuente ? "fuente del pago" : "sin enlace"), fecha_closer: enl ? enl.a.fecha_closer : null, agenda_id: enl ? enl.a.id : null, pagos: [] })
      }
      clientes.get(clave)!.pagos.push(pg)
    }

    const B: Record<string, Bloque> = Object.fromEntries([...EMBUDOS, "Total"].map((e) => [e, nuevoBloque()]))
    const origenes = new Map<string, { origen: string; embudo: Embudo; agendas: number; presentadas: number; calificadas: number; cierres: number; fees: number; cash_leads_mes: number }>()
    const origenDe = (a: { fuente: string | null }) => (a.fuente || "Sin fuente").trim()
    const bump = (a: { fuente: string | null }) => { const o = origenDe(a); if (!origenes.has(o)) origenes.set(o, { origen: o, embudo: embudoDe(o), agendas: 0, presentadas: 0, calificadas: 0, cierres: 0, fees: 0, cash_leads_mes: 0 }); return origenes.get(o)! }

    for (const a of agendas) {
      const e = embudoDe(a.fuente)
      const pasada = Boolean(a.fecha_closer && a.fecha_closer < ahora)
      const o = bump(a); o.agendas++
      if (a.show === true) o.presentadas++
      if (CAL.has(a.calificacion || "")) o.calificadas++
      for (const k of [e, "Total"]) {
        const b = B[k]; b.agendas++
        if (a.show === true) b.presentadas++
        else if (a.show === false) b.no_show++
        else if (pasada) b.sin_resultado++
        else b.futuras++
        if (CAL.has(a.calificacion || "")) { b.calificadas++; if (a.show === true) b.calif_presentadas++; if (a.show !== null) b.calif_con_resultado++ }
      }
    }
    const conPago = new Set<string>()
    for (const c of clientes.values()) {
      if (c.agenda_id) conPago.add(c.agenda_id)
      const ventas = c.pagos.filter((x) => FE.has(x.tipo || "")), fees = c.pagos.filter((x) => FEE.has(x.tipo || ""))
      const leadMes = Boolean(c.fecha_closer && c.fecha_closer >= desde && c.fecha_closer < hasta)
      const o = bump({ fuente: c.fuente })
      // las ventas internas (back end, a clientes que ya estaban) no entran en ningún embudo: se informan aparte
      const frontEnd = c.pagos.filter((x) => !BE.has(x.tipo || ""))
      const delDia = (dia: string) => frontEnd.filter((x) => x.fecha.slice(0, 10) === dia)
      const textoDia = (dia: string) => delDia(dia).map((x) => `${x.tipo} ${r0(Number(x.monto || 0))}`).join(" + ")
      for (const k of [c.embudo, "Total"]) {
        const b = B[k]
        for (const x of c.pagos) {
          const monto = Number(x.monto || 0)
          if (BE.has(x.tipo || "")) { b.back_end += monto; continue }
          b.cash_total += monto
          if (leadMes) { b.cash_leads_mes += monto; if (k !== "Total") o.cash_leads_mes += monto }
          if (!FE.has(x.tipo || "") && !FEE.has(x.tipo || "")) b.cuotas += monto
        }
        if (ventas.length) {
          const dia = ventas.map((x) => x.fecha.slice(0, 10)).sort()[0]
          const cobrado = delDia(dia).reduce((s, x) => s + Number(x.monto || 0), 0)
          b.cierres.push({ cliente: c.nombre, dia, cobrado: r0(cobrado), pagos_del_dia: textoDia(dia), fuente: c.fuente, via: c.via }); b.dia1.push(cobrado)
          if (k !== "Total") o.cierres++
        } else if (fees.length) {
          const dia = fees.map((x) => x.fecha.slice(0, 10)).sort()[0]
          const cobrado = delDia(dia).reduce((s, x) => s + Number(x.monto || 0), 0)
          b.fees.push({ cliente: c.nombre, dia, monto: r0(cobrado), pagos_del_dia: textoDia(dia), fuente: c.fuente }); b.dia1.push(cobrado)
          if (k !== "Total") o.fees++
        }
      }
    }
    // fees marcados en la agenda (estado Fee) sin ningún pago cargado
    for (const a of agendas) {
      if ((a.estado || "") !== "Fee" || conPago.has(a.id)) continue
      const tk = tokens(a.nombre)
      if ([...clientes.values()].some((c) => mismoNombre(tk, tokens(c.nombre)))) continue
      for (const k of [embudoDe(a.fuente), "Total"]) B[k].fees_sin_pago.push({ nombre: a.nombre, closer: a.closer, fecha: a.fecha_closer })
    }

    // Outbound: trazabilidad lead por lead (quién prospectó, qué pasó, qué pagó)
    const outbound = agendas.filter((a) => embudoDe(a.fuente) === "Outbound").map((a) => {
      const c = [...clientes.values()].find((x) => x.agenda_id === a.id || (a.person_id && x.clave === `p:${a.person_id}`))
      const pagosLead = c ? c.pagos.filter((x) => !BE.has(x.tipo || "")).map((x) => `${x.tipo} ${r0(Number(x.monto || 0))}`).join(" · ") : ""
      return { id: a.id, nombre: a.nombre, fecha: a.fecha_closer, origen: a.fuente, setter: a.setter, closer: a.closer, calificacion: a.calificacion, show: a.show, estado: a.estado, motivo: a.motivo_no_cierre, recurso: a.recurso, pagos: pagosLead, cash: c ? r0(c.pagos.filter((x) => !BE.has(x.tipo || "")).reduce((s, x) => s + Number(x.monto || 0), 0)) : 0 }
    })
    const porSetter = new Map<string, { setter: string; agendas: number; presentadas: number; calificadas: number; cierres: number; cash: number }>()
    for (const l of outbound) {
      const s = l.setter || "Sin setter"
      if (!porSetter.has(s)) porSetter.set(s, { setter: s, agendas: 0, presentadas: 0, calificadas: 0, cierres: 0, cash: 0 })
      const x = porSetter.get(s)!; x.agendas++; if (l.show === true) x.presentadas++; if (CAL.has(l.calificacion || "")) x.calificadas++
      if (/Venta Nueva|Adentro en Seguimiento|Completó PIF/.test(l.pagos)) x.cierres++; x.cash += l.cash
    }

    const ventasInternas = [...clientes.values()].flatMap((c) => c.pagos.filter((x) => BE.has(x.tipo || "")).map((x) => ({ cliente: c.nombre, fecha: x.fecha.slice(0, 10), tipo: x.tipo, monto: r0(Number(x.monto || 0)) })))
    const sinFuente = [...clientes.values()].filter((c) => c.embudo === "Sin fuente" && c.pagos.some((x) => !BE.has(x.tipo || ""))).map((c) => ({ cliente: c.nombre, via: c.via, pagos: c.pagos.filter((x) => !BE.has(x.tipo || "")).map((x) => `${x.tipo} ${r0(Number(x.monto || 0))}`).join(" · "), cash: r0(c.pagos.filter((x) => !BE.has(x.tipo || "")).reduce((s, x) => s + Number(x.monto || 0), 0)) }))
    // inversión en Meta Ads del mes, separada por embudo (lib/ads-embudos.ts); si Meta falla, la página sigue sin ads
    const ads = await inversionAds(sb, [mes]).then((x) => x[mes]).catch((e) => ({ mes, total: 0, por_embudo: {}, campanas: [], actualizado: null, fuente: "meta", error: (e as Error).message }))
    return NextResponse.json({
      mes, corte: hoy, ads,
      embudos: Object.fromEntries([...EMBUDOS, "Total"].map((e) => [e, resumen(B[e])])),
      origenes: [...origenes.values()].sort((a, b) => b.agendas - a.agendas),
      outbound: { leads: outbound, por_setter: [...porSetter.values()] },
      pagos_sin_fuente: sinFuente,
      ventas_internas: { pagos: ventasInternas, total: r0(ventasInternas.reduce((s, x) => s + x.monto, 0)) },
      pagos_del_mes: pagos.length, cash_del_mes: r0(pagos.reduce((s, x) => s + Number(x.monto || 0), 0)), cash_front_end: r0(pagos.filter((x) => !BE.has(x.tipo || "")).reduce((s, x) => s + Number(x.monto || 0), 0)),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
