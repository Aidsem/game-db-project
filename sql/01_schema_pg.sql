-- =====================================================================
-- 01_schema_pg.sql  -  PostgreSQL schema (hosted on Neon)
-- Game companion database ("Codex"): 10 tables
-- Safe to re-run: drops everything first (DEV ONLY - destroys data).
-- =====================================================================

DROP VIEW IF EXISTS v_build_damage_summary;
DROP VIEW IF EXISTS v_build_details;
DROP VIEW IF EXISTS v_character_overview;

DROP TABLE IF EXISTS character_catalog_provenance;
DROP TABLE IF EXISTS character_aliases;
DROP TABLE IF EXISTS character_source_mappings;
DROP TABLE IF EXISTS character_variants;
DROP TABLE IF EXISTS character_catalog_classifications;

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS character_profiles;
DROP TABLE IF EXISTS build_damage_logs;
DROP TABLE IF EXISTS build_team_members;
DROP TABLE IF EXISTS builds;
DROP TABLE IF EXISTS tier_list_exploration;
DROP TABLE IF EXISTS tier_list_combat;
DROP TABLE IF EXISTS artifacts;
DROP TABLE IF EXISTS weapons;
DROP TABLE IF EXISTS characters;

-- 1) characters ------------------------------------------------------
CREATE TABLE characters (
    id            SERIAL PRIMARY KEY,
    release_order INT          NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL UNIQUE,
    rarity        SMALLINT     NOT NULL CHECK (rarity BETWEEN 1 AND 5),
    element       VARCHAR(30)  NOT NULL,
    weapon_type   VARCHAR(30)  NOT NULL,
    description   TEXT
);

-- 2) weapons ---------------------------------------------------------
CREATE TABLE weapons (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    type        VARCHAR(30)  NOT NULL,
    rarity      SMALLINT     NOT NULL CHECK (rarity BETWEEN 1 AND 5),
    description TEXT
);
CREATE INDEX idx_weapon_type_rarity ON weapons (type, rarity DESC);

-- 3) artifacts (sets) ------------------------------------------------
CREATE TABLE artifacts (
    id        SERIAL PRIMARY KEY,
    set_name  VARCHAR(100) NOT NULL UNIQUE,
    bonus_2pc TEXT NOT NULL,
    bonus_4pc TEXT NOT NULL
);

-- 4) combat tier list ------------------------------------------------
CREATE TABLE tier_list_combat (
    id           SERIAL PRIMARY KEY,
    character_id INT         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    tier         VARCHAR(1)  NOT NULL CHECK (tier IN ('S','A','B','C','D')),
    role         VARCHAR(50) NOT NULL,
    CONSTRAINT uq_character_combat_role UNIQUE (character_id, role)
);

-- 5) exploration tier list (one per character) -----------------------
CREATE TABLE tier_list_exploration (
    id           SERIAL PRIMARY KEY,
    character_id INT        NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE,
    tier         VARCHAR(1) NOT NULL CHECK (tier IN ('S','A','B','C','D'))
);

-- 6) builds ----------------------------------------------------------
CREATE TABLE builds (
    id           SERIAL PRIMARY KEY,
    character_id INT          NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    build_name   VARCHAR(100) NOT NULL DEFAULT 'Main Build',
    weapon_id    INT          NOT NULL REFERENCES weapons(id),
    artifact_id  INT          NOT NULL REFERENCES artifacts(id),
    CONSTRAINT uq_character_build UNIQUE (character_id, build_name)
);

-- 7) build_team_members (junction: builds <-> teammate characters) ---
CREATE TABLE build_team_members (
    id           SERIAL PRIMARY KEY,
    build_id     INT NOT NULL REFERENCES builds(id)     ON DELETE CASCADE,
    character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    notes        VARCHAR(255),
    CONSTRAINT uq_build_teammate UNIQUE (build_id, character_id)
);

-- 8) build_damage_logs ----------------------------------------------
CREATE TABLE build_damage_logs (
    id           SERIAL PRIMARY KEY,
    build_id     INT              NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    label        VARCHAR(100)     NOT NULL,
    damage_value DOUBLE PRECISION NOT NULL,
    notes        VARCHAR(255),
    recorded_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- 9) character_profiles (1:1, semi-structured JSONB) -----------------
CREATE TABLE character_profiles (
    character_id INT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    profile      JSONB NOT NULL DEFAULT '{}'
);

-- 10) audit_log (filled by triggers only) ----------------------------
CREATE TABLE audit_log (
    id         SERIAL PRIMARY KEY,
    table_name VARCHAR(50)  NOT NULL,
    action     VARCHAR(20)  NOT NULL,
    record_id  INT,
    details    VARCHAR(255),
    logged_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
