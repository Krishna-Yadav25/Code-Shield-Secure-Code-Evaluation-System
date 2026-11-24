// import {
//   ArrowLeft, Eye, Settings, Code2, BarChart3, FileText,
//   Clock, Send, Lock, Unlock, EyeOff, CheckCircle,
//   AlertCircle, RefreshCw, Users, Trophy, ShieldAlert,
//   Sparkles, Trash2, ChevronDown, ChevronUp, AlertTriangle,
//   Download, Search
// } from "lucide-react";
// import { useCallback, useEffect, useMemo, useState } from "react";
// import ProblemManager from "./ProblemManager.jsx";
// import PlagiarismPanel from "./PlagiarismPanel.jsx";
// import ProctoringPanel from "./ProctoringPanel.jsx";
// import IncidentPanel from "./IncidentPanel.jsx";
// import "./TeacherTest.css";
// import "./Proctoring.css";
// import "./Aiquestiongenerator.css";

// const API_BASE = "http://localhost:5000";

// const DEFAULT_MAX_MARKS = 10;

// // Frozen students aur camera alerts itne ms mein refresh hote rehte hain
// const PROCTORING_POLL_MS = 10000;

// let draftCounter = 0;

// function TeacherTestPage({ test, onBack }) {
//   const [tab, setTab] = useState("overview");
//   const [problems, setProblems] = useState([]);
//   const [submissions, setSubmissions] = useState([]);
//   const [analytics, setAnalytics] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [message, setMessage] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [passwordProtected, setPasswordProtected] = useState(false);
//   const [savingPassword, setSavingPassword] = useState(false);
//   const [savingReview, setSavingReview] = useState(null);
//   const [reviews, setReviews] = useState({});
//   const [submissionSearch, setSubmissionSearch] = useState("");
//   const [submissionVerdictFilter, setSubmissionVerdictFilter] = useState("all");

//   // Proctoring
//   const [proctoring, setProctoring] = useState({
//     sessions: [],
//     max_switches: 6,
//     gaze_alert_at: 3,
//     pending_incidents: 0,
//     frozen_count: 0,
//     alert_count: 0
//   });
//   const [proctoringLoading, setProctoringLoading] = useState(false);
//   const [proctoringError, setProctoringError] = useState("");
//   const [busyKey, setBusyKey] = useState(null);

//   // AI question generator
//   const [aiTopic, setAiTopic] = useState("");
//   const [aiDifficulty, setAiDifficulty] = useState("Easy");
//   const [aiCount, setAiCount] = useState(3);
//   const [aiNotes, setAiNotes] = useState("");
//   const [drafts, setDrafts] = useState([]);
//   const [generating, setGenerating] = useState(false);
//   const [savingAi, setSavingAi] = useState(false);
//   const [removingId, setRemovingId] = useState(null);

//   const token = localStorage.getItem("codeshield_token");
//   const contestId = test?.contest_id;

//   /* ==========================================================
//      API HELPER
//      ========================================================== */

//   const api = useCallback(async (url, options = {}) => {
//     const response = await fetch(`${API_BASE}${url}`, {
//       ...options,
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json",
//         ...(options.headers || {})
//       }
//     });

//     const data = await response.json().catch(() => ({}));

//     if (!response.ok) {
//       throw new Error(data.error || `Request failed (${response.status})`);
//     }

//     return data;
//   }, [token]);

//   /* ==========================================================
//      LOADERS
//      ========================================================== */

//   const loadProblems = useCallback(async () => {
//     if (!contestId || !token) return;

//     try {
//       const data = await api(`/api/tests/${contestId}/problems`);
//       setProblems(data.problems || []);
//     } catch (e) {
//       setError(e.message);
//     }
//   }, [api, contestId, token]);

//   const loadDetails = useCallback(async () => {
//     if (!contestId || !token) return;

//     try {
//       const data = await api(`/api/teacher/tests/${contestId}`);
//       setPasswordProtected(Boolean(data.password_protected));
//     } catch (e) {
//       setError(e.message);
//     }
//   }, [api, contestId, token]);

//   const loadReport = useCallback(async () => {
//     if (!contestId || !token) return;

//     setLoading(true);
//     setError("");

//     try {
//       const data = await api(`/api/teacher/tests/${contestId}/report`);
//       const list = data.submissions || [];

//       setSubmissions(list);
//       setAnalytics(data.analytics || null);

//       const initialReviews = {};

//       list.forEach((s) => {
//         initialReviews[s.submission_id] = {
//           awarded_marks: s.awarded_marks ?? "",
//           teacher_feedback: s.teacher_feedback ?? ""
//         };
//       });

//       setReviews(initialReviews);
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setLoading(false);
//     }
//   }, [api, contestId, token]);

//   const loadProctoring = useCallback(async (showLoader = false) => {
//     if (!contestId || !token) return;

//     if (showLoader) setProctoringLoading(true);

//     try {
//       const data = await api(`/api/teacher/tests/${contestId}/proctoring`);

//       setProctoring({
//         sessions: data.sessions || [],
//         max_switches: data.max_switches ?? 6,
//         gaze_alert_at: data.gaze_alert_at ?? 3,
//         pending_incidents: data.pending_incidents ?? 0,
//         frozen_count: data.frozen_count ?? 0,
//         alert_count: data.alert_count ?? 0
//       });

//       setProctoringError("");
//     } catch (e) {
//       setProctoringError(e.message);
//     } finally {
//       if (showLoader) setProctoringLoading(false);
//     }
//   }, [api, contestId, token]);

//   useEffect(() => {
//     loadProblems();
//     loadDetails();
//   }, [loadProblems, loadDetails]);

//   useEffect(() => {
//     if (tab === "submissions" || tab === "analytics") {
//       loadReport();
//     }
//   }, [tab, loadReport]);

//   // Frozen students aur camera alerts har 10 second mein refresh hote hain
//   useEffect(() => {
//     if (!contestId || !token) return undefined;

//     loadProctoring();

//     const timer = setInterval(() => loadProctoring(), PROCTORING_POLL_MS);

//     return () => clearInterval(timer);
//   }, [loadProctoring, contestId, token]);

//   /* ==========================================================
//      AI: GENERATE / EDIT / SAVE
//      ========================================================== */

//   const generateQuestions = async (event) => {
//     event.preventDefault();
//     setError("");
//     setMessage("");

//     if (aiTopic.trim().length < 3) {
//       setError("Please describe the topic using at least 3 characters.");
//       return;
//     }

//     setGenerating(true);

//     try {
//       const data = await api("/api/teacher/ai/generate", {
//         method: "POST",
//         body: JSON.stringify({
//           topic: aiTopic.trim(),
//           difficulty: aiDifficulty,
//           count: Number(aiCount),
//           notes: aiNotes.trim()
//         })
//       });

//       const fresh = (data.questions || []).map((q) => ({
//         ...q,
//         _id: ++draftCounter,
//         selected: true,
//         open: false
//       }));

//       setDrafts((prev) => [...prev, ...fresh]);

//       setMessage(
//         `${fresh.length} question(s) generated. Review them and add the ones you want to this test.`
//       );
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setGenerating(false);
//     }
//   };

//   const updateDraft = (id, patch) => {
//     setDrafts((prev) =>
//       prev.map((d) => (d._id === id ? { ...d, ...patch } : d))
//     );
//   };

//   const removeDraft = (id) => {
//     setDrafts((prev) => prev.filter((d) => d._id !== id));
//   };

//   const selectedDrafts = drafts.filter((d) => d.selected);

//   const saveDraftsToTest = async () => {
//     setError("");
//     setMessage("");

//     if (selectedDrafts.length === 0) {
//       setError("Select at least one question.");
//       return;
//     }

//     const unverified = selectedDrafts.filter((d) => !d.verified).length;

//     if (
//       unverified > 0 &&
//       !window.confirm(
//         `${unverified} selected question(s) are not verified. Add them anyway?`
//       )
//     ) {
//       return;
//     }

//     for (const d of selectedDrafts) {
//       const marks = Number(d.max_marks);
//       if (!d.title.trim() || !d.statement.trim()) {
//         setError("Every selected question needs a title and a statement.");
//         return;
//       }
//       if (!Number.isFinite(marks) || marks <= 0) {
//         setError(`"${d.title}": maximum marks must be greater than 0.`);
//         return;
//       }
//     }

//     setSavingAi(true);

//     try {
//       const questions = selectedDrafts.map((d) => ({
//         title: d.title,
//         statement: d.statement,
//         difficulty: d.difficulty,
//         time_limit_ms: d.time_limit_ms,
//         memory_limit_mb: d.memory_limit_mb,
//         max_marks: Number(d.max_marks),
//         test_cases: d.test_cases
//       }));

//       const result = await api(`/api/teacher/tests/${contestId}/ai/save`, {
//         method: "POST",
//         body: JSON.stringify({ questions })
//       });

//       setDrafts((prev) =>
//         prev.filter((d) => !selectedDrafts.some((s) => s._id === d._id))
//       );

//       await loadProblems();

//       setMessage(
//         `${selectedDrafts.length} question(s) added to this test. ${result.message || ""}`
//       );
//       setTab("problems");
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setSavingAi(false);
//     }
//   };

//   /* ==========================================================
//      PROCTORING ACTIONS: UNLOCK / FREEZE / END / CLEAR ALERTS
//      ========================================================== */

//   const runProctorAction = async (session, action, confirmText) => {
//     if (!window.confirm(confirmText)) return;

//     setBusyKey(`${action}-${session.user_id}`);
//     setError("");
//     setMessage("");

//     try {
//       const data = await api(
//         `/api/teacher/tests/${contestId}/sessions/${session.user_id}/${action}`,
//         { method: "POST", body: JSON.stringify({}) }
//       );

//       setMessage(data.message || "Done.");

//       await loadProctoring();
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setBusyKey(null);
//     }
//   };

//   const unlockStudent = (session) =>
//     runProctorAction(
//       session,
//       "unlock",
//       `Unlock ${session.username}? They can continue the test and their tab-switch count resets to 0.`
//     );

//   const freezeStudent = (session) =>
//     runProctorAction(
//       session,
//       "freeze",
//       `Freeze ${session.username}'s test? They cannot continue until you unlock them.`
//     );

//   const endStudentTest = (session) =>
//     runProctorAction(
//       session,
//       "end",
//       `End ${session.username}'s test? Their test will be submitted and they cannot continue.`
//     );

//   const clearStudentAlerts = (session) =>
//     runProctorAction(
//       session,
//       "clear-alerts",
//       `Clear the camera alerts for ${session.username}? Use this for a false alarm.`
//     );

//   /* ==========================================================
//      REMOVE QUESTION FROM TEST
//      ========================================================== */

//   const removeProblem = async (problem) => {
//     const ok = window.confirm(
//       `Remove "${problem.title}" from this test? Its test cases will also be deleted. This cannot be undone.`
//     );

//     if (!ok) return;

//     setRemovingId(problem.problem_id);
//     setError("");
//     setMessage("");

//     try {
//       await api(`/api/teacher/problems/${problem.problem_id}`, {
//         method: "DELETE"
//       });

//       setMessage(`"${problem.title}" removed from the test.`);
//       await loadProblems();
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setRemovingId(null);
//     }
//   };

//   /* ==========================================================
//      PASSWORD
//      ========================================================== */

//   const savePassword = async (value) => {
//     setSavingPassword(true);
//     setError("");
//     setMessage("");

//     try {
//       await api(`/api/teacher/tests/${contestId}/password`, {
//         method: "PUT",
//         body: JSON.stringify({ password: value })
//       });

