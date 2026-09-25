
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




--Run this with: psql -U postgres -d codeshield_db -f schema.sql