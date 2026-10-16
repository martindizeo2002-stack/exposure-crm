// Motor del globo del asistente (16/10/2026). Separado del asistente de Jarvis a propósito: responde con el dato exacto
// y su fundamento, usa las métricas oficiales (lib/metricas-ventas, la misma regla de Métricas, Home y Resumen de
// ventas) y puede ofrecer el botón para ir a la pantalla justa (lib/pantallas-crm). Solo lectura.

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { metricasVentas } from "@/lib/metricas-ventas"
import { leerEmbudos } from "@/lib/embudo-atribucion"
import { pantallasPara, rutaValida } from "@/lib/pantallas-crm"

const MODELO = "claude-opus-5-5"

export type ActorGlobo = { rol: string; nombre: string; email: string }
export type DestinoGlobo = { url: string; motivo: string }
export type RespuestaGlobo = { respuesta: string; destinos: DestinoGlobo[]; consultas: string[] }

const texto = (v: unknown, max = 120) => String(v ?? "").replace(/[,%()]/g, " ").trim().slice(0, max)

// Tablas que se pueden leer (solo lectura, columnas acotadas)
const TABLAS: Record<string, { tabla: string; columnas: string; fechas: string[]; busca: string[]; max: number }> = {
  agendas: { tabla: "agendas", columnas: "id,nombre,telefono,instagram,fecha_agenda,fecha_closer,closer,setter,show,cerro,estado,calificacion,fuente,ocupacion,motivo_no_cierre,link_fathom,operacion,cc_dia_1,problema_actual,ingresos,inversion", fechas: ["fecha_closer", "fecha_agenda"], busca: ["nombre", "telefono", "instagram", "closer", "setter", "estado", "fuente"], max: 2000 },
  pagos: { tabla: "pagos", columnas: "id,fecha,cliente,tipo,operacion,monto,closer,setter,calificacion,medio_de_pago,record_status", fechas: ["fecha"], busca: ["cliente", "closer", "setter", "tipo", "operacion"], max: 2000 },
  planes_pago: { tabla: "planes_pago", columnas: "id,cliente,operacion,closer,setter,fecha_alta,created_at,plan_pago_items(concepto,monto,fecha_planeada,estado,pago_id)", fechas: ["created_at", "fecha_alta"], busca: ["cliente", "closer", "operacion"], max: 800 },
  llamadas: { tabla: "crm_call_records", columnas: "id,agenda_id,title,occurred_at,fathom_url,call_type,trace_analysis", fechas: ["occurred_at"], busca: ["title"], max: 400 },
  clientes: { tabla: "clientes", columnas: "id,nombre,telefono,calificacion,fecha_ingreso,fecha_baja,estado,etapa,operacion_original", fechas: ["fecha_ingreso"], busca: ["nombre", "telefono", "estado", "etapa"], max: 800 },
  contenido: { tabla: "crm_content_assets", columnas: "id,title,platform,angle,format,published_at,status", fechas: ["published_at"], busca: ["title", "angle", "format"], max: 800 },
}

const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: "metricas_ventas",
    description: "Métricas de ventas OFICIALES del período, con la misma regla de Métricas, Home y Resumen de ventas: agendas, presentadas, no show, canceladas, tasa de show, cierres (1 por persona, primer pago de venta nueva, día del pago), fees, tasa de cierre, calificadas (Lead S/A/B/C), cash collected con desglose FECCU/FECCP/BECCU/BECCPP, por closer, y la lista de cierres y fees. Usala para cualquier cifra de cierres, show, tasas, cash o rendimiento de closers.",
    input_schema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Fecha inicial AAAA-MM-DD" },
        hasta: { type: "string", description: "Fecha final AAAA-MM-DD" },
        closer: { type: "string", description: "Closer para filtrar (opcional)" },
        embudo: { type: "string", description: "Webinar, Orgánico, Outbound o Sin fuente; varios separados por coma (opcional)" },
      },
      required: ["desde", "hasta"],
    },
  },
  {
    name: "consultar_crm",
    description: "Lee filas reales del CRM para datos que no son métricas de ventas: un lead puntual, sus datos y su resultado, pagos de un cliente, planes y cuotas, grabaciones de Fathom, clientes del programa o contenido.",
    input_schema: {
      type: "object",
      properties: {
        tabla: { type: "string", enum: Object.keys(TABLAS) },
        desde: { type: "string", description: "Fecha inicial AAAA-MM-DD (opcional)" },
        hasta: { type: "string", description: "Fecha final AAAA-MM-DD (opcional)" },
        campo_fecha: { type: "string", description: "Campo de fecha, si la tabla tiene más de uno (opcional)" },
        buscar: { type: "string", description: "Texto: nombre, teléfono, closer, concepto… (opcional)" },
        limite: { type: "number", description: "Filas (por defecto 200)" },
      },
      required: ["tabla"],
    },
  },
  {
    name: "abrir_pantalla",
    description: "Ofrece al usuario un botón para ir a una pantalla del CRM (no navega sola). Usala cuando pida ir a algún lado, cuando quiera ver o verificar un dato, o para abrir la ficha de un lead (/centro-agendas con buscar = nombre o teléfono).",
    input_schema: {
      type: "object",
      properties: {
        ruta: { type: "string", description: "Ruta exacta del catálogo de pantallas" },
        buscar: { type: "string", description: "Texto a buscar en la pantalla, si la acepta" },
        motivo: { type: "string", description: "Qué va a encontrar ahí, en pocas palabras (es el texto del botón)" },
      },
      required: ["ruta", "motivo"],
    },
  },
]

