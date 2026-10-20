#!/usr/bin/env python3
"""Safely synchronize the reviewed character catalog into PostgreSQL.

Dry-run is the default. It reads PostgreSQL in a read-only transaction and
prints a JSON plan. Writes require --apply and an already-installed additive
sql/06_character_catalog.sql migration. External IDs are never local PKs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "data" / "character_catalog_manifest.json"
DEFAULT_SOURCE_REPO = ROOT.parents[1] / "genshin-db-main" / "genshin-db-main"
SOURCE_NAMESPACE = "genshin-db"
MANAGED_FIELDS = ("rarity", "element", "weapon_type")


class CatalogError(Exception):
    """Expected input, catalog, or database-state problem."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalized_alias(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def all_source_mappings(entity: dict[str, Any]):
    yield from entity.get("source_mappings", [])
    for variant in entity.get("variants", []):
        yield variant["source_mapping"]


def resolve_catalog_name(value: str, manifest: dict[str, Any]) -> str | None:
    """Resolve a canonical name, reviewed alias, or selectable variant."""
    target = normalized_alias(value)
    matches = set()
    for entity in manifest["canonical_entities"]:
        names = [entity["name"]]
        names.extend(a["name"] for a in entity.get("aliases", []))
        names.extend(v["name"] for v in entity.get("variants", []))
        if any(normalized_alias(name) == target for name in names):
            matches.add(entity["canonical_key"])
    if len(matches) > 1:
        raise CatalogError(f"Alias {value!r} resolves to multiple canonical entities")
    return next(iter(matches), None)


def read_inputs(manifest_path: Path, source_repo: Path):
    try:
        manifest_bytes = manifest_path.read_bytes()
        manifest = json.loads(manifest_bytes)
    except (OSError, json.JSONDecodeError) as exc:
        raise CatalogError(f"Cannot read catalog manifest {manifest_path}: {exc.__class__.__name__}") from None
    if not isinstance(manifest, dict) or not isinstance(manifest.get("canonical_entities"), list):
        raise CatalogError("Manifest must contain a canonical_entities array")
    snapshot = manifest.get("catalog_snapshot", {})
    entities = manifest["canonical_entities"]
    keys, names, source_ids = set(), set(), set()
    input_hashes = {str(manifest_path.resolve()): sha256(manifest_bytes)}
    index_rel = snapshot.get("source_index")
    if not snapshot.get("source_version") or not snapshot.get("retrieved_on"):
        raise CatalogError("Manifest catalog_snapshot must include source_version and retrieved_on")
    try:
        date.fromisoformat(snapshot["retrieved_on"])
    except ValueError:
        raise CatalogError("catalog_snapshot.retrieved_on must be an ISO date") from None

    try:
        index_path = source_repo / index_rel
        index_bytes = index_path.read_bytes()
        input_hashes[str(index_path.resolve())] = sha256(index_bytes)
        index = json.loads(index_bytes)
    except (OSError, AttributeError, json.JSONDecodeError) as exc:
        raise CatalogError(f"Cannot read genshin-db source index: {exc.__class__.__name__}") from None
    indexed_keys = set(index.get("namemap", {}))

    policy = {entry["catalog_field"]: entry for entry in manifest.get("source_field_policy", {}).get("managed_fields", [])}
    if set(policy) != set(MANAGED_FIELDS):
        raise CatalogError("Manifest managed-field policy must define rarity, element, and weapon_type")
    records = []
    seen_source_keys = set()
    for entity in entities:
        key, name = entity.get("canonical_key"), entity.get("name")
        if not key or key in keys:
            raise CatalogError(f"Missing or duplicate canonical_key: {key!r}")
        if not name or name.casefold() in names:
            raise CatalogError(f"Missing or duplicate canonical name: {name!r}")
        if entity.get("classification") not in {"combat_playable", "mode_avatar"}:
            raise CatalogError(f"Unsupported classification on {name}")
        keys.add(key)
        names.add(name.casefold())
        mappings = list(all_source_mappings(entity))
        if not mappings:
            raise CatalogError(f"Approved entity {name} has no source mapping")
        mapped_facts = []
        for mapping in mappings:
            namespace = mapping.get("source")
            external_id = str(mapping.get("source_id", ""))
            source_key = mapping.get("source_key")
            identity = (namespace, external_id)
            if namespace != SOURCE_NAMESPACE or not external_id or identity in source_ids:
                raise CatalogError(f"Missing, unsupported, or duplicate namespaced source ID for {name}")
            if mapping.get("source_version") != snapshot["source_version"]:
                raise CatalogError(f"Source version mismatch for {name} ({source_key})")
            source_ids.add(identity)
            if source_key not in indexed_keys or source_key in seen_source_keys:
                raise CatalogError(f"Invalid or duplicate genshin-db source key {source_key!r}")
            seen_source_keys.add(source_key)
            rel = mapping.get("record_path", "")
            if not rel.startswith("src/data/") or ".." in Path(rel).parts:
                raise CatalogError(f"Unsafe source record path for {name}")
            record_path = source_repo / rel
            try:
                raw = record_path.read_bytes()
                source_record = json.loads(raw)
            except (OSError, json.JSONDecodeError) as exc:
                raise CatalogError(f"Cannot read source record for {name} ({source_key}): {exc.__class__.__name__}") from None
            input_hashes[str(record_path.resolve())] = sha256(raw)
            if str(source_record.get("id")) != external_id or source_record.get("name") != mapping.get("source_name"):
                raise CatalogError(f"Source identity mismatch for {name} ({source_key})")
            try:
                rarity = int(source_record[policy["rarity"]["source_field"]])
                raw_element = source_record[policy["element"]["source_field"]]
                weapon = source_record[policy["weapon_type"]["source_field"]]
                if rarity not in range(1, 6) or not isinstance(weapon, str) or not weapon:
                    raise ValueError
                if raw_element is None or raw_element == "None":
                    element_policy = entity.get("element_handling", {})
                    if element_policy.get("mode") == "adaptive":
                        element = element_policy.get("application_value")
                        if element != "Adaptive":
                            raise ValueError
                    elif entity.get("classification") == "mode_avatar":
                        element = "None"
                    else:
                        raise ValueError
                else:
                    if entity.get("element_handling", {}).get("mode") == "adaptive":
                        raise ValueError
                    element = str(raw_element)
                if not element:
                    raise ValueError
            except (KeyError, TypeError, ValueError):
                raise CatalogError(f"Required managed source fields are missing or invalid for {name}") from None
            mapped_facts.append({"rarity": rarity, "element": element, "weapon_type": weapon})
            records.append({
                "canonical_key": key,
                "canonical_name": name,
                "classification": entity["classification"],
                "mapping": mapping,
                "variant_key": next((v["variant_key"] for v in entity.get("variants", []) if v.get("source_mapping") == mapping), None),
            })
        if len({tuple(sorted(f.items())) for f in mapped_facts}) != 1:
            raise CatalogError(f"Source variants disagree on managed fields for {name}")
        entity["managed_values"] = mapped_facts[0]
    if seen_source_keys - indexed_keys:
        raise CatalogError("Manifest contains source keys absent from the referenced source index")
    manifest["_unmatched_source_index_keys"] = sorted(indexed_keys - seen_source_keys)
    return manifest, records, input_hashes


