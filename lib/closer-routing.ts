export const CLOSER_YAFE = "Yafé"
export const CLOSER_TOMMY = "Tommy"

export function canonicalCloserName(value: unknown) {
  const raw = String(value || "").trim()
  const key = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  if (["tomas ardu", "tomi", "tommy"].includes(key)) return CLOSER_TOMMY
  if (["tomas yafe mola", "tomas yafe", "yafe"].includes(key)) return CLOSER_YAFE
  return raw
}

export function closerForScore(score: string | null | undefined) {
  const tier = String(score || "").toUpperCase().replace("LEAD ", "").trim()
  if (["S", "A", "B"].includes(tier)) return CLOSER_YAFE
  if (["C", "D"].includes(tier)) return CLOSER_TOMMY
  return null
}
