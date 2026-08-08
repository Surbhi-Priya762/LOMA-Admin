import { useMemo, useState } from 'react';
import { rupee, todayStr, formatTimestamp, productProductionCost, materialTotalIssued, saleGross, saleNet, saleTypeForChannel } from '../lib/calc';
import { updateSettings, recordLastUpdate } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function Home({ data, setRoute, reload, role }) {
  const { toast, promptName } = useUI();
  const { products, materials, productionLog, salesLog, settings, lastUpdate, expenses } = data;
  const [budgetInput, setBudgetInput] = useState(settings.daily_labour_budget ?? '');

  const today = todayStr();
  const thisMonth = today.slice(0, 7);

  const totalFabrics = materials.filter((m) => m.category === 'Fabric').length;
  const todaysProd = productionLog.filter((l) => l.date === today).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const todaysSales = salesLog.filter((l) => l.date === today);
  const todaysRevenue = todaysSales.reduce((a, l) => a + (saleNet(l) || 0), 0);
  const monthSales = salesLog.filter((l) => (l.date || '').slice(0, 7) === thisMonth);
  const monthUnits = monthSales.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const monthGross = monthSales.reduce((a, l) => a + (saleGross(l) || 0), 0);
  const monthNet = monthSales.reduce((a, l) => a + (saleNet(l) || 0), 0);
  const monthOnlineNet = monthSales
    .filter((l) => (l.sale_type || saleTypeForChannel(l.channel)) === 'Online')
    .reduce((a, l) => a + (saleNet(l) || 0), 0);
  const monthOfflineNet = monthSales
    .filter((l) => (l.sale_type || saleTypeForChannel(l.channel)) === 'Offline')
    .reduce((a, l) => a + (saleNet(l) || 0), 0);

  const monthExpenses = (expenses || []).filter((e) => (e.date || '').slice(0, 7) === thisMonth);
  const monthExpenseTotal = monthExpenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const lastExpense = [...(expenses || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  const daysSinceExpense = lastExpense ? Math.round((new Date(today) - new Date(lastExpense.date)) / 86400000) : null;
  const expenseStale = daysSinceExpense == null || daysSinceExpense >= 2;

  const reorderCount = useMemo(() => {
    return materials.filter((m) => {
      if (m.stock == null) return false;
      const used = materialTotalIssued(m, products, productionLog);
      const current = Number(m.stock) - used;
      return m.reorder_level != null && current <= Number(m.reorder_level);
    }).length;
  }, [materials, products, productionLog]);

  const missingCost = products.filter((p) => productProductionCost(p, settings.daily_labour_budget) == null).length;

  const recentProd = [...productionLog].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
  const recentSales = [...salesLog].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);

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
          <p className="section-title">Expenses</p>
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
          <div className="mini-note" style={{ marginTop: 4 }}>This month so far: {rupee(monthExpenseTotal)} across {monthExpenses.length} entries.</div>
          <div style={{ marginTop: 8 }}>
            <button className="link-btn" onClick={() => setRoute('expenses')}>Go to Expenses →</button>
          </div>
        </div>
      )}

      {role !== 'viewer' && (
        <div className="card" style={{ marginBottom: 18 }}>
          <p className="section-title">Daily labour budget</p>
          <div className="mini-note" style={{ marginBottom: 8 }}>
            Shared across every product's labour cost — change it here as your tailor headcount or wages change,
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
        <Stat num={products.length} label="Products" />
        <Stat num={totalFabrics} label="Fabrics tracked" />
        <Stat num={todaysProd} label="Pieces logged today" />
        {role !== 'viewer' && <Stat num={rupee(todaysRevenue)} label="Net revenue today" />}
        <Stat num={monthUnits} label={`Units sold this month (${thisMonth})`} />
        {role !== 'viewer' && <Stat num={rupee(monthGross)} label="Gross sale this month" />}
        {role !== 'viewer' && <Stat num={rupee(monthNet)} label="Net sale this month" />}
        {role !== 'viewer' && <Stat num={rupee(monthOnlineNet)} label="Online sales this month (Myntra, Nykaa, Shopify, Other)" />}
        {role !== 'viewer' && <Stat num={rupee(monthOfflineNet)} label="Offline sales this month (Coyu Store, Popup, Our Store)" />}
        {role !== 'viewer' && <Stat num={rupee(monthExpenseTotal)} label="Expenses this month" />}
        <Stat num={reorderCount} label="Materials to reorder" flag={reorderCount > 0 ? 'Check Stock page' : null} />
        {role !== 'viewer' && <Stat num={missingCost} label="Products missing cost data" flag={missingCost > 0 ? 'Fill in Products page' : null} />}
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
