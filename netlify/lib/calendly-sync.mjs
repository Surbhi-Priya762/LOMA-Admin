// Pulls home-trial bookings from Calendly and saves them into Supabase (home_trials).
// Runs on Netlify only, so the Calendly token never reaches the browser.
//
// Netlify environment variables used:
//   CALENDLY_TOKEN          personal access token from the Lõma Calendly account (required)
//   CALENDLY_EVENT_MATCH    optional: only sync events whose name contains this text (default "trial")
//   VITE_SUPABASE_URL       already set for the app
//   VITE_SUPABASE_ANON_KEY  already set for the app

import { createClient } from '@supabase/supabase-js';

const API = 'https://api.calendly.com';
const TZ = 'Asia/Kolkata';
// Rows the team has already moved past "Booked/Confirmed/Packed" are never changed by a sync.
const CANCELLABLE = ['Booked', 'Confirmed', 'Packed'];

async function calendly(url, token, fetchImpl) {
  const res = await fetchImpl(url.startsWith('http') ? url : API + url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const hint = res.status === 401 ? ' (check CALENDLY_TOKEN in Netlify)' : '';
    throw new Error(`Calendly ${res.status}${hint}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function collectAll(firstUrl, token, fetchImpl) {
  const out = [];
  let url = firstUrl;
  while (url) {
    const page = await calendly(url, token, fetchImpl);
    out.push(...(page.collection || []));
    url = page.pagination?.next_page || null;
  }
  return out;
}

// Match Calendly's booking questions by keyword, so renaming a question slightly doesn't break the sync.
function answersFrom(qa = []) {
  const pick = (re) => (qa.find((q) => re.test(q.question || ''))?.answer || '').trim();
  return {
    phone: pick(/whats\s*app|phone|mobile|contact\s*(no|number)/i),
    address: pick(/address/i),
    pincode: pick(/pin\s*code|pincode|postal|zip/i),
    size: pick(/size/i),
    styles: pick(/style|product|link|piece|what would you like/i),
  };
}

function istDate(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
function istTime(iso) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(iso))
    .toUpperCase();
}

// Turn one Calendly event + invitee into a home_trials row.
export function toRow(event, invitee) {
  const a = answersFrom(invitee.questions_and_answers);
  const pin = a.pincode || (a.address.match(/\b5\d{5}\b/) || [])[0] || '';
  let status = 'Booked';
  let notes = '';
  if (invitee.status === 'canceled' || event.status === 'canceled') {
    status = invitee.rescheduled ? 'Rescheduled' : 'Cancelled';
    notes = invitee.rescheduled ? 'Moved to a new slot on Calendly' : (invitee.cancellation?.reason ? `Cancelled: ${invitee.cancellation.reason}` : '');
  }
  return {
    id: 'trial-' + invitee.uri.split('/').pop().slice(0, 12),
    brand: 'Loma',
    source: 'Calendly',
    calendly_uri: invitee.uri,
    booked_at: invitee.created_at,
    trial_date: istDate(event.start_time),
    trial_time: istTime(event.start_time),
    name: (invitee.name || 'Unknown').trim(),
    phone: a.phone || invitee.text_reminder_number || '',
    email: invitee.email || '',
    address: a.address,
    pincode: pin,
    size: a.size,
    styles_requested: a.styles,
    status,
    notes,
  };
}

export async function runSync({ env = process.env, fetchImpl = fetch, supabase } = {}) {
  const token = env.CALENDLY_TOKEN;
  if (!token) throw new Error('CALENDLY_TOKEN is not set in Netlify environment variables.');
  const match = (env.CALENDLY_EVENT_MATCH || 'trial').toLowerCase();

  const db = supabase || createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  const me = await calendly('/users/me', token, fetchImpl);
  const user = me.resource.uri;

  // Bookings with a trial date from 60 days ago to 120 days ahead.
  const min = new Date(Date.now() - 60 * 864e5).toISOString();
  const max = new Date(Date.now() + 120 * 864e5).toISOString();
  const qs = new URLSearchParams({ user, min_start_time: min, max_start_time: max, count: '100', sort: 'start_time:asc' });
  const events = (await collectAll(`/scheduled_events?${qs}`, token, fetchImpl))
    .filter((e) => (e.name || '').toLowerCase().includes(match));

  const rows = [];
  for (const ev of events) {
    const invitees = await collectAll(`${ev.uri}/invitees?count=100`, token, fetchImpl);
    invitees.forEach((inv) => rows.push(toRow(ev, inv)));
  }
  if (rows.length === 0) return { checked: 0, added: 0, cancelled: 0 };

  const { data: existing, error: readErr } = await db
    .from('home_trials')
    .select('calendly_uri,status')
    .in('calendly_uri', rows.map((r) => r.calendly_uri));
  if (readErr) throw new Error('Supabase: ' + readErr.message + ' (has supabase-home-trials.sql been run?)');
  const known = new Map((existing || []).map((r) => [r.calendly_uri, r.status]));

  // New bookings: insert. Existing ones keep everything the team has typed in.
  const fresh = rows.filter((r) => !known.has(r.calendly_uri));
  if (fresh.length) {
    const { error } = await db.from('home_trials').upsert(fresh, { onConflict: 'calendly_uri', ignoreDuplicates: true });
    if (error) throw new Error('Supabase: ' + error.message);
  }

  // Cancelled or rescheduled on Calendly after we saved them: update the status only.
  let cancelled = 0;
  for (const r of rows) {
    const current = known.get(r.calendly_uri);
    if (current && CANCELLABLE.includes(current) && (r.status === 'Cancelled' || r.status === 'Rescheduled')) {
      const { error } = await db
        .from('home_trials')
        .update({ status: r.status, updated_at: new Date().toISOString() })
        .eq('calendly_uri', r.calendly_uri);
      if (error) throw new Error('Supabase: ' + error.message);
      cancelled++;
    }
  }

  return { checked: rows.length, added: fresh.length, cancelled };
}
