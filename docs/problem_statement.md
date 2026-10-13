# Problem Statement and Objectives

## The problem
Players of a live-service action RPG rely on information that is scattered across wikis, videos, forum posts and spreadsheets: which characters are strong, which weapon and artifact set suit them, and who to team them with. The data is inconsistent between sources, hard to search or compare, and goes stale after each game update. A flat document or spreadsheet cannot answer relational questions such as:

* "Which build of this character deals the most damage, and with which teammates?"
* "Which S-tier supports are Pyro, and which of them have a recommended build?"
* "Which weapons can no longer be removed because a build depends on them?"

## Why a database (DBMS) is the right solution
| Need | DBMS concept that solves it |
|---|---|
| No duplicated or conflicting facts | Normalisation (3NF), primary and foreign keys |
| Invalid data (rarity 9, tier "Z", negative damage) | CHECK constraints, a validation trigger |
| Teams are many-to-many | Junction table `build_team_members` |
| Cross-table questions | Joins, subqueries, GROUP BY / HAVING, views |
| Reusable logic inside the database | Stored function and stored procedure |
| Traceability | Audit trigger writing to `audit_log` |
| Fast filtering | Indexes (B-tree and GIN on JSONB) |
| Semi-structured facts (region, stat priority) | PostgreSQL JSONB |
| Always available, shareable | Cloud-hosted PostgreSQL (Neon) |

## Objectives
1. Model the domain in a normalised relational schema with integrity constraints.
2. Provide full CRUD plus analytics through a REST API and a web interface.
3. Record and visualise per-build damage so builds can be compared.
4. Enforce rules inside the database (constraints, triggers) and expose reporting through views and functions.
5. Host the database in the cloud and document the deployment.
6. Keep the project reproducible: SQL scripts, setup guide, tests and Git history from both members.

## Scope and honesty note
This is a student project using fan-made, educational sample data. It is not affiliated with the game's publisher and uses no game assets. Damage figures are **sample values** to demonstrate the feature, not measured results.
