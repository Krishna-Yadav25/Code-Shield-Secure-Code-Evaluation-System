// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   AlertTriangle,
//   ArrowLeft,
//   Clock3,
//   Code2,
//   FileText,
//   Lock,
//   LogOut,
//   MemoryStick,
//   Play,
//   Send,
//   ChevronRight,
//   CheckCircle2,
//   Eye,
//   Loader2,
//   RotateCcw,
// } from "lucide-react";
// import EyeMonitor from "./EyeMonitor.jsx";
// import "./StudentTestPage.css";
// import "./Proctoring.css";
// import Editor from "@monaco-editor/react";

// const API_BASE = "http://localhost:5000";

// // Server MAX_TAB_SWITCHES bhejta hai; yeh sirf shuruaati default hai.
// // 6 switch tak allowed, 7th switch par test freeze.
// const DEFAULT_MAX_SWITCHES = 6;

// // Session status itne ms mein check hota hai (teacher ke freeze / end ke liye)
// const SESSION_POLL_MS = 10000;

// // Gambhir cases: photo teacher ko jati hai (student ko kuch nahi dikhta)
// const INCIDENT_TYPES = ["MULTI_FACE", "FACE_MISMATCH"];

// // Ye alert pehle jaise /gaze-event se bhi gine jayenge (auto-submit ka hisaab
// // wahi rahega), aur saath mein photo wala incident bhi banega (Incidents tab ke liye).
// const PHOTO_ALERT_TYPES = ["NO_FACE", "CAMERA_OFF"];

// /* ============================================================
//    HELPERS
//    ============================================================ */

// // Alert ke saath photo na aaye to live camera preview se frame le leta hai
// function captureFrame() {
//   try {
//     const video = document.querySelector("video");

//     if (!video || !video.videoWidth) return null;

//     const scale = Math.min(1, 640 / video.videoWidth);
//     const canvas = document.createElement("canvas");

//     canvas.width = Math.round(video.videoWidth * scale);
//     canvas.height = Math.round(video.videoHeight * scale);

//     canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

//     return canvas.toDataURL("image/jpeg", 0.7);
//   } catch {
//     return null;
//   }
// }

// // JWT se user_id nikalta hai (sirf draft ki key banane ke liye).
// function tokenUserId(token) {
//   try {
//     const payload = token
//       .split(".")[1]
//       .replace(/-/g, "+")
//       .replace(/_/g, "/");

//     return JSON.parse(atob(payload)).user_id ?? "anon";
//   } catch {
//     return "anon";
//   }
// }

// function readDrafts(key) {
//   try {
//     const raw = localStorage.getItem(key);
//     const parsed = raw ? JSON.parse(raw) : {};

//     return parsed && typeof parsed === "object" ? parsed : {};
//   } catch {
//     return {};
//   }
// }

// function tabSwitchMessage(data) {
//   const count = data.tab_switch_count ?? 0;
//   const max = data.max_switches ?? DEFAULT_MAX_SWITCHES;
//   const left = max - count;

//   return (
//     `Tab switch detected (${count} of ${max} allowed). ` +
//     (left > 0
//       ? `${left} more ${
//           left === 1 ? "switch is" : "switches are"
//         } allowed. After that your test will be FROZEN until your teacher unlocks it.`
//       : "The next switch will FREEZE your test until your teacher unlocks it.")
//   );
// }

// function tabSwitchLevel(data) {
//   const left =
//     (data.max_switches ?? DEFAULT_MAX_SWITCHES) -
//     (data.tab_switch_count ?? 0);

//   return left > 0 ? "warn" : "danger";
// }

// function endedMessage(data) {
//   return (
//     data?.freeze_reason ||
//     "Your teacher ended your test after reviewing suspicious activity."
//   );
// }

// function pickSession(data) {
//   return {
//     tab_switch_count: data?.tab_switch_count ?? 0,
//     max_switches: data?.max_switches ?? DEFAULT_MAX_SWITCHES,
//     freeze_reason: data?.freeze_reason || "",
//   };
// }

// function StudentTestPage({ test, onBack, onLogout }) {
//   const token = localStorage.getItem("codeshield_token");
//   const testId = test?.contest_id;
//   const draftKey = `codeshield_drafts_${testId}_${tokenUserId(token)}`;

//   const [problems, setProblems] = useState([]);
//   const [selectedProblem, setSelectedProblem] = useState(null);
//   const [codes, setCodes] = useState(() => readDrafts(draftKey));
//   const [visibleTestCases, setVisibleTestCases] = useState([]);
//   const [loadingProblems, setLoadingProblems] = useState(true);
//   const [loadingTestCases, setLoadingTestCases] = useState(false);
//   const [error, setError] = useState("");
//   const [language, setLanguage] = useState("cpp");
//   const [timeLeft, setTimeLeft] = useState(null);
//   const [executionResult, setExecutionResult] = useState(null);
//   const [executionLoading, setExecutionLoading] = useState(false);
//   const [submissionId, setSubmissionId] = useState(null);
//   const [attempt, setAttempt] = useState(null);
//   const [attemptLoading, setAttemptLoading] = useState(true);
//   const [finalizing, setFinalizing] = useState(false);
//   const [finalized, setFinalized] = useState(false);
//   const [attemptedProblems, setAttemptedProblems] = useState({});
//   const [elapsedByProblem, setElapsedByProblem] = useState({});
//   const [editorFontSize, setEditorFontSize] = useState(14);

//   // Proctoring
//   const [frozen, setFrozen] = useState(false);
//   const [session, setSession] = useState({
//     tab_switch_count: 0,
//     max_switches: DEFAULT_MAX_SWITCHES,
//     freeze_reason: "",
//   });
//   const [warning, setWarning] = useState("");
//   const [warningType, setWarningType] = useState("warn");

//   const activityTimerRef = useRef(null);
//   const selectedProblemRef = useRef(null);
//   const lastActivityRef = useRef(Date.now());
//   const finalizedRef = useRef(false);

//   const frozenRef = useRef(false);
//   const suppressRef = useRef(false);
//   const lastSwitchRef = useRef(0);
//   const warningTimerRef = useRef(null);
//   const autoSubmitRef = useRef(null);

//   const authHeaders = useMemo(
//     () => ({
//       Authorization: `Bearer ${token || ""}`,
//       "Content-Type": "application/json",
//     }),
//     [token]
//   );

//   const getDefaultCode = useCallback((lang = language) => {
//     if (lang === "cpp") {
//       return `#include <iostream>
// #include <vector>
// #include <string>
// using namespace std;

// int main() {
//     // Write your solution here
//     return 0;
// }`;
//     }

//     if (lang === "java") {
//       return `import java.util.*;

// public class Main {
//     public static void main(String[] args) {
//         // Write your solution here
//     }
// }`;
//     }

//     return `# Write your solution here
// `;
//   }, [language]);

//   const testStatus = useMemo(() => {
//     if (!test) return "Unavailable";

//     const now = Date.now();
//     const start = test.start_time
//       ? new Date(test.start_time).getTime()
//       : 0;
//     const end = test.end_time
//       ? new Date(test.end_time).getTime()
//       : Infinity;

//     if (now < start) return "Upcoming";
//     if (now >= end) return "Ended";
//     return "Active";
//   }, [test]);

//   const formatTime = useCallback((milliseconds) => {
//     if (milliseconds == null || milliseconds <= 0) {
//       return "00:00:00";
//     }

//     const totalSeconds = Math.floor(milliseconds / 1000);
//     const hours = Math.floor(totalSeconds / 3600);
//     const minutes = Math.floor((totalSeconds % 3600) / 60);
//     const seconds = totalSeconds % 60;

//     return [hours, minutes, seconds]
//       .map((value) => String(value).padStart(2, "0"))
//       .join(":");
//   }, []);

//   /* ============================================================
//      PROCTORING: FREEZE / SESSION
//      ============================================================ */

//   // Test freeze ho gaya: screen par ka content hata do.
//   const enterFrozen = useCallback((data) => {
//     if (data) {
//       setSession((previous) => ({ ...previous, ...pickSession(data) }));
//     }

//     frozenRef.current = true;
//     setFrozen(true);
//     setProblems([]);
//     setSelectedProblem(null);
//     setVisibleTestCases([]);
//     setExecutionResult(null);
//     setWarning("");
//   }, []);

