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
- Una fila por lead: tuvo call, situación, audio enviado, tipo de lead, problema/dolor, **los 10 FUP como casilleros**, próximo contacto, razón para la call, link de Fathom, notas y estado (Activo · Reagendó · Cerrado · Descartado).
- **Cada FUP se abre tocándolo** (26/09) y tiene su propia ficha:
  - **Fecha**: se puede poner una anterior a hoy para dejar registro de un seguimiento que ya se hizo, o una futura para dejarlo preparado.
  - **Hecho** (ya se envió) o **Preparado para esa fecha** (texto, link o captura listos para usar cuando toque).
  - **Nota corta**, **mensaje enviado o preparado** (se pega el DM, WhatsApp o audio transcripto), **link** (Loom, Drive, video) y **capturas** (JPG, PNG, WEBP, GIF o PDF hasta 8 MB; también se pega la captura con Ctrl+V dentro de la ficha). Las capturas quedan guardadas al instante; lo demás con "Guardar".
  - "Marcar hecho hoy" lo cierra en un toque; "Quitar FUP" lo borra.
  - Colores del casillero: **azul** = hecho (muestra el día), **amarillo punteado** = preparado para más adelante, **rojo punteado** = preparado con fecha que ya pasó y no se envió. Un puntito arriba avisa que tiene mensaje, link o captura.
  - La etapa del lead cuenta solo los FUP hechos. Si se deja un FUP preparado a futuro, el **próximo contacto** se corre solo a esa fecha (salvo que ya hubiera uno más cercano).
- **Todo se guarda solo**: los desplegables al tocarlos, los textos al salir del campo.
- Los leads entran desde "Agregar lead": se eligen agendas de los últimos 90 días, o con un clic se traen todas las que quedaron en estado *Hacer Seguimiento, Seguimiento por wpp, Adentro en FUP, Agendó 2da call* o *Fee*. También se puede cargar uno a mano.
- Arriba se ven los vencidos (el próximo contacto ya pasó), los de hoy y cuántos leads hay en cada etapa de FUP.
- Cuando el lead cierra, se carga el pago como siempre y el seguimiento se pasa a Cerrado; si se enfría, a Descartado. Borrar solo puede dirección.

## Radar de contenido (29/09)

Marketing → Radar. Sigue cuentas de Instagram (las nuestras, la competencia y los referentes) y muestra qué publican, cómo les rinde y cómo se haría esa pieza en EXPOSURE.

- **Semana** y **Grilla**: las piezas del período (esta semana, 7 o 30 días) con comentarios, views, tasa, outlier y score. *Outlier* = views de la pieza sobre la mediana de su cuenta; 3x o más es un banger. *Score* = ranking de 0 a 100 (50 % comentarios, 30 % outlier, 20 % tasa). Tocando una pieza se abre el panel con el caption, lo que se dice, las slides leídas y el análisis.
- **Análisis** (lo hace Claude): formato, etapa de consciencia, hook textual y su patrón, estructura, CTA, keyword, recurso prometido, por qué pegó, ángulo del banco que le corresponde y si es recreable.
- **Generar recreación**: escribe la versión de EXPOSURE (reel, carrusel, historias y hooks alternativos) con las reglas de la casa. Marca en "revisar antes de publicar" lo que roza una regla. **Reel → Contenido** y **Carrusel → Contenido** la mandan al pipeline como pieza con guion listo.
- **Cuentas**: una cuenta a fondo (keywords que farmean, patrones de hook, formatos, hora y día de publicación) y el dossier "qué hace y qué le robamos", que se genera a pedido.
- **Guion**: anatomía del guion de los reels con voz (hook, apertura, estructura, evidencia, emoción, CTA) cruzada con el rendimiento. Pide 15 reels etiquetados por cuenta.
- **Historias**: las historias capturadas antes de que venzan, con el texto en pantalla, lo hablado, los stickers y el tipo (hand raiser, CTA, why now, encuesta, prueba social). **Las métricas de historias ajenas no son públicas**: alcance, respuestas y salidas solo existen para la cuenta propia.
- **Semillas**: las cuentas seguidas. Se agregan pegando el @usuario o el link (varias a la vez), se pausan y se les prende o apaga la captura de historias. Abajo está qué está conectado y las últimas corridas con su costo.
- **Comentarios**: dolores, objeciones, preguntas y jerga de la audiencia, sacados de los comentarios de las piezas más comentadas.
- **Sincronizar** (arriba): adelanta cualquier lectura sin esperar al horario.
- **Historias (desde el 29/09, Apify plan Starter):** todos los días a las **18:00** se leen las historias activas de las cuentas con "historias" prendido y a las **22:00** se vuelve a mirar: solo se suman las nuevas y queda anotado qué cuentas publicaron algo después de las 18 (Semillas → Conexiones y corridas). Corre en la nube, no depende de ninguna compu y no deja "visto". Se guarda la imagen o el video original, lo hablado (salvo las que tienen música de fondo), los stickers y la lectura de Claude (texto en pantalla, tipo, CTA y keyword).
- Ven el Radar dirección, marketing y editores. Agregar cuentas, sincronizar, analizar y recrear: solo dirección y marketing.

