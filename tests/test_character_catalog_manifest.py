"""Offline validation for the reviewed Stage 1 catalog manifests."""

import json
import re
from collections import defaultdict
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "character_catalog_manifest.json"
CANDIDATES_PATH = ROOT / "data" / "character_catalog_candidates.json"
SOURCE_DATA = ROOT.parents[1] / "genshin-db-main" / "genshin-db-main" / "src" / "data"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def source_records(manifest):
    for entity in manifest["canonical_entities"]:
        yield from entity["source_mappings"]
        for variant in entity["variants"]:
            yield variant["source_mapping"]


def test_catalog_totals_are_derived_from_actual_manifest_contents():
    manifest = load(MANIFEST_PATH)
    candidate_doc = load(CANDIDATES_PATH)
    snapshot = manifest["catalog_snapshot"]
    entities = manifest["canonical_entities"]
    confirmed_mappings = list(source_records(manifest))
    candidate_mappings = [m for c in candidate_doc["candidates"] for m in c["source_mappings"]]
    classifications = {}
    for entity in entities:
        classifications[entity["classification"]] = classifications.get(entity["classification"], 0) + 1

    assert manifest["manifest_version"] == 1
    assert snapshot["source_package_version"]
    assert snapshot["source_data_release"]
    assert len({e["canonical_key"] for e in entities}) == len(entities)
    assert len({e["name"].casefold() for e in entities}) == len(entities)
    assert manifest["coverage_summary"] == {
        "combat_playable_canonical_entities": classifications.get("combat_playable", 0),
        "mode_avatar_canonical_entities": classifications.get("mode_avatar", 0),
        "confirmed_canonical_entities_total": len(entities),
        "confirmed_source_records_in_manifest": len(confirmed_mappings),
        "candidate_source_records": len(candidate_mappings),
    }
    assert snapshot["included_source_records"] == len(confirmed_mappings)
    assert snapshot["candidate_source_records"] == len(candidate_mappings)
    assert snapshot["source_index_entries"] == len(confirmed_mappings) + len(candidate_mappings)


def test_source_mappings_are_unique_and_refer_to_source_record_paths():
    manifest = load(MANIFEST_PATH)
    candidate_doc = load(CANDIDATES_PATH)
    records = list(source_records(manifest))
    records.extend(m for c in candidate_doc["candidates"] for m in c["source_mappings"])

    mapping_keys = [(r["source"], r["source_id"]) for r in records]
    assert len(mapping_keys) == len(set(mapping_keys))
    assert all(r["source_id"].isdigit() for r in records)
    assert all(r["source_key"] and r["record_path"].startswith("src/data/English/characters/") for r in records)


def test_all_local_source_index_records_are_accounted_for_when_snapshot_is_available():
    if not SOURCE_DATA.is_dir():
        pytest.skip("Optional genshin-db checkout is not present beside the project")
    manifest = load(MANIFEST_PATH)
    candidate_doc = load(CANDIDATES_PATH)
    source_index = json.loads((SOURCE_DATA / "index/English/characters.json").read_text(encoding="utf-8"))
    indexed_keys = set(source_index["namemap"])
    manifest_records = list(source_records(manifest))
    candidate_records = [m for c in candidate_doc["candidates"] for m in c["source_mappings"]]
    mapped_keys = {m["source_key"] for m in manifest_records + candidate_records}

    assert mapped_keys == indexed_keys
    assert manifest["catalog_snapshot"]["source_index_entries"] == len(indexed_keys)
    for mapping in manifest_records + candidate_records:
        record = json.loads((SOURCE_DATA / mapping["record_path"].removeprefix("src/data/")).read_text(encoding="utf-8"))
        assert str(record["id"]) == mapping["source_id"]
        assert record["name"] == mapping["source_name"]
        for source_field in ("rarity", "elementText", "weaponText"):
            assert source_field in record and record[source_field] is not None and record[source_field] != ""
    alias_names = set(source_index["aliases"]) | set(source_index["namemap"].values())
    for entity in manifest["canonical_entities"]:
        for alias in entity["aliases"]:
            assert alias["name"] in alias_names


def test_database_seed_roster_is_covered_by_manifest_entities_aliases_or_variants():
    manifest = load(MANIFEST_PATH)
    seed = (ROOT / "sql" / "02_seed_data.sql").read_text(encoding="utf-8")
    seeded_names = {
        name.replace("''", "'")
        for name in re.findall(
            r"INSERT INTO characters\s*\(release_order,\s*name,\s*rarity,\s*element,\s*weapon_type,\s*description\)\s*VALUES\s*\(\d+,\s*'((?:[^']|'')*)'",
            seed,
            flags=re.IGNORECASE,
        )
    }
    represented_names = {e["name"] for e in manifest["canonical_entities"]}
    represented_names.update(a["name"] for e in manifest["canonical_entities"] for a in e["aliases"])
    represented_names.update(v["name"] for e in manifest["canonical_entities"] for v in e["variants"])

    assert seeded_names <= represented_names


