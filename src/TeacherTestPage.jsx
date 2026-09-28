import {
    ArrowLeft,
    Eye,
    Settings,
    Code2,
    BarChart3,
    FileText,
    Clock,
    Send,
    Lock,
    Unlock,
    EyeOff,
    CheckCircle,
    AlertCircle
} from "lucide-react";

import { useEffect, useState } from "react";
import ProblemManager from "./ProblemManager.jsx";
import "./TeacherTest.css";

const API_BASE = "http://localhost:5000";

function TeacherTestPage({ test, onBack }) {
    const [tab, setTab] = useState("problems");
    const [problems, setProblems] = useState([]);

    // Password states
    const [testPassword, setTestPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordProtected, setPasswordProtected] = useState(false);

    const token = localStorage.getItem("codeshield_token");

    // =========================================================
    // LOAD PROBLEMS
    // =========================================================

    const loadProblems = async () => {
        if (!test?.contest_id) return;

        try {
            const response = await fetch(
                `${API_BASE}/api/tests/${test.contest_id}/problems`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const result = await response.json();

            if (!response.ok) {
                console.error(
                    result.error || "Failed to load problems"
                );
                return;
            }

            setProblems(result.problems || []);
        } catch (error) {
            console.error("Problem loading error:", error);
        }
    };

    // =========================================================
    // LOAD TEST DETAILS
    // =========================================================

    const loadTestDetails = async () => {
        if (!test?.contest_id) return;

        try {
            const response = await fetch(
                `${API_BASE}/api/teacher/tests/${test.contest_id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                return;
            }

            const result = await response.json();

            if (result.password_protected !== undefined) {
                setPasswordProtected(
                    Boolean(result.password_protected)
                );
            }
        } catch (error) {
            /*
             * If this endpoint is not available,
             * we simply keep the current UI state.
             */
            console.log(
                "Test details endpoint not available."
            );
        }
    };

    // =========================================================
    // LOAD PAGE DATA
    // =========================================================

    useEffect(() => {
        loadProblems();
        loadTestDetails();
    }, [test?.contest_id]);

    // =========================================================
    // SAVE / SET / CHANGE PASSWORD
    // =========================================================

    const handleSavePassword = async () => {
        setPasswordMessage("");
        setPasswordError("");

        const password = testPassword.trim();

        if (!password) {
            setPasswordError(
                "Please enter a password."
            );
            return;
        }

        if (password.length < 4) {
            setPasswordError(
                "Password must contain at least 4 characters."
            );
            return;
        }

        if (!token) {
            setPasswordError(
                "Authentication token not found. Please login again."
            );
            return;
        }

        setSavingPassword(true);

        try {
            const response = await fetch(
                `${API_BASE}/api/teacher/tests/${test.contest_id}/password`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        password: password
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                setPasswordError(
                    result.error ||
                    "Failed to save password."
                );
                return;
            }

            setPasswordProtected(true);
            setTestPassword("");
            setShowPassword(false);

            setPasswordMessage(
                "Test password saved successfully."
            );
        } catch (error) {
            console.error(
                "Password save error:",
                error
            );

            setPasswordError(
                "Unable to connect to backend."
            );
        } finally {
            setSavingPassword(false);
        }
    };

    // =========================================================
    // REMOVE PASSWORD
    // =========================================================

    const handleRemovePassword = async () => {
        setPasswordMessage("");
        setPasswordError("");

        if (!window.confirm(
            "Are you sure you want to remove the test password?"
        )) {
            return;
        }

        if (!token) {
            setPasswordError(
                "Authentication token not found. Please login again."
            );
            return;
        }

        setSavingPassword(true);

        try {
            const response = await fetch(
                `${API_BASE}/api/teacher/tests/${test.contest_id}/password`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        password: ""
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                setPasswordError(
                    result.error ||
                    "Failed to remove password."
                );
                return;
            }

            setPasswordProtected(false);
            setTestPassword("");
            setShowPassword(false);

            setPasswordMessage(
                "Test password removed successfully."
            );
        } catch (error) {
            console.error(
                "Password removal error:",
                error
            );

            setPasswordError(
                "Unable to connect to backend."
            );
        } finally {
            setSavingPassword(false);
        }
    };

    // =========================================================
    // TEST STATUS
    // =========================================================

    const start = new Date(test?.start_time);
    const end = new Date(test?.end_time);
    const now = new Date();

    let status = "Upcoming";
    let statusClass = "warning";

    if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime())
    ) {
        if (now >= start && now <= end) {
            status = "Active";
            statusClass = "success";
        } else if (now > end) {
            status = "Ended";
            statusClass = "neutral";
        }
    }

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="teacher-test-page">

            {/* =================================================
                BREADCRUMB
            ================================================= */}

            <div className="test-breadcrumb">

                <button
                    onClick={onBack}
                    className="back-link"
                    type="button"
                >
                    <ArrowLeft size={16} />
                    Tests
                </button>

                <span>/</span>

                <span>
                    {test?.title || "Test"}
                </span>

                <span>/</span>

                <strong>
                    Manage
                </strong>

            </div>

            {/* =================================================
                TITLE AREA
            ================================================= */}

            <div className="test-title-row">

                <div>

                    <div className="test-title-line">

                        <h1>
                            {test?.title || "Untitled Test"}
                        </h1>

                        <span
                            className={`large-status ${statusClass}`}
                        >
                            ● {status}
                        </span>

                    </div>

                    <p>
                        {test?.description ||
                            "Coding assessment"}
                    </p>

                </div>

                <div className="test-actions">

                    <button
                        className="outline-btn"
                        type="button"
                        onClick={() => {
                            alert(
                                "Student preview will be available soon."
                            );
                        }}
                    >
                        <Eye size={16} />
                        View as Student
                    </button>

                    <button
                        className="primary-small-btn"
                        type="button"
                        onClick={() => setTab("settings")}
                    >
                        <Settings size={16} />
                        Test Settings
                    </button>

                </div>

            </div>

            {/* =================================================
                STAT CARDS
            ================================================= */}

            <div className="test-stat-grid">

                <TestStat
                    icon={<Clock size={19} />}
                    title="Start Time"
                    value={formatDate(start)}
                    color="blue"
                />

                <TestStat
                    icon={<Clock size={19} />}
                    title="End Time"
                    value={formatDate(end)}
                    color="pink"
                />

                <TestStat
                    icon={<Code2 size={19} />}
                    title="Problems"
                    value={problems.length}
                    color="orange"
                />

                <TestStat
                    icon={<Send size={19} />}
                    title="Submissions"
                    value={test?.submission_count || 0}
                    color="purple"
                />

            </div>

            {/* =================================================
                TABS
            ================================================= */}

            <div className="test-tabs">

                <button
                    className={
                        tab === "overview"
                            ? "active"
                            : ""
                    }
                    onClick={() => setTab("overview")}
                    type="button"
                >
                    <FileText size={16} />
                    Overview
                </button>

                <button
                    className={
                        tab === "problems"
                            ? "active"
                            : ""
                    }
                    onClick={() => setTab("problems")}
                    type="button"
                >
                    <Code2 size={16} />
                    Problems
                </button>

                <button
                    className={
                        tab === "submissions"
                            ? "active"
                            : ""
                    }
                    onClick={() => setTab("submissions")}
                    type="button"
                >
                    <Send size={16} />
                    Submissions
                </button>

                <button
                    className={
                        tab === "analytics"
                            ? "active"
                            : ""
                    }
                    onClick={() => setTab("analytics")}
                    type="button"
                >
                    <BarChart3 size={16} />
                    Analytics
                </button>

                <button
                    className={
                        tab === "settings"
                            ? "active"
                            : ""
                    }
                    onClick={() => setTab("settings")}
                    type="button"
                >
                    <Settings size={16} />
                    Settings
                </button>

            </div>

            {/* =================================================
                OVERVIEW
            ================================================= */}

            {tab === "overview" && (

                <div className="test-overview-card">

                    <h2>
                        Assessment Overview
                    </h2>

                    <p>
                        This assessment contains{" "}
                        <strong>
                            {problems.length}
                        </strong>{" "}
                        coding problem
                        {problems.length !== 1
                            ? "s"
                            : ""}.
                    </p>

                    <div className="overview-info-grid">

                        <div className="overview-info">
                            <span>Status</span>
                            <strong>{status}</strong>
                        </div>

                        <div className="overview-info">
                            <span>Problems</span>
                            <strong>
                                {problems.length}
                            </strong>
                        </div>

                        <div className="overview-info">
                            <span>Start</span>
                            <strong>
                                {formatDate(start)}
                            </strong>
                        </div>

                        <div className="overview-info">
                            <span>End</span>
                            <strong>
                                {formatDate(end)}
                            </strong>
                        </div>

                    </div>

                </div>

            )}

            {/* =================================================
                PROBLEMS
            ================================================= */}

            {tab === "problems" && (

                <ProblemManager
                    test={test}
                    problems={problems}
                    reloadProblems={loadProblems}
                />

            )}

            {/* =================================================
                SUBMISSIONS
            ================================================= */}

            {tab === "submissions" && (

                <div className="placeholder-panel">

                    <div className="placeholder-icon">
                        <Send size={30} />
                    </div>

                    <h2>
                        Submissions
                    </h2>

                    <p>
                        Student submission
                        management will appear here.
                    </p>

                </div>

            )}

            {/* =================================================
                ANALYTICS
            ================================================= */}

            {tab === "analytics" && (

                <div className="placeholder-panel">

                    <div className="placeholder-icon">
                        <BarChart3 size={30} />
                    </div>

                    <h2>
                        Analytics
                    </h2>

                    <p>
                        Assessment analytics
                        will appear here.
                    </p>

                </div>

            )}

            {/* =================================================
                SETTINGS
            ================================================= */}

            {tab === "settings" && (

                <div className="teacher-settings-container">

                    {/* =================================================
                        PASSWORD CARD
                    ================================================= */}

                    <div className="settings-card">

                        <div className="settings-card-header">

                            <div className="settings-heading">

                                <div className="settings-icon-box">
                                    <Lock size={20} />
                                </div>

                                <div>

                                    <h2>
                                        Test Password
                                    </h2>

                                    <p>
                                        Protect this assessment
                                        with a password.
                                    </p>

                                </div>

                            </div>

                            <div>

                                {passwordProtected ? (

                                    <span className="password-status enabled">

                                        <CheckCircle size={14} />

                                        Protected

                                    </span>

                                ) : (

                                    <span className="password-status disabled">

                                        <AlertCircle size={14} />

                                        Not Protected

                                    </span>

                                )}

                            </div>

                        </div>

                        <div className="settings-divider" />

                        <div className="password-setting-body">

                            <label>
                                Assessment Password
                            </label>

                            <p className="settings-help">
                                Students will need this password
                                before entering the test.
                            </p>

                            <div className="password-input-wrapper">

                                <input
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={testPassword}
                                    onChange={(e) => {
                                        setTestPassword(
                                            e.target.value
                                        );

                                        setPasswordError("");
                                        setPasswordMessage("");
                                    }}
                                    placeholder={
                                        passwordProtected
                                            ? "Enter new password"
                                            : "Enter test password"
                                    }
                                    disabled={savingPassword}
                                    autoComplete="new-password"
                                />

                                <button
                                    type="button"
                                    className="password-eye-btn"
                                    onClick={() =>
                                        setShowPassword(
                                            !showPassword
                                        )
                                    }
                                    disabled={savingPassword}
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} />
                                    ) : (
                                        <Eye size={18} />
                                    )}
                                </button>

                            </div>

                            {passwordError && (

                                <div className="settings-message error">

                                    <AlertCircle size={16} />

                                    {passwordError}

                                </div>

                            )}

                            {passwordMessage && (

                                <div className="settings-message success">

                                    <CheckCircle size={16} />

                                    {passwordMessage}

                                </div>

                            )}

                            <div className="password-setting-actions">

                                <button
                                    type="button"
                                    className="save-password-btn"
                                    onClick={
                                        handleSavePassword
                                    }
                                    disabled={
                                        savingPassword ||
                                        !testPassword.trim()
                                    }
                                >

                                    <Unlock size={16} />

                                    {savingPassword
                                        ? "Saving..."
                                        : passwordProtected
                                            ? "Change Password"
                                            : "Set Password"}

                                </button>

                                {passwordProtected && (

                                    <button
                                        type="button"
                                        className="remove-password-btn"
                                        onClick={
                                            handleRemovePassword
                                        }
                                        disabled={
                                            savingPassword
                                        }
                                    >
                                        Remove Password
                                    </button>

                                )}

                            </div>

                        </div>

                    </div>

                    {/* =================================================
                        TEST INFORMATION
                    ================================================= */}

                    <div className="settings-card">

                        <div className="settings-card-header">

                            <div className="settings-heading">

                                <div className="settings-icon-box">
                                    <Settings size={20} />
                                </div>

                                <div>

                                    <h2>
                                        Test Information
                                    </h2>

                                    <p>
                                        Current assessment
                                        configuration.
                                    </p>

                                </div>

                            </div>

                        </div>

                        <div className="settings-divider" />

                        <div className="settings-info-grid">

                            <div>
                                <span>
                                    Test Name
                                </span>

                                <strong>
                                    {test?.title || "—"}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Status
                                </span>

                                <strong>
                                    {status}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Start Time
                                </span>

                                <strong>
                                    {formatDate(start)}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    End Time
                                </span>

                                <strong>
                                    {formatDate(end)}
                                </strong>
                            </div>

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
}

// =============================================================
// STAT CARD
// =============================================================

function TestStat({
    icon,
    title,
    value,
    color
}) {
    return (
        <div
            className={`test-stat-card ${color}`}
        >
            <div className="stat-icon">
                {icon}
            </div>

            <div className="stat-content">

                <span>
                    {title}
                </span>

                <strong>
                    {value}
                </strong>

            </div>
        </div>
    );
}

// =============================================================
// DATE FORMAT
// =============================================================

function formatDate(date) {
    if (
        !date ||
        Number.isNaN(date.getTime())
    ) {
        return "—";
    }

    return date.toLocaleString(
        [],
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

export default TeacherTestPage;