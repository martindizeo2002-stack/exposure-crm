# Guía rápida del CRM para el equipo de EXPOSURE

**Dirección:** https://exposure-crm-nu.vercel.app · Entrás con tu mail y contraseña (Alex las tiene en `exposure-crm-secrets\usuarios.txt`).

## Quién ve qué

| Usuario | Rol | Qué ve |
|---|---|---|
| Alex, Nahuel | CEO / admin | Todo: home con cash, panel del negocio, métricas, finanzas, equipo, accesos. |
| Cristian, Bener (y Tobías si se le crea usuario) | Closer | Home con **sus** números, pipeline, sus agendas, carga de pagos, pagos, seguimientos, cobros y clientes. |
| Máximo | Setter | Pipeline, agendas, seguimientos, carga de pagos. |

Lo que no le corresponde a un rol rebota con "Tu cuenta no tiene acceso a este módulo". Para cambiar roles o crear usuarios: `node scripts/crear-usuario.mjs <mail> <contraseña> "<nombre>" <rol>` desde la carpeta del CRM.

## El flujo de un lead

1. **Entra la agenda** sola desde iClosed (cada 10 minutos) o a mano en *Agendas → Vista de agendas*. Cada agenda tiene closer, setter, fecha de la llamada, calificación (LEAD A/B/C/D) y las respuestas del formulario.
2. **La llamada** se marca en el pipeline (obligatorio para que el show-up rate sea real): show / no show, estado (Adentro en Call, Hacer Seguimiento, Seguimiento por wpp, Agendó 2da call…), motivo de no cierre, link de Fathom.
3. **El cierre se carga en "Cargar pago"** (menú Pagos → Cargar pago):
   - Closer → Categoría (Front End = venta nueva, Back End = venta a cliente existente) → Nombre del cliente (busca su agenda) → Programa (IA Partner, Agency, Agency Pro, Content, Círculo) → operación.
   - Pagos: fecha, monto en USD y **concepto**. Primer pago: *Fee* (guarda lugar, no da acceso), *Venta Nueva* (cerró en la call), *Adentro en Seguimiento* (cerró después), *Venta Interna* / *Upsell*. Pagos siguientes: *Completó PIF*, *Adentro en Seguimiento y Post Fee*, *Cuota 1…10*, *Cuota Venta Interna*.
   - "Guardar y Cargar en CRM" crea el pago, el plan de pagos con sus cuotas, marca la agenda como cerrada y crea al cliente. El botón "Copiar mensaje" arma el texto del plan (PPP) para el grupo.
4. **Cuotas y cobros**: *Cobros y cuotas* muestra lo que vence, lo atrasado y quién lo tiene que cobrar. Cuando entra una cuota, se carga desde el mismo "Cargar pago" eligiendo el plan existente.
5. **Clientes**: se crean solos al cargar una venta. Ahí van onboarding, calls con CSM, estado y baja.

## Seguimientos (25/09)

Es la pestaña "🔂 SEGUIMIENTOS" del sheet, pero adentro del CRM y por closer (menú Ventas → Seguimientos).

- **Cada closer ve solo sus leads**; dirección y setters ven todos y pueden filtrar por closer.
- Una fila por lead: tuvo call, situación, audio enviado, tipo de lead, problema/dolor, **los 10 FUP como casilleros** (al marcar uno queda la fecha y quién lo hizo), próximo contacto, razón para la call, link de Fathom, notas y estado (Activo · Reagendó · Cerrado · Descartado).
- **Todo se guarda solo**: los desplegables y casilleros al tocarlos, los textos al salir del campo.
- Los leads entran desde "Agregar lead": se eligen agendas de los últimos 90 días, o con un clic se traen todas las que quedaron en estado *Hacer Seguimiento, Seguimiento por wpp, Adentro en FUP, Agendó 2da call* o *Fee*. También se puede cargar uno a mano.
- Arriba se ven los vencidos (el próximo contacto ya pasó), los de hoy y cuántos leads hay en cada etapa de FUP.
- Cuando el lead cierra, se carga el pago como siempre y el seguimiento se pasa a Cerrado; si se enfría, a Descartado. Borrar solo puede dirección.

## Embudos (25/09)

Ventas → Embudos: la misma tabla de métricas para Webinar, Orgánico y Outbound, mes por mes. Ads no es un embudo aparte: es el orgánico potenciado con Meta Ads, y se ve en "Orgánico por origen". Criterio:

