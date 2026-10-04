# Exposure OS · Vista ciudad

Etapas A, B y C del prompt maestro, entregadas el 03/10/2026. Ruta: **Operaciones → Ciudad** (`/ciudad`),
para CEO, Sales Manager y Manager MKT. Solo lectura: no escribe en el CRM, no manda mensajes ni publica nada.

## Interpretación

La ciudad es el embudo de EXPOSURE dibujado como un lugar. Cada pieza de contenido es una **isla** en el agua; de
cada isla baja una **cinta** a la cinta grande de **ManyChat**, que entra a **Captación**. De ahí el recorrido sigue
por la fila de arriba (Captación → Sala de espera → Setters → plaza de **Agendas**) y vuelve por la de abajo
(oficinas de **Closers** → **Seguimiento** → **Clientes** → **Formación**).

Tres reglas mandan sobre el diseño:

1. **Cada figura es un registro real.** Si un grupo tiene más gente de la que entra en el patio, se dibujan los más
   recientes (hasta 14) y el número del cartel es el total; la lista completa está en el panel (hasta 200 por grupo).
   Los paquetes que avanzan por las cintas marcan caudal, no personas, y la leyenda lo dice.
2. **Lo que no tiene fuente es N/D, nunca cero.** Una isla sin etiqueta de ManyChat muestra «leads N/D»; Formación
   dice «actividad no disponible» y nadie se dibuja dormido.
3. **Solo hay modo real.** No existen datos de demo ni repeticiones; el cartel verde dice «Datos reales · corte HH:MM».

## Inventario: qué alimenta cada zona

| Zona | Qué se dibuja | Fuente | Estado |
|---|---|---|---|
| Islas | Una por pieza publicada en los últimos 21 días (hasta 24 en el mapa), color = ángulo de ManyChat | Etiquetas de pieza de ManyChat (`crm_angulos_manychat`, el mismo cálculo que Marketing → Ángulos) + piezas propias del radar (`radar_piezas`, cuenta alexmcarrera) | Real. La vista previa es parcial: el radar no captura todo |
| Cintas | Contactos nuevos de los últimos 7 días cuya primera etiqueta de pieza es esa isla | `crm_integration_assets` (ManyChat) | Real |
| Captación | Contactos nuevos de hoy (hora Argentina), barras de los últimos 7 días | ManyChat, tarea cada 3 h | Real, con hasta 3 h de atraso |
| Sala de espera | Contactos de 7 días sin la etiqueta ASIGNADO y sin agenda | ManyChat + `crm_identities` + `agendas` | Real |
| Setters | Setters del equipo (agendas hoy / 7 días, conversaciones del mes) + contactos con ASIGNADO y sin agenda | `team_members`, `agendas`, `metricas_manual` | Real. ManyChat no dice qué setter tiene cada conversación |
| Agendas | Una fila de sillas por closer; color = estado; la hora pintada en el respaldo | `agendas` del día (`fecha_closer`) | Real. No hay estado en vivo: «en horario» sale de la hora agendada |
| Closers | Una oficina por closer con sus calls del día | `agendas` + `team_members` | Real |
| Seguimiento | Leads en estado Activo o Reagendó; naranja = FUP vencido | `seguimientos` | Parcial: 49 de 54 sin próximo FUP |
| Clientes | Los que entraron en los últimos 30 días + cuotas vencidas sin pago | `clientes`, `plan_pago_items`, `planes_pago` | Real |
| Formación | Los clientes activos como alumnos | `clientes` | Actividad **no disponible** (no hay Discord, Skool ni asistencia conectados) |

Las fórmulas completas están en el **Diccionario** (botón arriba a la derecha) y salen de `DICCIONARIO` y
`ESTADOS_SILLA` en `lib/ciudad.ts`: si cambia una regla, se cambia ahí y la página la muestra sola.

## Arquitectura

- `lib/ciudad.ts` → `leerCiudad(sb, { dia, diasContenido })`: una sola lectura de todo, con service role, en ~4 s.
  Si el cálculo de piezas (la consulta más pesada) falla dos veces, la ciudad se arma igual sin el embudo de las
  piezas y lo avisa.
- `lib/angulos-manychat.ts` → `medirAngulos(sb, dias)`: el cálculo de Ángulos, movido desde la ruta para reusarlo.
- `app/api/ciudad/route.ts` → `GET /api/ciudad?dia=AAAA-MM-DD&dias=21` (protegida por rol en `lib/role-access.ts`).
- `components/ciudad/escena.tsx` → three.js con React Three Fiber y drei: cámara ortográfica en 3/4, geometría simple
  (cajas redondeadas, cápsulas, cilindros), carteles como capas HTML, un solo tooltip compartido.
- `components/ciudad/panel.tsx` → resumen, detalle por zona con los registros exactos, diccionario.
- `components/ciudad/vista.tsx` → barra (día, ocultar nombres, pausar animación, Ciudad / Tabla / Diccionario).
  Sin WebGL, arranca en Tabla. Con «reducir movimiento» del sistema, arranca pausada.
- Migración `20261003000001_indice_suscripcion_manychat.sql`: solo un índice sobre la fecha de suscripción de los
  contactos de ManyChat (sin él, la consulta recorría los 82 mil contactos).

## Lo que falta (etapas D a F)

- **Estado en vivo de las llamadas:** hoy no existe. Se puede sacar de iClosed o de Fathom (llamada empezada /
  terminada) para que la silla pase a «en llamada» de verdad.
- **Actividad de los alumnos:** conectar Discord, Skool o la asistencia a las clases; recién ahí Formación puede
  marcar a alguien como dormido, con una regla escrita en el diccionario.
- **Repetición del día:** reconstruir el recorrido con `crm_events` (manychat_tag, call_booked, call_showed,
  payment_received) para ver la ciudad de cualquier hora pasada. Tiene que verse distinto del modo real.
- **Recorrido de una persona:** tocar una figura y ver su camino isla → captación → setter → agenda → cliente.
- **Tiempo real:** hoy la página se relee cada 5 minutos; con Supabase Realtime se movería sola.
- **Datos que conviene corregir en el CRM:** agendas con closer «exposure» (no es un closer del equipo), seguimientos
  sin próximo FUP y la etapa `onboarding_pendiente`, que tienen casi todos los clientes.
