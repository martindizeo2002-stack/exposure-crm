-- UTM de cada agenda, tal como lo registra iClosed cuando el calendario recibe los parámetros de la página
-- (la landing de YouTube manda utm_source=yt). Permite saber de dónde vino cada agenda y da de alta el embudo YouTube.
alter table public.agendas
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists utm_referrer text;
create index if not exists agendas_utm_source_idx on public.agendas (utm_source) where utm_source is not null;
