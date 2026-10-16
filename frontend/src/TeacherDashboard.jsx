import { useEffect, useState } from "react";

import DashboardLayout from "./DashboardLayout.jsx";
import TeacherTestPage from "./TeacherTestPage.jsx";

import "./Dashboard.css";


const API_BASE = "http://localhost:5000";


function TeacherDashboard({ onLogout }) {

    const [data, setData] = useState(null);

    const [tab, setTab] = useState("home");

    const [selectedTest, setSelectedTest] = useState(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const [loading, setLoading] = useState(true);


    const getToken = () =>
        localStorage.getItem("codeshield_token");


    const loadDashboard = async () => {

        try {

            const response = await fetch(
                `${API_BASE}/api/teacher/dashboard`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`
                    }
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ||
                    "Failed to load dashboard"
                );
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


    const createTest = async (event) => {

        event.preventDefault();

        setMessage("");
        setError("");

        try {

            const response = await fetch(
                `${API_BASE}/api/teacher/tests`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${getToken()}`
                    },

                    body: JSON.stringify({
                        title,
                        description,
                        start_time: startTime,
                        end_time: endTime
                    })
                }
            );

            const result =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    result.error ||
                    "Could not create test"
                );

            }

            setMessage(
                "Test created successfully!"
            );

            setTitle("");
            setDescription("");
            setStartTime("");
            setEndTime("");

            await loadDashboard();

        } catch (err) {

            setError(err.message);

        }
    };


    if (loading) {

        return (
            <div className="dashboard-loading">
                Loading CodeShield...
            </div>
        );

    }


    if (error && !data) {

        return (
            <div className="dashboard-error">

                <h2>
                    Unable to load dashboard
                </h2>

                <p>
                    {error}
                </p>

                <button
                    className="secondary-btn"
                    onClick={onLogout}
                    style={{
                        maxWidth: "180px"
                    }}
                >
                    Back to Login
                </button>

            </div>
        );

    }


    const username =
        data?.user?.username ||
        "Teacher";

    const tests =
        data?.tests ||
        [];


    /* ==========================================================
       TEST MANAGEMENT PAGE
       ========================================================== */

    if (
        tab === "manage" &&
        selectedTest
    ) {

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


    return (

        <DashboardLayout
            role="teacher"
            username={username}
            active={tab}
            onNavigate={setTab}
            onLogout={onLogout}
        >

            <div className="page">


                {/* ==================================================
                    HOME
                ================================================== */}

                {tab === "home" && (

                    <>

                        <section className="hero-card">

                            <h2>
                                Welcome back, {username} 👋
                            </h2>

                            <p>
                                Manage your coding assessments,
                                create problems and monitor
                                student submissions.
                            </p>

                        </section>


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
                                        My Tests
                                    </p>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-ico">
                                    📝
                                </div>

                                <div>

                                    <h3>
                                        {data?.total_submissions || 0}
                                    </h3>

                                    <p>
                                        Submissions
                                    </p>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-ico">
                                    💻
                                </div>

                                <div>

                                    <h3>
                                        {tests.reduce(
                                            (
                                                total,
                                                test
                                            ) =>
                                                total +
                                                Number(
                                                    test.problem_count ||
                                                    0
                                                ),
                                            0
                                        )}
                                    </h3>

                                    <p>
                                        Problems
                                    </p>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-ico">
                                    🛡️
                                </div>

                                <div>

                                    <h3>
                                        100%
                                    </h3>

                                    <p>
                                        Secure Execution
                                    </p>

                                </div>

                            </div>

                        </section>


                        <section>

                            <div className="sec-head">

                                <h2>
                                    Recent Tests
                                </h2>

                                <button
                                    onClick={() =>
                                        setTab("tests")
                                    }
                                >
                                    View all
                                </button>

                            </div>


                            <div className="test-grid">

                                {tests.length === 0 ? (

                                    <div className="empty-card">

                                        No tests created yet.

                                    </div>

                                ) : (

                                    tests
                                        .slice(0, 3)
                                        .map(test => (

                                            <TestCard
                                                key={
                                                    test.contest_id
                                                }
                                                test={test}
                                                onManage={() => {

                                                    setSelectedTest(
                                                        test
                                                    );

                                                    setTab(
                                                        "manage"
                                                    );

                                                }}
                                            />

                                        ))

                                )}

                            </div>

                        </section>

                    </>

                )}


                {/* ==================================================
                    CREATE TEST
                ================================================== */}

                {tab === "create" && (

                    <section className="create-test-card">

                        <h2>
                            Create New Test
                        </h2>

                        <form
                            onSubmit={createTest}
                        >

                            <label>
                                Test Title
                            </label>

                            <input
                                type="text"
                                placeholder="Example: DSA Mid Semester Test"
                                value={title}
                                onChange={e =>
                                    setTitle(
                                        e.target.value
                                    )
                                }
                                required
                            />


                            <label>
                                Description
                            </label>

                            <textarea
                                placeholder="Describe this assessment..."
                                value={description}
                                onChange={e =>
                                    setDescription(
                                        e.target.value
                                    )
                                }
                            />


                            <div className="time-row">

                                <div>

                                    <label>
                                        Start Time
                                    </label>

                                    <input
                                        type="datetime-local"
                                        value={startTime}
                                        onChange={e =>
                                            setStartTime(
                                                e.target.value
                                            )
                                        }
                                        required
                                    />

                                </div>


                                <div>

                                    <label>
                                        End Time
                                    </label>

                                    <input
                                        type="datetime-local"
                                        value={endTime}
                                        onChange={e =>
                                            setEndTime(
                                                e.target.value
                                            )
                                        }
                                        required
                                    />

                                </div>

                            </div>


                            <button
                                className="primary-btn"
                                type="submit"
                            >
                                Create Test
                            </button>

                        </form>


                        {message && (

                            <div className="success-message">
                                {message}
                            </div>

                        )}


                        {error && (

                            <div className="error-message">
                                {error}
                            </div>

                        )}

                    </section>

                )}


                {/* ==================================================
                    MY TESTS
                ================================================== */}

                {tab === "tests" && (

                    <section>

                        <div className="sec-head">

                            <div>

                                <h2>
                                    My Tests
                                </h2>

                                <p
                                    style={{
                                        color:
                                            "var(--text-muted)",
                                        fontSize:
                                            "12px"
                                    }}
                                >
                                    Manage your coding
                                    assessments
                                </p>

                            </div>

                        </div>


                        <div className="test-grid">

                            {tests.length === 0 ? (

                                <div className="empty-card">

                                    No tests created yet.

                                </div>

                            ) : (

                                tests.map(test => (

                                    <TestCard
                                        key={
                                            test.contest_id
                                        }
                                        test={test}
                                        onManage={() => {

                                            setSelectedTest(
                                                test
                                            );

                                            setTab(
                                                "manage"
                                            );

                                        }}
                                    />

                                ))

                            )}

                        </div>

                    </section>

                )}

            </div>

        </DashboardLayout>

    );
}


