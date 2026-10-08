import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const sb = createSupabaseAdmin()

    const originalId = "998262ee-2eaa-4902-ab61-ecb8d2122770"
    const duplicateIds = [
      "00480eaa-5d80-4d43-ad59-7c617ffdd4da",
      "a68ba429-2424-425f-84aa-e308ae883ebe",
    ]

    let actionResults = null

    if (action === "archive_duplicates") {
      // 1. Archivar los dos duplicados
      const { data: archData, error: archErr } = await sb
        .from("agendas")
        .update({
          estado: "Archivada manualmente",
          motivo_no_cierre: "Archivado manual: Duplicado de llamada original del 06/10",
          updated_at: new Date().toISOString(),
        })
        .in("id", duplicateIds)
        .select("id, nombre, estado")

      // 2. Asegurar que el registro original esté activo bajo Nahuel
      const { data: origData, error: origErr } = await sb
        .from("agendas")
        .update({
          closer: "Nahuel",
          estado: "Se presentó",
          calificacion: "LEAD C",
          motivo_no_cierre: "Miedo",
          show: true,
          cerro: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", originalId)
        .select("id, nombre, closer, estado, calificacion, motivo_no_cierre")

      actionResults = {
        archivedDuplicates: archData,
        archError: archErr?.message,
        preservedOriginal: origData,
        origError: origErr?.message,
      }
    }

    // Consultar estado de los tres registros
    const { data: currentRecords } = await sb
      .from("agendas")
      .select("id, nombre, closer, setter, fecha_agenda, fecha_closer, show, cerro, estado, calificacion, motivo_no_cierre")
      .in("id", [originalId, ...duplicateIds])

    return NextResponse.json({
      actionResults,
      currentRecords,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
