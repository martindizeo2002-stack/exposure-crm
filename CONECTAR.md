# Conectar el CRM al negocio real — checklist

Actualizado 11/09/2026 (madrugada). Qué está conectado, qué falta y quién hace cada cosa.
Las claves van en `.env.local` (y en Vercel). Nunca al repo. Copia de respaldo en `Documents\exposure-crm-secrets\`.

## 0 · Lo que necesito de vos (en este orden)

| # | Qué | Dónde se saca | Qué destraba |
|---|---|---|---|
| ~~1~~ ✅ | Contraseña de la base de Supabase | Alex la pasó el 11/09 (04:20). Está en `exposure-crm-secrets\db-password.txt`. La migración `20260911000001` ya se aplicó (sección 5). | Fees y cuotas desde la pantalla, avisos al sheet. |
| ~~2~~ ✅ | JSON de la cuenta de servicio de Google | `crm-exposure@original-nation-395419.iam.gserviceaccount.com`, guardado en `exposure-crm-secrets\google-service-account.json` y cargado en Vercel. El sheet ya está compartido con esa cuenta. | Espejo CRM → sheet (sección 4). |
| ~~3~~ ✅ | API key de iClosed | Cargada el 11/09 (13:00). | Las agendas nuevas y las llamadas futuras entran solas. |
| ~~4~~ ✅ | API key de Anthropic | Alex la pasó el 11/09 (04:50). Cargada en `.env.local`, en el respaldo y en Vercel. | Fathom (show / no show real), análisis de llamadas, asistente. |
| 5 | **¿Bener es closer del equipo?** | Aparece en 34 agendas de septiembre. Hoy se lo cuenta como closer propio (después de junio) y no tiene usuario. | Leaderboards y usuario. |
| 6 | **Duración de cada programa** | IA Partner y Agency Pro figuran con 4 meses, Content con 3 (sacados del sheet, no de una definición). Están en `lib/programas.ts`. | Fecha de baja automática y "alumnos activos". |

## 1 · Lo que ya está conectado

- [x] **Supabase** — base, login, esquema (`NEXT_PUBLIC_SUPABASE_URL`, `…ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`).
- [x] **Vercel** — https://exposure-crm-nu.vercel.app (repo privado tukienzo/exposure-crm). Variables cargadas. **Plan Pro desde el 11/09 (05:00)**: crons frecuentes (espejo cada 5 min, Fathom cada 30, iClosed cada 10, ManyChat cada 6 h, operaciones cada hora, repaso diario 09:00 UTC) y funciones de hasta 300 s.
- [x] **Usuarios** — Alex (CEO), Nahuel (CEO/admin), Cristian, Kenneth y Bener (Closer), Maximo (Setter). Mails y contraseñas en `exposure-crm-secrets\usuarios.txt`. Los mails `@exposure-crm.local` son provisorios: se cambian con `node scripts/crear-usuario.mjs` cuando tengas los reales.
- [x] **Histórico importado del CRM CENTRAL 2026** (11/09): 579 agendas, 196 pagos (cash por mes igual al sheet, con TC 1.540 para los ARS), 236 clientes (181 los derivó el CRM de los pagos + 55 de ACTIVE CLIENTS sin pago en el sheet), seguimientos e iClosed cruzados. Solo cuentan los closers propios (Alex y Nahuel hasta junio; después también Cristian, Tobias y Kenneth). Script: `Central Negocio\scripts\manychat\importar-crm.py`.
- [x] **ManyChat** — 78.204 contactos leídos con sus tags (11/09, 06:25) → `crm_integration_assets`; 413 de las 577 agendas con Instagram cruzadas con su contacto (pieza que las trajo: 200 reels, 55 nuevo seguidor, 42 webinar, 42 ads, 24 historias, 16 carruseles; fuente completada en el sheet), 1.546 identidades, 2.831 eventos de tags; conversaciones nuevas por mes y setter (142 filas en `metricas_manual`) alimentan el panel. Para mantenerlo al día hace falta la regla de ManyChat (sección 3).
- [x] **Panel del negocio** — lee del CRM (agendas, pagos, clientes, métricas).
- [x] **Calendly** — token probado. Solo tiene activo el evento "1-1 con Alex (Exposure)" (clientes, no ventas); sin webhooks.
- [x] **Fathom** — funcionando desde el 11/09 (05:05): lee las grabaciones (26 en 30 días), las transcribe y las analiza con Claude (`crm_call_records`), las enlaza a la agenda por el link de Fathom y clasifica las llamadas de venta por título ("Lead x Exposure", Cristian Lescano, Bener Salvo…). Cron cada 30 min. La conciliación de show / no show solo toca agendas "sin resultado" (`show = null`): hoy son 309 históricas sin estado.
- [x] **Stripe** — clave restringida cargada (solo lectura).
- [x] **Meta Ads** — token y cuenta `act_…` cargados. El token todavía no ve la página ni el Instagram.
- [x] **Clave de ingesta** (`CRM_INGEST_KEY`) y **secreto de crons** (`CRON_SECRET`).
- [x] **Espejo CRM → Google Sheet** — conectado (`lib/sheet-mirror.ts`, `/api/sheet-sync`); la base avisa por pg_net en cada alta o cambio y el cron diario (`/api/cron-diario`, 09:00 UTC) repasa todo.

## 2 · Claves

| Servicio | Variable | Estado |
|---|---|---|
| ManyChat | `MANYCHAT_API_KEY` | ✅ |
| Calendly | `CALENDLY_TOKEN` | ✅ |
| Fathom | `FATHOM_API_KEY`, `FATHOM_WEBHOOK_SECRET` | ✅ |
| Stripe | `STRIPE_SECRET_KEY` | ✅ |
| Meta Ads | `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID` | ✅ |
| Google Sheets | `GOOGLE_SERVICE_ACCOUNT_JSON` (base64 del JSON), `GOOGLE_SHEET_ID` (`1mLpa1gGCgN29LYt8ul7egX-M5Paej9TY6N7NydND-9w`) | ✅ |
| iClosed | `ICLOSED_API_KEY` | ✅ (11/09 13:00; calendarios 37886 y 48656; cron cada 10 min; API con límite de tasa → pedidos en serie) |
| Anthropic | `ANTHROPIC_API_KEY` | ✅ |
| Instagram Graph | `IG_ACCESS_TOKEN` + `IG_BUSINESS_ID` | ⏳ el token del System User (app "EXPOSURE Ads") solo tiene permisos de anuncios y no ve ninguna página. Pasos exactos abajo (sección 8). |

## 3 · ManyChat → CRM en tiempo real (HECHO el 11/09 a las 13:30)

Automatización **"CRM EXPOSURE · sincronizar contactos"** publicada en ManyChat (LIVE): disparadores *Nuevo contacto creado* y *Etiqueta aplicada* → acción *Solicitud externa* POST a `/api/manychat-sync` con `Authorization: Bearer <CRON_SECRET>` y cuerpo Full Contact Data. Probada con un contacto real (respuesta 200, snapshot guardado). Si alguna vez hay que rehacerla, los pasos son estos:



1. ManyChat → **Automation** → abrí el flujo de la keyword (por ejemplo "PARTNER") → agregá un paso **Actions → External Request** al final.
2. Request type: **POST**. URL: `https://exposure-crm-nu.vercel.app/api/manychat-sync`.
3. **Headers**: `Authorization` = `Bearer <CRON_SECRET>` (el valor está en `exposure-crm-secrets\env.local.backup`, línea `CRON_SECRET=`). `Content-Type` = `application/json`.
4. **Body** → "Full Contact Data" (el botón de ManyChat que manda todo el contacto con sus tags y campos).
5. Guardar y publicar. Repetir el paso en los otros flujos de entrada (o hacer una **Rule**: "Tag added → cualquiera" → External Request, y cubre todo).