//   const fetchSession = useCallback(async () => {
//     if (!testId || !token) return null;

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/session`,
//         { method: "GET", headers: authHeaders }
//       );

//       const data = await response.json().catch(() => ({}));

//       return response.ok ? data : null;
//     } catch {
//       return null;
//     }
//   }, [testId, token, authHeaders]);

//   const showWarning = useCallback((message, type = "warn") => {
//     setWarning(message);
//     setWarningType(type);

//     if (warningTimerRef.current) {
//       clearTimeout(warningTimerRef.current);
//     }

//     warningTimerRef.current = setTimeout(() => setWarning(""), 10000);
//   }, []);

//   // Camera alert: sirf teacher ko jata hai. Student ko koi warning nahi,
//   // test rukta bhi nahi.
//   const reportGaze = useCallback(async ({ type, durationMs, snapshot, photo }) => {
//     if (finalizedRef.current || frozenRef.current || !testId) return;

//     const isIncident = INCIDENT_TYPES.includes(type);

//     // Face not visible / camera off: gaze-event bhi (neeche) aur photo wala
//     // incident bhi (yahan). count:false = dobara gina nahi jata.
//     if (PHOTO_ALERT_TYPES.includes(type)) {
//       fetch(`${API_BASE}/api/tests/${testId}/incident`, {
//         method: "POST",
//         headers: authHeaders,
//         body: JSON.stringify({
//           kind: type,
//           photo: snapshot || photo || captureFrame(),
//           count: false,
//         }),
//       }).catch(() => {});
//     }

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/${isIncident ? "incident" : "gaze-event"}`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify(
//             isIncident
//               ? { kind: type, photo: snapshot || photo || null }
//               : { event_type: type, duration_ms: durationMs }
//           ),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) return;

//       setSession((previous) => ({ ...previous, ...pickSession(data) }));

//       // Teacher ne is dauran test end ya freeze kar diya ho
//       if (data.ended) {
//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       if (data.status === "frozen") {
//         enterFrozen(data);
//       }
//     } catch (err) {
//       console.warn("Gaze report failed:", err);
//     }
//   }, [testId, authHeaders, enterFrozen]);

//   // Camera permission popup khulne par browser blur bhejta hai;
//   // use tab switch na ginna.
//   const handleCameraStarting = useCallback((starting) => {
//     suppressRef.current = starting;

//     if (!starting) {
//       lastSwitchRef.current = Date.now();
//     }
//   }, []);

//   // Face verification (identity check) API
//   const identityApi = useMemo(() => {
//     const call = async (method, body) => {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/identity`,
//         {
//           method,
//           headers: authHeaders,
//           body: body ? JSON.stringify(body) : undefined,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Identity request failed.");
//       }

//       return data;
//     };

//     return {
//       getStatus: () => call("GET"),
//       submit: (payload) => call("POST", payload),
//     };
//   }, [testId, authHeaders]);

//   // confirm() / alert() khulne par browser blur event bhejta hai;
//   // usse tab switch na ginne ke liye.
//   const withSuppressed = (callback) => {
//     suppressRef.current = true;

//     try {
//       return callback();
//     } finally {
//       lastSwitchRef.current = Date.now();

//       setTimeout(() => {
//         suppressRef.current = false;
//       }, 1500);
//     }
//   };

//   const handleLogout = () => {
//     if (typeof onLogout === "function") {
//       onLogout();
//       return;
//     }

//     localStorage.removeItem("codeshield_token");
//     window.location.reload();
//   };

//   /* ============================================================
//      TEST ATTEMPT / PROBLEMS
//      ============================================================ */

//   // Start or resume the student's single attempt for this test.
//   const startAttempt = useCallback(async () => {
//     if (!testId || !token) {
//       setAttemptLoading(false);
//       if (!token) setError("Your session has expired. Please log in again.");
//       return null;
//     }

//     try {
//       setAttemptLoading(true);

//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/start`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({}),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Could not start the test attempt.");
//       }

//       setAttempt(data.attempt || data);
//       return data.attempt || data;
//     } catch (err) {
//       console.error("Start attempt error:", err);
//       setError(err.message || "Could not start the test attempt.");
//       return null;
//     } finally {
//       setAttemptLoading(false);
//     }
//   }, [testId, token, authHeaders]);

//   const loadProblems = useCallback(async () => {
//     if (!testId || !token) {
//       setLoadingProblems(false);
//       if (!token) setError("Please log in again to continue.");
//       return;
//     }

//     try {
//       setLoadingProblems(true);
//       setError("");

//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/problems`,
//         {
//           method: "GET",
//           headers: authHeaders,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       // 423 = test frozen
//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || "Failed to load problems.");
//       }

//       const loadedProblems = data.problems || [];
//       setProblems(loadedProblems);

//       setSelectedProblem((current) => {
//         if (
//           current &&
//           loadedProblems.some(
//             (problem) => problem.problem_id === current.problem_id
//           )
//         ) {
//           return current;
//         }

//         return loadedProblems[0] || null;
//       });
//     } catch (err) {
//       console.error("Problem loading error:", err);
//       setError(err.message || "Failed to load problems.");
//     } finally {
//       setLoadingProblems(false);
//     }
//   }, [testId, token, authHeaders, enterFrozen]);

//   const loadVisibleTestCases = useCallback(async (problemId) => {
//     if (!problemId || !token) return;

//     try {
//       setLoadingTestCases(true);

//       const response = await fetch(
//         `${API_BASE}/api/problems/${problemId}/testcases`,
//         {
//           method: "GET",
//           headers: authHeaders,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Failed to load test cases.");
//       }

//       setVisibleTestCases(data.testcases || []);
//     } catch (err) {
//       console.error("Visible testcase error:", err);
//       setVisibleTestCases([]);
//     } finally {
//       setLoadingTestCases(false);
//     }
//   }, [token, authHeaders]);


//   useEffect(() => {
//     let cancelled = false;

//     async function initialise() {
//       setProblems([]);
//       setSelectedProblem(null);
//       setCodes(readDrafts(draftKey));
//       setVisibleTestCases([]);
//       setAttempt(null);
//       setAttemptedProblems({});
//       setElapsedByProblem({});
//       setFinalized(false);
//       finalizedRef.current = false;
//       setFinalizing(false);
//       setExecutionResult(null);
//       setSubmissionId(null);
//       setFrozen(false);
//       frozenRef.current = false;
//       setWarning("");

//       if (!testId) {
//         setLoadingProblems(false);
//         setAttemptLoading(false);
//         setError("Test information is missing.");
//         return;
//       }

//       const attemptData = await startAttempt();
//       if (cancelled) return;

//       if (!attemptData) {
//         setLoadingProblems(false);
//         return;
//       }

//       // Refresh / dobara login ke baad bhi freeze bana rahe
//       const sessionData = await fetchSession();
//       if (cancelled) return;

//       // Teacher ne test end kar diya tha
//       if (sessionData?.ended) {
//         setLoadingProblems(false);
//         setTimeout(() => {
//           autoSubmitRef.current?.(true, endedMessage(sessionData));
//         }, 0);
//         return;
//       }

//       if (sessionData?.status === "frozen") {
//         enterFrozen(sessionData);
//         setLoadingProblems(false);
//         return;
//       }

//       if (sessionData) {
//         setSession((previous) => ({ ...previous, ...pickSession(sessionData) }));
//       }

//       await loadProblems();
//     }

//     initialise();

//     return () => {
//       cancelled = true;
//     };
//   }, [testId, draftKey, startAttempt, loadProblems, fetchSession, enterFrozen]);

//   useEffect(() => {
//     selectedProblemRef.current = selectedProblem;
//   }, [selectedProblem]);

//   useEffect(() => {
//     if (!selectedProblem) {
//       setVisibleTestCases([]);
//       return;
//     }

//     loadVisibleTestCases(selectedProblem.problem_id);

//     setCodes((previous) => {
//       if (previous[selectedProblem.problem_id] !== undefined) {
//         return previous;
//       }

//       return {
//         ...previous,
//         [selectedProblem.problem_id]: getDefaultCode(),
//       };
//     });

//     setExecutionResult(null);
//     setSubmissionId(null);
//     lastActivityRef.current = Date.now();
//   }, [selectedProblem, loadVisibleTestCases, getDefaultCode]);

//   // Code ka draft isi browser mein save (refresh / freeze ke baad bhi bacha rahe)
//   useEffect(() => {
//     if (!testId || finalizedRef.current) return;

//     try {
//       localStorage.setItem(draftKey, JSON.stringify(codes));
//     } catch {
//       /* storage full / blocked: ignore */
//     }
//   }, [codes, testId, draftKey, finalized]);


//   useEffect(() => {
//     if (!testId || !selectedProblem || finalized || !attempt || frozen) return;

//     const problemId = selectedProblem.problem_id;
//     lastActivityRef.current = Date.now();

//     const sendActivity = async () => {
//       const now = Date.now();
//       const elapsed = Math.max(
//         0,
//         Math.floor((now - lastActivityRef.current) / 1000)
//       );

//       lastActivityRef.current = now;

//       if (elapsed > 0) {
//         setElapsedByProblem((previous) => ({
//           ...previous,
//           [problemId]: (previous[problemId] || 0) + elapsed,
//         }));
//       }

//       try {
//         const response = await fetch(
//           `${API_BASE}/api/tests/${testId}/activity`,
//           {
//             method: "POST",
//             headers: authHeaders,
//             body: JSON.stringify({
//               problem_id: problemId,
//               event_type: "heartbeat",
//               elapsed_seconds: elapsed,
//             }),
//           }
//         );

//         if (!response.ok) {
//           const data = await response.json().catch(() => ({}));
//           console.warn("Activity update failed:", data.error);
//         }
//       } catch (err) {
//         console.warn("Activity heartbeat failed:", err);
//       }
//     };

//     activityTimerRef.current = setInterval(sendActivity, 15000);

//     return () => {
//       if (activityTimerRef.current) {
//         clearInterval(activityTimerRef.current);
//         activityTimerRef.current = null;
//       }


//       const elapsed = Math.max(
//         0,
//         Math.floor((Date.now() - lastActivityRef.current) / 1000)
//       );

//       if (elapsed > 0) {
//         setElapsedByProblem((previous) => ({
//           ...previous,
//           [problemId]: (previous[problemId] || 0) + elapsed,
//         }));
//       }
//     };
//   }, [testId, selectedProblem, finalized, attempt, authHeaders, frozen]);

//   useEffect(() => {
//     if (!test?.end_time) {
//       setTimeLeft(null);
//       return;
//     }

//     const updateTimer = () => {
//       const remaining = new Date(test.end_time).getTime() - Date.now();
//       setTimeLeft(Math.max(0, remaining));
//     };

//     updateTimer();
//     const interval = setInterval(updateTimer, 1000);

//     return () => clearInterval(interval);
//   }, [test?.end_time]);

//   /* ============================================================
//      PROCTORING: TAB-SWITCH MONITORING
//      6 switch tak sirf warning. 7th switch par test freeze.
//      ============================================================ */

//   const monitoring =
//     attempt?.status === "in_progress" && !finalized && !frozen;

//   useEffect(() => {
//     if (!monitoring || !testId || !token) return undefined;

//     const report = async (reason) => {
//       if (
//         finalizedRef.current ||
//         frozenRef.current ||
//         suppressRef.current
//       ) {
//         return;
//       }

//       // visibilitychange + blur ek hi switch par dono aate hain
//       const now = Date.now();
//       if (now - lastSwitchRef.current < 2000) return;
//       lastSwitchRef.current = now;

//       try {
//         const response = await fetch(
//           `${API_BASE}/api/tests/${testId}/tab-switch`,
//           {
//             method: "POST",
//             headers: authHeaders,
//             body: JSON.stringify({ reason }),
//           }
//         );

//         const data = await response.json().catch(() => ({}));

//         if (response.status === 423) {
//           enterFrozen(data);
//           return;
//         }

//         if (!response.ok) return;

//         setSession((previous) => ({ ...previous, ...pickSession(data) }));

//         if (data.ended) {
//           autoSubmitRef.current?.(true, endedMessage(data));
//           return;
//         }

//         if (data.status === "frozen") {
//           enterFrozen(data);
//           return;
//         }

//         if (data.counted) {
//           showWarning(tabSwitchMessage(data), tabSwitchLevel(data));
//         }
//       } catch (err) {
//         console.warn("Tab-switch report failed:", err);
//       }
//     };

//     const onVisibility = () => {
//       if (document.visibilityState === "hidden") {
//         report("tab_hidden");
//       }
//     };

//     const onBlur = () => report("window_blur");

//     document.addEventListener("visibilitychange", onVisibility);
//     window.addEventListener("blur", onBlur);

//     return () => {
//       document.removeEventListener("visibilitychange", onVisibility);
//       window.removeEventListener("blur", onBlur);
//     };
//   }, [monitoring, testId, token, authHeaders, enterFrozen, showWarning]);

//   // Teacher ne test freeze ya end kiya ho to student ko pata chale
//   useEffect(() => {
//     if (!monitoring || !testId || !token) return undefined;

//     const timer = setInterval(async () => {
//       if (finalizedRef.current || frozenRef.current) return;

//       const data = await fetchSession();

//       if (!data) return;

//       if (data.ended) {
//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       if (data.status === "frozen") {
//         enterFrozen(data);
//       }
//     }, SESSION_POLL_MS);

//     return () => clearInterval(timer);
//   }, [monitoring, testId, token, fetchSession, enterFrozen]);

//   // Freeze ke dauran teacher ke unlock / end ka intezaar
//   useEffect(() => {
//     if (!frozen || finalized) return undefined;

//     const timer = setInterval(async () => {
//       const data = await fetchSession();

//       if (!data) return;

//       // Teacher ne "End test" kiya: test submit ho jata hai
//       if (data.ended) {
//         frozenRef.current = false;
//         setFrozen(false);

//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       // Teacher ne unlock kiya
//       if (data.status !== "frozen") {
//         frozenRef.current = false;
//         lastSwitchRef.current = Date.now();

//         setSession((previous) => ({ ...previous, ...pickSession(data) }));
//         setFrozen(false);

//         showWarning(
//           "Your teacher reviewed the activity and allowed you to continue the test.",
//           "info"
//         );

//         await loadProblems();
//       }
//     }, 5000);

//     return () => clearInterval(timer);
//   }, [frozen, finalized, fetchSession, loadProblems, showWarning]);

//   useEffect(() => {
//     return () => {
//       if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
//     };
//   }, []);

//   /* ============================================================
//      EDITOR HANDLERS
//      ============================================================ */

//   const handleProblemSelect = (problem) => {
//     if (finalized || finalizing || frozen) return;
//     setSelectedProblem(problem);
//   };

//   const handleCodeChange = (value) => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;

//     setCodes((previous) => ({
//       ...previous,
//       [selectedProblem.problem_id]: value,
//     }));
//   };

//   const resetToDefaultCode = () => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;
//     if (
//       withSuppressed(() =>
//         window.confirm(
//           "Reset code to the default starter template for this problem? Any unsaved edits will be replaced."
//         )
//       )
//     ) {
//       const def = getDefaultCode(language);
//       handleCodeChange(def);
//     }
//   };

//   const handleLanguageChange = (value) => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;

//     setLanguage(value);
//     setCodes((previous) => ({
//       ...previous,
//       [selectedProblem.problem_id]:
//         getDefaultCode(value),
//     }));
//     setExecutionResult(null);
//   };

//   const pollResult = async (id) => {
//     if (!id) {
//       setExecutionLoading(false);
//       return;
//     }

//     let attempts = 0;
//     const maxAttempts = 40;

//     const checkResult = async () => {
//       try {
//         const response = await fetch(`${API_BASE}/result/${id}`, {
//           method: "GET",
//           headers: authHeaders,
//         });

//         const data = await response.json().catch(() => ({}));

//         if (!response.ok) {
//           throw new Error(data.error || "Failed to get execution result.");
//         }

//         setExecutionResult(data);

//         if (data.status === "completed") {
//           setExecutionLoading(false);
//           return;
//         }

//         attempts += 1;

//         if (attempts >= maxAttempts) {
//           setExecutionResult({
//             status: "completed",
//             verdict: "TIME LIMIT EXCEEDED",
//             output: "Result polling timed out. Check the submission later.",
//           });
//           setExecutionLoading(false);
//           return;
//         }

//         setTimeout(checkResult, 500);
//       } catch (err) {
//         console.error("Result polling error:", err);
//         setExecutionResult({
//           status: "completed",
//           verdict: "SYSTEM ERROR",
//           output: err.message,
//         });
//         setExecutionLoading(false);
//       }
//     };

//     await checkResult();
//   };

//   const postSubmissionActivity = async (id, problemId) => {
//     if (!testId || !id || !problemId) return;

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/record-submission`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({
//             submission_id: id,
//             problem_id: problemId,
//           }),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         console.warn("Could not record attempt submission:", data.error);
//       }
//     } catch (err) {
//       console.warn("Record submission request failed:", err);
//     }
//   };

//   const submitCodeToBackend = async (endpoint, actionLabel) => {
//     if (
//       !selectedProblem ||
//       executionLoading ||
//       finalized ||
//       finalizing ||
//       frozen
//     ) {
//       return;
//     }

//     if (!token) {
//       setError("Your session has expired. Please log in again.");
//       return;
//     }

//     if (testStatus !== "Active") {
//       setError(
//         testStatus === "Upcoming"
//           ? "This test has not started yet."
//           : "This test has ended."
//       );
//       return;
//     }

//     const problemId = selectedProblem.problem_id;
//     const code = codes[problemId] ?? getDefaultCode();

//     if (!code.trim()) {
//       setError("Code cannot be empty.");
//       return;
//     }

//     setError("");
//     setExecutionLoading(true);
//     setExecutionResult({
//       status: "queued",
//       verdict: null,
//       output: `${actionLabel} sent for execution...`,
//     });
//     setSubmissionId(null);

//     try {
//       const response = await fetch(`${API_BASE}${endpoint}`, {
//         method: "POST",
//         headers: authHeaders,
//         body: JSON.stringify({
//           code,
//           problem_id: problemId,
//           language,
//         }),
//       });

//       const data = await response.json().catch(() => ({}));

//       // 423 = teacher ne test freeze kiya hua hai
//       if (response.status === 423) {
//         setExecutionLoading(false);
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || `Failed to ${actionLabel.toLowerCase()}.`);
//       }

//       const id = data.run_id || data.submission_id;

//       if (!id) {
//         throw new Error("Backend did not return a run or submission ID.");
//       }

//       setSubmissionId(id);
//       setAttemptedProblems((previous) => ({
//         ...previous,
//         [problemId]: true,
//       }));

//       if (endpoint === "/submit") {
//         await postSubmissionActivity(id, problemId);
//       }

//       setExecutionResult({
//         status: "queued",
//         verdict: null,
//         output: "Your code is waiting for execution...",
//       });

//       await pollResult(id);
//     } catch (err) {
//       console.error(`${actionLabel} error:`, err);
//       setExecutionResult({
//         status: "completed",
//         verdict: "SYSTEM ERROR",
//         output: err.message,
//       });
//       setExecutionLoading(false);
//     }
//   };

//   const handleRunCode = () => submitCodeToBackend("/run", "Run Code");

//   const handleSubmit = () => submitCodeToBackend("/submit", "Submit");


//   // automatic = true: timer khatam hua ya teacher ne test end kiya.
//   // endedReason: teacher ke end karne ka message.
//   const handleFinalSubmit = async (automatic = false, endedReason = "") => {
//     if (finalizedRef.current || finalizing || !testId) return;

//     const confirmed = automatic
//       ? true
//       : withSuppressed(() =>
//           window.confirm(
//             "Are you sure you want to submit the test? You cannot continue editing after final submission."
//           )
//         );

//     if (!confirmed) return;

//     setFinalizing(true);
//     setError("");

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/final-submit`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({
//             status: automatic ? "auto_submitted" : "submitted",
//           }),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || "Could not finalize the test.");
//       }

//       finalizedRef.current = true;
//       setFinalized(true);

//       // Submit ho gaya, ab draft ki zarurat nahi
//       try {
//         localStorage.removeItem(draftKey);
//       } catch {
//         /* ignore */
//       }

//       // Test successfully submitted
//       if (activityTimerRef.current) {
//         clearInterval(activityTimerRef.current);
//         activityTimerRef.current = null;
//       }

//       setTimeout(() => {
//         if (typeof onBack === "function") {
//           onBack(true);
//         }
//       }, 1500);

//       setAttempt((previous) => ({
//         ...(previous || {}),
//         ...(data.attempt || {}),
//         status: automatic ? "auto_submitted" : "submitted",
//       }));

//       withSuppressed(() =>
//         window.alert(
//           endedReason
//             ? endedReason
//             : automatic
//               ? "Time is over. Your test has been auto-submitted."
//               : "Your test has been submitted successfully."
//         )
//       );
//     } catch (err) {
//       console.error("Final submission error:", err);
//       setError(err.message || "Could not finalize the test.");
//     } finally {
//       setFinalizing(false);
//     }
//   };

//   autoSubmitRef.current = handleFinalSubmit;

//   // Auto-submit sirf tab, jab timer zero ho jaye.
//   useEffect(() => {
//     if (
//       timeLeft === 0 &&
//       !finalized &&
//       !finalizing &&
//       attempt
//     ) {
//       handleFinalSubmit(true);
//     }
//     // handleFinalSubmit is intentionally invoked only when the timer expires.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [timeLeft, finalized, finalizing, attempt]);

//   const attemptedCount = Object.keys(attemptedProblems).filter(
//     (key) => attemptedProblems[key]
//   ).length;

//   const switchMax = session.max_switches;

//   if (loadingProblems || attemptLoading) {
//     return (
//       <div className="student-test-loading">
//         <Loader2 size={28} className="spin" />
//         <span>Loading test...</span>
//       </div>
//     );
//   }

//   return (
//     <div className="student-test-page">
//       <header className="student-test-topbar">
//         <div className="student-test-brand">
//           <button
//             className="student-back-btn"
//             onClick={() => onBack && onBack(false)}
//             disabled={finalizing}
//             aria-label="Go back"
//           >
//             <ArrowLeft size={18} />
//           </button>

//           <div>
//             <div className="student-brand-name">CodeShield</div>
//             <div className="student-brand-subtitle">
//               Student Workspace
//             </div>
//           </div>
//         </div>

//         <div className="student-test-title">
//           <span>{test?.title || "Coding Test"}</span>
//           <span
//             className={
//               testStatus === "Active"
//                 ? "student-status active"
//                 : "student-status"
//             }
//           >
//             {finalized ? "Submitted" : testStatus}
//           </span>
//         </div>

//         <div className="student-topbar-right">
//           <div
//             className={`switch-chip ${
//               session.tab_switch_count >= switchMax
//                 ? "danger"
//                 : session.tab_switch_count > 0
//                   ? "warn"
//                   : ""
//             }`}
//             title={`You can switch tabs ${switchMax} times. After that your test is frozen until your teacher unlocks it.`}
//           >
//             <AlertTriangle size={14} />
//             Tab switches {session.tab_switch_count}/{switchMax}
//           </div>

//           <div className="student-timer">
//             <Clock3 size={17} />
//             <div>
//               <span>Time Remaining</span>
//               <strong>{formatTime(timeLeft)}</strong>
//             </div>
//           </div>
//         </div>
//       </header>

//       {warning && (
//         <div
//           className={`proctor-warning ${
//             warningType === "info" ? "proctor-info" : ""
//           }`}
//           role="alert"
//         >
//           <AlertTriangle size={16} />
//           {warning}
//         </div>
//       )}

//       {error && (
//         <div className="student-test-error" role="alert">
//           {error}
//         </div>
//       )}

//       {finalized && (
//         <div className="student-test-error">
//           Your test has been submitted. Editing and new submissions are disabled.
//         </div>
//       )}

//       <div className="student-test-body">
//         <aside className="student-problem-sidebar">
//           <div className="student-sidebar-header">
//             <div>
//               <span>ASSESSMENT</span>
//               <h2>Problems</h2>
//             </div>
//             <div className="problem-count">{problems.length}</div>
//           </div>

//           <div className="student-problem-list">
//             {problems.length === 0 ? (
//               <div className="no-problems">
//                 No problems available.
//               </div>
//             ) : (
//               problems.map((problem, index) => (
//                 <button
//                   key={problem.problem_id}
//                   className={
//                     selectedProblem?.problem_id === problem.problem_id
//                       ? "student-problem-item selected"
//                       : "student-problem-item"
//                   }
//                   onClick={() => handleProblemSelect(problem)}
//                   disabled={finalized || finalizing}
//                 >
//                   <div className="problem-number">{index + 1}</div>

//                   <div className="problem-item-content">
//                     <strong>{problem.title}</strong>
//                     <div className="problem-meta">
//                       <span
//                         className={`difficulty ${String(
//                           problem.difficulty || "Easy"
//                         ).toLowerCase()}`}
//                       >
//                         {problem.difficulty || "Easy"}
//                       </span>
//                       <span>{problem.time_limit_ms ?? 1000} ms</span>
//                     </div>
//                     {attemptedProblems[problem.problem_id] && (
//                       <small>Attempted</small>
//                     )}
//                   </div>

//                   <ChevronRight size={17} className="problem-arrow" />
//                 </button>
//               ))
//             )}
//           </div>

//           <div className="student-sidebar-footer">
//             <div className="progress-label">
//               <span>Attempted</span>
//               <span>
//                 {attemptedCount} / {problems.length}
//               </span>
//             </div>
//             <div className="progress-track">
//               <div
//                 className="progress-fill"
//                 style={{
//                   width: `${
//                     problems.length
//                       ? (attemptedCount / problems.length) * 100
//                       : 0
//                   }%`,
//                 }}
//               />
//             </div>
//           </div>
//         </aside>

//         <main className="student-problem-panel">
//           {!selectedProblem ? (
//             <div className="empty-problem">
//               <FileText size={40} />
//               <h2>Select a problem</h2>
//               <p>
//                 Choose a problem from the left panel to start solving.
//               </p>
//             </div>
//           ) : (
//             <>
//               <div className="problem-header">
//                 <div>
//                   <div className="problem-heading-row">
//                     <h1>{selectedProblem.title}</h1>
//                     <span
//                       className={`difficulty large ${String(
//                         selectedProblem.difficulty || "Easy"
//                       ).toLowerCase()}`}
//                     >
//                       {selectedProblem.difficulty || "Easy"}
//                     </span>
//                   </div>
//                   <p>
//                     Problem #
//                     {problems.findIndex(
//                       (problem) =>
//                         problem.problem_id === selectedProblem.problem_id
//                     ) + 1}
//                   </p>
//                 </div>
//               </div>

//               <section className="problem-section">
//                 <div className="section-heading">
//                   <FileText size={17} />
//                   <h2>Problem Statement</h2>
//                 </div>
//                 <div className="problem-statement">
//                   {selectedProblem.statement}
//                 </div>
//               </section>

//               <section className="problem-limits">
//                 <div className="limit-card">
//                   <Clock3 size={18} />
//                   <div>
//                     <span>Time Limit</span>
//                     <strong>
//                       {selectedProblem.time_limit_ms ?? 1000} ms
//                     </strong>
//                   </div>
//                 </div>

//                 <div className="limit-card">
//                   <MemoryStick size={18} />
//                   <div>
//                     <span>Memory Limit</span>
//                     <strong>
//                       {selectedProblem.memory_limit_mb ?? 256} MB
//                     </strong>
//                   </div>
//                 </div>
//               </section>

//               <section className="problem-section">
//                 <div className="section-heading">
//                   <Eye size={17} />
//                   <h2>Examples</h2>
//                   <span className="example-count">
//                     {visibleTestCases.length}
//                   </span>
//                 </div>

//                 {loadingTestCases ? (
//                   <div className="examples-loading">
//                     <Loader2 size={17} className="spin" />
//                     Loading examples...
//                   </div>
//                 ) : visibleTestCases.length === 0 ? (
//                   <div className="no-examples">
//                     No visible examples available for this problem.
//                   </div>
//                 ) : (
//                   <div className="examples-list">
//                     {visibleTestCases.map((testCase, index) => (
//                       <div
//                         className="example-card"
//                         key={testCase.testcase_id ?? index}
//                       >
//                         <div className="example-header">
//                           <span>Example {index + 1}</span>
//                           <CheckCircle2 size={15} />
//                         </div>

//                         <div className="example-grid">
//                           <div>
//                             <label>Input</label>
//                             <pre>{testCase.input}</pre>
//                           </div>
//                           <div>
//                             <label>Expected Output</label>
//                             <pre>{testCase.expected_output}</pre>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </section>
//             </>
//           )}
//         </main>

//         <section className="student-editor-panel">
//           <div className="editor-header">
//             <div className="editor-title">
//               <Code2 size={18} />
//               <span>Code Editor</span>
//             </div>

//             <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//               <div style={{ display: "flex", gap: "3px" }}>
//                 <button
//                   type="button"
//                   className="editor-tool-btn"
//                   onClick={() => setEditorFontSize((s) => Math.max(11, s - 1))}
//                   title="Decrease font size"
//                 >
//                   A-
//                 </button>
//                 <button
//                   type="button"
//                   className="editor-tool-btn"
//                   onClick={() => setEditorFontSize((s) => Math.min(22, s + 1))}
//                   title="Increase font size"
//                 >
//                   A+
//                 </button>
//               </div>

//               <button
//                 type="button"
//                 className="editor-tool-btn"
//                 onClick={resetToDefaultCode}
//                 title="Reset code to default template"
//                 disabled={finalized || finalizing || frozen}
//               >
//                 <RotateCcw size={13} /> Reset
//               </button>

//               <select
//                 value={language}
//                 onChange={(event) => handleLanguageChange(event.target.value)}
//                 disabled={finalized || finalizing || executionLoading}
//               >
//                 <option value="cpp">C++</option>
//                 <option value="java">Java</option>
//                 <option value="python">Python</option>
//               </select>
//             </div>
//           </div>

//           <div className="editor-container">
//             <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
//               <div style={{ position: "absolute", inset: 0 }}>
//                 <Editor
//                   height="100%"
//                   theme="vs-dark"
//                   path={
//                     selectedProblem
//                       ? `problem-${selectedProblem.problem_id}.${language}`
//                       : "empty"
//                   }
//                   language={language}
//                   value={
//                     selectedProblem
//                       ? codes[selectedProblem.problem_id] ?? getDefaultCode()
//                       : ""
//                   }
//                   onChange={(value) => handleCodeChange(value ?? "")}
//                   loading={
//                     <div className="examples-loading">
//                       <Loader2 size={17} className="spin" /> Loading editor...
//                     </div>
//                   }
//                   options={{
//                     readOnly: !selectedProblem || finalized || finalizing || frozen,
//                     minimap: { enabled: false },
//                     fontSize: editorFontSize,
//                     tabSize: 4,
//                     automaticLayout: true,
//                     scrollBeyondLastLine: false,
//                     padding: { top: 14 },
//                     fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
//                   }}
//                 />
//               </div>
//             </div>
//           </div>

//           <div className="editor-footer">
//             <div className="editor-info">
//               <span>
//                 {language === "cpp"
//                   ? "C++17"
//                   : language === "java"
//                     ? "Java"
//                     : "Python 3"}
//               </span>
//               <span>Auto-save: Local</span>
//             </div>

//             <div className="editor-actions">
//               <button
//                 className="run-button"
//                 onClick={handleRunCode}
//                 disabled={
//                   !selectedProblem ||
//                   executionLoading ||
//                   finalized ||
//                   finalizing ||
//                   frozen
//                 }
//               >
//                 {executionLoading ? (
//                   <Loader2 size={16} className="spin" />
//                 ) : (
//                   <Play size={16} />
//                 )}
//                 {executionLoading ? "Running..." : "Run Code"}
//               </button>

//               <button
//                 className="submit-button"
//                 onClick={handleSubmit}
//                 disabled={
//                   !selectedProblem ||
//                   executionLoading ||
//                   finalized ||
//                   finalizing ||
//                   frozen
//                 }
//               >
//                 <Send size={16} />
//                 Submit
//               </button>
//             </div>
//           </div>

//           <div className="execution-result-panel">
//             <div className="execution-result-header">
//               <div>
//                 <strong>Execution Result</strong>
//                 {executionLoading && (
//                   <span className="execution-running">
//                     <Loader2 size={15} className="spin" />
//                     Running...
//                   </span>
//                 )}
//               </div>

//               {executionResult?.verdict && (
//                 <span
//                   className={`execution-verdict ${
//                     ["AC", "Accepted"].includes(executionResult.verdict)
//                       ? "success"
//                       : "failed"
//                   }`}
//                 >
//                   {executionResult.verdict}
//                 </span>
//               )}
//             </div>

//             <div className="execution-result-body">
//               {!executionResult ? (
//                 <div className="execution-empty">
//                   <Code2 size={22} />
//                   <span>Run your code to see the result.</span>
//                 </div>
//               ) : (
//                 <>
//                   <div className="execution-status">
//                     <span>Status</span>
//                     <strong>{executionResult.status}</strong>
//                   </div>

//                   {executionResult.execution_time_ms !== undefined && (
//                     <div className="execution-status">
//                       <span>Execution Time</span>
//                       <strong>
//                         {executionResult.execution_time_ms} ms
//                       </strong>
//                     </div>
//                   )}

//                   {executionResult.test_cases_total !== undefined && (
//                     <div className="execution-status">
//                       <span>Test Cases</span>
//                       <strong>
//                         {executionResult.test_cases_passed ?? 0}
//                         {" / "}
//                         {executionResult.test_cases_total}
//                       </strong>
//                     </div>
//                   )}

//                   <div className="execution-output">
//                     <div className="output-title">Output</div>
//                     <pre>
//                       {executionResult.output ||
//                         executionResult.stderr ||
//                         "No output"}
//                     </pre>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>

//           <div className="editor-footer">
//             <div className="editor-info">
//               <span>
//                 Questions attempted: {attemptedCount}/{problems.length}
//               </span>
//             </div>

//             <div className="editor-actions">
//               <button
//                 className="submit-button"
//                 onClick={() => handleFinalSubmit(false)}
//                 disabled={finalized || finalizing || !attempt || frozen}
//               >
//                 {finalizing && <Loader2 size={16} className="spin" />}
//                 {finalizing ? "Submitting Test..." : "Final Submit Test"}
//               </button>
//             </div>
//           </div>
//         </section>
//       </div>

//       {/* CAMERA MONITORING: consent + live preview. Alerts sirf teacher ko jaate hain. */}
//       <EyeMonitor
//         active={attempt?.status === "in_progress" && !finalized}
//         paused={frozen}
//         identity={identityApi}
//         onViolation={reportGaze}
//         onStartingChange={handleCameraStarting}
//       />

//       {/* FREEZE SCREEN: sirf Logout ka option */}
//       {frozen && !finalized && (
//         <div className="freeze-overlay" role="alertdialog" aria-modal="true">
//           <div className="freeze-card">
//             <div className="freeze-icon">
//               <Lock size={30} />
//             </div>

//             <h2>Your test is frozen</h2>

//             <p>
//               Your test is frozen. You cannot continue until your teacher
//               reviews it and approves.
//             </p>

//             <div className="freeze-reason">
//               {session.freeze_reason ||
//                 `You switched tabs more than ${switchMax} times.`}
//             </div>

//             <div className="freeze-waiting">
//               <Loader2 size={15} className="spin" />
//               Waiting for your teacher...
//             </div>

//             <div>
//               <button
//                 type="button"
//                 className="freeze-logout"
//                 onClick={handleLogout}
//               >
//                 <LogOut size={16} />
//                 Logout
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default StudentTestPage;

// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   AlertTriangle,
//   ArrowLeft,
//   Clock3,
//   Code2,
//   FileText,
//   Lock,
//   LogOut,
//   MemoryStick,
//   Play,
//   Send,
//   ChevronRight,
//   CheckCircle2,
//   Eye,
//   Loader2,
//   RotateCcw,
// } from "lucide-react";
// import EyeMonitor from "./EyeMonitor.jsx";
// import "./StudentTestPage.css";
// import "./Proctoring.css";
// import Editor from "@monaco-editor/react";

// const API_BASE = "http://localhost:5000";

// // Server MAX_TAB_SWITCHES bhejta hai; yeh sirf shuruaati default hai.
// // 6 switch tak allowed, 7th switch par test freeze.
// const DEFAULT_MAX_SWITCHES = 6;

// // Session status itne ms mein check hota hai (teacher ke freeze / end ke liye)
// const SESSION_POLL_MS = 10000;

// // Gambhir cases: photo teacher ko jati hai (student ko kuch nahi dikhta)
// const INCIDENT_TYPES = ["MULTI_FACE", "FACE_MISMATCH"];

// // Ye alert pehle jaise /gaze-event se bhi gine jayenge (auto-submit ka hisaab
// // wahi rahega), aur saath mein photo wala incident bhi banega (Incidents tab ke liye).
// const PHOTO_ALERT_TYPES = ["NO_FACE", "CAMERA_OFF"];

// /* ============================================================
//    HELPERS
//    ============================================================ */

// // Alert ke saath photo na aaye to live camera preview se frame le leta hai
// function captureFrame() {
//   try {
//     const video = document.querySelector("video");

//     if (!video || !video.videoWidth) return null;

//     const scale = Math.min(1, 640 / video.videoWidth);
//     const canvas = document.createElement("canvas");

//     canvas.width = Math.round(video.videoWidth * scale);
//     canvas.height = Math.round(video.videoHeight * scale);

//     canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

//     return canvas.toDataURL("image/jpeg", 0.7);
//   } catch {
//     return null;
//   }
// }

// // JWT se user_id nikalta hai (sirf draft ki key banane ke liye).
// function tokenUserId(token) {
//   try {
//     const payload = token
//       .split(".")[1]
//       .replace(/-/g, "+")
//       .replace(/_/g, "/");

//     return JSON.parse(atob(payload)).user_id ?? "anon";
//   } catch {
//     return "anon";
//   }
// }

// function readDrafts(key) {
//   try {
//     const raw = localStorage.getItem(key);
//     const parsed = raw ? JSON.parse(raw) : {};

//     return parsed && typeof parsed === "object" ? parsed : {};
//   } catch {
//     return {};
//   }
// }

// // Har (problem, language) ka apna code. Language badalne par code udta nahi.
// function codeKey(problemId, lang) {
//   return `${problemId}:${lang}`;
// }

// function readLanguage(key) {
//   try {
//     const value = localStorage.getItem(key);
//     return ["cpp", "java", "python"].includes(value) ? value : "cpp";
//   } catch {
//     return "cpp";
//   }
// }

// function tabSwitchMessage(data) {
//   const count = data.tab_switch_count ?? 0;
//   const max = data.max_switches ?? DEFAULT_MAX_SWITCHES;
//   const left = max - count;

//   return (
//     `Tab switch detected (${count} of ${max} allowed). ` +
//     (left > 0
//       ? `${left} more ${
//           left === 1 ? "switch is" : "switches are"
//         } allowed. After that your test will be FROZEN until your teacher unlocks it.`
//       : "The next switch will FREEZE your test until your teacher unlocks it.")
//   );
// }

// function tabSwitchLevel(data) {
//   const left =
//     (data.max_switches ?? DEFAULT_MAX_SWITCHES) -
//     (data.tab_switch_count ?? 0);

//   return left > 0 ? "warn" : "danger";
// }

// function endedMessage(data) {
//   return (
//     data?.freeze_reason ||
//     "Your teacher ended your test after reviewing suspicious activity."
//   );
// }

// function pickSession(data) {
//   return {
//     tab_switch_count: data?.tab_switch_count ?? 0,
//     max_switches: data?.max_switches ?? DEFAULT_MAX_SWITCHES,
//     freeze_reason: data?.freeze_reason || "",
//   };
// }

// function StudentTestPage({ test, onBack, onLogout }) {
//   const token = localStorage.getItem("codeshield_token");
//   const testId = test?.contest_id;
//   const draftKey = `codeshield_drafts_v2_${testId}_${tokenUserId(token)}`;
//   const languageKey = `codeshield_lang_${testId}_${tokenUserId(token)}`;

//   const [problems, setProblems] = useState([]);
//   const [selectedProblem, setSelectedProblem] = useState(null);
//   const [codes, setCodes] = useState(() => readDrafts(draftKey));
//   const [visibleTestCases, setVisibleTestCases] = useState([]);
//   const [loadingProblems, setLoadingProblems] = useState(true);
//   const [loadingTestCases, setLoadingTestCases] = useState(false);
//   const [error, setError] = useState("");
//   const [language, setLanguage] = useState(() => readLanguage(languageKey));
//   const [timeLeft, setTimeLeft] = useState(null);
//   const [executionResult, setExecutionResult] = useState(null);
//   const [executionLoading, setExecutionLoading] = useState(false);
//   const [submissionId, setSubmissionId] = useState(null);
//   const [attempt, setAttempt] = useState(null);
//   const [attemptLoading, setAttemptLoading] = useState(true);
//   const [finalizing, setFinalizing] = useState(false);
//   const [finalized, setFinalized] = useState(false);
//   const [attemptedProblems, setAttemptedProblems] = useState({});
//   const [elapsedByProblem, setElapsedByProblem] = useState({});
//   const [editorFontSize, setEditorFontSize] = useState(14);

//   // Proctoring
//   const [frozen, setFrozen] = useState(false);
//   const [session, setSession] = useState({
//     tab_switch_count: 0,
//     max_switches: DEFAULT_MAX_SWITCHES,
//     freeze_reason: "",
//   });
//   const [warning, setWarning] = useState("");
//   const [warningType, setWarningType] = useState("warn");

//   const activityTimerRef = useRef(null);
//   const selectedProblemRef = useRef(null);
//   const lastActivityRef = useRef(Date.now());
//   const finalizedRef = useRef(false);

//   const frozenRef = useRef(false);
//   const suppressRef = useRef(false);
//   const lastSwitchRef = useRef(0);
//   const warningTimerRef = useRef(null);
//   const autoSubmitRef = useRef(null);

//   const authHeaders = useMemo(
//     () => ({
//       Authorization: `Bearer ${token || ""}`,
//       "Content-Type": "application/json",
//     }),
//     [token]
//   );

//   const getDefaultCode = useCallback((lang = language) => {
//     if (lang === "cpp") {
//       return `#include <iostream>
// #include <vector>
// #include <string>
// using namespace std;

// int main() {
//     // Write your solution here
//     return 0;
// }`;
//     }

//     if (lang === "java") {
//       return `import java.util.*;

// public class Main {
//     public static void main(String[] args) {
//         // Write your solution here
//     }
// }`;
//     }

//     return `# Write your solution here
// `;
//   }, [language]);

//   const testStatus = useMemo(() => {
//     if (!test) return "Unavailable";

//     const now = Date.now();
//     const start = test.start_time
//       ? new Date(test.start_time).getTime()
//       : 0;
//     const end = test.end_time
//       ? new Date(test.end_time).getTime()
//       : Infinity;

//     if (now < start) return "Upcoming";
//     if (now >= end) return "Ended";
//     return "Active";
//   }, [test]);

//   const formatTime = useCallback((milliseconds) => {
//     if (milliseconds == null || milliseconds <= 0) {
//       return "00:00:00";
//     }

//     const totalSeconds = Math.floor(milliseconds / 1000);
//     const hours = Math.floor(totalSeconds / 3600);
//     const minutes = Math.floor((totalSeconds % 3600) / 60);
//     const seconds = totalSeconds % 60;

//     return [hours, minutes, seconds]
//       .map((value) => String(value).padStart(2, "0"))
//       .join(":");
//   }, []);

//   /* ============================================================
//      PROCTORING: FREEZE / SESSION
//      ============================================================ */

//   // Test freeze ho gaya: screen par ka content hata do.
//   const enterFrozen = useCallback((data) => {
//     if (data) {
//       setSession((previous) => ({ ...previous, ...pickSession(data) }));
//     }

//     frozenRef.current = true;
//     setFrozen(true);
//     setProblems([]);
//     setSelectedProblem(null);
//     setVisibleTestCases([]);
//     setExecutionResult(null);
//     setWarning("");
//   }, []);

//   const fetchSession = useCallback(async () => {
//     if (!testId || !token) return null;

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/session`,
//         { method: "GET", headers: authHeaders }
//       );

//       const data = await response.json().catch(() => ({}));

//       return response.ok ? data : null;
//     } catch {
//       return null;
//     }
//   }, [testId, token, authHeaders]);

//   const showWarning = useCallback((message, type = "warn") => {
//     setWarning(message);
//     setWarningType(type);

//     if (warningTimerRef.current) {
//       clearTimeout(warningTimerRef.current);
//     }

//     warningTimerRef.current = setTimeout(() => setWarning(""), 10000);
//   }, []);

//   // Camera alert: sirf teacher ko jata hai. Student ko koi warning nahi,
//   // test rukta bhi nahi.
//   const reportGaze = useCallback(async ({ type, durationMs, snapshot, photo }) => {
//     if (finalizedRef.current || frozenRef.current || !testId) return;

//     const isIncident = INCIDENT_TYPES.includes(type);

//     // Face not visible / camera off: gaze-event bhi (neeche) aur photo wala
//     // incident bhi (yahan). count:false = dobara gina nahi jata.
//     if (PHOTO_ALERT_TYPES.includes(type)) {
//       fetch(`${API_BASE}/api/tests/${testId}/incident`, {
//         method: "POST",
//         headers: authHeaders,
//         body: JSON.stringify({
//           kind: type,
//           photo: snapshot || photo || captureFrame(),
//           count: false,
//         }),
//       }).catch(() => {});
//     }

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/${isIncident ? "incident" : "gaze-event"}`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify(
//             isIncident
//               ? { kind: type, photo: snapshot || photo || null }
//               : { event_type: type, duration_ms: durationMs }
//           ),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) return;

//       setSession((previous) => ({ ...previous, ...pickSession(data) }));

//       // Teacher ne is dauran test end ya freeze kar diya ho
//       if (data.ended) {
//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       if (data.status === "frozen") {
//         enterFrozen(data);
//       }
//     } catch (err) {
//       console.warn("Gaze report failed:", err);
//     }
//   }, [testId, authHeaders, enterFrozen]);

//   // Camera permission popup khulne par browser blur bhejta hai;
//   // use tab switch na ginna.
//   const handleCameraStarting = useCallback((starting) => {
//     suppressRef.current = starting;

//     if (!starting) {
//       lastSwitchRef.current = Date.now();
//     }
//   }, []);

//   // Face verification (identity check) API
//   const identityApi = useMemo(() => {
//     const call = async (method, body) => {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/identity`,
//         {
//           method,
//           headers: authHeaders,
//           body: body ? JSON.stringify(body) : undefined,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Identity request failed.");
//       }

//       return data;
//     };

//     return {
//       getStatus: () => call("GET"),
//       submit: (payload) => call("POST", payload),
//     };
//   }, [testId, authHeaders]);

//   // confirm() / alert() khulne par browser blur event bhejta hai;
//   // usse tab switch na ginne ke liye.
//   const withSuppressed = (callback) => {
//     suppressRef.current = true;

//     try {
//       return callback();
//     } finally {
//       lastSwitchRef.current = Date.now();

//       setTimeout(() => {
//         suppressRef.current = false;
//       }, 1500);
//     }
//   };

//   const handleLogout = () => {
//     if (typeof onLogout === "function") {
//       onLogout();
//       return;
//     }

//     localStorage.removeItem("codeshield_token");
//     window.location.reload();
//   };

//   /* ============================================================
//      TEST ATTEMPT / PROBLEMS
//      ============================================================ */

//   // Start or resume the student's single attempt for this test.
//   const startAttempt = useCallback(async () => {
//     if (!testId || !token) {
//       setAttemptLoading(false);
//       if (!token) setError("Your session has expired. Please log in again.");
//       return null;
//     }

//     try {
//       setAttemptLoading(true);

//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/start`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({}),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Could not start the test attempt.");
//       }

//       setAttempt(data.attempt || data);
//       return data.attempt || data;
//     } catch (err) {
//       console.error("Start attempt error:", err);
//       setError(err.message || "Could not start the test attempt.");
//       return null;
//     } finally {
//       setAttemptLoading(false);
//     }
//   }, [testId, token, authHeaders]);

//   const loadProblems = useCallback(async () => {
//     if (!testId || !token) {
//       setLoadingProblems(false);
//       if (!token) setError("Please log in again to continue.");
//       return;
//     }

//     try {
//       setLoadingProblems(true);
//       setError("");

//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/problems`,
//         {
//           method: "GET",
//           headers: authHeaders,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       // 423 = test frozen
//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || "Failed to load problems.");
//       }

//       const loadedProblems = data.problems || [];
//       setProblems(loadedProblems);

//       setSelectedProblem((current) => {
//         if (
//           current &&
//           loadedProblems.some(
//             (problem) => problem.problem_id === current.problem_id
//           )
//         ) {
//           return current;
//         }

//         return loadedProblems[0] || null;
//       });
//     } catch (err) {
//       console.error("Problem loading error:", err);
//       setError(err.message || "Failed to load problems.");
//     } finally {
//       setLoadingProblems(false);
//     }
//   }, [testId, token, authHeaders, enterFrozen]);

//   const loadVisibleTestCases = useCallback(async (problemId) => {
//     if (!problemId || !token) return;

//     try {
//       setLoadingTestCases(true);

//       const response = await fetch(
//         `${API_BASE}/api/problems/${problemId}/testcases`,
//         {
//           method: "GET",
//           headers: authHeaders,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Failed to load test cases.");
//       }

//       setVisibleTestCases(data.testcases || []);
//     } catch (err) {
//       console.error("Visible testcase error:", err);
//       setVisibleTestCases([]);
//     } finally {
//       setLoadingTestCases(false);
//     }
//   }, [token, authHeaders]);


//   useEffect(() => {
//     let cancelled = false;

//     async function initialise() {
//       setProblems([]);
//       setSelectedProblem(null);
//       setCodes(readDrafts(draftKey));
//       setVisibleTestCases([]);
//       setAttempt(null);
//       setAttemptedProblems({});
//       setElapsedByProblem({});
//       setFinalized(false);
//       finalizedRef.current = false;
//       setFinalizing(false);
//       setExecutionResult(null);
//       setSubmissionId(null);
//       setFrozen(false);
//       frozenRef.current = false;
//       setWarning("");

//       if (!testId) {
//         setLoadingProblems(false);
//         setAttemptLoading(false);
//         setError("Test information is missing.");
//         return;
//       }

//       const attemptData = await startAttempt();
//       if (cancelled) return;

//       if (!attemptData) {
//         setLoadingProblems(false);
//         return;
//       }

//       // Refresh / dobara login ke baad bhi freeze bana rahe
//       const sessionData = await fetchSession();
//       if (cancelled) return;

//       // Teacher ne test end kar diya tha
//       if (sessionData?.ended) {
//         setLoadingProblems(false);
//         setTimeout(() => {
//           autoSubmitRef.current?.(true, endedMessage(sessionData));
//         }, 0);
//         return;
//       }

//       if (sessionData?.status === "frozen") {
//         enterFrozen(sessionData);
//         setLoadingProblems(false);
//         return;
//       }

//       if (sessionData) {
//         setSession((previous) => ({ ...previous, ...pickSession(sessionData) }));
//       }

//       await loadProblems();
//     }

//     initialise();

//     return () => {
//       cancelled = true;
//     };
//   }, [testId, draftKey, startAttempt, loadProblems, fetchSession, enterFrozen]);

//   useEffect(() => {
//     selectedProblemRef.current = selectedProblem;
//   }, [selectedProblem]);

//   useEffect(() => {
//     if (!selectedProblem) {
//       setVisibleTestCases([]);
//       return;
//     }

//     loadVisibleTestCases(selectedProblem.problem_id);

//     setExecutionResult(null);
//     setSubmissionId(null);
//     lastActivityRef.current = Date.now();
//   }, [selectedProblem, loadVisibleTestCases]);

//   // Is problem + language ka code abhi nahi hai to starter template do
//   useEffect(() => {
//     if (!selectedProblem) return;

//     const key = codeKey(selectedProblem.problem_id, language);

//     setCodes((previous) =>
//       previous[key] !== undefined
//         ? previous
//         : { ...previous, [key]: getDefaultCode(language) }
//     );
//   }, [selectedProblem, language, getDefaultCode]);

//   useEffect(() => {
//     try {
//       localStorage.setItem(languageKey, language);
//     } catch {
//       /* ignore */
//     }
//   }, [language, languageKey]);

//   // Code ka draft isi browser mein save (refresh / freeze ke baad bhi bacha rahe)
//   useEffect(() => {
//     if (!testId || finalizedRef.current) return;

//     try {
//       localStorage.setItem(draftKey, JSON.stringify(codes));
//     } catch {
//       /* storage full / blocked: ignore */
//     }
//   }, [codes, testId, draftKey, finalized]);


//   useEffect(() => {
//     if (!testId || !selectedProblem || finalized || !attempt || frozen) return;

//     const problemId = selectedProblem.problem_id;
//     lastActivityRef.current = Date.now();

//     const sendActivity = async () => {
//       const now = Date.now();
//       const elapsed = Math.max(
//         0,
//         Math.floor((now - lastActivityRef.current) / 1000)
//       );

//       lastActivityRef.current = now;

//       if (elapsed > 0) {
//         setElapsedByProblem((previous) => ({
//           ...previous,
//           [problemId]: (previous[problemId] || 0) + elapsed,
//         }));
//       }

//       try {
//         const response = await fetch(
//           `${API_BASE}/api/tests/${testId}/activity`,
//           {
//             method: "POST",
//             headers: authHeaders,
//             body: JSON.stringify({
//               problem_id: problemId,
//               event_type: "heartbeat",
//               elapsed_seconds: elapsed,
//             }),
//           }
//         );

//         if (!response.ok) {
//           const data = await response.json().catch(() => ({}));
//           console.warn("Activity update failed:", data.error);
//         }
//       } catch (err) {
//         console.warn("Activity heartbeat failed:", err);
//       }
//     };

//     activityTimerRef.current = setInterval(sendActivity, 15000);

//     return () => {
//       if (activityTimerRef.current) {
//         clearInterval(activityTimerRef.current);
//         activityTimerRef.current = null;
//       }


//       const elapsed = Math.max(
//         0,
//         Math.floor((Date.now() - lastActivityRef.current) / 1000)
//       );

//       if (elapsed > 0) {
//         setElapsedByProblem((previous) => ({
//           ...previous,
//           [problemId]: (previous[problemId] || 0) + elapsed,
//         }));
//       }
//     };
//   }, [testId, selectedProblem, finalized, attempt, authHeaders, frozen]);

//   useEffect(() => {
//     if (!test?.end_time) {
//       setTimeLeft(null);
//       return;
//     }

//     const updateTimer = () => {
//       const remaining = new Date(test.end_time).getTime() - Date.now();
//       setTimeLeft(Math.max(0, remaining));
//     };

//     updateTimer();
//     const interval = setInterval(updateTimer, 1000);

//     return () => clearInterval(interval);
//   }, [test?.end_time]);

//   /* ============================================================
//      PROCTORING: TAB-SWITCH MONITORING
//      6 switch tak sirf warning. 7th switch par test freeze.
//      ============================================================ */

//   const monitoring =
//     attempt?.status === "in_progress" && !finalized && !frozen;

//   useEffect(() => {
//     if (!monitoring || !testId || !token) return undefined;

//     const report = async (reason) => {
//       if (
//         finalizedRef.current ||
//         frozenRef.current ||
//         suppressRef.current
//       ) {
//         return;
//       }

//       // visibilitychange + blur ek hi switch par dono aate hain
//       const now = Date.now();
//       if (now - lastSwitchRef.current < 2000) return;
//       lastSwitchRef.current = now;

//       try {
//         const response = await fetch(
//           `${API_BASE}/api/tests/${testId}/tab-switch`,
//           {
//             method: "POST",
//             headers: authHeaders,
//             body: JSON.stringify({ reason }),
//           }
//         );

//         const data = await response.json().catch(() => ({}));

//         if (response.status === 423) {
//           enterFrozen(data);
//           return;
//         }

//         if (!response.ok) return;

//         setSession((previous) => ({ ...previous, ...pickSession(data) }));

//         if (data.ended) {
//           autoSubmitRef.current?.(true, endedMessage(data));
//           return;
//         }

//         if (data.status === "frozen") {
//           enterFrozen(data);
//           return;
//         }

//         if (data.counted) {
//           showWarning(tabSwitchMessage(data), tabSwitchLevel(data));
//         }
//       } catch (err) {
//         console.warn("Tab-switch report failed:", err);
//       }
//     };

//     const onVisibility = () => {
//       if (document.visibilityState === "hidden") {
//         report("tab_hidden");
//       }
//     };

//     const onBlur = () => report("window_blur");

//     document.addEventListener("visibilitychange", onVisibility);
//     window.addEventListener("blur", onBlur);

//     return () => {
//       document.removeEventListener("visibilitychange", onVisibility);
//       window.removeEventListener("blur", onBlur);
//     };
//   }, [monitoring, testId, token, authHeaders, enterFrozen, showWarning]);

//   // Teacher ne test freeze ya end kiya ho to student ko pata chale
//   useEffect(() => {
//     if (!monitoring || !testId || !token) return undefined;

//     const timer = setInterval(async () => {
//       if (finalizedRef.current || frozenRef.current) return;

//       const data = await fetchSession();

//       if (!data) return;

//       if (data.ended) {
//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       if (data.status === "frozen") {
//         enterFrozen(data);
//       }
//     }, SESSION_POLL_MS);

//     return () => clearInterval(timer);
//   }, [monitoring, testId, token, fetchSession, enterFrozen]);

//   // Freeze ke dauran teacher ke unlock / end ka intezaar
//   useEffect(() => {
//     if (!frozen || finalized) return undefined;

//     const timer = setInterval(async () => {
//       const data = await fetchSession();

//       if (!data) return;

//       // Teacher ne "End test" kiya: test submit ho jata hai
//       if (data.ended) {
//         frozenRef.current = false;
//         setFrozen(false);

//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       // Teacher ne unlock kiya
//       if (data.status !== "frozen") {
//         frozenRef.current = false;
//         lastSwitchRef.current = Date.now();

//         setSession((previous) => ({ ...previous, ...pickSession(data) }));
//         setFrozen(false);

//         showWarning(
//           "Your teacher reviewed the activity and allowed you to continue the test.",
//           "info"
//         );

//         await loadProblems();
//       }
//     }, 5000);

//     return () => clearInterval(timer);
//   }, [frozen, finalized, fetchSession, loadProblems, showWarning]);

//   useEffect(() => {
//     return () => {
//       if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
//     };
//   }, []);

//   /* ============================================================
//      EDITOR HANDLERS
//      ============================================================ */

//   const handleProblemSelect = (problem) => {
//     if (finalized || finalizing || frozen) return;
//     setSelectedProblem(problem);
//   };

//   const handleCodeChange = (value) => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;

//     setCodes((previous) => ({
//       ...previous,
//       [codeKey(selectedProblem.problem_id, language)]: value,
//     }));
//   };

//   const resetToDefaultCode = () => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;
//     if (
//       withSuppressed(() =>
//         window.confirm(
//           "Reset code to the default starter template for this problem? Any unsaved edits will be replaced."
//         )
//       )
//     ) {
//       const def = getDefaultCode(language);
//       handleCodeChange(def);
//     }
//   };

//   const handleLanguageChange = (value) => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;

//     setLanguage(value);
//     setExecutionResult(null);
//   };

//   const pollResult = async (id) => {
//     if (!id) {
//       setExecutionLoading(false);
//       return;
//     }

//     let attempts = 0;
//     // Java mein compile + JVM start ka time lagta hai, queue mein bhi wait ho sakta hai
//     const maxAttempts = language === "java" ? 120 : 60;

//     const checkResult = async () => {
//       try {
//         const response = await fetch(`${API_BASE}/result/${id}`, {
//           method: "GET",
//           headers: authHeaders,
//         });

//         const data = await response.json().catch(() => ({}));

//         if (!response.ok) {
//           throw new Error(data.error || "Failed to get execution result.");
//         }

//         setExecutionResult(data);

//         if (data.status === "completed") {
//           setExecutionLoading(false);
//           return;
//         }

//         attempts += 1;

//         if (attempts >= maxAttempts) {
//           setExecutionResult({
//             status: "completed",
//             verdict: "SYSTEM ERROR",
//             output:
//               "Result did not arrive in time (server may be busy). Please try again.",
//           });
//           setExecutionLoading(false);
//           return;
//         }

//         setTimeout(checkResult, 500);
//       } catch (err) {
//         console.error("Result polling error:", err);
//         setExecutionResult({
//           status: "completed",
//           verdict: "SYSTEM ERROR",
//           output: err.message,
//         });
//         setExecutionLoading(false);
//       }
//     };

//     await checkResult();
//   };

//   const postSubmissionActivity = async (id, problemId) => {
//     if (!testId || !id || !problemId) return;

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/record-submission`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({
//             submission_id: id,
//             problem_id: problemId,
//           }),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         console.warn("Could not record attempt submission:", data.error);
//       }
//     } catch (err) {
//       console.warn("Record submission request failed:", err);
//     }
//   };

//   const submitCodeToBackend = async (endpoint, actionLabel) => {
//     if (
//       !selectedProblem ||
//       executionLoading ||
//       finalized ||
//       finalizing ||
//       frozen
//     ) {
//       return;
//     }

//     if (!token) {
//       setError("Your session has expired. Please log in again.");
//       return;
//     }

//     if (testStatus !== "Active") {
//       setError(
//         testStatus === "Upcoming"
//           ? "This test has not started yet."
//           : "This test has ended."
//       );
//       return;
//     }

//     const problemId = selectedProblem.problem_id;
//     const code =
//       codes[codeKey(problemId, language)] ?? getDefaultCode(language);

//     if (!code.trim()) {
//       setError("Code cannot be empty.");
//       return;
//     }

//     setError("");
//     setExecutionLoading(true);
//     setExecutionResult({
//       status: "queued",
//       verdict: null,
//       output: `${actionLabel} sent for execution...`,
//     });
//     setSubmissionId(null);

//     try {
//       const response = await fetch(`${API_BASE}${endpoint}`, {
//         method: "POST",
//         headers: authHeaders,
//         body: JSON.stringify({
//           code,
//           problem_id: problemId,
//           language,
//         }),
//       });

//       const data = await response.json().catch(() => ({}));

//       // 423 = teacher ne test freeze kiya hua hai
//       if (response.status === 423) {
//         setExecutionLoading(false);
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || `Failed to ${actionLabel.toLowerCase()}.`);
//       }

//       const id = data.run_id || data.submission_id;

//       if (!id) {
//         throw new Error("Backend did not return a run or submission ID.");
//       }

//       setSubmissionId(id);
//       setAttemptedProblems((previous) => ({
//         ...previous,
//         [problemId]: true,
//       }));

//       if (endpoint === "/submit") {
//         await postSubmissionActivity(id, problemId);
//       }

//       setExecutionResult({
//         status: "queued",
//         verdict: null,
//         output: "Your code is waiting for execution...",
//       });

//       await pollResult(id);
//     } catch (err) {
//       console.error(`${actionLabel} error:`, err);
//       setExecutionResult({
//         status: "completed",
//         verdict: "SYSTEM ERROR",
//         output: err.message,
//       });
//       setExecutionLoading(false);
//     }
//   };

//   const handleRunCode = () => submitCodeToBackend("/run", "Run Code");

//   const handleSubmit = () => submitCodeToBackend("/submit", "Submit");


//   // automatic = true: timer khatam hua ya teacher ne test end kiya.
//   // endedReason: teacher ke end karne ka message.
//   const handleFinalSubmit = async (automatic = false, endedReason = "") => {
//     if (finalizedRef.current || finalizing || !testId) return;

//     const confirmed = automatic
//       ? true
//       : withSuppressed(() =>
//           window.confirm(
//             "Are you sure you want to submit the test? You cannot continue editing after final submission."
//           )
//         );

//     if (!confirmed) return;

//     setFinalizing(true);
//     setError("");

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/final-submit`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({
//             status: automatic ? "auto_submitted" : "submitted",
//           }),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || "Could not finalize the test.");
//       }

//       finalizedRef.current = true;
//       setFinalized(true);

//       // Submit ho gaya, ab draft ki zarurat nahi
//       try {
//         localStorage.removeItem(draftKey);
//       } catch {
//         /* ignore */
//       }

//       // Test successfully submitted
//       if (activityTimerRef.current) {
//         clearInterval(activityTimerRef.current);
//         activityTimerRef.current = null;
//       }

//       setTimeout(() => {
//         if (typeof onBack === "function") {
//           onBack(true);
//         }
//       }, 1500);

//       setAttempt((previous) => ({
//         ...(previous || {}),
//         ...(data.attempt || {}),
//         status: automatic ? "auto_submitted" : "submitted",
//       }));

//       withSuppressed(() =>
//         window.alert(
//           endedReason
//             ? endedReason
//             : automatic
//               ? "Time is over. Your test has been auto-submitted."
//               : "Your test has been submitted successfully."
//         )
//       );
//     } catch (err) {
//       console.error("Final submission error:", err);
//       setError(err.message || "Could not finalize the test.");
//     } finally {
//       setFinalizing(false);
//     }
//   };

//   autoSubmitRef.current = handleFinalSubmit;

//   // Auto-submit sirf tab, jab timer zero ho jaye.
//   useEffect(() => {
//     if (
//       timeLeft === 0 &&
//       !finalized &&
//       !finalizing &&
//       attempt
//     ) {
//       handleFinalSubmit(true);
//     }
//     // handleFinalSubmit is intentionally invoked only when the timer expires.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [timeLeft, finalized, finalizing, attempt]);

//   const attemptedCount = Object.keys(attemptedProblems).filter(
//     (key) => attemptedProblems[key]
//   ).length;

//   const switchMax = session.max_switches;

//   if (loadingProblems || attemptLoading) {
//     return (
//       <div className="student-test-loading">
//         <Loader2 size={28} className="spin" />
//         <span>Loading test...</span>
//       </div>
//     );
//   }

//   return (
//     <div className="student-test-page">
//       <header className="student-test-topbar">
//         <div className="student-test-brand">
//           <button
//             className="student-back-btn"
//             onClick={() => onBack && onBack(false)}
//             disabled={finalizing}
//             aria-label="Go back"
//           >
//             <ArrowLeft size={18} />
//           </button>

//           <div>
//             <div className="student-brand-name">CodeShield</div>
//             <div className="student-brand-subtitle">
//               Student Workspace
//             </div>
//           </div>
//         </div>

//         <div className="student-test-title">
//           <span>{test?.title || "Coding Test"}</span>
//           <span
//             className={
//               testStatus === "Active"
//                 ? "student-status active"
//                 : "student-status"
//             }
//           >
//             {finalized ? "Submitted" : testStatus}
//           </span>
//         </div>

//         <div className="student-topbar-right">
//           <div
//             className={`switch-chip ${
//               session.tab_switch_count >= switchMax
//                 ? "danger"
//                 : session.tab_switch_count > 0
//                   ? "warn"
//                   : ""
//             }`}
//             title={`You can switch tabs ${switchMax} times. After that your test is frozen until your teacher unlocks it.`}
//           >
//             <AlertTriangle size={14} />
//             Tab switches {session.tab_switch_count}/{switchMax}
//           </div>

//           <div className="student-timer">
//             <Clock3 size={17} />
//             <div>
//               <span>Time Remaining</span>
//               <strong>{formatTime(timeLeft)}</strong>
//             </div>
//           </div>
//         </div>
//       </header>

//       {warning && (
//         <div
//           className={`proctor-warning ${
//             warningType === "info" ? "proctor-info" : ""
//           }`}
//           role="alert"
//         >
//           <AlertTriangle size={16} />
//           {warning}
//         </div>
//       )}

//       {error && (
//         <div className="student-test-error" role="alert">
//           {error}
//         </div>
//       )}

//       {finalized && (
//         <div className="student-test-error">
//           Your test has been submitted. Editing and new submissions are disabled.
//         </div>
//       )}

//       <div className="student-test-body">
//         <aside className="student-problem-sidebar">
//           <div className="student-sidebar-header">
//             <div>
//               <span>ASSESSMENT</span>
//               <h2>Problems</h2>
//             </div>
//             <div className="problem-count">{problems.length}</div>
//           </div>

//           <div className="student-problem-list">
//             {problems.length === 0 ? (
//               <div className="no-problems">
//                 No problems available.
//               </div>
//             ) : (
//               problems.map((problem, index) => (
//                 <button
//                   key={problem.problem_id}
//                   className={
//                     selectedProblem?.problem_id === problem.problem_id
//                       ? "student-problem-item selected"
//                       : "student-problem-item"
//                   }
//                   onClick={() => handleProblemSelect(problem)}
//                   disabled={finalized || finalizing}
//                 >
//                   <div className="problem-number">{index + 1}</div>

//                   <div className="problem-item-content">
//                     <strong>{problem.title}</strong>
//                     <div className="problem-meta">
//                       <span
//                         className={`difficulty ${String(
//                           problem.difficulty || "Easy"
//                         ).toLowerCase()}`}
//                       >
//                         {problem.difficulty || "Easy"}
//                       </span>
//                       <span>{problem.time_limit_ms ?? 1000} ms</span>
//                     </div>
//                     {attemptedProblems[problem.problem_id] && (
//                       <small>Attempted</small>
//                     )}
//                   </div>

//                   <ChevronRight size={17} className="problem-arrow" />
//                 </button>
//               ))
//             )}
//           </div>

//           <div className="student-sidebar-footer">
//             <div className="progress-label">
//               <span>Attempted</span>
//               <span>
//                 {attemptedCount} / {problems.length}
//               </span>
//             </div>
//             <div className="progress-track">
//               <div
//                 className="progress-fill"
//                 style={{
//                   width: `${
//                     problems.length
//                       ? (attemptedCount / problems.length) * 100
//                       : 0
//                   }%`,
//                 }}
//               />
//             </div>
//           </div>
//         </aside>

//         <main className="student-problem-panel">
//           {!selectedProblem ? (
//             <div className="empty-problem">
//               <FileText size={40} />
//               <h2>Select a problem</h2>
//               <p>
//                 Choose a problem from the left panel to start solving.
//               </p>
//             </div>
//           ) : (
//             <>
//               <div className="problem-header">
//                 <div>
//                   <div className="problem-heading-row">
//                     <h1>{selectedProblem.title}</h1>
//                     <span
//                       className={`difficulty large ${String(
//                         selectedProblem.difficulty || "Easy"
//                       ).toLowerCase()}`}
//                     >
//                       {selectedProblem.difficulty || "Easy"}
//                     </span>
//                   </div>
//                   <p>
//                     Problem #
//                     {problems.findIndex(
//                       (problem) =>
//                         problem.problem_id === selectedProblem.problem_id
//                     ) + 1}
//                   </p>
//                 </div>
//               </div>

//               <section className="problem-section">
//                 <div className="section-heading">
//                   <FileText size={17} />
//                   <h2>Problem Statement</h2>
//                 </div>
//                 <div className="problem-statement">
//                   {selectedProblem.statement}
//                 </div>
//               </section>

//               <section className="problem-limits">
//                 <div className="limit-card">
//                   <Clock3 size={18} />
//                   <div>
//                     <span>Time Limit</span>
//                     <strong>
//                       {selectedProblem.time_limit_ms ?? 1000} ms
//                     </strong>
//                   </div>
//                 </div>

//                 <div className="limit-card">
//                   <MemoryStick size={18} />
//                   <div>
//                     <span>Memory Limit</span>
//                     <strong>
//                       {selectedProblem.memory_limit_mb ?? 256} MB
//                     </strong>
//                   </div>
//                 </div>
//               </section>

//               <section className="problem-section">
//                 <div className="section-heading">
//                   <Eye size={17} />
//                   <h2>Examples</h2>
//                   <span className="example-count">
//                     {visibleTestCases.length}
//                   </span>
//                 </div>

//                 {loadingTestCases ? (
//                   <div className="examples-loading">
//                     <Loader2 size={17} className="spin" />
//                     Loading examples...
//                   </div>
//                 ) : visibleTestCases.length === 0 ? (
//                   <div className="no-examples">
//                     No visible examples available for this problem.
//                   </div>
//                 ) : (
//                   <div className="examples-list">
//                     {visibleTestCases.map((testCase, index) => (
//                       <div
//                         className="example-card"
//                         key={testCase.testcase_id ?? index}
//                       >
//                         <div className="example-header">
//                           <span>Example {index + 1}</span>
//                           <CheckCircle2 size={15} />
//                         </div>

//                         <div className="example-grid">
//                           <div>
//                             <label>Input</label>
//                             <pre>{testCase.input}</pre>
//                           </div>
//                           <div>
//                             <label>Expected Output</label>
//                             <pre>{testCase.expected_output}</pre>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </section>
//             </>
//           )}
//         </main>

//         <section className="student-editor-panel">
//           <div className="editor-header">
//             <div className="editor-title">
//               <Code2 size={18} />
//               <span>Code Editor</span>
//             </div>

//             <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//               <div style={{ display: "flex", gap: "3px" }}>
//                 <button
//                   type="button"
//                   className="editor-tool-btn"
//                   onClick={() => setEditorFontSize((s) => Math.max(11, s - 1))}
//                   title="Decrease font size"
//                 >
//                   A-
//                 </button>
//                 <button
//                   type="button"
//                   className="editor-tool-btn"
//                   onClick={() => setEditorFontSize((s) => Math.min(22, s + 1))}
//                   title="Increase font size"
//                 >
//                   A+
//                 </button>
//               </div>

//               <button
//                 type="button"
//                 className="editor-tool-btn"
//                 onClick={resetToDefaultCode}
//                 title="Reset code to default template"
//                 disabled={finalized || finalizing || frozen}
//               >
//                 <RotateCcw size={13} /> Reset
//               </button>

//               <select
//                 value={language}
//                 onChange={(event) => handleLanguageChange(event.target.value)}
//                 disabled={finalized || finalizing || executionLoading || frozen}
//               >
//                 <option value="cpp">C++</option>
//                 <option value="java">Java</option>
//                 <option value="python">Python</option>
//               </select>
//             </div>
//           </div>

//           <div className="editor-container">
//             <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
//               <div style={{ position: "absolute", inset: 0 }}>
//                 <Editor
//                   height="100%"
//                   theme="vs-dark"
//                   path={
//                     selectedProblem
//                       ? `problem-${selectedProblem.problem_id}.${language}`
//                       : "empty"
//                   }
//                   language={language}
//                   value={
//                     selectedProblem
//                       ? codes[codeKey(selectedProblem.problem_id, language)] ??
//                         getDefaultCode(language)
//                       : ""
//                   }
//                   onChange={(value) => handleCodeChange(value ?? "")}
//                   loading={
//                     <div className="examples-loading">
//                       <Loader2 size={17} className="spin" /> Loading editor...
//                     </div>
//                   }
//                   options={{
//                     readOnly: !selectedProblem || finalized || finalizing || frozen,
//                     minimap: { enabled: false },
//                     fontSize: editorFontSize,
//                     tabSize: 4,
//                     automaticLayout: true,
//                     scrollBeyondLastLine: false,
//                     padding: { top: 14 },
//                     fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
//                   }}
//                 />
//               </div>
//             </div>
//           </div>

//           <div className="editor-footer">
//             <div className="editor-info">
//               <span>
//                 {language === "cpp"
//                   ? "C++17"
//                   : language === "java"
//                     ? "Java"
//                     : "Python 3"}
//               </span>
//               <span>Auto-save: Local</span>
//             </div>

//             <div className="editor-actions">
//               <button
//                 className="run-button"
//                 onClick={handleRunCode}
//                 disabled={
//                   !selectedProblem ||
//                   executionLoading ||
//                   finalized ||
//                   finalizing ||
//                   frozen
//                 }
//               >
//                 {executionLoading ? (
//                   <Loader2 size={16} className="spin" />
//                 ) : (
//                   <Play size={16} />
//                 )}
//                 {executionLoading ? "Running..." : "Run Code"}
//               </button>

//               <button
//                 className="submit-button"
//                 onClick={handleSubmit}
//                 disabled={
//                   !selectedProblem ||
//                   executionLoading ||
//                   finalized ||
//                   finalizing ||
//                   frozen
//                 }
//               >
//                 <Send size={16} />
//                 Submit
//               </button>
//             </div>
//           </div>

//           <div className="execution-result-panel">
//             <div className="execution-result-header">
//               <div>
//                 <strong>Execution Result</strong>
//                 {executionLoading && (
//                   <span className="execution-running">
//                     <Loader2 size={15} className="spin" />
//                     Running...
//                   </span>
//                 )}
//               </div>

//               {executionResult?.verdict && (
//                 <span
//                   className={`execution-verdict ${
//                     ["AC", "Accepted"].includes(executionResult.verdict)
//                       ? "success"
//                       : "failed"
//                   }`}
//                 >
//                   {executionResult.verdict}
//                 </span>
//               )}
//             </div>

//             <div className="execution-result-body">
//               {!executionResult ? (
//                 <div className="execution-empty">
//                   <Code2 size={22} />
//                   <span>Run your code to see the result.</span>
//                 </div>
//               ) : (
//                 <>
//                   <div className="execution-status">
//                     <span>Status</span>
//                     <strong>{executionResult.status}</strong>
//                   </div>

//                   {executionResult.execution_time_ms !== undefined && (
//                     <div className="execution-status">
//                       <span>Execution Time</span>
//                       <strong>
//                         {executionResult.execution_time_ms} ms
//                       </strong>
//                     </div>
//                   )}

//                   {executionResult.test_cases_total !== undefined && (
//                     <div className="execution-status">
//                       <span>Test Cases</span>
//                       <strong>
//                         {executionResult.test_cases_passed ?? 0}
//                         {" / "}
//                         {executionResult.test_cases_total}
//                       </strong>
//                     </div>
//                   )}

//                   <div className="execution-output">
//                     <div className="output-title">Output</div>
//                     <pre>
//                       {executionResult.output ||
//                         executionResult.stderr ||
//                         "No output"}
//                     </pre>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>

//           <div className="editor-footer">
//             <div className="editor-info">
//               <span>
//                 Questions attempted: {attemptedCount}/{problems.length}
//               </span>
//             </div>

//             <div className="editor-actions">
//               <button
//                 className="submit-button"
//                 onClick={() => handleFinalSubmit(false)}
//                 disabled={finalized || finalizing || !attempt || frozen}
//               >
//                 {finalizing && <Loader2 size={16} className="spin" />}
//                 {finalizing ? "Submitting Test..." : "Final Submit Test"}
//               </button>
//             </div>
//           </div>
//         </section>
//       </div>

//       {/* CAMERA MONITORING: consent + live preview. Alerts sirf teacher ko jaate hain. */}
//       <EyeMonitor
//         active={attempt?.status === "in_progress" && !finalized}
//         paused={frozen}
//         identity={identityApi}
//         onViolation={reportGaze}
//         onStartingChange={handleCameraStarting}
//       />

//       {/* FREEZE SCREEN: sirf Logout ka option */}
//       {frozen && !finalized && (
//         <div className="freeze-overlay" role="alertdialog" aria-modal="true">
//           <div className="freeze-card">
//             <div className="freeze-icon">
//               <Lock size={30} />
//             </div>

//             <h2>Your test is frozen</h2>

//             <p>
//               Your test is frozen. You cannot continue until your teacher
//               reviews it and approves.
//             </p>

//             <div className="freeze-reason">
//               {session.freeze_reason ||
//                 `You switched tabs more than ${switchMax} times.`}
//             </div>

//             <div className="freeze-waiting">
//               <Loader2 size={15} className="spin" />
//               Waiting for your teacher...
//             </div>

//             <div>
//               <button
//                 type="button"
//                 className="freeze-logout"
//                 onClick={handleLogout}
//               >
//                 <LogOut size={16} />
//                 Logout
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default StudentTestPage;


// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   AlertTriangle,
//   ArrowLeft,
//   Clock3,
//   Code2,
//   FileText,
//   Lock,
//   LogOut,
//   MemoryStick,
//   Play,
//   Send,
//   ChevronRight,
//   CheckCircle2,
//   Eye,
//   Loader2,
//   RotateCcw,
// } from "lucide-react";
// import EyeMonitor from "./EyeMonitor.jsx";
// import "./StudentTestPage.css";
// import "./Proctoring.css";
// import Editor from "@monaco-editor/react";

// const API_BASE = "http://localhost:5000";

// // Server MAX_TAB_SWITCHES bhejta hai; yeh sirf shuruaati default hai.
// // 6 switch tak allowed, 7th switch par test freeze.
// const DEFAULT_MAX_SWITCHES = 6;

// // Session status itne ms mein check hota hai (teacher ke freeze / end ke liye)
// const SESSION_POLL_MS = 10000;

// /* ============================================================
//    HELPERS
//    ============================================================ */

// // JWT se user_id nikalta hai (sirf draft ki key banane ke liye).
// function tokenUserId(token) {
//   try {
//     const payload = token
//       .split(".")[1]
//       .replace(/-/g, "+")
//       .replace(/_/g, "/");

//     return JSON.parse(atob(payload)).user_id ?? "anon";
//   } catch {
//     return "anon";
//   }
// }

// function readDrafts(key) {
//   try {
//     const raw = localStorage.getItem(key);
//     const parsed = raw ? JSON.parse(raw) : {};

//     return parsed && typeof parsed === "object" ? parsed : {};
//   } catch {
//     return {};
//   }
// }

// function tabSwitchMessage(data) {
//   const count = data.tab_switch_count ?? 0;
//   const max = data.max_switches ?? DEFAULT_MAX_SWITCHES;
//   const left = max - count;

//   return (
//     `Tab switch detected (${count} of ${max} allowed). ` +
//     (left > 0
//       ? `${left} more ${
//           left === 1 ? "switch is" : "switches are"
//         } allowed. After that your test will be FROZEN until your teacher unlocks it.`
//       : "The next switch will FREEZE your test until your teacher unlocks it.")
//   );
// }

// function tabSwitchLevel(data) {
//   const left =
//     (data.max_switches ?? DEFAULT_MAX_SWITCHES) -
//     (data.tab_switch_count ?? 0);

//   return left > 0 ? "warn" : "danger";
// }

// function endedMessage(data) {
//   return (
//     data?.freeze_reason ||
//     "Your teacher ended your test after reviewing suspicious activity."
//   );
// }

// function pickSession(data) {
//   return {
//     tab_switch_count: data?.tab_switch_count ?? 0,
//     max_switches: data?.max_switches ?? DEFAULT_MAX_SWITCHES,
//     freeze_reason: data?.freeze_reason || "",
//   };
// }

// function StudentTestPage({ test, onBack, onLogout }) {
//   const token = localStorage.getItem("codeshield_token");
//   const testId = test?.contest_id;
//   const draftKey = `codeshield_drafts_${testId}_${tokenUserId(token)}`;

//   const [problems, setProblems] = useState([]);
//   const [selectedProblem, setSelectedProblem] = useState(null);
//   const [codes, setCodes] = useState(() => readDrafts(draftKey));
//   const [visibleTestCases, setVisibleTestCases] = useState([]);
//   const [loadingProblems, setLoadingProblems] = useState(true);
//   const [loadingTestCases, setLoadingTestCases] = useState(false);
//   const [error, setError] = useState("");
//   const [language, setLanguage] = useState("cpp");
//   const [timeLeft, setTimeLeft] = useState(null);
//   const [executionResult, setExecutionResult] = useState(null);
//   const [executionLoading, setExecutionLoading] = useState(false);
//   const [submissionId, setSubmissionId] = useState(null);
//   const [attempt, setAttempt] = useState(null);
//   const [attemptLoading, setAttemptLoading] = useState(true);
//   const [finalizing, setFinalizing] = useState(false);
//   const [finalized, setFinalized] = useState(false);
//   const [attemptedProblems, setAttemptedProblems] = useState({});
//   const [elapsedByProblem, setElapsedByProblem] = useState({});
//   const [editorFontSize, setEditorFontSize] = useState(14);

//   // Proctoring
//   const [frozen, setFrozen] = useState(false);
//   const [session, setSession] = useState({
//     tab_switch_count: 0,
//     max_switches: DEFAULT_MAX_SWITCHES,
//     freeze_reason: "",
//   });
//   const [warning, setWarning] = useState("");
//   const [warningType, setWarningType] = useState("warn");

//   const activityTimerRef = useRef(null);
//   const selectedProblemRef = useRef(null);
//   const lastActivityRef = useRef(Date.now());
//   const finalizedRef = useRef(false);

//   const frozenRef = useRef(false);
//   const suppressRef = useRef(false);
//   const lastSwitchRef = useRef(0);
//   const warningTimerRef = useRef(null);
//   const autoSubmitRef = useRef(null);

//   const authHeaders = useMemo(
//     () => ({
//       Authorization: `Bearer ${token || ""}`,
//       "Content-Type": "application/json",
//     }),
//     [token]
//   );

//   const getDefaultCode = useCallback((lang = language) => {
//     if (lang === "cpp") {
//       return `#include <iostream>
// #include <vector>
// #include <string>
// using namespace std;

// int main() {
//     // Write your solution here
//     return 0;
// }`;
//     }

//     if (lang === "java") {
//       return `import java.util.*;

// public class Main {
//     public static void main(String[] args) {
//         // Write your solution here
//     }
// }`;
//     }

//     return `# Write your solution here
// `;
//   }, [language]);

//   const testStatus = useMemo(() => {
//     if (!test) return "Unavailable";

//     const now = Date.now();
//     const start = test.start_time
//       ? new Date(test.start_time).getTime()
//       : 0;
//     const end = test.end_time
//       ? new Date(test.end_time).getTime()
//       : Infinity;

//     if (now < start) return "Upcoming";
//     if (now >= end) return "Ended";
//     return "Active";
//   }, [test]);

//   const formatTime = useCallback((milliseconds) => {
//     if (milliseconds == null || milliseconds <= 0) {
//       return "00:00:00";
//     }

//     const totalSeconds = Math.floor(milliseconds / 1000);
//     const hours = Math.floor(totalSeconds / 3600);
//     const minutes = Math.floor((totalSeconds % 3600) / 60);
//     const seconds = totalSeconds % 60;

//     return [hours, minutes, seconds]
//       .map((value) => String(value).padStart(2, "0"))
//       .join(":");
//   }, []);

//   /* ============================================================
//      PROCTORING: FREEZE / SESSION
//      ============================================================ */

//   // Test freeze ho gaya: screen par ka content hata do.
//   const enterFrozen = useCallback((data) => {
//     if (data) {
//       setSession((previous) => ({ ...previous, ...pickSession(data) }));
//     }

//     frozenRef.current = true;
//     setFrozen(true);
//     setProblems([]);
//     setSelectedProblem(null);
//     setVisibleTestCases([]);
//     setExecutionResult(null);
//     setWarning("");
//   }, []);

//   const fetchSession = useCallback(async () => {
//     if (!testId || !token) return null;

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/session`,
//         { method: "GET", headers: authHeaders }
//       );

//       const data = await response.json().catch(() => ({}));

//       return response.ok ? data : null;
//     } catch {
//       return null;
//     }
//   }, [testId, token, authHeaders]);

//   const showWarning = useCallback((message, type = "warn") => {
//     setWarning(message);
//     setWarningType(type);

//     if (warningTimerRef.current) {
//       clearTimeout(warningTimerRef.current);
//     }

//     warningTimerRef.current = setTimeout(() => setWarning(""), 10000);
//   }, []);

//   // Camera ki koi bhi alag harkat (doosra chehra, face na dikhna, nazar hatna,
//   // camera band): teacher ke Incidents tab mein photo ke saath jati hai.
//   // Student ko koi warning nahi dikhti, test rukta bhi nahi.
//   const reportGaze = useCallback(async ({ type, snapshot, photo }) => {
//     if (finalizedRef.current || frozenRef.current || !testId) return;

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/incident`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({
//             kind: type,
//             photo: snapshot || photo || null,
//           }),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) return;

//       setSession((previous) => ({ ...previous, ...pickSession(data) }));

//       // Teacher ne is dauran test end ya freeze kar diya ho
//       if (data.ended) {
//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       if (data.status === "frozen") {
//         enterFrozen(data);
//       }
//     } catch (err) {
//       console.warn("Gaze report failed:", err);
//     }
//   }, [testId, authHeaders, enterFrozen]);

//   // Camera permission popup khulne par browser blur bhejta hai;
//   // use tab switch na ginna.
//   const handleCameraStarting = useCallback((starting) => {
//     suppressRef.current = starting;

//     if (!starting) {
//       lastSwitchRef.current = Date.now();
//     }
//   }, []);

//   // Face verification (identity check) API
//   const identityApi = useMemo(() => {
//     const call = async (method, body) => {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/identity`,
//         {
//           method,
//           headers: authHeaders,
//           body: body ? JSON.stringify(body) : undefined,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Identity request failed.");
//       }

//       return data;
//     };

//     return {
//       getStatus: () => call("GET"),
//       submit: (payload) => call("POST", payload),
//     };
//   }, [testId, authHeaders]);

//   // confirm() / alert() khulne par browser blur event bhejta hai;
//   // usse tab switch na ginne ke liye.
//   const withSuppressed = (callback) => {
//     suppressRef.current = true;

//     try {
//       return callback();
//     } finally {
//       lastSwitchRef.current = Date.now();

//       setTimeout(() => {
//         suppressRef.current = false;
//       }, 1500);
//     }
//   };

//   const handleLogout = () => {
//     if (typeof onLogout === "function") {
//       onLogout();
//       return;
//     }

//     localStorage.removeItem("codeshield_token");
//     window.location.reload();
//   };

//   /* ============================================================
//      TEST ATTEMPT / PROBLEMS
//      ============================================================ */

//   // Start or resume the student's single attempt for this test.
//   const startAttempt = useCallback(async () => {
//     if (!testId || !token) {
//       setAttemptLoading(false);
//       if (!token) setError("Your session has expired. Please log in again.");
//       return null;
//     }

//     try {
//       setAttemptLoading(true);

//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/start`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({}),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Could not start the test attempt.");
//       }

//       setAttempt(data.attempt || data);
//       return data.attempt || data;
//     } catch (err) {
//       console.error("Start attempt error:", err);
//       setError(err.message || "Could not start the test attempt.");
//       return null;
//     } finally {
//       setAttemptLoading(false);
//     }
//   }, [testId, token, authHeaders]);

//   const loadProblems = useCallback(async () => {
//     if (!testId || !token) {
//       setLoadingProblems(false);
//       if (!token) setError("Please log in again to continue.");
//       return;
//     }

//     try {
//       setLoadingProblems(true);
//       setError("");

//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/problems`,
//         {
//           method: "GET",
//           headers: authHeaders,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       // 423 = test frozen
//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || "Failed to load problems.");
//       }

//       const loadedProblems = data.problems || [];
//       setProblems(loadedProblems);

//       setSelectedProblem((current) => {
//         if (
//           current &&
//           loadedProblems.some(
//             (problem) => problem.problem_id === current.problem_id
//           )
//         ) {
//           return current;
//         }

//         return loadedProblems[0] || null;
//       });
//     } catch (err) {
//       console.error("Problem loading error:", err);
//       setError(err.message || "Failed to load problems.");
//     } finally {
//       setLoadingProblems(false);
//     }
//   }, [testId, token, authHeaders, enterFrozen]);

//   const loadVisibleTestCases = useCallback(async (problemId) => {
//     if (!problemId || !token) return;

//     try {
//       setLoadingTestCases(true);

//       const response = await fetch(
//         `${API_BASE}/api/problems/${problemId}/testcases`,
//         {
//           method: "GET",
//           headers: authHeaders,
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Failed to load test cases.");
//       }

//       setVisibleTestCases(data.testcases || []);
//     } catch (err) {
//       console.error("Visible testcase error:", err);
//       setVisibleTestCases([]);
//     } finally {
//       setLoadingTestCases(false);
//     }
//   }, [token, authHeaders]);


//   useEffect(() => {
//     let cancelled = false;

//     async function initialise() {
//       setProblems([]);
//       setSelectedProblem(null);
//       setCodes(readDrafts(draftKey));
//       setVisibleTestCases([]);
//       setAttempt(null);
//       setAttemptedProblems({});
//       setElapsedByProblem({});
//       setFinalized(false);
//       finalizedRef.current = false;
//       setFinalizing(false);
//       setExecutionResult(null);
//       setSubmissionId(null);
//       setFrozen(false);
//       frozenRef.current = false;
//       setWarning("");

//       if (!testId) {
//         setLoadingProblems(false);
//         setAttemptLoading(false);
//         setError("Test information is missing.");
//         return;
//       }

//       const attemptData = await startAttempt();
//       if (cancelled) return;

//       if (!attemptData) {
//         setLoadingProblems(false);
//         return;
//       }

//       // Refresh / dobara login ke baad bhi freeze bana rahe
//       const sessionData = await fetchSession();
//       if (cancelled) return;

//       // Teacher ne test end kar diya tha
//       if (sessionData?.ended) {
//         setLoadingProblems(false);
//         setTimeout(() => {
//           autoSubmitRef.current?.(true, endedMessage(sessionData));
//         }, 0);
//         return;
//       }

//       if (sessionData?.status === "frozen") {
//         enterFrozen(sessionData);
//         setLoadingProblems(false);
//         return;
//       }

//       if (sessionData) {
//         setSession((previous) => ({ ...previous, ...pickSession(sessionData) }));
//       }

//       await loadProblems();
//     }

//     initialise();

//     return () => {
//       cancelled = true;
//     };
//   }, [testId, draftKey, startAttempt, loadProblems, fetchSession, enterFrozen]);

//   useEffect(() => {
//     selectedProblemRef.current = selectedProblem;
//   }, [selectedProblem]);

//   useEffect(() => {
//     if (!selectedProblem) {
//       setVisibleTestCases([]);
//       return;
//     }

//     loadVisibleTestCases(selectedProblem.problem_id);

//     setCodes((previous) => {
//       if (previous[selectedProblem.problem_id] !== undefined) {
//         return previous;
//       }

//       return {
//         ...previous,
//         [selectedProblem.problem_id]: getDefaultCode(),
//       };
//     });

//     setExecutionResult(null);
//     setSubmissionId(null);
//     lastActivityRef.current = Date.now();
//   }, [selectedProblem, loadVisibleTestCases, getDefaultCode]);

//   // Code ka draft isi browser mein save (refresh / freeze ke baad bhi bacha rahe)
//   useEffect(() => {
//     if (!testId || finalizedRef.current) return;

//     try {
//       localStorage.setItem(draftKey, JSON.stringify(codes));
//     } catch {
//       /* storage full / blocked: ignore */
//     }
//   }, [codes, testId, draftKey, finalized]);


//   useEffect(() => {
//     if (!testId || !selectedProblem || finalized || !attempt || frozen) return;

//     const problemId = selectedProblem.problem_id;
//     lastActivityRef.current = Date.now();

//     const sendActivity = async () => {
//       const now = Date.now();
//       const elapsed = Math.max(
//         0,
//         Math.floor((now - lastActivityRef.current) / 1000)
//       );

//       lastActivityRef.current = now;

//       if (elapsed > 0) {
//         setElapsedByProblem((previous) => ({
//           ...previous,
//           [problemId]: (previous[problemId] || 0) + elapsed,
//         }));
//       }

//       try {
//         const response = await fetch(
//           `${API_BASE}/api/tests/${testId}/activity`,
//           {
//             method: "POST",
//             headers: authHeaders,
//             body: JSON.stringify({
//               problem_id: problemId,
//               event_type: "heartbeat",
//               elapsed_seconds: elapsed,
//             }),
//           }
//         );

//         if (!response.ok) {
//           const data = await response.json().catch(() => ({}));
//           console.warn("Activity update failed:", data.error);
//         }
//       } catch (err) {
//         console.warn("Activity heartbeat failed:", err);
//       }
//     };

//     activityTimerRef.current = setInterval(sendActivity, 15000);

//     return () => {
//       if (activityTimerRef.current) {
//         clearInterval(activityTimerRef.current);
//         activityTimerRef.current = null;
//       }


//       const elapsed = Math.max(
//         0,
//         Math.floor((Date.now() - lastActivityRef.current) / 1000)
//       );

//       if (elapsed > 0) {
//         setElapsedByProblem((previous) => ({
//           ...previous,
//           [problemId]: (previous[problemId] || 0) + elapsed,
//         }));
//       }
//     };
//   }, [testId, selectedProblem, finalized, attempt, authHeaders, frozen]);

//   useEffect(() => {
//     if (!test?.end_time) {
//       setTimeLeft(null);
//       return;
//     }

//     const updateTimer = () => {
//       const remaining = new Date(test.end_time).getTime() - Date.now();
//       setTimeLeft(Math.max(0, remaining));
//     };

//     updateTimer();
//     const interval = setInterval(updateTimer, 1000);

//     return () => clearInterval(interval);
//   }, [test?.end_time]);

//   /* ============================================================
//      PROCTORING: TAB-SWITCH MONITORING
//      6 switch tak sirf warning. 7th switch par test freeze.
//      ============================================================ */

//   const monitoring =
//     attempt?.status === "in_progress" && !finalized && !frozen;

//   useEffect(() => {
//     if (!monitoring || !testId || !token) return undefined;

//     const report = async (reason) => {
//       if (
//         finalizedRef.current ||
//         frozenRef.current ||
//         suppressRef.current
//       ) {
//         return;
//       }

//       // visibilitychange + blur ek hi switch par dono aate hain
//       const now = Date.now();
//       if (now - lastSwitchRef.current < 2000) return;
//       lastSwitchRef.current = now;

//       try {
//         const response = await fetch(
//           `${API_BASE}/api/tests/${testId}/tab-switch`,
//           {
//             method: "POST",
//             headers: authHeaders,
//             body: JSON.stringify({ reason }),
//           }
//         );

//         const data = await response.json().catch(() => ({}));

//         if (response.status === 423) {
//           enterFrozen(data);
//           return;
//         }

//         if (!response.ok) return;

//         setSession((previous) => ({ ...previous, ...pickSession(data) }));

//         if (data.ended) {
//           autoSubmitRef.current?.(true, endedMessage(data));
//           return;
//         }

//         if (data.status === "frozen") {
//           enterFrozen(data);
//           return;
//         }

//         if (data.counted) {
//           showWarning(tabSwitchMessage(data), tabSwitchLevel(data));
//         }
//       } catch (err) {
//         console.warn("Tab-switch report failed:", err);
//       }
//     };

//     const onVisibility = () => {
//       if (document.visibilityState === "hidden") {
//         report("tab_hidden");
//       }
//     };

//     const onBlur = () => report("window_blur");

//     document.addEventListener("visibilitychange", onVisibility);
//     window.addEventListener("blur", onBlur);

//     return () => {
//       document.removeEventListener("visibilitychange", onVisibility);
//       window.removeEventListener("blur", onBlur);
//     };
//   }, [monitoring, testId, token, authHeaders, enterFrozen, showWarning]);

//   // Teacher ne test freeze ya end kiya ho to student ko pata chale
//   useEffect(() => {
//     if (!monitoring || !testId || !token) return undefined;

//     const timer = setInterval(async () => {
//       if (finalizedRef.current || frozenRef.current) return;

//       const data = await fetchSession();

//       if (!data) return;

//       if (data.ended) {
//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       if (data.status === "frozen") {
//         enterFrozen(data);
//       }
//     }, SESSION_POLL_MS);

//     return () => clearInterval(timer);
//   }, [monitoring, testId, token, fetchSession, enterFrozen]);

//   // Freeze ke dauran teacher ke unlock / end ka intezaar
//   useEffect(() => {
//     if (!frozen || finalized) return undefined;

//     const timer = setInterval(async () => {
//       const data = await fetchSession();

//       if (!data) return;

//       // Teacher ne "End test" kiya: test submit ho jata hai
//       if (data.ended) {
//         frozenRef.current = false;
//         setFrozen(false);

//         autoSubmitRef.current?.(true, endedMessage(data));
//         return;
//       }

//       // Teacher ne unlock kiya
//       if (data.status !== "frozen") {
//         frozenRef.current = false;
//         lastSwitchRef.current = Date.now();

//         setSession((previous) => ({ ...previous, ...pickSession(data) }));
//         setFrozen(false);

//         showWarning(
//           "Your teacher reviewed the activity and allowed you to continue the test.",
//           "info"
//         );

//         await loadProblems();
//       }
//     }, 5000);

//     return () => clearInterval(timer);
//   }, [frozen, finalized, fetchSession, loadProblems, showWarning]);

//   useEffect(() => {
//     return () => {
//       if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
//     };
//   }, []);

//   /* ============================================================
//      EDITOR HANDLERS
//      ============================================================ */

//   const handleProblemSelect = (problem) => {
//     if (finalized || finalizing || frozen) return;
//     setSelectedProblem(problem);
//   };

//   const handleCodeChange = (value) => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;

//     setCodes((previous) => ({
//       ...previous,
//       [selectedProblem.problem_id]: value,
//     }));
//   };

//   const resetToDefaultCode = () => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;
//     if (
//       withSuppressed(() =>
//         window.confirm(
//           "Reset code to the default starter template for this problem? Any unsaved edits will be replaced."
//         )
//       )
//     ) {
//       const def = getDefaultCode(language);
//       handleCodeChange(def);
//     }
//   };

//   const handleLanguageChange = (value) => {
//     if (!selectedProblem || finalized || finalizing || frozen) return;

//     setLanguage(value);
//     setCodes((previous) => ({
//       ...previous,
//       [selectedProblem.problem_id]:
//         getDefaultCode(value),
//     }));
//     setExecutionResult(null);
//   };

//   const pollResult = async (id) => {
//     if (!id) {
//       setExecutionLoading(false);
//       return;
//     }

//     // Server busy ho (queue lambi ho) to bhi result aane tak intezaar karo.
//     const startedAt = Date.now();
//     const maxWaitMs = 3 * 60 * 1000;
//     let delay = 500;
//     let failures = 0;

//     const checkResult = async () => {
//       try {
//         const response = await fetch(`${API_BASE}/result/${id}`, {
//           method: "GET",
//           headers: authHeaders,
//         });

//         const data = await response.json().catch(() => ({}));

//         if (!response.ok) {
//           throw new Error(data.error || "Failed to get execution result.");
//         }

//         setExecutionResult(data);

//         if (data.status === "completed") {
//           setExecutionLoading(false);
//           return;
//         }

//         failures = 0;

//         if (Date.now() - startedAt >= maxWaitMs) {
//           setExecutionResult({
//             status: "completed",
//             verdict: "SYSTEM ERROR",
//             output:
//               "The server is very busy and your code is still waiting in the queue. Please try again in a minute.",
//           });
//           setExecutionLoading(false);
//           return;
//         }

//         // Shuru mein jaldi, phir dheere: bhaari load mein server par bojh kam
//         delay = Math.min(2000, Math.round(delay * 1.25));
//         setTimeout(checkResult, delay);
//       } catch (err) {
//         console.error("Result polling error:", err);

//         failures += 1;

//         // Ek-do baar network ki chhoti galti ho to dobara koshish
//         if (failures < 3 && Date.now() - startedAt < maxWaitMs) {
//           setTimeout(checkResult, 1500);
//           return;
//         }

//         setExecutionResult({
//           status: "completed",
//           verdict: "SYSTEM ERROR",
//           output: err.message,
//         });
//         setExecutionLoading(false);
//       }
//     };

//     await checkResult();
//   };

//   const postSubmissionActivity = async (id, problemId) => {
//     if (!testId || !id || !problemId) return;

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/record-submission`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({
//             submission_id: id,
//             problem_id: problemId,
//           }),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         console.warn("Could not record attempt submission:", data.error);
//       }
//     } catch (err) {
//       console.warn("Record submission request failed:", err);
//     }
//   };

//   const submitCodeToBackend = async (endpoint, actionLabel) => {
//     if (
//       !selectedProblem ||
//       executionLoading ||
//       finalized ||
//       finalizing ||
//       frozen
//     ) {
//       return;
//     }

//     if (!token) {
//       setError("Your session has expired. Please log in again.");
//       return;
//     }

//     if (testStatus !== "Active") {
//       setError(
//         testStatus === "Upcoming"
//           ? "This test has not started yet."
//           : "This test has ended."
//       );
//       return;
//     }

//     const problemId = selectedProblem.problem_id;
//     const code = codes[problemId] ?? getDefaultCode();

//     if (!code.trim()) {
//       setError("Code cannot be empty.");
//       return;
//     }

//     setError("");
//     setExecutionLoading(true);
//     setExecutionResult({
//       status: "queued",
//       verdict: null,
//       output: `${actionLabel} sent for execution...`,
//     });
//     setSubmissionId(null);

//     try {
//       const response = await fetch(`${API_BASE}${endpoint}`, {
//         method: "POST",
//         headers: authHeaders,
//         body: JSON.stringify({
//           code,
//           problem_id: problemId,
//           language,
//         }),
//       });

//       const data = await response.json().catch(() => ({}));

//       // 423 = teacher ne test freeze kiya hua hai
//       if (response.status === 423) {
//         setExecutionLoading(false);
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || `Failed to ${actionLabel.toLowerCase()}.`);
//       }

//       const id = data.run_id || data.submission_id;

//       if (!id) {
//         throw new Error("Backend did not return a run or submission ID.");
//       }

//       setSubmissionId(id);
//       setAttemptedProblems((previous) => ({
//         ...previous,
//         [problemId]: true,
//       }));

//       if (endpoint === "/submit") {
//         await postSubmissionActivity(id, problemId);
//       }

//       setExecutionResult({
//         status: "queued",
//         verdict: null,
//         output: "Your code is waiting for execution...",
//       });

//       await pollResult(id);
//     } catch (err) {
//       console.error(`${actionLabel} error:`, err);
//       setExecutionResult({
//         status: "completed",
//         verdict: "SYSTEM ERROR",
//         output: err.message,
//       });
//       setExecutionLoading(false);
//     }
//   };

//   const handleRunCode = () => submitCodeToBackend("/run", "Run Code");

//   const handleSubmit = () => submitCodeToBackend("/submit", "Submit");


//   // automatic = true: timer khatam hua ya teacher ne test end kiya.
//   // endedReason: teacher ke end karne ka message.
//   const handleFinalSubmit = async (automatic = false, endedReason = "") => {
//     if (finalizedRef.current || finalizing || !testId) return;

//     const confirmed = automatic
//       ? true
//       : withSuppressed(() =>
//           window.confirm(
//             "Are you sure you want to submit the test? You cannot continue editing after final submission."
//           )
//         );

//     if (!confirmed) return;

//     setFinalizing(true);
//     setError("");

//     try {
//       const response = await fetch(
//         `${API_BASE}/api/tests/${testId}/final-submit`,
//         {
//           method: "POST",
//           headers: authHeaders,
//           body: JSON.stringify({
//             status: automatic ? "auto_submitted" : "submitted",
//           }),
//         }
//       );

//       const data = await response.json().catch(() => ({}));

//       if (response.status === 423) {
//         enterFrozen(data);
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(data.error || "Could not finalize the test.");
//       }

//       finalizedRef.current = true;
//       setFinalized(true);

//       // Submit ho gaya, ab draft ki zarurat nahi
//       try {
//         localStorage.removeItem(draftKey);
//       } catch {
//         /* ignore */
//       }

//       // Test successfully submitted
//       if (activityTimerRef.current) {
//         clearInterval(activityTimerRef.current);
//         activityTimerRef.current = null;
//       }

//       setTimeout(() => {
//         if (typeof onBack === "function") {
//           onBack(true);
//         }
//       }, 1500);

//       setAttempt((previous) => ({
//         ...(previous || {}),
//         ...(data.attempt || {}),
//         status: automatic ? "auto_submitted" : "submitted",
//       }));

//       withSuppressed(() =>
//         window.alert(
//           endedReason
//             ? endedReason
//             : automatic
//               ? "Time is over. Your test has been auto-submitted."
//               : "Your test has been submitted successfully."
//         )
//       );
//     } catch (err) {
//       console.error("Final submission error:", err);
//       setError(err.message || "Could not finalize the test.");
//     } finally {
//       setFinalizing(false);
//     }
//   };

//   autoSubmitRef.current = handleFinalSubmit;

//   // Auto-submit sirf tab, jab timer zero ho jaye.
//   useEffect(() => {
//     if (
//       timeLeft === 0 &&
//       !finalized &&
//       !finalizing &&
//       attempt
//     ) {
//       handleFinalSubmit(true);
//     }
//     // handleFinalSubmit is intentionally invoked only when the timer expires.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [timeLeft, finalized, finalizing, attempt]);

//   const attemptedCount = Object.keys(attemptedProblems).filter(
//     (key) => attemptedProblems[key]
//   ).length;

//   const switchMax = session.max_switches;

//   if (loadingProblems || attemptLoading) {
//     return (
//       <div className="student-test-loading">
//         <Loader2 size={28} className="spin" />
//         <span>Loading test...</span>
//       </div>
//     );
//   }

//   return (
//     <div className="student-test-page">
//       <header className="student-test-topbar">
//         <div className="student-test-brand">
//           <button
//             className="student-back-btn"
//             onClick={() => onBack && onBack(false)}
//             disabled={finalizing}
//             aria-label="Go back"
//           >
//             <ArrowLeft size={18} />
//           </button>

//           <div>
//             <div className="student-brand-name">CodeShield</div>
//             <div className="student-brand-subtitle">
//               Student Workspace
//             </div>
//           </div>
//         </div>

//         <div className="student-test-title">
//           <span>{test?.title || "Coding Test"}</span>
//           <span
//             className={
//               testStatus === "Active"
//                 ? "student-status active"
//                 : "student-status"
//             }
//           >
//             {finalized ? "Submitted" : testStatus}
//           </span>
//         </div>

//         <div className="student-topbar-right">
//           <div
//             className={`switch-chip ${
//               session.tab_switch_count >= switchMax
//                 ? "danger"
//                 : session.tab_switch_count > 0
//                   ? "warn"
//                   : ""
//             }`}
//             title={`You can switch tabs ${switchMax} times. After that your test is frozen until your teacher unlocks it.`}
//           >
//             <AlertTriangle size={14} />
//             Tab switches {session.tab_switch_count}/{switchMax}
//           </div>

//           <div className="student-timer">
//             <Clock3 size={17} />
//             <div>
//               <span>Time Remaining</span>
//               <strong>{formatTime(timeLeft)}</strong>
//             </div>
//           </div>
//         </div>
//       </header>

//       {warning && (
//         <div
//           className={`proctor-warning ${
//             warningType === "info" ? "proctor-info" : ""
//           }`}
//           role="alert"
//         >
//           <AlertTriangle size={16} />
//           {warning}
//         </div>
//       )}

//       {error && (
//         <div className="student-test-error" role="alert">
//           {error}
//         </div>
//       )}

//       {finalized && (
//         <div className="student-test-error">
//           Your test has been submitted. Editing and new submissions are disabled.
//         </div>
//       )}

//       <div className="student-test-body">
//         <aside className="student-problem-sidebar">
//           <div className="student-sidebar-header">
//             <div>
//               <span>ASSESSMENT</span>
//               <h2>Problems</h2>
//             </div>
//             <div className="problem-count">{problems.length}</div>
//           </div>

//           <div className="student-problem-list">
//             {problems.length === 0 ? (
//               <div className="no-problems">
//                 No problems available.
//               </div>
//             ) : (
//               problems.map((problem, index) => (
//                 <button
//                   key={problem.problem_id}
//                   className={
//                     selectedProblem?.problem_id === problem.problem_id
//                       ? "student-problem-item selected"
//                       : "student-problem-item"
//                   }
//                   onClick={() => handleProblemSelect(problem)}
//                   disabled={finalized || finalizing}
//                 >
//                   <div className="problem-number">{index + 1}</div>

//                   <div className="problem-item-content">
//                     <strong>{problem.title}</strong>
//                     <div className="problem-meta">
//                       <span
//                         className={`difficulty ${String(
//                           problem.difficulty || "Easy"
//                         ).toLowerCase()}`}
//                       >
//                         {problem.difficulty || "Easy"}
//                       </span>
//                       <span>{problem.time_limit_ms ?? 1000} ms</span>
//                     </div>
//                     {attemptedProblems[problem.problem_id] && (
//                       <small>Attempted</small>
//                     )}
//                   </div>

//                   <ChevronRight size={17} className="problem-arrow" />
//                 </button>
//               ))
//             )}
//           </div>

//           <div className="student-sidebar-footer">
//             <div className="progress-label">
//               <span>Attempted</span>
//               <span>
//                 {attemptedCount} / {problems.length}
//               </span>
//             </div>
//             <div className="progress-track">
//               <div
//                 className="progress-fill"
//                 style={{
//                   width: `${
//                     problems.length
//                       ? (attemptedCount / problems.length) * 100
//                       : 0
//                   }%`,
//                 }}
//               />
//             </div>
//           </div>
//         </aside>

//         <main className="student-problem-panel">
//           {!selectedProblem ? (
//             <div className="empty-problem">
//               <FileText size={40} />
//               <h2>Select a problem</h2>
//               <p>
//                 Choose a problem from the left panel to start solving.
//               </p>
//             </div>
//           ) : (
//             <>
//               <div className="problem-header">
//                 <div>
//                   <div className="problem-heading-row">
//                     <h1>{selectedProblem.title}</h1>
//                     <span
//                       className={`difficulty large ${String(
//                         selectedProblem.difficulty || "Easy"
//                       ).toLowerCase()}`}
//                     >
//                       {selectedProblem.difficulty || "Easy"}
//                     </span>
//                   </div>
//                   <p>
//                     Problem #
//                     {problems.findIndex(
//                       (problem) =>
//                         problem.problem_id === selectedProblem.problem_id
//                     ) + 1}
//                   </p>
//                 </div>
//               </div>

//               <section className="problem-section">
//                 <div className="section-heading">
//                   <FileText size={17} />
//                   <h2>Problem Statement</h2>
//                 </div>
//                 <div className="problem-statement">
//                   {selectedProblem.statement}
//                 </div>
//               </section>

//               <section className="problem-limits">
//                 <div className="limit-card">
//                   <Clock3 size={18} />
//                   <div>
//                     <span>Time Limit</span>
//                     <strong>
//                       {selectedProblem.time_limit_ms ?? 1000} ms
//                     </strong>
//                   </div>
//                 </div>

//                 <div className="limit-card">
//                   <MemoryStick size={18} />
//                   <div>
//                     <span>Memory Limit</span>
//                     <strong>
//                       {selectedProblem.memory_limit_mb ?? 256} MB
//                     </strong>
//                   </div>
//                 </div>
//               </section>

//               <section className="problem-section">
//                 <div className="section-heading">
//                   <Eye size={17} />
//                   <h2>Examples</h2>
//                   <span className="example-count">
//                     {visibleTestCases.length}
//                   </span>
//                 </div>

//                 {loadingTestCases ? (
//                   <div className="examples-loading">
//                     <Loader2 size={17} className="spin" />
//                     Loading examples...
//                   </div>
//                 ) : visibleTestCases.length === 0 ? (
//                   <div className="no-examples">
//                     No visible examples available for this problem.
//                   </div>
//                 ) : (
//                   <div className="examples-list">
//                     {visibleTestCases.map((testCase, index) => (
//                       <div
//                         className="example-card"
//                         key={testCase.testcase_id ?? index}
//                       >
//                         <div className="example-header">
//                           <span>Example {index + 1}</span>
//                           <CheckCircle2 size={15} />
//                         </div>

//                         <div className="example-grid">
//                           <div>
//                             <label>Input</label>
//                             <pre>{testCase.input}</pre>
//                           </div>
//                           <div>
//                             <label>Expected Output</label>
//                             <pre>{testCase.expected_output}</pre>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </section>
//             </>
//           )}
//         </main>

//         <section className="student-editor-panel">
//           <div className="editor-header">
//             <div className="editor-title">
//               <Code2 size={18} />
//               <span>Code Editor</span>
//             </div>

//             <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//               <div style={{ display: "flex", gap: "3px" }}>
//                 <button
//                   type="button"
//                   className="editor-tool-btn"
//                   onClick={() => setEditorFontSize((s) => Math.max(11, s - 1))}
//                   title="Decrease font size"
//                 >
//                   A-
//                 </button>
//                 <button
//                   type="button"
//                   className="editor-tool-btn"
//                   onClick={() => setEditorFontSize((s) => Math.min(22, s + 1))}
//                   title="Increase font size"
//                 >
//                   A+
//                 </button>
//               </div>

//               <button
//                 type="button"
//                 className="editor-tool-btn"
//                 onClick={resetToDefaultCode}
//                 title="Reset code to default template"
//                 disabled={finalized || finalizing || frozen}
//               >
//                 <RotateCcw size={13} /> Reset
//               </button>

//               <select
//                 value={language}
//                 onChange={(event) => handleLanguageChange(event.target.value)}
//                 disabled={finalized || finalizing || executionLoading}
//               >
//                 <option value="cpp">C++</option>
//                 <option value="java">Java</option>
//                 <option value="python">Python</option>
//               </select>
//             </div>
//           </div>

//           <div className="editor-container">
//             <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
//               <div style={{ position: "absolute", inset: 0 }}>
//                 <Editor
//                   height="100%"
//                   theme="vs-dark"
//                   path={
//                     selectedProblem
//                       ? `problem-${selectedProblem.problem_id}.${language}`
//                       : "empty"
//                   }
//                   language={language}
//                   value={
//                     selectedProblem
//                       ? codes[selectedProblem.problem_id] ?? getDefaultCode()
//                       : ""
//                   }
//                   onChange={(value) => handleCodeChange(value ?? "")}
//                   loading={
//                     <div className="examples-loading">
//                       <Loader2 size={17} className="spin" /> Loading editor...
//                     </div>
//                   }
//                   options={{
//                     readOnly: !selectedProblem || finalized || finalizing || frozen,
//                     minimap: { enabled: false },
//                     fontSize: editorFontSize,
//                     tabSize: 4,
//                     automaticLayout: true,
//                     scrollBeyondLastLine: false,
//                     padding: { top: 14 },
//                     fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
//                   }}
//                 />
//               </div>
//             </div>
//           </div>

//           <div className="editor-footer">
//             <div className="editor-info">
//               <span>
//                 {language === "cpp"
//                   ? "C++17"
//                   : language === "java"
//                     ? "Java"
//                     : "Python 3"}
//               </span>
//               <span>Auto-save: Local</span>
//             </div>

//             <div className="editor-actions">
//               <button
//                 className="run-button"
//                 onClick={handleRunCode}
//                 disabled={
//                   !selectedProblem ||
//                   executionLoading ||
//                   finalized ||
//                   finalizing ||
//                   frozen
//                 }
//               >
//                 {executionLoading ? (
//                   <Loader2 size={16} className="spin" />
//                 ) : (
//                   <Play size={16} />
//                 )}
//                 {executionLoading ? "Running..." : "Run Code"}
//               </button>

//               <button
//                 className="submit-button"
//                 onClick={handleSubmit}
//                 disabled={
//                   !selectedProblem ||
//                   executionLoading ||
//                   finalized ||
//                   finalizing ||
//                   frozen
//                 }
//               >
//                 <Send size={16} />
//                 Submit
//               </button>
//             </div>
//           </div>

//           <div className="execution-result-panel">
//             <div className="execution-result-header">
//               <div>
//                 <strong>Execution Result</strong>
//                 {executionLoading && (
//                   <span className="execution-running">
//                     <Loader2 size={15} className="spin" />
//                     Running...
//                   </span>
//                 )}
//               </div>

//               {executionResult?.verdict && (
//                 <span
//                   className={`execution-verdict ${
//                     ["AC", "Accepted"].includes(executionResult.verdict)
//                       ? "success"
//                       : "failed"
//                   }`}
//                 >
//                   {executionResult.verdict}
//                 </span>
//               )}
//             </div>

//             <div className="execution-result-body">
//               {!executionResult ? (
//                 <div className="execution-empty">
//                   <Code2 size={22} />
//                   <span>Run your code to see the result.</span>
//                 </div>
//               ) : (
//                 <>
//                   <div className="execution-status">
//                     <span>Status</span>
//                     <strong>{executionResult.status}</strong>
//                   </div>

//                   {executionResult.execution_time_ms !== undefined && (
//                     <div className="execution-status">
//                       <span>Execution Time</span>
//                       <strong>
//                         {executionResult.execution_time_ms} ms
//                       </strong>
//                     </div>
//                   )}

//                   {executionResult.test_cases_total !== undefined && (
//                     <div className="execution-status">
//                       <span>Test Cases</span>
//                       <strong>
//                         {executionResult.test_cases_passed ?? 0}
//                         {" / "}
//                         {executionResult.test_cases_total}
//                       </strong>
//                     </div>
//                   )}

//                   <div className="execution-output">
//                     <div className="output-title">Output</div>
//                     <pre>
//                       {executionResult.output ||
//                         executionResult.stderr ||
//                         "No output"}
//                     </pre>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>

//           <div className="editor-footer">
//             <div className="editor-info">
//               <span>
//                 Questions attempted: {attemptedCount}/{problems.length}
//               </span>
//             </div>

//             <div className="editor-actions">
//               <button
//                 className="submit-button"
//                 onClick={() => handleFinalSubmit(false)}
//                 disabled={finalized || finalizing || !attempt || frozen}
//               >
//                 {finalizing && <Loader2 size={16} className="spin" />}
//                 {finalizing ? "Submitting Test..." : "Final Submit Test"}
//               </button>
//             </div>
//           </div>
//         </section>
//       </div>

//       {/* CAMERA MONITORING: consent + live preview. Alerts sirf teacher ko jaate hain. */}
//       <EyeMonitor
//         active={attempt?.status === "in_progress" && !finalized}
//         paused={frozen}
//         identity={identityApi}
//         onViolation={reportGaze}
//         onStartingChange={handleCameraStarting}
//       />

//       {/* FREEZE SCREEN: sirf Logout ka option */}
//       {frozen && !finalized && (
//         <div className="freeze-overlay" role="alertdialog" aria-modal="true">
//           <div className="freeze-card">
//             <div className="freeze-icon">
//               <Lock size={30} />
//             </div>

//             <h2>Your test is frozen</h2>

//             <p>
//               Your test is frozen. You cannot continue until your teacher
//               reviews it and approves.
//             </p>

//             <div className="freeze-reason">
//               {session.freeze_reason ||
//                 `You switched tabs more than ${switchMax} times.`}
//             </div>

//             <div className="freeze-waiting">
//               <Loader2 size={15} className="spin" />
//               Waiting for your teacher...
//             </div>

//             <div>
//               <button
//                 type="button"
//                 className="freeze-logout"
//                 onClick={handleLogout}
//               >
//                 <LogOut size={16} />
//                 Logout
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default StudentTestPage;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Code2,
  FileText,
  Lock,
  LogOut,
  MemoryStick,
  Play,
  Send,
  ChevronRight,
  CheckCircle2,
  Eye,
  Loader2,
  RotateCcw,
} from "lucide-react";
import EyeMonitor from "./EyeMonitor.jsx";
import "./StudentTestPage.css";
import "./Proctoring.css";
import Editor from "@monaco-editor/react";

const API_BASE = "http://localhost:5000";

// Server MAX_TAB_SWITCHES bhejta hai; yeh sirf shuruaati default hai.
// 6 switch tak allowed, 7th switch par test freeze.
const DEFAULT_MAX_SWITCHES = 6;

// Session status itne ms mein check hota hai (teacher ke freeze / end ke liye)
const SESSION_POLL_MS = 10000;

// Gambhir cases: photo teacher ko jati hai (student ko kuch nahi dikhta)
const INCIDENT_TYPES = ["MULTI_FACE", "FACE_MISMATCH"];

// Ye alert pehle jaise /gaze-event se bhi gine jayenge (auto-submit ka hisaab
// wahi rahega), aur saath mein photo wala incident bhi banega (Incidents tab ke liye).
const PHOTO_ALERT_TYPES = ["NO_FACE", "CAMERA_OFF"];

/* ============================================================
   HELPERS
   ============================================================ */

// Alert ke saath photo na aaye to live camera preview se frame le leta hai
function captureFrame() {
  try {
    const video = document.querySelector("video");

    if (!video || !video.videoWidth) return null;

    const scale = Math.min(1, 640 / video.videoWidth);
    const canvas = document.createElement("canvas");

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

// JWT se user_id nikalta hai (sirf draft ki key banane ke liye).
function tokenUserId(token) {
  try {
    const payload = token
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    return JSON.parse(atob(payload)).user_id ?? "anon";
  } catch {
    return "anon";
  }
}

function readDrafts(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// Har (problem, language) ka apna code. Language badalne par code udta nahi.
function codeKey(problemId, lang) {
  return `${problemId}:${lang}`;
}

function readLanguage(key) {
  try {
    const value = localStorage.getItem(key);
    return ["cpp", "java", "python"].includes(value) ? value : "cpp";
  } catch {
    return "cpp";
  }
}

function tabSwitchMessage(data) {
  const count = data.tab_switch_count ?? 0;
  const max = data.max_switches ?? DEFAULT_MAX_SWITCHES;
  const left = max - count;

  return (
    `Tab switch detected (${count} of ${max} allowed). ` +
    (left > 0
      ? `${left} more ${
          left === 1 ? "switch is" : "switches are"
        } allowed. After that your test will be FROZEN until your teacher unlocks it.`
      : "The next switch will FREEZE your test until your teacher unlocks it.")
  );
}

function tabSwitchLevel(data) {
  const left =
    (data.max_switches ?? DEFAULT_MAX_SWITCHES) -
    (data.tab_switch_count ?? 0);

  return left > 0 ? "warn" : "danger";
}

function endedMessage(data) {
  return (
    data?.freeze_reason ||
    "Your teacher ended your test after reviewing suspicious activity."
  );
}

function pickSession(data) {
  return {
    tab_switch_count: data?.tab_switch_count ?? 0,
    max_switches: data?.max_switches ?? DEFAULT_MAX_SWITCHES,
    freeze_reason: data?.freeze_reason || "",
  };
}

function StudentTestPage({ test, onBack, onLogout }) {
  const token = localStorage.getItem("codeshield_token");
  const testId = test?.contest_id;
  const draftKey = `codeshield_drafts_v2_${testId}_${tokenUserId(token)}`;
  const languageKey = `codeshield_lang_${testId}_${tokenUserId(token)}`;

  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [codes, setCodes] = useState(() => readDrafts(draftKey));
  const [visibleTestCases, setVisibleTestCases] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [loadingTestCases, setLoadingTestCases] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState(() => readLanguage(languageKey));
  const [timeLeft, setTimeLeft] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [attemptLoading, setAttemptLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [attemptedProblems, setAttemptedProblems] = useState({});
  const [elapsedByProblem, setElapsedByProblem] = useState({});
  const [editorFontSize, setEditorFontSize] = useState(14);

  // Proctoring
  const [frozen, setFrozen] = useState(false);
  const [session, setSession] = useState({
    tab_switch_count: 0,
    max_switches: DEFAULT_MAX_SWITCHES,
    freeze_reason: "",
  });
  const [warning, setWarning] = useState("");
  const [warningType, setWarningType] = useState("warn");

  const activityTimerRef = useRef(null);
  const selectedProblemRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const finalizedRef = useRef(false);

  const frozenRef = useRef(false);
  const suppressRef = useRef(false);
  const lastSwitchRef = useRef(0);
  const warningTimerRef = useRef(null);
  const autoSubmitRef = useRef(null);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token || ""}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const getDefaultCode = useCallback((lang = language) => {
    if (lang === "cpp") {
      return `#include <iostream>
#include <vector>
#include <string>
using namespace std;

int main() {
    // Write your solution here
    return 0;
}`;
    }

    if (lang === "java") {
      return `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your solution here
    }
}`;
    }

    return `# Write your solution here
`;
  }, [language]);

  const testStatus = useMemo(() => {
    if (!test) return "Unavailable";

    const now = Date.now();
    const start = test.start_time
      ? new Date(test.start_time).getTime()
      : 0;
    const end = test.end_time
      ? new Date(test.end_time).getTime()
      : Infinity;

    if (now < start) return "Upcoming";
    if (now >= end) return "Ended";
    return "Active";
  }, [test]);

  const formatTime = useCallback((milliseconds) => {
    if (milliseconds == null || milliseconds <= 0) {
      return "00:00:00";
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }, []);

  /* ============================================================
     PROCTORING: FREEZE / SESSION
     ============================================================ */

  // Test freeze ho gaya: screen par ka content hata do.
  const enterFrozen = useCallback((data) => {
    if (data) {
      setSession((previous) => ({ ...previous, ...pickSession(data) }));
    }

    frozenRef.current = true;
    setFrozen(true);
    setProblems([]);
    setSelectedProblem(null);
    setVisibleTestCases([]);
    setExecutionResult(null);
    setWarning("");
  }, []);

  const fetchSession = useCallback(async () => {
    if (!testId || !token) return null;

    try {
      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/session`,
        { method: "GET", headers: authHeaders }
      );

      const data = await response.json().catch(() => ({}));

      return response.ok ? data : null;
    } catch {
      return null;
    }
  }, [testId, token, authHeaders]);

  const showWarning = useCallback((message, type = "warn") => {
    setWarning(message);
    setWarningType(type);

    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    warningTimerRef.current = setTimeout(() => setWarning(""), 10000);
  }, []);

  // Camera alert: sirf teacher ko jata hai. Student ko koi warning nahi,
  // test rukta bhi nahi.
  const reportGaze = useCallback(async ({ type, durationMs, snapshot, photo }) => {
    if (finalizedRef.current || frozenRef.current || !testId) return;

    const isIncident = INCIDENT_TYPES.includes(type);

    // Face not visible / camera off: gaze-event bhi (neeche) aur photo wala
    // incident bhi (yahan). count:false = dobara gina nahi jata.
    if (PHOTO_ALERT_TYPES.includes(type)) {
      fetch(`${API_BASE}/api/tests/${testId}/incident`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          kind: type,
          photo: snapshot || photo || captureFrame(),
          count: false,
        }),
      }).catch(() => {});
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/${isIncident ? "incident" : "gaze-event"}`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(
            isIncident
              ? { kind: type, photo: snapshot || photo || null }
              : { event_type: type, duration_ms: durationMs }
          ),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 423) {
        enterFrozen(data);
        return;
      }

      if (!response.ok) return;

      setSession((previous) => ({ ...previous, ...pickSession(data) }));

      // Teacher ne is dauran test end ya freeze kar diya ho
      if (data.ended) {
        autoSubmitRef.current?.(true, endedMessage(data));
        return;
      }

      if (data.status === "frozen") {
        enterFrozen(data);
      }
    } catch (err) {
      console.warn("Gaze report failed:", err);
    }
  }, [testId, authHeaders, enterFrozen]);

  // Camera permission popup khulne par browser blur bhejta hai;
  // use tab switch na ginna.
  const handleCameraStarting = useCallback((starting) => {
    suppressRef.current = starting;

    if (!starting) {
      lastSwitchRef.current = Date.now();
    }
  }, []);

  // Face verification (identity check) API
  const identityApi = useMemo(() => {
    const call = async (method, body) => {
      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/identity`,
        {
          method,
          headers: authHeaders,
          body: body ? JSON.stringify(body) : undefined,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Identity request failed.");
      }

      return data;
    };

    return {
      getStatus: () => call("GET"),
      submit: (payload) => call("POST", payload),
    };
  }, [testId, authHeaders]);

  // confirm() / alert() khulne par browser blur event bhejta hai;
  // usse tab switch na ginne ke liye.
  const withSuppressed = (callback) => {
    suppressRef.current = true;

    try {
      return callback();
    } finally {
      lastSwitchRef.current = Date.now();

      setTimeout(() => {
        suppressRef.current = false;
      }, 1500);
    }
  };

  const handleLogout = () => {
    if (typeof onLogout === "function") {
      onLogout();
      return;
    }

    localStorage.removeItem("codeshield_token");
    window.location.reload();
  };

  /* ============================================================
     TEST ATTEMPT / PROBLEMS
     ============================================================ */

  // Start or resume the student's single attempt for this test.
  const startAttempt = useCallback(async () => {
    if (!testId || !token) {
      setAttemptLoading(false);
      if (!token) setError("Your session has expired. Please log in again.");
      return null;
    }

    try {
      setAttemptLoading(true);

      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/start`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({}),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not start the test attempt.");
      }

      setAttempt(data.attempt || data);
      return data.attempt || data;
    } catch (err) {
      console.error("Start attempt error:", err);
      setError(err.message || "Could not start the test attempt.");
      return null;
    } finally {
      setAttemptLoading(false);
    }
  }, [testId, token, authHeaders]);

  const loadProblems = useCallback(async () => {
    if (!testId || !token) {
      setLoadingProblems(false);
      if (!token) setError("Please log in again to continue.");
      return;
    }

    try {
      setLoadingProblems(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/problems`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      const data = await response.json().catch(() => ({}));

      // 423 = test frozen
      if (response.status === 423) {
        enterFrozen(data);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to load problems.");
      }

      const loadedProblems = data.problems || [];
      setProblems(loadedProblems);

      setSelectedProblem((current) => {
        if (
          current &&
          loadedProblems.some(
            (problem) => problem.problem_id === current.problem_id
          )
        ) {
          return current;
        }

        return loadedProblems[0] || null;
      });
    } catch (err) {
      console.error("Problem loading error:", err);
      setError(err.message || "Failed to load problems.");
    } finally {
      setLoadingProblems(false);
    }
  }, [testId, token, authHeaders, enterFrozen]);

  const loadVisibleTestCases = useCallback(async (problemId) => {
    if (!problemId || !token) return;

    try {
      setLoadingTestCases(true);

      const response = await fetch(
        `${API_BASE}/api/problems/${problemId}/testcases`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to load test cases.");
      }

      setVisibleTestCases(data.testcases || []);
    } catch (err) {
      console.error("Visible testcase error:", err);
      setVisibleTestCases([]);
    } finally {
      setLoadingTestCases(false);
    }
  }, [token, authHeaders]);


  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      setProblems([]);
      setSelectedProblem(null);
      setCodes(readDrafts(draftKey));
      setVisibleTestCases([]);
      setAttempt(null);
      setAttemptedProblems({});
      setElapsedByProblem({});
      setFinalized(false);
      finalizedRef.current = false;
      setFinalizing(false);
      setExecutionResult(null);
      setSubmissionId(null);
      setFrozen(false);
      frozenRef.current = false;
      setWarning("");

      if (!testId) {
        setLoadingProblems(false);
        setAttemptLoading(false);
        setError("Test information is missing.");
        return;
      }

      const attemptData = await startAttempt();
      if (cancelled) return;

      if (!attemptData) {
        setLoadingProblems(false);
        return;
      }

      // Refresh / dobara login ke baad bhi freeze bana rahe
      const sessionData = await fetchSession();
      if (cancelled) return;

      // Teacher ne test end kar diya tha
      if (sessionData?.ended) {
        setLoadingProblems(false);
        setTimeout(() => {
          autoSubmitRef.current?.(true, endedMessage(sessionData));
        }, 0);
        return;
      }

      if (sessionData?.status === "frozen") {
        enterFrozen(sessionData);
        setLoadingProblems(false);
        return;
      }

      if (sessionData) {
        setSession((previous) => ({ ...previous, ...pickSession(sessionData) }));
      }

      await loadProblems();
    }

    initialise();

    return () => {
      cancelled = true;
    };
  }, [testId, draftKey, startAttempt, loadProblems, fetchSession, enterFrozen]);

  useEffect(() => {
    selectedProblemRef.current = selectedProblem;
  }, [selectedProblem]);

  useEffect(() => {
    if (!selectedProblem) {
      setVisibleTestCases([]);
      return;
    }

    loadVisibleTestCases(selectedProblem.problem_id);

    setExecutionResult(null);
    setSubmissionId(null);
    lastActivityRef.current = Date.now();
  }, [selectedProblem, loadVisibleTestCases]);

  // Is problem + language ka code abhi nahi hai to starter template do
  useEffect(() => {
    if (!selectedProblem) return;

    const key = codeKey(selectedProblem.problem_id, language);

    setCodes((previous) =>
      previous[key] !== undefined
        ? previous
        : { ...previous, [key]: getDefaultCode(language) }
    );
  }, [selectedProblem, language, getDefaultCode]);

  useEffect(() => {
    try {
      localStorage.setItem(languageKey, language);
    } catch {
      /* ignore */
    }
  }, [language, languageKey]);

  // Code ka draft isi browser mein save (refresh / freeze ke baad bhi bacha rahe)
  useEffect(() => {
    if (!testId || finalizedRef.current) return;

    try {
      localStorage.setItem(draftKey, JSON.stringify(codes));
    } catch {
      /* storage full / blocked: ignore */
    }
  }, [codes, testId, draftKey, finalized]);


  useEffect(() => {
    if (!testId || !selectedProblem || finalized || !attempt || frozen) return;

    const problemId = selectedProblem.problem_id;
    lastActivityRef.current = Date.now();

    const sendActivity = async () => {
      const now = Date.now();
      const elapsed = Math.max(
        0,
        Math.floor((now - lastActivityRef.current) / 1000)
      );

      lastActivityRef.current = now;

      if (elapsed > 0) {
        setElapsedByProblem((previous) => ({
          ...previous,
          [problemId]: (previous[problemId] || 0) + elapsed,
        }));
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/tests/${testId}/activity`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              problem_id: problemId,
              event_type: "heartbeat",
              elapsed_seconds: elapsed,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.warn("Activity update failed:", data.error);
        }
      } catch (err) {
        console.warn("Activity heartbeat failed:", err);
      }
    };

    activityTimerRef.current = setInterval(sendActivity, 15000);

    return () => {
      if (activityTimerRef.current) {
        clearInterval(activityTimerRef.current);
        activityTimerRef.current = null;
      }


      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - lastActivityRef.current) / 1000)
      );

      if (elapsed > 0) {
        setElapsedByProblem((previous) => ({
          ...previous,
          [problemId]: (previous[problemId] || 0) + elapsed,
        }));
      }
    };
  }, [testId, selectedProblem, finalized, attempt, authHeaders, frozen]);

  useEffect(() => {
    if (!test?.end_time) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const remaining = new Date(test.end_time).getTime() - Date.now();
      setTimeLeft(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [test?.end_time]);

  /* ============================================================
     PROCTORING: TAB-SWITCH MONITORING
     6 switch tak sirf warning. 7th switch par test freeze.
     ============================================================ */

  const monitoring =
    attempt?.status === "in_progress" && !finalized && !frozen;

  useEffect(() => {
    if (!monitoring || !testId || !token) return undefined;

    const report = async (reason) => {
      if (
        finalizedRef.current ||
        frozenRef.current ||
        suppressRef.current
      ) {
        return;
      }

      // visibilitychange + blur ek hi switch par dono aate hain
      const now = Date.now();
      if (now - lastSwitchRef.current < 2000) return;
      lastSwitchRef.current = now;

      try {
        const response = await fetch(
          `${API_BASE}/api/tests/${testId}/tab-switch`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ reason }),
          }
        );

        const data = await response.json().catch(() => ({}));

        if (response.status === 423) {
          enterFrozen(data);
          return;
        }

        if (!response.ok) return;

        setSession((previous) => ({ ...previous, ...pickSession(data) }));

        if (data.ended) {
          autoSubmitRef.current?.(true, endedMessage(data));
          return;
        }

        if (data.status === "frozen") {
          enterFrozen(data);
          return;
        }

        if (data.counted) {
          showWarning(tabSwitchMessage(data), tabSwitchLevel(data));
        }
      } catch (err) {
        console.warn("Tab-switch report failed:", err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        report("tab_hidden");
      }
    };

    const onBlur = () => report("window_blur");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [monitoring, testId, token, authHeaders, enterFrozen, showWarning]);

  // Teacher ne test freeze ya end kiya ho to student ko pata chale
  useEffect(() => {
    if (!monitoring || !testId || !token) return undefined;

    const timer = setInterval(async () => {
      if (finalizedRef.current || frozenRef.current) return;

      const data = await fetchSession();

      if (!data) return;

      if (data.ended) {
        autoSubmitRef.current?.(true, endedMessage(data));
        return;
      }

      if (data.status === "frozen") {
        enterFrozen(data);
      }
    }, SESSION_POLL_MS);

    return () => clearInterval(timer);
  }, [monitoring, testId, token, fetchSession, enterFrozen]);

  // Freeze ke dauran teacher ke unlock / end ka intezaar
  useEffect(() => {
    if (!frozen || finalized) return undefined;

    const timer = setInterval(async () => {
      const data = await fetchSession();

      if (!data) return;

      // Teacher ne "End test" kiya: test submit ho jata hai
      if (data.ended) {
        frozenRef.current = false;
        setFrozen(false);

        autoSubmitRef.current?.(true, endedMessage(data));
        return;
      }

      // Teacher ne unlock kiya
      if (data.status !== "frozen") {
        frozenRef.current = false;
        lastSwitchRef.current = Date.now();

        setSession((previous) => ({ ...previous, ...pickSession(data) }));
        setFrozen(false);

        showWarning(
          "Your teacher reviewed the activity and allowed you to continue the test.",
          "info"
        );

        await loadProblems();
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [frozen, finalized, fetchSession, loadProblems, showWarning]);

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, []);

  /* ============================================================
     EDITOR HANDLERS
     ============================================================ */

  const handleProblemSelect = (problem) => {
    if (finalized || finalizing || frozen) return;
    setSelectedProblem(problem);
  };

  const handleCodeChange = (value) => {
    if (!selectedProblem || finalized || finalizing || frozen) return;

    setCodes((previous) => ({
      ...previous,
      [codeKey(selectedProblem.problem_id, language)]: value,
    }));
  };

  const resetToDefaultCode = () => {
    if (!selectedProblem || finalized || finalizing || frozen) return;
    if (
      withSuppressed(() =>
        window.confirm(
          "Reset code to the default starter template for this problem? Any unsaved edits will be replaced."
        )
      )
    ) {
      const def = getDefaultCode(language);
      handleCodeChange(def);
    }
  };

  const handleLanguageChange = (value) => {
    if (!selectedProblem || finalized || finalizing || frozen) return;

    setLanguage(value);
    setExecutionResult(null);
  };

  const pollResult = async (id) => {
    if (!id) {
      setExecutionLoading(false);
      return;
    }

    let attempts = 0;
    // Bahut students ek saath hon to queue lambi ho sakti hai; time-based limit.
    const startedAt = Date.now();
    const maxWaitMs = language === "java" ? 120000 : 90000;

    const checkResult = async () => {
      try {
        const response = await fetch(`${API_BASE}/result/${id}`, {
          method: "GET",
          headers: authHeaders,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Failed to get execution result.");
        }

        setExecutionResult(data);

        if (data.status === "completed") {
          setExecutionLoading(false);
          return;
        }

        attempts += 1;

        if (Date.now() - startedAt >= maxWaitMs) {
          setExecutionResult({
            status: "completed",
            verdict: "SYSTEM ERROR",
            output:
              "Result did not arrive in time (server may be busy). Please try again.",
          });
          setExecutionLoading(false);
          return;
        }

        // Shuru mein jaldi, phir dheere: 500 students ka polling server par bojh na bane
        const delay = attempts < 6 ? 500 : attempts < 20 ? 1000 : 2000;

        setTimeout(checkResult, delay);
      } catch (err) {
        console.error("Result polling error:", err);
        setExecutionResult({
          status: "completed",
          verdict: "SYSTEM ERROR",
          output: err.message,
        });
        setExecutionLoading(false);
      }
    };

    await checkResult();
  };

  const postSubmissionActivity = async (id, problemId) => {
    if (!testId || !id || !problemId) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/record-submission`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            submission_id: id,
            problem_id: problemId,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.warn("Could not record attempt submission:", data.error);
      }
    } catch (err) {
      console.warn("Record submission request failed:", err);
    }
  };

  const submitCodeToBackend = async (endpoint, actionLabel) => {
    if (
      !selectedProblem ||
      executionLoading ||
      finalized ||
      finalizing ||
      frozen
    ) {
      return;
    }

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    if (testStatus !== "Active") {
      setError(
        testStatus === "Upcoming"
          ? "This test has not started yet."
          : "This test has ended."
      );
      return;
    }

    const problemId = selectedProblem.problem_id;
    const code =
      codes[codeKey(problemId, language)] ?? getDefaultCode(language);

    if (!code.trim()) {
      setError("Code cannot be empty.");
      return;
    }

    setError("");
    setExecutionLoading(true);
    setExecutionResult({
      status: "queued",
      verdict: null,
      output: `${actionLabel} sent for execution...`,
    });
    setSubmissionId(null);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          code,
          problem_id: problemId,
          language,
        }),
      });

      const data = await response.json().catch(() => ({}));

      // 423 = teacher ne test freeze kiya hua hai
      if (response.status === 423) {
        setExecutionLoading(false);
        enterFrozen(data);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${actionLabel.toLowerCase()}.`);
      }

      const id = data.run_id || data.submission_id;

      if (!id) {
        throw new Error("Backend did not return a run or submission ID.");
      }

      setSubmissionId(id);
      setAttemptedProblems((previous) => ({
        ...previous,
        [problemId]: true,
      }));

      if (endpoint === "/submit") {
        await postSubmissionActivity(id, problemId);
      }

      setExecutionResult({
        status: "queued",
        verdict: null,
        output: "Your code is waiting for execution...",
      });

      await pollResult(id);
    } catch (err) {
      console.error(`${actionLabel} error:`, err);
      setExecutionResult({
        status: "completed",
        verdict: "SYSTEM ERROR",
        output: err.message,
      });
      setExecutionLoading(false);
    }
  };

  const handleRunCode = () => submitCodeToBackend("/run", "Run Code");

  const handleSubmit = () => submitCodeToBackend("/submit", "Submit");


  // automatic = true: timer khatam hua ya teacher ne test end kiya.
  // endedReason: teacher ke end karne ka message.
  const handleFinalSubmit = async (automatic = false, endedReason = "") => {
    if (finalizedRef.current || finalizing || !testId) return;

    const confirmed = automatic
      ? true
      : withSuppressed(() =>
          window.confirm(
            "Are you sure you want to submit the test? You cannot continue editing after final submission."
          )
        );

    if (!confirmed) return;

    setFinalizing(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/tests/${testId}/final-submit`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            status: automatic ? "auto_submitted" : "submitted",
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 423) {
        enterFrozen(data);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Could not finalize the test.");
      }

      finalizedRef.current = true;
      setFinalized(true);

      // Submit ho gaya, ab draft ki zarurat nahi
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }

      // Test successfully submitted
      if (activityTimerRef.current) {
        clearInterval(activityTimerRef.current);
        activityTimerRef.current = null;
      }

      setTimeout(() => {
        if (typeof onBack === "function") {
          onBack(true);
        }
      }, 1500);

      setAttempt((previous) => ({
        ...(previous || {}),
        ...(data.attempt || {}),
        status: automatic ? "auto_submitted" : "submitted",
      }));

      withSuppressed(() =>
        window.alert(
          endedReason
            ? endedReason
            : automatic
              ? "Time is over. Your test has been auto-submitted."
              : "Your test has been submitted successfully."
        )
      );
    } catch (err) {
      console.error("Final submission error:", err);
      setError(err.message || "Could not finalize the test.");
    } finally {
      setFinalizing(false);
    }
  };

  autoSubmitRef.current = handleFinalSubmit;

  // Auto-submit sirf tab, jab timer zero ho jaye.
  useEffect(() => {
    if (
      timeLeft === 0 &&
      !finalized &&
      !finalizing &&
      attempt
    ) {
      handleFinalSubmit(true);
    }
    // handleFinalSubmit is intentionally invoked only when the timer expires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, finalized, finalizing, attempt]);

  const attemptedCount = Object.keys(attemptedProblems).filter(
    (key) => attemptedProblems[key]
  ).length;

  const switchMax = session.max_switches;

  if (loadingProblems || attemptLoading) {
    return (
      <div className="student-test-loading">
        <Loader2 size={28} className="spin" />
        <span>Loading test...</span>
      </div>
    );
  }

  return (
    <div className="student-test-page">
      <header className="student-test-topbar">
        <div className="student-test-brand">
          <button
            className="student-back-btn"
            onClick={() => onBack && onBack(false)}
            disabled={finalizing}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="student-brand-name">CodeShield</div>
            <div className="student-brand-subtitle">
              Student Workspace
            </div>
          </div>
        </div>

        <div className="student-test-title">
          <span>{test?.title || "Coding Test"}</span>
          <span
            className={
              testStatus === "Active"
                ? "student-status active"
                : "student-status"
            }
          >
            {finalized ? "Submitted" : testStatus}
          </span>
        </div>

        <div className="student-topbar-right">
          <div
            className={`switch-chip ${
              session.tab_switch_count >= switchMax
                ? "danger"
                : session.tab_switch_count > 0
                  ? "warn"
                  : ""
            }`}
            title={`You can switch tabs ${switchMax} times. After that your test is frozen until your teacher unlocks it.`}
          >
            <AlertTriangle size={14} />
            Tab switches {session.tab_switch_count}/{switchMax}
          </div>

          <div className="student-timer">
            <Clock3 size={17} />
            <div>
              <span>Time Remaining</span>
              <strong>{formatTime(timeLeft)}</strong>
            </div>
          </div>
        </div>
      </header>

      {warning && (
        <div
          className={`proctor-warning ${
            warningType === "info" ? "proctor-info" : ""
          }`}
          role="alert"
        >
          <AlertTriangle size={16} />
          {warning}
        </div>
      )}

      {error && (
        <div className="student-test-error" role="alert">
          {error}
        </div>
      )}

      {finalized && (
        <div className="student-test-error">
          Your test has been submitted. Editing and new submissions are disabled.
        </div>
      )}

      <div className="student-test-body">
        <aside className="student-problem-sidebar">
          <div className="student-sidebar-header">
            <div>
              <span>ASSESSMENT</span>
              <h2>Problems</h2>
            </div>
            <div className="problem-count">{problems.length}</div>
          </div>

          <div className="student-problem-list">
            {problems.length === 0 ? (
              <div className="no-problems">
                No problems available.
              </div>
            ) : (
              problems.map((problem, index) => (
                <button
                  key={problem.problem_id}
                  className={
                    selectedProblem?.problem_id === problem.problem_id
                      ? "student-problem-item selected"
                      : "student-problem-item"
                  }
                  onClick={() => handleProblemSelect(problem)}
                  disabled={finalized || finalizing}
                >
                  <div className="problem-number">{index + 1}</div>

                  <div className="problem-item-content">
                    <strong>{problem.title}</strong>
                    <div className="problem-meta">
                      <span
                        className={`difficulty ${String(
                          problem.difficulty || "Easy"
                        ).toLowerCase()}`}
                      >
                        {problem.difficulty || "Easy"}
                      </span>
                      <span>{problem.time_limit_ms ?? 1000} ms</span>
                    </div>
                    {attemptedProblems[problem.problem_id] && (
                      <small>Attempted</small>
                    )}
                  </div>

                  <ChevronRight size={17} className="problem-arrow" />
                </button>
              ))
            )}
          </div>

          <div className="student-sidebar-footer">
            <div className="progress-label">
              <span>Attempted</span>
              <span>
                {attemptedCount} / {problems.length}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    problems.length
                      ? (attemptedCount / problems.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </aside>

        <main className="student-problem-panel">
          {!selectedProblem ? (
            <div className="empty-problem">
              <FileText size={40} />
              <h2>Select a problem</h2>
              <p>
                Choose a problem from the left panel to start solving.
              </p>
            </div>
          ) : (
            <>
              <div className="problem-header">
                <div>
                  <div className="problem-heading-row">
                    <h1>{selectedProblem.title}</h1>
                    <span
                      className={`difficulty large ${String(
                        selectedProblem.difficulty || "Easy"
                      ).toLowerCase()}`}
                    >
                      {selectedProblem.difficulty || "Easy"}
                    </span>
                  </div>
                  <p>
                    Problem #
                    {problems.findIndex(
                      (problem) =>
                        problem.problem_id === selectedProblem.problem_id
                    ) + 1}
                  </p>
                </div>
              </div>

              <section className="problem-section">
                <div className="section-heading">
                  <FileText size={17} />
                  <h2>Problem Statement</h2>
                </div>
                <div className="problem-statement">
                  {selectedProblem.statement}
                </div>
              </section>

              <section className="problem-limits">
                <div className="limit-card">
                  <Clock3 size={18} />
                  <div>
                    <span>Time Limit</span>
                    <strong>
                      {selectedProblem.time_limit_ms ?? 1000} ms
                    </strong>
                  </div>
                </div>

                <div className="limit-card">
                  <MemoryStick size={18} />
                  <div>
                    <span>Memory Limit</span>
                    <strong>
                      {selectedProblem.memory_limit_mb ?? 256} MB
                    </strong>
                  </div>
                </div>
              </section>

              <section className="problem-section">
                <div className="section-heading">
                  <Eye size={17} />
                  <h2>Examples</h2>
                  <span className="example-count">
                    {visibleTestCases.length}
                  </span>
                </div>

                {loadingTestCases ? (
                  <div className="examples-loading">
                    <Loader2 size={17} className="spin" />
                    Loading examples...
                  </div>
                ) : visibleTestCases.length === 0 ? (
                  <div className="no-examples">
                    No visible examples available for this problem.
                  </div>
                ) : (
                  <div className="examples-list">
                    {visibleTestCases.map((testCase, index) => (
                      <div
                        className="example-card"
                        key={testCase.testcase_id ?? index}
                      >
                        <div className="example-header">
                          <span>Example {index + 1}</span>
                          <CheckCircle2 size={15} />
                        </div>

                        <div className="example-grid">
                          <div>
                            <label>Input</label>
                            <pre>{testCase.input}</pre>
                          </div>
                          <div>
                            <label>Expected Output</label>
                            <pre>{testCase.expected_output}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        <section className="student-editor-panel">
          <div className="editor-header">
            <div className="editor-title">
              <Code2 size={18} />
              <span>Code Editor</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", gap: "3px" }}>
                <button
                  type="button"
                  className="editor-tool-btn"
                  onClick={() => setEditorFontSize((s) => Math.max(11, s - 1))}
                  title="Decrease font size"
                >
                  A-
                </button>
                <button
                  type="button"
                  className="editor-tool-btn"
                  onClick={() => setEditorFontSize((s) => Math.min(22, s + 1))}
                  title="Increase font size"
                >
                  A+
                </button>
              </div>

              <button
                type="button"
                className="editor-tool-btn"
                onClick={resetToDefaultCode}
                title="Reset code to default template"
                disabled={finalized || finalizing || frozen}
              >
                <RotateCcw size={13} /> Reset
              </button>

              <select
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value)}
                disabled={finalized || finalizing || executionLoading || frozen}
              >
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="python">Python</option>
              </select>
            </div>
          </div>

          <div className="editor-container">
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <div style={{ position: "absolute", inset: 0 }}>
                <Editor
                  height="100%"
                  theme="vs-dark"
                  path={
                    selectedProblem
                      ? `problem-${selectedProblem.problem_id}.${language}`
                      : "empty"
                  }
                  language={language}
                  value={
                    selectedProblem
                      ? codes[codeKey(selectedProblem.problem_id, language)] ??
                        getDefaultCode(language)
                      : ""
                  }
                  onChange={(value) => handleCodeChange(value ?? "")}
                  loading={
                    <div className="examples-loading">
                      <Loader2 size={17} className="spin" /> Loading editor...
                    </div>
                  }
                  options={{
                    readOnly: !selectedProblem || finalized || finalizing || frozen,
                    minimap: { enabled: false },
                    fontSize: editorFontSize,
                    tabSize: 4,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 14 },
                    fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="editor-footer">
            <div className="editor-info">
              <span>
                {language === "cpp"
                  ? "C++17"
                  : language === "java"
                    ? "Java"
                    : "Python 3"}
              </span>
              <span>Auto-save: Local</span>
            </div>

            <div className="editor-actions">
              <button
                className="run-button"
                onClick={handleRunCode}
                disabled={
                  !selectedProblem ||
                  executionLoading ||
                  finalized ||
                  finalizing ||
                  frozen
                }
              >
                {executionLoading ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Play size={16} />
                )}
                {executionLoading ? "Running..." : "Run Code"}
              </button>

              <button
                className="submit-button"
                onClick={handleSubmit}
                disabled={
                  !selectedProblem ||
                  executionLoading ||
                  finalized ||
                  finalizing ||
                  frozen
                }
              >
                <Send size={16} />
                Submit
              </button>
            </div>
          </div>

          <div className="execution-result-panel">
            <div className="execution-result-header">
              <div>
                <strong>Execution Result</strong>
                {executionLoading && (
                  <span className="execution-running">
                    <Loader2 size={15} className="spin" />
                    Running...
                  </span>
                )}
              </div>

              {executionResult?.verdict && (
                <span
                  className={`execution-verdict ${
                    ["AC", "Accepted"].includes(executionResult.verdict)
                      ? "success"
                      : "failed"
                  }`}
                >
                  {executionResult.verdict}
                </span>
              )}
            </div>

            <div className="execution-result-body">
              {!executionResult ? (
                <div className="execution-empty">
                  <Code2 size={22} />
                  <span>Run your code to see the result.</span>
                </div>
              ) : (
                <>
                  <div className="execution-status">
                    <span>Status</span>
                    <strong>{executionResult.status}</strong>
                  </div>

                  {executionResult.execution_time_ms !== undefined && (
                    <div className="execution-status">
                      <span>Execution Time</span>
                      <strong>
                        {executionResult.execution_time_ms} ms
                      </strong>
                    </div>
                  )}

                  {executionResult.test_cases_total !== undefined && (
                    <div className="execution-status">
                      <span>Test Cases</span>
                      <strong>
                        {executionResult.test_cases_passed ?? 0}
                        {" / "}
                        {executionResult.test_cases_total}
                      </strong>
                    </div>
                  )}

                  <div className="execution-output">
                    <div className="output-title">Output</div>
                    <pre>
                      {executionResult.output ||
                        executionResult.stderr ||
                        "No output"}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="editor-footer">
            <div className="editor-info">
              <span>
                Questions attempted: {attemptedCount}/{problems.length}
              </span>
            </div>

            <div className="editor-actions">
              <button
                className="submit-button"
                onClick={() => handleFinalSubmit(false)}
                disabled={finalized || finalizing || !attempt || frozen}
              >
                {finalizing && <Loader2 size={16} className="spin" />}
                {finalizing ? "Submitting Test..." : "Final Submit Test"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* CAMERA MONITORING: consent + live preview. Alerts sirf teacher ko jaate hain. */}
      <EyeMonitor
        active={attempt?.status === "in_progress" && !finalized}
        paused={frozen}
        identity={identityApi}
        onViolation={reportGaze}
        onStartingChange={handleCameraStarting}
      />

      {/* FREEZE SCREEN: sirf Logout ka option */}
      {frozen && !finalized && (
        <div className="freeze-overlay" role="alertdialog" aria-modal="true">
          <div className="freeze-card">
            <div className="freeze-icon">
              <Lock size={30} />
            </div>

            <h2>Your test is frozen</h2>

            <p>
              Your test is frozen. You cannot continue until your teacher
              reviews it and approves.
            </p>

            <div className="freeze-reason">
              {session.freeze_reason ||
                `You switched tabs more than ${switchMax} times.`}
            </div>

            <div className="freeze-waiting">
              <Loader2 size={15} className="spin" />
              Waiting for your teacher...
            </div>

            <div>
              <button
                type="button"
                className="freeze-logout"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentTestPage;