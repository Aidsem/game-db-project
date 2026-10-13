# CONTEXT: "Codex" Game Companion Database - DBMS PBL Project

**Paste this whole file at the START of every new AI chat (Gemini, Codex, Claude, Copilot), then add ONE task.** Everything the AI needs is here. If something is missing, the AI must ASK instead of guessing.

---

## 0. Rules for the AI reading this
1. Do exactly ONE task per message. Stop and wait after finishing it.
2. Output ONLY the code for the file(s) named in the task, preceded by the exact path relative to the project root. For small fixes output only the changed function plus where to paste it. Never rewrite an existing file unless the task says "full file".
3. Never invent tables, columns, endpoints or features that are not in this file. If you need one, say so and ask.
4. Frontend: vanilla JavaScript (ES modules), HTML5, CSS3. NO React/Vue/npm/build tools. Allowed CDN library: Chart.js (already loaded in index.html as global `Chart`). Never use `innerHTML` with API data (build DOM with `ui.el`, so there is no XSS).
5. Never put passwords, connection strings or API keys in code. Secrets live only in `.env`.
6. Only edit files you own (section 3). If a change is needed in someone else's file, describe it in one sentence instead.
7. Keep answers short: no long explanations, no repeating this context back.
8. Target: VS Code and Python 3.10+. Person A uses Pop!_OS (Linux, bash), Person B uses Windows 10/11 (PowerShell). Give commands for both when a shell command is needed; code must be cross-platform. Dark theme (section 7).
9. Several different AIs write pages for this project. If an example view file is attached, MATCH its code style (naming, structure, how it uses `ctx.ui`, `ctx.api`, `ctx.theme`) so all pages look and feel consistent. Use only the helpers listed in section 7; do not invent new helper functions in shared files.
10. If you are running low on output space, stop at a clean boundary and say exactly where you stopped, rather than truncating silently.

---

## 1. Project, deadline, assessment
- **What:** a game-companion web app + PostgreSQL database: characters, weapons, artifact sets, combat/exploration tier lists, recommended builds with teammates, per-build damage logs with graphs. Dataset themed on Genshin Impact (fan-made, educational, no game assets, not affiliated with the publisher).
- **Team:** 2 members, Person A and Person B (names and roll numbers go in the README).
- **Deadline:** Wednesday 14 Oct 2026. Today is Tuesday 13 Oct 2026. The public GitHub link is shared at evaluation.
- **Assessment: DBMS PBL, 34 marks**

| # | Criterion | Marks | Full marks needs |
|---|---|---|---|
| 1 | Problem identification and proposed solution | 8 | Clear real-world problem, defined objectives, strong reason for a database, DBMS concepts applied |
| 2 | Database design and implementation | 14 | Accurate ER diagram, 3NF/BCNF schema, keys and constraints, DDL, DML, joins, views, triggers/procedures, fully working interface |
| 3 | Git repository and version control | 4 | Public repo (2), complete README + organised folders (1), regular meaningful commits from ALL members (1) |
| 4 | Presentation, demo, viva and SDG mapping | 8 | Organised presentation, smooth live demo, correct confident answers, relevant UN SDG clearly mapped and explained |
| B1 | Bonus: PostgreSQL/NoSQL | 2 | PostgreSQL features (JSONB, stored functions, indexing) shown working in the demo |
| B2 | Bonus: DB on the cloud | 2 | Cloud DB connected live in the demo, deployment explained in README, NO credentials in the repo |

Bonus marks are inside the 34 total (they can only make up for lost marks).

**Teacher's repository rules:** public GitHub repo named for the project; contains source code, `.sql` scripts, design diagrams (ER, schema) and documentation; `README.md` has Project Title and Description, Tech Stack and Database used, Team Members (Name and Roll Number), Setup/Execution Instructions.

---

