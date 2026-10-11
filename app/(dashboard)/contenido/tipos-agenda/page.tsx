"use client"

import { Fragment, useMemo, useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ARQUETIPOS, GRUPOS, grupoDe, piezaDe, fechaDePieza, diaAR, sumarDias, type FilaTipoAgenda, type GrupoId, type PiezaPropia } from "@/lib/tipos-agenda"

type Datos = { desde: string; dias: number; filas: FilaTipoAgenda[]; piezas: PiezaPropia[]; fmAds: FmAds | null }
type Resumen = { agendas: number; foco: number; calificadas: number; presentadas: number; cierres: number; cash: number; grupos: Record<GrupoId, number> }

const fetcher = (url: string) => fetch(url).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "No se pudo cargar"); return b })
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—")
const money = (n: number) => `USD ${Math.round(n).toLocaleString("es-AR")}`
const ddmm = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().slice(0, 2).join("/") : "—")
const COLOR = Object.fromEntries(GRUPOS.map((g) => [g.id, g.color])) as Record<GrupoId, string>
const NOMBRE_GRUPO = Object.fromEntries(GRUPOS.map((g) => [g.id, g.nombre])) as Record<GrupoId, string>
const FORMATO: Record<string, string> = { reel: "Reel", historia: "Historia", carrusel: "Carrusel", ads: "Anuncio", outbound: "Outbound", webinar: "Webinar", otro: "Otro", no_identificado: "—" }

function vacio(): Resumen {
  return { agendas: 0, foco: 0, calificadas: 0, presentadas: 0, cierres: 0, cash: 0, grupos: Object.fromEntries(GRUPOS.map((g) => [g.id, 0])) as Record<GrupoId, number> }
}
function sumar(r: Resumen, f: FilaTipoAgenda) {
  r.agendas++
  if (f.foco) r.foco++
  if (f.calificada) r.calificadas++
  if (f.show) r.presentadas++
  if (f.cerro || f.cash > 0) r.cierres++
  r.cash += f.cash
  r.grupos[grupoDe(f.arquetipo)]++
}
function lunes(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600000) // hora argentina
  const dia = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dia)
  return d.toISOString().slice(0, 10)
}

/** Barra apilada fina por grupo, con 2 px de separación entre segmentos. */
function Mezcla({ r, alto = 10 }: { r: Resumen; alto?: number }) {
  if (!r.agendas) return null
  return <div className="flex w-full min-w-[120px] gap-[2px]" style={{ height: alto }}>
    {GRUPOS.filter((g) => r.grupos[g.id]).map((g) => <div key={g.id} title={`${g.nombre}: ${r.grupos[g.id]} (${pct(r.grupos[g.id], r.agendas)})`}
      className="h-full first:rounded-l last:rounded-r" style={{ width: `${(r.grupos[g.id] / r.agendas) * 100}%`, background: g.color }} />)}
  </div>
}

function Leyenda() {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {GRUPOS.map((g) => <span key={g.id} className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />{g.nombre}{g.foco ? " · foco" : ""}
    </span>)}
  </div>
}

