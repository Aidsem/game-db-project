# Execution Plan - Codex Game DB (DBMS PBL)

Deadline: **Wednesday 14 Oct**. Today: Tuesday 13 Oct. Two people (A and B), free AI plans only.

## 0. What is already done for you (tested)
The starter pack (`game-db-project.zip`) already contains a working PostgreSQL schema, seed data (87 characters, 61 weapons, 15 artifact sets), views / function / procedure / triggers / indexes, the Flask backend (all endpoints), 8 passing tests, the ER diagram (Mermaid + PNG), README, and all docs. The front-end shell (router, helpers, CSS) is done and tested in a browser.

**What is left = the 10 page files in `app/static/js/views/`, Neon + GitHub setup, screenshots, slides, rehearsal.**

---

## 1. Folder structure, file by file

```
game-db-project/                     <- open THIS folder in VS Code (File > Open Folder)
├── README.md                        Project page for the teacher. B: fill names + roll numbers, add screenshots.
├── app.py                           The whole backend (Flask). Do not edit unless fixing a bug (A).
├── requirements.txt                 Python packages. requirements-dev.txt = pytest.
├── .env.example                     TEMPLATE with placeholders. Safe to commit.
├── .env                             YOU create it (copy of .env.example + your Neon URL). Never committed.
├── .gitignore                       Keeps .env, venv, caches out of Git.
├── start_server.bat / start_server.sh   Optional launchers (Windows / Linux).
├── .gitattributes                   Keeps line endings consistent between Linux and Windows.
├── sql/
│   ├── 01_schema_pg.sql             Creates the 10 tables (drops old ones first: DEV ONLY).
│   ├── 02_seed_data.sql             Characters, weapons, artifacts, tiers, builds, teams.
│   ├── 03_seed_extra.sql            Extra builds, JSONB profiles, SAMPLE damage logs.
│   ├── 04_advanced_pg.sql           Views, function, procedure, triggers, indexes.
│   ├── 05_queries.sql               16 demo queries for the viva (paste into Neon SQL Editor).
│   └── legacy_mysql/                Your original MySQL schema (kept for reference).
├── scripts/run_sql.py               Runs .sql files against the database in .env.
├── tests/test_api.py                8 pytest tests.
├── .github/workflows/ci.yml         GitHub runs the tests on every push (free).
├── docs/
│   ├── problem_statement.md         Rubric 1.
│   ├── er_diagram.md / .png         ER diagram (renders on GitHub) - rubric 2.
│   ├── normalization.md             1NF -> BCNF write-up - rubric 2.
│   ├── sdg_mapping.md               SDG 9 + SDG 4 - rubric 4.
│   ├── cloud_deployment.md          Neon steps - bonus B2.
│   ├── viva_qa.md                   Likely viva questions with answers.
│   ├── screenshots/                 B adds PNGs here.
│   └── team/                        context.md (give to AIs) and this plan.
├── presentation/                    B puts the slides (.pptx/.pdf) here.
└── app/static/                      THE WEBSITE (served at http://127.0.0.1:5000/)
    ├── index.html                   Page shell: sidebar + #view + drawer + modal + toasts.
    ├── css/base.css                 Colours, fonts, resets.
    ├── css/layout.css               Sidebar, drawer, modal, toasts, mobile layout.
    ├── css/components.css           Buttons, forms, cards, tables, skeletons.
    └── js/
        ├── main.js                  Router + boot (done).
        ├── api.js                   fetch wrapper + graph URL helper (done).
        ├── ui.js                    el(), toast, modal, drawer, table, CSV (done).
        ├── theme.js                 Element/tier colours, rarity diamonds (done).
        └── views/                   <- YOUR 10 NEW FILES GO HERE (one per page)
            dashboard.js damageLab.js sqlExplorer.js compare.js     (A)
            characters.js weapons.js artifacts.js tiers.js builds.js search.js   (B)
```

**Rule that avoids merge conflicts:** A edits only `app.py`, `sql/`, `scripts/`, `tests/`, `.github/`, and the four A views. B edits only `README.md`, `docs/`, `presentation/`, `index.html`, `css/`, and the six B views. If you need a change in the other person's file, message them.

---

## 2. Setup in VS Code (both, ~30 min)

