/**
 * ChromaCart Client-Side Optical Physics & Colorimetrics Engine (ES6 Module)
 * Provides zero-cost <5ms CIELAB, ITA°, CIEDE2000, and Bradford Chromatic Adaptation.
 */

export const ILLUMINANTS = {
  D65: { X: 95.047, Y: 100.0, Z: 108.883, temp: "6500K", name: "Natural Daylight (D65)" },
  D50: { X: 96.422, Y: 100.0, Z: 82.521, temp: "5000K", name: "Horizon Sunlight (D50)" },
  F2:  { X: 99.186, Y: 100.0, Z: 67.393, temp: "4230K", name: "Cool White Office LED (F2)" },
  A:   { X: 109.850, Y: 100.0, Z: 35.585, temp: "2856K", name: "Warm Incandescent / Evening (A)" }
};

const M_BFD = [
  [0.8951,  0.2664, -0.1614],
  [-0.7502, 1.7135,  0.0367],
  [0.0389, -0.0685,  1.0296]
];

const M_BFD_INV = [
  [0.98699, -0.14705, 0.15996],
  [0.43231,  0.51836, 0.04929],
  [-0.00853, 0.04004, 0.96849]
];

export function hexToRgb(hex) {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map(c => c + c).join("");
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = v => clamp(v).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToXyz(r, g, b) {
  const linearize = c => {
    const v = c / 255.0;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const rLin = linearize(r) * 100.0;
  const gLin = linearize(g) * 100.0;
  const bLin = linearize(b) * 100.0;

  const X = rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375;
  const Y = rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.0721750;
  const Z = rLin * 0.0193339 + gLin * 0.1191920 + bLin * 0.9503041;
  return { X, Y, Z };
}

export function xyzToRgb(X, Y, Z) {
  const x = X / 100.0;
  const y = Y / 100.0;
  const z = Z / 100.0;

  const rLin = x * 3.2404542 - y * 1.5371385 - z * 0.4985314;
  const gLin = -x * 0.9692660 + y * 1.8760108 + z * 0.0415560;
  const bLin = x * 0.0556434 - y * 0.2040259 + z * 1.0572252;

  const delinearize = v => {
    const val = Math.max(0.0, Math.min(1.0, v));
    const comp = val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1.0 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(comp * 255.0)));
  };

  return {
    r: delinearize(rLin),
    g: delinearize(gLin),
    b: delinearize(bLin)
  };
}

export function xyzToLab(X, Y, Z, illuminant = "D65") {
  const ref = ILLUMINANTS[illuminant] || ILLUMINANTS.D65;
  const xr = X / ref.X;
  const yr = Y / ref.Y;
  const zr = Z / ref.Z;

  const epsilon = 216.0 / 24389.0;
  const kappa = 24389.0 / 27.0;

  const f = t => (t > epsilon ? Math.cbrt(t) : (kappa * t + 16.0) / 116.0);

  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);

  const L = Math.max(0.0, Math.min(100.0, 116.0 * fy - 16.0));
  const a = 500.0 * (fx - fy);
  const b = 200.0 * (fy - fz);

  return { L, a, b };
}

export function rgbToLab(r, g, b, illuminant = "D65") {
  const { X, Y, Z } = rgbToXyz(r, g, b);
  return xyzToLab(X, Y, Z, illuminant);
}

export function hexToLab(hex, illuminant = "D65") {
  const { r, g, b } = hexToRgb(hex);
  return rgbToLab(r, g, b, illuminant);
}

export function calculateIta(L, b) {
  const bSafe = Math.abs(b) > 0.0001 ? b : 0.0001;
  const angleRad = Math.atan((L - 50.0) / bSafe);
  return (angleRad * 180.0) / Math.PI;
}

export function classifyPhototype(ita) {
  if (ita > 55.0) return { category: "Very Light", code: "Type I-II", description: "Melano-protective" };
  if (ita > 41.0) return { category: "Light", code: "Type II-III", description: "Mild Melanin" };
  if (ita > 28.0) return { category: "Intermediate", code: "Type III-IV", description: "Moderate Golden Melanin" };
  if (ita > 10.0) return { category: "Tan", code: "Type IV-V", description: "Rich Melanin" };
  if (ita > -30.0) return { category: "Brown", code: "Type V", description: "Deep Melanin" };
  return { category: "Dark", code: "Type VI", description: "Very Deep Melanin" };
}

