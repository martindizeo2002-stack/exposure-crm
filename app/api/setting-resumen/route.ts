import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { nombreCanonico } from "@/lib/equipo"
import { cruzarLead, parchesDe, semanaDe, norm, type AgendaCruce, type LeadReporte } from "@/lib/setting-cruce"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// Generador de resúmenes de setting. El setter pega las notas crudas del día (lo que escribe en su
// bloc de notas) y Claude las convierte en el mismo reporte estructurado que sus dashboards
// (KPIs del día + lead por lead) más un mensaje listo para WhatsApp. "Guardar" lo deja en el CRM
// exactamente como los reportes cargados por script: crm_integration_assets (source=setting), la
// agenda de cada lead completada, un evento por persona y las métricas semanales del setter.

const CLAUDE_URL = "https://api.anthropic.com/v1/messages"
const MODELOS = ["claude-sonnet-5", "claude-sonnet-4-6"]
const TIPOS: Record<string, string> = { calendarios_enviados: "calendarios_enviados", agendas: "setting_agendas", calificados_dia: "setting_calificados", fups: "setting_fups", nuevos_seguidores: "setting_nuevos_seguidores", outbound_enviados: "setting_outbound_enviados", outbound_respuestas: "setting_outbound_respuestas" }
const NUMEROS = ["calendarios_enviados", "agendas", "calificados_dia", "fups", "nuevos_seguidores", "ns_contestan", "ns_califican", "ns_bookeados", "historia_comentaron", "historia_calificaron", "historia_bookeados", "outbound_enviados", "outbound_respuestas", "outbound_agendas"] as const

type Dia = Record<(typeof NUMEROS)[number], number | null> & { fecha: string; setter: string; historia: string | null; leads: LeadReporte[]; observaciones?: string[]; resumen_whatsapp?: string; notas?: string; origen?: string; archivo?: string }

