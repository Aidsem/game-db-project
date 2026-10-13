# Normalisation (1NF -> 3NF / BCNF)

## First Normal Form (1NF) - atomic values, no repeating groups
* Every column holds a single value. A build's "recommended team" (a list) is **not** stored in a column; it is split into the junction table `build_team_members (build_id, character_id)`, one row per teammate.
* A character's several combat roles are separate rows in `tier_list_combat`, not a comma-separated column.
* One deliberate exception: `character_profiles.profile` is JSONB, used for genuinely semi-structured data (region, stat priority, playstyle). This is a documented trade-off, kept in its own 1:1 table so the core schema stays strictly relational.

## Second Normal Form (2NF) - no partial dependency on part of a key
Tables whose natural key is composite (`tier_list_combat(character_id, role)`, `builds(character_id, build_name)`, `build_team_members(build_id, character_id)`) use a single-column surrogate primary key `id` and enforce the composite key with a UNIQUE constraint. Every non-key attribute (e.g. `tier`, `notes`) depends on the whole key.

## Third Normal Form (3NF) - no transitive dependency
* Weapon details (`name`, `type`, `rarity`) live in `weapons`; `builds` stores only `weapon_id`. Without this, `weapon_type` and `rarity` would depend on `weapon_id` through `builds` (a transitive dependency).
* Artifact bonuses live in `artifacts`; `builds` stores only `artifact_id`.
* Teammate names are never copied into `build_team_members`; they are reached through `character_id`.

## BCNF check
In every table each determinant is a candidate key: `id`, `name`, `release_order` (characters); `name` (weapons); `set_name` (artifacts); `(character_id, role)`; `character_id` (exploration); `(character_id, build_name)`; `(build_id, character_id)`. No non-key attribute determines another, e.g. element does not determine weapon type and weapon type does not determine rarity, so the schema is in BCNF.

## Keys and constraints used
| Kind | Examples |
|---|---|
| Primary keys | `id SERIAL` on every table; `character_profiles.character_id` |
| Foreign keys | `builds.character_id`, `builds.weapon_id`, `builds.artifact_id`, `build_team_members.*`, `build_damage_logs.build_id`, tier tables |
| UNIQUE | `characters.name`, `weapons.name`, `artifacts.set_name`, `(character_id, build_name)` ... |
| CHECK | `rarity BETWEEN 1 AND 5`, `tier IN ('S','A','B','C','D')` |
| ON DELETE CASCADE | deleting a character removes its tiers, builds, teammates, damage logs, profile |
| ON DELETE RESTRICT | a weapon or artifact used by a build cannot be deleted |
| Trigger rule | `damage_value >= 0`, non-empty label |