def build_plan(manifest, source_records, state, input_hashes, manifest_hash):
    """Build a non-destructive plan from source records and an observed DB snapshot."""
    conflicts: list[str] = []
    entities = manifest["canonical_entities"]
    chars = list(state.get("characters", []))
    by_id, by_name = defaultdict(list), defaultdict(list)
    for row in chars:
        by_id[row["id"]].append(row)
        by_name[row["name"].casefold()].append(row)
    for ident, rows in by_id.items():
        if len(rows) > 1:
            conflicts.append(f"Database has duplicate character ID {ident}")
    for name, rows in by_name.items():
        if len(rows) > 1:
            conflicts.append(f"Database has duplicate character name {rows[0]['name']}")
    orders = [r["release_order"] for r in chars]
    if len(orders) != len(set(orders)):
        conflicts.append("Database has duplicate release_order values")

    mapping_owner = {}
    for row in state.get("source_mappings", []):
        key = (row["source_namespace"], str(row["external_id"]))
        if key in mapping_owner:
            conflicts.append(f"Database has duplicate source mapping {key[0]}:{key[1]}")
        mapping_owner[key] = row
    entity_by_id = {r["id"]: r for r in chars}
    for row in state.get("source_mappings", []):
        if row.get("character_id") not in entity_by_id:
            conflicts.append(f"Source mapping {row['source_namespace']}:{row['external_id']} points to a missing character")
    variant_by_id = {row["id"]: row for row in state.get("variants", []) if row.get("id") is not None}

    source_by_entity = defaultdict(list)
    manifest_source_ids = set()
    for record in source_records:
        mapping_id = (record["mapping"].get("source"), str(record["mapping"].get("source_id")))
        if mapping_id in manifest_source_ids:
            conflicts.append(f"Manifest has duplicate source mapping {mapping_id[0]}:{mapping_id[1]}")
        manifest_source_ids.add(mapping_id)
        source_by_entity[record["canonical_key"]].append(record)
    insert, update, unchanged, entity_ids = [], [], [], {}
    current_max = max(orders, default=0)
    for entity in sorted(entities, key=lambda e: e["canonical_key"]):
        key, name = entity["canonical_key"], entity["name"]
        records = source_by_entity[key]
        matches = {}
        for record in records:
            ext = (record["mapping"]["source"], str(record["mapping"]["source_id"]))
            mapped = mapping_owner.get(ext)
            if mapped:
                row = entity_by_id.get(mapped["character_id"])
                if row and row["name"].casefold() != name.casefold():
                    conflicts.append(f"Source ID {ext[0]}:{ext[1]} maps to {row['name']}, expected {name}")
                expected_variant = record["variant_key"]
                stored_variant = variant_by_id.get(mapped.get("variant_id"))
                stored_variant_key = stored_variant.get("variant_key") if stored_variant else None
                if (stored_variant_key or None) != (expected_variant or None):
                    conflicts.append(f"Source ID {ext[0]}:{ext[1]} has a conflicting variant mapping")
                for field, expected in (("source_key", record["mapping"].get("source_key")),
                                        ("source_name", record["mapping"].get("source_name")),
                                        ("source_version", record["mapping"].get("source_version")),
                                        ("source_record_path", record["mapping"].get("record_path"))):
                    if mapped.get(field) is not None and mapped[field] != expected:
                        conflicts.append(f"Source ID {ext[0]}:{ext[1]} has conflicting {field}")
                if row:
                    matches[row["id"]] = row
        exact = by_name.get(name.casefold(), [])
        if len(exact) == 1:
            # Reviewed legacy fallback: exact canonical manifest name only; aliases are never fuzzy DB matches.
            matches[exact[0]["id"]] = exact[0]
        if len(matches) > 1:
            conflicts.append(f"Source mappings for {name} point to multiple database characters")
            continue
        values = entity["managed_values"]
        if matches:
            row = next(iter(matches.values()))
            entity_ids[key] = row["id"]
            changed = {field: values[field] for field in MANAGED_FIELDS if row[field] != values[field]}
            (update if changed else unchanged).append({"canonical_key": key, "name": name, "id": row["id"], "fields": changed})
        else:
            if current_max >= 2_147_483_647:
                conflicts.append("No unique PostgreSQL INT release_order value remains for catalog inserts")
                continue
            current_max += 1
            insert.append({"canonical_key": key, "name": name, "release_order": current_max, **values})

    classifications = {r["character_id"]: r["classification"] for r in state.get("classifications", [])}
    for key, char_id in entity_ids.items():
        expected = next(e["classification"] for e in entities if e["canonical_key"] == key)
        if char_id in classifications and classifications[char_id] != expected:
            conflicts.append(f"Classification conflict for {next(e['name'] for e in entities if e['canonical_key'] == key)}")
    variants = {(r["character_id"], r["variant_key"]): r for r in state.get("variants", [])}
    aliases = defaultdict(list)
    for row in state.get("aliases", []):
        aliases[(row["source_namespace"], row["normalized_alias"])].append(row)
    alias_owners = {}
    for entity in entities:
        char_id = entity_ids.get(entity["canonical_key"])
        if char_id is not None:
            for variant in entity.get("variants", []):
                old = variants.get((char_id, variant["variant_key"]))
                if old and old["display_name"] != variant["name"]:
                    conflicts.append(f"Variant conflict for {entity['name']}:{variant['variant_key']}")
        for alias in entity.get("aliases", []):
            norm = normalized_alias(alias["name"])
            alias_key = (alias["source"], norm)
            previous_owner = alias_owners.get(alias_key)
            if previous_owner and previous_owner != entity["canonical_key"]:
                conflicts.append(f"Manifest alias {alias['name']!r} is assigned to multiple canonical entities")
            alias_owners[alias_key] = entity["canonical_key"]
            for old in aliases.get((alias["source"], norm), []):
                if char_id is None or old["character_id"] != char_id:
                    conflicts.append(f"Alias {alias['name']!r} is already assigned to another character")

    # A mapped entity is not safe to insert if two distinct canonical entities resolve to one local row.
    reverse = defaultdict(list)
    for key, char_id in entity_ids.items():
        reverse[char_id].append(key)
    for char_id, keys in reverse.items():
        if len(keys) > 1:
            conflicts.append(f"Multiple canonical entities resolve to database character ID {char_id}")
    known_ids = set(entity_ids.values())
    unmatched = [{"id": c["id"], "name": c["name"]} for c in chars if c["id"] not in known_ids]
    summary = {
        "mode": "dry-run",
        "source_version": manifest["catalog_snapshot"]["source_version"],
        "retrieved_on": manifest["catalog_snapshot"]["retrieved_on"],
        "manifest_sha256": manifest_hash,
        "input_hashes": input_hashes,
        "planned_inserts": insert,
        "planned_updates": update,
        "unchanged": unchanged,
        "conflicts": sorted(set(conflicts)),
        "unmatched_database_records": unmatched,
        "unmatched_source_index_keys": manifest.get("_unmatched_source_index_keys", []),
        "source_record_count": len(source_records),
        "canonical_entity_count": len(entities),
    }
    summary["counts"] = {
        "planned_inserts": len(insert),
        "planned_updates": len(update),
        "unchanged": len(unchanged),
        "conflicts": len(summary["conflicts"]),
        "unmatched_database_records": len(unmatched),
        "unmatched_source_index_keys": len(summary["unmatched_source_index_keys"]),
    }
    return summary


