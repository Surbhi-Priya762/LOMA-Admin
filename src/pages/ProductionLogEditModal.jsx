import { useState } from 'react';
import { SIZES } from '../lib/calc';
import { updateProductionLog, updateQualityCheck } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function ProductionLogEditModal({ entry, products, linkedQC, onClose, onSaved }) {
  const { toast } = useUI();
  const [productId, setProductId] = useState(entry.product_id || '');
  const [size, setSize] = useState(entry.size || '');
  const [qty, setQty] = useState(entry.qty ?? 1);
  const [date, setDate] = useState(entry.date || '');
  const [remarks, setRemarks] = useState(entry.remarks || '');
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find((p) => p.id === productId) || products.find((p) => p.name === entry.product_name);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  // If this entry already passed QC, its stock was already added based on the old
  // Product/Size/Qty — changing those here wouldn't adjust that stock, so we lock them.
  const locked = linkedQC && linkedQC.overall_result === 'Pass';

  async function handleSave() {
    if (!selectedProduct && !locked) { toast('Select a product.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    setSaving(true);
    try {
      const updatedEntry = {
        ...entry,
        product_id: locked ? entry.product_id : selectedProduct.id,
        product_name: locked ? entry.product_name : selectedProduct.name,
        size, qty: q, date, remarks: remarks.trim(),
      };
      await updateProductionLog(updatedEntry);

      // keep a still-pending/rework/reject QC record's basic info in sync
      if (linkedQC && !locked) {
        await updateQualityCheck({
          ...linkedQC, product_id: updatedEntry.product_id, product_name: updatedEntry.product_name,
          size: updatedEntry.size, qty: updatedEntry.qty,
        });
      }
      toast('Entry updated.');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <div className="modal-title">Edit production log entry</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {locked && (
            <div className="mini-note" style={{ color: 'var(--rust)', marginBottom: 12 }}>
              This batch already passed Quality Check and its stock was added. Product, Size, and Qty are locked to protect that stock number — use Undo on this entry instead if it needs to be fully corrected.
            </div>
          )}
          <div className="field">
            <label>Product</label>
            <select value={productId} onChange={(e) => { setProductId(e.target.value); setSize(''); }} disabled={locked}>
              <option value="">Select…</option>
              {products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Size</label>
              <select value={size} onChange={(e) => setSize(e.target.value)} disabled={locked}>
                <option value="">—</option>
                {sizeOptions.map((s) => <option value={s} key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Qty</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} disabled={locked} /></div>
            <div className="field"><label>Date logged</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="field">
            <label>Remarks</label>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <div />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
