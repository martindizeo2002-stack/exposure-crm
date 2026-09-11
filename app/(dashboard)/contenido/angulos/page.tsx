"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Fila = { nombre: string; tag?: string; angulo?: string; formato?: string; categoria?: string; fecha?: string | null; leads: number; nuevos: number; agendas: number; presentadas: number; calificadas: number; cierres: number; cash: number; ultima: string | null }
type Datos = {
  desde: string; dias: number
  cobertura: { contactos: number; contactosNuevos: number; agendas: number; conPersona: number; conTags: number; cash: number }
  angulos: Fila[]; subangulos: Fila[]; piezas: Fila[]; formatos: Fila[]; categorias: Fila[]; historias: Fila[]
}

const fetcher = (url: string) => fetch(url).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "No se pudo cargar"); return b })
const pct = (n: number, d: number) => (d ? `${(Math.round((n / d) * 1000) / 10).toString().replace(".", ",")}%` : "—")
const money = (n: number) => `USD ${Math.round(n).toLocaleString("es-AR")}`
const miles = (n: number) => Math.round(n).toLocaleString("es-AR")
const fecha = (f?: string | null) => (f ? f.split("-").reverse().slice(0, 2).join("/") : "—")
const COLOR: Record<string, string> = { "Solución": "bg-emerald-500/15 text-emerald-300", "Volumen/TOFU": "bg-violet-500/15 text-violet-300", "Producto": "bg-sky-500/15 text-sky-300", "Problema": "bg-red-500/15 text-red-300" }
const EMOJI: Record<string, string> = { "Solución": "🟢", "Volumen/TOFU": "🟣", "Producto": "🔵", "Problema": "🔴" }

function Angulo({ a }: { a?: string }) {
  if (!a) return <span className="text-white/30">—</span>
  return <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-semibold", COLOR[a] || "bg-white/10 text-white/70")}>{EMOJI[a] || ""} {a}</span>
}

