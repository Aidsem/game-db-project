"""Offline tests for the Stage 3 catalog synchronization planner."""

import copy
import json
from pathlib import Path

import pytest

from scripts import sync_character_catalog as sync


def fixture_data():
    manifest = {
        "catalog_snapshot": {
            "source_version": "fixture-1",
            "retrieved_on": "2026-10-20",
            "source_data_release": "test",
            "source_repository": "fixture",
            "source_index": "src/data/index.json",
        },
        "canonical_entities": [
            {
                "canonical_key": "hero",
                "name": "Hero",
                "classification": "combat_playable",
                "managed_values": {"rarity": 5, "element": "Pyro", "weapon_type": "Sword"},
                "aliases": [{"name": "The Hero", "source": "genshin-db", "source_version": "fixture-1"}],
                "variants": [{"variant_key": "alt", "name": "Alt Hero"}],
            }
        ],
    }
    mappings = [{
        "canonical_key": "hero", "canonical_name": "Hero", "classification": "combat_playable",
        "variant_key": None,
        "mapping": {"source": "genshin-db", "source_id": "100", "source_key": "hero", "source_name": "Hero", "source_version": "fixture-1", "record_path": "src/data/hero.json"},
    }]
    return manifest, mappings, {"manifest.json": "abc"}, "abc"


class MemoryStore:
    def __init__(self, state=None, fail_apply=False):
        self.state = copy.deepcopy(state or {"characters": [], "source_mappings": [], "classifications": [], "variants": [], "aliases": []})
        self.fail_apply = fail_apply
        self.committed = False
        self.rolled_back = False
        self.relationships = {"builds": [(19, 1)], "profiles": [(1, "manual profile")]} if self.state["characters"] else {}

    def begin(self, apply):
        self.apply_mode = apply
        self.before_transaction = copy.deepcopy(self.state)

    def load_state(self):
        return copy.deepcopy(self.state)

    def apply(self, manifest, source_records, state, plan):
        if self.fail_apply:
            self.state["characters"].append({"id": 999, "name": "partial write"})
            raise RuntimeError("simulated database write error")
        by_name = {row["name"].casefold(): row for row in self.state["characters"]}
        for item in plan["planned_inserts"]:
            row = {"id": max([r["id"] for r in self.state["characters"]] + [0]) + 1, **item, "description": "user data"}
            self.state["characters"].append(row)
            by_name[row["name"].casefold()] = row
        for item in plan["planned_updates"]:
            row = next(r for r in self.state["characters"] if r["id"] == item["id"])
            row.update(item["fields"])
        for entity in manifest["canonical_entities"]:
            char_id = by_name[entity["name"].casefold()]["id"]
            if not any(r["character_id"] == char_id for r in self.state["classifications"]):
                self.state["classifications"].append({"character_id": char_id, "classification": entity["classification"]})
            for variant in entity.get("variants", []):
                if not any(r["character_id"] == char_id and r["variant_key"] == variant["variant_key"] for r in self.state["variants"]):
                    self.state["variants"].append({"character_id": char_id, "variant_key": variant["variant_key"], "display_name": variant["name"]})
            for alias in entity.get("aliases", []):
                if not any(r["source_namespace"] == alias["source"] and r["normalized_alias"] == sync.normalized_alias(alias["name"]) for r in self.state["aliases"]):
                    self.state["aliases"].append({"character_id": char_id, "source_namespace": alias["source"], "normalized_alias": sync.normalized_alias(alias["name"])})
        for record in source_records:
            mapping = record["mapping"]
            if not any(r["source_namespace"] == mapping["source"] and r["external_id"] == mapping["source_id"] for r in self.state["source_mappings"]):
                self.state["source_mappings"].append({"source_namespace": mapping["source"], "external_id": mapping["source_id"], "character_id": by_name[record["canonical_name"].casefold()]["id"]})

    def commit(self):
        self.committed = True

    def rollback(self):
        self.state = copy.deepcopy(self.before_transaction)
        self.rolled_back = True


def test_dry_run_report_is_json_and_does_not_write():
    manifest, records, hashes, manifest_hash = fixture_data()
    store = MemoryStore()
    report = sync.execute_sync(manifest, records, hashes, manifest_hash, store)
    decoded = json.loads(json.dumps(report))
    assert decoded["mode"] == "dry-run"
    assert decoded["counts"]["planned_inserts"] == 1
    assert decoded["planned_inserts"][0]["release_order"] == 1
    assert not store.committed and not store.rolled_back


def test_external_id_matching_and_reviewed_alias_resolution():
    manifest, records, hashes, digest = fixture_data()
    state = {"characters": [{"id": 44, "name": "Hero", "release_order": 9, "rarity": 5, "element": "Pyro", "weapon_type": "Sword"}],
             "source_mappings": [{"source_namespace": "genshin-db", "external_id": "100", "character_id": 44}],
             "classifications": [], "variants": [], "aliases": []}
    report = sync.build_plan(manifest, records, state, hashes, digest)
    assert report["counts"]["planned_inserts"] == 0
    assert report["counts"]["unchanged"] == 1
    assert sync.resolve_catalog_name("Alt Hero", manifest) == "hero"
    assert sync.resolve_catalog_name("The Hero", manifest) == "hero"
    assert sync.resolve_catalog_name("unknown", manifest) is None