## 2. Decisions already made (do not reopen)
| Topic | Decision |
|---|---|
| Database | PostgreSQL 16 on **Neon** (free cloud). Original MySQL schema kept only as `sql/legacy_mysql/`. |
| Backend | Single file `app.py`: Flask 3, Flask-SQLAlchemy, Flask-CORS, psycopg2-binary, python-dotenv, matplotlib. **DONE and tested.** |
| Config | One `DATABASE_URL` in `.env`. The app refuses to start without it. |
| Schema creation | By SQL files, NOT by SQLAlchemy: `python scripts/run_sql.py sql/01_schema_pg.sql sql/02_seed_data.sql sql/03_seed_extra.sql sql/04_advanced_pg.sql` |
| Frontend | Vanilla JS ES modules + hash router + Chart.js CDN, in `app/static/`. Shell, router and helpers are DONE; the 9 page modules (`js/views/*.js`) are what remains. |
| Tests / CI | `pytest` (8 tests pass) and `.github/workflows/ci.yml` |

---

## 3. People and file ownership (prevents merge conflicts)
**Person A: cloud, repo admin, data-heavy pages**
Owns: `app.py`, `requirements*.txt`, `.env.example`, `.gitignore`, `sql/*`, `scripts/*`, `tests/*`, `.github/*`, `docs/cloud_deployment.md`, and views `dashboard.js`, `damageLab.js`, `sqlExplorer.js`, `compare.js`.

**Person B: core pages, documentation, slides**
Owns: `README.md`, `docs/problem_statement.md`, `docs/er_diagram.*`, `docs/normalization.md`, `docs/sdg_mapping.md`, `docs/screenshots/*`, `presentation/*`, `app/static/index.html`, `app/static/css/*`, and views `characters.js`, `weapons.js`, `artifacts.js`, `tiers.js`, `builds.js`, `search.js`.

**Shared contract files (already written; change only after telling the other person):** `js/api.js`, `js/main.js`, `js/theme.js`, `js/ui.js`. Shared doc: `docs/viva_qa.md`.

**AI tools in use (free plans, both people have the same set):** Gemini Pro (large), ChatGPT free (limited), Codex free (small), Claude free (very small), Copilot Student (if activated). Allocation: Gemini = big pages (`characters`, `damageLab`, `sqlExplorer`, `dashboard`) and CSS; ChatGPT = smaller pages (`weapons`, `artifacts`, `search`, `compare`) and slide/viva text; Codex = single-function fixes; Claude = the hardest bug and one final review. One AI per file; never two AIs on the same file.

Git: each person works on `feature/<topic>` branches, commits small and often with meaningful messages, merges to `main` (pull request or direct). Both must have commits.

---

## 4. Repository structure and status
```
game-db-project/
├── README.md                    DONE (B fills names/roll numbers, adds screenshots)
├── app.py                       DONE, tested
├── requirements.txt, requirements-dev.txt, .env.example, .gitignore, start_server.bat   DONE
├── sql/
│   ├── 01_schema_pg.sql         DONE   10 tables
│   ├── 02_seed_data.sql         DONE   87 characters, 61 weapons, 15 artifact sets, 30 combat tiers, 15 exploration tiers, 26 builds
│   ├── 03_seed_extra.sql        DONE   +5 builds, teammates, 15 JSONB profiles, 17 SAMPLE damage logs
│   ├── 04_advanced_pg.sql       DONE   3 views, 1 function, 1 procedure, 2 triggers, 4 indexes
│   ├── 05_queries.sql           DONE   16 demo queries
│   └── legacy_mysql/game_database_schema.sql
├── scripts/run_sql.py           DONE
├── tests/test_api.py            DONE (8 tests)
├── .github/workflows/ci.yml     DONE
├── docs/
│   ├── problem_statement.md, er_diagram.md + .png, normalization.md, sdg_mapping.md,
│   │   cloud_deployment.md, viva_qa.md           DONE
│   ├── screenshots/                               TODO (B)
│   └── team/ (context.md, EXECUTION_PLAN.md)
├── presentation/                TODO (B): slides
└── app/static/
    ├── index.html               DONE (shell: sidebar #nav, #view, #drawer, #modal-root, #toasts)
    ├── css/base.css, layout.css, components.css    DONE (functional dark theme; B may polish)
    └── js/
        ├── main.js, api.js, theme.js, ui.js        DONE
        └── views/               TODO: dashboard(A) damageLab(A) sqlExplorer(A) compare(A)
                                       characters(B) weapons(B) artifacts(B) tiers(B) builds(B) search(B)
```
Flask serves `app/static/` at the site root: `index.html` is `/`, scripts are `/js/main.js`, styles `/css/base.css`.

