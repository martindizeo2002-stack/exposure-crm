export type BusinessAccount = "paul" | "cris"

export type AccountIdentity = {
  person_id?: string | null
  telefono?: string | null
}

export type AccountAgenda = AccountIdentity & {
  cuenta?: string | null
  fecha_agenda?: string | null
  fecha_closer?: string | null
  created_at?: string | null
}

export function normalizeBusinessAccount(value: string | null | undefined): BusinessAccount | null {
  const normalized = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  if (normalized.includes("cristian") || normalized.includes("cris")) return "cris"
  if (normalized.includes("paul")) return "paul"
  return null
}

function identityKeys(row: AccountIdentity) {
  const phone = String(row.telefono || "").replace(/\D/g, "")
  return [row.person_id ? `p:${row.person_id}` : "", phone ? `t:${phone}` : ""].filter(Boolean)
}

function agendaDate(row: AccountAgenda) {
  return String(row.fecha_agenda || row.fecha_closer || row.created_at || "").slice(0, 10)
}

export function buildAccountAttributor(agendas: AccountAgenda[]) {
  const histories = new Map<string, AccountAgenda[]>()
  for (const agenda of agendas) {
    if (!normalizeBusinessAccount(agenda.cuenta)) continue
    for (const key of identityKeys(agenda)) {
      const rows = histories.get(key) || []
      rows.push(agenda)
      histories.set(key, rows)
    }
  }
  for (const rows of histories.values()) rows.sort((a, b) => agendaDate(a).localeCompare(agendaDate(b)))

  return (row: AccountIdentity, date?: string | null): BusinessAccount | null => {
    const candidates = [...new Map(identityKeys(row).flatMap(key => histories.get(key) || []).map(agenda => [String(agenda.person_id || agenda.telefono || "") + agendaDate(agenda), agenda])).values()]
    if (!candidates.length) return null
    const day = String(date || "").slice(0, 10)
    const prior = day ? candidates.filter(agenda => agendaDate(agenda) <= day) : candidates
    const chosen = (prior.length ? prior : candidates).at(-1)
    return normalizeBusinessAccount(chosen?.cuenta)
  }
}
