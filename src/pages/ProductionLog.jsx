import { useState } from 'react';
import { SIZES, todayStr, fmt, uid, materialTotalIssued } from '../lib/calc';
import { addProductionLog, deleteProductionLog, saveProduct } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function ProductionLog({ data, reload }) {
  const { toast } = useUI();
  const { products, productionLog, materials } = data;
  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState('Ready');
  const [date, setDate] = useState(todayStr());
  const [remarks, setRemarks] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  const sorted = [...productionLog].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    const entry = {
      id: uid('log'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: q, status, remarks: remarks.trim(),
    };
    await addProductionLog(entry);

    if (status === 'Ready') {
      const updated = { ...selectedProduct, sizes: selectedProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) + q } : s)) };
      delete updated.updated_at;
      await saveProduct(updated);
    }
    toast(`Logged ${q} × ${selectedProduct.name} (${size}).`);
    setRemarks('');
    reload();
  }

  async function handleUndo(entry) {
    if (entry.status === 'Ready') {
      const p = products.find((x) => x.id === entry.product_id || x.name === entry.product_name);
      if (p) {
        const updated = { ...p, sizes: p.sizes.map((s) => (s.size === entry.size ? { ...s, stock: Math.max(0, (Number(s.stock) || 0) - Number(entry.qty)) } : s)) };
        delete updated.updated_at;
        await saveProduct(updated);
      }
    }
    await deleteProductionLog(entry.id);
    toast('Entry undone, stock adjusted.');
    reload();
  }

  // live preview of fabric that will be consumed
  let preview = null;
  if (selectedProduct && size && qty) {
    const q = Number(qty) || 0;
    if (selectedProduct.fabric_name && selectedProduct.fabric_qty != null) {
      const need = Number(selectedProduct.fabric_qty) * q;
      const mat = materials.find((m) => m.name === selectedProduct.fabric_name);
      const currentStock = mat && mat.stock != null ? Number(mat.stock) - materialTotalIssued(mat, products, productionLog) : null;
      preview = (
        <div className="calc-row">
          <span>Fabric needed ({selectedProduct.fabric_name})</span>
          <span>{fmt(need)} m{currentStock != null ? ` — ${fmt(currentStock - need)}m left after` : ''}</span>
        </div>
      );
    } else {
      preview = <div className="calc-row"><span>Fabric</span><span>not set on this product yet</span></div>;
    }
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Production Log</h1>
          <div className="page-sub">Log every batch — marking it "Ready" adds to finished-goods stock and deducts fabric automatically</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">Log a new entry</p>
        <div className="field-row">
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
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Pending</option><option>In Progress</option><option>Ready</option>
            </select>
          </div>
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Remarks (optional)</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Coyu order fulfilment" />
        </div>
        {preview && <div className="calc-box">{preview}</div>}
        <button className="btn" style={{ marginTop: 10 }} onClick={handleSubmit}>Log entry</button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Status</th><th>Remarks</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="empty">No entries yet.</td></tr>
            ) : (
              sorted.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td><td>{l.product_name}</td><td>{l.size}</td><td>{l.qty}</td>
                  <td><span className={`tag ${l.status === 'Ready' ? 'ready' : l.status === 'In Progress' ? 'progress' : 'pending'}`}>{l.status}</span></td>
                  <td>{l.remarks || ''}</td>
                  <td><button className="btn danger small" onClick={() => handleUndo(l)}>Undo</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
