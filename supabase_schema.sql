-- Ejecutar este SQL en Supabase > SQL Editor

-- Usuarios / perfiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  partner_name text default 'Mi pareja',
  created_at timestamp with time zone default now()
);

-- Cuentas bancarias
create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  type text not null default 'Bank',
  currency text not null default 'UYU',
  balance numeric default 0,
  owner text default 'personal',
  color text default '#2dd36f',
  created_at timestamp with time zone default now()
);

-- Categorías
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  parent text,
  icon text default '📁',
  budget numeric default 0,
  budget_period text default 'monthly',
  owner text default 'personal',
  color text default '#2dd36f',
  created_at timestamp with time zone default now()
);

-- Transacciones
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric not null,
  type text not null check (type in ('e','i','t')),
  currency text not null default 'UYU',
  category_id uuid references categories(id),
  account_id uuid references accounts(id),
  notes text,
  is_installment boolean default false,
  installment_current int,
  installment_total int,
  created_at timestamp with time zone default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;

create policy "Users can manage own profile"
  on profiles for all using (auth.uid() = id);

create policy "Users can manage own accounts"
  on accounts for all using (auth.uid() = user_id);

create policy "Users can manage own categories"
  on categories for all using (auth.uid() = user_id);

create policy "Users can manage own transactions"
  on transactions for all using (auth.uid() = user_id);

-- Auto-crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
