import { useState } from 'react';
import { QC_SECTIONS, todayStr } from '../lib/calc';
import { updateQualityCheck, saveProduct } from '../lib/api';
import { useUI } from '../context/UIContext';

const RESULTS = ['Pending', 'Pass', 'Reject', 'Rework'];

export default function QCModal({ qc, products, onClose, onSaved }) {
  const { toast } = useUI();
  const [checklist, setChecklist] = useState(qc.checklist && qc.checklist.length ? qc.checklist : []);
  const [checkedBy, setCheckedBy] = useState(qc.checked_by || '');
  const [overallResult, setOverallResult] = useState(qc.overall_result || 'Pending');
  const [reworkInstructions, setReworkInstructions] = useState(qc.rework_instructions || '');
  const [saving, setSaving] = useState(false);

  function toggle(section, item, field) {
    setChecklist((rows) =>
      rows.map((r) => {
        if (r.section !== section || r.item !== item) return r;
        if (field === 'ok') return { ...r, ok: !r.ok, fix: r.ok ? r.fix : false };
        return { ...r, fix: !r.fix, ok: r.fix ? r.ok : false };
      })
    );
  }
  function setNote(section, item, note) {
    setChecklist((rows) => rows.map((r) => (r.section === section && r.item === item ? { ...r, note } : r)));
  }

  const checkedCount = checklist.filter((r) => r.ok || r.fix).length;

  async function handleSave() {
    setSaving(true);
    try {
      const wasPass = qc.overall_result === 'Pass';
      const willBePass = overallResult === 'Pass';

      await updateQualityCheck({
        ...qc, checklist, checked_by: checkedBy.trim(), overall_result: overallResult,
        rework_instructions: reworkInstructions.trim(),
        passed_date: willBePass ? (qc.passed_date || todayStr()) : null,
      });

      if (willBePass && !wasPass) {
        const p = products.find((x) => x.id === qc.product_id || x.name === qc.product_name);
        if (p) {
          const updated = { ...p, sizes: p.sizes.map((s) => (s.size === qc.size ? { ...s, stock: (Number(s.stock) || 0) + Number(qc.qty) } : s)) };
          delete updated.updated_at;
          await saveProduct(updated);
        }
        toast('Passed — stock added.');
      } else if (!willBePass && wasPass) {
        const p = products.find((x) => x.id === qc.product_id || x.name === qc.product_name);
        if (p) {
          const updated = { ...p, sizes: p.sizes.map((s) => (s.size === qc.size ? { ...s, stock: Math.max(0, (Number(s.stock) || 0) - Number(qc.qty)) } : s)) };
          delete updated.updated_at;
          await saveProduct(updated);
        }
        toast(`Changed from Pass to ${overallResult} — stock reversed.`);
      } else {
        toast('Quality check saved.');
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 820 }}>
        <div className="modal-head">
          <div className="modal-title">Quality Check — {qc.product_name}</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="field-row" style={{ marginBottom: 16 }}>
            <div className="field"><label>Style/SKU</label><div style={{ fontSize: 13, paddingTop: 6 }}>{qc.product_name}</div></div>
            <div className="field"><label>Size</label><div style={{ fontSize: 13, paddingTop: 6 }}>{qc.size}</div></div>
            <div className="field"><label>Qty</label><div style={{ fontSize: 13, paddingTop: 6 }}>{qc.qty}</div></div>
            <div className="field"><label>Checked by</label><input value={checkedBy} onChange={(e) => setCheckedBy(e.target.value)} placeholder="Name" /></div>
            <div className="field"><label>Date</label><div style={{ fontSize: 13, paddingTop: 6 }}>{qc.date}</div></div>
          </div>

          <div className="mini-note" style={{ marginBottom: 14 }}>{checkedCount} of {checklist.length} points checked.</div>

          {QC_SECTIONS.map(({ section }) => (
            <div key={section} style={{ marginBottom: 18 }}>
              <p className="section-title">{section}</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Check point</th><th>OK</th><th>Fix</th><th>Note</th></tr></thead>
                  <tbody>
                    {checklist.filter((r) => r.section === section).map((r) => (
                      <tr key={r.item}>
                        <td style={{ fontSize: 12.5 }}>{r.item}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={r.ok} onChange={() => toggle(section, r.item, 'ok')} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={r.fix} onChange={() => toggle(section, r.item, 'fix')} />
                        </td>
                        <td>
                          <input
                            value={r.note} onChange={(e) => setNote(section, r.item, e.target.value)}
                            placeholder="optional note" style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2, fontSize: 12 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <p className="section-title">Overall Result</p>
          <div className="field-row">
            <div className="field">
              <label>Result</label>
              <select value={overallResult} onChange={(e) => setOverallResult(e.target.value)}>
                {RESULTS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {(overallResult === 'Rework' || overallResult === 'Reject') && (
              <div className="field" style={{ flex: 2 }}>
                <label>{overallResult === 'Rework' ? 'Rework instructions' : 'Reason for reject'}</label>
                <input value={reworkInstructions} onChange={(e) => setReworkInstructions(e.target.value)} />
              </div>
            )}
          </div>
          <div className="mini-note">
            Pass adds this quantity to finished-goods stock automatically. Reject or Rework does not add stock — you can change the result back to Pass later once it's fixed and re-checked.
          </div>
        </div>
        <div className="modal-foot">
          <div />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
