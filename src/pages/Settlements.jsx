import { useState } from 'react';
import { CHANNELS, SIZES, rupee, applyCommission, todayStr, uid } from '../lib/calc';
import { addSettlement, updateSettlement, deleteSettlement } from '../lib/api';
import { useUI } from '../context/UIContext';

const STATUSES = ['Pending', 'Invoice Sent', 'Partial', 'Settled', 'Cancelled'];

export default function Settlements({ data, reload }) {
  const { toast, confirm } = useUI();
  const { settlements, products } = data;
  const [monthFilter, setMonthFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  // manual "Log a settlement" form
  const [fProductId, setFProductId] = useState('');
  const [fSize, setFSize] = useState('');
  const [fChannel, setFChannel] = useState(CHANNELS[0]);
  const [fGross, setFGross] = useState('');
  const [fCommType, setFCommType] = useState('None');
  const [fCommValue, setFCommValue] = useState('');
  const [fReceived, setFReceived] = useState('');
  const [fStatus, setFStatus] = useState('Pending');
  const [fSettleDate, setFSettleDate] = useState('');
  const [fNotes, setFNotes] = useState('');

  const fSelectedProduct = products.find((p) => p.id === fProductId);
  const fSizeOptions = fSelectedProduct ? (fSelectedProduct.sizes || []).map((s) => s.size) : SIZES;
  const fExpected = applyCommission(fGross, { type: fCommType, value: fCommValue });

  async function handleLogSettlement() {
    if (!fSelectedProduct) { toast('Select a product first.'); return; }
    if (!fSize) { toast('Select a size.'); return; }
    if (fGross === '') { toast('Enter the price from the marketplace sheet.'); return; }
    await addSettlement({
      id: uid('settle'), sale_id: null, date_logged: todayStr(),
      product_name: fSelectedProduct.name, size: fSize, channel: fChannel,
      gross_amount: Number(fGross),
      commission_type: fCommType === 'None' ? null : fCommType,
      commission_value: fCommValue === '' ? null : Number(fCommValue),
      expected_amount: fExpected === '' ? null : Number(fExpected),
      received_amount: fReceived === '' ? null : Number(fReceived),
      status: fStatus,
      settlement_date: fSettleDate || null,
      notes: fNotes.trim(),
      cancel_reason: fStatus === 'Cancelled' ? fNotes.trim() : '',
    });
    toast('Settlement logged.');
    setFProductId(''); setFSize(''); setFGross(''); setFCommValue(''); setFReceived(''); setFSettleDate(''); setFNotes(''); setFStatus('Pending'); setFCommType('None');
    reload();
  }

  const allMonths = Array.from(new Set((settlements || []).map((s) => (s.date_logged || '').slice(0, 7)))).filter(Boolean).sort().reverse();
  const q = search.toLowerCase();
  const filtered = (settlements || []).filter((s) => {
    if (monthFilter !== 'All' && (s.date_logged || '').slice(0, 7) !== monthFilter) return false;
    if (channelFilter !== 'All' && s.channel !== channelFilter) return false;
    if (statusFilter !== 'All' && (s.status || 'Pending') !== statusFilter) return false;
    if (q && !(s.product_name || '').toLowerCase().includes(q) && !(s.channel || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.date_logged || '').localeCompare(a.date_logged || ''));

  const activeFiltered = filtered.filter((s) => (s.status || 'Pending') !== 'Cancelled');
  const totalExpected = activeFiltered.reduce((a, s) => a + (Number(s.expected_amount) || 0), 0);
  const totalReceived = activeFiltered.reduce((a, s) => a + (Number(s.received_amount) || 0), 0);
  const totalPending = activeFiltered
    .filter((s) => (s.status || 'Pending') !== 'Settled')
    .reduce((a, s) => a + ((Number(s.expected_amount) || 0) - (Number(s.received_amount) || 0)), 0);
  const cancelledCount = filtered.filter((s) => s.status === 'Cancelled').length;

  async function recalcExpected(entry) {
    const newExpected = applyCommission(entry.gross_amount ?? '', { type: entry.commission_type, value: entry.commission_value });
    await updateSettlement({ ...entry, expected_amount: newExpected === '' ? null : Number(newExpected) });
    reload();
  }

  async function editCommission(entry, field, value) {
    const updatedEntry = { ...entry, [field]: field === 'commission_value' ? (value === '' ? null : Number(value)) : value };
    const newExpected = applyCommission(updatedEntry.gross_amount ?? '', { type: updatedEntry.commission_type, value: updatedEntry.commission_value });
    await updateSettlement({ ...updatedEntry, expected_amount: newExpected === '' ? null : Number(newExpected) });
    toast('Commission updated, Expected recalculated.');
    reload();
  }

  async function editField(entry, field, value) {
    const num = field === 'received_amount' || field === 'gross_amount' ? (value === '' ? null : Number(value)) : value;
    await updateSettlement({ ...entry, [field]: num });
    reload();
  }

  async function markSettled(entry) {
    await updateSettlement({
      ...entry, status: 'Settled',
      received_amount: entry.received_amount ?? entry.expected_amount,
      settlement_date: entry.settlement_date || todayStr(),
    });
    toast('Marked as settled.');
    reload();
  }

  async function setStatus(entry, newStatus) {
    await updateSettlement({ ...entry, status: newStatus });
    if (newStatus === 'Cancelled') toast('Marked cancelled — add the reason in the box on the right.');
    reload();
  }

  async function handleDelete(entry) {
    const ok = await confirm(`Delete this settlement record for "${entry.product_name}"?\n\nThis only removes the settlement tracking — it does not touch the original sale.`, 'Delete');
    if (!ok) return;
    await deleteSettlement(entry.id);
    toast('Settlement record deleted.');
    reload();
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Settlements</h1>
          <div className="page-sub">Every sale lands here automatically, or log one by hand from a marketplace sheet — track what each marketplace actually pays, on their own schedule</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">Log a settlement</p>
        <div className="mini-note" style={{ marginBottom: 10 }}>Type in exactly what's on the marketplace's sheet — nothing is calculated for you unless you want it to be.</div>
        <div className="field-row">
          <div className="field">
            <label>Product</label>
            <select value={fProductId} onChange={(e) => { setFProductId(e.target.value); setFSize(''); }}>
              <option value="">Select…</option>
              {products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Size</label>
            <select value={fSize} onChange={(e) => setFSize(e.target.value)}>
              <option value="">—</option>
              {fSizeOptions.map((s) => <option value={s} key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Channel</label>
            <select value={fChannel} onChange={(e) => setFChannel(e.target.value)}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Price (Rs.)</label><input type="number" step="any" value={fGross} onChange={(e) => setFGross(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Commission type</label>
            <select value={fCommType} onChange={(e) => setFCommType(e.target.value)}>
              <option value="None">None</option>
              <option value="Percentage">Percentage off</option>
              <option value="Flat">Flat amount off</option>
            </select>
          </div>
          <div className="field">
            <label>Commission value{fCommType === 'Percentage' ? ' (%)' : fCommType === 'Flat' ? ' (Rs.)' : ''}</label>
            <input type="number" step="any" value={fCommValue} onChange={(e) => setFCommValue(e.target.value)} disabled={fCommType === 'None'} />
          </div>
          <div className="field"><label>Expected (Rs.) — from Price &amp; Commission</label><input value={fExpected !== '' ? rupee(fExpected) : ''} disabled /></div>
          <div className="field"><label>Received (Rs.)</label><input type="number" step="any" value={fReceived} onChange={(e) => setFReceived(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Status</label>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Date of settlement</label><input type="date" value={fSettleDate} onChange={(e) => setFSettleDate(e.target.value)} /></div>
          <div className="field"><label>Notes{fStatus === 'Cancelled' ? ' — reason' : ''}</label><input value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder={fStatus === 'Cancelled' ? 'e.g. customer refused delivery' : 'e.g. invoice sent'} /></div>
        </div>
        <button className="btn" onClick={handleLogSettlement}>Log settlement</button>
      </div>

      <div className="tabs-row">
        <div className={`pill ${monthFilter === 'All' ? 'active' : ''}`} onClick={() => setMonthFilter('All')}>All months</div>
        {allMonths.map((m) => (
          <div className={`pill ${monthFilter === m ? 'active' : ''}`} key={m} onClick={() => setMonthFilter(m)}>{m}</div>
        ))}
      </div>
      <div className="tabs-row">
        <div className={`pill ${channelFilter === 'All' ? 'active' : ''}`} onClick={() => setChannelFilter('All')}>All channels</div>
        {CHANNELS.map((c) => (
          <div className={`pill ${channelFilter === c ? 'active' : ''}`} key={c} onClick={() => setChannelFilter(c)}>{c}</div>
        ))}
      </div>
      <div className="tabs-row">
        <div className={`pill ${statusFilter === 'All' ? 'active' : ''}`} onClick={() => setStatusFilter('All')}>All statuses</div>
        {STATUSES.map((s) => (
          <div className={`pill ${statusFilter === s ? 'active' : ''}`} key={s} onClick={() => setStatusFilter(s)}>{s}</div>
        ))}
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
        <div className="stat-card"><div className="stat-num">{rupee(totalExpected)}</div><div className="stat-label">Expected (filtered)</div></div>
        <div className="stat-card"><div className="stat-num">{rupee(totalReceived)}</div><div className="stat-label">Received (filtered)</div></div>
        <div className="stat-card"><div className="stat-num">{rupee(totalPending)}</div><div className="stat-label">Still pending (filtered)</div></div>
        <div className="stat-card"><div className="stat-num">{cancelledCount}</div><div className="stat-label">Cancelled (filtered)</div></div>
      </div>

      <input className="search-input" placeholder="Search by product or marketplace…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 340 }} />

      <div className="mini-note" style={{ marginBottom: 8 }}>
        Commission, Received, Settlement date, and Status are all editable right here — change them anytime as marketplaces actually pay out.
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sale date</th><th>Product</th><th>Size</th><th>Channel</th><th>Gross</th>
              <th>Commission</th><th>Expected</th><th>Received</th><th>Settlement date</th><th>Status</th><th>Notes</th><th>Reason (if cancelled)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={13} className="empty">No settlements match your filters.</td></tr>
            ) : (
              sorted.map((s) => (
                <tr key={s.id}>
                  <td>{s.date_logged}</td>
                  <td>{s.product_name}</td>
                  <td>{s.size}</td>
                  <td>{s.channel}</td>
                  <td>
                    <input
                      key={`gross-${s.id}-${s.gross_amount}`}
                      type="number" step="any" defaultValue={s.gross_amount ?? ''}
                      onBlur={(e) => editField(s, 'gross_amount', e.target.value)}
                      style={{ width: 75, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <select
                        key={`ct-${s.id}-${s.commission_type}`}
                        defaultValue={s.commission_type || 'None'}
                        onChange={(e) => editCommission(s, 'commission_type', e.target.value)}
                        style={{ padding: '4px 4px', border: '1px solid var(--line)', borderRadius: 2, fontSize: 11 }}
                      >
                        <option value="None">None</option>
                        <option value="Percentage">%</option>
                        <option value="Flat">Flat</option>
                      </select>
                      <input
                        key={`cv-${s.id}-${s.commission_value}`}
                        type="number" step="any" defaultValue={s.commission_value ?? ''}
                        onBlur={(e) => editCommission(s, 'commission_value', e.target.value)}
                        disabled={(s.commission_type || 'None') === 'None'}
                        style={{ width: 55, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                      />
                    </div>
                  </td>
                  <td>{rupee(s.expected_amount)}</td>
                  <td>
                    <input
                      key={`recv-${s.id}-${s.received_amount}`}
                      type="number" step="any" defaultValue={s.received_amount ?? ''}
                      onBlur={(e) => editField(s, 'received_amount', e.target.value)}
                      style={{ width: 75, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td>
                    <input
                      key={`sd-${s.id}-${s.settlement_date}`}
                      type="date" defaultValue={s.settlement_date || ''}
                      onBlur={(e) => editField(s, 'settlement_date', e.target.value || null)}
                      style={{ width: 130, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td>
                    <select
                      key={`st-${s.id}-${s.status}`}
                      defaultValue={s.status || 'Pending'}
                      onChange={(e) => (e.target.value === 'Settled' ? markSettled(s) : setStatus(s, e.target.value))}
                      className={`tag ${s.status === 'Settled' ? 'ready' : s.status === 'Partial' || s.status === 'Invoice Sent' ? 'progress' : s.status === 'Cancelled' ? 'reorder' : 'pending'}`}
                      style={{ border: '1px solid var(--line)' }}
                    >
                      {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      key={`notes-${s.id}-${s.notes}`}
                      defaultValue={s.notes || ''}
                      onBlur={(e) => editField(s, 'notes', e.target.value)}
                      placeholder="e.g. invoice sent"
                      style={{ width: 140, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td>
                    <input
                      key={`reason-${s.id}-${s.cancel_reason}`}
                      defaultValue={s.cancel_reason || ''}
                      onBlur={(e) => editField(s, 'cancel_reason', e.target.value)}
                      disabled={s.status !== 'Cancelled'}
                      placeholder={s.status === 'Cancelled' ? 'e.g. customer refused delivery' : '—'}
                      style={{ width: 150, padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 2 }}
                    />
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn secondary small" onClick={() => recalcExpected(s)}>Recalc</button>
                    <button className="btn danger small" onClick={() => handleDelete(s)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={6}>Total ({sorted.length} shown, excludes cancelled)</td>
                <td>{rupee(totalExpected)}</td><td>{rupee(totalReceived)}</td><td colSpan={5}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