El CRM guarda el contacto, lo vincula por Instagram/teléfono a la persona del pipeline y registra cada tag como evento (pieza que lo trajo, mes de conversación nueva).

**Ajuste del 11/09 a la noche.** El disparador *Nuevo contacto creado* solo corre para contactos que llegan a "Suscrito" (mandaron un DM);
la mayoría de los contactos nuevos entran como "Visitante" (siguieron o comentaron, sin DM) y ahí ManyChat no ejecuta la automatización.
Por eso la automatización tiene además 7 disparadores *Se aplica la etiqueta a un contacto*: `Nuevo Seguidor | Septiembre 2026`,
`Leads | Septiembre 2026`, `ASIGNADO`, `🟢Ángulo Solución`, `🟣Ángulo Volumen/TOFU`, `🔵Ángulo PRODUCTO`, `🔴Ángulo Problema`.
Probado por API (sacar y volver a poner ASIGNADO a un contacto → llegó al CRM en segundos). **Cada mes** hay que agregar las dos
etiquetas nuevas del mes (`Nuevo Seguidor | <Mes>` y `Leads | <Mes>`) como disparadores; pedímelo y lo hago.

**Contactos nuevos cada 3 horas (desde el 19/09).** La automatización de arriba solo ve a los contactos que mandan un DM o reciben
una de las 7 etiquetas; los que siguen o comentan sin escribir ("Visitante") no pasan por ahí. Además el cuerpo *Full Contact Data*
llega **sin etiquetas** (el CRM ahora pide el detalle por API cuando entra un contacto, así que ya no las pierde). Para cubrir el
resto, en la compu de Alex corre la tarea programada de Windows **"EXPOSURE - ManyChat contactos"** cada 3 horas
(`Central Negocio\scripts\manychatctualizar-contactos.mjs`): recorre la lista de Contactos de ManyChat con un Chrome sin
ventana (sesión guardada en `datos\manychat\.perfil`), pide el detalle de los nuevos por API, los sube a `crm_integration_assets`,
cruza con agendas y recalcula las conversaciones por mes. Log en `datos\manychatctualizacion.log`; estado en
`datos\manychat\estado-actualizacion.json`. Si la sesión de ManyChat vence, el log dice "SIN SESION": hay que abrir el navegador
con ese perfil (`CLON_PERFIL=…\.perfil CLON_PUERTO=47322 node navegador.mjs abrir https://app.manychat.com`) y loguearse una vez.
Registrar o quitar la tarea: `powershell -ExecutionPolicy Bypass -File scripts\manychat	area-programada.ps1 [-Quitar|-Ahora]`.

