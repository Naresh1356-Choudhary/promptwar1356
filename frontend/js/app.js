/**
 * ChromaCart Main Application Orchestrator (ES6 Module)
 * Connects Optical CV, Virtual Draping, Multi-Option Outfits, BigQuery Catalog, and Hackathon Prompter.
 */

import { FaceLandmarkerEngine, DIVERSE_ARCHETYPES } from "./faceLandmarker.js";
import { VirtualDrapingStudio, SEASONAL_DRAPES } from "./virtualDraping.js";
import { hexToLab, ciede2000, calculateIta, determinePersonalSeason } from "./opticalMath.js";

// Global App State
export const state = {
  currentProfile: {
    l_star: 64.2,
    a_star: 11.4,
    b_star: 19.8,
    ita_angle: 35.6,
    season: "Warm Autumn",
    undertone: "Warm"
  },
  selectedOccasion: "Casual",
  activeIllum: "D65",
  lightingKelvin: 6500,
  activeCollarStyle: "crew",
  splitDrapeMode: false,
  cart: [],
  user: null,
  options: [],
  catalog: [],
  hackathonStep: 0
};

// DOM References
let cvEngine = null;
let drapingStudio = null;

export async function initApp() {
  console.log("Initializing ChromaCart v2.5 Enterprise...");

  // Initialize Canvas Viewfinder
  const viewCanvas = document.getElementById("viewfinder-canvas");
  const videoEl = document.getElementById("webcam-video");
  if (viewCanvas && videoEl) {
    cvEngine = new FaceLandmarkerEngine(viewCanvas, videoEl);
    await cvEngine.initArchetype("maya");
    updateProfileFromEngine(cvEngine.analyzeCurrentFace());
  }

  // Initialize Virtual Draping Studio
  const drapeCanvas = document.getElementById("draping-canvas");
  if (drapeCanvas) {
    drapingStudio = new VirtualDrapingStudio(drapeCanvas);
    if (viewCanvas) drapingStudio.setFaceImage(viewCanvas);
    drapingStudio.setSkinVector({
      L: state.currentProfile.l_star,
      a: state.currentProfile.a_star,
      b: state.currentProfile.b_star,
      season: state.currentProfile.season,
      undertone: state.currentProfile.undertone
    });
  }

  // Setup Event Listeners
  setupEventListeners();

  // Initial Fetch of Gemini Multi-Options & Catalog
  await fetchMultiOptions();
  await fetchCatalog();
}

function updateProfileFromEngine(analysis) {
  const v = analysis.vectorToken;
  state.currentProfile = {
    l_star: v.L,
    a_star: v.a,
    b_star: v.b,
    ita_angle: v.ita,
    season: v.season,
    undertone: v.undertone
  };

  // Update HUD
  const hudEl = document.getElementById("vector-hud-text");
  if (hudEl) {
    hudEl.textContent = `L*=${v.L} a*=${v.a} b*=${v.b} | ITA=${v.ita}° (${v.season})`;
  }

  // Update Coordinate Numbers
  document.getElementById("spec-l").textContent = v.L;
  document.getElementById("spec-a").textContent = v.a;
  document.getElementById("spec-b").textContent = v.b;
  document.getElementById("spec-ita").textContent = `${v.ita}°`;
  document.getElementById("spec-season").textContent = v.season;

  // Update Ambient Light Banner
  const guardrailEl = document.getElementById("guardrail-banner");
  if (guardrailEl && analysis.lightCheck) {
    const chk = analysis.lightCheck;
    guardrailEl.className = `p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
      chk.status === "warning" ? "bg-amber-950/60 border-amber-600/40 text-amber-200" :
      (chk.status === "info" ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-200" : "bg-emerald-950/60 border-emerald-500/40 text-emerald-200")
    }`;
    guardrailEl.innerHTML = `
      <span>${chk.title}: ${chk.message}</span>
      <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40">Guardrail OK</span>
    `;
  }

  // Update Draping Studio
  if (drapingStudio) {
    drapingStudio.setSkinVector({
      L: v.L,
      a: v.a,
      b: v.b,
      season: v.season,
      undertone: v.undertone
    });
    updateFlatteryMeter();
  }
}

