import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireFinanzas } from "@/lib/finanzas-guard"
import { createSupabaseServer } from "@/lib/supabase-server"
import { AREAS_FINANZAS, LIBROS_FINANZAS, type RegistroFinanzas } from "@/lib/finanzas-libros"

// Libros de Finanzas (gastos personales de Nahuel, de Alex y payroll de EXPOSURE), en Finanzas → Centro Financiero.
// Guarda en la tabla finanzas_registros (migración 20261011000001). Mientras esa tabla no exista, cada registro
// va a crm_config con la clave `finanzas_reg:<id>` y el registro en JSON; cuando la tabla aparece, la primera
// lectura pasa esos registros a la tabla y los borra de crm_config.

type Admin = NonNullable<Awaited<ReturnType<typeof requireFinanzas>>>
const COLS = "id,libro,tipo,fecha,concepto,monto_usd,area,categoria,medio_pago,notas,creado_por,created_at,updated_at"
const PREFIJO = "finanzas_reg:"

function tablaFaltante(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || (/finanzas_registros/.test(error.message || "") && /does not exist|could not find/i.test(error.message || "")))
}

async function usaTabla(admin: Admin) {
  const { error } = await admin.from("finanzas_registros").select("id").limit(1)
  if (!error) return true
  if (tablaFaltante(error)) return false
  throw new Error(error.message)
}

async function leerConfig(admin: Admin): Promise<RegistroFinanzas[]> {
  const out: RegistroFinanzas[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("crm_config").select("clave,valor").like("clave", `${PREFIJO}%`).range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data || []) { try { out.push(JSON.parse(r.valor)) } catch { /* fila corrupta: se ignora */ } }
    if (!data || data.length < 1000) break
  }
  return out
}

const ordenar = (filas: RegistroFinanzas[]) => filas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at))

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

const fallo = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : "Error de servidor" }, { status: 500 })

export async function GET() {
  const admin = await requireFinanzas()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  try {
    if (!(await usaTabla(admin))) return NextResponse.json(ordenar(await leerConfig(admin)))
    // La tabla ya existe: si quedaron registros guardados antes en crm_config, se pasan (una sola vez).
    const pendientes = await leerConfig(admin)
    if (pendientes.length) {
      const { error } = await admin.from("finanzas_registros").upsert(pendientes, { onConflict: "id" })
      if (!error) await admin.from("crm_config").delete().like("clave", `${PREFIJO}%`)
    }
    const filas: RegistroFinanzas[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("finanzas_registros").select(COLS).order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(from, from + 999)
      if (error) throw new Error(error.message)
      filas.push(...((data || []) as RegistroFinanzas[]))
      if (!data || data.length < 1000) break
    }
    return NextResponse.json(filas)
  } catch (e) { return fallo(e) }
}

export async function POST(request: Request) {
  const admin = await requireFinanzas()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const r = limpiar(await request.json(), false)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 })
  try {
    const ahora = new Date().toISOString()
    const nuevo = { id: randomUUID(), area: null, categoria: null, medio_pago: null, notas: null, ...r.row, creado_por: await emailActual(), created_at: ahora, updated_at: ahora } as RegistroFinanzas
    if (await usaTabla(admin)) {
      const { data, error } = await admin.from("finanzas_registros").insert(nuevo).select(COLS).single()
      if (error) throw new Error(error.message)
      return NextResponse.json(data)
    }
    const { error } = await admin.from("crm_config").insert({ clave: `${PREFIJO}${nuevo.id}`, valor: JSON.stringify(nuevo), updated_at: ahora })
    if (error) throw new Error(error.message)
    return NextResponse.json(nuevo)
  } catch (e) { return fallo(e) }
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
  try {
    const ahora = new Date().toISOString()
    if (await usaTabla(admin)) {
      const { data, error } = await admin.from("finanzas_registros").update({ ...r.row, updated_at: ahora }).eq("id", id).select(COLS).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return NextResponse.json({ error: "No existe ese registro" }, { status: 404 })
      return NextResponse.json(data)
    }
    const clave = `${PREFIJO}${id}`
    const { data: actual, error: errLeer } = await admin.from("crm_config").select("valor").eq("clave", clave).maybeSingle()
    if (errLeer) throw new Error(errLeer.message)
    if (!actual) return NextResponse.json({ error: "No existe ese registro" }, { status: 404 })
    const nuevo = { ...JSON.parse(actual.valor), ...r.row, updated_at: ahora }
    const { error } = await admin.from("crm_config").update({ valor: JSON.stringify(nuevo), updated_at: ahora }).eq("clave", clave)
    if (error) throw new Error(error.message)
    return NextResponse.json(nuevo)
  } catch (e) { return fallo(e) }
}

export async function DELETE(request: Request) {
  const admin = await requireFinanzas()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })
  try {
    if (await usaTabla(admin)) {
      const { error } = await admin.from("finanzas_registros").delete().eq("id", id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await admin.from("crm_config").delete().eq("clave", `${PREFIJO}${id}`)
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (e) { return fallo(e) }
}