function Tabla({ filas, titulo, sub, columnas }: { filas: Fila[]; titulo: string; sub: string; columnas: Array<"angulo" | "formato" | "categoria" | "fecha"> }) {
  return <Card className="border-white/10 bg-white/[.035]">
    <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle><p className="text-xs text-muted-foreground">{sub}</p></CardHeader>
    <CardContent className="pt-2">
      {!filas.length && <p className="py-6 text-center text-sm text-muted-foreground">Sin etiquetas de este tipo en el período.</p>}
      {filas.length > 0 && <div className="overflow-x-auto"><Table>
        <TableHeader><TableRow className="hover:bg-transparent">
          <TableHead>Nombre</TableHead>
          {columnas.includes("angulo") && <TableHead>Ángulo</TableHead>}
          {columnas.includes("formato") && <TableHead>Formato</TableHead>}
          {columnas.includes("categoria") && <TableHead>Categoría</TableHead>}
          {columnas.includes("fecha") && <TableHead>Publicada</TableHead>}
          <TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Nuevos</TableHead>
          <TableHead className="text-right">Agendas</TableHead><TableHead className="text-right">Lead → agenda</TableHead>
          <TableHead className="text-right">Presentadas</TableHead><TableHead className="text-right">Calificadas</TableHead>
          <TableHead className="text-right">Cierres</TableHead><TableHead className="text-right">Cierre</TableHead>
          <TableHead className="text-right">Cash collected</TableHead><TableHead className="text-right">Cash / lead</TableHead><TableHead>Última agenda</TableHead>
        </TableRow></TableHeader>
        <TableBody>{filas.map((f) => <TableRow key={f.nombre}>
          <TableCell className="max-w-[380px] whitespace-normal font-bold" title={f.tag}>{f.nombre}</TableCell>
          {columnas.includes("angulo") && <TableCell><Angulo a={f.angulo} /></TableCell>}
          {columnas.includes("formato") && <TableCell className="text-muted-foreground">{f.formato || "—"}</TableCell>}
          {columnas.includes("categoria") && <TableCell className="text-muted-foreground">{f.categoria || "—"}</TableCell>}
          {columnas.includes("fecha") && <TableCell className="text-muted-foreground">{fecha(f.fecha)}</TableCell>}
          <TableCell className="text-right">{miles(f.leads)}</TableCell><TableCell className="text-right text-muted-foreground">{miles(f.nuevos)}</TableCell>
          <TableCell className="text-right font-semibold">{f.agendas}</TableCell><TableCell className="text-right">{pct(f.agendas, f.leads)}</TableCell>
          <TableCell className="text-right">{f.presentadas}</TableCell><TableCell className="text-right">{f.calificadas}</TableCell>
          <TableCell className="text-right font-semibold">{f.cierres}</TableCell><TableCell className="text-right">{pct(f.cierres, f.presentadas)}</TableCell>
          <TableCell className="text-right font-semibold">{f.cash ? money(f.cash) : "—"}</TableCell>
          <TableCell className="text-right text-muted-foreground">{f.cash && f.leads ? `USD ${(f.cash / f.leads).toFixed(2).replace(".", ",")}` : "—"}</TableCell>
          <TableCell className="text-muted-foreground">{fecha(f.ultima)}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    </CardContent>
  </Card>
}

export default function AngulosPage() {
  const [dias, setDias] = useState(35)
  const { data, error, isLoading } = useSWR<Datos>(`/api/angulos-manychat?dias=${dias}`, fetcher, { revalidateOnFocus: false })
  const cob = data?.cobertura
  return <div className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-5 sm:px-6 lg:px-[1.5cm]">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black">Ángulos de comunicación</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Qué ángulo trae leads, cuáles llegan a agenda, cuáles cierran y cuánto cash dejó cada uno. Sale de las etiquetas que ManyChat le pone a cada contacto (🟢 Solución · 🟣 Volumen/TOFU · 🔵 Producto · 🔴 Problema), cruzadas con las agendas y los pagos de esa persona.</p>
      </div>
      <div className="flex gap-2">{[14, 35, 60, 90, 180].map((d) => <button key={d} type="button" onClick={() => setDias(d)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide", dias === d ? "border-white bg-white text-black" : "border-white/15 text-white/60 hover:bg-white/5")}>{d} días</button>)}</div>
    </div>
    {error && <p className="text-sm text-red-300">No se pudo cargar: {String(error.message || error)}</p>}
    {isLoading && <p className="text-sm text-muted-foreground">Cruzando etiquetas con agendas y pagos…</p>}
    {data && cob && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.angulos.map((a) => <Card key={a.nombre} className="border-white/10 bg-white/[.035]">
          <CardContent className="pt-5">
            <Angulo a={a.nombre} />
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground">Leads</span><span className="text-right font-bold">{miles(a.leads)}</span>
              <span className="text-muted-foreground">Agendas</span><span className="text-right font-bold">{a.agendas} <span className="text-xs font-normal text-muted-foreground">({pct(a.agendas, a.leads)})</span></span>
              <span className="text-muted-foreground">Presentadas</span><span className="text-right">{a.presentadas}</span>
              <span className="text-muted-foreground">Cierres</span><span className="text-right font-bold">{a.cierres} <span className="text-xs font-normal text-muted-foreground">({pct(a.cierres, a.presentadas)})</span></span>
              <span className="text-muted-foreground">Cash collected</span><span className="text-right font-black">{a.cash ? money(a.cash) : "—"}</span>
            </div>
          </CardContent>
        </Card>)}
        {!data.angulos.length && <p className="text-sm text-muted-foreground">Todavía no hay contactos etiquetados con ángulo en este período.</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        Desde el {data.desde.split("-").reverse().join("/")}: {miles(cob.contactos)} contactos en ManyChat ({miles(cob.contactosNuevos)} nuevos en el período) · {cob.agendas} agendas, {cob.conTags} con etiquetas de ManyChat cruzadas ({pct(cob.conTags, cob.agendas)}) · {money(cob.cash)} cobrados a personas con agenda en el período.
        "Leads" cuenta todos los contactos que tienen la etiqueta; "Nuevos" solo los que siguieron la cuenta en el período. Las agendas sin contacto de ManyChat cruzado no entran en ninguna fila: por eso la cobertura importa.
      </p>
      <Tabla filas={data.subangulos} titulo="Sub-ángulos" sub="El ángulo con su tema concreto, tal como lo etiqueta el flujo (ej. Solución · Cómo hacer dinero con IA)." columnas={["angulo"]} />
      <Tabla filas={data.piezas} titulo="Piezas" sub="Cada contenido publicado, con su formato, ángulo y fecha. Ordenado por cash, cierres y agendas." columnas={["angulo", "formato", "categoria", "fecha"]} />
      <Tabla filas={data.historias} titulo="Historias" sub="Las historias con keyword, una por una." columnas={["fecha"]} />
      <Tabla filas={data.formatos} titulo="Formatos" sub="Yapping, carrusel, B-roll, explicativo iPad, tutorial, reacción…" columnas={[]} />
      <Tabla filas={data.categorias} titulo="Categorías" sub="Reel, carrusel, historia, ads, nuevo seguidor: el canal por el que entró el lead." columnas={[]} />
    </>}
  </div>
}
