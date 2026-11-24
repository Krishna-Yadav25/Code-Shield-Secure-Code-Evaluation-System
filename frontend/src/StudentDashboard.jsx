// import { useCallback, useEffect, useMemo, useState } from "react";
// import { Search } from "lucide-react";
// import DashboardLayout from "./DashboardLayout.jsx";
// import StudentTestPage from "./StudentTestPage.jsx";
// import { NotificationsCard } from "./NotificationBell.jsx";
// import LoginFaceGate from "./LoginFaceGate.jsx";
// import { isFaceVerifiedThisSession } from "./faceSession.js";
// import Leaderboard from "./Leaderboard.jsx";
// import "./Dashboard.css";

// const API_BASE = "http://localhost:5000";
// const SUBMITTED_KEY = "codeshield_submitted_tests";
// const DEFAULT_MAX_MARKS = 10;

// // Face status server se kitni der tak intezaar karna hai (ms).
// // Server na de to student ko rokna nahi, seedha dashboard khul jata hai.
// const FACE_STATUS_TIMEOUT_MS = 8000;

// // Face setup ek baar hone ke baad is browser mein yaad rakhne ki key
// const faceKeyFor = (userId) => `codeshield_face_enrolled_${userId}`;

// // JWT se user_id nikalta hai. Dashboard API user_id na bheje tab bhi
// // face check chalta rahe. Fail ho to null (kuch ghalat nahi hota).
// function tokenUserId(token) {
//   try {
//     const payload = token
//       .split(".")[1]
//       .replace(/-/g, "+")
//       .replace(/_/g, "/");

//     return JSON.parse(atob(payload)).user_id ?? null;
//   } catch {
//     return null;
//   }
// }

// /*
//   /api/identity/status ka jawab dekhkar batata hai ki face registered hai ya nahi.
//   known = false: jawab ka shape pehchana nahi gaya (tab local flag par bharosa).
// */
// function readFaceStatus(status) {
//   if (!status || typeof status !== "object") {
//     return { known: false, registered: false };
//   }

//   const flags = [
//     status.registered,
//     status.enrolled,
//     status.is_registered,
//     status.face_registered,
//     status.has_reference,
//     status.has_face
//   ].filter((value) => typeof value === "boolean");

//   if (flags.length > 0) {
//     return { known: true, registered: flags.some(Boolean) };
//   }

//   if (typeof status.mode === "string") {
//     const mode = status.mode.toLowerCase();

//     if (["register", "enroll", "enrol"].includes(mode)) {
//       return { known: true, registered: false };
//     }

//     if (["verify", "login", "match"].includes(mode)) {
//       return { known: true, registered: true };
//     }
//   }

//   return { known: false, registered: false };
// }

// function getSubmittedTests() {
//   try {
//     return JSON.parse(localStorage.getItem(SUBMITTED_KEY) || "[]").map(String);
//   } catch {
//     return [];
//   }
// }

// function testStatus(test) {
//   const now = Date.now();
//   const start = new Date(test.start_time).getTime();
//   const end = new Date(test.end_time).getTime();

//   if (Number.isFinite(start) && now < start) return ["Upcoming", "upcoming"];
//   if (Number.isFinite(end) && now > end) return ["Ended", "ended"];
//   return ["Live", "live"];
// }

// function verdictClass(verdict) {
//   if (!verdict) return "neutral";
//   const v = String(verdict).trim().toLowerCase();
//   return v === "ac" || v.includes("accept") ? "good" : "bad";
// }

// function countdownText(test) {
//   const end = new Date(test.end_time).getTime();
//   const diff = end - Date.now();

//   if (!Number.isFinite(end) || diff <= 0) return null;

//   const mins = Math.floor(diff / 60000);
//   const d = Math.floor(mins / 1440);
//   const h = Math.floor((mins % 1440) / 60);
//   const m = mins % 60;
//   const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;

//   return { text: `Ends in ${text}`, urgent: diff < 3600000 };
// }

// function TestCard({ test, onStartTest, submitted }) {
//   const [label, cls] = testStatus(test);
//   const isLive = cls === "live";
//   const [, setTick] = useState(0);

//   useEffect(() => {
//     const t = setInterval(() => setTick((n) => n + 1), 60000);
//     return () => clearInterval(t);
//   }, []);

//   const countdown = isLive && !submitted ? countdownText(test) : null;

//   return (
//     <div className="test-card">
//       <div className="test-top">
//         <div className="test-icon">🧪</div>
//         <span className={`badge ${submitted ? "good" : cls}`}>
//           {submitted ? "Attempted" : label}
//         </span>
//       </div>

//       <h3>{test.title}</h3>
//       <p>{test.description || "Coding assessment"}</p>

//       {countdown && (
//         <div className={`test-countdown ${countdown.urgent ? "urgent" : ""}`}>
//           ⏳ {countdown.text}
//         </div>
//       )}

//       <div className="test-time">
//         <span>
//           <strong>Starts</strong>{" "}
//           {test.start_time ? new Date(test.start_time).toLocaleString() : "—"}
//         </span>
//         <span>
//           <strong>Ends</strong>{" "}
//           {test.end_time ? new Date(test.end_time).toLocaleString() : "—"}
//         </span>
//       </div>

//       <button
//         className="primary-btn"
//         onClick={() => onStartTest(test)}
//         disabled={!isLive || submitted}
//       >
//         {submitted
//           ? "✓ Test Submitted"
//           : isLive
//             ? "🔐 Start Test"
//             : label === "Upcoming"
//               ? "Test Not Started"
//               : "Test Ended"}
//       </button>
//     </div>
//   );
// }

// function SubmissionsTable({ rows }) {
//   if (!rows?.length) {
//     return <div className="empty-card">No submissions yet.</div>;
//   }

//   return (
//     <div className="teacher-table-wrapper">
//       <table className="teacher-data-table">
//         <thead>
//           <tr>
//             <th>Problem</th>
//             <th>Language</th>
//             <th>Status</th>
//             <th>Verdict</th>
//             <th>Date</th>
//           </tr>
//         </thead>
//         <tbody>
//           {rows.map((s, i) => (
//             <tr key={s.submission_id ?? i}>
//               <td>{s.problem || s.problem_title || "—"}</td>
//               <td>{s.language || "—"}</td>
//               <td>{s.status || "—"}</td>
//               <td>
//                 <span className={`badge ${verdictClass(s.verdict)}`}>
//                   {s.verdict || "—"}
//                 </span>
//               </td>
//               <td>
//                 {s.submitted_at
//                   ? new Date(s.submitted_at).toLocaleString()
//                   : "—"}
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// function PasswordModal({
//   test,
//   password,
//   setPassword,
//   onClose,
//   onUnlock,
//   unlocking,
//   error
// }) {
//   return (
//     <div className="password-overlay">
//       <div className="password-modal">
//         <div className="password-icon">🔐</div>
//         <h2>Test Protected</h2>
//         <p className="password-test-name">{test.title}</p>
//         <p className="password-description">
//           Enter the password provided by your teacher.
//         </p>

//         <label>Test Password</label>
//         <input
//           type="password"
//           value={password}
//           autoFocus
//           placeholder="Enter test password"
//           onChange={(e) => setPassword(e.target.value)}
//           onKeyDown={(e) => e.key === "Enter" && !unlocking && onUnlock()}
//         />

//         {error && <div className="password-error">{error}</div>}

