-- ============================================================
-- Lõma Home Trials — run this once in Supabase
-- Project → SQL Editor → New query → paste all of this → Run
-- Safe to run again: it only creates what is missing.
-- ============================================================

create table if not exists home_trials (
  id text primary key,
  brand text not null default 'Loma',
  source text not null default 'Calendly',      -- Calendly / WhatsApp / Manual
  calendly_uri text unique,                     -- filled by the Calendly sync, empty for manual entries
  booked_at timestamptz,

  -- Booking (filled from Calendly, editable)
  trial_date date,
  trial_time text,
  name text not null,
  phone text,
  email text,
  address text,
  pincode text,
  size text,
  styles_requested text,

  -- Fulfilment (filled by the team)
  status text not null default 'Booked',        -- Booked, Confirmed, Packed, Dispatched, Completed, No-show, Cancelled, Rescheduled
  pieces_sent text,
  dispatched_by text,
  pieces_kept text,
  amount numeric,
  payment_mode text,
  pieces_returned text,
  returned_checked boolean not null default false,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_trials_trial_date_idx on home_trials (trial_date);

alter table home_trials enable row level security;

drop policy if exists "allow all home_trials" on home_trials;
create policy "allow all home_trials" on home_trials for all using (true) with check (true);
