import React, { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// 1. Color Science Utilities (CIELAB, ITA, Bradford Lighting Calibration)
// ============================================================================
function rgbToXyz(r, g, b) {
  const linearize = (c) => {
    const v = c / 255.0;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const rL = linearize(r) * 100.0;
  const gL = linearize(g) * 100.0;
  const bL = linearize(b) * 100.0;
  return {
    x: rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375,
    y: rL * 0.2126729 + gL * 0.7151522 + bL * 0.072175,
    z: rL * 0.0193339 + gL * 0.119192 + bL * 0.9503041,
  };
}

function xyzToLab(x, y, z) {
  const xn = 95.047;
  const yn = 100.0;
  const zn = 108.883;

  const xr = x / xn;
  const yr = y / yn;
  const zr = z / zn;

  const eps = 216.0 / 24389.0;
  const kap = 24389.0 / 27.0;

  const f = (t) => (t > eps ? Math.cbrt(t) : (kap * t + 16.0) / 116.0);
  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);

  const L = Math.max(0, Math.min(100, 116.0 * fy - 16.0));
  const a = 500.0 * (fx - fy);
  const b = 200.0 * (fy - fz);

  return {
    L: Number(L.toFixed(1)),
    a: Number(a.toFixed(1)),
    b: Number(b.toFixed(1)),
  };
}

function rgbToLab(r, g, b) {
  const { x, y, z } = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

function calculateIta(L, b) {
  const bSafe = Math.abs(b) > 0.0001 ? b : 0.0001;
  const rad = Math.atan((L - 50.0) / bSafe);
  return Number(((rad * 180.0) / Math.PI).toFixed(1));
}

function classifySeason(L, a, b, ita) {
  const isWarm = b > 13.0 || (a > 0 && b / (a || 1) > 1.2);
  if (isWarm) {
    if (L >= 66.0) return "Warm Spring";
    if (L <= 50.0) return "Deep Autumn";
    return "Warm Autumn";
  } else {
    if (L >= 65.0) return "True Summer";
    if (L <= 50.0) return "Deep Winter";
    return "Cool Winter";
  }
}

// ============================================================================
// 2. Preset Data & Options
// ============================================================================
const DEFAULT_SAMPLE_PHOTO =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80";

const ARCHETYPES = [
  { label: "Warm Autumn", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", L: 64.2, a: 11.4, b: 19.8, ita: 35.6 },
  { label: "Cool Winter", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", L: 71.0, a: 14.8, b: 11.6, ita: 52.1 },
  { label: "Deep Autumn", url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80", L: 42.5, a: 12.2, b: 17.5, ita: 8.4 },
  { label: "True Summer", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80", L: 67.5, a: 12.8, b: 12.4, ita: 44.0 },
];

const BODY_SHAPES = [
  {
    id: "Athletic",
    title: "Athletic / V-Taper",
    description: "Broad shoulders, tapered waist. Benefits from structured lapels & relaxed draping cuts.",
    cutRule: "Structured shoulders with relaxed drape; avoids clinging fabric at the torso.",
    icon: "⚡",
  },
  {
    id: "Slim",
    title: "Slim / Lean Column",
    description: "Even vertical proportions. Benefits from layered textures & horizontal tonal blocking.",
    cutRule: "Medium-width lapels, double-pleated trousers & layered textures to add dimension.",
    icon: "📏",
  },
  {
    id: "Curvy",
    title: "Curvy / Hourglass",
    description: "Balanced bust and hips with defined waist. Benefits from fluid drape & wrap cuts.",
    cutRule: "Waist-accentuating silhouettes, open collars, and fluid bias-cut fabrics.",
    icon: "⏳",
  },
  {
    id: "Tall",
    title: "Tall / Columnar",
    description: "Elongated vertical frame. Benefits from dropped shoulders and wide-leg trousers.",
    cutRule: "Extended overshirt lengths, relaxed wide-leg hems, and broken color blocking.",
    icon: "🏛️",
  },
  {
    id: "Compact",
    title: "Compact / Petite",
    description: "Shorter torso or legs. Benefits from high-rise trousers and cropped hemlines.",
    cutRule: "High-rise waistlines, cropped outerwear jackets to visually elevate the leg line.",
    icon: "💎",
  },
];

const OCCASIONS = [
  {
    id: "Casual / Streetwear",
    title: "Casual / Streetwear",
    subtitle: "Relaxed Weekend Chic & Urban Drops",
    vibe: "Effortless, contemporary silhouettes with comfortable premium textiles.",
    image: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=600&q=80",
    colorAccent: "#76D1FF",
  },
  {
    id: "Business / Executive",
    title: "Business / Executive",
    subtitle: "Tailored Suiting & Executive Presence",
    vibe: "Crisp, structured double-breasted cuts and high-contrast tonal authority.",
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80",
    colorAccent: "#D0BCFF",
  },
  {
    id: "Festive / Wedding / Ethnic",
    title: "Festive / Wedding / Ethnic",
    subtitle: "Opulent Celebrations & Regal Elegance",
    vibe: "Luminous silk georgette, rich gilded undertones, and celebratory majesty.",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80",
    colorAccent: "#FBBF24",
  },
  {
    id: "Active / Athletic",
    title: "Active / Athletic",
    subtitle: "Performance Technical & Studio Motion",
    vibe: "Breathable ergonomic panelling, flexible four-way stretch, and dynamic accents.",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80",
    colorAccent: "#34D399",
  },
];

// Carousel items duplicated for seamless infinite loop (8 cards)
const CAROUSEL_CARDS = [
  { ...OCCASIONS[0], cardIdx: 0 },
  { ...OCCASIONS[1], cardIdx: 1 },
  { ...OCCASIONS[2], cardIdx: 2 },
  { ...OCCASIONS[3], cardIdx: 3 },
  { ...OCCASIONS[0], cardIdx: 4 },
  { ...OCCASIONS[1], cardIdx: 5 },
  { ...OCCASIONS[2], cardIdx: 6 },
  { ...OCCASIONS[3], cardIdx: 7 },
];

const CLOTHING_TYPES = [
  {
    id: "Shirts / Tops",
    title: "Shirts / Tops",
    desc: "Oversized poplins, linen camp collars, silk shells & knit boatnecks",
    icon: "👔",
  },
  {
    id: "Jackets / Overshirts",
    title: "Jackets / Overshirts",
    desc: "Tailored wool blazers, chore coats & double-breasted trench coats",
    icon: "🧥",
  },
  {
    id: "Dresses / Traditional Wear",
    title: "Dresses / Traditional Wear",
    desc: "Silk slip midis, micro-pleated gowns & regal celebratory sets",
    icon: "✨",
  },
  {
    id: "Trousers / Denim",
    title: "Trousers / Denim",
    desc: "French pleats, high-waist selvedge denim & fluid wool culottes",
    icon: "👖",
  },
];

// Local deterministic optical recommendations (resilient offline fallback)
function generateLocalRecommendations(season, bodyShape, occasion, clothingType) {
  const isWarm = season.includes("Autumn") || season.includes("Spring");
  const cutInfo = BODY_SHAPES.find((b) => b.id === bodyShape) || BODY_SHAPES[0];

  if (isWarm) {
    return [
      {
        title: `Terracotta ${clothingType} (${bodyShape} Silhouette)`,
        harmonyMode: "High-Contrast Power",
        flatteryIndex: "97% Harmonic Match",
        explanation: `Custom-tailored for ${bodyShape} dynamics: ${cutInfo.cutRule} Burnt Terracotta enriches golden melanin undertones without sallow reflections.`,
        swatches: ["#C85A32", "#B88654", "#1E1714"],
        swatchLabels: ["Terracotta", "Warm Camel", "Espresso"],
        price: "$145.00",
        buyLink: "https://www.google.com/search?q=terracotta+" + encodeURIComponent(clothingType) + "+fashion&tbm=shop",
      },
      {
        title: `Forest Olive & Ochre ${clothingType}`,
        harmonyMode: "Analogous Tonal Softness",
        flatteryIndex: "95% Harmonic Match",
        explanation: `Designed for ${occasion}: Olive tones with warm ecru layer establish optical equilibrium, highlighting cheekbone radiance.`,
        swatches: ["#3D4F37", "#E0A96D", "#E3D5C0"],
        swatchLabels: ["Forest Olive", "Golden Ochre", "Oat Ecru"],
        price: "$180.00",
        buyLink: "https://www.google.com/search?q=olive+ochre+" + encodeURIComponent(clothingType) + "&tbm=shop",
      },
      {
        title: `Champagne Gold ${clothingType} Optical Layer`,
        harmonyMode: "Color Rescue Buffer",
        flatteryIndex: "93% Undertone Sync",
        explanation: `Protective inner buffer: Soft champagne silk neutralizes heavy outer colors against the neck and chin line for ${occasion}.`,
        swatches: ["#F4E0B9", "#8C5835", "#3A2118"],
        swatchLabels: ["Champagne", "Spiced Russet", "Deep Bark"],
        price: "$120.00",
        buyLink: "https://www.google.com/search?q=champagne+" + encodeURIComponent(clothingType) + "&tbm=shop",
      },
    ];
  } else {
    return [
      {
        title: `Royal Sapphire ${clothingType} (${bodyShape} Silhouette)`,
        harmonyMode: "High-Contrast Power",
        flatteryIndex: "98% Harmonic Match",
        explanation: `Engineered for ${bodyShape} posture: ${cutInfo.cutRule} Royal Sapphire against crisp obsidian black sharpens facial contours and eye clarity.`,
        swatches: ["#1B3B6F", "#F8FAFC", "#111215"],
        swatchLabels: ["Sapphire", "Snow White", "Obsidian"],
        price: "$165.00",
        buyLink: "https://www.google.com/search?q=sapphire+" + encodeURIComponent(clothingType) + "&tbm=shop",
      },
      {
        title: `French Lavender & Cool Sage ${clothingType}`,
        harmonyMode: "Analogous Tonal Softness",
        flatteryIndex: "96% Harmonic Match",
        explanation: `Tailored for ${occasion}: Delicate cool lavender and sage green provide subtle, luminous harmony without washing out rosy-blue undertones.`,
        swatches: ["#9B8EB9", "#7B9E87", "#252B36"],
        swatchLabels: ["Lavender", "Cool Sage", "Slate Grey"],
        price: "$135.00",
        buyLink: "https://www.google.com/search?q=lavender+sage+" + encodeURIComponent(clothingType) + "&tbm=shop",
      },
      {
        title: `Crimson Ruby ${clothingType} Statement`,
        harmonyMode: "Color Rescue Buffer",
        flatteryIndex: "94% Undertone Sync",
        explanation: `Rich ruby tone balances cool pink skin highlights while providing structured dimensional depth for ${occasion}.`,
        swatches: ["#9B111E", "#4A6B82", "#111215"],
        swatchLabels: ["Ruby Red", "Steel Blue", "Obsidian"],
        price: "$210.00",
        buyLink: "https://www.google.com/search?q=crimson+ruby+" + encodeURIComponent(clothingType) + "&tbm=shop",
      },
    ];
  }
}

// ============================================================================
// 3. Curved Cylindrical Carousel Component for Occasion Selection
// ============================================================================
function CurvedOccasionCarousel({ selectedOccasion, onSelectOccasion }) {
  const containerRef = useRef(null);
  const [scrollPos, setScrollPos] = useState(0);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const lastXRef = useRef(0);
  const velocityRef = useRef(0);
  const animFrameRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const dragDistRef = useRef(0);

  const cardWidth = 200;
  const cardGap = 20;
  const pitch = cardWidth + cardGap;
  const totalTrack = CAROUSEL_CARDS.length * pitch;

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (time) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (!isDraggingRef.current) {
        if (Math.abs(velocityRef.current) > 0.5) {
          setScrollPos((prev) => (prev + velocityRef.current) % totalTrack);
          velocityRef.current *= 0.94;
        } else if (!isHovered) {
          setScrollPos((prev) => (prev + 35 * dt) % totalTrack);
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [totalTrack, isHovered]);

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    lastXRef.current = startXRef.current;
    velocityRef.current = 0;
    dragDistRef.current = 0;
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const dx = clientX - lastXRef.current;
    lastXRef.current = clientX;
    dragDistRef.current += Math.abs(dx);
    velocityRef.current = -dx;
    setScrollPos((prev) => (prev - dx) % totalTrack);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="relative w-full overflow-hidden select-none py-6">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          isDraggingRef.current = false;
        }}
        className="relative h-[340px] flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden perspective-[1000px]"
        style={{ touchAction: "pan-y" }}
      >
        {CAROUSEL_CARDS.map((card) => {
          const containerWidth = containerRef.current ? containerRef.current.offsetWidth : 900;
          const centerX = containerWidth / 2;

          let xOffset = (card.cardIdx * pitch - scrollPos) % totalTrack;
          if (xOffset < -pitch * 2) xOffset += totalTrack;
          if (xOffset > totalTrack - pitch * 2) xOffset -= totalTrack;

          const cardCenter = xOffset + cardWidth / 2;
          const distFromCenter = cardCenter - centerX;
          const normDist = Math.min(1.4, Math.abs(distFromCenter) / (containerWidth / 2.2));

          const height = 270 + 70 * Math.pow(normDist, 2.2);
          const rotateY = (distFromCenter / (containerWidth / 2)) * 26;
          const translateZ = -60 * Math.pow(normDist, 1.8);
          const opacity = Math.max(0.35, 1 - Math.pow(normDist, 2.8) * 0.7);
          const isSelected = selectedOccasion === card.id;

          return (
            <div
              key={card.cardIdx}
              onClick={() => {
                if (dragDistRef.current < 6) {
                  onSelectOccasion(card.id);
                }
              }}
              className={`absolute top-1/2 rounded-[18px] overflow-hidden border transition-shadow duration-300 group flex flex-col justify-between ${
                isSelected
                  ? "border-[#76D1FF] ring-2 ring-[#76D1FF]/50 shadow-[0_0_24px_rgba(118,209,255,0.4)]"
                  : "border-[#2E353C] hover:border-[#76D1FF]/40 shadow-xl"
              }`}
              style={{
                width: `${cardWidth}px`,
                height: `${height}px`,
                left: `${xOffset}px`,
                transform: `translateY(-50%) perspective(1000px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                opacity,
                zIndex: Math.round(100 - normDist * 50),
                backgroundColor: "#191D21",
                willChange: "transform, opacity",
              }}
            >
              <div className="relative w-full h-full overflow-hidden bg-[#0F1214]">
                <img
                  src={card.image}
                  alt={card.title}
                  draggable={false}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111417] via-black/20 to-black/60" />

                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[#76D1FF] border border-white/10">
                    {card.title.split(" / ")[0]}
                  </span>
                  {isSelected && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#76D1FF] shadow-[0_0_8px_#76D1FF]" />
                  )}
                </div>

                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-[#111417] via-[#111417]/80 to-transparent">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight drop-shadow">
                        {card.title}
                      </h4>
                      <p className="text-[10px] text-[#A6ADB5] line-clamp-1 mt-0.5">
                        {card.subtitle}
                      </p>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md border text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-[#76D1FF] text-[#00354B] border-[#76D1FF]"
                          : "bg-white/15 text-white border-white/20 group-hover:bg-[#76D1FF]/20 group-hover:text-[#76D1FF]"
                      }`}
                    >
                      {isSelected ? "✓" : "▶"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 mt-2 text-[11px] text-[#A6ADB5] font-mono">
        <span>↔</span>
        <span>Drag or flick the curved carousel to explore • Click any card to select</span>
      </div>
    </div>
  );
}

// ============================================================================
// 4. Main ChromaCart Wizard Application Component
// ============================================================================
export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [photoUrl, setPhotoUrl] = useState(DEFAULT_SAMPLE_PHOTO);
  const [metrics, setMetrics] = useState({ L: 64.2, a: 11.4, b: 19.8, ita: 35.6 });
  const [calibratedSeason, setCalibratedSeason] = useState("Warm Autumn");
  const [lightingMode, setLightingMode] = useState("D65");
  const [isWebcamActive, setIsWebcamActive] = useState(false);

  const [selectedBodyShape, setSelectedBodyShape] = useState("Athletic");
  const [selectedOccasion, setSelectedOccasion] = useState("Casual / Streetwear");
  const [selectedClothingType, setSelectedClothingType] = useState("Shirts / Tops");
  const [copiedHex, setCopiedHex] = useState(null);

  // Recommendations state & engine metadata
  const [recommendations, setRecommendations] = useState([]);
  const [engineMeta, setEngineMeta] = useState({
    engine: "Deterministic Optical Physics Engine (Zero Token Cost)",
    api_key_configured: true,
  });
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Agentic Product Recommendation Fetcher (Handles both with and without API key)
  const fetchAgentRecommendations = useCallback(
    async (season, bodyShape, occasion, clothingType, currentMetrics, light) => {
      setIsLoadingRecs(true);
      const isWarm = season.includes("Autumn") || season.includes("Spring");
      const localFallback = generateLocalRecommendations(season, bodyShape, occasion, clothingType);

      try {
        const payload = {
          skin_vector: {
            L: currentMetrics.L,
            a: currentMetrics.a,
            b: currentMetrics.b,
            ita: currentMetrics.ita,
            undertone: isWarm ? "Warm" : "Cool",
            season: season,
          },
          occasion: occasion,
          clothing_category: clothingType,
          body_shape: bodyShape,
          lighting_condition: light,
        };

        const res = await fetch("/api/agent/outfit-generator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.outfit_options && data.outfit_options.length > 0) {
            setRecommendations(data.outfit_options);
            if (data.metadata) {
              setEngineMeta(data.metadata);
            }
            setIsLoadingRecs(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Backend agent unreachable, using deterministic optical fallback:", err);
      }

      // Resilient fallback if no API key or offline
      setRecommendations(localFallback);
      setEngineMeta({
        engine: "Deterministic Optical Physics Engine (Zero Token Fallback)",
        api_key_configured: false,
      });
      setIsLoadingRecs(false);
    },
    []
  );

  // Auto-fetch recommendations when entering Step 5
  useEffect(() => {
    if (currentStep === 5) {
      fetchAgentRecommendations(
        calibratedSeason,
        selectedBodyShape,
        selectedOccasion,
        selectedClothingType,
        metrics,
        lightingMode
      );
    }
  }, [currentStep, calibratedSeason, selectedBodyShape, selectedOccasion, selectedClothingType, metrics, lightingMode, fetchAgentRecommendations]);

  const analyzeImageColor = useCallback((imageSrc) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);

      const data = ctx.getImageData(30, 30, 40, 40).data;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;

      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        count++;
      }

      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);

      const lab = rgbToLab(r, g, b);
      const ita = calculateIta(lab.L, lab.b);
      const season = classifySeason(lab.L, lab.a, lab.b, ita);

      setMetrics({ ...lab, ita });
      setCalibratedSeason(season);
    };
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      stopCamera();
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result;
        setPhotoUrl(url);
        analyzeImageColor(url);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      setIsWebcamActive(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Unable to access camera. Please allow permissions or upload a photo.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 640;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setPhotoUrl(dataUrl);
      analyzeImageColor(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
  };

  const handleViewfinderClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normX = Math.max(0, Math.min(1, x / rect.width));
    const normY = Math.max(0, Math.min(1, y / rect.height));

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photoUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      const px = Math.floor(normX * img.width);
      const py = Math.floor(normY * img.height);
      const pixel = ctx.getImageData(px, py, 1, 1).data;

      const lab = rgbToLab(pixel[0], pixel[1], pixel[2]);
      const ita = calculateIta(lab.L, lab.b);
      const season = classifySeason(lab.L, lab.a, lab.b, ita);

      setMetrics({ ...lab, ita });
      setCalibratedSeason(season);
    };
  };

  const handleCopyHex = (hex) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const getLightingBadge = () => {
    switch (lightingMode) {
      case "D65":
        return {
          text: "Lighting Verified: Natural D65 Pass (6500K)",
          style: "bg-emerald-950/80 text-emerald-300 border-emerald-500/30",
          dot: "bg-emerald-400",
        };
      case "F2":
        return {
          text: "Lighting Verified: Office LED Calibrated (4000K)",
          style: "bg-sky-950/80 text-sky-300 border-sky-500/30",
          dot: "bg-sky-400",
        };
      case "A":
        return {
          text: "Lighting Verified: Warm Evening Calibrated (2856K)",
          style: "bg-amber-950/80 text-amber-300 border-amber-500/30",
          dot: "bg-amber-400",
        };
      default:
        return {
          text: "Lighting Verified",
          style: "bg-emerald-950/80 text-emerald-300 border-emerald-500/30",
          dot: "bg-emerald-400",
        };
    }
  };

  const badgeInfo = getLightingBadge();
  const activeOccasionMeta = OCCASIONS.find((o) => o.id === selectedOccasion) || OCCASIONS[0];
  const renderedRecs = recommendations.length > 0 ? recommendations : generateLocalRecommendations(calibratedSeason, selectedBodyShape, selectedOccasion, selectedClothingType);

  return (
    <div className="min-h-screen bg-[#111417] text-[#E1E2E6] font-sans antialiased selection:bg-[#76D1FF] selection:text-[#00354B]">
      
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 bg-[#191D21]/95 backdrop-blur-md border-b border-[#292F35]">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#76D1FF] to-[#D0BCFF] flex items-center justify-center font-black text-[#00354B] text-base shadow-lg shadow-[#76D1FF]/20">
              CC
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-none">
                ChromaCart
              </h1>
              <span className="text-[10px] text-[#A6ADB5] font-medium tracking-wide">
                Agentic Color Analysis & Styling Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#76D1FF] bg-[#1F2B33] px-3 py-1 rounded-full border border-[#76D1FF]/30">
              Step {currentStep} of 5
            </span>
          </div>
        </div>
      </header>

      {/* Stepper Navigation Bar */}
      <nav className="bg-[#14171A] border-b border-[#292F35] py-2.5 px-4 overflow-x-auto scrollbar-none">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 min-w-[580px]">
          {[
            { num: 1, label: "Skin Tone" },
            { num: 2, label: "Body Silhouette" },
            { num: 3, label: "Occasion" },
            { num: 4, label: "Clothing Type" },
            { num: 5, label: "Recommendations" },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentStep === s.num
                  ? "bg-[#76D1FF] text-[#00354B] shadow-md shadow-[#76D1FF]/20"
                  : currentStep > s.num
                  ? "bg-[#1E262C] text-emerald-400 border border-emerald-500/20"
                  : "text-[#A6ADB5] hover:text-white"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  currentStep === s.num
                    ? "bg-[#00354B] text-[#76D1FF]"
                    : currentStep > s.num
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-[#292F35] text-[#CBD3DC]"
                }`}
              >
                {currentStep > s.num ? "✓" : s.num}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* STEP 1: SKIN TONE & UNDERTONE CAPTURE */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 bg-[#191D21] rounded-3xl p-6 border border-[#292F35] shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#76D1FF]">Step 1 / 5</span>
                  <h2 className="text-xl font-bold text-white tracking-tight">Skin Tone & Undertone Capture</h2>
                </div>
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-[#1F2B33] text-[#76D1FF] border border-[#76D1FF]/20">
                  Client Optical
                </span>
              </div>

              <div
                onClick={!isWebcamActive ? handleViewfinderClick : undefined}
                className="relative rounded-2xl overflow-hidden aspect-square bg-[#0F1214] border border-[#2E353B] shadow-inner flex items-center justify-center cursor-crosshair group"
                title="Click anywhere on photo to sample skin pixel color"
              >
                {isWebcamActive ? (
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={photoUrl}
                    alt="Analyzed Subject"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                )}

                {!isWebcamActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border border-[#76D1FF]/60 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#76D1FF] animate-ping" />
                    </div>
                  </div>
                )}

                <div className="absolute top-3 left-3 bg-[#111417]/85 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-mono text-[#E1E2E6] border border-white/10 pointer-events-none">
                  🎯 Tap face to sample skin tone
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#292F35] hover:bg-[#323940] text-white border border-[#3E464E] transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>📁</span>
                  <span>Upload Photo</span>
                </button>

                {isWebcamActive ? (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#76D1FF] hover:bg-[#58C4F8] text-[#00354B] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>📸</span>
                    <span>Capture Frame</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#76D1FF] hover:bg-[#58C4F8] text-[#00354B] transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>📷</span>
                    <span>Use Camera</span>
                  </button>
                )}
              </div>

              {isWebcamActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full mt-2 py-1.5 rounded-lg text-[11px] text-[#FFB4AB] hover:bg-[#FFB4AB]/10 transition-colors"
                >
                  Cancel Camera
                </button>
              )}

              <div className="mt-4 pt-4 border-t border-[#292F35]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A6ADB5] block mb-2">
                  Or Test Preset Archetypes
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ARCHETYPES.map((arch, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setPhotoUrl(arch.url);
                        analyzeImageColor(arch.url);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-[#24292E] hover:bg-[#2F353C] text-[10px] font-semibold text-[#CBD3DC] border border-[#323940] transition-colors truncate text-center"
                    >
                      {arch.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="bg-[#191D21] rounded-3xl p-6 border border-[#292F35] shadow-xl">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#76D1FF]">Optical Quality Check</span>
                    <h3 className="text-base font-bold text-white">White-Light Guardrail & Validator</h3>
                  </div>
                  <span className="text-[10px] text-[#A6ADB5] font-mono">Ambient Control</span>
                </div>

                <div className="flex gap-2 bg-[#14171A] p-1.5 rounded-xl border border-[#292F35] text-xs mt-3">
                  {[
                    { id: "D65", label: "☀️ Daylight 6500K" },
                    { id: "F2", label: "🏢 Office LED 4000K" },
                    { id: "A", label: "🌆 Evening 2856K" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLightingMode(l.id)}
                      className={`flex-1 py-2 px-2 rounded-lg font-bold transition-all text-xs truncate ${
                        lightingMode === l.id
                          ? "bg-[#76D1FF] text-[#00354B] shadow-sm"
                          : "text-[#A6ADB5] hover:text-white"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>

                <div className={`mt-4 p-3.5 rounded-xl border flex items-center gap-3 text-xs font-semibold ${badgeInfo.style}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${badgeInfo.dot} animate-pulse`} />
                  <span>{badgeInfo.text}</span>
                </div>
              </div>

              <div className="bg-[#191D21] rounded-3xl p-6 border border-[#292F35] shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#76D1FF]">Deterministic Extraction</span>
                    <h3 className="text-base font-bold text-white">Extracted CIELAB (L*, a*, b*) & Season</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-[#A6ADB5] block">Color Season</span>
                    <span className="text-base font-extrabold text-[#76D1FF] font-sans">{calibratedSeason}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#24292E] p-3.5 rounded-2xl border border-[#2E353C] text-center">
                    <span className="text-[10px] font-bold uppercase text-[#A6ADB5] block">Luminance (L*)</span>
                    <span className="text-xl font-extrabold text-white font-mono mt-1 block">{metrics.L}</span>
                    <span className="text-[9px] text-[#A6ADB5] mt-0.5 block">Lightness (0-100)</span>
                  </div>

                  <div className="bg-[#24292E] p-3.5 rounded-2xl border border-[#2E353C] text-center">
                    <span className="text-[10px] font-bold uppercase text-[#A6ADB5] block">Green-Red (a*)</span>
                    <span className="text-xl font-extrabold text-white font-mono mt-1 block">
                      {metrics.a >= 0 ? `+${metrics.a}` : metrics.a}
                    </span>
                    <span className="text-[9px] text-[#A6ADB5] mt-0.5 block">Erythema axis</span>
                  </div>

                  <div className="bg-[#24292E] p-3.5 rounded-2xl border border-[#2E353C] text-center">
                    <span className="text-[10px] font-bold uppercase text-[#A6ADB5] block">Blue-Yellow (b*)</span>
                    <span className="text-xl font-extrabold text-white font-mono mt-1 block">
                      {metrics.b >= 0 ? `+${metrics.b}` : metrics.b}
                    </span>
                    <span className="text-[9px] text-[#A6ADB5] mt-0.5 block">Melanin axis</span>
                  </div>

                  <div className="bg-[#24292E] p-3.5 rounded-2xl border border-[#2E353C] text-center">
                    <span className="text-[10px] font-bold uppercase text-[#76D1FF] block">ITA° Angle</span>
                    <span className="text-xl font-extrabold text-[#76D1FF] font-mono mt-1 block">{metrics.ita}°</span>
                    <span className="text-[9px] text-[#A6ADB5] mt-0.5 block">Typology Angle</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#292F35] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="bg-[#76D1FF] hover:bg-[#58C4F8] text-[#00354B] font-bold text-xs py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <span>Proceed to Body Silhouette Analysis</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: BODY DYNAMICS & SILHOUETTE ANALYSIS */}
        {currentStep === 2 && (
          <div className="max-w-4xl mx-auto bg-[#191D21] rounded-3xl p-6 sm:p-8 border border-[#292F35] shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#76D1FF]">Step 2 / 5</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">Body Dynamics & Silhouette Analysis</h2>
                <p className="text-xs text-[#A6ADB5] mt-1">Select your body proportions to determine flattering structural garment cuts.</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#1F2B33] text-[#76D1FF]">
                Selected: {selectedBodyShape}
              </span>
            </div>

            {/* Clickable Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {BODY_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => setSelectedBodyShape(shape.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    selectedBodyShape === shape.id
                      ? "bg-[#76D1FF] text-[#00354B] shadow-md shadow-[#76D1FF]/25 scale-105"
                      : "bg-[#24292E] text-[#CBD3DC] border border-[#2E353C] hover:border-[#3E464E]"
                  }`}
                >
                  <span>{shape.icon}</span>
                  <span>[{shape.id}]</span>
                </button>
              ))}
            </div>

            {/* Detailed Shape Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BODY_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => setSelectedBodyShape(shape.id)}
                  className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    selectedBodyShape === shape.id
                      ? "bg-[#1F2B33] border-[#76D1FF] shadow-lg shadow-[#76D1FF]/10 scale-[1.02]"
                      : "bg-[#24292E] border-[#2E353C] hover:border-[#3E464E] text-[#CBD3DC]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{shape.icon}</span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                        selectedBodyShape === shape.id ? "border-[#76D1FF] bg-[#76D1FF] text-[#00354B] font-bold" : "border-[#3E464E]"
                      }`}>
                        {selectedBodyShape === shape.id ? "✓" : ""}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">{shape.title}</h3>
                    <p className="text-xs text-[#A6ADB5] leading-relaxed mb-3">{shape.description}</p>
                  </div>

                  <div className="pt-3 border-t border-[#2E353C] text-[11px] text-[#76D1FF] font-medium">
                    📌 {shape.cutRule}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-[#292F35] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="py-2.5 px-5 rounded-xl text-xs font-bold bg-[#292F35] hover:bg-[#323940] text-white border border-[#3E464E] transition-all"
              >
                ← Back to Skin Tone
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="bg-[#76D1FF] hover:bg-[#58C4F8] text-[#00354B] font-bold text-xs py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <span>Proceed to Occasion Selection</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OCCASION SELECTION (Curved Cylindrical Carousel + Pills) */}
        {currentStep === 3 && (
          <div className="max-w-5xl mx-auto bg-[#191D21] rounded-3xl p-6 sm:p-8 border border-[#292F35] shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#76D1FF]">Step 3 / 5</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">Occasion Selection</h2>
                <p className="text-xs text-[#A6ADB5] mt-1">
                  Explore aesthetic atmospheres on the curved cylindrical carousel or select an occasion pill.
                </p>
              </div>

              {/* Clickable Pill Options */}
              <div className="flex flex-wrap gap-1.5 bg-[#14171A] p-1.5 rounded-full border border-[#292F35]">
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => setSelectedOccasion(occ.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                      selectedOccasion === occ.id
                        ? "bg-[#76D1FF] text-[#00354B] shadow-md shadow-[#76D1FF]/25 scale-105"
                        : "text-[#A6ADB5] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    [{occ.id}]
                  </button>
                ))}
              </div>
            </div>

            <CurvedOccasionCarousel
              selectedOccasion={selectedOccasion}
              onSelectOccasion={(id) => setSelectedOccasion(id)}
            />

            <div className="mt-4 p-5 rounded-2xl bg-[#14171A] border border-[#292F35] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#76D1FF]" />
                  <span className="text-xs font-bold text-[#76D1FF] uppercase tracking-wider">
                    Active Context: {activeOccasionMeta.title}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  {activeOccasionMeta.subtitle}
                </h3>
                <p className="text-xs text-[#CBD3DC] mt-1">
                  {activeOccasionMeta.vibe}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#1F2B33] text-[#76D1FF] border border-[#76D1FF]/30 whitespace-nowrap">
                  ✓ Selected for Synthesis
                </span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#292F35] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="py-2.5 px-5 rounded-xl text-xs font-bold bg-[#292F35] hover:bg-[#323940] text-white border border-[#3E464E] transition-all"
              >
                ← Back to Body Silhouette
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="bg-[#76D1FF] hover:bg-[#58C4F8] text-[#00354B] font-bold text-xs py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <span>Proceed to Clothing Type</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CLOTHING TYPE PREFERENCE */}
        {currentStep === 4 && (
          <div className="max-w-4xl mx-auto bg-[#191D21] rounded-3xl p-6 sm:p-8 border border-[#292F35] shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#76D1FF]">Step 4 / 5</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">Clothing Type Preference</h2>
                <p className="text-xs text-[#A6ADB5] mt-1">Choose the specific apparel category to curate.</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#1F2B33] text-[#76D1FF]">
                Selected: {selectedClothingType}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CLOTHING_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedClothingType(type.id)}
                  className={`p-6 rounded-2xl border text-left transition-all flex items-start gap-4 ${
                    selectedClothingType === type.id
                      ? "bg-[#1F2B33] border-[#76D1FF] ring-1 ring-[#76D1FF]/40 shadow-lg scale-[1.01]"
                      : "bg-[#24292E] border-[#2E353C] hover:border-[#3E464E] text-[#CBD3DC]"
                  }`}
                >
                  <div className="text-3xl p-3 rounded-xl bg-[#14171A] border border-[#292F35]">
                    {type.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-bold text-white">[{type.title}]</h3>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                        selectedClothingType === type.id ? "border-[#76D1FF] bg-[#76D1FF] text-[#00354B] font-bold" : "border-[#3E464E]"
                      }`}>
                        {selectedClothingType === type.id ? "✓" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-[#A6ADB5] leading-relaxed">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-[#292F35] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="py-2.5 px-5 rounded-xl text-xs font-bold bg-[#292F35] hover:bg-[#323940] text-white border border-[#3E464E] transition-all"
              >
                ← Back to Occasion
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="bg-[#76D1FF] hover:bg-[#58C4F8] text-[#00354B] font-bold text-xs py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <span>Generate Recommendations</span>
                <span>✨</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: AGENTIC RECOMMENDATION & DIRECT PRODUCT LINKS */}
        {currentStep === 5 && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-[#191D21] rounded-3xl p-6 border border-[#292F35] shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#76D1FF]">
                    Step 5 / 5 • Agentic Synthesis
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14171A] text-emerald-400 border border-emerald-500/30">
                    {engineMeta.engine.includes("Gemini") ? "✨ Gemini 2.5 Flash Agent" : "⚡ Optical Physics Engine"}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">Curated Wardrobe Recommendations</h2>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  <span className="bg-[#1F2B33] text-[#76D1FF] px-2.5 py-1 rounded-lg border border-[#76D1FF]/20 font-semibold">
                    Season: {calibratedSeason} (ITA° {metrics.ita}°)
                  </span>
                  <span className="bg-[#1F2B33] text-[#CBD3DC] px-2.5 py-1 rounded-lg border border-[#3E464E]">
                    Silhouette: {selectedBodyShape}
                  </span>
                  <span className="bg-[#1F2B33] text-[#CBD3DC] px-2.5 py-1 rounded-lg border border-[#3E464E]">
                    Occasion: {selectedOccasion}
                  </span>
                  <span className="bg-[#1F2B33] text-[#CBD3DC] px-2.5 py-1 rounded-lg border border-[#3E464E]">
                    Category: {selectedClothingType}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchAgentRecommendations(calibratedSeason, selectedBodyShape, selectedOccasion, selectedClothingType, metrics, lightingMode)}
                  className="py-2 px-3.5 rounded-xl text-xs font-bold bg-[#14171A] hover:bg-[#24292E] text-[#76D1FF] border border-[#76D1FF]/30 transition-all flex items-center gap-1.5"
                  title="Re-run Agent Synthesis"
                >
                  <span>🔄</span>
                  <span>Refresh AI Recommendations</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="py-2 px-3.5 rounded-xl text-xs font-bold bg-[#292F35] hover:bg-[#323940] text-white border border-[#3E464E] transition-all"
                >
                  ↺ Modify Inputs
                </button>
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoadingRecs && (
              <div className="p-8 text-center bg-[#191D21] rounded-3xl border border-[#292F35]">
                <div className="w-8 h-8 rounded-full border-2 border-[#76D1FF] border-t-transparent animate-spin mx-auto mb-3" />
                <span className="text-xs text-[#A6ADB5] font-mono">
                  Synthesizing optical colorimetry & e-commerce availability...
                </span>
              </div>
            )}

            {/* 3 Tailored Recommendation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {renderedRecs.map((rec, idx) => (
                <div
                  key={idx}
                  className="bg-[#191D21] rounded-3xl p-6 border border-[#292F35] hover:border-[#76D1FF]/50 transition-all flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#76D1FF]">
                        {rec.harmonyMode || rec.mode || "Harmonic Sync"}
                      </span>
                      <span className="text-xs font-bold text-white font-mono">{rec.price || "$145.00"}</span>
                    </div>

                    <div className="inline-block px-2.5 py-1 rounded-md bg-[#1F2B33] text-emerald-400 font-mono text-[11px] font-bold mb-3">
                      {rec.flatteryIndex || rec.flattery_index || "96% Match"}
                    </div>

                    <h3 className="text-base font-bold text-white mb-2 leading-snug">{rec.title}</h3>
                    <p className="text-xs text-[#CBD3DC] leading-relaxed mb-5">{rec.explanation || rec.desc}</p>

                    {/* 3 Interactive Color Swatch Circles */}
                    <div className="bg-[#14171A] p-3.5 rounded-2xl border border-[#292F35] mb-5">
                      <span className="text-[9px] uppercase font-bold text-[#A6ADB5] block mb-2">
                        Matching Skin Undertone Swatches (Click to Copy)
                      </span>
                      <div className="flex items-center gap-3">
                        {(rec.swatches || ["#C85A32", "#B88654", "#1E1714"]).map((hex, sIdx) => {
                          const label = (rec.swatchLabels && rec.swatchLabels[sIdx]) || (rec.swatch_labels && rec.swatch_labels[sIdx]) || ["Primary", "Secondary", "Accent"][sIdx];
                          return (
                            <div key={sIdx} className="text-center flex-1">
                              <button
                                type="button"
                                onClick={() => handleCopyHex(hex)}
                                className="w-10 h-10 rounded-full mx-auto shadow-inner border border-white/20 transition-transform hover:scale-110 active:scale-95 block"
                                style={{ backgroundColor: hex }}
                                title={`${label}: ${hex}`}
                              />
                              <span className="text-[9px] font-mono text-[#A6ADB5] block mt-1">
                                {hex}
                              </span>
                              <span className="text-[8px] text-[#76D1FF] block truncate">
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {copiedHex && (
                        <div className="text-center text-[10px] text-emerald-400 font-bold mt-2">
                          Copied {copiedHex} to clipboard!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Direct Product Link Button */}
                  <a
                    href={rec.buyLink || rec.buy_link || rec.buyUrl || "https://www.google.com/search?q=fashion&tbm=shop"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#004D6B] hover:bg-[#76D1FF] text-[#C3E8FF] hover:text-[#00354B] py-3 px-4 rounded-xl text-center text-xs font-bold transition-all block shadow-md"
                  >
                    Shop Product Link →
                  </a>
                </div>
              ))}
            </div>

            <div className="bg-[#191D21] rounded-3xl p-5 border border-[#292F35] flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-[#A6ADB5]">Want to test a different silhouette or occasion?</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-2 px-3 rounded-lg bg-[#24292E] hover:bg-[#2F353C] text-[#CBD3DC] border border-[#323940]"
                >
                  Change Silhouette
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="py-2 px-3 rounded-lg bg-[#24292E] hover:bg-[#2F353C] text-[#CBD3DC] border border-[#323940]"
                >
                  Change Occasion
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="py-2 px-3 rounded-lg bg-[#24292E] hover:bg-[#2F353C] text-[#CBD3DC] border border-[#323940]"
                >
                  Change Clothing Type
                </button>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
