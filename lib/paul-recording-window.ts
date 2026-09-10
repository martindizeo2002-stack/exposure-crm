export type RecordingWindow = {
  start: string
  end: string
}

// Configuración manual de la vista "Grabar YA" de Cuenta A.
// No se mueve con la fecha: solo cambia cuando Valen habilita otro bloque.
export const PAUL_RECORDING_WINDOW: RecordingWindow = {
  start: "2026-09-11",
  end: "2026-09-13",
}
