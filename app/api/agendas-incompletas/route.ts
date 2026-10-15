import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { createSupabaseServer } from "@/lib/supabase-server"
import { effectiveCRMRole } from "@/lib/role-access"
import { closerMissing, setterMissing, operationalStage } from "@/lib/crm-compliance"
import { armarEnlazador, tel9, tokens, mismoNombre } from "@/lib/embudo-atribucion"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Agendas que el Home cuenta en "CRM por completar" (misma regla: lib/crm-compliance) con, para cada una,
// qué le falta, por qué y qué se puede completar solo:
//  · otra agenda de la misma persona que ya tiene el dato (duplicado o reagenda) → se copia y, si es la misma
//    llamada, la copia vacía se archiva (no queda el lead dos veces);
//  · la grabación de Fathom (link, presentado y motivo del análisis);
//  · los pagos del CRM (operación, plan, medio, comprobante, CC día 1, fecha TC);
//  · las respuestas del formulario de iClosed (datos del setter).
// GET ?mes=AAAA-MM → diagnóstico. POST { cambios: [{ id, campos }], archivar: [{ id, hacia, motivo }] } → aplica.

const AG_COLS = "id,person_id,nombre,telefono,instagram,fecha_agenda,fecha_closer,closer,setter,call_confirmer,calificacion,show,cerro,estado,motivo_no_cierre,link_fathom,operacion,plan_de_pago,medio_de_pago,comprobante,cc_dia_1,fecha_tc,motivo_urgencia,problema_actual,tiempo_problema,intentos_previos,ingresos,inversion,resumen_chat,ocupacion,updated_at,created_at"
const CAMPOS_EDITABLES = new Set(["show", "motivo_no_cierre", "link_fathom", "operacion", "plan_de_pago", "medio_de_pago", "comprobante", "cc_dia_1", "fecha_tc", "estado", "calificacion", "problema_actual", "motivo_urgencia", "tiempo_problema", "intentos_previos", "ingresos", "inversion", "ocupacion"])
const FRONT_END = /venta nueva|adentro en seguimiento|complet|^fee|refuerzo de fee/i

const MOTIVOS: Array<[RegExp, string]> = [
  [/caro|precio alto/i, "Le parecia caro"],
  [/\bpif\b/i, "No llego al PIF"],
  [/cuota/i, "No llegaba a la Cuota 1"],
  [/desconf|estaf|confian/i, "Desconfianza"],
  [/miedo|riesgo/i, "Miedo"],
  [/padre|madre|pareja|espos|socio|familia|mayor/i, "Necesitaba de un mayor para la decision"],
  [/m[eé]todo de pago|tarjeta|banco|transferencia/i, "Metodo de pago"],
  [/desemple/i, "Era desempleado"],
  [/urgencia/i, "No tenia urgencia"],
  [/no califica|descalific|menor de edad/i, "No Califica"],
  [/dinero|plata|fondos|recursos|ahorro|no tiene|no ten[ií]a/i, "No tenia dinero ni apoyo"],
  [/pensar|pensarlo|analizar|decidir/i, "Lo tenia que pensar"],
]
function motivoDesdeTexto(txt: unknown): string | null {
  const s = String(txt || "")
  if (!s.trim()) return null
  return MOTIVOS.find(([re]) => re.test(s))?.[1] || null
}
const vacio = (v: unknown) => v == null || String(v).trim() === "" || (typeof v === "number" && v === 0)
const dia = (s: unknown) => String(s || "").slice(0, 10)
const diasEntre = (a: unknown, b: unknown) => Math.abs(Date.parse(dia(a)) - Date.parse(dia(b))) / 864e5
const normIg = (s: unknown) => String(s || "").replace(/[@\s]/g, "").toLowerCase()

async function autorizar() {
  const session = await createSupabaseServer()
  const { data: { user } } = await session.auth.getUser()
  if (!user?.email) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  const admin = createSupabaseAdmin()
  const { data: member } = await admin.from("team_members").select("nombre,rol,estado").eq("email", user.email.toLowerCase()).maybeSingle()
  const role = effectiveCRMRole(member?.rol, member?.nombre)
  if (member?.estado !== "aprobado" || !["CEO", "Sales Manager"].includes(String(role))) {
    return { error: NextResponse.json({ error: "Solo CEO o Sales Manager" }, { status: 403 }) }
  }
  return { admin, email: user.email.toLowerCase() }
}

