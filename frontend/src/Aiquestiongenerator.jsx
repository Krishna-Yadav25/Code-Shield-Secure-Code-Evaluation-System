// // import { useState } from "react";
// // import {
// //   Sparkles,
// //   CheckCircle,
// //   AlertTriangle,
// //   Trash2,
// //   ChevronDown,
// //   ChevronUp,
// //   Eye,
// //   EyeOff
// // } from "lucide-react";

// // import "./Aiquestiongenerator.css";

// // const API_BASE = "http://localhost:5000";
// // let draftCounter = 0;

// // function AIQuestionGenerator({ onSaved }) {
// //   const token = localStorage.getItem("codeshield_token");

// //   const [topic, setTopic] = useState("");
// //   const [difficulty, setDifficulty] = useState("Easy");
// //   const [count, setCount] = useState(3);
// //   const [notes, setNotes] = useState("");

// //   const [testTitle, setTestTitle] = useState("");
// //   const [testDescription, setTestDescription] = useState("");
// //   const [startTime, setStartTime] = useState("");
// //   const [endTime, setEndTime] = useState("");
// //   const [accessPassword, setAccessPassword] = useState("");

// //   const [drafts, setDrafts] = useState([]);
// //   const [generating, setGenerating] = useState(false);
// //   const [saving, setSaving] = useState(false);
// //   const [error, setError] = useState("");
// //   const [message, setMessage] = useState("");

// //   const post = async (path, body) => {
// //     const response = await fetch(`${API_BASE}${path}`, {
// //       method: "POST",
// //       headers: {
// //         Authorization: `Bearer ${token}`,
// //         "Content-Type": "application/json"
// //       },
// //       body: JSON.stringify(body)
// //     });

// //     const data = await response.json().catch(() => ({}));

// //     if (!response.ok) {
// //       throw new Error(data.error || `Request failed (${response.status})`);
// //     }

// //     return data;
// //   };

// //   const generate = async (event) => {
// //     event.preventDefault();
// //     setError("");
// //     setMessage("");

// //     if (topic.trim().length < 3) {
// //       setError("Please describe the topic using at least 3 characters.");
// //       return;
// //     }

// //     setGenerating(true);

// //     try {
// //       const data = await post("/api/teacher/ai/generate", {
// //         topic: topic.trim(),
// //         difficulty,
// //         count: Number(count),
// //         notes: notes.trim()
// //       });

// //       const fresh = (data.questions || []).map((q) => ({
// //         ...q,
// //         _id: ++draftCounter,
// //         selected: false,
// //         open: false
// //       }));

// //       setDrafts((previous) => [...previous, ...fresh]);

// //       setMessage(
// //         `${fresh.length} question(s) generated. Review and select the questions you want.`
// //       );
// //     } catch (e) {
// //       setError(e.message);
// //     } finally {
// //       setGenerating(false);
// //     }
// //   };

// //   const updateDraft = (id, patch) => {
// //     setDrafts((previous) =>
// //       previous.map((d) => d._id === id ? { ...d, ...patch } : d)
// //     );
// //   };

// //   const removeDraft = (id) => {
// //     setDrafts((previous) => previous.filter((d) => d._id !== id));
// //   };

// //   const selectAll = () => {
// //     setDrafts((previous) =>
// //       previous.map((d) => ({ ...d, selected: true }))
// //     );
// //   };

// //   const selectedDrafts = drafts.filter((d) => d.selected);

// //   const saveSelected = async () => {
// //     setError("");
// //     setMessage("");

// //     if (!testTitle.trim()) {
// //       setError("Enter a test title.");
// //       return;
// //     }

// //     if (!startTime || !endTime) {
// //       setError("Enter both the start time and end time.");
// //       return;
// //     }

// //     if (new Date(endTime) <= new Date(startTime)) {
// //       setError("End time must be after start time.");
// //       return;
// //     }

// //     if (accessPassword.trim() && accessPassword.trim().length < 4) {
// //       setError("Test password must contain at least 4 characters.");
// //       return;
// //     }

// //     if (selectedDrafts.length === 0) {
// //       setError("Select at least one question.");
// //       return;
// //     }

// //     const unverified = selectedDrafts.filter((d) => !d.verified).length;

// //     if (
// //       unverified > 0 &&
// //       !window.confirm(
// //         `${unverified} selected question(s) are not verified. Add them anyway?`
// //       )
// //     ) {
// //       return;
// //     }

// //     setSaving(true);
// //     let contestId = null;

// //     try {
// //       // Create test first.
// //       const testResult = await post("/api/teacher/tests", {
// //         title: testTitle.trim(),
// //         description: testDescription.trim(),
// //         start_time: startTime,
// //         end_time: endTime,
// //         access_password: accessPassword.trim() || null
// //       });

// //       contestId = testResult.contest_id;

// //       if (!contestId) {
// //         throw new Error(
// //           "The test may have been created, but the server did not return its ID."
// //         );
// //       }

// //       // Save selected questions to that test.
// //       const questions = selectedDrafts.map((d) => ({
// //         title: d.title,
// //         statement: d.statement,
// //         difficulty: d.difficulty,
// //         time_limit_ms: d.time_limit_ms,
// //         memory_limit_mb: d.memory_limit_mb,
// //         max_marks: Number(d.max_marks),
// //         test_cases: d.test_cases
// //       }));

