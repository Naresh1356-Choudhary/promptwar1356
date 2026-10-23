import React from 'react';

export default function Navbar({ user, onAuthClick, activeIllum, onIllumChange, cartCount, onOpenCart }) {
  return (
    <nav className="w-full bg-surface-container border-b border-outline-variant/40 px-6 py-4 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-tertiary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-on-primary font-black text-lg">◈</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-on-surface">ChromaCart</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container">
                v2.5 Enterprise
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Zero-Trust Face Handling • 50-Byte Vector Protocol
            </p>
          </div>
        </div>

        {/* Center: Lighting Adaptor Selector */}
        <div className="hidden md:flex items-center gap-1 bg-surface-container-high p-1 rounded-full border border-outline-variant/30 text-xs font-medium">
          <span className="px-3 text-on-surface-variant">Illuminant:</span>
          {[
            { id: "D65", label: "☀️ Daylight (6500K)", kelvin: 6500 },
            { id: "F2",  label: "🏢 Office LED (4200K)", kelvin: 4200 },
            { id: "A",   label: "🌆 Evening (2856K)", kelvin: 2856 }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => onIllumChange(opt.id, opt.kelvin)}
              className={`px-3 py-1.5 rounded-full transition-all ${
                activeIllum === opt.id
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Right: Cart & Auth */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2 bg-surface-container-high hover:bg-surface-bright text-on-surface px-3.5 py-2 rounded-xl text-xs font-semibold border border-outline-variant/40 transition-colors"
          >
            <span>🛍️</span>
            <span>Cart</span>
            <span className="px-1.5 py-0.2 rounded-full bg-primary text-on-primary text-[10px] font-bold">
              {cartCount || 0}
            </span>
          </button>

          <button
            onClick={onAuthClick}
            className="flex items-center gap-2 bg-primary-container hover:bg-primary hover:text-on-primary text-on-primary-container px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <span>{user ? "👤" : "🔒"}</span>
            <span>{user ? (user.displayName || "Stylist Profile") : "Firebase Sign-In"}</span>
          </button>
        </div>

      </div>
    </nav>
  );
}
