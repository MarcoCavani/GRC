import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const RESULT_OPTIONS = ['not_tested', 'effective', 'ineffective', 'not_applicable']
const CONCLUSION_OPTIONS = ['not_tested', 'effective', 'partially_effective', 'ineffective']

export default function AssessmentDetail() {
  const { id } = useParams()
  const [assessment, setAssessment] = useState(null)
  const [items, setItems] = useState([])
  const [library, setLibrary] = useState([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [importedRefs, setImportedRefs] = useState(new Set())
  const [expandedId, setExpandedId] = useState(null)

  async function load() {
    const { data: a } = await supabase.from('assessments').select('*').eq('id', id).single()
    setAssessment(a)
    const { data: i } = await supabase.from('racm_items').select('*').eq('assessment_id', id).order('ref')
    setItems(i || [])
    setImportedRefs(new Set((i || []).map(x => x.ref)))
  }

  useEffect(() => { load() }, [id])

  async function loadLibrary() {
    const { data } = await supabase.from('risk_library').select('*').order('ref')
    setLibrary(data || [])
    setShowLibrary(true)
  }

  async function importAll() {
    const toImport = library.filter(r => !importedRefs.has(r.ref))
    if (toImport.length === 0) return
    const rows = toImport.map(r => ({
      assessment_id: id,
      risk_library_id: r.id,
      group: r.group,
      ref: r.ref,
      category: r.category,
      risk_title: r.risk_title,
      risk_description: r.risk_description,
      control_objective: r.control_objective,
      control_description: r.control_description,
      design_effectiveness_test_procedures: r.design_effectiveness_test_procedures,
      operating_effectiveness_test_procedures: r.operating_effectiveness_test_procedures,
      design_effectiveness_result: 'not_tested',
      operating_effectiveness_result: 'not_tested',
      overall_conclusion: 'not_tested'
    }))
    await supabase.from('racm_items').insert(rows)
    setShowLibrary(false)
    load()
  }

  async function importOne(r) {
    await supabase.from('racm_items').insert({
      assessment_id: id,
      risk_library_id: r.id,
      group: r.group,
      ref: r.ref,
      category: r.category,
      risk_title: r.risk_title,
      risk_description: r.risk_description,
      control_objective: r.control_objective,
      control_description: r.control_description,
      design_effectiveness_test_procedures: r.design_effectiveness_test_procedures,
      operating_effectiveness_test_procedures: r.operating_effectiveness_test_procedures,
      design_effectiveness_result: 'not_tested',
      operating_effectiveness_result: 'not_tested',
      overall_conclusion: 'not_tested'
    })
    load()
  }

  async function updateItem(itemId, field, value) {
    setItems(items.map(it => it.id === itemId ? { ...it, [field]: value } : it))
    await supabase.from('racm_items').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', itemId)
  }

  async function deleteItem(itemId) {
    if (!confirm('Remove this control from the assessment?')) return
    await supabase.from('racm_items').delete().eq('id', itemId)
    load()
  }

  if (!assessment) return <div className="app-shell">Loading…</div>

  return (
    <div className="app-shell">
      <p><Link to="/">&larr; All assessments</Link></p>
      <h1>{assessment.title}</h1>
      <p style={{ color: '#666' }}>{assessment.period} &middot; {assessment.status} &middot; {items.length} controls</p>
      <p><Link to={`/assessments/${id}/report`} className="btn secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>Generate report</Link></p>

      <div className="card">
        <button className="btn secondary" onClick={loadLibrary}>+ Import controls from risk library</button>
        {showLibrary && (
          <>
            <div style={{ margin: '12px 0' }}>
              <button className="btn" onClick={importAll}>Import all not yet added ({library.filter(r => !importedRefs.has(r.ref)).length})</button>
            </div>
            <table>
              <thead><tr><th>Ref</th><th>Category</th><th>Risk title</th><th></th></tr></thead>
              <tbody>
                {library.map(r => (
                  <tr key={r.id}>
                    <td>{r.ref}</td>
                    <td>{r.category}</td>
                    <td>{r.risk_title}</td>
                    <td>
                      {importedRefs.has(r.ref)
                        ? <span style={{ color: '#888' }}>Added</span>
                        : <button className="btn" onClick={() => importOne(r)}>Add</button>}
                    </td>
                  </tr>
                ))}
                {library.length === 0 && <tr><td colSpan={4}>Risk library is empty — run the import script (see README).</td></tr>}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Ref</th><th>Category</th><th>Risk title</th><th>Design</th><th>Operating</th><th>Conclusion</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <Row
                key={it.id}
                item={it}
                expanded={expandedId === it.id}
                onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
                onUpdate={updateItem}
                onDelete={deleteItem}
              />
            ))}
            {items.length === 0 && <tr><td colSpan={7} style={{ color: '#888' }}>No controls yet — import from the risk library above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ item, expanded, onToggle, onUpdate, onDelete }) {
  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={onToggle}>
        <td>{item.ref}</td>
        <td>{item.category}</td>
        <td>{item.risk_title}</td>
        <td><span className={`badge ${item.design_effectiveness_result}`}>{item.design_effectiveness_result?.replace('_', ' ')}</span></td>
        <td><span className={`badge ${item.operating_effectiveness_result}`}>{item.operating_effectiveness_result?.replace('_', ' ')}</span></td>
        <td><span className={`badge ${item.overall_conclusion}`}>{item.overall_conclusion?.replace('_', ' ')}</span></td>
        <td>{expanded ? '\u25b2' : '\u25bc'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ background: '#fafaf7' }}>
            <div style={{ padding: 16 }}>
              <p><strong>Risk description</strong><br />{item.risk_description}</p>
              <p><strong>Control objective</strong><br />{item.control_objective}</p>
              <p><strong>Control description</strong><br />{item.control_description}</p>
              <p><strong>Design effectiveness test procedures</strong><br />{item.design_effectiveness_test_procedures}</p>
              <p><strong>Operating effectiveness test procedures</strong><br />{item.operating_effectiveness_test_procedures}</p>

              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e3e2dd' }} />
              <h4>Assessment results</h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#555' }}>Control owner</label>
                  <input defaultValue={item.control_owner || ''} onBlur={e => onUpdate(item.id, 'control_owner', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#555' }}>Tested by</label>
                  <input defaultValue={item.tested_by || ''} onBlur={e => onUpdate(item.id, 'tested_by', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#555' }}>Design effectiveness result</label>
                  <select defaultValue={item.design_effectiveness_result || 'not_tested'} onChange={e => onUpdate(item.id, 'design_effectiveness_result', e.target.value)}>
                    {RESULT_OPTIONS.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#555' }}>Operating effectiveness result</label>
                  <select defaultValue={item.operating_effectiveness_result || 'not_tested'} onChange={e => onUpdate(item.id, 'operating_effectiveness_result', e.target.value)}>
                    {RESULT_OPTIONS.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#555' }}>Overall conclusion</label>
                  <select defaultValue={item.overall_conclusion || 'not_tested'} onChange={e => onUpdate(item.id, 'overall_conclusion', e.target.value)}>
                    {CONCLUSION_OPTIONS.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#555' }}>Testing workpaper reference</label>
                  <input defaultValue={item.testing_workpapers || ''} placeholder="e.g. link or filename" onBlur={e => onUpdate(item.id, 'testing_workpapers', e.target.value)} />
                </div>
              </div>

              <label style={{ fontSize: 13, color: '#555' }}>Observations noted</label>
              <textarea rows={3} defaultValue={item.observations_noted || ''} onBlur={e => onUpdate(item.id, 'observations_noted', e.target.value)} />

              <button className="btn secondary" onClick={() => onDelete(item.id)} style={{ color: '#b42318' }}>Remove control</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
