import { ANGULOS_EXPOSURE } from "@/lib/angulos-exposure"

// Etiquetas canónicas de ángulo que se guardan en `crm_content_assets.angle` y
// en los eventos de trazabilidad: "N · <título>" sobre el banco fijo de 25
// ángulos de EXPOSURE (lib/angulos-exposure). Regla de la casa: no se inventan
// ángulos; si un texto no mapea, vuelve tal cual y el consumidor decide
// (ver knownSalesAngle en lib/trace-intelligence).
export const SALES_ANGLES: readonly string[] = ANGULOS_EXPOSURE.map((a) => `${a.id} · ${a.titulo}`)

export function salesAngleLabel(id: number): string | null {
  return SALES_ANGLES[id - 1] ?? null
}

// Número de ángulo (1-25) cuando el texto arranca con él: "12", "12 ·", "#12",
// "12 - ...". Exige separador o fin de texto para no confundir "20 caminos"
// ni "10K" con un número de ángulo.
const NUMBER_PREFIX = /^#?\s*(\d{1,3})\s*(?:[·—\-:)]|$)/
// El tope ya no son los 25 de la semilla: Alex agrega ángulos desde Contenido → Banco de ángulos
// y esos llegan con número 26 en adelante. Se acepta cualquier número razonable; si no existe en
// el banco, salesAngleLabel devuelve null y el consumidor se queda con el texto tal cual.
export function salesAngleId(value: unknown): number | null {
  const match = String(value ?? "").trim().match(NUMBER_PREFIX)
  if (!match) return null
  const id = Number(match[1])
  return id >= 1 && id <= 999 ? id : null
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

// Antes había acá un mapa de palabras clave que adivinaba el ángulo a partir de texto libre.
// Se eliminó el 14/09/2026 junto con el banco viejo: apuntaba a los 25 ángulos originales por
// número, y con el banco nuevo habría clasificado cada texto en el ángulo equivocado. Además ya
// no hace falta: el ángulo se elige de un desplegable que sale del banco (Contenido → Banco de
// ángulos), así que siempre llega como etiqueta canónica. Texto desconocido vuelve tal cual.

// Devuelve la etiqueta canónica si el valor es una etiqueta, un número de
// ángulo, el título exacto o contiene una palabra clave. Vacío → "Sin ángulo".
// Texto desconocido → vuelve tal cual (mismo contrato que siempre).
export function canonicalSalesAngle(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return "Sin ángulo"
  if (SALES_ANGLES.includes(raw)) return raw
  const byId = salesAngleId(raw)
  if (byId) return salesAngleLabel(byId) || raw
  const text = normalize(raw)
  const exact = ANGULOS_EXPOSURE.find((a) => normalize(a.titulo) === text)
  if (exact) return salesAngleLabel(exact.id) || raw
  return raw
}