//         <div className="password-actions">
//           <button
//             className="secondary-btn"
//             onClick={onClose}
//             disabled={unlocking}
//           >
//             Cancel
//           </button>
//           <button
//             className="primary-btn"
//             onClick={onUnlock}
//             disabled={unlocking || !password.trim()}
//           >
//             {unlocking ? "Unlocking..." : "🔓 Unlock Test"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function StudentDashboard({ onLogout }) {
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [tab, setTab] = useState("home");
//   const [selectedTest, setSelectedTest] = useState(null);
//   const [passwordTest, setPasswordTest] = useState(null);
//   const [password, setPassword] = useState("");
//   const [passwordError, setPasswordError] = useState("");
//   const [unlocking, setUnlocking] = useState(false);
//   const [submittedTests, setSubmittedTests] = useState(getSubmittedTests);
//   const [results, setResults] = useState([]);
//   const [resultsLoading, setResultsLoading] = useState(false);
//   const [resultsError, setResultsError] = useState("");
//   const [testSearch, setTestSearch] = useState("");
//   const [testFilter, setTestFilter] = useState("all");
//   const [historySearch, setHistorySearch] = useState("");
//   const [historyVerdict, setHistoryVerdict] = useState("all");
//   const [resultsSearch, setResultsSearch] = useState("");

//   // Face: is session mein verify ho chuka?
//   const [faceOk, setFaceOk] = useState(isFaceVerifiedThisSession);

//   // Face setup ho chuka hai? null = abhi pata nahi, true/false = pata chal gaya
//   const [faceEnrolled, setFaceEnrolled] = useState(null);

//   // Dashboard API se, nahi mila to token se
//   const userId =
//     data?.user?.user_id ??
//     tokenUserId(localStorage.getItem("codeshield_token") || "");

//   const refreshDashboard = useCallback(async () => {
//     const token = localStorage.getItem("codeshield_token");

//     if (!token) {
//       setError("You are not logged in.");
//       setLoading(false);
//       return;
//     }

//     try {
//       setError("");

//       const response = await fetch(`${API_BASE}/api/student/dashboard`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(result.error || "Failed to load dashboard.");
//       }

//       setData(result);

//       try {
//         const attemptsResponse = await fetch(
//           `${API_BASE}/api/student/attempts`,
//           { headers: { Authorization: `Bearer ${token}` } }
//         );

//         const attemptsData = await attemptsResponse.json().catch(() => ({}));

//         if (
//           attemptsResponse.ok &&
//           Array.isArray(attemptsData.submitted_contest_ids)
//         ) {
//           const ids = attemptsData.submitted_contest_ids.map(String);

//           localStorage.setItem(SUBMITTED_KEY, JSON.stringify(ids));
//           setSubmittedTests(ids);
//         }
//       } catch {
//         // attempts load na ho to dashboard phir bhi chalta hai
//       }
//     } catch (e) {
//       setError(e.message || "Unable to load dashboard.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   const loadResults = useCallback(async () => {
//     const token = localStorage.getItem("codeshield_token");

//     if (!token) {
//       setResultsError("Please log in again.");
//       return;
//     }

//     setResultsLoading(true);
//     setResultsError("");

//     try {
//       const response = await fetch(`${API_BASE}/api/student/results`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(result.error || "Unable to load results.");
//       }

//       setResults(result.results || []);
//     } catch (e) {
//       setResultsError(e.message);
//     } finally {
//       setResultsLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     refreshDashboard();
//   }, [refreshDashboard]);

//   useEffect(() => {
//     if (tab === "results") loadResults();
//   }, [tab, loadResults]);

//   /* ==========================================================
//      FACE SETUP: SIRF EK BAAR
//      Server batata hai ki face registered hai ya nahi.
//      Registered hai => dashboard par gate kabhi nahi dikhta.
//      Registered nahi (naya student) => ek baar gate, phir kabhi nahi.
//      Test ke andar ki verification alag hai: wo har test mein ek baar
//      hoti hai aur server par save rehti hai (refresh / re-login par
//      dobara nahi poochti).
//      ========================================================== */

//   useEffect(() => {
//     if (userId == null) return undefined;

//     const key = faceKeyFor(userId);
//     const savedFlag = localStorage.getItem(key) === "1";
//     const token = localStorage.getItem("codeshield_token");

//     const controller = new AbortController();
//     const timer = setTimeout(
//       () => controller.abort(),
//       FACE_STATUS_TIMEOUT_MS
//     );

//     let cancelled = false;

//     (async () => {
//       try {
//         const response = await fetch(`${API_BASE}/api/identity/status`, {
//           headers: { Authorization: `Bearer ${token}` },
//           signal: controller.signal
//         });

//         const status = await response.json().catch(() => ({}));

//         if (cancelled) return;

//         if (!response.ok) {
//           // Server se pata nahi chala: student ko rokna nahi
//           setFaceEnrolled(true);
//           return;
//         }

//         const { known, registered } = readFaceStatus(status);

//         if (known) {
//           if (registered) {
//             localStorage.setItem(key, "1");
//           } else {
//             // Teacher ne face reset kiya ho ya naya student:
//             // purana "verified" session flag bhi hata do, taaki gate dikhe
//             localStorage.removeItem(key);
//             setFaceOk(false);
//           }

//           setFaceEnrolled(registered);
//         } else {
//           // Shape pehchana nahi gaya: local flag par chalo
//           setFaceEnrolled(savedFlag);
//         }
//       } catch {
//         // Timeout ya network error: student ko rokna nahi
//         if (!cancelled) setFaceEnrolled(true);
//       } finally {
//         clearTimeout(timer);
//       }
//     })();

//     return () => {
//       cancelled = true;
//       clearTimeout(timer);
//       controller.abort();
//     };
//   }, [userId]);

//   /* ==========================================================
//      DERIVED DATA + FILTERS
//      Saare hooks (useMemo) early return se PEHLE hone chahiye,
//      warna React "order of Hooks changed" error deta hai aur
//      page kala ho jata hai. Isliye `data` null ho tab bhi safe.
//      ========================================================== */

//   const tests = data?.available_tests || [];
//   const submissions = data?.recent_submissions || [];

//   const filteredTests = useMemo(() => {
//     const q = testSearch.trim().toLowerCase();

//     return tests.filter((test) => {
//       const matchesSearch =
//         !q ||
//         test.title?.toLowerCase().includes(q) ||
//         (test.description && test.description.toLowerCase().includes(q));

//       if (!matchesSearch) return false;

//       const [, cls] = testStatus(test);
//       const submitted = submittedTests.includes(String(test.contest_id));

//       if (testFilter === "all") return true;
//       if (testFilter === "live") return cls === "live" && !submitted;
//       if (testFilter === "upcoming") return cls === "upcoming";
//       if (testFilter === "ended") return cls === "ended";
//       if (testFilter === "attempted") return submitted;
//       return true;
//     });
//   }, [tests, testSearch, testFilter, submittedTests]);

//   const filteredSubmissions = useMemo(() => {
//     const q = historySearch.trim().toLowerCase();

//     return submissions.filter((s) => {
//       const problemName = (s.problem || s.problem_title || "").toLowerCase();
//       const matchesSearch = !q || problemName.includes(q);

//       if (!matchesSearch) return false;

//       const vClass = verdictClass(s.verdict);

//       if (historyVerdict === "all") return true;
//       if (historyVerdict === "accepted") return vClass === "good";
//       if (historyVerdict === "rejected") return vClass === "bad";
//       return true;
//     });
//   }, [submissions, historySearch, historyVerdict]);

//   const filteredResults = useMemo(() => {
//     const q = resultsSearch.trim().toLowerCase();

