"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { BookOpen, Box, ChevronLeft, ChevronRight, EyeOff, Eye, Loader2, Pause, Play, RefreshCw, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { COLOR_ANGULO, COLOR_ESTADO, ZONAS, horaArt, type CiudadVista, type Seleccion, type Zona } from "./tipos"
import { DetalleZona, Diccionario, PanelZona, Definiciones } from "./panel"

const Escena = dynamic(() => import("./escena"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>,
})

type Modo = "ciudad" | "tabla" | "diccionario"
const sumarDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)

function leer(clave: string, def: boolean) { try { const v = localStorage.getItem(clave); return v === null ? def : v === "1" } catch { return def } }
function guardar(clave: string, v: boolean) { try { localStorage.setItem(clave, v ? "1" : "0") } catch { /* sin almacenamiento */ } }

function hayWebGL() {
  try { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2") || c.getContext("webgl")) } catch { return false }
}

export function VistaCiudad({ datos, dia, onDia, cargando, onRecargar }: { datos: CiudadVista; dia: string; onDia: (d: string) => void; cargando?: boolean; onRecargar?: () => void }) {
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [modo, setModo] = useState<Modo>("ciudad")
  const [animar, setAnimar] = useState(true)
  const [nombres, setNombres] = useState(true)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setAnimar(leer("ciudad.animar", !reducido) && !reducido)
    setNombres(leer("ciudad.nombres", true))
    const ok = hayWebGL()
    setWebgl(ok)
    if (!ok) setModo("tabla")
  }, [])

  const cambiarAnimar = () => { setAnimar((v) => { guardar("ciudad.animar", !v); return !v }) }
  const cambiarNombres = () => { setNombres((v) => { guardar("ciudad.nombres", !v); return !v }) }
  const esHoy = dia === datos.hoy

  return (
    <div className="space-y-3">
      {/* barra: modo de datos, día, controles */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Datos reales · corte {horaArt(datos.corte)}
        </span>
        <span className="text-xs text-muted-foreground">Sin datos de demo ni repeticiones: todo lo que se ve es del CRM.</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border">
            <button type="button" className="p-1.5 hover:bg-muted" onClick={() => onDia(sumarDias(dia, -1))} aria-label="Día anterior"><ChevronLeft className="h-4 w-4" /></button>
            <label className="sr-only" htmlFor="ciudad-dia">Día de las agendas</label>
            <input id="ciudad-dia" type="date" value={dia} onChange={(e) => e.target.value && onDia(e.target.value)} className="bg-transparent px-1 text-xs tabular-nums outline-none" />
            <button type="button" className="p-1.5 hover:bg-muted" onClick={() => onDia(sumarDias(dia, 1))} aria-label="Día siguiente"><ChevronRight className="h-4 w-4" /></button>
          </div>
          {!esHoy ? <button type="button" onClick={() => onDia(datos.hoy)} className="rounded-lg border px-2 py-1 text-xs hover:bg-muted">Hoy</button> : null}
          <button type="button" onClick={cambiarNombres} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted" aria-pressed={!nombres}>
            {nombres ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{nombres ? "Ocultar nombres" : "Mostrar nombres"}
          </button>
          <button type="button" onClick={cambiarAnimar} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted" aria-pressed={animar}>
            {animar ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{animar ? "Pausar" : "Animar"}
          </button>
          {onRecargar ? <button type="button" onClick={onRecargar} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted" disabled={cargando}><RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} />Actualizar</button> : null}
          <div className="inline-flex rounded-lg border p-0.5">
            {([["ciudad", Box, "Ciudad"], ["tabla", Table2, "Tabla"], ["diccionario", BookOpen, "Diccionario"]] as const).map(([m, Icono, label]) => (
              <button key={m} type="button" onClick={() => setModo(m)} disabled={m === "ciudad" && !webgl} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs", modo === m ? "bg-violet-600 text-white" : "hover:bg-muted", m === "ciudad" && !webgl && "opacity-40")}>
                <Icono className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {!webgl ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">Este navegador no tiene WebGL: la ciudad se muestra como tabla, con los mismos datos.</p> : null}

      {modo === "ciudad" ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="relative h-[62vh] min-h-[460px] overflow-hidden rounded-2xl border border-violet-200/70 bg-[linear-gradient(160deg,#F6F2FF_0%,#ECE5FF_55%,#E3EAFF_100%)] lg:h-[calc(100dvh-220px)] dark:border-violet-400/20">
            <Escena datos={datos} seleccion={seleccion} onSeleccion={setSeleccion} animar={animar} nombres={nombres} />
            {cargando ? <div className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 shadow"><Loader2 className="h-4 w-4 animate-spin text-violet-600" /></div> : null}
            <details className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] rounded-xl border border-violet-200/80 bg-white/90 px-3 py-2 text-[11px] text-[#2A2140] shadow-sm backdrop-blur">
              <summary className="cursor-pointer select-none font-semibold">Leyenda</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="mb-1 font-medium text-[#6E6590]">Islas · ángulo de la pieza</div>
                  {Object.entries(COLOR_ANGULO).map(([a, c]) => <div key={a} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{a}</div>)}
                  <div className="mt-1 text-[#6E6590]">Cada paquete de la cinta marca caudal, no una persona.</div>
                </div>
                <div>
                  <div className="mb-1 font-medium text-[#6E6590]">Sillas · estado de la call</div>
                  {Object.entries(datos.estados).map(([k, e]) => <div key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: COLOR_ESTADO[k as keyof typeof COLOR_ESTADO] }} />{e.label}</div>)}
                </div>
              </div>
              <div className="mt-2 text-[#6E6590]">Cada figura es un registro real. Arrastrá para moverte, rueda o pellizco para acercar.</div>
            </details>
          </div>
          <aside className="max-h-[calc(100dvh-220px)] min-h-[300px] overflow-y-auto rounded-2xl border bg-card p-4">
            <PanelZona datos={datos} seleccion={seleccion} nombres={nombres} onSeleccion={setSeleccion} />
          </aside>
        </div>
      ) : null}

      {modo === "tabla" ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(ZONAS) as Zona[]).map((z) => (
            <section key={z} className="max-h-[560px] space-y-3 overflow-y-auto rounded-2xl border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ZONAS[z].color }} />{ZONAS[z].titulo}</h3>
              <Definiciones datos={datos} zona={z} />
              <DetalleZona datos={datos} zona={z} nombres={nombres} onSeleccion={() => {}} />
            </section>
          ))}
        </div>
      ) : null}

      {modo === "diccionario" ? <Diccionario datos={datos} /> : null}
    </div>
  )
}