//       setPasswordProtected(Boolean(value));
//       setPassword("");
//       setMessage(value ? "Test password saved." : "Test password removed.");
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setSavingPassword(false);
//     }
//   };

//   /* ==========================================================
//      REVIEW / PUBLISH
//      ========================================================== */

//   const updateReview = (id, field, value) => {
//     setReviews((prev) => ({
//       ...prev,
//       [id]: { ...(prev[id] || {}), [field]: value }
//     }));
//   };

//   const saveReview = async (submission, publish) => {
//     const id = submission.submission_id;
//     const review = reviews[id] || {};
//     const marks = Number(review.awarded_marks);
//     const max = Number(submission.max_marks ?? DEFAULT_MAX_MARKS);

//     if (
//       review.awarded_marks === "" ||
//       review.awarded_marks === undefined ||
//       !Number.isFinite(marks) ||
//       marks < 0
//     ) {
//       setError("Please enter valid marks before reviewing.");
//       return;
//     }

//     if (marks > max) {
//       setError(`Marks cannot exceed ${max}.`);
//       return;
//     }

//     setSavingReview(id);
//     setError("");
//     setMessage("");

//     try {
//       await api(`/api/teacher/submissions/${id}/review`, {
//         method: "PUT",
//         body: JSON.stringify({
//           awarded_marks: marks,
//           teacher_feedback: review.teacher_feedback || "",
//           action: publish ? "publish" : "save"
//         })
//       });

//       setMessage(
//         publish ? "Result approved and published." : "Review saved."
//       );

//       await loadReport();
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setSavingReview(null);
//     }
//   };

//   const exportGradebookCSV = () => {
//     if (!submissions || submissions.length === 0) {
//       alert("No submissions available to export.");
//       return;
//     }
//     const headers = [
//       "Submission ID",
//       "Student",
//       "Problem",
//       "Language",
//       "Verdict",
//       "Test Cases Passed",
//       "Total Test Cases",
//       "Awarded Marks",
//       "Max Marks",
//       "Execution Time (ms)",
//       "Memory (KB)",
//       "Submitted At",
//       "Teacher Feedback"
//     ];

//     const rows = submissions.map((s) => {
//       const review = reviews[s.submission_id] || {};
//       const marks =
//         review.awarded_marks !== "" && review.awarded_marks != null
//           ? review.awarded_marks
//           : s.awarded_marks ?? "";
//       const feedback = review.teacher_feedback || s.teacher_feedback || "";

//       return [
//         s.submission_id,
//         `"${(s.username || s.student_name || `Student ${s.user_id}`).replace(/"/g, '""')}"`,
//         `"${(s.problem_title || s.problem || `Problem ${s.problem_id}`).replace(/"/g, '""')}"`,
//         s.language || "cpp",
//         s.verdict || "—",
//         s.test_cases_passed ?? 0,
//         s.test_cases_total ?? 0,
//         marks,
//         s.max_marks ?? DEFAULT_MAX_MARKS,
//         s.execution_time_ms ?? 0,
//         s.memory_used_kb ?? 0,
//         s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—",
//         `"${feedback.replace(/"/g, '""')}"`
//       ];
//     });

