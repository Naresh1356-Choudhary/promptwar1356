"""
ChromaCart Optical Physics & Colorimetrics Engine
Implements:
- sRGB <-> CIE XYZ (D65)
- CIE XYZ <-> CIELAB (L*a*b*)
- Individual Typology Angle (ITA°) for objective skin phototyping
- Undertone & 12-Season Personal Color classification
- CIEDE2000 (ΔE2000) standard color difference matrix (<1ms computation)
- Bradford Chromatic Adaptation Matrix for dynamic lighting shifts (Daylight, Office LED, Warm Evening)
"""

import math
from typing import Dict, Any, Tuple, List, Optional

# Reference Illuminants (Tristimulus values Xn, Yn, Zn normalized to Yn = 100)
ILLUMINANTS = {
    "D65": {"X": 95.047, "Y": 100.000, "Z": 108.883, "temp": "6500K", "name": "Natural Daylight"},
    "D50": {"X": 96.422, "Y": 100.000, "Z": 82.521, "temp": "5000K", "name": "Horizon Sunlight"},
    "F2":  {"X": 99.186, "Y": 100.000, "Z": 67.393, "temp": "4230K", "name": "Cool White Office LED"},
    "A":   {"X": 109.850, "Y": 100.000, "Z": 35.585, "temp": "2856K", "name": "Warm Incandescent / Evening"},
}

# Bradford Chromatic Adaptation Matrices
M_BFD = [
    [0.8951,  0.2664, -0.1614],
    [-0.7502, 1.7135,  0.0367],
    [0.0389, -0.0685,  1.0296]
]

M_BFD_INV = [
    [0.98699, -0.14705, 0.15996],
    [0.43231,  0.51836, 0.04929],
    [-0.00853, 0.04004, 0.96849]
]


def hex_to_rgb(hex_code: str) -> Tuple[int, int, int]:
    """Convert hex string (e.g. '#A57352' or 'A57352') to RGB (0-255)."""
    hex_clean = hex_code.lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join([c * 2 for c in hex_clean])
    if len(hex_clean) != 6:
        raise ValueError(f"Invalid hex color: {hex_code}")
    r = int(hex_clean[0:2], 16)
    g = int(hex_clean[2:4], 16)
    b = int(hex_clean[4:6], 16)
    return r, g, b


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """Convert RGB (0-255) to uppercase hex string (#RRGGBB)."""
    r_c = max(0, min(255, int(round(r))))
    g_c = max(0, min(255, int(round(g))))
    b_c = max(0, min(255, int(round(b))))
    return f"#{r_c:02X}{g_c:02X}{b_c:02X}"


def rgb_to_xyz(r: int, g: int, b: int) -> Tuple[float, float, float]:
    """
    Convert sRGB (0-255) to CIE XYZ under D65 illuminant (0-100 scale).
    Standard: IEC 61966-2-1
    """
    # Linearize sRGB
    def linearize(channel: float) -> float:
        c = channel / 255.0
        return (c / 12.92) if c <= 0.04045 else (((c + 0.055) / 1.055) ** 2.4)

    r_lin = linearize(r) * 100.0
    g_lin = linearize(g) * 100.0
    b_lin = linearize(b) * 100.0

    # sRGB to XYZ Matrix
    X = r_lin * 0.4124564 + g_lin * 0.3575761 + b_lin * 0.1804375
    Y = r_lin * 0.2126729 + g_lin * 0.7151522 + b_lin * 0.0721750
    Z = r_lin * 0.0193339 + g_lin * 0.1191920 + b_lin * 0.9503041

    return X, Y, Z


