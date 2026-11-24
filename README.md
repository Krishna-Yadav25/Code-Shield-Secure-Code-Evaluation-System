# CodeShield – Secure Code Evaluation System

**AI-Assisted Secure Online Coding Assessment Platform**

![Project](https://img.shields.io/badge/Project-CodeShield-blue)
![Frontend](https://img.shields.io/badge/Frontend-React-blue)
![Backend](https://img.shields.io/badge/Backend-Flask-green)
![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)
![Language](https://img.shields.io/badge/Execution-C%2B%2B-orange)
![Platform](https://img.shields.io/badge/Platform-Linux-black)

## 1. Project Overview

CodeShield is a web-based secure coding assessment platform designed for academic programming examinations, coding tests and practice assessments.

The platform provides separate dashboards for teachers and students. Teachers can create coding tests, manage programming questions, configure test cases and monitor student submissions. Students can attempt assessments through an online coding interface and receive automatically evaluated results.

CodeShield integrates Operating System concepts, Database Management Systems and web technologies to provide controlled code execution, automated evaluation, plagiarism detection and suspicious activity monitoring.

## 2. Problem Statement

Traditional coding assessments require teachers to manually manage questions, test cases, submissions and evaluation results. Basic online coding platforms may also lack the execution controls and monitoring features required for academic examinations.

CodeShield addresses these challenges through a centralized platform that combines automated code evaluation, controlled program execution, database-backed assessment management and academic-integrity monitoring.

## 3. Key Features

### Authentication and Role Management
- Separate Student and Teacher access.
- User authentication and role-based authorization.
- Dedicated dashboards for both user roles.

### Assessment and Test Management
- Teachers can create and manage coding assessments.
- Add programming questions and configure constraints.
- Configure visible and hidden test cases.
- Manage student assessments and submissions.

### C++ Sandbox Execution Engine
- Executes student-submitted C++ programs.
- Uses Linux process management through the fork-exec model.
- Uses pipes for inter-process communication where required.
- Applies execution time and resource restrictions.
- Supports controlled program execution and automatic evaluation.

### Automated Code Evaluation
- Compiles and executes submitted programs.
- Evaluates output against configured test cases.
- Generates submission results and execution status.
- Stores evaluation results for later retrieval.

### Plagiarism Detection
- Token-based code comparison.
- Jaccard similarity-based comparison.
- Identifies potentially similar code submissions.

### Suspicious Activity Monitoring
- Tab-switch and browser focus monitoring.
- Configurable tab-switch threshold.
- Camera-based student presence and eye-gaze monitoring.
- Suspicious activity logging.
- Test freeze and teacher-controlled resume workflow.

### AI-Assisted Question Generation
- Gemini API integration for AI-assisted coding question generation.
- Generate proposed questions from teacher prompts.
- Generate suggested visible and hidden test cases.
- Teacher review and selection before publishing.

### Notifications and Results
- Student and teacher notifications.
- Submission history and evaluation results.
- Database-backed result management.

## 4. System Architecture

CodeShield follows a modular architecture:

```text
             STUDENT / TEACHER
                     |
                     v
             REACT FRONTEND
                     |
                     v
              FLASK API LAYER
                     |
          +----------+----------+
          |          |          |
          v          v          v
      AUTH API    AI SERVICE   MONITORING
          |          |          |
          +----------+----------+
                     |
                     v
             JOB QUEUE & WORKER
                     |
                     v
              C++ SANDBOX ENGINE
                     |
                     v
             AUTOMATED EVALUATION
                     |
                     v
              POSTGRESQL DATABASE
                     |
                     v
             RESULTS & DASHBOARDS
```

### Architecture Components

| Component | Responsibility |
|---|---|
| React Frontend | Student and Teacher interfaces |
| Flask Backend | API handling and application logic |
| PostgreSQL | Users, tests, submissions and results |
| Job Queue and Worker | Submission processing |
| C++ Sandbox | Controlled code execution |
| Gemini API | AI-assisted question generation |
| Monitoring Module | Suspicious activity detection |

## 5. Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, JavaScript, CSS |
| Backend | Python, Flask |
| Database | PostgreSQL |
| Code Execution | C++ |
| Operating System | Linux |
| AI Integration | Gemini API |
| Monitoring | JavaScript, Camera APIs |
| Version Control | Git and GitHub |
| Development Environment | Visual Studio Code |

## 6. Operating System Concepts Implemented

CodeShield demonstrates practical Operating System concepts through its sandbox execution engine.

- **Process Management:** Creation and management of child processes using fork().
- **Program Execution:** Execution of compiled programs using exec().
- **Process Synchronization:** Waiting for child-process completion using wait mechanisms.
- **Inter-Process Communication:** Communication using pipes.
- **Signal Handling:** Handling execution termination and timeout conditions.
- **Resource Management:** Controlling CPU, memory and process usage.
- **Linux Isolation:** Use of namespaces and cgroups where configured in the execution environment.

## 7. DBMS Concepts Implemented

PostgreSQL is used for persistent storage and management of application data.

The database manages:
- User accounts and authentication data.
- Contests and coding assessments.
- Programming questions and test cases.
- Student submissions.
- Evaluation results.
- Execution and activity records.

The application uses relational database structures, primary keys, foreign keys and backend database operations to maintain data consistency.

## 8. Project Structure

```text
CodeShield/
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
│
├── backend/
│   ├── app.py
│   ├── auth_routes.py
│   ├── coding_routes.py
│   ├── plagiarism_routes.py
│   ├── proctoring_routes.py
│   ├── dashboard_routes.py
│   ├── requirements.txt
│   └── tests/
│
├── database/
│   ├── schema.sql
│   ├── authentication.py
│   └── insert_result.py
│
├── sandbox/
│   └── C++ execution engine source files
│
├── README.md
└── .gitignore
```

*Note: This is a logical project structure. Actual filenames and folders may differ according to the repository version.*

## 9. Installation and Setup

### Prerequisites

Install the following software:

- Python 3
- Node.js and npm
- PostgreSQL
- C++ compiler (g++)
- Linux environment
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/Krishna-Yadav25/Code-Shield-Secure-Code-Evaluation-System.git

cd Code-Shield-Secure-Code-Evaluation-System
```

### Step 2: Backend Setup

```bash
cd backend

python3 -m venv venv

source venv/bin/activate

pip install -r requirements.txt
```

Configure the required environment variables and PostgreSQL database connection according to the backend configuration.

### Step 3: Database Setup

Create a PostgreSQL database and configure its connection details.

Run the database schema:

```bash
psql -U postgres -d your_database_name -f database/schema.sql
```

Run this command from the project root. Replace the database name and username with your actual configuration.

### Step 4: Frontend Setup

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

### Step 5: Run the Backend

From the backend directory, start the Flask application using the project's configured startup command.

```bash
python app.py
```

The frontend and backend should be configured to communicate using the appropriate API base URL.

## 10. Testing and Validation

The major application workflows have been tested, including:

| Test Area | Validation |
|---|---|
| Authentication | Login and registration workflows |
| Code Execution | Compilation and execution of C++ submissions |
| Automated Evaluation | Output comparison against test cases |
| Resource Control | Execution time and resource-limit handling |
| Database | Storage and retrieval of assessment results |
| Multi-Student Execution | Queue-based submission processing |
| Monitoring | Tab-switch and camera-monitoring workflows |

Monitoring accuracy and higher-load performance can be further improved through additional testing.

## 11. Team Contributions

**Project Team – OSDBMS-V-2026-T163**

| Team Member | Major Responsibilities |
|---|---|
| Krishna Yadav | C++ Sandbox Engine, OS-based execution, AI question generation and test freeze/resume |
| Khyati Uttam | React frontend, Flask API integration and plagiarism detection |
| Abhishek Singh | PostgreSQL database, authentication/result integration and suspicious activity monitoring |

**Project Mentor:** Dr. Vikas Tripathi

**Department:** Computer Science & Engineering  
**Institution:** Graphic Era (Deemed to be University), Dehradun  
**Academic Session:** 2026–27

## 12. Applications

- University coding examinations.
- Programming laboratories.
- Online coding assessments.
- Academic programming competitions.
- Student coding practice and evaluation.

## 13. Future Scope

- Distributed code execution using multiple independent workers.
- Advanced sandbox isolation and execution security.
- AST-based plagiarism detection.
- AI-assisted code quality analysis.
- Adaptive question difficulty.
- Advanced performance analytics.
- Support for additional programming languages.
- Improved proctoring and suspicious activity analysis.

## 14. References

- Silberschatz, Galvin and Gagne – *Operating System Concepts*.
- PostgreSQL Official Documentation.
- Linux man-pages – Processes, Pipes and Signals.
- Linux cgroups v2 and Namespace Documentation.
- React Official Documentation.
- Flask Official Documentation.
- Gemini API Documentation.

## 15. Repository

**GitHub:**  
https://github.com/Krishna-Yadav25/Code-Shield-Secure-Code-Evaluation-System

---

**CodeShield – Making Coding Assessments Secure, Intelligent and Reliable.**