//     return results.filter((r) => {
//       if (!q) return true;

//       const title = (r.contest_title || r.test_title || "").toLowerCase();
//       const prob = (r.problem_title || r.problem || "").toLowerCase();

//       return title.includes(q) || prob.includes(q);
//     });
//   }, [results, resultsSearch]);

//   /* ==========================================================
//      HANDLERS
//      ========================================================== */

//   const isTestSubmitted = (test) =>
//     submittedTests.includes(String(test.contest_id));

//   const handleStartTest = (test) => {
//     const [status] = testStatus(test);

//     if (status !== "Live" || isTestSubmitted(test)) return;

//     setPasswordTest(test);
//     setPassword("");
//     setPasswordError("");
//   };

//   const handleUnlockTest = async () => {
//     if (!passwordTest || unlocking) return;

//     if (!password.trim()) {
//       setPasswordError("Please enter the test password.");
//       return;
//     }

//     const token = localStorage.getItem("codeshield_token");

//     if (!token) {
//       setPasswordError("Your login session has expired.");
//       return;
//     }

//     setUnlocking(true);
//     setPasswordError("");

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/student/tests/${passwordTest.contest_id}/unlock`,
//         {
//           method: "POST",
//           headers: {
//             Authorization: `Bearer ${token}`,
//             "Content-Type": "application/json"
//           },
//           body: JSON.stringify({ password })
//         }
//       );

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(result.error || "Unable to unlock test.");
//       }

//       setSelectedTest(passwordTest);
//       setPasswordTest(null);
//       setPassword("");
//     } catch (e) {
//       setPasswordError(e.message);
//     } finally {
//       setUnlocking(false);
//     }
//   };

//   const handleBackFromTest = (wasSubmitted = false) => {
//     const completed = selectedTest;

//     setSelectedTest(null);

//     if (wasSubmitted && completed?.contest_id != null) {
//       const updated = [
//         ...new Set([...getSubmittedTests(), String(completed.contest_id)])
//       ];

//       localStorage.setItem(SUBMITTED_KEY, JSON.stringify(updated));
//       setSubmittedTests(updated);
//     }

//     setLoading(true);
//     refreshDashboard();
//   };

//   // Face setup poora hua: ab is student se dobara nahi poocha jayega
//   const handleFaceVerified = () => {
//     if (userId != null) {
//       localStorage.setItem(faceKeyFor(userId), "1");
//     }

//     setFaceEnrolled(true);
//     setFaceOk(true);
//   };

//   /* ==========================================================
//      EARLY RETURNS (iske neeche koi hook nahi hona chahiye)
//      ========================================================== */

//   if (loading) {
//     return <div className="dashboard-loading">Loading dashboard...</div>;
//   }

//   if (error) {
//     return (
//       <div className="dashboard-error">
//         <h2>Unable to load dashboard</h2>
//         <p>{error}</p>
//         <button className="primary-btn" onClick={refreshDashboard}>
//           Retry
//         </button>
//         <button className="logout-btn" onClick={onLogout}>
//           Back to Login
//         </button>
//       </div>
//     );
//   }

//   if (!data) {
//     return <div className="dashboard-error">No dashboard data available.</div>;
//   }

//   // Face status abhi check ho raha hai (max 8 second)
//   if (userId != null && faceEnrolled === null) {
//     return <div className="dashboard-loading">Loading dashboard...</div>;
//   }

//   // Sirf us student ko gate, jiska face abhi register nahi hua
//   if (userId != null && faceEnrolled === false && !faceOk) {
//     return (
//       <LoginFaceGate
//         onVerified={handleFaceVerified}
//         onLogout={onLogout}
//       />
//     );
//   }

//   if (selectedTest) {
//     return (
//       <StudentTestPage
//         test={selectedTest}
//         onBack={handleBackFromTest}
//         onLogout={onLogout}
//       />
//     );
//   }

//   const username = data.user?.username || "Student";
//   const accepted = submissions.filter(
//     (s) => verdictClass(s.verdict) === "good"
//   ).length;

//   const renderTestCards = (items) =>
//     items.length === 0 ? (
//       <div className="empty-card">No tests available.</div>
//     ) : (
//       <div className="test-grid">
//         {items.map((test) => (
//           <TestCard
//             key={test.contest_id}
//             test={test}
//             onStartTest={handleStartTest}
//             submitted={isTestSubmitted(test)}
//           />
//         ))}
//       </div>
//     );

//   return (
//     <>
//       <DashboardLayout
//         role="student"
//         username={username}
//         active={tab}
//         onNavigate={setTab}
//         onLogout={onLogout}
//       >
//         <div className="page">
//           {tab === "home" && (
//             <>
//               <section className="hero-card">
//                 <h2>Welcome back, {username} 👋</h2>
//                 <p>
//                   View your coding assessments, submission history and
//                   published results.
//                 </p>

//                 <div className="hero-actions">
//                   <button
//                     className="primary-btn"
//                     onClick={() => setTab("results")}
//                   >
//                     🏆 View Results
//                   </button>
//                 </div>
//               </section>

//               <NotificationsCard />

//               <section className="stats-grid">
//                 <div className="stat-card">
//                   <div className="stat-ico">🧪</div>
//                   <div>
//                     <h3>{tests.length}</h3>
//                     <p>Available tests</p>
//                   </div>
//                 </div>

//                 <div className="stat-card">
//                   <div className="stat-ico">📝</div>
//                   <div>
//                     <h3>{submissions.length}</h3>
//                     <p>Recent submissions</p>
//                   </div>
//                 </div>

//                 <div className="stat-card">
//                   <div className="stat-ico">✅</div>
//                   <div>
//                     <h3>{accepted}</h3>
//                     <p>Accepted</p>
//                   </div>
//                 </div>

//                 <div className="stat-card">
//                   <div className="stat-ico">🎯</div>
//                   <div>
//                     <h3>{submittedTests.length}</h3>
//                     <p>Tests attempted</p>
//                   </div>
//                 </div>
//               </section>

//               <section>
//                 <div className="sec-head">
//                   <h2>Available Tests</h2>
//                   <button onClick={() => setTab("tests")}>View all</button>
//                 </div>
//                 {renderTestCards(tests.slice(0, 3))}
//               </section>

//               <section>
//                 <div className="sec-head">
//                   <h2>Recent Submissions</h2>
//                   <button onClick={() => setTab("history")}>
//                     View history
//                   </button>
//                 </div>
//                 <div className="submission-card">
//                   <SubmissionsTable rows={submissions.slice(0, 5)} />
//                 </div>
//               </section>
//             </>
//           )}

//           {tab === "tests" && (
//             <section>
//               <div className="sec-head">
//                 <div>
//                   <h2>Available Assessments</h2>
//                   <p>Browse live, upcoming and past coding tests</p>
//                 </div>
//               </div>

//               <div className="cs-search-filter-bar">
//                 <div className="cs-search-input-wrap">
//                   <Search size={16} className="cs-search-icon" />
//                   <input
//                     type="text"
//                     className="cs-search-input"
//                     placeholder="Search test by title or topic..."
//                     value={testSearch}
//                     onChange={(e) => setTestSearch(e.target.value)}
//                   />
//                 </div>
//                 <div className="cs-filter-pills">
//                   {[
//                     { id: "all", label: "All Tests" },
//                     { id: "live", label: "🔥 Live Now" },
//                     { id: "upcoming", label: "⏳ Upcoming" },
//                     { id: "ended", label: "🏁 Ended" },
//                     { id: "attempted", label: "✓ Attempted" },
//                   ].map((p) => (
//                     <button
//                       key={p.id}
//                       type="button"
//                       className={`cs-filter-pill ${testFilter === p.id ? "active" : ""}`}
//                       onClick={() => setTestFilter(p.id)}
//                     >
//                       {p.label}
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               {renderTestCards(filteredTests)}
//             </section>
//           )}

//           {tab === "leaderboard" && (
//             <section>
//               <div className="sec-head">
//                 <h2>Leaderboard</h2>
//               </div>
//               <Leaderboard />
//             </section>
//           )}

//           {tab === "history" && (
//             <section>
//               <div className="sec-head">
//                 <div>
//                   <h2>Submission History</h2>
//                   <p>All your past code executions and evaluations</p>
//                 </div>
//               </div>

//               <div className="cs-search-filter-bar">
//                 <div className="cs-search-input-wrap">
//                   <Search size={16} className="cs-search-icon" />
//                   <input
//                     type="text"
//                     className="cs-search-input"
//                     placeholder="Filter submissions by problem title..."
//                     value={historySearch}
//                     onChange={(e) => setHistorySearch(e.target.value)}
//                   />
//                 </div>
//                 <div className="cs-filter-pills">
//                   {[
//                     { id: "all", label: "All Verdicts" },
//                     { id: "accepted", label: "✅ Accepted" },
//                     { id: "rejected", label: "❌ Not Accepted" },
//                   ].map((p) => (
//                     <button
//                       key={p.id}
//                       type="button"
//                       className={`cs-filter-pill ${historyVerdict === p.id ? "active" : ""}`}
//                       onClick={() => setHistoryVerdict(p.id)}
//                     >
//                       {p.label}
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               <div className="submission-card">
//                 <SubmissionsTable rows={filteredSubmissions} />
//               </div>
//             </section>
//           )}

//           {tab === "results" && (
//             <section>
//               <div className="sec-head">
//                 <div>
//                   <h2>My Results</h2>
//                   <p>
//                     Only results approved and published by your teacher appear
//                     here.
//                   </p>
//                 </div>

//                 <button onClick={loadResults} disabled={resultsLoading}>
//                   {resultsLoading ? "Loading..." : "Refresh"}
//                 </button>
//               </div>

//               <div className="cs-search-filter-bar">
//                 <div className="cs-search-input-wrap">
//                   <Search size={16} className="cs-search-icon" />
//                   <input
//                     type="text"
//                     className="cs-search-input"
//                     placeholder="Search results by assessment or problem title..."
//                     value={resultsSearch}
//                     onChange={(e) => setResultsSearch(e.target.value)}
//                   />
//                 </div>
//               </div>

//               {resultsError && (
//                 <div className="dashboard-error">
//                   <p>{resultsError}</p>
//                 </div>
//               )}

//               {resultsLoading ? (
//                 <div className="empty-card">Loading published results...</div>
//               ) : filteredResults.length === 0 ? (
//                 <div className="empty-card">
//                   <h3>No published results yet</h3>
//                   <p>
//                     {resultsSearch
//                       ? "No results match your search."
//                       : "Your teacher has not published a result for you yet. Please check again later."}
//                   </p>
//                 </div>
//               ) : (
//                 <div className="test-grid">
//                   {filteredResults.map((r, i) => {
//                     const marks = Number(r.awarded_marks || 0);
//                     const max = Number(r.max_marks || DEFAULT_MAX_MARKS);
//                     const percentage = max > 0 ? (marks / max) * 100 : 0;

//                     return (
//                       <article
//                         className="test-card"
//                         key={r.result_id ?? r.submission_id ?? i}
//                       >
//                         <div className="test-top">
//                           <div className="test-icon">🏆</div>
//                           <span className="badge good">Published</span>
//                         </div>

//                         <h3>
//                           {r.contest_title ||
//                             r.test_title ||
//                             "Assessment Result"}
//                         </h3>
//                         <p>
//                           {r.problem_title ||
//                             r.problem ||
//                             "Coding assessment"}
//                         </p>

//                         <div className="stats-grid">
//                           <div className="stat-card">
//                             <div>
//                               <h3>
//                                 {marks} / {max}
//                               </h3>
//                               <p>Marks</p>
//                             </div>
//                           </div>

//                           <div className="stat-card">
//                             <div>
//                               <h3>{percentage.toFixed(1)}%</h3>
//                               <p>Percentage</p>
//                             </div>
//                           </div>

//                           <div className="stat-card">
//                             <div>
//                               <h3>
//                                 {r.test_cases_passed ?? 0} /{" "}
//                                 {r.test_cases_total ?? 0}
//                               </h3>
//                               <p>Test cases passed</p>
//                             </div>
//                           </div>
//                         </div>

//                         <p>
//                           <strong>Teacher feedback:</strong>{" "}
//                           {r.teacher_feedback || "No feedback provided."}
//                         </p>

//                         {r.published_at && (
//                           <p>
//                             <small>
//                               Published:{" "}
//                               {new Date(r.published_at).toLocaleString()}
//                             </small>
//                           </p>
//                         )}
//                       </article>
//                     );
//                   })}
//                 </div>
//               )}
//             </section>
//           )}
//         </div>
//       </DashboardLayout>

//       {passwordTest && (
//         <PasswordModal
//           test={passwordTest}
//           password={password}
//           setPassword={setPassword}
//           onClose={() => !unlocking && setPasswordTest(null)}
//           onUnlock={handleUnlockTest}
//           unlocking={unlocking}
//           error={passwordError}
//         />
//       )}
//     </>
//   );
// }

// export default StudentDashboard;


import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCode2,
  FlaskConical,
  History,
  Inbox,
  Lock,
  Medal,
  Play,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Trophy
} from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import StudentTestPage from "./StudentTestPage.jsx";
import { NotificationsCard } from "./NotificationBell.jsx";
import LoginFaceGate from "./LoginFaceGate.jsx";
import { isFaceVerifiedThisSession } from "./faceSession.js";
import Leaderboard from "./Leaderboard.jsx";
import "./Dashboard.css";
import "./StudentDashboard.css";

const API_BASE = "http://localhost:5000";
const SUBMITTED_KEY = "codeshield_submitted_tests";
const DEFAULT_MAX_MARKS = 10;

// Face setup ek baar hone ke baad is browser mein yaad rakhne ki key
const faceKeyFor = (userId) => `codeshield_face_enrolled_${userId}`;

/*
  /api/identity/status ka jawab dekhkar batata hai ki face registered hai ya nahi.
  known = false: jawab ka shape pehchana nahi gaya (tab local flag par bharosa).
*/
function readFaceStatus(status) {
  if (!status || typeof status !== "object") {
    return { known: false, registered: false };
  }

  const flags = [
    status.registered,
    status.enrolled,
    status.is_registered,
    status.face_registered,
    status.has_reference,
    status.has_face
  ].filter((value) => typeof value === "boolean");

  if (flags.length > 0) {
    return { known: true, registered: flags.some(Boolean) };
  }

  if (typeof status.mode === "string") {
    const mode = status.mode.toLowerCase();

    if (["register", "enroll", "enrol"].includes(mode)) {
      return { known: true, registered: false };
    }

    if (["verify", "login", "match"].includes(mode)) {
      return { known: true, registered: true };
    }
  }

  return { known: false, registered: false };
}

function getSubmittedTests() {
  try {
    return JSON.parse(localStorage.getItem(SUBMITTED_KEY) || "[]").map(String);
  } catch {
    return [];
  }
}

function testStatus(test) {
  const now = Date.now();
  const start = new Date(test.start_time).getTime();
  const end = new Date(test.end_time).getTime();

  if (Number.isFinite(start) && now < start) return ["Upcoming", "upcoming"];
  if (Number.isFinite(end) && now > end) return ["Ended", "ended"];
  return ["Live", "live"];
}

function verdictClass(verdict) {
  if (!verdict) return "neutral";
  const v = String(verdict).trim().toLowerCase();
  return v === "ac" || v.includes("accept") ? "good" : "bad";
}

function countdownText(test) {
  const end = new Date(test.end_time).getTime();
  const diff = end - Date.now();

  if (!Number.isFinite(end) || diff <= 0) return null;

  const mins = Math.floor(diff / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;

  return { text: `Ends in ${text}`, urgent: diff < 3600000 };
}

/* ==========================================================
   SMALL FORMATTING HELPERS
   ========================================================== */

const LANGUAGE_LABELS = {
  cpp: "C++",
  "c++": "C++",
  java: "Java",
  python: "Python",
  python3: "Python",
  py: "Python"
};

function langLabel(language) {
  const key = String(language || "").trim().toLowerCase();

  return LANGUAGE_LABELS[key] || (language ? String(language) : "—");
}

function greeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayText() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function shortDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function timeAgo(value) {
  if (!value) return "—";

  const then = new Date(value).getTime();

  if (!Number.isFinite(then)) return "—";

  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.floor(mins / 60);

  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days} d ago`;

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function verdictLabel(verdict) {
  if (!verdict) return "—";

  return String(verdict).trim().toUpperCase() === "AC"
    ? "Accepted"
    : String(verdict);
}

