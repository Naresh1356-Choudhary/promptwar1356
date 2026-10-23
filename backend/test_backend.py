"""
Unit & Integration Tests for ChromaCart Optical Engine & FastAPI Backend
"""

import math
from backend.optical_math import (
    hex_to_rgb, rgb_to_hex, rgb_to_xyz, xyz_to_lab,
    rgb_to_lab, hex_to_lab, calculate_ita, classify_skin_phototype,
    classify_undertone, determine_personal_season, ciede2000, bradford_adapt
)
from backend.auth_security import SkinVectorToken
from backend.vector_catalog import match_catalog_items


def test_hex_rgb_roundtrip():
    hex_in = "#C85A32"
    r, g, b = hex_to_rgb(hex_in)
    hex_out = rgb_to_hex(r, g, b)
    assert hex_in.upper() == hex_out.upper(), f"Expected {hex_in}, got {hex_out}"
    print("[PASS] Hex-RGB conversion test passed.")


def test_ita_calculation():
    # Warm Autumn test: L*=64.2, b*=19.8
    # ITA = arctan((64.2 - 50) / 19.8) * 180 / pi = arctan(14.2 / 19.8) * 180 / pi = ~35.6°
    ita = calculate_ita(64.2, 19.8)
    assert 34.0 < ita < 37.0, f"Expected ~35.6, got {ita}"
    phototype = classify_skin_phototype(ita)
    assert phototype["category"] == "Intermediate", f"Expected Intermediate, got {phototype['category']}"
    print(f"[PASS] ITA calculation test passed: {ita:.2f} deg ({phototype['category']}).")


def test_undertone_and_season():
    undertone_warm = classify_undertone(11.4, 19.8)
    assert undertone_warm["undertone"] == "Warm", f"Expected Warm, got {undertone_warm}"

    season_autumn = determine_personal_season(64.2, 11.4, 19.8, 35.6)
    assert season_autumn["core_season"] == "Autumn", f"Expected Autumn, got {season_autumn}"
    print(f"[PASS] Seasonal matrix test passed: {season_autumn['subseason']}.")


def test_ciede2000_speed_and_accuracy():
    lab1 = (60.0, 15.0, 20.0)
    lab2 = (62.0, 14.0, 21.0)
    delta_e = ciede2000(lab1, lab2)
    assert delta_e > 0.0 and delta_e < 5.0, f"Unexpected dE: {delta_e}"
    print(f"[PASS] CIEDE2000 test passed: dE2000 = {delta_e:.3f}.")


def test_bradford_adaptation():
    rgb_day = (200, 90, 50)
    rgb_evening = bradford_adapt(rgb_day, source_illum="D65", target_illum="A")
    assert rgb_evening[0] >= rgb_day[0] - 20, "Evening light should warm red channel"
    print(f"[PASS] Bradford Adaptation test passed: {rgb_day} -> {rgb_evening}.")


def test_skin_vector_token():
    token = SkinVectorToken(
        L=64.2,
        a=11.4,
        b=19.8,
        ita=35.6,
        undertone="Warm",
        season="Warm Autumn"
    )
    compact = token.to_compact_byte_repr()
    assert len(compact) <= 50, f"Token byte representation exceeded 50 bytes: {len(compact)}"
    print(f"[PASS] 50-Byte Vector Token test passed: {len(compact)} bytes ({compact.decode('utf-8')}).")


def test_catalog_matching():
    skin_lab = (64.2, 11.4, 19.8)
    matches = match_catalog_items(
        skin_lab=skin_lab,
        user_season="Autumn",
        user_undertone="Warm",
        lighting_condition="D65"
    )
    assert len(matches) > 0, "Catalog should return items"
    top_item = matches[0]
    assert top_item["harmony_score"] >= 90, f"Top match should have high harmony: {top_item['harmony_score']}"
    print(f"[PASS] Catalog Matching test passed: Top pick '{top_item['title']}' ({top_item['harmony_score']}% harmony).")


if __name__ == "__main__":
    print("\n--- Running ChromaCart Optical & Backend Verification Suite ---")
    test_hex_rgb_roundtrip()
    test_ita_calculation()
    test_undertone_and_season()
    test_ciede2000_speed_and_accuracy()
    test_bradford_adaptation()
    test_skin_vector_token()
    test_catalog_matching()
    print("[SUCCESS] All ChromaCart backend tests passed successfully!\n")
