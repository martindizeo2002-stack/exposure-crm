import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

function normPhone(phone: any): string {
  if (!phone) return ""
  const digits = String(phone).replace(/\D/g, "")
  return digits.length >= 7 ? digits.slice(-10) : digits
}

function normName(name: any): string {
  if (!name) return ""
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

function calculateCompleteness(row: any): number {
  let score = 0
  // Campos de alto valor
  if (row.resumen_chat && row.resumen_chat.length > 10) score += 5
  if (row.ia_analisis && row.ia_analisis.length > 10) score += 5
  if (row.notas && row.notas.length > 5) score += 3
  if (row.setter && row.setter !== "Sin setter") score += 3
  if (row.calificacion && row.calificacion !== "LEAD D") score += 3
  if (row.calificacion_real) score += 2
  if (row.motivo_calificacion_real) score += 2
  if (row.ocupacion && row.ocupacion !== "Sin ocupación cargada") score += 2
  if (row.ingresos) score += 2
  if (row.inversion) score += 2
  if (row.intentos_previos) score += 2
  if (row.motivo_urgencia) score += 2
  if (row.problema_actual) score += 2
  if (row.tiempo_problema) score += 2
  if (row.angulo_entrada) score += 2
  if (row.link_fathom || row.fathom_url) score += 4
  if (row.meet_link || row.link_reunion) score += 2
  if (row.person_id) score += 1
  if (row.email) score += 1
  if (row.instagram) score += 1
  if (row.show === true) score += 2
  if (row.cerro === true) score += 3
  return score
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const sb = createSupabaseAdmin()

    // Traer todas las agendas no archivadas
    const { data: allAgendas, error } = await sb
      .from("agendas")
      .select("*")
      .or("estado.is.null,estado.neq.Archivada manualmente")
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Agrupar por clave de duplicado:
    // Prioridad 1: Teléfono (últimos 8-10 dígitos)
    // Prioridad 2: Instagram (si existe)
    // Prioridad 3: Nombre normalizado
    const groups = new Map<string, any[]>()

    for (const ag of allAgendas || []) {
      const phone = normPhone(ag.telefono)
      const insta = ag.instagram ? ag.instagram.toLowerCase().replace(/[@\s]/g, "") : ""
      const name = normName(ag.nombre)

      let key = ""
      if (phone && phone.length >= 8) {
        key = `phone:${phone}`
      } else if (insta && insta.length >= 3 && insta !== "no" && insta !== "none") {
        key = `ig:${insta}`
      } else if (name && name.length >= 4 && name !== "sin nombre") {
        key = `name:${name}`
      }

      if (key) {
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(ag)
      }
    }

    const duplicateGroups: Array<{
      key: string
      count: number
      chosenToKeepId: string | number
      duplicateIds: Array<string | number>
      records: any[]
    }> = []

    for (const [key, records] of groups.entries()) {
      if (records.length > 1) {
        // Ordenar por completeness descendente y fecha más reciente
        const scored = records.map(r => ({
          record: r,
          score: calculateCompleteness(r),
        })).sort((a, b) => b.score - a.score || new Date(b.record.created_at || 0).getTime() - new Date(a.record.created_at || 0).getTime())

        const best = scored[0].record
        const duplicates = scored.slice(1).map(s => s.record)

        duplicateGroups.push({
          key,
          count: records.length,
          chosenToKeepId: best.id,
          duplicateIds: duplicates.map(d => d.id),
          records: records.map(r => ({
            id: r.id,
            nombre: r.nombre,
            telefono: r.telefono,
            instagram: r.instagram,
            fecha_agenda: r.fecha_agenda,
            fecha_closer: r.fecha_closer,
            closer: r.closer,
            setter: r.setter,
            calificacion: r.calificacion,
            ocupacion: r.ocupacion,
            estado: r.estado,
            score: calculateCompleteness(r),
            has_chat: Boolean(r.resumen_chat),
            created_at: r.created_at,
          })),
        })
      }
    }

    let executionResult = null

    if (action === "clean_duplicates") {
      let totalArchived = 0
      let totalMerged = 0

      for (const group of duplicateGroups) {
        const bestRecordFull = allAgendas!.find(a => a.id === group.chosenToKeepId)!
        const dupsFull = allAgendas!.filter(a => group.duplicateIds.includes(a.id))

        // Combinar datos faltantes en el mejor registro
        const mergedUpdates: Record<string, any> = {}
        const fieldsToCheck = [
          "resumen_chat", "ia_analisis", "notas", "setter", "instagram", "email",
          "calificacion", "ocupacion", "ingresos", "inversion", "motivo_urgencia",
          "intentos_previos", "problema_actual", "tiempo_problema", "angulo_entrada",
          "link_fathom", "fathom_url", "meet_link", "link_reunion", "person_id"
        ]

        for (const field of fieldsToCheck) {
          if (!bestRecordFull[field] || bestRecordFull[field] === "Sin setter" || bestRecordFull[field] === "Sin ocupación cargada") {
            const donor = dupsFull.find(d => d[field] && d[field] !== "Sin setter" && d[field] !== "Sin ocupación cargada")
            if (donor) {
              mergedUpdates[field] = donor[field]
            }
          }
        }

        if (Object.keys(mergedUpdates).length > 0) {
          mergedUpdates.updated_at = new Date().toISOString()
          await sb.from("agendas").update(mergedUpdates).eq("id", bestRecordFull.id)
          totalMerged++
        }

        // Archivar los duplicados
        const { data: archData, error: archErr } = await sb
          .from("agendas")
          .update({
            estado: "Archivada manualmente",
            motivo_no_cierre: `Archivado manual: Duplicado de agenda ${bestRecordFull.id}`,
            updated_at: new Date().toISOString(),
          })
          .in("id", group.duplicateIds)

        if (!archErr) {
          totalArchived += group.duplicateIds.length
        }
      }

      executionResult = {
        totalGroupsDeduplicated: duplicateGroups.length,
        totalArchived,
        totalMergedWithEnrichedData: totalMerged,
      }
    }

    return NextResponse.json({
      totalAgendasActivas: allAgendas?.length || 0,
      totalGruposDuplicados: duplicateGroups.length,
      duplicateGroups,
      executionResult,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
