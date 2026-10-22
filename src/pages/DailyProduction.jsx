import { useMemo, useState } from 'react';
import { todayStr, uid, exportToExcel, filterByBrand, inDateRange, rangeForPreset, rangeLabel } from '../lib/calc';
import { saveDailyProduction, deleteDailyProduction } from '../lib/api';
import { useUI } from '../context/UIContext';
import DateFilter from '../components/DateFilter';

// Daily Production: pieces stitched per day, by product and type.
// Record-keeping only — it never changes stock.

const TYPES = ['Top', 'Dress', 'Trousers', 'Shirt', 'Skirt', 'Co-ord Set', 'Other'];
const OTHER_PRODUCT = '__other';

// Products use mixed spellings ("top", "Top", "pant", "Culottes & Trousers") — fold them into one list.
function normaliseType(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (!t) return 'Other';
  if (t.includes('co-ord') || t.includes('coord') || t === 'set') return 'Co-ord Set';
  if (t.includes('dress')) return 'Dress';
  if (t.includes('shirt')) return 'Shirt';
  if (t.includes('skirt')) return 'Skirt';
  if (t.includes('top') || t.includes('tunic')) return 'Top';
  if (t.includes('trouser') || t.includes('pant') || t.includes('culotte')) return 'Trousers';
  return 'Other';
}

function totalsByType(rows) {
  const out = {};
  rows.forEach((r) => {
    const t = r.type || 'Other';
    out[t] = (out[t] || 0) + (Number(r.qty) || 0);
  });
  return TYPES.filter((t) => out[t]).map((t) => ({ type: t, qty: out[t] }));
}

