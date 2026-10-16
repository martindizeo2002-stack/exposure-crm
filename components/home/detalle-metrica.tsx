"use client"

// Detalle de cada tarjeta del Home (CEO): de dónde sale el número, fila por fila, y si la suma de las filas da lo
// mismo que muestra la tarjeta. Las filas salen del mismo cálculo que el total (/api/metricas?detalle=1, que usa
// lib/metricas-ventas, y /api/home-ceo-profit?detalle=1), no de una consulta aparte.

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { CheckCircle2, ExternalLink, Loader2, TriangleAlert } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export type MetricaHome = "revenue" | "cash" | "feccu" | "feccp" | "beccu" | "beccpp" | "cuotas" | "promedio" | "roas" | "aov_tc" | "aov" | "objetivo" | "cac" | "profit"

type Fila = Record<string, string | number | null>
type Col = { k: string; label: string; num?: boolean }
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Error"); return j })
const money = (v: number) => `USD ${Math.round(v).toLocaleString("es-AR")}`
const fmtFecha = (s: unknown) => { const t = String(s || ""); return t.length >= 10 ? `${t.slice(8, 10)}/${t.slice(5, 7)}` : "—" }
const suma = (rows: Fila[], k = "monto") => Math.round(rows.reduce((s, r) => s + Number(r[k] || 0), 0) * 100) / 100

const COLS_PAGO: Col[] = [{ k: "fecha", label: "Fecha" }, { k: "cliente", label: "Cliente" }, { k: "tipo", label: "Concepto" }, { k: "closer", label: "Closer" }, { k: "monto", label: "USD", num: true }]

