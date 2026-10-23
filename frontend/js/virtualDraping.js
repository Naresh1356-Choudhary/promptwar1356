/**
 * ChromaCart Interactive Virtual Draping Engine (ES6 Module)
 * Renders realistic fabric collars and drapes over user's live face/portrait,
 * calculates real-time ΔE2000 contrast harmony, and supports split-screen flattery comparisons.
 */

import { hexToLab, ciede2000, hexToRgb, rgbToHex, bradfordAdapt } from "./opticalMath.js";

export const SEASONAL_DRAPES = {
  Autumn: [
    { name: "Burnt Terracotta", hex: "#C85A32", season: "Warm Autumn", type: "Harmonic" },
    { name: "Forest Olive", hex: "#3D4F37", season: "Warm Autumn", type: "Harmonic" },
    { name: "Warm Toffee Camel", hex: "#B88654", season: "Warm Autumn", type: "Harmonic" },
    { name: "Spiced Cinnamon Rust", hex: "#8C5835", season: "Warm Autumn", type: "Harmonic" },
    { name: "Icy Lilac Bleach", hex: "#D6D2E8", season: "Cool Summer", type: "Clash", reason: "Dulls golden undertones; causes sickly grey cast" }
  ],
  Winter: [
    { name: "Royal Sapphire Blue", hex: "#1B3B6F", season: "Cool Winter", type: "Harmonic" },
    { name: "Crimson Ruby", hex: "#9B111E", season: "Cool Winter", type: "Harmonic" },
    { name: "Obsidian Jet Black", hex: "#111215", season: "Cool Winter", type: "Harmonic" },
    { name: "Crisp Glacial White", hex: "#F8FAFC", season: "Cool Winter", type: "Harmonic" },
    { name: "Muddy Mustard Ochre", hex: "#DDA738", season: "Warm Autumn", type: "Clash", reason: "Yellow undertone clashes with cool rosy skin; produces sallow reflections" }
  ],
  Summer: [
    { name: "French Lavender", hex: "#9B8EB9", season: "Cool Summer", type: "Harmonic" },
    { name: "Dusty Steel Blue", hex: "#4A6B82", season: "Cool Summer", type: "Harmonic" },
    { name: "Rose Quartz Muted", hex: "#DFC5C8", season: "Soft Summer", type: "Harmonic" },
    { name: "Cool Sage Green", hex: "#7B9E87", season: "Soft Summer", type: "Harmonic" },
    { name: "Electric Neon Orange", hex: "#FF5500", season: "Warm Spring", type: "Clash", reason: "Overwhelms delicate low-chroma complexion; induces ruddy flush" }
  ],
  Spring: [
    { name: "Sunburst Coral", hex: "#FF6F59", season: "Warm Spring", type: "Harmonic" },
    { name: "Champagne Silk", hex: "#F4E0B9", season: "Warm Spring", type: "Harmonic" },
    { name: "Marigold Gold", hex: "#DDA738", season: "Warm Spring", type: "Harmonic" },
    { name: "Aqua Marine", hex: "#48BFE3", season: "Clear Spring", type: "Harmonic" },
    { name: "Dead Charcoal Grey", hex: "#374151", season: "Cool Winter", type: "Clash", reason: "Drains natural vitality; creates tired facial shadows" }
  ]
};

