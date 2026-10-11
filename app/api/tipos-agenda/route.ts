import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { diaAR, type FilaTipoAgenda, type PiezaPropia } from "@/lib/tipos-agenda"

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
        dia_reserva: diaAR(a?.fecha_agenda ? `${String(a.fecha_agenda).slice(0, 19)}Z` : r.publicado_at),
        nombre: a?.nombre ?? null,
        instagram: a?.instagram ?? null,
        fecha_llamada: a?.fecha_closer || a?.fecha_agenda || null,
        show: a?.show ?? null,
        cerro: a?.cerro ?? null,
        closer: a?.closer ?? null,
        cash: plata,
      } as FilaTipoAgenda
    })

    // Piezas propias publicadas en el período (y dos días antes), con el ángulo que les asignó el Radar
    const [{ data: crudas, error: ep }, { data: banco }] = await Promise.all([
      db.from("radar_piezas").select("id,url,tipo_media,fecha,caption,views,analisis")
        .eq("cuenta_fuente", "alexmcarrera").gte("fecha", new Date(new Date(desde).getTime() - 2 * 86400000).toISOString())
        .order("fecha", { ascending: true }).limit(2000),
      db.from("crm_angulos").select("titulo,dolor"),
    ])
    if (ep) throw ep
    const clave = (s: unknown) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim()
    const categoria = new Map((banco || []).map((b) => [clave(b.titulo), String(b.dolor || "")]))
    const piezas: PiezaPropia[] = (crudas || []).map((p) => {
      const a = (p.analisis || {}) as Record<string, unknown>
      const angulo = String(a.angulo_bm_nombre || "").trim() || null
      return {
        id: p.id, url: p.url, tipo: p.tipo_media, fecha: p.fecha, dia: diaAR(p.fecha),
        titulo: String(p.caption || "").split("\n")[0].slice(0, 120), views: p.views,
        angulo, categoria: angulo ? categoria.get(clave(angulo)) || null : null,
        angulo_texto: a.angulo_comunicacion ? String(a.angulo_comunicacion) : null,
        keyword: a.keyword ? String(a.keyword) : null, analizada: Boolean(p.analisis),
      }
    })

    // Follow Me Ads → agendas (lo carga Central Negocio/scripts/ads/anuncios-agendas.py --aplicar)
    const { data: fm } = await db.from("crm_integration_assets").select("metadata")
      .eq("source", "fm-ads").eq("asset_type", "atribucion").eq("source_id", "ultimo").maybeSingle()

    return NextResponse.json({ desde, dias, filas, piezas, fmAds: fm?.metadata ?? null })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