export function classifyUndertone(a, b) {
  const aSafe = Math.abs(a) > 0.001 ? a : 0.001;
  const ratio = b / aSafe;

  if (a < 7.5 && b > 12.0) {
    return {
      undertone: "Olive",
      ratio: ratio.toFixed(2),
      description: "Neutral-warm greenish undertone with subtle golden radiance",
      bestMetals: ["Yellow Gold", "Antique Bronze", "Rose Gold"]
    };
  }
  if (ratio > 1.28 && b > 13.0) {
    return {
      undertone: "Warm",
      ratio: ratio.toFixed(2),
      description: "Golden, peach, and honey undertone; excels with warm earth tones",
      bestMetals: ["Polished Yellow Gold", "Brass", "Champagne Gold"]
    };
  }
  if (ratio < 1.12 || a > 14.5) {
    return {
      undertone: "Cool",
      ratio: ratio.toFixed(2),
      description: "Pink, blue, and rosy undertone; excels with jewel tones and crisp whites",
      bestMetals: ["925 Sterling Silver", "Platinum", "White Gold"]
    };
  }
  return {
    undertone: "Neutral",
    ratio: ratio.toFixed(2),
    description: "Balanced red-yellow chromaticity; flexible across both warm and cool palettes",
    bestMetals: ["Rose Gold", "Mixed Silver & Gold", "White Gold"]
  };
}

export function determinePersonalSeason(L, a, b, ita) {
  const undertoneObj = classifyUndertone(a, b);
  const undertone = undertoneObj.undertone;
  const phototype = classifyPhototype(ita);

  let coreSeason = "";
  let subseason = "";
  let headline = "";
  let recommended = [];
  let avoid = [];

  if (undertone === "Warm" || undertone === "Olive") {
    if (L >= 68.0) {
      coreSeason = "Spring";
      subseason = b > 18.0 ? "Warm Spring" : (L > 74.0 ? "Light Spring" : "Clear Spring");
      headline = "Radiant, fresh, warm, and sunlit";
      recommended = ["Coral", "Warm Peach", "Marigold", "Cream", "Turquoise", "Honey Gold"];
      avoid = ["Dusty Charcoal", "Icy Grey", "Magenta", "Bleached White"];
    } else {
      coreSeason = "Autumn";
      subseason = L < 52.0 ? "Deep Autumn" : (b > 16.0 ? "Warm Autumn" : "Soft Autumn");
      headline = "Rich, earthy, grounded, and velvety";
      recommended = ["Terracotta", "Forest Olive", "Rust", "Caramel", "Mustard", "Warm Camel"];
      avoid = ["Electric Neon", "Stark Cool Black", "Baby Blue", "Cool Fuchsia"];
    }
  } else {
    if (L >= 65.0) {
      coreSeason = "Summer";
      subseason = L > 72.0 ? "Light Summer" : (a > 13.0 ? "Cool Summer" : "Soft Summer");
      headline = "Subtle, ethereal, cool, and refined";
      recommended = ["Lavender", "Powder Blue", "Slate Rose", "Muted Mauve", "Soft Navy", "Sage"];
      avoid = ["Bright Orange", "Mustard Ochre", "Warm Gold", "Muddy Brown"];
    } else {
      coreSeason = "Winter";
      subseason = L < 48.0 ? "Deep Winter" : (a > 14.0 ? "Cool Winter" : "Clear Winter");
      headline = "Bold, dramatic, high-contrast, and vivid";
      recommended = ["Royal Sapphire", "Emerald Green", "Pure Black", "Crisp Snow White", "True Ruby", "Plum"];
      avoid = ["Earthy Tan", "Warm Olive", "Pumpkin Orange", "Beige"];
    }
  }

  return {
    coreSeason,
    subseason,
    undertone,
    phototype,
    headline,
    recommended,
    avoid,
    contrastTolerance: (coreSeason === "Winter" || coreSeason === "Spring") ? "High Contrast" : "Soft / Low Contrast"
  };
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

  const computeHP = (ap, bp) => {
    if (Math.abs(ap) < 1e-6 && Math.abs(bp) < 1e-6) return 0.0;
    const deg = (Math.atan2(bp, ap) * 180.0) / Math.PI;
    return deg < 0.0 ? deg + 360.0 : deg;
  };

  const h1P = computeHP(a1P, b1);
  const h2P = computeHP(a2P, b2);

  const deltaLP = L2 - L1;
  const deltaCP = C2P - C1P;

  let deltaHP = 0.0;
  if (C1P * C2P >= 1e-6) {
    const diffH = h2P - h1P;
    if (Math.abs(diffH) <= 180.0) deltaHP = diffH;
    else if (diffH > 180.0) deltaHP = diffH - 360.0;
    else deltaHP = diffH + 360.0;
  }
  const deltaHPrime = 2.0 * Math.sqrt(C1P * C2P) * Math.sin((deltaHP * Math.PI) / 360.0);

  const LBarP = (L1 + L2) / 2.0;
  const CBarP = (C1P + C2P) / 2.0;

  let hBarP = 0.0;
  if (C1P * C2P < 1e-6) {
    hBarP = h1P + h2P;
  } else {
    const sumH = h1P + h2P;
    if (Math.abs(h1P - h2P) <= 180.0) hBarP = sumH / 2.0;
    else if (sumH < 360.0) hBarP = (sumH + 360.0) / 2.0;
    else hBarP = (sumH - 360.0) / 2.0;
  }

  const rad = deg => (deg * Math.PI) / 180.0;
  const T = 1.0
    - 0.17 * Math.cos(rad(hBarP - 30.0))
    + 0.24 * Math.cos(rad(2.0 * hBarP))
    + 0.32 * Math.cos(rad(3.0 * hBarP + 6.0))
    - 0.20 * Math.cos(rad(4.0 * hBarP - 63.0));

  const deltaTheta = 30.0 * Math.exp(-Math.pow((hBarP - 275.0) / 25.0, 2.0));
  const CBarP7 = Math.pow(CBarP, 7.0);
  const RC = 2.0 * Math.sqrt(CBarP7 / (CBarP7 + Math.pow(25.0, 7.0)));
  const RT = -Math.sin(rad(2.0 * deltaTheta)) * RC;

  const LMinus50Sq = Math.pow(LBarP - 50.0, 2.0);
  const SL = 1.0 + (0.015 * LMinus50Sq) / Math.sqrt(20.0 + LMinus50Sq);
  const SC = 1.0 + 0.045 * CBarP;
  const SH = 1.0 + 0.015 * CBarP * T;

  const termL = deltaLP / SL;
  const termC = deltaCP / SC;
  const termH = deltaHPrime / SH;

  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * termC * termH);
}