function Semanas({ filas }: { filas: FilaTipoAgenda[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const semanas = useMemo(() => {
    const m = new Map<string, { r: Resumen; piezas: Set<string> }>()
    for (const f of filas) {
      const k = lunes(f.publicado_at)
      if (!m.has(k)) m.set(k, { r: vacio(), piezas: new Set() })
      sumar(m.get(k)!.r, f)
    }
    // piezas publicadas esa semana (según la fecha de la etiqueta), para leer el antes y el después
    for (const f of filas) {
      const fp = fechaDePieza(f.gatillo_etiqueta)
      if (!fp) continue
      const k = lunes(`${fp}T15:00:00Z`)
      m.get(k)?.piezas.add(piezaDe(f))
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filas])
  const max = Math.max(1, ...semanas.map(([, s]) => s.r.agendas))
  const activa = semanas.find(([k]) => k === hover)
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Agendas por semana, según el tipo de lead</CardTitle>
      <p className="text-xs text-muted-foreground">Cada barra es una semana (lunes a domingo, por el día en que el setter publicó el resumen). Pasá el mouse para ver el detalle y las piezas que se publicaron esa semana.</p>
    </CardHeader>
    <CardContent className="space-y-3 pt-2">
      <Leyenda />
      <div className="relative flex h-56 items-end gap-2 border-b border-white/10 pb-0">
        {semanas.map(([k, s]) => <button key={k} type="button" onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(k)}
          className="group flex h-full flex-1 flex-col justify-end" aria-label={`Semana del ${ddmm(k)}: ${s.r.agendas} agendas`}>
          <div className="mb-1 text-center text-[11px] font-bold text-white/70">{s.r.agendas}</div>
          <div className={cn("flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity", hover && hover !== k && "opacity-50")} style={{ height: `${(s.r.agendas / max) * 85}%` }}>
            {GRUPOS.filter((g) => s.r.grupos[g.id]).map((g) => <div key={g.id} style={{ flexGrow: s.r.grupos[g.id], background: g.color }} />)}
          </div>
        </button>)}
      </div>
      <div className="flex gap-2">{semanas.map(([k, s]) => <div key={k} className="flex-1 text-center">
        <div className="text-[10px] text-muted-foreground">{ddmm(k)}</div>
        <div className="text-[11px] font-bold text-white/80" title="Porcentaje de agendas de arquetipos foco">{pct(s.r.foco, s.r.agendas)}</div>
      </div>)}</div>
      <p className="text-[11px] text-muted-foreground">Debajo de cada fecha: el porcentaje de agendas de arquetipos foco (9 a 5, universitario, sabe IA, dueño de negocio).</p>
      {activa && <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs">
        <div className="mb-1 font-bold">Semana del {ddmm(activa[0])} · {activa[1].r.agendas} agendas · {activa[1].r.calificadas} calificadas · {activa[1].r.presentadas} presentadas · {activa[1].r.cierres} cierres</div>
        <div className="flex flex-wrap gap-x-3">{GRUPOS.filter((g) => activa[1].r.grupos[g.id]).map((g) => <span key={g.id}><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: g.color }} />{g.nombre} {activa[1].r.grupos[g.id]}</span>)}</div>
        {activa[1].piezas.size > 0 && <div className="mt-2 text-muted-foreground">Piezas publicadas esa semana que después trajeron agendas: {[...activa[1].piezas].join(" · ")}</div>}
      </div>}
    </CardContent>
  </Card>
}

