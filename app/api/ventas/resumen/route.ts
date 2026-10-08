import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import {
  leerArquetipoCrm,
  esAgendaCalificada,
  leerLeadScoringCrm,
  type MacroArquetipo,
} from "@/lib/arquetipos-closing"
import {
  generarTextoWhatsApp,
  type CallDetalle,
  type MetricasClosing,
  type ResumenPayload,
  type FathomDiagnostico,
  type ArquetiposMetricas,
} from "@/lib/closing-whatsapp-formatter"
import { extractBookingContentOrigin } from "@/lib/chat-summary-attribution"

export const dynamic = "force-dynamic"
export const revalidate = 0

function hoyIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function parseFathomText(summary?: string | null, transcript?: string | null): FathomDiagnostico {
  const diag: FathomDiagnostico = {}
  const txt = `${summary || ""} ${transcript || ""}`.toLowerCase()

  if (txt.includes("alex") || txt.includes("carrera")) {
    diag.mencion_alex = "Mencionó conocer el contenido de Alex"
  }
  if (txt.includes("claude") || txt.includes("notion")) {
    diag.contenido_recuerda = "Reel o video de Claude / automatización"
  } else if (txt.includes("flex")) {
    diag.contenido_recuerda = "Caso Flex"
  } else if (txt.includes("fran")) {
    diag.contenido_recuerda = "Caso Fran Puleo"
  }

  // Citas textuales o insights si el summary / ia_analisis los trae
  if (summary) {
    const lines = summary.split("\n")
    for (const l of lines) {
      const lLow = l.toLowerCase()
      if (lLow.includes("dolor") || lLow.includes("pain") || lLow.includes("problema")) {
        diag.dolor_principal = l.replace(/^[-*•#\s]+/, "").slice(0, 200)
      }
      if (lLow.includes("deseo") || lLow.includes("objetivo") || lLow.includes("goal")) {
        diag.deseo_principal = l.replace(/^[-*•#\s]+/, "").slice(0, 200)
      }
      if (lLow.includes("objeci") || lLow.includes("freno")) {
        diag.oferta_interes = l.replace(/^[-*•#\s]+/, "").slice(0, 200)
      }
      if (lLow.includes("urgencia")) {
        diag.urgencia = l.replace(/^[-*•#\s]+/, "").slice(0, 200)
      }
    }
  }

  return diag
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sb = createSupabaseAdmin()

    // 1. MODO CONSULTA DE HISTÓRICO
    if (searchParams.get("historico") === "1") {
      const limite = Math.min(100, Number(searchParams.get("limite") || 30))
      const { data, error } = await sb
        .from("crm_integration_assets")
        .select("id, source_id, asset_type, name, metadata, last_seen_at")
        .eq("source", "closing")
        .order("last_seen_at", { ascending: false })
        .limit(limite)

      if (error) throw new Error(error.message)

      return NextResponse.json({
        ok: true,
        reportes: (data || []).map((r) => ({
          id: r.id,
          source_id: r.source_id,
          asset_type: r.asset_type,
          name: r.name,
          metadata: r.metadata,
          fecha_guardado: r.last_seen_at,
        })),
      })
    }

    // 2. MODO OBTENER REPORTE ESPECÍFICO POR SOURCE_ID
    const sourceId = searchParams.get("source_id")
    if (sourceId) {
      const { data, error } = await sb
        .from("crm_integration_assets")
        .select("id, source_id, asset_type, name, metadata, last_seen_at")
        .eq("source", "closing")
        .eq("source_id", sourceId)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) return NextResponse.json({ error: "No se encontró el reporte guardado" }, { status: 404 })

      return NextResponse.json({ ok: true, reporte: data.metadata, name: data.name })
    }

    // 3. MODO GENERACIÓN EN TIEMPO REAL
    const periodo = (searchParams.get("periodo") || "dia") as "dia" | "semana" | "mes"
    const fecha = searchParams.get("fecha") || hoyIso()
    let fechaDesde = searchParams.get("fecha_desde") || fecha
    let fechaHasta = searchParams.get("fecha_hasta") || fecha
    const closer = (searchParams.get("closer") || "todos").toLowerCase()
    const modo = (searchParams.get("modo") || "detallado") as "detallado" | "corto"

    if (periodo === "dia") {
      fechaDesde = fecha
      fechaHasta = fecha
    } else if (periodo === "semana" && !searchParams.get("fecha_desde")) {
      const parts = fecha.split("-").map(Number)
      const d = new Date(parts[0], parts[1] - 1, parts[2])
      const day = d.getDay() // 0 = Domingo, 1 = Lunes
      const diffToMonday = day === 0 ? -6 : 1 - day
      const monday = new Date(parts[0], parts[1] - 1, parts[2] + diffToMonday)
      const sunday = new Date(parts[0], parts[1] - 1, parts[2] + diffToMonday + 6)
      const fmt = (x: Date) =>
        `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
      fechaDesde = fmt(monday)
      fechaHasta = fmt(sunday)
    } else if (periodo === "mes" && !searchParams.get("fecha_desde")) {
      const parts = fecha.split("-").map(Number)
      const year = parts[0]
      const month = parts[1]
      const lastDay = new Date(year, month, 0).getDate()
      const mStr = String(month).padStart(2, "0")
      fechaDesde = `${year}-${mStr}-01`
      fechaHasta = `${year}-${mStr}-${String(lastDay).padStart(2, "0")}`
    }

    // Consultamos agendas reales del CRM por fecha_closer (excluyendo registros archivados manualmente)
    let query = sb
      .from("agendas")
      .select(
        "id, nombre, email, telefono, instagram, fecha_closer, fecha_agenda, closer, setter, show, cerro, estado, calificacion, lead_score, lead_score_grade, lead_score_detalle, calificaba_realmente, ocupacion, angulo_entrada, recurso, manychat, fuente, medio_de_pago, motivo_no_cierre, plan_de_pago, cc_dia_1, person_id, problema_actual, motivo_urgencia, ingresos, inversion, link_fathom, ia_analisis, resumen_chat"
      )
      .gte("fecha_closer", `${fechaDesde}T00:00:00`)
      .lte("fecha_closer", `${fechaHasta}T23:59:59`)
      .or("estado.is.null,estado.neq.Archivada manualmente")
      .order("fecha_closer", { ascending: true })

    if (closer && closer !== "todos") {
      query = query.ilike("closer", `%${closer}%`)
    }

    const { data: agendas, error: errAg } = await query
    if (errAg) throw new Error(errAg.message)

    // Filtrar archivadas defensivamente y deduplicar en memoria por identidad y fecha
    const rawAgendas = (agendas || []).filter(
      (a: any) => a.estado !== "Archivada manualmente" && a.estado !== "Archivada"
    )

    const normPhone = (p?: string | null) => (p || "").replace(/\D/g, "")
    const normIg = (i?: string | null) => (i || "").replace(/[@\s]/g, "").toLowerCase()
    const normName = (n?: string | null) =>
      (n || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()

    function getLeadCompletenessScore(item: any): number {
      let score = 0
      if (item.calificaba_realmente) score += 20
      if (item.calificacion) score += 15
      if (item.lead_score_grade === "A") score += 25
      else if (item.lead_score_grade === "B") score += 20
      else if (item.lead_score_grade === "C") score += 15
      else if (item.lead_score_grade === "D") score += 10
      if (item.cerro) score += 50
      if (item.show === true) score += 30
      if (item.medio_de_pago || item.cc_dia_1) score += 20
      if (item.ocupacion) score += 10
      if (item.problema_actual) score += 10
      if (item.ingresos) score += 5
      if (item.inversion) score += 5
      if (item.motivo_urgencia) score += 5
      if (item.intentos_previos) score += 5
      if (item.link_fathom) score += 10
      return score
    }

    const agendaList: typeof rawAgendas = []
    const clusters: Record<string, typeof rawAgendas> = {}

    for (const item of rawAgendas) {
      const p = normPhone(item.telefono)
      const ig = normIg(item.instagram)
      const nm = normName(item.nombre)
      const datePart = (item.fecha_closer || item.fecha_agenda || "").slice(0, 10)

      let clusterKey = ""
      if (p && p.length >= 7) {
        clusterKey = `phone:${p}_${datePart}`
      } else if (ig && ig.length >= 3) {
        clusterKey = `ig:${ig}_${datePart}`
      } else if (nm && nm.length >= 5) {
        clusterKey = `nm:${nm}_${datePart}`
      } else {
        clusterKey = `id:${item.id}`
      }

      if (!clusters[clusterKey]) {
        clusters[clusterKey] = []
      }
      clusters[clusterKey].push(item)
    }

    for (const key of Object.keys(clusters)) {
      const items = clusters[key]
      if (items.length === 1) {
        agendaList.push(items[0])
      } else {
        items.sort((a, b) => getLeadCompletenessScore(b) - getLeadCompletenessScore(a))
        const winner = { ...items[0] }
        for (let i = 1; i < items.length; i++) {
          const other = items[i]
          for (const field of Object.keys(other)) {
            if ((winner as any)[field] === null || (winner as any)[field] === undefined || (winner as any)[field] === "") {
              (winner as any)[field] = (other as any)[field]
            }
          }
        }
        agendaList.push(winner)
      }
    }
    const agendaIds = agendaList.map((a) => a.id).filter(Boolean)

    // Consultamos pagos reales en el rango
    const { data: pagos } = await sb
      .from("pagos")
      .select("id, agenda_id, person_id, cliente, fecha, monto, tipo, operacion, medio_de_pago, comprobante")
      .gte("fecha", fechaDesde)
      .lte("fecha", fechaHasta)

    // Consultamos grabaciones Fathom enlazadas
    let callRecords: Record<string, { summary?: string; transcript?: string }> = {}
    if (agendaIds.length > 0) {
      const { data: cRecs } = await sb
        .from("crm_call_records")
        .select("agenda_id, summary, transcript")
        .in("agenda_id", agendaIds)

      if (cRecs) {
        cRecs.forEach((r: any) => {
          if (r.agenda_id) callRecords[r.agenda_id] = r
        })
      }
    }

    // Acumuladores de métricas
    let programadas = agendaList.length
    let presentadas = 0
    let noShows = 0
    let canceladas = 0
    let calificadasProgramadas = 0
    let calificadasPresentadas = 0
    let noShowsCalificados = 0
    let cierres = 0
    let cierresCalificados = 0
    let noCierres = 0
    let fees = 0
    let cashD1 = 0
    let cashFees = 0
    let ticketTotal = 0

    const arquetipos: ArquetiposMetricas = {
      dueno_negocio: { total: 0, calificadas: 0, cierres: 0, cash_d1: 0 },
      empleado: { total: 0, calificadas: 0, cierres: 0, cash_d1: 0 },
      estudiante: { total: 0, calificadas: 0, cierres: 0, cash_d1: 0 },
      sin_clasificar: { total: 0, calificadas: 0, cierres: 0, cash_d1: 0 },
    }

    const motivosNoCierre: Record<string, number> = {}
    const angulosCalificados: Record<string, number> = {}

    const callsDetalle: CallDetalle[] = agendaList.map((a) => {
      // 1. Arquetipo leído estrictamente del CRM (sin heurísticas)
      const arq = leerArquetipoCrm(a.ocupacion, (a as any).arquetipo, (a as any).subarquetipo)

      // 2. Calificación leída mediante la definición canónica de Exposure OS
      const esCalif = esAgendaCalificada(a.calificacion, a.lead_score_grade)

      // 3. Lead scoring leído del CRM
      const leadScoreStr = leerLeadScoringCrm(a.lead_score_grade, a.calificacion, a.lead_score)

      // Estados operativos
      const estadoStr = (a.estado || "").toLowerCase()
      const esCancel = estadoStr.includes("cancelad")
      const esNoShow = Boolean(!esCancel && (a.show === false || estadoStr.includes("no show")))
      const esShow = Boolean(!esCancel && !esNoShow && (a.show === true || estadoStr.includes("adentro") || estadoStr.includes("fee") || estadoStr.includes("cierre") || a.cerro === true))

      const hora = a.fecha_closer ? a.fecha_closer.slice(11, 16) : undefined

      if (esCalif) {
        calificadasProgramadas++
      }

      if (esCancel) {
        canceladas++
      } else if (esNoShow) {
        noShows++
        if (esCalif) noShowsCalificados++
      } else if (esShow) {
        presentadas++
        if (esCalif) calificadasPresentadas++
      }

      // Cruce con pagos para validar cierres y cash
      const pagosLead = (pagos || []).filter(
        (p: any) =>
          (p.agenda_id && p.agenda_id === a.id) ||
          (p.person_id && a.person_id && p.person_id === a.person_id) ||
          (p.cliente && a.nombre && p.cliente.toLowerCase().includes(a.nombre.toLowerCase().split(" ")[0]))
      )

      let resComercial: CallDetalle["resultado"] = "NO CIERRE"
      let cashLead = Number(a.cc_dia_1) || 0
      let ticketLead = 0
      let formaPagoLead = a.medio_de_pago || ""

      if (esCancel) {
        resComercial = "CANCELADA"
      } else if (esNoShow) {
        resComercial = "NO SHOW"
      } else if (pagosLead.length > 0) {
        const esFee = pagosLead.some((p: any) => String(p.tipo || "").toLowerCase().includes("fee") || Number(p.monto) === 27)
        const sumaPagos = pagosLead.reduce((acc: number, p: any) => acc + (Number(p.monto) || 0), 0)
        cashLead = sumaPagos > 0 ? sumaPagos : cashLead

        if (esFee) {
          resComercial = "FEE"
          fees++
          cashFees += cashLead
          ticketLead = cashLead
        } else {
          resComercial = "CIERRE"
          cierres++
          if (esCalif) cierresCalificados++
          cashD1 += cashLead
          ticketLead = 1500 // Ticket base de contrato
          ticketTotal += ticketLead
        }
        formaPagoLead = pagosLead.map((p: any) => p.medio_de_pago).filter(Boolean).join(" / ") || formaPagoLead
      } else if (a.cerro === true || estadoStr.includes("cierre")) {
        resComercial = "CIERRE"
        cierres++
        if (esCalif) cierresCalificados++
        cashD1 += cashLead
        ticketLead = 1500
        ticketTotal += ticketLead
      } else if (estadoStr.includes("fee")) {
        resComercial = "FEE"
        fees++
        cashFees += cashLead
        ticketLead = cashLead
      } else if (estadoStr.includes("seguimiento") || estadoStr.includes("fup")) {
        resComercial = "SEGUIMIENTO"
      }

      if (esShow && resComercial === "NO CIERRE") {
        noCierres++
      }

      // Distribución por Arquetipos (con grupo sin_clasificar)
      const arqKey: keyof ArquetiposMetricas =
        arq.macro === "DUEÑO DE NEGOCIO"
          ? "dueno_negocio"
          : arq.macro === "EMPLEADO"
          ? "empleado"
          : arq.macro === "ESTUDIANTE"
          ? "estudiante"
          : "sin_clasificar"

      arquetipos[arqKey].total++
      if (esCalif) arquetipos[arqKey].calificadas++
      if (resComercial === "CIERRE") {
        arquetipos[arqKey].cierres++
        arquetipos[arqKey].cash_d1 += cashLead
      }

      // Registro de patrones
      if (a.motivo_no_cierre && resComercial === "NO CIERRE") {
        const objKey = a.motivo_no_cierre.trim()
        motivosNoCierre[objKey] = (motivosNoCierre[objKey] || 0) + 1
      }
      if (a.angulo_entrada && esCalif) {
        const angKey = a.angulo_entrada.trim()
        angulosCalificados[angKey] = (angulosCalificados[angKey] || 0) + 1
      }

      // Diagnóstico Fathom: cruza crm_call_records o a.ia_analisis directamente
      const fathomData = callRecords[a.id]
      const fDiag = parseFathomText(fathomData?.summary || a.ia_analisis, fathomData?.transcript)

      // Atribución de ESA agenda limpia y separada:
      // 1. Origen: canal base (limpiando si viniera con comas o concatenaciones)
      const origenLimpio = (a.fuente || "Instagram").split(",")[0].trim()

      // 2. Pieza de entrada específica
      const piezaEntradaLimpia = (a.recurso || "").trim()

      // 3. Keyword / Manychat de ESA agenda
      const keywordLimpia = (a.manychat || "").trim()

      // 4. Ángulo de adquisición: si angulo_entrada está vacío, intentar extraerlo del gatillo del chat
      let anguloLimpio = (a.angulo_entrada || "").trim()
      if (!anguloLimpio && a.resumen_chat) {
        const gatillo = extractBookingContentOrigin(a.resumen_chat)
        if (gatillo) anguloLimpio = gatillo
      }

      return {
        agenda_id: a.id,
        nombre: a.nombre || "Sin nombre",
        fecha: a.fecha_closer ? a.fecha_closer.slice(0, 10) : undefined,
        hora,
        closer: a.closer || "Cristian",
        arquetipo_macro: arq.macro,
        subarquetipo: arq.subarquetipo,
        lead_score: leadScoreStr,
        es_calificado: esCalif,
        calificaba_realmente: a.calificaba_realmente || null,
        ingresos_declarados: a.ingresos || "",
        origen: origenLimpio,
        pieza_entrada: piezaEntradaLimpia,
        keyword: keywordLimpia,
        angulo_adquisicion: anguloLimpio,
        porque_agendo: a.problema_actual || a.motivo_urgencia || "",
        resultado: resComercial,
        cash_d1: cashLead,
        ticket_total: ticketLead,
        forma_pago: formaPagoLead,
        objecion_principal: a.motivo_no_cierre || (resComercial === "NO CIERRE" ? "Sin motivo cargado" : ""),
        motivo_real: a.motivo_no_cierre || (resComercial === "CIERRE" ? "Propuesta y claridad en el modelo" : ""),
        siguiente_paso: resComercial === "CIERRE" ? "Onboarding" : (a.estado || "Seguimiento"),
        fathom: fDiag,
      }
    })

    const calificadosNoCerrados = Math.max(0, calificadasPresentadas - cierresCalificados)
    const showRatePct = programadas > 0 ? (presentadas / programadas) * 100 : 0
    const showRateCalifPct = calificadasProgramadas > 0 ? (calificadasPresentadas / calificadasProgramadas) * 100 : 0
    const tcPresentadasPct = presentadas > 0 ? (cierres / presentadas) * 100 : 0
    const tcCalifPct = calificadasPresentadas > 0 ? (cierresCalificados / calificadasPresentadas) * 100 : 0

    const metricas: MetricasClosing = {
      programadas,
      presentadas,
      no_shows: noShows,
      canceladas,
      calificadas_programadas: calificadasProgramadas,
      calificadas_presentadas: calificadasPresentadas,
      no_shows_calificados: noShowsCalificados,
      calificados_no_cerrados: calificadosNoCerrados,
      cierres,
      cierres_calificados: cierresCalificados,
      no_cierres: noCierres,
      fees,
      cash_d1: cashD1,
      cash_fees: cashFees,
      ticket_total: ticketTotal,
      show_rate_pct: showRatePct,
      show_rate_calificados_pct: showRateCalifPct,
      tc_presentadas_pct: tcPresentadasPct,
      tc_calificadas_pct: tcCalifPct,
    }

    const payload: ResumenPayload = {
      periodo,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      closer,
      modo,
      metricas,
      arquetipos,
      calls: callsDetalle,
      patrones: {
        motivos_no_cierre: motivosNoCierre,
        angulos_calificados: angulosCalificados,
      },
    }

    const textoWhatsApp = generarTextoWhatsApp(payload)

    return NextResponse.json({
      ok: true,
      datos: payload,
      texto_whatsapp: textoWhatsApp,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { accion = "guardar", periodo = "dia", fecha_desde, fecha_hasta, closer = "todos", datos, texto_whatsapp } = body

    if (accion !== "guardar") {
      return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
    }

    if (!fecha_desde || !datos) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios (fecha_desde, datos)" }, { status: 400 })
    }

    const sb = createSupabaseAdmin()
    const closerSlug = (closer || "todos").toLowerCase().replace(/\s+/g, "_")

    let sourceId = ""
    let assetType = ""
    let name = ""

    if (periodo === "dia") {
      sourceId = `${fecha_desde}_${closerSlug}`
      assetType = "resumen_diario"
      name = `Closing Diario ${fecha_desde} · ${closer.toUpperCase()}`
    } else if (periodo === "semana") {
      sourceId = `${fecha_desde}_${fecha_hasta || fecha_desde}_${closerSlug}`
      assetType = "resumen_semanal"
      name = `Closing Semanal ${fecha_desde} a ${fecha_hasta} · ${closer.toUpperCase()}`
    } else {
      const mes = fecha_desde.slice(0, 7)
      sourceId = `${mes}_${closerSlug}`
      assetType = "resumen_mensual"
      name = `Closing Mensual ${mes} · ${closer.toUpperCase()}`
    }

    const metadataToStore = {
      ...datos,
      texto_whatsapp,
      version_schema: "1.0",
      timestamp_guardado: new Date().toISOString(),
    }

    const { error: upsertErr } = await sb.from("crm_integration_assets").upsert(
      {
        source: "closing",
        asset_type: assetType,
        source_id: sourceId,
        name,
        metadata: metadataToStore,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "source,asset_type,source_id" }
    )

    if (upsertErr) throw new Error(upsertErr.message)

    return NextResponse.json({
      ok: true,
      mensaje: "Reporte guardado exitosamente en crm_integration_assets",
      source_id: sourceId,
      asset_type: assetType,
      name,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
