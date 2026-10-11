"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowDownRight, ArrowUpRight, Loader2, Plus, Scale, Trash2, Wallet } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  AREAS_FINANZAS, CATEGORIAS_EXPOSURE, CATEGORIAS_PERSONALES, LIBROS_FINANZAS, MEDIOS_PAGO,
  type LibroFinanzas, type RegistroFinanzas,
} from "@/lib/finanzas-libros"

const API = "/api/finanzas/libros"
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const COLOR_AREA: Record<string, string> = { Marketing: "#8b5cf6", Ventas: "#22c55e", Producto: "#f59e0b", Operaciones: "#3b82f6", "Sin área": "#94a3b8" }
const COLOR_GASTO = "#f43f5e"
const COLOR_INGRESO = "#10b981"

type Error503 = { error: string; codigo?: string }
const fetcher = async (url: string) => {
  const r = await fetch(url)
  const j = await r.json().catch(() => null)
  if (!r.ok) throw Object.assign(new Error(j?.error || "Error"), { info: j as Error503 })
  return j as RegistroFinanzas[]
}

const usd = (n: number) => "US$ " + (n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const parse = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const mesDe = (iso: string) => { const d = parse(iso); return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const sumarDias = (iso: string, n: number) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return fmt(d) }

type Gran = "dia" | "semana" | "mes"
// Clave del balde: día, lunes de la semana o primer día del mes.
function balde(iso: string, g: Gran) {
  const d = parse(iso)
  if (g === "mes") return `${iso.slice(0, 7)}-01`
  if (g === "semana") { d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return fmt(d) }
  return iso.slice(0, 10)
}
function etiqueta(clave: string, g: Gran) {
  const d = parse(clave)
  if (g === "mes") return `${MESES_CORTO[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
  if (g === "semana") return `sem ${d.getUTCDate()} ${MESES_CORTO[d.getUTCMonth()]}`
  return `${d.getUTCDate()} ${MESES_CORTO[d.getUTCMonth()]}`
}
function siguiente(clave: string, g: Gran) {
  const d = parse(clave)
  if (g === "mes") d.setUTCMonth(d.getUTCMonth() + 1)
  else d.setUTCDate(d.getUTCDate() + (g === "semana" ? 7 : 1))
  return fmt(d)
}

type Rango = "mes" | "30d" | "3m" | "anio" | "todo" | "custom"
const RANGOS: Array<{ id: Rango; label: string }> = [
  { id: "mes", label: "Este mes" }, { id: "30d", label: "Últimos 30 días" }, { id: "3m", label: "Últimos 3 meses" },
  { id: "anio", label: "Este año" }, { id: "todo", label: "Todo" },
]
function limitesRango(r: Rango, filas: RegistroFinanzas[]): [string, string] {
  const hoy = hoyISO()
  if (r === "mes") return [`${hoy.slice(0, 7)}-01`, hoy]
  if (r === "30d") return [sumarDias(hoy, -29), hoy]
  if (r === "3m") { const d = parse(`${hoy.slice(0, 7)}-01`); d.setUTCMonth(d.getUTCMonth() - 2); return [`${fmt(d).slice(0, 7)}-01`, hoy] }
  if (r === "anio") return [`${hoy.slice(0, 4)}-01-01`, hoy]
  const fechas = filas.map(f => f.fecha).sort()
  return [fechas[0] || hoy, fechas[fechas.length - 1] && fechas[fechas.length - 1] > hoy ? fechas[fechas.length - 1] : hoy]
}

// ─────────────────────────── Dashboard ───────────────────────────

// Un punto del gráfico: el balde y los montos por serie (Gastos, Ingresos y cada área).
type Punto = { clave: string; label: string } & Record<string, number | string>
const val = (p: Punto, k: string) => Number(p[k]) || 0

function Dashboard({ libro, filas }: { libro: LibroFinanzas; filas: RegistroFinanzas[] }) {
  const [rango, setRango] = useState<Rango>("3m")
  const [gran, setGran] = useState<Gran>("mes")
  const [propio, setPropio] = useState<[string, string]>(["", ""])
  const esExposure = libro === "exposure"
  const [desde, hasta] = rango === "custom" ? propio : limitesRango(rango, filas)
  const cambiarFecha = (i: 0 | 1, v: string) => { const n: [string, string] = [desde, hasta]; n[i] = v; setPropio(n); setRango("custom") }

  const enRango = useMemo(() => filas.filter(f => (!desde || f.fecha >= desde) && (!hasta || f.fecha <= hasta)), [filas, desde, hasta])
  const gastos = enRango.filter(f => f.tipo === "gasto")
  const ingresos = enRango.filter(f => f.tipo === "ingreso")
  const totalGastos = gastos.reduce((a, f) => a + Number(f.monto_usd), 0)
  const totalIngresos = ingresos.reduce((a, f) => a + Number(f.monto_usd), 0)

  // Serie por balde (día / semana / mes), con los baldes vacíos incluidos para que se vea el ritmo real.
  const serie = useMemo(() => {
    if (!desde || !hasta) return []
    const mapa = new Map<string, Record<string, number>>()
    let k = balde(desde, gran)
    for (let i = 0; k <= hasta && i < 400; i++, k = siguiente(k, gran)) mapa.set(k, {})
    for (const f of enRango) {
      const b = balde(f.fecha, gran)
      const o = mapa.get(b) || {}
      const m = Number(f.monto_usd)
      if (f.tipo === "ingreso") o.Ingresos = (o.Ingresos || 0) + m
      else {
        o.Gastos = (o.Gastos || 0) + m
        const area = f.area || "Sin área"
        o[area] = (o[area] || 0) + m
      }
      mapa.set(b, o)
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([clave, o]) => ({ clave, label: etiqueta(clave, gran), ...o }) as Punto)
  }, [enRango, desde, hasta, gran])
  const baldesConDatos = serie.length || 1

  const desglose = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of gastos) {
      const k = (esExposure ? f.area || "Sin área" : f.categoria || "Sin categoría")
      m.set(k, (m.get(k) || 0) + Number(f.monto_usd))
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [gastos, esExposure])
  const porCategoriaExposure = useMemo(() => {
    if (!esExposure) return []
    const m = new Map<string, number>()
    for (const f of gastos) m.set(f.categoria || "Sin categoría", (m.get(f.categoria || "Sin categoría") || 0) + Number(f.monto_usd))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [gastos, esExposure])
  const areasEnSerie = [...AREAS_FINANZAS, "Sin área"].filter(a => serie.some(s => val(s, a)))
  const nombreGran = gran === "dia" ? "día" : gran === "semana" ? "semana" : "mes"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          {RANGOS.map(r => (
            <button key={r.id} onClick={() => setRango(r.id)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium", rango === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{r.label}</button>
          ))}
        </div>
        <label className="text-xs text-muted-foreground">Desde
          <input type="date" value={desde} onChange={e => cambiarFecha(0, e.target.value)} className="ml-1 h-8 rounded-md border border-input bg-background px-2 text-xs" />
        </label>
        <label className="text-xs text-muted-foreground">Hasta
          <input type="date" value={hasta} onChange={e => cambiarFecha(1, e.target.value)} className="ml-1 h-8 rounded-md border border-input bg-background px-2 text-xs" />
        </label>
        <div className="ml-auto flex gap-1 rounded-lg border border-border p-1">
          {(["dia", "semana", "mes"] as Gran[]).map(g => (
            <button key={g} onClick={() => setGran(g)}
              className={cn("rounded-md px-3 py-1 text-xs font-semibold", gran === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              {g === "dia" ? "Día a día" : g === "semana" ? "Semana a semana" : "Mes a mes"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={ArrowDownRight} tono="text-rose-500" titulo="Gastos" valor={usd(totalGastos)} sub={`${gastos.length} registros`} />
        <Kpi icon={ArrowUpRight} tono="text-emerald-500" titulo="Ingresos manuales" valor={usd(totalIngresos)} sub={`${ingresos.length} registros`} />
        <Kpi icon={Scale} tono={totalIngresos - totalGastos >= 0 ? "text-emerald-500" : "text-rose-500"} titulo="Neto (ingresos − gastos)" valor={usd(totalIngresos - totalGastos)} sub="del período" />
        <Kpi icon={Wallet} tono="text-sky-500" titulo={`Gasto promedio por ${nombreGran}`} valor={usd(totalGastos / baldesConDatos)} sub={`${serie.length} ${nombreGran === "mes" ? "meses" : nombreGran === "día" ? "días" : "semanas"} en el período`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{esExposure ? `Gastos por área, ${nombreGran} a ${nombreGran}` : `Gastos e ingresos, ${nombreGran} a ${nombreGran}`}</CardTitle></CardHeader>
          <CardContent className="h-72">
            {enRango.length === 0 ? <Vacio /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={64} tickFormatter={v => `$${Number(v).toLocaleString("es-AR")}`} />
                  <Tooltip formatter={(v: number) => usd(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fillOpacity: 0.08 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {esExposure
                    ? areasEnSerie.map(a => <Bar key={a} dataKey={a} stackId="g" fill={COLOR_AREA[a]} maxBarSize={48} />)
                    : <Bar dataKey="Gastos" fill={COLOR_GASTO} radius={[4, 4, 0, 0]} maxBarSize={40} />}
                  {totalIngresos > 0 && <Bar dataKey="Ingresos" fill={COLOR_INGRESO} radius={[4, 4, 0, 0]} maxBarSize={esExposure ? 24 : 40} />}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{esExposure ? "Gasto por área" : "Gasto por categoría"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Barras filas={desglose} total={totalGastos} colores={esExposure ? COLOR_AREA : undefined} />
            {esExposure && porCategoriaExposure.length > 0 && <>
              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por tipo de costo</p>
              <Barras filas={porCategoriaExposure} total={totalGastos} />
            </>}
          </CardContent>
        </Card>
      </div>

      {esExposure && serie.length > 0 && gastos.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Áreas × {nombreGran}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-max text-xs">
              <thead><tr className="text-muted-foreground">
                <th className="py-1.5 pr-4 text-left font-semibold">Área</th>
                {serie.map(s => <th key={s.clave} className="px-2 py-1.5 text-right font-semibold">{s.label}</th>)}
                <th className="pl-3 text-right font-semibold">Total</th>
              </tr></thead>
              <tbody>
                {[...AREAS_FINANZAS, "Sin área"].map(a => {
                  const tot = serie.reduce((acc, s) => acc + (val(s, a)), 0)
                  if (!tot && a === "Sin área") return null
                  return (
                    <tr key={a} className="border-t border-border">
                      <td className="py-1.5 pr-4 font-medium"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLOR_AREA[a] }} />{a}</td>
                      {serie.map(s => { const v = val(s, a); return <td key={s.clave} className={cn("px-2 py-1.5 text-right tabular-nums", !v && "text-muted-foreground/50")}>{v ? usd(v) : "—"}</td> })}
                      <td className="pl-3 text-right font-semibold tabular-nums">{usd(tot)}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-1.5 pr-4">Total</td>
                  {serie.map(s => <td key={s.clave} className="px-2 py-1.5 text-right tabular-nums">{usd(val(s, "Gastos"))}</td>)}
                  <td className="pl-3 text-right tabular-nums">{usd(totalGastos)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, tono, titulo, valor, sub }: { icon: typeof Wallet; tono: string; titulo: string; valor: string; sub: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className={cn("h-4 w-4", tono)} />{titulo}</div>
      <p className="mt-1.5 text-xl font-bold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </CardContent></Card>
  )
}

function Barras({ filas, total, colores }: { filas: Array<[string, number]>; total: number; colores?: Record<string, string> }) {
  if (!filas.length) return <Vacio />
  const max = filas[0][1] || 1
  return (
    <div className="space-y-2">
      {filas.map(([k, v]) => (
        <div key={k} className="space-y-0.5">
          <div className="flex justify-between gap-2 text-xs"><span className="truncate">{k}</span><span className="shrink-0 tabular-nums text-muted-foreground">{usd(v)} · {total ? Math.round((v / total) * 100) : 0}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: colores?.[k] || "hsl(var(--primary) / .7)" }} /></div>
        </div>
      ))}
    </div>
  )
}

const Vacio = () => <div className="grid h-full min-h-24 place-items-center text-xs text-muted-foreground">Sin movimientos en el período</div>

// ─────────────────────────── Tablas ───────────────────────────

type Nuevo = Omit<RegistroFinanzas, "id" | "creado_por" | "created_at" | "updated_at">
const vacio = (libro: LibroFinanzas): Nuevo => ({ libro, tipo: "gasto", fecha: hoyISO(), concepto: "", monto_usd: 0, area: null, categoria: null, medio_pago: null, notas: null })

function TablaLibro({ libro, titulo, filas, onCrear, onEditar, onBorrar }: {
  libro: LibroFinanzas; titulo: string; filas: RegistroFinanzas[]
  onCrear: (n: Nuevo) => Promise<boolean>; onEditar: (id: string, c: Partial<RegistroFinanzas>) => void; onBorrar: (r: RegistroFinanzas) => void
}) {
  const esExposure = libro === "exposure"
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState<Nuevo>(vacio(libro))
  const [guardando, setGuardando] = useState(false)
  const [mesFiltro, setMesFiltro] = useState("")
  const meses = useMemo(() => [...new Set(filas.map(f => f.fecha.slice(0, 7)))].sort().reverse(), [filas])
  const visibles = mesFiltro ? filas.filter(f => f.fecha.startsWith(mesFiltro)) : filas
  const g = visibles.filter(f => f.tipo === "gasto").reduce((a, f) => a + Number(f.monto_usd), 0)
  const i = visibles.filter(f => f.tipo === "ingreso").reduce((a, f) => a + Number(f.monto_usd), 0)
  const categorias = esExposure ? CATEGORIAS_EXPOSURE : CATEGORIAS_PERSONALES
  const listaCat = `cat-${libro}`, listaMedio = `medio-${libro}`

  const crear = async () => {
    if (!form.concepto.trim()) return toast.error("Escribí el concepto")
    setGuardando(true)
    const ok = await onCrear(form)
    setGuardando(false)
    if (ok) { setAbierto(false); setForm(vacio(libro)) }
  }

  return (
    <Card>
      <datalist id={listaCat}>{categorias.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id={listaMedio}>{MEDIOS_PAGO.map(c => <option key={c} value={c} />)}</datalist>
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{titulo}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gastos {usd(g)} · Ingresos {usd(i)} · Neto <span className={cn("font-semibold", i - g >= 0 ? "text-emerald-600" : "text-rose-600")}>{usd(i - g)}</span>
            {mesFiltro ? ` · ${mesDe(`${mesFiltro}-01`)}` : " · todo"}
          </p>
        </div>
        <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="">Todos los meses</option>
          {meses.map(m => <option key={m} value={m}>{mesDe(`${m}-01`)}</option>)}
        </select>
        <button onClick={() => { setForm(vacio(libro)); setAbierto(true) }} title="Agregar gasto o ingreso"
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90">
          <Plus className="h-5 w-5" />
        </button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Mes</th>
              <th className="px-2 py-2 text-left font-semibold">Fecha</th>
              <th className="px-2 py-2 text-left font-semibold">Tipo</th>
              <th className="px-2 py-2 text-left font-semibold">Concepto</th>
              <th className="px-2 py-2 text-right font-semibold">Monto USD</th>
              {esExposure && <th className="px-2 py-2 text-left font-semibold">Área</th>}
              <th className="px-2 py-2 text-left font-semibold">{esExposure ? "Tipo de costo" : "Categoría"}</th>
              <th className="px-2 py-2 text-left font-semibold">Medio de pago</th>
              <th className="px-2 py-2 text-left font-semibold">Notas</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td colSpan={esExposure ? 10 : 9} className="px-3 py-8 text-center text-xs text-muted-foreground">Todavía no hay registros. Tocá el + para agregar el primero.</td></tr>
            )}
            {visibles.map(f => (
              <tr key={f.id} className="border-t border-border align-middle hover:bg-muted/20">
                <td className="whitespace-nowrap px-3 py-1 text-xs text-muted-foreground">{mesDe(f.fecha)}</td>
                <td className="px-1 py-1"><Celda tipo="date" valor={f.fecha} onGuardar={v => v && onEditar(f.id, { fecha: v })} className="w-[8.5rem]" /></td>
                <td className="px-1 py-1">
                  <select value={f.tipo} onChange={e => onEditar(f.id, { tipo: e.target.value as RegistroFinanzas["tipo"] })}
                    className={cn("h-8 rounded-md border border-transparent bg-transparent px-1 text-xs font-semibold hover:border-input", f.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600")}>
                    <option value="gasto">Gasto</option><option value="ingreso">Ingreso</option>
                  </select>
                </td>
                <td className="px-1 py-1"><Celda valor={f.concepto} onGuardar={v => v.trim() ? onEditar(f.id, { concepto: v }) : toast.error("El concepto no puede quedar vacío")} className="min-w-[12rem]" /></td>
                <td className="px-1 py-1"><Celda tipo="number" valor={String(f.monto_usd)} onGuardar={v => onEditar(f.id, { monto_usd: Number(v) || 0 })} className="w-28 text-right tabular-nums" /></td>
                {esExposure && (
                  <td className="px-1 py-1">
                    <select value={f.area || ""} onChange={e => onEditar(f.id, { area: e.target.value || null })}
                      className="h-8 rounded-md border border-transparent bg-transparent px-1 text-xs hover:border-input">
                      <option value="">Sin área</option>
                      {AREAS_FINANZAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                )}
                <td className="px-1 py-1"><Celda valor={f.categoria || ""} lista={listaCat} onGuardar={v => onEditar(f.id, { categoria: v || null })} className="w-40" /></td>
                <td className="px-1 py-1"><Celda valor={f.medio_pago || ""} lista={listaMedio} onGuardar={v => onEditar(f.id, { medio_pago: v || null })} className="w-40" /></td>
                <td className="px-1 py-1"><Celda valor={f.notas || ""} onGuardar={v => onEditar(f.id, { notas: v || null })} className="min-w-[10rem]" /></td>
                <td className="px-1 py-1">
                  <button onClick={() => onBorrar(f)} title="Borrar" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Agregar a {titulo}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 grid grid-cols-2 gap-2">
              {(["gasto", "ingreso"] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo: t }))}
                  className={cn("rounded-lg border py-2 text-sm font-semibold", form.tipo === t ? (t === "gasto" ? "border-rose-500 bg-rose-500/10 text-rose-600" : "border-emerald-500 bg-emerald-500/10 text-emerald-600") : "border-border text-muted-foreground")}>
                  {t === "gasto" ? "Gasto" : "Ingreso manual"}
                </button>
              ))}
            </div>
            <Campo label="Fecha"><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className={inputCls} /></Campo>
            <Campo label="Monto USD"><input type="number" min={0} step="0.01" value={form.monto_usd || ""} onChange={e => setForm(p => ({ ...p, monto_usd: Number(e.target.value) }))} className={inputCls} placeholder="0" /></Campo>
            <Campo label={esExposure ? "Concepto (persona, software, costo…)" : "Concepto"} full>
              <input autoFocus value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))} className={inputCls} placeholder={esExposure ? "Ej.: Sueldo Lukas, ManyChat Pro, Contador" : "Ej.: Alquiler, Súper, Uber"} />
            </Campo>
            {esExposure && (
              <Campo label="Área">
                <select value={form.area || ""} onChange={e => setForm(p => ({ ...p, area: e.target.value || null }))} className={inputCls}>
                  <option value="">Sin área</option>
                  {AREAS_FINANZAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Campo>
            )}
            <Campo label={esExposure ? "Tipo de costo" : "Categoría"}>
              <input list={listaCat} value={form.categoria || ""} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className={inputCls} placeholder="Elegí o escribí" />
            </Campo>
            <Campo label="Medio de pago">
              <input list={listaMedio} value={form.medio_pago || ""} onChange={e => setForm(p => ({ ...p, medio_pago: e.target.value }))} className={inputCls} placeholder="Elegí o escribí" />
            </Campo>
            <Campo label="Notas" full><input value={form.notas || ""} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={inputCls} /></Campo>
          </div>
          <DialogFooter>
            <button onClick={() => setAbierto(false)} className="h-9 rounded-md border border-border px-4 text-sm">Cancelar</button>
            <button onClick={crear} disabled={guardando} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}Agregar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

const inputCls = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
const Campo = ({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) => (
  <label className={cn("space-y-1 text-xs font-medium text-muted-foreground", full && "sm:col-span-2")}><span>{label}</span>{children}</label>
)

// Celda editable: guarda al salir del campo o con Enter, solo si cambió.
function Celda({ valor, onGuardar, tipo = "text", lista, className }: { valor: string; onGuardar: (v: string) => void; tipo?: "text" | "number" | "date"; lista?: string; className?: string }) {
  const [v, setV] = useState(valor)
  // Si el valor cambia desde afuera (otro guardado), la celda lo toma.
  const [base, setBase] = useState(valor)
  if (base !== valor) { setBase(valor); setV(valor) }
  const guardar = () => { if (v !== valor) onGuardar(v) }
  return (
    <input type={tipo} value={v} list={lista} step={tipo === "number" ? "0.01" : undefined} min={tipo === "number" ? 0 : undefined}
      onChange={e => setV(e.target.value)} onBlur={guardar}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(valor); (e.target as HTMLInputElement).blur() } }}
      className={cn("h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-input focus:border-input focus:bg-background focus:outline-none", className)} />
  )
}

// ─────────────────────────── Página ───────────────────────────

const SQL_MIGRACION = `create table if not exists public.finanzas_registros (
  id uuid primary key default gen_random_uuid(),
  libro text not null check (libro in ('nahuel', 'alex', 'exposure')),
  tipo text not null default 'gasto' check (tipo in ('gasto', 'ingreso')),
  fecha date not null default current_date,
  concepto text not null check (char_length(concepto) between 1 and 300),
  monto_usd numeric(14,2) not null default 0 check (monto_usd >= 0),
  area text check (area is null or area in ('Marketing', 'Ventas', 'Producto', 'Operaciones')),
  categoria text,
  medio_pago text,
  notas text,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finanzas_registros_libro_fecha_idx on public.finanzas_registros(libro, fecha desc);
alter table public.finanzas_registros enable row level security;
revoke all on public.finanzas_registros from anon, authenticated;
notify pgrst, 'reload schema';`

export default function LibrosFinanzasPage() {
  const { data, error, isLoading, mutate } = useSWR<RegistroFinanzas[]>(API, fetcher)
  const [tab, setTab] = useState<LibroFinanzas>("exposure")
  const filas = useMemo(() => data || [], [data])
  const porLibro = (l: LibroFinanzas) => filas.filter(f => f.libro === l)
  const faltaTabla = (error as { info?: Error503 } | undefined)?.info?.codigo === "tabla_faltante"

  const crear = async (n: Nuevo) => {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(n) })
    const j = await r.json().catch(() => null)
    if (!r.ok) { toast.error(j?.error || "No se pudo agregar"); return false }
    await mutate(prev => [j as RegistroFinanzas, ...(prev || [])].sort((a, b) => b.fecha.localeCompare(a.fecha)), { revalidate: false })
    toast.success(n.tipo === "ingreso" ? "Ingreso agregado" : "Gasto agregado")
    return true
  }
  const editar = async (id: string, cambios: Partial<RegistroFinanzas>) => {
    const antes = data
    await mutate(prev => (prev || []).map(f => f.id === id ? { ...f, ...cambios } : f), { revalidate: false })
    const r = await fetch(API, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...cambios }) })
    const j = await r.json().catch(() => null)
    if (!r.ok) { toast.error(j?.error || "No se guardó el cambio"); await mutate(antes, { revalidate: false }); return }
    await mutate(prev => (prev || []).map(f => f.id === id ? j : f).sort((a, b) => b.fecha.localeCompare(a.fecha)), { revalidate: false })
  }
  const borrar = async (reg: RegistroFinanzas) => {
    if (!window.confirm(`¿Borrar "${reg.concepto}" (${usd(Number(reg.monto_usd))})? No se puede deshacer.`)) return
    const r = await fetch(API, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: reg.id }) })
    const j = await r.json().catch(() => null)
    if (!r.ok) return toast.error(r.status === 403 ? "Solo un CEO puede borrar registros" : j?.error || "No se pudo borrar")
    await mutate(prev => (prev || []).filter(f => f.id !== reg.id), { revalidate: false })
    toast.success("Registro borrado")
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gastos y payroll</h1>
        <p className="text-sm text-muted-foreground">Gastos personales de Nahuel y de Alex, y el payroll de EXPOSURE (sueldos, software y demás costos). Todo en USD; los ingresos se cargan a mano.</p>
      </div>

      {faltaTabla && (
        <Alert>
          <AlertTitle>Falta crear la tabla en la base</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Una sola vez: abrí Supabase → SQL Editor, pegá esto y tocá Run. Después recargá esta página.</p>
            <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">{SQL_MIGRACION}</pre>
            <button onClick={() => { void navigator.clipboard.writeText(SQL_MIGRACION); toast.success("SQL copiado") }} className="h-8 rounded-md border border-border px-3 text-xs font-semibold">Copiar SQL</button>
          </AlertDescription>
        </Alert>
      )}
      {error && !faltaTabla && <Alert variant="destructive"><AlertTitle>No se pudieron cargar los datos</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>}

      {data && <>
        <section className="space-y-3">
          <Tabs value={tab} onValueChange={v => setTab(v as LibroFinanzas)}>
            <TabsList>
              {LIBROS_FINANZAS.map(l => <TabsTrigger key={l.id} value={l.id}>Dashboard · {l.corto}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Dashboard key={tab} libro={tab} filas={porLibro(tab)} />
        </section>

        {LIBROS_FINANZAS.map(l => (
          <TablaLibro key={l.id} libro={l.id} titulo={l.titulo} filas={porLibro(l.id)} onCrear={crear} onEditar={editar} onBorrar={borrar} />
        ))}
      </>}
    </div>
  )
}