- **Cierre** = cliente que entró al programa (pago Venta Nueva o Adentro en Seguimiento en el mes). Un fee no es cierre; los fees tienen su fila.
- **AOV Trato Cerrado** = lo que pagó cada cliente el día que entró (sumando los pagos de ese día). Sano: 33 a 50 % del ticket.
- **AOV Día 1** = lo recibido el día del cierre sobre todos los compromisos (los que entraron + los que dejaron fee). Mínimo: 10 % del ticket.
- **Cash collected** sale de la tabla de pagos y se atribuye al embudo de la agenda del cliente (por persona, teléfono o nombre). Las cuotas de clientes viejos cuentan en el embudo por el que entraron.
- El show up se calcula sobre las calls con resultado; "sin resultado cargado" muestra cuántas calls pasadas nadie marcó. Si ese número es alto, el show up no es confiable.
- Outbound tiene su trazabilidad lead por lead (setter que prospectó, closer, calificación, show, estado, pagos).

## Sheet CRM CENTRAL 2026 y el CRM (25/09)

El CRM escribe solo en el sheet (cada 5 minutos) los pagos y las agendas; **lo que se carga a mano en el sheet no vuelve al CRM solo**. La carga de show, cerró, estado y motivo va en el CRM (pipeline o Vista de agendas). Si igual alguien actualiza la pestaña de agendas del sheet, se trae al CRM con `python scripts/importar-agendas-sheet.py --aplicar` (primero sin `--aplicar` muestra qué cambiaría). El espejo verifica el teléfono antes de escribir en una fila del sheet: si el equipo borró o corrió filas, no pisa a otra persona.

## Avisos en el celular o la compu (24/09)

En **Contenido → Semanal** hay un botón **"Activar avisos"** (lo ven CEO, Sales Manager y Manager MKT). Al tocarlo, el navegador pide permiso
y ese dispositivo queda anotado: cada vez que un editor mueve una pieza de **Grabado → En producción** o de **En producción → Revisar**,
llega una notificación con el nombre del editor asignado ("Nico ha movido un video a revisar.") y el título de la pieza; al tocarla se
abre el pipeline. Se activa por dispositivo (la compu y el celular por separado) y "Probar" manda un aviso de prueba. En iPhone solo
funciona con el CRM agregado a la pantalla de inicio (Compartir → Agregar a pantalla de inicio) y abierto desde ahí.

## Lo que pasa solo

- **Google Sheet CRM CENTRAL 2026**: cada pago o agenda que se carga o cambia en el CRM se escribe en la pestaña del mes (`💰 PAGOS <MES>`, `📆 AGENDAS <MES>`) al instante. Es de ida: lo que se toca a mano en el sheet **no** vuelve al CRM.
- **Leaderboard, métricas y panel del negocio** se calculan de los pagos y agendas cargados. No hay que llenar METRICS ni LEADERBOARDS a mano.
- **ManyChat**: cada contacto nuevo y cada etiqueta llegan al CRM al instante (automatización "CRM EXPOSURE · sincronizar contactos"); el cruce con las agendas por Instagram dice qué pieza de contenido trajo cada lead y las conversaciones nuevas por mes y setter alimentan el panel.
- **Fathom**: cada 30 minutos el CRM lee las grabaciones nuevas, las transcribe y analiza, y marca la llamada como tomada en su agenda.

- **Reportes del setter**: cada dashboard diario de Máximo se archiva en `Central Negocio/datos/setting-reports` y se carga con `python scripts/setting/actualizar.py`. Aparece en Panel del negocio → El equipo → Setting diario, en Métricas (calendarios enviados) y en la ficha de cada lead.

- **Resumen de setting** (Ventas → Resumen de setting): el setter pega sus notas del día, sale el reporte y el mensaje para WhatsApp, y con "Guardar" queda en el CRM sin pasar por archivos.
- **Ángulos** (Marketing → Ángulos): qué ángulo de comunicación trae leads, agendas, cierres y cash, según las etiquetas de ManyChat.
- **WhatsApp** (Ventas → WhatsApp): los grupos donde está el número del bot, con resumen por IA.

- **Tipo de lead (S/A/B/C/D)**: lo calcula solo el CRM con el formulario de agenda de iClosed (capital, ingresos, etapa, objetivo, situación). Se ve en cada agenda, en el pipeline y en el Panel del negocio. Si el closer carga otra calificación a mano, esa manda.

- **Pago ↔ lead ↔ plan**: al editar un pago podés pegar el ManyChat ID del lead para que quede atado a su ficha, marcar de qué cuota de un plan es ese pago, o crear el plan ahí mismo.

## Reglas para que los números cierren

- El **concepto** del pago es lo que decide todo: cash collected, FECCU/FECCPP, comisiones y si el cliente tiene acceso. Usá siempre el de la lista.
- El **monto** va en USD. Si cobraron en pesos, cargá el USD equivalente y el ARS en el campo CC ARS.
- La **fecha** del pago es la del cobro, no la de la carga.
- **Nombre del cliente** igual al de la agenda (buscalo, no lo escribas de cero) para que el CRM lo vincule a la misma persona.
- No borrar pagos: se anulan (queda el rastro y el sheet lo marca `ANULADO`).
