-- Master cost (Rs./piece) on every product — adds into production cost.
-- Safe to run more than once. (Already applied on the live database.)
alter table products add column if not exists master_cost numeric;
