-- Resúmenes de setting del grupo de WhatsApp «Ventas EXPOSURE CONSULTING» (10/10/2026).
-- Después de cada agenda el setter (Maxi; antes Andrés) publica un resumen con secciones fijas: situación,
-- freno, objetivo, caso enviado, contenido consumido, gatillo de agenda, ciclo, seguimientos, historial y
-- síntesis. Además, el número de la empresa publica un aviso automático «📊 EOD ALEX» por cada reserva con el
-- formulario de iClosed (ingreso, inversión, situación, uso de IA, decisor, urgencia).
-- Los carga Central Negocio/scripts/whatsapp/setting-a-crm.py (lee el export + 2Chat). Un registro por resumen;
-- agenda_id queda null si no se pudo cruzar con seguridad (motivo en `cruce`).
-- El arquetipo sale de la situación que describe el resumen, con la frase textual como evidencia.

create table if not exists public.crm_setting_resumenes (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,               -- wa:<fecha y hora AR>:<setter>
  agenda_id uuid references public.agendas(id) on delete set null,
  person_id uuid,
  publicado_at timestamptz not null,             -- cuándo lo publicó el setter en el grupo
  setter text,
  nombre_perfil text,
  -- secciones del resumen, textuales
  situacion text,
  freno text,
  objetivo text,
  caso_enviado text,
  contenido_consumido text,
  material_enviado text,
  gatillo text,
  ciclo text,
  seguimientos text,
  seguimientos_n integer,
  historial text,
  sintesis text,
  texto text not null,                            -- el mensaje completo
  -- aviso automático de la agenda (formulario de iClosed)
  aviso_at timestamptz,
  aviso jsonb,
  minutos_aviso_resumen integer,                  -- del aviso al resumen: velocidad del setter
  -- contenido que disparó la agenda (etiqueta de ManyChat tal cual la cita el resumen)
  gatillo_etiqueta text,
  gatillo_formato text,                           -- reel · historia · carrusel · ads · outbound · webinar · otro · no_identificado
  -- tipo de lead
  arquetipo text,                                 -- 9a5 · universitario · sabe_ia · dueno_negocio · desempleado · laburante_digital · agencia_chica · creador · mmo · coach_consultor · otro
  arquetipo_secundario text,
  macro text,                                     -- Empleado · Estudiante · Negocio · Desempleado
  profesion text,
  arquetipo_evidencia text,
  arquetipo_confianza text,
  foco boolean,                                   -- arquetipo foco del contenido (9a5, universitario, sabe_ia, dueño de negocio)
  ingreso_declarado text,
  calificada boolean,                             -- criterio de Alex del 08/10/2026: ingreso 1.000-3.000 + arquetipo foco
  calificada_motivo text,
  -- trazabilidad del cruce
  cruce text,
  cruce_puntaje integer,
  clasificado_con text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_setting_resumenes_agenda_idx on public.crm_setting_resumenes (agenda_id);
create index if not exists crm_setting_resumenes_publicado_idx on public.crm_setting_resumenes (publicado_at desc);
create index if not exists crm_setting_resumenes_gatillo_idx on public.crm_setting_resumenes (gatillo_etiqueta);

-- Solo se accede desde el servidor con la clave de servicio: sin políticas, el acceso anónimo queda cerrado.
alter table public.crm_setting_resumenes enable row level security;
