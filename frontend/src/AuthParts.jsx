import {
  Shield,
  ShieldCheck,
  BarChart3,
  Users,
  Zap,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Check,
  Eye,
  EyeOff
} from 'lucide-react'

/* =========================================================
   Login aur Register dono ke liye common hisse:
   AuthShell (nav + hero + live judge card + form column),
   AuthField, PasswordToggle, AuthAlert, PasswordStrength,
   StepDots, SocialLogin.
   Sirf UI hai: login / register / token / redirect ka logic
   Login.jsx aur Register.jsx mein waisa hi hai.
========================================================= */

const FEATURES = {
  login: [
    { icon: ShieldCheck, title: 'Safe & Secure', text: 'Sandboxed code execution' },
    { icon: BarChart3, title: 'Practice & Improve', text: 'Track your coding progress' },
    { icon: Users, title: 'Built for Everyone', text: 'Students, teachers & institutes' }
  ],
  register: [
    { icon: Zap, title: 'Solve Real Problems', text: 'Sharpen your coding skills' },
    { icon: BarChart3, title: 'Track Your Progress', text: 'View detailed analytics' },
    { icon: Trophy, title: 'Compete & Grow', text: 'Become a better developer' }
  ]
}

const JUDGE_TESTS = [
  { name: 'Test 1', tag: 'Sample', ms: 4 },
  { name: 'Test 2', tag: 'Sample', ms: 5 },
  { name: 'Test 3', tag: 'Hidden', ms: 6 },
  { name: 'Test 4', tag: 'Hidden', ms: 8 },
  { name: 'Test 5', tag: 'Hidden', ms: 12 }
]

/* ---------------------------------------------------------
   LIVE JUDGE PREVIEW CARD
--------------------------------------------------------- */

