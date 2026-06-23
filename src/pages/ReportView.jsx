import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { generateReport } from '../lib/reportGenerator'
import defaultTemplate from '../lib/defaultReportTemplate.json'

function humanize(key) {
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ReportView() {
  const { id } = useParams()
  const [report, setReport] = useState(null)
  const [conclusionNotes, setConclusionNotes] = useState('')

  async function build() {
    const { data: assessment } = await supabase.from('assessments').select('*').eq('id', id).single()
    const { data: items } = await supabase.from('racm_items').select('*').eq('assessment_id', id).order('ref')
    const result = generateReport(defaultTemplate, { assessment, items: items || [], conclusionNotes })
    setReport(result)

    // Optional audit trail: store the generated snapshot
    await supabase.from('reports').insert({
      assessment_id: id,
      report_data: result
    })
  }

  useEffect(() => { build() }, [id])

  if (!report) return <div className="app-shell">Building report…</div>

  return (
    <div className="app-shell">
      <div className="no-print" style={{ marginBottom: 16 }}>
        <Link to={`/assessments/${id}`}>&larr; Back to assessment</Link>
        <button className="btn" style={{ marginLeft: 16 }} onClick={() => window.print()}>Save as PDF</button>
      </div>

      {report.sections.map((section, idx) => {
        if (section.type === 'cover') {
          return (
            <div key={idx} className="card">
              <h1>{section.title}</h1>
              {section.fields.map(f => <p key={f.label}><strong>{f.label}:</strong> {String(f.value)}</p>)}
            </div>
          )
        }
        if (section.type === 'summary') {
          return (
            <div key={idx} className="card">
              <h2>{section.heading}</h2>
              {section.metrics.map(m => <p key={m.label}>{m.label}: <strong>{m.value}</strong></p>)}
            </div>
          )
        }
        if (section.type === 'table') {
          return (
            <div key={idx} className="card">
              <h2>{section.heading}</h2>
              <div className="report-item-list">
                {section.rows.map((row, r) => {
                  const fields = section.columns.map((col, c) => ({ key: col, label: humanize(col), value: row[c] }))
                  const get = key => fields.find(f => f.key === key)?.value
                  const detailFields = fields.filter(f => !['ref', 'risk_title', 'overall_conclusion'].includes(f.key))
                  return (
                    <div key={r} className="report-item-card">
                      <div className="report-item-header">
                        <strong>{get('ref')}</strong> — {get('risk_title')}
                        {get('overall_conclusion') && (
                          <span className={`badge ${get('overall_conclusion')}`} style={{ marginLeft: 10 }}>
                            {String(get('overall_conclusion')).replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {detailFields.map(f => (
                        <p key={f.key} style={{ margin: '4px 0' }}>
                          <strong>{f.label}:</strong> {String(f.value ?? '\u2014')}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }
        if (section.type === 'narrative') {
          return (
            <div key={idx} className="card no-print">
              <h2>{section.heading}</h2>
              <textarea
                rows={4}
                placeholder="Add conclusion notes, then regenerate"
                value={conclusionNotes}
                onChange={e => setConclusionNotes(e.target.value)}
              />
              <button className="btn secondary" onClick={build}>Regenerate with notes</button>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
