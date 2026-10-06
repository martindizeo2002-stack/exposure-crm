"use client"

/* ── Tareas del equipo (Panel del negocio → El equipo) ─────────────────────
   Cada miembro ve y tilda sus tareas; un CEO ve las de todos y puede asignar,
   editar, mover y borrar. Lo que ve cada uno lo decide /api/tareas en el
   servidor: esta pantalla solo dibuja lo que le llega.
   Las tareas diarias y semanales se «reinician» solas: cuentan como hechas si
   se tildaron hoy o esta semana (hora argentina). */

import { useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CrmPageIntro } from "@/components/crm-ui"
import { cn } from "@/lib/utils"
import { AlertTriangle, CalendarClock, ExternalLink, ListChecks, Loader2, Pencil, Plus, Repeat, RotateCw, Trash2, X } from "lucide-react"
import { ETIQUETA_FRECUENCIA, FRECUENCIAS, type Frecuencia, type MiembroTareas, type RespuestaTareas, type Tarea } from "@/lib/tareas"

// Los errores de red del navegador llegan en inglés («Failed to fetch»): se muestran en castellano.
const mensajeDe = (e: unknown, porDefecto: string) =>
  e instanceof TypeError ? "No hay conexión. Probá de nuevo en un rato." : (e as Error)?.message || porDefecto

const fetcher = async (url: string) => {
  try {
    const r = await fetch(url)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || "No se pudieron leer las tareas")
    return j as RespuestaTareas
  } catch (e) {
    throw new Error(mensajeDe(e, "No se pudieron leer las tareas"))
  }
}

const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"
const fechaCorta = (f: string) => { const [, m, d] = f.split("-"); return `${Number(d)}/${Number(m)}` }

type Borrador = { titulo: string; detalle: string; frecuencia: Frecuencia; vence: string; miembro_id: number }
type Llamar = (metodo: "POST" | "PATCH" | "DELETE", cuerpo: Record<string, unknown>) => Promise<boolean>
type Comun = { admin: boolean; miembros: MiembroTareas[]; hoy: string; onTildar: (t: Tarea, hecha: boolean) => void; llamar: Llamar }

