import { useState } from 'react';
import { todayStr, exportToExcel } from '../lib/calc';
import { deleteQualityCheck } from '../lib/api';
import { useUI } from '../context/UIContext';
import QCModal from './QCModal';

const RESULTS = ['Pending', 'Pass', 'Reject', 'Rework'];

export default function QualityCheck({ data, reload }) {
  const { toast, confirm } = useUI();
  const { qualityChecks, products } = data;
  const [resultFilter, setResultFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  const q = search.toLowerCase();
  const filtered = (qualityChecks || []).filter((qc) => {
    if (resultFilter !== 'All' && (qc.overall_result || 'Pending') !== resultFilter) return false;
    if (q && !(qc.product_name || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const openQC = openId ? (qualityChecks || []).find((qc) => qc.id === openId) : null;

  function handleExport() {
    exportToExcel(
      sorted,
      [
        { key: 'date', label: 'Date' },
        { key: 'product_name', label: 'Product' },
        { key: 'size', label: 'Size' },
        { key: 'qty', label: 'Qty' },
        { key: 'checked_by', label: 'Checked by' },
        { key: (qc) => `${(qc.checklist || []).filter((r) => r.ok || r.fix).length}/${(qc.checklist || []).length}`, label: 'Points checked' },
        { key: 'overall_result', label: 'Result' },
        { key: 'rework_instructions', label: 'Rework/reject notes' },
        { key: 'passed_date', label: 'Passed date' },
      ],
      `loma-quality-check-${todayStr()}.csv`
    );
  }

  async function handleDelete(qc) {
    const ok = await confirm(`Delete this quality check for "${qc.product_name}"?\n\nIf it was already Passed, this won't reverse the stock — undo that from Production Log if needed.`, 'Delete');
    if (!ok) return;
    await deleteQualityCheck(qc.id);
    toast('Quality check deleted.');
    reload();
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Quality Check</h1>
          <div className="page-sub">Every batch marked Ready in Production Log lands here — Pass adds it to stock, Reject/Rework doesn't</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="tabs-row">
        <div className={`pill ${resultFilter === 'All' ? 'active' : ''}`} onClick={() => setResultFilter('All')}>All</div>
        {RESULTS.map((r) => (
          <div className={`pill ${resultFilter === r ? 'active' : ''}`} key={r} onClick={() => setResultFilter(r)}>{r}</div>
        ))}
      </div>

      <input className="search-input" placeholder="Search by product…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 340 }} />

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Checked by</th><th>Progress</th><th>Result</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={8} className="empty">Nothing here yet — mark a Production Log entry "Ready" to send it for quality check.</td></tr>
            ) : (
              sorted.map((qc) => {
                const total = (qc.checklist || []).length;
                const done = (qc.checklist || []).filter((r) => r.ok || r.fix).length;
                const result = qc.overall_result || 'Pending';
                return (
                  <tr key={qc.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(qc.id)}>
                    <td>{qc.date}</td>
                    <td>{qc.product_name}</td>
                    <td>{qc.size}</td>
                    <td>{qc.qty}</td>
                    <td>{qc.checked_by || '—'}</td>
                    <td>{done}/{total}</td>
                    <td>
                      <span className={`tag ${result === 'Pass' ? 'ready' : result === 'Rework' ? 'progress' : result === 'Reject' ? 'reorder' : 'pending'}`}>{result}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn danger small" onClick={() => handleDelete(qc)}>Delete</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {openQC && (
        <QCModal
          qc={openQC}
          products={products}
          onClose={() => setOpenId(null)}
          onSaved={() => { setOpenId(null); reload(); }}
        />
      )}
    </div>
  );
}
