-- ============================================================
-- Loma Production Studio — Supabase schema
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run
-- ============================================================

create table if not exists products (
  id text primary key,
  name text not null,
  sku_prefix text,
  image text,
  type text,
  fabric_name text, fabric_qty numeric, fabric_price numeric,
  button_name text, button_qty numeric, button_price numeric, button_size text,
  thread_name text, thread_qty numeric, thread_price numeric,
  fusing_name text, fusing_qty numeric, fusing_price numeric,
  zip_name text, zip_qty numeric, zip_price numeric,
  hook_name text, hook_qty numeric, hook_price numeric,
  elastic_name text, elastic_qty numeric, elastic_price numeric,
  lining_name text, lining_qty numeric, lining_price numeric,
  labour_cost numeric, tailor_output numeric, hours_per_piece numeric,
  packaging numeric, electricity_cost numeric, selling_price numeric,
  sizes jsonb not null default '[]',
  updated_at timestamptz default now()
);

create table if not exists materials (
  id text primary key,
  name text not null,
  category text not null,
  unit text,
  price numeric,
  stock numeric,
  block numeric,
  reorder_level numeric,
  image text,
  updated_at timestamptz default now()
);

create table if not exists production_log (
  id text primary key,
  date date not null,
  product_id text,
  product_name text,
  size text,
  qty numeric,
  status text,
  remarks text,
  created_at timestamptz default now()
);

create table if not exists sales_log (
  id text primary key,
  date date not null,
  product_id text,
  product_name text,
  size text,
  qty numeric,
  channel text,
  price numeric,
  created_at timestamptz default now()
);

create table if not exists app_settings (
  id int primary key default 1,
  daily_labour_budget numeric,
  constraint single_row check (id = 1)
);

create table if not exists last_update (
  id int primary key default 1,
  name text,
  what text,
  ts timestamptz,
  constraint single_row check (id = 1)
);

-- Row Level Security: open read/write for now since this is a small internal team tool
-- accessed only via the anon key you'll put in Netlify's env vars. Tighten later with
-- Supabase Auth if you want per-user logins.
alter table products enable row level security;
alter table materials enable row level security;
alter table production_log enable row level security;
alter table sales_log enable row level security;
alter table app_settings enable row level security;
alter table last_update enable row level security;

create policy "allow all products" on products for all using (true) with check (true);
create policy "allow all materials" on materials for all using (true) with check (true);
create policy "allow all production_log" on production_log for all using (true) with check (true);
create policy "allow all sales_log" on sales_log for all using (true) with check (true);
create policy "allow all app_settings" on app_settings for all using (true) with check (true);
create policy "allow all last_update" on last_update for all using (true) with check (true);

insert into app_settings (id, daily_labour_budget) values (1, 1100)
  on conflict (id) do nothing;
