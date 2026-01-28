
-- MIGRATION: Tabelas Complementares do Sistema AutoClaims Pro
-- Execute este script no SQL Editor do Supabase se as funcionalidades de Cotação ou Entrega apresentarem erro.

-- 1. TABELA DE COTAÇÕES (Quotations.tsx)
create table if not exists public.quotations (
  id uuid default gen_random_uuid() primary key,
  code text not null,
  "eventRef" text,
  "eventId" uuid references public.events(id) on delete set null,
  status text default 'Em Aberto',
  date text,
  suppliers int default 0,
  "itemCount" int default 0,
  created_at timestamp with time zone default now()
);

-- 2. TABELA DE ENTREGAS (Deliveries.tsx)
create table if not exists public.deliveries (
  id uuid default gen_random_uuid() primary key,
  po text,
  supplier text,
  items int default 0,
  date timestamp with time zone default now(),
  event text,
  status text default 'Pendente',
  created_at timestamp with time zone default now()
);

-- 3. HISTÓRICO DE EVENTOS (eventService.ts)
create table if not exists public.event_history (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade,
  from_status text,
  to_status text,
  comment text,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- 4. ANEXOS (eventService.ts)
create table if not exists public.event_attachments (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade,
  url text not null,
  name text,
  type text,
  created_at timestamp with time zone default now()
);

-- 5. POLÍTICAS DE SEGURANÇA (RLS)
alter table public.quotations enable row level security;
alter table public.deliveries enable row level security;
alter table public.event_history enable row level security;
alter table public.event_attachments enable row level security;

create policy "Acesso total logado" on quotations for all using (auth.role() = 'authenticated');
create policy "Acesso total logado" on deliveries for all using (auth.role() = 'authenticated');
create policy "Acesso total logado" on event_history for all using (auth.role() = 'authenticated');
create policy "Acesso total logado" on event_attachments for all using (auth.role() = 'authenticated');
