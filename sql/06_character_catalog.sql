-- 06_character_catalog.sql
-- Additive catalog identity and provenance metadata. Run only after review.
-- This migration does not insert/update characters or alter existing tables.
-- PostgreSQL characters.id remains the application primary key; source IDs are
-- namespaced external identifiers and must never be used as local primary keys.

CREATE TABLE IF NOT EXISTS character_catalog_classifications (
    character_id INT PRIMARY KEY
        REFERENCES characters(id) ON DELETE CASCADE ON UPDATE CASCADE,
    classification VARCHAR(32) NOT NULL
        CHECK (classification IN ('combat_playable', 'mode_avatar')),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS character_variants (
    id SERIAL PRIMARY KEY,
    character_id INT NOT NULL
        REFERENCES characters(id) ON DELETE CASCADE ON UPDATE CASCADE,
    variant_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    UNIQUE (character_id, variant_key),
    UNIQUE (id, character_id)
);

CREATE TABLE IF NOT EXISTS character_source_mappings (
    id SERIAL PRIMARY KEY,
    character_id INT NOT NULL
        REFERENCES characters(id) ON DELETE CASCADE ON UPDATE CASCADE,
    variant_id INT,
    source_namespace VARCHAR(100) NOT NULL,
    external_id VARCHAR(150) NOT NULL,
    source_key VARCHAR(150) NOT NULL,
    source_name VARCHAR(150) NOT NULL,
    source_version VARCHAR(100) NOT NULL,
    source_record_path TEXT NOT NULL,
    UNIQUE (source_namespace, external_id),
    FOREIGN KEY (variant_id, character_id)
        REFERENCES character_variants(id, character_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK (btrim(source_namespace) <> ''),
    CHECK (btrim(external_id) <> '')
);
CREATE INDEX IF NOT EXISTS idx_character_source_mappings_character
    ON character_source_mappings (character_id);

CREATE TABLE IF NOT EXISTS character_aliases (
    id SERIAL PRIMARY KEY,
    character_id INT NOT NULL
        REFERENCES characters(id) ON DELETE CASCADE ON UPDATE CASCADE,
    source_namespace VARCHAR(100) NOT NULL,
    source_version VARCHAR(100) NOT NULL,
    alias VARCHAR(200) NOT NULL,
    normalized_alias VARCHAR(200) NOT NULL,
    UNIQUE (character_id, source_namespace, normalized_alias),
    CHECK (btrim(alias) <> ''),
    CHECK (btrim(normalized_alias) <> '')
);
CREATE INDEX IF NOT EXISTS idx_character_aliases_normalized
    ON character_aliases (normalized_alias);

-- Snapshot-level provenance. The manifest/importer supplies a content hash;
-- this migration intentionally does not presume or insert a particular snapshot.
CREATE TABLE IF NOT EXISTS character_catalog_provenance (
    id SERIAL PRIMARY KEY,
    source_namespace VARCHAR(100) NOT NULL,
    source_version VARCHAR(100) NOT NULL,
    source_data_release VARCHAR(150),
    retrieved_on DATE NOT NULL,
    source_repository TEXT NOT NULL,
    source_index_path TEXT NOT NULL,
    manifest_sha256 CHAR(64) NOT NULL,
    input_hashes JSONB NOT NULL DEFAULT '{}'::jsonb,
    import_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    run_mode VARCHAR(16) NOT NULL CHECK (run_mode IN ('apply')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$')
);
