"use client"

// Globo del asistente: círculo con el logo de EXPOSURE abajo a la derecha, en todas las pantallas del CRM.
// Al pasar el mouse se agranda; al tocarlo abre un chat que responde con el dato exacto y su fundamento
// (/api/asistente/globo: métricas de la regla única + datos del CRM) y ofrece botones para ir a la
// pantalla justa. La conversación queda en la pestaña (sessionStorage) mientras no se cierre el navegador.

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowRight, Loader2, MessageCircle, Send, Trash2, X } from "lucide-react"
import { LogoExposureMark } from "@/components/logo-exposure"
import { cn } from "@/lib/utils"

type Turno = { rol: "yo" | "bot"; texto: string; destinos?: Array<{ url: string; motivo: string }>; error?: boolean }
const CLAVE = "exposure-globo-chat"
const SUGERENCIAS = [
  "¿Cuántos cierres llevamos este mes y cuál es la tasa de cierre?",
  "¿Cuánto cash collected llevamos y cuánto falta para la meta?",
  "¿Cómo viene cada closer esta semana?",
  "Llevame a las agendas incompletas",
]

export function AsistenteGlobo() {
  const [abierto, setAbierto] = useState(false)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [texto, setTexto] = useState("")
  const [pensando, setPensando] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const fin = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { try { const g = sessionStorage.getItem(CLAVE); if (g) setTurnos(JSON.parse(g)) } catch { /* sin almacenamiento */ } }, [])
  useEffect(() => { try { sessionStorage.setItem(CLAVE, JSON.stringify(turnos.slice(-30))) } catch { /* sin almacenamiento */ } }, [turnos])
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }) }, [turnos, pensando, abierto])
  useEffect(() => { if (abierto) setTimeout(() => entrada.current?.focus(), 50) }, [abierto])
  useEffect(() => {
    if (!abierto) return
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false) }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [abierto])

  async function preguntar(q: string) {
    const pregunta = q.trim()
    if (!pregunta || pensando) return
    const previos = turnos
    setTurnos((t) => [...t, { rol: "yo", texto: pregunta }])
    setTexto("")
    setPensando(true)
    try {
      const r = await fetch("/api/asistente/globo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: pregunta, pantalla: pathname, historial: previos.slice(-6).map((t) => ({ rol: t.rol, texto: t.texto })) }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "No pude responder")
      setTurnos((t) => [...t, { rol: "bot", texto: j.respuesta || "No encontré una respuesta.", destinos: j.destinos || [] }])
    } catch (e) {
      setTurnos((t) => [...t, { rol: "bot", texto: `No pude responder: ${(e as Error).message}. Probá de nuevo o con un período más concreto.`, error: true }])
    } finally {
      setPensando(false)
    }
  }

  return <>
    {/* Botón: círculo con el logo y un globito de texto */}
    {!abierto && (
      <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir el asistente de EXPOSURE"
        className="group fixed z-[60] grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-zinc-950 text-white shadow-xl shadow-black/40 transition-transform duration-200 ease-out hover:scale-110 focus-visible:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 motion-reduce:transition-none motion-reduce:hover:scale-100"
        style={{ right: "max(20px, env(safe-area-inset-right, 0px))", bottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}>
        <LogoExposureMark size={30} color="#ffffff" title="EXPOSURE" />
        <span aria-hidden className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-zinc-950 bg-emerald-400 text-zinc-950 shadow">
          <MessageCircle className="h-3.5 w-3.5" />
        </span>
        <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Preguntale al CRM
        </span>
      </button>
    )}

    {/* Panel del chat */}
    {abierto && (
      <section role="dialog" aria-label="Asistente de EXPOSURE"
        className="fixed z-[60] flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/50"
        style={{ right: "max(12px, env(safe-area-inset-right, 0px))", bottom: "max(12px, env(safe-area-inset-bottom, 0px))", height: "min(620px, calc(100vh - 24px))" }}>
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><LogoExposureMark size={22} color="#ffffff" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Asistente EXPOSURE</p>
            <p className="text-[11px] text-zinc-400">Datos reales del CRM, con el dato y de dónde sale</p>
          </div>
          {turnos.length > 0 && <button type="button" onClick={() => setTurnos([])} aria-label="Borrar la conversación" title="Borrar la conversación" className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><Trash2 className="h-4 w-4" /></button>}
          <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar el asistente" className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
          {turnos.length === 0 && <div className="space-y-3">
            <p className="text-zinc-300">Preguntame cualquier cosa del negocio: una cifra, una métrica, un lead o a qué pantalla ir. Te contesto con el número exacto y de dónde sale.</p>
            <div className="flex flex-col gap-2">
              {SUGERENCIAS.map((s) => <button key={s} type="button" onClick={() => preguntar(s)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-zinc-200 hover:border-emerald-400/40 hover:bg-emerald-400/5">{s}</button>)}
            </div>
          </div>}
          {turnos.map((t, i) => (
            <div key={i} className={cn("flex", t.rol === "yo" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 leading-relaxed",
                t.rol === "yo" ? "rounded-br-sm bg-emerald-500 text-zinc-950" : t.error ? "rounded-bl-sm border border-red-500/30 bg-red-500/10 text-red-200" : "rounded-bl-sm bg-white/[0.06] text-zinc-100")}>
                {t.texto}
                {!!t.destinos?.length && <div className="mt-2 flex flex-col gap-1.5">
                  {t.destinos.map((d) => <button key={d.url} type="button" onClick={() => router.push(d.url)}
                    className="inline-flex items-center justify-between gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-left text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20">
                    <span>{d.motivo}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>)}
                </div>}
              </div>
            </div>
          ))}
          {pensando && <div className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Buscando en el CRM…</div>}
          <div ref={fin} />
        </div>

        <form className="flex items-end gap-2 border-t border-white/10 p-3" onSubmit={(e) => { e.preventDefault(); void preguntar(texto) }}>
          <label htmlFor="globo-pregunta" className="sr-only">Pregunta para el asistente</label>
          <textarea id="globo-pregunta" ref={entrada} rows={1} value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void preguntar(texto) } }}
            placeholder="Ej.: ¿cuántos no shows tuvo Cristian ayer?"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-400/50 focus:outline-none" />
          <button type="submit" disabled={!texto.trim() || pensando} aria-label="Enviar pregunta"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-zinc-950 transition-opacity disabled:opacity-40">
            {pensando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </section>
    )}
  </>
}
