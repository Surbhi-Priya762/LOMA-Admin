import { useState } from 'react';
import { todayStr, rupee, uid } from '../lib/calc';
import { addExpense, deleteExpense } from '../lib/api';
import { useUI } from '../context/UIContext';

const COMPANY = 'Sauca Design LLP';
const CATEGORIES = [
  'Marketing & Ads', 'Vendor/Production & Fabric', 'Logistics & Shipping', 'Software & Subscriptions',
  'Marketplace Fees & Commission', 'Office & Admin', 'Travel & Reimbursement', 'Professional/Contractor Fees',
  'Salaries & Payroll', 'Miscellaneous',
];
const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Card', 'Cash', 'Cheque', 'Other'];

export default function Expenses({ data, reload }) {
  const { toast, confirm } = useUI();
  const { expenses } = data;
  const [monthFilter, setMonthFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [date, setDate] = useState(todayStr());
  const brand = COMPANY;
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Other');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [gst, setGst] = useState('Y');
  const [notes, setNotes] = useState('');

  const allMonths = Array.from(new Set(expenses.map((e) => (e.date || '').slice(0, 7)))).filter(Boolean).sort().reverse();
  const q = search.toLowerCase();
  const filtered = expenses.filter((e) => {
    if (monthFilter !== 'All' && (e.date || '').slice(0, 7) !== monthFilter) return false;
    if (q && !(e.vendor || '').toLowerCase().includes(q) && !(e.category || '').toLowerCase().includes(q) && !(e.description || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const total = filtered.reduce((a, e) => a + (Number(e.amount) || 0), 0);

  const byCategory = {};
  filtered.forEach((e) => {
    byCategory[e.category || 'Uncategorised'] = (byCategory[e.category || 'Uncategorised'] || 0) + (Number(e.amount) || 0);
  });

  async function handleSubmit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast('Enter a valid amount.'); return; }
    const entry = {
      id: uid('exp'), date, brand, category, vendor: vendor.trim(), description: description.trim(),
      amount: amt, payment_mode: paymentMode, invoice_ref: invoiceRef.trim(), gst_applicable: gst, notes: notes.trim(),
    };
    await addExpense(entry);
    toast('Expense logged.');
    setVendor(''); setDescription(''); setAmount(''); setInvoiceRef(''); setNotes('');
    reload();
  }

  async function handleDelete(e) {
    const ok = await confirm(`Delete this expense — "${e.vendor || e.category}" (${rupee(e.amount)})?`, 'Delete');
    if (!ok) return;
    await deleteExpense(e.id);
    toast('Expense deleted.');
    reload();
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Expenses</h1>
          <div className="page-sub">Track Sauca &amp; Loma spend by category — nobody has to remember to update this if the Home page keeps flagging it</div>
        </div>
      </div>

      <div className="tabs-row">
        <div className={`pill ${monthFilter === 'All' ? 'active' : ''}`} onClick={() => setMonthFilter('All')}>All months</div>
        {allMonths.map((m) => (
          <div className={`pill ${monthFilter === m ? 'active' : ''}`} key={m} onClick={() => setMonthFilter(m)}>{m}</div>
        ))}
      </div>

      <div className="grid-cards">
        <div className="stat-card"><div className="stat-num">{rupee(total)}</div><div className="stat-label">Total (filtered)</div></div>
        {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => (
          <div className="stat-card" key={cat}><div className="stat-num" style={{ fontSize: 18 }}>{rupee(amt)}</div><div className="stat-label">{cat}</div></div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">Log an expense</p>
        <div className="mini-note" style={{ marginBottom: 10 }}>Recorded under {COMPANY}.</div>
        <div className="field-row">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="field"><label>Amount (Rs.)</label><input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Vendor / Payee</label><input value={vendor} onChange={(e) => setVendor(e.target.value)} /></div>
          <div className="field"><label>Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="field">
            <label>Payment mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>{PAYMENT_MODES.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
        </div>
        <div className="field-row">
          <div className="field"><label>Invoice / Ref no.</label><input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} /></div>
          <div className="field">
            <label>GST applicable</label>
            <select value={gst} onChange={(e) => setGst(e.target.value)}><option value="Y">Y</option><option value="N">N</option></select>
          </div>
          <div className="field"><label>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <button className="btn" onClick={handleSubmit}>Log expense</button>
      </div>

      <input className="search-input" placeholder="Search vendor, category, or description…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 340 }} />

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Brand</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Payment</th><th>GST</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={10} className="empty">No expenses match your filters.</td></tr>
            ) : (
              sorted.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td><td>{e.brand}</td><td>{e.category}</td><td>{e.vendor}</td><td>{e.description}</td>
                  <td>{rupee(e.amount)}</td><td>{e.payment_mode}</td><td>{e.gst_applicable}</td><td>{e.notes}</td>
                  <td><button className="btn danger small" onClick={() => handleDelete(e)}>Delete</button></td>
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot><tr><td colSpan={5}>Total ({sorted.length} entries)</td><td>{rupee(total)}</td><td colSpan={4}></td></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