function LiveJudgeCard() {
  return (
    <div className="au-judge-wrap" aria-hidden="true">
      <div className="au-judge-label">
        <span className="au-live-dot" />
        LIVE JUDGE
      </div>

      <div className="au-judge">
        <div className="au-judge-top">
          <div className="au-dots">
            <i />
            <i />
            <i />
          </div>
          <span className="au-file">solution.cpp</span>
          <span className="au-lang">C++17</span>
        </div>

        <pre className="au-code">
          <code>
            <span className="ln"><i className="k">#include</i> <i className="s">&lt;iostream&gt;</i></span>
            <span className="ln"><i className="k">using namespace</i> std;</span>
            <span className="ln">&nbsp;</span>
            <span className="ln"><i className="t">int</i> <i className="f">main</i>() {'{'}</span>
            <span className="ln">{'    '}<i className="t">long long</i> a, b;</span>
            <span className="ln">{'    '}cin <i className="o">&gt;&gt;</i> a <i className="o">&gt;&gt;</i> b;</span>
            <span className="ln">{'    '}cout <i className="o">&lt;&lt;</i> a <i className="o">+</i> b <i className="o">&lt;&lt;</i> <i className="s">{'"\\n"'}</i>;</span>
            <span className="ln">{'}'}</span>
          </code>
        </pre>

        <div className="au-judge-panel">
          <ul className="au-tests">
            {JUDGE_TESTS.map((test, index) => (
              <li key={test.name} style={{ '--i': index }}>
                <span className="au-test-ok">
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className="au-test-name">{test.name}</span>
                <span className="au-test-tag">{test.tag}</span>
                <span className="au-test-ms">{test.ms} ms</span>
              </li>
            ))}
          </ul>

          <div className="au-verdict">
            <CheckCircle2 size={20} />
            <div>
              <strong>Accepted ✓ 5/5 tests</strong>
              <small>Runtime 12 ms · Memory 3.4 MB</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------
   SHELL: nav + hero + preview + form column
--------------------------------------------------------- */

export function AuthShell({
  mode = 'login',
  onSwitchToLogin,
  onSwitchToRegister,
  children
}) {
  const features = FEATURES[mode] || FEATURES.login

  return (
    <div className="au-page">
      <header className="au-nav">
        <div className="au-brand">
          <div className="au-brand-mark">
            <Shield size={22} strokeWidth={2.2} />
          </div>

          <div>
            <div className="au-brand-name">
              Code<span>Shield</span>
            </div>
            <div className="au-brand-sub">Secure Code Evaluation System</div>
          </div>
        </div>

        <nav className="au-nav-right" aria-label="Primary">
          <div className="au-nav-links">
            <span className="au-nav-link">Home</span>
            <span className="au-nav-link">About</span>
            <span className="au-nav-link">Contact</span>
          </div>

          <button
            type="button"
            className={`au-nav-btn ghost ${mode === 'login' ? 'current' : ''}`}
            aria-current={mode === 'login' ? 'page' : undefined}
            onClick={() => {
              if (mode !== 'login' && onSwitchToLogin) onSwitchToLogin()
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={`au-nav-btn solid ${mode === 'register' ? 'current' : ''}`}
            aria-current={mode === 'register' ? 'page' : undefined}
            onClick={() => {
              if (mode !== 'register' && onSwitchToRegister) onSwitchToRegister()
            }}
          >
            Register
          </button>
        </nav>
      </header>

      <main className="au-main">
        <section className="au-hero">
          {mode === 'register' ? (
            <h1>
              Join
              <br />
              Code<span>Shield</span>
            </h1>
          ) : (
            <h1>
              Code.
              <br />
              Compile.
              <br />
              Compete.
              <br />
              <span>Confidently.</span>
            </h1>
          )}

          <p>
            {mode === 'register'
              ? 'Create your account and start your coding journey today.'
              : 'A secure platform for coding assessments, built for learners and educators.'}
          </p>

          <ul className="au-features">
            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <li key={feature.title} className="au-feature">
                  <div className="au-feature-icon">
                    <Icon size={20} />
                  </div>
                  <div>
                    <strong>{feature.title}</strong>
                    <small>{feature.text}</small>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="au-preview-col">
          <LiveJudgeCard />
        </aside>

        <section className="au-form-col">
          <div className="au-card">{children}</div>
        </section>
      </main>
    </div>
  )
}

/* ---------------------------------------------------------
   FORM PARTS
--------------------------------------------------------- */

export function AuthField({ icon: Icon, right, invalid, ...inputProps }) {
  return (
    <div className={`au-field ${invalid ? 'invalid' : ''}`}>
      {Icon && <Icon size={17} className="au-field-ico" aria-hidden="true" />}
      <input {...inputProps} />
      {right}
    </div>
  )
}

export function PasswordToggle({ shown, onToggle }) {
  return (
    <button
      type="button"
      className="au-eye"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
    >
      {shown ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  )
}

export function AuthAlert({ kind = 'error', children }) {
  const Icon = kind === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div
      className={`au-alert ${kind}`}
      role={kind === 'success' ? 'status' : 'alert'}
    >
      <Icon size={17} />
      <span>{children}</span>
    </div>
  )
}

function passwordScore(password) {
  let score = 0

  if (password.length >= 8) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score += 1

  return score
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

/* Sirf dikhane ke liye: submit ko block nahi karta */
export function PasswordStrength({ password }) {
  if (!password) return null

  const tooShort = password.length < 8
  const score = tooShort ? Math.min(1, passwordScore(password)) : passwordScore(password)

  return (
    <div className="au-strength" data-level={score}>
      <div className="au-strength-bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <span>
        {tooShort
          ? 'Too short (use at least 8 characters)'
          : `${STRENGTH_LABELS[score] || 'Weak'} password`}
      </span>
    </div>
  )
}

export function StepDots({ step, total = 3 }) {
  return (
    <div className="au-steps" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, index) => {
        const number = index + 1

        return (
          <i
            key={number}
            className={number < step ? 'done' : number === step ? 'active' : ''}
          />
        )
      })}
    </div>
  )
}

export function SocialLogin({ onGoogle, onGithub }) {
  return (
    <>
      <div className="au-divider">
        <span />
        <p>or continue with</p>
        <span />
      </div>

      <div className="au-social">
        <button type="button" className="au-social-btn" onClick={onGoogle}>
          <svg className="au-social-icon" viewBox="0 0 24 24" aria-hidden="true">
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
          <span>Google</span>
        </button>

        <button type="button" className="au-social-btn" onClick={onGithub}>
          <svg className="au-social-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.26c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23A11.5 11.5 0 0 1 12 6.58c1.02 0 2.05.14 3.01.42 2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z"
            />
          </svg>
          <span>GitHub</span>
        </button>
      </div>
    </>
  )
}


