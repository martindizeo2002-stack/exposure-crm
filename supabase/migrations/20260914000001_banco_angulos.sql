-- Banco de ángulos editable. Hasta ahora los 25 ángulos vivían fijos en lib/angulos-exposure.ts
-- y solo se podían cambiar tocando el código. Pasan a esta tabla para que Alex los edite, agregue
-- y desactive desde Contenido → Banco de ángulos. El código mantiene los 25 como semilla y como
-- respaldo si la tabla estuviera vacía o la base no respondiera.
create table if not exists public.crm_angulos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,          -- el "N" de la etiqueta "N · título"; es la clave estable
  titulo text not null,
  dolor text not null,                     -- agrupa la rotación de Volumen (ver lib/content-volume-angle.ts)
  activo boolean not null default true,    -- desactivado = no se ofrece para contenido nuevo, pero el histórico sigue leyéndose
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_angulos_activo_numero on public.crm_angulos (activo, numero);
alter table public.crm_angulos enable row level security;
revoke all on public.crm_angulos from anon;

create or replace function public.crm_angulos_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists crm_angulos_touch on public.crm_angulos;
create trigger crm_angulos_touch before update on public.crm_angulos
  for each row execute function public.crm_angulos_touch();

-- Semilla: los 25 ángulos del doc "Avatar Pibardo - BIZOP". Si ya existe el número, no se pisa
-- (para poder re-aplicar la migración sin deshacer ediciones de Alex).
insert into public.crm_angulos (numero, titulo, dolor) values
  (1,  'El techo del rol operativo: ser el mejor editando, cerrando o seteando no te saca de los 1.500', 'techo operativo'),
  (2,  'Sos el mejor empleado del negocio de otro y el peor jefe de vos mismo', 'techo operativo'),
  (3,  'Llevás dos años "metido en lo digital" y todavía no tenés un negocio. ¿Por qué?', 'falta de vehículo'),
  (4,  'Tenés las ganas, el tiempo y la habilidad. Lo único que te falta es el vehículo', 'falta de vehículo'),
  (5,  '"Me falta información" es la mentira que te contás para no arrancar', 'procrastinación'),
  (6,  'Consumiste 2 años de contenido de negocios y seguís en cero. El consumo no es acción', 'procrastinación'),
  (7,  'Tocaste un pico una vez y bajaste: el pico sin sistema es peor que nunca subir', 'falta de sistema'),
  (8,  'Vender tu habilidad barata vs. usarla para operar lo tuyo: la diferencia de 300 a 3.000', 'oferta pobre'),
  (9,  'El cliente que regatea es culpa de tu oferta, no del cliente', 'oferta pobre'),
  (10, 'La trampa de laburar en el negocio de otro: cobrás lo que él decide', 'techo operativo'),
  (11, 'Probaste dropshipping, afiliados, trading y no pegaste. No era vos, era el vehículo', 'falta de vehículo'),
  (12, 'Prospección en frío: cinco "no" por día te están quemando', 'adquisición sin control'),
  (13, 'El miedo al high ticket no es por la plata, es porque te sentís un impostor', 'impostor'),
  (14, '10K te parece imposible solo porque nadie de tu entorno lo gana', 'autoestima'),
  (15, 'El pueblo, el bullying y por qué todavía no te mostrás', 'marca personal'),
  (16, '"Quiero disfrutar la vida" vs. "quiero comerme el mundo": el subibaja que te traba', 'identidad'),
  (17, 'No querés un negocio. Querés demostrarte que podés', 'identidad'),
  (18, 'El verdadero lujo no es el Lambo: es reponer un celu robado sin que duela', 'identidad'),
  (19, 'Ves 20 caminos y no sabés cuál tomar. El problema no es falta de opciones', 'parálisis'),
  (20, 'La diferencia entre el que arranca y el que "piensa el negocio" dos años', 'procrastinación'),
  (21, 'Estudiás algo que ya sabés que no vas a ejercer. ¿Por qué seguís ahí?', 'falta de vehículo'),
  (22, 'El costo de oportunidad de tus últimos 5 meses, en dólares', 'procrastinación'),
  (23, 'Tenés habilidades reales y las estás regalando como servicio barato', 'oferta pobre'),
  (24, 'Los referentes te inspiran pero no te sirven de espejo (y quién sí)', 'autoestima'),
  (25, 'La estafa que te hicieron y por qué ahora no confiás en nadie (y cómo elegir bien)', 'confianza')
on conflict (numero) do nothing;
