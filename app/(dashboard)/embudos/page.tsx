"use client"

import { useState } from "react"
import useSWR from "swr"
import { Filter, Info, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CrmPageIntro } from "@/components/crm-ui"
import { cn } from "@/lib/utils"

// Métricas por embudo: Webinar / Orgánico (incluye Ads) / Outbound, en formato de tabla, con el criterio de Alex:
// cierre = cliente que entró (los fees van aparte); AOV Trato Cerrado = lo que pagó cada cliente el día que entró;
// AOV Día 1 = lo recibido el día del cierre sobre todos los compromisos (ventas + fees); cash desde la tabla pagos.

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Error"); return b })
const EMBUDOS = ["Webinar", "Orgánico", "Outbound", "Sin fuente", "Total"] as const
type Detalle = { cierres: Array<{ cliente: string; dia: string; cobrado: number; fuente: string | null; via: string; ticket: number | null }>; fees: Array<{ cliente: string; dia: string; monto: number; fuente: string | null }>; fees_sin_pago: Array<{ nombre: string; closer: string | null; fecha: string | null }> }
type Bloque = { agendas: number; presentadas: number; no_show: number; sin_resultado: number; futuras: number; show_up: number | null; calificadas: number; calif_presentadas: number; show_up_calif: number | null; cierres: number; tc_calif_presentadas: number | null; tc_presentadas: number | null; fees: number; fees_usd: number; fees_sin_pago: number; ticket_promedio: number | null; aov_trato_cerrado: number | null; aov_dia_1: number | null; aov_tc_sobre_ticket: number | null; aov_dia1_sobre_ticket: number | null; cash_total: number; cash_leads_mes: number; cuotas: number; back_end: number; detalle: Detalle }
type Respuesta = { mes: string; corte: string; embudos: Record<string, Bloque>; origenes: Array<{ origen: string; embudo: string; agendas: number; presentadas: number; calificadas: number; cierres: number; fees: number; cash_leads_mes: number }>; outbound: { leads: Array<{ id: string; nombre: string; fecha: string | null; origen: string | null; setter: string | null; closer: string | null; calificacion: string | null; show: boolean | null; estado: string | null; motivo: string | null; recurso: string | null; pagos: string; cash: number }>; por_setter: Array<{ setter: string; agendas: number; presentadas: number; calificadas: number; cierres: number; cash: number }> }; pagos_sin_fuente: Array<{ cliente: string; via: string; pagos: string; cash: number }>; pagos_del_mes: number; cash_del_mes: number }

