"""Unified P24 listing privacy & feature classifier (Single Source of Truth).

Used by:
- api/services/live_search.py (search card & cached detail parsing)
- api/scraper/portal_parser.py (full portal page parser)
- api/routers/live_p24.py (/api/listing-photos full description enrichment)
- api/intelligence/evaluator.py (scoring & privacy intelligence)
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, Optional

VALID_PRIVACY_VALUES = (
    "independent",
    "apartment_block",
    "freestanding_house",
    "garden_cottage",
    "attached_flatlet",
    "room_shared",
    "landlord_on_site",
)

SHARED_PRIVACY_TYPES = ("garden_cottage", "attached_flatlet", "room_shared", "landlord_on_site")

_NEGATED_LANDLORD_RE = re.compile(
    r"\b(?:no|not|zero|without)\s+(?:landlord|owner)\s+(?:on[- ]?site|residing)\b",
    re.I,
)

_ROOM_SHARED_RE = re.compile(
    r"\b(?:room to let|flatshare|digs|shared house|shared apartment|single room)\b",
    re.I,
)
_ATTACHED_FLATLET_RE = re.compile(
    r"\b(?:separate entrance|attached flatlet|wing of the house|attached granny flat|bachelor flatlet|studio flatlet)\b",
    re.I,
)
_GARDEN_COTTAGE_RE = re.compile(
    r"\b(?:cottage|garden cottage|nutec cottage|granny flat|part of a larger property|behind the main house|behind main house|set back from the main house|dual living)\b",
    re.I,
)
_LANDLORD_ONSITE_RE = re.compile(
    r"\b(?:landlord lives|owner lives|landlord resides|owner resides|landlord on site|landlord on-site|owner on site|owner on-site|on owners? property|on landlords? property|owners? discretion|main house occupied by owner|share with owner|shared property|attached to main house|shared yard|shared garden|shared gate|shared driveway|suit single|suit quiet tenant)\b",
    re.I,
)
_SHARED_ENTRANCE_RE = re.compile(
    r"\b(?:shared entrance|shared driveway|shared gate|driveway shared|communal entrance|walk past main house)\b",
    re.I,
)
_SHARED_GARDEN_RE = re.compile(
    r"\b(?:shared garden|communal garden|shared yard|communal yard|shared grounds|part of a larger property)\b",
    re.I,
)
_SHARED_POOL_RE = re.compile(
    r"\b(?:shared pool|communal pool|heated pool|pool.*(?:owners? discretion|shared|utilized))\b",
    re.I,
)
_APARTMENT_BLOCK_RE = re.compile(
    r"\b(?:unit\s*\d+|apt\s*\d+|apartment\s*building|apartment\s*block|sectional\s*title|heights|towers|court|manor|mews|villas|terraces|residences|block\s+[a-z0-9])\b",
    re.I,
)
_STUDIO_OR_ONE_BED_RE = re.compile(r"\b(?:studio|bachelor|0\.5\s*bed)\b", re.I)
_STREET_NUM_RE = re.compile(r"^\d{1,4}\s+[a-z]", re.I)
_SHARED_UTILITY_OR_ESTATE_RE = re.compile(
    r"\b(?:wi-?fi\s+included|wifi\s+incl|internet\s+included|security\s+estate|gated\s+estate|three-bedroom\s+villa|family\s+home)\b",
    re.I,
)

_MAIN_ROAD_RE = re.compile(
    r"\b(main\s+r(oa)?d|victoria\s+r(oa)?d|somerset\s+r(oa)?d|regent\s+r(oa)?d|kloof\s+st(reet)?|kloof\s+nek|buitengracht|new\s+church(\s+st(reet)?)?|orange\s+st(reet)?|roeland\s+st(reet)?|buitenkant(\s+st(reet)?)?|strand\s+st(reet)?|helen\s+suzman|mill\s+st(reet)?|voortrekker\s+r(oa)?d|ou\s+kaapse\s+weg|kommetjie\s+r(oa)?d|baden\s+powell|highway|freeway|motorway|m3|m4|m5|m6|m62)\b",
    re.I,
)


def classify_privacy(
    title: str = "",
    address: str = "",
    description: str = "",
    estate_name: str = "",
    amenities: Optional[Iterable[str]] = None,
    bedrooms: Optional[float] = None,
    is_security_estate: bool = False,
    existing_privacy: Optional[str] = None,
    existing_landlord_on_site: Optional[bool] = None,
    vision_verified: bool = False,
) -> Dict[str, Any]:
    """Classify dwelling type, landlord-on-site status, and shared-erf heuristics."""
    amenities_str = " ".join(str(a) for a in (amenities or []))
    combined = f"{title or ''} {address or ''} {estate_name or ''} {description or ''} {amenities_str}".lower()
    clean_no_neg = _NEGATED_LANDLORD_RE.sub("", combined)

    if vision_verified and existing_privacy in VALID_PRIVACY_VALUES:
        dwelling_privacy = existing_privacy
        is_landlord = (
            bool(existing_landlord_on_site)
            if existing_landlord_on_site is not None
            else (dwelling_privacy in SHARED_PRIVACY_TYPES)
        )
    elif _ROOM_SHARED_RE.search(combined):
        dwelling_privacy = "room_shared"
        is_landlord = True
    elif _ATTACHED_FLATLET_RE.search(combined):
        dwelling_privacy = "attached_flatlet"
        is_landlord = True
    elif _GARDEN_COTTAGE_RE.search(combined):
        dwelling_privacy = "garden_cottage"
        is_landlord = True
    elif _LANDLORD_ONSITE_RE.search(clean_no_neg):
        dwelling_privacy = "landlord_on_site"
        is_landlord = True
    elif _APARTMENT_BLOCK_RE.search(combined):
        dwelling_privacy = "apartment_block"
        is_landlord = False
    elif existing_privacy in VALID_PRIVACY_VALUES and existing_privacy != "independent":
        dwelling_privacy = existing_privacy
        is_landlord = bool(existing_landlord_on_site) or (dwelling_privacy in SHARED_PRIVACY_TYPES)
    else:
        dwelling_privacy = "independent"
        is_landlord = bool(existing_landlord_on_site)

    has_shared_entrance = bool(_SHARED_ENTRANCE_RE.search(combined)) or dwelling_privacy in (
        "garden_cottage",
        "attached_flatlet",
    )
    has_shared_garden = bool(_SHARED_GARDEN_RE.search(combined)) or (
        "garden" in combined and dwelling_privacy in ("garden_cottage", "attached_flatlet")
    )
    has_shared_pool = bool(_SHARED_POOL_RE.search(combined))

    beds_val = float(bedrooms) if bedrooms is not None else 1.0
    is_studio_or_1bed = beds_val <= 1.0 or bool(_STUDIO_OR_ONE_BED_RE.search(combined))
    has_street_num = bool(_STREET_NUM_RE.search((address or "").strip()))
    has_apt_block = dwelling_privacy == "apartment_block" or bool(_APARTMENT_BLOCK_RE.search(combined))
    is_possible_shared = (
        dwelling_privacy == "independent"
        and not is_landlord
        and is_studio_or_1bed
        and has_street_num
        and not has_apt_block
        and (is_security_estate or bool(_SHARED_UTILITY_OR_ESTATE_RE.search(combined)) or True)
    )

    return {
        "dwelling_privacy": dwelling_privacy,
        "is_landlord_on_site": is_landlord,
        "is_possible_shared_property": is_possible_shared,
        "has_shared_entrance": has_shared_entrance,
        "has_shared_garden": has_shared_garden,
        "has_shared_pool": has_shared_pool,
    }


def classify_listing_features(
    text: str = "",
    title: str = "",
    address: str = "",
    pkg_cnt: int = 0,
) -> Dict[str, Any]:
    """Extract unified stove, parking, fibre, inverter, pet, security-estate, and road attributes."""
    comb = f"{title or ''} {address or ''} {text or ''}".lower()

    if re.search(r"\b(?:gas hob|gas stove|gas cooker|gas plates|gas burner)\b", comb) or (
        re.search(r"\bgas\b", comb) and any(w in comb for w in ("hob", "stove", "cook", "burner"))
    ):
        stove_type: Optional[str] = "gas"
    elif re.search(r"\b(?:induction hob|induction stove)\b", comb):
        stove_type = "induction"
    else:
        stove_type = "electric"

    has_garage = bool(
        re.search(
            r"\b(?:garage|garages|lock-up|lock\s+up\s+garage|automated\s+garage|single\s+garage|double\s+garage)\b",
            comb,
        )
    )
    has_secure_bay = bool(
        re.search(
            r"\b(?:secure\s+parking(?:\s+bay)?|parking\s+bay|off-street\s+parking|off\s+street\s+parking|undercover\s+parking|basement\s+parking|allocated\s+(?:parking|bay)|shaded\s+parking|carport|vehicular\s+access(?:\s+driveway)?|sliding\s+gate\s+vehicular\s+access|remote\s+controlled\s+(?:sliding\s+)?gate\s+(?:vehicular\s+)?access|parking\s+behind\s+gate|secure\s+off-street)\b",
            comb,
        )
    ) or pkg_cnt > 0
    parking_type = "garage" if has_garage else ("secure_bay" if has_secure_bay else "none")

    pet_friendly: Optional[bool]
    if re.search(r"\b(?:pet friendly|pets allowed|pets welcome|dogs allowed|cats allowed)\b", comb):
        pet_friendly = True
    elif re.search(r"\b(?:no pets|pets not allowed|no dogs|no cats)\b", comb):
        pet_friendly = False
    else:
        pet_friendly = None

    fibre_ready = bool(re.search(r"\b(?:fibre|fiber|wifi|wi-fi|internet)\b", comb)) and not bool(
        re.search(r"\b(?:no\s+fibre|not\s+fibre\s+ready)\b", comb)
    )
    has_inverter = bool(re.search(r"\b(?:inverter|solar|backup|battery backup|ups|load shedding)\b", comb))
    is_security_estate = bool(
        re.search(
            r"\b(?:security\s+estate|gated\s+estate|gated\s+community|eco\s+estate|24.?h(?:our)?\s+security|manned\s+gate|boom\s+gate|biometric)\b",
            comb,
        )
    )
    is_main_road = bool(_MAIN_ROAD_RE.search(f"{address or ''} {title or ''}".lower()))

    return {
        "stove_type": stove_type,
        "has_garage": has_garage,
        "has_secure_bay": has_secure_bay,
        "parking_type": parking_type,
        "pet_friendly": pet_friendly,
        "fibre_ready": fibre_ready,
        "has_inverter": has_inverter,
        "is_security_estate": is_security_estate,
        "is_main_road": is_main_road,
    }
