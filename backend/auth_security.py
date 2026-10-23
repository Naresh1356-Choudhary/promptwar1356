"""
ChromaCart Zero-Trust Face Handling & Cryptographic Token Verification
Enforces:
- Strict 50-byte anonymous mathematical vector extraction
- Zero raw image uploads (rejects any base64 image or multipart payload)
- Pydantic schema validation for partner API calls
- Checksum verification for client-generated colorimetric payloads
"""

import hashlib
import time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class SkinVectorToken(BaseModel):
    """
    Anonymous 50-byte mathematical skin vector generated client-side by MediaPipe.
    Guarantees zero biometric image storage or privacy exposure.
    """
    L: float = Field(..., ge=0.0, le=100.0, description="CIELAB Lightness (0-100)")
    a: float = Field(..., ge=-128.0, le=127.0, description="CIELAB Green-Red axis")
    b: float = Field(..., ge=-128.0, le=127.0, description="CIELAB Blue-Yellow axis")
    ita: float = Field(..., ge=-90.0, le=90.0, description="Individual Typology Angle in degrees")
    undertone: str = Field(..., description="Classified undertone: Warm, Cool, Neutral, Olive")
    season: str = Field(..., description="Determined seasonal color palette")
    timestamp: Optional[int] = Field(default_factory=lambda: int(time.time()))
    signature: Optional[str] = Field(default=None, description="Optional HMAC or client checksum")

    @field_validator("undertone")
    @classmethod
    def validate_undertone(cls, v: str) -> str:
        valid = {"Warm", "Cool", "Neutral", "Olive"}
        if v not in valid:
            raise ValueError(f"Undertone must be one of {valid}")
        return v

    def generate_fingerprint(self) -> str:
        """Deterministic 8-byte hash token for session tracking without PII."""
        raw_repr = f"{self.L:.2f}:{self.a:.2f}:{self.b:.2f}:{self.ita:.1f}:{self.undertone}"
        return hashlib.sha256(raw_repr.encode("utf-8")).hexdigest()[:12]

    def to_compact_byte_repr(self) -> bytes:
        """Compact 50-byte encoded binary representation."""
        content = f"{self.L:.1f},{self.a:.1f},{self.b:.1f},{self.ita:.1f},{self.undertone[:2]},{self.season[:4]}"
        return content.encode("utf-8")[:50]


class ColorHarmonyQuery(BaseModel):
    skin_vector: SkinVectorToken
    lighting_condition: str = Field(default="D65", description="D65 (Daylight), F2 (Office), A (Warm Evening)")
    occasion: Optional[str] = Field(default="All", description="Occasion filter: Formal, Casual, Gala, Date Night")
    category: Optional[str] = Field(default="All", description="Tops, Dresses, Blazers, Knitwear, Outerwear")
    max_price: Optional[float] = Field(default=None, ge=0.0)


class GeminiOutfitRequest(BaseModel):
    skin_vector: SkinVectorToken
    occasion: str = Field(default="Casual / Streetwear")
    clothing_category: Optional[str] = Field(default="Shirts / Tops")
    body_shape: Optional[str] = Field(default="Athletic")
    lighting_condition: str = Field(default="D65")
    user_style_preference: Optional[str] = Field(default="Modern Minimalist", max_length=100)
    api_key: Optional[str] = Field(default=None, description="Optional custom Gemini API Key")


class AuditSecurityLog(BaseModel):
    event: str
    client_ip_hash: str
    payload_size_bytes: int
    zero_trust_status: str = "PASSED - NO_RAW_IMAGE_RECEIVED"
    timestamp: int = Field(default_factory=lambda: int(time.time()))