class PostgresStore:
    """Small explicit SQL adapter; no SQL is run until the CLI is invoked."""

    def __init__(self, connection):
        self.connection = connection
        self.cursor = connection.cursor()

    def begin(self, apply: bool):
        if apply:
            self.cursor.execute("LOCK TABLE characters, character_source_mappings, character_catalog_classifications, character_variants, character_aliases, character_catalog_provenance IN EXCLUSIVE MODE")
        else:
            self.cursor.execute("SET TRANSACTION READ ONLY")

    def load_state(self):
        try:
            self.cursor.execute("SELECT id, name, release_order, rarity, element, weapon_type FROM characters")
            characters = [dict(zip(("id", "name", "release_order", "rarity", "element", "weapon_type"), r)) for r in self.cursor.fetchall()]
            self.cursor.execute("SELECT source_namespace, external_id, character_id, variant_id, source_key, source_name, source_version, source_record_path FROM character_source_mappings")
            mappings = [dict(zip(("source_namespace", "external_id", "character_id", "variant_id", "source_key", "source_name", "source_version", "source_record_path"), r)) for r in self.cursor.fetchall()]
            self.cursor.execute("SELECT character_id, classification FROM character_catalog_classifications")
            classifications = [dict(zip(("character_id", "classification"), r)) for r in self.cursor.fetchall()]
            self.cursor.execute("SELECT id, character_id, variant_key, display_name FROM character_variants")
            variants = [dict(zip(("id", "character_id", "variant_key", "display_name"), r)) for r in self.cursor.fetchall()]
            self.cursor.execute("SELECT character_id, source_namespace, source_version, alias, normalized_alias FROM character_aliases")
            aliases = [dict(zip(("character_id", "source_namespace", "source_version", "alias", "normalized_alias"), r)) for r in self.cursor.fetchall()]
            return {"characters": characters, "source_mappings": mappings, "classifications": classifications, "variants": variants, "aliases": aliases}
        except Exception:
            raise CatalogError("Catalog metadata tables are unavailable; review and apply sql/06_character_catalog.sql first") from None

    def apply(self, manifest, source_records, state, plan):
        from psycopg2.extras import Json

        rows_by_name = {r["name"].casefold(): r for r in state["characters"]}
        entity_ids = {r["name"].casefold(): r["id"] for r in state["characters"]}
        for item in plan["planned_inserts"]:
            self.cursor.execute(
                "INSERT INTO characters (release_order, name, rarity, element, weapon_type) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (item["release_order"], item["name"], item["rarity"], item["element"], item["weapon_type"]),
            )
            entity_ids[item["name"].casefold()] = self.cursor.fetchone()[0]
        for item in plan["planned_updates"]:
            fields = item["fields"]
            columns = [field for field in MANAGED_FIELDS if field in fields]
            assignments = ", ".join(f"{field}=%s" for field in columns)
            values = [fields[field] for field in columns]
            self.cursor.execute(f"UPDATE characters SET {assignments} WHERE id=%s", (*values, item["id"]))
        entities = {e["canonical_key"]: e for e in manifest["canonical_entities"]}
        id_by_key = {key: entity_ids[e["name"].casefold()] for key, e in entities.items()}
        for entity in manifest["canonical_entities"]:
            char_id = id_by_key[entity["canonical_key"]]
            self.cursor.execute(
                "INSERT INTO character_catalog_classifications (character_id, classification) VALUES (%s,%s) ON CONFLICT (character_id) DO NOTHING",
                (char_id, entity["classification"]),
            )
            for variant in entity.get("variants", []):
                self.cursor.execute(
                    "INSERT INTO character_variants (character_id, variant_key, display_name) VALUES (%s,%s,%s) ON CONFLICT (character_id, variant_key) DO NOTHING",
                    (char_id, variant["variant_key"], variant["name"]),
                )
            for alias in entity.get("aliases", []):
                self.cursor.execute(
                    "INSERT INTO character_aliases (character_id, source_namespace, source_version, alias, normalized_alias) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (character_id, source_namespace, normalized_alias) DO NOTHING",
                    (char_id, alias["source"], alias["source_version"], alias["name"], normalized_alias(alias["name"])),
                )
        variant_ids = {}
        self.cursor.execute("SELECT id, character_id, variant_key FROM character_variants")
        for ident, char_id, variant_key in self.cursor.fetchall():
            variant_ids[(char_id, variant_key)] = ident
        for record in source_records:
            mapping = record["mapping"]
            char_id = id_by_key[record["canonical_key"]]
            variant_id = variant_ids.get((char_id, record["variant_key"])) if record["variant_key"] else None
            self.cursor.execute(
                "INSERT INTO character_source_mappings (character_id, variant_id, source_namespace, external_id, source_key, source_name, source_version, source_record_path) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (source_namespace, external_id) DO NOTHING",
                (char_id, variant_id, mapping["source"], mapping["source_id"], mapping["source_key"], mapping["source_name"], mapping["source_version"], mapping["record_path"]),
            )
        snapshot = manifest["catalog_snapshot"]
        self.cursor.execute(
            "INSERT INTO character_catalog_provenance (source_namespace, source_version, source_data_release, retrieved_on, source_repository, source_index_path, manifest_sha256, input_hashes, import_summary, run_mode) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (SOURCE_NAMESPACE, snapshot["source_version"], snapshot.get("source_data_release"), snapshot["retrieved_on"], snapshot["source_repository"], snapshot["source_index"], plan["manifest_sha256"], Json(plan["input_hashes"]), Json({k: plan[k] for k in ("planned_inserts", "planned_updates", "unchanged", "conflicts", "unmatched_database_records", "unmatched_source_index_keys", "counts")}), "apply"),
        )

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()


