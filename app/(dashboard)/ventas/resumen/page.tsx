"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { mutate } from "swr"
import { Calendar as CalendarIcon,
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
  Loader2, ArrowUpRight,
  Search,
  X,
  CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CLOSERS_ACTIVOS, SETTERS_TODOS } from "@/lib/equipo"
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

  // Estado para el modal de edición de lead comercial enriquecido
  const [modalLeadAbierto, setModalLeadAbierto] = useState(false)
  const [leadEditando, setLeadEditando] = useState<CallDetalle | null>(null)
  const [cargandoAgendaId, setCargandoAgendaId] = useState<string | number | null>(null)
  const [tabModal, setTabModal] = useState<"comercial" | "contacto" | "llamada" | "contexto">("comercial")
  const agendaOriginalRef = useRef<Agenda | null>(null)
  const [formEdit, setFormEdit] = useState<{
    lead_scoring: string
    macro_arquetipo: string
    subarquetipo: string
    calificaba_realmente: string
    objecion: string
    motivo_no_cierre: string
    siguiente_paso: string
    closer: string
    setter: string
    telefono: string
    email: string
    instagram: string
    fecha_closer: string
    estado: string
    link_fathom: string
    problema_actual: string
    tiempo_problema: string
    intentos_previos: string
    motivo_urgencia: string
    ingresos: string
    inversion: string
  }>({
    lead_scoring: "LEAD D",
    macro_arquetipo: "SIN CLASIFICAR",
    subarquetipo: "",
    calificaba_realmente: "Sin definir",
    objecion: "",
    motivo_no_cierre: "",
    siguiente_paso: "Seguimiento",
    closer: "Cristian",
    setter: "",
    telefono: "",
    email: "",
    instagram: "",
    fecha_closer: "",
    estado: "",
    link_fathom: "",
    problema_actual: "",
    tiempo_problema: "",
    intentos_previos: "",
    motivo_urgencia: "",
    ingresos: "",
    inversion: "",
  })
  const [guardandoLead, setGuardandoLead] = useState(false)

  // Buscador de leads para mover al reporte
  const [busquedaLead, setBusquedaLead] = useState("")
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([])
  const [buscandoLead, setBuscandoLead] = useState(false)
  const [moviendoLeadId, setMoviendoLeadId] = useState<string | number | null>(null)

  const abrirEdicionLead = async (c: any) => {
    const agendaId = c.agenda_id || c.id
    if (!agendaId) {
      toast.error("No se encontró el ID de la agenda para editar")
      return
    }
    setCargandoAgendaId(agendaId)
    const leadObj: CallDetalle = {
      agenda_id: agendaId,
      nombre: c.nombre || "Lead",
      closer: c.closer || "Nahuel",
      arquetipo_macro: c.arquetipo_macro || "SIN CLASIFICAR",
      subarquetipo: c.subarquetipo || null,
      lead_score: c.lead_score || c.calificacion || "SIN SCORING",
      es_calificado: Boolean(c.es_calificado || (c.calificacion && c.calificacion.startsWith("LEAD") && !c.calificacion.includes("D"))),
      origen: c.fuente || c.origen || "Instagram",
      resultado: c.resultado || (c.cerro ? "CIERRE" : c.show === false ? "NO SHOW" : "NO CIERRE"),
      cash_d1: Number(c.cc_dia_1) || 0,
      ticket_total: Number(c.cc_dia_1) || 0,
      ...c,
    }
    setLeadEditando(leadObj)
    setTabModal("comercial")
    setModalLeadAbierto(true)

    let scoringBase = "LEAD D"
    const scoreUpper = (c.lead_score || "").toUpperCase()
    if (scoreUpper.includes("LEAD S")) scoringBase = "LEAD S"
    else if (scoreUpper.includes("LEAD A")) scoringBase = "LEAD A"
    else if (scoreUpper.includes("LEAD B")) scoringBase = "LEAD B"
    else if (scoreUpper.includes("LEAD C")) scoringBase = "LEAD C"
    else if (scoreUpper.includes("LEAD D")) scoringBase = "LEAD D"

    const macroBase = c.arquetipo_macro || "SIN CLASIFICAR"
    const objBase = c.objecion_principal && c.objecion_principal !== "Sin motivo cargado" ? c.objecion_principal : ""

    const initial = {
      lead_scoring: scoringBase,
      macro_arquetipo: macroBase,
      subarquetipo: c.subarquetipo || "",
      calificaba_realmente: c.calificaba_realmente || "Sin definir",
      objecion: objBase,
      motivo_no_cierre: c.motivo_real && c.motivo_real !== "Propuesta y claridad en el modelo" ? c.motivo_real : "",
      siguiente_paso: c.siguiente_paso || "Seguimiento",
      closer: c.closer || "Cristian",
      setter: "",
      telefono: "",
      email: "",
      instagram: "",
      fecha_closer: "",
      estado: c.resultado === "CANCELADA" ? "Cancelado" : (c.resultado === "NO SHOW" ? "No se presentó" : ""),
      link_fathom: "",
      problema_actual: c.porque_agendo || "",
      tiempo_problema: "",
      intentos_previos: "",
      motivo_urgencia: "",
      ingresos: c.ingresos_declarados || "",
      inversion: "",
    }
    setFormEdit(initial)

    try {
      const res = await fetch(`/api/agendas?id=${c.agenda_id}`)
      if (res.ok) {
        const data: Agenda = await res.json()
        if (data) {
          agendaOriginalRef.current = data
          setFormEdit(prev => ({
            ...prev,
            closer: data.closer || prev.closer,
            setter: data.setter || prev.setter,
            telefono: data.telefono || prev.telefono,
            email: data.email || (data as any)?.crm_people?.primary_email || prev.email,
            instagram: data.instagram || prev.instagram,
            fecha_closer: data.fecha_closer ? data.fecha_closer.slice(0, 16) : prev.fecha_closer,
            estado: data.estado || prev.estado,
            link_fathom: data.link_fathom || prev.link_fathom,
            problema_actual: data.problema_actual || prev.problema_actual,
            tiempo_problema: data.tiempo_problema || prev.tiempo_problema,
            intentos_previos: data.intentos_previos || prev.intentos_previos,
            motivo_urgencia: data.motivo_urgencia || prev.motivo_urgencia,
            ingresos: data.ingresos || prev.ingresos,
            inversion: data.inversion || prev.inversion,
            lead_scoring: data.calificacion || prev.lead_scoring,
            calificaba_realmente: data.calificaba_realmente || prev.calificaba_realmente,
          }))
        }
      }
    } catch (err) {
      console.warn("No se pudo precargar agenda completa:", err)
    } finally {
      setCargandoAgendaId(null)
    }
  }

  const guardarEdicionLead = async () => {
    if (!leadEditando?.agenda_id) {
      toast.error("No se encontró el ID de la agenda para guardar")
      return
    }
    setGuardandoLead(true)
    try {
      let ocupacionFinal: string | null = null
      if (formEdit.macro_arquetipo === "DUEÑO DE NEGOCIO") {
        ocupacionFinal = formEdit.subarquetipo.trim() ? `Negocio - ${formEdit.subarquetipo.trim()}` : "Negocio"
      } else if (formEdit.macro_arquetipo === "EMPLEADO") {
        ocupacionFinal = formEdit.subarquetipo.trim() ? `Empleado - ${formEdit.subarquetipo.trim()}` : "Empleado"
      } else if (formEdit.macro_arquetipo === "ESTUDIANTE") {
        ocupacionFinal = formEdit.subarquetipo.trim() ? `Estudiante - ${formEdit.subarquetipo.trim()}` : "Estudiante"
      } else if (formEdit.subarquetipo.trim()) {
        ocupacionFinal = formEdit.subarquetipo.trim()
      }

      let estadoFinal = formEdit.estado || formEdit.siguiente_paso
      if (formEdit.estado === "Reprogramó") {
        estadoFinal = "Reprogramó"
      } else if (formEdit.siguiente_paso === "Onboarding") {
        estadoFinal = "Cierre"
      }

      const orig = agendaOriginalRef.current
      const pickVal = (newVal: string | null | undefined, origVal: string | null | undefined) => {
        if (newVal !== undefined && newVal !== null && newVal.trim() !== "") return newVal.trim()
        return origVal || null
      }

      const updates: any = {
        id: leadEditando.agenda_id,
        closer: pickVal(formEdit.closer, orig?.closer),
        setter: pickVal(formEdit.setter, orig?.setter),
        telefono: pickVal(formEdit.telefono, orig?.telefono),
        email: pickVal(formEdit.email, orig?.email || (orig as any)?.crm_people?.primary_email),
        instagram: pickVal(formEdit.instagram, orig?.instagram),
        fecha_closer: formEdit.fecha_closer ? `${formEdit.fecha_closer}:00` : (orig?.fecha_closer || null),
        link_fathom: pickVal(formEdit.link_fathom, orig?.link_fathom),
        problema_actual: pickVal(formEdit.problema_actual, orig?.problema_actual),
        tiempo_problema: pickVal(formEdit.tiempo_problema, orig?.tiempo_problema),
        intentos_previos: pickVal(formEdit.intentos_previos, orig?.intentos_previos),
        motivo_urgencia: pickVal(formEdit.motivo_urgencia, orig?.motivo_urgencia),
        ingresos: pickVal(formEdit.ingresos, orig?.ingresos),
        inversion: pickVal(formEdit.inversion, orig?.inversion),
        calificacion: formEdit.lead_scoring,
        lead_score_grade: formEdit.lead_scoring,
        ocupacion: ocupacionFinal || orig?.ocupacion || null,
        calificaba_realmente: formEdit.calificaba_realmente === "Sin definir" ? (orig?.calificaba_realmente || null) : formEdit.calificaba_realmente,
        motivo_no_cierre: formEdit.motivo_no_cierre || (formEdit.objecion && formEdit.objecion !== "none" ? formEdit.objecion : null) || orig?.motivo_no_cierre || null,
        estado: estadoFinal,
      }

      if (updates.fecha_closer) {
        updates.fecha_agenda = updates.fecha_closer
      }

      if (formEdit.estado === "Reprogramó") {
        updates.show = false
        updates.cerro = false
        updates.estado = "Reprogramó"
      } else if (formEdit.estado === "No se presentó") {
        updates.show = false
        updates.cerro = false
        updates.estado = "No Show"
      } else if (formEdit.estado === "Se presentó") {
        updates.show = true
      }

      const res = await fetch("/api/agendas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Error al actualizar la agenda en Exposure OS")
      }

      toast.success("Lead actualizado exitosamente en Agendas de Exposure OS")
      setModalLeadAbierto(false)
      setLeadEditando(null)
      await mutate((key: string) => typeof key === "string" && key.startsWith("/api/agendas"))
      await cargarResumen()
    } catch (err: any) {
      toast.error(err.message || "Error al guardar cambios")
    } finally {
      setGuardandoLead(false)
    }
  }
  // Búsqueda global de leads en todo el CRM (debounce 300ms)
  useEffect(() => {
    const term = busquedaLead.trim()
    if (term.length < 2) {
      setResultadosBusqueda([])
      setBuscandoLead(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        setBuscandoLead(true)
        const res = await fetch(`/api/agendas?q=${encodeURIComponent(term)}&light=1`)
        if (res.ok) {
          const list = await res.json()
          setResultadosBusqueda(Array.isArray(list) ? list : [])
        }
      } catch (err) {
        console.error("Error buscando leads:", err)
      } finally {
        setBuscandoLead(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaLead])

  // Mover lead de otra fecha a la fecha seleccionada en el reporte
  const moverLeadAFecha = async (lead: any, fechaDestino: string) => {
    try {
      setMoviendoLeadId(lead.id)
      const horaOriginal = lead.fecha_closer
        ? lead.fecha_closer.slice(11, 16)
        : lead.fecha_agenda
        ? lead.fecha_agenda.slice(11, 16)
        : "10:00"
      const nuevaFecha = `${fechaDestino}T${horaOriginal || "10:00"}:00`

      const res = await fetch("/api/agendas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          fecha_closer: nuevaFecha,
          fecha_agenda: nuevaFecha,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "No se pudo mover el lead")
      }

      toast.success(`¡Lead ${lead.nombre || ""} movido al ${fechaDestino} (${horaOriginal})!`)
      setBusquedaLead("")
      setResultadosBusqueda([])
      await cargarResumen()
      void mutate((key: string) => typeof key === "string" && key.startsWith("/api/agendas"))
    } catch (err: any) {
      toast.error(err.message || "Error al mover el lead")
    } finally {
      setMoviendoLeadId(null)
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

  // Deduplicación defensiva en UI para garantizar llamadas únicas en cualquier período
  const callsUnicas = useMemo(() => {
    const seen = new Set<string>()
    return calls.filter((c) => {
      if (c.agenda_id && seen.has(`id:${c.agenda_id}`)) return false
      if (c.agenda_id) seen.add(`id:${c.agenda_id}`)

      const cleanNom = (c.nombre || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
      const horaStr = (c.hora || "").trim()
      const fechaStr = (c.fecha || "").trim()
      if (cleanNom && cleanNom.length >= 4) {
        const combo = `nhf:${cleanNom}_${fechaStr}_${horaStr}`
        if (seen.has(combo)) return false
        seen.add(combo)
      }
      return true
    })
  }, [calls])

  const callsFiltradas = callsUnicas.filter((c) => {
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
              {/* Buscador y Reubicador de Leads Global */}
              <Card className="border-white/10 bg-zinc-900/60 p-3 shadow-sm">
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-xs focus-within:border-emerald-500/50 transition-colors">
                    <Search className="h-4 w-4 text-emerald-400 shrink-0" />
                    <Input
                      placeholder="Buscar lead en todo el CRM (nombre, teléfono o IG) para mover a este día..."
                      value={busquedaLead}
                      onChange={(e) => setBusquedaLead(e.target.value)}
                      className="h-6 border-0 bg-transparent p-0 text-xs text-white placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {busquedaLead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-zinc-400 hover:text-white"
                        onClick={() => {
                          setBusquedaLead("")
                          setResultadosBusqueda([])
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {buscandoLead && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400 shrink-0" />}
                  </div>

                  {/* Dropdown flotante con resultados de búsqueda */}
                  {busquedaLead.trim().length >= 2 && (
                    <div className="mt-2.5 space-y-2 rounded-lg border border-white/10 bg-zinc-950/95 p-2 shadow-xl">
                      <div className="flex items-center justify-between px-2 py-1 text-[11px] text-zinc-400 border-b border-white/5">
                        <span>
                          {buscandoLead
                            ? "Buscando en la base de datos..."
                            : `Resultados encontrados (${resultadosBusqueda.length})`}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Día destino: <strong className="text-emerald-400">{fecha}</strong>
                        </span>
                      </div>

                      {resultadosBusqueda.length === 0 && !buscandoLead ? (
                        <div className="p-4 text-center text-xs text-zinc-500">
                          No se encontraron leads con "{busquedaLead}" en el CRM.
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                          {resultadosBusqueda.map((lead: any) => {
                            const leadFecha = lead.fecha_closer || lead.fecha_agenda || ""
                            const fechaCorta = leadFecha ? leadFecha.slice(0, 10) : "Sin fecha"
                            const horaCorta = leadFecha && leadFecha.length >= 16 ? leadFecha.slice(11, 16) : ""
                            const esMismoDia = fechaCorta === fecha
                            const moviendo = moviendoLeadId === lead.id

                            return (
                              <div
                                key={lead.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-white/5 bg-zinc-900/60 p-2.5 hover:bg-zinc-900 transition-colors"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-white truncate">
                                      {lead.nombre || "Sin nombre"}
                                    </span>
                                    {lead.calificacion && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] px-1.5 py-0 h-4 border-white/10",
                                          lead.calificacion.includes("A") && "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
                                          lead.calificacion.includes("B") && "border-blue-500/40 text-blue-300 bg-blue-500/10",
                                          lead.calificacion.includes("C") && "border-amber-500/40 text-amber-300 bg-amber-500/10",
                                          lead.calificacion.includes("D") && "border-zinc-500/40 text-zinc-400 bg-zinc-500/10"
                                        )}
                                      >
                                        {lead.calificacion}
                                      </Badge>
                                    )}
                                    {lead.closer && (
                                      <span className="text-[10px] text-zinc-400">
                                        Closer: <strong className="text-zinc-300">{lead.closer}</strong>
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                                    {lead.telefono && <span>📞 {lead.telefono}</span>}
                                    {lead.instagram && <span>📸 @{lead.instagram.replace(/^@/, "")}</span>}
                                    <span className={cn(
                                      "font-medium",
                                      esMismoDia ? "text-emerald-400" : "text-amber-400"
                                    )}>
                                      📅 {esMismoDia ? `En este día (${horaCorta || "10:00"})` : `Agendado: ${fechaCorta} ${horaCorta}`}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={moviendo}
                                    onClick={() => moverLeadAFecha(lead, fecha)}
                                    className="h-7 text-[11px] px-2.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                                    title={`Mover lead al día del reporte (${fecha})`}
                                  >
                                    {moviendo ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                      <CalendarDays className="h-3 w-3 mr-1 text-emerald-400" />
                                    )}
                                    Mover a {fecha}
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => abrirEdicionLead(lead)}
                                    className="h-7 text-[11px] px-2 text-zinc-300 hover:text-white hover:bg-white/5"
                                    title="Abrir ficha completa del lead"
                                  >
                                    <Pencil className="h-3 w-3 mr-1 text-zinc-400" />
                                    Ficha
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

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

      {/* Modal / Dialog Completo de Edición de Lead */}
      <Dialog open={modalLeadAbierto} onOpenChange={setModalLeadAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-zinc-950 border-white/10 text-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <Pencil className="h-4 w-4 text-emerald-400" />
                  Editar Lead: {leadEditando?.nombre}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 mt-1">
                  Modificá los datos comerciales, asignación de closer, llamada y contexto del lead en Agendas.
                </DialogDescription>
              </div>
            </div>

            {/* Pestañas de navegación rápida dentro de la ficha */}
            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setTabModal("comercial")}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition", tabModal === "comercial" ? "bg-emerald-600 text-white" : "bg-white/5 text-zinc-400 hover:text-white")}
              >
                Comercial y Cierre
              </button>
              <button
                type="button"
                onClick={() => setTabModal("contacto")}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition", tabModal === "contacto" ? "bg-emerald-600 text-white" : "bg-white/5 text-zinc-400 hover:text-white")}
              >
                Contacto y Responsables
              </button>
              <button
                type="button"
                onClick={() => setTabModal("llamada")}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition", tabModal === "llamada" ? "bg-emerald-600 text-white" : "bg-white/5 text-zinc-400 hover:text-white")}
              >
                Agenda y Llamada
              </button>
              <button
                type="button"
                onClick={() => setTabModal("contexto")}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition", tabModal === "contexto" ? "bg-emerald-600 text-white" : "bg-white/5 text-zinc-400 hover:text-white")}
              >
                Contexto del Lead
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
            {/* PESTAÑA 1: COMERCIAL Y CIERRE */}
            {tabModal === "comercial" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-300 text-xs">Lead Scoring</Label>
                    <Select value={formEdit.lead_scoring} onValueChange={v => setFormEdit(prev => ({ ...prev, lead_scoring: v }))}>
                      <SelectTrigger className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="LEAD S">LEAD S (Calificado)</SelectItem>
                        <SelectItem value="LEAD A">LEAD A (Calificado)</SelectItem>
                        <SelectItem value="LEAD B">LEAD B (Calificado)</SelectItem>
                        <SelectItem value="LEAD C">LEAD C (Calificado)</SelectItem>
                        <SelectItem value="LEAD D">LEAD D (No calificado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-zinc-300 text-xs">Calificaba realmente (post-call)</Label>
                    <Select value={formEdit.calificaba_realmente} onValueChange={v => setFormEdit(prev => ({ ...prev, calificaba_realmente: v }))}>
                      <SelectTrigger className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="Sin definir">Sin definir</SelectItem>
                        <SelectItem value="Si">Si</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-300 text-xs">Macro Arquetipo</Label>
                    <Select value={formEdit.macro_arquetipo} onValueChange={v => setFormEdit(prev => ({ ...prev, macro_arquetipo: v }))}>
                      <SelectTrigger className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="DUEÑO DE NEGOCIO">DUEÑO DE NEGOCIO</SelectItem>
                        <SelectItem value="EMPLEADO">EMPLEADO</SelectItem>
                        <SelectItem value="ESTUDIANTE">ESTUDIANTE</SelectItem>
                        <SelectItem value="SIN CLASIFICAR">SIN CLASIFICAR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-zinc-300 text-xs">Subarquetipo</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs placeholder:text-zinc-500 text-white"
                      placeholder="Ej. Ingeniero, Dev freelance, Editor..."
                      value={formEdit.subarquetipo}
                      onChange={e => setFormEdit(prev => ({ ...prev, subarquetipo: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-300 text-xs">Objeción</Label>
                    <Select value={formEdit.objecion || "none"} onValueChange={v => setFormEdit(prev => ({ ...prev, objecion: v === "none" ? "" : v }))}>
                      <SelectTrigger className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white">
                        <SelectValue placeholder="Seleccionar objeción..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="none">Sin objeción cargada</SelectItem>
                        {MOTIVOS_NO_CIERRE_CRM.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-zinc-300 text-xs">Siguiente paso</Label>
                    <Select value={formEdit.siguiente_paso} onValueChange={v => setFormEdit(prev => ({ ...prev, siguiente_paso: v }))}>
                      <SelectTrigger className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="Seguimiento">Seguimiento</SelectItem>
                        <SelectItem value="Onboarding">Onboarding</SelectItem>
                        <SelectItem value="Volver a llamar">Volver a llamar</SelectItem>
                        <SelectItem value="Descartado">Descartado</SelectItem>
                        <SelectItem value="Esperando pago">Esperando pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-zinc-300 text-xs">Motivo de no cierre (detalle)</Label>
                  <Input
                    className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs placeholder:text-zinc-500 text-white"
                    placeholder="Explicación detallada o notas del motivo"
                    value={formEdit.motivo_no_cierre}
                    onChange={e => setFormEdit(prev => ({ ...prev, motivo_no_cierre: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* PESTAÑA 2: CONTACTO Y RESPONSABLES */}
            {tabModal === "contacto" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                      Closer que tomó la llamada
                    </Label>
                    <Select value={formEdit.closer} onValueChange={v => setFormEdit(prev => ({ ...prev, closer: v }))}>
                      <SelectTrigger className="mt-1 h-8 bg-zinc-900 border-emerald-500/30 text-xs font-semibold text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        {["Nahuel", "Cristian", "Alex", "Tobias", "Bener", "Libre / Recontacto", "Sin Closer"].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-zinc-300 text-xs">Setter asignado</Label>
                    <Select value={formEdit.setter || "none"} onValueChange={v => setFormEdit(prev => ({ ...prev, setter: v === "none" ? "" : v }))}>
                      <SelectTrigger className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white">
                        <SelectValue placeholder="Sin setter" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="none">Sin Setter</SelectItem>
                        {["Maximo", "Andres", "Santi", "Cesar", "Lukas"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-zinc-300 text-xs">WhatsApp / Teléfono</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.telefono}
                      onChange={e => setFormEdit(prev => ({ ...prev, telefono: e.target.value }))}
                      placeholder="+54 9 11..."
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">Email</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.email}
                      onChange={e => setFormEdit(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@..."
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">Instagram</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.instagram}
                      onChange={e => setFormEdit(prev => ({ ...prev, instagram: e.target.value }))}
                      placeholder="@usuario"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA 3: AGENDA Y LLAMADA */}
            {tabModal === "llamada" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-purple-300 font-bold text-xs">
                      Estado de la llamada
                    </Label>
                    <Select value={formEdit.estado || "none"} onValueChange={v => setFormEdit(prev => ({ ...prev, estado: v === "none" ? "" : v }))}>
                      <SelectTrigger className="mt-1 h-8 bg-zinc-900 border-purple-500/30 text-xs font-semibold text-white">
                        <SelectValue placeholder="Seleccionar estado..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="Reprogramó">🟣 Reprogramó</SelectItem>
                        <SelectItem value="Se presentó">🟢 Se presentó</SelectItem>
                        <SelectItem value="No se presentó">🔴 No se presentó (No Show)</SelectItem>
                        <SelectItem value="Adentro en Call">🏆 Adentro en Call (Cierre)</SelectItem>
                        <SelectItem value="Adentro en FUP">🔄 Adentro en FUP</SelectItem>
                        <SelectItem value="Fee">💳 Fee pagado</SelectItem>
                        <SelectItem value="Grupo Precall Creado">🔷 Grupo Precall Creado</SelectItem>
                        <SelectItem value="Pendiente">⏳ Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-zinc-300 text-xs">
                        Fecha y hora de llamada {formEdit.estado === "Reprogramó" ? "(Reprogramar)" : ""}
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          const horaActual = formEdit.fecha_closer && formEdit.fecha_closer.length >= 16 ? formEdit.fecha_closer.slice(11, 16) : "10:00"
                          setFormEdit(prev => ({ ...prev, fecha_closer: `${fecha}T${horaActual || "10:00"}` }))
                          toast.info(`Fecha ajustada al día del reporte (${fecha})`)
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                      >
                        Mover a fecha del reporte ({fecha})
                      </button>
                    </div>
                    <Input
                      type="datetime-local"
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.fecha_closer}
                      onChange={e => setFormEdit(prev => ({ ...prev, fecha_closer: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-zinc-300 text-xs">Link grabación Fathom</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      className="h-8 bg-zinc-900 border-white/10 text-xs text-white flex-1"
                      placeholder="https://fathom.video/..."
                      value={formEdit.link_fathom}
                      onChange={e => setFormEdit(prev => ({ ...prev, link_fathom: e.target.value }))}
                    />
                    {formEdit.link_fathom && (
                      <a href={formEdit.link_fathom} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs flex items-center gap-1 font-semibold">
                        Ver <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA 4: CONTEXTO DEL LEAD */}
            {tabModal === "contexto" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-300 text-xs">Problema actual</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.problema_actual}
                      onChange={e => setFormEdit(prev => ({ ...prev, problema_actual: e.target.value }))}
                      placeholder="Ej: No sé cómo vender IA"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">Hace cuánto arrastra el problema</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.tiempo_problema}
                      onChange={e => setFormEdit(prev => ({ ...prev, tiempo_problema: e.target.value }))}
                      placeholder="Ej: Hace meses"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-300 text-xs">Intentos previos</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.intentos_previos}
                      onChange={e => setFormEdit(prev => ({ ...prev, intentos_previos: e.target.value }))}
                      placeholder="Ej: Intentó vender de forma autodidacta"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">Motivo de urgencia</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.motivo_urgencia}
                      onChange={e => setFormEdit(prev => ({ ...prev, motivo_urgencia: e.target.value }))}
                      placeholder="Ej: Quiere ganar más / aprovechar IA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-300 text-xs">Ingreso mensual</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.ingresos}
                      onChange={e => setFormEdit(prev => ({ ...prev, ingresos: e.target.value }))}
                      placeholder="Ej: +$3.000 /MES"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">Capacidad de inversión</Label>
                    <Input
                      className="mt-1 h-8 bg-zinc-900 border-white/10 text-xs text-white"
                      value={formEdit.inversion}
                      onChange={e => setFormEdit(prev => ({ ...prev, inversion: e.target.value }))}
                      placeholder="Ej: +$500 / -$500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-white/10 flex justify-between items-center bg-zinc-950">
            <span className="text-[11px] text-zinc-500">
              Al guardar se actualiza agendas y se sincroniza la atribución al closer real.
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 hover:bg-white/10 text-xs text-white"
                onClick={() => setModalLeadAbierto(false)}
                disabled={guardandoLead}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                onClick={guardarEdicionLead}
                disabled={guardandoLead}
              >
                {guardandoLead && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {guardandoLead ? "Guardando en Agendas..." : "Guardar cambios"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
