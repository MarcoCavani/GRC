import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext.jsx'

export default function Dashboard() {
  const { user } = useAuth()
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState('')

  async function loadAssessments() {
    setLoading(true)
    // RLS automatically scopes this to the logged-in user's own rows
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setAssessments(data)
    setLoading(false)
  }

  useEffect(() => { loadAssessments() }, [])

  async function createAssessment(e) {
    e.preventDefault()
    const { error } = await supabase.from('assessments').insert({
      owner_id: user.id,
      title,
      period,
      status: 'in_progress'
    })
    if (!error) {
      setTitle('')
      setPeriod('')
      loadAssessments()
    }
  }

  async function deleteAssessment(id) {
    if (!confirm('Delete this assessment and all its RACM items?')) return
    await supabase.from('assessments').delete().eq('id', id)
    loadAssessments()
  }

  return (
    <div className="app-shell">
      <h1>Your assessments</h1>
      <p style={{ color: '#666' }}>Only visible to {user.email}, enforced by Supabase row-level security.</p>

      <div className="card">
        <h3>New assessment</h3>
        <form onSubmit={createAssessment} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input placeholder="Title, e.g. Q3 2026 ITGC review" value={title} onChange={e => setTitle(e.target.value)} required />
          <input placeholder="Period, e.g. Q3 2026" value={period} onChange={e => setPeriod(e.target.value)} style={{ maxWidth: 160 }} />
          <button className="btn" type="submit">Create</button>
        </form>
      </div>

      {loading ? <p>Loading…</p> : (
        <div className="card">
          <table>
            <thead>
              <tr><th>Title</th><th>Period</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {assessments.map(a => (
                <tr key={a.id}>
                  <td><Link to={`/assessments/${a.id}`}>{a.title}</Link></td>
                  <td>{a.period}</td>
                  <td>{a.status}</td>
                  <td>
                    <Link to={`/assessments/${a.id}/report`} style={{ marginRight: 10 }}>Report</Link>
                    <a href="#" onClick={() => deleteAssessment(a.id)} style={{ color: '#b42318' }}>Delete</a>
                  </td>
                </tr>
              ))}
              {assessments.length === 0 && (
                <tr><td colSpan={4} style={{ color: '#888' }}>No assessments yet — create your first one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