async function metricas(input: Record<string, unknown>) {
  const desde = texto(input.desde, 10), hasta = texto(input.hasta, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return { error: "desde y hasta tienen que ser AAAA-MM-DD" }
  const u = await metricasVentas(createSupabaseAdmin(), { desde, hasta, closer: texto(input.closer, 40) || null, embudos: leerEmbudos(texto(input.embudo, 60) || null) })
  return {
    fuente: "lib/metricas-ventas: la regla única de Métricas, Home y Resumen de ventas",
    definiciones: "Llamadas por fecha de la llamada (hora Argentina), un lead por persona. Presentada = show, cerró o fee. Tasa de show = presentadas ÷ llamadas ya ocurridas (sin canceladas ni futuras). Cierre = 1 por persona, primer pago de venta nueva, en el día del pago; fees aparte; cuotas y back end no son cierres. Tasa de cierre = cierres ÷ presentadas. Calificada = Lead S/A/B/C. Cash = todos los pagos activos del período por fecha de pago.",
    periodo: { desde, hasta },
    agendas: u.agendas, ocurridas: u.ocurridas, presentadas: u.presentadas, no_show: u.no_show, canceladas: u.canceladas, pendientes: u.pendientes, sin_resultado: u.sin_resultado,
    calificadas: u.calificadas, calif_presentadas: u.calif_presentadas,
    cierres: u.cierres, cierres_calificados: u.cierres_calificados, cierres_back_end: u.cierres_back_end, fees: u.fees, fees_monto: u.fees_monto,
    cash: u.cash, show_rate_pct: u.show_rate, show_rate_calif_pct: u.show_rate_calif, tasa_cierre_pct: u.tasa_cierre, tasa_cierre_calif_pct: u.tasa_cierre_calif,
    por_closer: u.por_closer, lista_cierres: u.lista_cierres.slice(0, 80), lista_fees: u.lista_fees.slice(0, 80),
  }
}

async function consultar(input: Record<string, unknown>) {
  const cfg = TABLAS[String(input.tabla || "")]
  if (!cfg) return { error: "Tabla no permitida" }
  const campo = cfg.fechas.includes(String(input.campo_fecha || "")) ? String(input.campo_fecha) : cfg.fechas[0]
  let q = createSupabaseAdmin().from(cfg.tabla).select(cfg.columnas).limit(Math.max(1, Math.min(Number(input.limite) || 200, cfg.max)))
  const desde = texto(input.desde, 10), hasta = texto(input.hasta, 10)
  if (campo && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte(campo, desde)
  if (campo && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q = q.lte(campo, `${hasta}T23:59:59`)
  const buscar = texto(input.buscar)
  if (buscar) q = q.or(cfg.busca.map((c) => `${c}.ilike.%${buscar}%`).join(","))
  const { data, error } = await q
  if (error) return { error: error.message }
  return { tabla: cfg.tabla, filas: data?.length || 0, rows: data || [] }
}

function sistema(actor: ActorGlobo, pantallaActual: string) {
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
  const pantallas = pantallasPara(actor.rol).map((p) => `${p.ruta} — ${p.nombre}: ${p.para}${p.busqueda ? " (acepta buscar)" : ""}`).join("\n")
  return `Sos el asistente del CRM de EXPOSURE, adentro de la app. Hablás en español rioplatense, con voseo, directo y sin relleno.
Hoy es ${hoy} (hora de Argentina). Usuario: ${actor.nombre} (${actor.rol}).${pantallaActual ? ` Está mirando ${pantallaActual}.` : ""}

Cómo respondés:
- Primero el dato exacto (la cifra, el nombre, la fecha). En la línea siguiente, el fundamento en una oración: de dónde sale y con qué regla se calculó. Si piden detalle, dalo.
- Toda cifra sale de una herramienta, nunca de memoria. Para cierres, show, tasas, cash, fees o rendimiento de closers usá metricas_ventas: son los números oficiales. Para un lead puntual, pagos de un cliente, cuotas, grabaciones o contenido usá consultar_crm.
- Si el período no está dicho, usá el mes en curso y decilo.
- Si quiere ir a un lugar, ver o verificar algo, o abrir un lead, llamá abrir_pantalla con una ruta del catálogo (además de responder si hace falta).
- Sin Markdown: nada de títulos, tablas ni negritas; podés usar saltos de línea y viñetas simples con "•".
- Si un dato no está, decilo en una oración. Nunca inventes.

Pantallas que este usuario puede abrir:
${pantallas}`
}

export async function responderGlobo(pregunta: string, actor: ActorGlobo, historial: Array<{ rol: string; texto: string }>, pantallaActual: string): Promise<RespuestaGlobo> {
  const client = new Anthropic()
  const previo = historial.slice(-6).map((t) => `${t.rol === "bot" ? "Asistente" : "Usuario"}: ${String(t.texto || "").slice(0, 600)}`).join("\n")
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: previo ? `Conversación previa:\n${previo}\n\nPregunta: ${pregunta}` : pregunta }]
  const destinos: DestinoGlobo[] = []
  const consultas: string[] = []

  for (let vuelta = 0; vuelta < 8; vuelta++) {
    // fallbacks "default": si un clasificador de seguridad rechaza, el servidor reintenta con el modelo de respaldo
    const respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      system: sistema(actor, pantallaActual),
      tools: HERRAMIENTAS as Anthropic.Beta.BetaTool[],
      messages,
      ...({ fallbacks: "default", output_config: { effort: "medium" } } as Record<string, unknown>),
    } as Anthropic.Beta.MessageCreateParamsNonStreaming)

    if (respuesta.stop_reason === "refusal") return { respuesta: "No puedo responder eso. Probá reformular la pregunta.", destinos, consultas }
    // el contenido completo (incluidos los bloques de thinking) vuelve tal cual para seguir la vuelta
    messages.push({ role: "assistant", content: respuesta.content as Anthropic.Beta.BetaContentBlockParam[] })
    if (respuesta.stop_reason === "pause_turn") continue

    const usos = respuesta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
    if (!usos.length) {
      const final = respuesta.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim()
      return { respuesta: final || (destinos.length ? "Te dejo el acceso directo." : "No encontré una respuesta con datos suficientes."), destinos, consultas }
    }

    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const uso of usos) {
      const input = (uso.input || {}) as Record<string, unknown>
      let salida: unknown
      try {
        if (uso.name === "abrir_pantalla") {
          const url = rutaValida(String(input.ruta || ""), actor.rol, input.buscar as string | undefined)
          if (url && !destinos.some((d) => d.url === url)) destinos.push({ url, motivo: texto(input.motivo, 80) || "Abrir" })
          salida = url ? { ok: true, url } : { error: "Esa ruta no está en el catálogo o este usuario no la puede abrir" }
        } else if (uso.name === "metricas_ventas") {
          consultas.push(`métricas ${texto(input.desde, 10)} a ${texto(input.hasta, 10)}${input.closer ? ` · ${texto(input.closer, 30)}` : ""}`)
          salida = await metricas(input)
        } else if (uso.name === "consultar_crm") {
          consultas.push(`${texto(input.tabla, 20)}${input.buscar ? ` · ${texto(input.buscar, 30)}` : ""}`)
          salida = await consultar(input)
        } else salida = { error: "Herramienta desconocida" }
      } catch (e) {
        salida = { error: (e as Error).message }
      }
      const error = Boolean(salida && typeof salida === "object" && "error" in (salida as object))
      resultados.push({ type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(salida).slice(0, 180000), ...(error ? { is_error: true } : {}) })
    }
    messages.push({ role: "user", content: resultados })
  }
  return { respuesta: "La consulta necesitó demasiados pasos. Probá con un período o una persona más concreta.", destinos, consultas }
}
