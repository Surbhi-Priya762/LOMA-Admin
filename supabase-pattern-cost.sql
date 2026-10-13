-- Sauca "Pattern cost (Rs./piece)" — adds into production cost.
-- Safe to run more than once. (Already applied on the live database.)
alter table products add column if not exists pattern_cost numeric;
