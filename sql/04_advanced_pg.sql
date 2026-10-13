-- =====================================================================
-- 04_advanced_pg.sql - views, function, procedure, triggers, indexes
-- Run AFTER 01-03. Safe to re-run (CREATE OR REPLACE / IF NOT EXISTS).
-- =====================================================================

-- ---------- VIEWS ----------------------------------------------------
CREATE OR REPLACE VIEW v_character_overview AS
SELECT c.id, c.name, c.rarity, c.element, c.weapon_type,
       te.tier AS exploration_tier,
       (SELECT t.tier FROM tier_list_combat t
         WHERE t.character_id = c.id
         ORDER BY array_position(ARRAY['S','A','B','C','D'], t.tier) LIMIT 1) AS best_combat_tier,
       (SELECT COUNT(*) FROM builds b WHERE b.character_id = c.id)::int AS build_count
FROM characters c
LEFT JOIN tier_list_exploration te ON te.character_id = c.id;

CREATE OR REPLACE VIEW v_build_details AS
SELECT b.id AS build_id, c.name AS character_name, b.build_name,
       w.name AS weapon, w.rarity AS weapon_rarity, a.set_name AS artifact_set,
       (SELECT string_agg(tc.name, ', ' ORDER BY tc.name)
          FROM build_team_members m
          JOIN characters tc ON tc.id = m.character_id
         WHERE m.build_id = b.id) AS team
FROM builds b
JOIN characters c ON c.id = b.character_id
JOIN weapons    w ON w.id = b.weapon_id
JOIN artifacts  a ON a.id = b.artifact_id;

CREATE OR REPLACE VIEW v_build_damage_summary AS
SELECT b.id AS build_id, c.name AS character_name, b.build_name,
       COUNT(d.id)::int                   AS runs,
       ROUND(AVG(d.damage_value)::numeric, 1) AS avg_damage,
       MAX(d.damage_value)                AS max_damage
FROM builds b
JOIN characters c ON c.id = b.character_id
LEFT JOIN build_damage_logs d ON d.build_id = b.id
GROUP BY b.id, c.name, b.build_name;

-- ---------- FUNCTION: best build for a character ---------------------
CREATE OR REPLACE FUNCTION get_best_build(p_character_id INT)
RETURNS TABLE (build_id INT, build_name VARCHAR, avg_damage NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT b.id, b.build_name, ROUND(AVG(d.damage_value)::numeric, 1)
    FROM builds b
    JOIN build_damage_logs d ON d.build_id = b.id
    WHERE b.character_id = p_character_id
    GROUP BY b.id, b.build_name
    ORDER BY AVG(d.damage_value) DESC
    LIMIT 1;
$$;

-- ---------- PROCEDURE: add a damage log (called with CALL) -----------
CREATE OR REPLACE PROCEDURE add_damage_log(
    p_build_id INT, p_label VARCHAR, p_value DOUBLE PRECISION, p_notes VARCHAR DEFAULT NULL)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM builds WHERE id = p_build_id) THEN
        RAISE EXCEPTION 'Build % does not exist', p_build_id;
    END IF;
    INSERT INTO build_damage_logs (build_id, label, damage_value, notes)
    VALUES (p_build_id, p_label, p_value, p_notes);   -- validated by trigger
END;
$$;

-- ---------- TRIGGER 1: validate damage logs --------------------------
CREATE OR REPLACE FUNCTION trg_validate_damage() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.damage_value < 0 THEN
        RAISE EXCEPTION 'damage_value cannot be negative (got %)', NEW.damage_value;
    END IF;
    NEW.label := btrim(NEW.label);
    IF NEW.label = '' THEN
        RAISE EXCEPTION 'label cannot be empty';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_damage ON build_damage_logs;
CREATE TRIGGER validate_damage
BEFORE INSERT OR UPDATE ON build_damage_logs
FOR EACH ROW EXECUTE FUNCTION trg_validate_damage();

-- ---------- TRIGGER 2: audit character inserts / deletes -------------
CREATE OR REPLACE FUNCTION trg_audit_characters() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, action, record_id, details)
        VALUES ('characters', 'INSERT', NEW.id, 'Added character: ' || NEW.name);
        RETURN NEW;
    ELSE
        INSERT INTO audit_log (table_name, action, record_id, details)
        VALUES ('characters', 'DELETE', OLD.id, 'Deleted character: ' || OLD.name);
        RETURN OLD;
    END IF;
END;
$$;
DROP TRIGGER IF EXISTS audit_characters ON characters;
CREATE TRIGGER audit_characters
AFTER INSERT OR DELETE ON characters
FOR EACH ROW EXECUTE FUNCTION trg_audit_characters();

-- ---------- INDEXES (one-line justification each) --------------------
CREATE INDEX IF NOT EXISTS idx_damage_build_time   ON build_damage_logs (build_id, recorded_at); -- per-build charts
CREATE INDEX IF NOT EXISTS idx_char_element_rarity ON characters (element, rarity);              -- element/rarity filters
CREATE INDEX IF NOT EXISTS idx_tlc_tier            ON tier_list_combat (tier);                   -- tier-board queries
CREATE INDEX IF NOT EXISTS idx_profile_gin         ON character_profiles USING GIN (profile);    -- JSONB containment (@>)
