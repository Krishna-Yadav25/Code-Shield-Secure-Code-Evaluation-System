import {
  ArrowLeft, Eye, Settings, Code2, BarChart3, FileText,
  Clock, Send, Lock, Unlock, EyeOff, CheckCircle,
  AlertCircle, RefreshCw, Users, Trophy, ShieldAlert
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ProblemManager from "./ProblemManager.jsx";
import PlagiarismPanel from "./PlagiarismPanel.jsx";
import "./TeacherTest.css";

const API_BASE = "http://localhost:5000";


const DEFAULT_MAX_MARKS = 10;

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

  useEffect(() => {
    loadProblems();
    loadDetails();
  }, [loadProblems, loadDetails]);

  useEffect(() => {
    if (tab === "submissions" || tab === "analytics") {
      loadReport();
    }
  }, [tab, loadReport]);

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

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="teacher-test-page">

      {/* BREADCRUMB */}
      <div className="test-breadcrumb">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Tests
        </button>
        <span>/</span>
        <strong>{test.title}</strong>
      </div>

      {/* HEADER */}
      <div className="test-title-row">
        <div>
          <div className="test-title-line">
            <h1>{test.title || "Untitled Test"}</h1>
            <span className={`large-status ${statusClass}`}>● {status}</span>
          </div>
          <p>{test.description || "Coding assessment"}</p>
        </div>

        <button
          className="primary-small-btn"
          onClick={() => setTab("settings")}
        >
          <Settings size={16} /> Test Settings
        </button>
      </div>

      {/* STATS */}
      <div className="test-stat-grid">
        <TestStat icon={<Clock size={19} />} title="Start Time" value={date(start)} color="blue" />
        <TestStat icon={<Clock size={19} />} title="End Time" value={date(end)} color="pink" />
        <TestStat icon={<Code2 size={19} />} title="Problems" value={problems.length} color="orange" />
        <TestStat icon={<Send size={19} />} title="Submissions" value={submissionCount} color="purple" />
      </div>

      {/* TABS */}
      <div className="test-tabs">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={<FileText size={16} />}>Overview</TabButton>
        <TabButton active={tab === "problems"} onClick={() => setTab("problems")} icon={<Code2 size={16} />}>Problems</TabButton>
        <TabButton active={tab === "submissions"} onClick={() => setTab("submissions")} icon={<Send size={16} />}>Submissions & Marks</TabButton>
        <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} icon={<BarChart3 size={16} />}>Analytics</TabButton>
        <TabButton active={tab === "plagiarism"} onClick={() => setTab("plagiarism")} icon={<ShieldAlert size={16} />}>Plagiarism</TabButton>
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings size={16} />}>Settings</TabButton>
      </div>

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
        <div className="test-overview-card">
          <h2>Assessment Overview</h2>
          <p>This test contains {problems.length} coding problem(s).</p>

          <div className="overview-info-grid">
            <InfoItem label="Status" value={status} />
            <InfoItem label="Problems" value={problems.length} />
            <InfoItem label="Start Time" value={date(start)} />
            <InfoItem label="End Time" value={date(end)} />
            <InfoItem label="Password" value={passwordProtected ? "Protected" : "Not protected"} />
            <InfoItem label="Submissions" value={submissionCount} />
          </div>

          <div className="teacher-quick-actions">
            <button className="primary-small-btn" onClick={() => setTab("problems")}>
              <Code2 size={16} /> Manage Problems
            </button>
            <button className="outline-btn" onClick={() => setTab("submissions")}>
              <Users size={16} /> Review Marks
            </button>
            <button className="outline-btn" onClick={() => setTab("plagiarism")}>
              <ShieldAlert size={16} /> Check Plagiarism
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          PROBLEMS
          ====================================================== */}

      {tab === "problems" && (
        <div>
          <button className="outline-btn" onClick={loadProblems}>
            <RefreshCw size={16} /> Refresh Problems
          </button>

          <ProblemManager
            test={test}
            problems={problems}
            reloadProblems={loadProblems}
          />
        </div>
      )}

      {/* ======================================================
          SUBMISSIONS & MARKS
          ====================================================== */}

      {tab === "submissions" && (
        <section className="teacher-report-panel">
          <div className="teacher-report-header">
            <div>
              <h2>Student Submissions & Marks</h2>
              <p>
                Review automatic test-case scores, adjust marks and publish
                approved results.
              </p>
            </div>

            <button
              className="outline-btn"
              onClick={loadReport}
              disabled={loading}
            >
              <RefreshCw size={16} /> {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p>Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <div className="placeholder-panel">
              <Send size={28} />
              <h3>No submissions found</h3>
              <p>Submissions will appear here when students submit code.</p>
            </div>
          ) : (
            <div className="teacher-review-list">
              {submissions.map((s) => {
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

                const published =
                  Boolean(s.published_at) ||
                  String(s.teacher_review_status || "").toLowerCase() ===
                    "published";

                const busy = savingReview === s.submission_id;

                return (
                  <article className="test-overview-card" key={s.submission_id}>

                    <div className="teacher-report-header">
                      <div>
                        <h3>
                          {s.username || s.student_name || `Student ${s.user_id}`}
                        </h3>
                        <p>
                          {s.problem_title || s.problem || `Problem ${s.problem_id}`}
                          {" · "}
                          {s.language || "—"}
                        </p>
                      </div>

                      <span
                        className={`password-status ${
                          published ? "enabled" : "disabled"
                        }`}
                      >
                        {published
                          ? "Published"
                          : s.teacher_review_status || "Awaiting review"}
                      </span>
                    </div>

                    <div className="overview-info-grid">
                      <InfoItem label="Verdict" value={s.verdict || s.status || "Pending"} />
                      <InfoItem label="Test Cases Passed" value={`${passed} / ${total}`} />
                      <InfoItem label="Automatic Score" value={`${automaticMarks.toFixed(2)} / ${max}`} />
                      <InfoItem label="Submitted At" value={date(s.submitted_at)} />
                    </div>

                    <div className="password-setting-body">

                      <label>Teacher-awarded marks (maximum {max})</label>

                      <input
                        type="number"
                        min="0"
                        max={max}
                        step="0.5"
                        value={review.awarded_marks ?? ""}
                        onChange={(e) =>
                          updateReview(s.submission_id, "awarded_marks", e.target.value)
                        }
                        placeholder={`Suggested: ${automaticMarks.toFixed(2)}`}
                      />

                      <label>Feedback for student</label>

                      <textarea
                        value={review.teacher_feedback || ""}
                        onChange={(e) =>
                          updateReview(s.submission_id, "teacher_feedback", e.target.value)
                        }
                        placeholder="Optional feedback"
                        rows={3}
                      />

                      <div className="password-setting-actions">

                        <button
                          className="outline-btn"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            updateReview(
                              s.submission_id,
                              "awarded_marks",
                              String(automaticMarks)
                            )
                          }
                        >
                          Use automatic marks
                        </button>

                        <button
                          className="outline-btn"
                          type="button"
                          disabled={busy}
                          onClick={() => saveReview(s, false)}
                        >
                          Save Review
                        </button>

                        <button
                          className="save-password-btn"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Approve and publish this result to the student?"
                              )
                            ) {
                              saveReview(s, true);
                            }
                          }}
                        >
                          <CheckCircle size={16} />
                          {busy ? "Saving..." : "Approve & Publish"}
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
        <section className="teacher-report-panel">
          <div className="teacher-report-header">
            <div>
              <h2>Assessment Analytics</h2>
              <p>Performance summary for this assessment.</p>
            </div>

            <button
              className="outline-btn"
              onClick={loadReport}
              disabled={loading}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loading ? (
            <p>Loading analytics...</p>
          ) : (
            <>
              <div className="teacher-analytics-grid">
                <AnalyticsCard icon={<Users size={21} />} label="Students" value={analytics?.total_students ?? 0} />
                <AnalyticsCard icon={<Send size={21} />} label="Submissions" value={analytics?.total_submissions ?? submissions.length} />
                <AnalyticsCard icon={<Trophy size={21} />} label="Accepted" value={analytics?.accepted_submissions ?? 0} />
                <AnalyticsCard icon={<Code2 size={21} />} label="Problems" value={analytics?.total_problems ?? problems.length} />
              </div>

              <div className="test-overview-card">
                <h3>Problem Summary</h3>

                <div className="teacher-table-wrapper">
                  <table className="teacher-data-table">
                    <thead>
                      <tr>
                        <th>Problem</th>
                        <th>Submissions</th>
                        <th>Accepted</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(analytics?.problem_summary || []).map((p, i) => (
                        <tr key={p.problem_id ?? i}>
                          <td>{p.problem_title || p.title || `Problem ${p.problem_id}`}</td>
                          <td>{p.submissions ?? p.submission_count ?? 0}</td>
                          <td>{p.accepted ?? p.accepted_count ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
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
        <div className="teacher-settings-container">
          <div className="settings-card">

            <div className="settings-card-header">
              <div className="settings-heading">
                <div className="settings-icon-box">
                  <Lock size={20} />
                </div>
                <div>
                  <h2>Test Password</h2>
                  <p>Protect this assessment with a password.</p>
                </div>
              </div>

              <span
                className={`password-status ${
                  passwordProtected ? "enabled" : "disabled"
                }`}
              >
                {passwordProtected ? "Protected" : "Not protected"}
              </span>
            </div>

            <div className="settings-divider" />

            <div className="password-setting-body">
              <label>Assessment Password</label>

              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    passwordProtected ? "Enter new password" : "Enter password"
                  }
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="password-setting-actions">
                <button
                  className="save-password-btn"
                  disabled={savingPassword || password.trim().length < 4}
                  onClick={() => savePassword(password.trim())}
                >
                  <Unlock size={16} />{" "}
                  {savingPassword ? "Saving..." : "Save Password"}
                </button>

                {passwordProtected && (
                  <button
                    className="outline-btn"
                    disabled={savingPassword}
                    onClick={() => {
                      if (window.confirm("Remove test password?")) {
                        savePassword("");
                      }
                    }}
                  >
                    Remove Password
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   REUSABLE COMPONENTS
   ============================================================ */

function TestStat({ icon, title, value, color }) {
  return (
    <div className={`test-stat-card ${color || ""}`}>
      <div className="test-stat-icon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      className={`test-tab ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon} {children}
    </button>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="overview-info-item">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function AnalyticsCard({ icon, label, value }) {
  return (
    <div className="analytics-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default TeacherTestPage;