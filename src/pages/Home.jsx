import { useMemo, useState } from 'react';
import { rupee, todayStr, formatTimestamp, productProductionCost, materialTotalIssued } from '../lib/calc';
import { updateSettings, recordLastUpdate } from '../lib/api';
import { useUI } from '../context/UIContext';

export default function Home({ data, setRoute, reload }) {
  const { toast, promptName } = useUI();
  const { products, materials, productionLog, salesLog, settings, lastUpdate } = data;
  const [budgetInput, setBudgetInput] = useState(settings.daily_labour_budget ?? '');

  const today = todayStr();
  const thisMonth = today.slice(0, 7);

  const totalFabrics = materials.filter((m) => m.category === 'Fabric').length;
  const todaysProd = productionLog.filter((l) => l.date === today).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const todaysSales = salesLog.filter((l) => l.date === today);
  const todaysRevenue = todaysSales.reduce((a, l) => a + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
  const monthSales = salesLog.filter((l) => (l.date || '').slice(0, 7) === thisMonth);
  const monthUnits = monthSales.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const monthRevenue = monthSales.reduce((a, l) => a + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);

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

      <div className="grid-cards">
        <Stat num={products.length} label="Products" />
        <Stat num={totalFabrics} label="Fabrics tracked" />
        <Stat num={todaysProd} label="Pieces logged today" />
        <Stat num={rupee(todaysRevenue)} label="Revenue today" />
        <Stat num={monthUnits} label={`Units sold this month (${thisMonth})`} />
        <Stat num={rupee(monthRevenue)} label="Net revenue this month" />
        <Stat num={reorderCount} label="Materials to reorder" flag={reorderCount > 0 ? 'Check Stock page' : null} />
        <Stat num={missingCost} label="Products missing cost data" flag={missingCost > 0 ? 'Fill in Products page' : null} />
      </div>

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
                  {l.channel} · {rupee(l.price)}
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
