import { useMemo, useState } from 'react';
import { rupee, todayStr, formatTimestamp, productProductionCost, materialTotalIssued, saleGross, saleNet, saleTypeForChannel } from '../lib/calc';
import { updateSettings, recordLastUpdate } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function Home({ data, setRoute, reload, role, brand }) {
  const { toast, promptName } = useUI();
  const { products, materials, productionLog, salesLog, settings, lastUpdate, expenses, settlements, qualityChecks } = data;
  const [budgetInput, setBudgetInput] = useState(settings.daily_labour_budget ?? '');
  const isViewer = role === 'viewer';
  const isAdmin = role === 'admin';

  const today = todayStr();
  const currentMonth = today.slice(0, 7);
  const [filterMode, setFilterMode] = useState('month');
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterDate, setFilterDate] = useState(today);

  const productsForBrand = brand === 'Combined' ? products : products.filter((p) => (p.brand || 'Loma') === brand);
  const materialsForBrand = brand === 'Combined' ? materials : materials.filter((m) => (m.brand || 'Loma') === brand);

  const availableMonths = useMemo(() => {
    const set = new Set();
    [...productionLog, ...salesLog, ...(expenses || [])].forEach((r) => {
      if (r.date) set.add(r.date.slice(0, 7));
    });
    set.add(currentMonth);
    return Array.from(set).sort().reverse();
  }, [productionLog, salesLog, expenses, currentMonth]);

  function matchesPeriod(dateStr) {
    if (!dateStr) return false;
    if (filterMode === 'date') return dateStr === filterDate;
    return dateStr.slice(0, 7) === filterMonth;
  }

  const totalFabrics = materialsForBrand.filter((m) => m.category === 'Fabric').length;

  const brandRows = (rows) => (brand === 'Combined' ? rows || [] : (rows || []).filter((r) => (r.brand || 'Loma') === brand));
  const periodProd = brandRows(productionLog).filter((l) => matchesPeriod(l.date)).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const periodSales = brandRows(salesLog).filter((l) => matchesPeriod(l.date));
  const periodUnits = periodSales.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const periodGross = periodSales.reduce((a, l) => a + (saleGross(l) || 0), 0);
  const periodNet = periodSales.reduce((a, l) => a + (saleNet(l) || 0), 0);
  const periodOnlineNet = periodSales
    .filter((l) => (l.sale_type || saleTypeForChannel(l.channel)) === 'Online')
    .reduce((a, l) => a + (saleNet(l) || 0), 0);
  const periodOfflineNet = periodSales
    .filter((l) => (l.sale_type || saleTypeForChannel(l.channel)) === 'Offline')
    .reduce((a, l) => a + (saleNet(l) || 0), 0);

  const periodExpenses = (expenses || []).filter((e) => matchesPeriod(e.date));
  const periodExpenseTotal = periodExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);

  const lastExpense = [...(expenses || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  const daysSinceExpense = lastExpense ? Math.round((new Date(today) - new Date(lastExpense.date)) / 86400000) : null;
  const expenseStale = daysSinceExpense == null || daysSinceExpense >= 2;

  const reorderCount = useMemo(() => {
    return materialsForBrand.filter((m) => {
      if (m.stock == null) return false;
      const used = materialTotalIssued(m, products, productionLog);
      const current = Number(m.stock) - used;
      return m.reorder_level != null && current <= Number(m.reorder_level);
    }).length;
  }, [materialsForBrand, products, productionLog]);

  const missingCost = productsForBrand.filter((p) => productProductionCost(p, settings.daily_labour_budget) == null).length;

  const recentProd = [...brandRows(productionLog)].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
  const recentSales = [...brandRows(salesLog)].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);

  const activeSettlements = (settlements || []).filter((s) => (s.status || 'Pending') !== 'Cancelled');
  const settledList = activeSettlements.filter((s) => s.status === 'Settled');
  const settledCount = settledList.length;
  const settledTotal = settledList.reduce((a, s) => a + (Number(s.received_amount) || 0), 0);
  const pendingList = activeSettlements.filter((s) => (s.status || 'Pending') !== 'Settled');
  const pendingCount = pendingList.length;
  const pendingTotal = pendingList.reduce((a, s) => a + ((Number(s.expected_amount) || 0) - (Number(s.received_amount) || 0)), 0);


  // ---------- Needs attention ----------
  const byBrand = brandRows;
  const daysAgo = (d) => (d ? Math.round((new Date(today) - new Date(d.slice(0, 10))) / 86400000) : null);

  const qcPending = byBrand(qualityChecks).filter((q) => (q.overall_result || 'Pending') === 'Pending');
  const qcOld = qcPending.filter((q) => (daysAgo(q.date) ?? 0) > 3).length;

  const brandPending = byBrand(activeSettlements).filter((s) => (s.status || 'Pending') !== 'Settled');
  const brandPendingTotal = brandPending.reduce((a, s) => a + ((Number(s.expected_amount) || 0) - (Number(s.received_amount) || 0)), 0);
  const pendingOld = brandPending.filter((s) => (daysAgo(s.date_logged) ?? 0) > 30).length;

  const brandSales = byBrand(salesLog);
  const lastSaleFor = {};
  brandSales.forEach((l) => {
    const k = l.product_id || l.product_name;
    if (!lastSaleFor[k] || (l.date || '') > lastSaleFor[k]) lastSaleFor[k] = l.date || '';
    if (l.product_name && (!lastSaleFor[l.product_name] || (l.date || '') > lastSaleFor[l.product_name])) lastSaleFor[l.product_name] = l.date || '';
  });
  const lastSale = (p) => [lastSaleFor[p.id], lastSaleFor[p.name]].filter(Boolean).sort().pop() || null;

  // Styles that sold in the last 60 days but have one or more sizes at 0.
  const soldOut = [];
  let soldOutSizes = 0;
  productsForBrand.forEach((p) => {
    const ls = lastSale(p);
    if (!ls || daysAgo(ls) > 60) return;
    const out = (p.sizes || []).filter((sz) => (Number(sz.stock) || 0) <= 0).map((sz) => sz.size);
    if (out.length) { soldOut.push(`${p.name.split('|')[0].trim()} (${out.join(', ')})`); soldOutSizes += out.length; }
  });

  const slowMovers = productsForBrand
    .filter((p) => (p.sizes || []).reduce((a, sz) => a + (Number(sz.stock) || 0), 0) > 0)
    .filter((p) => { const ls = lastSale(p); return !ls || daysAgo(ls) > 45; });

  const shortName = (n) => (n || '').split('|')[0].trim();
  const alerts = [];
  if (!isViewer) {
    if (qcPending.length) alerts.push({
      tone: qcOld ? 'warn' : 'info', route: 'qualitycheck', title: `${qcPending.length} quality check${qcPending.length === 1 ? '' : 's'} pending`,
      detail: qcOld ? `${qcOld} waiting more than 3 days` : 'All logged in the last 3 days', cta: 'Open Quality Check',
    });
    if (isAdmin && brandPending.length) alerts.push({
      tone: pendingOld ? 'warn' : 'info', route: 'settlements', title: `${rupee(brandPendingTotal)} waiting to be settled`,
      detail: `${brandPending.length} order${brandPending.length === 1 ? '' : 's'}${pendingOld ? ` · ${pendingOld} older than 30 days` : ''}`, cta: 'Open Settlements',
    });
    if (soldOut.length) alerts.push({
      tone: 'warn', route: 'stockcheck', title: `${soldOut.length} selling style${soldOut.length === 1 ? ' has' : 's have'} sizes out of stock`,
      detail: `${soldOutSizes} sizes at 0 · ` + soldOut.slice(0, 2).join('; ') + (soldOut.length > 2 ? ` +${soldOut.length - 2} more` : ''), cta: 'Open Stock Check',
    });
    if (slowMovers.length) alerts.push({
      tone: 'info', route: 'products', title: `${slowMovers.length} style${slowMovers.length === 1 ? '' : 's'} with no sale in 45 days`,
      detail: slowMovers.slice(0, 3).map((p) => shortName(p.name)).join(', ') + (slowMovers.length > 3 ? ` +${slowMovers.length - 3} more` : ''), cta: 'Open Products',
    });
    if (expenseStale) alerts.push({
      tone: 'warn', route: 'expenses', title: lastExpense ? `No expense logged for ${daysSinceExpense} day${daysSinceExpense === 1 ? '' : 's'}` : 'No expenses logged yet',
      detail: lastExpense ? `Last entry ${lastExpense.date}` : 'Start logging spend', cta: 'Open Expenses',
    });
    if (missingCost) alerts.push({
      tone: 'info', route: 'products', title: `${missingCost} product${missingCost === 1 ? '' : 's'} missing cost data`,
      detail: 'Margins can’t be calculated for these', cta: 'Open Products',
    });
    if (reorderCount) alerts.push({
      tone: 'warn', route: 'stock', title: `${reorderCount} material${reorderCount === 1 ? '' : 's'} to reorder`,
      detail: 'At or below the reorder level', cta: 'Open Stock',
    });
  }

  async function saveBudget() {
    const newBudget = budgetInput === '' ? null : Number(budgetInput);
    const name = await promptName(`Changing daily labour budget to ${newBudget != null ? 'Rs.' + newBudget : 'blank'}`);
    if (name == null) return;
    await updateSettings(newBudget);
    await recordLastUpdate(name, `Changed daily labour budget to ${newBudget != null ? 'Rs.' + newBudget : 'blank'}`);
    toast('Daily labour budget updated — every product recalculates.');
    reload();
  }

  const brandName = brand === 'Combined' ? 'Lõma + Sauca' : brand === 'Loma' ? 'Lõma' : brand;

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Home</h1>
          <div className="page-sub">{brandName} · everything at a glance</div>
        </div>
      </div>

      {!isViewer && (
        <section className="attention" aria-label="Needs attention">
          <p className="section-title">Needs attention</p>
          {alerts.length === 0 ? (
            <div className="card all-clear">All clear — nothing needs you right now.</div>
          ) : (
            <div className="alert-grid">
              {alerts.map((a) => (
                <button key={a.title} className={`alert-card ${a.tone}`} onClick={() => setRoute(a.route)}>
                  <span className="alert-title">{a.title}</span>
                  <span className="alert-detail">{a.detail}</span>
                  <span className="alert-cta">{a.cta} →</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="period-bar">
        <p className="section-title" style={{ margin: 0 }}>Numbers for</p>
        <select
          className="month-select"
          aria-label="Dashboard month"
          value={filterMode === 'month' ? filterMonth : ''}
          onChange={(e) => { if (e.target.value) { setFilterMode('month'); setFilterMonth(e.target.value); } }}
        >
          {filterMode === 'date' && <option value="">Exact date</option>}
          {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <label className="inline-date">
          or a day
          <input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setFilterMode('date'); }} />
        </label>
        {filterMode === 'date' && (
          <button className="btn secondary small" onClick={() => setFilterMode('month')}>Back to month</button>
        )}
      </div>

      <div className="grid-cards">
        {!isViewer && <Stat num={rupee(periodNet)} label="Net sales" sub={`Gross ${rupee(periodGross)}`} strong />}
        <Stat num={periodUnits} label="Units sold" />
        {!isViewer && <Stat num={rupee(periodExpenseTotal)} label="Expenses" sub={`${periodExpenses.length} entries · both brands`} />}
        <Stat num={periodProd} label="Pieces made" />
        {!isViewer && <Stat num={rupee(periodOnlineNet)} label="Online net" sub="Myntra, Nykaa, Shopify, other" />}
        {!isViewer && <Stat num={rupee(periodOfflineNet)} label="Offline net" sub="Coyu, popups, our store" />}
        <Stat num={productsForBrand.length} label="Products" sub={`${totalFabrics} fabrics tracked`} />
      </div>

      {!isViewer && (
        <div className="two-col" style={{ marginBottom: 18 }}>
          <div className="card">
            <p className="section-title">Recent sales</p>
            {recentSales.length === 0 ? (
              <div className="empty">No sales logged yet.</div>
            ) : (
              recentSales.map((l) => (
                <div className="activity-row" key={l.id}>
                  <span>
                    <span className="muted">{l.date}</span> {l.product_name} ({l.size})
                  </span>
                  <span className="num">
                    {l.channel} · {rupee(saleNet(l))}
                  </span>
                </div>
              ))
            )}
            <div style={{ marginTop: 10 }}>
              <button className="link-btn" onClick={() => setRoute('sales')}>Go to Sales →</button>
            </div>
          </div>
          <div className="card">
            <p className="section-title">Recent production</p>
            {recentProd.length === 0 ? (
              <div className="empty">No production logged yet.</div>
            ) : (
              recentProd.map((l) => (
                <div className="activity-row" key={l.id}>
                  <span>
                    <span className="muted">{l.date}</span> {l.product_name} ({l.size})
                  </span>
                  <span className={`tag ${l.status === 'Ready' ? 'ready' : l.status === 'In Progress' ? 'progress' : 'pending'}`}>
                    {l.status} × {l.qty}
                  </span>
                </div>
              ))
            )}
            <div style={{ marginTop: 10 }}>
              <button className="link-btn" onClick={() => setRoute('production')}>Go to Production Log →</button>
            </div>
          </div>
        </div>
      )}

      <div className="two-col">
        {isAdmin && (
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => setRoute('settlements')}>
            <p className="section-title">Settlements — all time, both brands</p>
            <div className="kv"><span>Settled</span><strong className="num">{settledCount} · {rupee(settledTotal)}</strong></div>
            <div className="kv"><span>Pending</span><strong className="num" style={{ color: 'var(--rust)' }}>{pendingCount} · {rupee(pendingTotal)}</strong></div>
            <div className="link-btn" style={{ marginTop: 8, display: 'inline-block' }}>Go to Settlements →</div>
          </div>
        )}
        <div className="card">
          <p className="section-title">Last updated</p>
          {lastUpdate ? (
            <div style={{ fontSize: 14 }}>
              <strong>{lastUpdate.name}</strong> — {lastUpdate.what}{' '}
              <span className="muted">· {formatTimestamp(lastUpdate.ts)}</span>
            </div>
          ) : (
            <div className="empty" style={{ padding: '6px 0' }}>
              No updates logged yet — this fills in the next time someone saves a product or raw material.
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <details className="card fold" style={{ marginTop: 18 }}>
          <summary className="section-title">Settings · daily labour budget</summary>
          <div className="mini-note" style={{ marginBottom: 8 }}>
            Shared across every product's labour cost, both brands — change it as your tailor headcount or wages change,
            and every product recalculates.
          </div>
          <div className="field-row" style={{ alignItems: 'flex-end', maxWidth: 360 }}>
            <div className="field">
              <label>Rs. per day</label>
              <input type="number" step="any" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="e.g. 1100" />
            </div>
            <button className="btn secondary small" style={{ marginBottom: 12 }} onClick={saveBudget}>
              Save
            </button>
          </div>
        </details>
      )}
    </div>
  );
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function Stat({ num, label, sub, strong }) {
  return (
    <div className={`stat-card ${strong ? 'strong' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-num">{num}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