export async function GET(request: Request) {
  try {
    const auth = await autorizar()
    if ("error" in auth) return auth.error
    const sb = auth.admin
    const p = new URL(request.url).searchParams
    const hoy = new Date().toISOString().slice(0, 10)
    const mes = /^\d{4}-\d{2}$/.test(p.get("mes") || "") ? String(p.get("mes")) : hoy.slice(0, 7)
    const [y, m] = mes.split("-").map(Number)
    const desde = `${mes}-01`
    const hasta = `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`

    // Las mismas agendas que lee el Home: por fecha de agenda, sin archivadas
    const { data: delMes, error } = await sb.from("agendas").select(AG_COLS)
      .gte("fecha_agenda", `${desde}T00:00:00`).lte("fecha_agenda", `${hasta}T23:59:59`)
      .or("estado.is.null,estado.neq.Archivada manualmente").limit(3000)
    if (error) throw new Error(error.message)
    const agendas = (delMes || []) as any[]
    const ids = agendas.map((a) => String(a.id))
    const resumenes = new Set<string>()
    for (const a of agendas) if (!vacio(a.resumen_chat)) resumenes.add(String(a.id))

    const incompletas = agendas.map((a) => {
      const faltaCloser = closerMissing({ ...a, _has_resumen: resumenes.has(String(a.id)) })
      const faltaSetter = setterMissing({ ...a, _has_resumen: resumenes.has(String(a.id)) })
      return { a, faltaCloser, faltaSetter, etapa: operationalStage(a) }
    }).filter((x) => x.faltaCloser.length || x.faltaSetter.length)

    // Otras agendas de las mismas personas (cuatro meses alrededor), para detectar duplicados y datos cargados en otra fila
    const desdeAmplio = new Date(Date.parse(desde) - 75 * 864e5).toISOString().slice(0, 10)
    const hastaAmplio = new Date(Date.parse(hasta) + 45 * 864e5).toISOString().slice(0, 10)
    const { data: vecinas } = await sb.from("agendas").select(AG_COLS)
      .gte("fecha_agenda", `${desdeAmplio}T00:00:00`).lte("fecha_agenda", `${hastaAmplio}T23:59:59`)
      .or("estado.is.null,estado.neq.Archivada manualmente").limit(8000)
    const todas = (vecinas || []) as any[]
    const mismaPersona = (a: any, b: any) => String(a.id) !== String(b.id) && (
      (a.person_id && b.person_id && a.person_id === b.person_id) ||
      (tel9(a.telefono) && tel9(a.telefono) === tel9(b.telefono)) ||
      (normIg(a.instagram).length >= 3 && normIg(a.instagram) === normIg(b.instagram)) ||
      mismoNombre(tokens(a.nombre), tokens(b.nombre)))

    // Fathom: por agenda, por persona y por nombre en el título, cerca de la fecha de la llamada
    const personIds = [...new Set(incompletas.map((x) => x.a.person_id).filter(Boolean))]
    const { data: grabaciones } = await sb.from("crm_call_records")
      .select("id,agenda_id,person_id,fathom_url,title,occurred_at,trace_analysis,call_type")
      .gte("occurred_at", `${desdeAmplio}T00:00:00`).lte("occurred_at", `${hastaAmplio}T23:59:59`).limit(5000)
    const calls = (grabaciones || []) as any[]

    // Pagos activos (para los cerrados) con la regla de enlace de Métricas y Embudos
    const { data: pagosRows } = await sb.from("pagos")
      .select("id,person_id,cliente,telefono,fecha,monto,tipo,operacion,medio_de_pago,comprobante,ppp,record_status")
      .eq("record_status", "active").gte("fecha", desdeAmplio).lte("fecha", hastaAmplio).order("fecha", { ascending: true }).limit(5000)
    const { agendaDe } = armarEnlazador(todas.map((a) => ({ id: String(a.id), person_id: a.person_id, nombre: a.nombre, telefono: a.telefono, fuente: null, fecha_closer: a.fecha_closer })))
    const pagosPorAgenda = new Map<string, any[]>()
    for (const pg of (pagosRows || []) as any[]) {
      const enl = agendaDe(pg)
      if (!enl) continue
      const k = String(enl.a.id)
      if (!pagosPorAgenda.has(k)) pagosPorAgenda.set(k, [])
      pagosPorAgenda.get(k)!.push(pg)
    }

    // iClosed: respuestas del formulario guardadas como evento por persona
    const { data: evIclosed } = personIds.length
      ? await sb.from("crm_events").select("person_id,occurred_at,metadata").eq("event_type", "iclosed_call").in("person_id", personIds.slice(0, 900))
      : { data: [] as any[] }

    const items = incompletas.map(({ a, faltaCloser, faltaSetter, etapa }) => {
      const propuesta: Record<string, { valor: unknown; fuente: string }> = {}
      const causas: string[] = []
      const proponer = (campo: string, valor: unknown, fuente: string) => {
        if (!vacio(valor) && vacio(a[campo]) && !propuesta[campo]) propuesta[campo] = { valor, fuente }
      }
      const hermanas = todas.filter((b) => mismaPersona(a, b))
      // Misma llamada cargada dos veces (mismo día de llamada, o una sin fecha): duplicado real
      const duplicadas = hermanas.filter((b) => dia(b.fecha_closer) && dia(a.fecha_closer) ? diasEntre(a.fecha_closer, b.fecha_closer) <= 1
        : !dia(b.fecha_closer) && !dia(a.fecha_closer) && diasEntre(a.fecha_agenda, b.fecha_agenda) <= 1)
      const conDatos = [...duplicadas, ...hermanas.filter((b) => !duplicadas.includes(b))]
        .filter((b) => b.show != null || b.cerro || !vacio(b.motivo_no_cierre) || !vacio(b.link_fathom) || !vacio(b.operacion))
      if (duplicadas.length) causas.push(`La misma persona tiene ${duplicadas.length === 1 ? "otra agenda" : `${duplicadas.length} agendas más`} para esa llamada: el resultado se cargó en una y el Home cuenta la otra.`)
      for (const b of conDatos) {
        const fuente = `agenda ${dia(b.fecha_closer) || dia(b.fecha_agenda)} (${b.closer || "sin closer"})`
        for (const campo of ["motivo_no_cierre", "link_fathom", "operacion", "plan_de_pago", "medio_de_pago", "comprobante", "cc_dia_1", "fecha_tc"]) {
          // el motivo y el link de otra llamada distinta no aplican a esta
          if ((campo === "motivo_no_cierre" || campo === "link_fathom") && !duplicadas.includes(b)) continue
          proponer(campo, b[campo], fuente)
        }
      }

      // Fathom
      const tk = tokens(a.nombre)
      const grab = calls
        .filter((c) => String(c.agenda_id || "") === String(a.id) || (a.person_id && c.person_id === a.person_id) || (tk.length >= 2 && mismoNombre(tk, tokens(String(c.title || "").split(/\s+x\s+|\s+X\s+|\|/)[0]))))
        .filter((c) => !a.fecha_closer || !c.occurred_at || diasEntre(a.fecha_closer, c.occurred_at) <= 2)
        .sort((c1, c2) => Math.abs(Date.parse(c1.occurred_at) - Date.parse(a.fecha_closer || c1.occurred_at)) - Math.abs(Date.parse(c2.occurred_at) - Date.parse(a.fecha_closer || c2.occurred_at)))[0]
      if (grab) {
        const t = grab.trace_analysis || {}
        proponer("link_fathom", grab.fathom_url, `Fathom: ${grab.title || "grabación"}`)
        if (a.show == null && !a.cerro) proponer("show", true, "Fathom: hay grabación de la llamada")
        if (!a.cerro && a.estado !== "Fee") proponer("motivo_no_cierre", motivoDesdeTexto(t.why_not_bought || (Array.isArray(t.objections) ? t.objections.join(" ") : "")), "Fathom: análisis de la llamada")
      } else if (faltaCloser.includes("Fathom")) {
        causas.push("No hay grabación de Fathom para esa llamada: el closer no grabó o el título no tiene el nombre del lead. Sin link, el Home la sigue contando.")
      }

      // Pagos
      const pagosLead = [...(pagosPorAgenda.get(String(a.id)) || []), ...hermanas.flatMap((b) => pagosPorAgenda.get(String(b.id)) || [])]
      const primero = pagosLead.find((pg) => FRONT_END.test(String(pg.tipo || ""))) || null
      if (primero && (etapa === "cerrado" || etapa === "fee")) {
        const fuente = `pago ${dia(primero.fecha)} · ${primero.tipo} USD ${Math.round(Number(primero.monto) || 0)}`
        proponer("operacion", primero.operacion, fuente)
        proponer("medio_de_pago", primero.medio_de_pago, fuente)
        proponer("comprobante", primero.comprobante, fuente)
        proponer("plan_de_pago", primero.ppp, fuente)
        const delDia = pagosLead.filter((pg) => dia(pg.fecha) === dia(primero.fecha)).reduce((s, pg) => s + (Number(pg.monto) || 0), 0)
        proponer("cc_dia_1", delDia || null, fuente)
        if (etapa === "cerrado") proponer("fecha_tc", dia(primero.fecha), fuente)
      } else if ((etapa === "cerrado" || etapa === "fee") && faltaCloser.some((f) => ["operación", "medio de pago", "comprobante", "CC día 1"].includes(f))) {
        causas.push("Está marcada como cerrada o fee pero no hay ningún pago cargado de esa persona: falta cargar el pago en Cargar pago.")
      }

      // iClosed (datos del formulario)
      const ev = ((evIclosed || []) as any[]).filter((e) => e.person_id && e.person_id === a.person_id)
        .sort((e1, e2) => Math.abs(Date.parse(e1.occurred_at) - Date.parse(a.fecha_closer || e1.occurred_at)) - Math.abs(Date.parse(e2.occurred_at) - Date.parse(a.fecha_closer || e2.occurred_at)))[0]
      const respuestas: any[] = Array.isArray(ev?.metadata?.answers) ? ev.metadata.answers : []
      // mismo formato que lee iclosed-sync: { statement | question, answer } con la respuesta anidada
      const valores = (raw: any): any[] => raw == null ? [] : typeof raw !== "object" ? [raw] : Array.isArray(raw) ? raw.flatMap(valores)
        : (["answer", "number", "value", "label", "text"].map((k) => raw[k]).find((v) => v != null) ?? null) != null
          ? valores(["answer", "number", "value", "label", "text"].map((k) => raw[k]).find((v) => v != null))
          : Object.values(raw).flatMap(valores)
      const resp = (re: RegExp) => {
        const item = respuestas.find((r: any) => re.test(String(r?.statement || r?.question || "")))
        return item ? valores(item.answer).find((v) => v != null && String(v).trim()) ?? null : null
      }
      if (respuestas.length) {
        proponer("ocupacion", resp(/dedic/i), "iClosed: formulario")
        proponer("ingresos", resp(/ingreso/i), "iClosed: formulario")
        proponer("inversion", resp(/capital|invertir|inversi/i), "iClosed: formulario")
        proponer("intentos_previos", resp(/intentaste|antes/i), "iClosed: formulario")
        proponer("motivo_urgencia", resp(/cu[aá]ndo|resolver/i), "iClosed: formulario")
      }
      if (faltaSetter.includes("resumen")) causas.push("Falta el resumen del chat de setting: lo sube el setter desde el reporte (Setting → Resumen).")
      if (faltaSetter.includes("calificación")) causas.push("Falta la calificación del lead (la calcula el scoring con el formulario de iClosed).")

      const faltantes = [...faltaCloser, ...faltaSetter]
      const cubre = (f: string) => ({ motivo: "motivo_no_cierre", Fathom: "link_fathom", "operación": "operacion", "plan de pago": "plan_de_pago", "medio de pago": "medio_de_pago", comprobante: "comprobante", "CC día 1": "cc_dia_1", "Fecha TC": "fecha_tc" } as Record<string, string>)[f]
      const quedan = faltantes.filter((f) => !(cubre(f) && propuesta[cubre(f)!]))
      // Duplicado vacío: se archiva si la otra agenda de la misma llamada tiene más datos
      const principal = duplicadas
        .map((b) => ({ b, peso: [b.show != null, b.cerro, b.motivo_no_cierre, b.link_fathom, b.operacion, b.cc_dia_1, b.resumen_chat].filter((v) => !vacio(v) && v !== false).length }))
        .sort((x, z) => z.peso - x.peso)[0]
      const pesoPropio = [a.show != null, a.cerro, a.motivo_no_cierre, a.link_fathom, a.operacion, a.cc_dia_1, a.resumen_chat].filter((v) => !vacio(v) && v !== false).length
      const archivarHacia = principal && principal.peso > pesoPropio ? { id: String(principal.b.id), nombre: principal.b.nombre, fecha: dia(principal.b.fecha_closer) } : null

      return {
        id: String(a.id), nombre: a.nombre, closer: a.closer, setter: a.setter, fecha_agenda: dia(a.fecha_agenda), fecha_closer: String(a.fecha_closer || "").slice(0, 16),
        etapa, falta_closer: faltaCloser, falta_setter: faltaSetter, quedan, causas, propuesta, archivar_hacia: archivarHacia,
        otras_agendas: hermanas.map((b) => ({ id: String(b.id), fecha_closer: String(b.fecha_closer || "").slice(0, 16), closer: b.closer, show: b.show, cerro: b.cerro, estado: b.estado })),
      }
    })

    return NextResponse.json({
      ok: true, mes, total_agendas: agendas.length,
      incompletas: items.length,
      llamadas: items.filter((i) => i.falta_closer.length).length,
      setting: items.filter((i) => i.falta_setter.length).length,
      se_completan: items.filter((i) => i.quedan.length === 0 || i.archivar_hacia).length,
      items,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await autorizar()
    if ("error" in auth) return auth.error
    const sb = auth.admin
    const body = await request.json().catch(() => ({}))
    const cambios: Array<{ id: string; campos: Record<string, unknown>; fuentes?: Record<string, string> }> = Array.isArray(body.cambios) ? body.cambios : []
    const archivar: Array<{ id: string; hacia: string; motivo?: string }> = Array.isArray(body.archivar) ? body.archivar : []
    const ahora = new Date().toISOString()
    let actualizadas = 0, archivadas = 0
    const errores: string[] = []

    for (const c of cambios) {
      const campos = Object.fromEntries(Object.entries(c.campos || {}).filter(([k, v]) => CAMPOS_EDITABLES.has(k) && !vacio(v)))
      if (!c.id || !Object.keys(campos).length) continue
      // Solo se completa lo que está vacío: nunca se pisa un dato cargado a mano
      const { data: actual } = await sb.from("agendas").select(AG_COLS).eq("id", c.id).maybeSingle()
      if (!actual) { errores.push(`${c.id}: no existe`); continue }
      const parche = Object.fromEntries(Object.entries(campos).filter(([k]) => vacio((actual as any)[k]) || (k === "show" && (actual as any).show == null)))
      if (!Object.keys(parche).length) continue
      const { error } = await sb.from("agendas").update(parche).eq("id", c.id)
      if (error) { errores.push(`${actual.nombre}: ${error.message}`); continue }
      actualizadas++
      if (actual.person_id) await sb.from("crm_events").insert({
        person_id: actual.person_id, event_type: "agenda_completada", occurred_at: ahora, source: "CRM", source_record_type: "agendas",
        source_record_id: String(c.id), title: "Agenda completada desde iClosed / Fathom / pagos",
        metadata: { actor: auth.email, campos: parche, fuentes: c.fuentes || {} },
        dedupe_key: `agenda_completada:${c.id}:${ahora}`,
      })
    }

    for (const x of archivar) {
      if (!x.id || !x.hacia || x.id === x.hacia) continue
      const { data: dup } = await sb.from("agendas").select(AG_COLS).eq("id", x.id).maybeSingle()
      const { data: principal } = await sb.from("agendas").select(AG_COLS).eq("id", x.hacia).maybeSingle()
      if (!dup || !principal || dup.estado === "Archivada manualmente") continue
      // Antes de archivar, lo que tenga la copia y le falte a la principal pasa a la principal
      const pasar = Object.fromEntries([...CAMPOS_EDITABLES].filter((k) => !vacio((dup as any)[k]) && vacio((principal as any)[k])).map((k) => [k, (dup as any)[k]]))
      if (vacio(principal.resumen_chat) && !vacio(dup.resumen_chat)) (pasar as any).resumen_chat = dup.resumen_chat
      if (principal.show == null && dup.show != null) (pasar as any).show = dup.show
      if (Object.keys(pasar).length) await sb.from("agendas").update(pasar).eq("id", x.hacia)
      const { error } = await sb.from("agendas").update({ estado: "Archivada manualmente" }).eq("id", x.id)
      if (error) { errores.push(`${dup.nombre}: ${error.message}`); continue }
      archivadas++
      if (dup.person_id) await sb.from("crm_events").upsert({
        person_id: dup.person_id, event_type: "agenda_archived", occurred_at: ahora, source: "CRM", source_record_type: "agendas",
        source_record_id: String(x.id), title: "Agenda archivada (duplicado)",
        metadata: { reason: x.motivo || `Duplicado de la agenda ${x.hacia}`, actor: auth.email, previous_estado: dup.estado, fusionada_en: x.hacia, campos_pasados: pasar },
        dedupe_key: `agenda_archived:${x.id}`,
      }, { onConflict: "dedupe_key" })
    }

    return NextResponse.json({ ok: errores.length === 0, actualizadas, archivadas, errores })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
