/**
 * ChromaCart CIELAB & Delta-E Color Math Engine (frontend/src/utils/colorMath.js)
 * Implements sub-10ms client-side optical physics.
 */

export const ILLUMINANTS = {
  D65: { X: 95.047, Y: 100.0, Z: 108.883, name: "Daylight 6500K" },
  F2:  { X: 99.186, Y: 100.0, Z: 67.393, name: "Office LED 4200K" },
  A:   { X: 109.850, Y: 100.0, Z: 35.585, name: "Warm Evening 2856K" }
};

export function hexToRgb(hex) {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) clean = clean.split("").map(c => c + c).join("");
  const n = parseInt(clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const toH = v => clamp(v).toString(16).padStart(2, "0").toUpperCase();
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

export function rgbToXyz(r, g, b) {
  const lin = c => (c / 255 <= 0.04045 ? (c / 255) / 12.92 : Math.pow(((c / 255) + 0.055) / 1.055, 2.4));
  const rL = lin(r) * 100;
  const gL = lin(g) * 100;
  const bL = lin(b) * 100;
  return {
    X: rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375,
    Y: rL * 0.2126729 + gL * 0.7151522 + bL * 0.0721750,
    Z: rL * 0.0193339 + gL * 0.1191920 + bL * 0.9503041
  };
}

export function xyzToLab(X, Y, Z, illum = "D65") {
  const ref = ILLUMINANTS[illum] || ILLUMINANTS.D65;
  const xr = X / ref.X;
  const yr = Y / ref.Y;
  const zr = Z / ref.Z;
  const eps = 216 / 24389;
  const kap = 24389 / 27;

  const f = t => (t > eps ? Math.cbrt(t) : (kap * t + 16) / 116);
  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);

  return {
    L: Math.max(0, Math.min(100, 116 * fy - 16)),
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

export function hexToLab(hex, illum = "D65") {
  const { r, g, b } = hexToRgb(hex);
  const { X, Y, Z } = rgbToXyz(r, g, b);
  return xyzToLab(X, Y, Z, illum);
}

export function calculateIta(L, b) {
  const bSafe = Math.abs(b) > 0.0001 ? b : 0.0001;
  return (Math.atan((L - 50) / bSafe) * 180) / Math.PI;
}

export function ciede2000(lab1, lab2) {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const CBar = (C1 + C2) / 2.0;

  const CBar7 = Math.pow(CBar, 7.0);
  const G = 0.5 * (1.0 - Math.sqrt(CBar7 / (CBar7 + Math.pow(25.0, 7.0))));

  const a1P = (1.0 + G) * a1;
  const a2P = (1.0 + G) * a2;
  const C1P = Math.hypot(a1P, b1);
  const C2P = Math.hypot(a2P, b2);

  const deg = (Math.atan2(b1, a1P) * 180) / Math.PI;
  const h1P = deg < 0 ? deg + 360 : deg;
  const deg2 = (Math.atan2(b2, a2P) * 180) / Math.PI;
  const h2P = deg2 < 0 ? deg2 + 360 : deg2;

  const dLP = L2 - L1;
  const dCP = C2P - C1P;

  let dHP = 0;
  if (C1P * C2P >= 1e-6) {
    const diff = h2P - h1P;
    dHP = Math.abs(diff) <= 180 ? diff : (diff > 180 ? diff - 360 : diff + 360);
  }
  const deltaH = 2 * Math.sqrt(C1P * C2P) * Math.sin((dHP * Math.PI) / 360);

  const LBar = (L1 + L2) / 2;
  const CBarP = (C1P + C2P) / 2;

  let hBarP = 0;
  if (C1P * C2P < 1e-6) {
    hBarP = h1P + h2P;
  } else {
    const sum = h1P + h2P;
    hBarP = Math.abs(h1P - h2P) <= 180 ? sum / 2 : (sum < 360 ? (sum + 360) / 2 : (sum - 360) / 2);
  }

  const rad = d => (d * Math.PI) / 180;
  const T = 1 - 0.17 * Math.cos(rad(hBarP - 30)) + 0.24 * Math.cos(rad(2 * hBarP)) + 0.32 * Math.cos(rad(3 * hBarP + 6)) - 0.2 * Math.cos(rad(4 * hBarP - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hBarP - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(CBarP, 7) / (Math.pow(CBarP, 7) + Math.pow(25, 7)));
  const RT = -Math.sin(rad(2 * dTheta)) * RC;

  const lSq = Math.pow(LBar - 50, 2);
  const SL = 1 + (0.015 * lSq) / Math.sqrt(20 + lSq);
  const SC = 1 + 0.045 * CBarP;
  const SH = 1 + 0.015 * CBarP * T;

  return Math.sqrt(Math.pow(dLP / SL, 2) + Math.pow(dCP / SC, 2) + Math.pow(deltaH / SH, 2) + RT * (dCP / SC) * (deltaH / SH));
}