export function bradfordAdapt(rgb, sourceIllum = "D65", targetIllum = "A") {
  if (sourceIllum === targetIllum) return rgb;

  const { X, Y, Z } = rgbToXyz(rgb.r, rgb.g, rgb.b);
  const src = ILLUMINANTS[sourceIllum] || ILLUMINANTS.D65;
  const dst = ILLUMINANTS[targetIllum] || ILLUMINANTS.A;

  const toCone = (x, y, z) => ({
    r: M_BFD[0][0] * x + M_BFD[0][1] * y + M_BFD[0][2] * z,
    g: M_BFD[1][0] * x + M_BFD[1][1] * y + M_BFD[1][2] * z,
    b: M_BFD[2][0] * x + M_BFD[2][1] * y + M_BFD[2][2] * z
  });

  const srcCone = toCone(src.X, src.Y, src.Z);
  const dstCone = toCone(dst.X, dst.Y, dst.Z);

  const kr = dstCone.r / srcCone.r;
  const kg = dstCone.g / srcCone.g;
  const kb = dstCone.b / srcCone.b;

  const cCone = toCone(X, Y, Z);

  const rA = cCone.r * kr;
  const gA = cCone.g * kg;
  const bA = cCone.b * kb;

  const XA = M_BFD_INV[0][0] * rA + M_BFD_INV[0][1] * gA + M_BFD_INV[0][2] * bA;
  const YA = M_BFD_INV[1][0] * rA + M_BFD_INV[1][1] * gA + M_BFD_INV[1][2] * bA;
  const ZA = M_BFD_INV[2][0] * rA + M_BFD_INV[2][1] * gA + M_BFD_INV[2][2] * bA;

  return xyzToRgb(XA, YA, ZA);
}
