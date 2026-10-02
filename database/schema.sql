
--Database Schema For Code Sheild

--USER
CREATE TABLE Users (
    user_id      SERIAL PRIMARY KEY,
    username     VARCHAR(50) UNIQUE NOT NULL,
    email        VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role         VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher')),
    created_at   TIMESTAMP DEFAULT NOW()
);
--CONTESTS/TESTS
CREATE TABLE Contests (
    contest_id   SERIAL PRIMARY KEY,
    title        VARCHAR(150) NOT NULL,
    description  TEXT,
    created_by   INTEGER NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    start_time   TIMESTAMP NOT NULL,
    end_time     TIMESTAMP NOT NULL,
    created_at   TIMESTAMP DEFAULT NOW()
);

--PROBLEMS
CREATE TABLE Problems (
    problem_id   SERIAL PRIMARY KEY,
    contest_id   INTEGER NOT NULL REFERENCES Contests(contest_id) ON DELETE CASCADE,
    title        VARCHAR(150) NOT NULL,
    statement    TEXT NOT NULL,
    difficulty   VARCHAR(20) CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    time_limit_ms   INTEGER NOT NULL DEFAULT 1000,  
    memory_limit_mb INTEGER NOT NULL DEFAULT 256,    
    created_at   TIMESTAMP DEFAULT NOW()
);

--TEST CASES
CREATE TABLE TestCases (
    testcase_id  SERIAL PRIMARY KEY,
    problem_id   INTEGER NOT NULL REFERENCES Problems(problem_id) ON DELETE CASCADE,
    input        TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden    BOOLEAN NOT NULL DEFAULT TRUE  
);

--SUBMISSIONS
CREATE TABLE Submissions (
    submission_id SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    problem_id   INTEGER NOT NULL REFERENCES Problems(problem_id) ON DELETE CASCADE,
    code         TEXT NOT NULL,
    language     VARCHAR(20) NOT NULL CHECK (language IN ('python', 'cpp', 'java')),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'running', 'completed')),
    submitted_at TIMESTAMP DEFAULT NOW()
);

--RESULTS
CREATE TABLE Results (
    result_id    SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES Submissions(submission_id) ON DELETE CASCADE,
    verdict      VARCHAR(20) NOT NULL
                 CHECK (verdict IN ('AC', 'WA', 'TLE', 'MLE', 'RE')),
    execution_time_ms INTEGER,
    memory_used_kb    INTEGER,
    test_cases_passed INTEGER DEFAULT 0,
    test_cases_total  INTEGER DEFAULT 0,
    created_at   TIMESTAMP DEFAULT NOW()
);

--ACTIVITY LOG
CREATE TABLE ActivityLog(
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES USER(user_id) ON DELETE CASCADE,
    contest_id INTEGER NOT NULL REFERENCES CONTESTS(contest_id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_time TIMESTAMP DEFAULT NOW()

)

--PLAGRISM RESULT
CREATE TABLE PlagrismChecks(
    check_id SERIAL PRIMARY KEY,
    submission_id_1 INTEGER NOT NULL REFERENCES SUBMISSIONS(submission_id) ON DELETE CASCADE,
    submission_id_2 INTEGER NOT NULL REFERENCES SUBMISSION(submission_id) ON DELETE CASCADE,
    similarity_score NUMERIC(5,2) NOT NULL,
    flagged BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMP DEFAULT NOW()
)

--INDEXES
CREATE INDEX idx_submissions_status ON Submissions(status);
CREATE INDEX idx_submissions_problem ON Submissions(problem_id);
CREATE INDEX idx_problems_contest ON Problems(contest_id);
CREATE INDEX idx_activitylog_contest ON ActivityLog(contest_id);

--LEADERBOARD VIEW
CREATE VIEW LeaderboardView AS
SELECT
    u.username,
    p.contest_id,
    COUNT(DISTINCT CASE
        WHEN r.verdict = 'AC' THEN s.problem_id
    END) AS problems_solved,
    SUM(r.execution_time_ms) AS total_time_ms
FROM Submissions s
JOIN Users u ON s.user_id = u.user_id
JOIN Problems p ON s.problem_id = p.problem_id
JOIN Results r ON r.submission_id = s.submission_id
GROUP BY u.username, p.contest_id
ORDER BY problems_solved DESC, total_time_ms ASC;






--Run this with: psql -U postgres -d codeshield_db -f schema.sql