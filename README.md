# RACM ITGC — digital risk & control matrix

A multi-tenant web app for running ITGC (IT General Controls) risk and control
assessments: a shared risk library, per-user assessments, an editable RACM
matrix, and JSON-template-driven report generation. Built to run entirely on
free tiers: **Netlify** (static hosting) + **Supabase** (auth + Postgres).

## Stack

- React + Vite (frontend, JSX)
- Supabase (Auth + Postgres + Row Level Security)
- Client-side report generation: JSON template + DB data → HTML → "Save as PDF"
  via the browser's print dialog (no serverless function calls, so it stays
  inside Netlify's free request limits)

## 1. Set up Supabase

1. Create a free project at https://supabase.com.
2. Open the SQL editor and run `supabase/schema.sql`. This creates all tables
   and the Row Level Security policies that give every user a private
   dashboard — a user can only ever see assessments where `owner_id = auth.uid()`.
3. Copy your project's URL and anon key (Project settings → API).

## 2. Seed the risk library with your RACM data

`supabase/seed/racm.json` already contains your real 52-control ITGC RACM
(governance, network security, access management x3, change management,
business continuity, physical security).

Import it into `risk_library`:

```
# Get your service role key from Supabase: Project settings -> API -> service_role
cat > .env.import << 'EOF'
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF

node --env-file=.env.import scripts/import_risk_library.mjs
```

This upserts by `ref`, so it's safe to re-run after editing `racm.json` —
existing rows get updated, not duplicated. The service role key bypasses
Row Level Security, which is why this runs as a standalone script rather
than from the browser (that key must never reach the frontend bundle).

## 3. Configure environment variables

```
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 4. Run locally

```
npm install
npm run dev
```

## 5. Deploy to Netlify (free tier)

1. Push this repo to GitHub.
2. In Netlify: "Add new site" → "Import an existing project" → pick the repo.
   Build command and publish directory are already set in `netlify.toml`
   (`npm run build` → `dist`).
3. Add the same two environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) in Netlify's site settings → Environment variables.
4. Deploy. `netlify.toml` already includes the SPA redirect rule so client-side
   routing (`/assessments/:id`) works on refresh.

## How report generation works

`supabase/report_template.example.json` defines report structure as data —
cover section, summary metrics, a RACM table, and a narrative/conclusion
section. `src/lib/reportGenerator.js` walks that template and fills it with
live data pulled from `assessments` and `racm_items`. `src/pages/ReportView.jsx`
renders the populated report and lets the user trigger the browser's
"Save as PDF" via `window.print()` — so there's no PDF-generation library or
serverless function involved, keeping you on Netlify's free plan.

To change what a report looks like, edit the template JSON — no code changes
needed for new sections that follow the same `cover` / `summary` / `table` /
`narrative` shape.

## Data model

- `profiles` — one row per user (auto-created on signup)
- `risk_library` — shared master RACM reference data, imported from
  `racm.json` (group, ref, category, risk_title, risk_description,
  control_objective, control_description, design/operating effectiveness
  test procedures)
- `assessments` — one row per assessment engagement, owned by a user
- `racm_items` — the matrix rows for an assessment: the descriptive text
  copied in from `risk_library` at import time, plus the fields a reviewer
  fills in (control_owner, tested_by, design/operating effectiveness
  results, overall_conclusion, observations_noted, testing_workpapers)
- `report_templates` — JSON template definitions (extend beyond the example)
- `reports` — audit-trail snapshot of each generated report

## What's next

- Wire `report_templates` into the UI so users can pick/save templates
  instead of using only the default
- Add filtering/search on the RACM item table for large assessments
- Add a "duplicate assessment" action to reuse a RACM set period over period
