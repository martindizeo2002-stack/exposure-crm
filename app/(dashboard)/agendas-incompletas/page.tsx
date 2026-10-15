"use client"

// Las agendas que el Home cuenta en "CRM por completar", con la causa y lo que se puede completar solo
// (otra agenda de la misma persona, Fathom, pagos, iClosed). Nada se pisa: solo se llenan campos vacíos.

import { useMemo, useState } from "react"
import useSWR from "swr"
import { CheckCircle2, CircleAlert, ClipboardCheck, Loader2, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CrmPageIntro, CrmStat } from "@/components/crm-ui"
import { toast } from "sonner"

type Propuesta = Record<string, { valor: unknown; fuente: string }>
type Item = {
  id: string; nombre: string; closer: string | null; setter: string | null; fecha_agenda: string; fecha_closer: string
  etapa: string | null; falta_closer: string[]; falta_setter: string[]; quedan: string[]; causas: string[]
  propuesta: Propuesta; archivar_hacia: { id: string; nombre: string; fecha: string } | null
  otras_agendas: Array<{ id: string; fecha_closer: string; closer: string | null; show: boolean | null; cerro: boolean | null; estado: string | null }>
}
type Resp = { mes: string; total_agendas: number; incompletas: number; llamadas: number; setting: number; se_completan: number; items: Item[] }
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j })
const CAMPO: Record<string, string> = {
  show: "Se presentó", motivo_no_cierre: "Motivo de no cierre", link_fathom: "Link de Fathom", operacion: "Operación", plan_de_pago: "Plan de pago",
  medio_de_pago: "Medio de pago", comprobante: "Comprobante", cc_dia_1: "CC día 1", fecha_tc: "Fecha TC", ocupacion: "A qué se dedica",
  ingresos: "Ingresos", inversion: "Capital para invertir", intentos_previos: "Intentos previos", motivo_urgencia: "Urgencia",
}
const fmt = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}${s.length > 10 ? ` ${s.slice(11, 16)}` : ""}` : "sin fecha")
const valor = (v: unknown) => (v === true ? "Sí" : v === false ? "No" : String(v).length > 70 ? `${String(v).slice(0, 70)}…` : String(v))

export default function AgendasIncompletasPage() {
  const hoy = new Date()
  const meses = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [mes, setMes] = useState(meses[0])
  const { data, error, isLoading, mutate } = useSWR<Resp>(`/api/agendas-incompletas?mes=${mes}`, fetcher)
  const [elegidas, setElegidas] = useState<Record<string, boolean>>({})
  const [aplicando, setAplicando] = useState(false)

  const conArreglo = useMemo(() => (data?.items || []).filter((i) => Object.keys(i.propuesta).length || i.archivar_hacia), [data])
  // los duplicados a archivar no vienen tildados: se revisan uno por uno
  const seleccion = conArreglo.filter((i) => elegidas[i.id] ?? !i.archivar_hacia)

  async function aplicar(items: Item[]) {
    if (!items.length) return
    setAplicando(true)
    try {
      const cambios = items.filter((i) => !i.archivar_hacia && Object.keys(i.propuesta).length).map((i) => ({
        id: i.id,
        campos: Object.fromEntries(Object.entries(i.propuesta).map(([k, p]) => [k, p.valor])),
        fuentes: Object.fromEntries(Object.entries(i.propuesta).map(([k, p]) => [k, p.fuente])),
      }))
      const archivar = items.filter((i) => i.archivar_hacia).map((i) => ({ id: i.id, hacia: i.archivar_hacia!.id, motivo: `Duplicado de la agenda del ${i.archivar_hacia!.fecha} (misma persona, misma llamada)` }))
      const r = await fetch("/api/agendas-incompletas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cambios, archivar }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "No se pudo aplicar")
      toast.success(`Listo: ${j.actualizadas} agendas completadas y ${j.archivadas} duplicados archivados${j.errores?.length ? ` · ${j.errores.length} con error` : ""}`)
      if (j.errores?.length) console.warn(j.errores)
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setAplicando(false)
    }
  }

  return <div className="crm-module-page">
    <CrmPageIntro eyebrow="Home · CRM por completar" title="Agendas incompletas" description="Las llamadas que el Home marca como incompletas, por qué, y lo que se puede completar desde otra agenda de la misma persona, Fathom, los pagos o iClosed. Solo se llenan campos vacíos: nada de lo cargado a mano se pisa." icon={<ClipboardCheck className="h-6 w-6" />} tone="violet" />

    <div className="flex flex-wrap items-center gap-2">
      {meses.map((m) => <Button key={m} size="sm" variant={mes === m ? "default" : "outline"} onClick={() => { setMes(m); setElegidas({}) }}>{m}</Button>)}
      <Button size="sm" className="ml-auto" disabled={aplicando || !seleccion.length} onClick={() => aplicar(seleccion)}>
        {aplicando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />}Completar {seleccion.length} seleccionadas
      </Button>
    </div>

    {data && <div className="crm-kpis">
      <CrmStat label="Incompletas" value={data.incompletas} detail={`de ${data.total_agendas} agendas del mes`} icon={<CircleAlert className="h-5 w-5" />} tone="violet" />
      <CrmStat label="Llamadas" value={data.llamadas} detail="les falta resultado del closer" icon={<CircleAlert className="h-5 w-5" />} tone="neutral" />
      <CrmStat label="Setting" value={data.setting} detail="falta calificación o resumen" icon={<CircleAlert className="h-5 w-5" />} tone="neutral" />
      <CrmStat label="Se pueden completar" value={conArreglo.length} detail="con datos que ya existen" icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
    </div>}

    {error && <div className="rounded-xl border border-red-500/30 p-4 text-red-500">No se pudo leer: {error.message}</div>}
    {isLoading && <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Revisando agendas, Fathom, pagos e iClosed…</div>}

    {data && <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {data.items.map((i) => {
        const arreglable = Object.keys(i.propuesta).length > 0 || !!i.archivar_hacia
        const marcada = elegidas[i.id] ?? !i.archivar_hacia
        return <div key={i.id} className="grid gap-3 border-b border-border p-4 last:border-0 lg:grid-cols-[auto_1fr_1.2fr] lg:items-start">
          <input type="checkbox" aria-label={`Seleccionar ${i.nombre}`} className="mt-1 h-4 w-4" disabled={!arreglable} checked={arreglable && marcada} onChange={(e) => setElegidas((x) => ({ ...x, [i.id]: e.target.checked }))} />
          <div className="min-w-0 space-y-1.5">
            <p className="font-bold">{i.nombre}</p>
            <p className="text-xs text-muted-foreground">Llamada {fmt(i.fecha_closer)} · agenda {fmt(i.fecha_agenda)} · closer {i.closer || "—"} · setter {i.setter || "—"}{i.etapa ? ` · ${i.etapa}` : ""}</p>
            <div className="flex flex-wrap gap-1.5">
              {i.falta_closer.map((f) => <Badge key={`c-${f}`} variant="outline" className="border-red-500/30 text-red-600">falta {f}</Badge>)}
              {i.falta_setter.map((f) => <Badge key={`s-${f}`} variant="outline" className="border-amber-500/30 text-amber-600">setter: {f}</Badge>)}
            </div>
            {i.causas.map((c, k) => <p key={k} className="text-xs text-muted-foreground">• {c}</p>)}
            {i.otras_agendas.length > 0 && <p className="text-xs text-muted-foreground">Otras agendas de esta persona: {i.otras_agendas.map((o) => `${fmt(o.fecha_closer)} (${o.closer || "—"}${o.cerro ? ", cerró" : o.show ? ", se presentó" : o.show === false ? ", no show" : ""})`).join(" · ")}</p>}
          </div>
          <div className="min-w-0 space-y-1.5 text-sm">
            {i.archivar_hacia && <p className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-2 text-xs">Es un duplicado de la agenda del <b>{i.archivar_hacia.fecha || "sin fecha"}</b>, que tiene el resultado. Se pasa lo que falte y esta copia se archiva: el lead queda una sola vez.</p>}
            {Object.entries(i.propuesta).map(([k, p]) => <div key={k} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs">
              <b>{CAMPO[k] || k}:</b> {valor(p.valor)} <span className="text-muted-foreground">· {p.fuente}</span>
            </div>)}
            {!arreglable && <p className="text-xs text-muted-foreground">No hay datos en otro lado para completarla: la tiene que completar {i.falta_closer.length ? i.closer || "el closer" : i.setter || "el setter"} desde Centro de agendas.</p>}
            {arreglable && i.quedan.length > 0 && !i.archivar_hacia && <p className="text-xs text-amber-600">Después de completar sigue faltando: {i.quedan.join(", ")}.</p>}
            {arreglable && <Button size="sm" variant="outline" disabled={aplicando} onClick={() => aplicar([i])}>Completar solo esta</Button>}
          </div>
        </div>
      })}
      {!data.items.length && <div className="p-10 text-center text-emerald-600"><CheckCircle2 className="mx-auto mb-2 h-8 w-8" />No hay agendas incompletas en {data.mes}.</div>}
    </div>}
  </div>
}
