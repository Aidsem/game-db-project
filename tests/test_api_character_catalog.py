"""Mock-backed API contract tests; these do not connect to the configured database."""

from pathlib import Path

import pytest

import app as flask_app
from scripts import sync_character_catalog as catalog_sync


ROOT = Path(__file__).resolve().parents[1]


class InMemoryCharacterQuery:
    def __init__(self, rows):
        self.rows = list(rows)

    def filter(self, expression):
        field = expression.left.name
        value = expression.right.value
        if field in {"element", "weapon_type"}:
            self.rows = [row for row in self.rows if str(getattr(row, field)).casefold() == str(value).casefold()]
        elif field == "rarity":
            self.rows = [row for row in self.rows if row.rarity == value]
        return self

    def order_by(self, _column):
        self.rows.sort(key=lambda row: row.release_order)
        return self

    def all(self):
        return list(self.rows)

    def get_or_404(self, character_id):
        row = next((row for row in self.rows if row.id == character_id), None)
        if row is None:
            flask_app.abort(404)
        return row


@pytest.fixture
def catalog_api(monkeypatch):
    manifest, _source_records, _hashes = catalog_sync.read_inputs(
        ROOT / "data" / "character_catalog_manifest.json", catalog_sync.DEFAULT_SOURCE_REPO
    )
    facts_by_key = {entity["canonical_key"]: entity["managed_values"] for entity in manifest["canonical_entities"]}

    rows = [
        flask_app.Character(
            id=index + 500,
            release_order=index + 1,
            name=entity["name"],
            rarity=facts_by_key[entity["canonical_key"]]["rarity"],
            element=facts_by_key[entity["canonical_key"]]["element"],
            weapon_type=facts_by_key[entity["canonical_key"]]["weapon_type"],
            description=None,
        )
        for index, entity in enumerate(manifest["canonical_entities"])
    ]
    by_key = {entity["canonical_key"]: rows[i] for i, entity in enumerate(manifest["canonical_entities"])}
    traveler = by_key["traveler"]
    avatar = by_key["miliastra-avatar"]
    metadata = {
        traveler.id: {
            "catalog_classification": "combat_playable",
            "variants": [
                {"key": "aether", "name": "Aether", "character_id": traveler.id},
                {"key": "lumine", "name": "Lumine", "character_id": traveler.id},
            ],
            "aliases": ["Aether", "Lumine"],
        },
        avatar.id: {
            "catalog_classification": "mode_avatar",
            "variants": [
                {"key": "manekin", "name": "Manekin", "character_id": avatar.id},
                {"key": "manekina", "name": "Manekina", "character_id": avatar.id},
            ],
            "aliases": ["Manekin", "Manekina"],
        },
    }
    with flask_app.app.app_context():
        monkeypatch.setattr(flask_app.Character, "query", InMemoryCharacterQuery(rows))
    monkeypatch.setattr(flask_app, "_catalog_metadata", lambda ids: {i: metadata[i] for i in ids if i in metadata})
    flask_app.app.config["TESTING"] = True
    return flask_app.app.test_client(), manifest, rows, traveler, avatar


def test_characters_api_returns_approved_canonical_roster_with_unique_ids(catalog_api):
    client, manifest, _rows, traveler, avatar = catalog_api
    response = client.get("/api/characters")
    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload) == len(manifest["canonical_entities"])
    assert {row["name"] for row in payload} == {entity["name"] for entity in manifest["canonical_entities"]}
    assert len({row["id"] for row in payload}) == len(payload)
    assert sum(row["name"] == "Traveler" for row in payload) == 1
    assert sum(row["name"] == "Miliastra Avatar" for row in payload) == 1
    traveler_record = next(row for row in payload if row["id"] == traveler.id)
    assert traveler_record["element"] == "Adaptive"
    assert traveler_record["element_behavior"] == "adaptive"
    assert {variant["name"] for variant in traveler_record["variants"]} == {"Aether", "Lumine"}
    assert {variant["character_id"] for variant in traveler_record["variants"]} == {traveler.id}
    avatar_record = next(row for row in payload if row["id"] == avatar.id)
    assert avatar_record["catalog_classification"] == "mode_avatar"
    assert avatar_record["mode_label"] == "Miliastra Wonderland avatar"


@pytest.mark.parametrize("params,expected", [
    ({"element": "Adaptive"}, {"Traveler"}),
    ({"weapon_type": "Sword"}, None),
    ({"rarity": "4"}, None),
])
def test_characters_api_filters_are_applied(catalog_api, params, expected):
    client, manifest, _rows, _traveler, _avatar = catalog_api
    response = client.get("/api/characters", query_string=params)
    assert response.status_code == 200
    names = {row["name"] for row in response.get_json()}
    if expected is not None:
        assert names == expected
    if "weapon_type" in params:
        assert all(row["weapon_type"].casefold() == params["weapon_type"].casefold() for row in response.get_json())
    if "rarity" in params:
        assert all(str(row["rarity"]) == params["rarity"] for row in response.get_json())
    assert len(names) == len(response.get_json())


def test_catalog_entry_without_profile_art_tier_or_build_is_still_in_api(catalog_api):
    client, _manifest, _rows, _traveler, _avatar = catalog_api
    response = client.get("/api/characters")
    optional_entry = next(row for row in response.get_json() if row["name"] == "Aino")
    assert response.status_code == 200
    assert optional_entry["description"] is None
    assert "assets" not in optional_entry
    assert "builds" not in optional_entry
    assert "combat_tiers" not in optional_entry
    assert "exploration_tier" not in optional_entry
    assert optional_entry["catalog_classification"] is None


def test_profile_route_uses_parent_canonical_id_for_variant(catalog_api, monkeypatch):
    client, _manifest, _rows, traveler, _avatar = catalog_api
    captured = {}

    def fake_rows(_sql, **params):
        captured.update(params)
        return [{"character_id": traveler.id, "name": "Traveler", "profile": {"region": "Unknown"}}]

    monkeypatch.setattr(flask_app, "_rows", fake_rows)
    response = client.get(f"/api/profiles/{traveler.id}")
    assert response.status_code == 200
    assert captured == {"cid": traveler.id}
    assert response.get_json()["character_id"] == traveler.id


def test_character_detail_includes_variant_metadata(monkeypatch, catalog_api):
    client, _manifest, _rows, traveler, _avatar = catalog_api
    metadata = {
        traveler.id: {
            "catalog_classification": "combat_playable",
            "variants": [{"key": "aether", "name": "Aether", "character_id": traveler.id}],
            "aliases": ["Aether"],
        }
    }
    monkeypatch.setattr(flask_app, "_catalog_metadata", lambda ids: {i: metadata[i] for i in ids if i in metadata})
    monkeypatch.setattr(flask_app.Character, "to_dict", lambda self, include_relations=False: {
        "id": self.id, "name": self.name, "element": self.element,
        "builds": [] if include_relations else None,
    })
    response = client.get(f"/api/characters/{traveler.id}")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["element_behavior"] == "adaptive"
    assert payload["variants"][0]["character_id"] == traveler.id


@pytest.mark.parametrize("rarity", ["abc", "0", "6"])
def test_invalid_rarity_filter_returns_client_error(catalog_api, rarity):
    client, _manifest, _rows, _traveler, _avatar = catalog_api
    response = client.get("/api/characters", query_string={"rarity": rarity})
    assert response.status_code == 400
