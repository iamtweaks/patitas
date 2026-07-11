-- Patitas initial schema
-- Applied to Supabase on 2026-07-11 via MCP

-- =====================================================
-- Clientes (dueños)
-- =====================================================
create table if not exists public.patitas_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  telefono text,
  email text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- Perros (mascotas)
-- =====================================================
create table if not exists public.patitas_perros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.patitas_clientes(id) on delete cascade,
  nombre text not null,
  raza text not null,
  tamanio text check (tamanio in ('chico', 'mediano', 'grande', 'gigante')),
  peso_kg numeric(6,2),
  fecha_nacimiento date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- Servicios / visitas
-- =====================================================
create table if not exists public.patitas_servicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  perro_id uuid not null references public.patitas_perros(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('bano', 'corte', 'bano_y_corte', 'otro')),
  precio numeric(10,2) not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- Indexes
-- =====================================================
create index if not exists idx_patitas_clientes_user on public.patitas_clientes(user_id);
create index if not exists idx_patitas_perros_user on public.patitas_perros(user_id);
create index if not exists idx_patitas_perros_cliente on public.patitas_perros(cliente_id);
create index if not exists idx_patitas_servicios_user on public.patitas_servicios(user_id);
create index if not exists idx_patitas_servicios_perro on public.patitas_servicios(perro_id);
create index if not exists idx_patitas_servicios_fecha on public.patitas_servicios(fecha desc);

-- =====================================================
-- Updated_at trigger
-- =====================================================
create or replace function public.patitas_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_patitas_clientes_updated
before update on public.patitas_clientes
for each row execute function public.patitas_set_updated_at();

create trigger trg_patitas_perros_updated
before update on public.patitas_perros
for each row execute function public.patitas_set_updated_at();

create trigger trg_patitas_servicios_updated
before update on public.patitas_servicios
for each row execute function public.patitas_set_updated_at();

-- =====================================================
-- RLS — cada user solo ve sus datos
-- =====================================================
alter table public.patitas_clientes enable row level security;
alter table public.patitas_perros enable row level security;
alter table public.patitas_servicios enable row level security;

drop policy if exists "Users can manage own clients" on public.patitas_clientes;
create policy "Users can manage own clients"
  on public.patitas_clientes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own perros" on public.patitas_perros;
create policy "Users can manage own perros"
  on public.patitas_perros
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own servicios" on public.patitas_servicios;
create policy "Users can manage own servicios"
  on public.patitas_servicios
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);