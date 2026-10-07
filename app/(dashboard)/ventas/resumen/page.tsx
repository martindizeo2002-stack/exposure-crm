"use client"

import { useState, useEffect } from "react"
import {
  Calendar as CalendarIcon,
  PhoneCall,
  CheckCircle2,
  Copy,
  Check,
  TrendingUp,
  AlertCircle,
  FileText,
  DollarSign,
  Users,
  ChevronDown,
  ChevronUp,
  Eye,
  History,
  RefreshCw,
  Award,
  Pencil,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CLOSERS_ACTIVOS } from "@/lib/equipo"
import { LeadDetailDialog } from "@/components/lead-detail-dialog"
import type { Agenda } from "@/lib/supabase"
import type { ResumenPayload, CallDetalle } from "@/lib/closing-whatsapp-formatter"
import { cn } from "@/lib/utils"


const MOTIVOS_NO_CIERRE_CRM = [
  "Le parecia caro",
  "No llego al PIF",
  "No llegaba a la Cuota 1",
  "Lo tenia que pensar",
  "Desconfianza",
  "Miedo",
  "Metodo de pago",
  "No Califica",
  "Era desempleado"
]

function hoyIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function ResumenVentasPage() {
  const [periodo, setPeriodo] = useState<"dia" | "semana" | "mes">("dia")
  const [fecha, setFecha] = useState<string>(hoyIso())
  const [closer, setCloser] = useState<string>("todos")
  const [modo, setModo] = useState<"detallado" | "corto">("detallado")

  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // Estado para la ficha del lead (mismo LeadDetailDialog de Agendas / Pipeline)
  const [agendaEditando, setAgendaEditando] = useState<Agenda | null>(null)
  const [cargandoAgendaId, setCargandoAgendaId] = useState<string | number | null>(null)

  const abrirEdicionLead = async (c: CallDetalle) => {
    if (!c.agenda_id) {
      toast.error("No se encontró el ID de la agenda para editar")
      return
    }
    setCargandoAgendaId(c.agenda_id)
    try {
      const res = await fetch(`/api/agendas?id=${c.agenda_id}`)
      const data = await res.json()
      if (!res.ok || !data) throw new Error(data?.error || "Error al consultar la agenda")
      setAgendaEditando(data)
    } catch (err: any) {
      toast.error(err.message || "Error al abrir la ficha del lead")
    } finally {
      setCargandoAgendaId(null)
    }
  }


  const [datos, setDatos] = useState<ResumenPayload | null>(null)
  const [textoWhatsapp, setTextoWhatsapp] = useState<string>("")
  const [filtroResultado, setFiltroResultado] = useState<string>("todos")
  const [callExpandida, setCallExpandida] = useState<number | string | null>(null)

  // Histórico
  const [tabActiva, setTabActiva] = useState<"generador" | "historico">("generador")
  const [historico, setHistorico] = useState<Array<any>>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Cargar datos
  const cargarResumen = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        periodo,
        fecha,
        closer,
        modo,
      })

      const res = await fetch(`/api/ventas/resumen?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Error al cargar resumen comercial")
      }

      setDatos(json.datos)
      setTextoWhatsapp(json.texto_whatsapp)
    } catch (err: any) {
      toast.error(err.message || "Error al generar resumen")
    } finally {
      setLoading(false)
    }
  }

  // Cargar lista de reportes históricos
  const cargarHistorico = async () => {
    try {
      setLoadingHistorico(true)
      const res = await fetch("/api/ventas/resumen?historico=1&limite=30")
      const json = await res.json()
      if (res.ok && json.ok) {
        setHistorico(json.reportes || [])
      }
    } catch (err: any) {
      toast.error("Error al cargar historial de cierres")
    } finally {
      setLoadingHistorico(false)
    }
  }

  useEffect(() => {
    cargarResumen()
  }, [periodo, fecha, closer, modo])

  useEffect(() => {
    if (tabActiva === "historico") {
      cargarHistorico()
    }
  }, [tabActiva])

  const copiarWhatsApp = () => {
    if (!textoWhatsapp) return
    navigator.clipboard.writeText(textoWhatsapp)
    setCopiado(true)
    toast.success("¡Resumen de WhatsApp copiado al portapapeles!")
    setTimeout(() => setCopiado(false), 2500)
  }

  const guardarReporteHistorico = async () => {
    if (!datos) return
    try {
      setGuardando(true)
      const res = await fetch("/api/ventas/resumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "guardar",
          periodo,
          fecha_desde: datos.fecha_desde,
          fecha_hasta: datos.fecha_hasta,
          closer,
          datos,
          texto_whatsapp: textoWhatsapp,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo guardar")

      toast.success("Resumen guardado exitosamente en el historial del CRM")
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el reporte")
    } finally {
      setGuardando(false)
    }
  }

  const verReporteGuardado = (rep: any) => {
    if (!rep.metadata) return
    setDatos(rep.metadata)
    setTextoWhatsapp(rep.metadata.texto_whatsapp || "")
    setTabActiva("generador")
    toast.info(`Viendo reporte histórico: ${rep.name}`)
  }

  const metricas = datos?.metricas
  const arq = datos?.arquetipos
  const calls = datos?.calls || []

  const callsFiltradas = calls.filter((c) => {
    if (filtroResultado === "todos") return true
    if (filtroResultado === "cierres") return c.resultado === "CIERRE" || c.resultado === "FEE"
    if (filtroResultado === "calificados") return c.es_calificado
    if (filtroResultado === "no_cierres") return c.resultado === "NO CIERRE"
    if (filtroResultado === "no_shows") return c.resultado === "NO SHOW" || c.resultado === "CANCELADA"
    return true
  })

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Resumen de Ventas</h1>
              <p className="text-sm text-muted-foreground">
                Reporte operativo de closing basado exclusivamente en datos reales de Exposure OS.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copiarWhatsApp}
            disabled={!textoWhatsapp || loading}
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copiado ? "Copiado!" : "Copiar para WhatsApp"}
          </Button>
          <Button
            size="sm"
            onClick={guardarReporteHistorico}
            disabled={!datos || loading || guardando}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            {guardando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
            Guardar en Histórico
          </Button>
        </div>
      </div>

      {/* Tabs Generador / Histórico */}
      <Tabs value={tabActiva} onValueChange={(v: any) => setTabActiva(v)} className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <TabsList className="bg-zinc-900/80">
            <TabsTrigger value="generador" className="data-[state=active]:bg-zinc-800">
              <Eye className="mr-2 h-4 w-4" /> Generador de Resumen
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-zinc-800">
              <History className="mr-2 h-4 w-4" /> Historial de Cierres
            </TabsTrigger>
          </TabsList>

          {tabActiva === "generador" && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={cargarResumen}
                disabled={loading}
                className="h-8 text-xs text-muted-foreground hover:text-white"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
                Actualizar datos
              </Button>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* TAB 1: GENERADOR OPERATIVO */}
        {/* ============================================================== */}
        <TabsContent value="generador" className="space-y-6">
          {/* Barra de Filtros */}
          <Card className="border-white/10 bg-zinc-900/50 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
              {/* Selector de Período */}
              <div>
                <label className="text-xs font-medium text-zinc-400">Período</label>
                <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
                  <SelectTrigger className="mt-1 bg-zinc-900 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Día (Diario)</SelectItem>
                    <SelectItem value="semana">Semana (Weekly)</SelectItem>
                    <SelectItem value="mes">Mes (Monthly)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de Fecha */}
              <div>
                <label className="text-xs font-medium text-zinc-400">
                  {periodo === "dia" ? "Fecha del día" : periodo === "semana" ? "Semana de" : "Mes de"}
                </label>
                <input
                  type={periodo === "mes" ? "month" : "date"}
                  value={periodo === "mes" ? fecha.slice(0, 7) : fecha}
                  onChange={(e) => setFecha(e.target.value ? (periodo === "mes" ? `${e.target.value}-01` : e.target.value) : hoyIso())}
                  className="mt-1 flex h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Selector de Closer */}
              <div>
                <label className="text-xs font-medium text-zinc-400">Closer</label>
                <Select value={closer} onValueChange={setCloser}>
                  <SelectTrigger className="mt-1 bg-zinc-900 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los closers</SelectItem>
                    {CLOSERS_ACTIVOS.map((c) => (
                      <SelectItem key={c} value={c.toLowerCase()}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de Modo */}
              <div>
                <label className="text-xs font-medium text-zinc-400">Detalle WhatsApp</label>
                <Select value={modo} onValueChange={(v: any) => setModo(v)}>
                  <SelectTrigger className="mt-1 bg-zinc-900 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detallado">Detallado (call por call)</SelectItem>
                    <SelectItem value="corto">Ejecutivo (sólo métricas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botón de Copiado Rápido */}
              <div className="flex items-end">
                <Button
                  onClick={copiarWhatsApp}
                  disabled={!textoWhatsapp || loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copiado ? "Copiado!" : "Copiar WhatsApp"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Scorecards Principales */}
          {metricas && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {/* Calls Programadas */}
              <Card className="border-white/10 bg-zinc-900/40 p-4">
                <span className="text-xs font-medium text-muted-foreground">Programadas</span>
                <div className="mt-2 text-2xl font-black text-white">{metricas.programadas}</div>
                <span className="text-[11px] text-zinc-400">
                  {metricas.calificadas_programadas} calificadas
                </span>
              </Card>

              {/* Presentadas (Show Rate) */}
              <Card className="border-white/10 bg-zinc-900/40 p-4">
                <span className="text-xs font-medium text-muted-foreground">Presentadas</span>
                <div className="mt-2 text-2xl font-black text-white">{metricas.presentadas}</div>
                <span className="text-[11px] text-emerald-400">
                  {metricas.show_rate_pct.toFixed(1).replace(".", ",")} % show rate
                </span>
              </Card>

              {/* Calificadas Presentadas */}
              <Card className="border-white/10 bg-zinc-900/40 p-4">
                <span className="text-xs font-medium text-muted-foreground">Calif. Presentadas</span>
                <div className="mt-2 text-2xl font-black text-blue-400">{metricas.calificadas_presentadas}</div>
                <span className="text-[11px] text-zinc-400">
                  {metricas.show_rate_calificados_pct.toFixed(1).replace(".", ",")} % show calif
                </span>
              </Card>

              {/* Cierres & TC */}
              <Card className="border-emerald-500/20 bg-emerald-500/5 p-4">
                <span className="text-xs font-medium text-emerald-400">Cierres</span>
                <div className="mt-2 text-2xl font-black text-emerald-400">{metricas.cierres}</div>
                <span className="text-[11px] text-emerald-300">
                  {metricas.tc_calificadas_pct.toFixed(1).replace(".", ",")} % s/calif
                </span>
              </Card>

              {/* Cash D1 */}
              <Card className="border-emerald-500/20 bg-emerald-500/5 p-4">
                <span className="text-xs font-medium text-emerald-400">Cash D1</span>
                <div className="mt-2 text-2xl font-black text-emerald-400">
                  ${metricas.cash_d1.toLocaleString("es-AR")}
                </div>
                <span className="text-[11px] text-muted-foreground">USD directo</span>
              </Card>

              {/* Ticket Contratado */}
              <Card className="border-white/10 bg-zinc-900/40 p-4">
                <span className="text-xs font-medium text-muted-foreground">Ticket Contratado</span>
                <div className="mt-2 text-2xl font-black text-white">
                  ${metricas.ticket_total.toLocaleString("es-AR")}
                </div>
                <span className="text-[11px] text-zinc-400">USD total</span>
              </Card>
            </div>
          )}

          {/* Distribución por Arquetipos (4 Bloques: Dueño, Empleado, Estudiante, Sin Clasificar) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {/* Dueño de Negocio */}
            <Card className="border-emerald-500/20 bg-emerald-500/[0.03] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Dueño de Negocio</span>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">Macro</Badge>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black">{arq?.dueno_negocio.total || 0}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">calls</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-400">{arq?.dueno_negocio.cierres || 0} cierres</span>
                  <span className="block text-[11px] text-muted-foreground">${arq?.dueno_negocio.cash_d1 || 0} USD</span>
                </div>
              </div>
            </Card>

            {/* Empleado 9-5 */}
            <Card className="border-blue-500/20 bg-blue-500/[0.03] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Empleado (9 a 5)</span>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[10px]">Macro</Badge>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black">{arq?.empleado.total || 0}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">calls</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-400">{arq?.empleado.cierres || 0} cierres</span>
                  <span className="block text-[11px] text-muted-foreground">${arq?.empleado.cash_d1 || 0} USD</span>
                </div>
              </div>
            </Card>

            {/* Estudiante */}
            <Card className="border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Estudiante</span>
                <Badge variant="outline" className="border-white/10 text-muted-foreground text-[10px]">Macro</Badge>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black">{arq?.estudiante.total || 0}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">calls</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-zinc-300">{arq?.estudiante.cierres || 0} cierres</span>
                  <span className="block text-[11px] text-muted-foreground">${arq?.estudiante.cash_d1 || 0} USD</span>
                </div>
              </div>
            </Card>

            {/* Sin Clasificar */}
            <Card className="border-amber-500/20 bg-amber-500/[0.03] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Sin Clasificar</span>
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">Pendiente</Badge>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-amber-300">{arq?.sin_clasificar.total || 0}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">calls</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-amber-400">{arq?.sin_clasificar.cierres || 0} cierres</span>
                  <span className="block text-[11px] text-muted-foreground">${arq?.sin_clasificar.cash_d1 || 0} USD</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Split 2 Columnas: Detalle de Llamadas & Vista Previa WhatsApp */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Columna Izquierda: Detalle de Llamadas (7 Cols) */}
            <div className="space-y-4 lg:col-span-7">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Llamadas del período ({callsFiltradas.length})
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant={filtroResultado === "todos" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFiltroResultado("todos")}
                  >
                    Todas
                  </Button>
                  <Button
                    variant={filtroResultado === "cierres" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs text-emerald-400"
                    onClick={() => setFiltroResultado("cierres")}
                  >
                    Cierres
                  </Button>
                  <Button
                    variant={filtroResultado === "calificados" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs text-blue-400"
                    onClick={() => setFiltroResultado("calificados")}
                  >
                    Calificadas
                  </Button>
                  <Button
                    variant={filtroResultado === "no_cierres" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs text-zinc-400"
                    onClick={() => setFiltroResultado("no_cierres")}
                  >
                    No cierres
                  </Button>
                  <Button
                    variant={filtroResultado === "no_shows" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs text-rose-400"
                    onClick={() => setFiltroResultado("no_shows")}
                  >
                    No Shows
                  </Button>
                </div>
              </div>

              {callsFiltradas.length === 0 ? (
                <Card className="border-white/10 bg-zinc-900/30 p-8 text-center text-muted-foreground">
                  No se encontraron llamadas para los filtros seleccionados.
                </Card>
              ) : (
                <div className="space-y-2">
                  {callsFiltradas.map((c) => {
                    const expandida = callExpandida === c.agenda_id
                    const esCierre = c.resultado === "CIERRE"
                    const esFee = c.resultado === "FEE"
                    const esNS = c.resultado === "NO SHOW" || c.resultado === "CANCELADA"

                    return (
                      <Card
                        key={c.agenda_id || c.nombre}
                        className={cn(
                          "border-white/10 bg-zinc-900/40 transition-colors",
                          esCierre && "border-emerald-500/30 bg-emerald-500/[0.02]",
                          expandida && "border-white/20"
                        )}
                      >
                        <div className="p-3.5">
                          <div
                            className="flex cursor-pointer items-center justify-between"
                            onClick={() => setCallExpandida(expandida ? null : c.agenda_id || c.nombre)}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white text-sm">{c.nombre}</span>
                              {c.hora && <span className="text-xs text-muted-foreground">({c.hora})</span>}
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  esCierre && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                                  esFee && "border-blue-500/40 bg-blue-500/10 text-blue-400",
                                  esNS && "border-rose-500/40 bg-rose-500/10 text-rose-400",
                                  !esCierre && !esFee && !esNS && "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                )}
                              >
                                {c.resultado}
                              </Badge>

                              {/* Botón visible de edición en la cabecera cerca de nombre / estado */}
                              <Button
                                type="button"
                                size="sm"
                                className="h-6 px-2.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  abrirEdicionLead(c)
                                }}
                              >
                                {cargandoAgendaId === c.agenda_id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Pencil className="mr-1 h-3 w-3" />}
                                Editar lead
                              </Button>

                              {/* Lead Score */}
                              <Badge variant="secondary" className="text-[10px]">
                                {c.lead_score}
                              </Badge>
                              {/* Calificada / No Calificada */}
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  c.es_calificado
                                    ? "border-blue-500/30 text-blue-400"
                                    : "border-zinc-700 text-zinc-400"
                                )}
                              >
                                {c.es_calificado ? "Calificada" : "No calificada"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs shrink-0">
                              {esCierre && (
                                <span className="font-black text-emerald-400">${c.cash_d1} USD D1</span>
                              )}
                              {expandida ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                            </div>
                          </div>

                          {/* Fila secundaria: Macro Arquetipo y Subarquetipo leídos del CRM */}
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            <span className="font-medium text-zinc-300">Macro: {c.arquetipo_macro}</span>
                            {c.subarquetipo && <span> · Sub: {c.subarquetipo}</span>}
                            {c.ingresos_declarados && <span> · {c.ingresos_declarados}</span>}
                            {c.calificaba_realmente && (
                              <span className="text-blue-300 font-medium"> · Real: {c.calificaba_realmente}</span>
                            )}
                          </p>

                          {/* Detalle Expandido */}
                          {expandida && (
                            <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs">
                              <div className="flex items-center justify-between pb-1">
                                <span className="font-bold text-zinc-400 text-[11px] uppercase tracking-wider">Detalle de la agenda</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-6 px-2.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    abrirEdicionLead(c)
                                  }}
                                >
                                  <Pencil className="mr-1 h-3 w-3" />
                                  Editar lead
                                </Button>
                              </div>
                              {/* Grid de Atribución Separada de ESA Agenda */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded bg-zinc-950/60 p-2.5 border border-white/5">
                                <div>
                                  <span className="font-semibold text-zinc-400 block text-[11px]">Origen</span>
                                  <span className="text-zinc-200">{c.origen || "—"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-zinc-400 block text-[11px]">Pieza de entrada</span>
                                  <span className="text-zinc-200">{c.pieza_entrada || "—"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-zinc-400 block text-[11px]">Keyword</span>
                                  <span className="text-zinc-200">{c.keyword || "—"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-zinc-400 block text-[11px]">Ángulo de adquisición</span>
                                  <span className="text-zinc-200">{c.angulo_adquisicion || "—"}</span>
                                </div>
                              </div>

                              {c.porque_agendo && (
                                <div>
                                  <span className="font-semibold text-zinc-400">Por qué agendó: </span>
                                  <span>{c.porque_agendo}</span>
                                </div>
                              )}
                              {c.objecion_principal && (
                                <div>
                                  <span className="font-semibold text-amber-400/90">Objeción: </span>
                                  <span>{c.objecion_principal}</span>
                                </div>
                              )}
                              {c.motivo_real && (
                                <div>
                                  <span className="font-semibold text-zinc-400">
                                    {esCierre ? "Qué lo hizo cerrar: " : "Motivo no cierre: "}
                                  </span>
                                  <span>{c.motivo_real}</span>
                                </div>
                              )}
                              {c.siguiente_paso && (
                                <div>
                                  <span className="font-semibold text-zinc-400">Siguiente paso: </span>
                                  <span>{c.siguiente_paso}</span>
                                </div>
                              )}
                              {c.fathom?.dolor_principal && (
                                <div>
                                  <span className="font-semibold text-purple-400">Fathom · Dolor: </span>
                                  <span>{c.fathom.dolor_principal}</span>
                                </div>
                              )}
                              {c.fathom?.deseo_principal && (
                                <div>
                                  <span className="font-semibold text-purple-400">Fathom · Deseo: </span>
                                  <span>{c.fathom.deseo_principal}</span>
                                </div>
                              )}
                              {c.fathom?.mencion_alex && (
                                <div>
                                  <span className="font-semibold text-purple-400">Fathom · Mención Alex: </span>
                                  <span>{c.fathom.mencion_alex}</span>
                                </div>
                              )}
                              {c.fathom?.contenido_recuerda && (
                                <div>
                                  <span className="font-semibold text-purple-400">Fathom · Contenido recordado: </span>
                                  <span>{c.fathom.contenido_recuerda}</span>
                                </div>
                              )}
                              {c.fathom?.insight_mensaje && (
                                <div className="rounded bg-purple-500/10 p-2 text-purple-300">
                                  <span className="font-bold">Insight Fathom: </span>
                                  <span>"{c.fathom.insight_mensaje}"</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Columna Derecha: Preview de WhatsApp y Copiado (5 Cols) */}
            <div className="space-y-4 lg:col-span-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                  Preview para WhatsApp
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copiarWhatsApp}
                  disabled={!textoWhatsapp || loading}
                  className="h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
                >
                  {copiado ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copiado ? "Copiado!" : "Copiar"}
                </Button>
              </div>

              <Card className="border-white/10 bg-zinc-950 p-4 font-mono text-xs">
                <textarea
                  readOnly
                  value={textoWhatsapp}
                  rows={26}
                  className="w-full resize-none bg-transparent font-mono text-xs text-zinc-200 outline-none"
                />
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: HISTÓRICO DE REPORTES GUARDADOS */}
        {/* ============================================================== */}
        <TabsContent value="historico" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Historial de Cierres Guardados ({historico.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={cargarHistorico}
              disabled={loadingHistorico}
              className="text-xs"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loadingHistorico && "animate-spin")} />
              Recargar historial
            </Button>
          </div>

          {historico.length === 0 ? (
            <Card className="border-white/10 bg-zinc-900/30 p-8 text-center text-muted-foreground">
              Aún no hay reportes comerciales guardados en el historial. Podés guardar uno usando el botón
              "Guardar en Histórico".
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {historico.map((rep) => {
                const meta = rep.metadata || {}
                const m = meta.metricas || {}

                return (
                  <Card key={rep.id} className="border-white/10 bg-zinc-900/40 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{rep.name}</h4>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(rep.fecha_guardado).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                        {rep.asset_type.replace("resumen_", "").toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-y border-white/5 py-2 text-center text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Cierres</span>
                        <span className="font-bold text-emerald-400">{m.cierres || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Cash D1</span>
                        <span className="font-bold text-emerald-400">
                          ${(m.cash_d1 || 0).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Presentadas</span>
                        <span className="font-bold text-white">{m.presentadas || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => verReporteGuardado(rep)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Ver en Generador
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Ficha oficial completa del Lead (idéntica a Agendas / Pipeline) */}
      <LeadDetailDialog
        agenda={agendaEditando}
        onClose={() => setAgendaEditando(null)}
        onSaved={async () => {
          setAgendaEditando(null)
          toast.success("Lead actualizado exitosamente en Agendas")
          await cargarResumen()
        }}
      />

    </div>
  )
}
