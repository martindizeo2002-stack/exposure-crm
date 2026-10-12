"use client"

// Revisión del cruce de pagos (12/10/2026). Hasta ese día el resumen no cruzaba ningún pago: la consulta pedía
// una columna que no existe (pagos.agenda_id) y fallaba sin avisar, así que cierres y cash salían solo de la agenda.
// Acá se ve, mes por mes, qué agendas cambian al cruzar los pagos y qué pagos conviene vincular a mano.
// El tilde de "revisado" queda en este navegador.

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Check, Copy, GitCompare, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Ficha = { id: string; nombre: string; fecha: string; closer: string }
type Pago = { id: string; cliente: string; fecha: string; monto: number; tipo: string; operacion?: string; closer?: string; estado: string }
type AgendaCambio = { agenda: Ficha; antes: { resultado: string; cash: number }; ahora: { resultado: string; cash: number }; via: string | null; pagos: Pago[] }
type PagoRevisar = { pago: Pago; estado: "nombre" | "sin_agenda" | "anulado"; agenda: Ficha | null; via: string | null }
type Respuesta = { agendas: AgendaCambio[]; pagos: PagoRevisar[]; total_pagos: number }

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const CLAVE = "exposure-revision-cruces"
const fmt = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "")
const usd = (n: number) => `USD ${Math.round(n || 0).toLocaleString("es-AR")}`
const ESTADO_PAGO: Record<PagoRevisar["estado"], { label: string; txt: string }> = {
  nombre: { label: "Por nombre", txt: "Se encontró solo por nombre y apellido. Confirmá que sea la misma persona y vinculalo desde la ficha del pago." },
  sin_agenda: { label: "Sin llamada en el mes", txt: "No hay una llamada de esta persona en el mes. Si es una venta de una llamada de otro mes, está bien; si no, falta vincularlo." },
  anulado: { label: "Anulado", txt: "El pago está anulado o borrado: no cuenta en el resumen." },
}

