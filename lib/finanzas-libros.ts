// Libros de Finanzas → /finanzas/libros. Compartido por la página y la API.

export const LIBROS_FINANZAS = [
  { id: "nahuel", titulo: "Gastos personales · Nahuel", corto: "Nahuel" },
  { id: "alex", titulo: "Gastos personales · Alex", corto: "Alex" },
  { id: "exposure", titulo: "Payroll EXPOSURE", corto: "EXPOSURE" },
] as const

export type LibroFinanzas = (typeof LIBROS_FINANZAS)[number]["id"]

export const AREAS_FINANZAS = ["Marketing", "Ventas", "Producto", "Operaciones"] as const

// Sugerencias (se puede escribir cualquier otra).
export const CATEGORIAS_EXPOSURE = ["Sueldos y comisiones", "Software", "Publicidad", "Servicios profesionales", "Impuestos", "Otros costos"]
export const CATEGORIAS_PERSONALES = ["Vivienda", "Comida", "Transporte", "Salud", "Ocio", "Viajes", "Suscripciones", "Otros"]
export const MEDIOS_PAGO = ["Mercury", "Stripe", "Transferencia ARS", "Transferencia USD", "USDT / Binance", "Tarjeta de crédito", "Tarjeta de débito", "Efectivo USD", "Efectivo ARS", "Otro"]

export type RegistroFinanzas = {
  id: string
  libro: LibroFinanzas
  tipo: "gasto" | "ingreso"
  fecha: string
  concepto: string
  monto_usd: number
  area: string | null
  categoria: string | null
  medio_pago: string | null
  notas: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
}
