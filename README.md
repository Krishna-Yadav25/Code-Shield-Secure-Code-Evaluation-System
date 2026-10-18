# CodeShield — Secure Code Evaluation System

## Project Title and Brief Description

**CodeShield** is a secure, multi-tenant online programming assessment platform designed to compile and execute student-submitted code in a controlled environment. The project demonstrates the practical integration of Operating System concepts (process management, resource control, sandboxing, and concurrency) with Database Management System concepts (transactions, constraints, indexing, and persistent storage).

The platform provides separate student and teacher workflows, code submission and evaluation, assessment management, and authentication facilities. Further development focuses on strengthening sandbox security, improving scalability, and introducing academic-integrity modules.

**Team ID:** OSDBMS-V-2026-T163  
**Team Name:** CodeCrafters  
**Course:** OS & DBMS PBL, 5th Semester

## Problem Statement / Objective

Academic programming assessments require more than basic code execution. Running untrusted student code directly on a server can affect system stability and consume excessive resources. Teachers also need customizable assessments with their own problems, rules, and test cases, while students need a consistent environment to submit and evaluate their solutions.

**Core problem:** How can we provide a secure, customizable, and academic-focused environment for conducting programming assessments while controlling untrusted code execution at the operating-system level and maintaining reliable database storage?

**Objectives:**

- Provide a controlled environment for executing student-submitted code.
- Allow teachers to create and manage assessments, problems, and test cases.
- Automatically evaluate submissions against predefined test cases.
- Provide separate authentication and workflows for students and teachers.
- Store submission details and evaluation results in PostgreSQL.
- Apply operating-system resource controls to improve execution safety.
- Extend the platform with plagiarism detection and suspicious-activity monitoring in Phase III.
- Improve sandbox isolation, reliability, and concurrent submission handling.

## Team Members

| Name | Roll Number | Role |
|---|---|---|
| Krishna Yadav | 240211229 | Backend + Core OS/Sandbox |
| Abhishek Singh | 240211560 | DBMS + Evaluation & Result Management |
| Khyati Uttam | 240222306 | Frontend + Academic Integrity |

**Mentor:** Dr. Vikas Tripathi (Prof.), Department of Computer Science & Engineering

### Detailed Role Breakdown

**Krishna Yadav — Backend + Core OS/Sandbox**

- Develops the Flask backend and API orchestration layer.
- Manages code submissions through a job queue and worker thread.
- Develops the C++ sandbox executor.
- Implements process creation and execution using the fork-exec model.
- Works on Linux namespaces and cgroups v2 integration.
- Develops CPU, memory, and execution-time controls.
- Integrates sandbox execution with the code evaluation workflow.
- Implements authentication and Gmail-based password-reset functionality in the backend.

**Abhishek Singh — DBMS + Evaluation Engine**

- Designs and maintains the PostgreSQL database schema.
- Creates tables for users, assessments, problems, test cases, submissions, and results.
- Implements primary keys, foreign keys, and database constraints.
- Integrates database operations with the backend.
- Stores submission details and evaluation results.
- Supports transaction management, indexing, and query optimization.

**Khyati Uttam — Frontend + Academic Integrity**

- Develops the React-based student and teacher dashboards.
- Builds problem-creation and test-case-management interfaces.
- Develops code submission, execution-result, and submission-history interfaces.
- Builds teacher-facing assessment-management interfaces.
- Plans the Jaccard-based code similarity and plagiarism-detection module for Phase III.
- Plans suspicious-activity logging and monitoring features for Phase III.
- Integrates frontend components with backend APIs.

## Technologies/Tools Used

- **C++** — Sandbox executor and process management.
- **Python Flask** — Backend APIs and submission orchestration.
- **PostgreSQL** — Persistent storage for users, assessments, problems, test cases, submissions, and results.
- **React.js** — Student and teacher dashboards.
- **Vite** — Frontend development server and build tooling.
- **Linux cgroups v2** — Resource control for sandboxed execution.
- **Linux namespaces** — Planned/in-progress process, filesystem, and network isolation.
- **POSIX process management** — Child-process execution and process control.
- **Git & GitHub** — Version control and team collaboration.
- **Gmail SMTP** — Email delivery for OTP-based password reset.
- **Google and GitHub OAuth** — Third-party authentication.

## Project Setup / Installation Instructions

### Prerequisites

The project is developed and tested in a Linux environment. The following packages are required for the main components.

```bash
sudo dnf install gcc gcc-c++ make -y
sudo dnf install postgresql postgresql-server postgresql-contrib -y
sudo dnf install python3 python3-pip -y
```

Install Node.js and npm using a suitable method for your Fedora installation.

### Clone the Repository

```bash
git clone <repository-url>
cd Code-Shield-Secure-Code-Evaluation-System
```

Use the actual repository URL when cloning.

### Set Up PostgreSQL

Initialize PostgreSQL if it has not already been initialized:

