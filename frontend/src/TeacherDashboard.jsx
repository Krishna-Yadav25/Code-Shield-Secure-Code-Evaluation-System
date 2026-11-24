// import { useEffect, useMemo, useState } from "react";
// import {
//   AlertTriangle,
//   ArrowRight,
//   CalendarClock,
//   CheckCircle2,
//   Clock3,
//   FileCode2,
//   FlaskConical,
//   Inbox,
//   Layers,
//   Lightbulb,
//   Plus,
//   Radio,
//   Search,
//   Sparkles,
//   TrendingUp
// } from "lucide-react";
// import DashboardLayout from "./DashboardLayout.jsx";
// import TeacherTestPage from "./TeacherTestPage.jsx";
// import AIQuestionGenerator from "./Aiquestiongenerator.jsx";
// import "./Dashboard.css";
// import "./TeacherDashboard.css";

// const API_BASE = "http://localhost:5000";

// /* ==============================================================
//    HELPERS
//    ============================================================== */

// // "active" | "upcoming" | "ended"
// function testState(test, now = Date.now()) {
//   const start = new Date(test.start_time).getTime();
//   const end = new Date(test.end_time).getTime();

//   if (now > end) return "ended";
//   if (now >= start) return "active";
//   return "upcoming";
// }

// const STATE_LABEL = { active: "Active", upcoming: "Upcoming", ended: "Ended" };
// const STATE_BADGE = { active: "live", upcoming: "upcoming", ended: "ended" };
// const STATE_RANK = { active: 0, upcoming: 1, ended: 2 };

// function greeting() {
//   const hour = new Date().getHours();

//   if (hour < 12) return "Good morning";
//   if (hour < 17) return "Good afternoon";
//   return "Good evening";
// }

// function todayText() {
//   return new Date().toLocaleDateString(undefined, {
//     weekday: "long",
//     day: "numeric",
//     month: "long"
//   });
// }

// function shortDateTime(value) {
//   if (!value) return "—";

//   const date = new Date(value);

//   if (Number.isNaN(date.getTime())) return "—";

//   return date.toLocaleString(undefined, {
//     day: "numeric",
//     month: "short",
//     hour: "numeric",
//     minute: "2-digit"
//   });
// }

// function durationText(ms) {
//   if (!Number.isFinite(ms) || ms <= 0) return "";

//   const totalMinutes = Math.round(ms / 60000);
//   const days = Math.floor(totalMinutes / 1440);
//   const hours = Math.floor((totalMinutes % 1440) / 60);
//   const minutes = totalMinutes % 60;

//   if (days > 0) return `${days}d ${hours}h`;
//   if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
//   return `${minutes}m`;
// }

// function endsInText(test, now = Date.now()) {
//   const left = new Date(test.end_time).getTime() - now;

//   if (!Number.isFinite(left) || left <= 0) return null;

//   return {
//     text: `Ends in ${durationText(left)}`,
//     urgent: left < 60 * 60 * 1000
//   };
// }

// /* ==============================================================
//    SMALL BUILDING BLOCKS
//    ============================================================== */

// function PageHeader({ title, subtitle, action }) {
//   return (
//     <header className="td-page-head">
//       <div>
//         <h1>{title}</h1>
//         {subtitle && <p>{subtitle}</p>}
//       </div>

//       {action}
//     </header>
//   );
// }

// function CardHead({ icon: Icon, title, hint, actionLabel, onAction }) {
//   return (
//     <div className="td-card-head">
//       <div className="td-card-title">
//         {Icon && (
//           <span className="td-card-title-ico">
//             <Icon size={15} />
//           </span>
//         )}

//         <div>
//           <h2>{title}</h2>
//           {hint && <span>{hint}</span>}
//         </div>
//       </div>

//       {actionLabel && (
//         <button type="button" className="td-link-btn" onClick={onAction}>
//           {actionLabel}
//           <ArrowRight size={14} />
//         </button>
//       )}
//     </div>
//   );
// }

// function StatCard({ icon: Icon, tone, label, value, hint }) {
//   return (
//     <div className={`td-stat td-tone-${tone}`}>
//       <div className="td-stat-ico">
//         <Icon size={20} />
//       </div>

//       <div className="td-stat-body">
//         <span className="td-stat-label">{label}</span>
//         <strong>{value}</strong>
//         {hint && <small>{hint}</small>}
//       </div>
//     </div>
//   );
// }

// function EmptyState({ icon: Icon = Inbox, title, text, action }) {
//   return (
//     <div className="td-empty">
//       <div className="td-empty-ico">
//         <Icon size={22} />
//       </div>
//       <h3>{title}</h3>
//       {text && <p>{text}</p>}
//       {action}
//     </div>
//   );
// }

// function Toolbar({ search, onSearch, placeholder, options, value, onChange }) {
//   return (
//     <div className="td-toolbar">
//       <div className="td-search">
//         <Search size={16} />
//         <input
//           type="text"
//           placeholder={placeholder}
//           value={search}
//           onChange={(event) => onSearch(event.target.value)}
//         />
//       </div>

//       <div className="td-pills" role="tablist">
//         {options.map((option) => (
//           <button
//             key={option.id}
//             type="button"
//             role="tab"
//             aria-selected={value === option.id}
//             className={`td-pill ${value === option.id ? "active" : ""}`}
//             onClick={() => onChange(option.id)}
//           >
//             {option.label}
//             <em>{option.count}</em>
//           </button>
//         ))}
//       </div>
//     </div>
//   );
// }

// /* ==============================================================
//    TEST ROW (home) + TEST CARD (tests tab)
//    ============================================================== */

// function TestRow({ test, onManage }) {
//   const state = testState(test);
//   const ends = state === "active" ? endsInText(test) : null;

//   return (
//     <div className={`td-test-row td-state-${state}`}>
//       <div className="td-test-row-ico">
//         <FlaskConical size={18} />
//       </div>

//       <div className="td-test-row-main">
//         <strong>{test.title}</strong>
//         <span>
//           {test.problem_count || 0} problems · {test.submission_count || 0}{" "}
//           submissions
//         </span>
//       </div>

//       <div className={`td-test-row-when ${ends?.urgent ? "urgent" : ""}`}>
//         <Clock3 size={13} />
//         {state === "active"
//           ? ends?.text || "Active"
//           : state === "upcoming"
//             ? `Starts ${shortDateTime(test.start_time)}`
//             : `Ended ${shortDateTime(test.end_time)}`}
//       </div>

//       <span className={`badge ${STATE_BADGE[state]}`}>
//         {STATE_LABEL[state]}
//       </span>

//       <button
//         type="button"
//         className="td-btn td-btn-ghost td-btn-sm"
//         onClick={onManage}
//       >
//         Manage <ArrowRight size={13} />
//       </button>
//     </div>
//   );
// }

// function TestCard({ test, onManage }) {
//   const state = testState(test);
//   const ends = state === "active" ? endsInText(test) : null;

