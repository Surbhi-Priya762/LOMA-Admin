// Wraps any page that only ever shows one brand at a time (everything except
// Home, Products, and Raw Materials). If someone lands here with "Combined"
// selected, show a friendly nudge instead of silently mixing both brands'
// data together.
export default function BrandGate({ brand, children }) {
  if (brand === 'Combined') {
    return (
      <div className="card" style={{ marginTop: 4 }}>
        <p className="section-title">Pick a brand to view this page</p>
        <div className="mini-note">
          This page always shows one brand's data at a time. "Combined" is only available on
          Home — switch to Loma or Sauca (from Home, or the sidebar switcher) to see this page.
        </div>
      </div>
    );
  }
  return children;
}
