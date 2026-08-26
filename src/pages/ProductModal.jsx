import { useState } from 'react';
import {
  CATS, CAT_UNITS, SIZES, QTY_BASED_CATS, BRANDS,
  materialLineCost, productMaterialSubtotal, productProductionCost,
  productFinalCost, productTargetMRP, productLabourCost, labourFormulaText,
  rupee, uid,
} from '../lib/calc';
import { saveProduct, deleteProduct, recordLastUpdate, updateSettings } from '../lib/api';
import { useUI } from '../context/UIContext';

function blankProduct(brand) {
  const p = { id: uid('prod'), name: '', sku_prefix: '', image: '', type: '', brand: brand || 'Loma', sizes: SIZES.map((s) => ({ size: s, stock: 0 })) };
  CATS.forEach((cat) => {
    const k = cat.toLowerCase();
    p[`${k}_name`] = null;
    p[`${k}_qty`] = null;
    p[`${k}_price`] = null;
  });
  return p;
}

export default function ProductModal({ product, materials, dailyBudget, defaultBrand, onClose, onSaved, onDeleted }) {
  const { toast, confirm, promptName } = useUI();
  const isNew = product == null;
  const [draft, setDraft] = useState(() => (isNew ? blankProduct(defaultBrand) : { ...product, sizes: product.sizes || SIZES.map((s) => ({ size: s, stock: 0 })) }));
  const [liveBudget, setLiveBudget] = useState(dailyBudget ?? '');

  const set = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const setSize = (size, stock) => setDraft((d) => ({ ...d, sizes: d.sizes.map((s) => (s.size === size ? { ...s, stock } : s)) }));

  const budgetForCalc = liveBudget === '' ? null : Number(liveBudget);
  const matSub = productMaterialSubtotal(draft);
  const prodCost = productProductionCost(draft, budgetForCalc);
  const finalCost = productFinalCost(draft, budgetForCalc);
  const mrp = productTargetMRP(draft, budgetForCalc);
  const labour = productLabourCost(draft, budgetForCalc);

  async function handleSave() {
    if (!draft.name.trim()) {
      toast('Product name is required.');
      return;
    }
    const name = await promptName(`${isNew ? 'Adding' : 'Updating'} product "${draft.name}"`);
    if (name == null) return;
    const toSave = { ...draft };
    delete toSave.updated_at;
    await saveProduct(toSave);
    const newBudget = liveBudget === '' ? null : Number(liveBudget);
    let what = `${isNew ? 'Added' : 'Updated'} product "${draft.name}"`;
    if (newBudget !== dailyBudget) {
      await updateSettings(newBudget);
      what += ` (daily labour budget changed to ${newBudget != null ? 'Rs.' + newBudget : 'blank'})`;
    }
    await recordLastUpdate(name, what);
    toast(isNew ? 'Product added.' : 'Product updated.');
    onSaved();
  }

  async function handleDelete() {
    const ok = await confirm(`Delete "${draft.name}"?\n\nThis cannot be undone.`, 'Delete');
    if (!ok) return;
    await deleteProduct(draft.id);
    toast('Product deleted.');
    onDeleted();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">{isNew ? 'Add product' : 'Edit product'}</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="two-col">
            <div>
              <div className="field-row">
                <div className="field" style={{ flex: 1.5 }}>
                  <label>Product name</label>
                  <input value={draft.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div className="field">
                  <label>Brand</label>
                  <select value={draft.brand || 'Loma'} onChange={(e) => set('brand', e.target.value)}>
                    {BRANDS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>SKU prefix</label>
                  <input value={draft.sku_prefix || ''} onChange={(e) => set('sku_prefix', e.target.value)} />
                </div>
                <div className="field">
                  <label>Type</label>
                  <input value={draft.type || ''} onChange={(e) => set('type', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Image URL</label>
                <input value={draft.image || ''} onChange={(e) => set('image', e.target.value)} placeholder="https://…" />
              </div>
              {draft.image && <img className="thumb-preview" src={draft.image} onError={(e) => (e.currentTarget.style.display = 'none')} alt="" />}

              <p className="section-title" style={{ marginTop: 16 }}>Recipe — raw materials used per piece</p>
              {CATS.map((cat) => {
                const key = cat.toLowerCase();
                const unit = CAT_UNITS[cat];
                const isQtyBased = QTY_BASED_CATS.includes(key);
                const opts = materials.filter((m) => m.category === cat);
                let qtyVal = draft[`${key}_qty`];
                if (qtyVal == null && key === 'fabric' && draft.fabric_qty_m != null) qtyVal = draft.fabric_qty_m;
                return (
                  <div className="field-row" style={{ alignItems: 'flex-end' }} key={cat}>
                    <div className="field" style={{ flex: 1.3 }}>
                      <label>{cat}</label>
                      <select value={draft[`${key}_name`] || ''} onChange={(e) => set(`${key}_name`, e.target.value || null)}>
                        <option value="">— none / unknown yet —</option>
                        {opts.map((m) => <option value={m.name} key={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Qty ({unit}){!isQtyBased ? ' — for reference' : ''}</label>
                      <input
                        type="number" step="any"
                        value={qtyVal ?? ''}
                        onChange={(e) => set(`${key}_qty`, e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label>{isQtyBased ? `Price (Rs./${unit})` : 'Cost (Rs.) — flat'}</label>
                      <input
                        type="number" step="any"
                        value={draft[`${key}_price`] ?? ''}
                        onChange={(e) => set(`${key}_price`, e.target.value === '' ? null : Number(e.target.value))}
                        placeholder={isQtyBased ? 'e.g. 200' : 'e.g. 15'}
                      />
                    </div>
                    {cat === 'Button' && (
                      <div className="field">
                        <label>Button size</label>
                        <input value={draft.button_size || ''} onChange={(e) => set('button_size', e.target.value)} placeholder="e.g. 18L" />
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="section-title" style={{ marginTop: 16 }}>Labour</p>
              <div className="field-row">
                <div className="field">
                  <label>Daily labour budget (Rs.) — shared across all products</label>
                  <input type="number" step="any" value={liveBudget} onChange={(e) => setLiveBudget(e.target.value)} placeholder="e.g. 1100" />
                </div>
                <div className="field">
                  <label>Tailor output (pieces/day)</label>
                  <input type="number" step="any" value={draft.tailor_output ?? ''} onChange={(e) => set('tailor_output', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g. 2" />
                </div>
                <div className="field">
                  <label>Hours to make 1 piece</label>
                  <input type="number" step="any" value={draft.hours_per_piece ?? ''} onChange={(e) => set('hours_per_piece', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g. 4" />
                </div>
              </div>
              <div className="mini-note">{labourFormulaText(draft, budgetForCalc)}</div>
              <div className="field" style={{ marginTop: 8 }}>
                <label>Or type labour cost directly (Rs./piece) — used only if tailor output above is blank</label>
                <input type="number" step="any" value={draft.labour_cost ?? ''} onChange={(e) => set('labour_cost', e.target.value === '' ? null : Number(e.target.value))} />
              </div>
              <div className="mini-note" style={{ marginTop: 2 }}>
                Change the daily budget here (or on Home) and it updates the labour cost for every product at once, since the wage pool is shared, not fixed per product.
              </div>

              <div className="field-row" style={{ marginTop: 12 }}>
                <div className="field">
                  <label>Electricity (Rs.)</label>
                  <input type="number" step="any" value={draft.electricity_cost ?? ''} onChange={(e) => set('electricity_cost', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g. 25" />
                </div>
                <div className="field">
                  <label>Packaging (Rs.)</label>
                  <input type="number" step="any" value={draft.packaging ?? ''} onChange={(e) => set('packaging', e.target.value === '' ? null : Number(e.target.value))} />
                </div>
              </div>
              <div className="field">
                <label>Selling price / MRP override (Rs.)</label>
                <input type="number" step="any" value={draft.selling_price ?? ''} onChange={(e) => set('selling_price', e.target.value === '' ? null : Number(e.target.value))} />
              </div>
            </div>

            <div>
              <p className="section-title">Live cost calculation</p>
              <div className="calc-box">
                {CATS.map((cat) => {
                  const cost = materialLineCost(draft, cat.toLowerCase());
                  return (
                    <div className="calc-row" key={cat}>
                      <span>{cat}</span>
                      <span>{cost != null ? rupee(cost) : '—'}</span>
                    </div>
                  );
                })}
                <div className="calc-row total"><span>Material subtotal</span><span>{matSub != null ? rupee(matSub) : '—'}</span></div>
                <div className="calc-row"><span>Labour</span><span>{labour != null ? rupee(labour) : '—'}</span></div>
                <div className="calc-row"><span>Electricity</span><span>{draft.electricity_cost != null && draft.electricity_cost !== '' ? rupee(draft.electricity_cost) : '—'}</span></div>
                <div className="calc-row total"><span>Production cost</span><span>{prodCost != null ? rupee(prodCost) : '—'}</span></div>
                <div className="calc-row"><span>Packaging</span><span>{draft.packaging != null && draft.packaging !== '' ? rupee(draft.packaging) : '—'}</span></div>
                <div className="calc-row"><span>Final cost (incl. packaging)</span><span>{finalCost != null ? rupee(finalCost) : '—'}</span></div>
                <div className="calc-row mrp"><span>Target MRP (3× production cost)</span><span>{mrp != null ? rupee(mrp) : '—'}</span></div>
                {prodCost == null && (
                  <div className="mini-note" style={{ color: 'var(--rust)', marginTop: 8 }}>
                    Fill in Qty and Price for at least one material, plus a labour cost (or Tailor output + Daily budget), to see the full calculation.
                  </div>
                )}
              </div>

              <p className="section-title" style={{ marginTop: 16 }}>Stock by size</p>
              <div className="field-row">
                {draft.sizes.map((sz) => (
                  <div className="field" key={sz.size}>
                    <label>{sz.size}</label>
                    <input type="number" value={sz.stock ?? 0} onChange={(e) => setSize(sz.size, Number(e.target.value) || 0)} />
                  </div>
                ))}
              </div>
              <div className="mini-note">
                Stock updates automatically when Quality Check passes a batch, or you can correct it here directly.
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <div>{!isNew && <button className="btn danger" onClick={handleDelete}>Delete product</button>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={handleSave}>{isNew ? 'Add product' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
