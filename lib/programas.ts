// Catálogo de programas de EXPOSURE (11/09/2026). Alimenta el selector de "Cargar pago",
// la duración para calcular fecha_baja y el total del contrato. Las etiquetas históricas
// (tal como están escritas en el sheet CRM CENTRAL 2026) se reconocen en OPERACIONES_HISTORICAS.
// Todos los programas duran 4 meses (Alex, 11/09/2026); Círculo Privado es anual y las variantes "8 meses" llevan su override.
// Precio IA Partner vigente desde septiembre 2026 (Alex, 12/09/2026): $1500 PIF · 2 x $750 si se completa
// antes de los 21 días · si no, 2 x $1000 ($2000). Las etiquetas de $1300 pasaron a históricas.
// 3 x $667 ($2000) sumado al selector el 13/10/2026 (pedido de Alex).
// Exposure Agencia de IA (24/10/2026, pedido de Alex): es el nuevo nombre de IA Partner. Se suma como programa
// aparte para no tocar las ventas ya cargadas como IA PARTNER. Las etiquetas llevan el total con "$" para que
// contractValueFromOperation (lib/revenue.ts) lea exactamente $1500 o $2000.
export type ProgramaId = "ia_partner" | "agencia_ia" | "agency" | "agency_pro" | "content" | "circulo"

export type OperacionCatalogo = { label: string; total: number; meses?: number }

export type ProgramaDef = {
  id: ProgramaId
  nombreCompleto: string
  nombreCorto: string
  duracionMeses: number | null
  operaciones: OperacionCatalogo[]
}

export const PROGRAMAS: ProgramaDef[] = [
  {
    id: "ia_partner",
    nombreCompleto: "IA Partner",
    nombreCorto: "IA Partner",
    duracionMeses: 4,
    operaciones: [
      { label: "IA PARTNER | $1500 PIF", total: 1500 },
      { label: "IA PARTNER | 2 x $750 (antes de 21 días)", total: 1500 },
      { label: "IA PARTNER | 2 x $1000", total: 2000 },
      { label: "IA PARTNER | 3 x $667", total: 2000 },
    ],
  },
  {
    id: "agencia_ia",
    nombreCompleto: "Exposure Agencia de IA",
    nombreCorto: "Agencia de IA",
    duracionMeses: 4,
    operaciones: [
      { label: "Agencia de IA | 1500 PIF - $1500", total: 1500 },
      { label: "Agencia de IA | 2 cuotas de 750 (antes de 21 días) | $1500", total: 1500 },
      { label: "Agencia de IA | 2 cuotas de 1000 | $2000 total", total: 2000 },
      { label: "Agencia de IA | 3 cuotas de 667 | $2000 total", total: 2000 },
      { label: "Agencia de IA | 3 cuotas (la primera de 500) + 750 + 650 | $2000 total", total: 2000 },
    ],
  },
  {
    id: "agency",
    nombreCompleto: "Exposure Agency",
    nombreCorto: "Agency",
    duracionMeses: 4,
    operaciones: [
      { label: "Agency | $1300 PIF", total: 1300 },
      { label: "Agency | $1800 (PP)", total: 1800 },
      { label: "Agency | 3 Pagos (650 + 650 + 500)", total: 1800 },
      { label: "Agency | $1600 PIF", total: 1600 },
      { label: "Agency | $2000 PP", total: 2000 },
      { label: "Agency 8 meses | $800 PIF", total: 800, meses: 8 },
      { label: "Agency 8 meses | $1100 PIF", total: 1100, meses: 8 },
    ],
  },
  {
    id: "agency_pro",
    nombreCompleto: "Exposure Agency Pro",
    nombreCorto: "Agency Pro",
    duracionMeses: 4,
    operaciones: [
      { label: "Agency Pro | $2300 PIF", total: 2300 },
      { label: "Agency Pro | $3000 PIF", total: 3000 },
      { label: "Agency Pro | $4000 PP", total: 4000 },
      { label: "Agency Pro | 3 cuotas", total: 2300 },
      { label: "Upsell | Agency Pro $1700", total: 1700 },
    ],
  },
  {
    id: "content",
    nombreCompleto: "Exposure Content",
    nombreCorto: "Content",
    duracionMeses: 4,
    operaciones: [
      { label: "Content | $500 PIF", total: 500 },
      { label: "Content | $600 (PP)", total: 600 },
      { label: "Content | $700 PP", total: 700 },
      { label: "Content | $800 PP", total: 800 },
    ],
  },
  {
    id: "circulo",
    nombreCompleto: "Círculo Privado",
    nombreCorto: "Círculo",
    duracionMeses: 12,
    operaciones: [
      { label: "Círculo Privado | $1300 PIF", total: 1300 },
      { label: "Círculo | 1 año | $1800", total: 1800 },
    ],
  },
]

