import { useState } from 'react';
import { SIZES, todayStr, fmt, uid, materialTotalIssued, exportToExcel, blankQCChecklist, filterByBrand } from '../lib/calc';
import { addProductionLog, updateProductionLog, deleteProductionLog, addQualityCheck, deleteQualityCheckByProductionLog } from '../lib/api';
import { useUI } from '../context/UIContext';
import ProductionLogEditModal from './ProductionLogEditModal';

const STATUSES = ['Pending', 'In Progress', 'Ready'];

function daysBetween(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.round((d2 - d1) / 86400000);
}

export default function ProductionLog({ data, reload, brand }) {
  const { toast, confirm } = useUI();
  const products = filterByBrand(data.products, brand);
  const productionLog = filterByBrand(data.productionLog, brand);
  const qualityChecks = filterByBrand(data.qualityChecks, brand);
  const { materials } = data;
  const [editId, setEditId] = useState(null);
  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState('Ready');
  const [date, setDate] = useState(todayStr());
  const [remarks, setRemarks] = useState('');
  const [search, setSearch] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  const q = search.toLowerCase();
  const sorted = [...productionLog]
    .filter((l) => {
      if (!q) return true;
      return (
        (l.product_name || '').toLowerCase().includes(q) ||
        (l.size || '').toLowerCase().includes(q) ||
        (l.status || '').toLowerCase().includes(q) ||
        (l.remarks || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  function handleExport() {
    exportToExcel(
      sorted,
      [
        { key: 'date', label: 'Date logged' },
        { key: 'product_name', label: 'Product' },
        { key: 'size', label: 'Size' },
        { key: 'qty', label: 'Qty' },
        { key: 'status', label: 'Status' },
        { key: 'ready_date', label: 'Ready date' },
        { key: (l) => { const d = daysBetween(l.date, l.ready_date); return d != null ? d : ''; }, label: 'Days to Ready' },
        { key: 'remarks', label: 'Remarks' },
      ],
      `loma-production-log-${todayStr()}.csv`
    );
  }

  async function createQualityCheck(entry) {
    await addQualityCheck({
      id: uid('qc'), production_log_id: entry.id, date: todayStr(),
      product_id: entry.product_id, product_name: entry.product_name, size: entry.size, qty: entry.qty,
      checked_by: '', checklist: blankQCChecklist(), overall_result: 'Pending', rework_instructions: '', passed_date: null,
      brand: entry.brand || brand,
    });
  }

  async function handleSubmit() {
    if (!selectedProduct) { toast('Select a product first.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const qNum = Number(qty) || 0;
    if (qNum <= 0) { toast('Enter a quantity.'); return; }

    const entry = {
      id: uid('log'), date, product_id: selectedProduct.id, product_name: selectedProduct.name,
      size, qty: qNum, status, remarks: remarks.trim(),
      ready_date: status === 'Ready' ? todayStr() : null,
      brand,
    };
    await addProductionLog(entry);

    if (status === 'Ready') {
      await createQualityCheck(entry);
      toast(`Logged ${qNum} × ${selectedProduct.name} (${size}) — sent to Quality Check.`);
    } else {
      toast(`Logged ${qNum} × ${selectedProduct.name} (${size}).`);
    }
    setRemarks('');
    reload();
  }

  async function handleStatusChange(entry, newStatus) {
    const wasReady = entry.status === 'Ready';
    const willBeReady = newStatus === 'Ready';
    let readyDate = entry.ready_date;
    if (willBeReady && !wasReady) readyDate = readyDate || todayStr();
    if (!willBeReady && wasReady) readyDate = null;

    await updateProductionLog({ ...entry, status: newStatus, ready_date: readyDate });

    if (willBeReady && !wasReady) {
      await createQualityCheck(entry);
      toast('Status changed to Ready — sent to Quality Check.');
    } else if (!willBeReady && wasReady) {
      // pulled back out of Ready before QC was resolved — remove the now-irrelevant pending QC entry
      await deleteQualityCheckByProductionLog(entry.id);
      toast(`Status changed to ${newStatus} — removed from Quality Check.`);
    } else {
      toast(`Status changed to ${newStatus}.`);
    }
    reload();
  }

  async function handleReadyDateChange(entry, newDate) {
    await updateProductionLog({ ...entry, ready_date: newDate || null });
    reload();
  }

  async function handleUndo(entry) {
    const ok = await confirm(
      `Undo this production entry?\n\n${entry.qty} × ${entry.product_name} (${entry.size}) · ${entry.date}\n\nThis also removes its Quality Check entry.`,
      'Undo entry'
    );
    if (!ok) return;
    await deleteQualityCheckByProductionLog(entry.id);
    await deleteProductionLog(entry.id);
    toast('Entry undone.');
    reload();
  }

  let preview = null;
  if (selectedProduct && size && qty) {
    const qNum = Number(qty) || 0;
    if (selectedProduct.fabric_name && selectedProduct.fabric_qty != null) {
      const need = Number(selectedProduct.fabric_qty) * qNum;
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
          <div className="page-sub">Log every batch — marking it Ready sends it to Quality Check, and stock is only added once QC passes</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="card add-form" id="add-form" style={{ marginBottom: 20 }}>
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

      <div className="field-row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Search</label>
          <input className="search-input" placeholder="Search by product, size, status, or remarks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
              <tr><td colSpan={9} className="empty">No entries match{search ? ' your search' : ''}.</td></tr>
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
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn secondary small" onClick={() => setEditId(l.id)}>Edit</button>
                      <button className="btn danger small" onClick={() => handleUndo(l)}>Undo</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editId && (
        <ProductionLogEditModal
          entry={sorted.find((l) => l.id === editId)}
          products={products}
          linkedQC={(qualityChecks || []).find((qc) => qc.production_log_id === editId)}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); reload(); }}
        />
      )}
    </div>
  );
}