import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { usuarioActual } from "@/lib/push"
import { limpiarHandle } from "@/lib/radar/ingesta"
import { leerSemillas } from "@/lib/radar/lectura"

export const dynamic = "force-dynamic"

// Las cuentas que sigue el Radar. Las ve cualquiera con acceso a Marketing; las agrega, edita y pausa
// dirección y el manager de marketing. No se borran: una cuenta que deja de interesar se pausa
// (activa = false) y su histórico queda.

const GESTION = ["CEO", "Sales Manager", "Manager MKT"]
const TAGS = /^[a-z0-9áéíóúñ-]{2,24}$/
const limpiarTags = (v: unknown) =>
  [...new Set((Array.isArray(v) ? v : String(v || "").split(",")).map((t) => String(t).trim().toLowerCase().replace(/\s+/g, "-")).filter((t) => TAGS.test(t)))].slice(0, 6)

async function gestor() {
  const u = await usuarioActual()
  if (!u) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  if (!GESTION.includes(u.rol)) return { error: NextResponse.json({ error: "Solo dirección y marketing pueden cambiar las cuentas del Radar" }, { status: 403 }) }
  return { u }
}

export async function GET() {
  try {
    return NextResponse.json({ semillas: await leerSemillas(createSupabaseAdmin()) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const g = await gestor()
    if (g.error) return g.error
    const body = await request.json()
    // Se pueden pegar varias de una: separadas por coma, espacio o salto de línea, como @usuario o como link.
    const handles = [...new Set(String(body.handle || body.handles || "").split(/[\s,;]+/).map(limpiarHandle).filter((h) => h.length >= 2 && h.length <= 30))]
    if (!handles.length) return NextResponse.json({ error: "Escribí el usuario de Instagram (@usuario o el link del perfil)" }, { status: 400 })
    if (handles.length > 30) return NextResponse.json({ error: "Hasta 30 cuentas por vez" }, { status: 400 })
    const tags = limpiarTags(body.tags)
    const db = createSupabaseAdmin()
    const { data: ya } = await db.from("radar_semillas").select("handle,activa").in("handle", handles)
    const existentes = new Map((ya || []).map((s) => [String(s.handle), Boolean(s.activa)]))
    const nuevas = handles.filter((h) => !existentes.has(h)).map((handle) => ({
      handle, tags, nota: String(body.nota || "").trim().slice(0, 300) || null, historias: body.historias !== false, creado_por: g.u.nombre || g.u.email,
    }))
    if (nuevas.length) {
      const { error } = await db.from("radar_semillas").insert(nuevas)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Una cuenta que estaba pausada y se vuelve a cargar, se reactiva.
    const pausadas = handles.filter((h) => existentes.get(h) === false)
    if (pausadas.length) await db.from("radar_semillas").update({ activa: true }).in("handle", pausadas)
    return NextResponse.json({ ok: true, agregadas: nuevas.map((s) => s.handle), reactivadas: pausadas, ya_estaban: handles.filter((h) => existentes.get(h) === true), semillas: await leerSemillas(db) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const g = await gestor()
    if (g.error) return g.error
    const body = await request.json()
    const handle = limpiarHandle(body.handle)
    if (!handle) return NextResponse.json({ error: "Falta la cuenta" }, { status: 400 })
    const cambios: Record<string, unknown> = {}
    if (body.activa !== undefined) cambios.activa = Boolean(body.activa)
    if (body.historias !== undefined) cambios.historias = Boolean(body.historias)
    if (body.tags !== undefined) cambios.tags = limpiarTags(body.tags)
    if (body.nota !== undefined) cambios.nota = String(body.nota || "").trim().slice(0, 300) || null
    if (!Object.keys(cambios).length) return NextResponse.json({ error: "Nada para cambiar" }, { status: 400 })
    const db = createSupabaseAdmin()
    const { data, error } = await db.from("radar_semillas").update(cambios).eq("handle", handle).select("handle").maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "No existe la cuenta" }, { status: 404 })
    return NextResponse.json({ ok: true, semillas: await leerSemillas(db) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
