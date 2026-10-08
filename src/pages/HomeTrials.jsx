import { useEffect, useRef, useState } from 'react';
import { todayStr, uid, exportToExcel, rupee } from '../lib/calc';
import { saveHomeTrial, deleteHomeTrial, syncCalendly } from '../lib/api';
import { useUI } from '../context/UIContext';

// Home trials for Lõma. Bookings arrive from Calendly (synced by Netlify every 30 min,
// or with the Sync button); the team fills in everything after the booking here.

const STATUSES = ['Booked', 'Confirmed', 'Packed', 'Dispatched', 'Completed', 'No-show', 'Cancelled', 'Rescheduled'];
const CLOSED = ['Cancelled', 'Rescheduled'];
const TAG = {
  Booked: 'pending', Confirmed: 'progress', Packed: 'progress', Dispatched: 'progress',
  Completed: 'ok', 'No-show': 'reorder', Cancelled: '', Rescheduled: '',
};
const NEXT_STEP = {
  Booked: 'Confirm slot and styles on WhatsApp',
  Confirmed: 'Pick and wrap the pieces',
  Packed: 'Hand over to the delivery partner',
  Dispatched: 'Note what she kept once back',
};
const PAYMENT_MODES = ['UPI', 'Cash', 'Card', 'Bank transfer', 'Other'];
const SOURCES = ['Calendly', 'WhatsApp', 'Instagram', 'Phone call', 'Other'];
const SLOTS_PER_DAY = 4;

const EMPTY = {
  trial_date: '', trial_time: '', name: '', phone: '', email: '', address: '', pincode: '', size: '',
  styles_requested: '', status: 'Booked', pieces_sent: '', dispatched_by: '', pieces_kept: '', amount: '',
  payment_mode: '', pieces_returned: '', returned_checked: false, notes: '', source: 'WhatsApp',
};

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}
function prettyDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
// Sort key for "11:30 AM" style times.
function minutesOf(t) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t || '');
  if (!m) return 9999;
  let h = Number(m[1]) % 12;
  if ((m[3] || '').toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}
