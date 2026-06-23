// One-time import: loads supabase/seed/racm.json into the risk_library table.
// Run with: node --env-file=.env.import scripts/import_risk_library.mjs
//
// Uses the SERVICE ROLE key (full database access, bypasses RLS) — this is
// why it runs as a standalone script and never ships in the frontend bundle.
// Get the service role key from Supabase: Project settings -> API -> service_role.
//
// Safe to re-run: upserts by `ref`, so existing rows are updated, not duplicated.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Create a .env.import file (gitignored) with:')
  console.error('  SUPABASE_URL=https://YOUR-PROJECT.supabase.co')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  console.error('Then run: node --env-file=.env.import scripts/import_risk_library.mjs')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const raw = readFileSync(join(__dirname, '..', 'supabase', 'seed', 'racm.json'), 'utf-8')
const items = JSON.parse(raw)

console.log(`Loaded ${items.length} controls from racm.json`)

const rows = items.map(item => ({
  group: item.group,
  ref: item.ref,
  category: item.category,
  risk_title: item.risk_title,
  risk_description: item.risk_description,
  control_objective: item.control_objective,
  control_description: item.control_description,
  design_effectiveness_test_procedures: item.design_effectiveness_test_procedures,
  operating_effectiveness_test_procedures: item.operating_effectiveness_test_procedures
}))

const { data, error } = await supabase
  .from('risk_library')
  .upsert(rows, { onConflict: 'ref' })
  .select('ref')

if (error) {
  console.error('Import failed:', error.message)
  process.exit(1)
}

console.log(`Imported/updated ${data.length} rows into risk_library.`)
