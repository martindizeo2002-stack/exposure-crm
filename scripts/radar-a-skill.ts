// radar-a-skill.ts — retroalimenta la skill /historias-ig con las historias que captura el Radar.
//
//   1. FICHAS: cada día de historias de una cuenta seguida (sin la propia) se convierte en una ficha de
//      secuencia con el formato del corpus de la skill: frames con el texto verbatim y sus cajas, función de
//      cada frame, tipo y estructura (código del catálogo de la skill, o "nueva"), hilo, keyword, recurso,
//      por qué funciona, fórmulas reutilizables y cómo la usaría EXPOSURE. Se guarda en radar_secuencias.
//   2. APRENDIZAJES: una vez por semana (la semana anterior completa) destila las fichas: estructuras que más
//      se usaron, estructuras nuevas, hooks, transiciones y CTA textuales, keywords y recursos, ideas para
//      EXPOSURE y qué conviene cambiar en la skill. Se guarda en radar_aprendizajes.
//   3. EXPORTA a la skill (archivos que la skill lee):
//        references/corpus/radar/AAAA-MM.md     las fichas del mes
//        references/corpus/INDEX.md             una línea por ficha, entre las marcas <!-- radar:inicio/fin -->
//        references/radar-aprendizajes.md       la síntesis de la última semana + el historial
//
// Corre solo con el respaldo del cerebro (scripts/respaldar-cerebro.ps1, cada 4 h). A mano:
//   npx tsx scripts/radar-a-skill.ts                 fichas pendientes + síntesis si toca + exportar
//   npx tsx scripts/radar-a-skill.ts --solo-exportar
//   npx tsx scripts/radar-a-skill.ts --max 5         tope de fichas nuevas por corrida (default 12)
//   npx tsx scripts/radar-a-skill.ts --sintesis      rehace la síntesis de la última semana completa
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { createClient } from "@supabase/supabase-js"
import * as z from "zod/v4"

for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
}

const SKILL = path.join(os.homedir(), "Documents", "EXPOSURE", "Central Negocio", ".claude", "skills", "historias-ig")
const REF = path.join(SKILL, "references")
const MODELO = process.env.RADAR_MODELO || "claude-opus-5-5"
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const claude = new Anthropic({ maxRetries: 1, timeout: 180_000 })
const args = process.argv.slice(2)
const MAX = Number(args[args.indexOf("--max") + 1]) || 12
const SOLO_EXPORTAR = args.includes("--solo-exportar")
const FORZAR_SINTESIS = args.includes("--sintesis")
const ZONA = "America/Argentina/Buenos_Aires"

const diaLocal = (f: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(f))
const horaLocal = (f: string) => new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" }).format(new Date(f))
const urlPublica = (p: string) => `${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")}/storage/v1/object/public/radar/${p.split("/").map(encodeURIComponent).join("/")}`
const semanaISO = (d: Date) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); const i = Date.UTC(t.getUTCFullYear(), 0, 1); return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - i) / 864e5 + 1) / 7)).padStart(2, "0")}` }
const log = (m: string) => console.log(`${new Date().toISOString().slice(0, 16)} ${m}`)

// ── Contexto que lee Claude: el catálogo de estructuras de la skill y las reglas del negocio ────────────────
function catalogo() {
  const lineas: string[] = []
  for (const f of ["hr.md", "cta.md", "wn.md", "nutricion.md"]) {
    const p = path.join(REF, "estructuras", f)
    if (!existsSync(p)) continue
    for (const l of readFileSync(p, "utf8").split(/\r?\n/)) if (/^#{2,3} [A-Z]/.test(l)) lineas.push(l.replace(/^#+ /, "- "))
  }
  return lineas.join("\n")
}
async function negocio() {
  const { NEGOCIO, leerBanco, textoBanco } = await import("../lib/radar/contexto")
  return `${NEGOCIO}\n\n${textoBanco(await leerBanco(db))}`
}

// ── Esquemas ────────────────────────────────────────────────────────────────────
const TIPOS = ["HR", "CTA", "WN", "POLL", "AWARE", "PRUEBA", "LIBRE", "PRESENTACION", "TEASER"] as const
const EFicha = z.object({
  titulo: z.string(),
  tipo: z.enum(TIPOS),
  estructura: z.string(),
  estructura_nueva: z.string(),
  hilo: z.string(),
  keyword: z.string(),
  recurso: z.string(),
  escasez: z.string(),
  frames: z.array(z.object({ n: z.int(), funcion: z.string(), texto: z.string(), hablado: z.string(), visual: z.string(), sticker: z.string() })),
  por_que_funciona: z.array(z.string()),
  formulas: z.array(z.string()),
  para_exposure: z.object({ idea: z.string(), avatar: z.enum(["9a5", "universitario", "sabe_ia", "transversal"]), tipo: z.enum(TIPOS), estructura: z.string(), angulo_numero: z.int(), borrador: z.array(z.string()) }),
})
const ESintesis = z.object({
  resumen: z.string(),
  estructuras_mas_usadas: z.array(z.object({ codigo: z.string(), veces: z.int(), cuentas: z.array(z.string()), lectura: z.string() })),
  estructuras_nuevas: z.array(z.object({ nombre: z.string(), recorrido: z.string(), cuenta: z.string(), ficha_id: z.string(), cuando_usarla: z.string() })),
  hooks: z.array(z.object({ texto: z.string(), cuenta: z.string(), patron: z.string() })),
  transiciones: z.array(z.object({ texto: z.string(), cuenta: z.string() })),
  ctas: z.array(z.object({ texto: z.string(), cuenta: z.string(), keyword: z.string() })),
  recursos: z.array(z.object({ keyword: z.string(), recurso: z.string(), cuenta: z.string() })),
  ideas_exposure: z.array(z.object({ idea: z.string(), avatar: z.string(), tipo: z.string(), estructura: z.string(), angulo: z.string(), por_que: z.string() })),
  cambios_para_la_skill: z.array(z.string()),
})

async function pedir<E extends z.ZodType>(esquema: E, sistema: string, contenido: Array<Anthropic.Beta.Messages.BetaContentBlockParam>) {
  const r = await claude.beta.messages.parse({
    model: MODELO, max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: contenido }],
    output_config: { effort: "medium", format: betaZodOutputFormat(esquema) },
  })
  if (r.stop_reason === "refusal") throw new Error("el modelo declinó el pedido")
  if (r.stop_reason === "max_tokens") throw new Error("la respuesta se cortó por largo")
  if (!r.parsed_output) throw new Error("la respuesta no vino en el formato pedido")
  return { datos: r.parsed_output as z.infer<E>, modelo: r.model, uso: r.usage }
}

const TAREA_FICHA = `TAREA
Sos el analista de historias de EXPOSURE. Recibís las historias que publicó en un día una cuenta que seguimos (referente o competencia), en orden, con la imagen de cada una, lo que se dice y los stickers. Devolvés la ficha de la secuencia para el corpus de la skill de historias. La ficha se usa para MODELAR la forma, nunca para copiar el tema o el copy.

CAMPOS
- titulo: el tema en 3 a 6 palabras, en minúsculas (ej. "4hs por dia hhss").
- tipo: HR (pide levantar la mano a cambio de un recurso), CTA (manda a agendar, a una llamada o al programa), WN (urgencia real: cupos, cierre, suba), POLL (encuesta o caja de preguntas), AWARE (instala un problema o explica el producto), PRUEBA (casos y resultados de clientes), LIBRE (vida personal, sin intención), PRESENTACION ("qué hago"), TEASER (anuncia un evento).
- estructura: el código del catálogo de la skill que mejor la describe (ej. HR-OBJ, CTA-CASO, WN-CUPOS). Si ninguno encaja, "nueva".
- estructura_nueva: si es nueva, su recorrido en flechas (ej. "Costo de oportunidad → Prueba de comunidad → Método en 3 pasos → Doc"); si no, "".
- hilo: la secuencia en UNA frase: a quién + problema o afirmación + prueba + pedido.
- keyword: la palabra que pide responder, en mayúsculas; "" si no hay. recurso: lo que entrega a cambio; "". escasez: la escasez o urgencia textual; "".
- frames: uno por historia, en orden. funcion = qué hace ese frame en la secuencia (hook gancho, problema, prueba, mecanismo, puente, recurso + CTA…). texto = el texto en pantalla VERBATIM, caja por caja separadas con " / ", con el color de la caja entre corchetes: [negra], [blanca], [crema], [amarilla], [roja], [sin caja]; palabras resaltadas entre *asteriscos*. hablado = lo que se dice (si se pasó), resumido en una línea si es largo; "". visual = qué se ve en una línea. sticker = link, encuesta, caja, mención o "".
- por_que_funciona: de 2 a 4 puntos concretos sobre la mecánica (es análisis, no dato: no inventes métricas).
- formulas: de 1 a 3 fórmulas reutilizables con [variables] entre corchetes, sacadas del copy textual.
- para_exposure: cómo usaría EXPOSURE esta forma con SU avatar y SUS reglas. idea en una o dos oraciones; avatar al que le habla; tipo y estructura; angulo_numero del banco (0 si ninguno); borrador = 3 a 6 frames de texto en pantalla, cortos, en rioplatense, respetando todas las reglas de la casa (sin criticar el trabajo, sin cifras inventadas: FALTA donde haga falta un número o un caso).`

const TAREA_SINTESIS = `TAREA
Recibís las fichas de las secuencias de historias que publicaron en una semana las cuentas que sigue EXPOSURE. Destilá lo que hay que llevar a la skill de historias de EXPOSURE:
- resumen: qué pasó en la semana en 3 o 4 oraciones (qué tipos y estructuras dominaron, quién empujó qué).
- estructuras_mas_usadas: código, veces, cuentas y una lectura de cuándo la usan.
- estructuras_nuevas: las que no están en el catálogo y vale la pena sumar, con su recorrido y cuándo usarla.
- hooks, transiciones, ctas: los mejores TEXTUALES, con la cuenta (y el patrón abstracto en los hooks). Hasta 10 de cada uno.
- recursos: qué keywords usan y qué entregan.
- ideas_exposure: hasta 8 ideas de secuencias para EXPOSURE, cada una con avatar, tipo, estructura, ángulo del banco y por qué.
- cambios_para_la_skill: propuestas concretas para el catálogo, el banco de copy o el calendario de la skill (ej. "sumar la estructura X a hr.md"). Solo lo que esté respaldado por las fichas.
Nada inventado: todo sale de las fichas.`

// ── 1. Fichas ───────────────────────────────────────────────────────────────────
type H = { id: string; cuenta: string; fecha: string; tipo: string | null; caption: string | null; tx: string | null; stickers: Record<string, unknown>; frame_path: string | null; lectura: { tipo?: string; texto?: string; keyword?: string } | null }

async function fichas() {
  const { data: semillas } = await db.from("radar_semillas").select("handle,tags")
  const propias = new Set((semillas || []).filter((s) => (s.tags || []).includes("propia")).map((s) => s.handle))
  const desde = new Date(Date.now() - 14 * 864e5).toISOString()
  const { data, error } = await db.from("radar_historias").select("id,cuenta,fecha,tipo,caption,tx,stickers,frame_path,lectura").gte("fecha", desde).not("frame_path", "is", null).order("fecha")
  if (error) throw new Error(error.message)
  const grupos = new Map<string, H[]>()
  for (const h of (data || []) as H[]) {
    if (propias.has(h.cuenta)) continue
    const k = `${h.cuenta}|${diaLocal(h.fecha)}`
    const l = grupos.get(k) || []; l.push(h); grupos.set(k, l)
  }
  // Un día está completo cuando ya pasó el rechequeo de las 22 del día siguiente (las historias viven 24 h).
  const ahora = Date.now()
  // --hasta-ayer: toma cualquier día anterior a hoy aunque todavía pueda sumar historias (para probar).
  const completo = (dia: string) => args.includes("--hasta-ayer") ? dia < diaLocal(new Date()) : ahora > new Date(`${dia}T22:30:00-03:00`).getTime() + 864e5
  const { data: hechas } = await db.from("radar_secuencias").select("id,n_historias")
  const ya = new Map((hechas || []).map((s) => [s.id, s.n_historias]))
  const pendientes = [...grupos].filter(([k, l]) => completo(k.split("|")[1]) && ya.get(k) !== l.length).slice(0, MAX)
  if (!pendientes.length) return log("fichas: nada pendiente")
  const sistema = `${await negocio()}\n\nCATÁLOGO DE ESTRUCTURAS DE LA SKILL (código · recorrido)\n${catalogo()}\n\n${TAREA_FICHA}`
  for (const [k, l] of pendientes) {
    const [cuenta, dia] = k.split("|")
    const tanda = l.slice(0, 16)
    const contenido: Array<Anthropic.Beta.Messages.BetaContentBlockParam> = tanda.map((h) => ({ type: "image", source: { type: "url", url: urlPublica(h.frame_path as string) } }))
    contenido.push({ type: "text", text: `CUENTA @${cuenta} · ${dia} · ${tanda.length} historias, en orden (la imagen n es la historia n).\n\n` + tanda.map((h, i) => {
      const st = h.stickers || {}
      return `${i + 1}. ${horaLocal(h.fecha)} · ${h.tipo || "historia"}${h.tx ? ` · hablado: ${h.tx.slice(0, 600)}` : ""}${(st.links as string[] | undefined)?.length ? ` · link: ${(st.links as string[]).join(", ")}` : ""}${(st.encuestas as string[] | undefined)?.length ? ` · encuesta: ${(st.encuestas as string[]).join(" / ")}` : ""}${(st.preguntas as string[] | undefined)?.length ? ` · caja: ${(st.preguntas as string[]).join(" / ")}` : ""}${(st.menciones as string[] | undefined)?.length ? ` · menciones: @${(st.menciones as string[]).join(", @")}` : ""}`
    }).join("\n") })
    try {
      const r = await pedir(EFicha, sistema, contenido)
      await db.from("radar_secuencias").upsert({ id: k, cuenta, dia, n_historias: l.length, historias: l.map((h) => h.id), ficha: r.datos, error: null, modelo: r.modelo }, { onConflict: "id" })
      log(`ficha ${k}: ${r.datos.tipo} ${r.datos.estructura} · ${r.datos.titulo} · ${r.uso.input_tokens + (r.uso.cache_read_input_tokens || 0)} in / ${r.uso.output_tokens} out`)
    } catch (e) {
      await db.from("radar_secuencias").upsert({ id: k, cuenta, dia, n_historias: l.length, historias: l.map((h) => h.id), error: (e as Error).message.slice(0, 300) }, { onConflict: "id" })
      log(`ficha ${k}: ERROR ${(e as Error).message.slice(0, 200)}`)
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.RateLimitError) break
    }
  }
}

// ── 2. Síntesis semanal ─────────────────────────────────────────────────────────
async function sintesis() {
  const hoy = new Date(); const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - 7)
  const desde = diaLocal(lunes), hasta = diaLocal(new Date(lunes.getTime() + 6 * 864e5)), semana = semanaISO(lunes)
  const { data: ya } = await db.from("radar_aprendizajes").select("semana").eq("semana", semana).maybeSingle()
  if (ya && !FORZAR_SINTESIS) return log(`síntesis ${semana}: ya estaba`)
  const { data } = await db.from("radar_secuencias").select("id,cuenta,dia,ficha").gte("dia", desde).lte("dia", hasta).not("ficha", "is", null)
  if (!data || data.length < 3) return log(`síntesis ${semana}: solo ${data?.length || 0} fichas, se espera a tener 3`)
  const r = await pedir(ESintesis, `${await negocio()}\n\nCATÁLOGO DE ESTRUCTURAS DE LA SKILL\n${catalogo()}\n\n${TAREA_SINTESIS}`, [{ type: "text", text: `SEMANA ${semana} (${desde} a ${hasta}) · ${data.length} secuencias\n\n${JSON.stringify(data.map((s) => ({ id: s.id, ...s.ficha })), null, 0)}` }])
  await db.from("radar_aprendizajes").upsert({ semana, desde, hasta, n_secuencias: data.length, resultado: r.datos, modelo: r.modelo }, { onConflict: "semana" })
  log(`síntesis ${semana}: ${data.length} fichas`)
}

// ── 3. Exportar a la skill ──────────────────────────────────────────────────────
type Ficha = z.infer<typeof EFicha>
function mdFicha(id: string, f: Ficha) {
  const [cuenta, dia] = id.split("|")
  const est = f.estructura === "nueva" ? `nueva — "${f.estructura_nueva}"` : f.estructura
  return [
    `## R-${dia} · ${f.keyword || "(sin keyword)"} · ${f.titulo} (${cuenta})`,
    `- **Frames:** ${f.frames.length} · **Tipo:** ${f.tipo} · **Estructura:** ${est}`,
    `- **Hilo:** ${f.hilo}`,
    `- **Keyword / CTA:** ${f.keyword || "—"} · **Recurso:** ${f.recurso || "—"} · **Escasez:** ${f.escasez || "no"}`,
    "",
    "| # | Función del frame | Texto en pantalla VERBATIM | Hablado | Visual | Sticker |",
    "|---|---|---|---|---|---|",
    ...f.frames.map((x) => `| ${x.n} | ${x.funcion} | ${x.texto.replace(/\|/g, "/").replace(/\n/g, " ")} | ${x.hablado.replace(/\|/g, "/").replace(/\n/g, " ") || "—"} | ${x.visual.replace(/\|/g, "/")} | ${x.sticker || "—"} |`),
    "",
    "**Por qué funciona** (análisis, no dato):",
    ...f.por_que_funciona.map((p) => `- ${p}`),
    "",
    "**Fórmulas reutilizables:**",
    ...f.formulas.map((p) => `- "${p}"`),
    "",
    `**Para EXPOSURE** (${f.para_exposure.avatar} · ${f.para_exposure.tipo} · ${f.para_exposure.estructura}${f.para_exposure.angulo_numero ? ` · ángulo ${f.para_exposure.angulo_numero}` : ""}): ${f.para_exposure.idea}`,
    ...f.para_exposure.borrador.map((b, i) => `  ${i + 1}. ${b}`),
    "", "---", "",
  ].join("\n")
}

async function exportar() {
  const { data: sec } = await db.from("radar_secuencias").select("id,cuenta,dia,ficha").not("ficha", "is", null).order("dia")
  const dir = path.join(REF, "corpus", "radar")
  mkdirSync(dir, { recursive: true })
  const porMes = new Map<string, Array<{ id: string; f: Ficha }>>()
  for (const s of sec || []) { const m = String(s.dia).slice(0, 7); const l = porMes.get(m) || []; l.push({ id: s.id, f: s.ficha as Ficha }); porMes.set(m, l) }
  for (const [mes, l] of porMes) {
    writeFileSync(path.join(dir, `${mes}.md`), `# Radar · historias de las cuentas seguidas · ${mes}\n\n> Generado por el Radar del CRM (scripts/radar-a-skill.ts). No editar a mano: se regenera. Cuentas: Radar → Semillas.\n> Convenciones iguales al resto del corpus: cajas separadas con " / ", color de caja entre corchetes, *resaltado*.\n> Son de cuentas que seguimos **ahora**: más frescas que el resto del corpus. Se modela la forma, nunca se copia el copy ni el tema.\n\n---\n\n` + l.map((x) => mdFicha(x.id, x.f)).join(""))
  }
  for (const f of readdirSync(dir)) if (f.endsWith(".md") && !porMes.has(f.slice(0, 7))) writeFileSync(path.join(dir, f), "")
  // índice
  const idx = path.join(REF, "corpus", "INDEX.md")
  const filas = (sec || []).slice().reverse().map((s) => { const f = s.ficha as Ficha; return `| radar/${String(s.dia).slice(0, 7)}.md | R-${s.dia} · ${f.keyword || ""} · ${f.titulo} (${s.cuenta}) | ${f.frames.length} | ${f.tipo} | ${f.estructura === "nueva" ? `nueva — "${f.estructura_nueva}"` : f.estructura} |` })
  const bloque = `<!-- radar:inicio -->\n## Radar (cuentas seguidas, se actualiza solo)\n\n| Archivo | Secuencia | Frames | Tipo | Estructura |\n|---|---|---|---|---|\n${filas.join("\n")}\n<!-- radar:fin -->`
  let s = readFileSync(idx, "utf8")
  s = /<!-- radar:inicio -->[\s\S]*<!-- radar:fin -->/.test(s) ? s.replace(/<!-- radar:inicio -->[\s\S]*<!-- radar:fin -->/, bloque) : `${s.trimEnd()}\n\n${bloque}\n`
  writeFileSync(idx, s)
  // aprendizajes
  const { data: ap } = await db.from("radar_aprendizajes").select("*").order("semana", { ascending: false }).limit(8)
  const sec2md = (a: { semana: string; desde: string; hasta: string; n_secuencias: number; resultado: z.infer<typeof ESintesis> }, completa: boolean) => {
    const r = a.resultado
    const partes = [`## ${a.semana} (${a.desde} a ${a.hasta}) · ${a.n_secuencias} secuencias`, "", r.resumen, ""]
    if (!completa) return partes.join("\n")
    partes.push("### Estructuras que más se usaron", ...r.estructuras_mas_usadas.map((e) => `- **${e.codigo}** ×${e.veces} (${e.cuentas.join(", ")}): ${e.lectura}`), "")
    if (r.estructuras_nuevas.length) partes.push("### Estructuras nuevas (no están en el catálogo)", ...r.estructuras_nuevas.map((e) => `- **${e.nombre}**: ${e.recorrido}. Cuándo: ${e.cuando_usarla} (@${e.cuenta}, ficha ${e.ficha_id})`), "")
    partes.push("### Hooks textuales", ...r.hooks.map((h) => `- "${h.texto}" (@${h.cuenta}) · patrón: ${h.patron}`), "")
    partes.push("### Transiciones", ...r.transiciones.map((h) => `- "${h.texto}" (@${h.cuenta})`), "")
    partes.push("### CTA", ...r.ctas.map((h) => `- "${h.texto}" (@${h.cuenta}${h.keyword ? ` · ${h.keyword}` : ""})`), "")
    partes.push("### Keywords y recursos", ...r.recursos.map((h) => `- ${h.keyword} → ${h.recurso} (@${h.cuenta})`), "")
    partes.push("### Ideas de secuencias para EXPOSURE", ...r.ideas_exposure.map((h) => `- **${h.tipo} · ${h.estructura} · ${h.avatar}${h.angulo ? ` · ${h.angulo}` : ""}:** ${h.idea} — ${h.por_que}`), "")
    partes.push("### Cambios propuestos para la skill (los aprueba Alex)", ...r.cambios_para_la_skill.map((h) => `- ${h}`), "")
    return partes.join("\n")
  }
  const ap2 = (ap || []) as Array<Parameters<typeof sec2md>[0]>
  writeFileSync(path.join(REF, "radar-aprendizajes.md"), [
    "# Lo que enseña el Radar (historias de las cuentas seguidas)", "",
    "> Generado por el Radar del CRM cada semana (scripts/radar-a-skill.ts). No editar a mano. Las fichas completas están en",
    "> `corpus/radar/` y en el índice del corpus. Todo lo de acá se usa para MODELAR (forma, copy, ideas) con las reglas de la",
    "> marca: si algo choca con `perfil-marca.md`, `nivel-calidad.md` o las reglas de EXPOSURE, mandan esas.", "",
    ap2.length ? ap2.map((a, i) => sec2md(a, i < 2)).join("\n---\n\n") : "_Todavía no hay una semana completa con fichas._", "",
  ].join("\n"))
  log(`exportado: ${(sec || []).length} fichas en ${porMes.size} mes(es) · ${ap2.length} semana(s) de aprendizajes`)
}

async function main() {
  if (!existsSync(REF)) throw new Error(`no encuentro la skill en ${SKILL}`)
  if (!SOLO_EXPORTAR) {
    if (!process.env.ANTHROPIC_API_KEY) log("sin ANTHROPIC_API_KEY: solo se exporta")
    else { await fichas(); await sintesis() }
  }
  await exportar()
}
main().catch((e) => { console.error("ERROR", (e as Error).message); process.exit(1) })
