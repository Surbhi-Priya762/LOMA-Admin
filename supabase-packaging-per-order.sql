-- ============================================================
-- Packaging per order — run this once in Supabase
-- Project → SQL Editor → New query → paste all of this → Run
-- Safe to run again.
-- ============================================================

-- Which brand's orders use this packaging item, and how many per order.
alter table packaging_materials add column if not exists used_for text;
alter table packaging_materials add column if not exists per_order numeric;

-- Remember whether a sale / outward used packaging, so Undo can put it back.
alter table sales_log add column if not exists packaging_used boolean;
alter table outward add column if not exists packaging_used boolean;

-- Every Loma order uses 1 of each of these:
update packaging_materials set used_for = 'Loma', per_order = 1
where name in ('Brown Thread Tagging', 'Butter Paper Loma', 'Loma Big Sticker', 'Loma Round Stickers', 'Small Brown Loma tag');
