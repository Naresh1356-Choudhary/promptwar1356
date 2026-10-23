"""
ChromaCart BigQuery-Style Vector Fashion Catalog & Availability Engine
Stores rich e-commerce catalog with pre-computed CIELAB embeddings,
real-time ΔE2000 scoring against user skin vectors, and live availability matching.
"""

from typing import List, Dict, Any, Optional
from backend.optical_math import hex_to_lab, ciede2000, bradford_adapt, hex_to_rgb, rgb_to_hex, rgb_to_lab

# Curated catalog of high-impact garments with exact colorimetric coordinates
FASHION_CATALOG = [
    {
        "id": "CC-101",
        "title": "Cashmere Oversized Knit in Burnt Terracotta",
        "brand": "Atelier Solis",
        "category": "Knitwear",
        "hex": "#C85A32",
        "price": 148.00,
        "rating": 4.9,
        "reviews": 128,
        "fabric": "100% Grade-A Mongolian Cashmere",
        "seasons": ["Autumn", "Deep Autumn", "Warm Autumn"],
        "undertones": ["Warm", "Olive"],
        "occasions": ["Casual", "Smart Casual", "Date Night"],
        "image": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/cashmere-knit-terracotta"
    },
    {
        "id": "CC-102",
        "title": "Structured Double-Breasted Blazer in Royal Sapphire",
        "brand": "Maison Noir",
        "category": "Blazers",
        "hex": "#1B3B6F",
        "price": 285.00,
        "rating": 4.8,
        "reviews": 84,
        "fabric": "Italian Worsted Wool & Silk Lining",
        "seasons": ["Winter", "Cool Winter", "Deep Winter"],
        "undertones": ["Cool", "Neutral"],
        "occasions": ["Business", "Formal", "Gala"],
        "image": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/blazer-royal-sapphire"
    },
    {
        "id": "CC-103",
        "title": "Silk Charmeuse Slip Midi Dress in Champagne Gold",
        "brand": "Lumina Silk",
        "category": "Dresses",
        "hex": "#F4E0B9",
        "price": 210.00,
        "rating": 4.9,
        "reviews": 210,
        "fabric": "100% Mulberry Silk Charmeuse 22 Momme",
        "seasons": ["Spring", "Warm Spring", "Light Spring"],
        "undertones": ["Warm", "Neutral"],
        "occasions": ["Gala", "Date Night", "Summer"],
        "image": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/slip-dress-champagne"
    },
    {
        "id": "CC-104",
        "title": "Relaxed French Linen Oxford in Soft French Lavender",
        "brand": "Côte d'Azur Studio",
        "category": "Tops",
        "hex": "#9B8EB9",
        "price": 95.00,
        "rating": 4.7,
        "reviews": 165,
        "fabric": "Normandy Washed Organic Flax Linen",
        "seasons": ["Summer", "Cool Summer", "Soft Summer"],
        "undertones": ["Cool", "Neutral"],
        "occasions": ["Casual", "Summer", "Smart Casual"],
        "image": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/linen-shirt-lavender"
    },
    {
        "id": "CC-105",
        "title": "Tailored High-Waist Trousers in Forest Olive",
        "brand": "Kaufmann Tailoring",
        "category": "Bottoms",
        "hex": "#3D4F37",
        "price": 175.00,
        "rating": 4.8,
        "reviews": 92,
        "fabric": "Wool-Tencel Blend with French Pleats",
        "seasons": ["Autumn", "Warm Autumn", "Deep Autumn"],
        "undertones": ["Warm", "Olive"],
        "occasions": ["Business", "Smart Casual"],
        "image": "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/trousers-forest-olive"
    },
    {
        "id": "CC-106",
        "title": "Belted Trench Coat in Warm Toffee Camel",
        "brand": "Heritage London",
        "category": "Outerwear",
        "hex": "#B88654",
        "price": 360.00,
        "rating": 4.9,
        "reviews": 314,
        "fabric": "Water-Repellent Cotton Gabardine",
        "seasons": ["Autumn", "Spring", "Warm Autumn"],
        "undertones": ["Warm", "Olive"],
        "occasions": ["Casual", "Business", "Smart Casual"],
        "image": "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/trench-coat-camel"
    },
    {
        "id": "CC-107",
        "title": "Merino Wool Turtleneck in Crisp Obsidian Black",
        "brand": "Vanguard Minimal",
        "category": "Knitwear",
        "hex": "#111215",
        "price": 130.00,
        "rating": 4.8,
        "reviews": 178,
        "fabric": "Extra-Fine 19.5 Micron Australian Merino",
        "seasons": ["Winter", "Cool Winter", "Deep Winter"],
        "undertones": ["Cool", "Neutral"],
        "occasions": ["Casual", "Business", "Smart Casual"],
        "image": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/merino-turtleneck-black"
    },
    {
        "id": "CC-108",
        "title": "Pleated Asymmetric Evening Gown in Crimson Ruby",
        "brand": "Valentin Haute",
        "category": "Dresses",
        "hex": "#9B111E",
        "price": 420.00,
        "rating": 5.0,
        "reviews": 67,
        "fabric": "Micro-Pleated Silk Georgette",
        "seasons": ["Winter", "Autumn", "Deep Winter", "Deep Autumn"],
        "undertones": ["Cool", "Warm", "Neutral"],
        "occasions": ["Gala", "Formal", "Date Night"],
        "image": "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/evening-gown-ruby"
    },
    {
        "id": "CC-109",
        "title": "Camp-Collar Resort Shirt in Sunburst Coral",
        "brand": "Palma Sunwear",
        "category": "Tops",
        "hex": "#FF6F59",
        "price": 88.00,
        "rating": 4.7,
        "reviews": 115,
        "fabric": "Breathable Tencel Lyocell Voile",
        "seasons": ["Spring", "Warm Spring", "Clear Spring"],
        "undertones": ["Warm"],
        "occasions": ["Casual", "Summer"],
        "image": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/resort-shirt-coral"
    },
    {
        "id": "CC-110",
        "title": "Cashmere-Silk Mockneck in Muted Sage Green",
        "brand": "Atelier Solis",
        "category": "Knitwear",
        "hex": "#7B9E87",
        "price": 165.00,
        "rating": 4.8,
        "reviews": 98,
        "fabric": "70% Cashmere, 30% Mulberry Silk",
        "seasons": ["Summer", "Autumn", "Soft Summer", "Soft Autumn"],
        "undertones": ["Neutral", "Cool", "Olive"],
        "occasions": ["Casual", "Smart Casual", "Business"],
        "image": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/mockneck-sage"
    },
    {
        "id": "CC-111",
        "title": "Architectural Wool Car Coat in Dusty Steel Blue",
        "brand": "Kaufmann Tailoring",
        "category": "Outerwear",
        "hex": "#4A6B82",
        "price": 395.00,
        "rating": 4.9,
        "reviews": 73,
        "fabric": "Heavy Double-Faced Melton Wool",
        "seasons": ["Summer", "Winter", "Cool Summer"],
        "undertones": ["Cool", "Neutral"],
        "occasions": ["Business", "Formal", "Smart Casual"],
        "image": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/car-coat-steel-blue"
    },
    {
        "id": "CC-112",
        "title": "Fine Knit Boatneck Top in Warm Marigold Ochre",
        "brand": "Studio Eclat",
        "category": "Tops",
        "hex": "#DDA738",
        "price": 115.00,
        "rating": 4.6,
        "reviews": 89,
        "fabric": "Organic Pima Cotton Crepe",
        "seasons": ["Autumn", "Spring", "Warm Autumn", "Warm Spring"],
        "undertones": ["Warm"],
        "occasions": ["Casual", "Smart Casual", "Date Night"],
        "image": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/boatneck-marigold"
    },
    {
        "id": "CC-113",
        "title": "Pure Silk Twill Scarf in Botanical Emerald & Navy",
        "brand": "Maison Noir",
        "category": "Accessories",
        "hex": "#0D5C3A",
        "price": 95.00,
        "rating": 4.9,
        "reviews": 142,
        "fabric": "100% Hand-Rolled Mulberry Silk Twill",
        "seasons": ["Winter", "Autumn", "Deep Winter"],
        "undertones": ["Cool", "Olive", "Neutral"],
        "occasions": ["Casual", "Business", "Formal", "Gala"],
        "image": "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/silk-scarf-emerald"
    },
    {
        "id": "CC-114",
        "title": "Minimalist Satin Slip Dress in Icy Rose Quartz",
        "brand": "Lumina Silk",
        "category": "Dresses",
        "hex": "#DFC5C8",
        "price": 225.00,
        "rating": 4.8,
        "reviews": 118,
        "fabric": "Heavy Weight Sandwashed Silk",
        "seasons": ["Summer", "Cool Summer", "Light Summer"],
        "undertones": ["Cool", "Neutral"],
        "occasions": ["Gala", "Date Night", "Summer"],
        "image": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/slip-dress-rose"
    },
    {
        "id": "CC-115",
        "title": "Italian Leather Belt in Deep Chestnut Rust",
        "brand": "Heritage London",
        "category": "Accessories",
        "hex": "#7A351D",
        "price": 85.00,
        "rating": 4.8,
        "reviews": 204,
        "fabric": "Vegetable-Tanned Tuscan Vachetta Leather",
        "seasons": ["Autumn", "Warm Autumn", "Deep Autumn"],
        "undertones": ["Warm", "Olive"],
        "occasions": ["Casual", "Business", "Smart Casual"],
        "image": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/leather-belt-chestnut"
    },
    {
        "id": "CC-116",
        "title": "Heavy Cotton Chore Jacket in Electric Ultramarine",
        "brand": "Vanguard Minimal",
        "category": "Outerwear",
        "hex": "#224289",
        "price": 190.00,
        "rating": 4.7,
        "reviews": 94,
        "fabric": "12oz Japanese Ring-Spun Canvas",
        "seasons": ["Winter", "Cool Winter", "Clear Winter"],
        "undertones": ["Cool"],
        "occasions": ["Casual", "Streetwear", "Smart Casual"],
        "image": "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80",
        "buy_url": "https://example.com/shop/chore-jacket-ultramarine"
    }
]