/* ==============================================================
   TEST CARD
   ============================================================== */

function TestCard({
    test,
    onManage
}) {

    const now =
        new Date();

    const start =
        new Date(
            test.start_time
        );

    const end =
        new Date(
            test.end_time
        );


    let status =
        "Upcoming";

    let statusClass =
        "warning";


    if (
        now >= start &&
        now <= end
    ) {

        status =
            "Active";

        statusClass =
            "success";

    } else if (
        now > end
    ) {

        status =
            "Ended";

        statusClass =
            "neutral";

    }


    return (

        <div className="test-card">

            <div className="test-top">

                <div className="test-icon">
                    🧪
                </div>

                <span
                    className={`badge ${statusClass}`}
                >
                    ● {status}
                </span>

            </div>


            <h3>
                {test.title}
            </h3>


            <p>
                {test.description ||
                    "Coding assessment"}
            </p>


            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "1fr 1fr",
                    gap: "8px",
                    margin:
                        "15px 0"
                }}
            >

                <div
                    style={{
                        color:
                            "var(--text-muted)",
                        fontSize:
                            "11px"
                    }}
                >
                    Problems

                    <strong
                        style={{
                            display:
                                "block",
                            color:
                                "var(--text)",
                            fontSize:
                                "16px",
                            marginTop:
                                "3px"
                        }}
                    >
                        {test.problem_count || 0}
                    </strong>

                </div>


                <div
                    style={{
                        color:
                            "var(--text-muted)",
                        fontSize:
                            "11px"
                    }}
                >
                    Submissions

                    <strong
                        style={{
                            display:
                                "block",
                            color:
                                "var(--text)",
                            fontSize:
                                "16px",
                            marginTop:
                                "3px"
                        }}
                    >
                        {test.submission_count || 0}
                    </strong>

                </div>

            </div>


            <button
                className="secondary-btn"
                onClick={onManage}
            >
                Manage Test →
            </button>

        </div>

    );
}


export default TeacherDashboard;