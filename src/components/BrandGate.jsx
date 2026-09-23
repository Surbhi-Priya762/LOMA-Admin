// Shown on pages that only ever display one brand at a time when "Combined" is selected.
export default function BrandGate({ brand, setBrand, pageName, children }) {
  if (brand === 'Combined') {
    return (
      <div className="card" style={{ marginTop: 4, maxWidth: 520 }}>
        <p className="section-title">Pick a brand to open {pageName || 'this page'}</p>
        <div className="mini-note" style={{ marginBottom: 12 }}>
          This page shows one brand at a time. "Both" works on Home and Expenses only.
        </div>
        {setBrand && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setBrand('Loma')}>Show Lõma</button>
            <button className="btn secondary" onClick={() => setBrand('Sauca')}>Show Sauca</button>
          </div>
        )}
      </div>
    );
  }
  return children ?? null;
}
