"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSession } from "@/components/session-provider"
import { Loader2, MessageCircle, Copy, Save, Sparkles } from "lucide-react"

type Lead = { lead: string; usuario: string; nombre: string; origen: string | null; calificado: boolean; ciclo: string | null; gatillo: string | null; feed: string | null; fups: number | null; dolor: string | null; objetivo: string | null; sintesis_closer: string | null; caso_exito: string | null; material_enviado: string | null; agenda_id?: string | null; agenda_nombre?: string | null }
type Dia = {
  fecha: string; setter: string; calendarios_enviados: number | null; agendas: number | null; calificados_dia: number | null; fups: number | null
  nuevos_seguidores: number | null; ns_contestan: number | null; ns_califican: number | null; ns_bookeados: number | null
  historia: string | null; historia_comentaron: number | null; historia_calificaron: number | null; historia_bookeados: number | null
  outbound_enviados: number | null; outbound_respuestas: number | null; outbound_agendas: number | null
  leads: Lead[]; observaciones?: string[]; resumen_whatsapp?: string
}
type Guardado = { fecha: string; setter: string; calendarios_enviados: number | null; agendas: number | null; calificados_dia: number | null; fups: number | null; leads: number; cruzados: number; origen: string; resumen_whatsapp: string | null }

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v))
const pct = (a: number | null | undefined, b: number | null | undefined) => (a !== null && a !== undefined && b ? `${(Math.round((a / b) * 1000) / 10).toString().replace(".", ",")}%` : "")
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const dm = (f: string) => f.slice(8, 10) + "/" + f.slice(5, 7)

const EJEMPLO = `15 leads nuevos mandaron de 113 que nos siguieron, hice 89 fups y 68 outbound, de la historia del día comentaron 47 (los outbound provienen de ahí). 5 leads agendaron de 9 que se les mandó calendario y 11 calificados.

Nombre de perfil: kozzue (Josué)
Situación actual: Editor y creador de contenido para negocios…
Freno o dolor: …
Objetivo: …
Caso de éxito enviado: …
Origen: Follow Me Ads (nuevo seguidor)
Material enviado: …
Contenido gatillo: …
Ciclo de agenda: …
Seguimientos para agendar: …
Historial de chat: …
Síntesis para el closer: …

Nombre de perfil: Matias Martinez
…`