## 3b · Avisos push del navegador (24/09)

Web Push con VAPID: claves en `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (Vercel y `.env.local`; copia en
`exposure-crm-secrets/env.local.backup`). Tabla `crm_push_suscripciones` (un dispositivo por fila, con el email del usuario). Ruta
`/api/push` (suscribir, probar, borrar), envío en `lib/push.ts`, service worker `public/sw.js` (eventos `push` y `notificationclick`),
botón en `components/avisos-push.tsx`. Hoy el único disparador es el pipeline de contenido (`avisarMovimientoPieza`: grabado → en
producción y en producción → revisar, a los CEO que activaron avisos, salvo que el que movió sea CEO). Para sumar otro aviso: llamar a
`enviarPush(emails, { titulo, cuerpo, url, tag })` desde la ruta que corresponda. Las suscripciones vencidas (404/410) se borran solas.
Probado el 24/09 con un Chrome controlado: suscripción guardada y aviso de prueba entregado por FCM.

## 4 · Espejo CRM → Google Sheet (cómo funciona)

- Va en las dos direcciones: lo que se carga o cambia en el CRM se escribe en el sheet al instante, y **los pagos que se escriben a mano en la pestaña del mes entran al CRM cada 10 minutos** (`/api/sheet-pull`; necesitan concepto, nombre y monto). Las agendas siguen entrando por iClosed.
- Cada pago va a `💰 PAGOS <MES>` (columnas E a W: mes, fechas, cliente, teléfono, concepto, operación, closer, setter, calificación, CC USD, CC ARS, comprobante, PPP, fuente, contenido, medio de pago, tipo de cambio). Cada agenda va a `📆 AGENDAS <MES>` (columnas A a AJ, en el orden de tu cabecera).
- Las 775 filas importadas ya están mapeadas a su fila original: si un closer marca show o cerró en el CRM, se actualiza **esa misma fila** del sheet.
- Lo nuevo se agrega en la primera fila libre de la pestaña del mes. La pestaña sin mes (`💰 PAGOS`, `📆 AGENDAS`) es la del mes en curso. Si no existe pestaña para un mes, el CRM duplica la última y la llama `💰 PAGOS OCTUBRE` (avisame si preferís crearlas vos).
- Cuándo corre: al instante con la migración aplicada (la base avisa al CRM en cada alta o cambio); si no, una vez por día a las 09:00 UTC (06:00 Argentina). También a mano: `curl -X POST https://exposure-crm-nu.vercel.app/api/sheet-sync -H "Authorization: Bearer <CRON_SECRET>"`.
- Pagos anulados en el CRM quedan en el sheet con concepto `ANULADO · …` y monto 0.