---

## 5. Database (PostgreSQL)
10 tables. PK primary key, FK foreign key, UK unique.

| Table | Columns | Constraints |
|---|---|---|
| `characters` | id SERIAL PK, release_order INT, name VARCHAR(100), rarity SMALLINT, element VARCHAR(30), weapon_type VARCHAR(30), description TEXT | release_order UK, name UK, rarity CHECK 1..5 |
| `weapons` | id, name, type, rarity, description | name UK, rarity CHECK 1..5, index (type, rarity DESC) |
| `artifacts` | id, set_name, bonus_2pc, bonus_4pc | set_name UK |
| `tier_list_combat` | id, character_id FK, tier VARCHAR(1), role VARCHAR(50) | tier CHECK in S,A,B,C,D; UK(character_id, role); CASCADE |
| `tier_list_exploration` | id, character_id FK, tier | character_id UK; same CHECK; CASCADE |
| `builds` | id, character_id FK, build_name, weapon_id FK, artifact_id FK | UK(character_id, build_name); character CASCADE; weapon and artifact RESTRICT |
| `build_team_members` | id, build_id FK, character_id FK, notes | UK(build_id, character_id); both CASCADE (junction) |
| `build_damage_logs` | id, build_id FK, label, damage_value DOUBLE, notes, recorded_at TIMESTAMPTZ default now() | build CASCADE; trigger rejects negative |
| `character_profiles` | character_id PK/FK, profile JSONB | 1:1; CASCADE; GIN index |
| `audit_log` | id, table_name, action, record_id, details, logged_at | filled by trigger only |

Data facts: elements Pyro, Hydro, Electro, Cryo, Dendro, Geo, Anemo. Weapon types Sword, Claymore, Polearm, Bow, Catalyst. Combat roles Main DPS, Sub DPS, Support, Healer. Tiers S, A, B, C, D. Rarity is a NUMBER 1-5. Only some characters have tiers, builds, damage logs (15 have JSONB profiles), so every page must handle "no data".

**Advanced SQL (sql/04_advanced_pg.sql):** views `v_character_overview`, `v_build_details`, `v_build_damage_summary`; function `get_best_build(p_character_id)`; procedure `add_damage_log(p_build_id, p_label, p_value, p_notes)` (use `CALL`); triggers `validate_damage` (BEFORE INSERT/UPDATE on build_damage_logs: no negative value, no empty label, trims label) and `audit_characters` (AFTER INSERT/DELETE on characters -> audit_log); indexes `idx_damage_build_time`, `idx_char_element_rarity`, `idx_tlc_tier`, `idx_profile_gin`, `idx_weapon_type_rarity`.

**Normalisation facts:** 1NF: atoms only, teams in junction table (profile JSONB is a documented exception). 2NF: composite natural keys enforced by UNIQUE with surrogate PKs. 3NF/BCNF: weapon and artifact details stored once, referenced by id; every determinant is a candidate key.

---

## 6. API contract (JSON, same origin, base `/api`)
Errors: `{"error": "message"}` with 400 (bad input / trigger rejected), 404, 409 (duplicate or FK in use). Ids are integers.

**Shapes**
- Character: `{id, release_order, name, rarity, element, weapon_type, description}`
- `GET /characters/<id>` adds `combat_tiers:[{id,character_id,tier,role}]`, `exploration_tier:{id,character_id,tier}|null`, `builds:[Build]`
- Weapon `{id,name,type,rarity,description}`; Artifact `{id,set_name,bonus_2pc,bonus_4pc}`
- Combat tier `{id,character_id,tier,role,character_name}`; Exploration `{id,character_id,tier,character_name}` (list endpoints)
- Build `{id, character_id, build_name, weapon:{...}, artifact:{...}, team_members:[{id,build_id,character_id,teammate_name,notes}], damage_logs:[{id,build_id,label,damage_value,notes,recorded_at}], average_damage: number|null}`

