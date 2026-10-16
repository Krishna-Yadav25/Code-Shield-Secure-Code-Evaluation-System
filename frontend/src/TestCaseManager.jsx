import { useEffect, useState } from "react";

import {
    Plus,
    Trash2,
    Eye,
    EyeOff,
    X,
    CheckCircle2
} from "lucide-react";

import "./TestCaseManager.css";

const API_BASE = "http://localhost:5000";

function TestCaseManager({ problem }) {

    const problemId = problem?.problem_id;

    const [testCases, setTestCases] = useState([]);
    const [showForm, setShowForm] = useState(false);

    const [input, setInput] = useState("");
    const [expectedOutput, setExpectedOutput] = useState("");
    const [isHidden, setIsHidden] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // ==========================================
    // GET TOKEN
    // ==========================================

    const getToken = () => {
        return localStorage.getItem("codeshield_token");
    };

    // ==========================================
    // LOAD TEST CASES
    // ==========================================

    const loadTestCases = async () => {

        if (!problemId) {
            setTestCases([]);
            setLoading(false);
            return;
        }

        try {

            setLoading(true);
            setError("");

            const token = getToken();

            if (!token) {
                throw new Error("Authentication token not found.");
            }

            const response = await fetch(
                `${API_BASE}/api/teacher/problems/${problemId}/testcases`,
                {
                    method: "GET",

                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            // Read response as text first
            const text = await response.text();

            console.log(
                "GET test cases status:",
                response.status
            );

            console.log(
                "GET test cases response:",
                text
            );

            let result = {};

            // Safely parse JSON
            if (text.trim()) {

                try {

                    result = JSON.parse(text);

                } catch (parseError) {

                    throw new Error(
                        `Backend returned invalid JSON. Status: ${response.status}`
                    );

                }
            }

            if (!response.ok) {

                throw new Error(
                    result.error ||
                    result.message ||
                    `Failed to load test cases. Status: ${response.status}`
                );

            }

            setTestCases(
                Array.isArray(result.test_cases)
                    ? result.test_cases
                    : []
            );

        } catch (err) {

            console.error(
                "Load test cases error:",
                err
            );

            setError(err.message);

        } finally {

            setLoading(false);

        }
    };

    // ==========================================
    // LOAD WHEN PROBLEM CHANGES
    // ==========================================

    useEffect(() => {

        loadTestCases();

    }, [problemId]);

    // ==========================================
    // RESET FORM
    // ==========================================

    const resetForm = () => {

        setInput("");
        setExpectedOutput("");
        setIsHidden(false);

        setShowForm(false);

    };

    // ==========================================
    // ADD TEST CASE
    // ==========================================

    const addTestCase = async (event) => {

        event.preventDefault();

        setMessage("");
        setError("");

        if (!problemId) {

            setError(
                "Please select a problem first."
            );

            return;
        }

        if (!input.trim()) {

            setError(
                "Input is required."
            );

            return;
        }

        if (!expectedOutput.trim()) {

            setError(
                "Expected output is required."
            );

            return;
        }

        try {

            setSaving(true);

            const token = getToken();

            if (!token) {

                throw new Error(
                    "Authentication token not found."
                );

            }

            const response = await fetch(
                `${API_BASE}/api/teacher/problems/${problemId}/testcases`,
                {
                    method: "POST",

                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        input: input,
                        expected_output: expectedOutput,
                        is_hidden: isHidden
                    })
                }
            );

            // Read as text first
            const text = await response.text();

            console.log(
                "POST test case status:",
                response.status
            );

            console.log(
                "POST test case response:",
                text
            );

            let result = {};

            if (text.trim()) {

                try {

                    result = JSON.parse(text);

                } catch (parseError) {

                    throw new Error(
                        `Backend returned invalid JSON. Status: ${response.status}`
                    );

                }
            }

            if (!response.ok) {

                throw new Error(
                    result.error ||
                    result.message ||
                    `Could not create test case. Status: ${response.status}`
                );

            }

            setMessage(
                "Test case added successfully."
            );

            resetForm();

            await loadTestCases();

        } catch (err) {

            console.error(
                "Add test case error:",
                err
            );

            setError(err.message);

        } finally {

            setSaving(false);

        }
    };

    // ==========================================
    // DELETE TEST CASE
    // ==========================================

    const deleteTestCase = async (testcaseId) => {

        const confirmed = window.confirm(
            "Are you sure you want to delete this test case?"
        );

        if (!confirmed) {
            return;
        }

        try {

            setMessage("");
            setError("");

            const token = getToken();

            if (!token) {

                throw new Error(
                    "Authentication token not found."
                );

            }

            const response = await fetch(
                `${API_BASE}/api/teacher/testcases/${testcaseId}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const text = await response.text();

            console.log(
                "DELETE test case status:",
                response.status
            );

            console.log(
                "DELETE test case response:",
                text
            );

            let result = {};

            if (text.trim()) {

                try {

                    result = JSON.parse(text);

                } catch (parseError) {

                    throw new Error(
                        `Backend returned invalid JSON. Status: ${response.status}`
                    );

                }
            }

            if (!response.ok) {

                throw new Error(
                    result.error ||
                    result.message ||
                    `Could not delete test case. Status: ${response.status}`
                );

            }

            setMessage(
                "Test case deleted successfully."
            );

            await loadTestCases();

        } catch (err) {

            console.error(
                "Delete test case error:",
                err
            );

            setError(err.message);

        }
    };

    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (

            <section className="tc-section">

                <div className="tc-loading">
                    Loading test cases...
                </div>

            </section>

        );

    }

    // ==========================================
    // MAIN UI
    // ==========================================

    return (

        <section className="tc-section">

            {/* ================= HEADER ================= */}

            <div className="tc-header">

                <div>

                    <div className="tc-title-row">

                        <h2>
                            Test Cases
                        </h2>

                        <span className="tc-count">
                            {testCases.length}
                        </span>

                    </div>

                    <p>
                        Add visible and hidden evaluation cases
                        for this problem.
                    </p>

                </div>

                <button
                    className="tc-add-btn"
                    onClick={() => {

                        setMessage("");
                        setError("");
                        setShowForm(true);

                    }}
                >

                    <Plus size={17} />

                    Add Test Case

                </button>

            </div>


            {/* ================= SUCCESS MESSAGE ================= */}

            {message && (

                <div className="tc-message success">

                    <CheckCircle2 size={17} />

                    {message}

                </div>

            )}


            {/* ================= ERROR MESSAGE ================= */}

            {error && (

                <div className="tc-message error">

                    {error}

                </div>

            )}


            {/* ================= ADD FORM ================= */}

            {showForm && (

                <div className="tc-form-card">

                    <div className="tc-form-header">

                        <div>

                            <h3>
                                Add New Test Case
                            </h3>

                            <p>
                                Define the input and expected output
                                used for evaluation.
                            </p>

                        </div>

                        <button
                            type="button"
                            className="tc-close-btn"
                            onClick={resetForm}
                        >

                            <X size={18} />

                        </button>

                    </div>


                    <form onSubmit={addTestCase}>

                        {/* INPUT */}

                        <div className="tc-field">

                            <label>
                                Input
                            </label>

                            <textarea
                                value={input}

                                onChange={(e) =>
                                    setInput(
                                        e.target.value
                                    )
                                }

                                placeholder={`Example:
4
2 7 11 15
9`}

                                rows={6}
                            />

                            <span>
                                Enter exactly what should be
                                provided to the program.
                            </span>

                        </div>


                        {/* EXPECTED OUTPUT */}

                        <div className="tc-field">

                            <label>
                                Expected Output
                            </label>

                            <textarea
                                value={expectedOutput}

                                onChange={(e) =>
                                    setExpectedOutput(
                                        e.target.value
                                    )
                                }

                                placeholder={`Example:
0 1`}

                                rows={5}
                            />

                            <span>
                                Enter the exact expected output.
                            </span>

                        </div>


                        {/* VISIBILITY */}

                        <div className="tc-visibility">

                            <div className="tc-visibility-icon">

                                {isHidden ? (

                                    <EyeOff size={19} />

                                ) : (

                                    <Eye size={19} />

                                )}

                            </div>


                            <div className="tc-visibility-text">

                                <strong>

                                    {isHidden
                                        ? "Hidden test case"
                                        : "Visible test case"}

                                </strong>

                                <span>

                                    {isHidden
                                        ? "Hidden cases are not shown to students."
                                        : "Visible cases can be shown to students."}

                                </span>

                            </div>


                            <label className="tc-switch">

                                <input
                                    type="checkbox"

                                    checked={isHidden}

                                    onChange={(e) =>
                                        setIsHidden(
                                            e.target.checked
                                        )
                                    }
                                />

                                <span className="tc-slider" />

                            </label>

                        </div>


                        {/* ACTIONS */}

                        <div className="tc-form-actions">

                            <button
                                type="button"
                                className="tc-cancel-btn"
                                onClick={resetForm}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="tc-save-btn"
                                disabled={saving}
                            >

                                {saving
                                    ? "Saving..."
                                    : "Add Test Case"}

                            </button>

                        </div>

                    </form>

                </div>

            )}


            {/* ================= TEST CASE LIST ================= */}

            {testCases.length === 0 ? (

                <div className="tc-empty">

                    <div className="tc-empty-icon">

                        <Eye size={24} />

                    </div>

                    <h3>
                        No test cases yet
                    </h3>

                    <p>
                        Add visible or hidden test cases
                        using the button above.
                    </p>

                    <button
                        className="tc-empty-btn"
                        onClick={() =>
                            setShowForm(true)
                        }
                    >

                        <Plus size={16} />

                        Add first test case

                    </button>

                </div>

            ) : (

                <div className="tc-list">

                    {testCases.map(
                        (testCase, index) => (

                            <div
                                className="tc-card"
                                key={
                                    testCase.testcase_id
                                }
                            >

                                {/* CARD HEADER */}

                                <div className="tc-card-header">

                                    <div className="tc-card-left">

                                        <div className="tc-number">

                                            {index + 1}

                                        </div>


                                        <div>

                                            <h3>
                                                Test Case {index + 1}
                                            </h3>


                                            <span
                                                className={
                                                    testCase.is_hidden
                                                        ? "tc-badge hidden"
                                                        : "tc-badge visible"
                                                }
                                            >

                                                {testCase.is_hidden ? (

                                                    <>
                                                        <EyeOff
                                                            size={13}
                                                        />

                                                        Hidden
                                                    </>

                                                ) : (

                                                    <>
                                                        <Eye
                                                            size={13}
                                                        />

                                                        Visible
                                                    </>

                                                )}

                                            </span>

                                        </div>

                                    </div>


                                    {/* DELETE BUTTON */}

                                    <button
                                        type="button"
                                        className="tc-delete-btn"

                                        onClick={() =>
                                            deleteTestCase(
                                                testCase.testcase_id
                                            )
                                        }

                                        title="Delete test case"
                                    >

                                        <Trash2 size={17} />

                                    </button>

                                </div>


                                {/* INPUT / OUTPUT */}

                                <div className="tc-data-grid">

                                    <div className="tc-data-box">

                                        <div className="tc-data-label">
                                            Input
                                        </div>

                                        <pre>
                                            {testCase.input}
                                        </pre>

                                    </div>


                                    <div className="tc-data-box">

                                        <div className="tc-data-label">
                                            Expected Output
                                        </div>

                                        <pre>
                                            {testCase.expected_output}
                                        </pre>

                                    </div>

                                </div>

                            </div>

                        )
                    )}

                </div>

            )}

        </section>

    );

}

export default TestCaseManager;