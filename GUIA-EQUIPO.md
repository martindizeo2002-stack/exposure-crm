# Guía rápida del CRM para el equipo de EXPOSURE

**Dirección:** https://exposure-crm-nu.vercel.app · Entrás con tu mail y contraseña (Alex las tiene en `exposure-crm-secrets\usuarios.txt`).

## Quién ve qué

| Usuario | Rol | Qué ve |
|---|---|---|
| Alex, Nahuel | CEO / admin | Todo: home con cash, panel del negocio, métricas, finanzas, equipo, accesos. |
| Cristian, Kenneth (y Tobías si se le crea usuario) | Closer | Home con **sus** números, pipeline, sus agendas, carga de pagos, pagos, seguimientos, cobros y clientes. |
| Máximo | Setter | Pipeline, agendas, seguimientos, carga de pagos. |

Lo que no le corresponde a un rol rebota con "Tu cuenta no tiene acceso a este módulo". Para cambiar roles o crear usuarios: `node scripts/crear-usuario.mjs <mail> <contraseña> "<nombre>" <rol>` desde la carpeta del CRM.

## El flujo de un lead

1. **Entra la agenda** (hoy desde el sheet o a mano en *Agendas → Vista de agendas*; con la clave de iClosed va a entrar sola). Cada agenda tiene closer, setter, fecha de la llamada, calificación (LEAD A/B/C/D) y las respuestas del formulario.
2. **La llamada** se marca en el pipeline: show / no show, estado (Adentro en Call, Hacer Seguimiento, Seguimiento por wpp, Agendó 2da call…), motivo de no cierre, link de Fathom.
3. **El cierre se carga en "Cargar pago"** (menú Pagos → Cargar pago):
   - Closer → Categoría (Front End = venta nueva, Back End = venta a cliente existente) → Nombre del cliente (busca su agenda) → Programa (IA Partner, Agency, Agency Pro, Content, Círculo) → operación.
   - Pagos: fecha, monto en USD y **concepto**. Primer pago: *Fee* (guarda lugar, no da acceso), *Venta Nueva* (cerró en la call), *Adentro en Seguimiento* (cerró después), *Venta Interna* / *Upsell*. Pagos siguientes: *Completó PIF*, *Adentro en Seguimiento y Post Fee*, *Cuota 1…10*, *Cuota Venta Interna*.
   - "Guardar y Cargar en CRM" crea el pago, el plan de pagos con sus cuotas, marca la agenda como cerrada y crea al cliente. El botón "Copiar mensaje" arma el texto del plan (PPP) para el grupo.
4. **Cuotas y cobros**: *Cobros y cuotas* muestra lo que vence, lo atrasado y quién lo tiene que cobrar. Cuando entra una cuota, se carga desde el mismo "Cargar pago" eligiendo el plan existente.
5. **Clientes**: se crean solos al cargar una venta. Ahí van onboarding, calls con CSM, estado y baja.

## Lo que pasa solo

- **Google Sheet CRM CENTRAL 2026**: cada pago o agenda que se carga o cambia en el CRM se escribe en la pestaña del mes (`💰 PAGOS <MES>`, `📆 AGENDAS <MES>`) al instante. Es de ida: lo que se toca a mano en el sheet **no** vuelve al CRM.
- **Leaderboard, métricas y panel del negocio** se calculan de los pagos y agendas cargados. No hay que llenar METRICS ni LEADERBOARDS a mano.
- **ManyChat**: los 78.000 contactos con sus tags están en el CRM; el cruce con las agendas por Instagram dice qué pieza de contenido trajo cada lead y las conversaciones nuevas por mes y setter alimentan el panel.
- **Fathom**: una vez por día el CRM lee las grabaciones y marca show / no show real y motivo de no cierre en la agenda.

## Reglas para que los números cierren

- El **concepto** del pago es lo que decide todo: cash collected, FECCU/FECCPP, comisiones y si el cliente tiene acceso. Usá siempre el de la lista.
- El **monto** va en USD. Si cobraron en pesos, cargá el USD equivalente y el ARS en el campo CC ARS.
- La **fecha** del pago es la del cobro, no la de la carga.
- **Nombre del cliente** igual al de la agenda (buscalo, no lo escribas de cero) para que el CRM lo vincule a la misma persona.
- No borrar pagos: se anulan (queda el rastro y el sheet lo marca `ANULADO`).