**CRUD**
- `GET /characters?element=&weapon_type=&rarity=`; `POST /characters` body `{release_order,name,rarity,element,weapon_type,description?}` (client picks release_order = max+1); `PUT/DELETE /characters/<id>`
- `GET /weapons?type=`; `POST /weapons {name,type,rarity,description?}`; `GET/PUT/DELETE /weapons/<id>` (DELETE 409 if a build uses it)
- `GET/POST /artifacts {set_name,bonus_2pc,bonus_4pc}`; `GET/PUT/DELETE /artifacts/<id>`
- `GET /tier-lists/combat?tier=&role=`; `POST {character_id,tier,role}`; `DELETE /tier-lists/combat/<id>`
- `GET /tier-lists/exploration?tier=`; `POST {character_id,tier}` (upsert); `DELETE /tier-lists/exploration/<id>`
- `GET /builds?character_id=`; `POST /builds {character_id,weapon_id,artifact_id,build_name?}`; `GET/PUT/DELETE /builds/<id>`
- `POST /builds/<id>/team {character_id,notes?}`; `DELETE /builds/<id>/team/<member_id>`
- `GET /damage-logs?build_id=&character_id=&label=`; `POST /damage-logs {build_id,label,damage_value,notes?}`; `PUT/DELETE /damage-logs/<id>`
- PNG images (use as `<img src>`; `graphUrl(kind,id)` adds a cache-buster): `/damage-logs/graph/build/<build_id>`, `/damage-logs/graph/compare/<character_id>`