export function RevisionCruces() {
  const hoy = new Date()
  const meses = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    return { valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` }
  })
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(meses[0].valor)
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<"agendas" | PagoRevisar["estado"]>("agendas")
  const [revisados, setRevisados] = useState<Record<string, boolean>>({})

  useEffect(() => { try { setRevisados(JSON.parse(localStorage.getItem(CLAVE) || "{}")) } catch { /* sin almacenamiento */ } }, [])
  const marcar = (id: string) => {
    const nuevo = { ...revisados, [id]: !revisados[id] }
    setRevisados(nuevo)
    try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)) } catch { /* sin almacenamiento */ }
  }

  useEffect(() => {
    if (!abierto) return
    let vivo = true
    setCargando(true); setDatos(null); setError(null)
    fetch(`/api/ventas/resumen?periodo=mes&fecha=${mes}-01&closer=todos&auditar_cruce=1`, { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.error || "Error"); return j as Respuesta })
      .then((j) => { if (vivo) setDatos(j) })
      .catch((e) => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [abierto, mes])

  const cuenta = useMemo(() => {
    const c = { agendas: datos?.agendas.length || 0, nombre: 0, sin_agenda: 0, anulado: 0 }
    for (const p of datos?.pagos || []) c[p.estado]++
    return c
  }, [datos])
  const delta = useMemo(() => {
    let cierresAntes = 0, cierresAhora = 0, cashAntes = 0, cashAhora = 0
    for (const a of datos?.agendas || []) {
      if (a.antes.resultado === "CIERRE") { cierresAntes++; cashAntes += a.antes.cash }
      if (a.ahora.resultado === "CIERRE") { cierresAhora++; cashAhora += a.ahora.cash }
    }
    return { cierres: cierresAhora - cierresAntes, cash: cashAhora - cashAntes }
  }, [datos])
  const pagosVista = (datos?.pagos || []).filter((p) => p.estado === vista)

  const copiar = async () => {
    if (!datos) return
    const filas = ["Tipo\tLead o cliente\tFecha\tAntes\tAhora\tPagos / detalle"]
    for (const a of datos.agendas) filas.push(["Agenda", a.agenda.nombre, a.agenda.fecha, `${a.antes.resultado} ${usd(a.antes.cash)}`, `${a.ahora.resultado} ${usd(a.ahora.cash)}`, a.pagos.map((p) => `${p.fecha} ${p.tipo} ${usd(p.monto)} (${p.cliente})`).join(" | ")].join("\t"))
    for (const p of datos.pagos) filas.push([`Pago ${ESTADO_PAGO[p.estado].label}`, p.pago.cliente, p.pago.fecha, "", p.agenda ? `${p.agenda.nombre} ${p.agenda.fecha}` : "sin agenda", `${p.pago.tipo} ${usd(p.pago.monto)}`].join("\t"))
    try { await navigator.clipboard.writeText(filas.join("\n")); toast.success("Lista copiada: pegala en una planilla") } catch { toast.error("No se pudo copiar") }
  }

  const Tilde = ({ id }: { id: string }) => (
    <button type="button" onClick={() => marcar(id)} aria-pressed={!!revisados[id]} aria-label={revisados[id] ? "Marcar como no revisado" : "Marcar como revisado"}
      className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", revisados[id] ? "border-emerald-400 bg-emerald-400 text-zinc-950" : "border-white/20")}>
      {revisados[id] && <Check className="h-3.5 w-3.5" />}
    </button>
  )
  const Chip = ({ k, label, n }: { k: typeof vista; label: string; n: number }) => (
    <button type="button" onClick={() => setVista(k)} aria-pressed={vista === k}
      className={cn("rounded-full border px-2.5 py-1 text-[11px]", vista === k ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300")}>
      {label} ({n})
    </button>
  )

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}
        className="h-8 border-amber-500/30 text-xs text-amber-300 hover:bg-amber-500/10" title="Qué cambia en el resumen al cruzar los pagos">
        <GitCompare className="mr-1.5 h-3.5 w-3.5" />Revisar cruces de pagos
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden border-white/10 bg-zinc-950 text-zinc-200">
          <DialogHeader>
            <DialogTitle>Revisión del cruce de pagos</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Hasta el 12/10 el resumen no cruzaba pagos: cierres y cash salían solo de lo marcado en la agenda.
              Ahora cada pago va a la llamada de esa persona en el mes. Revisá las agendas que cambian y los pagos dudosos, y tildá cada uno.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes"
              className="h-8 rounded-md border border-white/10 bg-zinc-900 px-2 text-xs text-white">
              {meses.map((m) => <option key={m.valor} value={m.valor}>{m.label}</option>)}
            </select>
            <Chip k="agendas" label="Agendas que cambian" n={cuenta.agendas} />
            <Chip k="nombre" label="Pagos por nombre" n={cuenta.nombre} />
            <Chip k="sin_agenda" label="Pagos sin llamada en el mes" n={cuenta.sin_agenda} />
            <Chip k="anulado" label="Anulados" n={cuenta.anulado} />
            <Button type="button" variant="outline" size="sm" onClick={copiar} disabled={!datos} className="ml-auto h-8 border-white/10 text-xs">
              <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar todo
            </Button>
          </div>
          {datos && (
            <p className="text-[11px] text-zinc-500">
              {datos.total_pagos} pagos en el mes. Con el cruce, los cierres cambian en {delta.cierres >= 0 ? "+" : ""}{delta.cierres} y el cash día 1 en {delta.cash >= 0 ? "+" : "−"}{usd(Math.abs(delta.cash))}.
            </p>
          )}

          <div className="max-h-[56vh] space-y-1.5 overflow-y-auto pr-1 text-xs">
            {cargando && <div className="flex items-center gap-2 py-8 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Cruzando los pagos del mes…</div>}
            {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-red-300">No se pudo leer el cruce: {error}</div>}

            {datos && vista === "agendas" && (datos.agendas.length === 0
              ? <div className="py-8 text-center text-sm text-zinc-500">Ninguna agenda cambia en este mes.</div>
              : datos.agendas.map((a) => (
                <div key={a.agenda.id} className={cn("flex gap-2 rounded border p-2.5", revisados[`a:${a.agenda.id}`] ? "border-emerald-500/20 opacity-60" : "border-white/10 bg-zinc-900/50")}>
                  <Tilde id={`a:${a.agenda.id}`} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-white">{a.agenda.nombre}</strong>
                      <span className="text-zinc-400">{fmt(a.agenda.fecha)} · {a.agenda.closer}</span>
                      {a.via && <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", a.via === "nombre" ? "bg-amber-500/10 text-amber-300" : "bg-white/5 text-zinc-400")}>pago por {a.via}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded border border-white/10 px-1.5 py-0.5 text-zinc-300">Antes: {a.antes.resultado}{a.antes.cash ? ` · ${usd(a.antes.cash)}` : ""}</span>
                      <ArrowRight className="h-3 w-3 text-zinc-500" />
                      <span className="rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 text-emerald-200">Ahora: {a.ahora.resultado}{a.ahora.cash ? ` · ${usd(a.ahora.cash)}` : ""}</span>
                    </div>
                    {a.pagos.length > 0 && <div className="text-zinc-400">Pagos: {a.pagos.map((p) => `${fmt(p.fecha)} ${p.tipo} ${usd(p.monto)}${p.cliente && p.cliente !== a.agenda.nombre ? ` (cargado como "${p.cliente}")` : ""}`).join(" · ")}</div>}
                  </div>
                </div>
              )))}

            {datos && vista !== "agendas" && (
              <>
                <p className="text-zinc-500">{ESTADO_PAGO[vista].txt}</p>
                {pagosVista.length === 0 && <div className="py-6 text-center text-sm text-zinc-500">No hay pagos en esta lista.</div>}
                {pagosVista.map((p) => (
                  <div key={p.pago.id} className={cn("flex gap-2 rounded border p-2.5", revisados[`p:${p.pago.id}`] ? "border-emerald-500/20 opacity-60" : "border-white/10 bg-zinc-900/50")}>
                    <Tilde id={`p:${p.pago.id}`} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-white">{p.pago.cliente || "Sin cliente"}</strong>
                        <span className="text-zinc-400">{fmt(p.pago.fecha)} · {p.pago.tipo} · {usd(p.pago.monto)}{p.pago.closer ? ` · ${p.pago.closer}` : ""}</span>
                      </div>
                      <div className="text-zinc-400">{p.agenda ? <>Va a la llamada de <span className="text-zinc-200">{p.agenda.nombre}</span> del {fmt(p.agenda.fecha)} ({p.agenda.closer})</> : "Sin llamada en el mes"}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