def xyz_to_rgb(X: float, Y: float, Z: float) -> Tuple[int, int, int]:
    """Convert CIE XYZ under D65 back to sRGB (0-255)."""
    x_val = X / 100.0
    y_val = Y / 100.0
    z_val = Z / 100.0

    r_lin = x_val * 3.2404542 - y_val * 1.5371385 - z_val * 0.4985314
    g_lin = -x_val * 0.9692660 + y_val * 1.8760108 + z_val * 0.0415560
    b_lin = x_val * 0.0556434 - y_val * 0.2040259 + z_val * 1.0572252

    def delinearize(val: float) -> int:
        val = max(0.0, min(1.0, val))
        comp = (12.92 * val) if val <= 0.0031308 else (1.055 * (val ** (1.0 / 2.4)) - 0.055)
        return max(0, min(255, int(round(comp * 255.0))))

    return delinearize(r_lin), delinearize(g_lin), delinearize(b_lin)


def xyz_to_lab(X: float, Y: float, Z: float, illuminant: str = "D65") -> Tuple[float, float, float]:
    """
    Convert CIE XYZ to CIELAB (L*, a*, b*).
    Standard D65 reference white unless illuminant specified.
    """
    ref = ILLUMINANTS.get(illuminant, ILLUMINANTS["D65"])
    xr = X / ref["X"]
    yr = Y / ref["Y"]
    zr = Z / ref["Z"]

    epsilon = 216.0 / 24389.0  # 0.008856
    kappa = 24389.0 / 27.0     # 903.3

    def f(t: float) -> float:
        return (t ** (1.0 / 3.0)) if t > epsilon else ((kappa * t + 16.0) / 116.0)

    fx = f(xr)
    fy = f(yr)
    fz = f(zr)

    L = max(0.0, min(100.0, 116.0 * fy - 16.0))
    a = 500.0 * (fx - fy)
    b = 200.0 * (fy - fz)

    return L, a, b


def lab_to_xyz(L: float, a: float, b: float, illuminant: str = "D65") -> Tuple[float, float, float]:
    """Convert CIELAB (L*, a*, b*) back to CIE XYZ."""
    ref = ILLUMINANTS.get(illuminant, ILLUMINANTS["D65"])
    fy = (L + 16.0) / 116.0
    fx = (a / 500.0) + fy
    fz = fy - (b / 200.0)

    epsilon = 216.0 / 24389.0

    def f_inv(t: float) -> float:
        t3 = t ** 3.0
        return t3 if t3 > epsilon else ((116.0 * t - 16.0) / (24389.0 / 27.0))

    X = f_inv(fx) * ref["X"]
    Y = ( ((L + 16.0) / 116.0) ** 3.0 if L > 8.0 else (L / (24389.0 / 27.0)) ) * ref["Y"]
    Z = f_inv(fz) * ref["Z"]

    return X, Y, Z


def rgb_to_lab(r: int, g: int, b: int) -> Tuple[float, float, float]:
    """Full sRGB to CIELAB pipeline."""
    X, Y, Z = rgb_to_xyz(r, g, b)
    return xyz_to_lab(X, Y, Z)


def hex_to_lab(hex_code: str) -> Tuple[float, float, float]:
    """Convert hex color string directly to CIELAB (L*, a*, b*)."""
    r, g, b = hex_to_rgb(hex_code)
    return rgb_to_lab(r, g, b)


def lab_to_hex(L: float, a: float, b: float) -> str:
    """Convert CIELAB directly to hex color string."""
    X, Y, Z = lab_to_xyz(L, a, b)
    r, g, b = xyz_to_rgb(X, Y, Z)
    return rgb_to_hex(r, g, b)


def calculate_ita(L: float, b: float) -> float:
    """
    Calculate Individual Typology Angle (ITA°) for objective skin classification.
    Formula: ITA° = [ arctan( (L* - 50) / b* ) ] * (180 / π)
    """
    b_val = b if abs(b) > 0.0001 else 0.0001
    angle_rad = math.atan((L - 50.0) / b_val)
    return angle_rad * (180.0 / math.pi)