def test_traveler_and_miliastra_forms_are_variants_of_separate_entities():
    entities = {e["canonical_key"]: e for e in load(MANIFEST_PATH)["canonical_entities"]}
    traveler = entities["traveler"]
    avatar = entities["miliastra-avatar"]

    assert traveler["classification"] == "combat_playable"
    assert {v["variant_key"] for v in traveler["variants"]} == {"aether", "lumine"}
    assert traveler["element_handling"]["mode"] == "adaptive"
    assert traveler["element_handling"]["never_assign_fixed_element"] is True
    assert traveler["element_handling"]["application_value"] == "Adaptive"
    assert avatar["classification"] == "mode_avatar"
    assert {v["variant_key"] for v in avatar["variants"]} == {"manekin", "manekina"}
    assert not any(e["canonical_key"] in {"aether", "lumine", "manekin", "manekina"} for e in entities.values())


def test_aliases_are_attributed_and_review_queue_is_separate():
    manifest = load(MANIFEST_PATH)
    candidate_doc = load(CANDIDATES_PATH)
    candidates = candidate_doc["candidates"]
    confirmed_keys = {e["canonical_key"] for e in manifest["canonical_entities"]}

    alias_owners = defaultdict(set)
    for entity in manifest["canonical_entities"]:
        keys = [(a["source"], a["name"].casefold()) for a in entity["aliases"]]
        assert len(keys) == len(set(keys))
        assert all(a["source_version"] for a in entity["aliases"])
        for alias in entity["aliases"]:
            normalized = re.sub(r"[^a-z0-9]", "", alias["name"].casefold())
            assert normalized
            alias_owners[normalized].add(entity["canonical_key"])
    assert all(len(owners) == 1 for owners in alias_owners.values())
    assert all(c["candidate_key"] not in confirmed_keys for c in candidates)
    assert "NPCs absent" in " ".join(candidate_doc["scope_notes"])
    assert "sandrone" in confirmed_keys
    assert not any(c["candidate_key"] == "sandrone" for c in candidates)


def test_managed_field_policy_documents_provenance_and_missing_values():
    policy = load(MANIFEST_PATH)["source_field_policy"]
    fields = {entry["catalog_field"]: entry for entry in policy["managed_fields"]}
    assert set(fields) == {"rarity", "element", "weapon_type"}
    assert all(entry["source_field"] and entry["source_record_path"] for entry in fields.values())
    assert all("invent" in entry["missing_value"].casefold() for entry in fields.values())
    assert "description" in policy["not_managed"]


def test_each_additional_entity_has_official_playability_evidence():
    manifest = load(MANIFEST_PATH)
    seed = (ROOT / "sql" / "02_seed_data.sql").read_text(encoding="utf-8")
    seeded_names = {
        name.replace("''", "'")
        for name in re.findall(
            r"INSERT INTO characters\s*\(release_order,\s*name,\s*rarity,\s*element,\s*weapon_type,\s*description\)\s*VALUES\s*\(\d+,\s*'((?:[^']|'')*)'",
            seed,
            flags=re.IGNORECASE,
        )
    }
    additions = [e for e in manifest["canonical_entities"] if e["name"] not in seeded_names]
    assert additions
    assert all(e.get("classification_evidence") for e in additions)
    assert all(e["classification_evidence"][0]["url"].startswith("https://") for e in additions)


def test_release_order_is_append_only_and_seed_values_are_unique():
    policy = load(MANIFEST_PATH)["release_order_policy"]
    seed = (ROOT / "sql" / "02_seed_data.sql").read_text(encoding="utf-8")
    release_values = [int(v) for v in re.findall(r"INSERT INTO characters\s*\(release_order,[^)]*\)\s*VALUES\s*\((\d+),", seed, flags=re.IGNORECASE)]
    assert policy["renumber_existing"] is False
    assert policy["strategy"].startswith("Append after the current maximum")
    assert len(release_values) == len(set(release_values))
    next_value = max(release_values) + 1
    new_row_count = len(load(MANIFEST_PATH)["canonical_entities"]) - len(release_values)
    proposed = set(range(next_value, next_value + new_row_count))
    assert proposed.isdisjoint(release_values)


def test_manifest_does_not_include_editorial_or_artwork_content():
    manifest = load(MANIFEST_PATH)
    forbidden = {"builds", "tiers", "tier", "artwork", "image_url", "profile_description"}
    assert not (forbidden & set(manifest))
    for entity in manifest["canonical_entities"]:
        assert not (forbidden & set(entity))


def test_migration_is_additive_and_preserves_local_character_identity():
    migration = (ROOT / "sql" / "06_character_catalog.sql").read_text(encoding="utf-8").lower()
    assert "drop table" not in migration
    assert "truncate" not in migration
    assert "alter table characters" not in migration
    assert "references characters(id)" in migration
    assert "unique (source_namespace, external_id)" in migration
    assert "create table if not exists character_catalog_provenance" in migration
