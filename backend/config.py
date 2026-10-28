"""Central configuration for the Tourez FastAPI backend."""
import os
from dotenv import load_dotenv

load_dotenv()


def _bool(value, default=True):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _clean_secret(value: str) -> str:
    """Treat common template values as missing keys instead of real credentials."""
    value = (value or "").strip()
    lowered = value.lower()
    placeholders = (
        "your_", "replace_", "changeme", "change_me", "example", "placeholder",
    )
    if not value or any(lowered.startswith(p) for p in placeholders):
        return ""
    return value


class Settings:
    def __init__(self):
        self.use_mock = _bool(os.getenv("USE_MOCK"), True)

        raw_origins = os.getenv("ALLOWED_ORIGINS", "")
        self.allowed_origins = [
            o.strip() for o in raw_origins.split(",") if o.strip()
        ] or [
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

        # Google Gemini configuration (primary / recommended)
        self.gemini_api_key = _clean_secret(
            os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        )
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()

        # OpenAI configuration (alternative)
        self.openai_api_key = _clean_secret(os.getenv("OPENAI_API_KEY", ""))
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()

        # Leaflet renders OpenStreetMap tiles in the browser. These backend
        # endpoints provide free, keyless geocoding and nearby POI lookup.
        self.nominatim_url = os.getenv(
            "NOMINATIM_URL", "https://nominatim.openstreetmap.org"
        ).rstrip("/")
        self.overpass_url = os.getenv(
            "OVERPASS_URL", "https://overpass-api.de/api/interpreter"
        ).rstrip("/")
        raw_overpass_urls = os.getenv("OVERPASS_URLS", "")
        configured = [u.strip().rstrip("/") for u in raw_overpass_urls.split(",") if u.strip()]
        self.overpass_urls = configured or [
            self.overpass_url,
            "https://overpass.private.coffee/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
        ]
        self.osm_user_agent = os.getenv(
            "OSM_USER_AGENT", "TourezHackathon/1.0 educational-travel-demo"
        ).strip()

        # Keyless global weather forecast. Open-Meteo automatically selects
        # suitable forecast models for the requested coordinates.
        self.open_meteo_url = os.getenv(
            "OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"
        ).rstrip("/")

        self.exchange_rate_url = os.getenv(
            "EXCHANGE_RATE_URL", "https://open.er-api.com/v6/latest"
        ).rstrip("/")
        self.libretranslate_url = os.getenv(
            "LIBRETRANSLATE_URL", "https://libretranslate.de"
        ).rstrip("/")

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def has_ai(self) -> bool:
        return self.has_gemini or self.has_openai

    @property
    def ai_provider(self) -> str:
        if self.has_gemini:
            return "gemini"
        if self.has_openai:
            return "openai"
        return "demo"


settings = Settings()