// Etiquetas tal cual aparecen en los pagos importados del sheet (no se ofrecen en el selector).
const OPERACIONES_HISTORICAS: Array<{ programaId: ProgramaId; operacion: OperacionCatalogo }> = [
  // Precio hasta agosto 2026 (selector del 11/09): se reconocen pero ya no se ofrecen.
  { programaId: "ia_partner", operacion: { label: "IA PARTNER | $1300 PIF", total: 1300 } },
  { programaId: "ia_partner", operacion: { label: "IA PARTNER | $1300 PP", total: 1300 } },
  { programaId: "ia_partner", operacion: { label: "IA PARTNER | $2000 PP", total: 2000 } },
  { programaId: "ia_partner", operacion: { label: "IA PARTNER - PIF", total: 1300 } },
  { programaId: "ia_partner", operacion: { label: "IA PARTNER - 1300 PP", total: 1300 } },
  { programaId: "ia_partner", operacion: { label: "IA PARTNER  - 1300 PP", total: 1300 } },
  { programaId: "ia_partner", operacion: { label: "IA PARTNER 2000 PP", total: 2000 } },
  { programaId: "agency", operacion: { label: "Agency | $1300 (PIF)", total: 1300 } },
  { programaId: "agency", operacion: { label: "Cuota 1 (Agency)", total: 1800 } },
  { programaId: "agency", operacion: { label: "Agency 2K", total: 2000 } },
  { programaId: "agency", operacion: { label: "Agency 1600 pif", total: 1600 } },
  { programaId: "agency", operacion: { label: "Agency 1600 PIF", total: 1600 } },
  { programaId: "agency_pro", operacion: { label: "Agency PRO | $3000 (PIF)", total: 3000 } },
  { programaId: "agency_pro", operacion: { label: "Agency pro 4K", total: 4000 } },
  { programaId: "agency_pro", operacion: { label: "Agency pro (3 cuotas)", total: 2300 } },
  { programaId: "agency_pro", operacion: { label: "Upsell (Agency pro 1700)", total: 1700 } },
  { programaId: "content", operacion: { label: "Content (700) PP", total: 700 } },
  { programaId: "content", operacion: { label: "Content | $500 (DIFERIDO)", total: 500 } },
  { programaId: "circulo", operacion: { label: "Upsell - Círculo Privado ($1300 PIF)", total: 1300 } },
  { programaId: "circulo", operacion: { label: "Circulo | 1 año | 1800", total: 1800 } },
]