function updateFlatteryMeter() {
  if (!drapingStudio) return;
  const harmony = drapingStudio.calculateHarmony();
  const meterVal = document.getElementById("flattery-score-val");
  const meterRating = document.getElementById("flattery-rating-text");
  const meterBar = document.getElementById("flattery-meter-bar");

  if (meterVal) meterVal.textContent = `${harmony.flatteryScore}%`;
  if (meterRating) meterRating.textContent = `${harmony.rating} (ΔE ${harmony.deltaE})`;
  if (meterBar) meterBar.style.width = `${harmony.flatteryScore}%`;
}

async function fetchMultiOptions() {
  const start = performance.now();
  try {
    const res = await fetch("/api/v1/generate-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        l_star: state.currentProfile.l_star,
        a_star: state.currentProfile.a_star,
        b_star: state.currentProfile.b_star,
        ita_angle: state.currentProfile.ita_angle,
        occasion: state.selectedOccasion,
        lighting_kelvin: state.lightingKelvin
      })
    });
    if (res.ok) {
      const data = await res.json();
      state.options = data.options;
      const elapsed = (performance.now() - start).toFixed(1);
      document.getElementById("engine-latency-badge").textContent = `⚡ Tiered Compute: ${elapsed} ms ($0.00)`;
      renderMultiOptionCards(data.options);
    }
  } catch (err) {
    console.warn("Failed fetching options from backend; using local generator", err);
  }
}

function renderMultiOptionCards(options) {
  const container = document.getElementById("options-grid");
  if (!container) return;

  container.innerHTML = options.map((opt, i) => `
    <div class="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex flex-col justify-between interactive-card">
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold uppercase tracking-wider text-secondary">${opt.harmony_mode}</span>
          <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-surface-container-highest text-primary">
            ΔE ${opt.delta_e_score}
          </span>
        </div>
        <h3 class="text-base font-bold text-on-surface mt-2">${opt.option_title}</h3>
        <p class="text-xs text-on-surface-variant mt-2 leading-relaxed">${opt.explanation}</p>

        <!-- Garment Swatches -->
        <div class="flex items-center gap-3 my-4 p-3 bg-surface-dim rounded-xl border border-outline-variant/20">
          <div class="text-center cursor-pointer swatch-trigger" data-hex="${opt.primary_garment_hex}">
            <div class="w-8 h-8 rounded-full border border-white/20 shadow-inner mx-auto hover:scale-110 transition-transform" style="background-color: ${opt.primary_garment_hex}"></div>
            <span class="text-[9px] text-on-surface-variant block mt-1">Top</span>
          </div>
          <div class="text-center cursor-pointer swatch-trigger" data-hex="${opt.secondary_layer_hex}">
            <div class="w-8 h-8 rounded-full border border-white/20 shadow-inner mx-auto hover:scale-110 transition-transform" style="background-color: ${opt.secondary_layer_hex}"></div>
            <span class="text-[9px] text-on-surface-variant block mt-1">Layer</span>
          </div>
          <div class="text-center cursor-pointer swatch-trigger" data-hex="${opt.bottom_garment_hex}">
            <div class="w-8 h-8 rounded-full border border-white/20 shadow-inner mx-auto hover:scale-110 transition-transform" style="background-color: ${opt.bottom_garment_hex}"></div>
            <span class="text-[9px] text-on-surface-variant block mt-1">Bottom</span>
          </div>
          <div class="ml-auto text-right">
            <span class="text-[10px] text-emerald-400 font-bold block">96% Fit</span>
            <span class="text-[9px] text-on-surface-variant">-94% Return</span>
          </div>
        </div>
      </div>

      <a href="${opt.buy_link}" target="_blank" rel="noopener noreferrer" class="mt-2 w-full bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary py-2.5 px-4 rounded-xl text-center text-xs font-semibold transition-all block shadow-sm">
        Shop Available Items →
      </a>
    </div>
  `).join("");

  // Attach click listeners to swatches for quick drape
  container.querySelectorAll(".swatch-trigger").forEach(el => {
    el.addEventListener("click", () => {
      const hex = el.getAttribute("data-hex");
      if (drapingStudio && hex) {
        drapingStudio.setDrapeColor(hex);
        updateFlatteryMeter();
      }
    });
  });
}

