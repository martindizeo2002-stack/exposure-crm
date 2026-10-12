export type RecordingWindow = {
  start: string
  end: string
}

// Configuración manual de la vista "Grabar YA" de Alex.
// No se mueve con la fecha: solo cambia cuando el equipo habilita otro bloque.
// 12 al 18/10/2026: semana de captación (21 creativos, plan con Nahue del 09/10).
export const RECORDING_WINDOW: RecordingWindow = {
  start: "2026-10-12",
  end: "2026-10-18",
}
