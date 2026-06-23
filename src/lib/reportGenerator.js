// Populates a JSON report template (see supabase/report_template.example.json)
// with real data pulled from an assessment + its RACM items.
// Keeps report logic out of components and out of the database —
// pure JS, runs entirely client-side (no serverless function needed).

function countWhere(items, expr) {
  // expr format: "field=value"
  const [field, value] = expr.split('=')
  return items.filter(i => i[field] === value).length
}

function resolveMetricSource(source, items) {
  if (source === 'racm_items.count') return items.length
  const match = source.match(/^racm_items\.count_where:(.+)$/)
  if (match) return countWhere(items, match[1])
  return null
}

export function generateReport(template, { assessment, items, conclusionNotes = '' }) {
  const generated_at = new Date().toISOString()

  const sections = template.sections.map(section => {
    switch (section.type) {
      case 'cover':
        return {
          type: 'cover',
          title: section.title.replace('{{assessment.title}}', assessment.title),
          fields: section.fields.map(f => ({
            label: f,
            value: f === 'generated_at' ? generated_at : assessment[f]
          }))
        }
      case 'summary':
        return {
          type: 'summary',
          heading: section.heading,
          metrics: section.metrics.map(m => ({
            label: m.label,
            value: resolveMetricSource(m.source, items)
          }))
        }
      case 'table':
        return {
          type: 'table',
          heading: section.heading,
          columns: section.columns,
          rows: items.map(item => section.columns.map(col => item[col] ?? ''))
        }
      case 'narrative':
        return {
          type: 'narrative',
          heading: section.heading,
          text: conclusionNotes || 'No conclusion notes provided.'
        }
      default:
        return section
    }
  })

  return {
    name: template.name,
    generated_at,
    sections
  }
}