function Kpi({ t, v, s }: { t: string; v: string; s?: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-3">
    <p className="text-[10.5px] font-bold uppercase tracking-[.12em] text-muted-foreground">{t}</p>
    <p className="mt-1 text-2xl font-black tracking-tight">{v}</p>
    {s && <p className="text-xs text-muted-foreground">{s}</p>}
  </div>
}

export default function SettingResumenPage() {
  const session = useSession()
  const [fecha, setFecha] = useState(hoyIso())
  const [notas, setNotas] = useState("")
  const [dia, setDia] = useState<Dia | null>(null)
  const [wa, setWa] = useState("")
  const [estado, setEstado] = useState<"idle" | "generando" | "guardando">("idle")
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<{ enlazados: number; leads: number; completadas: number; sinAgenda: string[]; ambiguos: string[] } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const { data: historial } = useSWR<{ dias: Guardado[] }>("/api/setting-resumen?limite=20", fetcher, { revalidateOnFocus: false })
  const setter = session.nombre?.split(" ")[0] || "Maximo"

  async function generar() {
    setEstado("generando"); setError(null); setGuardado(null)
    try {
      const r = await fetch("/api/setting-resumen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "generar", fecha, notas, setter }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "No se pudo generar")
      setDia(j.dia); setWa(j.dia.resumen_whatsapp || "")
    } catch (e) { setError((e as Error).message) } finally { setEstado("idle") }
  }
  async function guardar() {
    if (!dia) return
    setEstado("guardando"); setError(null)
    try {
      const r = await fetch("/api/setting-resumen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "guardar", fecha, setter, dia, notas, resumen_whatsapp: wa }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "No se pudo guardar")
      setGuardado(j); void mutate("/api/setting-resumen?limite=20")
    } catch (e) { setError((e as Error).message) } finally { setEstado("idle") }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(wa); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch { /* sin permiso de portapapeles */ }
  }

  return <div className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-5 sm:px-6 lg:px-[1.5cm]">
    <div>
      <h1 className="text-2xl font-black">Resumen de setting</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Pegá las notas crudas del día tal como las escribís en el bloc de notas. Sale el reporte del día (números + lead por lead), un mensaje listo para WhatsApp y, al guardar, queda en el CRM: cada lead cruzado con su agenda, el panel y las métricas del setter.</p>
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.6fr)]">
      <Card className="border-white/10 bg-white/[.035] xl:sticky xl:top-4 xl:self-start">
        <CardHeader className="pb-2"><CardTitle className="text-base">Notas del día</CardTitle><p className="text-xs text-muted-foreground">Setter: <b>{setter}</b>. Los números del día en una frase y después un bloque por lead agendado.</p></CardHeader>
        <CardContent className="space-y-3 pt-2">
          <label className="block text-xs font-semibold text-muted-foreground">Fecha del reporte
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1 block w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-foreground" />
          </label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={EJEMPLO} rows={22} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-foreground placeholder:text-white/25" />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generar} disabled={estado !== "idle" || notas.trim().length < 40}>{estado === "generando" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Generar resumen</Button>
            <span className="text-xs text-muted-foreground">{notas.length.toLocaleString("es-AR")} caracteres</span>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {!dia && <Card className="border-dashed border-white/15 bg-transparent"><CardContent className="py-14 text-center text-sm text-muted-foreground">Acá aparece el reporte del día cuando lo generes.</CardContent></Card>}
        {dia && <>
          <Card className="border-white/10 bg-white/[.035]">
            <CardHeader className="pb-2"><CardTitle className="text-base">Setting del {dm(dia.fecha)} · {dia.setter}</CardTitle>{dia.observaciones?.length ? <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{dia.observaciones.map((o, i) => <li key={i}>{o}</li>)}</ul> : null}</CardHeader>
            <CardContent className="pt-2">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi t="Calendarios enviados" v={n(dia.calendarios_enviados)} />
                <Kpi t="Agendas" v={n(dia.agendas)} s={pct(dia.agendas, dia.calendarios_enviados) ? `${pct(dia.agendas, dia.calendarios_enviados)} de los calendarios` : undefined} />
                <Kpi t="Calificados (día)" v={n(dia.calificados_dia)} s="negocio + dolor identificados" />
                <Kpi t="Seguimientos" v={n(dia.fups)} />
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <Kpi t="Nuevos seguidores" v={n(dia.nuevos_seguidores)} s={`${n(dia.ns_contestan)} contestan · ${n(dia.ns_califican)} califican · ${n(dia.ns_bookeados)} bookean`} />
                <Kpi t={dia.historia ? `Historia · ${dia.historia}` : "Historia del día"} v={n(dia.historia_comentaron)} s={`comentaron · ${n(dia.historia_calificaron)} calificaron · ${n(dia.historia_bookeados)} bookeados`} />
                <Kpi t="Outbound" v={n(dia.outbound_enviados)} s={`enviados · ${n(dia.outbound_respuestas)} respuestas · ${n(dia.outbound_agendas)} agendas`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[.035]">
            <CardHeader className="pb-2"><CardTitle className="text-base">Lead por lead ({dia.leads.length})</CardTitle></CardHeader>
            <CardContent className="pt-2">
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Lead</TableHead><TableHead>Origen</TableHead><TableHead>Calif.</TableHead><TableHead>Ciclo</TableHead><TableHead>Gatillo</TableHead><TableHead className="text-right">Fups</TableHead><TableHead>Dolor</TableHead><TableHead>Objetivo</TableHead><TableHead>Para el closer</TableHead></TableRow></TableHeader>
                <TableBody>{dia.leads.map((l, i) => <TableRow key={i}>
                  <TableCell className="font-bold whitespace-nowrap">{l.lead}{l.agenda_nombre && <span className="block text-[11px] font-normal text-emerald-300">↳ {l.agenda_nombre}</span>}</TableCell>
                  <TableCell className="max-w-[200px] whitespace-normal text-muted-foreground">{l.origen || "—"}</TableCell>
                  <TableCell>{l.calificado ? <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">Sí</span> : <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/60">No</span>}</TableCell>
                  <TableCell className="max-w-[160px] whitespace-normal text-muted-foreground">{l.ciclo || "—"}</TableCell>
                  <TableCell className="max-w-[200px] whitespace-normal text-muted-foreground">{l.gatillo || "—"}{l.feed && <span className="block text-[11px]">{l.feed}</span>}</TableCell>
                  <TableCell className="text-right">{n(l.fups)}</TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal">{l.dolor || "—"}</TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal">{l.objetivo || "—"}</TableCell>
                  <TableCell className="max-w-[320px] whitespace-normal text-xs text-muted-foreground">{l.sintesis_closer || "—"}</TableCell>
                </TableRow>)}</TableBody>
              </Table></div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[.035]">
            <CardHeader className="pb-2"><CardTitle className="text-base">Mensaje para WhatsApp</CardTitle><p className="text-xs text-muted-foreground">Editalo si querés y mandalo al grupo del equipo. "Abrir WhatsApp" lo deja escrito para que elijas el chat.</p></CardHeader>
            <CardContent className="space-y-3 pt-2">
              <textarea value={wa} onChange={(e) => setWa(e.target.value)} rows={16} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-[13px] leading-relaxed text-foreground" />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={copiar}><Copy className="mr-2 h-4 w-4" />{copiado ? "Copiado" : "Copiar"}</Button>
                <a href={`https://wa.me/?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer" className={cn("inline-flex h-9 items-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500", !wa && "pointer-events-none opacity-50")}><MessageCircle className="mr-2 h-4 w-4" />Abrir WhatsApp</a>
                <span className="text-xs text-muted-foreground">{wa.length.toLocaleString("es-AR")} caracteres</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-emerald-500/[.04]">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-semibold">Guardar en el CRM</p>
                <p className="text-xs text-muted-foreground">Cruza cada lead con su agenda, completa dolor/objetivo/gatillo/fuente si estaban vacíos, deja el evento en la ficha y actualiza el Panel del negocio y Métricas.</p>
              </div>
              <Button onClick={guardar} disabled={estado !== "idle"}>{estado === "guardando" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar el {dm(fecha)}</Button>
              {guardado && <div className="w-full text-sm">
                <p className="text-emerald-300">Guardado: {guardado.enlazados} de {guardado.leads} leads cruzados con su agenda, {guardado.completadas} agendas completadas.</p>
                {guardado.sinAgenda.length > 0 && <p className="text-xs text-muted-foreground">Sin agenda en el CRM (o con otro nombre): {guardado.sinAgenda.join(", ")}.</p>}
                {guardado.ambiguos.length > 0 && <p className="text-xs text-muted-foreground">Sin cruzar por ambiguos: {guardado.ambiguos.join(" · ")}.</p>}
              </div>}
            </CardContent>
          </Card>
        </>}

        <Card className="border-white/10 bg-white/[.035]">
          <CardHeader className="pb-2"><CardTitle className="text-base">Días guardados</CardTitle><p className="text-xs text-muted-foreground">Lo que ya está en el CRM (por script o por este generador).</p></CardHeader>
          <CardContent className="pt-2">
            {!historial?.dias?.length && <p className="text-sm text-muted-foreground">Todavía no hay días guardados.</p>}
            {historial?.dias?.length ? <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Día</TableHead><TableHead>Setter</TableHead><TableHead className="text-right">Calendarios</TableHead><TableHead className="text-right">Agendas</TableHead><TableHead className="text-right">Calificados</TableHead><TableHead className="text-right">Fups</TableHead><TableHead className="text-right">Leads cruzados</TableHead><TableHead>Origen</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>{historial.dias.map((d) => <TableRow key={d.fecha}>
                <TableCell className="font-mono text-xs">{dm(d.fecha)}</TableCell><TableCell>{d.setter}</TableCell>
                <TableCell className="text-right">{n(d.calendarios_enviados)}</TableCell><TableCell className="text-right font-semibold">{n(d.agendas)}</TableCell>
                <TableCell className="text-right">{n(d.calificados_dia)}</TableCell><TableCell className="text-right">{n(d.fups)}</TableCell>
                <TableCell className="text-right">{d.cruzados} / {d.leads}</TableCell><TableCell className="text-muted-foreground">{d.origen === "generador" ? "Generador" : "Dashboard"}</TableCell>
                <TableCell>{d.resumen_whatsapp && <button type="button" onClick={() => { setWa(d.resumen_whatsapp || "") }} className="text-xs text-emerald-300 underline-offset-2 hover:underline">ver mensaje</button>}</TableCell>
              </TableRow>)}</TableBody>
            </Table></div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
}
