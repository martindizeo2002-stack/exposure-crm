import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const sb = createSupabaseAdmin()

    // 1. Buscar todos los registros de Agus Garcia
    const { data: records, error } = await sb
      .from("agendas")
      .select("id, nombre, closer, setter, fecha_agenda, fecha_closer, show, cerro, estado, calificacion, motivo_no_cierre, created_at, iclosed_id")
      .or("nombre.ilike.%agus%garcia%,nombre.ilike.%agustin%garcia%")
      .order("id", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!records || records.length === 0) {
      // Buscar con filtro mas amplio
      const { data: broader, error: bErr } = await sb
        .from("agendas")
        .select("id, nombre, closer, setter, fecha_agenda, fecha_closer, show, cerro, estado, calificacion, motivo_no_cierre, created_at, iclosed_id")
        .or("nombre.ilike.%agus%,nombre.ilike.%garcia%")
        .order("id", { ascending: true })

      return NextResponse.json({
        foundDirect: 0,
        broaderResults: broader || [],
        bErr: bErr?.message,
      })
    }

    let archivedResult = null

    if (action === "archive_oct8") {
      // Identificar el registro del 8/10 y el del 6/10
      const recOct8 = records.find(r => 
        (r.fecha_closer && r.fecha_closer.includes("2026-10-08")) ||
        (r.fecha_agenda && r.fecha_agenda.includes("2026-10-08"))
      )

      if (recOct8) {
        const { data: arch, error: aErr } = await sb
          .from("agendas")
          .update({
            estado: "Archivada manualmente",
            motivo_no_cierre: "Archivado manual: Duplicado de llamada tomada el 06/10",
            updated_at: new Date().toISOString(),
          })
          .eq("id", recOct8.id)
          .select()

        archivedResult = { archivedId: recOct8.id, data: arch, error: aErr?.message }
      } else if (records.length > 1) {
        // Fallback: si hay dos y ninguno dice 8/10 explicitamente en fecha_closer,
        // archivar el que NO sea del 6/10 o el mas reciente
        const toArchive = records[records.length - 1]
        const { data: arch, error: aErr } = await sb
          .from("agendas")
          .update({
            estado: "Archivada manualmente",
            motivo_no_cierre: "Archivado manual: Duplicado",
            updated_at: new Date().toISOString(),
          })
          .eq("id", toArchive.id)
          .select()

        archivedResult = { archivedId: toArchive.id, fallback: true, data: arch, error: aErr?.message }
      }

      // Asegurar que el registro del 6/10 quede impecable con Nahuel
      const recOct6 = records.find(r => 
        (r.fecha_closer && r.fecha_closer.includes("2026-10-06")) ||
        (r.fecha_agenda && r.fecha_agenda.includes("2026-10-06"))
      ) || records[0]

      if (recOct6 && recOct6.id !== (archivedResult?.archivedId)) {
        await sb
          .from("agendas")
          .update({
            closer: "Nahuel",
            estado: recOct6.estado === "Archivada manualmente" ? "Seguimiento" : recOct6.estado,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recOct6.id)
      }
    }

    // Consultar estado final tras la acción
    const { data: finalRecords } = await sb
      .from("agendas")
      .select("id, nombre, closer, setter, fecha_agenda, fecha_closer, show, cerro, estado, calificacion, motivo_no_cierre")
      .in("id", records.map(r => r.id))

    return NextResponse.json({
      recordsFound: records,
      archivedResult,
      finalRecords,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
