// Reprogramaciones de llamadas. Una sola regla para la ficha (PATCH /api/agendas), iclosed-sync e ingest/agendas.
//
// Una agenda reprogramada es UNA sola fila en `agendas`, que vive en el día nuevo. El día original queda como
// evento `agenda_reprogramada` (crm_events) con la fecha original y la nueva; con eso el Resumen de ventas la
// muestra en los dos días según el rango que se mire (en el original como "No show · Reprogramó para el …"),
// sin duplicar el lead. Desde el 15/10/2026 toda reprogramación queda con ese evento, venga de donde venga.
//
// La marca "reprogramó" (para separar a los que reprogramaron de los que se presentaron en la primera llamada)
// es la existencia de ese evento: el resultado de la segunda reunión se carga como siempre y se lee
// "Reprogramó y no se presentó", "Reprogramó y no cerró", "Reprogramó y cerró" (ver etiquetaReprogramada).

import type { SupabaseClient } from "@supabase/supabase-js"

export const REPROGRAMADA_EVENT = "agenda_reprogramada"

type AgendaResultado = { show?: boolean | null; cerro?: boolean | null; estado?: string | null; motivo_no_cierre?: string | null }

// Estados que ya son el resultado de UNA llamada presentada: otra fecha en iClosed es otra llamada (2da call),
// no una reprogramación. No show, Reprogramó, Grupo Precall o sin resultado sí se reprograman.
const ESTADOS_DE_LLAMADA_HECHA = new Set(["Fee", "Adentro en Call", "Adentro en FUP", "Cancelado", "Cancelado en precall", "Seguimiento", "Hacer Seguimiento", "Seguimiento por wpp"])
export function llamadaYaHecha(a: AgendaResultado) {
  return a.show === true || a.cerro === true || ESTADOS_DE_LLAMADA_HECHA.has(String(a.estado || ""))
}

const diaDe = (s: unknown) => String(s || "").slice(0, 10)

// Registra la reprogramación (una fila por agenda y día original) y devuelve los campos a resetear en la agenda
// para la llamada nueva: el no show del día original no se arrastra al día nuevo.
export async function registrarReprogramacion(sb: SupabaseClient, args: {
  agendaId: string | number; personId: string | null | undefined; closer?: string | null
  fechaOriginal: string | null | undefined; fechaNueva: string | null | undefined
  origen: "CRM" | "iclosed" | "ingest"; resultadoOriginal?: AgendaResultado
}): Promise<Record<string, unknown>> {
  const diaAnterior = diaDe(args.fechaOriginal)
  const diaNuevo = diaDe(args.fechaNueva)
  if (!args.personId || !diaAnterior || !diaNuevo || diaAnterior === diaNuevo) return {}
  const { error } = await sb.from("crm_events").upsert({
    person_id: args.personId,
    event_type: REPROGRAMADA_EVENT,
    occurred_at: `${diaAnterior}T12:00:00-03:00`,
    source: args.origen,
    source_record_type: "agendas",
    source_record_id: String(args.agendaId),
    title: `Reprogramó del ${diaAnterior} al ${diaNuevo}`,
    metadata: {
      fecha_original: args.fechaOriginal, fecha_nueva: args.fechaNueva, closer: args.closer || null, origen: args.origen,
      resultado_original: args.resultadoOriginal ? { show: args.resultadoOriginal.show ?? null, estado: args.resultadoOriginal.estado ?? null } : null,
    },
    dedupe_key: `${REPROGRAMADA_EVENT}:${args.agendaId}:${diaAnterior}`,
  }, { onConflict: "dedupe_key" })
  if (error) console.error("[reprogramaciones]", error.message)
  // El no show (o "Reprogramó") era de la llamada original: la nueva arranca pendiente.
  const r = args.resultadoOriginal
  if (r && !llamadaYaHecha(r) && (r.show === false || r.estado === "No Show")) return { show: null, cerro: false, estado: "Reprogramó" }
  return {}
}

// Etiqueta del resultado de una agenda que viene de una reprogramación (null si no se reprogramó).
export function etiquetaReprogramada(a: AgendaResultado, reprogramada: boolean): string | null {
  if (!reprogramada) return null
  if (a.cerro === true || a.estado === "Adentro en Call" || a.estado === "Adentro en FUP") return "Reprogramó y cerró"
  if (a.estado === "Fee") return "Reprogramó y dejó fee"
  if (a.show === true) return "Reprogramó y no cerró"
  if (a.show === false || a.estado === "No Show") return "Reprogramó y no se presentó"
  return "Reprogramó · pendiente"
}
