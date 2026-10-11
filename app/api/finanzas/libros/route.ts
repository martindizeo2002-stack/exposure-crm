import { NextResponse } from "next/server"
import { requireFinanzas } from "@/lib/finanzas-guard"
import { createSupabaseServer } from "@/lib/supabase-server"
import { AREAS_FINANZAS, LIBROS_FINANZAS } from "@/lib/finanzas-libros"

// Libros de Finanzas (gastos personales de Nahuel, de Alex y payroll de EXPOSURE).
// Tabla finanzas_registros — migración 20261011000001_finanzas_libros.sql.

const COLS = "id,libro,tipo,fecha,concepto,monto_usd,area,categoria,medio_pago,notas,creado_por,created_at,updated_at"

// Si la migración todavía no se corrió, la página muestra el aviso en vez de romperse.
function tablaFaltante(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /finanzas_registros/.test(error.message || "") && /does not exist|could not find/i.test(error.message || ""))
}
const faltaTabla = () => NextResponse.json({ error: "Falta crear la tabla finanzas_registros", codigo: "tabla_faltante" }, { status: 503 })

function limpiar(body: Record<string, unknown>, parcial: boolean) {
  const row: Record<string, unknown> = {}
  const err = (m: string) => ({ error: m })
  if (!parcial || "libro" in body) {
    if (!LIBROS_FINANZAS.some(l => l.id === body.libro)) return err("Libro inválido")
    row.libro = body.libro
  }
  if (!parcial || "tipo" in body) {
    if (body.tipo !== "gasto" && body.tipo !== "ingreso") return err("El tipo es gasto o ingreso")
    row.tipo = body.tipo
  }
  if (!parcial || "fecha" in body) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha || ""))) return err("Fecha inválida")
    row.fecha = body.fecha
  }
  if (!parcial || "concepto" in body) {
    const c = String(body.concepto || "").trim()
    if (!c) return err("Falta el concepto")
    row.concepto = c.slice(0, 300)
  }
  if (!parcial || "monto_usd" in body) {
    const m = Number(body.monto_usd)
    if (!Number.isFinite(m) || m < 0) return err("Monto inválido")
    row.monto_usd = Math.round(m * 100) / 100
  }
  if ("area" in body) {
    const a = body.area ? String(body.area) : null
    if (a && !AREAS_FINANZAS.includes(a as never)) return err("Área inválida")
    row.area = a
  }
  for (const k of ["categoria", "medio_pago", "notas"] as const) {
    if (k in body) row[k] = String(body[k] ?? "").trim().slice(0, 500) || null
  }
  return { row }
}

async function emailActual() {
  const s = await createSupabaseServer()
  const { data: { user } } = await s.auth.getUser()
  return user?.email?.toLowerCase() || null
}

export async function GET(request: Request) {
  const admin = await requireFinanzas()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const libro = new URL(request.url).searchParams.get("libro")
  const filas: unknown[] = []
  for (let from = 0; ; from += 1000) {
    let q = admin.from("finanzas_registros").select(COLS).order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(from, from + 999)
    if (libro) q = q.eq("libro", libro)
    const { data, error } = await q
    if (tablaFaltante(error)) return faltaTabla()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    filas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return NextResponse.json(filas)
}

export async function POST(request: Request) {
  const admin = await requireFinanzas()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const r = limpiar(await request.json(), false)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 })
  const { data, error } = await admin.from("finanzas_registros").insert({ ...r.row, creado_por: await emailActual() }).select(COLS).single()
  if (tablaFaltante(error)) return faltaTabla()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const admin = await requireFinanzas()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  const { id, ...resto } = body
  const r = limpiar(resto, true)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 })
  if (!Object.keys(r.row).length) return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 })
  const { data, error } = await admin.from("finanzas_registros").update({ ...r.row, updated_at: new Date().toISOString() }).eq("id", id).select(COLS).maybeSingle()
  if (tablaFaltante(error)) return faltaTabla()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "No existe ese registro" }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const admin = await requireFinanzas()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  const { error } = await admin.from("finanzas_registros").delete().eq("id", id)
  if (tablaFaltante(error)) return faltaTabla()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
