# CodeShield — Secure Code Evaluation System

## Project Title and Brief Description

**CodeShield** is a secure, multi-tenant online programming assessment platform designed to safely compile and execute student-submitted code at scale. The project demonstrates practical integration of Operating System concepts (process management, resource control, sandboxing, concurrency) with Database Management System concepts (transactions, connection pooling, indexing) to build a crash-resistant, self-hosted alternative to commercial coding judges such as HackerRank.

Team ID: OSDBMS-V-2026-T163 | Team Name: CodeCrafters | Course: OS & DBMS PBL, 5th Semester

## Problem Statement / Objective

Academic programming assessments require more than basic code execution. Running untrusted student code directly on a server is inherently risky — a single infinite loop, fork bomb, or malicious script can crash the entire system or corrupt other students' data. Teachers also need customizable assessments with their own problems, rules, and test cases, while students need a consistent, reliable environment to submit and get their solutions evaluated.

**Core problem:** How can we provide a secure, customizable, and academic-focused environment for conducting and evaluating programming assessments, while safely containing untrusted code at the operating-system level?

**Objectives:**
- Provide a controlled, sandboxed environment for executing student-submitted code
- Allow teachers to create custom problems, test cases, and difficulty settings
- Automatically evaluate submissions against predefined test cases
- Support academic integrity through plagiarism detection and suspicious-activity tracking
- Meaningfully integrate OS-level isolation with reliable, transactional database storage

## Team Members

| Name | Roll Number | Role |
|---|---|---|
| Krishna Yadav | 240211229 | Backend + Core OS/Sandbox |
| Abhishek Singh | 240211560 | DBMS + Evaluation & Result Management |
| Khyati Uttam | 240222306 | Frontend + Academic Integrity |

**Mentor:** Dr. Vikas Tripathi (Prof.), Department of Computer Science & Engineering

### Detailed Role Breakdown

**Krishna Yadav — Backend + Core OS/Sandbox**
- Develops the API/backend orchestration layer
- Manages submissions in a job queue
- Develops the C++ sandbox executor
- Implements the fork-exec model
- Integrates Linux namespaces and cgroups v2
- Handles CPU, memory, and process-count limits
- Implements the timeout/watchdog mechanism
- Builds the worker pool for concurrent submission handling

**Abhishek Singh — DBMS + Evaluation Engine**
- Designs the PostgreSQL database
- Creates tables for users, assessments, problems, test cases, submissions, and results
- Implements primary keys, foreign keys, and constraints
- Implements transactions
- Handles indexing and connection pooling
- Builds evaluation logic that checks submitted code against test cases
- Stores execution result, time, and memory information in the database
- Integrates the database with the backend

**Khyati Uttam — Frontend + Academic Integrity**
- Builds the React-based student dashboard
- Builds the teacher dashboard
- Builds the problem creation interface
- Builds the test-case creation interface
- Builds the code editor/submission interface
- Builds submission history and result display
- Builds the monitoring/analytics interface for teachers
- Develops the Jaccard-based code similarity/plagiarism module
- Builds the suspicious-activity logging interface
- Integrates the frontend with backend APIs

## Technologies/Tools Used

- **C++** — sandbox executor, process management, cgroups/namespaces integration
- **PostgreSQL** — persistent storage for users, contests, problems, submissions, and results
- **React.js** — student and teacher-facing web dashboard
- **Monaco Editor** — in-browser code editor
- **Linux cgroups v2** — CPU, memory, and process-count resource limiting
- **Linux namespaces** — process, filesystem, and network isolation
- **POSIX threads / mutex / semaphore** — concurrency and synchronization
- **Git & GitHub** — version control

## Project Setup / Installation Instructions

### Prerequisites
```bash
sudo dnf install gcc gcc-c++ make -y
sudo dnf install postgresql postgresql-server postgresql-contrib -y
sudo dnf install python3 python3-pip -y
```

### Clone the Repository
```bash
git clone <repository-url>
cd codeshield
```

### Build the Sandbox Executor
```bash
cd sandbox
g++ -o sandbox_executor sandbox_executor.cpp
```

### Set Up PostgreSQL
```bash
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Run the Executor (requires root for cgroup access)
```bash
sudo ./sandbox_executor <path_to_program>
```

*(Detailed frontend/backend setup instructions will be added as those modules are implemented.)*

## Major Features/Modules

- **Backend & Sandbox Executor** (Krishna) — API/backend orchestration, job queue management, and a C++ sandbox executor that runs each submission in an isolated child process using fork-exec; isolation via Linux namespaces and cgroups v2, with CPU/memory/process-count limits, a timeout/watchdog mechanism, and a worker pool for concurrent submissions
- **Database & Evaluation Engine** (Abhishek) — PostgreSQL schema for users, assessments, problems, test cases, submissions, and results, with primary/foreign keys and constraints, ACID transactions, indexing, and connection pooling; evaluation logic that checks submitted code against test cases and stores execution result, time, and memory data
- **Frontend & Academic Integrity** (Khyati) — React-based student and teacher dashboards, problem/test-case creation interfaces, code editor and submission interface, submission history and result display, teacher monitoring/analytics interface, a Jaccard-based plagiarism detection module, and a suspicious-activity logging interface

## Current Project Status

**Phase I — Completed:** Problem identification, current-solution study, requirements discussion, feature scope finalization, and three mentor interactions completed.

**Phase II — In Progress:** Building core modules in parallel —
- Krishna: baseline naive executor built (demonstrates unprotected execution risk); basic sandboxed executor built with cgroups v2 (memory limit, process-count limit, timeout enforcement); namespace integration and worker pool in progress
- Abhishek: PostgreSQL schema design and evaluation logic in progress
- Khyati: frontend dashboard wireframes and plagiarism module planning in progress

**Phase III — Upcoming:** Namespace isolation, full frontend integration, plagiarism detection, load testing, and final integration.

## References

- Silberschatz, Galvin & Gagne — *Operating System Concepts*
- Tanenbaum — *Modern Operating Systems*
- Linux Kernel Documentation — cgroups v2
- PostgreSQL Documentation
- React Documentation
- Michael Kerrisk — Linux man-pages / Namespaces