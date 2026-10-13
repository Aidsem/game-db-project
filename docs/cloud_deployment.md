# Cloud Deployment (Neon PostgreSQL)

The database is hosted on **Neon** (managed serverless PostgreSQL). Free-tier limits change, so check neon.com for current terms.

## Create the database
1. Sign up at neon.com with GitHub or email and create a project (any name; pick the region closest to you).
2. On the project dashboard click **Connect** and copy the connection string. It looks like
   `postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require`
3. Put it in your local `.env` as `DATABASE_URL=...` (the file is git-ignored; **never commit it**).

## Load the schema and data
```
python scripts/run_sql.py sql/01_schema_pg.sql sql/02_seed_data.sql sql/03_seed_extra.sql sql/04_advanced_pg.sql
```
Then open `/api/health`: it should return `"database": "connected"` and the PostgreSQL version. The Neon **SQL Editor** (browser) can run `sql/05_queries.sql` for the demo.

## Notes
* Neon suspends idle databases; the first request after a pause can take a few seconds. The app uses `pool_pre_ping` so connections recover.
* Credentials appear only in `.env` (ignored by Git) and in host environment variables. Rotate the password in Neon if it was ever committed.

## Optional: host the web app too (Render)
1. Push the repo to GitHub. On render.com create a **Web Service** from the repo.
2. Build command `pip install -r requirements.txt`; start command `gunicorn app:app` (add `gunicorn` to requirements.txt first).
3. Add environment variables `DATABASE_URL` and `SECRET_KEY` in Render's dashboard.
Free instances sleep when idle, so open the URL a few minutes before a demo. This step is optional: the rubric asks for the **database** to be in the cloud.
