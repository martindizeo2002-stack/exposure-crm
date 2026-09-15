// portadas-formatos.mjs — baja una vez la portada (og:image) del posteo de referencia de cada
// formato y la guarda en el bucket privado imagenes-crm. Instagram no deja incrustar, y la URL
// del CDN vence, así que la imagen se copia; el link original se conserva en referencia_url.
//   node scripts/portadas-formatos.mjs
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n")
  .filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const BUCKET = "imagenes-crm"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"

const limpio = (v) => (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60)

async function portadaDe(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "es-AR,es;q=0.9" } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const html = await r.text()
  const m = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/)
    || html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/)
  if (!m) throw new Error("el posteo no expone og:image")
  return m[1].replace(/&amp;/g, "&")
}

const { data: formatos } = await sb.from("crm_formatos")
  .select("id,nombre,referencia_url,portada_url").eq("activo", true).order("orden")

for (const f of formatos) {
  if (f.portada_url) { console.log(`= ${f.nombre}: ya tiene portada`); continue }
  // El campo puede traer varios links pegados; alcanza con el primero.
  const link = String(f.referencia_url || "").trim().split(/\s+/)[0]
  if (!link) { console.log(`- ${f.nombre}: sin link de referencia`); continue }
  try {
    const imagen = await portadaDe(link)
    const resp = await fetch(imagen, { headers: { "user-agent": UA } })
    if (!resp.ok) throw new Error(`la imagen dio HTTP ${resp.status}`)
    const tipo = resp.headers.get("content-type")?.split(";")[0] || "image/jpeg"
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[tipo] || "jpg"
    const bytes = Buffer.from(await resp.arrayBuffer())
    const path = `formato/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${limpio(f.nombre)}.${ext}`
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: tipo, cacheControl: "3600", upsert: false })
    if (error) throw error
    const url = `/api/imagen?path=${encodeURIComponent(path)}`
    await sb.from("crm_formatos").update({ portada_url: url }).eq("id", f.id)
    console.log(`+ ${f.nombre}: portada de ${Math.round(bytes.length / 1024)} KB`)
  } catch (e) {
    console.log(`! ${f.nombre}: ${e.message}`)
  }
}
