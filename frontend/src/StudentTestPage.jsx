import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  Code2,
  FileText,
  MemoryStick,
  Play,
  Send,
  ChevronRight,
  CheckCircle2,
  Eye,
  Loader2,
} from "lucide-react";
import "./StudentTestPage.css";

const API_BASE = "http://localhost:5000";

function StudentTestPage({ test, onBack }) {
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [codes, setCodes] = useState({});
  const [visibleTestCases, setVisibleTestCases] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [loadingTestCases, setLoadingTestCases] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [timeLeft, setTimeLeft] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [attemptLoading, setAttemptLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [attemptedProblems, setAttemptedProblems] = useState({});
  const [elapsedByProblem, setElapsedByProblem] = useState({});

  const activityTimerRef = useRef(null);
  const selectedProblemRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const finalizedRef = useRef(false);

  const token = localStorage.getItem("codeshield_token");

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token || ""}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const testId = test?.contest_id;

  const getDefaultCode = useCallback((lang = language) => {
    if (lang === "cpp") {
      return `#include <iostream>
#include <vector>
#include <string>
using namespace std;

int main() {
    // Write your solution here
    return 0;
}`;
    }

    if (lang === "java") {
      return `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your solution here
    }
}`;
    }

    return `# Write your solution here
`;
  }, [language]);

  const testStatus = useMemo(() => {
    if (!test) return "Unavailable";

    const now = Date.now();
    const start = test.start_time
      ? new Date(test.start_time).getTime()
      : 0;
    const end = test.end_time
      ? new Date(test.end_time).getTime()
      : Infinity;

    if (now < start) return "Upcoming";
    if (now >= end) return "Ended";
    return "Active";
  }, [test]);

  const formatTime = useCallback((milliseconds) => {
    if (milliseconds == null || milliseconds <= 0) {
      return "00:00:00";
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }, []);

  // Start or resume the student's single attempt for this test.
  const startAttempt = useCallback(async () => {
    if (!testId || !token) {
      setAttemptLoading(false);
      if (!token) setError("Your session has expired. Please log in again.");
      return null;
    }

    try {
      setAttemptLoading(true);

      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/start`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({}),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not start the test attempt.");
      }

      setAttempt(data.attempt || data);
      return data.attempt || data;
    } catch (err) {
      console.error("Start attempt error:", err);
      setError(err.message || "Could not start the test attempt.");
      return null;
    } finally {
      setAttemptLoading(false);
    }
  }, [testId, token, authHeaders]);

  const loadProblems = useCallback(async () => {
    if (!testId || !token) {
      setLoadingProblems(false);
      if (!token) setError("Please log in again to continue.");
      return;
    }

    try {
      setLoadingProblems(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/problems`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to load problems.");
      }

      const loadedProblems = data.problems || [];
      setProblems(loadedProblems);

      setSelectedProblem((current) => {
        if (
          current &&
          loadedProblems.some(
            (problem) => problem.problem_id === current.problem_id
          )
        ) {
          return current;
        }

        return loadedProblems[0] || null;
      });
    } catch (err) {
      console.error("Problem loading error:", err);
      setError(err.message || "Failed to load problems.");
    } finally {
      setLoadingProblems(false);
    }
  }, [testId, token, authHeaders]);

  const loadVisibleTestCases = useCallback(async (problemId) => {
    if (!problemId || !token) return;

    try {
      setLoadingTestCases(true);

      const response = await fetch(
        `${API_BASE}/api/problems/${problemId}/testcases`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to load test cases.");
      }

      setVisibleTestCases(data.testcases || []);
    } catch (err) {
      console.error("Visible testcase error:", err);
      setVisibleTestCases([]);
    } finally {
      setLoadingTestCases(false);
    }
  }, [token, authHeaders]);

 
  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      setProblems([]);
      setSelectedProblem(null);
      setCodes({});
      setVisibleTestCases([]);
      setAttempt(null);
      setAttemptedProblems({});
      setElapsedByProblem({});
      setFinalized(false);
      finalizedRef.current = false;
      setFinalizing(false);
      setExecutionResult(null);
      setSubmissionId(null);

      if (!testId) {
        setLoadingProblems(false);
        setAttemptLoading(false);
        setError("Test information is missing.");
        return;
      }

      const attemptData = await startAttempt();
      if (cancelled) return;

      if (!attemptData) {
        setLoadingProblems(false);
        return;
      }

      await loadProblems();
    }

    initialise();

    return () => {
      cancelled = true;
    };
  }, [testId, startAttempt, loadProblems]);

  useEffect(() => {
    selectedProblemRef.current = selectedProblem;
  }, [selectedProblem]);

  useEffect(() => {
    if (!selectedProblem) {
      setVisibleTestCases([]);
      return;
    }

    loadVisibleTestCases(selectedProblem.problem_id);

    setCodes((previous) => {
      if (previous[selectedProblem.problem_id] !== undefined) {
        return previous;
      }

      return {
        ...previous,
        [selectedProblem.problem_id]: getDefaultCode(),
      };
    });

    setExecutionResult(null);
    setSubmissionId(null);
    lastActivityRef.current = Date.now();
  }, [selectedProblem, loadVisibleTestCases, getDefaultCode]);

  
  useEffect(() => {
    if (!testId || !selectedProblem || finalized || !attempt) return;

    const problemId = selectedProblem.problem_id;
    lastActivityRef.current = Date.now();

    const sendActivity = async () => {
      const now = Date.now();
      const elapsed = Math.max(
        0,
        Math.floor((now - lastActivityRef.current) / 1000)
      );

      lastActivityRef.current = now;

      if (elapsed > 0) {
        setElapsedByProblem((previous) => ({
          ...previous,
          [problemId]: (previous[problemId] || 0) + elapsed,
        }));
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/tests/${testId}/activity`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              problem_id: problemId,
              event_type: "heartbeat",
              elapsed_seconds: elapsed,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.warn("Activity update failed:", data.error);
        }
      } catch (err) {
        console.warn("Activity heartbeat failed:", err);
      }
    };

    activityTimerRef.current = setInterval(sendActivity, 15000);

    return () => {
      if (activityTimerRef.current) {
        clearInterval(activityTimerRef.current);
        activityTimerRef.current = null;
      }

     
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - lastActivityRef.current) / 1000)
      );

      if (elapsed > 0) {
        setElapsedByProblem((previous) => ({
          ...previous,
          [problemId]: (previous[problemId] || 0) + elapsed,
        }));
      }
    };
  }, [testId, selectedProblem, finalized, attempt, authHeaders]);

  useEffect(() => {
    if (!test?.end_time) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const remaining = new Date(test.end_time).getTime() - Date.now();
      setTimeLeft(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [test?.end_time]);

  const handleProblemSelect = (problem) => {
    if (finalized || finalizing) return;
    setSelectedProblem(problem);
  };

  const handleCodeChange = (value) => {
    if (!selectedProblem || finalized || finalizing) return;

    setCodes((previous) => ({
      ...previous,
      [selectedProblem.problem_id]: value,
    }));
  };

  const handleLanguageChange = (value) => {
    if (!selectedProblem || finalized || finalizing) return;

    setLanguage(value);
    setCodes((previous) => ({
      ...previous,
      [selectedProblem.problem_id]:
        getDefaultCode(value),
    }));
    setExecutionResult(null);
  };

  const pollResult = async (id) => {
    if (!id) {
      setExecutionLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 40;

    const checkResult = async () => {
      try {
        const response = await fetch(`${API_BASE}/result/${id}`, {
          method: "GET",
          headers: authHeaders,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Failed to get execution result.");
        }

        setExecutionResult(data);

        if (data.status === "completed") {
          setExecutionLoading(false);
          return;
        }

        attempts += 1;

        if (attempts >= maxAttempts) {
          setExecutionResult({
            status: "completed",
            verdict: "TIME LIMIT EXCEEDED",
            output: "Result polling timed out. Check the submission later.",
          });
          setExecutionLoading(false);
          return;
        }

        setTimeout(checkResult, 500);
      } catch (err) {
        console.error("Result polling error:", err);
        setExecutionResult({
          status: "completed",
          verdict: "SYSTEM ERROR",
          output: err.message,
        });
        setExecutionLoading(false);
      }
    };

    await checkResult();
  };

  const postSubmissionActivity = async (id, problemId) => {
    if (!testId || !id || !problemId) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/record-submission`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            submission_id: id,
            problem_id: problemId,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.warn("Could not record attempt submission:", data.error);
      }
    } catch (err) {
      console.warn("Record submission request failed:", err);
    }
  };

  const submitCodeToBackend = async (endpoint, actionLabel) => {
    if (!selectedProblem || executionLoading || finalized || finalizing) {
      return;
    }

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    if (testStatus !== "Active") {
      setError(
        testStatus === "Upcoming"
          ? "This test has not started yet."
          : "This test has ended."
      );
      return;
    }

    const problemId = selectedProblem.problem_id;
    const code = codes[problemId] ?? getDefaultCode();

    if (!code.trim()) {
      setError("Code cannot be empty.");
      return;
    }

    setError("");
    setExecutionLoading(true);
    setExecutionResult({
      status: "queued",
      verdict: null,
      output: `${actionLabel} sent for execution...`,
    });
    setSubmissionId(null);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          code,
          problem_id: problemId,
          language,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${actionLabel.toLowerCase()}.`);
      }

      const id = data.run_id || data.submission_id;

      if (!id) {
        throw new Error("Backend did not return a run or submission ID.");
      }

      setSubmissionId(id);
      setAttemptedProblems((previous) => ({
        ...previous,
        [problemId]: true,
      }));

      if (endpoint === "/submit") {
        await postSubmissionActivity(id, problemId);
      }

      setExecutionResult({
        status: "queued",
        verdict: null,
        output: "Your code is waiting for execution...",
      });

      await pollResult(id);
    } catch (err) {
      console.error(`${actionLabel} error:`, err);
      setExecutionResult({
        status: "completed",
        verdict: "SYSTEM ERROR",
        output: err.message,
      });
      setExecutionLoading(false);
    }
  };

  const handleRunCode = () => submitCodeToBackend("/run", "Run Code");

  const handleSubmit = () => submitCodeToBackend("/submit", "Submit");

  
  const handleFinalSubmit = async (automatic = false) => {
    if (finalizedRef.current || finalizing || !testId) return;

    const confirmed = automatic
      ? true
      : window.confirm(
          "Are you sure you want to submit the test? You cannot continue editing after final submission."
        );

    if (!confirmed) return;

    setFinalizing(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/final-submit`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            status: automatic ? "auto_submitted" : "submitted",
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not finalize the test.");
      }

      finalizedRef.current = true;
      setFinalized(true);
      // Test successfully submitted
if (activityTimerRef.current) {
  clearInterval(activityTimerRef.current);
  activityTimerRef.current = null;
}

setTimeout(() => {
  if (typeof onBack === "function") {
    onBack(true);
  }
}, 1500);
      setAttempt((previous) => ({
        ...(previous || {}),
        ...(data.attempt || {}),
        status: automatic ? "auto_submitted" : "submitted",
      }));

      if (activityTimerRef.current) {
        clearInterval(activityTimerRef.current);
        activityTimerRef.current = null;
      }

      window.alert(
        automatic
          ? "Time is over. Your test has been auto-submitted."
          : "Your test has been submitted successfully."
      );
    } catch (err) {
      console.error("Final submission error:", err);
      setError(err.message || "Could not finalize the test.");
    } finally {
      setFinalizing(false);
    }
  };

  // Auto-submit once the timer reaches zero.
  useEffect(() => {
    if (
      timeLeft === 0 &&
      !finalized &&
      !finalizing &&
      attempt
    ) {
      handleFinalSubmit(true);
    }
    // handleFinalSubmit is intentionally invoked only when the timer expires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, finalized, finalizing, attempt]);

  const attemptedCount = Object.keys(attemptedProblems).filter(
    (key) => attemptedProblems[key]
  ).length;

  if (loadingProblems || attemptLoading) {
    return (
      <div className="student-test-loading">
        <Loader2 size={28} className="spin" />
        <span>Loading test...</span>
      </div>
    );
  }

  return (
    <div className="student-test-page">
      <header className="student-test-topbar">
        <div className="student-test-brand">
          <button
            className="student-back-btn"
            onClick={onBack}
            disabled={finalizing}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="student-brand-name">CodeShield</div>
            <div className="student-brand-subtitle">
              Student Workspace
            </div>
          </div>
        </div>

        <div className="student-test-title">
          <span>{test?.title || "Coding Test"}</span>
          <span
            className={
              testStatus === "Active"
                ? "student-status active"
                : "student-status"
            }
          >
            {finalized ? "Submitted" : testStatus}
          </span>
        </div>

        <div className="student-timer">
          <Clock3 size={17} />
          <div>
            <span>Time Remaining</span>
            <strong>{formatTime(timeLeft)}</strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="student-test-error" role="alert">
          {error}
        </div>
      )}

      {finalized && (
        <div className="student-test-error">
          Your test has been submitted. Editing and new submissions are disabled.
        </div>
      )}

      <div className="student-test-body">
        <aside className="student-problem-sidebar">
          <div className="student-sidebar-header">
            <div>
              <span>ASSESSMENT</span>
              <h2>Problems</h2>
            </div>
            <div className="problem-count">{problems.length}</div>
          </div>

          <div className="student-problem-list">
            {problems.length === 0 ? (
              <div className="no-problems">
                No problems available.
              </div>
            ) : (
              problems.map((problem, index) => (
                <button
                  key={problem.problem_id}
                  className={
                    selectedProblem?.problem_id === problem.problem_id
                      ? "student-problem-item selected"
                      : "student-problem-item"
                  }
                  onClick={() => handleProblemSelect(problem)}
                  disabled={finalized || finalizing}
                >
                  <div className="problem-number">{index + 1}</div>

                  <div className="problem-item-content">
                    <strong>{problem.title}</strong>
                    <div className="problem-meta">
                      <span
                        className={`difficulty ${String(
                          problem.difficulty || "Easy"
                        ).toLowerCase()}`}
                      >
                        {problem.difficulty || "Easy"}
                      </span>
                      <span>{problem.time_limit_ms ?? 1000} ms</span>
                    </div>
                    {attemptedProblems[problem.problem_id] && (
                      <small>Attempted</small>
                    )}
                  </div>

                  <ChevronRight size={17} className="problem-arrow" />
                </button>
              ))
            )}
          </div>

          <div className="student-sidebar-footer">
            <div className="progress-label">
              <span>Attempted</span>
              <span>
                {attemptedCount} / {problems.length}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    problems.length
                      ? (attemptedCount / problems.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </aside>

        <main className="student-problem-panel">
          {!selectedProblem ? (
            <div className="empty-problem">
              <FileText size={40} />
              <h2>Select a problem</h2>
              <p>
                Choose a problem from the left panel to start solving.
              </p>
            </div>
          ) : (
            <>
              <div className="problem-header">
                <div>
                  <div className="problem-heading-row">
                    <h1>{selectedProblem.title}</h1>
                    <span
                      className={`difficulty large ${String(
                        selectedProblem.difficulty || "Easy"
                      ).toLowerCase()}`}
                    >
                      {selectedProblem.difficulty || "Easy"}
                    </span>
                  </div>
                  <p>
                    Problem #
                    {problems.findIndex(
                      (problem) =>
                        problem.problem_id === selectedProblem.problem_id
                    ) + 1}
                  </p>
                </div>
              </div>

              <section className="problem-section">
                <div className="section-heading">
                  <FileText size={17} />
                  <h2>Problem Statement</h2>
                </div>
                <div className="problem-statement">
                  {selectedProblem.statement}
                </div>
              </section>

              <section className="problem-limits">
                <div className="limit-card">
                  <Clock3 size={18} />
                  <div>
                    <span>Time Limit</span>
                    <strong>
                      {selectedProblem.time_limit_ms ?? 1000} ms
                    </strong>
                  </div>
                </div>

                <div className="limit-card">
                  <MemoryStick size={18} />
                  <div>
                    <span>Memory Limit</span>
                    <strong>
                      {selectedProblem.memory_limit_mb ?? 256} MB
                    </strong>
                  </div>
                </div>
              </section>

              <section className="problem-section">
                <div className="section-heading">
                  <Eye size={17} />
                  <h2>Examples</h2>
                  <span className="example-count">
                    {visibleTestCases.length}
                  </span>
                </div>

                {loadingTestCases ? (
                  <div className="examples-loading">
                    <Loader2 size={17} className="spin" />
                    Loading examples...
                  </div>
                ) : visibleTestCases.length === 0 ? (
                  <div className="no-examples">
                    No visible examples available for this problem.
                  </div>
                ) : (
                  <div className="examples-list">
                    {visibleTestCases.map((testCase, index) => (
                      <div
                        className="example-card"
                        key={testCase.testcase_id ?? index}
                      >
                        <div className="example-header">
                          <span>Example {index + 1}</span>
                          <CheckCircle2 size={15} />
                        </div>

                        <div className="example-grid">
                          <div>
                            <label>Input</label>
                            <pre>{testCase.input}</pre>
                          </div>
                          <div>
                            <label>Expected Output</label>
                            <pre>{testCase.expected_output}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        <section className="student-editor-panel">
          <div className="editor-header">
            <div className="editor-title">
              <Code2 size={18} />
              <span>Code Editor</span>
            </div>

            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              disabled={finalized || finalizing || executionLoading}
            >
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="python">Python</option>
            </select>
          </div>

          <div className="editor-container">
            <div className="editor-line-numbers">
              {(
                codes[selectedProblem?.problem_id] ??
                getDefaultCode()
              )
                .split("\n")
                .map((_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
            </div>

            <textarea
              className="code-editor"
              spellCheck="false"
              value={
                selectedProblem
                  ? codes[selectedProblem.problem_id] ??
                    getDefaultCode()
                  : ""
              }
              onChange={(event) => handleCodeChange(event.target.value)}
              placeholder={
                selectedProblem
                  ? "Write your solution here..."
                  : "Select a problem first..."
              }
              disabled={!selectedProblem || finalized || finalizing}
            />
          </div>

          <div className="editor-footer">
            <div className="editor-info">
              <span>
                {language === "cpp"
                  ? "C++17"
                  : language === "java"
                    ? "Java"
                    : "Python 3"}
              </span>
              <span>Auto-save: Local</span>
            </div>

            <div className="editor-actions">
              <button
                className="run-button"
                onClick={handleRunCode}
                disabled={
                  !selectedProblem ||
                  executionLoading ||
                  finalized ||
                  finalizing
                }
              >
                {executionLoading ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Play size={16} />
                )}
                {executionLoading ? "Running..." : "Run Code"}
              </button>

              <button
                className="submit-button"
                onClick={handleSubmit}
                disabled={
                  !selectedProblem ||
                  executionLoading ||
                  finalized ||
                  finalizing
                }
              >
                <Send size={16} />
                Submit
              </button>
            </div>
          </div>

          <div className="execution-result-panel">
            <div className="execution-result-header">
              <div>
                <strong>Execution Result</strong>
                {executionLoading && (
                  <span className="execution-running">
                    <Loader2 size={15} className="spin" />
                    Running...
                  </span>
                )}
              </div>

              {executionResult?.verdict && (
                <span
                  className={`execution-verdict ${
                    ["AC", "Accepted"].includes(executionResult.verdict)
                      ? "success"
                      : "failed"
                  }`}
                >
                  {executionResult.verdict}
                </span>
              )}
            </div>

            <div className="execution-result-body">
              {!executionResult ? (
                <div className="execution-empty">
                  <Code2 size={22} />
                  <span>Run your code to see the result.</span>
                </div>
              ) : (
                <>
                  <div className="execution-status">
                    <span>Status</span>
                    <strong>{executionResult.status}</strong>
                  </div>

                  {executionResult.execution_time_ms !== undefined && (
                    <div className="execution-status">
                      <span>Execution Time</span>
                      <strong>
                        {executionResult.execution_time_ms} ms
                      </strong>
                    </div>
                  )}

                  {executionResult.test_cases_total !== undefined && (
                    <div className="execution-status">
                      <span>Test Cases</span>
                      <strong>
                        {executionResult.test_cases_passed ?? 0}
                        {" / "}
                        {executionResult.test_cases_total}
                      </strong>
                    </div>
                  )}

                  <div className="execution-output">
                    <div className="output-title">Output</div>
                    <pre>
                      {executionResult.output ||
                        executionResult.stderr ||
                        "No output"}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="editor-footer">
            <div className="editor-info">
              <span>
                Questions attempted: {attemptedCount}/{problems.length}
              </span>
            </div>

            <div className="editor-actions">
              <button
                className="submit-button"
                onClick={() => handleFinalSubmit(false)}
                disabled={finalized || finalizing || !attempt}
              >
                {finalizing && <Loader2 size={16} className="spin" />}
                {finalizing ? "Submitting Test..." : "Final Submit Test"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default StudentTestPage;
