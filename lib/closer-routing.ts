import { nombreCanonico } from "@/lib/equipo"

// Normaliza el nombre del closer que llega de iClosed/ingest (apodos como
// "Nawe" → "Nahuel"). Nombres desconocidos vuelven tal cual.
export function canonicalCloserName(value: unknown) {
  const raw = String(value || "").trim()
  if (!raw) return raw
  // nombreCanonico devuelve el primer nombre normalizado ("Cristian Lescano" → "Cristian", "Nawe" → "Nahuel");
  // el CRM identifica a los closers por ese primer nombre
  return nombreCanonico(raw) || raw
}

// La plantilla original ruteaba S/A/B a un closer y C/D a otro. EXPOSURE no
// tiene una regla de asignación por calificación definida: se respeta el
// closer que traiga la agenda y no se asigna ninguno automáticamente.
export function closerForScore(_score: string | null | undefined): string | null {
  return null
}
