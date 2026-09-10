export type Severity = "alta" | "media" | "baja"

export function slaHours(severity: Severity) {
  return severity === "alta" ? 2 : severity === "media" ? 24 : 72
}

export function engagementSignal(lastActivity: Date | null, now = new Date()) {
  if (!lastActivity) return "sin_evidencia" as const
  const days = Math.max(0, Math.floor((now.getTime() - lastActivity.getTime()) / 86_400_000))
  if (days >= 14) return "inactividad_14d" as const
  if (days >= 7) return "inactividad_7d" as const
  return "actividad_reciente" as const
}

export function financeDistribution(input: { occurredOn: string; isRenewal: boolean | null; soldBy?: string | null; originAccount?: string | null }) {
  const active = input.occurredOn >= "2026-08-01"
  const soldBy = String(input.soldBy || "").trim().toLowerCase()
  const origin = String(input.originAccount || "").trim().toLowerCase()
  if (active && input.isRenewal === true && ["paul", "paul aragorn"].includes(soldBy)) {
    return { rule: "paul_renewal", paul: 0.65, cristian: 0.35, priority: 1 }
  }
  if (active && ["@cuenta.principal", "cuenta.principal"].includes(origin)) {
    return { rule: "paul_origin", paul: 0.8, cristian: 0.2, priority: 2 }
  }
  return { rule: "default", paul: 0.5, cristian: 0.5, priority: 3 }
}
