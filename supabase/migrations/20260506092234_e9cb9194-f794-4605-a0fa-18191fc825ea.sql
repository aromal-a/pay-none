-- Profiles table
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  display_name text,
  token_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = user_id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = user_id);

-- Token transactions ledger (server-only writes via service role)
create table public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text unique,
  price_id text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  tokens_credited integer not null,
  status text not null default 'completed',
  environment text not null default 'sandbox',
  created_at timestamptz not null default now()
);

create index idx_token_tx_user on public.token_transactions(user_id);

alter table public.token_transactions enable row level security;
create policy "Users view own transactions" on public.token_transactions for select using (auth.uid() = user_id);
-- No insert/update/delete policies = only service role can write

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Atomic token credit function (called by webhook via service role)
create or replace function public.credit_tokens(p_user_id uuid, p_tokens integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set token_balance = token_balance + p_tokens where user_id = p_user_id;
end;
$$;