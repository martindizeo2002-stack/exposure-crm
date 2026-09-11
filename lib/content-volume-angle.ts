import { ANGULOS_EXPOSURE } from "@/lib/angulos-exposure"
import { salesAngleId, salesAngleLabel } from "@/lib/sales-angles"

// Los 12 dolores del banco de 25 ángulos (lib/angulos-exposure), en el orden
// en que rota el Volumen semanal. Reemplaza la taxonomía P/M/S/PR de la
// plantilla original: acá el grupo de un ángulo es su dolor.
export const VOLUME_DOLORES = [
  "techo operativo", "falta de vehículo", "procrastinación", "falta de sistema",
  "oferta pobre", "adquisición sin control", "impostor", "autoestima",
  "marca personal", "identidad", "parálisis", "confianza",
] as const

type AngleGroup = typeof VOLUME_DOLORES[number]

// Mix parejo: cada dolor pesa lo mismo, así el Volumen de la semana pasa por
// todos antes de repetir uno.
export const VOLUME_ANGLE_MIX = Object.fromEntries(
  VOLUME_DOLORES.map((dolor) => [dolor, Math.round((100 / VOLUME_DOLORES.length) * 100) / 100]),
) as Record<AngleGroup, number>

// Nivel de consciencia que se guarda en awareness_level según el dolor: los
// dolores de negocio son PROBLEMA, los de cabeza son MENTALIDAD.
const GROUP_AWARENESS: Record<AngleGroup, "PROBLEMA" | "MENTALIDAD"> = {
  "techo operativo": "PROBLEMA",
  "falta de vehículo": "PROBLEMA",
  "falta de sistema": "PROBLEMA",
  "oferta pobre": "PROBLEMA",
  "adquisición sin control": "PROBLEMA",
  "procrastinación": "MENTALIDAD",
  impostor: "MENTALIDAD",
  autoestima: "MENTALIDAD",
  "marca personal": "MENTALIDAD",
  identidad: "MENTALIDAD",
  "parálisis": "MENTALIDAD",
  confianza: "MENTALIDAD",
}

const GROUP_ANGLES = {} as Record<AngleGroup, readonly string[]>
for (const dolor of VOLUME_DOLORES) {
  GROUP_ANGLES[dolor] = ANGULOS_EXPOSURE.filter((a) => a.dolor === dolor).map((a) => salesAngleLabel(a.id) || "").filter(Boolean)
}

function isGroup(value: string): value is AngleGroup {
  return (VOLUME_DOLORES as readonly string[]).includes(value)
}

// Dolor de un ángulo canónico ("12 · ..."). Etiquetas viejas de la plantilla
// (P2, M1...) no mapean y vuelven null, igual que antes con texto desconocido.
export function angleGroup(angle: string | null | undefined): AngleGroup | null {
  const id = salesAngleId(angle)
  if (!id) return null
  const dolor = ANGULOS_EXPOSURE.find((a) => a.id === id)?.dolor || ""
  return isGroup(dolor) ? dolor : null
}

export function nextVolumeAngle(existingAngles: Array<string | null | undefined>) {
  const totalAfterInsert = existingAngles.length + 1
  const groupCounts = Object.fromEntries(
    VOLUME_DOLORES.map((group) => [group, 0]),
  ) as Record<AngleGroup, number>

  for (const angle of existingAngles) {
    const group = angleGroup(angle)
    if (group) groupCounts[group]++
  }

  // Mayor déficit contra el mix; empate → orden del banco (rotación fija).
  const group = [...VOLUME_DOLORES].sort((a, b) => {
    const deficitA = totalAfterInsert * VOLUME_ANGLE_MIX[a] / 100 - groupCounts[a]
    const deficitB = totalAfterInsert * VOLUME_ANGLE_MIX[b] / 100 - groupCounts[b]
    return deficitB - deficitA || VOLUME_DOLORES.indexOf(a) - VOLUME_DOLORES.indexOf(b)
  })[0]

  // Dentro del dolor, el ángulo menos usado; empate → orden del banco.
  const candidates = GROUP_ANGLES[group]
  const candidateCounts = new Map(candidates.map((angle) => [angle, 0]))
  for (const angle of existingAngles) {
    const key = String(angle)
    if (candidateCounts.has(key)) candidateCounts.set(key, (candidateCounts.get(key) || 0) + 1)
  }
  const angle = [...candidates].sort((a, b) =>
    (candidateCounts.get(a) || 0) - (candidateCounts.get(b) || 0) || candidates.indexOf(a) - candidates.indexOf(b),
  )[0]

  return { angle, awarenessLevel: GROUP_AWARENESS[group], dolor: group, mix: VOLUME_ANGLE_MIX }
}