def classify_skin_phototype(ita: float) -> Dict[str, Any]:
    """
    Standard dermatological classification based on ITA°:
    > 55°: Very Light (Fitzpatrick I-II)
    41° to 55°: Light (Fitzpatrick II-III)
    28° to 41°: Intermediate (Fitzpatrick III-IV)
    10° to 28°: Tan (Fitzpatrick IV-V)
    -30° to 10°: Brown (Fitzpatrick V)
    < -30°: Dark (Fitzpatrick VI)
    """
    if ita > 55.0:
        return {"category": "Very Light", "code": "I-II", "melanin_index": "Low (Melano-protective)", "range": "> 55°"}
    elif ita > 41.0:
        return {"category": "Light", "code": "II-III", "melanin_index": "Mild-Low", "range": "41° to 55°"}
    elif ita > 28.0:
        return {"category": "Intermediate", "code": "III-IV", "melanin_index": "Moderate", "range": "28° to 41°"}
    elif ita > 10.0:
        return {"category": "Tan", "code": "IV-V", "melanin_index": "Moderate-High", "range": "10° to 28°"}
    elif ita > -30.0:
        return {"category": "Brown", "code": "V", "melanin_index": "High", "range": "-30° to 10°"}
    else:
        return {"category": "Dark", "code": "VI", "melanin_index": "Very High", "range": "< -30°"}


def classify_undertone(a: float, b: float) -> Dict[str, Any]:
    """
    Undertone classification using a* (red-green axis) and b* (yellow-blue axis).
    - Warm: Higher b* (golden/peachy), b*/a* > 1.25, positive b*
    - Cool: Elevated a* relative to b*, rosy/pinkish, b*/a* < 1.15
    - Olive: Balanced yellow-green undertone, lower a* relative to lightness, subtle green cast
    - Neutral: Balanced a* and b* (ratio ~1.15 - 1.25)
    """
    a_safe = a if abs(a) > 0.001 else 0.001
    ratio = b / a_safe

    if a < 7.5 and b > 12.0:
        tone = "Olive"
        description = "Neutral-warm greenish undertone with subtle yellow radiance"
        best_metals = ["Yellow Gold", "Antique Bronze", "Rose Gold"]
    elif ratio > 1.28 and b > 13.0:
        tone = "Warm"
        description = "Golden, peach, and honey undertone; excels with warm earth tones"
        best_metals = ["Polished Yellow Gold", "Brass", "Champagne Gold"]
    elif ratio < 1.12 or a > 14.5:
        tone = "Cool"
        description = "Pink, blue, and rosy undertone; excels with jewel tones and icy hues"
        best_metals = ["Platinum", "925 Sterling Silver", "White Gold"]
    else:
        tone = "Neutral"
        description = "Balanced red-yellow chromaticity; can wear both warm and cool palettes"
        best_metals = ["Rose Gold", "Mixed Silver & Gold", "White Gold"]

    return {
        "undertone": tone,
        "ratio_b_a": round(ratio, 2),
        "description": description,
        "best_metals": best_metals
    }


