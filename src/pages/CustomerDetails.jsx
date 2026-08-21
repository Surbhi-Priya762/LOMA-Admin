import { useState } from 'react';
import { todayStr, uid, exportToExcel } from '../lib/calc';
import { addCustomerDetail, deleteCustomerDetail } from '../lib/api';
import { useUI } from '../context/UIContext';

const SOURCES = ['Popup', 'Shopify', 'Our Store / Studio', 'Other'];

export default function CustomerDetails({ data, reload }) {
  const { toast, confirm } = useUI();
  const { customerDetails } = data;
  const [sourceFilter, setSourceFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [date, setDate] = useState(todayStr());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [source, setSource] = useState(SOURCES[0]);
  const [productBought, setProductBought] = useState('');
  const [notes, setNotes] = useState('');

  const q = search.toLowerCase();
  const filtered = (customerDetails || []).filter((c) => {
    if (sourceFilter !== 'All' && c.source !== sourceFilter) return false;
    if (q && !(c.name || '').toLowerCase().includes(q) && !(c.phone || '').toLowerCase().includes(q) && !(c.email || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  async function handleSubmit() {
    if (!name.trim()) { toast('Enter the customer name.'); return; }
    await addCustomerDetail({
      id: uid('cust'), date, name: name.trim(), phone: phone.trim(), email: email.trim(),
      address: address.trim(), source, product_bought: productBought.trim(), notes: notes.trim(),
    });
    toast('Customer added.');
    setName(''); setPhone(''); setEmail(''); setAddress(''); setProductBought(''); setNotes('');
    reload();
  }

  async function handleDelete(entry) {
    const ok = await confirm(`Delete "${entry.name}"?`, 'Delete');
    if (!ok) return;
    await deleteCustomerDetail(entry.id);
    toast('Customer deleted.');
    reload();
  }

  function handleExport() {
    exportToExcel(
      sorted,
      [
        { key: 'date', label: 'Date' },
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'address', label: 'Address' },
        { key: 'source', label: 'Source' },
        { key: 'product_bought', label: 'Product bought' },
        { key: 'notes', label: 'Notes' },
      ],
      `loma-customers-${todayStr()}.csv`
    );
    toast('Customer list exported — opens directly in Excel.');
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Customer Details</h1>
          <div className="page-sub">Every customer, wherever they came from — Popup, Shopify, Our Store, or anywhere else</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={handleExport}>⬇ Download as Excel</button>
        </div>
      </div>

      <div className="tabs-row">
        <div className={`pill ${sourceFilter === 'All' ? 'active' : ''}`} onClick={() => setSourceFilter('All')}>All sources</div>
        {SOURCES.map((s) => (
          <div className={`pill ${sourceFilter === s ? 'active' : ''}`} key={s} onClick={() => setSourceFilter(s)}>{s}</div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">Add a customer</p>
        <div className="field-row">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field" style={{ flex: 1.5 }}><label>Address</label><input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="field">
            <label>Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Product bought</label><input value={productBought} onChange={(e) => setProductBought(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. repeat customer, prefers size M" />
        </div>
        <button className="btn" onClick={handleSubmit}>Add customer</button>
      </div>

      <input className="search-input" placeholder="Search by name, phone, or email…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, width: '100%', maxWidth: 340 }} />

      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Source</th><th>Product bought</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={9} className="empty">No customers match your filters.</td></tr>
            ) : (
              sorted.map((c) => (
                <tr key={c.id}>
                  <td>{c.date}</td><td>{c.name}</td><td>{c.phone}</td><td>{c.email}</td>
                  <td>{c.address}</td><td>{c.source}</td><td>{c.product_bought}</td><td>{c.notes}</td>
                  <td><button className="btn danger small" onClick={() => handleDelete(c)}>Delete</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