//     const csvContent =
//       "data:text/csv;charset=utf-8," +
//       [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
//     const encodedUri = encodeURI(csvContent);
//     const link = document.createElement("a");
//     const safeTitle = (test?.title || "assessment").replace(/[^a-zA-Z0-9_-]/g, "_");
//     link.setAttribute("href", encodedUri);
//     link.setAttribute("download", `CodeShield_${safeTitle}_Gradebook.csv`);
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const filteredSubmissions = useMemo(() => {
//     return submissions.filter((s) => {
//       const q = submissionSearch.trim().toLowerCase();
//       const studentName = (s.username || s.student_name || "").toLowerCase();
//       const problemName = (s.problem_title || s.problem || "").toLowerCase();
//       const matchesSearch = !q || studentName.includes(q) || problemName.includes(q);
//       if (!matchesSearch) return false;

//       if (submissionVerdictFilter === "all") return true;
//       const verdict = (s.verdict || "").trim().toUpperCase();
//       if (submissionVerdictFilter === "AC") return verdict === "AC" || verdict.includes("ACCEPT");
//       if (submissionVerdictFilter === "WA") return verdict === "WA" || verdict.includes("WRONG");
//       if (submissionVerdictFilter === "TLE") return verdict === "TLE" || verdict.includes("TIME");
//       if (submissionVerdictFilter === "RE") return verdict === "RE" || verdict.includes("RUN");
//       return true;
//     });
//   }, [submissions, submissionSearch, submissionVerdictFilter]);

//   /* ==========================================================
//      GUARD
//      ========================================================== */

//   if (!test || !contestId) {
//     return (
//       <div className="teacher-test-page">
//         <button className="back-link" onClick={onBack}>
//           <ArrowLeft size={16} /> Back to Tests
//         </button>
//         <p>No test selected.</p>
//       </div>
//     );
//   }

//   /* ==========================================================
//      HELPERS
//      ========================================================== */

//   const date = (value) => {
//     if (!value) return "—";
//     const d = new Date(value);
//     return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
//   };

//   const start = test.start_time ? new Date(test.start_time) : null;
//   const end = test.end_time ? new Date(test.end_time) : null;
//   const now = new Date();

//   let status = "Active";
//   let statusClass = "success";

//   if (start && now < start) {
//     status = "Upcoming";
//     statusClass = "warning";
//   } else if (end && now > end) {
//     status = "Ended";
//     statusClass = "neutral";
//   }

//   const submissionCount = submissions.length || test.submission_count || 0;

//   const frozenCount = proctoring.frozen_count;
//   const alertCount = proctoring.alert_count;
//   const pendingIncidents = proctoring.pending_incidents;

//   const bannerParts = [];

//   if (frozenCount > 0) {
//     bannerParts.push(`${frozenCount} frozen`);
//   }

//   if (alertCount > 0) {
//     bannerParts.push(`${alertCount} with suspicious camera activity`);
//   }

//   if (pendingIncidents > 0) {
//     bannerParts.push(
//       `${pendingIncidents} photo alert${pendingIncidents > 1 ? "s" : ""}`
//     );
//   }

//   /* ==========================================================
//      RENDER
//      ========================================================== */

//   return (
//     <div className="teacher-test-page">

//       {/* BREADCRUMB */}
//       <div className="test-breadcrumb">
//         <button className="back-link" onClick={onBack}>
//           <ArrowLeft size={16} /> Tests
//         </button>
//         <span>/</span>
//         <strong>{test.title}</strong>
//       </div>

//       {/* HEADER */}
//       <div className="test-title-row">
//         <div>
//           <div className="test-title-line">
//             <h1>{test.title || "Untitled Test"}</h1>
//             <span className={`large-status ${statusClass}`}>● {status}</span>
//           </div>
//           <p>{test.description || "Coding assessment"}</p>
//         </div>

//         <button
//           className="primary-small-btn"
//           onClick={() => setTab("settings")}
//         >
//           <Settings size={16} /> Test Settings
//         </button>
//       </div>

//       {/* PROCTORING ALERT (kisi bhi tab par dikhta hai) */}
//       {bannerParts.length > 0 && (
//         <div className="pc-banner" role="alert">
//           <span>
//             <Lock size={16} />
//             {bannerParts.join(" · ")}: waiting for your decision
//           </span>

//           {tab !== "proctoring" && tab !== "incidents" && (
//             <button
//               type="button"
//               onClick={() =>
//                 setTab(pendingIncidents > 0 ? "incidents" : "proctoring")
//               }
//             >
//               Review &amp; decide
//             </button>
//           )}
//         </div>
//       )}

//       {/* STATS */}
//       <div className="test-stat-grid">
//         <TestStat icon={<Clock size={19} />} title="Start Time" value={date(start)} color="blue" />
//         <TestStat icon={<Clock size={19} />} title="End Time" value={date(end)} color="pink" />
//         <TestStat icon={<Code2 size={19} />} title="Problems" value={problems.length} color="orange" />
//         <TestStat icon={<Send size={19} />} title="Submissions" value={submissionCount} color="purple" />
//       </div>

//       {/* TABS */}
//       <div className="test-tabs">
//         <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={<FileText size={16} />}>Overview</TabButton>
//         <TabButton active={tab === "problems"} onClick={() => setTab("problems")} icon={<Code2 size={16} />}>Problems</TabButton>
//         <TabButton active={tab === "ai"} onClick={() => setTab("ai")} icon={<Sparkles size={16} />}>
//           AI Generate
//           {drafts.length > 0 && <span className="pc-tab-badge">{drafts.length}</span>}
//         </TabButton>
//         <TabButton active={tab === "submissions"} onClick={() => setTab("submissions")} icon={<Send size={16} />}>Submissions & Marks</TabButton>
//         <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} icon={<BarChart3 size={16} />}>Analytics</TabButton>
//         <TabButton active={tab === "proctoring"} onClick={() => setTab("proctoring")} icon={<Lock size={16} />}>
//           Proctoring
//           {frozenCount + alertCount > 0 && (
//             <span className="pc-tab-badge">{frozenCount + alertCount}</span>
//           )}
//         </TabButton>
//         <TabButton active={tab === "incidents"} onClick={() => setTab("incidents")} icon={<AlertTriangle size={16} />}>
//           Incidents
//           {pendingIncidents > 0 && <span className="pc-tab-badge">{pendingIncidents}</span>}
//         </TabButton>
//         <TabButton active={tab === "plagiarism"} onClick={() => setTab("plagiarism")} icon={<ShieldAlert size={16} />}>Plagiarism</TabButton>
//         <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings size={16} />}>Settings</TabButton>
//       </div>

//       {/* MESSAGES */}
//       {error && (
//         <div className="settings-message error">
//           <AlertCircle size={16} /> {error}
//           <button onClick={() => setError("")}>Dismiss</button>
//         </div>
//       )}

//       {message && (
//         <div className="settings-message success">
//           <CheckCircle size={16} /> {message}
//         </div>
//       )}

//       {/* ======================================================
//           OVERVIEW
//           ====================================================== */}

//       {tab === "overview" && (
//         <div className="test-overview-card">
//           <h2>Assessment Overview</h2>
//           <p>This test contains {problems.length} coding problem(s).</p>

//           <div className="overview-info-grid">
//             <InfoItem label="Status" value={status} />
//             <InfoItem label="Problems" value={problems.length} />
//             <InfoItem label="Start Time" value={date(start)} />
//             <InfoItem label="End Time" value={date(end)} />
//             <InfoItem label="Password" value={passwordProtected ? "Protected" : "Not protected"} />
//             <InfoItem label="Submissions" value={submissionCount} />
//             <InfoItem label="Frozen students" value={frozenCount} />
//             <InfoItem label="Tab-switch limit" value={proctoring.max_switches} />
//             <InfoItem label="Photo alerts pending" value={pendingIncidents} />
//           </div>

//           <div className="teacher-quick-actions">
//             <button className="primary-small-btn" onClick={() => setTab("ai")}>
//               <Sparkles size={16} /> Generate with AI
//             </button>
//             <button className="outline-btn" onClick={() => setTab("problems")}>
//               <Code2 size={16} /> Manage Problems
//             </button>
//             <button className="outline-btn" onClick={() => setTab("submissions")}>
//               <Users size={16} /> Review Marks
//             </button>
//             <button className="outline-btn" onClick={() => setTab("proctoring")}>
//               <Lock size={16} /> Proctoring
//             </button>
//             <button className="outline-btn" onClick={() => setTab("plagiarism")}>
//               <ShieldAlert size={16} /> Check Plagiarism
//             </button>
//           </div>
//         </div>
//       )}

//       {/* ======================================================
//           PROBLEMS
//           ====================================================== */}

//       {tab === "problems" && (
//         <div>
//           <button className="outline-btn" onClick={loadProblems}>
//             <RefreshCw size={16} /> Refresh Problems
//           </button>

//           <div className="test-overview-card" style={{ margin: "16px 0" }}>
//             <h3>Questions in this test ({problems.length})</h3>

//             {problems.length === 0 ? (
//               <p>No questions yet. Add them manually or use AI Generate.</p>
//             ) : (
//               <div className="teacher-table-wrapper">
//                 <table className="teacher-data-table">
//                   <thead>
//                     <tr>
//                       <th>#</th>
//                       <th>Title</th>
//                       <th>Difficulty</th>
//                       <th>Marks</th>
//                       <th>Action</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {problems.map((p, i) => (
//                       <tr key={p.problem_id}>
//                         <td>{i + 1}</td>
//                         <td>{p.title}</td>
//                         <td>{p.difficulty}</td>
//                         <td>{p.max_marks}</td>
//                         <td>
//                           <button
//                             type="button"
//                             className="outline-btn"
//                             disabled={removingId === p.problem_id}
//                             onClick={() => removeProblem(p)}
//                           >
//                             <Trash2 size={14} />{" "}
//                             {removingId === p.problem_id ? "Removing..." : "Remove"}
//                           </button>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             )}
//           </div>

//           <ProblemManager
//             test={test}
//             problems={problems}
//             reloadProblems={loadProblems}
//           />
//         </div>
//       )}

//       {/* ======================================================
//           AI GENERATE
//           ====================================================== */}

//       {tab === "ai" && (
//         <section className="aiq">
//           <form className="aiq-card" onSubmit={generateQuestions}>
//             <div className="aiq-head">
//               <div className="aiq-icon"><Sparkles size={20} /></div>
//               <div>
//                 <h2>Generate questions with AI</h2>
//                 <p>
//                   Gemini creates the problem statement with visible and hidden
//                   test cases. Selected questions are added to this test and
//                   appear on the student dashboard automatically.
//                 </p>
//               </div>
//             </div>

//             <label htmlFor="ai-topic">Topic</label>
//             <textarea
//               id="ai-topic"
//               rows={3}
//               value={aiTopic}
//               onChange={(e) => setAiTopic(e.target.value)}
//               placeholder="Example: arrays, binary search, linked lists"
//               maxLength={500}
//               required
//             />

//             <div className="aiq-row">
//               <div>
//                 <label htmlFor="ai-difficulty">Difficulty</label>
//                 <select
//                   id="ai-difficulty"
//                   value={aiDifficulty}
//                   onChange={(e) => setAiDifficulty(e.target.value)}
//                 >
//                   <option>Easy</option>
//                   <option>Medium</option>
//                   <option>Hard</option>
//                 </select>
//               </div>
//               <div>
//                 <label htmlFor="ai-count">Number of questions (1–8)</label>
//                 <input
//                   id="ai-count"
//                   type="number"
//                   min="1"
//                   max="8"
//                   value={aiCount}
//                   onChange={(e) => setAiCount(e.target.value)}
//                   required
//                 />
//               </div>
//             </div>

//             <label htmlFor="ai-notes">Extra instructions (optional)</label>
//             <input
//               id="ai-notes"
//               value={aiNotes}
//               onChange={(e) => setAiNotes(e.target.value)}
//               placeholder="Example: avoid recursion"
//               maxLength={1000}
//             />

//             <div className="aiq-actions">
//               <button
//                 className="primary-small-btn"
//                 type="submit"
//                 disabled={generating || savingAi}
//               >
//                 <Sparkles size={16} />
//                 {generating ? "Generating..." : "Generate questions"}
//               </button>

//               {drafts.length > 0 && (
//                 <button
//                   type="button"
//                   className="outline-btn"
//                   disabled={generating || savingAi}
//                   onClick={() => {
//                     if (window.confirm("Remove all unsaved drafts?")) setDrafts([]);
//                   }}
//                 >
//                   Clear drafts
//                 </button>
//               )}
//             </div>
//           </form>

//           {drafts.length > 0 && (
//             <div className="aiq-card">
//               <div className="aiq-list-head">
//                 <div>
//                   <h3>Draft questions ({drafts.length})</h3>
//                   <p>{selectedDrafts.length} selected</p>
//                 </div>
//                 <div className="aiq-actions">
//                   <button
//                     type="button"
//                     className="outline-btn"
//                     onClick={() =>
//                       setDrafts((prev) => prev.map((d) => ({ ...d, selected: true })))
//                     }
//                   >
//                     Select all
//                   </button>
//                   <button
//                     type="button"
//                     className="outline-btn"
//                     onClick={() =>
//                       setDrafts((prev) => prev.map((d) => ({ ...d, selected: false })))
//                     }
//                   >
//                     Deselect all
//                   </button>
//                 </div>
//               </div>

//               <div className="aiq-drafts">
//                 {drafts.map((d) => (
//                   <article
//                     key={d._id}
//                     className={`aiq-draft ${d.selected ? "selected" : ""}`}
//                   >
//                     <div className="aiq-draft-top">
//                       <label className="aiq-check">
//                         <input
//                           type="checkbox"
//                           checked={d.selected}
//                           onChange={(e) =>
//                             updateDraft(d._id, { selected: e.target.checked })
//                           }
//                         />
//                         Select
//                       </label>

//                       <span className={`aiq-badge ${d.verified ? "ok" : "warn"}`}>
//                         {d.verified ? "Verified" : "Not verified"}
//                       </span>

//                       <span className={`difficulty ${(d.difficulty || "easy").toLowerCase()}`}>
//                         {d.difficulty}
//                       </span>

//                       <button
//                         type="button"
//                         className="aiq-icon-btn"
//                         title="Remove question"
//                         onClick={() => removeDraft(d._id)}
//                       >
//                         <Trash2 size={16} />
//                       </button>
//                     </div>

//                     <p className={`aiq-note ${d.verified ? "ok" : "warn"}`}>
//                       {!d.verified && <AlertTriangle size={13} />} {d.verify_note}
//                     </p>

//                     <label>Title</label>
//                     <input
//                       value={d.title}
//                       onChange={(e) => updateDraft(d._id, { title: e.target.value })}
//                     />

//                     <label>Statement</label>
//                     <textarea
//                       rows={8}
//                       value={d.statement}
//                       onChange={(e) => updateDraft(d._id, { statement: e.target.value })}
//                     />

//                     <div className="aiq-row">
//                       <div>
//                         <label>Maximum marks</label>
//                         <input
//                           type="number"
//                           min="0.5"
//                           max="1000"
//                           step="0.5"
//                           value={d.max_marks}
//                           onChange={(e) => updateDraft(d._id, { max_marks: e.target.value })}
//                         />
//                       </div>
//                     </div>

//                     <button
//                       type="button"
//                       className="aiq-toggle"
//                       onClick={() => updateDraft(d._id, { open: !d.open })}
//                     >
//                       {d.open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
//                       {d.open ? "Hide" : "Show"} {d.test_cases?.length || 0} test cases
//                       {" "}
//                       ({(d.test_cases || []).filter((t) => !t.is_hidden).length} visible,{" "}
//                       {(d.test_cases || []).filter((t) => t.is_hidden).length} hidden)
//                     </button>

//                     {d.open && (
//                       <div className="aiq-cases">
//                         {(d.test_cases || []).map((tc, i) => (
//                           <div className="aiq-case" key={i}>
//                             <div className="aiq-case-head">
//                               <strong>Test case {i + 1}</strong>
//                               <span className={`aiq-vis ${tc.is_hidden ? "hidden" : "visible"}`}>
//                                 {tc.is_hidden ? <EyeOff size={12} /> : <Eye size={12} />}
//                                 {tc.is_hidden ? "Hidden" : "Visible"}
//                               </span>
//                             </div>
//                             <div className="aiq-case-grid">
//                               <div>
//                                 <span>Input</span>
//                                 <pre>{tc.input}</pre>
//                               </div>
//                               <div>
//                                 <span>Expected output</span>
//                                 <pre>{tc.expected_output}</pre>
//                               </div>
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </article>
//                 ))}
//               </div>

//               <div className="aiq-actions">
//                 <button
//                   type="button"
//                   className="primary-small-btn"
//                   onClick={saveDraftsToTest}
//                   disabled={savingAi || generating || selectedDrafts.length === 0}
//                 >
//                   <CheckCircle size={16} />
//                   {savingAi
//                     ? "Saving..."
//                     : `Add ${selectedDrafts.length} question(s) to this test`}
//                 </button>
//               </div>
//             </div>
//           )}
//         </section>
//       )}

//       {/* ======================================================
//           SUBMISSIONS & MARKS
//           ====================================================== */}

//       {tab === "submissions" && (
//         <section className="teacher-report-panel">
//           <div className="teacher-report-header">
//             <div>
//               <h2>Student Submissions & Marks ({submissions.length})</h2>
//               <p>
//                 Review automatic test-case scores, adjust marks and publish
//                 approved results.
//               </p>
//             </div>

//             <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
//               <button
//                 className="cs-export-btn"
//                 onClick={exportGradebookCSV}
//                 title="Download CSV for Gradebook / Excel"
//               >
//                 <Download size={15} /> Export CSV
//               </button>

//               <button
//                 className="outline-btn"
//                 onClick={loadReport}
//                 disabled={loading}
//               >
//                 <RefreshCw size={16} /> {loading ? "Loading..." : "Refresh"}
//               </button>
//             </div>
//           </div>

//           <div className="cs-search-filter-bar">
//             <div className="cs-search-input-wrap">
//               <Search size={16} className="cs-search-icon" />
//               <input
//                 type="text"
//                 className="cs-search-input"
//                 placeholder="Search by student name or problem title..."
//                 value={submissionSearch}
//                 onChange={(e) => setSubmissionSearch(e.target.value)}
//               />
//             </div>
//             <div className="cs-filter-pills">
//               {[
//                 { id: "all", label: "All Verdicts" },
//                 { id: "AC", label: "✅ AC (Accepted)" },
//                 { id: "WA", label: "❌ WA (Wrong Answer)" },
//                 { id: "TLE", label: "⏱️ TLE (Time Limit)" },
//                 { id: "RE", label: "⚠️ RE (Runtime Error)" },
//               ].map((p) => (
//                 <button
//                   key={p.id}
//                   type="button"
//                   className={`cs-filter-pill ${submissionVerdictFilter === p.id ? "active" : ""}`}
//                   onClick={() => setSubmissionVerdictFilter(p.id)}
//                 >
//                   {p.label}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {loading ? (
//             <p>Loading submissions...</p>
//           ) : filteredSubmissions.length === 0 ? (
//             <div className="placeholder-panel">
//               <Send size={28} />
//               <h3>{submissions.length === 0 ? "No submissions found" : "No matching submissions"}</h3>
//               <p>{submissions.length === 0 ? "Submissions will appear here when students submit code." : "Try adjusting your search query or verdict filter."}</p>
//             </div>
//           ) : (
//             <div className="teacher-review-list">
//               {filteredSubmissions.map((s) => {
//                 const review = reviews[s.submission_id] || {};
//                 const passed = Number(s.test_cases_passed || 0);
//                 const total = Number(s.test_cases_total || 0);
//                 const max = Number(s.max_marks ?? DEFAULT_MAX_MARKS);

//                 // Backend automatic_score bhejta hai; na mile to khud nikalo.
//                 const automaticMarks =
//                   s.automatic_score != null
//                     ? Number(s.automatic_score)
//                     : total > 0
//                       ? (passed / total) * max
//                       : 0;

//                 const published =
//                   Boolean(s.published_at) ||
//                   String(s.teacher_review_status || "").toLowerCase() ===
//                     "published";

//                 const busy = savingReview === s.submission_id;

//                 return (
//                   <article className="test-overview-card" key={s.submission_id}>

//                     <div className="teacher-report-header">
//                       <div>
//                         <h3>
//                           {s.username || s.student_name || `Student ${s.user_id}`}
//                         </h3>
//                         <p>
//                           {s.problem_title || s.problem || `Problem ${s.problem_id}`}
//                           {" · "}
//                           {s.language || "—"}
//                         </p>
//                       </div>

//                       <span
//                         className={`password-status ${
//                           published ? "enabled" : "disabled"
//                         }`}
//                       >
//                         {published
//                           ? "Published"
//                           : s.teacher_review_status || "Awaiting review"}
//                       </span>
//                     </div>

//                     <div className="overview-info-grid">
//                       <InfoItem label="Verdict" value={s.verdict || s.status || "Pending"} />
//                       <InfoItem label="Test Cases Passed" value={`${passed} / ${total}`} />
//                       <InfoItem label="Automatic Score" value={`${automaticMarks.toFixed(2)} / ${max}`} />
//                       <InfoItem label="Submitted At" value={date(s.submitted_at)} />
//                     </div>

//                     <div className="password-setting-body">

//                       <label>Teacher-awarded marks (maximum {max})</label>

//                       <input
//                         type="number"
//                         min="0"
//                         max={max}
//                         step="0.5"
//                         value={review.awarded_marks ?? ""}
//                         onChange={(e) =>
//                           updateReview(s.submission_id, "awarded_marks", e.target.value)
//                         }
//                         placeholder={`Suggested: ${automaticMarks.toFixed(2)}`}
//                       />

//                       <label>Feedback for student</label>

//                       <textarea
//                         value={review.teacher_feedback || ""}
//                         onChange={(e) =>
//                           updateReview(s.submission_id, "teacher_feedback", e.target.value)
//                         }
//                         placeholder="Optional feedback"
//                         rows={3}
//                       />

//                       <div className="password-setting-actions">

//                         <button
//                           className="outline-btn"
//                           type="button"
//                           disabled={busy}
//                           onClick={() =>
//                             updateReview(
//                               s.submission_id,
//                               "awarded_marks",
//                               String(automaticMarks)
//                             )
//                           }
//                         >
//                           Use automatic marks
//                         </button>

//                         <button
//                           className="outline-btn"
//                           type="button"
//                           disabled={busy}
//                           onClick={() => saveReview(s, false)}
//                         >
//                           Save Review
//                         </button>

//                         <button
//                           className="save-password-btn"
//                           type="button"
//                           disabled={busy}
//                           onClick={() => {
//                             if (
//                               window.confirm(
//                                 "Approve and publish this result to the student?"
//                               )
//                             ) {
//                               saveReview(s, true);
//                             }
//                           }}
//                         >
//                           <CheckCircle size={16} />
//                           {busy ? "Saving..." : "Approve & Publish"}
//                         </button>

//                       </div>
//                     </div>
//                   </article>
//                 );
//               })}
//             </div>
//           )}
//         </section>
//       )}

//       {/* ======================================================
//           ANALYTICS
//           ====================================================== */}

//       {tab === "analytics" && (
//         <section className="teacher-report-panel">
//           <div className="teacher-report-header">
//             <div>
//               <h2>Assessment Analytics</h2>
//               <p>Performance summary for this assessment.</p>
//             </div>

//             <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
//               <button
//                 className="cs-export-btn"
//                 onClick={exportGradebookCSV}
//                 title="Download CSV for Gradebook / Excel"
//               >
//                 <Download size={15} /> Export CSV
//               </button>

//               <button
//                 className="outline-btn"
//                 onClick={loadReport}
//                 disabled={loading}
//               >
//                 <RefreshCw size={16} /> Refresh
//               </button>
//             </div>
//           </div>

//           {loading ? (
//             <p>Loading analytics...</p>
//           ) : (
//             <>
//               <div className="teacher-analytics-grid">
//                 <AnalyticsCard icon={<Users size={21} />} label="Students" value={analytics?.total_students ?? 0} />
//                 <AnalyticsCard icon={<Send size={21} />} label="Submissions" value={analytics?.total_submissions ?? submissions.length} />
//                 <AnalyticsCard icon={<Trophy size={21} />} label="Accepted" value={analytics?.accepted_submissions ?? 0} />
//                 <AnalyticsCard icon={<Code2 size={21} />} label="Problems" value={analytics?.total_problems ?? problems.length} />
//               </div>

//               <div className="test-overview-card">
//                 <h3>Problem Summary</h3>

//                 <div className="teacher-table-wrapper">
//                   <table className="teacher-data-table">
//                     <thead>
//                       <tr>
//                         <th>Problem</th>
//                         <th>Submissions</th>
//                         <th>Accepted</th>
//                       </tr>
//                     </thead>

//                     <tbody>
//                       {(analytics?.problem_summary || []).map((p, i) => (
//                         <tr key={p.problem_id ?? i}>
//                           <td>{p.problem_title || p.title || `Problem ${p.problem_id}`}</td>
//                           <td>{p.submissions ?? p.submission_count ?? 0}</td>
//                           <td>{p.accepted ?? p.accepted_count ?? 0}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
//             </>
//           )}
//         </section>
//       )}

//       {/* ======================================================
//           PROCTORING
//           ====================================================== */}

//       {tab === "proctoring" && (
//         <ProctoringPanel
//           sessions={proctoring.sessions}
//           maxSwitches={proctoring.max_switches}
//           gazeAlertAt={proctoring.gaze_alert_at}
//           loading={proctoringLoading}
//           error={proctoringError}
//           onRefresh={() => loadProctoring(true)}
//           onUnlock={unlockStudent}
//           onFreeze={freezeStudent}
//           onEnd={endStudentTest}
//           onClearAlerts={clearStudentAlerts}
//           busyKey={busyKey}
//         />
//       )}

//       {/* ======================================================
//           INCIDENTS (photo alerts)
//           ====================================================== */}

//       {tab === "incidents" && (
//         <IncidentPanel
//           contestId={contestId}
//           onChanged={() => loadProctoring()}
//         />
//       )}

//       {/* ======================================================
//           PLAGIARISM
//           ====================================================== */}

//       {tab === "plagiarism" && (
//         <PlagiarismPanel contestId={contestId} />
//       )}

//       {/* ======================================================
//           SETTINGS
//           ====================================================== */}

//       {tab === "settings" && (
//         <div className="teacher-settings-container">
//           <div className="settings-card">

//             <div className="settings-card-header">
//               <div className="settings-heading">
//                 <div className="settings-icon-box">
//                   <Lock size={20} />
//                 </div>
//                 <div>
//                   <h2>Test Password</h2>
//                   <p>Protect this assessment with a password.</p>
//                 </div>
//               </div>

//               <span
//                 className={`password-status ${
//                   passwordProtected ? "enabled" : "disabled"
//                 }`}
//               >
//                 {passwordProtected ? "Protected" : "Not protected"}
//               </span>
//             </div>

//             <div className="settings-divider" />

//             <div className="password-setting-body">
//               <label>Assessment Password</label>

//               <div className="password-input-wrapper">
//                 <input
//                   type={showPassword ? "text" : "password"}
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   placeholder={
//                     passwordProtected ? "Enter new password" : "Enter password"
//                   }
//                   autoComplete="new-password"
//                 />

//                 <button
//                   type="button"
//                   className="password-eye-btn"
//                   onClick={() => setShowPassword(!showPassword)}
//                 >
//                   {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
//                 </button>
//               </div>

//               <div className="password-setting-actions">
//                 <button
//                   className="save-password-btn"
//                   disabled={savingPassword || password.trim().length < 4}
//                   onClick={() => savePassword(password.trim())}
//                 >
//                   <Unlock size={16} />{" "}
//                   {savingPassword ? "Saving..." : "Save Password"}
//                 </button>

//                 {passwordProtected && (
//                   <button
//                     className="outline-btn"
//                     disabled={savingPassword}
//                     onClick={() => {
//                       if (window.confirm("Remove test password?")) {
//                         savePassword("");
//                       }
//                     }}
//                   >
//                     Remove Password
//                   </button>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ============================================================
//    REUSABLE COMPONENTS
//    ============================================================ */

// function TestStat({ icon, title, value, color }) {
//   return (
//     <div className={`test-stat-card ${color || ""}`}>
//       <div className="test-stat-icon">{icon}</div>
//       <div>
//         <span>{title}</span>
//         <strong>{value}</strong>
//       </div>
//     </div>
//   );
// }

// function TabButton({ active, onClick, icon, children }) {
//   return (
//     <button
//       type="button"
//       className={`test-tab ${active ? "active" : ""}`}
//       onClick={onClick}
//     >
//       {icon} {children}
//     </button>
//   );
// }

// function InfoItem({ label, value }) {
//   return (
//     <div className="overview-info-item">
//       <span>{label}</span>
//       <strong>{value ?? "—"}</strong>
//     </div>
//   );
// }

// function AnalyticsCard({ icon, label, value }) {
//   return (
//     <div className="analytics-card">
//       <div>{icon}</div>
//       <span>{label}</span>
//       <strong>{value}</strong>
//     </div>
//   );
// }

// export default TeacherTestPage;
import {
  ArrowLeft, Eye, Settings, Code2, BarChart3, FileText,
  Clock, Send, Lock, Unlock, EyeOff, CheckCircle,
  AlertCircle, RefreshCw, Users, Trophy, ShieldAlert,
  Sparkles, Trash2, ChevronDown, ChevronUp, AlertTriangle,
  Download, Search, ArrowRight, CalendarClock, Plus, ShieldCheck, Inbox
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProblemManager from "./ProblemManager.jsx";
import PlagiarismPanel from "./PlagiarismPanel.jsx";
import ProctoringPanel from "./ProctoringPanel.jsx";
import IncidentPanel from "./IncidentPanel.jsx";
import "./TeacherTest.css";
import "./Proctoring.css";
import "./Aiquestiongenerator.css";
import "./TeacherTestPage.css";

const API_BASE = "http://localhost:5000";

const DEFAULT_MAX_MARKS = 10;

// Frozen students aur camera alerts itne ms mein refresh hote rehte hain
const PROCTORING_POLL_MS = 10000;

let draftCounter = 0;

/* ---------- chhote helpers (UI ke liye) ---------- */

const spanText = (ms) => {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const shortDate = (value, withYear = false) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit"
  });
};

const relTime = (value) => {
  if (!value) return "—";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 10080) return `${Math.floor(mins / 1440)}d ago`;
  return shortDate(value);
};

const verdictTone = (v) => {
  const x = String(v || "").trim().toUpperCase();
  if (x === "AC" || x.includes("ACCEPT")) return "ok";
  if (x === "WA" || x.includes("WRONG")) return "bad";
  if (x.includes("TLE") || x.includes("TIME") || x === "RE" || x.includes("RUN")) return "warn";
  return "neutral";
};

const verdictLabel = (v) => {
  const x = String(v || "Pending").trim();
  const u = x.toUpperCase();
  if (u.includes("ACCEPT")) return "AC";
  if (u.includes("WRONG")) return "WA";
  if (u.includes("TIME")) return "TLE";
  if (u.includes("RUNTIME")) return "RE";
  return x.length > 10 ? `${x.slice(0, 9)}…` : x;
};

const verdictMatches = (s, id) => {
  if (id === "all") return true;
  const v = (s.verdict || "").trim().toUpperCase();
  if (id === "AC") return v === "AC" || v.includes("ACCEPT");
  if (id === "WA") return v === "WA" || v.includes("WRONG");
  if (id === "TLE") return v === "TLE" || v.includes("TIME");
  if (id === "RE") return v === "RE" || v.includes("RUN");
  return true;
};

const isPublished = (s) =>
  Boolean(s.published_at) ||
  String(s.teacher_review_status || "").toLowerCase() === "published";

function TeacherTestPage({ test, onBack }) {
  const [tab, setTab] = useState("overview");
  const [problems, setProblems] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingReview, setSavingReview] = useState(null);
  const [reviews, setReviews] = useState({});
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionVerdictFilter, setSubmissionVerdictFilter] = useState("all");
  const [, setTick] = useState(0); // time-left / progress har minute refresh

  // Proctoring
  const [proctoring, setProctoring] = useState({
    sessions: [],
    max_switches: 6,
    gaze_alert_at: 3,
    pending_incidents: 0,
    frozen_count: 0,
    alert_count: 0
  });
  const [proctoringLoading, setProctoringLoading] = useState(false);
  const [proctoringError, setProctoringError] = useState("");
  const [busyKey, setBusyKey] = useState(null);

  // AI question generator
  const [aiTopic, setAiTopic] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("Easy");
  const [aiCount, setAiCount] = useState(3);
  const [aiNotes, setAiNotes] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const token = localStorage.getItem("codeshield_token");
  const contestId = test?.contest_id;

  /* ==========================================================
     API HELPER
     ========================================================== */

  const api = useCallback(async (url, options = {}) => {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  }, [token]);

  /* ==========================================================
     LOADERS
     ========================================================== */

  const loadProblems = useCallback(async () => {
    if (!contestId || !token) return;

    try {
      const data = await api(`/api/tests/${contestId}/problems`);
      setProblems(data.problems || []);
    } catch (e) {
      setError(e.message);
    }
  }, [api, contestId, token]);

  const loadDetails = useCallback(async () => {
    if (!contestId || !token) return;

    try {
      const data = await api(`/api/teacher/tests/${contestId}`);
      setPasswordProtected(Boolean(data.password_protected));
    } catch (e) {
      setError(e.message);
    }
  }, [api, contestId, token]);

  const loadReport = useCallback(async () => {
    if (!contestId || !token) return;

    setLoading(true);
    setError("");

    try {
      const data = await api(`/api/teacher/tests/${contestId}/report`);
      const list = data.submissions || [];

      setSubmissions(list);
      setAnalytics(data.analytics || null);

      const initialReviews = {};

      list.forEach((s) => {
        initialReviews[s.submission_id] = {
          awarded_marks: s.awarded_marks ?? "",
          teacher_feedback: s.teacher_feedback ?? ""
        };
      });

      setReviews(initialReviews);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api, contestId, token]);

  const loadProctoring = useCallback(async (showLoader = false) => {
    if (!contestId || !token) return;

    if (showLoader) setProctoringLoading(true);

    try {
      const data = await api(`/api/teacher/tests/${contestId}/proctoring`);

      setProctoring({
        sessions: data.sessions || [],
        max_switches: data.max_switches ?? 6,
        gaze_alert_at: data.gaze_alert_at ?? 3,
        pending_incidents: data.pending_incidents ?? 0,
        frozen_count: data.frozen_count ?? 0,
        alert_count: data.alert_count ?? 0
      });

      setProctoringError("");
    } catch (e) {
      setProctoringError(e.message);
    } finally {
      if (showLoader) setProctoringLoading(false);
    }
  }, [api, contestId, token]);

  useEffect(() => {
    loadProblems();
    loadDetails();
  }, [loadProblems, loadDetails]);

  useEffect(() => {
    if (tab === "submissions" || tab === "analytics" || tab === "overview") {
      loadReport();
    }
  }, [tab, loadReport]);

  // Frozen students aur camera alerts har 10 second mein refresh hote hain
  useEffect(() => {
    if (!contestId || !token) return undefined;

    loadProctoring();

    const timer = setInterval(() => loadProctoring(), PROCTORING_POLL_MS);

    return () => clearInterval(timer);
  }, [loadProctoring, contestId, token]);

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  /* ==========================================================
     AI: GENERATE / EDIT / SAVE
     ========================================================== */

  const generateQuestions = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (aiTopic.trim().length < 3) {
      setError("Please describe the topic using at least 3 characters.");
      return;
    }

    setGenerating(true);

    try {
      const data = await api("/api/teacher/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          topic: aiTopic.trim(),
          difficulty: aiDifficulty,
          count: Number(aiCount),
          notes: aiNotes.trim()
        })
      });

      const fresh = (data.questions || []).map((q) => ({
        ...q,
        _id: ++draftCounter,
        selected: true,
        open: false
      }));

      setDrafts((prev) => [...prev, ...fresh]);

      setMessage(
        `${fresh.length} question(s) generated. Review them and add the ones you want to this test.`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const updateDraft = (id, patch) => {
    setDrafts((prev) =>
      prev.map((d) => (d._id === id ? { ...d, ...patch } : d))
    );
  };

  const removeDraft = (id) => {
    setDrafts((prev) => prev.filter((d) => d._id !== id));
  };

  const selectedDrafts = drafts.filter((d) => d.selected);

  const saveDraftsToTest = async () => {
    setError("");
    setMessage("");

    if (selectedDrafts.length === 0) {
      setError("Select at least one question.");
      return;
    }

    const unverified = selectedDrafts.filter((d) => !d.verified).length;

    if (
      unverified > 0 &&
      !window.confirm(
        `${unverified} selected question(s) are not verified. Add them anyway?`
      )
    ) {
      return;
    }

    for (const d of selectedDrafts) {
      const marks = Number(d.max_marks);
      if (!d.title.trim() || !d.statement.trim()) {
        setError("Every selected question needs a title and a statement.");
        return;
      }
      if (!Number.isFinite(marks) || marks <= 0) {
        setError(`"${d.title}": maximum marks must be greater than 0.`);
        return;
      }
    }

    setSavingAi(true);

    try {
      const questions = selectedDrafts.map((d) => ({
        title: d.title,
        statement: d.statement,
        difficulty: d.difficulty,
        time_limit_ms: d.time_limit_ms,
        memory_limit_mb: d.memory_limit_mb,
        max_marks: Number(d.max_marks),
        test_cases: d.test_cases
      }));

      const result = await api(`/api/teacher/tests/${contestId}/ai/save`, {
        method: "POST",
        body: JSON.stringify({ questions })
      });

      setDrafts((prev) =>
        prev.filter((d) => !selectedDrafts.some((s) => s._id === d._id))
      );

      await loadProblems();

      setMessage(
        `${selectedDrafts.length} question(s) added to this test. ${result.message || ""}`
      );
      setTab("problems");
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingAi(false);
    }
  };

  /* ==========================================================
     PROCTORING ACTIONS: UNLOCK / FREEZE / END / CLEAR ALERTS
     ========================================================== */

  const runProctorAction = async (session, action, confirmText) => {
    if (!window.confirm(confirmText)) return;

    setBusyKey(`${action}-${session.user_id}`);
    setError("");
    setMessage("");

    try {
      const data = await api(
        `/api/teacher/tests/${contestId}/sessions/${session.user_id}/${action}`,
        { method: "POST", body: JSON.stringify({}) }
      );

      setMessage(data.message || "Done.");

      await loadProctoring();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  };

  const unlockStudent = (session) =>
    runProctorAction(
      session,
      "unlock",
      `Unlock ${session.username}? They can continue the test and their tab-switch count resets to 0.`
    );

  const freezeStudent = (session) =>
    runProctorAction(
      session,
      "freeze",
      `Freeze ${session.username}'s test? They cannot continue until you unlock them.`
    );

  const endStudentTest = (session) =>
    runProctorAction(
      session,
      "end",
      `End ${session.username}'s test? Their test will be submitted and they cannot continue.`
    );

  const clearStudentAlerts = (session) =>
    runProctorAction(
      session,
      "clear-alerts",
      `Clear the camera alerts for ${session.username}? Use this for a false alarm.`
    );

  /* ==========================================================
     REMOVE QUESTION FROM TEST
     ========================================================== */

  const removeProblem = async (problem) => {
    const ok = window.confirm(
      `Remove "${problem.title}" from this test? Its test cases will also be deleted. This cannot be undone.`
    );

    if (!ok) return;

    setRemovingId(problem.problem_id);
    setError("");
    setMessage("");

    try {
      await api(`/api/teacher/problems/${problem.problem_id}`, {
        method: "DELETE"
      });

      setMessage(`"${problem.title}" removed from the test.`);
      await loadProblems();
    } catch (e) {
      setError(e.message);
    } finally {
      setRemovingId(null);
    }
  };

  /* ==========================================================
     PASSWORD
     ========================================================== */

  const savePassword = async (value) => {
    setSavingPassword(true);
    setError("");
    setMessage("");

    try {
      await api(`/api/teacher/tests/${contestId}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: value })
      });

      setPasswordProtected(Boolean(value));
      setPassword("");
      setMessage(value ? "Test password saved." : "Test password removed.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  /* ==========================================================
     REVIEW / PUBLISH
     ========================================================== */

  const updateReview = (id, field, value) => {
    setReviews((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }));
  };

  const saveReview = async (submission, publish) => {
    const id = submission.submission_id;
    const review = reviews[id] || {};
    const marks = Number(review.awarded_marks);
    const max = Number(submission.max_marks ?? DEFAULT_MAX_MARKS);

    if (
      review.awarded_marks === "" ||
      review.awarded_marks === undefined ||
      !Number.isFinite(marks) ||
      marks < 0
    ) {
      setError("Please enter valid marks before reviewing.");
      return;
    }

    if (marks > max) {
      setError(`Marks cannot exceed ${max}.`);
      return;
    }

    setSavingReview(id);
    setError("");
    setMessage("");

    try {
      await api(`/api/teacher/submissions/${id}/review`, {
        method: "PUT",
        body: JSON.stringify({
          awarded_marks: marks,
          teacher_feedback: review.teacher_feedback || "",
          action: publish ? "publish" : "save"
        })
      });

      setMessage(
        publish ? "Result approved and published." : "Review saved."
      );

      await loadReport();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingReview(null);
    }
  };

  const exportGradebookCSV = () => {
    if (!submissions || submissions.length === 0) {
      alert("No submissions available to export.");
      return;
    }
    const headers = [
      "Submission ID",
      "Student",
      "Problem",
      "Language",
      "Verdict",
      "Test Cases Passed",
      "Total Test Cases",
      "Awarded Marks",
      "Max Marks",
      "Execution Time (ms)",
      "Memory (KB)",
      "Submitted At",
      "Teacher Feedback"
    ];

    const rows = submissions.map((s) => {
      const review = reviews[s.submission_id] || {};
      const marks =
        review.awarded_marks !== "" && review.awarded_marks != null
          ? review.awarded_marks
          : s.awarded_marks ?? "";
      const feedback = review.teacher_feedback || s.teacher_feedback || "";

      return [
        s.submission_id,
        `"${(s.username || s.student_name || `Student ${s.user_id}`).replace(/"/g, '""')}"`,
        `"${(s.problem_title || s.problem || `Problem ${s.problem_id}`).replace(/"/g, '""')}"`,
        s.language || "cpp",
        s.verdict || "—",
        s.test_cases_passed ?? 0,
        s.test_cases_total ?? 0,
        marks,
        s.max_marks ?? DEFAULT_MAX_MARKS,
        s.execution_time_ms ?? 0,
        s.memory_used_kb ?? 0,
        s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—",
        `"${feedback.replace(/"/g, '""')}"`
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const safeTitle = (test?.title || "assessment").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CodeShield_${safeTitle}_Gradebook.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const q = submissionSearch.trim().toLowerCase();
      const studentName = (s.username || s.student_name || "").toLowerCase();
      const problemName = (s.problem_title || s.problem || "").toLowerCase();
      const matchesSearch = !q || studentName.includes(q) || problemName.includes(q);
      if (!matchesSearch) return false;

      if (submissionVerdictFilter === "all") return true;
      const verdict = (s.verdict || "").trim().toUpperCase();
      if (submissionVerdictFilter === "AC") return verdict === "AC" || verdict.includes("ACCEPT");
      if (submissionVerdictFilter === "WA") return verdict === "WA" || verdict.includes("WRONG");
      if (submissionVerdictFilter === "TLE") return verdict === "TLE" || verdict.includes("TIME");
      if (submissionVerdictFilter === "RE") return verdict === "RE" || verdict.includes("RUN");
      return true;
    });
  }, [submissions, submissionSearch, submissionVerdictFilter]);

  /* ==========================================================
     GUARD
     ========================================================== */

  if (!test || !contestId) {
    return (
      <div className="teacher-test-page">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Tests
        </button>
        <p>No test selected.</p>
      </div>
    );
  }

  /* ==========================================================
     HELPERS
     ========================================================== */

  const date = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  };

  const start = test.start_time ? new Date(test.start_time) : null;
  const end = test.end_time ? new Date(test.end_time) : null;
  const now = new Date();

  let status = "Active";
  let statusClass = "success";

  if (start && now < start) {
    status = "Upcoming";
    statusClass = "warning";
  } else if (end && now > end) {
    status = "Ended";
    statusClass = "neutral";
  }

  const submissionCount = submissions.length || test.submission_count || 0;

  const frozenCount = proctoring.frozen_count;
  const alertCount = proctoring.alert_count;
  const pendingIncidents = proctoring.pending_incidents;

  const bannerParts = [];

  if (frozenCount > 0) {
    bannerParts.push(`${frozenCount} frozen`);
  }

  if (alertCount > 0) {
    bannerParts.push(`${alertCount} with suspicious camera activity`);
  }

  if (pendingIncidents > 0) {
    bannerParts.push(
      `${pendingIncidents} photo alert${pendingIncidents > 1 ? "s" : ""}`
    );
  }

  const totalMarks = problems.reduce((sum, p) => sum + Number(p.max_marks || 0), 0);

  const unreviewedCount = submissions.filter((s) => !isPublished(s)).length;

  const recentSubmissions = [...submissions]
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))
    .slice(0, 5);

  let timeLabel = "Ends in";
  let timeValue = "—";
  let progress = 0;

  if (status === "Upcoming" && start) {
    timeLabel = "Starts in";
    timeValue = spanText(start - now);
  } else if (status === "Ended" && end) {
    timeLabel = "Ended";
    timeValue = `${spanText(now - end)} ago`;
  } else if (end) {
    timeValue = spanText(end - now);
  }

  if (start && end && end > start) {
    progress = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  }

  const attention = [];

  if (pendingIncidents > 0) {
    attention.push({
      key: "incidents",
      tone: "red",
      icon: <AlertTriangle size={16} />,
      title: `${pendingIncidents} photo alert${pendingIncidents > 1 ? "s" : ""} pending`,
      hint: "Review the camera snapshots and decide",
      tab: "incidents"
    });
  }

  if (frozenCount > 0) {
    attention.push({
      key: "frozen",
      tone: "amber",
      icon: <Lock size={16} />,
      title: `${frozenCount} frozen student${frozenCount > 1 ? "s" : ""}`,
      hint: "Unlock them or end their test",
      tab: "proctoring"
    });
  }

  if (alertCount > 0) {
    attention.push({
      key: "gaze",
      tone: "amber",
      icon: <ShieldAlert size={16} />,
      title: `${alertCount} with suspicious camera activity`,
      hint: "Check the proctoring panel",
      tab: "proctoring"
    });
  }

  if (unreviewedCount > 0) {
    attention.push({
      key: "review",
      tone: "blue",
      icon: <Send size={16} />,
      title: `${unreviewedCount} submission${unreviewedCount > 1 ? "s" : ""} awaiting review`,
      hint: "Check marks and publish results",
      tab: "submissions"
    });
  }

  if (problems.length === 0 && status !== "Ended") {
    attention.push({
      key: "noproblems",
      tone: "blue",
      icon: <Code2 size={16} />,
      title: "No problems added yet",
      hint: "Students have nothing to solve until you add some",
      tab: "problems"
    });
  }

  const attentionCount = attention.length;

  const acceptRate = (() => {
    const total = Number(analytics?.total_submissions ?? submissions.length);
    const acc = Number(analytics?.accepted_submissions ?? 0);
    return total > 0 ? Math.round((acc / total) * 100) : 0;
  })();

  const nextAction =
    problems.length === 0
      ? { tab: "problems", label: "Add problems", icon: <Plus size={15} /> }
      : unreviewedCount > 0
        ? { tab: "submissions", label: "Review submissions", icon: <Users size={15} /> }
        : { tab: "ai", label: "Generate with AI", icon: <Sparkles size={15} /> };

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="teacher-test-page">

      {/* HEADER */}
      <header className="tp-header">
        <div className="tp-crumb">
          <button type="button" className="tp-crumb-back" onClick={onBack}>
            <ArrowLeft size={15} /> Tests
          </button>
          <span>/</span>
          <strong>{test.title}</strong>
        </div>

        <div className="tp-title-row">
          <div className="tp-title-block">
            <div className="tp-title-line">
              <h1>{test.title || "Untitled Test"}</h1>
              <span className={`tp-status ${statusClass}`}>
                <i /> {status}
              </span>
            </div>

            <p className="tp-desc">{test.description || "Coding assessment"}</p>

            <div className="tp-meta">
              <span>
                <CalendarClock size={14} />
                {shortDate(start)} <ArrowRight size={12} /> {shortDate(end)}
              </span>
              {passwordProtected && (
                <span>
                  <Lock size={13} /> Password protected
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="tp-btn tp-btn-primary"
            onClick={() => setTab(nextAction.tab)}
          >
            {nextAction.icon} {nextAction.label}
          </button>
        </div>

        {status === "Active" && start && end && (
          <div className="tp-progress" title={`${progress}% of the test time has passed`}>
            <div className="tp-progress-bar">
              <div style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}% elapsed</span>
          </div>
        )}
      </header>

      {/* PROCTORING ALERT (overview ke bahar kisi bhi tab par) */}
      {bannerParts.length > 0 && tab !== "overview" && (
        <div className="pc-banner" role="alert">
          <span>
            <Lock size={16} />
            {bannerParts.join(" · ")}: waiting for your decision
          </span>

          {tab !== "proctoring" && tab !== "incidents" && (
            <button
              type="button"
              onClick={() =>
                setTab(pendingIncidents > 0 ? "incidents" : "proctoring")
              }
            >
              Review &amp; decide
            </button>
          )}
        </div>
      )}

      {/* STATS */}
      <div className="tp-stats">
        <TpStat
          tone="blue"
          icon={<Clock size={18} />}
          label={timeLabel}
          value={timeValue}
          sub={status === "Ended" ? shortDate(end) : status === "Upcoming" ? shortDate(start) : `until ${shortDate(end)}`}
        />
        <TpStat
          tone="amber"
          icon={<Code2 size={18} />}
          label="Problems"
          value={problems.length}
          sub={problems.length ? `${totalMarks} marks in total` : "None added yet"}
        />
        <TpStat
          tone="violet"
          icon={<Send size={18} />}
          label="Submissions"
          value={submissionCount}
          sub={analytics?.total_students != null ? `from ${analytics.total_students} student(s)` : " "}
        />
        <TpStat
          tone={attentionCount > 0 ? "amber" : "green"}
          icon={attentionCount > 0 ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
          label="Needs attention"
          value={attentionCount}
          sub={attentionCount > 0 ? `item${attentionCount > 1 ? "s" : ""} to look at` : "All clear"}
        />
      </div>

      {/* TABS */}
      <nav className="tp-tabs" aria-label="Test sections">
        <TpTab active={tab === "overview"} onClick={() => setTab("overview")} icon={<FileText size={15} />}>Overview</TpTab>

        <span className="tp-tab-sep" />

        <TpTab active={tab === "problems"} onClick={() => setTab("problems")} icon={<Code2 size={15} />} count={problems.length}>Problems</TpTab>
        <TpTab active={tab === "ai"} onClick={() => setTab("ai")} icon={<Sparkles size={15} />} badge={drafts.length}>AI Generate</TpTab>

        <span className="tp-tab-sep" />

        <TpTab active={tab === "submissions"} onClick={() => setTab("submissions")} icon={<Send size={15} />} badge={unreviewedCount}>Submissions &amp; Marks</TpTab>
        <TpTab active={tab === "analytics"} onClick={() => setTab("analytics")} icon={<BarChart3 size={15} />}>Analytics</TpTab>

        <span className="tp-tab-sep" />

        <TpTab active={tab === "proctoring"} onClick={() => setTab("proctoring")} icon={<Lock size={15} />} badge={frozenCount + alertCount} danger>Proctoring</TpTab>
        <TpTab active={tab === "incidents"} onClick={() => setTab("incidents")} icon={<AlertTriangle size={15} />} badge={pendingIncidents} danger>Incidents</TpTab>
        <TpTab active={tab === "plagiarism"} onClick={() => setTab("plagiarism")} icon={<ShieldAlert size={15} />}>Plagiarism</TpTab>

        <span className="tp-tab-sep" />

        <TpTab active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings size={15} />}>Settings</TpTab>
      </nav>

      {/* MESSAGES */}
      {error && (
        <div className="settings-message error">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {message && (
        <div className="settings-message success">
          <CheckCircle size={16} /> {message}
        </div>
      )}

      {/* ======================================================
          OVERVIEW
          ====================================================== */}

      {tab === "overview" && (
        <div className="tp-overview">
          <div className="tp-col">
            <TpCard
              title="Needs attention"
              icon={<AlertTriangle size={16} />}
              meta={attention.length ? String(attention.length) : null}
            >
              {attention.length === 0 ? (
                <div className="tp-allgood">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>All clear</strong>
                    <span>No frozen students, camera alerts or pending reviews.</span>
                  </div>
                </div>
              ) : (
                <ul className="tp-attn-list">
                  {attention.map((a) => (
                    <li key={a.key}>
                      <button
                        type="button"
                        className={`tp-attn tone-${a.tone}`}
                        onClick={() => setTab(a.tab)}
                      >
                        <span className="tp-attn-ico">{a.icon}</span>
                        <span className="tp-attn-text">
                          <strong>{a.title}</strong>
                          <em>{a.hint}</em>
                        </span>
                        <ArrowRight size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TpCard>

            <TpCard
              title="Problems"
              icon={<Code2 size={16} />}
              meta={String(problems.length)}
              action={
                <button type="button" className="tp-link" onClick={() => setTab("problems")}>
                  Manage <ArrowRight size={13} />
                </button>
              }
            >
              {problems.length === 0 ? (
                <TpEmpty
                  icon={<Code2 size={20} />}
                  title="No problems yet"
                  text="Add problems manually or let AI draft them with test cases."
                >
                  <button type="button" className="tp-btn tp-btn-primary" onClick={() => setTab("ai")}>
                    <Sparkles size={15} /> Generate with AI
                  </button>
                  <button type="button" className="tp-btn tp-btn-ghost" onClick={() => setTab("problems")}>
                    <Plus size={15} /> Add manually
                  </button>
                </TpEmpty>
              ) : (
                <>
                  <ul className="tp-problems">
                    {problems.slice(0, 6).map((p, i) => (
                      <li key={p.problem_id}>
                        <span className="tp-num">{i + 1}</span>
                        <span className="tp-p-title">{p.title}</span>
                        <span className={`tp-diff ${(p.difficulty || "easy").toLowerCase()}`}>
                          {p.difficulty || "Easy"}
                        </span>
                        <span className="tp-marks">{p.max_marks} marks</span>
                      </li>
                    ))}
                  </ul>
                  {problems.length > 6 && (
                    <button type="button" className="tp-link tp-more" onClick={() => setTab("problems")}>
                      +{problems.length - 6} more problem(s)
                    </button>
                  )}
                </>
              )}
            </TpCard>
          </div>

          <div className="tp-col">
            <TpCard title="Test details" icon={<FileText size={16} />}>
              <dl className="tp-details">
                <TpRow label="Status">
                  <span className={`tp-status small ${statusClass}`}><i /> {status}</span>
                </TpRow>
                <TpRow label="Starts">{shortDate(start, true)}</TpRow>
                <TpRow label="Ends">{shortDate(end, true)}</TpRow>
                <TpRow label="Password">
                  {passwordProtected ? (
                    <span className="tp-pill ok"><Lock size={11} /> Protected</span>
                  ) : (
                    <button type="button" className="tp-link" onClick={() => setTab("settings")}>
                      Not set · Add
                    </button>
                  )}
                </TpRow>
                <TpRow label="Tab-switch limit">{proctoring.max_switches}</TpRow>
                <TpRow label="Students">{analytics?.total_students ?? "—"}</TpRow>
              </dl>
            </TpCard>

            <TpCard
              title="Recent submissions"
              icon={<Send size={16} />}
              action={
                submissions.length > 0 ? (
                  <button type="button" className="tp-link" onClick={() => setTab("submissions")}>
                    View all <ArrowRight size={13} />
                  </button>
                ) : null
              }
            >
              {loading && submissions.length === 0 ? (
                <p className="tp-muted">Loading…</p>
              ) : recentSubmissions.length === 0 ? (
                <TpEmpty
                  small
                  icon={<Inbox size={18} />}
                  title="No submissions yet"
                  text="They will show up here as students submit."
                />
              ) : (
                <ul className="tp-recent">
                  {recentSubmissions.map((s) => (
                    <li key={s.submission_id}>
                      <span className="tp-avatar">
                        {(s.username || s.student_name || "S").charAt(0).toUpperCase()}
                      </span>
                      <span className="tp-recent-text">
                        <strong>{s.username || s.student_name || `Student ${s.user_id}`}</strong>
                        <em>{s.problem_title || s.problem || `Problem ${s.problem_id}`}</em>
                      </span>
                      <span className="tp-recent-side">
                        <span className={`tp-pill ${verdictTone(s.verdict)}`}>
                          {verdictLabel(s.verdict || s.status)}
                        </span>
                        <small>{relTime(s.submitted_at)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TpCard>
          </div>
        </div>
      )}

      {/* ======================================================
          PROBLEMS
          ====================================================== */}

      {tab === "problems" && (
        <div className="tp-stack">
          <section className="tp-panel">
            <div className="tp-panel-head">
              <div>
                <h2>Questions in this test <em>{problems.length}</em></h2>
                <p>Total {totalMarks} marks. Add more below or generate them with AI.</p>
              </div>
              <div className="tp-panel-actions">
                <button type="button" className="tp-btn tp-btn-ghost" onClick={() => setTab("ai")}>
                  <Sparkles size={15} /> Generate with AI
                </button>
                <button type="button" className="tp-btn tp-btn-ghost" onClick={loadProblems}>
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>
            </div>

            {problems.length === 0 ? (
              <TpEmpty
                icon={<Code2 size={20} />}
                title="No questions yet"
                text="Add them manually using the form below or use AI Generate."
              />
            ) : (
              <div className="tp-table-wrap">
                <table className="tp-table">
                  <thead>
                    <tr>
                      <th style={{ width: 52 }}>#</th>
                      <th>Title</th>
                      <th>Difficulty</th>
                      <th>Marks</th>
                      <th style={{ width: 120 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map((p, i) => (
                      <tr key={p.problem_id}>
                        <td><span className="tp-num">{i + 1}</span></td>
                        <td className="tp-strong">{p.title}</td>
                        <td>
                          <span className={`tp-diff ${(p.difficulty || "easy").toLowerCase()}`}>
                            {p.difficulty || "Easy"}
                          </span>
                        </td>
                        <td>{p.max_marks}</td>
                        <td className="tp-right">
                          <button
                            type="button"
                            className="tp-btn tp-btn-danger tp-btn-sm"
                            disabled={removingId === p.problem_id}
                            onClick={() => removeProblem(p)}
                          >
                            <Trash2 size={13} />
                            {removingId === p.problem_id ? "Removing…" : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <ProblemManager
            test={test}
            problems={problems}
            reloadProblems={loadProblems}
          />
        </div>
      )}

      {/* ======================================================
          AI GENERATE
          ====================================================== */}

      {tab === "ai" && (
        <section className="aiq">
          <form className="aiq-card" onSubmit={generateQuestions}>
            <div className="aiq-head">
              <div className="aiq-icon"><Sparkles size={20} /></div>
              <div>
                <h2>Generate questions with AI</h2>
                <p>
                  Gemini creates the problem statement with visible and hidden
                  test cases. Selected questions are added to this test and
                  appear on the student dashboard automatically.
                </p>
              </div>
            </div>

            <label htmlFor="ai-topic">Topic</label>
            <textarea
              id="ai-topic"
              rows={3}
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Example: arrays, binary search, linked lists"
              maxLength={500}
              required
            />

            <div className="aiq-row">
              <div>
                <label htmlFor="ai-difficulty">Difficulty</label>
                <select
                  id="ai-difficulty"
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value)}
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
              <div>
                <label htmlFor="ai-count">Number of questions (1–8)</label>
                <input
                  id="ai-count"
                  type="number"
                  min="1"
                  max="8"
                  value={aiCount}
                  onChange={(e) => setAiCount(e.target.value)}
                  required
                />
              </div>
            </div>

            <label htmlFor="ai-notes">Extra instructions (optional)</label>
            <input
              id="ai-notes"
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              placeholder="Example: avoid recursion"
              maxLength={1000}
            />

            <div className="aiq-actions">
              <button
                className="primary-small-btn"
                type="submit"
                disabled={generating || savingAi}
              >
                <Sparkles size={16} />
                {generating ? "Generating..." : "Generate questions"}
              </button>

              {drafts.length > 0 && (
                <button
                  type="button"
                  className="outline-btn"
                  disabled={generating || savingAi}
                  onClick={() => {
                    if (window.confirm("Remove all unsaved drafts?")) setDrafts([]);
                  }}
                >
                  Clear drafts
                </button>
              )}
            </div>
          </form>

          {drafts.length > 0 && (
            <div className="aiq-card">
              <div className="aiq-list-head">
                <div>
                  <h3>Draft questions ({drafts.length})</h3>
                  <p>{selectedDrafts.length} selected</p>
                </div>
                <div className="aiq-actions">
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() =>
                      setDrafts((prev) => prev.map((d) => ({ ...d, selected: true })))
                    }
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() =>
                      setDrafts((prev) => prev.map((d) => ({ ...d, selected: false })))
                    }
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              <div className="aiq-drafts">
                {drafts.map((d) => (
                  <article
                    key={d._id}
                    className={`aiq-draft ${d.selected ? "selected" : ""}`}
                  >
                    <div className="aiq-draft-top">
                      <label className="aiq-check">
                        <input
                          type="checkbox"
                          checked={d.selected}
                          onChange={(e) =>
                            updateDraft(d._id, { selected: e.target.checked })
                          }
                        />
                        Select
                      </label>

                      <span className={`aiq-badge ${d.verified ? "ok" : "warn"}`}>
                        {d.verified ? "Verified" : "Not verified"}
                      </span>

                      <span className={`difficulty ${(d.difficulty || "easy").toLowerCase()}`}>
                        {d.difficulty}
                      </span>

                      <button
                        type="button"
                        className="aiq-icon-btn"
                        title="Remove question"
                        onClick={() => removeDraft(d._id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <p className={`aiq-note ${d.verified ? "ok" : "warn"}`}>
                      {!d.verified && <AlertTriangle size={13} />} {d.verify_note}
                    </p>

                    <label>Title</label>
                    <input
                      value={d.title}
                      onChange={(e) => updateDraft(d._id, { title: e.target.value })}
                    />

                    <label>Statement</label>
                    <textarea
                      rows={8}
                      value={d.statement}
                      onChange={(e) => updateDraft(d._id, { statement: e.target.value })}
                    />

                    <div className="aiq-row">
                      <div>
                        <label>Maximum marks</label>
                        <input
                          type="number"
                          min="0.5"
                          max="1000"
                          step="0.5"
                          value={d.max_marks}
                          onChange={(e) => updateDraft(d._id, { max_marks: e.target.value })}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="aiq-toggle"
                      onClick={() => updateDraft(d._id, { open: !d.open })}
                    >
                      {d.open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      {d.open ? "Hide" : "Show"} {d.test_cases?.length || 0} test cases
                      {" "}
                      ({(d.test_cases || []).filter((t) => !t.is_hidden).length} visible,{" "}
                      {(d.test_cases || []).filter((t) => t.is_hidden).length} hidden)
                    </button>

                    {d.open && (
                      <div className="aiq-cases">
                        {(d.test_cases || []).map((tc, i) => (
                          <div className="aiq-case" key={i}>
                            <div className="aiq-case-head">
                              <strong>Test case {i + 1}</strong>
                              <span className={`aiq-vis ${tc.is_hidden ? "hidden" : "visible"}`}>
                                {tc.is_hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                {tc.is_hidden ? "Hidden" : "Visible"}
                              </span>
                            </div>
                            <div className="aiq-case-grid">
                              <div>
                                <span>Input</span>
                                <pre>{tc.input}</pre>
                              </div>
                              <div>
                                <span>Expected output</span>
                                <pre>{tc.expected_output}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <div className="aiq-actions">
                <button
                  type="button"
                  className="primary-small-btn"
                  onClick={saveDraftsToTest}
                  disabled={savingAi || generating || selectedDrafts.length === 0}
                >
                  <CheckCircle size={16} />
                  {savingAi
                    ? "Saving..."
                    : `Add ${selectedDrafts.length} question(s) to this test`}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ======================================================
          SUBMISSIONS & MARKS
          ====================================================== */}

      {tab === "submissions" && (
        <section className="tp-panel">
          <div className="tp-panel-head">
            <div>
              <h2>Submissions &amp; Marks <em>{submissions.length}</em></h2>
              <p>Review automatic scores, adjust marks and publish approved results.</p>
            </div>

            <div className="tp-panel-actions">
              <button
                type="button"
                className="tp-btn tp-btn-ghost"
                onClick={exportGradebookCSV}
                title="Download CSV for Gradebook / Excel"
              >
                <Download size={15} /> Export CSV
              </button>
              <button
                type="button"
                className="tp-btn tp-btn-ghost"
                onClick={loadReport}
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? "tp-spin" : ""} />
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="tp-toolbar">
            <div className="tp-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search by student or problem…"
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
              />
            </div>

            <div className="tp-pills">
              {[
                { id: "all", label: "All" },
                { id: "AC", label: "Accepted" },
                { id: "WA", label: "Wrong answer" },
                { id: "TLE", label: "Time limit" },
                { id: "RE", label: "Runtime error" }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`tp-fpill ${submissionVerdictFilter === f.id ? "active" : ""}`}
                  onClick={() => setSubmissionVerdictFilter(f.id)}
                >
                  {f.label}
                  <em>{submissions.filter((x) => verdictMatches(x, f.id)).length}</em>
                </button>
              ))}
            </div>
          </div>

          {loading && submissions.length === 0 ? (
            <p className="tp-muted">Loading submissions…</p>
          ) : filteredSubmissions.length === 0 ? (
            <TpEmpty
              icon={<Send size={20} />}
              title={submissions.length === 0 ? "No submissions yet" : "No matching submissions"}
              text={
                submissions.length === 0
                  ? "Submissions will appear here when students submit code."
                  : "Try changing your search or the verdict filter."
              }
            />
          ) : (
            <div className="tp-subs">
              {filteredSubmissions.map((s) => {
                const review = reviews[s.submission_id] || {};
                const passed = Number(s.test_cases_passed || 0);
                const total = Number(s.test_cases_total || 0);
                const max = Number(s.max_marks ?? DEFAULT_MAX_MARKS);

                // Backend automatic_score bhejta hai; na mile to khud nikalo.
                const automaticMarks =
                  s.automatic_score != null
                    ? Number(s.automatic_score)
                    : total > 0
                      ? (passed / total) * max
                      : 0;

                const published = isPublished(s);
                const busy = savingReview === s.submission_id;
                const rawStatus = String(s.teacher_review_status || "").trim();
                const statusText = published
                  ? "Published"
                  : !rawStatus || rawStatus.toLowerCase() === "pending"
                    ? "Awaiting review"
                    : rawStatus;
                const name = s.username || s.student_name || `Student ${s.user_id}`;

                return (
                  <article className="tp-sub" key={s.submission_id}>
                    <div className="tp-sub-head">
                      <span className="tp-avatar">{name.charAt(0).toUpperCase()}</span>

                      <div className="tp-sub-who">
                        <strong>{name}</strong>
                        <em>
                          {s.problem_title || s.problem || `Problem ${s.problem_id}`}
                          {" · "}
                          {s.language || "—"}
                          {" · "}
                          {date(s.submitted_at)}
                        </em>
                      </div>

                      <div className="tp-sub-chips">
                        <span className={`tp-pill ${verdictTone(s.verdict || s.status)}`}>
                          {verdictLabel(s.verdict || s.status)}
                        </span>
                        <span className="tp-chip">
                          {passed}/{total} <small>tests</small>
                        </span>
                        <span className="tp-chip">
                          {automaticMarks.toFixed(1)}/{max} <small>auto</small>
                        </span>
                        <span className={`tp-pill ${published ? "ok" : "neutral"}`}>
                          {statusText}
                        </span>
                      </div>
                    </div>

                    <div className="tp-sub-body">
                      <div className="tp-field tp-field-marks">
                        <label>Marks (max {max})</label>
                        <input
                          type="number"
                          min="0"
                          max={max}
                          step="0.5"
                          value={review.awarded_marks ?? ""}
                          onChange={(e) =>
                            updateReview(s.submission_id, "awarded_marks", e.target.value)
                          }
                          placeholder={automaticMarks.toFixed(2)}
                        />
                      </div>

                      <div className="tp-field tp-field-fb">
                        <label>Feedback for student</label>
                        <textarea
                          value={review.teacher_feedback || ""}
                          onChange={(e) =>
                            updateReview(s.submission_id, "teacher_feedback", e.target.value)
                          }
                          placeholder="Optional feedback"
                          rows={2}
                        />
                      </div>

                      <div className="tp-sub-actions">
                        <button
                          type="button"
                          className="tp-btn tp-btn-ghost tp-btn-sm"
                          disabled={busy}
                          onClick={() =>
                            updateReview(s.submission_id, "awarded_marks", String(automaticMarks))
                          }
                        >
                          Use auto marks
                        </button>

                        <button
                          type="button"
                          className="tp-btn tp-btn-ghost tp-btn-sm"
                          disabled={busy}
                          onClick={() => saveReview(s, false)}
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          className="tp-btn tp-btn-primary tp-btn-sm"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm("Approve and publish this result to the student?")) {
                              saveReview(s, true);
                            }
                          }}
                        >
                          <CheckCircle size={14} />
                          {busy ? "Saving…" : "Approve & Publish"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ======================================================
          ANALYTICS
          ====================================================== */}

      {tab === "analytics" && (
        <section className="tp-panel">
          <div className="tp-panel-head">
            <div>
              <h2>Assessment analytics</h2>
              <p>Performance summary for this assessment.</p>
            </div>

            <div className="tp-panel-actions">
              <button type="button" className="tp-btn tp-btn-ghost" onClick={exportGradebookCSV}>
                <Download size={15} /> Export CSV
              </button>
              <button type="button" className="tp-btn tp-btn-ghost" onClick={loadReport} disabled={loading}>
                <RefreshCw size={15} className={loading ? "tp-spin" : ""} /> Refresh
              </button>
            </div>
          </div>

          {loading && !analytics ? (
            <p className="tp-muted">Loading analytics…</p>
          ) : (
            <>
              <div className="tp-stats tp-stats-in">
                <TpStat tone="blue" icon={<Users size={18} />} label="Students" value={analytics?.total_students ?? 0} sub=" " />
                <TpStat tone="violet" icon={<Send size={18} />} label="Submissions" value={analytics?.total_submissions ?? submissions.length} sub=" " />
                <TpStat tone="green" icon={<Trophy size={18} />} label="Accepted" value={analytics?.accepted_submissions ?? 0} sub={`${acceptRate}% acceptance`} />
                <TpStat tone="amber" icon={<Code2 size={18} />} label="Problems" value={analytics?.total_problems ?? problems.length} sub=" " />
              </div>

              <div className="tp-subpanel">
                <h3>Problem summary</h3>

                {(analytics?.problem_summary || []).length === 0 ? (
                  <TpEmpty small icon={<BarChart3 size={18} />} title="No data yet" text="Problem-wise numbers will appear after students submit." />
                ) : (
                  <div className="tp-table-wrap">
                    <table className="tp-table">
                      <thead>
                        <tr>
                          <th>Problem</th>
                          <th>Submissions</th>
                          <th>Accepted</th>
                          <th style={{ width: "28%" }}>Acceptance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analytics?.problem_summary || []).map((p, i) => {
                          const sub = Number(p.submissions ?? p.submission_count ?? 0);
                          const acc = Number(p.accepted ?? p.accepted_count ?? 0);
                          const pct = sub > 0 ? Math.round((acc / sub) * 100) : 0;
                          return (
                            <tr key={p.problem_id ?? i}>
                              <td className="tp-strong">{p.problem_title || p.title || `Problem ${p.problem_id}`}</td>
                              <td>{sub}</td>
                              <td>{acc}</td>
                              <td>
                                <div className="tp-rate">
                                  <div className="tp-rate-bar"><div style={{ width: `${pct}%` }} /></div>
                                  <span>{sub > 0 ? `${pct}%` : "—"}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* ======================================================
          PROCTORING
          ====================================================== */}

      {tab === "proctoring" && (
        <ProctoringPanel
          sessions={proctoring.sessions}
          maxSwitches={proctoring.max_switches}
          gazeAlertAt={proctoring.gaze_alert_at}
          loading={proctoringLoading}
          error={proctoringError}
          onRefresh={() => loadProctoring(true)}
          onUnlock={unlockStudent}
          onFreeze={freezeStudent}
          onEnd={endStudentTest}
          onClearAlerts={clearStudentAlerts}
          busyKey={busyKey}
        />
      )}

      {/* ======================================================
          INCIDENTS (photo alerts)
          ====================================================== */}

      {tab === "incidents" && (
        <IncidentPanel
          contestId={contestId}
          onChanged={() => loadProctoring()}
        />
      )}

      {/* ======================================================
          PLAGIARISM
          ====================================================== */}

      {tab === "plagiarism" && (
        <PlagiarismPanel contestId={contestId} />
      )}

      {/* ======================================================
          SETTINGS
          ====================================================== */}

      {tab === "settings" && (
        <div className="tp-stack">
          <section className="tp-panel">
            <div className="tp-panel-head">
              <div className="tp-set-title">
                <span className="tp-set-ico"><Lock size={18} /></span>
                <div>
                  <h2>Test password</h2>
                  <p>Students must enter this password before they can start the test.</p>
                </div>
              </div>

              <span className={`tp-pill ${passwordProtected ? "ok" : "neutral"}`}>
                {passwordProtected ? "Protected" : "Not protected"}
              </span>
            </div>

            <div className="tp-set-body">
              <label htmlFor="tp-pass">
                {passwordProtected ? "Set a new password" : "Assessment password"}
              </label>

              <div className="password-input-wrapper tp-pass-wrap">
                <input
                  id="tp-pass"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={passwordProtected ? "Enter new password" : "Enter password (min 4 characters)"}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="tp-set-actions">
                <button
                  type="button"
                  className="tp-btn tp-btn-primary"
                  disabled={savingPassword || password.trim().length < 4}
                  onClick={() => savePassword(password.trim())}
                >
                  <Unlock size={15} />
                  {savingPassword ? "Saving…" : "Save password"}
                </button>

                {passwordProtected && (
                  <button
                    type="button"
                    className="tp-btn tp-btn-danger"
                    disabled={savingPassword}
                    onClick={() => {
                      if (window.confirm("Remove test password?")) {
                        savePassword("");
                      }
                    }}
                  >
                    Remove password
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="tp-panel">
            <div className="tp-panel-head">
              <div>
                <h2>Test information</h2>
                <p>Read-only details of this assessment.</p>
              </div>
            </div>

            <dl className="tp-details tp-details-wide">
              <TpRow label="Status">
                <span className={`tp-status small ${statusClass}`}><i /> {status}</span>
              </TpRow>
              <TpRow label="Starts">{shortDate(start, true)}</TpRow>
              <TpRow label="Ends">{shortDate(end, true)}</TpRow>
              <TpRow label="Problems">{problems.length}</TpRow>
              <TpRow label="Tab-switch limit">{proctoring.max_switches}</TpRow>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   REUSABLE COMPONENTS
   ============================================================ */

function TpStat({ icon, label, value, sub, tone }) {
  return (
    <div className={`tp-stat tone-${tone || "blue"}`}>
      <span className="tp-stat-ico">{icon}</span>
      <div>
        <span className="tp-stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function TpTab({ active, onClick, icon, children, count, badge, danger }) {
  return (
    <button
      type="button"
      className={`tp-tab ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
      {count > 0 && <em className="tp-tab-count">{count}</em>}
      {badge > 0 && (
        <em className={`tp-tab-badge ${danger ? "danger" : ""}`}>{badge}</em>
      )}
    </button>
  );
}

function TpCard({ title, icon, meta, action, children }) {
  return (
    <section className="tp-card">
      <div className="tp-card-head">
        <h2>
          {icon}
          {title}
          {meta != null && <em>{meta}</em>}
        </h2>
        {action}
      </div>
      <div className="tp-card-body">{children}</div>
    </section>
  );
}

function TpEmpty({ icon, title, text, children, small }) {
  return (
    <div className={`tp-empty ${small ? "small" : ""}`}>
      <span className="tp-empty-ico">{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      {children && <div className="tp-empty-actions">{children}</div>}
    </div>
  );
}

function TpRow({ label, children }) {
  return (
    <div className="tp-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default TeacherTestPage;