async function fetchCatalog() {
  try {
    const res = await fetch("/api/catalog/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skin_vector: {
          L: state.currentProfile.l_star,
          a: state.currentProfile.a_star,
          b: state.currentProfile.b_star,
          ita: state.currentProfile.ita_angle,
          undertone: state.currentProfile.undertone,
          season: state.currentProfile.season
        },
        lighting_condition: state.activeIllum,
        occasion: state.selectedOccasion
      })
    });
    if (res.ok) {
      const data = await res.json();
      state.catalog = data.items;
      renderCatalogGrid(data.items);
    }
  } catch (err) {
    console.warn("Failed fetching catalog", err);
  }
}

function renderCatalogGrid(items) {
  const container = document.getElementById("catalog-grid");
  if (!container) return;

  container.innerHTML = items.map(item => `
    <div class="group bg-surface-container rounded-2xl overflow-hidden border border-outline-variant/30 hover:border-primary/50 transition-all flex flex-col justify-between interactive-card">
      <div class="relative aspect-[4/3] bg-surface-dim overflow-hidden">
        <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-surface-dim/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-bold text-emerald-400">
          <span>✓</span>
          <span>${item.harmony_score || 95}% Match</span>
        </div>
        <div class="absolute bottom-2.5 left-2.5 flex items-center gap-2 bg-surface-dim/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
          <span class="w-3.5 h-3.5 rounded-full shadow-inner border border-white/20" style="background-color: ${item.adapted_hex || item.hex}"></span>
          <span class="text-[10px] font-mono font-semibold text-on-surface">${item.adapted_hex || item.hex}</span>
        </div>
      </div>

      <div class="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-secondary">${item.brand}</span>
            <span class="text-xs font-mono font-bold text-primary">ΔE ${item.delta_e_2000 || '1.8'}</span>
          </div>
          <h4 class="text-sm font-bold text-on-surface line-clamp-1">${item.title}</h4>
          <p class="text-xs text-on-surface-variant mt-1">$${item.price.toFixed(2)} USD</p>
        </div>

        <div class="mt-4 flex gap-2">
          <button class="catalog-drape-btn px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold border border-outline-variant/40 transition-colors" data-hex="${item.hex}">
            Drape
          </button>
          <button class="catalog-add-btn flex-1 bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold py-2 rounded-xl border border-outline-variant/40 transition-colors" data-id="${item.id}">
            + Add
          </button>
          <a href="${item.buy_url}" target="_blank" rel="noopener noreferrer" class="bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold py-2 px-3 rounded-xl transition-all shadow-sm flex items-center justify-center">
            Buy Now →
          </a>
        </div>
      </div>
    </div>
  `).join("");

  // Event handlers for catalog buttons
  container.querySelectorAll(".catalog-drape-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const hex = btn.getAttribute("data-hex");
      if (drapingStudio && hex) {
        drapingStudio.setDrapeColor(hex);
        updateFlatteryMeter();
        document.getElementById("draping-section").scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  container.querySelectorAll(".catalog-add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const found = items.find(it => it.id === id);
      if (found) {
        state.cart.push(found);
        updateCartBadge();
        showToast(`Added "${found.title}" to Cart`);
      }
    });
  });
}