def execute_sync(manifest, source_records, input_hashes, manifest_hash, store, apply=False):
    try:
        store.begin(apply)
        state = store.load_state()
    except CatalogError:
        store.rollback()
        raise
    except Exception:
        store.rollback()
        raise CatalogError("Could not read catalog state or acquire required locks; verify the database schema and connection") from None
    try:
        plan = build_plan(manifest, source_records, state, input_hashes, manifest_hash)
    except Exception:
        store.rollback()
        raise CatalogError("Could not build catalog plan from the observed database state; transaction rolled back") from None
    if apply and plan["conflicts"]:
        store.rollback()
        raise CatalogError("Unresolved catalog conflicts; transaction rolled back")
    if apply:
        try:
            store.apply(manifest, source_records, state, plan)
            store.commit()
            plan["mode"] = "apply"
        except Exception:
            store.rollback()
            raise CatalogError("Catalog apply failed; transaction rolled back") from None
    return plan


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--source-repo", type=Path, default=Path(os.getenv("GENSHIN_DB_REPO", DEFAULT_SOURCE_REPO)))
    parser.add_argument("--apply", action="store_true", help="Write changes; default is a read-only dry-run")
    parser.add_argument("--report-file", type=Path, help="Also save the JSON report to this path")
    args = parser.parse_args(argv)
    try:
        manifest, source_records, input_hashes = read_inputs(args.manifest, args.source_repo)
        manifest_hash = input_hashes[str(args.manifest.resolve())]
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
        dsn = os.getenv("DATABASE_URL", "").strip()
        if not dsn:
            raise CatalogError("DATABASE_URL is not set; configure it in the project .env or environment")
        if dsn.startswith("postgresql+psycopg2://"):
            dsn = "postgresql://" + dsn[len("postgresql+psycopg2://"):]
        import psycopg2
        try:
            connection = psycopg2.connect(dsn)
        except Exception:
            raise CatalogError("PostgreSQL connection failed; verify DATABASE_URL and network access (credentials were not displayed)") from None
        try:
            store = PostgresStore(connection)
            plan = execute_sync(manifest, source_records, input_hashes, manifest_hash, store, args.apply)
        finally:
            connection.close()
        rendered = json.dumps(plan, indent=2, ensure_ascii=False)
        print(rendered)
        if args.report_file:
            args.report_file.write_text(rendered + "\n", encoding="utf-8")
        if plan["conflicts"]:
            return 2
        return 0
    except CatalogError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
