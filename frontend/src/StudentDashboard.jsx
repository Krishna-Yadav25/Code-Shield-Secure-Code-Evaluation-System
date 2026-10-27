import { useCallback, useEffect, useState } from "react";

import DashboardLayout from "./DashboardLayout.jsx";

import StudentTestPage from "./StudentTestPage.jsx";

import { NotificationsCard } from "./NotificationBell.jsx";

import Leaderboard from "./Leaderboard.jsx";

import "./Dashboard.css";



const API_BASE = "http://localhost:5000";

const SUBMITTED_KEY = "codeshield_submitted_tests";




const DEFAULT_MAX_MARKS = 10;



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



function TestCard({ test, onStartTest, submitted }) {

const [label, cls] = testStatus(test);

const isLive = cls === "live";

const [, setTick] = useState(0);

useEffect(() => {

  const t = setInterval(() => setTick((n) => n + 1), 60000);

  return () => clearInterval(t);

}, []);

const countdown = isLive && !submitted ? countdownText(test) : null;



   return (

     <div className="test-card">

       <div className="test-top">

         <div className="test-icon">🧪</div>

         <span className={`badge ${submitted ? "good" : cls}`}>

           {submitted ? "Attempted" : label}

         </span>

       </div>

       <h3>{test.title}</h3>

       <p>{test.description || "Coding assessment"}</p>

       {countdown && (

         <div className={`test-countdown ${countdown.urgent ? "urgent" : ""}`}>

           ⏳ {countdown.text}

         </div>

       )}

       <div className="test-time">

         <span><strong>Starts</strong> {test.start_time ? new Date(test.start_time).toLocaleString() : "—"}</span>

         <span><strong>Ends</strong> {test.end_time ? new Date(test.end_time).toLocaleString() : "—"}</span>

       </div>

       <button

         className="primary-btn"

         onClick={() => onStartTest(test)}

         disabled={!isLive || submitted}

       >

         {submitted ? "✓ Test Submitted" : isLive ? "🔐 Start Test" : label === "Upcoming" ? "Test Not Started" : "Test Ended"}

       </button>

     </div>

   );

}



function SubmissionsTable({ rows }) {

   if (!rows?.length) {

     return <div className="empty-card">No submissions yet.</div>;

   }



   return (

     <div className="teacher-table-wrapper">

       <table className="teacher-data-table">

         <thead>

           <tr><th>Problem</th><th>Language</th><th>Status</th><th>Verdict</th><th>Date</th></tr>

         </thead>

         <tbody>

           {rows.map((s, i) => (

             <tr key={s.submission_id ?? i}>

               <td>{s.problem || s.problem_title || "—"}</td>

               <td>{s.language || "—"}</td>

               <td>{s.status || "—"}</td>

               <td><span className={`badge ${verdictClass(s.verdict)}`}>{s.verdict || "—"}</span></td>

               <td>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}</td>

             </tr>

           ))}

         </tbody>

       </table>

     </div>

   );

}



function PasswordModal({ test, password, setPassword, onClose, onUnlock, unlocking, error }) {

   return (

     <div className="password-overlay">

       <div className="password-modal">

         <div className="password-icon">🔐</div>

         <h2>Test Protected</h2>

         <p className="password-test-name">{test.title}</p>

         <p className="password-description">Enter the password provided by your teacher.</p>

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

           <button className="secondary-btn" onClick={onClose} disabled={unlocking}>Cancel</button>

           <button className="primary-btn" onClick={onUnlock} disabled={unlocking || !password.trim()}>

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

       if (!response.ok) throw new Error(result.error || "Failed to load dashboard.");

       setData(result);

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

       if (!response.ok) throw new Error(result.error || "Unable to load results.");




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
     if (data && Array.isArray(data.recent_submissions) && data.recent_submissions.length === 0) {
       localStorage.removeItem(SUBMITTED_KEY);
       setSubmittedTests([]);
     }
   }, [data]);



   useEffect(() => {

     if (tab === "results") loadResults();

   }, [tab, loadResults]);



const isTestSubmitted = (test) => submittedTests.includes(String(test.contest_id));



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

       if (!response.ok) throw new Error(result.error || "Unable to unlock test.");



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

const updated = [...new Set([

         ...getSubmittedTests(),

         String(completed.contest_id)

       ])];

       localStorage.setItem(SUBMITTED_KEY, JSON.stringify(updated));

       setSubmittedTests(updated);

     }



     setLoading(true);

     refreshDashboard();

   };



   if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;



   if (error) {

     return (

       <div className="dashboard-error">

         <h2>Unable to load dashboard</h2>

         <p>{error}</p>

         <button className="primary-btn" onClick={refreshDashboard}>Retry</button>

         <button className="logout-btn" onClick={onLogout}>Back to Login</button>

       </div>

     );

   }



   if (!data) return <div className="dashboard-error">No dashboard data available.</div>;



   if (selectedTest) {

     return <StudentTestPage test={selectedTest} onBack={handleBackFromTest} />;

   }