De dónde sale cada cosa: las piezas, perfiles, historias y comentarios los lee **Apify**; las historias propias con sus métricas, la **Graph API de Instagram**; la transcripción, **Whisper (Groq)**; el análisis, **Claude**. Variables: `APIFY_TOKEN`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `IG_INSIGHTS_TOKEN`, `RADAR_PLAN` (`gratis` o `completo`), `RADAR_MODELO`.

## Embudos (25/09)

Ventas → Embudos: la misma tabla de métricas para Webinar, Orgánico y Outbound, mes por mes. Ads no es un embudo aparte: es el orgánico potenciado con Meta Ads, y se ve en "Orgánico por origen". Criterio:

- **Cierre** = cliente que entró al programa (pago Venta Nueva o Adentro en Seguimiento en el mes). Un fee no es cierre; los fees tienen su fila.
- **AOV Trato Cerrado** = lo que pagó cada cliente el día que entró (sumando los pagos de ese día). Sano: 33 a 50 % del ticket.
- **AOV Día 1** = lo recibido el día del cierre sobre todos los compromisos (los que entraron + los que dejaron fee). Mínimo: 10 % del ticket.
- **Cash collected** sale de la tabla de pagos y se atribuye al embudo de la agenda del cliente (por persona, teléfono o nombre). Las cuotas de clientes viejos cuentan en el embudo por el que entraron.
- El show up se calcula sobre las calls con resultado; "sin resultado cargado" muestra cuántas calls pasadas nadie marcó. Si ese número es alto, el show up no es confiable.
- Outbound tiene su trazabilidad lead por lead (setter que prospectó, closer, calificación, show, estado, pagos).
- **Meta Ads (01/10):** debajo de la tabla está el bloque Meta Ads con la inversión del mes por embudo, el costo por agenda, por presentada, por cierre (CAC) y el retorno (cash del embudo ÷ inversión). Más abajo, la lista de campañas con lo invertido, impresiones, clics y costo por clic. La inversión se lee de Meta campaña por campaña y queda guardada en el CRM (tablas `ads_campanas_mes` y `ads_meses`): las campañas «exp-…» van a Webinar y el resto (Follow Me Ads, tráfico) a Orgánico. Si una campaña está mal imputada, se le cambia el embudo en esa lista y queda fijo para esa campaña. El mes en curso se relee cada 3 horas; el botón **Traer de Meta** fuerza la relectura. El Panel del negocio usa la misma inversión para el CAC. **Operaciones → Métricas** tiene el mismo corte: botones **Embudo** (Todos · Webinar · Orgánico · Outbound · Sin fuente) que recortan todo (agendas por fuente, pagos y planes por la agenda del cliente, inversión por campaña) con la misma regla que Embudos (`lib/embudo-atribucion.ts`); los cuatro embudos suman el total. **Los botones se combinan (01/10):** tocando varios (p. ej. Orgánico + Outbound) se miden como un solo embudo; las tasas, el ROAS y el CAC salen de los totales sumados (pesa más el embudo con más volumen, no es el promedio simple) y aparece la tabla **Por separado y juntos** con cada uno y la suma. Tocar un embudo elegido lo saca; **Todos** limpia. En la API, `?embudo=Orgánico,Outbound`. Los leads y conversaciones de ManyChat no se separan por embudo, y con un embudo elegido no se editan. Para cargar el histórico desde la compu: `npx --yes tsx scripts/ads-sincronizar.ts [AAAA-MM …]`.

## Costo por seguidor (02/10)

En **Ventas → Embudos** (debajo de las campañas de Meta Ads) y en **Operaciones → Métricas** (bloque Meta Ads). Costo por seguidor = gasto de las campañas del embudo orgánico (Follow Me Ads) ÷ seguidores nuevos. Los seguidores nuevos son los contactos que ManyChat etiqueta "Nuevo Seguidor", contados por día de alta (tabla `crm_seguidores_dia`, la carga el importador de ManyChat cada 3 horas). Además, el Radar saca todos los días a las 00:05 una foto del total de seguidores de la cuenta: la resta entre dos días es el crecimiento neto (descuenta a los que dejan de seguir). Es un costo **mezclado**: Meta no informa seguidores en esta campaña (es de tráfico), así que incluye a los que llegaron por orgánico. Ojo: la etiqueta "Nuevo Seguidor | Agosto 2026" incluye unas 4.500 altas de julio; por eso se cuenta por día de alta y no por la etiqueta.

## Ciudad (03/10)

**Operaciones → Ciudad** muestra todo el negocio como una ciudad en 3D: cada pieza de contenido es una isla (color = ángulo), la cinta de ManyChat lleva los contactos a Captación, y de ahí Sala de espera → Setters → Agendas (una fila de sillas por closer, color = estado, la hora en el respaldo) → oficinas de los Closers → Seguimiento → Clientes → Formación. Cada figura es una persona real del CRM; si hay más de las que entran, se dibujan las más recientes y el cartel dice el total. Tocá un edificio, una isla o una persona y el panel de la derecha muestra la lista exacta con links al módulo que corresponde. Arriba: el día de las agendas, **Ocultar nombres** (para compartir pantalla), **Pausar** la animación y las vistas **Tabla** (lo mismo sin 3D) y **Diccionario** (qué cuenta cada número y de dónde sale). Es solo lectura. Lo que no tiene fuente dice N/D: la actividad de los alumnos todavía no está conectada y el CRM no sabe si una llamada empezó (la silla «en horario» sale de la hora agendada). Detalle técnico: `docs/ciudad-exposure-os.md`.

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
