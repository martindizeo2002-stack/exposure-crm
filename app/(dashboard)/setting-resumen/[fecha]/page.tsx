"use client"

import { use } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react"

// Un reporte de setting ya guardado, visto como dashboard. Es el mismo HTML que se descarga,
// servido por la API detrás del login, así que el enlace se puede guardar y volver cuando sea.
// Las flechas recorren los días que hay en la base, no el calendario: saltan los días sin reporte.

type Guardado = { fecha: string; setter: string }
const fetcher = (url: string) => fetch(url).then((r) => r.json())
const dm = (f: string) => f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(0, 4)

export default function ReporteSettingPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = use(params)
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  const { data } = useSWR<{ dias: Guardado[] }>("/api/setting-resumen?limite=60", fetcher, { revalidateOnFocus: false })
  // La lista viene de más nuevo a más viejo.
  const dias = (data?.dias || []).map((d) => d.fecha)
  const i = dias.indexOf(fecha)
  const masNuevo = i > 0 ? dias[i - 1] : null
  const masViejo = i >= 0 && i < dias.length - 1 ? dias[i + 1] : null
  const setter = data?.dias?.find((d) => d.fecha === fecha)?.setter
  const src = `/api/setting-resumen?fecha=${fecha}&html=1`

  if (!valida) return <div className="p-6 text-sm text-muted-foreground">Fecha inválida.</div>

  return <div className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-[1800px] flex-col gap-3 px-4 py-4 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button asChild size="sm" variant="ghost"><Link href="/setting-resumen"><ArrowLeft className="mr-1.5 h-4 w-4" />Generador</Link></Button>
        <div>
          <h1 className="text-lg font-black leading-tight">Setting del {dm(fecha)}</h1>
          <p className="text-xs text-muted-foreground">{setter ? `Reporte de ${setter}` : "Reporte guardado"} · el mismo dashboard que se descarga</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline" disabled={!masViejo}>
          {masViejo ? <Link href={`/setting-resumen/${masViejo}`}><ChevronLeft className="mr-1 h-4 w-4" />{dm(masViejo).slice(0, 5)}</Link> : <span><ChevronLeft className="mr-1 h-4 w-4" />Anterior</span>}
        </Button>
        <Button asChild size="sm" variant="outline" disabled={!masNuevo}>
          {masNuevo ? <Link href={`/setting-resumen/${masNuevo}`}>{dm(masNuevo).slice(0, 5)}<ChevronRight className="ml-1 h-4 w-4" /></Link> : <span>Siguiente<ChevronRight className="ml-1 h-4 w-4" /></span>}
        </Button>
        <Button asChild size="sm" variant="outline"><a href={src} download={`setting-${fecha}.html`}><Download className="mr-1.5 h-4 w-4" />Descargar</a></Button>
        <Button asChild size="sm"><a href={src} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Abrir en pestaña</a></Button>
      </div>
    </div>
    <iframe title={`Setting del ${fecha}`} src={src} className="min-h-0 w-full flex-1 rounded-xl border border-white/10 bg-[#14110c]" />
  </div>
}