function waLink(t) {
  let digits = (t.phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  if (digits.length < 11) return null;
  const when = t.trial_date ? ` on ${prettyDate(t.trial_date)}${t.trial_time ? ' at ' + t.trial_time : ''}` : '';
  const msg = `Hi ${(t.name || '').split(' ')[0]}, this is Lōma. Thank you for booking your home trial${when}. Could you share the styles you would love to try and your size, so we can prepare your edit?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

export default function HomeTrials({ data, reload }) {
  const { toast, confirm } = useUI();
  const trials = (data.homeTrials || []).filter((t) => (t.brand || 'Loma') === 'Loma');
  const tableMissing = !!data.homeTrialsError;
  const today = todayStr();

  const [view, setView] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // trial being edited, or {} for a new one
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  async function runSync(silent = false) {
    setSyncing(true);
    try {
      const r = await syncCalendly();
      const msg = r.added || r.cancelled
        ? `${r.added} new booking${r.added === 1 ? '' : 's'}${r.cancelled ? `, ${r.cancelled} cancelled or moved` : ''}`
        : 'Up to date';
      setSyncNote(`Calendly synced just now · ${msg}`);
      if (!silent || r.added || r.cancelled) toast(`Calendly: ${msg}.`);
      if (r.added || r.cancelled) await reload();
    } catch (e) {
      setSyncNote('Calendly sync not working yet: ' + (e.message || String(e)));
      if (!silent) toast('Sync failed: ' + (e.message || String(e)));
    } finally {
      setSyncing(false);
    }
  }

  // Quietly check Calendly once when the page opens.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current || tableMissing) return;
    synced.current = true;
    runSync(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Numbers at the top ----
  const active = trials.filter((t) => !CLOSED.includes(t.status));
  const in7 = addDays(today, 7);
  const monthStart = today.slice(0, 8) + '01';
  const todays = active.filter((t) => t.trial_date === today);
  const next7 = active.filter((t) => t.trial_date >= today && t.trial_date <= in7);
  const toConfirm = active.filter((t) => t.status === 'Booked' && (t.trial_date || '9999') >= today);
  const doneMonth = trials.filter((t) => t.status === 'Completed' && (t.trial_date || '') >= monthStart);
  const bought = doneMonth.filter((t) => Number(t.amount) > 0);
  const revenue = doneMonth.reduce((a, t) => a + (Number(t.amount) || 0), 0);

  // ---- List ----
  const q = search.toLowerCase().trim();
  const listed = trials
    .filter((t) => {
      if (view === 'upcoming' && ((t.trial_date || '9999') < today || CLOSED.includes(t.status))) return false;
      if (view === 'past' && (t.trial_date || '9999') >= today) return false;
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (q && ![t.name, t.phone, t.pincode, t.address, t.email].some((v) => (v || '').toLowerCase().includes(q))) return false;
      return true;
    })
    .sort((a, b) => {
      const d = (a.trial_date || '').localeCompare(b.trial_date || '') || minutesOf(a.trial_time) - minutesOf(b.trial_time);
      return view === 'upcoming' ? d : -d;
    });

  const perDay = {};
  active.forEach((t) => { perDay[t.trial_date] = (perDay[t.trial_date] || 0) + 1; });

  function handleExport() {
    exportToExcel(
      listed,
      [
        { key: 'trial_date', label: 'Trial date' }, { key: 'trial_time', label: 'Time' },
        { key: 'name', label: 'Name' }, { key: 'phone', label: 'WhatsApp' }, { key: 'email', label: 'Email' },
        { key: 'address', label: 'Address' }, { key: 'pincode', label: 'Pincode' }, { key: 'size', label: 'Size' },
        { key: 'styles_requested', label: 'Styles requested' }, { key: 'status', label: 'Status' },
        { key: 'pieces_sent', label: 'Pieces sent' }, { key: 'dispatched_by', label: 'Dispatched by' },
        { key: 'pieces_kept', label: 'Pieces kept' }, { key: 'amount', label: 'Amount' },
        { key: 'payment_mode', label: 'Payment mode' }, { key: 'pieces_returned', label: 'Pieces returned' },
        { key: (t) => (t.returned_checked ? 'Yes' : ''), label: 'Returns checked' },
        { key: 'source', label: 'Source' }, { key: 'notes', label: 'Notes' },
      ],
      `loma-home-trials-${today}.csv`
    );
    toast('Home trials exported. Opens directly in Excel.');
  }

  let lastDate = null;

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Home Trials</h1>
          <div className="page-sub">Every home trial from booking to delivery, with what each customer kept</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={() => runSync(false)} disabled={syncing || tableMissing}>
            {syncing ? 'Syncing…' : '↻ Sync from Calendly'}
          </button>
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
          <button className="btn" onClick={() => setEditing({})} disabled={tableMissing}>+ Add trial</button>
        </div>
      </div>

      {tableMissing && (
        <div className="card" style={{ borderColor: 'var(--brass)', background: 'var(--brass-soft)', marginBottom: 16 }}>
          <p className="section-title">One setup step left</p>
          <div style={{ fontSize: 13.5 }}>
            The Home Trials table isn't in Supabase yet. In Supabase, open SQL Editor → New query, paste everything
            from <b>supabase-home-trials.sql</b>, click Run, then refresh this page.
          </div>
        </div>
      )}
      {syncNote && <div className="mini-note" style={{ marginBottom: 12 }}>{syncNote}</div>}

      <div className="grid-cards">
        <Stat label="Today" num={todays.length} sub={todays.length ? todays.map((t) => t.trial_time).filter(Boolean).join(', ') : 'No trials today'} strong={todays.length > 0} />
        <Stat label="Next 7 days" num={next7.length} sub={`Max ${SLOTS_PER_DAY} a day`} />
        <Stat label="To confirm on WhatsApp" num={toConfirm.length} sub={toConfirm.length ? 'Booked, not yet confirmed' : 'All confirmed'} />
        <Stat label="Completed this month" num={doneMonth.length} sub={doneMonth.length ? `${bought.length} bought something` : '—'} />
        <Stat label="Sales from trials this month" num={rupee(revenue)} sub={bought.length ? `Avg ${rupee(revenue / bought.length)} per buyer` : '—'} />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div className="seg" role="group" aria-label="Which trials">
          {[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']].map(([id, label]) => (
            <button key={id} className={`seg-btn ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
        <input className="search-input" placeholder="Search name, phone, pincode…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', maxWidth: 300 }} />
      </div>

      <div className="tabs-row">
        {['All', ...STATUSES].map((s) => (
          <div key={s} className={`pill ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s === 'All' ? 'All statuses' : s}
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Time</th><th>Customer</th><th>WhatsApp</th><th>Size</th><th>Styles</th><th>Status</th><th>Kept</th><th className="num">Amount</th><th></th></tr>
          </thead>
          <tbody>
            {listed.length === 0 ? (
              <tr><td colSpan={9} className="empty">
                {trials.length === 0 ? 'No home trials yet. New Calendly bookings will appear here.' : 'No trials match these filters.'}
              </td></tr>
            ) : (
              listed.flatMap((t) => {
                const rows = [];
                if (t.trial_date !== lastDate) {
                  lastDate = t.trial_date;
                  const n = perDay[t.trial_date] || 0;
                  rows.push(
                    <tr key={'d-' + t.trial_date + t.id}>
                      <td colSpan={9} style={{ background: 'var(--panel-2)', fontWeight: 700, fontSize: 13 }}>
                        {t.trial_date === today ? 'Today · ' : ''}{prettyDate(t.trial_date)}
                        {view === 'upcoming' && (
                          <span className={`tag ${n >= SLOTS_PER_DAY ? 'reorder' : ''}`} style={{ marginLeft: 8 }}>
                            {n} of {SLOTS_PER_DAY} slots
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                }
                const wa = waLink(t);
                rows.push(
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(t)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.trial_time || '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div className="mini-note">{[t.pincode, t.source !== 'Calendly' ? t.source : ''].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      {wa ? <a className="link-btn" href={wa} target="_blank" rel="noopener noreferrer">{t.phone}</a> : (t.phone || '—')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.size || '—'}</td>
                    <td style={{ minWidth: 160, maxWidth: 240 }}>{t.styles_requested || <span className="muted">Ask on WhatsApp</span>}</td>
                    <td>
                      <span className={`tag ${TAG[t.status] || ''}`}>{t.status}</span>
                      {NEXT_STEP[t.status] && !CLOSED.includes(t.status) && <div className="mini-note">{NEXT_STEP[t.status]}</div>}
                    </td>
                    <td>{t.pieces_kept || '—'}</td>
                    <td className="num">{t.amount ? rupee(t.amount) : '—'}</td>
                    <td><button className="btn secondary small" onClick={(e) => { e.stopPropagation(); setEditing(t); }}>Open</button></td>
                  </tr>
                );
                return rows;
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <TrialModal
          trial={editing}
          onClose={() => setEditing(null)}
          onSave={async (entry) => {
            await saveHomeTrial(entry);
            toast(editing.id ? 'Trial updated.' : 'Trial added.');
            setEditing(null);
            reload();
          }}
          onDelete={async (entry) => {
            const ok = await confirm(`Delete the home trial for "${entry.name}"?\nTip: for a cancelled booking, set the status to Cancelled instead so it stays on record.`, 'Delete');
            if (!ok) return;
            await deleteHomeTrial(entry.id);
            toast('Trial deleted.');
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, num, sub, strong }) {
  return (
    <div className={`stat-card ${strong ? 'strong' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-num">{num}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function TrialModal({ trial, onClose, onSave, onDelete }) {
  const isNew = !trial.id;
  const [f, setF] = useState(() => ({ ...EMPTY, ...trial, amount: trial.amount ?? '' }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const fromCalendly = f.source === 'Calendly' && !isNew;

  async function handleSave() {
    if (!f.name.trim()) { setErr('Enter the customer name.'); return; }
    setSaving(true);
    try {
      const entry = {
        ...f,
        id: f.id || uid('trial'),
        brand: 'Loma',
        name: f.name.trim(),
        trial_date: f.trial_date || null,
        amount: f.amount === '' || f.amount == null ? null : Number(f.amount),
      };
      delete entry.created_at;
      await onSave(entry);
    } finally {
      setSaving(false);
    }
  }
  const field = (label, k, props = {}) => (
    <div className="field" style={props.wide ? { flex: 1.6 } : undefined}>
      <label>{label}</label>
      <input value={f[k] ?? ''} onChange={set(k)} placeholder={props.placeholder} type={props.type || 'text'} inputMode={props.inputMode} />
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <div className="modal-title">{isNew ? 'Add a home trial' : `Home trial · ${trial.name}`}</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p className="section-title">Booking{fromCalendly ? ' (from Calendly)' : ''}</p>
          <div className="field-row">
            <div className="field"><label>Trial date</label><input type="date" value={f.trial_date || ''} onChange={set('trial_date')} /></div>
            {field('Time', 'trial_time', { placeholder: 'e.g. 11:30 AM' })}
            <div className="field">
              <label>Status</label>
              <select value={f.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            {!fromCalendly && (
              <div className="field">
                <label>Booked via</label>
                <select value={f.source} onChange={set('source')}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
              </div>
            )}
          </div>
          <div className="field-row">
            {field('Name', 'name')}
            {field('WhatsApp number', 'phone', { inputMode: 'tel' })}
            {field('Email', 'email', { type: 'email' })}
          </div>
          <div className="field-row">
            {field('Address', 'address', { wide: true })}
            {field('Pincode', 'pincode', { inputMode: 'numeric' })}
            {field('Size', 'size', { placeholder: 'e.g. M, Petite S' })}
          </div>
          <div className="field">
            <label>Styles requested</label>
            <textarea rows={2} value={f.styles_requested || ''} onChange={set('styles_requested')} placeholder="Style names or product links she'd love to try" />
          </div>

          <p className="section-title" style={{ marginTop: 18 }}>Dispatch</p>
          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <label>Pieces sent</label>
              <input value={f.pieces_sent || ''} onChange={set('pieces_sent')} placeholder="SKUs, e.g. LOM-COCOA-W-BRN-M, LOM-…" />
            </div>
            {field('Dispatched by', 'dispatched_by', { placeholder: 'Delivery partner name' })}
          </div>

          <p className="section-title" style={{ marginTop: 18 }}>After the trial</p>
          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <label>Pieces kept</label>
              <input value={f.pieces_kept || ''} onChange={set('pieces_kept')} placeholder="SKUs she bought" />
            </div>
            {field('Amount paid (Rs.)', 'amount', { type: 'number', inputMode: 'decimal' })}
            <div className="field">
              <label>Payment mode</label>
              <select value={f.payment_mode || ''} onChange={set('payment_mode')}>
                <option value="">—</option>
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <label>Pieces returned</label>
              <input value={f.pieces_returned || ''} onChange={set('pieces_returned')} placeholder="SKUs that came back to the studio" />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', marginTop: 22 }}>
                <input type="checkbox" checked={!!f.returned_checked} onChange={set('returned_checked')} style={{ width: 'auto' }} />
                Returns checked and back in stock
              </label>
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <input value={f.notes || ''} onChange={set('notes')} placeholder="e.g. loved the linen, wants the dress in navy when it's back" />
          </div>
          {Number(f.amount) > 0 && (
            <div className="mini-note">Remember to also log this sale on the Sales page so stock and reports stay right.</div>
          )}
          {err && <div style={{ color: 'var(--rust)', fontSize: 12.5, marginTop: 8 }}>{err}</div>}
        </div>
        <div className="modal-foot">
          <div>{!isNew && <button className="btn danger small" onClick={() => onDelete(trial)}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Add trial' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
