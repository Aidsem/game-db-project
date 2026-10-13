# Viva Questions and Answers

## Database design
**Why PostgreSQL instead of MySQL?** It is open source, standards-compliant, supports JSONB, stored functions/procedures, richer indexing (GIN), and is available as free managed hosting on Neon. The original design was MySQL; the schema was ported (ENUM -> VARCHAR + CHECK, AUTO_INCREMENT -> SERIAL).

**Why is `build_team_members` a separate table?** A build has many teammates and a character can be a teammate in many builds: a many-to-many relationship. A column holding a list would break 1NF.

**Why surrogate `id` keys plus UNIQUE constraints?** Short, stable foreign-key targets; the natural composite key is still enforced by UNIQUE.

**CASCADE vs RESTRICT?** Tiers, builds, teammates and logs are meaningless without their character, so they cascade. A weapon or artifact is shared by many builds, so deleting one that is in use is blocked (RESTRICT) to protect integrity.

**Which normal form and why?** 3NF/BCNF: weapon and artifact attributes are stored once and referenced by id, so there are no update anomalies. See `docs/normalization.md`.

**Why JSONB for profiles?** Region, stat priority and playstyle vary per character; JSONB stores flexible data, and a GIN index makes `@>` containment queries fast. It is isolated in a 1:1 table.

## Advanced SQL
**What do the views do?** `v_character_overview`, `v_build_details` and `v_build_damage_summary` pre-join tables so the app and reports reuse one tested query.

**Function vs procedure?** `get_best_build(character_id)` is a function: it returns a value and is used inside SELECT. `add_damage_log(...)` is a procedure: it performs an action and is called with `CALL`.

**What do the triggers do?** `validate_damage` (BEFORE INSERT/UPDATE) rejects negative damage and empty labels, so the rule holds even if someone bypasses the app. `audit_characters` (AFTER INSERT/DELETE) writes to `audit_log`.

**Why each index?** `(build_id, recorded_at)` for per-build charts; `(element, rarity)` for filters; `tier` for the tier board; GIN on `profile` for JSONB containment; `(type, rarity DESC)` for weapons grouped by type.

## Architecture and tools
**Why Flask and SQLAlchemy?** Flask is a light microframework; SQLAlchemy parameterises queries (protects against SQL injection) and maps tables to Python classes. Raw SQL with bound parameters is used for views, the function and the procedure.

**Why vanilla JavaScript?** The UI is a small data app; avoiding a framework removes build tooling and shows DOM, events and `fetch` fundamentals.

**Why a REST API?** It decouples front end from back end so any client (web, mobile) can use the same endpoints.

**How are secrets handled?** In `.env` (ignored by Git); `.env.example` holds placeholders only.

**Why is the graph server-side?** matplotlib renders PNGs the browser shows with `<img>`, using the same dark palette as the UI.

## Cloud
**Why Neon?** Free managed PostgreSQL, serverless with auto-suspend, connects with a standard URL. See `docs/cloud_deployment.md`.

## Honest limitations
Damage values are sample data; no user accounts; the API is open (fine for a local/demo project); the schema is in SQL scripts rather than migrations.
