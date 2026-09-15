-- Banco de formatos editable. Hasta ahora los formatos de pieza vivían fijos en una constante del
-- código (OFFICIAL_FORMAT_OPTIONS) y solo se podían cambiar tocando el repositorio. Pasan a esta
-- tabla para que el admin los agregue, edite y desactive desde Contenido → Formatos, y para poder
-- guardar una referencia visual de cada uno.
create table if not exists public.crm_formatos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,             -- la etiqueta que se guarda en crm_content_assets.format
  tipo text not null default 'Reel',       -- Reel · Carrusel · Historia · Otro. Agrupa el panel de referencias
  descripcion text,                        -- cuándo se usa este formato
  referencia_url text,                     -- link a la pieza de referencia (video, imagen o post)
  notas text,
  activo boolean not null default true,    -- desactivado = no se ofrece para piezas nuevas; el histórico queda
  orden integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_formatos_activo_orden on public.crm_formatos (activo, orden, nombre);
alter table public.crm_formatos enable row level security;
revoke all on public.crm_formatos from anon;

create or replace function public.crm_formatos_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists crm_formatos_touch on public.crm_formatos;
create trigger crm_formatos_touch before update on public.crm_formatos
  for each row execute function public.crm_formatos_touch();

-- Semilla: los formatos que ya usaba el CRM. `on conflict do nothing` para poder re-aplicar la
-- migración sin deshacer lo que el admin haya editado.
insert into public.crm_formatos (nombre, tipo, descripcion, orden) values
  ('TALKING HEAD',        'Reel',     'A cámara, hablando de frente. El formato base para problema y mentalidad.', 10),
  ('TALKING IMAGEN',      'Reel',     'Foto real del día con una frase encima. Costo de producción cero.', 20),
  ('B-ROLL + VOZ EN OFF', 'Reel',     'Imágenes de apoyo con la voz grabada aparte.', 30),
  ('CÁMARA + PC',         'Reel',     'A cámara con la pantalla al lado: educación concreta mostrando el sistema.', 40),
  ('REACCIÓN',            'Reel',     'Reacción a un video, comentario o noticia. La fábrica de contenido más rápida.', 50),
  ('ANÁLISIS',            'Reel',     'Desarme de un caso o de una estrategia ajena.', 60),
  ('VOLUMEN',             'Reel',     'Pieza de alcance: demo de herramienta, lista o comparativa. Sin bajada a producto.', 70),
  ('PIZARRÓN',            'Reel',     'Explicación dibujando sobre un pizarrón.', 80),
  ('MIRO',                'Reel',     'Explicación sobre un tablero de Miro.', 90),
  ('HORIZONTAL',          'Reel',     'Pieza grabada en horizontal, para YouTube o repurpose.', 100),
  ('TOP TIER',            'Reel',     'Producción alta: guion cerrado, varias tomas y edición pesada.', 110),
  ('TESTIMONIO',          'Reel',     'El alumno hablando, sin guion.', 120),
  ('CASO DE ÉXITO',       'Reel',     'Caso con pantalla y cifra real del período. Solo casos del banco.', 130),
  ('ESTRATEGIA',          'Reel',     'Pieza de estrategia: el marco completo explicado.', 140),
  ('CARRUSEL',            'Carrusel', 'Carrusel de slides. Educativo o de caso, con paso a paso.', 150)
on conflict (nombre) do nothing;
