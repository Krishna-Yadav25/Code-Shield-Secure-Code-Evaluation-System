import { useState } from 'react'
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  GraduationCap,
  Presentation
} from 'lucide-react'
import './Auth.css'
import {
  AuthShell,
  AuthField,
  PasswordToggle,
  AuthAlert,
  PasswordStrength
} from './AuthParts.jsx'

const API_BASE = 'http://localhost:5000'

function Register({ switchToLogin }) {

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('student')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e) => {

    e.preventDefault()

    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {

      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          email,
          password,
          role
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }

      setMessage('Account created! You can log in now.')

      setUsername('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')

    } catch (err) {

      setError('Could not reach the server')

    } finally {

      setLoading(false)

    }
  }

  const confirmMismatch =
    confirmPassword.length > 0 && password !== confirmPassword

  const confirmMatch =
    confirmPassword.length > 0 && password === confirmPassword

  return (
    <AuthShell mode="register" onSwitchToLogin={switchToLogin}>

      <h2 className="au-card-title">Create Account</h2>
      <p className="au-card-sub">Fill in the details to get started</p>

      {error && <AuthAlert kind="error">{error}</AuthAlert>}

      {message && <AuthAlert kind="success">{message}</AuthAlert>}

      <form onSubmit={handleRegister}>

        {/* USERNAME */}

        <AuthField
          icon={User}
          type="text"
          placeholder="Username"
          aria-label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        {/* EMAIL */}

        <AuthField
          icon={Mail}
          type="email"
          placeholder="Email address"
          aria-label="Email address"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* PASSWORD */}

        <AuthField
          icon={Lock}
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          aria-label="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          right={
            <PasswordToggle
              shown={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
            />
          }
        />

        <PasswordStrength password={password} />

        {/* CONFIRM PASSWORD */}

        <AuthField
          icon={Lock}
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Confirm Password"
          aria-label="Confirm Password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          invalid={confirmMismatch}
          required
          right={
            <PasswordToggle
              shown={showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          }
        />

        {confirmMismatch && (
          <p className="au-hint bad">Passwords do not match</p>
        )}

        {confirmMatch && (
          <p className="au-hint good">Passwords match</p>
        )}

        {/* ROLE */}

        <div className="au-role-title">I am a</div>

        <div className="au-roles">

          {/* STUDENT */}

          <button
            type="button"
            className={role === 'student' ? 'au-role active' : 'au-role'}
            aria-pressed={role === 'student'}
            onClick={() => setRole('student')}
          >
            <span className="au-role-ico">
              <GraduationCap size={19} />
            </span>
            <span>
              <strong>Student</strong>
              <small>Solve problems & learn</small>
            </span>
          </button>

          {/* TEACHER */}

          <button
            type="button"
            className={role === 'teacher' ? 'au-role active' : 'au-role'}
            aria-pressed={role === 'teacher'}
            onClick={() => setRole('teacher')}
          >
            <span className="au-role-ico">
              <Presentation size={19} />
            </span>
            <span>
              <strong>Teacher</strong>
              <small>Create problems & manage</small>
            </span>
          </button>

        </div>

        {/* REGISTER BUTTON */}

        <button
          type="submit"
          className="au-btn au-btn-primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={17} className="au-spin" /> Creating Account...
            </>
          ) : (
            <>
              Create Account <ArrowRight size={17} />
            </>
          )}
        </button>

      </form>

      {/* LOGIN */}

      <div className="au-switch">
        Already have an account?{' '}
        <button
          type="button"
          className="au-switch-link"
          onClick={switchToLogin}
        >
          Login here
        </button>
      </div>

    </AuthShell>
  )
}

export default Register