function scoreTone(percentage) {
  if (percentage >= 75) return "good";
  if (percentage >= 40) return "warn";
  return "bad";
}

/* ==========================================================
   SHARED BUILDING BLOCKS
   ========================================================== */

function PageHeader({ title, subtitle, action }) {
  return (
    <header className="sd-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {action}
    </header>
  );
}

function CardHead({ icon: Icon, title, hint, actionLabel, onAction }) {
  return (
    <div className="sd-card-head">
      <div className="sd-card-title">
        {Icon && (
          <span className="sd-card-title-ico">
            <Icon size={15} />
          </span>
        )}

        <div>
          <h2>{title}</h2>
          {hint && <span>{hint}</span>}
        </div>
      </div>

      {actionLabel && (
        <button type="button" className="sd-link-btn" onClick={onAction}>
          {actionLabel}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <div className={`sd-stat sd-tone-${tone}`}>
      <div className="sd-stat-ico">
        <Icon size={20} />
      </div>

      <div className="sd-stat-body">
        <span className="sd-stat-label">{label}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title, text }) {
  return (
    <div className="sd-empty">
      <div className="sd-empty-ico">
        <Icon size={22} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}

function Toolbar({ search, onSearch, placeholder, options, value, onChange }) {
  return (
    <div className="sd-toolbar">
      <div className="sd-search">
        <Search size={16} />
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      {options && (
        <div className="sd-pills" role="tablist">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={value === option.id}
              className={`sd-pill ${value === option.id ? "active" : ""}`}
              onClick={() => onChange(option.id)}
            >
              {option.label}
              {option.count != null && <em>{option.count}</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   TESTS
   ========================================================== */

function useMinuteTick() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
}

function startLabel(test, label, isLive, submitted) {
  if (submitted) return "Submitted";
  if (isLive) return "Start test";
  return label === "Upcoming" ? "Not started" : "Ended";
}

// Home page par chhoti row
function TestRow({ test, onStartTest, submitted }) {
  useMinuteTick();

  const [label, cls] = testStatus(test);
  const isLive = cls === "live";
  const countdown = isLive && !submitted ? countdownText(test) : null;
  const state = submitted ? "done" : cls;

  const when = submitted
    ? "Test submitted"
    : isLive
      ? countdown?.text || "Live now"
      : cls === "upcoming"
        ? `Starts ${shortDateTime(test.start_time)}`
        : `Ended ${shortDateTime(test.end_time)}`;

  return (
    <div className={`sd-test-row sd-state-${state}`}>
      <div className="sd-test-row-ico">
        {submitted ? <CheckCircle2 size={18} /> : <FlaskConical size={18} />}
      </div>

      <div className="sd-test-row-main">
        <strong>{test.title}</strong>
        <span>{test.description || "Coding assessment"}</span>
      </div>

      <div
        className={`sd-test-row-when ${countdown?.urgent ? "urgent" : ""}`}
      >
        <Clock3 size={13} />
        {when}
      </div>

      <span className={`badge ${submitted ? "good" : cls}`}>
        {submitted ? "Attempted" : label}
      </span>

      <button
        type="button"
        className="sd-btn sd-btn-primary sd-btn-sm"
        onClick={() => onStartTest(test)}
        disabled={!isLive || submitted}
      >
        {isLive && !submitted ? <Play size={13} /> : <Lock size={13} />}
        {startLabel(test, label, isLive, submitted)}
      </button>
    </div>
  );
}

// "Available tests" page par bada card
function TestCard({ test, onStartTest, submitted }) {
  useMinuteTick();

  const [label, cls] = testStatus(test);
  const isLive = cls === "live";
  const countdown = isLive && !submitted ? countdownText(test) : null;
  const state = submitted ? "done" : cls;

  return (
    <article className={`sd-test-card sd-state-${state}`}>
      <div className="sd-test-card-top">
        <div className="sd-test-card-ico">
          {submitted ? <CheckCircle2 size={20} /> : <FlaskConical size={20} />}
        </div>

        <span className={`badge ${submitted ? "good" : cls}`}>
          {submitted ? "Attempted" : label}
        </span>
      </div>

      <h3>{test.title}</h3>
      <p>{test.description || "Coding assessment"}</p>

      {countdown && (
        <div className={`sd-chip ${countdown.urgent ? "urgent" : ""}`}>
          <Clock3 size={12} />
          {countdown.text}
        </div>
      )}

      <div className="sd-schedule">
        <div>
          <span>Starts</span>
          <strong>{shortDateTime(test.start_time)}</strong>
        </div>
        <div>
          <span>Ends</span>
          <strong>{shortDateTime(test.end_time)}</strong>
        </div>
      </div>

      <button
        type="button"
        className="sd-btn sd-btn-primary sd-btn-block"
        onClick={() => onStartTest(test)}
        disabled={!isLive || submitted}
      >
        {submitted ? (
          <>
            <CheckCircle2 size={15} /> Test submitted
          </>
        ) : isLive ? (
          <>
            <Play size={15} /> Start test
          </>
        ) : (
          <>
            <Lock size={15} /> {label === "Upcoming" ? "Not started yet" : "Test ended"}
          </>
        )}
      </button>
    </article>
  );
}

// Abhi chal rahe test ka bada banner (home ke top par)
function LiveBanner({ test, extra, onStartTest }) {
  useMinuteTick();

  const countdown = countdownText(test);

  return (
    <section className="sd-live">
      <div className="sd-live-main">
        <span className="sd-live-tag">
          <i /> Live now
        </span>

        <h2>{test.title}</h2>
        <p>{test.description || "Coding assessment"}</p>

        <div className="sd-live-meta">
          {countdown && (
            <span className={countdown.urgent ? "urgent" : ""}>
              <Clock3 size={14} />
              {countdown.text}
            </span>
          )}

          <span>
            <CalendarClock size={14} />
            Ends {shortDateTime(test.end_time)}
          </span>

          {extra > 0 && <span>+{extra} more live</span>}
        </div>
      </div>

      <button
        type="button"
        className="sd-btn sd-btn-light"
        onClick={() => onStartTest(test)}
      >
        <Play size={15} /> Start test
      </button>
    </section>
  );
}

/* ==========================================================
   SUBMISSIONS TABLE
   ========================================================== */

function SubmissionsTable({ rows, emptyText = "No submissions yet." }) {
  if (!rows?.length) {
    return (
      <EmptyState
        icon={FileCode2}
        title={emptyText}
        text="Your code submissions will show up here."
      />
    );
  }

  return (
    <div className="sd-table-wrap">
      <table className="sd-table">
        <thead>
          <tr>
            <th>Problem</th>
            <th className="sd-col-lang">Language</th>
            <th>Verdict</th>
            <th className="sd-right">Submitted</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((s, i) => (
            <tr key={s.submission_id ?? i}>
              <td className="sd-cell-title">
                {s.problem || s.problem_title || "—"}
                <span className="sd-lang-inline">{langLabel(s.language)}</span>
              </td>
              <td className="sd-col-lang">
                <span className="sd-lang">{langLabel(s.language)}</span>
              </td>
              <td>
                <span className={`badge ${verdictClass(s.verdict)}`}>
                  {s.verdict ? verdictLabel(s.verdict) : s.status || "—"}
                </span>
              </td>
              <td className="sd-right sd-muted" title={s.submitted_at ? new Date(s.submitted_at).toLocaleString() : ""}>
                {timeAgo(s.submitted_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ==========================================================
   PERFORMANCE PANEL
   ========================================================== */

function PerformancePanel({ submissions, accepted }) {
  const total = submissions.length;
  const rejected = total - accepted;
  const rate = total ? Math.round((accepted / total) * 100) : 0;

  const languages = useMemo(() => {
    const counts = {};

    submissions.forEach((s) => {
      const name = langLabel(s.language);
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [submissions]);

  if (!total) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No activity yet"
        text="Solve a problem to see your accuracy and languages here."
      />
    );
  }

  return (
    <div className="sd-perf">
      <div className="sd-perf-top">
        <div
          className="sd-ring"
          style={{ "--pct": `${rate}%` }}
          role="img"
          aria-label={`Acceptance rate ${rate} percent`}
        >
          <span>{rate}%</span>
        </div>

        <div className="sd-perf-legend">
          <div>
            <i className="good" />
            Accepted <strong>{accepted}</strong>
          </div>
          <div>
            <i className="bad" />
            Not accepted <strong>{rejected}</strong>
          </div>
        </div>
      </div>

      <div className="sd-perf-langs">
        <span className="sd-eyebrow">Languages used</span>

        {languages.map(([name, count]) => (
          <div className="sd-lang-row" key={name}>
            <span>{name}</span>
            <div className="sd-bar">
              <div style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <em>{count}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================
   RESULT CARD
   ========================================================== */

function ResultCard({ result }) {
  const marks = Number(result.awarded_marks || 0);
  const max = Number(result.max_marks || DEFAULT_MAX_MARKS);
  const percentage = max > 0 ? (marks / max) * 100 : 0;
  const tone = scoreTone(percentage);

  const passed = Number(result.test_cases_passed ?? 0);
  const totalCases = Number(result.test_cases_total ?? 0);
  const caseRate = totalCases > 0 ? (passed / totalCases) * 100 : 0;

  return (
    <article className="sd-result">
      <div className="sd-result-top">
        <div className="sd-test-card-ico">
          <Trophy size={20} />
        </div>

        <span className="badge good">Published</span>
      </div>

      <h3>
        {result.contest_title || result.test_title || "Assessment Result"}
      </h3>
      <p className="sd-result-problem">
        {result.problem_title || result.problem || "Coding assessment"}
      </p>

      <div className="sd-result-body">
        <div
          className={`sd-ring sd-ring-${tone}`}
          style={{ "--pct": `${Math.min(100, percentage)}%` }}
        >
          <span>{percentage.toFixed(0)}%</span>
        </div>

        <div className="sd-result-numbers">
          <div>
            <span>Marks</span>
            <strong>
              {marks} <em>/ {max}</em>
            </strong>
          </div>

          <div>
            <span>Test cases passed</span>
            <strong>
              {passed} <em>/ {totalCases}</em>
            </strong>
            <div className="sd-bar">
              <div style={{ width: `${caseRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="sd-feedback">
        <span className="sd-eyebrow">Teacher feedback</span>
        <p>{result.teacher_feedback || "No feedback provided."}</p>
      </div>

      {result.published_at && (
        <small className="sd-result-date">
          Published {new Date(result.published_at).toLocaleDateString()}
        </small>
      )}
    </article>
  );
}


function PasswordModal({
  test,
  password,
  setPassword,
  onClose,
  onUnlock,
  unlocking,
  error
}) {
  return (
    <div className="password-overlay">
      <div className="password-modal">
        <div className="password-icon">🔐</div>
        <h2>Test Protected</h2>
        <p className="password-test-name">{test.title}</p>
        <p className="password-description">
          Enter the password provided by your teacher.
        </p>

        <label>Test Password</label>
        <input
          type="password"
          value={password}
          autoFocus
          placeholder="Enter test password"
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !unlocking && onUnlock()}
        />

        {error && <div className="password-error">{error}</div>}

        <div className="password-actions">
          <button
            className="secondary-btn"
            onClick={onClose}
            disabled={unlocking}
          >
            Cancel
          </button>
          <button
            className="primary-btn"
            onClick={onUnlock}
            disabled={unlocking || !password.trim()}
          >
            {unlocking ? "Unlocking..." : "🔓 Unlock Test"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentDashboard({ onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");
  const [selectedTest, setSelectedTest] = useState(null);
  const [passwordTest, setPasswordTest] = useState(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [submittedTests, setSubmittedTests] = useState(getSubmittedTests);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [testFilter, setTestFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyVerdict, setHistoryVerdict] = useState("all");
  const [resultsSearch, setResultsSearch] = useState("");

  // Face: is session mein verify ho chuka?
  const [faceOk, setFaceOk] = useState(isFaceVerifiedThisSession);

  // Face setup ho chuka hai? null = abhi pata nahi, true/false = pata chal gaya
  const [faceEnrolled, setFaceEnrolled] = useState(null);

  const userId = data?.user?.user_id;

  const refreshDashboard = useCallback(async () => {
    const token = localStorage.getItem("codeshield_token");

    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API_BASE}/api/student/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Failed to load dashboard.");
      }

      setData(result);

      try {
        const attemptsResponse = await fetch(
          `${API_BASE}/api/student/attempts`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const attemptsData = await attemptsResponse.json().catch(() => ({}));

        if (
          attemptsResponse.ok &&
          Array.isArray(attemptsData.submitted_contest_ids)
        ) {
          const ids = attemptsData.submitted_contest_ids.map(String);

          localStorage.setItem(SUBMITTED_KEY, JSON.stringify(ids));
          setSubmittedTests(ids);
        }
      } catch {

      }
    } catch (e) {
      setError(e.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadResults = useCallback(async () => {
    const token = localStorage.getItem("codeshield_token");

    if (!token) {
      setResultsError("Please log in again.");
      return;
    }

    setResultsLoading(true);
    setResultsError("");

    try {
      const response = await fetch(`${API_BASE}/api/student/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to load results.");
      }

      setResults(result.results || []);
    } catch (e) {
      setResultsError(e.message);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    if (tab === "results") loadResults();
  }, [tab, loadResults]);

  /* ==========================================================
     FACE SETUP: SIRF EK BAAR
     Server batata hai ki face registered hai ya nahi.
     Registered hai => gate kabhi nahi dikhta.
     Registered nahi (naya student) => ek baar gate, phir kabhi nahi.
     ========================================================== */

  useEffect(() => {
    if (userId == null) return undefined;

    const key = faceKeyFor(userId);
    const savedFlag = localStorage.getItem(key) === "1";
    const token = localStorage.getItem("codeshield_token");
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/identity/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const status = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (!response.ok) {
          // Server se pata nahi chala: student ko rokna nahi
          setFaceEnrolled(true);
          return;
        }

        const { known, registered } = readFaceStatus(status);

        if (known) {
          if (registered) {
            localStorage.setItem(key, "1");
          } else {
            // Teacher ne face reset kiya ho to dobara setup
            localStorage.removeItem(key);
          }

          setFaceEnrolled(registered);
        } else {
          // Shape pehchana nahi gaya: local flag par chalo
          setFaceEnrolled(savedFlag);
        }
      } catch {
        if (!cancelled) setFaceEnrolled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* ==========================================================
     DERIVED DATA + FILTERS
     Saare hooks (useMemo) early return se PEHLE hone chahiye,
     warna React "order of Hooks changed" error deta hai aur
     page kala ho jata hai. Isliye `data` null ho tab bhi safe.
     ========================================================== */

  const tests = data?.available_tests || [];
  const submissions = data?.recent_submissions || [];

  const filteredTests = useMemo(() => {
    const q = testSearch.trim().toLowerCase();

    return tests.filter((test) => {
      const matchesSearch =
        !q ||
        test.title?.toLowerCase().includes(q) ||
        (test.description && test.description.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const [, cls] = testStatus(test);
      const submitted = submittedTests.includes(String(test.contest_id));

      if (testFilter === "all") return true;
      if (testFilter === "live") return cls === "live" && !submitted;
      if (testFilter === "upcoming") return cls === "upcoming";
      if (testFilter === "ended") return cls === "ended";
      if (testFilter === "attempted") return submitted;
      return true;
    });
  }, [tests, testSearch, testFilter, submittedTests]);

  const filteredSubmissions = useMemo(() => {
    const q = historySearch.trim().toLowerCase();

    return submissions.filter((s) => {
      const problemName = (s.problem || s.problem_title || "").toLowerCase();
      const matchesSearch = !q || problemName.includes(q);

      if (!matchesSearch) return false;

      const vClass = verdictClass(s.verdict);

      if (historyVerdict === "all") return true;
      if (historyVerdict === "accepted") return vClass === "good";
      if (historyVerdict === "rejected") return vClass === "bad";
      return true;
    });
  }, [submissions, historySearch, historyVerdict]);

  const filteredResults = useMemo(() => {
    const q = resultsSearch.trim().toLowerCase();

    return results.filter((r) => {
      if (!q) return true;

      const title = (r.contest_title || r.test_title || "").toLowerCase();
      const prob = (r.problem_title || r.problem || "").toLowerCase();

      return title.includes(q) || prob.includes(q);
    });
  }, [results, resultsSearch]);

  /* ==========================================================
     HANDLERS
     ========================================================== */

  const isTestSubmitted = (test) =>
    submittedTests.includes(String(test.contest_id));

  const handleStartTest = (test) => {
    const [status] = testStatus(test);

    if (status !== "Live" || isTestSubmitted(test)) return;

    setPasswordTest(test);
    setPassword("");
    setPasswordError("");
  };

  const handleUnlockTest = async () => {
    if (!passwordTest || unlocking) return;

    if (!password.trim()) {
      setPasswordError("Please enter the test password.");
      return;
    }

    const token = localStorage.getItem("codeshield_token");

    if (!token) {
      setPasswordError("Your login session has expired.");
      return;
    }

    setUnlocking(true);
    setPasswordError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/student/tests/${passwordTest.contest_id}/unlock`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password })
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to unlock test.");
      }

      setSelectedTest(passwordTest);
      setPasswordTest(null);
      setPassword("");
    } catch (e) {
      setPasswordError(e.message);
    } finally {
      setUnlocking(false);
    }
  };

  const handleBackFromTest = (wasSubmitted = false) => {
    const completed = selectedTest;

    setSelectedTest(null);

    if (wasSubmitted && completed?.contest_id != null) {
      const updated = [
        ...new Set([...getSubmittedTests(), String(completed.contest_id)])
      ];

      localStorage.setItem(SUBMITTED_KEY, JSON.stringify(updated));
      setSubmittedTests(updated);
    }

    setLoading(true);
    refreshDashboard();
  };

  // Face setup poora hua: ab is student se dobara nahi poocha jayega
  const handleFaceVerified = () => {
    if (userId != null) {
      localStorage.setItem(faceKeyFor(userId), "1");
    }

    setFaceEnrolled(true);
    setFaceOk(true);
  };

  /* ==========================================================
     EARLY RETURNS (iske neeche koi hook nahi hona chahiye)
     ========================================================== */

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Unable to load dashboard</h2>
        <p>{error}</p>
        <button className="primary-btn" onClick={refreshDashboard}>
          Retry
        </button>
        <button className="logout-btn" onClick={onLogout}>
          Back to Login
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="dashboard-error">No dashboard data available.</div>;
  }

  // Face status abhi check ho raha hai
  if (userId != null && faceEnrolled === null) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  // Sirf us student ko gate, jiska face abhi register nahi hua
  if (userId != null && faceEnrolled === false && !faceOk) {
    return (
      <LoginFaceGate
        onVerified={handleFaceVerified}
        onLogout={onLogout}
      />
    );
  }

  if (selectedTest) {
    return (
      <StudentTestPage
        test={selectedTest}
        onBack={handleBackFromTest}
        onLogout={onLogout}
      />
    );
  }

  const username = data.user?.username || "Student";

  const accepted = submissions.filter(
    (s) => verdictClass(s.verdict) === "good"
  ).length;

  const statusOf = (test) => testStatus(test)[1];

  const liveTests = tests
    .filter((test) => statusOf(test) === "live" && !isTestSubmitted(test))
    .sort((a, b) => new Date(a.end_time) - new Date(b.end_time));

  const stateRank = (test) =>
    isTestSubmitted(test)
      ? 3
      : { live: 0, upcoming: 1, ended: 2 }[statusOf(test)] ?? 2;

  const byState = (a, b) => stateRank(a) - stateRank(b);

  const homeTests = [...tests].sort(byState).slice(0, 4);
  const sortedFilteredTests = [...filteredTests].sort(byState);

  const testCounts = {
    all: tests.length,
    live: liveTests.length,
    upcoming: tests.filter((t) => statusOf(t) === "upcoming").length,
    ended: tests.filter((t) => statusOf(t) === "ended").length,
    attempted: tests.filter(isTestSubmitted).length
  };

  const historyCounts = {
    all: submissions.length,
    accepted,
    rejected: submissions.length - accepted
  };

  const acceptanceRate = submissions.length
    ? `${Math.round((accepted / submissions.length) * 100)}%`
    : "—";

  const renderTestCards = (items, emptyTitle) =>
    items.length === 0 ? (
      <div className="sd-card">
        <EmptyState
          icon={FlaskConical}
          title={emptyTitle}
          text="Tests published by your teacher will appear here."
        />
      </div>
    ) : (
      <div className="sd-test-grid">
        {items.map((test) => (
          <TestCard
            key={test.contest_id}
            test={test}
            onStartTest={handleStartTest}
            submitted={isTestSubmitted(test)}
          />
        ))}
      </div>
    );

  return (
    <>
      <DashboardLayout
        role="student"
        username={username}
        active={tab}
        onNavigate={setTab}
        onLogout={onLogout}
      >
        <div className="page sd-page">
          {/* ======================= HOME ======================= */}
          {tab === "home" && (
            <>
              <header className="sd-welcome">
                <div>
                  <span className="sd-eyebrow">{todayText()}</span>
                  <h1>
                    {greeting()}, <b>{username}</b>
                  </h1>
                  <p>
                    {liveTests.length > 0
                      ? `You have ${liveTests.length} live ${
                          liveTests.length === 1 ? "test" : "tests"
                        } waiting for you.`
                      : "Here is a quick look at your assessments and progress."}
                  </p>
                </div>

                <div className="sd-welcome-actions">
                  <button
                    type="button"
                    className="sd-btn sd-btn-ghost"
                    onClick={() => setTab("leaderboard")}
                  >
                    <Medal size={15} /> Leaderboard
                  </button>
                  <button
                    type="button"
                    className="sd-btn sd-btn-primary"
                    onClick={() => setTab("results")}
                  >
                    <Trophy size={15} /> My results
                  </button>
                </div>
              </header>

              {liveTests.length > 0 && (
                <LiveBanner
                  test={liveTests[0]}
                  extra={liveTests.length - 1}
                  onStartTest={handleStartTest}
                />
              )}

              <section className="sd-stats">
                <StatCard
                  icon={FlaskConical}
                  tone="blue"
                  label="Live tests"
                  value={liveTests.length}
                  hint={`${tests.length} available in total`}
                />
                <StatCard
                  icon={Target}
                  tone="violet"
                  label="Tests attempted"
                  value={submittedTests.length}
                  hint="Completed so far"
                />
                <StatCard
                  icon={FileCode2}
                  tone="amber"
                  label="Submissions"
                  value={submissions.length}
                  hint="Recent activity"
                />
                <StatCard
                  icon={CheckCircle2}
                  tone="green"
                  label="Acceptance rate"
                  value={acceptanceRate}
                  hint={`${accepted} accepted`}
                />
              </section>

              <div className="sd-layout">
                <div className="sd-col">
                  <section className="sd-card">
                    <CardHead
                      icon={FlaskConical}
                      title="Your tests"
                      hint="Live and upcoming assessments"
                      actionLabel="View all"
                      onAction={() => setTab("tests")}
                    />

                    {homeTests.length === 0 ? (
                      <EmptyState
                        icon={FlaskConical}
                        title="No tests available"
                        text="Tests published by your teacher will appear here."
                      />
                    ) : (
                      <div className="sd-test-list">
                        {homeTests.map((test) => (
                          <TestRow
                            key={test.contest_id}
                            test={test}
                            onStartTest={handleStartTest}
                            submitted={isTestSubmitted(test)}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="sd-card">
                    <CardHead
                      icon={History}
                      title="Recent submissions"
                      hint="Your latest code evaluations"
                      actionLabel="View history"
                      onAction={() => setTab("history")}
                    />

                    <SubmissionsTable rows={submissions.slice(0, 6)} />
                  </section>
                </div>

                <aside className="sd-col">
                  <div className="sd-notifications">
                    <NotificationsCard />
                  </div>

                  <section className="sd-card">
                    <CardHead
                      icon={TrendingUp}
                      title="Performance"
                      hint="Based on your recent submissions"
                    />

                    <PerformancePanel
                      submissions={submissions}
                      accepted={accepted}
                    />
                  </section>
                </aside>
              </div>
            </>
          )}

          {/* ======================= TESTS ======================= */}
          {tab === "tests" && (
            <>
              <PageHeader
                title="Assessments"
                subtitle="Browse live, upcoming and past coding tests."
              />

              <Toolbar
                search={testSearch}
                onSearch={setTestSearch}
                placeholder="Search by title or topic..."
                value={testFilter}
                onChange={setTestFilter}
                options={[
                  { id: "all", label: "All", count: testCounts.all },
                  { id: "live", label: "Live", count: testCounts.live },
                  { id: "upcoming", label: "Upcoming", count: testCounts.upcoming },
                  { id: "ended", label: "Ended", count: testCounts.ended },
                  { id: "attempted", label: "Attempted", count: testCounts.attempted }
                ]}
              />

              {renderTestCards(sortedFilteredTests, "No tests found")}
            </>
          )}

          {/* ===================== LEADERBOARD ===================== */}
          {tab === "leaderboard" && (
            <>
              <PageHeader
                title="Leaderboard"
                subtitle="See how you rank among your peers."
              />

              <Leaderboard />
            </>
          )}

          {/* ======================= HISTORY ======================= */}
          {tab === "history" && (
            <>
              <PageHeader
                title="Submission history"
                subtitle="All your past code executions and evaluations."
              />

              <Toolbar
                search={historySearch}
                onSearch={setHistorySearch}
                placeholder="Filter by problem title..."
                value={historyVerdict}
                onChange={setHistoryVerdict}
                options={[
                  { id: "all", label: "All", count: historyCounts.all },
                  { id: "accepted", label: "Accepted", count: historyCounts.accepted },
                  { id: "rejected", label: "Not accepted", count: historyCounts.rejected }
                ]}
              />

              <section className="sd-card sd-card-flush">
                <SubmissionsTable
                  rows={filteredSubmissions}
                  emptyText="No matching submissions"
                />
              </section>
            </>
          )}

          {/* ======================= RESULTS ======================= */}
          {tab === "results" && (
            <>
              <PageHeader
                title="My results"
                subtitle="Only results approved and published by your teacher appear here."
                action={
                  <button
                    type="button"
                    className="sd-btn sd-btn-ghost"
                    onClick={loadResults}
                    disabled={resultsLoading}
                  >
                    <RefreshCw
                      size={14}
                      className={resultsLoading ? "sd-spin" : ""}
                    />
                    {resultsLoading ? "Refreshing..." : "Refresh"}
                  </button>
                }
              />

              <Toolbar
                search={resultsSearch}
                onSearch={setResultsSearch}
                placeholder="Search by assessment or problem title..."
              />

              {resultsError && (
                <div className="sd-alert" role="alert">
                  {resultsError}
                </div>
              )}

              {resultsLoading ? (
                <div className="sd-card">
                  <EmptyState icon={Award} title="Loading published results..." />
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="sd-card">
                  <EmptyState
                    icon={Award}
                    title="No published results yet"
                    text={
                      resultsSearch
                        ? "No results match your search."
                        : "Your teacher has not published a result for you yet. Please check again later."
                    }
                  />
                </div>
              ) : (
                <div className="sd-test-grid">
                  {filteredResults.map((r, i) => (
                    <ResultCard
                      key={r.result_id ?? r.submission_id ?? i}
                      result={r}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DashboardLayout>

      {passwordTest && (
        <PasswordModal
          test={passwordTest}
          password={password}
          setPassword={setPassword}
          onClose={() => !unlocking && setPasswordTest(null)}
          onUnlock={handleUnlockTest}
          unlocking={unlocking}
          error={passwordError}
        />
      )}
    </>
  );
}

export default StudentDashboard;