export function buscarPrograma(id: ProgramaId | string | null | undefined): ProgramaDef | undefined {
  return PROGRAMAS.find((p) => p.id === id)
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

// Programa al que pertenece una operación escrita a mano ("Agency pro 4K", "IA PARTNER - PIF"…).
export function programaPorTexto(operacionLabel: string | null | undefined): ProgramaDef | undefined {
  const s = normalizar(operacionLabel || "")
  if (!s) return undefined
  if (s.includes("agencia de ia")) return buscarPrograma("agencia_ia")
  if (s.includes("partner")) return buscarPrograma("ia_partner")
  if (s.includes("circulo")) return buscarPrograma("circulo")
  if (s.includes("agency pro") || /\bpro\b/.test(s)) return buscarPrograma("agency_pro")
  if (s.includes("agency")) return buscarPrograma("agency")
  if (s.includes("content")) return buscarPrograma("content")
  return undefined
}

export function buscarProgramaPorOperacion(
  operacionLabel: string | null | undefined,
): { programa: ProgramaDef; operacionDef: OperacionCatalogo } | null {
  if (!operacionLabel) return null
  for (const programa of PROGRAMAS) {
    const operacionDef = programa.operaciones.find((o) => o.label === operacionLabel)
    if (operacionDef) return { programa, operacionDef }
  }
  const historical = OPERACIONES_HISTORICAS.find((item) => item.operacion.label === operacionLabel)
  if (historical) {
    const programa = PROGRAMAS.find((item) => item.id === historical.programaId)
    if (programa) return { programa, operacionDef: historical.operacion }
  }
  return null
}

// Meses de una operación: override de la etiqueta ("8 meses", "1 año") o la duración del programa.
export function mesesDeOperacion(operacionLabel: string | null | undefined): number | null {
  const match = buscarProgramaPorOperacion(operacionLabel)
  if (match?.operacionDef.meses != null) return match.operacionDef.meses
  const s = normalizar(operacionLabel || "")
  const meses = s.match(/(\d+)\s*meses/)
  if (meses) return Number(meses[1])
  if (/\b1 ano\b/.test(s)) return 12
  const programa = match?.programa || programaPorTexto(operacionLabel)
  return programa?.duracionMeses ?? null
}

export function resolverInfoPrograma(
  operacionLabel: string | null | undefined,
  filasFallback: { monto: number }[],
): { nombrePrograma: string; duracionLabel: string | null; total: number } {
  const match = buscarProgramaPorOperacion(operacionLabel)
  if (match) {
    const meses = mesesDeOperacion(operacionLabel)
    return {
      nombrePrograma: match.programa.nombreCompleto,
      duracionLabel: meses != null ? `${meses} Meses` : null,
      total: match.operacionDef.total,
    }
  }
  const porTexto = programaPorTexto(operacionLabel)
  const meses = mesesDeOperacion(operacionLabel)
  return {
    nombrePrograma: porTexto ? porTexto.nombreCompleto : operacionLabel || "",
    duracionLabel: meses != null ? `${meses} Meses` : null,
    total: filasFallback.reduce((s, f) => s + (f.monto || 0), 0),
  }
}

// Duraciones que se pueden elegir al cargar el pago (Venta Nueva Interna / renovaciones) y en el plan ya guardado.
export const DURACIONES_ELEGIBLES: Array<{ meses: number; label: string }> = [
  { meses: 4, label: "4 meses" },
  { meses: 6, label: "6 meses" },
  { meses: 8, label: "8 meses" },
  { meses: 12, label: "1 año" },
]

// Meses entre el alta y la baja guardadas (para respetar la duración que se eligió al cargar). null si falta alguna.
export function mesesEntreFechas(altaISO: string | null | undefined, bajaISO: string | null | undefined): number | null {
  if (!altaISO || !bajaISO) return null
  const [ya, ma, da] = String(altaISO).slice(0, 10).split("-").map(Number)
  const [yb, mb, db] = String(bajaISO).slice(0, 10).split("-").map(Number)
  if (![ya, ma, da, yb, mb, db].every(Number.isFinite)) return null
  const meses = (yb - ya) * 12 + (mb - ma) + (db >= da ? 0 : -1)
  return meses > 0 ? meses : null
}

// Suma `meses` a una fecha ISO (YYYY-MM-DD). null si meses es null (sin baja).
export function calcularFechaBajaPrograma(fechaAltaISO: string | null, meses: number | null): string | null {
  if (!fechaAltaISO || meses == null) return null
  const [y, m, d] = fechaAltaISO.split("-").map(Number)
  const dt = new Date(y, m - 1 + meses, d)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
