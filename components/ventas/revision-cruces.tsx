"use client"

// Revisión de los pagos que cambiaron de agenda con la regla de cruce del 12/10/2026.
// Lee /api/ventas/resumen?auditar_cruce=1 mes por mes. El tilde de "revisado" queda en este navegador.

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Check, Copy, GitCompare, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Ficha = { id: string; nombre: string; fecha: string; closer: string; via?: string }
type Cambio = {
  pago: { id: string; cliente: string; fecha: string; monto: number; tipo: string; operacion?: string; closer?: string; estado: string }
  antes: Ficha[]
  ahora: Ficha | null
  motivo: string
}
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const CLAVE = "exposure-revision-cruces"
const fmt = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "")

function tipoCambio(c: Cambio) {
  if (c.pago.estado !== "active") return "Anulado"
  if (c.antes.length > 1) return "Duplicado"
  if (c.antes.length === 1 && !c.ahora) return "Ya no se asigna"
  if (!c.antes.length && c.ahora) return "Ahora se encuentra"
  return "Cambió de agenda"
}
const TIPOS = ["Anulado", "Duplicado", "Ya no se asigna", "Cambió de agenda", "Ahora se encuentra"]

export function RevisionCruces() {
  const hoy = new Date()
  const meses = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    return { valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` }
  })
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(meses[0].valor)
  const [cambios, setCambios] = useState<Cambio[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState("")
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
    setCargando(true); setCambios(null)
    fetch(`/api/ventas/resumen?periodo=mes&fecha=${mes}-01&closer=todos&auditar_cruce=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!vivo) return; if (!j.ok) throw new Error(j.error || "Error"); setCambios(j.cambios || []) })
      .catch((e) => { if (vivo) { toast.error(`No se pudo leer el cruce: ${e.message}`); setCambios([]) } })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [abierto, mes])

  const conteo = useMemo(() => {
    const c: Record<string, { n: number; usd: number }> = {}
    for (const x of cambios || []) { const t = tipoCambio(x); c[t] ||= { n: 0, usd: 0 }; c[t].n++; c[t].usd += x.pago.monto }
    return c
  }, [cambios])
  const lista = (cambios || []).filter((c) => !filtro || tipoCambio(c) === filtro)
  const pendientes = (cambios || []).filter((c) => !revisados[c.pago.id]).length

  const copiar = async () => {
    const filas = [["Fecha", "Cliente del pago", "Concepto", "USD", "Estado", "Antes", "Ahora", "Cómo", "Motivo"].join("\t")]
    for (const c of lista) filas.push([c.pago.fecha, c.pago.cliente, c.pago.tipo, c.pago.monto, c.pago.estado,
      c.antes.map((a) => `${a.nombre} (${fmt(a.fecha)})`).join(" | ") || "ninguna", c.ahora ? `${c.ahora.nombre} (${fmt(c.ahora.fecha)})` : "ninguna", c.ahora?.via || "", c.motivo].join("\t"))
    try { await navigator.clipboard.writeText(filas.join("\n")); toast.success("Lista copiada: pegala en una planilla") } catch { toast.error("No se pudo copiar") }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}
        className="h-8 border-amber-500/30 text-xs text-amber-300 hover:bg-amber-500/10" title="Pagos que cambiaron de agenda con la corrección del cruce">
        <GitCompare className="mr-1.5 h-3.5 w-3.5" />Revisar cruces de pagos
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden border-white/10 bg-zinc-950 text-zinc-200">
          <DialogHeader>
            <DialogTitle>Pagos que cambiaron con el cruce nuevo</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Antes un pago se asignaba a toda agenda cuyo primer nombre apareciera en el cliente, y contaban los anulados.
              Ahora va a una sola agenda: por agenda, persona, teléfono o nombre y apellido. Tildá cada uno cuando lo revises.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes"
              className="h-8 rounded-md border border-white/10 bg-zinc-900 px-2 text-xs text-white">
              {meses.map((m) => <option key={m.valor} value={m.valor}>{m.label}</option>)}
            </select>
            <button type="button" onClick={() => setFiltro("")} aria-pressed={!filtro}
              className={cn("rounded-full border px-2.5 py-1 text-[11px]", !filtro ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300")}>
              Todos {cambios ? `(${cambios.length})` : ""}
            </button>
            {TIPOS.filter((t) => conteo[t]).map((t) => (
              <button key={t} type="button" onClick={() => setFiltro(t)} aria-pressed={filtro === t}
                className={cn("rounded-full border px-2.5 py-1 text-[11px]", filtro === t ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300")}>
                {t} ({conteo[t].n} · USD {Math.round(conteo[t].usd).toLocaleString("es-AR")})
              </button>
            ))}
            <span className="ml-auto text-[11px] text-zinc-500">{cambios ? `${pendientes} sin revisar` : ""}</span>
            <Button type="button" variant="outline" size="sm" onClick={copiar} disabled={!lista.length} className="h-8 border-white/10 text-xs">
              <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar lista
            </Button>
          </div>

          <div className="max-h-[56vh] space-y-1.5 overflow-y-auto pr-1">
            {cargando && <div className="flex items-center gap-2 py-8 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Comparando los pagos del mes…</div>}
            {!cargando && cambios && lista.length === 0 && <div className="py-8 text-center text-sm text-zinc-500">No hay pagos que hayan cambiado en este mes.</div>}
            {lista.map((c) => {
              const ok = revisados[c.pago.id]
              return (
                <div key={c.pago.id} className={cn("grid gap-2 rounded border p-2.5 text-xs sm:grid-cols-[auto_1fr]", ok ? "border-emerald-500/20 opacity-60" : "border-white/10 bg-zinc-900/50")}>
                  <button type="button" onClick={() => marcar(c.pago.id)} aria-pressed={!!ok} aria-label={ok ? "Marcar como no revisado" : "Marcar como revisado"}
                    className={cn("flex h-5 w-5 items-center justify-center rounded border", ok ? "border-emerald-400 bg-emerald-400 text-zinc-950" : "border-white/20")}>
                    {ok && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-white">{c.pago.cliente || "Sin cliente"}</strong>
                      <span className="text-zinc-400">{fmt(c.pago.fecha)} · {c.pago.tipo} · USD {Math.round(c.pago.monto).toLocaleString("es-AR")}{c.pago.closer ? ` · ${c.pago.closer}` : ""}</span>
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">{tipoCambio(c)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-zinc-500">Antes:</span>
                      {c.antes.length ? c.antes.map((a) => <span key={a.id} className="rounded border border-red-500/20 bg-red-500/5 px-1.5 py-0.5 text-red-200">{a.nombre} {fmt(a.fecha)}</span>) : <span className="text-zinc-500">ninguna</span>}
                      <ArrowRight className="h-3 w-3 text-zinc-500" />
                      <span className="text-zinc-500">Ahora:</span>
                      {c.ahora ? <span className="rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 text-emerald-200">{c.ahora.nombre} {fmt(c.ahora.fecha)} · por {c.ahora.via}</span> : <span className="text-zinc-500">ninguna</span>}
                    </div>
                    <div className="text-zinc-400">{c.motivo}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
