"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Loader2, Sparkles, MessageCircle } from "lucide-react"

type Chat = { chat_id: string; chat_name: string | null; mensajes: number; ultimo: string; is_group: boolean }
type Mensaje = { sender: string | null; sender_name: string | null; text: string | null; media_type: string | null; from_me: boolean; sent_at: string }

const fetcher = (url: string) => fetch(url).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "No se pudo cargar"); return b })
const iso = (d: Date) => d.toISOString().slice(0, 10)
const fh = (s: string) => { const d = new Date(s); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }

export default function WhatsappPage() {
  const [chat, setChat] = useState<string | null>(null)
  const [desde, setDesde] = useState(iso(new Date(Date.now() - 7 * 86400000)))
  const [hasta, setHasta] = useState(iso(new Date()))
  const [pregunta, setPregunta] = useState("")
  const [resumen, setResumen] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: chats, error: eChats } = useSWR<{ chats: Chat[]; total: number }>("/api/whatsapp", fetcher, { refreshInterval: 60000 })
  const rango = `desde=${desde}T00:00:00&hasta=${hasta}T23:59:59`
  const { data: msgs, isLoading } = useSWR<{ mensajes: Mensaje[] }>(chat ? `/api/whatsapp?chat=${encodeURIComponent(chat)}&${rango}` : null, fetcher)
  const actual = chats?.chats.find((c) => c.chat_id === chat)

  async function resumir() {
    if (!chat) return
    setCargando(true); setError(null); setResumen(null)
    try {
      const r = await fetch("/api/whatsapp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat, desde: `${desde}T00:00:00`, hasta: `${hasta}T23:59:59`, pregunta }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "No se pudo resumir")
      setResumen(j.resumen)
    } catch (e) { setError((e as Error).message) } finally { setCargando(false) }
  }

  return <div className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-5 sm:px-6 lg:px-[1.5cm]">
    <div>
      <h1 className="text-2xl font-black">WhatsApp del equipo</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Los grupos donde está el número del bot. Elegí un grupo y un rango, leé los mensajes o pedí un resumen con IA (qué pasó, leads mencionados, pendientes, alertas).</p>
    </div>
    {eChats && <p className="text-sm text-red-300">{String(eChats.message || eChats)}</p>}
    {chats && !chats.chats.length && <Card className="border-amber-400/30 bg-amber-400/10"><CardContent className="space-y-2 py-5 text-sm">
      <p className="font-semibold text-amber-100">Todavía no llegó ningún mensaje.</p>
      <p className="text-amber-100/80">El bot corre en la computadora de Alex: <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">node scripts/whatsapp/bot.mjs</code> dentro de <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">EXPOSURE\Central Negocio</code>. La primera vez muestra un QR para vincular el número; después, cada mensaje de los grupos donde está ese número llega acá solo.</p>
    </CardContent></Card>}
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-white/10 bg-white/[.035] lg:self-start">
        <CardHeader className="pb-2"><CardTitle className="text-base">Grupos</CardTitle><p className="text-xs text-muted-foreground">{chats ? `${chats.chats.length} chats` : "Cargando…"}</p></CardHeader>
        <CardContent className="space-y-1 pt-2">
          {chats?.chats.map((c) => <button key={c.chat_id} type="button" onClick={() => { setChat(c.chat_id); setResumen(null) }} className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/[.06]", chat === c.chat_id && "bg-white/[.09]")}>
            <span className="min-w-0 truncate"><MessageCircle className="mr-2 inline h-3.5 w-3.5 text-emerald-300" />{c.chat_name || c.chat_id}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{c.mensajes}</span>
          </button>)}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card className="border-white/10 bg-white/[.035]">
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <label className="text-xs font-semibold text-muted-foreground">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 block rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-foreground" /></label>
            <label className="text-xs font-semibold text-muted-foreground">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 block rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-foreground" /></label>
            <label className="min-w-[260px] flex-1 text-xs font-semibold text-muted-foreground">Pregunta puntual (opcional)<input value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="ej. ¿qué objeciones aparecieron esta semana?" className="mt-1 block w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-foreground" /></label>
            <Button onClick={resumir} disabled={!chat || cargando}>{cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Resumir con IA</Button>
          </CardContent>
        </Card>
        {error && <p className="text-sm text-red-300">{error}</p>}
        {resumen && <Card className="border-emerald-500/20 bg-emerald-500/[.04]"><CardHeader className="pb-2"><CardTitle className="text-base">Resumen · {actual?.chat_name || chat}</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm leading-relaxed">{resumen}</CardContent></Card>}
        <Card className="border-white/10 bg-white/[.035]">
          <CardHeader className="pb-2"><CardTitle className="text-base">{actual ? actual.chat_name || chat : "Mensajes"}</CardTitle><p className="text-xs text-muted-foreground">{msgs ? `${msgs.mensajes.length} mensajes en el rango` : chat ? "Cargando…" : "Elegí un grupo"}</p></CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto pt-2">
            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {msgs?.mensajes.map((m, i) => <div key={i} className={cn("rounded-lg px-3 py-2 text-sm", m.from_me ? "bg-emerald-500/10" : "bg-white/[.04]")}>
              <p className="text-[11px] text-muted-foreground"><b className="text-foreground/80">{m.sender_name || m.sender || "?"}</b> · {fh(m.sent_at)}</p>
              <p className="whitespace-pre-wrap">{m.text || (m.media_type ? <i className="text-muted-foreground">[{m.media_type}]</i> : "")}</p>
            </div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
}
