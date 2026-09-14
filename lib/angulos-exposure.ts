// Banco de ángulos de EXPOSURE, vigente desde el 14/09/2026 (planilla de Alex).
// Reemplazó a los 25 del doc "Avatar Pibardo": la taxonomía dejó de ser por dolor y pasó a ser por
// etapa de consciencia, la misma que usan las etiquetas de ManyChat (🔴Problema, 🟢Solución,
// 🔵Producto, 🟣Volumen/TOFU).
//
// El banco VIVO está en la tabla `crm_angulos` y se edita desde Contenido → Banco de ángulos
// (/api/angulos). Esta lista es la semilla de esa tabla y el respaldo si la base no respondiera,
// para que ningún desplegable quede vacío.
export type AnguloExposure = { id: number; titulo: string; dolor: string }

export const ANGULOS_EXPOSURE: AnguloExposure[] = [
  { id: 1, titulo: "SABES IA PERO NO COMO VENDERLA", dolor: "PROBLEMA" },
  { id: 2, titulo: "DEPENDER DE REFERIDOS", dolor: "PROBLEMA" },
  { id: 3, titulo: "ANTI-ECOM", dolor: "PROBLEMA" },
  { id: 4, titulo: "SATURADO DE CLIENTES POR HORAS", dolor: "PROBLEMA" },
  { id: 5, titulo: "SALARIO PROMEDIO EN ARG", dolor: "PROBLEMA" },
  { id: 6, titulo: "NECESITAS UN 2DO SALARIO", dolor: "PROBLEMA" },
  { id: 7, titulo: "PROSPECCIÓN EN FRIO", dolor: "PROBLEMA" },
  { id: 8, titulo: "COMO CERRAR CLIENTES CON IG", dolor: "SOLUCIÓN" },
  { id: 9, titulo: "CÓMO GANAR DINERO CON IA", dolor: "SOLUCIÓN" },
  { id: 10, titulo: "INGRESO EXTRA IA", dolor: "SOLUCIÓN" },
  { id: 11, titulo: "CASO DE ÉXITO: BAUTISTA QUILEZ", dolor: "PRODUCTO" },
  { id: 12, titulo: "CASO DE ÉXITO: FLEX", dolor: "PRODUCTO" },
  { id: 13, titulo: "CASO DE ÉXITO: FRAN PULEO", dolor: "PRODUCTO" },
  { id: 14, titulo: "CASO DE ÉXITO: TOTO BAEZ", dolor: "PRODUCTO" },
  { id: 15, titulo: "MI PROGRAMA 1-1", dolor: "PRODUCTO" },
  { id: 16, titulo: "MI HISTORIA", dolor: "MENTALIDAD" },
  { id: 17, titulo: "DEJA DE PROCASTINAR", dolor: "MENTALIDAD" },
  { id: 18, titulo: "VES 20 MIL TUTORIALES Y NO HACES NADA", dolor: "MENTALIDAD" },
  { id: 19, titulo: "MOSTRALES QUE ESTÁN EQUIVOCADOS", dolor: "MENTALIDAD" },
  { id: 20, titulo: "HERRAMIENTAS IA", dolor: "VOLUMEN/TOFU" },
]

export const ANGULOS_EXPOSURE_TITULOS = ANGULOS_EXPOSURE.map((a) => a.titulo)

// Misma lista con el nombre de campo que usa la tabla (`numero`), para sembrarla y para el respaldo.
export const ANGULOS_SEED = ANGULOS_EXPOSURE.map((a) => ({ numero: a.id, titulo: a.titulo, dolor: a.dolor }))

// Las categorías vigentes. La pantalla ofrece estas más cualquiera que Alex haya agregado.
export const DOLORES_SEED = ["PROBLEMA", "SOLUCIÓN", "PRODUCTO", "MENTALIDAD", "VOLUMEN/TOFU"] as const

// Un ángulo tal como lo devuelve /api/angulos.
export type AnguloBanco = {
  id: string
  numero: number
  titulo: string
  dolor: string
  activo: boolean
  notas: string | null
  etiqueta: string
  usos: number
}