## 5 · Migración 20260911000001 (aplicada el 11/09 a las 04:26)

Archivo: `supabase/migrations/20260911000001_tipos_pendientes.sql`. Se aplicó con `python scripts/aplicar-sql.py <archivo>` (host directo de la base con la contraseña de `exposure-crm-secrets\db-password.txt`; el pooler tarda unos minutos en aceptar una contraseña nueva). Para SQL suelto: `python scripts/sql.py "select …"`.

Qué arregló:
1. `plan_pago_items.pago_id` pasa a texto (el esquema reconstruido lo dejó uuid y el código de la plantilla lo compara como texto). Antes, cargar un pago que no da acceso (Fee, Cuota) desde la pantalla tiraba "operator does not exist: uuid = text". Después de aplicarla se corrigió el histórico: el acceso lo decide el concepto y se borraron 34 "clientes" que solo habían pagado un Fee.
2. `fecha_agenda` / `fecha_closer` con hora.
3. Conceptos de EXPOSURE que dan acceso: Venta Nueva, Adentro en Seguimiento, Adentro en Seguimiento y Post Fee, Completó PIF, Venta Interna, Venta Nueva Interna, Upsell (Agency).
4. "Adentro en Seguimiento y Post Fee" deja de contarse como fee al cargar el plan.
5. Avisos de la base al espejo del sheet (pg_net) en cada alta o cambio de pagos y agendas. La URL y el secreto están en la tabla `crm_config` (sin acceso para anon/authenticated).
6. Columnas de la bandeja de avisos (`crm_notification_outbox`) que faltaban para `operations-refresh`.

## 6 · Pendientes míos

- [x] Aplicar la migración.
- [ ] Probar el espejo con el sheet real y sacar la primera corrida.
- [ ] Adaptador iClosed → agendas (necesita la API key; el código de la plantilla ya está en `/api/iclosed-sync`).
- [ ] Stripe → pagos automáticos (decidir: directo o vía Zapier).
- [ ] Instagram Graph cuando Meta apruebe la app.
- [ ] Supabase → Authentication → URL Configuration: Site URL `https://exposure-crm-nu.vercel.app` (solo para "Entrar con link al mail").

## 7 · Cosas del sheet que conviene corregir a mano

- `💰 PAGOS JUNIO`, fila del 19/06 (Adentro en Seguimiento y Post Fee, "Cuota 1 (Agency)", USD 500): no tiene nombre de cliente, no se importó. Ponele el nombre y lo cargo.
- `💰 PAGOS FEB`: 25 filas tienen el nombre en la columna "Fecha Alta" (columnas corridas). Se importaron igual, pero al espejo le conviene que estén en su lugar.
- Los pagos de Marcos, Tony y del dueño de la plantilla quedaron afuera (closers de la maqueta). Bener es closer real desde julio, pero todavía no tiene pagos cargados en ninguna pestaña del sheet (revisado el 11/09).

## 8 · Conectar tu Instagram al CRM (5 minutos, en Meta Business)

El CRM ya sabe leer views, alcance y comentarios por reel, pero el token que tengo (System User de la app "EXPOSURE Ads")
solo tiene `ads_read` y no ve tu página. Hace falta un token que vea la página de Facebook conectada a @alexmcarrera:

1. business.facebook.com → **Configuración del negocio** → *Usuarios → Usuarios del sistema* → el System User de "EXPOSURE Ads".
2. **Asignar activos**: agregá la **página de Facebook** (control total) y la **cuenta de Instagram** @alexmcarrera (control total).
3. **Generar nuevo token** para la app "EXPOSURE Ads" con estos permisos: `pages_show_list`, `pages_read_engagement`,
   `instagram_basic`, `instagram_manage_insights` (dejá también `ads_read`). Sin vencimiento.
4. Pegame el token acá. Yo lo cargo como `IG_ACCESS_TOKEN`, obtengo el `IG_BUSINESS_ID` y prendo la página "El contenido".

Mientras la app siga "en desarrollo", esto funciona igual para tu propia cuenta (sos administrador de la app); la verificación de
Meta solo hace falta para cuentas de terceros.

