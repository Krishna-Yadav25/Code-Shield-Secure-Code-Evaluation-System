import { useEffect, useMemo, useState } from "react";

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
    Loader2
} from "lucide-react";

import "./StudentTestPage.css";

const API_BASE = "http://localhost:5000";


function StudentTestPage({
    test,
    onBack
}) {

    const [problems, setProblems] =
        useState([]);

    const [selectedProblem, setSelectedProblem] =
        useState(null);

    const [codes, setCodes] =
        useState({});

    const [visibleTestCases, setVisibleTestCases] =
        useState([]);

    const [loadingProblems, setLoadingProblems] =
        useState(true);

    const [loadingTestCases, setLoadingTestCases] =
        useState(false);

    const [error, setError] =
        useState("");

    const [language, setLanguage] =
        useState("cpp");

    const [timeLeft, setTimeLeft] =
        useState(null);

    const token =
        localStorage.getItem(
            "codeshield_token"
        );


    // ============================================================
    // DEFAULT CODE
    // ============================================================

    const getDefaultCode = () => {

        if (language === "cpp") {

            return `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

int main() {

    // Write your solution here

    return 0;
}`;
        }


        if (language === "java") {

            return `import java.util.*;

public class Main {

    public static void main(String[] args) {

        // Write your solution here

    }
}`;

        }


        return `# Write your solution here

`;
    };


    // ============================================================
    // TEST STATUS
    // ============================================================

    const testStatus = useMemo(() => {

        if (!test) {
            return "Unavailable";
        }


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


        if (now < start) {
            return "Upcoming";
        }


        if (now > end) {
            return "Ended";
        }


        return "Active";

    }, [test]);


    // ============================================================
    // LOAD PROBLEMS
    // ============================================================

    const loadProblems = async () => {

        if (!test?.contest_id) {
            return;
        }


        try {

            setLoadingProblems(true);
            setError("");


            const response =
                await fetch(

                    `${API_BASE}/api/tests/${test.contest_id}/problems`,

                    {
                        method: "GET",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"
                        }
                    }

                );


            const text =
                await response.text();


            let result = {};


            try {

                result =
                    text
                        ? JSON.parse(text)
                        : {};

            } catch {

                throw new Error(
                    "Server returned an invalid response."
                );

            }


            if (!response.ok) {

                throw new Error(
                    result.error ||
                    "Failed to load problems."
                );

            }


            const loadedProblems =
                result.problems || [];


            setProblems(
                loadedProblems
            );


            if (
                loadedProblems.length > 0
            ) {

                setSelectedProblem(
                    loadedProblems[0]
                );

            }

        } catch (err) {

            console.error(
                "Problem loading error:",
                err
            );

            setError(
                err.message
            );

        } finally {

            setLoadingProblems(false);

        }

    };


    // ============================================================
    // LOAD VISIBLE TEST CASES
    // ============================================================

    const loadVisibleTestCases =
        async (problemId) => {

            if (!problemId) {
                return;
            }


            try {

                setLoadingTestCases(
                    true
                );


                const response =
                    await fetch(

                        `${API_BASE}/api/problems/${problemId}/testcases`,

                        {
                            method: "GET",

                            headers: {
                                Authorization:
                                    `Bearer ${token}`,

                                "Content-Type":
                                    "application/json"
                            }
                        }

                    );


                const text =
                    await response.text();


                let result = {};


                try {

                    result =
                        text
                            ? JSON.parse(text)
                            : {};

                } catch {

                    throw new Error(
                        "Could not read visible test cases."
                    );

                }


                if (!response.ok) {

                    throw new Error(
                        result.error ||
                        "Failed to load test cases."
                    );

                }


                setVisibleTestCases(
                    result.testcases || []
                );

            } catch (err) {

                console.error(
                    "Visible testcase error:",
                    err
                );

                setVisibleTestCases([]);

            } finally {

                setLoadingTestCases(
                    false
                );

            }

        };


    // ============================================================
    // LOAD PAGE
    // ============================================================

    useEffect(() => {

        loadProblems();

    }, [test?.contest_id]);


    // ============================================================
    // SELECTED PROBLEM CHANGED
    // ============================================================

    useEffect(() => {

        if (!selectedProblem) {
            return;
        }


        loadVisibleTestCases(
            selectedProblem.problem_id
        );


        setCodes((previous) => {

            if (
                previous[
                    selectedProblem.problem_id
                ]
            ) {

                return previous;

            }


            return {

                ...previous,

                [selectedProblem.problem_id]:
                    getDefaultCode()

            };

        });

    }, [selectedProblem]);


    // ============================================================
    // TIMER
    // ============================================================

    useEffect(() => {

        if (!test?.end_time) {
            return;
        }


        const updateTimer = () => {

            const end =
                new Date(
                    test.end_time
                ).getTime();


            const now =
                new Date().getTime();


            const difference =
                end - now;


            if (difference <= 0) {

                setTimeLeft(0);

                return;

            }


            setTimeLeft(
                difference
            );

        };


        updateTimer();


        const interval =
            setInterval(
                updateTimer,
                1000
            );


        return () => {

            clearInterval(
                interval
            );

        };

    }, [test?.end_time]);


    // ============================================================
    // FORMAT TIME
    // ============================================================

    const formatTime =
        (milliseconds) => {

            if (
                milliseconds === null ||
                milliseconds <= 0
            ) {

                return "00:00:00";

            }


            const totalSeconds =
                Math.floor(
                    milliseconds / 1000
                );


            const hours =
                Math.floor(
                    totalSeconds / 3600
                );


            const minutes =
                Math.floor(
                    (totalSeconds % 3600) / 60
                );


            const seconds =
                totalSeconds % 60;


            return [

                String(hours)
                    .padStart(2, "0"),

                String(minutes)
                    .padStart(2, "0"),

                String(seconds)
                    .padStart(2, "0")

            ].join(":");

        };


    // ============================================================
    // SELECT PROBLEM
    // ============================================================

    const handleProblemSelect =
        (problem) => {

            setSelectedProblem(
                problem
            );

        };


    // ============================================================
    // CODE CHANGE
    // ============================================================

    const handleCodeChange =
        (value) => {

            if (!selectedProblem) {
                return;
            }


            setCodes(
                (previous) => ({

                    ...previous,

                    [selectedProblem.problem_id]:
                        value

                })
            );

        };


    // ============================================================
    // LANGUAGE CHANGE
    // ============================================================

    const handleLanguageChange =
        (value) => {

            setLanguage(value);


            if (!selectedProblem) {
                return;
            }


            let newCode;


            if (value === "cpp") {

                newCode = `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

int main() {

    // Write your solution here

    return 0;
}`;

            } else if (value === "java") {

                newCode = `import java.util.*;

public class Main {

    public static void main(String[] args) {

        // Write your solution here

    }
}`;

            } else {

                newCode =
                    `# Write your solution here`;

            }


            setCodes(
                (previous) => ({

                    ...previous,

                    [selectedProblem.problem_id]:
                        newCode

                })
            );

        };


    // ============================================================
    // RUN CODE
    // ============================================================

    const handleRunCode = () => {

        alert(
            "Run Code will be connected to the Queue + Worker + Sandbox system in the next phase."
        );

    };


    // ============================================================
    // SUBMIT CODE
    // ============================================================

    const handleSubmit = () => {

        alert(
            "Submit will be connected to the submission + DB transaction system in the next phase."
        );

    };


    // ============================================================
    // LOADING
    // ============================================================

    if (loadingProblems) {

        return (

            <div className="student-test-loading">

                <Loader2
                    size={28}
                    className="spin"
                />

                <span>
                    Loading test...
                </span>

            </div>

        );

    }


    // ============================================================
    // MAIN
    // ============================================================

    return (

        <div className="student-test-page">


            {/* ==================================================
                TOP BAR
            ================================================== */}

            <header
                className="student-test-topbar"
            >

                <div className="student-test-brand">

                    <button
                        className="student-back-btn"
                        onClick={onBack}
                    >

                        <ArrowLeft
                            size={18}
                        />

                    </button>


                    <div>

                        <div className="student-brand-name">
                            CodeShield
                        </div>

                        <div className="student-brand-subtitle">
                            Student Workspace
                        </div>

                    </div>

                </div>


                <div className="student-test-title">

                    <span>
                        {test?.title ||
                            "Coding Test"}
                    </span>


                    <span
                        className={
                            testStatus ===
                            "Active"
                                ? "student-status active"
                                : "student-status"
                        }
                    >

                        {testStatus}

                    </span>

                </div>


                <div className="student-timer">

                    <Clock3
                        size={17}
                    />

                    <div>

                        <span>
                            Time Remaining
                        </span>

                        <strong>
                            {formatTime(
                                timeLeft
                            )}
                        </strong>

                    </div>

                </div>

            </header>


            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (

                <div className="student-test-error">

                    {error}

                </div>

            )}


            {/* ==================================================
                BODY
            ================================================== */}

            <div className="student-test-body">


                {/* ==================================================
                    LEFT PROBLEMS
                ================================================== */}

                <aside
                    className="student-problem-sidebar"
                >

                    <div
                        className="student-sidebar-header"
                    >

                        <div>

                            <span>
                                ASSESSMENT
                            </span>

                            <h2>
                                Problems
                            </h2>

                        </div>


                        <div
                            className="problem-count"
                        >
                            {problems.length}
                        </div>

                    </div>


                    <div
                        className="student-problem-list"
                    >

                        {problems.length === 0 ? (

                            <div className="no-problems">

                                No problems
                                available.

                            </div>

                        ) : (

                            problems.map(
                                (
                                    problem,
                                    index
                                ) => (

                                    <button
                                        key={
                                            problem.problem_id
                                        }

                                        className={
                                            selectedProblem?.problem_id ===
                                            problem.problem_id

                                                ? "student-problem-item selected"

                                                : "student-problem-item"
                                        }

                                        onClick={() =>
                                            handleProblemSelect(
                                                problem
                                            )
                                        }
                                    >

                                        <div
                                            className="problem-number"
                                        >
                                            {index + 1}
                                        </div>


                                        <div
                                            className="problem-item-content"
                                        >

                                            <strong>
                                                {problem.title}
                                            </strong>


                                            <div
                                                className="problem-meta"
                                            >

                                                <span
                                                    className={
                                                        `difficulty ${String(
                                                            problem.difficulty
                                                        ).toLowerCase()}`
                                                    }
                                                >
                                                    {
                                                        problem.difficulty
                                                    }
                                                </span>


                                                <span>
                                                    {
                                                        problem.time_limit_ms
                                                    }
                                                    {" "}ms
                                                </span>

                                            </div>

                                        </div>


                                        <ChevronRight
                                            size={17}
                                            className="problem-arrow"
                                        />

                                    </button>

                                )
                            )

                        )}

                    </div>


                    <div
                        className="student-sidebar-footer"
                    >

                        <div
                            className="progress-label"
                        >

                            <span>
                                Progress
                            </span>

                            <span>
                                0 / {problems.length}
                            </span>

                        </div>


                        <div
                            className="progress-track"
                        >

                            <div
                                className="progress-fill"
                                style={{
                                    width: "0%"
                                }}
                            />

                        </div>

                    </div>

                </aside>


                {/* ==================================================
                    PROBLEM DETAILS
                ================================================== */}

                <main
                    className="student-problem-panel"
                >

                    {!selectedProblem ? (

                        <div
                            className="empty-problem"
                        >

                            <FileText
                                size={40}
                            />

                            <h2>
                                Select a problem
                            </h2>

                            <p>
                                Choose a problem
                                from the left panel
                                to start solving.
                            </p>

                        </div>

                    ) : (

                        <>

                            {/* PROBLEM HEADER */}

                            <div
                                className="problem-header"
                            >

                                <div>

                                    <div
                                        className="problem-heading-row"
                                    >

                                        <h1>
                                            {
                                                selectedProblem.title
                                            }
                                        </h1>


                                        <span
                                            className={
                                                `difficulty large ${String(
                                                    selectedProblem.difficulty
                                                ).toLowerCase()}`
                                            }
                                        >
                                            {
                                                selectedProblem.difficulty
                                            }
                                        </span>

                                    </div>


                                    <p>
                                        Problem #
                                        {
                                            problems.findIndex(
                                                (p) =>
                                                    p.problem_id ===
                                                    selectedProblem.problem_id
                                            ) + 1
                                        }
                                    </p>

                                </div>

                            </div>


                            {/* STATEMENT */}

                            <section
                                className="problem-section"
                            >

                                <div
                                    className="section-heading"
                                >

                                    <FileText
                                        size={17}
                                    />

                                    <h2>
                                        Problem Statement
                                    </h2>

                                </div>


                                <div
                                    className="problem-statement"
                                >

                                    {
                                        selectedProblem.statement
                                    }

                                </div>

                            </section>


                            {/* LIMITS */}

                            <section
                                className="problem-limits"
                            >

                                <div
                                    className="limit-card"
                                >

                                    <Clock3
                                        size={18}
                                    />

                                    <div>

                                        <span>
                                            Time Limit
                                        </span>

                                        <strong>
                                            {
                                                selectedProblem.time_limit_ms
                                            } ms
                                        </strong>

                                    </div>

                                </div>


                                <div
                                    className="limit-card"
                                >

                                    <MemoryStick
                                        size={18}
                                    />

                                    <div>

                                        <span>
                                            Memory Limit
                                        </span>

                                        <strong>
                                            {
                                                selectedProblem.memory_limit_mb
                                            } MB
                                        </strong>

                                    </div>

                                </div>

                            </section>


                            {/* EXAMPLES */}

                            <section
                                className="problem-section"
                            >

                                <div
                                    className="section-heading"
                                >

                                    <Eye
                                        size={17}
                                    />

                                    <h2>
                                        Examples
                                    </h2>


                                    <span
                                        className="example-count"
                                    >
                                        {
                                            visibleTestCases.length
                                        }
                                    </span>

                                </div>


                                {loadingTestCases ? (

                                    <div
                                        className="examples-loading"
                                    >

                                        <Loader2
                                            size={17}
                                            className="spin"
                                        />

                                        Loading examples...

                                    </div>

                                ) : visibleTestCases.length === 0 ? (

                                    <div
                                        className="no-examples"
                                    >

                                        No visible examples
                                        available for this
                                        problem.

                                    </div>

                                ) : (

                                    <div
                                        className="examples-list"
                                    >

                                        {
                                            visibleTestCases.map(
                                                (
                                                    testCase,
                                                    index
                                                ) => (

                                                    <div
                                                        className="example-card"
                                                        key={
                                                            testCase.testcase_id
                                                        }
                                                    >

                                                        <div
                                                            className="example-header"
                                                        >

                                                            <span>
                                                                Example{" "}
                                                                {index + 1}
                                                            </span>


                                                            <CheckCircle2
                                                                size={15}
                                                            />

                                                        </div>


                                                        <div
                                                            className="example-grid"
                                                        >

                                                            <div>

                                                                <label>
                                                                    Input
                                                                </label>


                                                                <pre>
                                                                    {
                                                                        testCase.input
                                                                    }
                                                                </pre>

                                                            </div>


                                                            <div>

                                                                <label>
                                                                    Expected Output
                                                                </label>


                                                                <pre>
                                                                    {
                                                                        testCase.expected_output
                                                                    }
                                                                </pre>

                                                            </div>

                                                        </div>

                                                    </div>

                                                )
                                            )
                                        }

                                    </div>

                                )}

                            </section>

                        </>

                    )}

                </main>


                {/* ==================================================
                    CODE EDITOR
                ================================================== */}

                <section
                    className="student-editor-panel"
                >

                    <div
                        className="editor-header"
                    >

                        <div
                            className="editor-title"
                        >

                            <Code2
                                size={18}
                            />

                            <span>
                                Code Editor
                            </span>

                        </div>


                        <select
                            value={language}
                            onChange={(e) =>
                                handleLanguageChange(
                                    e.target.value
                                )
                            }
                        >

                            <option value="cpp">
                                C++
                            </option>

                            <option value="java">
                                Java
                            </option>

                            <option value="python">
                                Python
                            </option>

                        </select>

                    </div>


                    {/* CODE AREA */}

                    <div
                        className="editor-container"
                    >

                        <div
                            className="editor-line-numbers"
                        >

                            {(
                                codes[
                                    selectedProblem?.problem_id
                                ] ||
                                getDefaultCode()
                            )
                                .split("\n")
                                .map(
                                    (
                                        _,
                                        index
                                    ) => (

                                        <span
                                            key={
                                                index
                                            }
                                        >
                                            {index + 1}
                                        </span>

                                    )
                                )}

                        </div>


                        <textarea
                            className="code-editor"

                            spellCheck="false"

                            value={
                                selectedProblem
                                    ? (
                                        codes[
                                            selectedProblem.problem_id
                                        ] ||
                                        getDefaultCode()
                                    )
                                    : ""
                            }

                            onChange={(e) =>
                                handleCodeChange(
                                    e.target.value
                                )
                            }

                            placeholder={
                                selectedProblem
                                    ? "Write your solution here..."
                                    : "Select a problem first..."
                            }

                            disabled={
                                !selectedProblem
                            }

                        />

                    </div>


                    {/* FOOTER */}

                    <div
                        className="editor-footer"
                    >

                        <div
                            className="editor-info"
                        >

                            <span>

                                {language === "cpp"
                                    ? "C++17"
                                    : language === "java"
                                        ? "Java"
                                        : "Python 3"}

                            </span>


                            <span>
                                Auto-save: Local
                            </span>

                        </div>


                        <div
                            className="editor-actions"
                        >

                            <button
                                className="run-button"

                                onClick={
                                    handleRunCode
                                }

                                disabled={
                                    !selectedProblem
                                }
                            >

                                <Play
                                    size={16}
                                />

                                Run Code

                            </button>


                            <button
                                className="submit-button"

                                onClick={
                                    handleSubmit
                                }

                                disabled={
                                    !selectedProblem
                                }
                            >

                                <Send
                                    size={16}
                                />

                                Submit

                            </button>

                        </div>

                    </div>


                    {/* FUTURE EXECUTION */}

                    <div
                        className="execution-placeholder"
                    >

                        <div
                            className="execution-icon"
                        >

                            <Code2
                                size={19}
                            />

                        </div>


                        <div>

                            <strong>
                                Secure execution
                                coming next
                            </strong>

                            <span>
                                Code will later be
                                processed through the
                                CodeShield queue and
                                sandbox.
                            </span>

                        </div>

                    </div>

                </section>

            </div>

        </div>

    );

}


export default StudentTestPage;