**A uses Pop!_OS (Linux). B uses Windows.** The project runs on both: use the command for your own system below. Use the VS Code integrated terminal (**Terminal > New Terminal**).

**Install once**
| | A: Pop!_OS | B: Windows |
|---|---|---|
| Python 3.10+ | `sudo apt update && sudo apt install -y python3 python3-venv python3-pip git` | python.org installer, tick **Add Python to PATH** |
| VS Code | Pop!_Shop or the .deb from code.visualstudio.com | code.visualstudio.com |
| Extensions | Python, GitLens, SQLTools (optional), Markdown Preview Mermaid Support (optional) | same |

### A (Pop!_OS): does this first, then B follows
1. Unzip `game-db-project.zip` (e.g. `unzip game-db-project.zip -d ~/`), then in VS Code **File > Open Folder** > `game-db-project`.
2. In the terminal:
   ```
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt -r requirements-dev.txt
   ```
   Your prompt should start with `(venv)`. If VS Code asks to use the venv interpreter, click Yes. (If `python3 -m venv` fails, install `python3-venv` as above.)
3. **Neon:** sign up at neon.com, create a project, click **Connect**, copy the connection string.
4. Create the settings file: `cp .env.example .env`, open `.env` in VS Code and paste the string after `DATABASE_URL=`. (Backup plan if Neon fails: `sudo apt install postgresql`, create a database, and use `postgresql://postgres:PASSWORD@localhost:5432/gamedb`.)
5. Load the database:
   ```
   python scripts/run_sql.py sql/01_schema_pg.sql sql/02_seed_data.sql sql/03_seed_extra.sql sql/04_advanced_pg.sql
   ```
   Expect `OK` four times.
6. `python app.py`, then open http://127.0.0.1:5000/api/health: it must say `"database": "connected"`. The site shows the nav and "not added yet" messages: correct until pages exist. (Or run `./start_server.sh` next time; first `chmod +x start_server.sh`.)
7. `pytest -q` should print `8 passed`.
8. **Create the repo:** Source Control (Ctrl+Shift+G) > **Initialize Repository** > message `Initial project: schema, backend, docs` > **Commit** > **Publish Branch** > **Public**, name it e.g. `game-companion-dbms`. Check that `.env` is NOT in the commit list. If VS Code asks you to sign in to GitHub, allow it. Set your identity first if needed:
   ```
   git config --global user.name "Your Name"
   git config --global user.email "your-github-email@example.com"
   ```
9. On github.com: repo > **Settings > Collaborators > Add people** > B's username.
10. Send B the repo URL and the Neon connection string privately (never in the repo). Or B can create their own free Neon project and run step 5 there.

### B (Windows)
1. `git clone <repo url>` in the terminal (or Ctrl+Shift+P > *Git: Clone*), then **File > Open Folder**.
2. In the VS Code terminal (PowerShell):
   ```
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt -r requirements-dev.txt
   ```
   If activation is blocked: `Set-ExecutionPolicy -Scope Process Bypass`, then activate again. If `python` is not found, try `py -m venv venv`.