def determine_personal_season(L: float, a: float, b: float, ita: float) -> Dict[str, Any]:
    """
    Synthesize CIELAB coordinates, ITA°, and chromatic ratio into 4-season & 12-subseason palette.
    """
    undertone_info = classify_undertone(a, b)
    undertone = undertone_info["undertone"]
    phototype = classify_skin_phototype(ita)

    # Determine seasonal quadrant
    if undertone in ("Warm", "Olive"):
        if L >= 68.0:
            core_season = "Spring"
            subseason = "Warm Spring" if b > 18.0 else ("Light Spring" if L > 74.0 else "Clear Spring")
            headline = "Radiant, fresh, warm, and sunlit"
            palette_keywords = ["Coral", "Warm Peach", "Marigold", "Cream", "Turquoise", "Honey Gold"]
            avoid_keywords = ["Dusty Charcoal", "Icy Grey", "Magenta", "Bleached White"]
        else:
            core_season = "Autumn"
            subseason = "Deep Autumn" if L < 52.0 else ("Warm Autumn" if b > 16.0 else "Soft Autumn")
            headline = "Rich, earthy, grounded, and velvety"
            palette_keywords = ["Terracotta", "Forest Olive", "Rust", "Caramel", "Mustard", "Warm Camel"]
            avoid_keywords = ["Electric Neon", "Stark Cool Black", "Baby Blue", "Cool Fuchsia"]
    else:  # Cool or Neutral
        if L >= 65.0:
            core_season = "Summer"
            subseason = "Light Summer" if L > 72.0 else ("Cool Summer" if a > 13.0 else "Soft Summer")
            headline = "Subtle, ethereal, cool, and refined"
            palette_keywords = ["Lavender", "Powder Blue", "Slate Rose", "Muted Mauve", "Soft Navy", "Sage"]
            avoid_keywords = ["Bright Orange", "Mustard Ochre", "Warm Gold", "Muddy Brown"]
        else:
            core_season = "Winter"
            subseason = "Deep Winter" if L < 48.0 else ("Cool Winter" if a > 14.0 else "Clear Winter")
            headline = "Bold, dramatic, high-contrast, and vivid"
            palette_keywords = ["Royal Sapphire", "Emerald Green", "Pure Black", "Crisp Snow White", "True Ruby", "Plum"]
            avoid_keywords = ["Earthy Tan", "Warm Olive", "Pumpkin Orange", "Beige"]

    return {
        "core_season": core_season,
        "subseason": subseason,
        "undertone": undertone,
        "phototype": phototype,
        "headline": headline,
        "recommended_colors": palette_keywords,
        "colors_to_avoid": avoid_keywords,
        "contrast_tolerance": "High Contrast" if core_season in ("Winter", "Spring") else "Soft / Low Contrast"
    }


def ciede2000(lab1: Tuple[float, float, float], lab2: Tuple[float, float, float]) -> float:
    """
    Calculate CIEDE2000 (ΔE00) color distance between two CIELAB colors.
    Standard: ISO/CIE 11664-6:2014.
    Highly optimized for runtime execution in < 1ms.
    """
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2

    # 1. Calculate C'i, h'i
    C1 = math.hypot(a1, b1)
    C2 = math.hypot(a2, b2)
    C_bar = (C1 + C2) / 2.0

    C_bar7 = C_bar ** 7.0
    G = 0.5 * (1.0 - math.sqrt(C_bar7 / (C_bar7 + (25.0 ** 7.0))))

    a1_prime = (1.0 + G) * a1
    a2_prime = (1.0 + G) * a2

    C1_prime = math.hypot(a1_prime, b1)
    C2_prime = math.hypot(a2_prime, b2)

    def compute_h_prime(a_p: float, b_p: float) -> float:
        if abs(a_p) < 1e-6 and abs(b_p) < 1e-6:
            return 0.0
        deg = math.degrees(math.atan2(b_p, a_p))
        return (deg + 360.0) if deg < 0.0 else deg

    h1_prime = compute_h_prime(a1_prime, b1)
    h2_prime = compute_h_prime(a2_prime, b2)

    # 2. Calculate ΔL', ΔC', ΔH'
    delta_L_prime = L2 - L1
    delta_C_prime = C2_prime - C1_prime

    if C1_prime * C2_prime < 1e-6:
        delta_h_prime = 0.0
    else:
        diff_h = h2_prime - h1_prime
        if abs(diff_h) <= 180.0:
            delta_h_prime = diff_h
        elif diff_h > 180.0:
            delta_h_prime = diff_h - 360.0
        else:
            delta_h_prime = diff_h + 360.0

    delta_H_prime = 2.0 * math.sqrt(C1_prime * C2_prime) * math.sin(math.radians(delta_h_prime / 2.0))

    # 3. Calculate CIEDE2000 weighting factors
    L_bar_prime = (L1 + L2) / 2.0
    C_bar_prime = (C1_prime + C2_prime) / 2.0

    if C1_prime * C2_prime < 1e-6:
        h_bar_prime = h1_prime + h2_prime
    else:
        diff_abs = abs(h1_prime - h2_prime)
        sum_h = h1_prime + h2_prime
        if diff_abs <= 180.0:
            h_bar_prime = sum_h / 2.0
        elif sum_h < 360.0:
            h_bar_prime = (sum_h + 360.0) / 2.0
        else:
            h_bar_prime = (sum_h - 360.0) / 2.0

    T = (
        1.0
        - 0.17 * math.cos(math.radians(h_bar_prime - 30.0))
        + 0.24 * math.cos(math.radians(2.0 * h_bar_prime))
        + 0.32 * math.cos(math.radians(3.0 * h_bar_prime + 6.0))
        - 0.20 * math.cos(math.radians(4.0 * h_bar_prime - 63.0))
    )

    delta_theta = 30.0 * math.exp(-(((h_bar_prime - 275.0) / 25.0) ** 2.0))
    C_bar_prime7 = C_bar_prime ** 7.0
    R_C = 2.0 * math.sqrt(C_bar_prime7 / (C_bar_prime7 + (25.0 ** 7.0)))
    R_T = -math.sin(math.radians(2.0 * delta_theta)) * R_C

    L_minus_50_sq = (L_bar_prime - 50.0) ** 2.0
    S_L = 1.0 + (0.015 * L_minus_50_sq) / math.sqrt(20.0 + L_minus_50_sq)
    S_C = 1.0 + 0.045 * C_bar_prime
    S_H = 1.0 + 0.015 * C_bar_prime * T

    # Parametric weights (kL = kC = kH = 1 for default standard viewing conditions)
    k_L = 1.0
    k_C = 1.0
    k_H = 1.0

    term_L = delta_L_prime / (k_L * S_L)
    term_C = delta_C_prime / (k_C * S_C)
    term_H = delta_H_prime / (k_H * S_H)

    delta_E = math.sqrt(
        (term_L ** 2.0)
        + (term_C ** 2.0)
        + (term_H ** 2.0)
        + R_T * term_C * term_H
    )

    return delta_E


