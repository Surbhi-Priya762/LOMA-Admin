import { useState } from 'react';
import { todayStr, uid, exportToExcel, filterByBrand } from '../lib/calc';
import { savePackaging, deletePackaging } from '../lib/api';
import { useUI } from '../context/UIContext';
import { packagingReady } from '../lib/packaging';
import { BRANDS } from '../lib/calc';

// Packaging Materials: what's in hand, when it was last counted, and which
// vendor to call when it runs out. Separate from raw materials and stock.

function prettyDate(d) {
  if (!d) return '—';
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysAgo(d) {
  if (!d) return null;
  const then = new Date(`${d}T00:00:00`);
  const now = new Date(`${todayStr()}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.round((now - then) / 86400000);
}

function status(item) {
  if (item.qty == null || item.qty === '') return null;
  const q = Number(item.qty);
  if (q <= 0) return 'out';
  if (item.reorder_level != null && item.reorder_level !== '' && q <= Number(item.reorder_level)) return 'low';
  return 'ok';
}

// "98450 12345" / "+91-98450-12345" -> "919845012345" for a WhatsApp link.
function waNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

const blank = { name: '', qty: '', unit: '', reorder_level: '', last_checked: '', vendor_name: '', vendor_phone: '', notes: '', used_for: '', per_order: '' };

export default function Packaging({ data, reload, brand }) {
  const { toast, confirm } = useUI();
  const items = filterByBrand(data.packaging, brand);
  const tableMissing = Boolean(data.packagingError);
  const perOrderReady = packagingReady(data);

  const [draft, setDraft] = useState({ ...blank, last_checked: todayStr() });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  function resetForm() {
    setEditId(null);
    setDraft({ ...blank, last_checked: todayStr() });
  }

  const num = (v) => (v === '' || v == null ? null : Number(v));

  async function handleSave() {
    if (!draft.name.trim()) { toast('Enter the packaging material name.'); return; }
    const existing = editId ? items.find((i) => i.id === editId) : null;
    const item = {
      ...(existing || {}),
      id: editId || uid('pack'),
      brand,
      name: draft.name.trim(),
      qty: num(draft.qty),
      unit: draft.unit.trim() || null,
      reorder_level: num(draft.reorder_level),
      last_checked: draft.last_checked || null,
      vendor_name: draft.vendor_name.trim() || null,
      vendor_phone: draft.vendor_phone.trim() || null,
      notes: draft.notes.trim() || null,
      ...(perOrderReady ? { used_for: draft.used_for || null, per_order: draft.used_for ? (num(draft.per_order) ?? 1) : null } : {}),
    };
    setSaving(true);
    try {
      await savePackaging(item);
      toast(editId ? 'Packaging material updated.' : `Added "${item.name}".`);
      resetForm();
      reload();
    } catch (err) {
      toast(`Couldn't save: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(i) {
    setEditId(i.id);
    setDraft({
      name: i.name || '', qty: i.qty ?? '', unit: i.unit || '', reorder_level: i.reorder_level ?? '',
      last_checked: i.last_checked || '', vendor_name: i.vendor_name || '', vendor_phone: i.vendor_phone || '', notes: i.notes || '',
      used_for: i.used_for || '', per_order: i.per_order ?? '',
    });
    document.getElementById('add-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Changing the count in the table also marks it as checked today.
  async function updateQty(i, value) {
    const q = num(value);
    if (q === (i.qty == null ? null : Number(i.qty))) return;
    await savePackaging({ ...i, qty: q, last_checked: todayStr() });
    toast(`${i.name}: ${q ?? '—'} ${i.unit || ''} · checked today`);
    reload();
  }

  async function markChecked(i) {
    await savePackaging({ ...i, last_checked: todayStr() });
    toast(`${i.name} marked as checked today.`);
    reload();
  }

  async function handleDelete(i) {
    const ok = await confirm(`Delete "${i.name}"?\n\nThis cannot be undone.`, 'Delete');
    if (!ok) return;
    await deletePackaging(i.id);
    if (editId === i.id) resetForm();
    toast('Deleted.');
    reload();
  }

  const q = search.trim().toLowerCase();
  const list = items
    .filter((i) => !q || [i.name, i.vendor_name, i.vendor_phone, i.notes, i.unit].some((v) => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => {
      const rank = { out: 0, low: 1, ok: 2 };
      return (rank[status(a)] ?? 3) - (rank[status(b)] ?? 3) || (a.name || '').localeCompare(b.name || '');
    });

  const outCount = items.filter((i) => status(i) === 'out').length;
  const lowCount = items.filter((i) => status(i) === 'low').length;
  const checkedToday = items.filter((i) => i.last_checked === todayStr()).length;

  function handleExport() {
    exportToExcel(
      list,
      [
        { key: 'name', label: 'Packaging material' },
        { key: 'qty', label: 'Quantity' },
        { key: 'unit', label: 'Unit' },
        { key: 'reorder_level', label: 'Reorder at' },
        { key: 'last_checked', label: 'Last checked' },
        { key: 'vendor_name', label: 'Vendor' },
        { key: 'vendor_phone', label: 'Vendor contact' },
        { key: 'used_for', label: 'Used per order (brand)' },
        { key: 'per_order', label: 'Per order' },
        { key: 'notes', label: 'Notes' },
      ],
      `${brand.toLowerCase()}-packaging-materials-${todayStr()}.csv`
    );
  }

  if (tableMissing) {
    return (
      <div>
        <h1 className="page-title">Packaging Materials</h1>
        <div className="card" style={{ borderColor: 'var(--rust)', marginTop: 12 }}>
          <p className="section-title">One-time setup needed</p>
          <p style={{ fontSize: 13 }}>
            The Packaging Materials table isn't in Supabase yet. Open Supabase → SQL Editor → New query, paste the contents of
            <code> supabase-packaging-materials.sql</code> from the loma-admin repo, click Run, then refresh this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Packaging Materials — {brand}</h1>
          <div className="page-sub">What's in hand, when it was last checked, and who to call when it runs out</div>
        </div>
        <div className="toolbar">
          <input className="search-input" placeholder="Search name, vendor, number…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="grid-cards">
        <div className="stat-card"><div className="stat-num">{items.length}</div><div className="stat-label">Packaging items</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: outCount ? 'var(--rust)' : undefined }}>{outCount}</div><div className="stat-label">Out of stock</div></div>
        <div className="stat-card"><div className="stat-num">{lowCount}</div><div className="stat-label">Running low</div></div>
        <div className="stat-card"><div className="stat-num">{checkedToday}</div><div className="stat-label">Checked today</div></div>
      </div>

      <div className="card add-form" id="add-form" style={{ margin: '18px 0 20px' }}>
        <p className="section-title">{editId ? 'Edit packaging material' : 'Add packaging material'}</p>
        <div className="field-row">
          <div className="field" style={{ flex: 2 }}><label>Name</label><input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Brown paper bag (large)" /></div>
          <div className="field"><label>Quantity</label><input type="number" step="any" value={draft.qty} onChange={(e) => set('qty', e.target.value)} placeholder="e.g. 250" /></div>
          <div className="field"><label>Unit</label><input value={draft.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pcs, rolls, kg" /></div>
          <div className="field"><label>Checked on</label><input type="date" value={draft.last_checked} onChange={(e) => set('last_checked', e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Vendor name</label><input value={draft.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} placeholder="Who to order from" /></div>
          <div className="field"><label>Vendor contact number</label><input type="tel" value={draft.vendor_phone} onChange={(e) => set('vendor_phone', e.target.value)} placeholder="e.g. 98450 12345" /></div>
          <div className="field"><label>Reorder at (optional)</label><input type="number" step="any" value={draft.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} placeholder="Shows Low at/below this" /></div>
        </div>
        {perOrderReady && (
          <div className="field-row">
            <div className="field">
              <label>Used when packing an order</label>
              <select value={draft.used_for} onChange={(e) => set('used_for', e.target.value)}>
                <option value="">Not used per order</option>
                {BRANDS.map((b) => <option key={b} value={b}>Every {b} order</option>)}
              </select>
            </div>
            {draft.used_for && (
              <div className="field"><label>How many per order</label><input type="number" step="any" min="0" value={draft.per_order} onChange={(e) => set('per_order', e.target.value)} placeholder="1" /></div>
            )}
          </div>
        )}
        <div className="field"><label>Notes (optional)</label><input value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. Size 12×16, min order 500" /></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save changes' : '+ Add'}</button>
          {editId && <button className="btn secondary" onClick={resetForm}>Cancel edit</button>}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">{items.length === 0 ? 'No packaging materials yet — add the first one above.' : 'Nothing matches your search.'}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Quantity</th><th>Status</th><th>Last checked</th><th>Vendor</th><th>Contact</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const st = status(i);
                const ago = daysAgo(i.last_checked);
                return (
                  <tr key={i.id}>
                    <td>
                      {i.name}
                      {i.used_for && <div className="mini-note" style={{ color: 'var(--brass)' }}>📦 {Number(i.per_order ?? 1)} per {i.used_for} order</div>}
                      {i.notes && <div className="mini-note">{i.notes}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <input type="number" step="any" defaultValue={i.qty ?? ''} key={`${i.id}-${i.qty}`}
                        style={{ width: 80, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                        onBlur={(e) => updateQty(i, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                      {i.unit ? ` ${i.unit}` : ''}
                    </td>
                    <td>
                      {st === 'out' && <span className="tag reorder">Out — order now</span>}
                      {st === 'low' && <span className="tag reorder">Low</span>}
                      {st === 'ok' && <span className="tag ok">OK</span>}
                      {st == null && '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {prettyDate(i.last_checked)}
                      {ago != null && <div className="mini-note">{ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}</div>}
                    </td>
                    <td>{i.vendor_name || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {i.vendor_phone ? (
                        <>
                          <a href={`tel:${i.vendor_phone.replace(/\s/g, '')}`}>{i.vendor_phone}</a>
                          <div className="mini-note"><a href={`https://wa.me/${waNumber(i.vendor_phone)}`} target="_blank" rel="noreferrer">WhatsApp</a></div>
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {i.last_checked !== todayStr() && <><button className="btn secondary small" onClick={() => markChecked(i)}>✓ Checked today</button>{' '}</>}
                      <button className="btn secondary small" onClick={() => startEdit(i)}>Edit</button>{' '}
                      <button className="btn danger small" onClick={() => handleDelete(i)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mini-note" style={{ marginTop: 8 }}>
        Changing a quantity in the table saves it and marks the item as checked today. Items marked 📦 go down automatically when a sale or outward is logged with "Packed" ticked. Tap a number to call, or WhatsApp to message the vendor.
      </div>
    </div>
  );
}
