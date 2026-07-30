import { useRef, useState } from 'react';
import { CATS, uid } from '../lib/calc';
import { materialUsedByProducts } from '../lib/calc';
import { saveMaterial, deleteMaterial, saveProduct, recordLastUpdate } from '../lib/api';
import { useUI } from '../context/UIContext';

function blankMaterial(defaultCategory) {
  return { id: uid('mat'), name: '', category: defaultCategory || 'Fabric', unit: 'm', price: null, stock: null, block: null, reorder_level: null, image: null };
}

export default function MaterialModal({ material, products, defaultCategory, onClose, onSaved, onDeleted }) {
  const { toast, confirm, promptName } = useUI();
  const isNew = material == null;
  const [draft, setDraft] = useState(() => (isNew ? blankMaterial(defaultCategory) : { ...material }));
  const fileInputRef = useRef(null);
  const [pendingImage, setPendingImage] = useState(null);

  const set = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const usedBy = isNew ? [] : materialUsedByProducts(draft, products);
  const unassigned = products.filter((p) => p[`${(draft.category || 'Fabric').toLowerCase()}_name`] !== draft.name);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      toast('Material name is required.');
      return;
    }
    const name = await promptName(`${isNew ? 'Adding' : 'Updating'} raw material "${draft.name}"`);
    if (name == null) return;
    const toSave = { ...draft, image: pendingImage || draft.image };
    delete toSave.updated_at;
    await saveMaterial(toSave);
    await recordLastUpdate(name, `${isNew ? 'Added' : 'Updated'} raw material "${draft.name}"`);
    toast(isNew ? 'Raw material added.' : 'Raw material updated.');
    onSaved();
  }

  async function handleDelete() {
    const usedCount = usedBy.length;
    const ok = await confirm(
      usedCount > 0 ? `${usedCount} product(s) still use this material. Delete anyway?` : `Delete "${draft.name}"?`,
      'Delete'
    );
    if (!ok) return;
    await deleteMaterial(draft.id);
    toast('Raw material deleted.');
    onDeleted();
  }

  async function addToProduct(productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const key = `${(draft.category || 'Fabric').toLowerCase()}_name`;
    const updated = { ...p, [key]: draft.name };
    delete updated.updated_at;
    await saveProduct(updated);
    toast(`Added to ${p.name}.`);
    onSaved(); // reload parent so usedBy list refreshes; modal will re-derive from fresh data on next open
  }

  async function removeFromProduct(productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const key = `${(draft.category || 'Fabric').toLowerCase()}_name`;
    const updated = { ...p, [key]: null };
    delete updated.updated_at;
    await saveProduct(updated);
    toast(`Removed from ${p.name}.`);
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <div className="modal-title">{isNew ? 'Add raw material' : 'Edit raw material'}</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {(pendingImage || draft.image) && <img className="thumb-preview" src={pendingImage || draft.image} alt="" />}
          <div className="field">
            <label>Photo (optional)</label>
            <div className="img-upload" onClick={() => fileInputRef.current.click()}>
              {pendingImage || draft.image ? 'Click to replace photo' : 'Click to upload a photo of this material'}
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFile} />
          </div>

          <div className="field-row">
            <div className="field" style={{ flex: 1.4 }}>
              <label>Material name</label>
              <input value={draft.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={draft.category} onChange={(e) => set('category', e.target.value)}>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Unit</label>
              <select value={draft.unit || 'm'} onChange={(e) => set('unit', e.target.value)}>
                <option value="m">m</option>
                <option value="pcs">pcs</option>
                <option value="cones">cones</option>
              </select>
            </div>
            <div className="field">
              <label>Price / unit (Rs.)</label>
              <input type="number" step="any" value={draft.price ?? ''} onChange={(e) => set('price', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>In house (warehouse)</label>
              <input type="number" step="any" value={draft.stock ?? ''} onChange={(e) => set('stock', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Reorder level</label>
              <input type="number" step="any" value={draft.reorder_level ?? ''} onChange={(e) => set('reorder_level', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Block (booked, not received)</label>
              <input type="number" step="any" value={draft.block ?? ''} onChange={(e) => set('block', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </div>
          <div className="mini-note">
            "Block" is just for your reference — quantity already ordered/booked but not in the warehouse yet. It doesn't affect any stock calculation.
          </div>

          {!isNew && (
            <>
              <p className="section-title" style={{ marginTop: 16 }}>Used in</p>
              <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                {usedBy.length === 0 ? (
                  <div className="empty">No products use this material yet.</div>
                ) : (
                  usedBy.map((p) => (
                    <div className="activity-row" key={p.id}>
                      <span>{p.name}</span>
                      <button className="btn danger small" onClick={() => removeFromProduct(p.id)}>Remove</button>
                    </div>
                  ))
                )}
              </div>
              <AddToProductRow unassigned={unassigned} onAdd={addToProduct} />
            </>
          )}
        </div>
        <div className="modal-foot">
          <div>{!isNew && <button className="btn danger" onClick={handleDelete}>Delete material</button>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={handleSave}>{isNew ? 'Add material' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddToProductRow({ unassigned, onAdd }) {
  const [pid, setPid] = useState('');
  return (
    <div className="field-row" style={{ marginTop: 10 }}>
      <div className="field" style={{ flex: 1.6 }}>
        <label>Add to a product</label>
        <select value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">Select a product…</option>
          {unassigned.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
        </select>
      </div>
      <button className="btn secondary small" style={{ alignSelf: 'flex-end' }} onClick={() => pid && onAdd(pid)}>Add</button>
    </div>
  );
}
