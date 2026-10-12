"use client"

// Auditoría de cierres del mes en curso contra el mes anterior.
// Lee /api/ventas/resumen (periodo=mes, ligero=1) dos veces y arma en el cliente:
// tablero, conclusiones, gráficos y la lista lead por lead de cierres y no cierres.
// Cierre = venta a lead nuevo con USD 400 o más cobrados (sin fees, cuotas sueltas ni ventas internas).

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Loader2, Pencil, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CallDetalle, ResumenPayload } from "@/lib/closing-whatsapp-formatter"

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const TICKET_MINIMO = 400
const GRADOS = ["A/B/S", "C", "D", "Sin score"] as const
type Grado = (typeof GRADOS)[number]

type MesRef = { anio: number; mes: number } // mes 1-12
const pad = (n: number) => String(n).padStart(2, "0")
const mesLabel = (m: MesRef) => MESES[m.mes - 1].charAt(0).toUpperCase() + MESES[m.mes - 1].slice(1)
const mesCorto = (m: MesRef) => mesLabel(m).slice(0, 3)
const usd = (n: number) => `USD ${Math.round(n).toLocaleString("es-AR")}`
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

function grado(c: CallDetalle): Grado {
  const g = String(c.lead_score || c.calificacion || "").toUpperCase().replace(/LEAD\s*/, "").trim().charAt(0)
  if (g === "A" || g === "B" || g === "S") return "A/B/S"
  if (g === "C") return "C"
  if (g === "D") return "D"
  return "Sin score"
}

// Venta nueva: sin pagos cargados (cerro marcado a mano) o con al menos un concepto de front end.
function esVentaNueva(c: CallDetalle) {
  const tipos = c.tipos_pago || []
  if (!tipos.length) return true
  return tipos.some((t) => /venta nueva|adentro en seguimiento|complet/i.test(t) && !/interna/i.test(t))
}
const esCierre = (c: CallDetalle) => c.resultado === "CIERRE" && (c.cash_d1 || 0) >= TICKET_MINIMO && esVentaNueva(c)
const esShow = (c: CallDetalle) => c.es_show ?? ["CIERRE", "FEE", "SEGUIMIENTO"].includes(c.resultado)

const FRENOS: { k: string; re: RegExp }[] = [
  { k: "Plata", re: /diner|plata|precio|inversi|econ[oó]m|fondos|recursos|capital|pagar|caro|cuota|ahorro/i },
  { k: "Decide otra persona", re: /padre|madre|pap[aá]|mam[aá]|familia|pareja|espos|novi[ao]|socio|tutor/i },
  { k: "Confianza o miedo", re: /confian|desconf|estaf|miedo|segur/i },
  { k: "Lo tiene que pensar", re: /pensar|pensa|analiz|decidir despu/i },
  { k: "Tiempo", re: /tiempo|horario|ocupad/i },
]
function freno(c: CallDetalle): string {
  const txt = [c.objecion_principal, c.motivo_real, c.fathom_lead?.objecion, c.fathom_lead?.porque_no_cerro].filter(Boolean).join(" ")
  if (!txt.trim() || /sin motivo|sin objeci/i.test(txt)) return "Sin motivo cargado"
  return FRENOS.find((f) => f.re.test(txt))?.k || "Otro"
}

