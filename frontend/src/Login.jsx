import { useState } from 'react'
import { Mail, Lock, KeyRound, ArrowRight, Loader2, Check } from 'lucide-react'
import './Auth.css'
import {
  AuthShell,
  AuthField,
  PasswordToggle,
  AuthAlert,
  PasswordStrength,
  StepDots,
  SocialLogin
} from './AuthParts.jsx'

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

  const confirmMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <AuthShell mode="login" onSwitchToRegister={switchToRegister}>
      {!showForgotPassword ? (
        <>
          <h2 className="au-card-title">Welcome Back</h2>
          <p className="au-card-sub">Login to your CodeShield account</p>

          {error && <AuthAlert kind="error">{error}</AuthAlert>}

          <form onSubmit={handleLogin}>
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

            <AuthField
              icon={Lock}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
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

            <div className="au-row">
              <label className="au-check">
                <input type="checkbox" />
                <span className="au-check-box">
                  <Check size={12} strokeWidth={3} />
                </span>
                Remember me
              </label>

              <a
                href="#forgot-password"
                className="au-link"
                onClick={openForgotPassword}
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className="au-btn au-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="au-spin" /> Logging in...
                </>
              ) : (
                <>
                  Login <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <SocialLogin
            onGoogle={handleGoogleLogin}
            onGithub={handleGithubLogin}
          />

          <div className="au-switch">
            Don't have an account?{' '}
            <button
              type="button"
              className="au-switch-link"
              onClick={switchToRegister}
            >
              Register here
            </button>
          </div>
        </>
      ) : (
        <>
          {resetStep < 4 && <StepDots step={resetStep} />}

          <h2 className="au-card-title">
            {resetStep === 1 && 'Forgot Password?'}
            {resetStep === 2 && 'Verify OTP'}
            {resetStep === 3 && 'Create New Password'}
            {resetStep === 4 && 'Password Updated'}
          </h2>

          <p className="au-card-sub">
            {resetStep === 1 && 'Enter your registered email to receive an OTP'}
            {resetStep === 2 && `Enter the 6-digit OTP sent to ${resetEmail}`}
            {resetStep === 3 && 'Choose a strong password for your account'}
            {resetStep === 4 && 'Your account password has been changed'}
          </p>

          {error && <AuthAlert kind="error">{error}</AuthAlert>}

          {resetMessage && <AuthAlert kind="success">{resetMessage}</AuthAlert>}

          {resetStep === 1 && (
            <form onSubmit={handleForgotPassword}>
              <AuthField
                icon={Mail}
                type="email"
                placeholder="Registered email address"
                aria-label="Registered email address"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />

              <button
                type="submit"
                className="au-btn au-btn-primary"
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <>
                    <Loader2 size={17} className="au-spin" /> Sending OTP...
                  </>
                ) : (
                  <>
                    Send OTP <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {resetStep === 2 && (
            <form onSubmit={handleVerifyOtp}>
              <AuthField
                icon={KeyRound}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit OTP"
                aria-label="6-digit OTP"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                }}
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />

              <button
                type="submit"
                className="au-btn au-btn-primary"
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <>
                    <Loader2 size={17} className="au-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    Verify OTP <ArrowRight size={17} />
                  </>
                )}
              </button>

              <button
                type="button"
                className="au-btn au-btn-ghost"
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
              <AuthField
                icon={Lock}
                type="password"
                placeholder="New password (minimum 8 characters)"
                aria-label="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />

              <PasswordStrength password={newPassword} />

              <AuthField
                icon={Lock}
                type="password"
                placeholder="Confirm new password"
                aria-label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                invalid={confirmMismatch}
                required
              />

              {confirmMismatch && (
                <p className="au-hint bad">Passwords do not match</p>
              )}

              <button
                type="submit"
                className="au-btn au-btn-primary"
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <>
                    <Loader2 size={17} className="au-spin" /> Updating password...
                  </>
                ) : (
                  <>
                    Reset Password <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {resetStep === 4 && (
            <button
              type="button"
              className="au-btn au-btn-primary"
              onClick={backToLogin}
            >
              Back to Login <ArrowRight size={17} />
            </button>
          )}

          {resetStep !== 4 && (
            <div className="au-switch">
              Remembered your password?{' '}
              <button
                type="button"
                className="au-switch-link"
                onClick={backToLogin}
              >
                Back to Login
              </button>
            </div>
          )}
        </>
      )}
    </AuthShell>
  )
}

export default Login