const SYSTEM = `Sos el analista de setting de EXPOSURE (programa high ticket para construir un negocio como IA Partner; el setter trabaja la cuenta de Instagram, los DMs de ManyChat y agenda llamadas de venta en iClosed).
Recibís las NOTAS CRUDAS que el setter escribió al final del día y devolvés el reporte del día en JSON, con la misma estructura que sus dashboards diarios.

REGLAS
- No inventes nada. Si un número o un dato no está en las notas, va null. Nunca estimes.
- "Calificado" acá significa negocio + dolor identificados. NO significa capacidad de pago.
- Los números del día suelen venir en una frase tipo: "15 leads nuevos mandaron de 113 que nos siguieron, hice 89 fups y 68 outbound, de la historia comentaron 47, 5 leads agendaron de 9 que se les mandó calendario y 11 calificados". Eso es: nuevos_seguidores 113, ns_contestan 15, fups 89, outbound_enviados 68, historia_comentaron 47, agendas 5, calendarios_enviados 9, calificados_dia 11.
- Cada lead agendado viene como bloque "Nombre de perfil: usuario (Nombre)" seguido de situación actual, freno/dolor, objetivo, caso de éxito enviado, contenido consumido, origen, material enviado, contenido gatillo, ciclo de agenda, seguimientos, historial y síntesis para el closer. Volcá cada bloque a un elemento de "leads".
- "lead": tal cual lo escribió el setter (ej. "kozzue (Josué)"). "usuario": el usuario de Instagram si se distingue, si no el nombre. "nombre": el nombre de pila si aparece entre paréntesis, si no el mismo lead.
- "origen": de dónde vino (ej. "Ads (nuevo seguidor)", "Inbound (Historia) de los 47 que pusieron Yo", "Nuevo seguidor + Reel orgánico", "Outbound setter reactivó"). "gatillo": qué disparó la agenda ("Historia Masterclass — Yo", "Reel Solución", "Setter/DM", "Follow Me Ads"). "feed": contenido orgánico consumido según etiquetas, o null. "ciclo": tiempo entre primer contacto y agenda ("≤1 día", "2–7 días", "Reactivación (1er contacto 2/5, ~3 meses)"). "fups": cantidad de seguimientos hasta agendar, o null.
- "dolor" y "objetivo": una línea cada uno, en las palabras del lead cuando se pueda. "sintesis_closer": 2 a 4 líneas para que el closer entre a la llamada sabiendo quién es, qué le duele, qué quiere y con qué predisposición llega.
- "resumen_whatsapp": el mensaje que el setter le manda al equipo por WhatsApp. Formato WhatsApp (negritas con *asteriscos*, sin markdown de otro tipo, emojis con moderación). Estructura: título "*Setting DD/MM*"; una línea con calendarios → agendas y calificados; una línea por embudo (nuevos seguidores → contestan → califican → bookean; historia del día → comentaron → calificaron → bookeados; outbound → respuestas → agendas), solo si hay datos; luego "*Agendas del día*" con una línea por lead: nombre — origen — dolor corto — objetivo corto; y al final "*Para el closer*" con lo más importante de cada lead en una línea. Máximo 2500 caracteres. Solo datos de las notas.
- "observaciones": 1 a 4 frases sobre lo que dicen los números (qué gatillo dominó, qué embudo rindió, qué falta). Sin consejos genéricos.
- Salida: SOLO el JSON, sin texto antes ni después, sin bloques de código.

ESQUEMA
{"fecha":"YYYY-MM-DD","calendarios_enviados":int|null,"agendas":int|null,"calificados_dia":int|null,"fups":int|null,"nuevos_seguidores":int|null,"ns_contestan":int|null,"ns_califican":int|null,"ns_bookeados":int|null,"historia":string|null,"historia_comentaron":int|null,"historia_calificaron":int|null,"historia_bookeados":int|null,"outbound_enviados":int|null,"outbound_respuestas":int|null,"outbound_agendas":int|null,"leads":[{"lead":str,"usuario":str,"nombre":str,"origen":str|null,"calificado":bool,"ciclo":str|null,"gatillo":str|null,"feed":str|null,"fups":int|null,"dolor":str|null,"objetivo":str|null,"sintesis_closer":str|null,"caso_exito":str|null,"material_enviado":str|null}],"observaciones":[str],"resumen_whatsapp":str}`

