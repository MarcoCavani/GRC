import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const { error } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName)

    if (error) setError(error.message)
    else navigate('/')
  }

  return (
    <div className="app-shell" style={{ maxWidth: 400, marginTop: 60 }}>
      <div className="card">
        <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          {error && <p style={{ color: '#b42318', fontSize: 13 }}>{error}</p>}
          <button className="btn" type="submit" style={{ width: '100%' }}>
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <p style={{ fontSize: 13, marginTop: 12 }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <a href="#" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </a>
        </p>
      </div>
    </div>
  )
}