const usd = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 0 }))
const pc = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`)
const fecha = (v: string | null | undefined) => (v ? new Date(v.includes("T") ? v : v.replace(" ", "T") + "Z").toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit" }) : "—")
const meses = () => { const out: Array<{ v: string; l: string }> = []; const d = new Date(); for (let i = 0; i < 8; i++) { const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; out.push({ v, l: d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }) }); d.setMonth(d.getMonth() - 1) } return out }

type Fila = { label: string; get: (b: Bloque) => string; bold?: boolean; sub?: boolean; detalle?: keyof Detalle; nota?: string }
const FILAS: Fila[] = [
  { label: "Agendas (calls del mes)", get: (b) => String(b.agendas) },
  { label: "Se presentaron", get: (b) => String(b.presentadas) },
  { label: "No show", get: (b) => String(b.no_show) },
  { label: "Sin resultado cargado", get: (b) => String(b.sin_resultado), sub: true, nota: "calls que ya pasaron y nadie marcó show / no show" },
  { label: "Calls futuras", get: (b) => String(b.futuras), sub: true },
  { label: "Show up", get: (b) => pc(b.show_up), bold: true, nota: "presentadas sobre calls con resultado" },
  { label: "Calificadas (A/B/C)", get: (b) => String(b.calificadas) },
  { label: "Calificadas presentadas", get: (b) => String(b.calif_presentadas) },
  { label: "Show up calificado", get: (b) => pc(b.show_up_calif) },
  { label: "Cierres (entraron al programa)", get: (b) => String(b.cierres), bold: true, detalle: "cierres", nota: "clientes con Venta Nueva / Adentro en Seguimiento en el mes; un fee no es cierre" },
  { label: "Tasa de cierre s/ calificadas presentadas", get: (b) => pc(b.tc_calif_presentadas), bold: true },
  { label: "Tasa de cierre s/ presentadas", get: (b) => pc(b.tc_presentadas) },
  { label: "Fees cobrados (personas · USD)", get: (b) => `${b.fees} · ${usd(b.fees_usd)}`, detalle: "fees" },
  { label: "Fees marcados en la agenda sin pago cargado", get: (b) => String(b.fees_sin_pago), sub: true, detalle: "fees_sin_pago" },
  { label: "Ticket promedio del trato", get: (b) => usd(b.ticket_promedio), nota: "valor total del plan de pagos de los que entraron" },
  { label: "AOV Trato Cerrado", get: (b) => usd(b.aov_trato_cerrado), bold: true, nota: "lo que pagó cada cliente el día que entró · sano: 33 a 50 % del ticket" },
  { label: "AOV Trato Cerrado sobre el ticket", get: (b) => pc(b.aov_tc_sobre_ticket), sub: true },
  { label: "AOV Día 1", get: (b) => usd(b.aov_dia_1), bold: true, nota: "lo recibido el día del cierre sobre todos los compromisos (ventas + fees) · mínimo: 10 % del ticket" },
  { label: "AOV Día 1 sobre el ticket", get: (b) => pc(b.aov_dia1_sobre_ticket), sub: true },
  { label: "Cash collected total", get: (b) => usd(b.cash_total), bold: true, nota: "todo lo cobrado en el mes a clientes de este embudo" },
  { label: "De leads con call en el mes", get: (b) => usd(b.cash_leads_mes), sub: true },
  { label: "Cuotas de clientes anteriores", get: (b) => usd(b.cuotas), sub: true },
  { label: "Ventas internas / back end", get: (b) => usd(b.back_end), sub: true },
]

export default function EmbudosPage() {
  const [mes, setMes] = useState(meses()[0].v)
  const [abierto, setAbierto] = useState<string | null>(null)
  const { data, error, isLoading, mutate } = useSWR<Respuesta>(`/api/embudos?mes=${mes}`, fetcher)
  const E = data?.embudos
  const detalle = abierto && E ? (() => { const [emb, key] = abierto.split("|") as [string, keyof Detalle]; return { emb, key, items: E[emb]?.detalle?.[key] || [] } })() : null

  return <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-7">
    <CrmPageIntro eyebrow="Ventas · Métricas por embudo" title="Embudos" tone="violet" icon={<Filter className="h-5 w-5" />}
      description="Webinar, orgánico (incluye Ads: es el mismo embudo potenciado con Meta Ads) y outbound, con el mismo criterio: cierre = cliente que entró, fees aparte, AOV desde los pagos. Tocá un número de cierres o fees para ver quiénes son."
      actions={<Button variant="outline" size="sm" onClick={() => mutate()}><RefreshCw className={cn("mr-1 h-4 w-4", isLoading && "animate-spin")} />Actualizar</Button>} />

    <div className="flex flex-wrap gap-1">{meses().map((m) => <Button key={m.v} size="sm" variant={mes === m.v ? "default" : "outline"} onClick={() => { setMes(m.v); setAbierto(null) }} className="capitalize">{m.l}</Button>)}</div>

    {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-500">{error.message}</p>}
    {isLoading && !data && <p className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Calculando…</p>}

    {E && <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-3 py-2 text-left">{data?.mes}</th>{EMBUDOS.map((e) => <th key={e} className={cn("px-3 py-2 text-right", e === "Total" && "border-l")}>{e}</th>)}</tr>
        </thead>
        <tbody>
          {FILAS.map((f) => <tr key={f.label} className={cn("border-t", f.bold && "bg-muted/30")}>
            <td className={cn("px-3 py-1.5", f.sub ? "pl-7 text-xs text-muted-foreground" : "font-medium", f.bold && "font-bold")}>
              {f.label}{f.nota && <span title={f.nota} className="ml-1 inline-flex align-middle text-muted-foreground"><Info className="h-3 w-3" /></span>}
            </td>
            {EMBUDOS.map((e) => {
              const b = E[e]; const v = f.get(b); const k = `${e}|${f.detalle}`
              const puede = f.detalle && b.detalle[f.detalle].length > 0
              return <td key={e} className={cn("px-3 py-1.5 text-right tabular-nums", f.bold && "font-bold", e === "Total" && "border-l", f.sub && "text-xs text-muted-foreground")}>
                {puede ? <button className={cn("underline decoration-dotted underline-offset-4 hover:text-blue-500", abierto === k && "text-blue-500")} onClick={() => setAbierto(abierto === k ? null : k)}>{v}</button> : v}
              </td>
            })}
          </tr>)}
        </tbody>
      </table>
    </div>}

    {detalle && <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="font-black">{detalle.emb} · {detalle.key === "cierres" ? "cierres" : detalle.key === "fees" ? "fees cobrados" : "fees marcados sin pago cargado"} ({detalle.items.length})</h2>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {detalle.items.map((it, i) => {
          if (detalle.key === "cierres") { const x = it as Detalle["cierres"][number]; return <li key={i} className="rounded-lg border px-3 py-1.5"><strong>{x.cliente}</strong> · {fecha(x.dia)} · pagó al entrar USD {usd(x.cobrado)}{x.ticket ? ` de ${usd(x.ticket)}` : ""}<span className="block text-xs text-muted-foreground">{x.fuente || "sin fuente"} · enlazado por {x.via}</span></li> }
          if (detalle.key === "fees") { const x = it as Detalle["fees"][number]; return <li key={i} className="rounded-lg border px-3 py-1.5"><strong>{x.cliente}</strong> · {fecha(x.dia)} · USD {usd(x.monto)}<span className="block text-xs text-muted-foreground">{x.fuente || "sin fuente"}</span></li> }
          const x = it as Detalle["fees_sin_pago"][number]; return <li key={i} className="rounded-lg border px-3 py-1.5"><strong>{x.nombre}</strong> · call {fecha(x.fecha)} · {x.closer || "sin closer"}<span className="block text-xs text-muted-foreground">estado Fee en la agenda, sin pago en Cargar pago</span></li>
        })}
      </ul>
    </section>}

    {data && <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="font-black">Orgánico por origen</h2>
        <p className="text-xs text-muted-foreground">Cómo se reparte el embudo orgánico entre reels, historias, carruseles, Ads, referidos…</p>
        <table className="mt-3 w-full text-sm"><thead className="text-[11px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">Origen</th><th className="text-right">Agendas</th><th className="text-right">Present.</th><th className="text-right">Calif.</th><th className="text-right">Cierres</th><th className="text-right">Fees</th><th className="text-right">Cash leads del mes</th></tr></thead>
          <tbody>{data.origenes.filter((o) => o.embudo === "Orgánico").map((o) => <tr key={o.origen} className="border-t"><td className="py-1">{o.origen}</td><td className="text-right">{o.agendas}</td><td className="text-right">{o.presentadas}</td><td className="text-right">{o.calificadas}</td><td className="text-right font-bold">{o.cierres}</td><td className="text-right">{o.fees}</td><td className="text-right">{usd(o.cash_leads_mes)}</td></tr>)}</tbody></table>
      </section>
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="font-black">Outbound · por setter</h2>
        <p className="text-xs text-muted-foreground">Quién prospectó cada agenda de outbound y qué salió de ahí.</p>
        {!data.outbound.por_setter.length && <p className="mt-3 text-sm text-muted-foreground">No hubo agendas de outbound con call en este mes.</p>}
        {data.outbound.por_setter.length > 0 && <table className="mt-3 w-full text-sm"><thead className="text-[11px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">Setter</th><th className="text-right">Agendas</th><th className="text-right">Present.</th><th className="text-right">Calif.</th><th className="text-right">Cierres</th><th className="text-right">Cash</th></tr></thead>
          <tbody>{data.outbound.por_setter.map((s) => <tr key={s.setter} className="border-t"><td className="py-1">{s.setter}</td><td className="text-right">{s.agendas}</td><td className="text-right">{s.presentadas}</td><td className="text-right">{s.calificadas}</td><td className="text-right font-bold">{s.cierres}</td><td className="text-right">{usd(s.cash)}</td></tr>)}</tbody></table>}
      </section>
    </div>}

    {data && data.outbound.leads.length > 0 && <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="font-black">Outbound · trazabilidad lead por lead</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="text-[11px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">Lead</th><th className="text-left">Call</th><th className="text-left">Origen</th><th className="text-left">Setter</th><th className="text-left">Closer</th><th className="text-left">Calif.</th><th className="text-left">Show</th><th className="text-left">Estado</th><th className="text-left">Motivo</th><th className="text-left">Pagos</th></tr></thead>
        <tbody>{data.outbound.leads.map((l) => <tr key={l.id} className="border-t"><td className="py-1 font-medium">{l.nombre}</td><td>{fecha(l.fecha)}</td><td>{l.origen}</td><td>{l.setter || "—"}</td><td>{l.closer || "—"}</td><td>{l.calificacion || "—"}</td><td>{l.show === true ? "Sí" : l.show === false ? "No" : "—"}</td><td>{l.estado || "—"}</td><td className="text-xs text-muted-foreground">{l.motivo || ""}</td><td className={cn(l.pagos && "font-bold")}>{l.pagos || "—"}</td></tr>)}</tbody></table></div>
    </section>}

    {data && data.pagos_sin_fuente.length > 0 && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h2 className="font-black">Pagos del mes sin embudo asignado</h2>
      <p className="text-xs text-muted-foreground">Clientes con pago que no tienen agenda enlazada ni fuente cargada en el pago. Se cuentan en "Sin fuente". Para atribuirlos, cargá la fuente en el pago o enlazá la agenda.</p>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">{data.pagos_sin_fuente.map((p, i) => <li key={i} className="rounded-lg border px-3 py-1.5"><strong>{p.cliente}</strong> · {p.pagos} · USD {usd(p.cash)}</li>)}</ul>
    </section>}

    {data && <p className="text-xs text-muted-foreground">Corte {data.corte} · {data.pagos_del_mes} pagos activos en el mes por USD {usd(data.cash_del_mes)} (tabla pagos). Las agendas cuentan por la fecha de la call; los pagos por su fecha, atribuidos al embudo de la agenda del cliente aunque la call haya sido en otro mes.</p>}
  </div>
}