// //       const saveResult = await post(
// //         `/api/teacher/tests/${contestId}/ai/save`,
// //         { questions }
// //       );

// //       setDrafts((previous) =>
// //         previous.filter((d) => !selectedDrafts.some((s) => s._id === d._id))
// //       );

// //       setTestTitle("");
// //       setTestDescription("");
// //       setStartTime("");
// //       setEndTime("");
// //       setAccessPassword("");

// //       setMessage(
// //         `Test created and questions saved successfully. Test ID: ${contestId}. ${saveResult.message || ""}`
// //       );

// //       if (onSaved) {
// //         await onSaved();
// //       }
// //     } catch (e) {
// //       if (contestId) {
// //         setError(
// //           `Test ID ${contestId} was created, but question saving failed: ${e.message}. Do not create another test.`
// //         );
// //       } else {
// //         setError(e.message);
// //       }
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   return (
// //     <section className="aiq">
// //       <form className="aiq-card" onSubmit={generate}>
// //         <div className="aiq-head">
// //           <div className="aiq-icon"><Sparkles size={20} /></div>
// //           <div>
// //             <h2>Generate questions with AI</h2>
// //             <p>Generate coding problems, review them, and select questions for your test.</p>
// //           </div>
// //         </div>

// //         <label htmlFor="aiq-topic">Topic</label>
// //         <textarea
// //           id="aiq-topic"
// //           rows={3}
// //           value={topic}
// //           onChange={(e) => setTopic(e.target.value)}
// //           placeholder="Example: arrays, binary search, linked lists"
// //           maxLength={500}
// //           required
// //         />

// //         <div className="aiq-row">
// //           <div>
// //             <label htmlFor="aiq-difficulty">Difficulty</label>
// //             <select
// //               id="aiq-difficulty"
// //               value={difficulty}
// //               onChange={(e) => setDifficulty(e.target.value)}
// //             >
// //               <option>Easy</option>
// //               <option>Medium</option>
// //               <option>Hard</option>
// //             </select>
// //           </div>
// //           <div>
// //             <label htmlFor="aiq-count">Number of questions (1–8)</label>
// //             <input
// //               id="aiq-count"
// //               type="number"
// //               min="1"
// //               max="8"
// //               value={count}
// //               onChange={(e) => setCount(e.target.value)}
// //               required
// //             />
// //           </div>
// //         </div>

// //         <label htmlFor="aiq-notes">Extra instructions (optional)</label>
// //         <input
// //           id="aiq-notes"
// //           value={notes}
// //           onChange={(e) => setNotes(e.target.value)}
// //           placeholder="Example: avoid recursion"
// //           maxLength={1000}
// //         />

// //         <div className="aiq-actions">
// //           <button className="primary-small-btn" type="submit" disabled={generating}>
// //             <Sparkles size={16} />
// //             {generating ? "Generating..." : "Generate questions"}
// //           </button>
// //           {drafts.length > 0 && (
// //             <button
// //               type="button"
// //               className="outline-btn"
// //               disabled={saving || generating}
// //               onClick={() => {
// //                 if (window.confirm("Remove all unsaved drafts?")) setDrafts([]);
// //               }}
// //             >
// //               Clear drafts
// //             </button>
// //           )}
// //         </div>
// //       </form>

// //       {error && (
// //         <div className="aiq-msg error" role="alert">
// //           <AlertTriangle size={16} /> {error}
// //         </div>
// //       )}
// //       {message && (
// //         <div className="aiq-msg success">
// //           <CheckCircle size={16} /> {message}
// //         </div>
// //       )}

// //       {drafts.length > 0 && (
// //         <div className="aiq-card">
// //           <div className="aiq-list-head">
// //             <div>
// //               <h3>Draft questions ({drafts.length})</h3>
// //               <p>{selectedDrafts.length} selected</p>
// //             </div>
// //             <div className="aiq-actions">
// //               <button type="button" className="outline-btn" onClick={selectAll}>
// //                 Select all
// //               </button>
// //             </div>
// //           </div>

// //           <div className="aiq-drafts">
// //             {drafts.map((d) => (
// //               <article
// //                 key={d._id}
// //                 className={`aiq-draft ${d.selected ? "selected" : ""}`}
// //               >
// //                 <div className="aiq-draft-top">
// //                   <label className="aiq-check">
// //                     <input
// //                       type="checkbox"
// //                       checked={d.selected}
// //                       onChange={(e) =>
// //                         updateDraft(d._id, { selected: e.target.checked })
// //                       }
// //                     />
// //                     Select
// //                   </label>

// //                   <span className={`aiq-badge ${d.verified ? "ok" : "warn"}`}>
// //                     {d.verified ? "Verified" : "Not verified"}
// //                   </span>

// //                   <span className={`difficulty ${(d.difficulty || "easy").toLowerCase()}`}>
// //                     {d.difficulty}
// //                   </span>

// //                   <button
// //                     type="button"
// //                     className="aiq-icon-btn"
// //                     title="Remove question"
// //                     onClick={() => removeDraft(d._id)}
// //                   >
// //                     <Trash2 size={16} />
// //                   </button>
// //                 </div>

// //                 <p className={`aiq-note ${d.verified ? "ok" : "warn"}`}>
// //                   {d.verify_note}
// //                 </p>

// //                 <label>Title</label>
// //                 <input
// //                   value={d.title}
// //                   onChange={(e) => updateDraft(d._id, { title: e.target.value })}
// //                 />

// //                 <label>Statement</label>
// //                 <textarea
// //                   rows={8}
// //                   value={d.statement}
// //                   onChange={(e) =>
// //                     updateDraft(d._id, { statement: e.target.value })
// //                   }
// //                 />

// //                 <div className="aiq-row">
// //                   <div>
// //                     <label>Maximum marks</label>
// //                     <input
// //                       type="number"
// //                       min="0.5"
// //                       max="1000"
// //                       step="0.5"
// //                       value={d.max_marks}
// //                       onChange={(e) =>
// //                         updateDraft(d._id, { max_marks: e.target.value })
// //                       }
// //                     />
// //                   </div>
// //                 </div>

// //                 <button
// //                   type="button"
// //                   className="aiq-toggle"
// //                   onClick={() => updateDraft(d._id, { open: !d.open })}
// //                 >
// //                   {d.open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
// //                   {d.open ? "Hide" : "Show"} {d.test_cases?.length || 0} test cases
// //                 </button>

// //                 {d.open && (
// //                   <div className="aiq-cases">
// //                     {(d.test_cases || []).map((tc, i) => (
// //                       <div className="aiq-case" key={i}>
// //                         <div className="aiq-case-head">
// //                           <strong>Test case {i + 1}</strong>
// //                           <span className={`aiq-vis ${tc.is_hidden ? "hidden" : "visible"}`}>
// //                             {tc.is_hidden ? <EyeOff size={12} /> : <Eye size={12} />}
// //                             {tc.is_hidden ? "Hidden" : "Visible"}
// //                           </span>
// //                         </div>
// //                         <div className="aiq-case-grid">
// //                           <div>
// //                             <span>Input</span>
// //                             <pre>{tc.input}</pre>
// //                           </div>
// //                           <div>
// //                             <span>Expected output</span>
// //                             <pre>{tc.expected_output}</pre>
// //                           </div>
// //                         </div>
// //                       </div>
// //                     ))}
// //                   </div>
// //                 )}
// //               </article>
// //             ))}
// //           </div>
// //         </div>
// //       )}

// //       <div className="aiq-card">
// //         <div className="aiq-head">
// //           <div className="aiq-icon"><CheckCircle size={20} /></div>
// //           <div>
// //             <h2>Create test</h2>
// //             <p>Enter test details after generating and selecting questions.</p>
// //           </div>
// //         </div>

// //         <label htmlFor="aiq-title">Test title</label>
// //         <input
// //           id="aiq-title"
// //           value={testTitle}
// //           onChange={(e) => setTestTitle(e.target.value)}
// //           placeholder="DSA Mid Semester Test"
// //           required
// //         />

// //         <label htmlFor="aiq-description">Description</label>
// //         <textarea
// //           id="aiq-description"
// //           rows={3}
// //           value={testDescription}
// //           onChange={(e) => setTestDescription(e.target.value)}
// //           placeholder="Describe this assessment"
// //         />

// //         <div className="aiq-row">
// //           <div>
// //             <label htmlFor="aiq-start">Start time</label>
// //             <input
// //               id="aiq-start"
// //               type="datetime-local"
// //               value={startTime}
// //               onChange={(e) => setStartTime(e.target.value)}
// //               required
// //             />
// //           </div>
// //           <div>
// //             <label htmlFor="aiq-end">End time</label>
// //             <input
// //               id="aiq-end"
// //               type="datetime-local"
// //               value={endTime}
// //               onChange={(e) => setEndTime(e.target.value)}
// //               required
// //             />
// //           </div>
// //         </div>

// //         <label htmlFor="aiq-password">Optional test password</label>
// //         <input
// //           id="aiq-password"
// //           type="password"
// //           value={accessPassword}
// //           onChange={(e) => setAccessPassword(e.target.value)}
// //           placeholder="Leave blank for no password"
// //         />

// //         <div className="aiq-actions">
// //           <button
// //             type="button"
// //             className="primary-small-btn"
// //             onClick={saveSelected}
// //             disabled={saving || generating || selectedDrafts.length === 0}
// //           >
// //             <CheckCircle size={16} />
// //             {saving
// //               ? "Creating test and saving..."
// //               : `Create Test & Save ${selectedDrafts.length} Questions`}
// //           </button>
// //         </div>
// //       </div>
// //     </section>
// //   );
// // }

// // export default AIQuestionGenerator;


// import { useState } from "react";
// import {
//   Sparkles,
//   CheckCircle,
//   AlertTriangle,
//   Trash2,
//   ChevronDown,
//   ChevronUp,
//   Eye,
//   EyeOff
// } from "lucide-react";

// import "./Aiquestiongenerator.css";

// const API_BASE = "http://localhost:5000";
// let draftCounter = 0;

// function AIQuestionGenerator({ onSaved }) {
//   const token = localStorage.getItem("codeshield_token");

//   const [topic, setTopic] = useState("");
//   const [difficulty, setDifficulty] = useState("Easy");
//   const [count, setCount] = useState(3);
//   const [notes, setNotes] = useState("");

//   const [testTitle, setTestTitle] = useState("");
//   const [testDescription, setTestDescription] = useState("");
//   const [startTime, setStartTime] = useState("");
//   const [endTime, setEndTime] = useState("");
//   const [accessPassword, setAccessPassword] = useState("");

//   const [drafts, setDrafts] = useState([]);
//   const [generating, setGenerating] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState("");
//   const [message, setMessage] = useState("");

//   const post = async (path, body) => {
//     const response = await fetch(`${API_BASE}${path}`, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify(body)
//     });

//     const data = await response.json().catch(() => ({}));

//     if (!response.ok) {
//       throw new Error(data.error || `Request failed (${response.status})`);
//     }

//     return data;
//   };

//   const generate = async (event) => {
//     event.preventDefault();
//     setError("");
//     setMessage("");

//     if (topic.trim().length < 3) {
//       setError("Please describe the topic using at least 3 characters.");
//       return;
//     }

//     setGenerating(true);

//     try {
//       const data = await post("/api/teacher/ai/generate", {
//         topic: topic.trim(),
//         difficulty,
//         count: Number(count),
//         notes: notes.trim()
//       });

//       const fresh = (data.questions || []).map((q) => ({
//         ...q,
//         _id: ++draftCounter,
//         selected: false,
//         open: false
//       }));

//       setDrafts((previous) => [...previous, ...fresh]);

//       setMessage(
//         `${fresh.length} question(s) generated. Review and select the questions you want.`
//       );
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setGenerating(false);
//     }
//   };

//   const updateDraft = (id, patch) => {
//     setDrafts((previous) =>
//       previous.map((d) => d._id === id ? { ...d, ...patch } : d)
//     );
//   };

//   const removeDraft = (id) => {
//     setDrafts((previous) => previous.filter((d) => d._id !== id));
//   };

//   const selectAll = () => {
//     setDrafts((previous) =>
//       previous.map((d) => ({ ...d, selected: true }))
//     );
//   };

//   const selectedDrafts = drafts.filter((d) => d.selected);

//   const saveSelected = async () => {
//     setError("");
//     setMessage("");

//     if (!testTitle.trim()) {
//       setError("Enter a test title.");
//       return;
//     }

//     if (!startTime || !endTime) {
//       setError("Enter both the start time and end time.");
//       return;
//     }

//     if (new Date(endTime) <= new Date(startTime)) {
//       setError("End time must be after start time.");
//       return;
//     }

//     if (accessPassword.trim() && accessPassword.trim().length < 4) {
//       setError("Test password must contain at least 4 characters.");
//       return;
//     }

//     if (selectedDrafts.length === 0) {
//       setError("Select at least one question.");
//       return;
//     }

//     const unverified = selectedDrafts.filter((d) => !d.verified).length;

//     if (
//       unverified > 0 &&
//       !window.confirm(
//         `${unverified} selected question(s) are not verified. Add them anyway?`
//       )
//     ) {
//       return;
//     }

//     setSaving(true);
//     let contestId = null;

//     try {
//       // Create test first.
//       const testResult = await post("/api/teacher/tests", {
//         title: testTitle.trim(),
//         description: testDescription.trim(),
//         start_time: startTime,
//         end_time: endTime,
//         access_password: accessPassword.trim() || null
//       });

//       contestId = testResult.contest_id;

//       if (!contestId) {
//         throw new Error(
//           "The test may have been created, but the server did not return its ID."
//         );
//       }

//       // Save selected questions to that test.
//       const questions = selectedDrafts.map((d) => ({
//         title: d.title,
//         statement: d.statement,
//         difficulty: d.difficulty,
//         time_limit_ms: d.time_limit_ms,
//         memory_limit_mb: d.memory_limit_mb,
//         max_marks: Number(d.max_marks),
//         test_cases: d.test_cases
//       }));

//       const saveResult = await post(
//         `/api/teacher/tests/${contestId}/ai/save`,
//         { questions }
//       );

//       setDrafts((previous) =>
//         previous.filter((d) => !selectedDrafts.some((s) => s._id === d._id))
//       );

//       setTestTitle("");
//       setTestDescription("");
//       setStartTime("");
//       setEndTime("");
//       setAccessPassword("");

//       setMessage(
//         `Test created and questions saved successfully. Test ID: ${contestId}. ${saveResult.message || ""}`
//       );

//       if (onSaved) {
//         await onSaved();
//       }
//     } catch (e) {
//       if (contestId) {
//         setError(
//           `Test ID ${contestId} was created, but question saving failed: ${e.message}. Do not create another test.`
//         );
//       } else {
//         setError(e.message);
//       }
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <section className="aiq">
//       <form className="aiq-card" onSubmit={generate}>
//         <div className="aiq-head">
//           <div className="aiq-icon"><Sparkles size={20} /></div>
//           <div>
//             <h2>Generate questions with AI</h2>
//             <p>Generate coding problems, review them, and select questions for your test.</p>
//           </div>
//         </div>

//         <label htmlFor="aiq-topic">Topic</label>
//         <textarea
//           id="aiq-topic"
//           rows={3}
//           value={topic}
//           onChange={(e) => setTopic(e.target.value)}
//           placeholder="Example: arrays, binary search, linked lists"
//           maxLength={500}
//           required
//         />

//         <div className="aiq-row">
//           <div>
//             <label htmlFor="aiq-difficulty">Difficulty</label>
//             <select
//               id="aiq-difficulty"
//               value={difficulty}
//               onChange={(e) => setDifficulty(e.target.value)}
//             >
//               <option>Easy</option>
//               <option>Medium</option>
//               <option>Hard</option>
//             </select>
//           </div>
//           <div>
//             <label htmlFor="aiq-count">Number of questions (1–8)</label>
//             <input
//               id="aiq-count"
//               type="number"
//               min="1"
//               max="8"
//               value={count}
//               onChange={(e) => setCount(e.target.value)}
//               required
//             />
//           </div>
//         </div>

//         <label htmlFor="aiq-notes">Extra instructions (optional)</label>
//         <input
//           id="aiq-notes"
//           value={notes}
//           onChange={(e) => setNotes(e.target.value)}
//           placeholder="Example: avoid recursion"
//           maxLength={1000}
//         />

//         <div className="aiq-actions">
//           <button className="primary-small-btn" type="submit" disabled={generating}>
//             <Sparkles size={16} />
//             {generating ? "Generating..." : "Generate questions"}
//           </button>
//           {drafts.length > 0 && (
//             <button
//               type="button"
//               className="outline-btn"
//               disabled={saving || generating}
//               onClick={() => {
//                 if (window.confirm("Remove all unsaved drafts?")) setDrafts([]);
//               }}
//             >
//               Clear drafts
//             </button>
//           )}
//         </div>
//       </form>

//       {error && (
//         <div className="aiq-msg error" role="alert">
//           <AlertTriangle size={16} /> {error}
//         </div>
//       )}
//       {message && (
//         <div className="aiq-msg success">
//           <CheckCircle size={16} /> {message}
//         </div>
//       )}

//       {drafts.length > 0 && (
//         <div className="aiq-card">
//           <div className="aiq-list-head">
//             <div>
//               <h3>Draft questions ({drafts.length})</h3>
//               <p>{selectedDrafts.length} selected</p>
//             </div>
//             <div className="aiq-actions">
//               <button type="button" className="outline-btn" onClick={selectAll}>
//                 Select all
//               </button>
//             </div>
//           </div>

//           <div className="aiq-drafts">
//             {drafts.map((d) => (
//               <article
//                 key={d._id}
//                 className={`aiq-draft ${d.selected ? "selected" : ""}`}
//               >
//                 <div className="aiq-draft-top">
//                   <label className="aiq-check">
//                     <input
//                       type="checkbox"
//                       checked={d.selected}
//                       onChange={(e) =>
//                         updateDraft(d._id, { selected: e.target.checked })
//                       }
//                     />
//                     Select
//                   </label>

//                   <span className={`aiq-badge ${d.verified ? "ok" : "warn"}`}>
//                     {d.verified ? "Verified" : "Not verified"}
//                   </span>

//                   <span className={`difficulty ${(d.difficulty || "easy").toLowerCase()}`}>
//                     {d.difficulty}
//                   </span>

//                   <button
//                     type="button"
//                     className="aiq-icon-btn"
//                     title="Remove question"
//                     onClick={() => removeDraft(d._id)}
//                   >
//                     <Trash2 size={16} />
//                   </button>
//                 </div>

//                 <p className={`aiq-note ${d.verified ? "ok" : "warn"}`}>
//                   {d.verify_note}
//                 </p>

//                 <label>Title</label>
//                 <input
//                   value={d.title}
//                   onChange={(e) => updateDraft(d._id, { title: e.target.value })}
//                 />

//                 <label>Statement</label>
//                 <textarea
//                   rows={8}
//                   value={d.statement}
//                   onChange={(e) =>
//                     updateDraft(d._id, { statement: e.target.value })
//                   }
//                 />

//                 <div className="aiq-row">
//                   <div>
//                     <label>Maximum marks</label>
//                     <input
//                       type="number"
//                       min="0.5"
//                       max="1000"
//                       step="0.5"
//                       value={d.max_marks}
//                       onChange={(e) =>
//                         updateDraft(d._id, { max_marks: e.target.value })
//                       }
//                     />
//                   </div>
//                 </div>

//                 <button
//                   type="button"
//                   className="aiq-toggle"
//                   onClick={() => updateDraft(d._id, { open: !d.open })}
//                 >
//                   {d.open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
//                   {d.open ? "Hide" : "Show"} {d.test_cases?.length || 0} test cases
//                 </button>

//                 {d.open && (
//                   <div className="aiq-cases">
//                     {(d.test_cases || []).map((tc, i) => (
//                       <div className="aiq-case" key={i}>
//                         <div className="aiq-case-head">
//                           <strong>Test case {i + 1}</strong>
//                           <span className={`aiq-vis ${tc.is_hidden ? "hidden" : "visible"}`}>
//                             {tc.is_hidden ? <EyeOff size={12} /> : <Eye size={12} />}
//                             {tc.is_hidden ? "Hidden" : "Visible"}
//                           </span>
//                         </div>
//                         <div className="aiq-case-grid">
//                           <div>
//                             <span>Input</span>
//                             <pre>{tc.input}</pre>
//                           </div>
//                           <div>
//                             <span>Expected output</span>
//                             <pre>{tc.expected_output}</pre>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </article>
//             ))}
//           </div>
//         </div>
//       )}

//       <div className="aiq-card">
//         <div className="aiq-head">
//           <div className="aiq-icon"><CheckCircle size={20} /></div>
//           <div>
//             <h2>Create test</h2>
//             <p>Enter test details after generating and selecting questions.</p>
//           </div>
//         </div>

//         <label htmlFor="aiq-title">Test title</label>
//         <input
//           id="aiq-title"
//           value={testTitle}
//           onChange={(e) => setTestTitle(e.target.value)}
//           placeholder="DSA Mid Semester Test"
//           required
//         />

//         <label htmlFor="aiq-description">Description</label>
//         <textarea
//           id="aiq-description"
//           rows={3}
//           value={testDescription}
//           onChange={(e) => setTestDescription(e.target.value)}
//           placeholder="Describe this assessment"
//         />

//         <div className="aiq-row">
//           <div>
//             <label htmlFor="aiq-start">Start time</label>
//             <input
//               id="aiq-start"
//               type="datetime-local"
//               value={startTime}
//               onChange={(e) => setStartTime(e.target.value)}
//               required
//             />
//           </div>
//           <div>
//             <label htmlFor="aiq-end">End time</label>
//             <input
//               id="aiq-end"
//               type="datetime-local"
//               value={endTime}
//               onChange={(e) => setEndTime(e.target.value)}
//               required
//             />
//           </div>
//         </div>

//         <label htmlFor="aiq-password">Optional test password</label>
//         <input
//           id="aiq-password"
//           type="password"
//           value={accessPassword}
//           onChange={(e) => setAccessPassword(e.target.value)}
//           placeholder="Leave blank for no password"
//         />

//         <div className="aiq-actions">
//           <button
//             type="button"
//             className="primary-small-btn"
//             onClick={saveSelected}
//             disabled={saving || generating || selectedDrafts.length === 0}
//           >
//             <CheckCircle size={16} />
//             {saving
//               ? "Creating test and saving..."
//               : `Create Test & Save ${selectedDrafts.length} Questions`}
//           </button>
//         </div>
//       </div>
//     </section>
//   );
// }

// export default AIQuestionGenerator;

import { useState } from "react";
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText
} from "lucide-react";

