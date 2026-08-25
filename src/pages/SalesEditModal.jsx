import { useState } from 'react';
import { SIZES, CHANNELS, CHANNELS_BY_TYPE, SALE_TYPES, saleTypeForChannel } from '../lib/calc';
import { updateSale, saveProduct, updateSettlement } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function SalesEditModal({ sale, products, linkedSettlement, onClose, onSaved }) {
  const { toast } = useUI();
  const [productId, setProductId] = useState(sale.product_id || '');
  const [size, setSize] = useState(sale.size || '');
  const [qty, setQty] = useState(sale.qty ?? 1);
  const [saleType, setSaleType] = useState(sale.sale_type || saleTypeForChannel(sale.channel) || 'Online');
  const [channel, setChannel] = useState(sale.channel || CHANNELS[0]);
  const [date, setDate] = useState(sale.date || '');
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find((p) => p.id === productId) || products.find((p) => p.name === sale.product_name);
  const sizeOptions = selectedProduct ? (selectedProduct.sizes || []).map((s) => s.size) : SIZES;

  function selectSaleType(type) {
    setSaleType(type);
    setChannel(CHANNELS_BY_TYPE[type][0]);
  }

  async function handleSave() {
    if (!selectedProduct) { toast('Select a product.'); return; }
    if (!size) { toast('Select a size.'); return; }
    const q = Number(qty) || 0;
    if (q <= 0) { toast('Enter a quantity.'); return; }

    setSaving(true);
    try {
      const oldProduct = products.find((p) => p.id === sale.product_id || p.name === sale.product_name);
      const sameLine = oldProduct && oldProduct.id === selectedProduct.id && sale.size === size;

      if (!sameLine) {
        // reverse the old deduction, apply the new one
        if (oldProduct) {
          const restored = { ...oldProduct, sizes: oldProduct.sizes.map((s) => (s.size === sale.size ? { ...s, stock: (Number(s.stock) || 0) + Number(sale.qty) } : s)) };
          delete restored.updated_at;
          await saveProduct(restored);
        }
        const freshProduct = oldProduct && oldProduct.id === selectedProduct.id ? { ...oldProduct } : selectedProduct;
        const deducted = { ...freshProduct, sizes: freshProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) - q } : s)) };
        delete deducted.updated_at;
        await saveProduct(deducted);
      } else if (Number(sale.qty) !== q) {
        // same product+size, just a quantity correction
        const diff = q - Number(sale.qty);
        const updated = { ...oldProduct, sizes: oldProduct.sizes.map((s) => (s.size === size ? { ...s, stock: (Number(s.stock) || 0) - diff } : s)) };
        delete updated.updated_at;
        await saveProduct(updated);
      }

      const updatedSale = {
        ...sale, product_id: selectedProduct.id, product_name: selectedProduct.name,
        size, qty: q, sale_type: saleType, channel, date,
      };
      await updateSale(updatedSale);

      if (linkedSettlement) {
        await updateSettlement({
          ...linkedSettlement, product_name: selectedProduct.name, size, qty: q, channel, date_logged: date,
        });
      }

      toast('Sale updated, stock adjusted.');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div className="modal-title">Edit sale</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="mini-note" style={{ marginBottom: 12 }}>
            Changing Product, Size, or Qty automatically corrects stock — the old deduction is reversed and the new one applied.
          </div>
          <div className="field">
            <label>Product</label>
            <select value={productId} onChange={(e) => { setProductId(e.target.value); setSize(''); }}>
              <option value="">Select…</option>
              {products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Size</label>
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="">—</option>
                {sizeOptions.map((s) => <option value={s} key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Qty</label><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Online or Offline</label>
              <select value={saleType} onChange={(e) => selectSaleType(e.target.value)}>
                {SALE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                {CHANNELS_BY_TYPE[saleType].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {linkedSettlement && (
            <div className="mini-note">This sale's Settlement record will be updated to match too (Product/Size/Qty/Channel/Date) — Gross, Net, and Commission stay as they are, edit those on the Settlements page if needed.</div>
          )}
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
