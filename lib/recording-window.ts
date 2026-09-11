export type RecordingWindow = {
  start: string
  end: string
}

// Configuración manual de la vista "Grabar YA" de Alex.
// No se mueve con la fecha: solo cambia cuando el equipo habilita otro bloque.
export const RECORDING_WINDOW: RecordingWindow = {
  start: "2026-09-11",
  end: "2026-09-13",
}
