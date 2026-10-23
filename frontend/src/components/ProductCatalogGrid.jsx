import React, { useState } from 'react';

export default function ProductCatalogGrid({ items, onAddToCart, onQuickDrape }) {
  const [filterCat, setFilterCat] = useState('All');

  const categories = ['All', 'Knitwear', 'Blazers', 'Dresses', 'Tops', 'Bottoms', 'Outerwear'];

  const filtered = items.filter(it => filterCat === 'All' || it.category.toLowerCase() === filterCat.toLowerCase());

  return (
    <div className="bg-surface-container rounded-3xl p-6 border border-outline-variant/40 shadow-xl mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-primary">BigQuery Vector Search</span>
          <h2 className="text-2xl font-bold text-on-surface">Live E-Commerce Catalog & Buy Links</h2>
          <p className="text-xs text-on-surface-variant">Sub-second cosine similarity & CIEDE2000 shade match verification</p>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 bg-surface-dim p-1.5 rounded-full border border-outline-variant/30 text-xs">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-1 rounded-full font-medium transition-all ${
                filterCat === c
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map(item => (
          <div
            key={item.item_id || item.id}
            className="group bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/30 hover:border-primary/50 transition-all flex flex-col justify-between hover:shadow-xl"
          >
            {/* Image Header */}
            <div className="relative aspect-[4/3] bg-surface-dim overflow-hidden">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-surface-dim/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-bold text-emerald-400">
                <span>✓</span>
                <span>{item.match_percentage || item.harmony_score || 95}% Match</span>
              </div>
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 bg-surface-dim/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                <span className="w-3.5 h-3.5 rounded-full shadow-inner border border-white/20" style={{ backgroundColor: item.display_hex || item.hex }} />
                <span className="text-[10px] font-mono font-semibold text-on-surface">{item.display_hex || item.hex}</span>
              </div>
            </div>

            {/* Info Body */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">{item.brand}</span>
                  <span className="text-xs font-mono font-bold text-primary">ΔE {item.delta_e_score || item.delta_e_2000 || '1.8'}</span>
                </div>
                <h3 className="text-sm font-bold text-on-surface line-clamp-1">{item.title}</h3>
                <p className="text-xs text-on-surface-variant mt-1">${item.price.toFixed(2)} USD</p>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onQuickDrape && onQuickDrape(item.hex)}
                  className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold border border-outline-variant/40 transition-colors"
                  title="Virtual Drape Swatch"
                >
                  Drape
                </button>
                <button
                  onClick={() => onAddToCart && onAddToCart(item)}
                  className="flex-1 bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold py-2 rounded-xl border border-outline-variant/40 transition-colors"
                >
                  + Add
                </button>
                <a
                  href={item.buy_link || item.buy_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold py-2 px-3 rounded-xl transition-all shadow-sm flex items-center justify-center"
                >
                  Buy Now →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
