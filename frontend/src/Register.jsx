import { useState } from 'react'
import './Auth.css'

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

  return (

    <div className="auth-page">

      {/* LEFT SIDE */}

      <div className="auth-left">

        <div className="logo">

          <div className="logo-shield">
            ◆
          </div>

          <div>

            <div className="logo-text">
              Code<span>Shield</span>
            </div>

            <div className="logo-subtitle">
              Secure Code Evaluation System
            </div>

          </div>

        </div>


        <div className="top-nav">
          <span>Home</span>
          <span>About</span>
          <span>Contact</span>
        </div>


        <div className="hero">

          <h1>
            Join<br />
            Code<span>Shield</span>
          </h1>

          <p>
            Create your account and start your
            coding journey today.
          </p>


          <div className="features">

            <div className="feature">

              <div className="feature-icon">
                ⚡
              </div>

              <div>
                <strong>Solve Real Problems</strong>
                <small>Sharpen your coding skills</small>
              </div>

            </div>


            <div className="feature">

              <div className="feature-icon">
                ▥
              </div>

              <div>
                <strong>Track Your Progress</strong>
                <small>View detailed analytics</small>
              </div>

            </div>


            <div className="feature">

              <div className="feature-icon">
                👥
              </div>

              <div>
                <strong>Compete & Grow</strong>
                <small>Become a better developer</small>
              </div>

            </div>

          </div>

        </div>

      </div>


      {/* RIGHT SIDE */}

      <div className="auth-right">

        <div className="auth-card register-card">

          <h2>
            Create Account
          </h2>

          <div className="auth-card-subtitle">
            Fill in the details to get started
          </div>


          {error && (
            <div className="error-message">
              {error}
            </div>
          )}


          {message && (
            <div className="success-message">
              {message}
            </div>
          )}


          <form onSubmit={handleRegister}>

            {/* USERNAME */}

            <div className="input-group">

              <span className="input-icon">
                👤
              </span>

              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

            </div>


            {/* EMAIL */}

            <div className="input-group">

              <span className="input-icon">
                ✉
              </span>

              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

            </div>


            {/* PASSWORD */}

            <div className="input-group">

              <span className="input-icon">
                🔒
              </span>

              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="password-eye"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >
                {showPassword ? '🙈' : '👁'}
              </button>

            </div>


            {/* CONFIRM PASSWORD */}

            <div className="input-group">

              <span className="input-icon">
                🔒
              </span>

              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                required
              />

              <button
                type="button"
                className="password-eye"
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
              >
                {showConfirmPassword ? '🙈' : '👁'}
              </button>

            </div>


            {/* ROLE */}

            <div className="role-title">
              I am a
            </div>


            <div className="role-container">

              {/* STUDENT */}

              <div
                className={
                  role === 'student'
                    ? 'role-card active'
                    : 'role-card'
                }
                onClick={() => setRole('student')}
              >

                <strong>
                  🎓 Student
                </strong>

                <small>
                  Solve problems & learn
                </small>

              </div>


              {/* TEACHER */}

              <div
                className={
                  role === 'teacher'
                    ? 'role-card active'
                    : 'role-card'
                }
                onClick={() => setRole('teacher')}
              >

                <strong>
                  👨‍🏫 Teacher
                </strong>

                <small>
                  Create problems & manage
                </small>

              </div>

            </div>


            {/* REGISTER BUTTON */}

            <button
              type="submit"
              className="primary-btn register-btn"
              disabled={loading}
            >

              {loading
                ? 'Creating Account...'
                : 'Create Account →'}

            </button>

          </form>


          {/* LOGIN */}

          <div className="auth-switch">

            Already have an account?{' '}

            <span onClick={switchToLogin}>
              Login here
            </span>

          </div>

        </div>

      </div>

    </div>
  )
}

export default Register