function TablaPiezas({ filas, elegida, elegir }: { filas: FilaTipoAgenda[]; elegida: string | null; elegir: (p: string | null) => void }) {
  const piezas = useMemo(() => {
    const m = new Map<string, { r: Resumen; formato: string; fecha: string | null }>()
    for (const f of filas) {
      const p = piezaDe(f)
      if (!m.has(p)) m.set(p, { r: vacio(), formato: FORMATO[f.gatillo_formato || ""] || "—", fecha: fechaDePieza(f.gatillo_etiqueta) })
      sumar(m.get(p)!.r, f)
    }
    return [...m.entries()].sort(([, a], [, b]) => b.r.agendas - a.r.agendas || b.r.calificadas - a.r.calificadas)
  }, [filas])
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Qué tipo de lead trae cada pieza</CardTitle>
      <p className="text-xs text-muted-foreground">La pieza es el «contenido gatillo de agenda» que anota el setter en el resumen (la etiqueta de ManyChat). Tocá una fila para ver sus agendas abajo.</p>
    </CardHeader>
    <CardContent className="pt-2"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow className="hover:bg-transparent">
        <TableHead>Pieza</TableHead><TableHead>Formato</TableHead><TableHead>Publicada</TableHead>
        <TableHead className="text-right">Agendas</TableHead><TableHead className="min-w-[160px]">Tipo de lead</TableHead>
        <TableHead className="text-right">Foco</TableHead><TableHead className="text-right">Calificadas</TableHead>
        <TableHead className="text-right">Presentadas</TableHead><TableHead className="text-right">Cierres</TableHead><TableHead className="text-right">Cash</TableHead>
      </TableRow></TableHeader>
      <TableBody>{piezas.map(([p, s]) => <TableRow key={p} onClick={() => elegir(elegida === p ? null : p)} className={cn("cursor-pointer", elegida === p && "bg-white/[.06]")}>
        <TableCell className="max-w-[340px] whitespace-normal font-bold">{p}</TableCell>
        <TableCell className="text-muted-foreground">{s.formato}</TableCell>
        <TableCell className="text-muted-foreground">{ddmm(s.fecha)}</TableCell>
        <TableCell className="text-right font-semibold">{s.r.agendas}</TableCell>
        <TableCell><Mezcla r={s.r} /></TableCell>
        <TableCell className="text-right">{pct(s.r.foco, s.r.agendas)}</TableCell>
        <TableCell className="text-right">{s.r.calificadas}</TableCell>
        <TableCell className="text-right">{s.r.presentadas}</TableCell>
        <TableCell className="text-right font-semibold">{s.r.cierres}</TableCell>
        <TableCell className="text-right">{s.r.cash ? money(s.r.cash) : "—"}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div></CardContent>
  </Card>
}

function TablaArquetipos({ filas }: { filas: FilaTipoAgenda[] }) {
  const filasA = useMemo(() => {
    const m = new Map<string, Resumen>()
    for (const f of filas) {
      const k = f.arquetipo || "otro"
      if (!m.has(k)) m.set(k, vacio())
      sumar(m.get(k)!, f)
    }
    return [...m.entries()].sort(([a, x], [b, y]) => GRUPOS.findIndex((g) => g.id === grupoDe(a)) - GRUPOS.findIndex((g) => g.id === grupoDe(b)) || y.agendas - x.agendas)
  }, [filas])
  const total = filas.length
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2"><CardTitle className="text-base">Por tipo de lead</CardTitle>
      <p className="text-xs text-muted-foreground">Presentada = la agenda figura como presentada en el CRM. Cierre = cerró o tiene pagos desde el inicio del período. La tasa de cierre es sobre presentadas.</p></CardHeader>
    <CardContent className="pt-2"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow className="hover:bg-transparent">
        <TableHead>Tipo</TableHead><TableHead className="text-right">Agendas</TableHead><TableHead className="text-right">% del total</TableHead>
        <TableHead className="text-right">Calificadas</TableHead><TableHead className="text-right">Presentadas</TableHead>
        <TableHead className="text-right">Cierres</TableHead><TableHead className="text-right">Cierre</TableHead><TableHead className="text-right">Cash</TableHead>
      </TableRow></TableHeader>
      <TableBody>{filasA.map(([k, r]) => <TableRow key={k}>
        <TableCell className="font-bold"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[grupoDe(k)] }} />{ARQUETIPOS[k]?.nombre || k}<span className="ml-2 text-[11px] font-normal text-muted-foreground">{NOMBRE_GRUPO[grupoDe(k)]}</span></TableCell>
        <TableCell className="text-right font-semibold">{r.agendas}</TableCell><TableCell className="text-right text-muted-foreground">{pct(r.agendas, total)}</TableCell>
        <TableCell className="text-right">{r.calificadas}</TableCell><TableCell className="text-right">{r.presentadas}</TableCell>
        <TableCell className="text-right font-semibold">{r.cierres}</TableCell><TableCell className="text-right">{pct(r.cierres, r.presentadas)}</TableCell>
        <TableCell className="text-right">{r.cash ? money(r.cash) : "—"}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div></CardContent>
  </Card>
}

function Leads({ filas, pieza }: { filas: FilaTipoAgenda[]; pieza: string | null }) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const lista = pieza ? filas.filter((f) => piezaDe(f) === pieza) : filas.slice(0, 60)
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2"><CardTitle className="text-base">{pieza ? `Agendas de «${pieza}»` : "Últimas agendas con resumen"}</CardTitle>
      <p className="text-xs text-muted-foreground">El tipo sale de la situación que describe el resumen del setter; la frase entre comillas es la evidencia. Tocá una fila para leer la síntesis para el closer.</p></CardHeader>
    <CardContent className="pt-2"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow className="hover:bg-transparent">
        <TableHead>Resumen</TableHead><TableHead>Lead</TableHead><TableHead>Tipo</TableHead><TableHead>Evidencia</TableHead>
        <TableHead>Ingreso declarado</TableHead><TableHead>Llamada</TableHead><TableHead>Resultado</TableHead>
      </TableRow></TableHeader>
      <TableBody>{lista.map((f) => <Fragment key={f.id}>
        <TableRow onClick={() => setAbierta(abierta === f.id ? null : f.id)} className="cursor-pointer align-top">
          <TableCell className="text-muted-foreground">{ddmm(f.publicado_at)}</TableCell>
          <TableCell className="font-bold">{f.nombre || f.nombre_perfil}{f.instagram ? <div className="text-[11px] font-normal text-muted-foreground">{f.instagram}</div> : null}{!f.agenda_id && <div className="text-[11px] font-normal text-amber-300">sin agenda cruzada</div>}</TableCell>
          <TableCell className="whitespace-nowrap"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: COLOR[grupoDe(f.arquetipo)] }} />{ARQUETIPOS[f.arquetipo || "otro"]?.nombre}{f.profesion ? <div className="text-[11px] text-muted-foreground">{f.profesion}</div> : null}</TableCell>
          <TableCell className="max-w-[360px] whitespace-normal text-xs text-muted-foreground">«{f.arquetipo_evidencia}»</TableCell>
          <TableCell className="text-xs">{f.ingreso_declarado || "—"}{f.calificada ? <div className="text-[11px] font-bold text-emerald-300">calificada</div> : null}</TableCell>
          <TableCell className="text-muted-foreground">{ddmm(f.fecha_llamada)}{f.closer ? <div className="text-[11px]">{f.closer}</div> : null}</TableCell>
          <TableCell className="text-xs">{f.cerro || f.cash > 0 ? <span className="font-bold text-emerald-300">Cerró{f.cash ? ` · ${money(f.cash)}` : ""}</span> : f.show ? "Presentada" : f.show === false ? "No se presentó" : "Sin resultado"}</TableCell>
        </TableRow>
        {abierta === f.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={7} className="whitespace-pre-wrap bg-black/30 text-xs text-white/80">
          {f.anuncio_confianza && <><b>Anuncio probable:</b> {f.anuncio_nombre || "ninguno (no resuena con los creativos que corrían)"}{f.anuncio_nombre ? ` · confianza ${f.anuncio_confianza}` : ""}{f.anuncio_evidencia ? ` · ${f.anuncio_evidencia}` : ""}{"\n"}</>}
          <b>Pieza:</b> {piezaDe(f)} · <b>Setter:</b> {f.setter}{f.minutos_aviso_resumen != null ? ` · resumen a los ${f.minutos_aviso_resumen} min del aviso` : ""}{f.seguimientos_n != null ? ` · ${f.seguimientos_n} seguimientos para agendar` : ""}{"\n\n"}{f.sintesis || "Sin síntesis en el resumen."}
        </TableCell></TableRow>}
      </Fragment>)}</TableBody>
    </Table></div></CardContent>
  </Card>
}

