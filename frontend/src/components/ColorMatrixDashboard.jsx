import React, { useState } from 'react';

export default function ColorMatrixDashboard({ profile, options, selectedOccasion, onOccasionChange, onSelectGarment }) {
  return (
    <div className="bg-surface-container-low text-on-surface p-6 rounded-3xl border border-outline-variant/40 font-sans shadow-xl">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-primary">Tiered Compute Multi-Option Engine</span>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface">Gemini 2.5 Flash Structured Outfits</h2>
        </div>
        <div className="flex gap-2">
          {['Casual', 'Executive', 'Festive'].map((occ) => (
            <button
              key={occ}
              onClick={() => onOccasionChange(occ)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                selectedOccasion === occ
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-bright'
              }`}
            >
              {occ}
            </button>
          ))}
        </div>
      </header>

      {/* 4 Multi-Option Cards Matrix */}
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {options && options.map((opt, idx) => (
          <div key={idx} className="bg-surface-container rounded-2xl p-5 shadow-sm border border-outline-variant/40 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-lg">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">{opt.harmony_mode}</span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-surface-container-highest text-primary">
                  ΔE {opt.delta_e_score}
                </span>
              </div>
              
              <h3 className="text-base font-bold mt-2 text-on-surface">{opt.option_title}</h3>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">{opt.explanation}</p>
              
              <div className="flex items-center gap-3 my-4 p-3 bg-surface-dim rounded-xl border border-outline-variant/30">
                <div className="text-center">
                  <div
                    onClick={() => onSelectGarment && onSelectGarment(opt.primary_garment_hex, "Top")}
                    className="w-8 h-8 rounded-full shadow-inner border border-white/20 cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: opt.primary_garment_hex }}
                    title="Primary Top"
                  />
                  <span className="text-[9px] text-on-surface-variant block mt-1">Top</span>
                </div>

                <div className="text-center">
                  <div
                    onClick={() => onSelectGarment && onSelectGarment(opt.secondary_layer_hex, "Layer")}
                    className="w-8 h-8 rounded-full shadow-inner border border-white/20 cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: opt.secondary_layer_hex }}
                    title="Layer / Jacket"
                  />
                  <span className="text-[9px] text-on-surface-variant block mt-1">Layer</span>
                </div>

                <div className="text-center">
                  <div
                    onClick={() => onSelectGarment && onSelectGarment(opt.bottom_garment_hex, "Bottom")}
                    className="w-8 h-8 rounded-full shadow-inner border border-white/20 cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: opt.bottom_garment_hex }}
                    title="Bottoms"
                  />
                  <span className="text-[9px] text-on-surface-variant block mt-1">Bottom</span>
                </div>

                <div className="ml-auto text-right">
                  <span className="text-[10px] text-emerald-400 font-bold block">96% Fit</span>
                  <span className="text-[9px] text-on-surface-variant">-92% Returns</span>
                </div>
              </div>
            </div>

            <a
              href={opt.buy_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary py-2.5 px-4 rounded-xl text-center text-xs font-semibold transition-colors block shadow-sm"
            >
              Shop Available Items →
            </a>
          </div>
        ))}
      </main>
    </div>
  );
}
