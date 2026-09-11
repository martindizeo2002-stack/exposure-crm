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
const NUMBER_PREFIX = /^#?\s*(\d{1,2})\s*(?:[·—\-:)]|$)/
export function salesAngleId(value: unknown): number | null {
  const match = String(value ?? "").trim().match(NUMBER_PREFIX)
  if (!match) return null
  const id = Number(match[1])
  return id >= 1 && id <= ANGULOS_EXPOSURE.length ? id : null
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

// Palabras clave por ángulo, evaluadas sobre texto normalizado (sin tildes,
// minúsculas) y en este orden: los patrones más específicos van antes que las
// palabras compartidas ("negocio de otro" antes que "techo", "dropshipping"
// antes que "vehiculo").
const KEYWORDS: Array<[RegExp, number]> = [
  [/mejor empleado|peor jefe/, 2],
  [/negocio de otro|lo que el decide/, 10],
  [/techo|1\.?500|mejor editando|editando, cerrando/, 1],
  [/dos anos metido|metido en lo digital/, 3],
  [/dropshipping|afiliados|trading/, 11],
  [/no vas a ejercer|estudias algo/, 21],
  [/vehiculo|ganas, el tiempo/, 4],
  [/informacion/, 5],
  [/consumo no es accion|consumiste|seguis en cero/, 6],
  [/piensa el negocio|el que arranca/, 20],
  [/costo de oportunidad|ultimos 5 meses/, 22],
  [/pico sin sistema|tocaste un pico|sin sistema/, 7],
  [/habilidad barata|300 a 3\.?000/, 8],
  [/regatea/, 9],
  [/regalando|servicio barato/, 23],
  [/prospeccion|cinco "?no"?/, 12],
  [/impostor|high ticket/, 13],
  [/10k|nadie de tu entorno/, 14],
  [/pueblo|bullying|no te mostras/, 15],
  [/disfrutar la vida|comerme el mundo|subibaja/, 16],
  [/demostrarte que podes/, 17],
  [/lambo|celu robado|verdadero lujo/, 18],
  [/20 caminos|exceso de opciones|cual tomar/, 19],
  [/referentes|espejo/, 24],
  [/estafa|no confias/, 25],
]

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
  const hit = KEYWORDS.find(([pattern]) => pattern.test(text))
  return hit ? salesAngleLabel(hit[1]) || raw : raw
}
