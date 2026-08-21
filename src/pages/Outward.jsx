import { useState } from 'react';
import { SIZES, todayStr, uid, exportToExcel } from '../lib/calc';
import { addOutward, deleteOutward, saveProduct } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function Outward({ data, reload }) {
  const { toast } = useUI();
  const { products, outward } = data;
  const [date, setDate] = useState(todayStr());
  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [personName, setPersonName] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  const q = search.toLowerCase();
  const filtered = (outward || []).filter((o) => !q || (o.product_name || '').toLowerCase().includes(q) || (o.person_name || '').toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totalUnits = filtered.reduce((a, o) => a + (Number(o.qty) || 0), 0);

  function handleExport() {
    exportToExcel(
      sorted,
      [
        { key: 'date', label: 'Date' },
        { key: 'product_name', label: 'Product' },
        { key: 'size', label: 'Size' },
        { key: 'qty', label: 'Qty' },
        { key: 'person_name', label: 'Person' },
        { key: 'notes', label: 'Notes' },
      ],
      `loma-outward-${todayStr()}.csv`
    );
  }

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const qn = Number(qty) || 0;
    if (qn <= 0) { toast('Enter a quantity.'); return; }
    if (!personName.trim()) { toast("Enter who this went to."); return; }

    const entry = {
      id: uid('out'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: qn, person_name: personName.trim(), notes: notes.trim(),
    };
    await addOutward(entry);

    const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: Math.max(0, (Number(s.stock) || 0) - qn) } : s)) };
    delete updated.updated_at;
    await saveProduct(updated);

    toast(`Logged ${qn} × ${selectedProduct.name} (${size}) to ${personName.trim()}.`);
    setPersonName(''); setNotes('');
    reload();
  }

  async function handleUndo(entry) {
    const p = products.find((x) => x.id === entry.product_id || x.name === entry.product_name);
    if (p) {
      const updated = { ...p, sizes: p.sizes.map((s) => (s.size === entry.size ? { ...s, stock: (Number(s.stock) || 0) + Number(entry.qty) } : s)) };
      delete updated.updated_at;
      await saveProduct(updated);
    }
    await deleteOutward(entry.id);
    toast('Entry undone, stock restored.');
    reload();
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Outward</h1>
          <div className="page-sub">Pieces sent out for marketing, gifting, or influencers — reduces stock automatically, but is never counted as a sale</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
        <div className="stat-card"><div className="stat-num">{totalUnits}</div><div className="stat-label">Pieces sent out</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">Log an outward entry</p>
        <div className="field-row">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field">
            <label>Product</label>
            <select value={productId} onChange={(e) => { setProductId(e.target.value); setSize(''); }}>
              <option value="">Select…</option>
              {products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">—</option>
              {sizeOptions.map((s) => <option value={s} key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Qty</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Name of the person</label><input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="e.g. influencer or team member's name" /></div>
          <div className="field"><label>Notes — what this is for</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Instagram collab, gifting, sample" /></div>
        </div>
        <button className="btn" onClick={handleSubmit}>Log outward</button>
      </div>

      <input className="search-input" placeholder="Search by product or person…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 340 }} />

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Person</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="empty">No outward entries yet.</td></tr>
            ) : (
              sorted.map((o) => (
                <tr key={o.id}>
                  <td>{o.date}</td><td>{o.product_name}</td><td>{o.size}</td><td>{o.qty}</td>
                  <td>{o.person_name}</td><td>{o.notes}</td>
                  <td><button className="btn danger small" onClick={() => handleUndo(o)}>Undo</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
