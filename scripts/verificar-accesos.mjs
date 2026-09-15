// verificar-accesos.mjs — prueba el login real de cada cuenta anotada en el archivo de accesos
// (../exposure-crm-secrets/usuarios.txt) y avisa cuál no entra. Correrlo después de tocar
// contraseñas, mails o altas del equipo: una contraseña anotada mal no se nota hasta que alguien
// intenta entrar y ahí ya es tarde.
//   node scripts/verificar-accesos.mjs
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))

// El archivo anota la clave de dos formas: "<mail>  contraseña: <clave>" y
// "<nombre> (rol, alta) · <mail> · <clave>". Se aceptan las dos.
const MEDIO = "\u00b7"
const cuentas = []
for (const linea of fs.readFileSync("../exposure-crm-secrets/usuarios.txt", "utf8").split("\n")) {
  if (linea.trim().startsWith("#")) continue
  const mail = linea.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  if (!mail) continue
  const etiquetada = linea.match(/contrase\u00f1a:\s*(\S+)/)
  const partes = linea.split(MEDIO).map((x) => x.trim()).filter(Boolean)
  const ultima = partes.length > 1 ? partes[partes.length - 1] : null
  const clave = etiquetada ? etiquetada[1] : (ultima && !ultima.includes("@") ? ultima.split(/\s+/).pop() : null)
  if (clave) cuentas.push({ email: mail[0].toLowerCase(), clave })
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: equipo } = await admin.from("team_members").select("email,nombre,rol,estado")
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 })

let fallan = 0
for (const c of cuentas) {
  const ficha = equipo?.find((x) => x.email?.toLowerCase() === c.email)
  const usuario = lista?.users.find((x) => x.email?.toLowerCase() === c.email)
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await anon.auth.signInWithPassword({ email: c.email, password: c.clave })
  if (error) fallan++
  const estado = ficha ? `${ficha.rol}/${ficha.estado}` : "SIN FILA en team_members"
  const login = usuario ? (usuario.email_confirmed_at ? "" : " · mail sin confirmar") : " · SIN usuario de login"
  console.log(`${error ? "NO ENTRA" : "entra   "}  ${(ficha?.nombre || "(sin ficha)").padEnd(18)} ${c.email.padEnd(34)} ${estado}${login}`)
}

// Cuentas del equipo que no figuran en el archivo: de esas nadie tiene la contraseña anotada.
const anotadas = new Set(cuentas.map((c) => c.email))
const sinAnotar = (equipo || []).filter((m) => !anotadas.has(String(m.email || "").toLowerCase()))
if (sinAnotar.length) {
  console.log("\nSin contraseña anotada en el archivo:")
  for (const m of sinAnotar) console.log(`   ${(m.nombre || "?").padEnd(18)} ${String(m.email).padEnd(34)} ${m.rol}/${m.estado}`)
}
console.log(`\n${cuentas.length - fallan} de ${cuentas.length} cuentas anotadas entran`)
