import { useEffect, useState } from "react";
import DashboardLayout from "./DashboardLayout.jsx";
import StudentTestPage from "./StudentTestPage.jsx";
import "./Dashboard.css";

const API_BASE = "http://localhost:5000";


// ============================================================
// TEST STATUS
// ============================================================

function testStatus(test) {

    const now = Date.now();

    if (now < new Date(test.start_time)) {
        return ["Upcoming", "upcoming"];
    }

    if (now > new Date(test.end_time)) {
        return ["Ended", "ended"];
    }

    return ["Live", "live"];
}


// ============================================================
// VERDICT CLASS
// ============================================================

function verdictClass(verdict) {

    if (!verdict) {
        return "neutral";
    }

    return String(verdict)
        .toLowerCase()
        .includes("accept")
        ? "good"
        : "bad";
}


// ============================================================
// TEST CARD
// ============================================================

function TestCard({ test, onStartTest }) {

    const [label, cls] = testStatus(test);

    const isLive = cls === "live";

    return (

        <div className="test-card">

            <div className="test-top">

                <div className="test-icon">
                    🧪
                </div>

                <span className={`badge ${cls}`}>
                    {label}
                </span>

            </div>

            <h3>
                {test.title}
            </h3>

            <p>
                {test.description ||
                    "Coding assessment"}
            </p>

            <div className="test-time">

                <span>

                    <strong>
                        Starts
                    </strong>

                    {new Date(
                        test.start_time
                    ).toLocaleString()}

                </span>

                <span>

                    <strong>
                        Ends
                    </strong>

                    {new Date(
                        test.end_time
                    ).toLocaleString()}

                </span>

            </div>

            <button
                className="primary-btn"
                onClick={() => onStartTest(test)}
                disabled={!isLive}
            >

                {isLive
                    ? "🔐 Start Test"
                    : label === "Upcoming"
                        ? "Test Not Started"
                        : "Test Ended"}

            </button>

        </div>
    );
}


// ============================================================
// SUBMISSIONS TABLE
// ============================================================

function SubmissionsTable({ rows }) {

    if (!rows || rows.length === 0) {

        return (

            <div className="empty-card">

                No submissions yet.

                Start a test to see your
                results here.

            </div>
        );
    }

    return (

        <table>

            <thead>

                <tr>

                    <th>
                        Problem
                    </th>

                    <th>
                        Language
                    </th>

                    <th>
                        Status
                    </th>

                    <th>
                        Verdict
                    </th>

                    <th>
                        Date
                    </th>

                </tr>

            </thead>

            <tbody>

                {rows.map((s) => (

                    <tr
                        key={s.submission_id}
                    >

                        <td>
                            {s.problem}
                        </td>

                        <td>
                            {s.language}
                        </td>

                        <td>
                            {s.status}
                        </td>

                        <td>

                            <span
                                className={
                                    `badge ${
                                        verdictClass(
                                            s.verdict
                                        )
                                    }`
                                }
                            >
                                {s.verdict || "-"}
                            </span>

                        </td>

                        <td>

                            {s.submitted_at
                                ? new Date(
                                    s.submitted_at
                                ).toLocaleString()
                                : "-"}

                        </td>

                    </tr>

                ))}

            </tbody>

        </table>
    );
}


// ============================================================
// PASSWORD MODAL
// ============================================================

function PasswordModal({
    test,
    password,
    setPassword,
    onClose,
    onUnlock,
    unlocking,
    passwordError
}) {

    return (

        <div className="password-overlay">

            <div className="password-modal">

                <div className="password-icon">
                    🔐
                </div>

                <h2>
                    Test Protected
                </h2>

                <p className="password-test-name">
                    {test.title}
                </p>

                <p className="password-description">
                    This assessment is protected by a
                    password provided by your teacher.
                </p>

                <label>
                    Test Password
                </label>

                <input
                    type="password"
                    value={password}
                    onChange={(e) =>
                        setPassword(e.target.value)
                    }
                    onKeyDown={(e) => {

                        if (
                            e.key === "Enter" &&
                            !unlocking
                        ) {
                            onUnlock();
                        }

                    }}
                    placeholder="Enter test password"
                    autoFocus
                />

                {passwordError && (

                    <div className="password-error">
                        {passwordError}
                    </div>

                )}

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
                        disabled={
                            unlocking ||
                            !password.trim()
                        }
                    >

                        {unlocking
                            ? "Unlocking..."
                            : "🔓 Unlock Test"}

                    </button>

                </div>

            </div>

        </div>
    );
}


