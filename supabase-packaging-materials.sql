-- ============================================================
-- Packaging Materials — run this once in Supabase
-- Project → SQL Editor → New query → paste all of this → Run
-- Safe to run again: it only creates what is missing.
-- ============================================================

create table if not exists packaging_materials (
  id text primary key,
  brand text not null default 'Loma',
  name text not null,
  qty numeric,                 -- quantity in hand
  unit text,                   -- pcs, rolls, kg…
  reorder_level numeric,       -- optional: flag "Low" at or below this
  last_checked date,           -- the day someone last counted it
  vendor_name text,
  vendor_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table packaging_materials enable row level security;

drop policy if exists "allow all packaging_materials" on packaging_materials;
create policy "allow all packaging_materials" on packaging_materials for all using (true) with check (true);