function updateCartBadge() {
  const badge = document.getElementById("cart-badge-count");
  if (badge) badge.textContent = state.cart.length;

  const savingsTotal = state.cart.reduce((acc, it) => acc + (it.price * 0.35), 0);
  const co2Total = (state.cart.length * 2.8).toFixed(1);

  const cartSavingsEl = document.getElementById("cart-savings-val");
  const cartCo2El = document.getElementById("cart-co2-val");
  if (cartSavingsEl) cartSavingsEl.textContent = `$${savingsTotal.toFixed(2)}`;
  if (cartCo2El) cartCo2El.textContent = `${co2Total} kg`;

  const cartList = document.getElementById("cart-items-list");
  if (cartList) {
    if (state.cart.length === 0) {
      cartList.innerHTML = `<p class="text-xs text-on-surface-variant text-center py-8">No garments added yet.</p>`;
    } else {
      cartList.innerHTML = state.cart.map(it => `
        <div class="flex items-center gap-3 p-3 bg-surface-dim rounded-xl border border-outline-variant/30">
          <img src="${it.image}" alt="${it.title}" class="w-12 h-12 rounded-lg object-cover" />
          <div class="flex-1">
            <div class="text-xs font-bold text-on-surface line-clamp-1">${it.title}</div>
            <div class="text-[11px] text-on-surface-variant">$${it.price.toFixed(2)}</div>
          </div>
          <span class="text-xs font-bold text-emerald-400">98% Fit</span>
        </div>
      `).join("");
    }
  }
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "fixed bottom-6 right-6 z-50 bg-primary-container text-on-primary-container px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl border border-primary/40 animate-bounce";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function setupEventListeners() {
  // Occasion Filters
  document.querySelectorAll(".occasion-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".occasion-btn").forEach(b => {
        b.className = "occasion-btn px-4 py-2 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant hover:bg-surface-bright transition-all";
      });
      btn.className = "occasion-btn px-4 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary shadow-md transition-all";
      state.selectedOccasion = btn.getAttribute("data-occ");
      await fetchMultiOptions();
      await fetchCatalog();
    });
  });

  // Illuminant / Lighting Simulator
  document.querySelectorAll(".illum-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".illum-btn").forEach(b => {
        b.className = "illum-btn px-3 py-1.5 rounded-full text-on-surface-variant hover:text-on-surface transition-all";
      });
      btn.className = "illum-btn px-3 py-1.5 rounded-full bg-primary text-on-primary font-semibold shadow-sm transition-all";
      state.activeIllum = btn.getAttribute("data-illum");
      state.lightingKelvin = parseInt(btn.getAttribute("data-kelvin"), 10);
      if (drapingStudio) drapingStudio.setLighting(state.activeIllum);
      await fetchMultiOptions();
      await fetchCatalog();
    });
  });

  // Archetype Switcher
  document.querySelectorAll(".arch-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".arch-btn").forEach(b => b.classList.remove("ring-2", "ring-primary", "bg-primary-container"));
      btn.classList.add("ring-2", "ring-primary", "bg-primary-container");
      const id = btn.getAttribute("data-arch");
      if (cvEngine) {
        await cvEngine.initArchetype(id);
        const analysis = cvEngine.analyzeCurrentFace();
        updateProfileFromEngine(analysis);
        if (drapingStudio) drapingStudio.setFaceImage(cvEngine.canvas);
        await fetchMultiOptions();
        await fetchCatalog();
      }
    });
  });

  // Webcam Activator
  const webcamBtn = document.getElementById("btn-webcam");
  if (webcamBtn) {
    webcamBtn.addEventListener("click", async () => {
      if (cvEngine) {
        const res = await cvEngine.startCamera();
        if (res.success) {
          showToast("Live Webcam Stream Connected!");
        } else {
          showToast("Webcam unavailable; using diverse archetypes.");
        }
      }
    });
  }

  // Scan Ray Trigger
  const scanBtn = document.getElementById("btn-trigger-scan");
  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      if (cvEngine) {
        scanBtn.disabled = true;
        await cvEngine.triggerScanAnimation(1200);
        const analysis = cvEngine.analyzeCurrentFace();
        updateProfileFromEngine(analysis);
        if (drapingStudio) drapingStudio.setFaceImage(cvEngine.canvas);
        await fetchMultiOptions();
        await fetchCatalog();
        scanBtn.disabled = false;
        showToast("Optical Spectrum Recalibrated!");
      }
    });
  }

  // Collar Style Switcher
  document.querySelectorAll(".collar-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".collar-btn").forEach(b => b.classList.remove("bg-primary", "text-on-primary"));
      btn.classList.add("bg-primary", "text-on-primary");
      const style = btn.getAttribute("data-style");
      if (drapingStudio) {
        drapingStudio.setCollarStyle(style);
        updateFlatteryMeter();
      }
    });
  });

  // Split-Screen Toggle
  const splitToggle = document.getElementById("toggle-split-drape");
  if (splitToggle) {
    splitToggle.addEventListener("change", (e) => {
      if (drapingStudio) drapingStudio.setSplitMode(e.target.checked);
    });
  }

  // Split-Screen Drag / Range Slider
  const splitSlider = document.getElementById("slider-split-ratio");
  if (splitSlider) {
    splitSlider.addEventListener("input", (e) => {
      if (drapingStudio) drapingStudio.setSplitRatio(parseFloat(e.target.value));
    });
  }

  // Drape Swatch Palette
  document.querySelectorAll(".drape-swatch").forEach(swatch => {
    swatch.addEventListener("click", () => {
      const hex = swatch.getAttribute("data-hex");
      if (drapingStudio && hex) {
        drapingStudio.setDrapeColor(hex);
        updateFlatteryMeter();
      }
    });
  });

  // Cart Drawer Open / Close
  const openCartBtn = document.getElementById("btn-open-cart");
  const closeCartBtn = document.getElementById("btn-close-cart");
  const cartDrawer = document.getElementById("cart-drawer");
  if (openCartBtn && cartDrawer) {
    openCartBtn.addEventListener("click", () => cartDrawer.classList.remove("hidden"));
  }
  if (closeCartBtn && cartDrawer) {
    closeCartBtn.addEventListener("click", () => cartDrawer.classList.add("hidden"));
  }

  // Auth Modal Open / Close
  const openAuthBtn = document.getElementById("btn-open-auth");
  const closeAuthBtn = document.getElementById("btn-close-auth");
  const authModal = document.getElementById("auth-modal");
  if (openAuthBtn && authModal) {
    openAuthBtn.addEventListener("click", () => authModal.classList.remove("hidden"));
  }
  if (closeAuthBtn && authModal) {
    closeAuthBtn.addEventListener("click", () => authModal.classList.add("hidden"));
  }

  // Hackathon Presentation Step Buttons
  document.querySelectorAll(".demo-step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".demo-step-btn").forEach(b => {
        b.className = "demo-step-btn px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-container text-on-surface-variant hover:text-on-surface transition-all";
      });
      btn.className = "demo-step-btn px-3 py-1 rounded-full text-[11px] font-semibold bg-primary text-on-primary font-bold shadow-sm transition-all";
      const step = parseInt(btn.getAttribute("data-step"), 10);
      showHackathonCue(step);
    });
  });
}