// ============================================================
// STUDENT DASHBOARD
// ============================================================

function StudentDashboard({ onLogout }) {

    const [data, setData] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [tab, setTab] =
        useState("home");


    // ========================================================
    // SELECTED TEST
    // ========================================================

    const [selectedTest, setSelectedTest] =
        useState(null);


    // ========================================================
    // PASSWORD MODAL
    // ========================================================

    const [passwordTest, setPasswordTest] =
        useState(null);

    const [password, setPassword] =
        useState("");

    const [passwordError, setPasswordError] =
        useState("");

    const [unlocking, setUnlocking] =
        useState(false);


    // ========================================================
    // LOAD DASHBOARD
    // ========================================================

    useEffect(() => {

        const token =
            localStorage.getItem(
                "codeshield_token"
            );

        if (!token) {

            setError(
                "You are not logged in."
            );

            setLoading(false);

            return;
        }


        fetch(
            `${API_BASE}/api/student/dashboard`,
            {
                method: "GET",

                headers: {
                    Authorization:
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json"
                }
            }
        )

            .then(async (response) => {

                const result =
                    await response.json();

                if (!response.ok) {

                    throw new Error(
                        result.error ||
                        "Failed to load dashboard"
                    );
                }

                return result;
            })

            .then((result) => {

                setData(result);

                setLoading(false);
            })

            .catch((error) => {

                console.error(
                    "Dashboard error:",
                    error
                );

                setError(
                    error.message
                );

                setLoading(false);
            });

    }, []);


    // ========================================================
    // OPEN PASSWORD MODAL
    // ========================================================

    const handleStartTest = (test) => {

        const [status] =
            testStatus(test);

        if (status !== "Live") {
            return;
        }

        setPasswordTest(test);
        setPassword("");
        setPasswordError("");
    };


    // ========================================================
    // CLOSE PASSWORD MODAL
    // ========================================================

    const handleClosePassword = () => {

        if (unlocking) {
            return;
        }

        setPasswordTest(null);
        setPassword("");
        setPasswordError("");
    };


    // ========================================================
    // UNLOCK TEST
    // ========================================================

    const handleUnlockTest = async () => {

        if (!passwordTest) {
            return;
        }

        if (!password.trim()) {

            setPasswordError(
                "Please enter the test password."
            );

            return;
        }

        const token =
            localStorage.getItem(
                "codeshield_token"
            );

        if (!token) {

            setPasswordError(
                "Your login session has expired."
            );

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
                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        password: password
                    })
                }
            );

            const result =
                await response.json();

            if (!response.ok) {

                setPasswordError(
                    result.error ||
                    "Unable to unlock test."
                );

                setUnlocking(false);

                return;
            }

            // Password correct
            setSelectedTest(passwordTest);

            setPasswordTest(null);
            setPassword("");
            setPasswordError("");

        } catch (error) {

            console.error(
                "Unlock error:",
                error
            );

            setPasswordError(
                "Unable to connect to the server."
            );

        } finally {

            setUnlocking(false);
        }
    };


    // ========================================================
    // GO BACK FROM TEST
    // ========================================================

    const handleBackFromTest = () => {

        setSelectedTest(null);
    };


    // ========================================================
    // LOADING
    // ========================================================

    if (loading) {

        return (

            <div className="dashboard-loading">
                Loading dashboard...
            </div>

        );
    }


    // ========================================================
    // ERROR
    // ========================================================

    if (error) {

        return (

            <div className="dashboard-error">

                <h2>
                    Unable to load dashboard
                </h2>

                <p>
                    {error}
                </p>

                <button
                    onClick={onLogout}
                    className="logout-btn"
                >
                    Back to Login
                </button>

            </div>

        );
    }


    // ========================================================
    // NO DATA
    // ========================================================

    if (!data) {

        return (

            <div className="dashboard-error">

                No dashboard data available.

            </div>

        );
    }


    // ========================================================
    // IF TEST IS OPEN
    // ========================================================

    if (selectedTest) {

        return (

            <StudentTestPage
                test={selectedTest}
                onBack={
                    handleBackFromTest
                }
            />

        );
    }


    // ========================================================
    // DASHBOARD DATA
    // ========================================================

    const username =
        data.user?.username ||
        "Student";

    const tests =
        data.available_tests || [];

    const subs =
        data.recent_submissions || [];

    const accepted =
        subs.filter(
            (s) =>
                verdictClass(
                    s.verdict
                ) === "good"
        ).length;


    // ========================================================
    // MAIN DASHBOARD
    // ========================================================

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

                    {/* HOME */}

                    {tab === "home" && (

                        <>

                            <section className="hero-card">

                                <h2>
                                    Welcome back,
                                    {" "}
                                    {username}
                                    {" "}👋
                                </h2>

                                <p>
                                    View your coding
                                    assessments and
                                    submission history.
                                </p>

                            </section>


                            {/* STATS */}

                            <section className="stats-grid">

                                <div className="stat-card">

                                    <div className="stat-ico">
                                        🧪
                                    </div>

                                    <div>

                                        <h3>
                                            {tests.length}
                                        </h3>

                                        <p>
                                            Available tests
                                        </p>

                                    </div>

                                </div>


                                <div className="stat-card">

                                    <div className="stat-ico">
                                        📝
                                    </div>

                                    <div>

                                        <h3>
                                            {subs.length}
                                        </h3>

                                        <p>
                                            Recent submissions
                                        </p>

                                    </div>

                                </div>


                                <div className="stat-card">

                                    <div className="stat-ico">
                                        ✅
                                    </div>

                                    <div>

                                        <h3>
                                            {accepted}
                                        </h3>

                                        <p>
                                            Accepted
                                        </p>

                                    </div>

                                </div>

                            </section>


                            {/* AVAILABLE TESTS */}

                            <section>

                                <div className="sec-head">

                                    <h2>
                                        Available Tests
                                    </h2>

                                    {tests.length > 3 && (

                                        <button
                                            onClick={() =>
                                                setTab(
                                                    "tests"
                                                )
                                            }
                                        >
                                            View all
                                        </button>

                                    )}

                                </div>


                                <div className="test-grid">

                                    {tests.length === 0 ? (

                                        <div className="empty-card">

                                            No active tests
                                            available.

                                        </div>

                                    ) : (

                                        tests
                                            .slice(0, 3)
                                            .map((t) => (

                                                <TestCard
                                                    key={
                                                        t.contest_id
                                                    }
                                                    test={t}
                                                    onStartTest={
                                                        handleStartTest
                                                    }
                                                />

                                            ))

                                    )}

                                </div>

                            </section>


                            {/* RECENT SUBMISSIONS */}

                            <section>

                                <div className="sec-head">

                                    <h2>
                                        Recent Submissions
                                    </h2>

                                    {subs.length > 5 && (

                                        <button
                                            onClick={() =>
                                                setTab(
                                                    "history"
                                                )
                                            }
                                        >
                                            View all
                                        </button>

                                    )}

                                </div>


                                <div className="submission-card">

                                    <SubmissionsTable
                                        rows={
                                            subs.slice(
                                                0,
                                                5
                                            )
                                        }
                                    />

                                </div>

                            </section>

                        </>

                    )}


                    {/* TESTS */}

                    {tab === "tests" && (

                        <section>

                            <div className="sec-head">

                                <h2>
                                    Available Tests
                                </h2>

                            </div>


                            <div className="test-grid">

                                {tests.length === 0 ? (

                                    <div className="empty-card">

                                        No active tests
                                        available.

                                    </div>

                                ) : (

                                    tests.map((t) => (

                                        <TestCard
                                            key={
                                                t.contest_id
                                            }
                                            test={t}
                                            onStartTest={
                                                handleStartTest
                                            }
                                        />

                                    ))

                                )}

                            </div>

                        </section>

                    )}


                    {/* HISTORY */}

                    {tab === "history" && (

                        <section>

                            <div className="sec-head">

                                <h2>
                                    Submission History
                                </h2>

                            </div>


                            <div className="submission-card">

                                <SubmissionsTable
                                    rows={subs}
                                />

                            </div>

                        </section>

                    )}

                </div>

            </DashboardLayout>


            {/* PASSWORD MODAL */}

            {passwordTest && (

                <PasswordModal

                    test={passwordTest}

                    password={password}

                    setPassword={setPassword}

                    onClose={
                        handleClosePassword
                    }

                    onUnlock={
                        handleUnlockTest
                    }

                    unlocking={
                        unlocking
                    }

                    passwordError={
                        passwordError
                    }

                />

            )}

        </>
    );
}


export default StudentDashboard;