const username = data.user?.username || "Student";

const tests = data.available_tests || [];

const submissions = data.recent_submissions || [];

const accepted = submissions.filter((s) => verdictClass(s.verdict) === "good").length;



const renderTestCards = (items) => items.length === 0 ? (

     <div className="empty-card">No tests available.</div>

   ) : (

     <div className="test-grid">

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

         <div className="page">

           {tab === "home" && (

             <>

               <section className="hero-card">

                 <h2>Welcome back, {username} 👋</h2>

                 <p>View your coding assessments, submission history and published results.</p>

                 <div className="hero-actions">

                   <button className="primary-btn" onClick={() => setTab("results")}>

                     🏆 View Results

                   </button>

                 </div>

               </section>



               <NotificationsCard />



               <section className="stats-grid">

                 <div className="stat-card"><div className="stat-ico">🧪</div><div><h3>{tests.length}</h3><p>Available tests</p></div></div>

                 <div className="stat-card"><div className="stat-ico">📝</div><div><h3>{submissions.length}</h3><p>Recent submissions</p></div></div>

                 <div className="stat-card"><div className="stat-ico">✅</div><div><h3>{accepted}</h3><p>Accepted</p></div></div>

                 <div className="stat-card"><div className="stat-ico">🎯</div><div><h3>{submittedTests.length}</h3><p>Tests attempted</p></div></div>

               </section>



               <section>

                 <div className="sec-head">

                   <h2>Available Tests</h2>

                   <button onClick={() => setTab("tests")}>View all</button>

                 </div>

                 {renderTestCards(tests.slice(0, 3))}

               </section>



               <section>

                 <div className="sec-head">

                   <h2>Recent Submissions</h2>

                   <button onClick={() => setTab("history")}>View history</button>

                 </div>

                 <div className="submission-card"><SubmissionsTable rows={submissions.slice(0, 5)} /></div>

               </section>

             </>

           )}



           {tab === "tests" && (

             <section>

               <div className="sec-head"><h2>Available Tests</h2></div>

               {renderTestCards(tests)}

             </section>

           )}



           {tab === "leaderboard" && (

             <section>

               <div className="sec-head"><h2>Leaderboard</h2></div>

               <Leaderboard />

             </section>

           )}



           {tab === "history" && (

             <section>

               <div className="sec-head"><h2>Submission History</h2></div>

               <div className="submission-card"><SubmissionsTable rows={submissions} /></div>

             </section>

           )}



           {tab === "results" && (

             <section>

               <div className="sec-head">

                 <div>

                   <h2>My Results</h2>

                   <p>Only results approved and published by your teacher appear here.</p>

                 </div>

                 <button onClick={loadResults} disabled={resultsLoading}>

                   {resultsLoading ? "Loading..." : "Refresh"}

                 </button>

               </div>



               {resultsError && <div className="dashboard-error"><p>{resultsError}</p></div>}



               {resultsLoading ? (

                 <div className="empty-card">Loading published results...</div>

               ) : results.length === 0 ? (

                 <div className="empty-card">

                   <h3>No published results yet</h3>

                   <p>Your teacher has not published a result for you yet. Please check again later.</p>

                 </div>

               ) : (

                 <div className="test-grid">

                   {results.map((r, i) => {

const marks = Number(r.awarded_marks || 0);

const max = Number(r.max_marks || DEFAULT_MAX_MARKS);

const percentage = max > 0 ? (marks / max) * 100 : 0;



                     return (

                       <article className="test-card" key={r.result_id ?? r.submission_id ?? i}>

                         <div className="test-top">

                           <div className="test-icon">🏆</div>

                           <span className="badge good">Published</span>

                         </div>

                         <h3>{r.contest_title || r.test_title || "Assessment Result"}</h3>

                         <p>{r.problem_title || r.problem || "Coding assessment"}</p>



                         <div className="stats-grid">

                           <div className="stat-card">

                             <div><h3>{marks} / {max}</h3><p>Marks</p></div>

                           </div>

                           <div className="stat-card">

                             <div><h3>{percentage.toFixed(1)}%</h3><p>Percentage</p></div>

                           </div>

                           <div className="stat-card">

                             <div><h3>{r.test_cases_passed ?? 0} / {r.test_cases_total ?? 0}</h3><p>Test cases passed</p></div>

                           </div>

                         </div>



                         <p><strong>Teacher feedback:</strong> {r.teacher_feedback || "No feedback provided."}</p>

                         {r.published_at && (

                           <p><small>Published: {new Date(r.published_at).toLocaleString()}</small></p>

                         )}

                       </article>

                     );

                   })}

                 </div>

               )}

             </section>

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