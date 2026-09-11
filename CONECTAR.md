# Conectar el CRM al negocio real — checklist

Actualizado 11/09/2026 (tarde). Qué está conectado, qué falta y quién hace cada cosa.
Las claves van en `.env.local` (y en Vercel cuando se despliegue). Nunca al repo.

## 1 · Lo que ya está conectado

- [x] **Supabase** — base de datos, login, esquema completo (`NEXT_PUBLIC_SUPABASE_URL`, `…ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- [x] **Usuario CEO** — alex.m.carrera02@gmail.com, aprobado.
- [x] **Secreto de crons** (`CRON_SECRET`) — cargado, todavía sin crons que lo usen.
- [x] **Panel del negocio** — lee del CRM; hoy muestra la demo porque el CRM está vacío.
- [x] **ManyChat** — clave cargada y probada (página "Alex Carrera").
- [x] **Calendly** — token cargado y probado (org EXPOSURE; evento activo "1-1 con Alex (Exposure)"; sin webhooks todavía).
- [x] **Fathom** — clave cargada y probada (lee las reuniones); secreto de webhook guardado para cuando exista el endpoint.
- [x] **Stripe** — clave restringida cargada y probada (cuenta live, lee cobros y balance).
- [x] **Meta Ads** — token del System User y cuenta `act_…` ("Exposure", USD) cargados y probados. Ese token todavía no ve ninguna página ni cuenta de Instagram.
- [x] **Clave de ingesta** (`CRM_INGEST_KEY`) — generada.

## 2 · Claves que faltan (las conseguís vos)

| # | Servicio | Variable | Dónde se saca | Qué destraba |
|---|---|---|---|---|
| ~~1~~ ✅ | **ManyChat** | `MANYCHAT_API_KEY` | ManyChat → Settings → API → Generate key (plan Pro) | Leads y conversaciones, atribución por keyword, embudo y fuentes |
| ~~2~~ ✅ | **Calendly** | `CALENDLY_TOKEN` *(nuevo)* | Calendly → Integrations → API & Webhooks → Personal Access Token | Agendas en el pipeline sin cargar a mano |
| ~~3~~ ✅ | **Fathom** | `FATHOM_API_KEY` | Fathom → Settings → API (plan Team, la cuenta donde graban los closers) | Show / no show real, motivo de no cierre, análisis de cada llamada |
| 4 | **Anthropic** | `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | La IA que lee las llamadas y el asistente interno |
| ~~5~~ ✅ | **Stripe** | `STRIPE_SECRET_KEY` *(nuevo, restringida solo lectura)* | Stripe → Developers → API keys → Restricted key | Pagos y cash collected automáticos |
| ~~6~~ ✅ | **Meta Ads** | `META_ADS_ACCESS_TOKEN` + `META_ADS_ACCOUNT_ID` | Business Settings → System users → token con `ads_read`; el ID es `act_…` | Inversión, costo por venta, ROAS |
| 7 | **Instagram Graph** | `IG_ACCESS_TOKEN` + `IG_BUSINESS_ID` *(nuevos)* | En Business Settings, asignarle al System User la página de Facebook y la cuenta de Instagram, y regenerar el token con `instagram_basic` + `instagram_manage_insights`. Hoy el token no ve ninguna página. La verificación de la app de Meta sigue pendiente. | Página "El contenido": views y leads por reel |
| 8 | **Vercel** | cuenta + dominio | vercel.com → Import `tukienzo/exposure-crm` | Que los crons corran solos. Sin esto nada se sincroniza |

Opcionales, solo si los usás:

| # | Servicio | Variable | Para qué |
|---|---|---|---|
| 9 | Meta CAPI | `META_CAPI_ACCESS_TOKEN` + ID del dataset del píxel | Devolverle a Meta la calidad de cada lead |
| 10 | Mercury | `MERCURY_API_TOKEN` | Banco y gastos automáticos (Paul lo usa; vos probablemente no) |
| 11 | iClosed | `ICLOSED_API_KEY` | Solo si migrás de Calendly a iClosed |

No hace falta: `OPENAI_API_KEY` (figura en el archivo, el código no la usa).

## 3 · Datos que me tenés que pasar (no son claves)

- [ ] **Equipo**: mail de cada setter y closer, y su nombre escrito exactamente como aparece en las agendas.
- [ ] **Precio y meta**: precio de lista vigente y meta mensual de cash collected (`PANEL_PRECIO_BASE`, `PANEL_META_MENSUAL`; hoy 1.300 y 50.000).
- [ ] **Tipos de pago** que usan: fee, cuota 1…n, PIF, etc. El CRM cuenta como cobrado solo lo que esté en esa lista.
- [ ] **Fuentes** con las que quieren medir (Reel, Historia, DM PARTNER, Ads, YouTube, Referido…).
- [ ] **Convención de tags de ManyChat**: qué tag pone cada keyword y cómo se marca "agendó".
- [ ] **Formulario de calificación** de Calendly: las preguntas exactas (ocupación, ingresos, capital, urgencia).
- [ ] **Desde qué fecha migrar el histórico** del CRM CENTRAL 2026 y del Grupo Estadístico.
- [ ] **Programas** que venden hoy y sus planes de pago.

## 4 · Decisiones tuyas

- [ ] **Calendly o iClosed.** El CRM de Paul habla iClosed; vos usás Calendly. Si seguís con Calendly, yo escribo el adaptador (webhook de Calendly → ingesta del CRM).
- [ ] **Stripe directo o vía Zapier.** Directo es más simple de mantener.
- [ ] **Wise y transferencias**: carga manual desde "Carga de pagos", o una planilla que el CRM lea.
- [ ] **Una sola cuenta o dos.** El código de Paul separa "Paul" y "Cris"; EXPOSURE es una. Lo simplifico salvo que quieras separar por closer o por marca.

## 5 · Lo que hago yo cuando tenga lo de arriba

- [x] Generar `CRM_INGEST_KEY` y cargarla en `.env.local`.
- [ ] Adaptador **Calendly → agendas** y **Stripe → pagos** (Paul los tiene para iClosed y Zapier).
- [ ] Reemplazar lo de Paul en el código: cuentas Paul/Cris (44 lugares), setters fijos Santi y Lolo, catálogo de programas y precios, lista de fuentes, dataset de Meta.
- [ ] Importar el histórico: ya tengo parseados los 225 pagos del año y las 63 agendas de agosto.
- [ ] Dar de alta al equipo en `team_members` con `scripts/crear-usuario.mjs`.
- [ ] Desplegar en Vercel, cargar las variables y prender los crons de a uno: ManyChat, Calendly, Fathom, Stripe, Meta.
- [ ] Sacar el sello "datos de demostración" del panel cuando entren los primeros datos reales.

## 6 · Orden recomendado

1. Vercel (sin esto nada corre solo)
2. Equipo + precio + tipos de pago + fuentes (configuración, un rato)
3. Histórico importado (para no arrancar en cero)
4. ManyChat → Calendly → Fathom → Stripe (el núcleo comercial)
5. Meta Ads e Instagram (segunda ola)