//   return (
//     <article className={`td-test-card td-state-${state}`}>
//       <div className="td-test-card-top">
//         <div className="td-test-card-ico">
//           <FlaskConical size={20} />
//         </div>

//         <span className={`badge ${STATE_BADGE[state]}`}>
//           {STATE_LABEL[state]}
//         </span>
//       </div>

//       <h3>{test.title}</h3>
//       <p>{test.description || "Coding assessment"}</p>

//       {ends && (
//         <div className={`td-chip ${ends.urgent ? "urgent" : ""}`}>
//           <Clock3 size={12} />
//           {ends.text}
//         </div>
//       )}

//       <div className="td-counts">
//         <div>
//           <Layers size={15} />
//           <strong>{test.problem_count || 0}</strong>
//           <span>Problems</span>
//         </div>
//         <div>
//           <FileCode2 size={15} />
//           <strong>{test.submission_count || 0}</strong>
//           <span>Submissions</span>
//         </div>
//       </div>

//       <div className="td-schedule">
//         <div>
//           <span>Starts</span>
//           <strong>{shortDateTime(test.start_time)}</strong>
//         </div>
//         <div>
//           <span>Ends</span>
//           <strong>{shortDateTime(test.end_time)}</strong>
//         </div>
//       </div>

//       <button
//         type="button"
//         className="td-btn td-btn-primary td-btn-block"
//         onClick={onManage}
//       >
//         Manage test <ArrowRight size={15} />
//       </button>
//     </article>
//   );
// }

// /* ==============================================================
//    TEACHER DASHBOARD
//    ============================================================== */

// function TeacherDashboard({ onLogout }) {
//   const [data, setData] = useState(null);
//   const [tab, setTab] = useState("home");
//   const [selectedTest, setSelectedTest] = useState(null);

//   const [title, setTitle] = useState("");
//   const [description, setDescription] = useState("");
//   const [startTime, setStartTime] = useState("");
//   const [endTime, setEndTime] = useState("");

//   const [message, setMessage] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [testSearch, setTestSearch] = useState("");
//   const [testFilter, setTestFilter] = useState("all");
//   const [, setTick] = useState(0);

//   const getToken = () => localStorage.getItem("codeshield_token");

//   /* ==========================================================
//      DERIVED DATA
//      IMPORTANT: saare hooks (useState, useEffect, useMemo) kisi bhi
//      early `return` se PEHLE hone chahiye, warna React error deta hai:
//      "Rendered more hooks than during the previous render".
//      ========================================================== */

//   const tests = useMemo(() => data?.tests || [], [data]);

//   const filteredTests = useMemo(() => {
//     const q = testSearch.trim().toLowerCase();

//     return tests
//       .filter((test) => {
//         const matchesSearch =
//           !q ||
//           test.title?.toLowerCase().includes(q) ||
//           (test.description && test.description.toLowerCase().includes(q));

//         if (!matchesSearch) return false;

//         if (testFilter === "all") return true;

//         return testState(test) === testFilter;
//       })
//       .sort((a, b) => STATE_RANK[testState(a)] - STATE_RANK[testState(b)]);
//   }, [tests, testSearch, testFilter]);

//   // Countdown har minute taaza ho
//   useEffect(() => {
//     const timer = setInterval(() => setTick((n) => n + 1), 60000);
//     return () => clearInterval(timer);
//   }, []);

//   /* ==========================================================
//      LOAD DASHBOARD
//      ========================================================== */

//   const loadDashboard = async () => {
//     try {
//       const response = await fetch(`${API_BASE}/api/teacher/dashboard`, {
//         headers: { Authorization: `Bearer ${getToken()}` }
//       });

//       const result = await response.json();

//       if (!response.ok) {
//         throw new Error(result.error || "Failed to load dashboard");
//       }

//       setData(result);
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadDashboard();
//   }, []);

//   /* ==========================================================
//      CREATE TEST (manual)
//      ========================================================== */

//   const createTest = async (event) => {
//     event.preventDefault();
//     setMessage("");
//     setError("");

//     if (new Date(endTime) <= new Date(startTime)) {
//       setError("End time must be after the start time.");
//       return;
//     }

//     try {
//       const response = await fetch(`${API_BASE}/api/teacher/tests`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${getToken()}`
//         },
//         body: JSON.stringify({
//           title,
//           description,
//           start_time: startTime,
//           end_time: endTime
//         })
//       });

//       const result = await response.json();

//       if (!response.ok) {
//         throw new Error(result.error || "Could not create test");
//       }

//       setMessage("Test created successfully! Open it from My tests to add problems.");
//       setTitle("");
//       setDescription("");
//       setStartTime("");
//       setEndTime("");

//       await loadDashboard();
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   // AI se test + questions save hone ke baad
//   const handleAISaved = async () => {
//     await loadDashboard();
//     setTab("tests");
//   };

//   const openManage = (test) => {
//     setSelectedTest(test);
//     setTab("manage");
//   };

//   /* ==========================================================
//      EARLY RETURNS (hooks ke BAAD)
//      ========================================================== */

//   if (loading) {
//     return <div className="dashboard-loading">Loading CodeShield...</div>;
//   }

//   if (error && !data) {
//     return (
//       <div className="dashboard-error">
//         <h2>Unable to load dashboard</h2>
//         <p>{error}</p>
//         <button
//           className="secondary-btn"
//           onClick={onLogout}
//           style={{ maxWidth: "180px" }}
//         >
//           Back to Login
//         </button>
//       </div>
//     );
//   }

//   const username = data?.user?.username || "Teacher";

//   /* ---------- MANAGE A TEST ---------- */

//   if (tab === "manage" && selectedTest) {
//     return (
//       <DashboardLayout
//         role="teacher"
//         username={username}
//         active="manage"
//         onNavigate={setTab}
//         onLogout={onLogout}
//       >
//         <TeacherTestPage
//           test={selectedTest}
//           username={username}
//           onBack={() => {
//             setSelectedTest(null);
//             setTab("tests");
//             loadDashboard();
//           }}
//         />
//       </DashboardLayout>
//     );
//   }

//   /* ---------- NUMBERS FOR THE PAGE ---------- */

//   const now = Date.now();

//   const activeTests = tests
//     .filter((test) => testState(test, now) === "active")
//     .sort((a, b) => new Date(a.end_time) - new Date(b.end_time));

//   const counts = {
//     all: tests.length,
//     active: activeTests.length,
//     upcoming: tests.filter((t) => testState(t, now) === "upcoming").length,
//     ended: tests.filter((t) => testState(t, now) === "ended").length
//   };

//   const totalProblems = tests.reduce(
//     (total, test) => total + Number(test.problem_count || 0),
//     0
//   );

//   const totalSubmissions =
//     data?.total_submissions ??
//     tests.reduce((total, test) => total + Number(test.submission_count || 0), 0);

//   const homeTests = [...tests]
//     .sort((a, b) => STATE_RANK[testState(a, now)] - STATE_RANK[testState(b, now)])
//     .slice(0, 5);

