import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  X
} from "lucide-react";
import "./PlagiarismPanel.css";

const API_BASE = "http://localhost:5000";

function PlagiarismPanel({ contestId }) {
  const token = localStorage.getItem("codeshield_token");

  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const [threshold, setThreshold] = useState(70);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [compare, setCompare] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

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
     LOAD SAVED REPORT
     ========================================================== */

  const loadReport = useCallback(async () => {
    if (!contestId || !token) return;

    setLoading(true);
    setError("");

    try {
      const data = await api(`/api/teacher/plagiarism/report/${contestId}`);

      setResults(data.results || []);
      setLastScanned(data.last_scanned_at || null);
      setSummary({
        pairs: data.total_pairs ?? 0,
        flagged: data.flagged_pairs ?? 0
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api, contestId, token]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  /* ==========================================================
     RUN SCAN
     ========================================================== */

  const runScan = async () => {
    const value = Number(threshold);

    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Threshold 0 se 100 ke beech hona chahiye.");
      return;
    }

    setScanning(true);
    setError("");
    setMessage("");

    try {
      const data = await api(`/api/teacher/plagiarism/scan/${contestId}`, {
        method: "POST",
        body: JSON.stringify({ threshold: value })
      });

      setResults(data.results || []);
      setSummary({
        pairs: data.pairs_checked ?? 0,
        flagged: data.flagged_pairs ?? 0,
        submissions: data.submissions_considered ?? 0
      });
      setLastScanned(new Date().toISOString());
      setMessage(
        `Scan complete: ${data.pairs_checked} pairs checked, ` +
        `${data.flagged_pairs} flagged.`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  /* ==========================================================
     COMPARE (SIDE BY SIDE)
     ========================================================== */

  const openCompare = async (pair) => {
    setCompareLoading(true);
    setCompare(null);
    setError("");

    try {
      const data = await api(
        `/api/teacher/plagiarism/compare/` +
        `${pair.submission_id_1}/${pair.submission_id_2}`
      );

      setCompare(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCompareLoading(false);
    }
  };

  /* ==========================================================
     DERIVED
     ========================================================== */

  const visibleResults = useMemo(
    () => (onlyFlagged ? results.filter((r) => r.flagged) : results),
    [results, onlyFlagged]
  );

  const levelClass = (pair) => {
    if (pair.flagged) return "pg-high";
    if (pair.similarity_score >= 40) return "pg-medium";
    return "pg-low";
  };

  const dateText = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  };

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <section className="pg-panel">

      {/* HEADER */}
      <div className="pg-header">
        <div>
          <h2>Plagiarism Detection</h2>
          {/* <p>
            Jaccard similarity se har student ke latest code ko baaki
            students ke code se compare kiya jata hai.
          </p> */}
        </div>

        <button
          className="pg-btn pg-btn-outline"
          type="button"
          onClick={loadReport}
          disabled={loading || scanning}
        >
          <RefreshCw size={16} /> {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* CONTROLS */}
      <div className="pg-controls">
        <div className="pg-field">
          <label>Flag threshold (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={scanning}
          />
        </div>

        <button
          className="pg-btn pg-btn-primary"
          type="button"
          onClick={runScan}
          disabled={scanning}
        >
          <Search size={16} /> {scanning ? "Scanning..." : "Run Scan"}
        </button>

        <label className="pg-check">
          <input
            type="checkbox"
            checked={onlyFlagged}
            onChange={(e) => setOnlyFlagged(e.target.checked)}
          />
          Show only flagged
        </label>
      </div>

      {/* MESSAGES */}
      {error && (
        <div className="pg-message pg-error">
          <AlertTriangle size={16} /> {error}
          <button type="button" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {message && (
        <div className="pg-message pg-success">
          <CheckCircle size={16} /> {message}
        </div>
      )}

      {/* SUMMARY */}
      <div className="pg-summary">
        <div className="pg-stat">
          <span>Pairs shown</span>
          <strong>{results.length}</strong>
        </div>
        <div className="pg-stat">
          <span>Flagged</span>
          <strong className={results.some((r) => r.flagged) ? "pg-text-high" : ""}>
            {results.filter((r) => r.flagged).length}
          </strong>
        </div>
        <div className="pg-stat">
          <span>Last scanned</span>
          <strong>{dateText(lastScanned)}</strong>
        </div>
        {summary?.submissions != null && (
          <div className="pg-stat">
            <span>Submissions scanned</span>
            <strong>{summary.submissions}</strong>
          </div>
        )}
      </div>

      {/* TABLE */}
      {loading ? (
        <p className="pg-note">Loading saved report...</p>
      ) : visibleResults.length === 0 ? (
        <div className="pg-empty">
          <ShieldAlert size={30} />
          <h3>
            {results.length === 0
              ? "No plagiarism results yet"
              : "No flagged pairs"}
          </h3>
          <p>
            {results.length === 0
              ? "Run Scan dabao. Sirf wahi pairs dikhte hain jinki similarity 20% ya zyada ho."
              : "Threshold se zyada similarity wala koi pair nahi mila."}
          </p>
        </div>
      ) : (
        <div className="pg-table-wrapper">
          <table className="pg-table">
            <thead>
              <tr>
                <th>Problem</th>
                <th>Student A</th>
                <th>Student B</th>
                <th>Similarity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {visibleResults.map((pair) => (
                <tr
                  key={`${pair.submission_id_1}-${pair.submission_id_2}`}
                  className={pair.flagged ? "pg-row-flagged" : ""}
                >
                  <td>{pair.problem_title}</td>
                  <td>{pair.student_1}</td>
                  <td>{pair.student_2}</td>

                  <td>
                    <div className="pg-score">
                      <div className="pg-bar">
                        <div
                          className={`pg-bar-fill ${levelClass(pair)}`}
                          style={{ width: `${Math.min(100, pair.similarity_score)}%` }}
                        />
                      </div>
                      <strong>{pair.similarity_score.toFixed(1)}%</strong>
                    </div>
                  </td>

                  <td>
                    <span className={`pg-badge ${levelClass(pair)}`}>
                      {pair.flagged ? "Flagged" : "OK"}
                    </span>
                  </td>

                  <td>
                    <button
                      className="pg-btn pg-btn-outline pg-btn-small"
                      type="button"
                      onClick={() => openCompare(pair)}
                    >
                      Compare
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      

      {/* COMPARE MODAL */}
      {(compare || compareLoading) && (
        <div className="pg-overlay" onClick={() => setCompare(null)}>
          <div className="pg-modal" onClick={(e) => e.stopPropagation()}>

            <div className="pg-modal-header">
              <div>
                <h3>
                  {compare
                    ? `${compare.submission_1.student}  vs  ${compare.submission_2.student}`
                    : "Loading..."}
                </h3>
                {compare && (
                  <p>
                    {compare.problem_title} · {compare.language} · Similarity{" "}
                    <strong>{compare.similarity_score.toFixed(1)}%</strong>
                  </p>
                )}
              </div>

              <button
                className="pg-icon-btn"
                type="button"
                onClick={() => setCompare(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {compareLoading && <p className="pg-note">Loading code...</p>}

            {compare && (
              <>
                <p className="pg-legend">
                  <span className="pg-legend-box" /> 
                </p>

                <div className="pg-compare">
                  <CodeColumn data={compare.submission_1} />
                  <CodeColumn data={compare.submission_2} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CodeColumn({ data }) {
  const matching = new Set(data.matching_lines || []);
  const lines = (data.code || "").split("\n");

  return (
    <div className="pg-code-col">
      <div className="pg-code-title">
        <strong>{data.student}</strong>
        <span>Submission #{data.submission_id}</span>
      </div>

      <div className="pg-code">
        {lines.map((line, index) => (
          <div
            key={index}
            className={`pg-line ${matching.has(index + 1) ? "pg-line-match" : ""}`}
          >
            <span className="pg-line-no">{index + 1}</span>
            <code>{line || " "}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlagiarismPanel;