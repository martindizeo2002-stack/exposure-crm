// El contexto del negocio que recibe Claude en cada lectura del Radar. Sale de CLAUDE.md de Central
// Negocio (oferta, avatar, reglas de la casa) más el banco de ángulos y el catálogo de formatos, que se
// leen de la base para que lo que Alex edite en el CRM llegue al análisis sin tocar código.
//
// El texto es estable a propósito (sin fechas ni datos que cambien por pedido): es el prefijo que se
// cachea entre llamadas.

import type { SupabaseClient } from "@supabase/supabase-js"

export const NEGOCIO = `EXPOSURE es un programa de formación high ticket (USD 1.500) que ayuda a construir un negocio como "IA Partner": en vez de cobrar por hora o por entregable, se cobra por resultado, con menos clientes que pagan más. La cuenta es @alexmcarrera (Alex Carrera). Mercado: LATAM hispanohablante, sobre todo Argentina, Uruguay, México, Colombia y Bolivia. Adquisición: contenido orgánico de Instagram, embudo de DM con keyword y llamada de venta. CTA habitual: comentar o mandar por DM una palabra clave a cambio de un recurso.

A QUIÉN LE HABLA EL CONTENIDO (20 a 30 años)
- El foco es "el que no sabe y quiere ganar plata": trabaja de 9 a 5 y quiere un segundo ingreso; o es universitario y estudia algo que no lo apasiona; o sabe usar IA pero no sabe cómo venderla.
- El "niño info" (setter, closer, editor, agencia chica) compra y se queda, pero el contenido NO se le dirige: está saturado de otros creadores.
- Problemas reales del 9 a 5: no puede viajar, no maneja sus tiempos, depende de un solo ingreso, no tiene plan B si lo echan, no tiene tiempo para la gente que quiere.
- Problemas del universitario: estudia por obligación, no sabe qué hacer de su vida pero quiere generar ingresos, quiere demostrarles a los padres que están equivocados.

REGLAS QUE NO SE NEGOCIAN
- Nunca criticar el trabajo en relación de dependencia ni a la gente que trabaja. Nunca decir "dejá tu trabajo". El trabajo se ataca de forma indirecta y desde la fantasía: viajar, trabajar desde la computadora, tiempo con la familia, darse gustos. Nunca ostentación vulgar.
- No se habla de hijos (el avatar tiene de 20 a 30).
- Alex no "vive de la IA": vive de escalar negocios. La IA es una herramienta y va en el gancho, nunca en la identidad ni en la promesa.
- Prohibido prometer resultados garantizados, ofrecer entregables que el programa no incluye, exagerar casos de éxito o inventar cifras. Los casos de éxito son solo los reales del banco (Bautista Quilez, Flex, Fran Puleo, Toto Báez), sin agregar números que no estén dados.
- Anti-posicionamiento frente a los gurús que venden humo: transparencia del proceso, mostrar el adentro.
- Idioma: español rioplatense con voseo, directo, cotidiano, sin relleno corporativo ni lenguaje de gurú.

ETAPAS DE CONSCIENCIA (la taxonomía del banco de ángulos)
- tofu / volumen: pieza de alcance (herramientas de IA, listas, comparativas), sin bajada a producto.
- problema: nombra el dolor del avatar.
- solucion: muestra el camino (cómo cerrar clientes con Instagram, cómo ganar dinero con IA).
- producto: caso de éxito o el programa.
- mentalidad: historia personal, procrastinación, creencias.
Mezcla del mes: 40 % problema, 30 % mentalidad, 20 % solución, 10 % producto.`

export type Banco = { angulos: Array<{ numero: number; titulo: string }>; formatos: Array<{ nombre: string; tipo: string }> }

export async function leerBanco(db: SupabaseClient): Promise<Banco> {
  const [a, f] = await Promise.all([
    db.from("crm_angulos").select("numero,titulo,activo").eq("activo", true).order("numero", { ascending: true }),
    db.from("crm_formatos").select("nombre,tipo,activo,orden").eq("activo", true).order("orden", { ascending: true }),
  ])
  return {
    angulos: (a.data || []).map((x) => ({ numero: Number(x.numero), titulo: String(x.titulo) })),
    formatos: (f.data || []).map((x) => ({ nombre: String(x.nombre), tipo: String(x.tipo) })),
  }
}

export function textoBanco(b: Banco) {
  const angulos = b.angulos.length ? b.angulos.map((a) => `${a.numero} · ${a.titulo}`).join("\n") : "(banco vacío)"
  const formatos = b.formatos.length ? b.formatos.map((f) => `${f.nombre} (${f.tipo})`).join(" · ") : "(catálogo vacío)"
  return `BANCO DE ÁNGULOS DE EXPOSURE (número · título). Usá el número; 0 si ninguno aplica. No inventes ángulos.\n${angulos}\n\nCATÁLOGO DE FORMATOS DEL CRM\n${formatos}`
}
