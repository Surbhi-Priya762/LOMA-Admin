import { useState } from 'react';
import { SIZES, todayStr, fmt, uid, materialTotalIssued } from '../lib/calc';
import { addProductionLog, updateProductionLog, deleteProductionLog, saveProduct } from '../lib/api';
import { useUI } from '../context/UIContext';

const STATUSES = ['Pending', 'In Progress', 'Ready'];

function daysBetween(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.round((d2 - d1) / 86400000);
}

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

  async function adjustStockForStatusChange(entry, wasReady, willBeReady) {
    if (wasReady === willBeReady) return;
    const p = products.find((x) => x.id === entry.product_id || x.name === entry.product_name);
    if (!p) return;
    const delta = (willBeReady ? 1 : 0) - (wasReady ? 1 : 0);
    const updated = {
      ...p,
      sizes: p.sizes.map((s) =>
        s.size === entry.size ? { ...s, stock: Math.max(0, (Number(s.stock) || 0) + delta * Number(entry.qty)) } : s
      ),
    };
    delete updated.updated_at;
    await saveProduct(updated);
  }

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    const entry = {
      id: uid('log'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: q, status, remarks: remarks.trim(),
      ready_date: status === 'Ready' ? todayStr() : null,
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

  async function handleStatusChange(entry, newStatus) {
    const wasReady = entry.status === 'Ready';
    const willBeReady = newStatus === 'Ready';
    let readyDate = entry.ready_date;
    if (willBeReady && !wasReady) readyDate = readyDate || todayStr(); // auto-fill the day it became Ready
    if (!willBeReady && wasReady) readyDate = null; // no longer ready, clear it

    await updateProductionLog({ ...entry, status: newStatus, ready_date: readyDate });
    await adjustStockForStatusChange(entry, wasReady, willBeReady);
    toast(`Status changed to ${newStatus}${willBeReady && !wasReady ? ' — stock updated' : !willBeReady && wasReady ? ' — stock reversed' : ''}.`);
    reload();
  }

  async function handleReadyDateChange(entry, newDate) {
    await updateProductionLog({ ...entry, ready_date: newDate || null });
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
          <div className="page-sub">Log every batch — change the status anytime, and Ready adds to finished-goods stock and deducts fabric automatically</div>
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
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Date logged</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
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
          <thead>
            <tr>
              <th>Date logged</th><th>Product</th><th>Size</th><th>Qty</th><th>Status</th>
              <th>Ready date</th><th>Days to Ready</th><th>Remarks</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={9} className="empty">No entries yet.</td></tr>
            ) : (
              sorted.map((l) => {
                const days = daysBetween(l.date, l.ready_date);
                return (
                  <tr key={l.id}>
                    <td>{l.date}</td>
                    <td>{l.product_name}</td>
                    <td>{l.size}</td>
                    <td>{l.qty}</td>
                    <td>
                      <select
                        value={l.status}
                        onChange={(e) => handleStatusChange(l, e.target.value)}
                        className={`tag ${l.status === 'Ready' ? 'ready' : l.status === 'In Progress' ? 'progress' : 'pending'}`}
                        style={{ border: '1px solid var(--line)', cursor: 'pointer' }}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        value={l.ready_date || ''}
                        onChange={(e) => handleReadyDateChange(l, e.target.value)}
                        style={{ width: 130, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                      />
                    </td>
                    <td>{days != null ? `${days} day${days === 1 ? '' : 's'}` : '—'}</td>
                    <td>{l.remarks || ''}</td>
                    <td><button className="btn danger small" onClick={() => handleUndo(l)}>Undo</button></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
