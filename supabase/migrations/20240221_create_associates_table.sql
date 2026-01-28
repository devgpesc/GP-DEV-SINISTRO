
-- Criação da tabela de Associados (Clientes)
create table if not exists public.associates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  document text not null, -- CPF ou CNPJ
  type text not null check (type in ('PF', 'PJ')),
  responsible text,
  email text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilita RLS (Row Level Security)
alter table public.associates enable row level security;

-- Políticas de Acesso (Permissiva para facilitar o uso inicial, ajustar conforme necessidade de segurança)
create policy "Enable read access for all users" on public.associates for select using (true);
create policy "Enable insert for authenticated users only" on public.associates for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users only" on public.associates for update using (auth.role() = 'authenticated');
create policy "Enable delete for authenticated users only" on public.associates for delete using (auth.role() = 'authenticated');
