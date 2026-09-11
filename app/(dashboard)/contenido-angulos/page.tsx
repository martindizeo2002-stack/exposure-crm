"use client"

import { CalendarClock, Radar } from "lucide-react"
import { ModuleTabs } from "@/components/module-tabs"
import { ContentWorkspace } from "@/components/content-workspace"
import { ContentAnglesMetrics } from "@/components/content-angles-metrics"

// Contenido tiene dos pestañas dentro del mismo módulo (mismo criterio que
// /cobros: ModuleTabs, sin crear un hub global nuevo):
// - Semanal (Esta semana / Biblioteca): donde el equipo escribe,
//   calendariza y revisa guiones día a día. Reemplaza el uso diario de
//   Notion para esto.
// - Métricas/Ángulos: la trazabilidad estímulo→venta que ya existía. Los
//   drill-downs de ángulo/formato/lead viven ahí mismo, no como página nueva.
export default function ContenidoPage() {
  const tabs = [
    { id: "semanal", label: "Semanal", hint: "esta semana y biblioteca", icon: <CalendarClock className="h-4 w-4" />, content: <ContentWorkspace /> },
    { id: "metricas", label: "Métricas y ángulos", hint: "trazabilidad estímulo → venta", icon: <Radar className="h-4 w-4" />, content: <ContentAnglesMetrics /> },
  ]
  return <ModuleTabs
    title="Contenido"
    subtitle="Calendario semanal de guiones + trazabilidad de ángulos en un solo lugar"
    tabs={tabs}
  />
}
