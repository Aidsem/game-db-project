"""Read-only access to the downloaded genshin-db JSON metadata.

The JavaScript package itself is not imported. This module reads its published
JSON image maps and English name indexes, and returns only source URLs (never
filesystem paths) to the Flask API.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


def _default_data_dir() -> Path:
    configured = os.environ.get("GENSHIN_DB_DATA_DIR")
    if configured:
        return Path(configured).expanduser()
    # Verified checkout: ../../genshin-db-main/genshin-db-main/src/data
    return Path(__file__).resolve().parents[2] / "genshin-db-main" / "genshin-db-main" / "src" / "data"


DATA_DIR = _default_data_dir()


def _key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())


@lru_cache(maxsize=32)
def _json(relative_path: str) -> dict[str, Any]:
    try:
        path = (DATA_DIR / relative_path).resolve()
        path.relative_to(DATA_DIR.resolve())
        with path.open(encoding="utf-8") as source:
            value = json.load(source)
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError, json.JSONDecodeError):
        return {}


@lru_cache(maxsize=3)
def _indexes(category: str) -> dict[str, str]:
    source = _json(f"index/English/{category}.json")
    names = source.get("namemap", {})
    return {_key(name): slug for slug, name in names.items()} if isinstance(names, dict) else {}


def _slug(category: str, name: str) -> str | None:
    normalized = _key(name)
    if not normalized:
        return None
    # Prefer the English index, which handles punctuation and spaced names.
    slug = _indexes(category).get(normalized)
    if slug:
        return slug
    # A few app records use names that are not present in a particular index;
    # accept a direct slug only when that exact source record exists.
    direct = normalized
    return direct if direct in _json(f"image/{category}.json") else None


def character_assets(name: str, element: str | None = None) -> dict[str, Any]:
    slug = _slug("characters", name)
    row = _json("image/characters.json").get(slug, {}) if slug else {}
    elements = _json("image/elements.json")
    element_row = elements.get(_key(element), {}) if element else {}
    # Prefer the current source icon: some legacy portrait/card URLs in the
    # source map are stale (the Xiangling portrait currently returns 404).
    image_url = row.get("mihoyo_icon") or row.get("hoyowiki_icon") or row.get("image")
    return {
        "image_url": image_url,
        "portrait_url": image_url or row.get("portrait"),
        "card_url": row.get("hoyowiki_icon") or image_url or row.get("card"),
        "element_icon_url": element_row.get("wikia"),
        "source": "genshin-db image metadata",
    }


def weapon_assets(name: str, weapon_type: str | None = None) -> dict[str, Any]:
    slug = _slug("weapons", name)
    row = _json("image/weapons.json").get(slug, {}) if slug else {}
    # genshin-db's image maps contain item art, but no weapon-class icon set.
    return {
        "image_url": row.get("icon"),
        "weapon_type_icon_url": None,
        "source": "genshin-db image metadata",
    }


def artifact_assets(name: str) -> dict[str, Any]:
    slug = _slug("artifacts", name)
    row = _json("image/artifacts.json").get(slug, {}) if slug else {}
    pieces = {piece: row.get(piece) for piece in ("flower", "plume", "sands", "goblet", "circlet")}
    pieces = {key: value for key, value in pieces.items() if value}
    return {
        **pieces,
        "icon_url": pieces.get("flower"),
        "source": "genshin-db image metadata",
    }


def artifact_effects(name: str) -> dict[str, str] | None:
    slug = _slug("artifacts", name)
    row = _json(f"English/artifacts/{slug}.json") if slug else {}
    two_piece = row.get("effect2Pc")
    four_piece = row.get("effect4Pc")
    if not two_piece and not four_piece:
        return None
    return {
        "bonus_2pc": two_piece or "",
        "bonus_4pc": four_piece or "",
        "source": "genshin-db English artifact data",
    }


def game_data_status() -> dict[str, Any]:
    """Small diagnostic safe for API output; deliberately omits local paths."""
    return {
        "available": bool(_json("image/characters.json")),
        "source": "genshin-db",
        "license": "MIT (repository code/data files; linked game artwork remains third-party property)",
        "weapon_type_icons_available": False,
    }
