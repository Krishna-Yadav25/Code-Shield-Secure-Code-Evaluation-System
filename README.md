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
| Krishna Yadav | 240211229 | Assessment Management & System Integration |
| Khyati Uttam | 240222306 | Database Design & Transaction Logic |
| Abhishek Singh | 240211560 | OS Sandboxing & Execution Engine |

**Mentor:** Dr. Vikas Tripathi (Prof.), Department of Computer Science & Engineering

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

- **Sandbox Executor** — runs each submission in an isolated child process using fork-exec, with cgroups v2 enforcing CPU, memory, and process-count limits, and a watchdog timeout to terminate runaway executions
- **Assessment Management** — allows teachers to create problems, define test cases, and configure difficulty/rules
- **Submission & Evaluation Pipeline** — connects the frontend, execution engine, and database to process and verdict-check submissions
- **Database Layer** — PostgreSQL schema for users, contests, problems, submissions, and results, with ACID transactions and connection pooling for burst-load handling
- **Plagiarism Detection** — token-based similarity checking (Jaccard similarity) across submissions
- **Suspicious Activity Tracking** — logs tab-switch events and anomalous submission timing
- **Web Dashboard** — React-based interface for students (submit code, view results) and teachers (create tests, monitor submissions)

## Current Project Status

**Phase I — Completed:** Problem identification, current-solution study, requirements discussion, feature scope finalization, and three mentor interactions completed.

**Phase II — In Progress:** Building core modules in parallel —
- Baseline naive executor built (demonstrates unprotected execution risk)
- Basic sandboxed executor built with cgroups v2 (memory limit, process-count limit, timeout enforcement)
- Database schema design in progress
- Assessment management and API integration in progress

**Phase III — Upcoming:** Namespace isolation, frontend dashboard, plagiarism detection, load testing, and final integration.

## References

- Silberschatz, Galvin & Gagne — *Operating System Concepts*
- Tanenbaum — *Modern Operating Systems*
- Linux Kernel Documentation — cgroups v2
- PostgreSQL Documentation
- React Documentation
- Michael Kerrisk — Linux man-pages / Namespaces