def bradford_adapt(rgb: Tuple[int, int, int], source_illum: str = "D65", target_illum: str = "A") -> Tuple[int, int, int]:
    """
    Perform Bradford Chromatic Adaptation Transform between two illuminants.
    E.g., transforms daytime D65 rendering to Warm Evening Incandescent (Illuminant A)
    or Office LED (F2).
    """
    if source_illum == target_illum:
        return rgb

    # Step 1: RGB to XYZ under source illuminant
    X, Y, Z = rgb_to_xyz(rgb[0], rgb[1], rgb[2])

    src = ILLUMINANTS.get(source_illum, ILLUMINANTS["D65"])
    dst = ILLUMINANTS.get(target_illum, ILLUMINANTS["A"])

    # Convert source & destination reference whites to cone responses (RGB_BFD)
    def to_cone(x: float, y: float, z: float) -> Tuple[float, float, float]:
        r = M_BFD[0][0] * x + M_BFD[0][1] * y + M_BFD[0][2] * z
        g = M_BFD[1][0] * x + M_BFD[1][1] * y + M_BFD[1][2] * z
        b = M_BFD[2][0] * x + M_BFD[2][1] * y + M_BFD[2][2] * z
        return r, g, b

    r_src, g_src, b_src = to_cone(src["X"], src["Y"], src["Z"])
    r_dst, g_dst, b_dst = to_cone(dst["X"], dst["Y"], dst["Z"])

    # Scale factors
    kr = r_dst / r_src
    kg = g_dst / g_src
    kb = b_dst / b_src

    # Cone response of input color
    r_c, g_c, b_c = to_cone(X, Y, Z)

    # Adapted cone response
    r_a = r_c * kr
    g_a = g_c * kg
    b_a = b_c * kb

    # Back to adapted XYZ
    X_adapted = M_BFD_INV[0][0] * r_a + M_BFD_INV[0][1] * g_a + M_BFD_INV[0][2] * b_a
    Y_adapted = M_BFD_INV[1][0] * r_a + M_BFD_INV[1][1] * g_a + M_BFD_INV[1][2] * b_a
    Z_adapted = M_BFD_INV[2][0] * r_a + M_BFD_INV[2][1] * g_a + M_BFD_INV[2][2] * b_a

    # Back to sRGB
    return xyz_to_rgb(X_adapted, Y_adapted, Z_adapted)