const CAT_COLOR: Record<string, string> = {
  "PROBLEMA": "bg-red-500/15 text-red-300", "SOLUCIÓN": "bg-emerald-500/15 text-emerald-300", "PRODUCTO": "bg-sky-500/15 text-sky-300",
  "MENTALIDAD": "bg-amber-500/15 text-amber-200", "VOLUMEN/TOFU": "bg-violet-500/15 text-violet-300",
}
function Cat({ c }: { c: string | null }) {
  if (!c) return <span className="text-white/30">—</span>
  return <span className={cn("inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase", CAT_COLOR[c] || "bg-white/10 text-white/70")}>{c}</span>
}
const nombreAngulo = (p: PiezaPropia) => p.angulo || (p.analizada ? "Sin ángulo del banco" : "Sin analizar todavía")

function agendasPorDia(filas: FilaTipoAgenda[]) {
  const m = new Map<string, FilaTipoAgenda[]>()
  for (const f of filas) {
    if (!m.has(f.dia_reserva)) m.set(f.dia_reserva, [])
    m.get(f.dia_reserva)!.push(f)
  }
  return m
}

/** Cada agenda se cruza con lo publicado el mismo día y el día anterior a la reserva. */
function PorAngulo({ filas, piezas, desde }: { filas: FilaTipoAgenda[]; piezas: PiezaPropia[]; desde: string }) {
  const { lista, promedio } = useMemo(() => {
    const porDia = agendasPorDia(filas)
    const inicio = diaAR(desde)
    const hoy = diaAR(new Date().toISOString())
    const diasPeriodo = Math.max(1, Math.round((new Date(`${hoy}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 864e5) + 1)
    const m = new Map<string, { cat: string | null; piezas: PiezaPropia[]; dias: Set<string>; agendas: Map<string, FilaTipoAgenda> }>()
    for (const p of piezas) {
      if (p.dia < sumarDias(inicio, -1)) continue
      const k = nombreAngulo(p)
      if (!m.has(k)) m.set(k, { cat: p.categoria, piezas: [], dias: new Set(), agendas: new Map() })
      const e = m.get(k)!
      e.piezas.push(p)
      for (const d of [p.dia, sumarDias(p.dia, 1)]) {
        if (d < inicio || d > hoy) continue
        e.dias.add(d)
        for (const f of porDia.get(d) || []) e.agendas.set(f.id, f)
      }
    }
    const lista = [...m.entries()].map(([angulo, e]) => {
      const r = vacio()
      e.agendas.forEach((f) => sumar(r, f))
      return { angulo, cat: e.cat, piezas: e.piezas.length, dias: e.dias.size, r, porDia: e.dias.size ? r.agendas / e.dias.size : 0 }
    }).filter((a) => a.r.agendas > 0).sort((a, b) => b.porDia - a.porDia)
    return { lista, promedio: filas.length / diasPeriodo }
  }, [filas, piezas, desde])
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Ángulo publicado → agendas de ese día y el siguiente</CardTitle>
      <p className="text-xs text-muted-foreground">Cada agenda se cruza con tus reels y carruseles publicados el mismo día de la reserva y el día anterior. El ángulo de cada pieza lo asigna el Radar al leer el texto, lo hablado y los slides (piezas de la API de Instagram). Promedio general del período: {promedio.toLocaleString("es-AR", { maximumFractionDigits: 1 })} agendas con resumen por día. Si el mismo día salieron dos ángulos, esas agendas suman en los dos.</p>
    </CardHeader>
    <CardContent className="pt-2"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow className="hover:bg-transparent">
        <TableHead>Ángulo</TableHead><TableHead>Etapa</TableHead><TableHead className="text-right">Piezas</TableHead>
        <TableHead className="text-right">Días cubiertos</TableHead><TableHead className="text-right">Agendas</TableHead>
        <TableHead className="text-right">Agendas por día</TableHead><TableHead className="text-right">vs. promedio</TableHead>
        <TableHead className="min-w-[160px]">Tipo de lead</TableHead><TableHead className="text-right">Foco</TableHead>
        <TableHead className="text-right">Calificadas</TableHead><TableHead className="text-right">Presentadas</TableHead><TableHead className="text-right">Cierres</TableHead>
      </TableRow></TableHeader>
      <TableBody>{lista.map((a) => <TableRow key={a.angulo}>
        <TableCell className="max-w-[260px] whitespace-normal font-bold">{a.angulo}</TableCell>
        <TableCell><Cat c={a.cat} /></TableCell>
        <TableCell className="text-right">{a.piezas}</TableCell>
        <TableCell className="text-right text-muted-foreground">{a.dias}</TableCell>
        <TableCell className="text-right font-semibold">{a.r.agendas}</TableCell>
        <TableCell className="text-right font-bold">{a.porDia.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</TableCell>
        <TableCell className={cn("text-right text-xs", a.porDia >= promedio ? "text-emerald-300" : "text-white/50")}>{promedio ? `${a.porDia >= promedio ? "+" : ""}${Math.round((a.porDia / promedio - 1) * 100)}%` : "—"}</TableCell>
        <TableCell><Mezcla r={a.r} /></TableCell>
        <TableCell className="text-right">{pct(a.r.foco, a.r.agendas)}</TableCell>
        <TableCell className="text-right">{a.r.calificadas}</TableCell>
        <TableCell className="text-right">{a.r.presentadas}</TableCell>
        <TableCell className="text-right font-semibold">{a.r.cierres}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div></CardContent>
  </Card>
}

function PorDia({ filas, piezas, desde }: { filas: FilaTipoAgenda[]; piezas: PiezaPropia[]; desde: string }) {
  const [todos, setTodos] = useState(false)
  const dias = useMemo(() => {
    const porDia = agendasPorDia(filas)
    const piezasDia = new Map<string, PiezaPropia[]>()
    for (const p of piezas) {
      if (!piezasDia.has(p.dia)) piezasDia.set(p.dia, [])
      piezasDia.get(p.dia)!.push(p)
    }
    const inicio = diaAR(desde)
    const salida: Array<{ dia: string; hoy: PiezaPropia[]; ayer: PiezaPropia[]; agendas: FilaTipoAgenda[]; r: Resumen }> = []
    for (let d = diaAR(new Date().toISOString()); d >= inicio; d = sumarDias(d, -1)) {
      const agendas = porDia.get(d) || []
      const r = vacio()
      agendas.forEach((f) => sumar(r, f))
      salida.push({ dia: d, hoy: piezasDia.get(d) || [], ayer: piezasDia.get(sumarDias(d, -1)) || [], agendas, r })
    }
    return salida
  }, [filas, piezas, desde])
  const visibles = todos ? dias : dias.slice(0, 21)
  const chip = (p: PiezaPropia, tenue = false) => <a key={`${p.id}-${tenue ? "a" : "h"}`} href={p.url || undefined} target="_blank" rel="noreferrer" title={`${p.titulo}${p.angulo_texto ? ` — ${p.angulo_texto}` : ""}`}
    className={cn("inline-flex max-w-[280px] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] hover:bg-white/5", tenue ? "border-white/5 text-white/45" : "border-white/15 text-white/85")}>
    <span className="shrink-0 text-[10px] uppercase text-white/40">{tenue ? "ayer · " : ""}{p.tipo === "carrusel" ? "Carru" : p.tipo === "reel" ? "Reel" : p.tipo}</span>
    <span className="truncate">{nombreAngulo(p)}</span>{p.categoria && !tenue && <Cat c={p.categoria} />}
  </a>
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Día por día: lo que publicaste y quién agendó</CardTitle>
      <p className="text-xs text-muted-foreground">Por cada día de reserva: las piezas de ese día, las del día anterior (más tenues) y las agendas con su tipo de lead. Tocá una pieza para abrirla en Instagram; pasá el mouse para leer el ángulo completo.</p>
    </CardHeader>
    <CardContent className="space-y-1 pt-2">
      {visibles.map((d) => <div key={d.dia} className="grid gap-2 border-b border-white/5 py-2 md:grid-cols-[70px_1fr_260px]">
        <div className="text-sm font-bold">{ddmm(d.dia)}</div>
        <div className="flex flex-wrap gap-1">
          {d.hoy.map((p) => chip(p))}
          {d.ayer.map((p) => chip(p, true))}
          {!d.hoy.length && !d.ayer.length && <span className="text-xs text-white/30">Sin reels ni carruseles ese día ni el anterior</span>}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs"><span className="font-bold">{d.r.agendas} agendas</span>{d.r.calificadas > 0 && <span className="text-emerald-300">{d.r.calificadas} calificadas</span>}</div>
          <Mezcla r={d.r} />
          {d.agendas.length > 0 && <div className="truncate text-[11px] text-muted-foreground" title={d.agendas.map((f) => `${f.nombre || f.nombre_perfil} (${ARQUETIPOS[f.arquetipo || "otro"]?.nombre})`).join("\n")}>
            {d.agendas.slice(0, 4).map((f) => (f.nombre || f.nombre_perfil || "").split(" ")[0]).join(", ")}{d.agendas.length > 4 ? "…" : ""}
          </div>}
        </div>
      </div>)}
      {dias.length > 21 && <button type="button" onClick={() => setTodos(!todos)} className="mt-2 rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-white/70 hover:bg-white/5">{todos ? "Ver menos" : `Ver los ${dias.length} días`}</button>}
    </CardContent>
  </Card>
}

type Estimado = { agendas: number; en_europa: number; foco: number; calificadas: number; presentadas: number; cierres: number; cash: number; costo_por_agenda: number | null; tipos: Record<string, number> }
type AnuncioFM = {
  id: string; anuncio: string; texto: string | null; paises: string[]; edad: Array<number | null>; desde: string; hasta: string; gasto: number
  frecuencia: number | null; alcance: number | null; costo_por_seguidor_cuenta: number | null
  etiqueta: string | null; atribucion: "propia" | "compartida" | "sin etiqueta"
  agendas?: number; contactos_con_etiqueta?: number; en_europa?: number; calificadas?: number; presentadas?: number; cierres?: number
  estimado_por_fecha?: Estimado
  resonancia?: Estimado & { alta: number }
}
type PersonaEuropa = { nombre: string; instagram: string | null; reserva: string; pais: string | null; arquetipo: string | null; profesion: string | null; evidencia: string | null; anuncio_europa: boolean; show: boolean | null; cerro: boolean }
type FmAds = {
  generado: string; anuncios: AnuncioFM[]; fm_sin_fecha_de_seguimiento: number; agendas_en_europa: PersonaEuropa[]
  resonancia_cobertura?: { follow_me_ads: number; evaluadas: number; ninguno: number; baja: number }
}

function resumenDeTipos(tipos: Record<string, number>): Resumen {
  const r = vacio()
  for (const [k, v] of Object.entries(tipos)) {
    r.grupos[grupoDe(k === "sin resumen" ? null : k)] += v
    r.agendas += v
  }
  return r
}
const uno = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 1 }))
const ETIQUETA_TXT: Record<string, string> = { propia: "etiqueta propia", compartida: "etiqueta del reel", "sin etiqueta": "sin etiqueta" }

function FollowMeAds({ datos }: { datos: FmAds }) {
  const lista = [...datos.anuncios].sort((a, b) => b.hasta.localeCompare(a.hasta) || b.gasto - a.gasto)
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Follow Me Ads: qué anuncio trajo qué tipo de lead</CardTitle>
      <p className="text-xs text-muted-foreground">«Follow Me Ads» en el resumen solo dice que el lead entró como seguidor nuevo: puede ser pauta u orgánico y nunca se sabe con certeza. Se estima por <b>resonancia</b>: Claude compara lo que contó el lead (situación, dolor, objetivo, cómo habla) con los creativos que corrían las tres semanas previas a su agenda y elige uno o ninguno, con la frase que los conecta (cuentan los de confianza alta o media; el detalle está en cada lead, abajo). «Comentaron y agendaron» son agendas de quienes tienen la etiqueta de ManyChat del anuncio. Frecuencia y costo por seguidor de la cuenta en las fechas del anuncio van primero (el costo es mezclado: Meta no informa seguidores por anuncio). «Por fecha» es la referencia anterior: reparte por el gasto del día en que la persona empezó a seguirte.{datos.resonancia_cobertura ? ` Resonancia evaluada en ${datos.resonancia_cobertura.evaluadas} de ${datos.resonancia_cobertura.follow_me_ads} agendas de Follow Me Ads (${datos.resonancia_cobertura.ninguno} sin ningún creativo que resuene).` : ""} Actualizado {datos.generado.replace("T", " ")}.</p>
    </CardHeader>
    <CardContent className="pt-2"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow className="hover:bg-transparent">
        <TableHead>Anuncio</TableHead><TableHead>Apunta a</TableHead><TableHead>Corrió</TableHead>
        <TableHead className="text-right">Frecuencia</TableHead><TableHead className="text-right">Costo por seguidor</TableHead><TableHead className="text-right">Gasto</TableHead>
        <TableHead className="text-right">Comentaron y agendaron</TableHead><TableHead className="text-right">Resuenan con el creativo</TableHead>
        <TableHead className="text-right">Costo por agenda</TableHead><TableHead className="min-w-[150px]">Tipo de lead</TableHead>
        <TableHead className="text-right">Foco</TableHead><TableHead className="text-right">Calificadas</TableHead>
        <TableHead className="text-right">Presentadas</TableHead><TableHead className="text-right">Cierres</TableHead><TableHead className="text-right">En Europa</TableHead>
        <TableHead className="text-right">Por fecha (ref.)</TableHead>
      </TableRow></TableHeader>
      <TableBody>{lista.map((a) => {
        const e = a.resonancia
        const r = e ? resumenDeTipos(e.tipos) : vacio()
        return <TableRow key={a.id}>
          <TableCell className="max-w-[260px] whitespace-normal" title={a.texto || ""}>
            <div className="font-bold">{a.anuncio}</div>
            <div className="text-[10px] uppercase text-white/40">{ETIQUETA_TXT[a.atribucion]}</div>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">{a.paises.join(", ").replace("europe", "Europa")}{a.edad?.[0] ? ` · ${a.edad[0]}-${a.edad[1]}` : ""}</TableCell>
          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{ddmm(a.desde)} → {ddmm(a.hasta)}</TableCell>
          <TableCell className="text-right font-bold">{uno(a.frecuencia)}</TableCell>
          <TableCell className="text-right font-bold">{a.costo_por_seguidor_cuenta != null ? `USD ${a.costo_por_seguidor_cuenta.toLocaleString("es-AR")}` : "—"}</TableCell>
          <TableCell className="text-right">{money(a.gasto)}</TableCell>
          <TableCell className="text-right">{a.agendas != null ? `${a.agendas} de ${a.contactos_con_etiqueta}` : "—"}</TableCell>
          <TableCell className="text-right font-semibold">{e ? `${e.agendas}${e.alta ? ` (${e.alta} alta)` : ""}` : "—"}</TableCell>
          <TableCell className="text-right">{e?.costo_por_agenda != null ? money(e.costo_por_agenda) : "—"}</TableCell>
          <TableCell><Mezcla r={r} /></TableCell>
          <TableCell className="text-right">{e && e.agendas ? pct(e.foco, e.agendas) : "—"}</TableCell>
          <TableCell className="text-right">{uno(e?.calificadas)}</TableCell>
          <TableCell className="text-right">{uno(e?.presentadas)}</TableCell>
          <TableCell className="text-right">{uno(e?.cierres)}</TableCell>
          <TableCell className="text-right">{uno(e?.en_europa)}</TableCell>
          <TableCell className="text-right text-xs text-muted-foreground">{uno(a.estimado_por_fecha?.agendas)}</TableCell>
        </TableRow>
      })}</TableBody>
    </Table></div></CardContent>
  </Card>
}

function AgendasEuropa({ datos }: { datos: FmAds }) {
  const anuncio = datos.anuncios.find((a) => a.paises.includes("europe") || /europa/i.test(a.anuncio))
  const lista = [...datos.agendas_en_europa].sort((a, b) => b.reserva.localeCompare(a.reserva))
  const desde = anuncio?.desde
  const despues = desde ? lista.filter((p) => p.reserva >= desde) : []
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Agendas con el lead en Europa</CardTitle>
      <p className="text-xs text-muted-foreground">Por la característica del teléfono (agenda o formulario de iClosed). {lista.length} desde mediados de julio{desde ? `; ${despues.length} desde que arrancó «${anuncio?.anuncio}» (${ddmm(desde)}), de las cuales ${despues.filter((p) => p.anuncio_europa).length} comentaron el anuncio` : ""}. Todos los Follow Me Ads incluyen España: un lead español pudo venir de cualquiera. El de Europa apuntó a todo el continente hasta el 10/10 y desde entonces a España, Italia y Alemania.</p>
    </CardHeader>
    <CardContent className="pt-2"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow className="hover:bg-transparent">
        <TableHead>Reserva</TableHead><TableHead>Lead</TableHead><TableHead>País</TableHead><TableHead>Tipo</TableHead><TableHead>Evidencia</TableHead><TableHead>Resultado</TableHead>
      </TableRow></TableHeader>
      <TableBody>{lista.slice(0, 25).map((p) => <TableRow key={`${p.nombre}-${p.reserva}`} className="align-top">
        <TableCell className="text-muted-foreground">{ddmm(p.reserva)}</TableCell>
        <TableCell className="font-bold">{p.nombre}{p.anuncio_europa && <div className="text-[10px] font-bold uppercase text-emerald-300">comentó EUROPA</div>}</TableCell>
        <TableCell className="text-xs">{p.pais || "—"}</TableCell>
        <TableCell className="whitespace-nowrap text-xs"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: COLOR[grupoDe(p.arquetipo)] }} />{p.arquetipo ? ARQUETIPOS[p.arquetipo]?.nombre : "sin resumen"}{p.profesion ? <div className="text-[11px] text-muted-foreground">{p.profesion}</div> : null}</TableCell>
        <TableCell className="max-w-[360px] whitespace-normal text-xs text-muted-foreground">{p.evidencia ? `«${p.evidencia}»` : "—"}</TableCell>
        <TableCell className="text-xs">{p.cerro ? <span className="font-bold text-emerald-300">Cerró</span> : p.show ? "Presentada" : p.show === false ? "No se presentó" : "Sin resultado"}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div></CardContent>
  </Card>
}

export default function TiposAgendaPage() {
  const [dias, setDias] = useState(90)
  const [pieza, setPieza] = useState<string | null>(null)
  const { data, error, isLoading } = useSWR<Datos>(`/api/tipos-agenda?dias=${dias}`, fetcher, { revalidateOnFocus: false })
  const filas = useMemo(() => data?.filas || [], [data])
  const total = useMemo(() => { const r = vacio(); filas.forEach((f) => sumar(r, f)); return r }, [filas])
  return <div className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-5 sm:px-6 lg:px-[1.5cm]">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black">Tipos de agenda</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Qué tipo de persona agenda y qué pieza la trajo. Sale del resumen que el setter publica en el grupo de ventas después de cada agenda: la situación del lead define su arquetipo y el «contenido gatillo» define la pieza. Se actualiza todas las noches.</p>
      </div>
      <div className="flex gap-2">{[30, 60, 90, 180].map((d) => <button key={d} type="button" onClick={() => setDias(d)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide", dias === d ? "border-white bg-white text-black" : "border-white/15 text-white/60 hover:bg-white/5")}>{d} días</button>)}</div>
    </div>
    {error && <p className="text-sm text-red-300">No se pudo cargar: {String(error.message || error)}</p>}
    {isLoading && <p className="text-sm text-muted-foreground">Cruzando resúmenes con agendas y pagos…</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {([["Agendas con resumen", String(total.agendas)], ["Arquetipo foco", pct(total.foco, total.agendas)], ["Calificadas", `${total.calificadas} · ${pct(total.calificadas, total.agendas)}`],
          ["Presentadas", String(total.presentadas)], ["Cierres", `${total.cierres} · ${pct(total.cierres, total.presentadas)}`], ["Cash", money(total.cash)]] as const).map(([l, v]) =>
          <Card key={l} className="border-white/10 bg-white/[.035]"><CardContent className="pt-5"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div><div className="mt-1 text-2xl font-black">{v}</div></CardContent></Card>)}
      </div>
      <div className="space-y-1"><Mezcla r={total} alto={14} /><Leyenda /></div>
      <Semanas filas={filas} />
      <PorAngulo filas={filas} piezas={data.piezas || []} desde={data.desde} />
      <PorDia filas={filas} piezas={data.piezas || []} desde={data.desde} />
      {data.fmAds && <FollowMeAds datos={data.fmAds} />}
      {data.fmAds && <AgendasEuropa datos={data.fmAds} />}
      <TablaPiezas filas={filas} elegida={pieza} elegir={setPieza} />
      <TablaArquetipos filas={filas} />
      <Leads filas={filas} pieza={pieza} />
      <p className="text-xs text-muted-foreground">Calificada = declaró en el formulario un ingreso de USD 1.000 a 3.000 por mes y es de un arquetipo foco (criterio del 08/10/2026). Los resúmenes que no se pudieron cruzar con seguridad con una agenda figuran como «sin agenda cruzada» y no suman presentadas ni cierres.</p>
    </>}
  </div>
}
