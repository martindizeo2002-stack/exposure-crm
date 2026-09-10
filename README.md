# Exposure CRM

El CRM de Paul (plantilla `crm-template-alex`) con el diseño y la capa de agentes de **Exposure OS**.
Un solo producto: las funcionalidades del CRM (agendas, pipeline, pagos, cuotas, cobranza, clientes,
métricas, equipo, comisiones, contenido, finanzas, calidad de datos, integraciones) con la piel de
Exposure OS (raíl oscuro a la izquierda, papel cálido, oro como acento, Inter) y sus pantallas de
"Sistema IA" (Centro de Mando, Agentes, Tareas, Agenda, Herramientas, Analítica, Contenido, Memoria).

Stack: Next.js 16 + React 19 + Tailwind 4 + shadcn/Radix, Supabase (Postgres + Auth + RLS), pnpm.

## Correr

```bash
npx pnpm install
npx pnpm dev          # http://localhost:3000
```

Producción local: `npx pnpm build` y `npx next start -p 3000`.

Las claves están en `.env.local` (no va al repo). Hay una copia y las contraseñas en
`C:\Users\Alex\Documents\exposure-crm-secrets\` (fuera del proyecto):

- `env.local.backup` — el `.env.local` completo
- `login.txt` — usuario y contraseña del CEO (alex.m.carrera02@gmail.com)
- `db-password.txt` — contraseña de la base de datos de Supabase

## Supabase

Proyecto **Exposure CRM** (`lswghtsvmsawntmiihvr`, región sa-east-1, plan Free), organización
"Alex Organization". Panel: https://supabase.com/dashboard/project/lswghtsvmsawntmiihvr

La carpeta está vinculada (`supabase link`). Para aplicar migraciones nuevas:

```bash
npx supabase@2.114.0 db push --password "<db-password.txt>"
```

### Ojo con el esquema base

La plantilla de Paul trae 25 migraciones que **modifican** tablas que ninguna crea (`agendas`,
`pagos`, `clientes`, `planes_pago`, `plan_pago_items`, `team_members`, `cuotas`, `gastos`, `payroll`…).
El esquema original quedó afuera de la plantilla. `supabase/migrations/20260701000000_base_schema.sql`
lo **reconstruye** a partir de cómo lo usa el código (tipos de `lib/supabase.ts`, rutas `/api`, y lo
que las migraciones posteriores esperan: ids `uuid` en agendas/pagos/planes, `bigint` en clientes).
Si Paul entrega el volcado real del esquema, conviene reemplazar ese archivo por el suyo.

Las migraciones originales se renombraron con versión única (`20260723000002_…`) porque Supabase no
acepta dos migraciones con la misma versión, y se reordenaron por dependencia real (por ejemplo,
`content_workspace` después de `crm_consolidation`, `soft_delete_financial` antes de `data_quality_queue`).

## Usuarios

`node scripts/crear-usuario.mjs <email> <password> "<nombre>" [rol]` crea el usuario en Supabase Auth
y su fila aprobada en `team_members`. Roles: CEO, Sales Manager, Manager MKT, Contaduria, Setter,
Closer, Cobranzas, CSM, Editor. El resto del equipo puede pedir acceso desde `/solicitar-acceso` y el
CEO lo aprueba en `/accesos`.

En la plantilla original solo "Paul" o "Cristian" podían ser CEO efectivos; acá el CEO es quien
figure con ese rol en `team_members`. Si se quiere limitar por nombre, cargar `CRM_CEO_NAMES` en `.env.local`.

## Qué es de Exposure OS y qué es del CRM

| Pieza | Origen | Archivos |
|---|---|---|
| Paleta, tipografía, tarjetas, fondo | Exposure OS | `app/globals.css` (tokens `:root`), `components/exposure/exposure.css` |
| Raíl de navegación (escritorio) | Exposure OS | `components/exposure-rail.tsx` (lee los módulos de `components/crm-navigation.tsx`) |
| Header + cajón (celular), ⌘K, Personalización | CRM de Paul | `components/crm-navigation.tsx` |
| Pantallas "Sistema IA" | Exposure OS | `components/exposure/pages/*`, rutas `app/(dashboard)/sistema/*` |
| Todo lo demás (38 pantallas, 70 rutas API, crons, integraciones) | CRM de Paul | `app/`, `lib/`, `supabase/` |

**Las pantallas de Sistema IA muestran datos ficticios** (`components/exposure/data.ts`): son la maqueta
de la capa de agentes, todavía sin conectar al CRM.

## Integraciones y crons

Vacías hasta configurarlas en `.env.local`: ManyChat, Fathom, iClosed, Meta Ads, Mercury, OpenAI.
Los crons de `vercel.json` están desactivados; activar de a uno después de configurar cada integración
y `CRON_SECRET`.

## Deploy

Pendiente: crear el proyecto en Vercel y cargar las mismas variables de `.env.local`
(`NEXT_PUBLIC_APP_URL` con la URL final en https).