async function claude(system: string, user: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("Falta configurar ANTHROPIC_API_KEY")
  let ultimo = ""
  for (const model of MODELOS) {
    const r = await fetch(CLAUDE_URL, {
      method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: "user", content: user }] }),
    })
    if (r.status === 404) { ultimo = await r.text(); continue }  // ese modelo no está disponible para la clave: probar el siguiente
    if (!r.ok) throw new Error(`Claude HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
    const j = await r.json()
    return (j.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n")
  }
  throw new Error(`Ningún modelo disponible: ${ultimo.slice(0, 200)}`)
}
function jsonDe(texto: string) {
  const i = texto.indexOf("{"), f = texto.lastIndexOf("}")
  if (i < 0 || f < i) throw new Error("Claude no devolvió JSON")
  return JSON.parse(texto.slice(i, f + 1))
}
const entero = (v: unknown) => { if (v === null || v === undefined || v === "") return null; const n = Number(String(v).replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? Math.round(n) : null }
const texto = (v: unknown, max = 600) => { const t = String(v ?? "").trim(); return t && t !== "null" ? t.slice(0, max) : null }

function limpiarDia(bruto: Record<string, unknown>, fecha: string, setter: string): Dia {
  const leads = (Array.isArray(bruto.leads) ? bruto.leads : []).map((l: Record<string, unknown>) => ({
    lead: texto(l.lead, 120) || texto(l.nombre, 120) || texto(l.usuario, 120) || "sin nombre",
    usuario: texto(l.usuario, 120) || texto(l.lead, 120) || "", nombre: texto(l.nombre, 120) || texto(l.lead, 120) || "",
    origen: texto(l.origen, 200), calificado: l.calificado === true || /^s/i.test(String(l.calificado || "")), ciclo: texto(l.ciclo, 120), gatillo: texto(l.gatillo, 200), feed: texto(l.feed, 300),
    fups: entero(l.fups), dolor: texto(l.dolor, 500), objetivo: texto(l.objetivo, 300), sintesis_closer: texto(l.sintesis_closer, 1200), caso_exito: texto(l.caso_exito, 300), material_enviado: texto(l.material_enviado, 400),
  }))
  const d = { fecha, setter, historia: texto(bruto.historia, 120), leads, observaciones: (Array.isArray(bruto.observaciones) ? bruto.observaciones : []).map((o: unknown) => String(o)).slice(0, 6), resumen_whatsapp: texto(bruto.resumen_whatsapp, 4000) || "" } as Dia
  for (const k of NUMEROS) d[k] = entero(bruto[k])
  if (d.agendas === null && leads.length) d.agendas = leads.length
  return d
}

export async function GET(request: Request) {
  const sb = createSupabaseAdmin()
  const { searchParams } = new URL(request.url)
  const limite = Math.min(60, Number(searchParams.get("limite") || 20) || 20)
  const { data, error } = await sb.from("crm_integration_assets").select("source_id,name,metadata,last_seen_at").eq("source", "setting").eq("asset_type", "dia").order("source_id", { ascending: false }).limit(limite)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dias: (data || []).map((r) => { const m = r.metadata as Dia; return { fecha: r.source_id, setter: m.setter, calendarios_enviados: m.calendarios_enviados, agendas: m.agendas, calificados_dia: m.calificados_dia, fups: m.fups, leads: (m.leads || []).length, cruzados: (m.leads || []).filter((l) => l.agenda_id).length, origen: m.origen || "dashboard", resumen_whatsapp: m.resumen_whatsapp || null, guardado: r.last_seen_at } }) })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const accion = String(body.accion || "generar")
    const hoy = new Date().toISOString().slice(0, 10)
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha || "")) ? String(body.fecha) : hoy
    const setter = nombreCanonico(String(body.setter || "")) || String(body.setter || "").split(" ")[0] || "Maximo"

    if (accion === "generar") {
      const notas = String(body.notas || "").trim()
      if (notas.length < 40) return NextResponse.json({ error: "Pegá las notas del día (al menos unas líneas)." }, { status: 400 })
      const salida = await claude(SYSTEM, `Fecha del reporte: ${fecha}. Setter: ${setter}.\n\nNOTAS CRUDAS DEL SETTER:\n"""\n${notas.slice(0, 60000)}\n"""`)
      const dia = limpiarDia(jsonDe(salida), fecha, setter)
      return NextResponse.json({ ok: true, dia })
    }

    if (accion === "guardar") {
      const dia = limpiarDia((body.dia || {}) as Record<string, unknown>, fecha, setter)
      if (body.resumen_whatsapp) dia.resumen_whatsapp = String(body.resumen_whatsapp).slice(0, 4000)
      dia.notas = String(body.notas || "").slice(0, 60000) || undefined
      dia.origen = "generador"
      const sb = createSupabaseAdmin()
      const desde = new Date(new Date(fecha).getTime() - 11 * 86400000).toISOString().slice(0, 10)
      const hasta = new Date(new Date(fecha).getTime() + 11 * 86400000).toISOString().slice(0, 10)
      const { data: filas, error: eAg } = await sb.from("agendas").select("id,nombre,instagram,fecha_agenda,fecha_closer,person_id,fuente,recurso,angulo_entrada,problema_actual,motivo_urgencia,setter")
        .or(`fecha_agenda.gte.${desde},fecha_closer.gte.${desde}`).or(`fecha_agenda.lte.${hasta}T23:59:59,fecha_closer.lte.${hasta}T23:59:59`).limit(2000)
      if (eAg) throw new Error(eAg.message)
      const agendas: AgendaCruce[] = (filas || []).map((a) => ({ ...a, fecha: (a.fecha_agenda || a.fecha_closer || null) as string | null }))
      const sinAgenda: string[] = [], ambiguos: string[] = []
      let enlazados = 0, completadas = 0, eventos = 0
      for (const l of dia.leads) {
        const r = cruzarLead(l, fecha, agendas)
        if (!r.agenda) { l.agenda_id = null; l.cruce = null; (r.motivo === "ambiguo" ? ambiguos : sinAgenda).push(r.ambiguo ? `${l.lead} → ${r.ambiguo}` : l.lead); continue }
        l.agenda_id = r.agenda.id; l.agenda_nombre = r.agenda.nombre; l.cruce = `${r.motivo} (${r.puntos})`
        enlazados++
        const parches = parchesDe(l, r.agenda, setter)
        if (Object.keys(parches).length) {
          const { error } = await sb.from("agendas").update(parches).eq("id", r.agenda.id)
          if (error) throw new Error(error.message)
          completadas++
          Object.assign(r.agenda, parches)
        }
        if (r.agenda.person_id) {
          const { error } = await sb.from("crm_events").upsert({
            person_id: r.agenda.person_id, event_type: "setting_report", occurred_at: `${fecha}T12:00:00Z`, source: "setting", source_record_type: "generador", source_record_id: fecha,
            title: `Reporte del setter · ${l.origen || "sin origen"}`, metadata: { origen: l.origen, calificado: l.calificado, ciclo: l.ciclo, gatillo: l.gatillo, feed: l.feed, fups: l.fups, dolor: l.dolor, objetivo: l.objetivo, sintesis_closer: l.sintesis_closer, agenda_id: r.agenda.id },
            dedupe_key: `setting:${fecha}:${norm(l.lead)}`,
          }, { onConflict: "dedupe_key" })
          if (error) throw new Error(error.message)
          eventos++
        }
      }
      const { error: eDia } = await sb.from("crm_integration_assets").upsert({ source: "setting", asset_type: "dia", source_id: fecha, name: `Setting ${fecha} · ${setter}`, metadata: dia, last_seen_at: new Date().toISOString() }, { onConflict: "source,asset_type,source_id" })
      if (eDia) throw new Error(eDia.message)

      // métricas semanales del mes, recalculadas con todos los días guardados de ese setter
      const mes = fecha.slice(0, 7)
      const { data: diasMes } = await sb.from("crm_integration_assets").select("source_id,metadata").eq("source", "setting").eq("asset_type", "dia").gte("source_id", `${mes}-01`).lte("source_id", `${mes}-31`)
      const sumas = new Map<string, number>()
      for (const r of diasMes || []) {
        const m = r.metadata as Dia
        if ((m.setter || "Maximo") !== setter) continue
        for (const [campo, tipo] of Object.entries(TIPOS)) {
          const v = m[campo as keyof Dia]
          if (typeof v !== "number") continue
          const k = `${tipo}|${semanaDe(r.source_id)}`
          sumas.set(k, (sumas.get(k) || 0) + v)
        }
      }
      await sb.from("metricas_manual").delete().eq("mes", mes).eq("persona", setter).in("tipo", Object.values(TIPOS))
      if (sumas.size) {
        const { error } = await sb.from("metricas_manual").insert([...sumas.entries()].map(([k, valor]) => { const [tipo, semana] = k.split("|"); return { tipo, valor, mes, semana, persona: setter } }))
        if (error) throw new Error(error.message)
      }
      return NextResponse.json({ ok: true, fecha, setter, leads: dia.leads.length, enlazados, completadas, eventos, sinAgenda, ambiguos, metricas: sumas.size })
    }
    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