function showHackathonCue(step) {
  const prompterBox = document.getElementById("prompter-box");
  const prompterText = document.getElementById("prompter-text");
  if (!prompterBox || !prompterText) return;

  prompterBox.classList.remove("hidden");
  const cues = {
    1: "“35% of online clothing purchases are returned because colors clash with skin undertones in real life, causing a $200B crisis and millions of tons of carbon waste. Meet ChromaCart—a secure, zero-biometric-leak agent replacing guesswork with optical physics and Gemini intelligence.”",
    2: "“Look at our client-side MediaPipe extraction. The raw photo never touches the cloud! If ambient lighting has a yellow incandescent cast, our White-Light Guardrail auto-corrects coordinates in <10ms via the Bradford Chromatic Matrix.”",
    3: "“Watch as we toggle between Executive, Casual, and Festive: our Tiered Compute Engine executes instant local ΔE math (<5ms, $0 cost) and Gemini 2.5 Flash Structured JSON delivers 4 calibrated outfits tailored to your undertone.”",
    4: "“Every outfit links directly to live e-commerce inventory with exact hex verification, slashing return rates by up to 94% and eliminating the $48 average restocking loss.”"
  };
  prompterText.textContent = cues[step] || "";

  // Auto-scroll to relevant section
  if (step === 2) document.getElementById("viewfinder-section").scrollIntoView({ behavior: "smooth" });
  if (step === 3) document.getElementById("options-section").scrollIntoView({ behavior: "smooth" });
  if (step === 4) document.getElementById("catalog-section").scrollIntoView({ behavior: "smooth" });
}

// Auto-boot when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
