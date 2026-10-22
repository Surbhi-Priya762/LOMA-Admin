-- ============================================================
-- Daily Production — run this once in Supabase
-- Project → SQL Editor → New query → paste all of this → Run
-- Safe to run again: it only creates what is missing.
-- Records pieces stitched per day. It does NOT change stock.
-- ============================================================

create table if not exists daily_production (
  id text primary key,
  brand text not null default 'Loma',
  date date not null,
  product_id text,
  product_name text not null,
  type text,                      -- Top, Dress, Trousers, Shirt, Skirt, Co-ord Set, Other
  qty numeric not null default 0, -- pieces stitched
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists daily_production_date_idx on daily_production (date);

alter table daily_production enable row level security;

drop policy if exists "allow all daily_production" on daily_production;
create policy "allow all daily_production" on daily_production for all using (true) with check (true);
