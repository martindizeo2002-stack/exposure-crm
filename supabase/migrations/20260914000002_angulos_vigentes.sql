-- Reemplazo del banco de ángulos por el vigente (planilla de Alex, 14/09/2026).
-- Los 25 originales del doc "Avatar Pibardo" quedaron obsoletos: la taxonomía ya no es por dolor
-- sino por etapa de consciencia (PROBLEMA / SOLUCIÓN / PRODUCTO / MENTALIDAD / VOLUMEN/TOFU), que es
-- la misma que usan las etiquetas de ManyChat (🔴Problema, 🟢Solución, 🔵Producto, 🟣Volumen/TOFU).
-- Se puede borrar sin perder nada: ninguna pieza de contenido ni agenda referencia los números viejos
-- (verificado el 14/09: 0 filas en crm_content_assets.angle y 0 en agendas.angulo_entrada con ese formato).
delete from public.crm_angulos;

insert into public.crm_angulos (numero, titulo, dolor) values
  (1,  'SABES IA PERO NO COMO VENDERLA',            'PROBLEMA'),
  (2,  'DEPENDER DE REFERIDOS',                     'PROBLEMA'),
  (3,  'ANTI-ECOM',                                 'PROBLEMA'),
  (4,  'SATURADO DE CLIENTES POR HORAS',            'PROBLEMA'),
  (5,  'SALARIO PROMEDIO EN ARG',                   'PROBLEMA'),
  (6,  'NECESITAS UN 2DO SALARIO',                  'PROBLEMA'),
  (7,  'PROSPECCIÓN EN FRIO',                       'PROBLEMA'),
  (8,  'COMO CERRAR CLIENTES CON IG',               'SOLUCIÓN'),
  (9,  'CÓMO GANAR DINERO CON IA',                  'SOLUCIÓN'),
  (10, 'INGRESO EXTRA IA',                          'SOLUCIÓN'),
  (11, 'CASO DE ÉXITO: BAUTISTA QUILEZ',            'PRODUCTO'),
  (12, 'CASO DE ÉXITO: FLEX',                       'PRODUCTO'),
  (13, 'CASO DE ÉXITO: FRAN PULEO',                 'PRODUCTO'),
  (14, 'CASO DE ÉXITO: TOTO BAEZ',                  'PRODUCTO'),
  (15, 'MI PROGRAMA 1-1',                           'PRODUCTO'),
  (16, 'MI HISTORIA',                               'MENTALIDAD'),
  (17, 'DEJA DE PROCASTINAR',                       'MENTALIDAD'),
  (18, 'VES 20 MIL TUTORIALES Y NO HACES NADA',     'MENTALIDAD'),
  (19, 'MOSTRALES QUE ESTÁN EQUIVOCADOS',           'MENTALIDAD'),
  (20, 'HERRAMIENTAS IA',                           'VOLUMEN/TOFU');
