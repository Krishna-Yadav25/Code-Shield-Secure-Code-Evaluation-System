import {
    Plus,
    Clock3,
    Database,
    ChevronRight
} from "lucide-react";

import { useEffect, useState } from "react";

import TestCaseManager from "./TestCaseManager.jsx";

import "./Dashboard.css";


const API_BASE = "http://localhost:5000";


function ProblemManager({
    test,
    problems,
    reloadProblems
}) {

    const [selectedProblem, setSelectedProblem] =
        useState(
            problems.length > 0
                ? problems[0]
                : null
        );

    const [showForm, setShowForm] =
        useState(false);

    const [title, setTitle] =
        useState("");

    const [statement, setStatement] =
        useState("");

    const [difficulty, setDifficulty] =
        useState("Easy");

    const [timeLimit, setTimeLimit] =
        useState(1000);

    const [memoryLimit, setMemoryLimit] =
        useState(256);

    const [message, setMessage] =
        useState("");

    const [error, setError] =
        useState("");


    const token =
        localStorage.getItem(
            "codeshield_token"
        );


    /* =========================================================
       KEEP SELECTED PROBLEM UPDATED
    ========================================================= */

    useEffect(() => {

        if (problems.length === 0) {

            setSelectedProblem(null);

            return;
        }


        setSelectedProblem((current) => {

            if (!current) {
                return problems[0];
            }


            const updatedProblem =
                problems.find(
                    (problem) =>
                        problem.problem_id ===
                        current.problem_id
                );


            return updatedProblem ||
                problems[0];

        });

    }, [problems]);


    /* =========================================================
       CREATE PROBLEM
    ========================================================= */

    const createProblem = async (event) => {

        event.preventDefault();

        setMessage("");
        setError("");


        try {

            const response =
                await fetch(
                    `${API_BASE}/api/teacher/tests/${test.contest_id}/problems`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`
                        },

                        body: JSON.stringify({

                            title,

                            statement,

                            difficulty,

                            time_limit_ms:
                                Number(timeLimit),

                            memory_limit_mb:
                                Number(memoryLimit)

                        })
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.error ||
                    "Could not create problem"
                );

            }


            setMessage(
                "Problem created successfully."
            );


            setTitle("");

            setStatement("");

            setDifficulty("Easy");

            setTimeLimit(1000);

            setMemoryLimit(256);

            setShowForm(false);


            await reloadProblems();


        } catch (err) {

            setError(
                err.message
            );

        }

    };


    /* =========================================================
       SELECT PROBLEM
    ========================================================= */

    const handleSelectProblem = (problem) => {

        setSelectedProblem(problem);

        setMessage("");

        setError("");

    };


    /* =========================================================
       RENDER
    ========================================================= */

    return (

        <div className="problem-workspace">


            {/* =================================================
                PROBLEM LIST
            ================================================= */}

            <section className="problems-panel">


                <div className="panel-header">

                    <div>

                        <h2>

                            Problems

                            <span>
                                ({problems.length})
                            </span>

                        </h2>

                    </div>


                    <button
                        className="add-problem-btn"
                        type="button"
                        onClick={() =>
                            setShowForm(
                                !showForm
                            )
                        }
                    >

                        <Plus size={15} />

                        Add Problem

                    </button>

                </div>


                {/* =================================================
                    CREATE PROBLEM FORM
                ================================================= */}

                {showForm && (

                    <form
                        className="problem-create-form"
                        onSubmit={
                            createProblem
                        }
                    >

                        <div className="form-title">

                            Create New Problem

                        </div>


                        <label>
                            Problem Title
                        </label>

                        <input
                            type="text"
                            placeholder="Example: Two Sum"
                            value={title}
                            onChange={
                                (e) =>
                                    setTitle(
                                        e.target.value
                                    )
                            }
                            required
                        />


                        <label>
                            Problem Statement
                        </label>

                        <textarea
                            placeholder="Enter the complete problem statement..."
                            value={statement}
                            onChange={
                                (e) =>
                                    setStatement(
                                        e.target.value
                                    )
                            }
                            required
                        />


                        <div className="problem-input-row">

                            <div>

                                <label>
                                    Difficulty
                                </label>

                                <select
                                    value={
                                        difficulty
                                    }
                                    onChange={
                                        (e) =>
                                            setDifficulty(
                                                e.target.value
                                            )
                                    }
                                >

                                    <option value="Easy">
                                        Easy
                                    </option>

                                    <option value="Medium">
                                        Medium
                                    </option>

                                    <option value="Hard">
                                        Hard
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label>
                                    Time Limit
                                </label>

                                <input
                                    type="number"
                                    min="1"
                                    value={
                                        timeLimit
                                    }
                                    onChange={
                                        (e) =>
                                            setTimeLimit(
                                                e.target.value
                                            )
                                    }
                                    required
                                />

                            </div>


                            <div>

                                <label>
                                    Memory Limit
                                </label>

                                <input
                                    type="number"
                                    min="1"
                                    value={
                                        memoryLimit
                                    }
                                    onChange={
                                        (e) =>
                                            setMemoryLimit(
                                                e.target.value
                                            )
                                    }
                                    required
                                />

                            </div>

                        </div>


                        <button
                            className="primary-small-btn"
                            type="submit"
                        >

                            <Plus size={15} />

                            Create Problem

                        </button>


                        {message && (

                            <div className="mini-success">

                                {message}

                            </div>

                        )}


                        {error && (

                            <div className="mini-error">

                                {error}

                            </div>

                        )}

                    </form>

                )}


                {/* =================================================
                    PROBLEM LIST
                ================================================= */}

                <div className="problem-list">

                    {problems.length === 0 ? (

                        <div className="no-problems">

                            <Database size={25} />

                            <p>
                                No problems yet
                            </p>

                            <span>
                                Add your first coding
                                problem.
                            </span>

                        </div>

                    ) : (

                        problems.map(
                            (problem, index) => (

                                <button
                                    key={
                                        problem.problem_id
                                    }

                                    type="button"

                                    className={
                                        `problem-list-item ${
                                            selectedProblem?.problem_id ===
                                            problem.problem_id
                                                ? "selected"
                                                : ""
                                        }`
                                    }

                                    onClick={() =>
                                        handleSelectProblem(
                                            problem
                                        )
                                    }
                                >

                                    <div className="problem-number">

                                        {index + 1}

                                    </div>


                                    <div className="problem-list-content">

                                        <strong>
                                            {problem.title}
                                        </strong>


                                        <div className="problem-meta">

                                            <span
                                                className={
                                                    `difficulty ${
                                                        problem
                                                            .difficulty
                                                            ?.toLowerCase()
                                                    }`
                                                }
                                            >

                                                {
                                                    problem.difficulty
                                                }

                                            </span>


                                            <span>

                                                <Clock3
                                                    size={12}
                                                />

                                                {
                                                    problem
                                                        .time_limit_ms
                                                } ms

                                            </span>


                                            <span>

                                                <Database
                                                    size={12}
                                                />

                                                {
                                                    problem
                                                        .memory_limit_mb
                                                } MB

                                            </span>

                                        </div>

                                    </div>


                                    <ChevronRight
                                        size={17}
                                    />

                                </button>

                            )
                        )

                    )}

                </div>

            </section>


            {/* =================================================
                PROBLEM DETAILS
            ================================================= */}

            <section className="problem-details-panel">

                {selectedProblem ? (

                    <>

                        {/* =========================================
                            PROBLEM HEADER
                        ========================================= */}

                        <div className="problem-detail-header">

                            <div>

                                <div className="problem-title-line">

                                    <h2>
                                        {
                                            selectedProblem.title
                                        }
                                    </h2>


                                    <span
                                        className={
                                            `difficulty ${
                                                selectedProblem
                                                    .difficulty
                                                    ?.toLowerCase()
                                            }`
                                        }
                                    >

                                        {
                                            selectedProblem
                                                .difficulty
                                        }

                                    </span>

                                </div>


                                <p className="problem-subtitle">

                                    Problem #
                                    {" "}
                                    {
                                        selectedProblem
                                            .problem_id
                                    }

                                </p>

                            </div>

                        </div>


                        {/* =========================================
                            STATEMENT
                        ========================================= */}

                        <div className="statement-box">

                            <h3>
                                Problem Statement
                            </h3>


                            <p>

                                {
                                    selectedProblem.statement
                                }

                            </p>

                        </div>


                        {/* =========================================
                            LIMITS
                        ========================================= */}

                        <div className="limits-row">


                            <div className="limit-card">

                                <Clock3
                                    size={18}
                                />

                                <div>

                                    <span>
                                        Time Limit
                                    </span>

                                    <strong>

                                        {
                                            selectedProblem
                                                .time_limit_ms
                                        } ms

                                    </strong>

                                </div>

                            </div>


                            <div className="limit-card">

                                <Database
                                    size={18}
                                />

                                <div>

                                    <span>
                                        Memory Limit
                                    </span>

                                    <strong>

                                        {
                                            selectedProblem
                                                .memory_limit_mb
                                        } MB

                                    </strong>

                                </div>

                            </div>

                        </div>


                        {/* =========================================
                            TEST CASES
                        ========================================= */}

                        <TestCaseManager
                            problem={
                                selectedProblem
                            }
                        />

                    </>

                ) : (

                    <div className="problem-empty">

                        <Code2Placeholder />

                        <h2>
                            Select a problem
                        </h2>

                        <p>
                            Choose a problem from
                            the left panel.
                        </p>

                    </div>

                )}

            </section>

        </div>

    );

}


/* ==============================================================
   EMPTY CODE ICON
   ============================================================== */

function Code2Placeholder() {

    return (

        <div className="empty-code-icon">

            {"</>"}

        </div>

    );

}


export default ProblemManager;