//   // "Dhyan dene wali baatein": teacher ko kya theek karna chahiye
//   const attention = [];

//   tests.forEach((test) => {
//     const state = testState(test, now);

//     if (state === "ended") return;

//     if (!Number(test.problem_count || 0)) {
//       attention.push({
//         id: `np-${test.contest_id}`,
//         level: state === "active" ? "bad" : "warn",
//         title: test.title,
//         text:
//           state === "active"
//             ? "Active but has no problems. Students cannot attempt it."
//             : "No problems added yet.",
//         test
//       });
//     } else if (state === "active") {
//       const ends = endsInText(test, now);

//       if (ends?.urgent) {
//         attention.push({
//           id: `soon-${test.contest_id}`,
//           level: "warn",
//           title: test.title,
//           text: `${ends.text}. Monitor students and results.`,
//           test
//         });
//       }
//     }
//   });

//   const topTests = [...tests]
//     .filter((test) => Number(test.submission_count || 0) > 0)
//     .sort((a, b) => Number(b.submission_count) - Number(a.submission_count))
//     .slice(0, 5);

//   const topMax = topTests.length ? Number(topTests[0].submission_count) : 1;

//   const durationPreview =
//     startTime && endTime
//       ? durationText(new Date(endTime) - new Date(startTime))
//       : "";

//   /* ---------- MAIN ---------- */

//   return (
//     <DashboardLayout
//       role="teacher"
//       username={username}
//       active={tab}
//       onNavigate={setTab}
//       onLogout={onLogout}
//     >
//       <div className="page td-page">
//         {/* ======================= HOME ======================= */}
//         {tab === "home" && (
//           <>
//             <header className="td-welcome">
//               <div>
//                 <span className="td-eyebrow">{todayText()}</span>
//                 <h1>
//                   {greeting()}, <b>{username}</b>
//                 </h1>
//                 <p>
//                   {activeTests.length > 0
//                     ? `${activeTests.length} ${
//                         activeTests.length === 1 ? "test is" : "tests are"
//                       } running right now.`
//                     : "Manage assessments, problems and student submissions from one place."}
//                 </p>
//               </div>

//               <div className="td-welcome-actions">
//                 <button
//                   type="button"
//                   className="td-btn td-btn-ghost"
//                   onClick={() => setTab("create")}
//                 >
//                   <Plus size={15} /> Create test
//                 </button>
//                 <button
//                   type="button"
//                   className="td-btn td-btn-primary"
//                   onClick={() => setTab("ai")}
//                 >
//                   <Sparkles size={15} /> Create with AI
//                 </button>
//               </div>
//             </header>

//             {activeTests.length > 0 && (
//               <section className="td-live">
//                 <div className="td-live-main">
//                   <span className="td-live-tag">
//                     <i /> Active now
//                   </span>

//                   <h2>{activeTests[0].title}</h2>
//                   <p>{activeTests[0].description || "Coding assessment"}</p>

//                   <div className="td-live-meta">
//                     {endsInText(activeTests[0], now) && (
//                       <span
//                         className={
//                           endsInText(activeTests[0], now).urgent ? "urgent" : ""
//                         }
//                       >
//                         <Clock3 size={14} />
//                         {endsInText(activeTests[0], now).text}
//                       </span>
//                     )}
//                     <span>
//                       <Layers size={14} />
//                       {activeTests[0].problem_count || 0} problems
//                     </span>
//                     <span>
//                       <FileCode2 size={14} />
//                       {activeTests[0].submission_count || 0} submissions
//                     </span>
//                     {activeTests.length > 1 && (
//                       <span>+{activeTests.length - 1} more active</span>
//                     )}
//                   </div>
//                 </div>

//                 <button
//                   type="button"
//                   className="td-btn td-btn-light"
//                   onClick={() => openManage(activeTests[0])}
//                 >
//                   Monitor test <ArrowRight size={15} />
//                 </button>
//               </section>
//             )}

//             <section className="td-stats">
//               <StatCard
//                 icon={FlaskConical}
//                 tone="blue"
//                 label="Total tests"
//                 value={counts.all}
//                 hint={`${counts.upcoming} upcoming · ${counts.ended} ended`}
//               />
//               <StatCard
//                 icon={Radio}
//                 tone="green"
//                 label="Active now"
//                 value={counts.active}
//                 hint="Students can attempt"
//               />
//               <StatCard
//                 icon={FileCode2}
//                 tone="amber"
//                 label="Submissions"
//                 value={totalSubmissions}
//                 hint="Across all tests"
//               />
//               <StatCard
//                 icon={Layers}
//                 tone="violet"
//                 label="Problems"
//                 value={totalProblems}
//                 hint={
//                   counts.all
//                     ? `${(totalProblems / counts.all).toFixed(1)} per test`
//                     : "No tests yet"
//                 }
//               />
//             </section>

//             <div className="td-layout">
//               <div className="td-col">
//                 <section className="td-card">
//                   <CardHead
//                     icon={FlaskConical}
//                     title="Your tests"
//                     hint="Active and upcoming first"
//                     actionLabel="View all"
//                     onAction={() => setTab("tests")}
//                   />

//                   {homeTests.length === 0 ? (
//                     <EmptyState
//                       icon={FlaskConical}
//                       title="No tests created yet"
//                       text="Create your first assessment manually or let AI generate the questions."
//                       action={
//                         <button
//                           type="button"
//                           className="td-btn td-btn-primary td-btn-sm"
//                           onClick={() => setTab("create")}
//                         >
//                           <Plus size={14} /> Create test
//                         </button>
//                       }
//                     />
//                   ) : (
//                     <div className="td-test-list">
//                       {homeTests.map((test) => (
//                         <TestRow
//                           key={test.contest_id}
//                           test={test}
//                           onManage={() => openManage(test)}
//                         />
//                       ))}
//                     </div>
//                   )}
//                 </section>
//               </div>

//               <aside className="td-col">
//                 <section className="td-card">
//                   <CardHead
//                     icon={AlertTriangle}
//                     title="Needs attention"
//                     hint="Things worth checking"
//                   />

//                   {attention.length === 0 ? (
//                     <div className="td-allgood">
//                       <CheckCircle2 size={18} />
//                       <div>
//                         <strong>Everything looks good</strong>
//                         <span>No issues found in your tests.</span>
//                       </div>
//                     </div>
//                   ) : (
//                     <div className="td-attn-list">
//                       {attention.map((item) => (
//                         <button
//                           type="button"
//                           key={item.id}
//                           className={`td-attn td-attn-${item.level}`}
//                           onClick={() => openManage(item.test)}
//                         >
//                           <AlertTriangle size={15} />
//                           <div>
//                             <strong>{item.title}</strong>
//                             <span>{item.text}</span>
//                           </div>
//                           <ArrowRight size={14} />
//                         </button>
//                       ))}
//                     </div>
//                   )}
//                 </section>

//                 <section className="td-card">
//                   <CardHead
//                     icon={TrendingUp}
//                     title="Submissions by test"
//                     hint="Most active tests"
//                   />

