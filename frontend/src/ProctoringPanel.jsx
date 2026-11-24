import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Lock,
  RefreshCw,
  Unlock
} from "lucide-react";
import "./Proctoring.css";
import "./IncidentPanel.css";

const GAZE_LABELS = {
  NO_FACE: "Face not visible",
  MULTI_FACE: "Multiple faces",
  LOOK_AWAY: "Looking away",
  CAMERA_OFF: "Camera off",
  FACE_MISMATCH: "Different person"
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function ProctoringPanel({
  sessions = [],
  maxSwitches = 6,
  gazeAlertAt = 3,
  loading = false,
  error = "",
  onRefresh,
  onUnlock,
  onFreeze,
  onEnd,
  onClearAlerts,
  busyKey = null
}) {
  const frozen = sessions.filter((s) => s.frozen);
  const attention = sessions.filter((s) => s.needs_attention);

  const tabClass = (count) => {
    if (count > maxSwitches) return "pc-count high";
    if (count >= maxSwitches - 1 && count > 0) return "pc-count mid";
    return "pc-count";
  };

  const gazeClass = (count) => {
    if (count >= gazeAlertAt) return "pc-count high";
    if (count > 0) return "pc-count mid";
    return "pc-count";
  };

  const isBusy = (action, userId) => busyKey === `${action}-${userId}`;

  const statusBadge = (s) => {
    if (s.ended) {
      return <span className="pc-badge inc-rejected">Ended by teacher</span>;
    }

    if (s.attempt_status && s.attempt_status !== "in_progress") {
      return <span className="pc-badge active">Submitted</span>;
    }

    if (s.frozen) {
      return (
        <span className="pc-badge frozen">
          <Lock size={12} /> Frozen
        </span>
      );
    }

    return <span className="pc-badge active">Active</span>;
  };

  const canAct = (s) =>
    !s.ended && (!s.attempt_status || s.attempt_status === "in_progress");

  return (
    <section className="teacher-report-panel">

      <div className="teacher-report-header">
        <div>
          <h2>Proctoring</h2>
          <p>
            More than {maxSwitches} tab switches freezes the test until you
            unlock it. Camera alerts (face not visible, multiple faces, looking
            away) never stop the student: you see them here and decide whether
            to freeze or end the test.
          </p>
        </div>

        <button
          className="outline-btn"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={16} /> {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="settings-message error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {(frozen.length > 0 || attention.length > 0) && (
        <div className="pc-banner" style={{ marginBottom: 18 }}>
          <span>
            <Lock size={16} />
            {frozen.length > 0 &&
              `${frozen.length} frozen and waiting for you`}
            {frozen.length > 0 && attention.length > 0 && " · "}
            {attention.length > 0 &&
              `${attention.length} with suspicious camera activity`}
          </span>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="placeholder-panel">
          <CheckCircle size={28} />
          <h2>No suspicious activity</h2>
          <p>
            Nobody has switched tabs or triggered a camera alert yet. Students
            appear here as soon as the first alert is recorded. This page
            refreshes every 10 seconds.
          </p>
        </div>
      ) : (
        <div className="teacher-table-wrapper">
          <table className="teacher-data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Tab switches</th>
                <th>Camera alerts</th>
                <th>Status</th>
                <th>Last alert</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {sessions.map((s) => {
                const breakdown = Object.entries(s.gaze_breakdown || {});

                return (
                  <tr
                    key={s.user_id}
                    style={
                      s.needs_attention || s.frozen
                        ? { background: "rgba(239, 68, 68, 0.07)" }
                        : undefined
                    }
                  >
                    <td>{s.username}</td>

                    <td>
                      <span className={tabClass(s.tab_switch_count)}>
                        {s.tab_switch_count} / {maxSwitches}
                      </span>
                    </td>

                    <td>
                      <span className={gazeClass(s.gaze_warning_count || 0)}>
                        {s.gaze_warning_count || 0}
                      </span>

                      {breakdown.length > 0 && (
                        <div className="pc-chips">
                          {breakdown.map(([type, total]) => (
                            <span className="pc-chip" key={type}>
                              {GAZE_LABELS[type] || type} ×{total}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td>{statusBadge(s)}</td>

                    <td>{formatDate(s.last_gaze_at || s.frozen_at)}</td>

                    <td>
                      <div className="pc-reason">{s.freeze_reason || "—"}</div>
                    </td>

                    <td>
                      {canAct(s) ? (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap"
                          }}
                        >
                          {s.frozen ? (
                            <button
                              className="pc-unlock-btn"
                              type="button"
                              disabled={isBusy("unlock", s.user_id)}
                              onClick={() => onUnlock && onUnlock(s)}
                            >
                              <Unlock size={14} />
                              {isBusy("unlock", s.user_id)
                                ? "Unlocking..."
                                : "Unlock"}
                            </button>
                          ) : (
                            <button
                              className="outline-btn"
                              type="button"
                              disabled={isBusy("freeze", s.user_id)}
                              onClick={() => onFreeze && onFreeze(s)}
                            >
                              <Lock size={14} />
                              {isBusy("freeze", s.user_id)
                                ? "Freezing..."
                                : "Freeze test"}
                            </button>
                          )}

                          <button
                            className="inc-reject-btn"
                            type="button"
                            disabled={isBusy("end", s.user_id)}
                            onClick={() => onEnd && onEnd(s)}
                          >
                            <Ban size={14} />
                            {isBusy("end", s.user_id)
                              ? "Ending..."
                              : "End test"}
                          </button>

                          {(s.gaze_warning_count || 0) > 0 && (
                            <button
                              className="outline-btn"
                              type="button"
                              disabled={isBusy("clear-alerts", s.user_id)}
                              onClick={() =>
                                onClearAlerts && onClearAlerts(s)
                              }
                            >
                              Clear alerts
                            </button>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="pc-note">
        Tab-switch and camera alerts are review signals, not proof. A student
        can trigger them by accident (notification popup, glasses glare, low
        light, looking at notes on paper), so check before deciding. Unlocking
        resets the tab-switch count to 0. No video is stored; only alert types
        and timestamps are saved.
      </p>
    </section>
  );
}

export default ProctoringPanel;