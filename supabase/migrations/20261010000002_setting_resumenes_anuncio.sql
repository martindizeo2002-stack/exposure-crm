-- Anuncio probable de cada lead que llegó como «Follow Me Ads» (10/10/2026, pedido de Alex).
-- «Follow Me Ads» en el resumen del setter solo dice que entró como seguidor nuevo: puede ser orgánico o pauta.
-- Se estima comparando lo que contó el lead (situación, dolor, objetivo, cómo habla) con los creativos que estaban
-- corriendo en Follow Me Ads las tres semanas anteriores a la reserva. «ninguno» = no resuena con ningún creativo.
-- Lo carga Central Negocio/scripts/ads/resonancia.py.
alter table public.crm_setting_resumenes
  add column if not exists anuncio_id text,
  add column if not exists anuncio_nombre text,
  add column if not exists anuncio_confianza text,          -- alta · media · baja · ninguno
  add column if not exists anuncio_evidencia text;