//                   {topTests.length === 0 ? (
//                     <EmptyState
//                       icon={TrendingUp}
//                       title="No submissions yet"
//                       text="Activity will appear once students start attempting."
//                     />
//                   ) : (
//                     <div className="td-bars">
//                       {topTests.map((test) => (
//                         <div className="td-bar-row" key={test.contest_id}>
//                           <div className="td-bar-top">
//                             <span title={test.title}>{test.title}</span>
//                             <em>{test.submission_count}</em>
//                           </div>
//                           <div className="td-bar">
//                             <div
//                               style={{
//                                 width: `${(Number(test.submission_count) / topMax) * 100}%`
//                               }}
//                             />
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   )}
//                 </section>
//               </aside>
//             </div>
//           </>
//         )}

//         {/* ======================= CREATE ======================= */}
//         {tab === "create" && (
//           <>
//             <PageHeader
//               title="Create new test"
//               subtitle="Set the title and schedule. You can add problems right after."
//             />

//             <div className="td-create">
//               <form className="td-card td-form" onSubmit={createTest}>
//                 <div className="td-field">
//                   <label htmlFor="td-title">Test title</label>
//                   <input
//                     id="td-title"
//                     type="text"
//                     placeholder="Example: DSA Mid Semester Test"
//                     value={title}
//                     onChange={(e) => setTitle(e.target.value)}
//                     required
//                   />
//                 </div>

//                 <div className="td-field">
//                   <label htmlFor="td-desc">Description</label>
//                   <textarea
//                     id="td-desc"
//                     placeholder="Describe this assessment..."
//                     value={description}
//                     onChange={(e) => setDescription(e.target.value)}
//                   />
//                 </div>

//                 <div className="td-field-row">
//                   <div className="td-field">
//                     <label htmlFor="td-start">Start time</label>
//                     <input
//                       id="td-start"
//                       type="datetime-local"
//                       value={startTime}
//                       onChange={(e) => setStartTime(e.target.value)}
//                       required
//                     />
//                   </div>

//                   <div className="td-field">
//                     <label htmlFor="td-end">End time</label>
//                     <input
//                       id="td-end"
//                       type="datetime-local"
//                       value={endTime}
//                       onChange={(e) => setEndTime(e.target.value)}
//                       required
//                     />
//                   </div>
//                 </div>

//                 {durationPreview && (
//                   <div className="td-duration">
//                     <CalendarClock size={14} />
//                     Test duration: <strong>{durationPreview}</strong>
//                   </div>
//                 )}

//                 {message && (
//                   <div className="td-alert td-alert-ok" role="status">
//                     <CheckCircle2 size={15} /> {message}
//                   </div>
//                 )}
//                 {error && (
//                   <div className="td-alert td-alert-bad" role="alert">
//                     <AlertTriangle size={15} /> {error}
//                   </div>
//                 )}

//                 <div className="td-form-actions">
//                   <button className="td-btn td-btn-primary" type="submit">
//                     <Plus size={15} /> Create test
//                   </button>

//                   <button
//                     className="td-btn td-btn-ghost"
//                     type="button"
//                     onClick={() => setTab("ai")}
//                   >
//                     <Sparkles size={15} /> Generate with AI instead
//                   </button>
//                 </div>
//               </form>

//               <aside className="td-card td-tips">
//                 <CardHead icon={Lightbulb} title="Quick tips" />

//                 <ul>
//                   <li>
//                     <strong>Add problems next.</strong> After creating, open the
//                     test from <em>My tests</em> and add problems with visible and
//                     hidden test cases.
//                   </li>
//                   <li>
//                     <strong>Set a test password.</strong> Students enter it to
//                     unlock the test when they start.
//                   </li>
//                   <li>
//                     <strong>Use AI for speed.</strong> The AI generator creates
//                     questions and test cases you can review before publishing.
//                   </li>
//                 </ul>
//               </aside>
//             </div>
//           </>
//         )}

//         {/* ======================= AI ======================= */}
//         {tab === "ai" && (
//           <>
//             <PageHeader
//               title="Create test with AI"
//               subtitle="Generate questions with visible and hidden test cases, then publish the test for students."
//             />

//             <AIQuestionGenerator onSaved={handleAISaved} />
//           </>
//         )}

//         {/* ======================= MY TESTS ======================= */}
//         {tab === "tests" && (
//           <>
//             <PageHeader
//               title={`My assessments (${tests.length})`}
//               subtitle="Manage your coding assessments, monitor participants and results."
//               action={
//                 <button
//                   type="button"
//                   className="td-btn td-btn-primary"
//                   onClick={() => setTab("create")}
//                 >
//                   <Plus size={15} /> New test
//                 </button>
//               }
//             />

//             <Toolbar
//               search={testSearch}
//               onSearch={setTestSearch}
//               placeholder="Search test by title or description..."
//               value={testFilter}
//               onChange={setTestFilter}
//               options={[
//                 { id: "all", label: "All", count: counts.all },
//                 { id: "active", label: "Active", count: counts.active },
//                 { id: "upcoming", label: "Upcoming", count: counts.upcoming },
//                 { id: "ended", label: "Ended", count: counts.ended }
//               ]}
//             />

//             {filteredTests.length === 0 ? (
//               <div className="td-card">
//                 <EmptyState
//                   icon={FlaskConical}
//                   title={
//                     testSearch ? "No tests match your search" : "No tests found"
//                   }
//                   text={
//                     testSearch
//                       ? "Try a different keyword or filter."
//                       : "Create a test to see it here."
//                   }
//                 />
//               </div>
//             ) : (
//               <div className="td-test-grid">
//                 {filteredTests.map((test) => (
//                   <TestCard
//                     key={test.contest_id}
//                     test={test}
//                     onManage={() => openManage(test)}
//                   />
//                 ))}
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </DashboardLayout>
//   );
// }

// export default TeacherDashboard;

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FileCode2,
  FlaskConical,
  Inbox,
  Layers,
  Lightbulb,
  Lock,
  Plus,
  Radio,
  Search,
  Sparkles,
  TrendingUp
} from "lucide-react";
import DashboardLayout from "./DashboardLayout.jsx";
import TeacherTestPage from "./TeacherTestPage.jsx";
import AIQuestionGenerator from "./Aiquestiongenerator.jsx";
import "./Dashboard.css";
import "./TeacherDashboard.css";

const API_BASE = "http://localhost:5000";

/* ==============================================================
   HELPERS
   ============================================================== */

// "active" | "upcoming" | "ended"
function testState(test, now = Date.now()) {
  const start = new Date(test.start_time).getTime();
  const end = new Date(test.end_time).getTime();

  if (now > end) return "ended";
  if (now >= start) return "active";
  return "upcoming";
}

const STATE_LABEL = { active: "Active", upcoming: "Upcoming", ended: "Ended" };
const STATE_BADGE = { active: "live", upcoming: "upcoming", ended: "ended" };
const STATE_RANK = { active: 0, upcoming: 1, ended: 2 };

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