3. `Copy-Item .env.example .env`, open `.env` and paste the Neon connection string (from A, or your own project) after `DATABASE_URL=`.
4. Load the database ONLY if you use your own Neon project (if you share A's database it is already loaded, so skip this):
   ```
   python scripts/run_sql.py sql/01_schema_pg.sql sql/02_seed_data.sql sql/03_seed_extra.sql sql/04_advanced_pg.sql
   ```
   WARNING: `01_schema_pg.sql` drops and recreates all tables. Never run it on the shared database during the demo.
5. `python app.py` (or double-click `start_server.bat`), then open http://127.0.0.1:5000/api/health.
6. Set your Git identity so commits show under YOUR GitHub account:
   ```
   git config --global user.name "Your Name"
   git config --global user.email "your-github-email@example.com"
   ```

**Cross-platform notes:** `.env` is never shared: each person has their own copy. Line endings are handled by `.gitattributes`, so you won't get fake "whole file changed" diffs between Linux and Windows. Folder paths in this plan use `/`; Windows accepts both in VS Code and Git. Use the same Neon database for the demo only if both of you agree not to re-run `01_schema_pg.sql` on it.

---

## 3. Git workflow (rubric: commits from BOTH)
```
git checkout -b feature/dashboard        # one branch per page / topic
# ...create or edit files...
git add .
git status                               # make sure .env is NOT listed
git commit -m "Add dashboard page with charts"
git push -u origin feature/dashboard
```
Then on GitHub click **Compare & pull request > Merge** (or `git checkout main; git pull; git merge feature/dashboard; git push`). Commit after every finished page, 8 or more commits each, with meaningful messages. Never `git add .env`.

---

## 4. How to get a page written (the AI loop)
For **every** page, in a **new** chat:
1. Paste all of `docs/team/context.md`.
2. Attach/paste `app/static/js/ui.js`, `api.js`, `theme.js`, and (after you have one) a finished view as a style example. **Always attach a finished view once one exists** so every AI matches the same code style (context.md rule 9).
3. Send this task prompt (change the page name and number):
   ```
   TASK: Write the full file app/static/js/views/<NAME>.js for page <N> of section 7 of the context.
   Follow the contract in sections 6-7 exactly (render(root, ctx), ctx.api/ui/theme, no innerHTML with API data).
   Handle loading, empty data and errors. Output only the code, preceded by the file path.
   If you need new CSS, output it as a separate block I can paste at the end of app/static/css/components.css.
   ```
4. In VS Code: right-click the `views` folder > **New File** > `<NAME>.js` > paste the code. Paste any CSS block at the end of `components.css`.
5. Run `python app.py` (leave it running), open the page, press **F12 > Console**. If there is a red error, paste **the error + the file** back into the same chat: "Fix this, output only the changed function."
6. Commit.

**Which AI for what (token budgets):**
| Tool | Use for | Avoid |
|---|---|---|
| **Gemini Pro** (large) | Big pages (`characters.js`, `damageLab.js`, `sqlExplorer.js`, `dashboard.js`), CSS polish, long outputs | - |
| **ChatGPT free** (limited, resets on a timer) | Smaller pages (`weapons.js`, `artifacts.js`, `search.js`, `compare.js`), slide wording, viva quiz, a second opinion on an error | Long files if it drops to a smaller model |
| **Codex free** (small) | Fixing a single function, tiny CSS tweaks, writing one test | Whole files |
| **Claude free** (very small, ~5 msgs) | The ONE hardest bug, and a final review of one view | Anything the others can do |
| **Copilot (GitHub Student Pack, if activated)** | Inline autocomplete and quick fixes in VS Code | - |
| **NotebookLM / Gemini / ChatGPT** | Paste `docs/viva_qa.md`, ask it to quiz you | - |

Rules for several AIs: always paste `context.md` first; one task per chat; never let two AIs write the same file (styles clash); if one tool hits its limit, move the next page to another tool and attach a finished view as a style example. If an AI gets stuck on an error, paste the same error and file into a different AI before spending Claude messages.

---

## 5. Division of work

### Person A: cloud, repo, data-heavy pages (about 4 AI chats)
| Order | Task | Output file | Tool |
|---|---|---|---|
| 1 | Setup steps above, push repo, add B | - | VS Code |
| 2 | Dashboard (page 1) | `views/dashboard.js` | Gemini |
| 3 | Damage Lab (page 7) | `views/damageLab.js` | Gemini |
| 4 | SQL Explorer (page 9) - the demo page | `views/sqlExplorer.js` | Gemini |
| 5 | Compare (page 8) | `views/compare.js` | ChatGPT |
| 6 | Merge B's branches, fresh-clone test, `pytest` | - | VS Code |
| 7 | Rehearse the SQL part of the demo with `sql/05_queries.sql` in the Neon SQL Editor | - | Neon |
| 8 | Optional: deploy on Render (see `docs/cloud_deployment.md`) | - | - |

### Person B: core pages, docs, slides (about 7 AI chats)
| Order | Task | Output file | Tool |
|---|---|---|---|
| 1 | Clone, setup, run | - | VS Code |
| 2 | Characters (page 2, the biggest) | `views/characters.js` | Gemini |
| 3 | Weapons (page 3) | `views/weapons.js` | ChatGPT |
| 4 | Artifacts (page 4) | `views/artifacts.js` | ChatGPT |
| 5 | Tiers (page 5) | `views/tiers.js` | Gemini |
| 6 | Builds (page 6) | `views/builds.js` | Gemini |
| 7 | Search palette (page 10) | `views/search.js` | ChatGPT |
| 8 | CSS polish (optional) | `css/*.css` | Gemini |
| 9 | Fill names + roll numbers in README, screenshots into `docs/screenshots/`, link them in README | - | VS Code |
| 10 | Slides (outline below) | `presentation/` | ChatGPT (text) + Canva/Gamma |

Both: read `docs/viva_qa.md`, and be able to explain **every** table, the trigger, the procedure and one SQL query. In the viva you may be asked about any part.

---

## 6. Slide outline (8-9 slides)
1. Title, team, course
2. Problem statement and objectives
3. Why a database (DBMS concepts table from `docs/problem_statement.md`)
4. Tech stack (frontend / backend / database)
5. ER diagram (use `docs/er_diagram.png`, all 10 tables)
6. Normalisation and constraints (1NF to BCNF, CHECK, CASCADE vs RESTRICT)
7. Advanced SQL: views, function, procedure, triggers, indexes, JSONB
8. Cloud + Git: Neon, commits from both members, CI
9. SDG mapping (SDG 9 primary, SDG 4 secondary) + limitations/future work
Then the **live demo**.

## 7. Demo script (7 minutes, rehearse twice)
1. Dashboard: counts and charts.
2. Characters: filter Pyro, open Hu Tao's drawer (tiers, build, team, JSONB profile).
3. Tier board: Combat vs Exploration.
4. Damage Lab: pick Ganyu > log a value > graphs update > best-build badge.
5. SQL Explorer: a view, the best-build function, JSONB filter for Liyue, "try negative value" (trigger rejects), audit log.
6. Neon console in the browser: show the tables and the cloud database.
7. GitHub: README, commits from both, ER diagram.
Have screenshots ready as backup in case the internet fails.

## 8. Rubric evidence checklist
| Rubric | Where the evidence is |
|---|---|
| 1 Problem (8) | `docs/problem_statement.md`, slides 2-3, README |
| 2 Design + implementation (14) | ER diagram, `normalization.md`, `sql/01-05`, working UI, tests |
| 3 Git (4) | Public repo, README, folders, commits from BOTH (check the Insights > Contributors page) |
| 4 Presentation + SDG (8) | Slides, live demo, `sdg_mapping.md`, `viva_qa.md` |
| B1 PostgreSQL (2) | JSONB profiles + GIN index, function, procedure, triggers |
| B2 Cloud (2) | Neon, `cloud_deployment.md`, no credentials in the repo |

## 9. Final checklist (Wednesday morning, finish 2 hours before the deadline)
- [ ] Repo is **Public** (open the link in a private/incognito window)
- [ ] README has both names and roll numbers, no `<placeholders>` left
- [ ] `git log -p -- .env` prints nothing; `.env` is not on GitHub
- [ ] The old MySQL password from the earlier `env.example` is not in the repo; if you used it anywhere else, change it
- [ ] Fresh clone to a new folder works with the README steps
- [ ] `pytest -q` passes; every page opens without console errors
- [ ] Both members have commits; screenshots and slides are in the repo
- [ ] Neon database is awake (open the app once before the demo)

## 10. Free extras if time remains
Render free web hosting (see cloud doc), GitHub Actions (already added), dbdiagram.io (alternative ER), Canva/Gamma for slides, Thunder Client extension to test the API, Faker for more seed data.

## 11. If something breaks
| Problem | Fix |
|---|---|
| `DATABASE_URL is not set` | `.env` missing or in the wrong folder (must be next to `app.py`) |
| `could not connect` / timeout | Neon asleep: wait 10 s and retry; check `?sslmode=require` is in the URL |
| `ModuleNotFoundError` | venv not active: Windows `venv\Scripts\activate`, Linux `source venv/bin/activate`, then `pip install -r requirements.txt` |
| Page says "not added yet" | The view file is missing or misnamed (must match exactly, e.g. `damageLab.js`) |
| Blank page + red console error | Paste the error and the file into the AI chat |
| `psycopg2` install fails | `pip install --upgrade pip`, then `pip install psycopg2-binary` (Pop!_OS: also fine without system libs, the binary wheel bundles them) |
| Pop!_OS: `venv` or `pip` not found | `sudo apt install python3-venv python3-pip` |
| Windows: `python` not found | Reinstall Python with **Add to PATH**, or use `py` instead of `python` |