function unicas(calls: CallDetalle[]) {
  const seen = new Set<string>()
  return calls.filter((c) => {
    const k = c.agenda_id ? `id:${c.agenda_id}` : `n:${c.nombre}_${c.fecha}_${c.hora}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

type Analisis = ReturnType<typeof analizar>
function analizar(datos: ResumenPayload) {
  const calls = unicas(datos.calls || [])
  const shows = calls.filter(esShow)
  const cierres = shows.filter(esCierre)
  const cierresSet = new Set(cierres)
  const noCierres = shows.filter((c) => !cierresSet.has(c))
  const cobrosChicos = noCierres.filter((c) => (c.resultado === "FEE" || c.resultado === "CIERRE") && (c.cash_d1 || 0) > 0)
  const porGrado = Object.fromEntries(GRADOS.map((g) => [g, { shows: 0, cierres: 0 }])) as Record<Grado, { shows: number; cierres: number }>
  shows.forEach((c) => { porGrado[grado(c)].shows++; if (cierresSet.has(c)) porGrado[grado(c)].cierres++ })
  const porCloser: Record<string, { shows: number; cierres: number; cash: number }> = {}
  shows.forEach((c) => {
    const k = (c.closer || "Sin closer").split(" ")[0]
    porCloser[k] ||= { shows: 0, cierres: 0, cash: 0 }
    porCloser[k].shows++
    if (cierresSet.has(c)) { porCloser[k].cierres++; porCloser[k].cash += c.cash_d1 || 0 }
  })
  const frenos: Record<string, number> = {}
  noCierres.forEach((c) => { const f = freno(c); frenos[f] = (frenos[f] || 0) + 1 })
  return {
    agendas: datos.metricas?.programadas ?? calls.length,
    shows: shows.length,
    showPct: Math.round(datos.metricas?.show_rate_pct ?? 0),
    cierres, noCierres, cobrosChicos,
    cash: cierres.reduce((a, c) => a + (c.cash_d1 || 0), 0),
    seguimientos: noCierres.filter((c) => c.resultado === "SEGUIMIENTO").length,
    estudiantes: shows.filter((c) => c.arquetipo_macro === "ESTUDIANTE").length,
    porGrado, porCloser, frenos,
  }
}

function delta(a: number, b: number) {
  if (!b) return a ? "nuevo" : "="
  const d = Math.round(((a - b) / b) * 100)
  return `${d > 0 ? "+" : ""}${d} %`
}

function conclusiones(act: Analisis, ant: Analisis, mA: MesRef, mB: MesRef, avance: number) {
  const out: { tono: "bad" | "ok" | "info"; txt: string }[] = []
  const nA = act.cierres.length, nB = ant.cierres.length
  const proy = avance > 0 && avance < 1 ? Math.round(nA / avance) : null
  out.push({ tono: nA >= nB ? "ok" : "bad", txt: `Cierres: ${nA} en ${mesLabel(mA)} contra ${nB} en ${mesLabel(mB)}${proy !== null ? `. Al ritmo actual el mes terminaría en ${proy}` : ""}.` })
  out.push({ tono: act.showPct >= ant.showPct ? "ok" : "bad", txt: `Show ${act.showPct} % contra ${ant.showPct} %. Se presentaron ${act.shows} de ${act.agendas} agendas.` })
  const abA = act.porGrado["A/B/S"].shows, abB = ant.porGrado["A/B/S"].shows
  const dA = pct(act.porGrado.D.shows, act.shows), dB = pct(ant.porGrado.D.shows, ant.shows)
  out.push({ tono: abA >= abB * avance && dA <= dB ? "ok" : "bad", txt: `Se presentaron ${abA} leads A, B o S (${abB} el mes anterior). Los leads D son el ${dA} % de los shows (${dB} % antes).` })
  const tot = (g: Grado) => ({ s: act.porGrado[g].shows + ant.porGrado[g].shows, c: act.porGrado[g].cierres + ant.porGrado[g].cierres })
  const abs = tot("A/B/S"), d = tot("D")
  if (abs.s + d.s > 0) out.push({ tono: "info", txt: `En los dos meses, los leads A, B o S cerraron el ${pct(abs.c, abs.s)} % (${abs.c} de ${abs.s}) y los D el ${pct(d.c, d.s)} % (${d.c} de ${d.s}).` })
  const topA = Object.entries(act.frenos).sort((a, b) => b[1] - a[1])[0]
  if (topA) out.push({ tono: "info", txt: `El freno más repetido en los no cierres es "${topA[0]}": ${topA[1]} de ${act.noCierres.length} (${ant.frenos[topA[0]] || 0} el mes anterior).` })
  const closers = Object.entries(act.porCloser).sort((a, b) => b[1].shows - a[1].shows)
  if (closers.length) {
    const [nom, v] = closers[0]
    out.push({ tono: "info", txt: `${nom} tomó ${v.shows} de ${act.shows} shows (${pct(v.shows, act.shows)} %) y cerró ${v.cierres}. ${closers.slice(1).map(([n, x]) => `${n}: ${x.cierres} de ${x.shows}`).join(" · ")}`.trim() })
  }
  if (act.seguimientos || act.cobrosChicos.length) out.push({ tono: "bad", txt: `${act.seguimientos} leads quedaron en seguimiento y ${act.cobrosChicos.length} pagaron menos de USD ${TICKET_MINIMO} (fee o seña). Es la plata más cerca de entrar.` })
  return out
}

function textoCopiable(act: Analisis, ant: Analisis, mA: MesRef, mB: MesRef, concl: ReturnType<typeof conclusiones>) {
  const l = [`AUDITORÍA DE CIERRES · ${mesLabel(mA).toUpperCase()} vs ${mesLabel(mB).toUpperCase()}`, ""]
  l.push(`Cierres ≥ USD ${TICKET_MINIMO}: ${act.cierres.length} vs ${ant.cierres.length}`, `Cash día 1: ${usd(act.cash)} vs ${usd(ant.cash)}`, `Show: ${act.showPct} % vs ${ant.showPct} %`, "")
  l.push("CONCLUSIONES", ...concl.map((c) => `• ${c.txt}`), "", "CIERRES")
  act.cierres.forEach((c) => l.push(`• ${c.nombre} · ${c.closer} · ${usd(c.cash_d1)} · ${grado(c)}`))
  l.push("", "NO CIERRES")
  act.noCierres.forEach((c) => l.push(`• ${c.nombre} · ${c.closer} · ${c.resultado} · ${freno(c)}${c.link_fathom ? ` · ${c.link_fathom}` : ""}`))
  return l.join("\n")
}

function Barra({ v, max, cls, label }: { v: number; max: number; cls: string; label: string }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="h-2.5 flex-1 rounded-sm bg-white/5">
        <div className={cn("h-full rounded-sm", cls)} style={{ width: `${max > 0 ? Math.max(v > 0 ? 3 : 0, (v / max) * 100) : 0}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-[11px] tabular-nums text-zinc-300">{v}</span>
    </div>
  )
}

const COLOR_GRADO: Record<Grado, string> = { "A/B/S": "bg-sky-400", C: "bg-sky-600", D: "bg-sky-900", "Sin score": "bg-zinc-600" }

export function AuditoriaMensual({ onAbrirFicha }: { onAbrirFicha?: (c: CallDetalle) => void }) {
  const hoy = new Date()
  const mA: MesRef = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
  const mB: MesRef = mA.mes === 1 ? { anio: mA.anio - 1, mes: 12 } : { anio: mA.anio, mes: mA.mes - 1 }
  const diasMes = new Date(mA.anio, mA.mes, 0).getDate()
  const avance = hoy.getDate() / diasMes

  const [datos, setDatos] = useState<{ act: ResumenPayload; ant: ResumenPayload } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"cierres" | "no_cierres">("no_cierres")
  const [filtro, setFiltro] = useState("")
  const [abierto, setAbierto] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const pedir = async (m: MesRef) => {
        const r = await fetch(`/api/ventas/resumen?periodo=mes&fecha=${m.anio}-${pad(m.mes)}-01&closer=todos&modo=corto&ligero=1`, { cache: "no-store" })
        const j = await r.json()
        if (!r.ok || !j.ok) throw new Error(j.error || "No se pudo leer el mes")
        return j.datos as ResumenPayload
      }
      const [act, ant] = await Promise.all([pedir(mA), pedir(mB)])
      setDatos({ act, ant })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { void cargar() }, [])

  const res = useMemo(() => (datos ? { act: analizar(datos.act), ant: analizar(datos.ant) } : null), [datos])
  const concl = useMemo(() => (res ? conclusiones(res.act, res.ant, mA, mB, avance) : []), [res])

  const copiar = async () => {
    if (!res) return
    const t = textoCopiable(res.act, res.ant, mA, mB, concl)
    try { await navigator.clipboard.writeText(t); setCopiado(true); toast.success("Auditoría copiada"); setTimeout(() => setCopiado(false), 2000) }
    catch { toast.error("No se pudo copiar") }
  }

  const lista = useMemo(() => {
    if (!res) return []
    const base = tab === "cierres" ? res.act.cierres : res.act.noCierres
    const q = filtro.trim().toLowerCase()
    return q ? base.filter((c) => `${c.nombre} ${c.closer} ${freno(c)} ${c.resultado}`.toLowerCase().includes(q)) : base
  }, [res, tab, filtro])

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-emerald-400">
          <span>Auditoría de cierres</span>
          <span className="font-sans text-[11px] font-normal normal-case text-zinc-400">
            {mesLabel(mA)} (al {hoy.getDate()}/{pad(mA.mes)}) vs {mesLabel(mB)}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando}
            className="h-8 border-emerald-500/30 text-xs text-emerald-400 hover:bg-emerald-500/10">
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", cargando && "animate-spin")} />Recargar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={copiar} disabled={!res}
            className="h-8 border-emerald-500/30 text-xs text-emerald-400 hover:bg-emerald-500/10">
            {copiado ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}{copiado ? "Copiado!" : "Copiar"}
          </Button>
        </div>
      </div>

      <Card className="space-y-5 border-white/10 bg-zinc-950 p-4 text-xs text-zinc-200">
        {cargando && !res && (
          <div className="flex items-center gap-2 py-10 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Leyendo {mesLabel(mA)} y {mesLabel(mB)}…</div>
        )}
        {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-red-300">No se pudo armar la auditoría: {error}. Probá con Recargar.</div>}

        {res && (
          <>
            {/* Tablero */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { t: `Cierres ≥ USD ${TICKET_MINIMO}`, a: res.act.cierres.length, b: res.ant.cierres.length, f: String },
                { t: "Cash día 1", a: res.act.cash, b: res.ant.cash, f: usd },
                { t: "Show", a: res.act.showPct, b: res.ant.showPct, f: (n: number) => `${n} %` },
                { t: "Shows A/B/S", a: res.act.porGrado["A/B/S"].shows, b: res.ant.porGrado["A/B/S"].shows, f: String },
              ].map((k) => (
                <div key={k.t} className="rounded-md border border-white/10 bg-zinc-900/60 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{k.t}</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-sans text-2xl font-bold tabular-nums text-white">{k.f(k.a)}</span>
                    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px]", k.a >= k.b ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>{delta(k.a, k.b)}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <Barra v={k.a} max={Math.max(k.a, k.b)} cls="bg-emerald-400" label={`${mesLabel(mA)}: ${k.f(k.a)}`} />
                    <Barra v={k.b} max={Math.max(k.a, k.b)} cls="bg-zinc-500" label={`${mesLabel(mB)}: ${k.f(k.b)}`} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-zinc-500"><span>■ {mesCorto(mA)}</span><span>{mesCorto(mB)}: {k.f(k.b)}</span></div>
                </div>
              ))}
            </div>

            {/* Conclusiones */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Qué dicen los números</div>
              <ul className="space-y-1.5 font-sans text-[12.5px] leading-snug">
                {concl.map((c, i) => (
                  <li key={i} className={cn("rounded border-l-2 bg-white/[0.03] px-2.5 py-1.5",
                    c.tono === "bad" ? "border-red-400" : c.tono === "ok" ? "border-emerald-400" : "border-sky-400")}>{c.txt}</li>
                ))}
              </ul>
            </div>

            {/* Embudo */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Embudo</div>
              {(["agendas", "shows", "cierres"] as const).map((k) => {
                const a = k === "cierres" ? res.act.cierres.length : res.act[k]
                const b = k === "cierres" ? res.ant.cierres.length : res.ant[k]
                const max = Math.max(res.act.agendas, res.ant.agendas)
                return (
                  <div key={k} className="grid grid-cols-[64px_1fr] items-center gap-2">
                    <span className="capitalize text-zinc-400">{k}</span>
                    <div className="space-y-0.5">
                      <Barra v={a} max={max} cls="bg-emerald-400" label={`${mesLabel(mA)} · ${k}: ${a}`} />
                      <Barra v={b} max={max} cls="bg-zinc-500" label={`${mesLabel(mB)} · ${k}: ${b}`} />
                    </div>
                  </div>
                )
              })}
              <div className="flex gap-3 text-[10px] text-zinc-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400" />{mesLabel(mA)}</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-zinc-500" />{mesLabel(mB)}</span></div>
            </div>

            {/* Mezcla de calificación */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Quién se presenta (calificación de los shows)</div>
              {[{ m: mA, r: res.act }, { m: mB, r: res.ant }].map(({ m, r }) => (
                <div key={m.mes} className="grid grid-cols-[64px_1fr] items-center gap-2">
                  <span className="text-zinc-400">{mesCorto(m)}</span>
                  <div className="flex h-5 gap-[2px] overflow-hidden rounded-sm">
                    {GRADOS.map((g) => r.porGrado[g].shows > 0 && (
                      <div key={g} className={cn("flex items-center justify-center text-[10px] font-bold text-white", COLOR_GRADO[g])}
                        style={{ width: `${(r.porGrado[g].shows / Math.max(1, r.shows)) * 100}%` }}
                        title={`${g}: ${r.porGrado[g].shows} de ${r.shows} shows`}>
                        {r.porGrado[g].shows / Math.max(1, r.shows) > 0.12 ? `${pct(r.porGrado[g].shows, r.shows)}%` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">
                {GRADOS.map((g) => <span key={g}><i className={cn("mr-1 inline-block h-2 w-2 rounded-sm", COLOR_GRADO[g])} />{g}</span>)}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                {GRADOS.slice(0, 3).map((g) => {
                  const s = res.act.porGrado[g].shows + res.ant.porGrado[g].shows, c = res.act.porGrado[g].cierres + res.ant.porGrado[g].cierres
                  return (
                    <div key={g} className="rounded border border-white/10 p-2" title={`${c} cierres de ${s} shows en los dos meses`}>
                      <div className="text-[10px] text-zinc-500">Cierra lead {g}</div>
                      <div className="font-sans text-base font-bold tabular-nums">{pct(c, s)} %</div>
                      <div className="text-[10px] text-zinc-500">{c} de {s}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Closers y frenos */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Cierres por closer</div>
                {[...new Set([...Object.keys(res.act.porCloser), ...Object.keys(res.ant.porCloser)])].map((k) => {
                  const a = res.act.porCloser[k] || { shows: 0, cierres: 0 }, b = res.ant.porCloser[k] || { shows: 0, cierres: 0 }
                  const max = Math.max(1, ...Object.values(res.act.porCloser).map((x) => x.cierres), ...Object.values(res.ant.porCloser).map((x) => x.cierres))
                  return (
                    <div key={k} className="space-y-0.5">
                      <div className="flex justify-between text-zinc-300"><span>{k}</span><span className="font-mono text-[10px] text-zinc-500">{a.cierres}/{a.shows} · antes {b.cierres}/{b.shows}</span></div>
                      <Barra v={a.cierres} max={max} cls="bg-emerald-400" label={`${mesLabel(mA)}: ${a.cierres} cierres de ${a.shows} shows`} />
                      <Barra v={b.cierres} max={max} cls="bg-zinc-500" label={`${mesLabel(mB)}: ${b.cierres} cierres de ${b.shows} shows`} />
                    </div>
                  )
                })}
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Por qué no cerraron</div>
                {Object.entries(res.act.frenos).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                  const b = res.ant.frenos[k] || 0
                  const max = Math.max(1, ...Object.values(res.act.frenos), ...Object.values(res.ant.frenos))
                  return (
                    <div key={k} className="space-y-0.5">
                      <div className="flex justify-between text-zinc-300"><span>{k}</span><span className="font-mono text-[10px] text-zinc-500">antes {b}</span></div>
                      <Barra v={v} max={max} cls="bg-red-400" label={`${mesLabel(mA)}: ${v}`} />
                      <Barra v={b} max={max} cls="bg-zinc-500" label={`${mesLabel(mB)}: ${b}`} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recorrido */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Cómo se cierra y cómo se pierde</div>
              <div className="flex flex-wrap items-center gap-1 rounded bg-emerald-500/10 p-2 font-sans text-[11px] text-emerald-200">
                {["Aislar la objeción", "Preguntar cuánto tiene", "Cobrar la entrada en la llamada", "Saldo con fecha"].map((s, i, arr) => (
                  <span key={s} className="flex items-center gap-1"><span className="rounded border border-emerald-500/30 bg-zinc-950 px-1.5 py-0.5">{s}</span>{i < arr.length - 1 && "→"}</span>
                ))}
                <span className="font-bold">= venta</span>
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded bg-red-500/10 p-2 font-sans text-[11px] text-red-200">
                {["Pitch largo sin triaje", "Aparece la plata", "\"Cuando tengas me hablás\"", "Seguimiento sin fecha"].map((s, i, arr) => (
                  <span key={s} className="flex items-center gap-1"><span className="rounded border border-red-500/30 bg-zinc-950 px-1.5 py-0.5">{s}</span>{i < arr.length - 1 && "→"}</span>
                ))}
                <span className="font-bold">= USD 0</span>
              </div>
            </div>

            {/* Lista lead por lead */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {([["no_cierres", `No cierres (${res.act.noCierres.length})`], ["cierres", `Cierres (${res.act.cierres.length})`]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
                    className={cn("rounded-full border px-3 py-1 font-sans text-[11px] font-semibold",
                      tab === k ? "border-emerald-400 bg-emerald-400 text-zinc-950" : "border-white/10 text-zinc-300 hover:bg-white/5")}>{l}</button>
                ))}
                <Input placeholder="Filtrar por nombre, closer o freno…" value={filtro} onChange={(e) => setFiltro(e.target.value)}
                  className="h-7 min-w-0 flex-1 border-white/10 bg-zinc-900 text-xs text-white placeholder:text-zinc-500" />
              </div>
              <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                {lista.length === 0 && <div className="py-4 text-center text-zinc-500">No hay leads en esta lista.</div>}
                {lista.map((c) => {
                  const id = String(c.agenda_id || c.nombre)
                  const open = abierto === id
                  const f = c.fathom_lead
                  return (
                    <div key={id} className={cn("rounded border bg-zinc-900/50", tab === "cierres" ? "border-emerald-500/20" : "border-white/10")}>
                      <button type="button" onClick={() => setAbierto(open ? null : id)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-sans text-[12.5px] font-semibold text-white">{c.nombre}</div>
                          <div className="text-[10.5px] text-zinc-500">{c.fecha?.slice(8, 10)}/{c.fecha?.slice(5, 7)} · {c.closer} · Lead {grado(c)}</div>
                        </div>
                        {tab === "cierres"
                          ? <span className="font-mono text-[11px] text-emerald-300">{usd(c.cash_d1)}</span>
                          : <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">{freno(c)}</span>}
                        {open ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
                      </button>
                      {open && (
                        <div className="space-y-1.5 border-t border-white/10 px-2.5 py-2 font-sans text-[12px] leading-snug">
                          {[["Situación", f?.situacion_actual], ["Quiere", f?.situacion_deseada], ["Dolor", f?.dolor_problema], ["Objeción", f?.objecion],
                            [tab === "cierres" ? "Por qué cerró" : "Por qué no cerró", tab === "cierres" ? f?.motivo_cierre : f?.porque_no_cerro],
                            ["Plata declarada", c.ingresos_declarados], ["Resultado", c.resultado]]
                            .filter(([, v]) => v && !/^no (registrada|especificada|detectado)|^N\/A/i.test(String(v)))
                            .map(([k, v]) => <div key={k as string}><span className="text-zinc-500">{k}: </span><span className="text-zinc-200">{v}</span></div>)}
                          <div className="flex gap-2 pt-1">
                            {c.link_fathom && (
                              <a href={c.link_fathom} target="_blank" rel="noopener noreferrer"
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 text-[11px] text-purple-300 hover:bg-purple-500/20">
                                <ExternalLink className="h-3 w-3" />Fathom
                              </a>
                            )}
                            {onAbrirFicha && (
                              <Button type="button" variant="outline" size="sm" onClick={() => onAbrirFicha(c)} className="h-7 border-white/10 text-[11px] text-zinc-300">
                                <Pencil className="mr-1 h-3 w-3" />Ficha
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="font-sans text-[10.5px] text-zinc-500">
                Cierre = venta a lead nuevo con USD {TICKET_MINIMO} o más cobrados en el mes; no cuentan fees, cuotas sueltas ni ventas internas.
                Calificación = Lead Score del CRM. El freno sale del motivo de no cierre y del análisis de Fathom.
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
