
import { useState } from 'react'
import './Auth.css'

const API_BASE = 'http://localhost:5000'

function Login({ onLoginSuccess, switchToRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetStep, setResetStep] = useState(1)
  const [resetEmail, setResetEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // =====================================================
  // NORMAL LOGIN
  // =====================================================

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      localStorage.setItem('codeshield_token', data.token)
      localStorage.setItem('codeshield_role', data.role)

      onLoginSuccess(data.token, data.role)
    } catch (err) {
      console.error(err)
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // GOOGLE LOGIN
  // =====================================================

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`
  }

  // =====================================================
  // GITHUB LOGIN
  // =====================================================

  const handleGithubLogin = () => {
    window.location.href = `${API_BASE}/auth/github`
  }

  // =====================================================
  // OPEN FORGOT PASSWORD
  // =====================================================

  const openForgotPassword = (e) => {
    e.preventDefault()
    setResetEmail(email)
    setResetStep(1)
    setOtp('')
    setResetToken('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setResetMessage('')
    setShowForgotPassword(true)
  }

  const backToLogin = () => {
    setShowForgotPassword(false)
    setResetStep(1)
    setError('')
    setResetMessage('')
    setOtp('')
    setResetToken('')
    setNewPassword('')
    setConfirmPassword('')
  }

  // =====================================================
  // STEP 1: SEND OTP
  // =====================================================

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setResetMessage('')
    setResetLoading(true)

    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Could not send OTP')
        return
      }

      
      setResetMessage(
        'If your account exists, an OTP has been sent. Check your inbox and spam folder.'
      )
      setResetStep(2)
    } catch (err) {
      console.error(err)
      setError('Could not reach the server')
    } finally {
      setResetLoading(false)
    }
  }

  // =====================================================
  // STEP 2: VERIFY OTP
  // =====================================================

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setResetMessage('')

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter a valid 6-digit OTP')
      return
    }

    setResetLoading(true)

    try {
      const res = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          otp: otp.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'OTP verification failed')
        return
      }

      if (!data.reset_token) {
        setError('Reset token was not received. Please try again.')
        return
      }

      setResetToken(data.reset_token)
      setResetMessage('OTP verified successfully.')
      setResetStep(3)
    } catch (err) {
      console.error(err)
      setError('Could not reach the server')
    } finally {
      setResetLoading(false)
    }
  }

  // =====================================================
  // STEP 3: RESET PASSWORD
  // =====================================================

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setResetMessage('')

    if (newPassword.length < 8) {
      setError('Password must contain at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setResetLoading(true)

    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          reset_token: resetToken,
          new_password: newPassword
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Password reset failed')
        return
      }

      setResetMessage(
        'Password reset successfully. You can now log in.'
      )
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setOtp('')
      setResetToken('')
      setResetStep(4)
    } catch (err) {
      console.error(err)
      setError('Could not reach the server')
    } finally {
      setResetLoading(false)
    }
  }

  // =====================================================
  // LEFT SIDE + RIGHT AUTH CARD
  // =====================================================

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="logo">
          <div className="logo-shield">◆</div>
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
            Code.
            <br />
            Compile.
            <br />
            Compete.
            <br />
            <span>Confidently.</span>
          </h1>

          <p>
            A secure platform for coding assessments,
            built for learners and educators.
          </p>

          <div className="features">
            <div className="feature">
              <div className="feature-icon">🛡</div>
              <div>
                <strong>Safe &amp; Secure</strong>
                <small>Sandboxed code execution</small>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">▥</div>
              <div>
                <strong>Practice &amp; Improve</strong>
                <small>Track your coding progress</small>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">👥</div>
              <div>
                <strong>Built for Everyone</strong>
                <small>Students, teachers &amp; institutes</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          {!showForgotPassword ? (
            <>
              <h2>Welcome Back</h2>
              <div className="auth-card-subtitle">
                Login to your CodeShield account
              </div>

              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div className="input-group">
                  <span className="input-icon">✉</span>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <span className="input-icon">🔒</span>
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
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>

                <div className="login-options">
                  <label>
                    <input type="checkbox" />
                    {' '}Remember me
                  </label>

                  <a href="#forgot-password" onClick={openForgotPassword}>
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={loading}
                >
                  {loading ? 'Logging in...' : 'Login →'}
                </button>
              </form>

              <div className="oauth-divider">
                <span></span>
                <p>OR</p>
                <span></span>
              </div>

              <button
                type="button"
                className="oauth-btn google-btn"
                onClick={handleGoogleLogin}
              >
                <svg
                  className="oauth-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M21.35 12.27c0-.73-.07-1.43-.2-2.1H12v3.98h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.27z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.75z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.54 13.84a5.87 5.87 0 0 1 0-3.68V7.63H3.3a9.75 9.75 0 0 0 0 8.74l3.24-2.53z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 6.13c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.2 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.7 5.38l3.24 2.53C7.31 7.85 9.46 6.13 12 6.13z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                className="oauth-btn github-btn"
                onClick={handleGithubLogin}
              >
                <svg
                  className="oauth-icon github-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.26c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23A11.5 11.5 0 0 1 12 6.58c1.02 0 2.05.14 3.01.42 2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z"
                  />
                </svg>
                <span>Continue with GitHub</span>
              </button>

              <div className="auth-switch">
                Don't have an account?{' '}
                <span onClick={switchToRegister} role="button" tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') switchToRegister()
                  }}
                >
                  Register here
                </span>
              </div>
            </>
          ) : (
            <>
              <h2>
                {resetStep === 1 && 'Forgot Password?'}
                {resetStep === 2 && 'Verify OTP'}
                {resetStep === 3 && 'Create New Password'}
                {resetStep === 4 && 'Password Updated'}
              </h2>

              <div className="auth-card-subtitle">
                {resetStep === 1 && 'Enter your registered email to receive an OTP'}
                {resetStep === 2 && `Enter the 6-digit OTP sent to ${resetEmail}`}
                {resetStep === 3 && 'Choose a strong password for your account'}
                {resetStep === 4 && 'Your account password has been changed'}
              </div>

              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}

              {resetMessage && (
                <div className="success-message" role="status">
                  {resetMessage}
                </div>
              )}

              {resetStep === 1 && (
                <form onSubmit={handleForgotPassword}>
                  <div className="input-group">
                    <span className="input-icon">✉</span>
                    <input
                      type="email"
                      placeholder="Registered email address"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Sending OTP...' : 'Send OTP →'}
                  </button>
                </form>
              )}

              {resetStep === 2 && (
                <form onSubmit={handleVerifyOtp}>
                  <div className="input-group">
                    <span className="input-icon">🔐</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }}
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Verifying...' : 'Verify OTP →'}
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={resetLoading}
                    onClick={() => {
                      setError('')
                      setResetMessage('')
                      setResetStep(1)
                    }}
                  >
                    Change email
                  </button>
                </form>
              )}

              {resetStep === 3 && (
                <form onSubmit={handleResetPassword}>
                  <div className="input-group">
                    <span className="input-icon">🔒</span>
                    <input
                      type="password"
                      placeholder="New password (minimum 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <span className="input-icon">🔒</span>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Updating password...' : 'Reset Password →'}
                  </button>
                </form>
              )}

              {resetStep === 4 && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={backToLogin}
                >
                  Back to Login →
                </button>
              )}

              {resetStep !== 4 && (
                <div className="auth-switch">
                  Remembered your password?{' '}
                  <span onClick={backToLogin} role="button" tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') backToLogin()
                    }}
                  >
                    Back to Login
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
