import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { effectiveCRMRole } from "@/lib/role-access"
import { responderGlobo } from "@/lib/asistente-globo"

export const dynamic = "force-dynamic"
export const maxDuration = 300  // Opus 5.5 con varias consultas encadenadas

// Globo del asistente (components/asistente-globo.tsx). El permiso de la ruta lo controla /api/asistente en lib/role-access.
export async function POST(request: Request) {
  try {
    const auth = await createSupabaseServer()
    const { data: { user } } = await auth.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const { data: member } = await createSupabaseAdmin().from("team_members").select("rol,estado,nombre").eq("email", user.email.toLowerCase()).maybeSingle()
    if (member?.estado !== "aprobado") return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 })
    const body = await request.json().catch(() => ({}))
    const pregunta = String(body.question || "").trim().slice(0, 1200)
    if (!pregunta) return NextResponse.json({ error: "Escribí qué querés saber" }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY" }, { status: 500 })
    const actor = { rol: effectiveCRMRole(member.rol, member.nombre) || "", nombre: member.nombre || "", email: user.email.toLowerCase() }
    const historial = Array.isArray(body.historial) ? body.historial : []
    const r = await responderGlobo(pregunta, actor, historial, String(body.pantalla || "").slice(0, 120))
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Error de servidor" }, { status: 500 })
  }
}
