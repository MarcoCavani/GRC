import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AssessmentDetail from './pages/AssessmentDetail.jsx'
import ReportView from './pages/ReportView.jsx'

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, signOut } = useAuth()

  return (
    <>
      {user && (
        <div className="topbar no-print">
          <Link to="/" style={{ fontWeight: 600, textDecoration: 'none' }}>RACM ITGC</Link>
          <div>
            <span style={{ marginRight: 12, fontSize: 14, color: '#555' }}>{user.email}</span>
            <button className="btn secondary" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/assessments/:id" element={<RequireAuth><AssessmentDetail /></RequireAuth>} />
        <Route path="/assessments/:id/report" element={<RequireAuth><ReportView /></RequireAuth>} />
      </Routes>
    </>
  )
}
