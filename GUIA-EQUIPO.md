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

## Reglas para que los números cierren

- El **concepto** del pago es lo que decide todo: cash collected, FECCU/FECCPP, comisiones y si el cliente tiene acceso. Usá siempre el de la lista.
- El **monto** va en USD. Si cobraron en pesos, cargá el USD equivalente y el ARS en el campo CC ARS.
- La **fecha** del pago es la del cobro, no la de la carga.
- **Nombre del cliente** igual al de la agenda (buscalo, no lo escribas de cero) para que el CRM lo vincule a la misma persona.
- No borrar pagos: se anulan (queda el rastro y el sheet lo marca `ANULADO`).
