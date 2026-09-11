# Conectar el CRM al negocio real — checklist

Actualizado 11/09/2026 (madrugada). Qué está conectado, qué falta y quién hace cada cosa.
Las claves van en `.env.local` (y en Vercel). Nunca al repo. Copia de respaldo en `Documents\exposure-crm-secrets\`.

## 0 · Lo que necesito de vos (en este orden)

| # | Qué | Dónde se saca | Qué destraba |
|---|---|---|---|
| ~~1~~ ✅ | Contraseña de la base de Supabase | Alex la pasó el 11/09 (04:20). Está en `exposure-crm-secrets\db-password.txt`. La migración `20260911000001` ya se aplicó (sección 5). | Fees y cuotas desde la pantalla, avisos al sheet. |
| ~~2~~ ✅ | JSON de la cuenta de servicio de Google | `crm-exposure@original-nation-395419.iam.gserviceaccount.com`, guardado en `exposure-crm-secrets\google-service-account.json` y cargado en Vercel. El sheet ya está compartido con esa cuenta. | Espejo CRM → sheet (sección 4). |
| 3 | **API key de iClosed** | iClosed → Settings → Integrations / API | Que cada agenda entre sola al pipeline (hoy se cargan del sheet o a mano). |
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
| iClosed | `ICLOSED_API_KEY` | ⏳ |
| Anthropic | `ANTHROPIC_API_KEY` | ✅ |
| Instagram Graph | `IG_ACCESS_TOKEN` + `IG_BUSINESS_ID` | ⏳ depende de la verificación de la app de Meta |

## 3 · ManyChat → CRM en tiempo real (5 minutos, en la pantalla de ManyChat)

El CRM ya tiene el endpoint. ManyChat no permite crear automatizaciones por API: el paso "External Request" solo se agrega desde su editor de automatizaciones. Intenté armarlo desde el navegador la madrugada del 11/09 y el sistema no me dejó operar dentro de tu cuenta de ManyChat, así que queda de tu lado (o lo hacemos juntos en una llamada de 5 minutos).

1. ManyChat → **Automation** → abrí el flujo de la keyword (por ejemplo "PARTNER") → agregá un paso **Actions → External Request** al final.
2. Request type: **POST**. URL: `https://exposure-crm-nu.vercel.app/api/manychat-sync`.
3. **Headers**: `Authorization` = `Bearer <CRON_SECRET>` (el valor está en `exposure-crm-secrets\env.local.backup`, línea `CRON_SECRET=`). `Content-Type` = `application/json`.
4. **Body** → "Full Contact Data" (el botón de ManyChat que manda todo el contacto con sus tags y campos).
5. Guardar y publicar. Repetir el paso en los otros flujos de entrada (o hacer una **Rule**: "Tag added → cualquiera" → External Request, y cubre todo).

El CRM guarda el contacto, lo vincula por Instagram/teléfono a la persona del pipeline y registra cada tag como evento (pieza que lo trajo, mes de conversación nueva).

## 4 · Espejo CRM → Google Sheet (cómo funciona)

- Es de **una sola dirección**: lo que se carga o cambia en el CRM se escribe en el sheet. Lo que escribas a mano en el sheet no vuelve al CRM.
- Cada pago va a `💰 PAGOS <MES>` (columnas E a W: mes, fechas, cliente, teléfono, concepto, operación, closer, setter, calificación, CC USD, CC ARS, comprobante, PPP, fuente, contenido, medio de pago, tipo de cambio). Cada agenda va a `📆 AGENDAS <MES>` (columnas A a AJ, en el orden de tu cabecera).
- Las 775 filas importadas ya están mapeadas a su fila original: si un closer marca show o cerró en el CRM, se actualiza **esa misma fila** del sheet.
- Lo nuevo se agrega en la primera fila libre de la pestaña del mes. La pestaña sin mes (`💰 PAGOS`, `📆 AGENDAS`) es la del mes en curso. Si no existe pestaña para un mes, el CRM duplica la última y la llama `💰 PAGOS OCTUBRE` (avisame si preferís crearlas vos).
- Cuándo corre: al instante con la migración aplicada (la base avisa al CRM en cada alta o cambio); si no, una vez por día a las 09:00 UTC (06:00 Argentina). También a mano: `curl -X POST https://exposure-crm-nu.vercel.app/api/sheet-sync -H "Authorization: Bearer <CRON_SECRET>"`.
- Pagos anulados en el CRM quedan en el sheet con concepto `ANULADO · …` y monto 0.

## 5 · Migración 20260911000001 (aplicada el 11/09 a las 04:26)

Archivo: `supabase/migrations/20260911000001_tipos_pendientes.sql`. Se aplicó con `python scripts/aplicar-sql.py <archivo>` (host directo de la base con la contraseña de `exposure-crm-secrets\db-password.txt`; el pooler tarda unos minutos en aceptar una contraseña nueva). Para SQL suelto: `python scripts/sql.py "select …"`.

Qué arregló:
1. `plan_pago_items.pago_id` pasa a texto (el esquema reconstruido lo dejó uuid y el código de Paul lo compara como texto). Antes, cargar un pago que no da acceso (Fee, Cuota) desde la pantalla tiraba "operator does not exist: uuid = text". Después de aplicarla se corrigió el histórico: el acceso lo decide el concepto y se borraron 34 "clientes" que solo habían pagado un Fee.
2. `fecha_agenda` / `fecha_closer` con hora.
3. Conceptos de EXPOSURE que dan acceso: Venta Nueva, Adentro en Seguimiento, Adentro en Seguimiento y Post Fee, Completó PIF, Venta Interna, Venta Nueva Interna, Upsell (Agency).
4. "Adentro en Seguimiento y Post Fee" deja de contarse como fee al cargar el plan.
5. Avisos de la base al espejo del sheet (pg_net) en cada alta o cambio de pagos y agendas. La URL y el secreto están en la tabla `crm_config` (sin acceso para anon/authenticated).
6. Columnas de la bandeja de avisos (`crm_notification_outbox`) que faltaban para `operations-refresh`.

## 6 · Pendientes míos

- [x] Aplicar la migración.
- [ ] Probar el espejo con el sheet real y sacar la primera corrida.
- [ ] Adaptador iClosed → agendas (necesita la API key; el código de Paul ya está en `/api/iclosed-sync`).
- [ ] Stripe → pagos automáticos (decidir: directo o vía Zapier).
- [ ] Instagram Graph cuando Meta apruebe la app.
- [ ] Supabase → Authentication → URL Configuration: Site URL `https://exposure-crm-nu.vercel.app` (solo para "Entrar con link al mail").

## 7 · Cosas del sheet que conviene corregir a mano

- `💰 PAGOS JUNIO`, fila del 19/06 (Adentro en Seguimiento y Post Fee, "Cuota 1 (Agency)", USD 500): no tiene nombre de cliente, no se importó. Ponele el nombre y lo cargo.
- `💰 PAGOS FEB`: 25 filas tienen el nombre en la columna "Fecha Alta" (columnas corridas). Se importaron igual, pero al espejo le conviene que estén en su lugar.
- Los pagos de Marcos, Tony, Paul y Bener quedaron afuera (no son closers propios), como acordamos.
