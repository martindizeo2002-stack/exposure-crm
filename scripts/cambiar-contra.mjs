// Cambia la contraseña del CEO en Supabase Auth y la verifica. No imprime secretos.
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"

const EMAIL = "alex.m.carrera02@gmail.com"
const VIEJA = process.argv[2]
const NUEVA = process.argv[3]
if (!VIEJA || !NUEVA) { console.error("uso: node cambiar-contra.mjs <vieja> <nueva>"); process.exit(1) }

const env = Object.fromEntries(readFileSync("C:\\Users\\Alex\\Documents\\exposure-crm\\.env.local", "utf8").split(/\r?\n/)
  .filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: lista, error: e1 } = await admin.auth.admin.listUsers({ perPage: 200 })
if (e1) { console.error("no pude listar usuarios:", e1.message); process.exit(1) }
const user = lista.users.find((u) => (u.email || "").toLowerCase() === EMAIL)
if (!user) { console.error("no encontré el usuario", EMAIL); process.exit(1) }

const { error: e2 } = await admin.auth.admin.updateUserById(user.id, { password: NUEVA })
if (e2) { console.error("no se pudo cambiar:", e2.message); process.exit(1) }
console.log("contraseña cambiada para", EMAIL)

// verificación: entrar con la nueva y confirmar que la vieja ya no sirve
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const ok = await anon.auth.signInWithPassword({ email: EMAIL, password: NUEVA })
console.log("login con la nueva:", ok.error ? "FALLÓ → " + ok.error.message : "OK")
const vieja = await anon.auth.signInWithPassword({ email: EMAIL, password: VIEJA })
console.log("login con la vieja:", vieja.error ? "rechazado (correcto)" : "TODAVÍA ENTRA")

// archivo de login en la carpeta de secretos
const p = "C:\\Users\\Alex\\Documents\\exposure-crm-secrets\\login.txt"
try {
  let t = readFileSync(p, "utf8")
  if (t.includes(VIEJA)) { t = t.split(VIEJA).join(NUEVA); writeFileSync(p, t); console.log("login.txt actualizado") }
  else { writeFileSync(p, t.trimEnd() + `\n\nContraseña (cambiada el 11/09/2026): ${NUEVA}\n`); console.log("login.txt: la vieja no figuraba, agregué la nueva al final") }
} catch (e) { console.log("login.txt no se pudo tocar:", e.message) }
