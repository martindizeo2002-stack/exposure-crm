-- Libros de Finanzas: gastos personales de Nahuel, gastos personales de Alex y el payroll de EXPOSURE
-- (sueldos, software y demás costos de la empresa). Cada fila es un gasto o un ingreso manual.
-- Se ve en CRM → Finanzas → Gastos y payroll (/finanzas/libros); la API usa la service role.
create table if not exists public.finanzas_registros (
  id uuid primary key default gen_random_uuid(),
  libro text not null check (libro in ('nahuel', 'alex', 'exposure')),
  tipo text not null default 'gasto' check (tipo in ('gasto', 'ingreso')),
  fecha date not null default current_date,
  concepto text not null check (char_length(concepto) between 1 and 300),
  monto_usd numeric(14,2) not null default 0 check (monto_usd >= 0),
  area text check (area is null or area in ('Marketing', 'Ventas', 'Producto', 'Operaciones')),
  categoria text,
  medio_pago text,
  notas text,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finanzas_registros_libro_fecha_idx on public.finanzas_registros(libro, fecha desc);
alter table public.finanzas_registros enable row level security;
revoke all on public.finanzas_registros from anon, authenticated;