```bash
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Configure the database, user, password, and database name according to the project's database configuration.

Apply the project's schema using the appropriate PostgreSQL user and database. Avoid reinitializing an existing database containing project data.

### Configure Environment Variables

Create a local `.env` file containing the required configuration, such as:

- PostgreSQL connection settings.
- JWT or authentication secret.
- Google OAuth client credentials.
- GitHub OAuth client credentials.
- Gmail SMTP email address and App Password.

**Important:** Do not commit `.env` or any database passwords, OAuth secrets, JWT secrets, or Gmail App Passwords to GitHub. Keep `.env` excluded through `.gitignore`.

### Install Backend Dependencies

From the project root:

```bash
cd backend
python3 -m pip install -r requirements.txt
```

If `requirements.txt` is not present, install the dependencies required by the backend imports or create a requirements file containing the project's actual dependencies.

### Run the Backend

From the `backend` directory:

```bash
python3 app.py
```

The Flask development server runs at the configured local address, currently expected to be:

```text
http://127.0.0.1:5000
```

### Run the Frontend

Open a separate terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### Build the Sandbox Executor

From the project root:

```bash
cd sandbox
g++ -o sandbox_executor sandbox_executor.cpp
```

Run the executor according to its current interface and configured permissions. Root privileges should only be used where necessary for the implemented OS resource controls. The executor must not be exposed to untrusted input without appropriate isolation and security checks.

## Major Features/Modules

- **Authentication & User Management** — Registration and login infrastructure, Google/GitHub authentication, password hashing, and Gmail-based OTP password reset.
- **Backend & Sandbox Executor (Krishna)** — Flask API orchestration, submission queue, worker-based execution, C++ sandbox integration, and initial OS-level resource controls.
- **Database & Evaluation Engine (Abhishek)** — PostgreSQL schema and persistent storage for users, problems, test cases, submissions, and results; evaluation of submissions against visible and hidden test cases.
- **Student Dashboard** — Student-facing interface for accessing assessments, viewing problems, submitting code, and checking execution results.
- **Teacher Dashboard** — Teacher-facing interface for assessment and problem management, test-case configuration, and assessment-related controls.
- **Code Execution & Evaluation** — Compilation and execution of C++ submissions, comparison against test cases, and reporting of evaluation results.
- **Academic Integrity (Phase III)** — Planned Jaccard-based code similarity analysis, plagiarism detection, suspicious-activity logging, and teacher-facing monitoring.
- **Sandbox Enhancements (Phase III)** — Planned improvements to process isolation, namespace integration, resource enforcement, timeout handling, cleanup, and execution reliability.

## Current Project Status

### Phase I — Completed

- Problem identification and current-solution study.
- Requirements discussion and feature-scope finalization.
- Mentor interactions and project planning.

### Phase II — In Progress

Core modules have been developed and are undergoing integration and testing.

- **Authentication:** Registration/login infrastructure and Google/GitHub authentication are present. Gmail-based password reset has been tested through OTP delivery, OTP verification, and password-reset endpoints.
- **Backend:** Flask API routes are implemented for authentication, dashboard workflows, and coding/submission workflows.
- **Database:** PostgreSQL integration supports user authentication and submission/result storage. Further validation and integration are ongoing.
- **Evaluation Engine:** C++ submissions have been tested using sample problems, including Two Sum and Sum of Array, with visible and hidden test-case evaluation.
- **Sandbox:** A baseline naive executor and an initial sandboxed executor have been developed. cgroups v2 resource controls and timeout handling have been explored and tested. Stronger isolation and additional reliability testing remain necessary.
- **Frontend:** React/Vite interfaces and separate student/teacher workflows are under development and integration.
- **Academic Integrity:** Plagiarism detection and suspicious-activity monitoring have not yet been implemented. Both are planned for Phase III.

### Phase III — Upcoming

Phase III will focus on strengthening existing components, implementing planned modules, and completing system integration.

- **Sandbox hardening:** Improve process isolation, filesystem and network restrictions, and execution safety.
- **Namespace integration:** Complete and validate Linux namespace-based isolation where supported by the execution environment.
- **Resource enforcement:** Strengthen cgroups-based CPU, memory, and process-count controls.
- **Execution reliability:** Improve timeout handling, error reporting, cleanup of temporary files and processes, and recovery from failed executions.
- **Concurrency:** Improve worker-pool handling and test simultaneous submissions under load.
- **Plagiarism detection:** Implement Jaccard-based code similarity analysis and identify potentially similar submissions.
- **Suspicious-activity monitoring:** Add activity logging and teacher-facing monitoring features.
- **Frontend integration:** Complete integration between student/teacher interfaces and backend APIs.
- **Database validation:** Test transaction handling, constraints, result consistency, and performance under concurrent workloads.
- **Additional modules:** Introduce further assessment, analytics, reporting, and administrative features based on project requirements.
- **Testing:** Perform end-to-end testing, security testing, integration testing, and load testing.

## Future Scope

- Support for additional programming languages beyond C++.
- Stronger sandbox isolation and configurable execution limits.
- Advanced plagiarism detection and academic-integrity analytics.
- Detailed performance reports and assessment analytics for teachers.
- Improved scalability for concurrent assessments and large numbers of users.
- Enhanced administrative controls and assessment-management features.
- More comprehensive execution logs, monitoring, and failure diagnostics.

## References

- Silberschatz, Galvin & Gagne — *Operating System Concepts*.
- Tanenbaum — *Modern Operating Systems*.
- Linux Kernel Documentation — cgroups v2.
- PostgreSQL Documentation.
- React Documentation.
- Flask Documentation.
- Michael Kerrisk — Linux man-pages and Linux namespaces documentation.
