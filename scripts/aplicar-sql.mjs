// aplicar-sql.mjs — corre un archivo SQL en la base de Supabase por la Management API.
//   node scripts/aplicar-sql.mjs supabase/migrations/20260911000001_tipos_pendientes.sql
// Token: SUPABASE_ACCESS_TOKEN en el entorno o ../exposure-crm-secrets/supabase-token.txt
// (se genera en https://supabase.com/dashboard/account/tokens). Reemplaza {{CRON_SECRET}} y
// {{APP_URL}} con los valores de .env.local antes de ejecutar, y anota la versión en
// supabase_migrations.schema_migrations para que `db push` no la vuelva a aplicar.
import { readFileSync, existsSync } from "node:fs"
import { basename, resolve } from "node:path"

const archivo = process.argv[2]
if (!archivo) { console.error("uso: node scripts/aplicar-sql.mjs <archivo.sql>"); process.exit(1) }

const env = Object.fromEntries(
  readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }),
)
const ref = env.SUPABASE_PROJECT_REF
const tokenArchivo = resolve("../exposure-crm-secrets/supabase-token.txt")
const token = (process.env.SUPABASE_ACCESS_TOKEN || (existsSync(tokenArchivo) ? readFileSync(tokenArchivo, "utf8") : "")).trim()
if (!ref || !token) { console.error("falta SUPABASE_PROJECT_REF en .env.local o el token de acceso"); process.exit(1) }

let sql = readFileSync(archivo, "utf8")
  .replaceAll("{{CRON_SECRET}}", env.CRON_SECRET || "")
  .replaceAll("{{APP_URL}}", (env.CRM_PUBLIC_URL || env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, ""))
const version = basename(archivo).match(/^(\d{14})/)?.[1]
if (version) {
  sql += `\ninsert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${basename(archivo).replace(/^\d+_/, "").replace(/\.sql$/, "")}') on conflict (version) do nothing;`
}

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }),
})
const cuerpo = await r.text()
console.log(r.ok ? "OK" : `HTTP ${r.status}`, cuerpo.slice(0, 2000))
process.exit(r.ok ? 0 : 2)