## 9 · Marketing y Sistema IA (11/09, tarde)

- **Contenido** (`/contenido-angulos`): una sola cuenta ("CONTENIDO EXPOSURE"), los 25 ángulos del banco de EXPOSURE (`lib/angulos-exposure.ts`),
  los 5 sub-perfiles del avatar en las secuencias de historias, responsables Alex / Nahuel / Editor / Máximo, guionista con IA configurado para
  el nicho IA Partner. Lo que se carga ahí se guarda en `crm_content_assets` (Supabase).
- **Formatos** (`/contenido/formatos`): ya no es una tabla fija. Calcula agendas, presentadas, calificadas, cierres y cash del día 1 por tipo de
  pieza (reel, carrusel, historia, webinar, ads, nuevo seguidor), por pieza concreta (el tag de ManyChat) y por canal. Fuente: `agendas`
  cruzadas con ManyChat. Ventana 30/90/180/365 días.
- **Testimonios** (`/testimonios`): banco real (Supabase), una sola cuenta de contenido.
- **Sistema IA** (Centro de mando, Agentes, Tareas, Agenda, Herramientas, Analítica, Contenido IA, Memoria): es la maqueta de Exposure OS con
  datos inventados (`components/exposure/data.ts`). Ahora lleva el aviso "Maqueta" en cada pantalla y el grupo del menú se llama
  "Sistema IA · maqueta". Conectarlo de verdad es un proyecto aparte: definir qué hace cada agente y con qué datos.
- **Instagram** (página "El contenido" del panel): sigue apagada hasta tener el token con permisos de página (sección 8).

## 10 · Reportes diarios del setter → CRM (11/09, noche)

Los dashboards que arma Máximo (`setting_dashboard_N.html`) se archivan en
`EXPOSURE/Central Negocio/datos/setting-reports/` (cada uno reemplaza al del día anterior, así que
hay que guardarlos con el número siguiente). Para llevarlos al CRM:

```
cd "C:\Users\Alex\Documents\EXPOSURE\Central Negocio"
python scripts/setting/actualizar.py
```

Qué hace (idempotente: se puede repetir sin duplicar):

- **Cruza cada lead del reporte con su agenda** (usuario de Instagram, nombre o alias, ±10 días) y completa en la
  agenda lo que estaba vacío: setter, fuente, recurso, ángulo de entrada (gatillo + feed), dolor y objetivo.
  Deja un evento "Reporte del setter" en la ficha de la persona con todo el detalle.
- **Panel del negocio → El equipo → "Setting diario"**: día por día (calendarios, agendas, cuántas existen en el CRM,
  calificados, fups, embudos de nuevos seguidores / historia / outbound) y la tabla lead por lead.
- **Métricas → Setting**: los calendarios enviados de Máximo salen de acá (tipo `calendarios_enviados`, por semana).
- Los leads que no encuentran agenda quedan listados al pie del bloque ("sin agenda"): o el setter los reportó
  con otro nombre, o la agenda nunca se creó en iClosed.

Ojo con "calificado" en estos reportes: significa negocio + dolor identificados, no capacidad de pago.

## 11 · Ángulos, resumen de setting y WhatsApp (11/09, noche)

**Marketing → Ángulos** (`/contenido/angulos`). Lee las etiquetas de ManyChat de los 78.000 contactos y las
cruza con las agendas y los pagos de cada persona: tipo de ángulo (🟢 Solución · 🟣 Volumen/TOFU · 🔵 Producto ·
🔴 Problema), sub-ángulo, pieza (formato + ángulo + fecha), historia, formato y categoría (reel, carrusel,
historia, ads, nuevo seguidor). Para cada uno: leads, nuevos en el período, agendas, presentadas, calificadas,
cierres y cash collected. La función `crm_angulos_manychat(fecha)` vive en la base (migración 20260911000003).
Cobertura: solo las agendas cuya persona tiene identidad de ManyChat entran en las filas; el pie de la página
dice cuántas son.

