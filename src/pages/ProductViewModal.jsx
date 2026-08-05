import { productTotalStock } from '../lib/calc';

export default function ProductViewModal({ product, onClose }) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <div className="modal-title">{product.name}</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {product.image ? (
            <img className="thumb-preview" src={product.image} alt={product.name} onError={(e) => (e.currentTarget.style.display = 'none')} />
          ) : (
            <div className="prod-img placeholder" style={{ aspectRatio: '4/3', borderRadius: 2, marginBottom: 8 }}>No image</div>
          )}
          <div className="field-row">
            <div className="field"><label>SKU</label><div style={{ fontSize: 13 }}>{product.sku_prefix || '—'}</div></div>
            <div className="field"><label>Type</label><div style={{ fontSize: 13 }}>{product.type || '—'}</div></div>
          </div>

          <p className="section-title" style={{ marginTop: 16 }}>Stock by size</p>
          <div className="field-row">
            {(product.sizes || []).map((sz) => (
              <div className="field" key={sz.size}>
                <label>{sz.size}</label>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{sz.stock ?? 0}</div>
              </div>
            ))}
          </div>
          <div className="mini-note" style={{ marginTop: 6 }}>Total stock: {productTotalStock(product)} pcs</div>
        </div>
        <div className="modal-foot">
          <div />
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