function durationText(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "";

  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

function endsInText(test, now = Date.now()) {
  const left = new Date(test.end_time).getTime() - now;

  if (!Number.isFinite(left) || left <= 0) return null;

  return {
    text: `Ends in ${durationText(left)}`,
    urgent: left < 60 * 60 * 1000
  };
}

/* ==============================================================
   SMALL BUILDING BLOCKS
   ============================================================== */

/* ---------- Create-test form helpers ---------- */

const pad2 = (n) => String(n).padStart(2, "0");

// Date -> "YYYY-MM-DDTHH:mm" (datetime-local input ki value, local time mein)
const toLocalInput = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const START_PRESETS = [
  { label: "Now", get: () => new Date() },
  { label: "In 1 hour", get: () => new Date(Date.now() + 3600e3) },
  {
    label: "Tomorrow, 9 AM",
    get: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
  }
];

const DURATION_PRESETS = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" }
];

const shortWhen = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
};

function PageHeader({ title, subtitle, action }) {
  return (
    <header className="td-page-head">
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
    <div className="td-card-head">
      <div className="td-card-title">
        {Icon && (
          <span className="td-card-title-ico">
            <Icon size={15} />
          </span>
        )}

        <div>
          <h2>{title}</h2>
          {hint && <span>{hint}</span>}
        </div>
      </div>

      {actionLabel && (
        <button type="button" className="td-link-btn" onClick={onAction}>
          {actionLabel}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <div className={`td-stat td-tone-${tone}`}>
      <div className="td-stat-ico">
        <Icon size={20} />
      </div>

      <div className="td-stat-body">
        <span className="td-stat-label">{label}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="td-empty">
      <div className="td-empty-ico">
        <Icon size={22} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

function Toolbar({ search, onSearch, placeholder, options, value, onChange }) {
  return (
    <div className="td-toolbar">
      <div className="td-search">
        <Search size={16} />
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className="td-pills" role="tablist">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={value === option.id}
            className={`td-pill ${value === option.id ? "active" : ""}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
            <em>{option.count}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ==============================================================
   TEST ROW (home) + TEST CARD (tests tab)
   ============================================================== */

function TestRow({ test, onManage }) {
  const state = testState(test);
  const ends = state === "active" ? endsInText(test) : null;

  return (
    <div className={`td-test-row td-state-${state}`}>
      <div className="td-test-row-ico">
        <FlaskConical size={18} />
      </div>

      <div className="td-test-row-main">
        <strong>{test.title}</strong>
        <span>
          {test.problem_count || 0} problems · {test.submission_count || 0}{" "}
          submissions
        </span>
      </div>

      <div className={`td-test-row-when ${ends?.urgent ? "urgent" : ""}`}>
        <Clock3 size={13} />
        {state === "active"
          ? ends?.text || "Active"
          : state === "upcoming"
            ? `Starts ${shortDateTime(test.start_time)}`
            : `Ended ${shortDateTime(test.end_time)}`}
      </div>

      <span className={`badge ${STATE_BADGE[state]}`}>
        {STATE_LABEL[state]}
      </span>

      <button
        type="button"
        className="td-btn td-btn-ghost td-btn-sm"
        onClick={onManage}
      >
        Manage <ArrowRight size={13} />
      </button>
    </div>
  );
}

function TestCard({ test, onManage }) {
  const state = testState(test);
  const ends = state === "active" ? endsInText(test) : null;

  return (
    <article className={`td-test-card td-state-${state}`}>
      <div className="td-test-card-top">
        <div className="td-test-card-ico">
          <FlaskConical size={20} />
        </div>

        <span className={`badge ${STATE_BADGE[state]}`}>
          {STATE_LABEL[state]}
        </span>
      </div>

      <h3>{test.title}</h3>
      <p>{test.description || "Coding assessment"}</p>

      {ends && (
        <div className={`td-chip ${ends.urgent ? "urgent" : ""}`}>
          <Clock3 size={12} />
          {ends.text}
        </div>
      )}

      <div className="td-counts">
        <div>
          <Layers size={15} />
          <strong>{test.problem_count || 0}</strong>
          <span>Problems</span>
        </div>
        <div>
          <FileCode2 size={15} />
          <strong>{test.submission_count || 0}</strong>
          <span>Submissions</span>
        </div>
      </div>

      <div className="td-schedule">
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
        className="td-btn td-btn-primary td-btn-block"
        onClick={onManage}
      >
        Manage test <ArrowRight size={15} />
      </button>
    </article>
  );
}

/* ==============================================================
   TEACHER DASHBOARD
   ============================================================== */

function TeacherDashboard({ onLogout }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("home");
  const [selectedTest, setSelectedTest] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [testSearch, setTestSearch] = useState("");
  const [testFilter, setTestFilter] = useState("all");
  const [, setTick] = useState(0);

  // Create tab se bahar jaate hi success card hata do
  useEffect(() => {
    if (tab !== "create") setCreated(null);
  }, [tab]);

  const getToken = () => localStorage.getItem("codeshield_token");

  /* ==========================================================
     DERIVED DATA
     IMPORTANT: saare hooks (useState, useEffect, useMemo) kisi bhi
     early `return` se PEHLE hone chahiye, warna React error deta hai:
     "Rendered more hooks than during the previous render".
     ========================================================== */

  const tests = useMemo(() => data?.tests || [], [data]);

  const filteredTests = useMemo(() => {
    const q = testSearch.trim().toLowerCase();

    return tests
      .filter((test) => {
        const matchesSearch =
          !q ||
          test.title?.toLowerCase().includes(q) ||
          (test.description && test.description.toLowerCase().includes(q));

        if (!matchesSearch) return false;

        if (testFilter === "all") return true;

        return testState(test) === testFilter;
      })
      .sort((a, b) => STATE_RANK[testState(a)] - STATE_RANK[testState(b)]);
  }, [tests, testSearch, testFilter]);

  // Countdown har minute taaza ho
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  /* ==========================================================
     LOAD DASHBOARD
     ========================================================== */

  const loadDashboard = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/teacher/dashboard`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load dashboard");
      }

      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  /* ==========================================================
     CREATE TEST (manual)
     ========================================================== */

  const clearFieldError = (key) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const validateCreate = () => {
    const errs = {};

    if (title.trim().length < 3) {
      errs.title = "Enter a test title (at least 3 characters).";
    }
    if (!startTime) {
      errs.start = "Choose when the test starts.";
    }
    if (!endTime) {
      errs.end = "Choose when the test ends.";
    } else if (startTime && new Date(endTime) <= new Date(startTime)) {
      errs.end = "End time must be after the start time.";
    }
    if (accessPassword && accessPassword.trim().length < 4) {
      errs.password = "Password must be at least 4 characters.";
    }

    return errs;
  };

  // Start time badalne par duration wahi rehti hai (end time saath khisakta hai)
  const applyStart = (date) => {
    const next = toLocalInput(date);

    if (startTime && endTime) {
      const length = new Date(endTime) - new Date(startTime);
      if (length > 0) {
        setEndTime(toLocalInput(new Date(date.getTime() + length)));
      }
    }

    setStartTime(next);
    clearFieldError("start");
    clearFieldError("end");
  };

  const applyDuration = (minutes) => {
    if (!startTime) return;
    setEndTime(
      toLocalInput(new Date(new Date(startTime).getTime() + minutes * 60000))
    );
    clearFieldError("end");
  };

  const createTest = async (event) => {
    event.preventDefault();
    setError("");

    const errs = validateCreate();
    setFieldErrors(errs);

    if (Object.keys(errs).length > 0) {
      const first = ["title", "start", "end", "password"].find((k) => errs[k]);
      const ids = { title: "td-title", start: "td-start", end: "td-end", password: "td-pass" };
      document.getElementById(ids[first])?.focus();
      return;
    }

    const pw = accessPassword.trim();
    setCreating(true);

    try {
      const response = await fetch(`${API_BASE}/api/teacher/tests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          start_time: startTime,
          end_time: endTime,
          ...(pw ? { access_password: pw } : {})
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create test");
      }

      setCreated({
        contest_id: result.contest_id,
        title: title.trim(),
        description: description.trim(),
        start_time: startTime,
        end_time: endTime,
        problem_count: 0,
        submission_count: 0,
        protected: Boolean(pw)
      });

      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
      setAccessPassword("");
      setShowPassword(false);
      setFieldErrors({});

      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // AI se test + questions save hone ke baad
  const handleAISaved = async () => {
    await loadDashboard();
    setTab("tests");
  };

  const openManage = (test) => {
    setSelectedTest(test);
    setTab("manage");
  };

  /* ==========================================================
     EARLY RETURNS (hooks ke BAAD)
     ========================================================== */

  if (loading) {
    return <div className="dashboard-loading">Loading CodeShield...</div>;
  }

  if (error && !data) {
    return (
      <div className="dashboard-error">
        <h2>Unable to load dashboard</h2>
        <p>{error}</p>
        <button
          className="secondary-btn"
          onClick={onLogout}
          style={{ maxWidth: "180px" }}
        >
          Back to Login
        </button>
      </div>
    );
  }

  const username = data?.user?.username || "Teacher";

  /* ---------- MANAGE A TEST ---------- */

  if (tab === "manage" && selectedTest) {
    return (
      <DashboardLayout
        role="teacher"
        username={username}
        active="manage"
        onNavigate={setTab}
        onLogout={onLogout}
      >
        <TeacherTestPage
          test={selectedTest}
          username={username}
          onBack={() => {
            setSelectedTest(null);
            setTab("tests");
            loadDashboard();
          }}
        />
      </DashboardLayout>
    );
  }

  /* ---------- NUMBERS FOR THE PAGE ---------- */

  const now = Date.now();

  const activeTests = tests
    .filter((test) => testState(test, now) === "active")
    .sort((a, b) => new Date(a.end_time) - new Date(b.end_time));

  const counts = {
    all: tests.length,
    active: activeTests.length,
    upcoming: tests.filter((t) => testState(t, now) === "upcoming").length,
    ended: tests.filter((t) => testState(t, now) === "ended").length
  };

  const totalProblems = tests.reduce(
    (total, test) => total + Number(test.problem_count || 0),
    0
  );

  const totalSubmissions =
    data?.total_submissions ??
    tests.reduce((total, test) => total + Number(test.submission_count || 0), 0);

  const homeTests = [...tests]
    .sort((a, b) => STATE_RANK[testState(a, now)] - STATE_RANK[testState(b, now)])
    .slice(0, 5);

  // "Dhyan dene wali baatein": teacher ko kya theek karna chahiye
  const attention = [];

  tests.forEach((test) => {
    const state = testState(test, now);

    if (state === "ended") return;

    if (!Number(test.problem_count || 0)) {
      attention.push({
        id: `np-${test.contest_id}`,
        level: state === "active" ? "bad" : "warn",
        title: test.title,
        text:
          state === "active"
            ? "Active but has no problems. Students cannot attempt it."
            : "No problems added yet.",
        test
      });
    } else if (state === "active") {
      const ends = endsInText(test, now);

      if (ends?.urgent) {
        attention.push({
          id: `soon-${test.contest_id}`,
          level: "warn",
          title: test.title,
          text: `${ends.text}. Monitor students and results.`,
          test
        });
      }
    }
  });

  const topTests = [...tests]
    .filter((test) => Number(test.submission_count || 0) > 0)
    .sort((a, b) => Number(b.submission_count) - Number(a.submission_count))
    .slice(0, 5);

  const topMax = topTests.length ? Number(topTests[0].submission_count) : 1;

  const durationPreview =
    startTime && endTime
      ? durationText(new Date(endTime) - new Date(startTime))
      : "";

  const startDate = startTime ? new Date(startTime) : null;
  const endDate = endTime ? new Date(endTime) : null;
  const validRange =
    startDate && endDate && !Number.isNaN(startDate) && !Number.isNaN(endDate);

  let previewStatus = null;
  if (validRange && endDate > startDate) {
    const nowMs = Date.now();
    previewStatus =
      nowMs < startDate
        ? { cls: "is-upcoming", label: `Starts in ${durationText(startDate - nowMs)}` }
        : nowMs <= endDate
          ? { cls: "is-active", label: "Active now" }
          : { cls: "is-ended", label: "Already ended" };
  }

  const startsInPast = Boolean(startDate) && startDate.getTime() < Date.now() - 60000;
  const currentLength = validRange ? Math.round((endDate - startDate) / 60000) : null;

  /* ---------- MAIN ---------- */

  return (
    <DashboardLayout
      role="teacher"
      username={username}
      active={tab}
      onNavigate={setTab}
      onLogout={onLogout}
    >
      <div className="page td-page">
        {/* ======================= HOME ======================= */}
        {tab === "home" && (
          <>
            <header className="td-welcome">
              <div>
                <span className="td-eyebrow">{todayText()}</span>
                <h1>
                  {greeting()}, <b>{username}</b>
                </h1>
                <p>
                  {activeTests.length > 0
                    ? `${activeTests.length} ${
                        activeTests.length === 1 ? "test is" : "tests are"
                      } running right now.`
                    : "Manage assessments, problems and student submissions from one place."}
                </p>
              </div>

              <div className="td-welcome-actions">
                <button
                  type="button"
                  className="td-btn td-btn-ghost"
                  onClick={() => setTab("create")}
                >
                  <Plus size={15} /> Create test
                </button>
                <button
                  type="button"
                  className="td-btn td-btn-primary"
                  onClick={() => setTab("ai")}
                >
                  <Sparkles size={15} /> Create with AI
                </button>
              </div>
            </header>

            {activeTests.length > 0 && (
              <section className="td-live">
                <div className="td-live-main">
                  <span className="td-live-tag">
                    <i /> Active now
                  </span>

                  <h2>{activeTests[0].title}</h2>
                  <p>{activeTests[0].description || "Coding assessment"}</p>

                  <div className="td-live-meta">
                    {endsInText(activeTests[0], now) && (
                      <span
                        className={
                          endsInText(activeTests[0], now).urgent ? "urgent" : ""
                        }
                      >
                        <Clock3 size={14} />
                        {endsInText(activeTests[0], now).text}
                      </span>
                    )}
                    <span>
                      <Layers size={14} />
                      {activeTests[0].problem_count || 0} problems
                    </span>
                    <span>
                      <FileCode2 size={14} />
                      {activeTests[0].submission_count || 0} submissions
                    </span>
                    {activeTests.length > 1 && (
                      <span>+{activeTests.length - 1} more active</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="td-btn td-btn-light"
                  onClick={() => openManage(activeTests[0])}
                >
                  Monitor test <ArrowRight size={15} />
                </button>
              </section>
            )}

            <section className="td-stats">
              <StatCard
                icon={FlaskConical}
                tone="blue"
                label="Total tests"
                value={counts.all}
                hint={`${counts.upcoming} upcoming · ${counts.ended} ended`}
              />
              <StatCard
                icon={Radio}
                tone="green"
                label="Active now"
                value={counts.active}
                hint="Students can attempt"
              />
              <StatCard
                icon={FileCode2}
                tone="amber"
                label="Submissions"
                value={totalSubmissions}
                hint="Across all tests"
              />
              <StatCard
                icon={Layers}
                tone="violet"
                label="Problems"
                value={totalProblems}
                hint={
                  counts.all
                    ? `${(totalProblems / counts.all).toFixed(1)} per test`
                    : "No tests yet"
                }
              />
            </section>

            <div className="td-layout">
              <div className="td-col">
                <section className="td-card">
                  <CardHead
                    icon={FlaskConical}
                    title="Your tests"
                    hint="Active and upcoming first"
                    actionLabel="View all"
                    onAction={() => setTab("tests")}
                  />

                  {homeTests.length === 0 ? (
                    <EmptyState
                      icon={FlaskConical}
                      title="No tests created yet"
                      text="Create your first assessment manually or let AI generate the questions."
                      action={
                        <button
                          type="button"
                          className="td-btn td-btn-primary td-btn-sm"
                          onClick={() => setTab("create")}
                        >
                          <Plus size={14} /> Create test
                        </button>
                      }
                    />
                  ) : (
                    <div className="td-test-list">
                      {homeTests.map((test) => (
                        <TestRow
                          key={test.contest_id}
                          test={test}
                          onManage={() => openManage(test)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <aside className="td-col">
                <section className="td-card">
                  <CardHead
                    icon={AlertTriangle}
                    title="Needs attention"
                    hint="Things worth checking"
                  />

                  {attention.length === 0 ? (
                    <div className="td-allgood">
                      <CheckCircle2 size={18} />
                      <div>
                        <strong>Everything looks good</strong>
                        <span>No issues found in your tests.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="td-attn-list">
                      {attention.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`td-attn td-attn-${item.level}`}
                          onClick={() => openManage(item.test)}
                        >
                          <AlertTriangle size={15} />
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.text}</span>
                          </div>
                          <ArrowRight size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="td-card">
                  <CardHead
                    icon={TrendingUp}
                    title="Submissions by test"
                    hint="Most active tests"
                  />

                  {topTests.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="No submissions yet"
                      text="Activity will appear once students start attempting."
                    />
                  ) : (
                    <div className="td-bars">
                      {topTests.map((test) => (
                        <div className="td-bar-row" key={test.contest_id}>
                          <div className="td-bar-top">
                            <span title={test.title}>{test.title}</span>
                            <em>{test.submission_count}</em>
                          </div>
                          <div className="td-bar">
                            <div
                              style={{
                                width: `${(Number(test.submission_count) / topMax) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}

        {/* ======================= CREATE ======================= */}
        {tab === "create" && (
          <>
            <PageHeader
              title="Create new test"
              subtitle="Set the title, schedule and access. You can add problems right after."
            />

            <div className="td-create">
              {created ? (
                <div className="td-card td-success" role="status">
                  <span className="td-success-ico">
                    <CheckCircle2 size={30} />
                  </span>
                  <h3>Test created</h3>
                  <p>
                    <strong>{created.title}</strong> is scheduled for{" "}
                    {shortWhen(created.start_time)} to {shortWhen(created.end_time)}
                    {created.protected ? " and is password protected" : ""}.
                    Next, add the problems students will solve.
                  </p>

                  <div className="td-success-actions">
                    <button
                      type="button"
                      className="td-btn td-btn-primary"
                      onClick={() =>
                        created.contest_id ? openManage(created) : setTab("tests")
                      }
                    >
                      <Plus size={15} /> Add problems
                    </button>
                    <button
                      type="button"
                      className="td-btn td-btn-ghost"
                      onClick={() => setCreated(null)}
                    >
                      Create another
                    </button>
                    <button
                      type="button"
                      className="td-btn td-btn-ghost"
                      onClick={() => setTab("tests")}
                    >
                      Back to tests
                    </button>
                  </div>
                </div>
              ) : (
                <form className="td-card td-form" onSubmit={createTest} noValidate>
                  {/* ---------- 1. BASICS ---------- */}
                  <section className="td-form-section">
                    <h3 className="td-form-title">
                      <span>1</span> Basics
                    </h3>

                    <div className={`td-field ${fieldErrors.title ? "has-error" : ""}`}>
                      <label htmlFor="td-title">Test title</label>
                      <input
                        id="td-title"
                        type="text"
                        placeholder="Example: DSA Mid Semester Test"
                        value={title}
                        maxLength={150}
                        aria-invalid={Boolean(fieldErrors.title)}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          clearFieldError("title");
                        }}
                      />
                      {fieldErrors.title && (
                        <span className="td-field-error">{fieldErrors.title}</span>
                      )}
                    </div>

                    <div className="td-field">
                      <label htmlFor="td-desc">
                        Description <em className="td-optional">Optional</em>
                      </label>
                      <textarea
                        id="td-desc"
                        placeholder="What will this test cover? Any rules students should know?"
                        value={description}
                        maxLength={500}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                      <span className="td-char">{description.length}/500</span>
                    </div>
                  </section>

                  {/* ---------- 2. SCHEDULE ---------- */}
                  <section className="td-form-section">
                    <h3 className="td-form-title">
                      <span>2</span> Schedule
                    </h3>

                    <div className="td-field-row">
                      <div className={`td-field ${fieldErrors.start ? "has-error" : ""}`}>
                        <label htmlFor="td-start">Start time</label>
                        <input
                          id="td-start"
                          type="datetime-local"
                          value={startTime}
                          aria-invalid={Boolean(fieldErrors.start)}
                          onChange={(e) => {
                            setStartTime(e.target.value);
                            clearFieldError("start");
                            clearFieldError("end");
                          }}
                        />
                        {fieldErrors.start && (
                          <span className="td-field-error">{fieldErrors.start}</span>
                        )}
                      </div>

                      <div className={`td-field ${fieldErrors.end ? "has-error" : ""}`}>
                        <label htmlFor="td-end">End time</label>
                        <input
                          id="td-end"
                          type="datetime-local"
                          value={endTime}
                          aria-invalid={Boolean(fieldErrors.end)}
                          onChange={(e) => {
                            setEndTime(e.target.value);
                            clearFieldError("end");
                          }}
                        />
                        {fieldErrors.end && (
                          <span className="td-field-error">{fieldErrors.end}</span>
                        )}
                      </div>
                    </div>

                    <div className="td-chip-row">
                      <span className="td-chip-label">Start</span>
                      {START_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className="td-chip"
                          onClick={() => applyStart(preset.get())}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="td-chip-row">
                      <span className="td-chip-label">Duration</span>
                      {DURATION_PRESETS.map((preset) => (
                        <button
                          key={preset.minutes}
                          type="button"
                          className={`td-chip ${currentLength === preset.minutes ? "active" : ""}`}
                          disabled={!startTime}
                          title={startTime ? "" : "Pick a start time first"}
                          onClick={() => applyDuration(preset.minutes)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {durationPreview && (
                      <div className="td-duration">
                        <CalendarClock size={14} />
                        Test duration: <strong>{durationPreview}</strong>
                      </div>
                    )}

                    {startsInPast && (
                      <div className="td-note">
                        <AlertTriangle size={14} />
                        The start time is in the past, so students can open this
                        test as soon as you create it.
                      </div>
                    )}
                  </section>

                  {/* ---------- 3. ACCESS ---------- */}
                  <section className="td-form-section">
                    <h3 className="td-form-title">
                      <span>3</span> Access <em className="td-optional">Optional</em>
                    </h3>

                    <div className={`td-field ${fieldErrors.password ? "has-error" : ""}`}>
                      <label htmlFor="td-pass">Test password</label>
                      <div className="td-pass">
                        <Lock size={15} className="td-pass-ico" />
                        <input
                          id="td-pass"
                          type={showPassword ? "text" : "password"}
                          placeholder="Leave blank for no password"
                          autoComplete="new-password"
                          value={accessPassword}
                          aria-invalid={Boolean(fieldErrors.password)}
                          onChange={(e) => {
                            setAccessPassword(e.target.value);
                            clearFieldError("password");
                          }}
                        />
                        <button
                          type="button"
                          className="td-pass-eye"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {fieldErrors.password ? (
                        <span className="td-field-error">{fieldErrors.password}</span>
                      ) : (
                        <span className="td-hint">
                          Students enter this password to unlock the test. Share
                          it with them separately.
                        </span>
                      )}
                    </div>
                  </section>

                  {error && (
                    <div className="td-alert td-alert-bad" role="alert">
                      <AlertTriangle size={15} /> {error}
                    </div>
                  )}

                  <div className="td-form-actions">
                    <button
                      className="td-btn td-btn-primary"
                      type="submit"
                      disabled={creating}
                    >
                      <Plus size={15} /> {creating ? "Creating…" : "Create test"}
                    </button>

                    <button
                      className="td-btn td-btn-link"
                      type="button"
                      disabled={creating}
                      onClick={() => setTab("ai")}
                    >
                      <Sparkles size={15} /> Generate questions with AI instead
                    </button>
                  </div>
                </form>
              )}

              <div className="td-create-side">
                <aside className="td-card td-preview">
                  <CardHead icon={Eye} title="Student view" hint="Live preview" />

                  <div className="td-preview-body">
                    <div className="td-preview-top">
                      <span className="td-preview-ico">
                        <FlaskConical size={18} />
                      </span>
                      {previewStatus && (
                        <span className={`td-preview-status ${previewStatus.cls}`}>
                          {previewStatus.label}
                        </span>
                      )}
                    </div>

                    <h4 className={title.trim() ? "" : "is-empty"}>
                      {title.trim() || "Your test title"}
                    </h4>
                    <p className={description.trim() ? "" : "is-empty"}>
                      {description.trim() || "Description will appear here."}
                    </p>

                    <dl className="td-preview-meta">
                      <div>
                        <dt>Starts</dt>
                        <dd>{startTime ? shortWhen(startTime) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Ends</dt>
                        <dd>{endTime ? shortWhen(endTime) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Duration</dt>
                        <dd>{durationPreview || "—"}</dd>
                      </div>
                      <div>
                        <dt>Access</dt>
                        <dd>
                          {accessPassword.trim() ? (
                            <span className="td-preview-lock">
                              <Lock size={11} /> Password
                            </span>
                          ) : (
                            "Open"
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </aside>

                <aside className="td-card td-tips">
                  <CardHead icon={Lightbulb} title="Quick tips" />

                  <ul>
                    <li>
                      <strong>Add problems next.</strong> After creating, you
                      can add problems with visible and hidden test cases.
                    </li>
                    <li>
                      <strong>Use AI for speed.</strong> The AI generator
                      creates questions and test cases you can review before
                      publishing.
                    </li>
                    <li>
                      <strong>Plan some buffer.</strong> Give students a few
                      extra minutes for login and setup.
                    </li>
                  </ul>
                </aside>
              </div>
            </div>
          </>
        )}

        {/* ======================= AI ======================= */}
        {tab === "ai" && (
          <>
            <PageHeader
              title="Create test with AI"
              subtitle="Generate questions with visible and hidden test cases, then publish the test for students."
            />

            <AIQuestionGenerator onSaved={handleAISaved} />
          </>
        )}

        {/* ======================= MY TESTS ======================= */}
        {tab === "tests" && (
          <>
            <PageHeader
              title={`My assessments (${tests.length})`}
              subtitle="Manage your coding assessments, monitor participants and results."
              action={
                <button
                  type="button"
                  className="td-btn td-btn-primary"
                  onClick={() => setTab("create")}
                >
                  <Plus size={15} /> New test
                </button>
              }
            />

            <Toolbar
              search={testSearch}
              onSearch={setTestSearch}
              placeholder="Search test by title or description..."
              value={testFilter}
              onChange={setTestFilter}
              options={[
                { id: "all", label: "All", count: counts.all },
                { id: "active", label: "Active", count: counts.active },
                { id: "upcoming", label: "Upcoming", count: counts.upcoming },
                { id: "ended", label: "Ended", count: counts.ended }
              ]}
            />

            {filteredTests.length === 0 ? (
              <div className="td-card">
                <EmptyState
                  icon={FlaskConical}
                  title={
                    testSearch ? "No tests match your search" : "No tests found"
                  }
                  text={
                    testSearch
                      ? "Try a different keyword or filter."
                      : "Create a test to see it here."
                  }
                />
              </div>
            ) : (
              <div className="td-test-grid">
                {filteredTests.map((test) => (
                  <TestCard
                    key={test.contest_id}
                    test={test}
                    onManage={() => openManage(test)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default TeacherDashboard;