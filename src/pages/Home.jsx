import { useMemo, useState } from 'react';
import { rupee, todayStr, formatTimestamp, productProductionCost, materialTotalIssued, saleGross, saleNet, saleTypeForChannel } from '../lib/calc';
import { updateSettings, recordLastUpdate } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function Home({ data, setRoute, reload, role, brand, setBrand }) {
  const { toast, promptName } = useUI();
  const { products, materials, productionLog, salesLog, settings, lastUpdate, expenses, settlements } = data;
  const [budgetInput, setBudgetInput] = useState(settings.daily_labour_budget ?? '');

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
  const periodLabel = filterMode === 'date' ? filterDate : filterMonth;

  const totalFabrics = materialsForBrand.filter((m) => m.category === 'Fabric').length;

  // Sales/Production/Settlements don't have a brand field yet (Stage 2) — these numbers
  // are combined across both brands until that's built.
  const periodProd = productionLog.filter((l) => matchesPeriod(l.date)).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const periodSales = salesLog.filter((l) => matchesPeriod(l.date));
  const periodUnits = periodSales.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const periodGross = periodSales.reduce((a, l) => a + (saleGross(l) || 0), 0);
  const periodNet = periodSales.reduce((a, l) => a + (saleNet(l) || 0), 0);
  const periodOnlineNet = periodSales
    .filter((l) => (l.sale_type || saleTypeForChannel(l.channel)) === 'Online')
    .reduce((a, l) => a + (saleNet(l) || 0), 0);
  const periodOfflineNet = periodSales
    .filter((l) => (l.sale_type || saleTypeForChannel(l.channel)) === 'Offline')
    .reduce((a, l) => a + (saleNet(l) || 0), 0);

  // Expenses are shared/common across both brands by design.
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

  const recentProd = [...productionLog].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
  const recentSales = [...salesLog].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);

  const activeSettlements = (settlements || []).filter((s) => (s.status || 'Pending') !== 'Cancelled');
  const settledList = activeSettlements.filter((s) => s.status === 'Settled');
  const settledCount = settledList.length;
  const settledTotal = settledList.reduce((a, s) => a + (Number(s.received_amount) || 0), 0);
  const pendingList = activeSettlements.filter((s) => (s.status || 'Pending') !== 'Settled');
  const pendingCount = pendingList.length;
  const pendingTotal = pendingList.reduce((a, s) => a + ((Number(s.expected_amount) || 0) - (Number(s.received_amount) || 0)), 0);

  async function saveBudget() {
    const newBudget = budgetInput === '' ? null : Number(budgetInput);
    const name = await promptName(`Changing daily labour budget to ${newBudget != null ? 'Rs.' + newBudget : 'blank'}`);
    if (name == null) return;
    await updateSettings(newBudget);
    await recordLastUpdate(name, `Changed daily labour budget to ${newBudget != null ? 'Rs.' + newBudget : 'blank'}`);
    toast('Daily labour budget updated — every product recalculates.');
    reload();
  }

  return (
    <div>
      <div className="topline">
        <div>
          <h1 className="page-title">Home</h1>
          <div className="page-sub">Everything at a glance — Lõma production &amp; inventory</div>
        </div>
        {role !== 'viewer' && (
          <div
            className="card"
            style={{ width: 220, flex: '0 0 220px', borderColor: 'var(--brass)', cursor: 'pointer' }}
            onClick={() => setRoute('settlements')}
          >
            <p className="section-title" style={{ marginBottom: 8 }}>Settlements — overall</p>
            <div className="mini-note" style={{ marginBottom: 8 }}>Not tied to the month filter below — this is everything, always.</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
              <span>Settled</span><strong>{settledCount} · {rupee(settledTotal)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Pending</span><strong style={{ color: 'var(--rust)' }}>{pendingCount} · {rupee(pendingTotal)}</strong>
            </div>
            <div className="link-btn" style={{ marginTop: 8, display: 'inline-block' }}>Go to Settlements →</div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18, borderColor: 'var(--brass)' }}>
        <p className="section-title">Brand</p>
        <div className="mini-note" style={{ marginBottom: 10 }}>Pick which brand's products, stock, and dashboard you want to see. Expenses and labour budget stay shared across both.</div>
        <div className="tabs-row" style={{ marginBottom: 0 }}>
          {['Loma', 'Sauca', 'Combined'].map((b) => (
            <div key={b} className={`pill ${brand === b ? 'active' : ''}`} onClick={() => setBrand(b)}>{b}</div>
          ))}
        </div>
        {brand !== 'Combined' && (
          <div className="mini-note" style={{ marginTop: 8 }}>
            Sales, Production Log, and Settlements below still show combined numbers across both brands for now — that split is coming next.
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="section-title">Dashboard period</p>
        <div className="mini-note" style={{ marginBottom: 10 }}>All the numbers below (except Products/Fabrics/reorder counts, and the Settlements box above) follow this — pick a month, or an exact date.</div>
        <div className="tabs-row">
          {availableMonths.map((m) => (
            <div
              key={m}
              className={`pill ${filterMode === 'month' && filterMonth === m ? 'active' : ''}`}
              onClick={() => { setFilterMode('month'); setFilterMonth(m); }}
            >
              {m}
            </div>
          ))}
        </div>
        <div className="field-row" style={{ maxWidth: 260, alignItems: 'flex-end' }}>
          <div className="field">
            <label>Or an exact date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setFilterMode('date'); }}
            />
          </div>
          {filterMode === 'date' && (
            <button className="btn secondary small" onClick={() => setFilterMode('month')}>Back to month view</button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="section-title">Last updated</p>
        {lastUpdate ? (
          <div style={{ fontSize: 13.5 }}>
            <strong>{lastUpdate.name}</strong> — {lastUpdate.what}{' '}
            <span style={{ color: 'var(--ink-soft)' }}>· {formatTimestamp(lastUpdate.ts)}</span>
          </div>
        ) : (
          <div className="empty" style={{ padding: '6px 0' }}>
            No updates logged yet — this fills in the next time someone saves a product or raw material.
          </div>
        )}
      </div>

      {role !== 'viewer' && (
        <div className="card" style={{ marginBottom: 18, borderColor: expenseStale ? 'var(--rust)' : 'var(--line)' }}>
          <p className="section-title">Expenses (shared — both brands)</p>
          <div style={{ fontSize: 13.5 }}>
            {lastExpense ? (
              <>
                Last entry: <strong>{lastExpense.date}</strong> ({daysSinceExpense === 0 ? 'today' : `${daysSinceExpense} day${daysSinceExpense === 1 ? '' : 's'} ago`})
                {expenseStale && <span style={{ color: 'var(--rust)', fontWeight: 600 }}> — nobody's updated this in a while, nudge the group.</span>}
              </>
            ) : (
              <span style={{ color: 'var(--rust)' }}>No expenses logged yet.</span>
            )}
          </div>
          <div className="mini-note" style={{ marginTop: 4 }}>For {periodLabel}: {rupee(periodExpenseTotal)} across {periodExpenses.length} entries.</div>
          <div style={{ marginTop: 8 }}>
            <button className="link-btn" onClick={() => setRoute('expenses')}>Go to Expenses →</button>
          </div>
        </div>
      )}

      {role !== 'viewer' && (
        <div className="card" style={{ marginBottom: 18 }}>
          <p className="section-title">Daily labour budget (shared — both brands)</p>
          <div className="mini-note" style={{ marginBottom: 8 }}>
            Shared across every product's labour cost, both brands — change it here as your tailor headcount or wages change,
            and every product recalculates.
          </div>
          <div className="field-row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ maxWidth: 200 }}>
              <label>Rs. per day</label>
              <input type="number" step="any" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="e.g. 1100" />
            </div>
            <button className="btn secondary small" onClick={saveBudget}>
              Save
            </button>
          </div>
        </div>
      )}

      <div className="grid-cards">
        <Stat num={productsForBrand.length} label={`Products${brand !== 'Combined' ? ' — ' + brand : ''}`} />
        <Stat num={totalFabrics} label={`Fabrics tracked${brand !== 'Combined' ? ' — ' + brand : ''}`} />
        <Stat num={periodProd} label={`Pieces logged — ${periodLabel}`} />
        <Stat num={periodUnits} label={`Units sold — ${periodLabel}`} />
        {role !== 'viewer' && <Stat num={rupee(periodGross)} label={`Gross sale — ${periodLabel}`} />}
        {role !== 'viewer' && <Stat num={rupee(periodNet)} label={`Net sale — ${periodLabel}`} />}
        {role !== 'viewer' && <Stat num={rupee(periodOnlineNet)} label="Online sales (Myntra, Nykaa, Shopify, Other)" />}
        {role !== 'viewer' && <Stat num={rupee(periodOfflineNet)} label="Offline sales (Coyu Store, Popup, Our Store)" />}
        {role !== 'viewer' && <Stat num={rupee(periodExpenseTotal)} label={`Expenses — ${periodLabel}`} />}
        <Stat num={reorderCount} label={`Materials to reorder${brand !== 'Combined' ? ' — ' + brand : ''}`} flag={reorderCount > 0 ? 'Check Stock page' : null} />
        {role !== 'viewer' && <Stat num={missingCost} label={`Products missing cost data${brand !== 'Combined' ? ' — ' + brand : ''}`} flag={missingCost > 0 ? 'Fill in Products page' : null} />}
      </div>

      {role !== 'viewer' && (
        <div className="two-col">
          <div className="card">
            <p className="section-title">Recent production</p>
            {recentProd.length === 0 ? (
              <div className="empty">No production logged yet.</div>
            ) : (
              recentProd.map((l) => (
                <div className="activity-row" key={l.id}>
                  <span>
                    {l.date} — {l.product_name} ({l.size})
                  </span>
                  <span className={`tag ${l.status === 'Ready' ? 'ready' : l.status === 'In Progress' ? 'progress' : 'pending'}`}>
                    {l.status} × {l.qty}
                  </span>
                </div>
              ))
            )}
            <div style={{ marginTop: 10 }}>
              <button className="link-btn" onClick={() => setRoute('production')}>
                Go to Production Log →
              </button>
            </div>
          </div>
          <div className="card">
            <p className="section-title">Recent sales</p>
            {recentSales.length === 0 ? (
              <div className="empty">No sales logged yet.</div>
            ) : (
              recentSales.map((l) => (
                <div className="activity-row" key={l.id}>
                  <span>
                    {l.date} — {l.product_name} ({l.size})
                  </span>
                  <span>
                    {l.channel} · {rupee(saleNet(l))}
                  </span>
                </div>
              ))
            )}
            <div style={{ marginTop: 10 }}>
              <button className="link-btn" onClick={() => setRoute('sales')}>
                Go to Sales →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ num, label, flag }) {
  return (
    <div className="stat-card">
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
      {flag && <div className="stat-flag">{flag}</div>}
    </div>
  );
}
