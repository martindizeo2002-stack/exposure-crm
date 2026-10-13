import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { sincronizarAudienciaPendientes } from "@/lib/meta-audiencia-pendientes"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET
  return !!expected && request.headers.get("authorization") === `Bearer ${expected}`
}

// Cron cada 15 minutos: reconcilia el público de Meta «Agendas pendientes» con las agendas del CRM.
// ?prueba=1 muestra quiénes tendrían que estar sin tocar Meta.
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const prueba = new URL(request.url).searchParams.get("prueba") === "1"
  try {
    const r = await sincronizarAudienciaPendientes(createSupabaseAdmin(), { prueba })
    // Las personas solo se devuelven en modo prueba; en el cron quedan los conteos.
    return NextResponse.json(prueba ? r : { ...r, personas: undefined })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