**Advanced endpoints**
- `GET /health` -> `{status, database:"connected", engine:"PostgreSQL 16.x"}`
- `GET /analytics/summary` -> `{counts:{characters,weapons,artifacts,builds,damage_logs}, by_element:[{element,total}], by_weapon_type:[{weapon_type,total}], combat_tiers:[{tier,total}] (S..D order), top_builds:[{build_id,character_name,build_name,runs,avg_damage,max_damage}]}`
- `GET /views/character-overview` rows `{id,name,rarity,element,weapon_type,exploration_tier,best_combat_tier,build_count}`
- `GET /views/build-details` rows `{build_id,character_name,build_name,weapon,weapon_rarity,artifact_set,team}` (team is a comma-separated string)
- `GET /views/damage-summary` rows `{build_id,character_name,build_name,runs,avg_damage,max_damage}`
- `GET /best-build/<character_id>` -> `{build_id,build_name,avg_damage}` (SQL function) or 404 `{error}`
- `POST /procedures/add-damage-log {build_id,label,damage_value,notes?}` -> 201 `{message}` (calls the stored procedure; the trigger's error text comes back as 400 `{error}`, e.g. "damage_value cannot be negative (got -5)")
- `GET /profiles?region=` -> `[{character_id,name,profile:{region,stat_priority:[...],playstyle}}]`; `GET /profiles/<character_id>` -> object or 404
- `GET /search?q=` (min 2 chars) -> `{characters:[{id,name,element,rarity}], weapons:[{id,name,type,rarity}], artifacts:[{id,set_name}]}`
- `GET /audit-log` -> latest 50 `{id,table_name,action,record_id,details,logged_at}`
- `GET /demo-queries` -> `[{id,title,sql}]`; `GET /demo-queries/<id>` -> `{id,title,sql,rows:[...]}` (8 fixed read-only SELECTs; the client cannot send SQL)

---

## 7. Frontend contract (already implemented in the shared files)
**index.html ids:** `#nav` (links `<a href="#/route" data-route="/route">`), `#view`, `#toasts`, `#drawer`, `#modal-root`, `#search-btn`, `#conn-dot`, `#conn-text`. Chart.js CDN loads first (global `Chart`), then `<script type="module" src="/js/main.js">`.

**Routes (hash router in main.js):** `/` dashboard, `/characters`, `/weapons`, `/artifacts`, `/tiers`, `/builds`, `/damage-lab`, `/compare`, `/sql`. Query params live in the hash: `#/damage-lab?character_id=5`. A missing view file shows a friendly "not added yet" message.

**Every view module** is `js/views/<name>.js` and exports `export async function render(root, ctx)` (and optionally `export function destroy()` to remove listeners / destroy charts). `ctx = { api, ui, theme, params, graphUrl }`. Append content to `root` (it is empty when render starts). Wrap network calls in try/catch and show `ui.toast(err.message,'error')`.

**search.js** is special: it exports `export function initSearch({api, ui, theme})`, called once at boot. It binds Ctrl+K and `#search-btn`, opens a palette with `ui.openModal`, searches via `/search` (debounced 250 ms), and on selection sets `location.hash` (character -> `#/characters?open=<id>`).

**api.js:** `api.get(path)`, `api.post(path, body)`, `api.put(path, body)`, `api.del(path)`; paths have NO `/api` prefix (`api.get('/characters?element=Pyro')`); failures throw `Error(message)`. `graphUrl('build'|'compare', id)` returns a PNG URL.

**ui.js:** `el(tag, attrs, ...children)` (attrs: class, style object, dataset, onclick-style handlers, other attributes; children can be strings, nodes, arrays), `toast(msg, 'info'|'success'|'error')`, `openModal({title, body, onClose})`, `closeModal()`, `openDrawer({title, body})`, `closeDrawer()`, `confirmDialog(msg) -> Promise<boolean>`, `skeleton(rows)`, `emptyState(msg)`, `debounce(fn, ms)`, `table(columns, rows, opts)` (columns `[{key,label,render?(row)->Node|string}]`, opts `{sortable:true,onRowClick}`; returns a Node), `downloadCsv(filename, rows)`.

**theme.js:** `ELEMENT_COLORS`, `TIER_COLORS`, `CHART_COLORS`, `elementColor(name)`, `tierColor(t)`, `rarityDiamonds(n)` ("◆◆◆◆◆").

**CSS classes available (components.css/layout.css):** `.btn` (+ `.primary`, `.danger`, `.ghost`), `.icon-btn`, `.field` (label + input), `.form-actions`, `.card` (+ `.clickable`), `.grid` (auto-fill cards), `.toolbar`, `.page-head`, `.chip` (+ `.swatch`), `.tier-badge`, `.rarity`, `.stat`, `.stat-label`, `.table-wrap`, `.data-table`, `img.graph`, `pre.sql`, `.muted`, `.mono`. Add new view-specific CSS to `css/components.css` (B owns CSS: A sends B the snippet, or prefixes class names with the view name, e.g. `.dash-...`).

**Design language:** dark slate (`--bg #14161C`, `--surface #1B1E27`, border `#2A2E3A`, text `#ECEDF2`, muted `#8B90A3`), accents teal `#3FC9BE`, amber `#F2A541`, violet `#8B7FD8`. Fonts: Fraunces headings, Inter UI, JetBrains Mono numbers. "Colour is data": elements and tiers always use their fixed colours; rarity as diamonds. Layout inspired by tier-list sites: dense, S-to-D rows with character chips, filter bar on top. Must work under 800 px width, with loading skeletons, empty states and error toasts.

**Page specs**
1. **Dashboard (A)** `views/dashboard.js`: 5 stat cards from `/analytics/summary` counts; Chart.js doughnut (characters by element, element colours); bar chart (combat tier counts, tier colours); "Top builds by average damage" list; latest 5 audit-log rows. Destroy charts in `destroy()`.
2. **Characters (B)** `characters.js`: card grid; search box; filters element / weapon type / rarity; create, edit, delete via modal forms (`confirmDialog` for delete); card click opens drawer with combat roles, exploration tier, builds (weapon, artifact, teammates), JSONB profile from `/profiles/<id>` (region, stat priority, playstyle; 404 = "no profile"), button "Open in Damage Lab" (`#/damage-lab?character_id=ID`); supports `?open=<id>` to open that drawer on load.
3. **Weapons (B)** `weapons.js`: grouped by type, rarity descending, type filter, CRUD (handle 409 on delete with a friendly message).
4. **Artifacts (B)** `artifacts.js`: expandable cards with 2-piece and 4-piece bonuses, CRUD.
5. **Tiers (B)** `tiers.js`: S-to-D board, Combat/Exploration switch, role and element filters, character chips coloured by element, add/remove entries.
6. **Builds (B)** `builds.js`: pick character -> list its builds (weapon, artifact, team); create build (weapon + artifact + name); add/remove teammates; delete; link to Damage Lab.
7. **Damage Lab (A)** `damageLab.js`: pick character then build (supports `?character_id=`); form (label, value, notes) posting to `/procedures/add-damage-log` (show the 400 trigger message in a toast); table of logs with delete; both PNG graphs refreshed after every change; "best build" badge from `/best-build/<id>` (404 = hide badge).
8. **Compare (A)** `compare.js`: pick two characters; side by side: stats, tiers, builds, average damage (data from `/characters/<id>`).
9. **SQL Explorer (A)** `sqlExplorer.js` (the live-demo page): dropdown of the 3 views as sortable tables with CSV export; "Best build" function demo; demo-queries list showing SQL text (`pre.sql`) and result table; JSONB profile filter by region; audit-log table; a "Try a negative value" button that calls the procedure endpoint to show the trigger rejecting it.
10. **Global search (B)** `search.js` as described above.

---

## 8. SDG mapping (slides, README, viva)
Primary **SDG 9** (Industry, Innovation and Infrastructure): reliable structured data platform, open REST API, cloud-hosted database. Secondary **SDG 4** (Quality Education): reproducible learning example of DBMS, cloud and Git practice. Minor SDG 12: build comparison helps players judge spending. State honestly that this is a student project: the contribution is skill-building and a reusable template. Verify SDG target numbers on sdgs.un.org before quoting them.

## 9. Problem statement (short)
Game data is scattered, inconsistent and hard to compare; a relational model answers cross-table questions (best build, teammates, tiers) with integrity rules, triggers, views and a cloud database. Objectives: normalised schema; CRUD + analytics API; damage logging and graphs; rules enforced in the DB; cloud hosting with documented deployment.

---

## 10. Known gotchas
- Windows PowerShell: activate with `venv\Scripts\activate`; if blocked run `Set-ExecutionPolicy -Scope Process Bypass` first. Pop!_OS/Linux: `python3 -m venv venv` then `source venv/bin/activate` (needs `python3-venv`).
- Never re-run `sql/01_schema_pg.sql` on a shared database: it drops all tables.
- `python app.py` exits at once if `DATABASE_URL` is missing. Neon needs `?sslmode=require` in the URL. Neon wakes from idle slowly (first request after a pause can take seconds).
- `CALL` arguments cannot be subqueries (use literal ids).
- A weapon or artifact used by a build cannot be deleted (409); deleting a character cascades.
- Damage values are SAMPLE data: label them as such in the README and slides.
- Never commit `.env`. Check with `git status` before every commit.
- In views never assume a character has tiers, builds, logs or a profile.

## 11. Timeline (IST)
| When | A | B |
|---|---|---|
| Tue midday | Unzip, Neon, load SQL, run app, create PUBLIC repo, push, add B as collaborator | Install tools, clone, run app against A's Neon URL (or own Neon), read this file |
| Tue afternoon | dashboard.js, damageLab.js | characters.js, weapons.js, artifacts.js |
| Tue evening | sqlExplorer.js, compare.js | tiers.js, builds.js, search.js |
| Tue night | Merge, fresh-clone test, fix bugs | Screenshots, README names, slides start |
| Wed morning | Demo rehearsal x2 on Neon, final push at least 2 hours before the deadline | Slides final, viva Q&A rehearsal, README check |

## 12. Definition of done
- Fresh clone + README steps = working app on Neon.
- Every rubric row has visible evidence (ER diagram, normalisation doc, SQL files, view/function/procedure/trigger/index, JSONB, tests, commits from both, SDG doc, cloud doc).
- No secrets in git history (`git log -p -- .env` is empty).
- Demo script rehearsed (7 min): Dashboard -> Characters -> Tier board -> Damage Lab (add a log, graph updates) -> SQL Explorer (views, best-build function, JSONB filter, trigger rejects negative, audit log) -> Neon console.