def match_catalog_items(
    skin_lab: tuple,
    user_season: str,
    user_undertone: str,
    lighting_condition: str = "D65",
    category: Optional[str] = None,
    occasion: Optional[str] = None,
    max_price: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Simulates BigQuery vector cosine & CIEDE2000 distance ranking against catalog.
    Applies Bradford chromatic adaptation transform if viewing under Office F2 or Evening A illuminant!
    """
    matched_results = []

    for item in FASHION_CATALOG:
        # Category filter
        if category and category.lower() != "all" and item["category"].lower() != category.lower():
            continue

        # Occasion filter
        if occasion and occasion.lower() != "all":
            if not any(occ.lower() == occasion.lower() for occ in item["occasions"]):
                continue

        # Price filter
        if max_price and item["price"] > max_price:
            continue

        # Extract base RGB & apply lighting adaptation
        base_rgb = hex_to_rgb(item["hex"])
        if lighting_condition != "D65":
            adapted_rgb = bradford_adapt(base_rgb, source_illum="D65", target_illum=lighting_condition)
            display_hex = rgb_to_hex(*adapted_rgb)
            item_lab = rgb_to_lab(*adapted_rgb)
        else:
            display_hex = item["hex"]
            item_lab = hex_to_lab(item["hex"])

        # Calculate exact CIEDE2000 distance
        delta_e = ciede2000(skin_lab, item_lab)

        # Flattery & Harmony scoring calculation:
        # Garments matching user's core season and undertone achieve 90-99% match.
        # Opposing season/undertone with clashing chromaticity receives lower scores with clear warnings.
        is_season_match = any(user_season.lower() in s.lower() or s.lower() in user_season.lower() for s in item["seasons"])
        is_undertone_match = user_undertone.lower() in [u.lower() for u in item["undertones"]]

        if is_season_match and is_undertone_match:
            harmony_score = max(90, min(99, int(round(100.0 - (delta_e * 0.25)))))
            badge = "Perfect Harmonic Match"
            badge_color = "success"
            clash_warning = None
        elif is_season_match:
            harmony_score = max(80, min(89, int(round(92.0 - (delta_e * 0.3)))))
            badge = "Complementary Palette"
            badge_color = "accent"
            clash_warning = None
        elif is_undertone_match:
            harmony_score = max(70, min(82, int(round(85.0 - (delta_e * 0.4)))))
            badge = "Harmonic Undertone"
            badge_color = "info"
            clash_warning = None
        else:
            harmony_score = max(38, min(65, int(round(70.0 - (delta_e * 0.5)))))
            badge = "High Clash Risk"
            badge_color = "danger"
            clash_warning = f"Clashes with your {user_undertone} undertone; color may wash out or dull complexion."

        matched_results.append({
            **item,
            "adapted_hex": display_hex,
            "delta_e_2000": round(delta_e, 2),
            "harmony_score": harmony_score,
            "badge": badge,
            "badge_color": badge_color,
            "clash_warning": clash_warning,
            "optical_specs": {
                "L": round(item_lab[0], 1),
                "a": round(item_lab[1], 1),
                "b": round(item_lab[2], 1),
                "illuminant": lighting_condition
            }
        })

    # Sort descending by harmony score (best match first)
    matched_results.sort(key=lambda x: x["harmony_score"], reverse=True)
    return matched_results