import "./Aiquestiongenerator.css";

const API_BASE = "http://localhost:5000";
let draftCounter = 0;

// Topic ke liye quick suggestions (click karne par topic box mein add ho jaate hain)
const TOPIC_SUGGESTIONS = [
  "Arrays",
  "Strings",
  "Recursion",
  "Sorting",
  "Linked lists",
  "Binary search",
  "Dynamic programming",
  "Graphs"
];

function AIQuestionGenerator({ onSaved }) {
  const token = localStorage.getItem("codeshield_token");

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [count, setCount] = useState(3);
  const [notes, setNotes] = useState("");

  const [testTitle, setTestTitle] = useState("");
  const [testDescription, setTestDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [drafts, setDrafts] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const post = async (path, body) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  };

  const addTopic = (name) => {
    setTopic((previous) => {
      const current = previous.trim();
      if (!current) return name;
      if (current.toLowerCase().includes(name.toLowerCase())) return previous;
      return `${current}, ${name}`;
    });
  };

  const generate = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (topic.trim().length < 3) {
      setError("Please describe the topic using at least 3 characters.");
      return;
    }

    setGenerating(true);

    try {
      const data = await post("/api/teacher/ai/generate", {
        topic: topic.trim(),
        difficulty,
        count: Number(count),
        notes: notes.trim()
      });

      const fresh = (data.questions || []).map((q) => ({
        ...q,
        _id: ++draftCounter,
        selected: false,
        open: false
      }));

      setDrafts((previous) => [...previous, ...fresh]);

      setMessage(
        `${fresh.length} question(s) generated. Review and select the questions you want.`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const updateDraft = (id, patch) => {
    setDrafts((previous) =>
      previous.map((d) => d._id === id ? { ...d, ...patch } : d)
    );
  };

  const removeDraft = (id) => {
    setDrafts((previous) => previous.filter((d) => d._id !== id));
  };

  const selectAll = () => {
    setDrafts((previous) =>
      previous.map((d) => ({ ...d, selected: true }))
    );
  };

  const deselectAll = () => {
    setDrafts((previous) =>
      previous.map((d) => ({ ...d, selected: false }))
    );
  };

  const selectedDrafts = drafts.filter((d) => d.selected);

  const selectedMarks = selectedDrafts.reduce(
    (sum, d) => sum + (Number(d.max_marks) || 0),
    0
  );

  const saveSelected = async () => {
    setError("");
    setMessage("");

    if (!testTitle.trim()) {
      setError("Enter a test title.");
      return;
    }

    if (!startTime || !endTime) {
      setError("Enter both the start time and end time.");
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      setError("End time must be after start time.");
      return;
    }

    if (accessPassword.trim() && accessPassword.trim().length < 4) {
      setError("Test password must contain at least 4 characters.");
      return;
    }

    if (selectedDrafts.length === 0) {
      setError("Select at least one question.");
      return;
    }

    const unverified = selectedDrafts.filter((d) => !d.verified).length;

    if (
      unverified > 0 &&
      !window.confirm(
        `${unverified} selected question(s) are not verified. Add them anyway?`
      )
    ) {
      return;
    }

    setSaving(true);
    let contestId = null;

    try {
      // Create test first.
      const testResult = await post("/api/teacher/tests", {
        title: testTitle.trim(),
        description: testDescription.trim(),
        start_time: startTime,
        end_time: endTime,
        access_password: accessPassword.trim() || null
      });

      contestId = testResult.contest_id;

      if (!contestId) {
        throw new Error(
          "The test may have been created, but the server did not return its ID."
        );
      }

      // Save selected questions to that test.
      const questions = selectedDrafts.map((d) => ({
        title: d.title,
        statement: d.statement,
        difficulty: d.difficulty,
        time_limit_ms: d.time_limit_ms,
        memory_limit_mb: d.memory_limit_mb,
        max_marks: Number(d.max_marks),
        test_cases: d.test_cases
      }));

      const saveResult = await post(
        `/api/teacher/tests/${contestId}/ai/save`,
        { questions }
      );

      setDrafts((previous) =>
        previous.filter((d) => !selectedDrafts.some((s) => s._id === d._id))
      );

      setTestTitle("");
      setTestDescription("");
      setStartTime("");
      setEndTime("");
      setAccessPassword("");

      setMessage(
        `Test created and questions saved successfully. Test ID: ${contestId}. ${saveResult.message || ""}`
      );

      if (onSaved) {
        await onSaved();
      }
    } catch (e) {
      if (contestId) {
        setError(
          `Test ID ${contestId} was created, but question saving failed: ${e.message}. Do not create another test.`
        );
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="aiq aiq-layout">

      {/* ================= LEFT: GENERATE + REVIEW ================= */}
      <div className="aiq-main">

        {/* STEP 1 */}
        <form className="aiq-card" onSubmit={generate}>
          <div className="aiq-head">
            <div className="aiq-icon"><Sparkles size={20} /></div>
            <div>
              <span className="aiq-step">Step 1</span>
              <h2>Generate questions with AI</h2>
              <p>Describe a topic and get coding problems with visible and hidden test cases.</p>
            </div>
          </div>

          <label htmlFor="aiq-topic">Topic</label>
          <textarea
            id="aiq-topic"
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Example: arrays, binary search, linked lists"
            maxLength={500}
            required
          />

          <div className="aiq-chips" aria-label="Topic suggestions">
            {TOPIC_SUGGESTIONS.map((name) => (
              <button
                key={name}
                type="button"
                className="aiq-chip"
                onClick={() => addTopic(name)}
              >
                + {name}
              </button>
            ))}
          </div>

          <div className="aiq-row">
            <div>
              <label htmlFor="aiq-difficulty">Difficulty</label>
              <select
                id="aiq-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
            <div>
              <label htmlFor="aiq-count">Number of questions (1–8)</label>
              <input
                id="aiq-count"
                type="number"
                min="1"
                max="8"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                required
              />
            </div>
          </div>

          <label htmlFor="aiq-notes">Extra instructions (optional)</label>
          <input
            id="aiq-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: avoid recursion"
            maxLength={1000}
          />

          <div className="aiq-actions">
            <button
              className="aiq-btn aiq-btn-primary"
              type="submit"
              disabled={generating || saving}
            >
              <Sparkles size={16} />
              {generating ? "Generating…" : "Generate questions"}
            </button>
          </div>
        </form>

        {error && (
          <div className="aiq-msg error" role="alert">
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {message && (
          <div className="aiq-msg success">
            <CheckCircle size={16} /> {message}
          </div>
        )}

        {/* STEP 2 */}
        <div className="aiq-card">
          <div className="aiq-list-head">
            <div>
              <span className="aiq-step">Step 2</span>
              <h3>
                Review questions
                {drafts.length > 0 && <em className="aiq-count">{drafts.length}</em>}
              </h3>
              <p>
                {drafts.length === 0
                  ? "Generated questions will appear here."
                  : `${selectedDrafts.length} selected. Open a question to edit it or see its test cases.`}
              </p>
            </div>

            {drafts.length > 0 && (
              <div className="aiq-actions">
                <button type="button" className="aiq-btn aiq-btn-ghost" onClick={selectAll}>
                  Select all
                </button>
                <button type="button" className="aiq-btn aiq-btn-ghost" onClick={deselectAll}>
                  Deselect all
                </button>
                <button
                  type="button"
                  className="aiq-btn aiq-btn-ghost"
                  disabled={saving || generating}
                  onClick={() => {
                    if (window.confirm("Remove all unsaved drafts?")) setDrafts([]);
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {drafts.length === 0 ? (
            <div className="aiq-empty">
              <span><FileText size={20} /></span>
              <strong>No questions yet</strong>
              <p>Fill in a topic above and press “Generate questions”.</p>
            </div>
          ) : (
            <div className="aiq-drafts">
              {drafts.map((d, index) => (
                <article
                  key={d._id}
                  className={`aiq-draft ${d.selected ? "selected" : ""}`}
                >
                  <div className="aiq-draft-top">
                    <label className="aiq-check">
                      <input
                        type="checkbox"
                        checked={d.selected}
                        onChange={(e) =>
                          updateDraft(d._id, { selected: e.target.checked })
                        }
                      />
                      Q{index + 1}
                    </label>

                    <span className={`aiq-badge ${d.verified ? "ok" : "warn"}`}>
                      {d.verified ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      {d.verified ? "Verified" : "Not verified"}
                    </span>

                    <span className={`aiq-diff ${(d.difficulty || "easy").toLowerCase()}`}>
                      {d.difficulty}
                    </span>

                    <button
                      type="button"
                      className="aiq-icon-btn"
                      title="Remove question"
                      onClick={() => removeDraft(d._id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {d.verify_note && (
                    <p className={`aiq-note ${d.verified ? "ok" : "warn"}`}>
                      {d.verify_note}
                    </p>
                  )}

                  <label>Title</label>
                  <input
                    value={d.title}
                    onChange={(e) => updateDraft(d._id, { title: e.target.value })}
                  />

                  <label>Statement</label>
                  <textarea
                    rows={8}
                    value={d.statement}
                    onChange={(e) =>
                      updateDraft(d._id, { statement: e.target.value })
                    }
                  />

                  <div className="aiq-row">
                    <div>
                      <label>Maximum marks</label>
                      <input
                        type="number"
                        min="0.5"
                        max="1000"
                        step="0.5"
                        value={d.max_marks}
                        onChange={(e) =>
                          updateDraft(d._id, { max_marks: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="aiq-toggle"
                    onClick={() => updateDraft(d._id, { open: !d.open })}
                  >
                    {d.open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    {d.open ? "Hide" : "Show"} {d.test_cases?.length || 0} test cases
                    {" "}
                    ({(d.test_cases || []).filter((t) => !t.is_hidden).length} visible,{" "}
                    {(d.test_cases || []).filter((t) => t.is_hidden).length} hidden)
                  </button>

                  {d.open && (
                    <div className="aiq-cases">
                      {(d.test_cases || []).map((tc, i) => (
                        <div className="aiq-case" key={i}>
                          <div className="aiq-case-head">
                            <strong>Test case {i + 1}</strong>
                            <span className={`aiq-vis ${tc.is_hidden ? "hidden" : "visible"}`}>
                              {tc.is_hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                              {tc.is_hidden ? "Hidden" : "Visible"}
                            </span>
                          </div>
                          <div className="aiq-case-grid">
                            <div>
                              <span>Input</span>
                              <pre>{tc.input}</pre>
                            </div>
                            <div>
                              <span>Expected output</span>
                              <pre>{tc.expected_output}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT: CREATE TEST ================= */}
      <aside className="aiq-side">
        <div className="aiq-card aiq-sticky">
          <div className="aiq-head">
            <div className="aiq-icon"><CheckCircle size={20} /></div>
            <div>
              <span className="aiq-step">Step 3</span>
              <h2>Create test</h2>
              <p>Enter the test details, then save the selected questions.</p>
            </div>
          </div>

          <div className={`aiq-summary ${selectedDrafts.length ? "has" : ""}`}>
            <div>
              <strong>{selectedDrafts.length}</strong>
              <span>of {drafts.length} selected</span>
            </div>
            <div>
              <strong>{selectedMarks}</strong>
              <span>total marks</span>
            </div>
          </div>

          <label htmlFor="aiq-title">Test title</label>
          <input
            id="aiq-title"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            placeholder="DSA Mid Semester Test"
            required
          />

          <label htmlFor="aiq-description">Description</label>
          <textarea
            id="aiq-description"
            rows={3}
            value={testDescription}
            onChange={(e) => setTestDescription(e.target.value)}
            placeholder="Describe this assessment"
          />

          <label htmlFor="aiq-start">Start time</label>
          <input
            id="aiq-start"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />

          <label htmlFor="aiq-end">End time</label>
          <input
            id="aiq-end"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />

          <label htmlFor="aiq-password">Optional test password</label>
          <div className="aiq-pass">
            <input
              id="aiq-password"
              type={showPassword ? "text" : "password"}
              value={accessPassword}
              onChange={(e) => setAccessPassword(e.target.value)}
              placeholder="Leave blank for no password"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="aiq-pass-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="aiq-actions aiq-actions-full">
            <button
              type="button"
              className="aiq-btn aiq-btn-primary aiq-btn-block"
              onClick={saveSelected}
              disabled={saving || generating || selectedDrafts.length === 0}
            >
              <CheckCircle size={16} />
              {saving
                ? "Creating test and saving…"
                : `Create test & save ${selectedDrafts.length} question${selectedDrafts.length === 1 ? "" : "s"}`}
            </button>

            {selectedDrafts.length === 0 && (
              <p className="aiq-hint">Select at least one question to continue.</p>
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}

export default AIQuestionGenerator;