export function DetalleMetrica({ metrica, onClose, start, end, monthKey, valor, goal, dias, extra }: {
  metrica: MetricaHome | null; onClose: () => void; start: string; end: string; monthKey: string
  valor: number | null; goal: number; dias: number
  extra?: { softwareCost?: number; commissions?: number; expenses?: number; comisionesComerciales?: number }
}) {
  const abierta = metrica !== null
  const necesitaPlanes = metrica === "cuotas" || metrica === "profit"
  const { data, error, isLoading } = useSWR(abierta ? `/api/metricas?start=${start}&end=${end}&detalle=1` : null, fetcher)
  const { data: profit } = useSWR(abierta && necesitaPlanes ? `/api/home-ceo-profit?month=${monthKey}&detalle=1` : null, fetcher)
  const [q, setQ] = useState("")

  const vista = useMemo(() => {
    if (!data || !metrica) return null
    const pagos: Fila[] = data.ventas?.lista_pagos || []
    const det = data.detalle || {}
    const porGrupo = (g: string) => pagos.filter((p) => p.grupo === g)
    const subtotales = ["FECCU", "FECCP", "BECCU", "BECCPP", "Otro"].map((g) => ({ g, total: suma(porGrupo(g)), n: porGrupo(g).length })).filter((x) => x.n)
    const cierres: Fila[] = (data.ventas?.lista_cierres || []).map((c: any) => ({ fecha: c.fecha, cliente: c.nombre, closer: c.closer, monto: c.monto }))
    const spend = Number(det.ad_spend?.spend || 0)
    switch (metrica) {
      case "revenue": return {
        titulo: "Revenue", formula: "Suma de todas las cuotas de los planes de pago dados de alta en el mes (cobradas o por cobrar). Es el valor contractual vendido.",
        cols: [{ k: "fecha", label: "Alta" }, { k: "cliente", label: "Cliente" }, { k: "operacion", label: "Operación" }, { k: "closer", label: "Closer" }, { k: "cuotas", label: "Cuotas", num: true }, { k: "total", label: "USD", num: true }] as Col[],
        rows: det.planes || [], total: suma(det.planes || [], "total"), fuente: { href: "/planes-pago", label: "Planes de pago" },
        extra: `De eso, ventas nuevas (fee + venta que da acceso): ${money(suma(det.planes || [], "ventas_nuevas"))}.`,
      }
      case "cash": case "objetivo": return {
        titulo: metrica === "cash" ? "Cash collected" : `Objetivo de cash collected · ${money(goal)}`,
        formula: metrica === "cash" ? "Todos los pagos activos del mes, por fecha de pago: ventas nuevas, fees, cuotas y back end (FECCU + FECCP + BECCU + BECCPP)."
          : `Cash collected del mes ÷ ${money(goal)}. Faltan ${money(Math.max(0, goal - suma(pagos)))}.`,
        cols: [...COLS_PAGO.slice(0, 3), { k: "grupo", label: "Grupo" }, ...COLS_PAGO.slice(3)], rows: pagos, total: suma(pagos), subtotales,
        fuente: { href: "/todos-pagos", label: "Todos los pagos" },
      }
      case "feccu": case "feccp": case "beccu": case "beccpp": {
        const g = { feccu: "FECCU", feccp: "FECCP", beccu: "BECCU", beccpp: "BECCPP" }[metrica]
        const desc = { feccu: "Front end cobrado en el momento: fees y pagos de venta nueva (Venta Nueva, Adentro en Seguimiento, Post Fee, Completó PIF).", feccp: "Front end en cuotas: Cuota 1, 2, 3… de planes de clientes nuevos.", beccu: "Back end cobrado en el momento: Venta Interna, Venta Nueva Interna, Upsell y Fee Venta Interna.", beccpp: "Back end en cuotas: Cuota Venta Interna." }[metrica]
        return { titulo: g, formula: `${desc} Por fecha de pago, pagos activos.`, cols: COLS_PAGO, rows: porGrupo(g), total: suma(porGrupo(g)), fuente: { href: "/todos-pagos", label: "Todos los pagos" } }
      }
      case "cuotas": {
        const items: Fila[] = profit?.pendingInstallmentItems || []
        return {
          titulo: "Cuotas pendientes", formula: "Cuotas de planes de pago todavía sin cobrar (estado pendiente y sin pago vinculado), de todos los planes con alta. No es solo del mes: es todo lo que falta cobrar hoy.",
          cols: [{ k: "fecha_planeada", label: "Vence" }, { k: "cliente", label: "Cliente" }, { k: "concepto", label: "Concepto" }, { k: "closer", label: "Closer" }, { k: "monto", label: "USD", num: true }] as Col[],
          rows: items, total: suma(items), fuente: { href: "/cuotas", label: "Cuotas" }, cargando: !profit,
        }
      }
      case "promedio": {
        const porDia = new Map<string, number>()
        for (const p of pagos) porDia.set(String(p.fecha), (porDia.get(String(p.fecha)) || 0) + Number(p.monto || 0))
        const rows = [...porDia.entries()].sort().map(([fecha, monto]) => ({ fecha, cliente: `${pagos.filter((p) => p.fecha === fecha).length} pagos`, monto: Math.round(monto * 100) / 100 }))
        return {
          titulo: "Promedio diario", formula: `Cash collected del mes (${money(suma(pagos))}) ÷ ${dias} días transcurridos = ${money(suma(pagos) / Math.max(1, dias))}.`,
          cols: [{ k: "fecha", label: "Día" }, { k: "cliente", label: "Pagos" }, { k: "monto", label: "USD", num: true }] as Col[],
          rows, total: Math.round((suma(pagos) / Math.max(1, dias)) * 100) / 100, totalLabel: "Promedio", fuente: { href: "/todos-pagos", label: "Todos los pagos" },
        }
      }
      case "roas": {
        const feccu = suma(porGrupo("FECCU"))
        const emb = det.ad_spend?.por_embudo || {}
        return {
          titulo: "ROAS", formula: `FECCU del mes (${money(feccu)}) ÷ inversión en Meta Ads (${money(spend)}) = ${spend > 0 ? (feccu / spend).toFixed(2) + "x" : "—"}. Fuente del gasto: ${det.ad_spend?.source === "meta" ? "Meta Ads" : det.ad_spend?.source === "mercury" ? "débitos de Meta en Mercury (estimado)" : "sin dato"}.`,
          cols: [{ k: "cliente", label: "Embudo" }, { k: "monto", label: "Inversión USD", num: true }] as Col[],
          rows: Object.entries(emb).map(([k, v]) => ({ cliente: k, monto: Math.round(Number(v || 0) * 100) / 100 })),
          total: spend > 0 ? Math.round((feccu / spend) * 100) / 100 : null, totalLabel: "ROAS", esRatio: true, fuente: { href: "/embudos", label: "Embudos · Meta Ads" },
          extra: `Pagos que suman el FECCU: ${porGrupo("FECCU").length}.`,
        }
      }
      case "aov_tc": case "aov": {
        const rows: Fila[] = (metrica === "aov_tc" ? det.aov_tc : det.aov_dia1) || []
        const prom = rows.length ? Math.round((suma(rows) / rows.length) * 100) / 100 : null
        return {
          titulo: metrica === "aov_tc" ? "AOV TC" : "AOV día 1",
          formula: metrica === "aov_tc" ? `Promedio de los pagos de venta del mes (front y back end, sin fees ni cuotas): ${money(suma(rows))} ÷ ${rows.length} pagos.`
            : `Promedio de lo cobrado en la llamada (Venta Nueva o Fee) en el mes: ${money(suma(rows))} ÷ ${rows.length} pagos.`,
          cols: COLS_PAGO, rows, total: prom, totalLabel: "Promedio", fuente: { href: "/todos-pagos", label: "Todos los pagos" },
        }
      }
      case "cac": {
        const ads = spend, soft = Number(extra?.softwareCost || 0), com = Number(extra?.comisionesComerciales || 0)
        return {
          titulo: "CAC integral", formula: `(Ads ${money(ads)} + software ${money(soft)} + comisiones comerciales ${money(com)}) ÷ ${cierres.length} cierres del mes = ${cierres.length ? money((ads + soft + com) / cierres.length) : "—"}. Cierre = 1 por persona, primer pago de venta nueva.`,
          cols: [{ k: "fecha", label: "Fecha" }, { k: "cliente", label: "Cierre" }, { k: "closer", label: "Closer" }, { k: "monto", label: "USD", num: true }] as Col[],
          rows: cierres, total: cierres.length ? Math.round(((ads + soft + com) / cierres.length) * 100) / 100 : null, totalLabel: "CAC", fuente: { href: "/metricas", label: "Métricas" },
        }
      }
      case "profit": {
        const gastos = Number(extra?.expenses || 0), comis = Number(extra?.commissions || 0)
        return {
          titulo: "Profit", formula: `Cash collected (${money(suma(pagos))}) − gastos del mes (${money(gastos)}) − comisiones del mes (${money(comis)}) = ${money(suma(pagos) - gastos - comis)}.`,
          cols: [{ k: "cliente", label: "Concepto" }, { k: "monto", label: "USD", num: true }] as Col[],
          rows: [{ cliente: "Cash collected", monto: suma(pagos) }, { cliente: "Gastos (Gastos)", monto: -gastos }, { cliente: "Comisiones (Payroll)", monto: -comis }],
          total: Math.round((suma(pagos) - gastos - comis) * 100) / 100, fuente: { href: "/gastos", label: "Gastos" },
        }
      }
    }
  }, [data, profit, metrica, goal, dias, extra])

  const filas = useMemo(() => {
    const rows: Fila[] = vista?.rows || []
    const t = q.trim().toLowerCase()
    return t ? rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(t))) : rows
  }, [vista, q])

  // ¿La suma de las filas da lo que muestra la tarjeta?
  const coincide = vista && valor != null && vista.total != null
    ? Math.abs(Number(vista.total) - (metrica === "objetivo" ? valor : valor)) <= ((vista as any).esRatio ? 0.01 : 1) : null
  const fmtTotal = (v: number | null) => v == null ? "—" : (vista as any)?.esRatio ? `${v.toFixed(2)}x` : money(v)

  return (
    <Dialog open={abierta} onOpenChange={(o) => { if (!o) { setQ(""); onClose() } }}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{vista?.titulo || "Detalle"}</DialogTitle>
          <DialogDescription>{vista?.formula || "Cargando el detalle…"}</DialogDescription>
        </DialogHeader>
        {(isLoading || (vista as any)?.cargando) && <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Trayendo las filas que suman el número…</div>}
        {error && <div className="rounded-lg border border-red-500/30 p-3 text-sm text-red-500">No se pudo cargar el detalle: {String((error as Error).message)}</div>}
        {vista && !(vista as any).cargando && <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{(vista as any).totalLabel || "Total de las filas"}</p><p className="text-2xl font-bold">{fmtTotal(vista.total as number | null)}</p></div>
            {coincide != null && <p className={`flex items-center gap-1.5 text-sm font-semibold ${coincide ? "text-emerald-500" : "text-amber-500"}`}>
              {coincide ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
              {coincide ? "Coincide con la tarjeta" : `La tarjeta dice ${fmtTotal(valor)}: recargá la página (los datos cambiaron mientras la mirabas)`}
            </p>}
            <Link href={vista.fuente.href} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Verificar en {vista.fuente.label}<ExternalLink className="h-3.5 w-3.5" /></Link>
          </div>
          {(vista as any).subtotales?.length > 0 && <div className="flex flex-wrap gap-2">
            {(vista as any).subtotales.map((s: any) => <span key={s.g} className="rounded-full border px-2.5 py-1 text-xs"><b>{s.g}</b> {money(s.total)} · {s.n} pagos</span>)}
          </div>}
          {(vista as any).extra && <p className="text-xs text-muted-foreground">{(vista as any).extra}</p>}
          <Input placeholder="Buscar cliente, concepto o closer…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-sm" />
          <div className="max-h-[48vh] overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr>{vista.cols.map((c) => <th key={c.k} className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${c.num ? "text-right" : ""}`}>{c.label}</th>)}</tr></thead>
              <tbody>
                {filas.map((r, i) => <tr key={i} className="border-t">
                  {vista.cols.map((c) => <td key={c.k} className={`px-3 py-1.5 ${c.num ? "text-right tabular-nums" : ""}`}>
                    {c.k.startsWith("fecha") ? fmtFecha(r[c.k]) : c.num && c.k !== "cuotas" ? Number(r[c.k] || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 }) : String(r[c.k] ?? "—")}
                  </td>)}
                </tr>)}
                {!filas.length && <tr><td colSpan={vista.cols.length} className="px-3 py-6 text-center text-muted-foreground">No hay filas para mostrar.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">{filas.length} filas{q ? " (filtradas)" : ""}. Las filas salen del mismo cálculo que la tarjeta.</p>
        </div>}
      </DialogContent>
    </Dialog>
  )
}
