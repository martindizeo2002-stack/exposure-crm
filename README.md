# Exposure CRM

La plantilla original de CRM (`crm-template-alex`) con el diseño y la capa de agentes de **Exposure OS**.
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

La plantilla original trae 25 migraciones que **modifican** tablas que ninguna crea (`agendas`,
`pagos`, `clientes`, `planes_pago`, `plan_pago_items`, `team_members`, `cuotas`, `gastos`, `payroll`…).
El esquema original quedó afuera de la plantilla. `supabase/migrations/20260701000000_base_schema.sql`
lo **reconstruye** a partir de cómo lo usa el código (tipos de `lib/supabase.ts`, rutas `/api`, y lo
que las migraciones posteriores esperan: ids `uuid` en agendas/pagos/planes, `bigint` en clientes).
Si aparece el volcado real del esquema original, conviene reemplazar ese archivo por ese.

Las migraciones originales se renombraron con versión única (`20260723000002_…`) porque Supabase no
acepta dos migraciones con la misma versión, y se reordenaron por dependencia real (por ejemplo,
`content_workspace` después de `crm_consolidation`, `soft_delete_financial` antes de `data_quality_queue`).

## Usuarios

`node scripts/crear-usuario.mjs <email> <password> "<nombre>" [rol]` crea el usuario en Supabase Auth
y su fila aprobada en `team_members`. Roles: CEO, Sales Manager, Manager MKT, Contaduria, Setter,
Closer, Cobranzas, CSM, Editor. El resto del equipo puede pedir acceso desde `/solicitar-acceso` y el
CEO lo aprueba en `/accesos`.

En la plantilla original solo dos nombres fijos podían ser CEO efectivos; acá el CEO es quien
figure con ese rol en `team_members`. Si se quiere limitar por nombre, cargar `CRM_CEO_NAMES` en `.env.local`.

## Qué es de Exposure OS y qué es del CRM

| Pieza | Origen | Archivos |
|---|---|---|
| Paleta, tipografía, tarjetas, fondo | Exposure OS | `app/globals.css` (tokens `:root`), `components/exposure/exposure.css` |
| Raíl de navegación (escritorio) | Exposure OS | `components/exposure-rail.tsx` (lee los módulos de `components/crm-navigation.tsx`) |
| Header + cajón (celular), ⌘K, Personalización | Plantilla original | `components/crm-navigation.tsx` |
| Pantallas "Sistema IA" | Exposure OS | `components/exposure/pages/*`, rutas `app/(dashboard)/sistema/*` |
| Todo lo demás (38 pantallas, 70 rutas API, crons, integraciones) | Plantilla original | `app/`, `lib/`, `supabase/` |

**Las pantallas de Sistema IA muestran datos ficticios** (`components/exposure/data.ts`): son la maqueta
de la capa de agentes, todavía sin conectar al CRM.

## Panel del negocio (el dashboard de Agustín Ruppel, adentro del CRM)

El grupo **"Panel del negocio"** del menú abre las doce páginas del panel
`exposure-dashboard` (github.com/Agustin-Ruppel/exposure-dashboard): Resumen del mes,
El embudo (el flujo de leads desde que entran hasta la venta), Pipeline, Cómo viene el año,
El equipo, Últimas llamadas, De dónde salen, El contenido, Cobranzas, Hacia dónde va,
Service JARVIS y el Generador de carruseles.

| Pieza | Dónde |
|---|---|
| El panel tal cual (HTML autosuficiente, miniaturas, estilos) | `public/panel/` — se abre embebido (`?embed=1`: sin su sidebar, el menú es el raíl del CRM) |
| Rutas del CRM | `/panel/<pagina>` → `app/(dashboard)/panel/[pagina]/page.tsx` + `components/panel-negocio.tsx` |
| Sus números | `/api/panel/datos` (`app/api/panel/datos/route.ts`) genera el `datos.js` a partir de las tablas del CRM con `lib/panel-negocio.ts` |
| Acceso | CEO, Sales Manager, Manager MKT y Contaduría (`lib/role-access.ts`) |

**De dónde salen los números.** El panel solo recibe conteos y montos crudos; las tasas,
deltas y la proyección las calcula él. `lib/panel-negocio.ts` arma cada bloque desde
`agendas`, `pagos` (cash collected con `lib/cash-collected.ts`, facturado con `lib/revenue.ts`),
`cuotas`, `clientes` y `metricas_manual` (nuevos_leads / conversaciones_asignadas).
**Mientras el CRM esté vacío** (cero agendas y cero pagos) o Supabase falle, se sirve el
`datos.js` de demostración que trae el panel, con su sello "datos de demostración".
Lo que el CRM no mide no se inventa: "El contenido" y los reels quedan vacíos y el panel
esconde esas páginas; los setters sin conversaciones cargadas muestran "—" en vez de una tasa.
La meta mensual y el precio base salen de `PANEL_META_MENSUAL` y `PANEL_PRECIO_BASE` en
`.env.local` (por defecto 50.000 y 1.500 — el PIF de IA Partner desde septiembre 2026).

Para actualizar el panel a una versión nueva del repo de Agustín: copiar `index.html`, `datos.js`,
`miniaturas/` y `estilos/` a `public/panel/` y volver a aplicar los cuatro retoques de la copia
(el `<script src="/api/panel/datos">`, la tolerancia a `contenido` vacío, las tasas de setters
sin denominador y el bloque "modo embebido" + "puente con el CRM" al final).

## Tema oscuro futurista

El CRM arranca en modo oscuro con la paleta del panel: fondo negro azulado con grilla de puntos,
tarjetas de grafito y las señales violeta / verde / ámbar / rojo / cian / magenta. Los tokens
están en el bloque `.dark` de `app/globals.css`; lo que cambia de forma (tarjetas, tablas,
formularios, portada, raíl) en `components/exposure/tema-futurista.css`. El tema claro
(papel cálido y oro de Exposure OS) sigue disponible desde Personalización.

## Integraciones y crons

Vacías hasta configurarlas en `.env.local`: ManyChat, Fathom, iClosed, Meta Ads, Mercury, OpenAI.
Los crons de `vercel.json` están desactivados; activar de a uno después de configurar cada integración
y `CRON_SECRET`.

## Deploy

Pendiente: crear el proyecto en Vercel y cargar las mismas variables de `.env.local`
(`NEXT_PUBLIC_APP_URL` con la URL final en https).