export class VirtualDrapingStudio {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.activeDrapeHex = "#C85A32";
    this.activeCollarStyle = "crew"; // 'crew', 'vneck', 'lapel', 'scarf'
    this.splitMode = false;
    this.splitRatio = 0.5; // 0 to 1
    this.clashHex = "#D6D2E8";
    this.lightingCondition = "D65";
    this.faceImage = null;
    this.userSkinVector = { L: 64.2, a: 11.4, b: 19.8, season: "Autumn", undertone: "Warm" };
  }

  setFaceImage(imgOrCanvas) {
    this.faceImage = imgOrCanvas;
    this.render();
  }

  setSkinVector(vector) {
    this.userSkinVector = vector;
    // Auto-select a signature harmonic drape for user's season
    const seasonKey = vector.season.includes("Winter") ? "Winter" :
                      vector.season.includes("Summer") ? "Summer" :
                      vector.season.includes("Spring") ? "Spring" : "Autumn";
    const drapes = SEASONAL_DRAPES[seasonKey] || SEASONAL_DRAPES.Autumn;
    this.activeDrapeHex = drapes[0].hex;
    this.clashHex = drapes[drapes.length - 1].hex;
    this.render();
  }

  setDrapeColor(hex) {
    this.activeDrapeHex = hex;
    this.render();
  }

  setCollarStyle(style) {
    this.activeCollarStyle = style;
    this.render();
  }

  setLighting(lighting) {
    this.lightingCondition = lighting;
    this.render();
  }

  setSplitMode(enabled) {
    this.splitMode = enabled;
    this.render();
  }

  setSplitRatio(ratio) {
    this.splitRatio = Math.max(0.05, Math.min(0.95, ratio));
    this.render();
  }

  calculateHarmony() {
    const skinLab = {
      L: this.userSkinVector.L,
      a: this.userSkinVector.a,
      b: this.userSkinVector.b
    };
    const drapeLab = hexToLab(this.activeDrapeHex, this.lightingCondition);
    const dE = ciede2000(skinLab, drapeLab);

    const isHarmonic = dE > 2.0 && dE < 45.0;
    const score = Math.max(30, Math.min(99, Math.round(100 - (dE * 0.28))));

    return {
      deltaE: Number(dE.toFixed(2)),
      flatteryScore: score,
      rating: score > 90 ? "Flawless Harmonic Radiance" : (score > 75 ? "Complementary Contrast" : "Noticeable Undertone Clash")
    };
  }

  render() {
    const ctx = this.ctx;
    const w = (this.canvas.width = 600);
    const h = (this.canvas.height = 600);

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Face Base (Image or Canvas stream)
    if (this.faceImage) {
      ctx.drawImage(this.faceImage, 0, 0, w, h);
    } else {
      // Elegant placeholder face gradient
      ctx.fillStyle = "#12151D";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#C49A74";
      ctx.beginPath();
      ctx.ellipse(300, 310, 150, 190, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Adapt drape colors according to current ambient illuminant
    const adapt = hex => {
      if (this.lightingCondition === "D65") return hex;
      const rgb = hexToRgb(hex);
      const adapted = bradfordAdapt(rgb, "D65", this.lightingCondition);
      return rgbToHex(adapted.r, adapted.g, adapted.b);
    };

    const colorHarmonic = adapt(this.activeDrapeHex);
    const colorClash = adapt(this.clashHex);

    // 2. Render Virtual Draping Collar
    if (!this.splitMode) {
      this.drawCollar(ctx, w, h, colorHarmonic, this.activeCollarStyle);
    } else {
      // Split Screen Comparison: Left = Harmonic, Right = Clash
      const splitX = w * this.splitRatio;

      // Draw Left Side (Harmonic)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, h);
      ctx.clip();
      this.drawCollar(ctx, w, h, colorHarmonic, this.activeCollarStyle);

      // Label Left
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(16, 20, 160, 32);
      ctx.fillStyle = "#00E5FF";
      ctx.font = "600 13px Inter, sans-serif";
      ctx.fillText("✨ Harmonic Match (98%)", 24, 41);
      ctx.restore();

      // Draw Right Side (Clash)
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, w - splitX, h);
      ctx.clip();
      this.drawCollar(ctx, w, h, colorClash, this.activeCollarStyle);

      // Label Right
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(w - 180, 20, 164, 32);
      ctx.fillStyle = "#FF5555";
      ctx.font = "600 13px Inter, sans-serif";
      ctx.fillText("⚠️ Clashing Season (42%)", w - 170, 41);
      ctx.restore();

      // Split Divider Bar
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, h);
      ctx.stroke();

      // Split Handle Circle
      ctx.fillStyle = "#00E5FF";
      ctx.beginPath();
      ctx.arc(splitX, h * 0.5, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("◂ ▸", splitX - 8, h * 0.5 + 4);
    }
  }

  drawCollar(ctx, w, h, fillHex, style) {
    ctx.save();
    ctx.fillStyle = fillHex;

    // Realistic fabric weave drop shadow & gradient
    const fabricGrad = ctx.createLinearGradient(0, h * 0.65, 0, h);
    fabricGrad.addColorStop(0, fillHex);
    fabricGrad.addColorStop(1, "rgba(0,0,0,0.35)");

    if (style === "crew") {
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.72);
      ctx.bezierCurveTo(w * 0.25, h * 0.70, w * 0.35, h * 0.78, w * 0.5, h * 0.78);
      ctx.bezierCurveTo(w * 0.65, h * 0.78, w * 0.75, h * 0.70, w, h * 0.72);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = fabricGrad;
      ctx.fill();

      // Collar trim ribbing
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w * 0.25, h * 0.70);
      ctx.bezierCurveTo(w * 0.35, h * 0.78, w * 0.65, h * 0.78, w * 0.75, h * 0.70);
      ctx.stroke();
    } else if (style === "vneck") {
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.70);
      ctx.lineTo(w * 0.30, h * 0.68);
      ctx.lineTo(w * 0.50, h * 0.84); // Deep V
      ctx.lineTo(w * 0.70, h * 0.68);
      ctx.lineTo(w, h * 0.70);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = fabricGrad;
      ctx.fill();
    } else if (style === "lapel") {
      // Structured Double Lapel Blazer
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.65);
      ctx.lineTo(w * 0.35, h * 0.68);
      ctx.lineTo(w * 0.46, h * 0.86);
      ctx.lineTo(w * 0.50, h * 0.90);
      ctx.lineTo(w * 0.54, h * 0.86);
      ctx.lineTo(w * 0.65, h * 0.68);
      ctx.lineTo(w, h * 0.65);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Lapel Fold Lines
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.68);
      ctx.lineTo(w * 0.44, h * 0.80);
      ctx.moveTo(w * 0.65, h * 0.68);
      ctx.lineTo(w * 0.56, h * 0.80);
      ctx.stroke();
    } else {
      // Scarf Drape
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h);
      ctx.bezierCurveTo(w * 0.25, h * 0.70, w * 0.4, h * 0.72, w * 0.5, h * 0.75);
      ctx.bezierCurveTo(w * 0.6, h * 0.72, w * 0.75, h * 0.70, w * 0.8, h);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
