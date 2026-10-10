import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import type { FilaTipoAgenda } from "@/lib/tipos-agenda"

export const dynamic = "force-dynamic"

// Resúmenes de setting clasificados + el resultado de su agenda (presentada, cierre) + cash de la persona.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dias = Math.min(400, Math.max(7, Number(searchParams.get("dias") || 90) || 90))
    const desde = new Date(Date.now() - dias * 86400000).toISOString()
    const db = createSupabaseAdmin()

    const { data: resumenes, error } = await db
      .from("crm_setting_resumenes")
      .select("id,agenda_id,person_id,publicado_at,setter,nombre_perfil,arquetipo,arquetipo_secundario,macro,profesion,arquetipo_evidencia,foco,calificada,ingreso_declarado,gatillo_etiqueta,gatillo_formato,minutos_aviso_resumen,seguimientos_n,sintesis")
      .gte("publicado_at", desde)
      .order("publicado_at", { ascending: false })
      .limit(5000)
    if (error) throw error

    const ids = Array.from(new Set((resumenes || []).map((r) => r.agenda_id).filter(Boolean))) as string[]
    const agendas = new Map<string, any>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error: e } = await db.from("agendas")
        .select("id,nombre,instagram,fecha_closer,fecha_agenda,show,cerro,closer,person_id")
        .in("id", ids.slice(i, i + 200))
      if (e) throw e
      for (const a of data || []) agendas.set(a.id, a)
    }

    // Cash por persona desde la primera agenda del período (pagos no anulados)
    const personas = Array.from(new Set([...agendas.values()].map((a) => a.person_id).filter(Boolean))) as string[]
    const cash = new Map<string, number>()
    for (let i = 0; i < personas.length; i += 200) {
      const { data, error: e } = await db.from("pagos")
        .select("person_id,monto,fecha,voided_at")
        .in("person_id", personas.slice(i, i + 200))
        .gte("fecha", desde.slice(0, 10))
        .is("voided_at", null)
      if (e) throw e
      for (const p of data || []) cash.set(p.person_id, (cash.get(p.person_id) || 0) + Number(p.monto || 0))
    }

    // Si dos resúmenes apuntan a la misma agenda, el cash se cuenta una sola vez (en el más reciente).
    const contada = new Set<string>()
    const filas: FilaTipoAgenda[] = (resumenes || []).map((r) => {
      const a = r.agenda_id ? agendas.get(r.agenda_id) : null
      const persona = a?.person_id || null
      const plata = persona && !contada.has(persona) ? cash.get(persona) || 0 : 0
      if (persona) contada.add(persona)
      return {
        ...r,
        nombre: a?.nombre ?? null,
        instagram: a?.instagram ?? null,
        fecha_llamada: a?.fecha_closer || a?.fecha_agenda || null,
        show: a?.show ?? null,
        cerro: a?.cerro ?? null,
        closer: a?.closer ?? null,
        cash: plata,
      } as FilaTipoAgenda
    })

    return NextResponse.json({ desde, dias, filas })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