export function TareasEquipo() {
  const { data, error, isLoading, mutate } = useSWR<RespuestaTareas>("/api/tareas", fetcher, { revalidateOnFocus: true })
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [abiertos, setAbiertos] = useState<number[]>([])   // miembros sin tareas a los que el CEO les abrió la tarjeta
  const [recien, setRecien] = useState<string[]>([])       // de una vez tildadas en esta visita: quedan a la vista, tachadas
  const enVuelo = useRef(0)
  const ultimo = useRef(0)

  // Cada acción se ve al instante (optimista). Con varias en vuelo, solo la respuesta de la última pisa la
  // pantalla, y si mientras tanto hubo otras, al terminar todas se relee lo que quedó en el servidor.
  async function llamar(metodo: "POST" | "PATCH" | "DELETE", cuerpo: Record<string, unknown>, optimista?: (d: RespuestaTareas) => RespuestaTareas) {
    const n = ++ultimo.current
    enVuelo.current++
    if (optimista && data) mutate(optimista(data), { revalidate: false })
    try {
      const r = await fetch("/api/tareas", { method: metodo, headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "No se pudo guardar")
      if (n === ultimo.current && enVuelo.current === 1) await mutate(j as RespuestaTareas, { revalidate: false })
      return true
    } catch (e) {
      toast.error(mensajeDe(e, "No se pudo guardar"))
      mutate()
      return false
    } finally {
      enVuelo.current--
      if (enVuelo.current === 0 && n !== ultimo.current) mutate()
    }
  }

  async function tildar(t: Tarea, hecha: boolean) {
    if (t.frecuencia === "una_vez") setRecien((r) => hecha ? [...r, t.id] : r.filter((id) => id !== t.id))
    const ok = await llamar("PATCH", { id: t.id, hecha }, (d) => ({
      ...d,
      tareas: d.tareas.map((x) => x.id === t.id ? {
        ...x, hecha,
        historial: x.historial.map((h, i) => i === x.historial.length - 1 ? { ...h, hecha } : h),
      } : x),
    }))
    if (!ok) setRecien((r) => r.filter((id) => id !== t.id))
  }

  const porMiembro = useMemo(() => {
    const m = new Map<number, Tarea[]>()
    for (const t of data?.tareas || []) m.set(t.miembro_id, [...(m.get(t.miembro_id) || []), t])
    return m
  }, [data])

  if (isLoading && !data) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando las tareas…</div>
  if (!data) {
    return (
      <div className="space-y-3 p-8 text-sm">
        <p className="text-destructive">{(error as Error)?.message || "No se pudieron leer las tareas."}</p>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => mutate()}><RotateCw className="h-3.5 w-3.5" /> Reintentar</Button>
      </div>
    )
  }

  const { yo } = data
  const admin = yo.admin
  const totales = resumen(data.tareas)
  // Orden fijo de las tarjetas (no se mueven al tildar): las que se acaban de abrir, la propia y el resto por nombre.
  const nueva = (id: number) => abiertos.includes(id) && !porMiembro.has(id)
  const conTareas = data.miembros
    .filter((m) => porMiembro.has(m.id) || abiertos.includes(m.id))
    .sort((a, b) => Number(nueva(b.id)) - Number(nueva(a.id))
      || Number(b.id === yo.id) - Number(a.id === yo.id)
      || a.nombre.localeCompare(b.nombre, "es"))
  const sinTareas = data.miembros.filter((m) => !porMiembro.has(m.id) && !abiertos.includes(m.id))
  const comun: Comun = { admin, miembros: data.miembros.filter((m) => !m.rol.startsWith("Sin acceso")), hoy: data.hoy, onTildar: tildar, llamar }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <CrmPageIntro
        eyebrow="Panel del negocio · El equipo"
        title={admin ? "Tareas del equipo" : "Tus tareas"}
        description={admin
          ? "Lo que tiene que hacer cada uno. Vos ves las de todos; cada persona ve solo las suyas y las va tildando. Las diarias y semanales se reinician solas."
          : "Lo que te toca hacer. Tildá cada tarea cuando la terminás; las diarias y semanales se reinician solas cada día o cada semana."}
        icon={<ListChecks className="h-5 w-5" />}
        tone="violet"
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span><strong className="text-base tabular-nums">{totales.pendientes}</strong> <span className="text-muted-foreground">{totales.pendientes === 1 ? "pendiente" : "pendientes"}</span></span>
        <span><strong className="text-base tabular-nums">{totales.hechas}</strong> <span className="text-muted-foreground">{totales.hechas === 1 ? "hecha o al día" : "hechas o al día"}</span></span>
        {totales.vencidas > 0 && <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" /><strong className="tabular-nums">{totales.vencidas}</strong> {totales.vencidas === 1 ? "vencida" : "vencidas"}</span>}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
          <Checkbox checked={soloPendientes} onCheckedChange={(v) => setSoloPendientes(v === true)} aria-label="Mostrar solo lo pendiente" />
          Solo lo pendiente
        </label>
      </div>

      {error && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          No se pudo actualizar: {(error as Error).message}.
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => mutate()}><RotateCw className="h-3.5 w-3.5" /> Reintentar</Button>
        </div>
      )}

      {!admin && (
        <TarjetaMiembro miembro={yo} tareas={porMiembro.get(yo.id) || []} soloPendientes={soloPendientes} recien={recien} {...comun} ancha />
      )}

      {admin && (
        <>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {conTareas.map((m) => (
              <TarjetaMiembro key={m.id} miembro={m} tareas={porMiembro.get(m.id) || []} soloPendientes={soloPendientes} recien={recien}
                abiertaAlInicio={nueva(m.id)} {...comun} />
            ))}
          </div>
          {sinTareas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">Sin tareas:</span>
              {sinTareas.map((m) => (
                <Button key={m.id} variant="outline" size="sm" className="h-7 gap-1 rounded-full" onClick={() => { setAbiertos((a) => [...a, m.id]); window.scrollTo({ top: 0, behavior: "smooth" }) }}>
                  <Plus className="h-3.5 w-3.5" /> {m.nombre}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function resumen(tareas: Tarea[]) {
  return {
    pendientes: tareas.filter((t) => !t.hecha).length,
    hechas: tareas.filter((t) => t.hecha).length,
    vencidas: tareas.filter((t) => t.vencida).length,
  }
}

function TarjetaMiembro({ miembro, tareas, soloPendientes, recien, ancha, abiertaAlInicio, ...comun }: Comun & {
  miembro: MiembroTareas
  tareas: Tarea[]
  soloPendientes: boolean
  recien: string[]
  ancha?: boolean
  abiertaAlInicio?: boolean
}) {
  const { admin } = comun
  const visible = (t: Tarea) => !soloPendientes || !t.hecha || recien.includes(t.id)
  const diarias = tareas.filter((t) => t.frecuencia === "diaria" && visible(t))
  const semanales = tareas.filter((t) => t.frecuencia === "semanal" && visible(t))
  const unaVez = tareas.filter((t) => t.frecuencia === "una_vez")
  const pendientesUnaVez = unaVez.filter((t) => !t.hecha || recien.includes(t.id))
  const hechasUnaVez = unaVez.filter((t) => t.hecha && !recien.includes(t.id))
  const alDia = tareas.filter((t) => t.hecha).length
  const nadaVisible = tareas.length > 0 && !diarias.length && !semanales.length && !pendientesUnaVez.length && (soloPendientes || !hechasUnaVez.length)

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", ancha && "max-w-3xl")}>
      <CardHeader className="flex flex-row items-center gap-3 border-b border-border px-4 py-3">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-700 dark:text-violet-300">{iniciales(miembro.nombre)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{miembro.nombre}</div>
          <div className="text-xs text-muted-foreground">{miembro.rol}</div>
        </div>
        {tareas.length > 0 && (
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">{alDia} de {tareas.length}</div>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${(alDia / tareas.length) * 100}%` }} />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-4">
        {tareas.length === 0 && <p className="text-sm text-muted-foreground">{admin ? "Todavía no tiene tareas." : "No tenés tareas asignadas."}</p>}
        {nadaVisible && <p className="text-sm text-muted-foreground">{admin ? "Al día: no le queda nada pendiente." : "Estás al día: no te queda nada pendiente."}</p>}
        <Grupo titulo="Todos los días" icono={<Repeat className="h-3.5 w-3.5" />} tareas={diarias} {...comun} />
        <Grupo titulo="Todas las semanas" icono={<Repeat className="h-3.5 w-3.5" />} tareas={semanales} {...comun} />
        <Grupo titulo="Pendientes" icono={<ListChecks className="h-3.5 w-3.5" />} tareas={pendientesUnaVez} {...comun} />
        {!soloPendientes && hechasUnaVez.length > 0 && (
          <details>
            <summary className="cursor-pointer select-none text-xs font-medium uppercase tracking-wide text-muted-foreground">Hechas ({hechasUnaVez.length})</summary>
            <ul className="mt-2 space-y-1">{hechasUnaVez.map((t) => <Item key={t.id} tarea={t} {...comun} />)}</ul>
          </details>
        )}
        {admin && !miembro.rol.startsWith("Sin acceso") && <NuevaTarea miembroId={miembro.id} llamar={comun.llamar} abiertaAlInicio={abiertaAlInicio} />}
      </CardContent>
    </Card>
  )
}

function Grupo({ titulo, icono, tareas, ...comun }: Comun & { titulo: string; icono: React.ReactNode; tareas: Tarea[] }) {
  if (!tareas.length) return null
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{icono}{titulo}</h3>
      <ul className="space-y-1">{tareas.map((t) => <Item key={t.id} tarea={t} {...comun} />)}</ul>
    </section>
  )
}

function Item({ tarea, admin, miembros, hoy, onTildar, llamar }: Comun & { tarea: Tarea }) {
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const id = `tarea-${tarea.id}`

  if (editando) return <EditarTarea tarea={tarea} miembros={miembros} llamar={llamar} cerrar={() => setEditando(false)} />

  async function borrar() {
    setBorrando(true)
    const ok = await llamar("DELETE", { id: tarea.id })
    setBorrando(false)
    if (!ok) setConfirmando(false)
  }

  return (
    <li className="group/item rounded-lg px-2 py-1.5 hover:bg-muted/50">
      <div className="flex items-start gap-2.5">
        <Checkbox id={id} checked={tarea.hecha} onCheckedChange={(v) => onTildar(tarea, v === true)} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className={cn("block cursor-pointer text-sm leading-snug", tarea.hecha && tarea.frecuencia === "una_vez" && "text-muted-foreground line-through")}>
            {tarea.titulo}
          </label>
          {tarea.detalle && <p className="mt-0.5 whitespace-pre-line text-xs leading-snug text-muted-foreground">{tarea.detalle}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {tarea.frecuencia !== "una_vez" && <Racha tarea={tarea} />}
            {tarea.vence && (
              <span className={cn("inline-flex items-center gap-1", tarea.vencida && "font-medium text-red-600 dark:text-red-400")}>
                <CalendarClock className="h-3 w-3" />{tarea.vencida ? "venció" : tarea.vence === hoy ? "vence hoy" : "vence"} {fechaCorta(tarea.vence)}
              </span>
            )}
            {tarea.origen && (tarea.origen_url
              ? <a href={tarea.origen_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">{tarea.origen}<ExternalLink className="h-3 w-3" /><span className="sr-only">(abre la grabación)</span></a>
              : <span>{tarea.origen}</span>)}
          </div>
        </div>
        {admin && !confirmando && (
          <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity focus-within:opacity-100 group-hover/item:opacity-100">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(true)} aria-label={`Editar «${tarea.titulo}»`}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmando(true)} aria-label={`Borrar «${tarea.titulo}»`}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </div>
      {confirmando && (
        <div className="ml-7 mt-1.5 flex items-center gap-2 text-xs">
          <span>¿Borrar esta tarea?</span>
          <Button size="sm" variant="destructive" className="h-7" disabled={borrando} onClick={borrar}>{borrando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Borrar"}</Button>
          <Button size="sm" variant="ghost" className="h-7" autoFocus disabled={borrando} onClick={() => setConfirmando(false)}>Cancelar</Button>
        </div>
      )}
    </li>
  )
}

// Los últimos 7 días (diaria) o las últimas 4 semanas (semanal): lleno si se tildó, vacío si no y
// punteado si la tarea todavía no existía.
function Racha({ tarea }: { tarea: Tarea }) {
  const cuentan = tarea.historial.filter((h) => h.hecha !== null)
  const hechas = cuentan.filter((h) => h.hecha).length
  const unidad = tarea.frecuencia === "diaria" ? (cuentan.length === 1 ? "día" : "días") : (cuentan.length === 1 ? "semana" : "semanas")
  const texto = `${hechas} de ${cuentan.length} ${unidad}`
  return (
    <span className="inline-flex items-center gap-1.5" title={texto}>
      <span className="inline-flex gap-0.5" aria-hidden>
        {tarea.historial.map((h) => (
          <span key={h.clave} title={`${h.etiqueta}: ${h.hecha === null ? "todavía no existía" : h.hecha ? "hecha" : "sin hacer"}`}
            className={cn("h-2 w-2 rounded-full", h.hecha === null ? "border border-dashed border-muted-foreground/30" : h.hecha ? "bg-violet-500" : "bg-muted-foreground/25")} />
        ))}
      </span>
      <span className="sr-only">{texto}.</span>
      {ETIQUETA_FRECUENCIA[tarea.frecuencia].toLowerCase()}
    </span>
  )
}

function CamposTarea({ b, set, miembros }: { b: Borrador; set: (c: Partial<Borrador>) => void; miembros?: MiembroTareas[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={b.frecuencia} onValueChange={(v) => set({ frecuencia: v as Frecuencia })}>
        <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Cada cuánto"><SelectValue /></SelectTrigger>
        <SelectContent>{FRECUENCIAS.map((f) => <SelectItem key={f} value={f}>{ETIQUETA_FRECUENCIA[f]}</SelectItem>)}</SelectContent>
      </Select>
      {b.frecuencia === "una_vez" && (
        <Input type="date" value={b.vence} onChange={(e) => set({ vence: e.target.value })} className="h-8 w-[150px] text-xs" aria-label="Vence" />
      )}
      {miembros && (
        <Select value={String(b.miembro_id)} onValueChange={(v) => set({ miembro_id: Number(v) })}>
          <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Asignada a"><SelectValue /></SelectTrigger>
          <SelectContent>{miembros.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  )
}

function NuevaTarea({ miembroId, llamar, abiertaAlInicio }: { miembroId: number; llamar: Llamar; abiertaAlInicio?: boolean }) {
  const vacio: Borrador = { titulo: "", detalle: "", frecuencia: "una_vez", vence: "", miembro_id: miembroId }
  const [abierta, setAbierta] = useState(Boolean(abiertaAlInicio))
  const [b, setB] = useState<Borrador>(vacio)
  const [guardando, setGuardando] = useState(false)

  if (!abierta) {
    return (
      <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground" onClick={() => setAbierta(true)}>
        <Plus className="h-3.5 w-3.5" /> Agregar tarea
      </Button>
    )
  }
  async function guardar() {
    if (!b.titulo.trim()) return
    setGuardando(true)
    const ok = await llamar("POST", { ...b, vence: b.vence || null })
    setGuardando(false)
    if (ok) setB(vacio)
  }
  return (
    <form className="space-y-2 rounded-lg border border-dashed border-border p-2.5" onSubmit={(e) => { e.preventDefault(); guardar() }}>
      <Input autoFocus value={b.titulo} onChange={(e) => setB({ ...b, titulo: e.target.value })} placeholder="Qué tiene que hacer" className="h-8 text-sm" aria-label="Tarea nueva" maxLength={300} />
      <Textarea value={b.detalle} onChange={(e) => setB({ ...b, detalle: e.target.value })} placeholder="Detalle (opcional)" className="min-h-[52px] text-xs" aria-label="Detalle" maxLength={2000} />
      <CamposTarea b={b} set={(c) => setB({ ...b, ...c })} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-8" disabled={guardando || !b.titulo.trim()}>{guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Asignar"}</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setAbierta(false); setB(vacio) }}>Cerrar</Button>
      </div>
    </form>
  )
}

function EditarTarea({ tarea, miembros, llamar, cerrar }: { tarea: Tarea; miembros: MiembroTareas[]; llamar: Llamar; cerrar: () => void }) {
  const [b, setB] = useState<Borrador>({ titulo: tarea.titulo, detalle: tarea.detalle || "", frecuencia: tarea.frecuencia, vence: tarea.vence || "", miembro_id: tarea.miembro_id })
  const [guardando, setGuardando] = useState(false)
  async function guardar() {
    if (!b.titulo.trim()) return
    setGuardando(true)
    const ok = await llamar("PATCH", { id: tarea.id, titulo: b.titulo, detalle: b.detalle, frecuencia: b.frecuencia, vence: b.vence || null, miembro_id: b.miembro_id })
    setGuardando(false)
    if (ok) cerrar()
  }
  return (
    <li>
      <form className="space-y-2 rounded-lg border border-border bg-muted/40 p-2.5" onSubmit={(e) => { e.preventDefault(); guardar() }}>
        <Input autoFocus value={b.titulo} onChange={(e) => setB({ ...b, titulo: e.target.value })} className="h-8 text-sm" aria-label="Tarea" maxLength={300} />
        <Textarea value={b.detalle} onChange={(e) => setB({ ...b, detalle: e.target.value })} placeholder="Detalle (opcional)" className="min-h-[52px] text-xs" aria-label="Detalle" maxLength={2000} />
        {b.frecuencia !== tarea.frecuencia && <p className="text-xs text-amber-700 dark:text-amber-300">Al cambiar cada cuánto se hace, la tarea arranca de cero: se borran sus tildes.</p>}
        <CamposTarea b={b} set={(c) => setB({ ...b, ...c })} miembros={miembros} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="h-8" disabled={guardando || !b.titulo.trim()}>{guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" onClick={cerrar}><X className="h-3.5 w-3.5" /> Cancelar</Button>
        </div>
      </form>
    </li>
  )
}