**Ventas → Resumen de setting** (`/setting-resumen`). El setter pega las notas crudas del día, Claude arma el
reporte (números + lead por lead + síntesis para el closer) y el mensaje para WhatsApp (botón "Abrir WhatsApp").
"Guardar en el CRM" hace lo mismo que `scripts/setting/actualizar.py`: cruza cada lead con su agenda, completa
dolor/objetivo/gatillo/fuente/setter si estaban vacíos, deja el evento en la ficha, y actualiza el Panel
(Setting diario) y Métricas (calendarios enviados). Usa `ANTHROPIC_API_KEY` (la misma del asistente).

**Ventas → WhatsApp** (`/whatsapp`). Los grupos donde esté el número del bot, con lectura por rango y
"Resumir con IA". El bot corre en tu PC:

```
cd "C:\Users\Alex\Documents\EXPOSURE\Central Negocio"
node scripts/whatsapp/bot.mjs
```

La primera vez muestra un QR: se escanea desde WhatsApp → Dispositivos vinculados, con el **número del bot**
(usá un chip del equipo, no tu número personal: WhatsApp puede cerrar sesiones automatizadas). Después, ese
número se agrega a los grupos que quieras leer y cada mensaje llega al CRM (`/api/whatsapp-ingest`, con el
CRON_SECRET). Opcional: `datos/whatsapp/grupos.txt` con un nombre de grupo por línea para limitar cuáles.
La sesión queda en `datos/whatsapp/.auth` (no se sube a ningún lado). Mientras la PC esté apagada no entra
nada; cuando vuelve, WhatsApp le manda lo pendiente.

**Sin depender de tu PC (recomendado):** el mismo bot corre 24/7 en la nube con Docker (Fly.io, Railway o un VPS):
`scripts/whatsapp/Dockerfile`, `fly.toml` y `README.md` tienen los pasos. El QR ya no se lee en la terminal:
el bot lo manda al CRM y aparece en Ventas → WhatsApp, junto con el estado (conectado / desconectado / último aviso).
Hace falta una cuenta en el servicio (unos USD 2 a 5 por mes) y cargarle `CRON_SECRET` y `CRM_URL`.

## 12 · Lead scoring automático (12/09)

Cada agenda recibe un **tipo de lead** (S / A / B / C / D) calculado con las respuestas del formulario de iClosed:
capital para invertir (35 pts), ingresos actuales (20), etapa del negocio (20), objetivo de ingresos (15) y
situación (10). Los pesos y cortes están calibrados con los cierres reales de julio a septiembre: de 66 puntos para
arriba es S (cierra 1 de 2), 54 es A, 42 es B, 30 es C, y menos de 30 es D. Sin capital y con menos de USD 500 de
ingresos no pasa de C. Si el formulario no trae capital ni ingresos ni etapa, queda "Sin scoring" (no se inventa).

- Se guarda en `agendas.lead_score`, `lead_score_grade` y `lead_score_detalle`; la calificación del closer
  (`calificacion`) se completa solo si estaba vacía y nunca se pisa a mano.
- Corre solo cada 15 minutos (`/api/lead-scoring-sync`); `?todo=1` recalcula todas (usarlo si cambian los pesos).
- Se ve en Panel del negocio → El embudo (cards por tipo, filtro y columna en "Las agendas del mes") y en Últimas
  llamadas; en el CRM, en la columna Calificación de agendas y en las tarjetas del pipeline.
- Para recalibrar: `scripts/simular-scoring.ts` (ver cabecera) y ajustar `CORTES`/pesos en `lib/lead-scoring.ts`.

## 13 · Pagos ↔ ManyChat ↔ planes de pago (12/09)

En **Pagos → Todos los pagos → Editar pago** hay un bloque "ManyChat y planes de pago":

- **ManyChat ID del lead**: pegás el ID del contacto (Contactos → el contacto → ID) y "Vincular". El pago queda
  atado a la persona de ese contacto (se crea si no existe, o se usa la que ya tiene ese ID o el mismo teléfono),
  se trae el nombre y el Instagram desde ManyChat, y los planes y agendas de ese cliente que estaban sueltos
  pasan a la misma persona.
- **Planes de pago del cliente**: se listan los planes de esa persona (por persona, nombre o teléfono). En cada
  cuota podés marcar "Este pago es esta cuota" (queda pagada y vinculada) o soltarla.
- **Nuevo plan**: arma un plan para ese cliente desde el mismo pago; la fila marcada "este pago" queda pagada y
  vinculada, el resto queda pendiente en Cobros y cuotas.

API: `GET/POST /api/pagos/vinculo`.
