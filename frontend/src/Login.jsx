// import { useState } from 'react'
// import './Auth.css'

// const API_BASE = 'http://localhost:5000'

// function Login({ onLoginSuccess, switchToRegister }) {

//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [error, setError] = useState('')
//   const [showPassword, setShowPassword] = useState(false)
//   const [loading, setLoading] = useState(false)

//   const handleLogin = async (e) => {

//     e.preventDefault()

//     setError('')
//     setLoading(true)

//     try {

//       const res = await fetch(`${API_BASE}/login`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           email,
//           password
//         })
//       })

//       const data = await res.json()

//       if (!res.ok) {
//         setError(data.error || 'Login failed')
//         return
//       }

//       localStorage.setItem('codeshield_token', data.token)
//       localStorage.setItem('codeshield_role', data.role)

//       onLoginSuccess(data.role)

//     } catch (err) {

//       setError('Could not reach the server')

//     } finally {

//       setLoading(false)

//     }
//   }

//   return (

//     <div className="auth-page">

//       {/* LEFT SIDE */}

//       <div className="auth-left">

//         <div className="logo">

//           <div className="logo-shield">
//             ◆
//           </div>

//           <div>
//             <div className="logo-text">
//               Code<span>Shield</span>
//             </div>

//             <div className="logo-subtitle">
//               Secure Code Evaluation System
//             </div>
//           </div>

//         </div>


//         <div className="top-nav">
//           <span>Home</span>
//           <span>About</span>
//           <span>Contact</span>
//         </div>


//         <div className="hero">

//           <h1>
//             Code.<br />
//             Compile.<br />
//             Compete.<br />
//             <span>Confidently.</span>
//           </h1>

//           <p>
//             A secure platform for coding assessments,
//             built for learners and educators.
//           </p>


//           <div className="features">

//             <div className="feature">

//               <div className="feature-icon">
//                 🛡
//               </div>

//               <div>
//                 <strong>Safe & Secure</strong>
//                 <small>Sandboxed code execution</small>
//               </div>

//             </div>


//             <div className="feature">

//               <div className="feature-icon">
//                 ▥
//               </div>

//               <div>
//                 <strong>Practice & Improve</strong>
//                 <small>Track your coding progress</small>
//               </div>

//             </div>


//             <div className="feature">

//               <div className="feature-icon">
//                 👥
//               </div>

//               <div>
//                 <strong>Built for Everyone</strong>
//                 <small>Students, teachers & institutes</small>
//               </div>

//             </div>

//           </div>

//         </div>

//       </div>


//       {/* RIGHT SIDE */}

//       <div className="auth-right">

//         <div className="auth-card">

//           <h2>
//             Welcome Back
//           </h2>

//           <div className="auth-card-subtitle">
//             Login to your CodeShield account
//           </div>


//           {error && (
//             <div className="error-message">
//               {error}
//             </div>
//           )}


//           <form onSubmit={handleLogin}>

//             {/* EMAIL */}

//             <div className="input-group">

//               <span className="input-icon">
//                 ✉
//               </span>

//               <input
//                 type="email"
//                 placeholder="Email address"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 required
//               />

//             </div>


//             {/* PASSWORD */}

//             <div className="input-group">

//               <span className="input-icon">
//                 🔒
//               </span>

//               <input
//                 type={showPassword ? 'text' : 'password'}
//                 placeholder="Password"
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 required
//               />

//               <button
//                 type="button"
//                 className="password-eye"
//                 onClick={() => setShowPassword(!showPassword)}
//               >
//                 {showPassword ? '🙈' : '👁'}
//               </button>

//             </div>


//             {/* OPTIONS */}

//             <div className="login-options">

//               <label>
//                 <input type="checkbox" />
//                 {' '} Remember me
//               </label>

//               <a href="#">
//                 Forgot password?
//               </a>

//             </div>


//             {/* LOGIN BUTTON */}

//             <button
//               type="submit"
//               className="primary-btn"
//               disabled={loading}
//             >

//               {loading
//                 ? 'Logging in...'
//                 : 'Login →'}

//             </button>

//           </form>


//           {/* DIVIDER */}

//           <div className="divider">
//             OR
//           </div>


//           {/* SOCIAL BUTTONS */}

//           <button
//   type="button"
//   className="google-btn"
//   onClick={() => {
//     window.location.href =
//       "http://127.0.0.1:5000/auth/google";
//   }}
// >
//   🌐 Continue with Google
// </button>


//           <button
//             type="button"
//             className="secondary-btn"
//           >
//             ◉ &nbsp; Continue with GitHub
//           </button>


//           {/* REGISTER */}

//           <div className="auth-switch">

//             Don't have an account?{' '}

