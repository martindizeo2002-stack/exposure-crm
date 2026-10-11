// Tipos de agenda: qué tipo de lead trae cada pieza de contenido.
// Fuente: crm_setting_resumenes (resúmenes del setter en el grupo de WhatsApp de ventas, clasificados con la
// frase textual como evidencia; los carga Central Negocio/scripts/whatsapp/setting-a-crm.py) + agendas + pagos.

export const ARQUETIPOS: Record<string, { nombre: string; grupo: GrupoId }> = {
  "9a5": { nombre: "9 a 5 que quiere un ingreso extra", grupo: "9a5" },
  universitario: { nombre: "Universitario inquieto", grupo: "universitario" },
  sabe_ia: { nombre: "Sabe de IA pero no venderla", grupo: "sabe_ia" },
  dueno_negocio: { nombre: "Dueño de negocio tradicional", grupo: "dueno_negocio" },
  laburante_digital: { nombre: "Laburante digital explotado", grupo: "nino_info" },
  agencia_chica: { nombre: "Agencia chica perdida", grupo: "nino_info" },
  creador: { nombre: "Creador desmonetizado", grupo: "nino_info" },
  mmo: { nombre: "Ya metido en make money online", grupo: "nino_info" },
  desempleado: { nombre: "Sin trabajo, arranca de cero", grupo: "desempleado" },
  coach_consultor: { nombre: "Coach o consultor", grupo: "otros" },
  otro: { nombre: "Otro / sin datos", grupo: "otros" },
}

export type GrupoId = "9a5" | "universitario" | "sabe_ia" | "dueno_negocio" | "nino_info" | "desempleado" | "otros"

// Orden fijo y colores validados contra la superficie oscura del CRM (#12141d): no se reordenan con los filtros.
export const GRUPOS: Array<{ id: GrupoId; nombre: string; color: string; foco: boolean }> = [
  { id: "9a5", nombre: "9 a 5", color: "#3987e5", foco: true },
  { id: "universitario", nombre: "Universitario", color: "#d95926", foco: true },
  { id: "sabe_ia", nombre: "Sabe IA", color: "#199e70", foco: true },
  { id: "dueno_negocio", nombre: "Dueño de negocio", color: "#c98500", foco: true },
  { id: "nino_info", nombre: "Niño info", color: "#d55181", foco: false },
  { id: "desempleado", nombre: "Sin trabajo", color: "#008300", foco: false },
  { id: "otros", nombre: "Otros", color: "#9085e9", foco: false },
]

export function grupoDe(arquetipo?: string | null): GrupoId {
  return ARQUETIPOS[String(arquetipo || "")]?.grupo || "otros"
}

/** Día calendario en hora argentina (UTC−3) de un instante ISO. */
export function diaAR(iso: string) {
  return new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10)
}

export function sumarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Pieza propia (reel o carrusel) con el ángulo que le asignó el Radar al analizarla. */
export type PiezaPropia = {
  id: string
  url: string | null
  tipo: string | null
  fecha: string
  dia: string
  titulo: string
  views: number | null
  angulo: string | null
  categoria: string | null      // PROBLEMA · SOLUCIÓN · PRODUCTO · MENTALIDAD · VOLUMEN/TOFU (columna dolor del banco)
  angulo_texto: string | null
  keyword: string | null
  analizada: boolean
}

export type FilaTipoAgenda = {
  id: string
  dia_reserva: string           // día en que el lead reservó (hora argentina)
  agenda_id: string | null
  publicado_at: string
  setter: string | null
  nombre_perfil: string | null
  arquetipo: string | null
  arquetipo_secundario: string | null
  macro: string | null
  profesion: string | null
  arquetipo_evidencia: string | null
  foco: boolean | null
  calificada: boolean | null
  ingreso_declarado: string | null
  gatillo_etiqueta: string | null
  gatillo_formato: string | null
  minutos_aviso_resumen: number | null
  seguimientos_n: number | null
  sintesis: string | null
  // de la agenda
  nombre: string | null
  instagram: string | null
  fecha_llamada: string | null
  show: boolean | null
  cerro: boolean | null
  closer: string | null
  cash: number
}

/** Fecha de publicación que trae la etiqueta de la pieza: «Historia | Italia - CLASE - 1/10/26» → 2026-10-01. */
export function fechaDePieza(etiqueta?: string | null): string | null {
  const m = String(etiqueta || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?!.*\d{1,2}\/\d{1,2}\/\d{2,4})/)
  if (!m) return null
  const anio = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
  return `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
}

/** Nombre de la pieza para agrupar: la etiqueta tal cual, o el formato cuando no hay pieza identificada. */
export function piezaDe(f: Pick<FilaTipoAgenda, "gatillo_etiqueta" | "gatillo_formato">): string {
  const e = String(f.gatillo_etiqueta || "").trim()
  if (/follow\s*me\s*ads/i.test(e) || (!e && f.gatillo_formato === "ads")) return "Follow Me Ads (anuncio)"
  if (e) return e
  if (f.gatillo_formato === "outbound") return "Outbound / nuevo seguidor"
  if (f.gatillo_formato === "webinar") return "Webinar / masterclass"
  return "Sin pieza identificada"
}
