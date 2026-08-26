import { useState } from 'react';
import { SIZES, CHANNELS, todayStr, uid, exportToExcel, filterByBrand } from '../lib/calc';
import { addInward, deleteInward, saveProduct } from '../lib/api';
import { useUI } from '../context/UIContext';

const SOURCES = [...CHANNELS, 'Customer', 'Vendor'];

export default function Inward({ data, reload, brand }) {
  const { toast } = useUI();
  const products = filterByBrand(data.products, brand);
  const inward = filterByBrand(data.inward, brand);
  const [date, setDate] = useState(todayStr());
  const [source, setSource] = useState(SOURCES[0]);
  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [search, setSearch] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  const q = search.toLowerCase();
  const filtered = inward.filter((i) => !q || (i.product_name || '').toLowerCase().includes(q) || (i.source || '').toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  function handleExport() {
    exportToExcel(
      sorted,
      [
        { key: 'date', label: 'Date' },
        { key: 'source', label: 'From' },
        { key: 'product_name', label: 'Product' },
        { key: 'size', label: 'Size' },
        { key: 'qty', label: 'Qty' },
        { key: 'remarks', label: 'Remarks' },
      ],
      `loma-inward-${todayStr()}.csv`
    );
  }

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const qn = Number(qty) || 0;
    if (qn <= 0) { toast('Enter a quantity.'); return; }

    const entry = {
      id: uid('inw'), date, source, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: qn, remarks: remarks.trim(),
      brand,
    };
    await addInward(entry);

    const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) + qn } : s)) };
    delete updated.updated_at;
    await saveProduct(updated);

    toast(`Restocked ${qn} × ${selectedProduct.name} (${size}) from ${source}.`);
    setRemarks('');
    reload();
  }

  async function handleUndo(entry) {
    const p = products.find((x) => x.id === entry.product_id || x.name === entry.product_name);
    if (p) {
      const updated = { ...p, sizes: p.sizes.map((s) => (s.size === entry.size ? { ...s, stock: Math.max(0, (Number(s.stock) || 0) - Number(entry.qty)) } : s)) };
      delete updated.updated_at;
      await saveProduct(updated);
    }
    await deleteInward(entry.id);
    toast('Entry undone, stock adjusted back.');
    reload();
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Inward / Returns</h1>
          <div className="page-sub">Log anything coming back — a return, an exchange, stock received — and it adds to finished-goods stock automatically</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">Log an inward entry</p>
        <div className="field-row">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field">
            <label>From where</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
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
        <div className="field">
          <label>Remarks</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Customer return, size exchange, wrong item sent back" />
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={handleSubmit}>Log inward &amp; restock</button>
      </div>

      <input className="search-input" placeholder="Search by product or source…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 340 }} />

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>From</th><th>Product</th><th>Size</th><th>Qty</th><th>Remarks</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="empty">No inward entries yet.</td></tr>
            ) : (
              sorted.map((i) => (
                <tr key={i.id}>
                  <td>{i.date}</td><td>{i.source}</td><td>{i.product_name}</td><td>{i.size}</td><td>{i.qty}</td><td>{i.remarks}</td>
                  <td><button className="btn danger small" onClick={() => handleUndo(i)}>Undo</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
