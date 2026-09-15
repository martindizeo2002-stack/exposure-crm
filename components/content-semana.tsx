"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { colorAngulo } from "@/lib/colores-angulo"
import { useAngulos } from "@/lib/use-angulos"
import { Plus } from "lucide-react"

// Las dos vistas de la semana de Contenido:
//  · TableroSemana: una columna por día, y adentro un bloquecito por pieza. Se ve la semana entera
//    de un vistazo, que era el problema del diseño anterior (un bloque gigante por día).
//  · CalendarioSemana: grilla tipo Google Calendar, con las horas en vertical y los días en
//    horizontal, para ver el orden real de publicación del día.
// Las dos usan los tokens del tema (bg-card, border-border, text-foreground…) para que se lean
// igual en modo claro y en modo oscuro.

export type PiezaSemana = {
  id: string
  title: string
  angle: string | null
  format: string | null
  planned_at: string | null
  status: string
  platform: string | null
  assigned_to: string | null
}

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

// `planned_at` se guarda con la hora tal cual en UTC (12:00 guardado = 12:00 mostrado), y el resto
// del CRM lee la fecha cortando el ISO. Se usa el mismo criterio acá para que nada cambie de día.
const diaDe = (p: PiezaSemana) => String(p.planned_at || "").slice(0, 10)
const horaDe = (p: PiezaSemana) => {
  const m = String(p.planned_at || "").match(/T(\d{2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  // Medianoche exacta es "sin hora": así se guardan las piezas cargadas con el campo de solo fecha.
  return h === 0 && m[2] === "00" ? null : { h, m: Number(m[2]), texto: `${m[1]}:${m[2]}` }
}
function fechaLegible(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  return { dia: DIAS_CORTOS[d.getUTCDay()], numero: d.getUTCDate(), mes: MESES_CORTOS[d.getUTCMonth()] }
}
const HOY = () => new Date().toISOString().slice(0, 10)

const ESTADOS: Record<string, string> = {
  idea: "Idea", guion_listo: "Guion", para_grabar: "Grabar", grabado: "Grabado",
  en_produccion: "En producción", en_revision: "En revisión",
  edicion: "Edición", completo: "Completo", publicado: "Publicado", historical: "Histórico",
}
const LISTO = new Set(["completo", "publicado"])

// Los días de la semana que arranca en `start` (lunes a domingo), aunque no tengan piezas.
function diasDeLaSemana(start: string) {
  const base = new Date(`${start}T12:00:00Z`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function agrupar(rows: PiezaSemana[]) {
  const porDia = new Map<string, PiezaSemana[]>()
  for (const row of rows) {
    const k = diaDe(row) || "sin-fecha"
    if (!porDia.has(k)) porDia.set(k, [])
    porDia.get(k)!.push(row)
  }
  for (const lista of porDia.values()) {
    lista.sort((a, b) => (horaDe(a)?.h ?? 99) - (horaDe(b)?.h ?? 99) || a.title.localeCompare(b.title, "es"))
  }
  return porDia
}

// ───────────────────────────── el bloquecito de una pieza ─────────────────────────────

function Pieza({ row, categoria, onOpen, compacta = false }: { row: PiezaSemana; categoria: string | null; onOpen: () => void; compacta?: boolean }) {
  const color = colorAngulo(categoria)
  const hora = horaDe(row)
  const listo = LISTO.has(row.status)
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${row.title}${row.angle ? ` · ${row.angle}` : ""}`}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border bg-card p-2 pl-3 text-left transition",
        "hover:border-foreground/25 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        listo ? "border-border/60" : "border-border",
      )}
    >
      {/* barra lateral del color de la categoría del ángulo */}
      <span className={cn("absolute inset-y-0 left-0 w-1.5", color.punto)} aria-hidden />
      <div className="flex items-baseline gap-1.5">
        {hora && <span className="shrink-0 font-mono text-[11px] font-bold text-muted-foreground">{hora.texto}</span>}
        <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight", listo && "text-muted-foreground line-through decoration-1")}>
          {row.title}
        </span>
      </div>
      {!compacta && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {row.format && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{row.format}</span>}
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", listo ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
            {ESTADOS[row.status] || row.status}
          </span>
        </div>
      )}
    </button>
  )
}

// ───────────────────────────── vista 1: tablero por día ─────────────────────────────

export function TableroSemana({ start, rows, onOpen, onNueva }: {
  start: string
  rows: PiezaSemana[]
  onOpen: (row: PiezaSemana) => void
  onNueva?: (fecha: string) => void
}) {
  const { categoriaDe } = useAngulos()
  const dias = useMemo(() => diasDeLaSemana(start), [start])
  const porDia = useMemo(() => agrupar(rows), [rows])
  const sinFecha = porDia.get("sin-fecha") || []
  const hoy = HOY()

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {dias.map((dia) => {
          const piezas = porDia.get(dia) || []
          const esHoy = dia === hoy
          const f = fechaLegible(dia)
          return (
            <section
              key={dia}
              className={cn(
                "flex min-h-[132px] flex-col rounded-xl border bg-muted/30 p-2",
                esHoy ? "border-primary/50 bg-primary/[.06]" : "border-border",
              )}
            >
              <header className="mb-2 flex items-baseline justify-between px-1">
                <div className="flex items-baseline gap-1.5">
                  <span className={cn("text-[11px] font-black uppercase tracking-wider", esHoy ? "text-primary" : "text-muted-foreground")}>{f.dia}</span>
                  <span className={cn("text-sm font-black tabular-nums", esHoy && "text-primary")}>{f.numero}</span>
                  <span className="text-[10px] text-muted-foreground">{f.mes}</span>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{piezas.length || ""}</span>
              </header>
              <div className="flex flex-1 flex-col gap-1.5">
                {piezas.map((row) => (
                  <Pieza key={row.id} row={row} categoria={categoriaDe(row.angle)} onOpen={() => onOpen(row)} />
                ))}
                {!piezas.length && <p className="px-1 py-3 text-center text-[11px] text-muted-foreground/70">Sin piezas</p>}
              </div>
              {onNueva && (
                <button
                  type="button"
                  onClick={() => onNueva(dia)}
                  className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />Agregar
                </button>
              )}
            </section>
          )
        })}
      </div>
      {sinFecha.length > 0 && (
        <section className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Sin fecha ({sinFecha.length})</p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {sinFecha.map((row) => <Pieza key={row.id} row={row} categoria={categoriaDe(row.angle)} onOpen={() => onOpen(row)} />)}
          </div>
        </section>
      )}
    </div>
  )
}

// ───────────────────────────── vista 2: calendario por hora ─────────────────────────────

export function CalendarioSemana({ start, rows, onOpen }: {
  start: string
  rows: PiezaSemana[]
  onOpen: (row: PiezaSemana) => void
}) {
  const { categoriaDe } = useAngulos()
  const dias = useMemo(() => diasDeLaSemana(start), [start])
  const porDia = useMemo(() => agrupar(rows), [rows])
  const hoy = HOY()

  // La franja de horas se ajusta a lo que hay, con un mínimo de 9 a 21 para que no quede raquítica.
  const horas = useMemo(() => {
    const conHora = rows.map(horaDe).filter((h): h is { h: number; m: number; texto: string } => !!h).map((h) => h.h)
    const desde = Math.max(0, Math.min(9, ...conHora))
    const hasta = Math.min(23, Math.max(21, ...conHora))
    return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
  }, [rows])

  const sinHora = useMemo(() => {
    const m = new Map<string, PiezaSemana[]>()
    for (const [dia, lista] of porDia) {
      const libres = lista.filter((row) => !horaDe(row))
      if (libres.length) m.set(dia, libres)
    }
    return m
  }, [porDia])
  const haySinHora = sinHora.size > 0

  const celda = (dia: string, hora: number) => (porDia.get(dia) || []).filter((row) => horaDe(row)?.h === hora)

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="min-w-[860px]">
        {/* encabezado con los días */}
        <div className="sticky top-0 z-10 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border bg-card">
          <div />
          {dias.map((dia) => {
            const f = fechaLegible(dia)
            const esHoy = dia === hoy
            return (
              <div key={dia} className={cn("border-l border-border px-2 py-2 text-center", esHoy && "bg-primary/[.07]")}>
                <p className={cn("text-[10px] font-black uppercase tracking-wider", esHoy ? "text-primary" : "text-muted-foreground")}>{f.dia}</p>
                <p className={cn("text-base font-black tabular-nums leading-tight", esHoy && "text-primary")}>{f.numero}</p>
              </div>
            )
          })}
        </div>

        {haySinHora && (
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border bg-muted/30">
            <div className="px-2 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">Sin hora</div>
            {dias.map((dia) => (
              <div key={dia} className="space-y-1 border-l border-border p-1.5">
                {(sinHora.get(dia) || []).map((row) => (
                  <Pieza key={row.id} row={row} categoria={categoriaDe(row.angle)} onOpen={() => onOpen(row)} compacta />
                ))}
              </div>
            ))}
          </div>
        )}

        {horas.map((hora) => (
          <div key={hora} className="grid min-h-[58px] grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border/60 last:border-b-0">
            <div className="px-2 pt-1.5 text-right font-mono text-[11px] text-muted-foreground">{String(hora).padStart(2, "0")}:00</div>
            {dias.map((dia) => {
              const piezas = celda(dia, hora)
              const esHoy = dia === hoy
              return (
                <div key={dia} className={cn("space-y-1 border-l border-border p-1.5", esHoy && "bg-primary/[.04]")}>
                  {piezas.map((row) => (
                    <Pieza key={row.id} row={row} categoria={categoriaDe(row.angle)} onOpen={() => onOpen(row)} compacta />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}


// ───────────────────────────── vista 3: pipeline de producción ─────────────────────────────

// Las columnas del recorrido. "En producción" es el editor trabajando; "En revisión" es lo que el
// editor ya entregó con el link del video final y está esperando el ok.
const COLUMNAS: Array<{ id: string; label: string; estados: string[]; acento: string }> = [
  { id: "idea", label: "Idea", estados: ["idea"], acento: "bg-zinc-400" },
  { id: "guion", label: "Guion listo", estados: ["guion_listo"], acento: "bg-blue-500" },
  { id: "grabar", label: "Para grabar", estados: ["para_grabar"], acento: "bg-amber-500" },
  { id: "grabado", label: "Grabado", estados: ["grabado"], acento: "bg-violet-500" },
  { id: "produccion", label: "En producción", estados: ["en_produccion", "edicion"], acento: "bg-sky-500" },
  { id: "revision", label: "En revisión", estados: ["en_revision"], acento: "bg-fuchsia-500" },
  { id: "listo", label: "Listo", estados: ["completo", "publicado"], acento: "bg-emerald-500" },
]

export function PipelineContenido({ rows, onOpen, editor }: {
  rows: PiezaSemana[]
  onOpen: (row: PiezaSemana) => void
  editor?: string | null
}) {
  const { categoriaDe } = useAngulos()
  // Si quien mira es un editor, sus piezas van primero: es lo que tiene que hacer hoy.
  const orden = (a: PiezaSemana, b: PiezaSemana) => {
    const mia = (p: PiezaSemana) => (editor && p.assigned_to === editor ? 0 : 1)
    return mia(a) - mia(b) || String(a.planned_at || "").localeCompare(String(b.planned_at || ""))
  }
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {COLUMNAS.map((col) => {
        const piezas = rows.filter((r) => col.estados.includes(r.status)).sort(orden)
        return (
          <section key={col.id} className="flex min-h-[140px] flex-col rounded-xl border border-border bg-muted/30 p-2">
            <header className="mb-2 flex items-center gap-1.5 px-1">
              <span className={cn("h-2 w-2 rounded-full", col.acento)} />
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{col.label}</span>
              <span className="ml-auto text-[11px] font-bold text-muted-foreground">{piezas.length || ""}</span>
            </header>
            <div className="flex flex-1 flex-col gap-1.5">
              {piezas.map((row) => {
                const mia = editor && row.assigned_to === editor
                return (
                  <div key={row.id} className={cn("rounded-lg", mia && "ring-1 ring-primary/50")}>
                    <Pieza row={row} categoria={categoriaDe(row.angle)} onOpen={() => onOpen(row)} compacta />
                    {row.assigned_to && row.assigned_to !== "SIN ASIGNAR" && (
                      <p className={cn("px-2 pb-1 pt-0.5 text-[10px] font-semibold", mia ? "text-primary" : "text-muted-foreground")}>
                        {mia ? "Tuya · " : ""}{row.assigned_to}
                      </p>
                    )}
                  </div>
                )
              })}
              {!piezas.length && <p className="px-1 py-3 text-center text-[11px] text-muted-foreground/70">Vacío</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