function prettyDate(d) {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function TypeChips({ rows }) {
  const totals = totalsByType(rows);
  const all = rows.reduce((a, r) => a + (Number(r.qty) || 0), 0);
  return (
    <div className="grid-cards">
      <div className="stat-card"><div className="stat-num">{all}</div><div className="stat-label">Total pieces</div></div>
      {totals.map((t) => (
        <div className="stat-card" key={t.type}><div className="stat-num">{t.qty}</div><div className="stat-label">{t.type}</div></div>
      ))}
    </div>
  );
}

export default function DailyProduction({ data, reload, brand }) {
  const { toast, confirm } = useUI();
  const products = filterByBrand(data.products, brand);
  const entries = filterByBrand(data.dailyProduction, brand);
  const tableMissing = Boolean(data.dailyProductionError);

  const [editId, setEditId] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [productId, setProductId] = useState('');
  const [otherName, setOtherName] = useState('');
  const [type, setType] = useState('');
  const [qty, setQty] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const [day, setDay] = useState(todayStr());
  const [range, setRange] = useState(() => rangeForPreset('this-month'));
  const [search, setSearch] = useState('');

  const sortedProducts = useMemo(() => [...products].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [products]);

  function pickProduct(id) {
    setProductId(id);
    if (id && id !== OTHER_PRODUCT) {
      const p = products.find((x) => x.id === id);
      setType(normaliseType(p?.type));
    }
  }

  function resetForm() {
    setEditId(null);
    setProductId('');
    setOtherName('');
    setType('');
    setQty('');
    setRemarks('');
  }

  async function handleSave() {
    const isOther = productId === OTHER_PRODUCT;
    const product = isOther ? null : products.find((p) => p.id === productId);
    const name = isOther ? otherName.trim() : product?.name;
    if (!name) { toast(isOther ? 'Type the product name.' : 'Pick a product.'); return; }
    if (!type) { toast('Pick a type (Top, Dress…).'); return; }
    const n = Number(qty);
    if (!n || n <= 0) { toast('Enter how many pieces were stitched.'); return; }
    if (!date) { toast('Pick a date.'); return; }

    const existing = editId ? entries.find((e) => e.id === editId) : null;
    const entry = {
      ...(existing || {}),
      id: editId || uid('dprod'),
      brand,
      date,
      product_id: product ? product.id : null,
      product_name: name,
      type,
      qty: n,
      remarks: remarks.trim() || null,
    };
    setSaving(true);
    try {
      await saveDailyProduction(entry);
      toast(editId ? 'Entry updated.' : `Added ${n} × ${name} for ${prettyDate(date)}.`);
      setDay(date);
      resetForm();
      reload();
    } catch (err) {
      toast(`Couldn't save: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(e) {
    setEditId(e.id);
    setDate(e.date);
    const known = e.product_id && products.find((p) => p.id === e.product_id);
    if (known) { setProductId(e.product_id); setOtherName(''); } else { setProductId(OTHER_PRODUCT); setOtherName(e.product_name || ''); }
    setType(e.type || 'Other');
    setQty(String(e.qty ?? ''));
    setRemarks(e.remarks || '');
    document.getElementById('add-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleDelete(e) {
    const ok = await confirm(`Delete this entry?\n\n${e.qty} × ${e.product_name} · ${prettyDate(e.date)}`, 'Delete');
    if (!ok) return;
    await deleteDailyProduction(e.id);
    if (editId === e.id) resetForm();
    toast('Entry deleted.');
    reload();
  }

  const dayRows = entries.filter((e) => e.date === day);

  const q = search.trim().toLowerCase();
  const rangeRows = entries
    .filter((e) => inDateRange(e.date, range))
    .filter((e) => !q || (e.product_name || '').toLowerCase().includes(q) || (e.type || '').toLowerCase().includes(q) || (e.remarks || '').toLowerCase().includes(q))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''));

  const allMonths = useMemo(() => {
    const set = new Set(entries.map((e) => (e.date || '').slice(0, 7)).filter(Boolean));
    return [...set].sort().reverse();
  }, [entries]);

  function handleExport() {
    exportToExcel(
      rangeRows,
      [
        { key: 'date', label: 'Date' },
        { key: 'product_name', label: 'Product' },
        { key: 'type', label: 'Type' },
        { key: 'qty', label: 'Pieces stitched' },
        { key: 'remarks', label: 'Remarks' },
      ],
      `${brand.toLowerCase()}-daily-production-${rangeLabel(range)}.csv`
    );
  }

  if (tableMissing) {
    return (
      <div>
        <h1 className="page-title">Daily Production</h1>
        <div className="card" style={{ borderColor: 'var(--rust)', marginTop: 12 }}>
          <p className="section-title">One-time setup needed</p>
          <p style={{ fontSize: 13 }}>
            The Daily Production table isn't in Supabase yet. Open Supabase → SQL Editor → New query, paste the contents of
            <code> supabase-daily-production.sql</code> from the loma-admin repo, click Run, then refresh this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Daily Production — {brand}</h1>
          <div className="page-sub">Pieces stitched each day, by product and type. For records only — this does not add to stock.</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="card add-form" id="add-form" style={{ marginBottom: 20 }}>
        <p className="section-title">{editId ? 'Edit entry' : 'Add stitched pieces'}</p>
        <div className="field-row">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field" style={{ flex: 2 }}>
            <label>Product</label>
            <select value={productId} onChange={(e) => pickProduct(e.target.value)}>
              <option value="">Select…</option>
              {sortedProducts.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
              <option value={OTHER_PRODUCT}>Not in the list — type a name</option>
            </select>
          </div>
          {productId === OTHER_PRODUCT && (
            <div className="field" style={{ flex: 1.5 }}>
              <label>Product name</label>
              <input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. Sample linen dress" />
            </div>
          )}
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">—</option>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Pieces stitched</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} placeholder="e.g. 4" />
          </div>
        </div>
        <div className="field">
          <label>Remarks (optional)</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Tailor name, sizes done" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save changes' : '+ Add'}</button>
          {editId && <button className="btn secondary" onClick={resetForm}>Cancel edit</button>}
        </div>
        <div className="mini-note" style={{ marginTop: 6 }}>Type is filled in from the product — change it if needed. The date stays set, so you can add several products for the same day one after another.</div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <p className="section-title" style={{ margin: 0 }}>Stitched on {prettyDate(day)}</p>
          <div className="field" style={{ margin: 0 }}>
            <label>Show day</label>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
        </div>
        {dayRows.length === 0 ? (
          <div className="empty">Nothing logged for this day yet.</div>
        ) : (
          <>
            <TypeChips rows={dayRows} />
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="data-table">
                <thead><tr><th>Product</th><th>Type</th><th>Pieces</th><th>Remarks</th></tr></thead>
                <tbody>
                  {dayRows.map((e) => (
                    <tr key={e.id}><td>{e.product_name}</td><td>{e.type}</td><td>{e.qty}</td><td>{e.remarks}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="section-title">All entries</p>
      <DateFilter value={range} onChange={setRange} months={allMonths} />
      <input className="search-input" placeholder="Search product, type or remarks…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ margin: '12px 0', width: '100%', maxWidth: 340 }} />
      {rangeRows.length > 0 && <div style={{ marginBottom: 12 }}><TypeChips rows={rangeRows} /></div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Pieces</th><th>Remarks</th><th></th></tr></thead>
          <tbody>
            {rangeRows.length === 0 ? (
              <tr><td colSpan={6} className="empty">No entries for this period.</td></tr>
            ) : (
              rangeRows.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td><td>{e.product_name}</td><td>{e.type}</td><td>{e.qty}</td><td>{e.remarks}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn secondary small" onClick={() => startEdit(e)}>Edit</button>{' '}
                    <button className="btn danger small" onClick={() => handleDelete(e)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
