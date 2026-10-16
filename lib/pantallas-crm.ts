// Pantallas del CRM a las que el asistente puede llevar (botón "Ir a …" en el globo). Solo rutas reales; el
// permiso se filtra con lib/role-access (canAccessPage) para no ofrecer una pantalla que el usuario no puede abrir.
// Las que aceptan búsqueda: /centro-agendas?q=<nombre o teléfono> abre el lead; /historia-leads?q=<nombre> su historia.

import { canAccessPage } from "@/lib/role-access"

export type PantallaCrm = { ruta: string; nombre: string; para: string; busqueda?: string }

export const PANTALLAS_CRM: PantallaCrm[] = [
  { ruta: "/", nombre: "Home", para: "tablero del mes: revenue, cash collected, FECCU, FECCPP, cuotas pendientes, ROAS, AOV, meta de cash; cada tarjeta abre su detalle" },
  { ruta: "/ventas/resumen", nombre: "Resumen de ventas", para: "resumen diario/semanal/mensual de closing: llamadas, shows, cierres, fees, objeciones, ángulos, texto para WhatsApp, auditoría del mes contra el anterior" },
  { ruta: "/metricas", nombre: "Métricas", para: "embudo del mes por embudo (webinar, orgánico, outbound): agendas, show, cierres, tasas, cash, setters, conversaciones" },
  { ruta: "/rendimiento", nombre: "Rendimiento", para: "métricas de rendimiento del equipo" },
  { ruta: "/embudos", nombre: "Embudos", para: "métricas por embudo y Meta Ads: inversión, costo por agenda/cierre, ROAS por campaña, costo por seguidor" },
  { ruta: "/centro-agendas", nombre: "Centro de agendas", para: "todas las agendas con su resultado; abrir y editar la ficha de un lead", busqueda: "q" },
  { ruta: "/agendas-incompletas", nombre: "Agendas incompletas", para: "llamadas que el Home marca como CRM por completar, la causa y el completado desde Fathom, pagos e iClosed" },
  { ruta: "/historia-leads", nombre: "Historia del lead", para: "todo lo que pasó con una persona: agendas, llamadas, pagos, eventos", busqueda: "q" },
  { ruta: "/ventas", nombre: "Agendas", para: "agendas del período" },
  { ruta: "/pipeline", nombre: "Pipeline", para: "tablero por etapa de cada llamada (confirmada, no show, presentada, fee, cerrada)" },
  { ruta: "/seguimientos", nombre: "Seguimientos", para: "leads en seguimiento con fecha y nota" },
  { ruta: "/setting-resumen", nombre: "Resumen de setting", para: "reportes de setting y calificación de cada agenda" },
  { ruta: "/pagos", nombre: "Pagos", para: "cargar pagos" },
  { ruta: "/todos-pagos", nombre: "Todos los pagos", para: "registro de todos los pagos con concepto, monto, closer y fecha" },
  { ruta: "/planes-pago", nombre: "Planes de pago", para: "planes y cuotas de cada cliente (revenue contractual)" },
  { ruta: "/cuotas", nombre: "Cuotas", para: "cuotas pendientes y cobradas" },
  { ruta: "/recordatorios", nombre: "Cobros y cuotas", para: "cobros atrasados y que vencen, con WhatsApp" },
  { ruta: "/equipo", nombre: "Leaderboard", para: "ranking de closers y setters: cash comisionable, cierres, tasa de cierre, comisiones" },
  { ruta: "/clientes-hub", nombre: "Clientes", para: "clientes del programa y su etapa" },
  { ruta: "/calidad-datos", nombre: "Calidad de datos", para: "excepciones de datos (setter faltante, comprobante faltante, Fathom sin agenda…)" },
  { ruta: "/reporte-llamadas", nombre: "Reporte de llamadas", para: "reporte de llamadas del equipo" },
  { ruta: "/contenido-angulos", nombre: "Contenido", para: "piezas de contenido y su ángulo" },
  { ruta: "/contenido/angulos", nombre: "Banco de ángulos", para: "ángulos vigentes por etapa de consciencia" },
  { ruta: "/contenido/tipos-agenda", nombre: "Tipos de agenda", para: "qué pieza y ángulo trajo cada agenda" },
  { ruta: "/radar", nombre: "Radar", para: "cuentas de Instagram seguidas: piezas, historias, comentarios" },
  { ruta: "/ciudad", nombre: "Ciudad", para: "el negocio en 3D, del contenido al cliente" },
  { ruta: "/gastos", nombre: "Gastos", para: "gastos del mes" },
  { ruta: "/finanzas", nombre: "Finanzas", para: "cierre financiero del mes" },
]

export function pantallasPara(rol: string): PantallaCrm[] {
  return PANTALLAS_CRM.filter((p) => canAccessPage(p.ruta, rol))
}

// Arma la URL final validando que la ruta exista en el catálogo y que el usuario la pueda abrir.
export function rutaValida(ruta: string, rol: string, buscar?: string | null): string | null {
  const limpia = String(ruta || "").split("?")[0].trim()
  const p = pantallasPara(rol).find((x) => x.ruta === limpia)
  if (!p) return null
  const q = String(buscar || "").trim().slice(0, 80)
  return p.busqueda && q ? `${p.ruta}?${p.busqueda}=${encodeURIComponent(q)}` : p.ruta
}
