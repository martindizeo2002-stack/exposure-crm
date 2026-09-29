import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { datosRadar } from "@/lib/radar/lectura"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Lo que alimenta las pestañas Semana, Grilla, Semillas y Comentarios: las piezas de los últimos 30 días
// con sus métricas derivadas, las cuentas y la minería de comentarios de la semana.
export async function GET() {
  try {
    return NextResponse.json(await datosRadar(createSupabaseAdmin()), { headers: { "Cache-Control": "private, max-age=60" } })
  } catch (e) {
    console.error("radar datos", e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