def test_duplicate_database_ids_and_source_id_wrong_owner_are_conflicts():
    manifest, records, hashes, digest = fixture_data()
    state = {"characters": [
        {"id": 1, "name": "Hero", "release_order": 1, "rarity": 5, "element": "Pyro", "weapon_type": "Sword"},
        {"id": 1, "name": "Other", "release_order": 2, "rarity": 4, "element": "Cryo", "weapon_type": "Bow"}],
        "source_mappings": [{"source_namespace": "genshin-db", "external_id": "100", "character_id": 1}],
        "classifications": [], "variants": [], "aliases": []}
    report = sync.build_plan(manifest, records, state, hashes, digest)
    assert any("duplicate character ID" in c for c in report["conflicts"])
    assert any("expected Hero" in c for c in report["conflicts"])


def test_duplicate_manifest_source_ids_are_reported_as_conflicts():
    manifest, records, hashes, digest = fixture_data()
    records.append(copy.deepcopy(records[0]))
    report = sync.build_plan(manifest, records, {"characters": [], "source_mappings": [], "classifications": [], "variants": [], "aliases": []}, hashes, digest)
    assert any("duplicate source mapping genshin-db:100" in c for c in report["conflicts"])


def test_conflicts_roll_back_apply_and_write_errors_roll_back():
    manifest, records, hashes, digest = fixture_data()
    conflicting = {"characters": [{"id": 1, "name": "Hero", "release_order": 1, "rarity": 5, "element": "Pyro", "weapon_type": "Sword"}],
                   "source_mappings": [], "classifications": [{"character_id": 1, "classification": "mode_avatar"}], "variants": [], "aliases": []}
    store = MemoryStore(conflicting)
    with pytest.raises(sync.CatalogError, match="rolled back"):
        sync.execute_sync(manifest, records, hashes, digest, store, apply=True)
    assert store.rolled_back and not store.committed
    failing = MemoryStore(fail_apply=True)
    with pytest.raises(sync.CatalogError, match="rolled back"):
        sync.execute_sync(manifest, records, hashes, digest, failing, apply=True)
    assert failing.rolled_back and not failing.committed
    assert failing.state["characters"] == []


def test_two_apply_runs_are_idempotent_and_preserve_user_data_and_relationships():
    manifest, records, hashes, digest = fixture_data()
    existing = {"characters": [{"id": 1, "name": "Unmatched Existing", "release_order": 15, "rarity": 4, "element": "Cryo", "weapon_type": "Bow", "description": "manual existing"}],
                "source_mappings": [], "classifications": [], "variants": [], "aliases": []}
    store = MemoryStore(existing)
    first = sync.execute_sync(manifest, records, hashes, digest, store, apply=True)
    assert first["counts"]["planned_inserts"] == 1
    second = sync.execute_sync(manifest, records, hashes, digest, store, apply=True)
    assert second["counts"]["planned_inserts"] == 0
    assert second["counts"]["planned_updates"] == 0
    assert second["counts"]["unchanged"] == 1
    assert len(store.state["characters"]) == 2
    assert next(row for row in store.state["characters"] if row["name"] == "Hero")["description"] == "user data"
    old = next(row for row in store.state["characters"] if row["name"] == "Unmatched Existing")
    assert (old["id"], old["release_order"], old["description"]) == (1, 15, "manual existing")
    assert store.relationships["builds"] == [(19, 1)]
    assert store.relationships["profiles"] == [(1, "manual profile")]


def test_actual_snapshot_is_read_and_traveler_is_adaptive():
    manifest, records, hashes = sync.read_inputs(sync.DEFAULT_MANIFEST, sync.DEFAULT_SOURCE_REPO)
    traveler = next(e for e in manifest["canonical_entities"] if e["canonical_key"] == "traveler")
    assert len(manifest["canonical_entities"]) == 122
    assert len(records) == 124
    assert traveler["managed_values"]["element"] == "Adaptive"
    assert len(hashes) == 126


def test_legacy_exact_name_match_updates_managed_fields_only():
    manifest, records, hashes, digest = fixture_data()
    state = {"characters": [{"id": 8, "name": "Hero", "release_order": 71, "rarity": 4, "element": "Cryo", "weapon_type": "Bow", "description": "manual"}],
             "source_mappings": [], "classifications": [], "variants": [], "aliases": []}
    report = sync.build_plan(manifest, records, state, hashes, digest)
    update = report["planned_updates"][0]
    assert update["id"] == 8 and update["fields"] == {"rarity": 5, "element": "Pyro", "weapon_type": "Sword"}
    assert state["characters"][0]["release_order"] == 71
    assert state["characters"][0]["description"] == "manual"