//             <span
//               onClick={switchToRegister}
//             >
//               Register here
//             </span>

//           </div>

//         </div>

//       </div>

//     </div>

//   )
// }

// export default Login





import { useState } from 'react'
import './Auth.css'

const API_BASE = 'http://localhost:5000'

function Login({ onLoginSuccess, switchToRegister }) {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)


  // =========================================================
  // NORMAL EMAIL/PASSWORD LOGIN
  // =========================================================

  const handleLogin = async (e) => {

    e.preventDefault()

    setError('')
    setLoading(true)

    try {

      const res = await fetch(
        `${API_BASE}/login`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            email,
            password
          })
        }
      )


      const data = await res.json()


      if (!res.ok) {

        setError(
          data.error || 'Login failed'
        )

        return
      }


      // -----------------------------------------------------
      // Store JWT and role
      // -----------------------------------------------------

      localStorage.setItem(
        'codeshield_token',
        data.token
      )

      localStorage.setItem(
        'codeshield_role',
        data.role
      )


      // -----------------------------------------------------
      // Send BOTH token and role to App.jsx
      // -----------------------------------------------------

      onLoginSuccess(
        data.token,
        data.role
      )


    } catch (err) {

      console.error(err)

      setError(
        'Could not reach the server'
      )

    } finally {

      setLoading(false)

    }
  }


  // =========================================================
  // GOOGLE LOGIN
  // =========================================================

  const handleGoogleLogin = () => {

    window.location.href =
      'http://127.0.0.1:5000/auth/google'

  }


  // =========================================================
  // GITHUB LOGIN
  // =========================================================

  const handleGithubLogin = () => {

    window.location.href =
      'http://127.0.0.1:5000/auth/github'

  }


  return (

    <div className="auth-page">


      {/* =====================================================
          LEFT SIDE
      ====================================================== */}

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


        {/* TOP NAVIGATION */}

        <div className="top-nav">

          <span>Home</span>

          <span>About</span>

          <span>Contact</span>

        </div>


        {/* HERO */}

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


          {/* FEATURES */}

          <div className="features">


            <div className="feature">

              <div className="feature-icon">
                🛡
              </div>

              <div>

                <strong>
                  Safe & Secure
                </strong>

                <small>
                  Sandboxed code execution
                </small>

              </div>

            </div>


            <div className="feature">

              <div className="feature-icon">
                ▥
              </div>

              <div>

                <strong>
                  Practice & Improve
                </strong>

                <small>
                  Track your coding progress
                </small>

              </div>

            </div>


            <div className="feature">

              <div className="feature-icon">
                👥
              </div>

              <div>

                <strong>
                  Built for Everyone
                </strong>

                <small>
                  Students, teachers & institutes
                </small>

              </div>

            </div>


          </div>

        </div>

      </div>


      {/* =====================================================
          RIGHT SIDE
      ====================================================== */}

      <div className="auth-right">

        <div className="auth-card">


          <h2>
            Welcome Back
          </h2>


          <div className="auth-card-subtitle">

            Login to your CodeShield account

          </div>


          {/* ERROR */}

          {error && (

            <div className="error-message">

              {error}

            </div>

          )}


          {/* =================================================
              LOGIN FORM
          ================================================== */}

          <form onSubmit={handleLogin}>


            {/* EMAIL */}

            <div className="input-group">

              <span className="input-icon">
                ✉
              </span>

              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
              />

            </div>


            {/* PASSWORD */}

            <div className="input-group">

              <span className="input-icon">
                🔒
              </span>

              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
              />

              <button
                type="button"
                className="password-eye"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
              >

                {showPassword
                  ? '🙈'
                  : '👁'}

              </button>

            </div>


            {/* OPTIONS */}

            <div className="login-options">

              <label>

                <input
                  type="checkbox"
                />

                {' '} Remember me

              </label>


              <a href="#">
                Forgot password?
              </a>

            </div>


            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="primary-btn"
              disabled={loading}
            >

              {loading
                ? 'Logging in...'
                : 'Login →'}

            </button>

          </form>


          {/* =================================================
              OAUTH DIVIDER
          ================================================== */}

          <div className="oauth-divider">

            <span></span>

            <p>OR</p>

            <span></span>

          </div>


          {/* =================================================
              GOOGLE LOGIN
          ================================================== */}

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


            <span>
              Continue with Google
            </span>

          </button>


          {/* =================================================
              GITHUB LOGIN
          ================================================== */}

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


            <span>
              Continue with GitHub
            </span>

          </button>


          {/* REGISTER */}

          <div className="auth-switch">

            Don't have an account?{' '}

            <span
              onClick={switchToRegister}
            >
              Register here
            </span>

          </div>


        </div>

      </div>

    </div>

  )
}


export default Login