// // import { useCallback, useEffect, useState } from "react";
// // import {
// //   AlertTriangle,
// //   Ban,
// //   CheckCircle,
// //   Lock,
// //   RefreshCw,
// //   ShieldAlert,
// //   Unlock,
// //   UserCheck
// // } from "lucide-react";
// // import "./IncidentPanel.css";

// // const API_BASE = "http://localhost:5000";
// // const POLL_MS = 10000;

// // const KIND_LABELS = {
// //   MULTI_FACE: "Multiple faces detected",
// //   FACE_MISMATCH: "Different person detected"
// // };

// // function formatDate(value) {
// //   if (!value) return "—";
// //   const d = new Date(value);
// //   return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
// // }

// // function IncidentPanel({ contestId, onChanged }) {
// //   const token = localStorage.getItem("codeshield_token");

// //   const [incidents, setIncidents] = useState([]);
// //   const [notes, setNotes] = useState({});
// //   const [loading, setLoading] = useState(false);
// //   const [error, setError] = useState("");
// //   const [message, setMessage] = useState("");
// //   const [busyId, setBusyId] = useState(null);

// //   const api = useCallback(
// //     async (path, options = {}) => {
// //       const response = await fetch(`${API_BASE}${path}`, {
// //         ...options,
// //         headers: {
// //           Authorization: `Bearer ${token}`,
// //           "Content-Type": "application/json"
// //         }
// //       });

// //       const data = await response.json().catch(() => ({}));

// //       if (!response.ok) {
// //         throw new Error(data.error || `Request failed (${response.status})`);
// //       }

// //       return data;
// //     },
// //     [token]
// //   );

// //   const load = useCallback(
// //     async (showLoader = false) => {
// //       if (showLoader) setLoading(true);

// //       try {
// //         const data = await api(`/api/teacher/tests/${contestId}/incidents`);
// //         setIncidents(data.incidents || []);
// //         setError("");
// //       } catch (e) {
// //         setError(e.message);
// //       } finally {
// //         if (showLoader) setLoading(false);
// //       }
// //     },
// //     [api, contestId]
// //   );

// //   useEffect(() => {
// //     load(true);

// //     const timer = setInterval(() => load(), POLL_MS);

// //     return () => clearInterval(timer);
// //   }, [load]);

// //   const decide = async (incident, decision) => {
// //     const name = incident.username;

// //     const text =
// //       decision === "freeze"
// //         ? `Freeze ${name}'s test? They cannot continue until you unlock them.`
// //         : decision === "reject"
// //           ? `End ${name}'s test? Their test will be submitted and ended.`
// //           : incident.student_frozen
// //             ? `Unlock ${name} and dismiss this alert?`
// //             : `Dismiss this alert? ${name} continues the test.`;

// //     if (!window.confirm(text)) return;

// //     setBusyId(incident.incident_id);
// //     setError("");
// //     setMessage("");

// //     try {
// //       const data = await api(
// //         `/api/teacher/tests/${contestId}/incidents/${incident.incident_id}/decide`,
// //         {
// //           method: "POST",
// //           body: JSON.stringify({
// //             decision,
// //             note: notes[incident.incident_id] || ""
// //           })
// //         }
// //       );

// //       setMessage(data.message || "Saved.");
// //       await load();

// //       if (typeof onChanged === "function") onChanged();
// //     } catch (e) {
// //       setError(e.message);
// //     } finally {
// //       setBusyId(null);
// //     }
// //   };

// //   const pending = incidents.filter((i) => i.status === "pending");

// //   const badge = (i) => {
// //     if (i.status === "pending") {
// //       return {
// //         className: "pc-badge frozen",
// //         text: i.student_frozen ? "Frozen: waiting for you" : "Needs review"
// //       };
// //     }

// //     if (i.status === "allowed") {
// //       return { className: "pc-badge active", text: "Dismissed" };
// //     }

// //     return { className: "pc-badge inc-rejected", text: "Test ended" };
// //   };

// //   return (
// //     <section className="teacher-report-panel">
// //       <div className="teacher-report-header">
// //         <div>
// //           <h2>Incidents</h2>
// //           <p>
// //             When a student's camera shows more than one face, or a different
// //             person from the registered student, a photo appears here. The
// //             student is not stopped and sees nothing. You decide: freeze the
// //             test, end it, or dismiss the alert.
// //           </p>
// //         </div>

// //         <button
// //           className="outline-btn"
// //           type="button"
// //           onClick={() => load(true)}
// //           disabled={loading}
// //         >
// //           <RefreshCw size={16} /> {loading ? "Loading..." : "Refresh"}
// //         </button>
// //       </div>

// //       {error && (
// //         <div className="settings-message error">
// //           <AlertTriangle size={16} /> {error}
// //         </div>
// //       )}

// //       {message && (
// //         <div className="settings-message success">
// //           <CheckCircle size={16} /> {message}
// //         </div>
// //       )}

// //       {pending.length > 0 && (
// //         <div className="pc-banner" style={{ marginBottom: 18 }}>
// //           <span>
// //             <ShieldAlert size={16} />
// //             {pending.length} alert{pending.length > 1 ? "s are" : " is"}{" "}
// //             waiting for your decision.
// //           </span>
// //         </div>
// //       )}

// //       {incidents.length === 0 ? (
// //         <div className="placeholder-panel">
// //           <CheckCircle size={28} />
// //           <h3>No incidents</h3>
// //           <p>
// //             Nothing has been flagged. Alerts appear here (this page refreshes
// //             every 10 seconds).
// //           </p>
// //         </div>
// //       ) : (
// //         <div className="inc-list">
// //           {incidents.map((i) => {
// //             const isPending = i.status === "pending";
// //             const busy = busyId === i.incident_id;
// //             const b = badge(i);

// //             return (
// //               <article
// //                 key={i.incident_id}
// //                 className={`inc-card ${isPending ? "pending" : ""}`}
// //               >
// //                 <div className="inc-photos">
// //                   <figure>
// //                     {i.photo ? (
// //                       <img src={i.photo} alt="Camera snapshot" />
// //                     ) : (
// //                       <div className="inc-nophoto">No photo</div>
// //                     )}
// //                     <figcaption>Camera snapshot</figcaption>
// //                   </figure>

// //                   {i.reference_photo && (
// //                     <figure className="inc-ref">
// //                       <img src={i.reference_photo} alt="Registered face" />
// //                       <figcaption>Registered face</figcaption>
// //                     </figure>
// //                   )}
// //                 </div>

// //                 <div className="inc-info">
// //                   <div className="inc-head">
// //                     <h3>{i.username}</h3>

// //                     <span className={b.className}>{b.text}</span>
// //                   </div>

// //                   <p className="inc-kind">
// //                     {KIND_LABELS[i.kind] || i.kind} · {formatDate(i.created_at)}
// //                   </p>

// //                   {isPending ? (
// //                     <>
// //                       <textarea
// //                         className="inc-note"
// //                         rows={2}
// //                         maxLength={300}
// //                         placeholder="Optional note (shown to the student if you freeze or end the test)"
// //                         value={notes[i.incident_id] || ""}
// //                         onChange={(e) =>
// //                           setNotes((prev) => ({
// //                             ...prev,
// //                             [i.incident_id]: e.target.value
// //                           }))
// //                         }
// //                       />

// //                       <div className="inc-actions">
// //                         {i.student_frozen ? (
// //                           <button
// //                             type="button"
// //                             className="pc-unlock-btn"
// //                             disabled={busy}
// //                             onClick={() => decide(i, "allow")}
// //                           >
// //                             <Unlock size={14} />
// //                             {busy ? "Saving..." : "Unlock & dismiss"}
// //                           </button>
// //                         ) : (
// //                           <>
// //                             <button
// //                               type="button"
// //                               className="outline-btn"
// //                               disabled={busy}
// //                               onClick={() => decide(i, "freeze")}
// //                             >
// //                               <Lock size={14} />
// //                               {busy ? "Saving..." : "Freeze test"}
// //                             </button>

// //                             <button
// //                               type="button"
// //                               className="pc-unlock-btn"
// //                               disabled={busy}
// //                               onClick={() => decide(i, "allow")}
// //                             >
// //                               <UserCheck size={14} />
// //                               Dismiss (false alarm)
// //                             </button>
// //                           </>
// //                         )}

// //                         <button
// //                           type="button"
// //                           className="inc-reject-btn"
// //                           disabled={busy}
// //                           onClick={() => decide(i, "reject")}
// //                         >
// //                           <Ban size={14} /> End test
// //                         </button>
// //                       </div>
// //                     </>
// //                   ) : (
// //                     <p className="inc-decided">
// //                       Decided {formatDate(i.decided_at)}
// //                       {i.note ? ` · Note: ${i.note}` : ""}
// //                     </p>
// //                   )}
// //                 </div>
// //               </article>
// //             );
// //           })}
// //         </div>
// //       )}

// //       <p className="pc-note">
// //         A photo is evidence to review, not proof. A family member walking past
// //         or a reflection can also trigger this, so look at the photo before
// //         ending a test.
// //       </p>
// //     </section>
// //   );
// // }

// // export default IncidentPanel;

// import { useCallback, useEffect, useState } from "react";
// import {
//   AlertTriangle,
//   Ban,
//   CheckCircle,
//   Lock,
//   RefreshCw,
//   ShieldAlert,
//   Unlock,
//   UserCheck
// } from "lucide-react";
// import "./IncidentPanel.css";

// const API_BASE = "http://localhost:5000";
// const POLL_MS = 10000;

// const KIND_LABELS = {
//   MULTI_FACE: "Another face appeared in the camera",
//   FACE_MISMATCH: "A different person is in front of the camera",
//   NO_FACE: "Student's face is not visible",
//   LOOK_AWAY: "Student is looking away from the screen",
//   CAMERA_OFF: "Student's camera was turned off"
// };

// function formatDate(value) {
//   if (!value) return "—";
//   const d = new Date(value);
//   return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
// }

// function IncidentPanel({ contestId, onChanged }) {
//   const token = localStorage.getItem("codeshield_token");

//   const [incidents, setIncidents] = useState([]);
//   const [notes, setNotes] = useState({});
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [message, setMessage] = useState("");
//   const [busyId, setBusyId] = useState(null);

//   const api = useCallback(
//     async (path, options = {}) => {
//       const response = await fetch(`${API_BASE}${path}`, {
//         ...options,
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json"
//         }
//       });

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || `Request failed (${response.status})`);
//       }

//       return data;
//     },
//     [token]
//   );

//   const load = useCallback(
//     async (showLoader = false) => {
//       if (showLoader) setLoading(true);

//       try {
//         const data = await api(`/api/teacher/tests/${contestId}/incidents`);
//         setIncidents(data.incidents || []);
//         setError("");
//       } catch (e) {
//         setError(e.message);
//       } finally {
//         if (showLoader) setLoading(false);
//       }
//     },
//     [api, contestId]
//   );

//   useEffect(() => {
//     load(true);

//     const timer = setInterval(() => load(), POLL_MS);

//     return () => clearInterval(timer);
//   }, [load]);

//   const decide = async (incident, decision) => {
//     const name = incident.username;

//     const text =
//       decision === "freeze"
//         ? `Freeze ${name}'s test? They cannot continue until you unlock them.`
//         : decision === "reject"
//           ? `End ${name}'s test? Their test will be submitted and ended.`
//           : incident.student_frozen
//             ? `Unlock ${name} and dismiss this alert?`
//             : `Dismiss this alert? ${name} continues the test.`;

//     if (!window.confirm(text)) return;

//     setBusyId(incident.incident_id);
//     setError("");
//     setMessage("");

//     try {
//       const data = await api(
//         `/api/teacher/tests/${contestId}/incidents/${incident.incident_id}/decide`,
//         {
//           method: "POST",
//           body: JSON.stringify({
//             decision,
//             note: notes[incident.incident_id] || ""
//           })
//         }
//       );

//       setMessage(data.message || "Saved.");
//       await load();

//       if (typeof onChanged === "function") onChanged();
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setBusyId(null);
//     }
//   };

//   const pending = incidents.filter((i) => i.status === "pending");

//   const badge = (i) => {
//     if (i.status === "pending") {
//       return {
//         className: "pc-badge frozen",
//         text: i.student_frozen ? "Frozen: waiting for you" : "Needs review"
//       };
//     }

//     if (i.status === "allowed") {
//       return { className: "pc-badge active", text: "Dismissed" };
//     }

//     return { className: "pc-badge inc-rejected", text: "Test ended" };
//   };

//   return (
//     <section className="teacher-report-panel">
//       <div className="teacher-report-header">
//         <div>
//           <h2>Incidents</h2>
//           <p>
//             Whenever a student's camera shows something unusual (another
//             face, a different person, face not visible, looking away or camera
//             turned off), the alert appears here with a photo. The student is
//             not stopped and sees nothing. You decide: let them continue,
//             freeze the test, or end (exit) it. Your decision applies to all
//             pending alerts of that student.
//           </p>
//         </div>

//         <button
//           className="outline-btn"
//           type="button"
//           onClick={() => load(true)}
//           disabled={loading}
//         >
//           <RefreshCw size={16} /> {loading ? "Loading..." : "Refresh"}
//         </button>
//       </div>

//       {error && (
//         <div className="settings-message error">
//           <AlertTriangle size={16} /> {error}
//         </div>
//       )}

//       {message && (
//         <div className="settings-message success">
//           <CheckCircle size={16} /> {message}
//         </div>
//       )}

//       {pending.length > 0 && (
//         <div className="pc-banner" style={{ marginBottom: 18 }}>
//           <span>
//             <ShieldAlert size={16} />
//             {pending.length} alert{pending.length > 1 ? "s are" : " is"}{" "}
//             waiting for your decision.
//           </span>
//         </div>
//       )}

//       {incidents.length === 0 ? (
//         <div className="placeholder-panel">
//           <CheckCircle size={28} />
//           <h3>No incidents</h3>
//           <p>
//             Nothing has been flagged. Alerts appear here (this page refreshes
//             every 10 seconds).
//           </p>
//         </div>
//       ) : (
//         <div className="inc-list">
//           {incidents.map((i) => {
//             const isPending = i.status === "pending";
//             const busy = busyId === i.incident_id;
//             const b = badge(i);

//             return (
//               <article
//                 key={i.incident_id}
//                 className={`inc-card ${isPending ? "pending" : ""}`}
//               >
//                 <div className="inc-photos">
//                   <figure>
//                     {i.photo ? (
//                       <img src={i.photo} alt="Camera snapshot" />
//                     ) : (
//                       <div className="inc-nophoto">No photo</div>
//                     )}
//                     <figcaption>Camera snapshot</figcaption>
//                   </figure>

//                   {i.reference_photo && (
//                     <figure className="inc-ref">
//                       <img src={i.reference_photo} alt="Registered face" />
//                       <figcaption>Registered face</figcaption>
//                     </figure>
//                   )}
//                 </div>

//                 <div className="inc-info">
//                   <div className="inc-head">
//                     <h3>{i.username}</h3>

//                     <span className={b.className}>{b.text}</span>
//                   </div>

//                   <p className="inc-kind">
//                     {KIND_LABELS[i.kind] || i.kind} · {formatDate(i.created_at)}
//                   </p>

//                   {isPending ? (
//                     <>
//                       <textarea
//                         className="inc-note"
//                         rows={2}
//                         maxLength={300}
//                         placeholder="Optional note (shown to the student if you freeze or end the test)"
//                         value={notes[i.incident_id] || ""}
//                         onChange={(e) =>
//                           setNotes((prev) => ({
//                             ...prev,
//                             [i.incident_id]: e.target.value
//                           }))
//                         }
//                       />

//                       <div className="inc-actions">
//                         {i.student_frozen ? (
//                           <button
//                             type="button"
//                             className="pc-unlock-btn"
//                             disabled={busy}
//                             onClick={() => decide(i, "allow")}
//                           >
//                             <Unlock size={14} />
//                             {busy ? "Saving..." : "Unlock & dismiss"}
//                           </button>
//                         ) : (
//                           <>
//                             <button
//                               type="button"
//                               className="outline-btn"
//                               disabled={busy}
//                               onClick={() => decide(i, "freeze")}
//                             >
//                               <Lock size={14} />
//                               {busy ? "Saving..." : "Freeze test"}
//                             </button>

//                             <button
//                               type="button"
//                               className="pc-unlock-btn"
//                               disabled={busy}
//                               onClick={() => decide(i, "allow")}
//                             >
//                               <UserCheck size={14} />
//                               Continue test
//                             </button>
//                           </>
//                         )}

//                         <button
//                           type="button"
//                           className="inc-reject-btn"
//                           disabled={busy}
//                           onClick={() => decide(i, "reject")}
//                         >
//                           <Ban size={14} /> End test
//                         </button>
//                       </div>
//                     </>
//                   ) : (
//                     <p className="inc-decided">
//                       Decided {formatDate(i.decided_at)}
//                       {i.note ? ` · Note: ${i.note}` : ""}
//                     </p>
//                   )}
//                 </div>
//               </article>
//             );
//           })}
//         </div>
//       )}

//       <p className="pc-note">
//         A photo is evidence to review, not proof. A family member walking past
//         or a reflection can also trigger this, so look at the photo before
//         ending a test.
//       </p>
//     </section>
//   );
// }

// export default IncidentPanel;


import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Lock,
  RefreshCw,
  ShieldAlert,
  Unlock,
  UserCheck
} from "lucide-react";
import "./IncidentPanel.css";

const API_BASE = "http://localhost:5000";
const POLL_MS = 10000;

const KIND_LABELS = {
  MULTI_FACE: "Another face appeared in the camera",
  FACE_MISMATCH: "A different person is in front of the camera",
  NO_FACE: "Student's face is not visible",
  LOOK_AWAY: "Student is looking away from the screen",
  CAMERA_OFF: "Student's camera was turned off",
  TAB_SWITCH: "Student switched tabs / left the exam window"
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function IncidentPanel({ contestId, onChanged }) {
  const token = localStorage.getItem("codeshield_token");

  const [incidents, setIncidents] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  const api = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      return data;
    },
    [token]
  );

  const load = useCallback(
    async (showLoader = false) => {
      if (showLoader) setLoading(true);

      try {
        const data = await api(`/api/teacher/tests/${contestId}/incidents`);
        setIncidents(data.incidents || []);
        setError("");
      } catch (e) {
        setError(e.message);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [api, contestId]
  );

  useEffect(() => {
    load(true);

    const timer = setInterval(() => load(), POLL_MS);

    return () => clearInterval(timer);
  }, [load]);

  const decide = async (incident, decision) => {
    const name = incident.username;

    const text =
      decision === "freeze"
        ? `Freeze ${name}'s test? They cannot continue until you unlock them.`
        : decision === "reject"
          ? `End ${name}'s test? Their test will be submitted and ended.`
          : incident.student_frozen
            ? `Unlock ${name} and dismiss this alert?`
            : `Dismiss this alert? ${name} continues the test.`;

    if (!window.confirm(text)) return;

    setBusyId(incident.incident_id);
    setError("");
    setMessage("");

    try {
      const data = await api(
        `/api/teacher/tests/${contestId}/incidents/${incident.incident_id}/decide`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            note: notes[incident.incident_id] || ""
          })
        }
      );

      setMessage(data.message || "Saved.");
      await load();

      if (typeof onChanged === "function") onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const pending = incidents.filter((i) => i.status === "pending");

  const badge = (i) => {
    if (i.status === "pending") {
      return {
        className: "pc-badge frozen",
        text: i.student_frozen ? "Frozen: waiting for you" : "Needs review"
      };
    }

    if (i.status === "allowed") {
      return { className: "pc-badge active", text: "Dismissed" };
    }

    return { className: "pc-badge inc-rejected", text: "Test ended" };
  };

  return (
    <section className="teacher-report-panel">
      <div className="teacher-report-header">
        <div>
          <h2>Incidents</h2>
          <p>
            Whenever a student's camera shows something unusual (another
            face, a different person, face not visible, looking away or camera
            turned off), the alert appears here with a photo. The student is
            not stopped and sees nothing. You decide: let them continue,
            freeze the test, or end (exit) it. Your decision applies to all
            pending alerts of that student.
          </p>
        </div>

        <button
          className="outline-btn"
          type="button"
          onClick={() => load(true)}
          disabled={loading}
        >
          <RefreshCw size={16} /> {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="settings-message error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {message && (
        <div className="settings-message success">
          <CheckCircle size={16} /> {message}
        </div>
      )}

      {pending.length > 0 && (
        <div className="pc-banner" style={{ marginBottom: 18 }}>
          <span>
            <ShieldAlert size={16} />
            {pending.length} alert{pending.length > 1 ? "s are" : " is"}{" "}
            waiting for your decision.
          </span>
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="placeholder-panel">
          <CheckCircle size={28} />
          <h3>No incidents</h3>
          <p>
            Nothing has been flagged. Alerts appear here (this page refreshes
            every 10 seconds).
          </p>
        </div>
      ) : (
        <div className="inc-list">
          {incidents.map((i) => {
            const isPending = i.status === "pending";
            const busy = busyId === i.incident_id;
            const b = badge(i);

            return (
              <article
                key={i.incident_id}
                className={`inc-card ${isPending ? "pending" : ""}`}
              >
                <div className="inc-photos">
                  <figure>
                    {i.photo ? (
                      <img src={i.photo} alt="Camera snapshot" />
                    ) : (
                      <div className="inc-nophoto">
                        {i.kind === "TAB_SWITCH"
                          ? "Tab switch (no camera photo)"
                          : "No photo"}
                      </div>
                    )}
                    <figcaption>Camera snapshot</figcaption>
                  </figure>

                  {i.reference_photo && (
                    <figure className="inc-ref">
                      <img src={i.reference_photo} alt="Registered face" />
                      <figcaption>Registered face</figcaption>
                    </figure>
                  )}
                </div>

                <div className="inc-info">
                  <div className="inc-head">
                    <h3>{i.username}</h3>

                    <span className={b.className}>{b.text}</span>
                  </div>

                  <p className="inc-kind">
                    {KIND_LABELS[i.kind] || i.kind} · {formatDate(i.created_at)}
                  </p>

                  {i.kind === "TAB_SWITCH" && (
                    <p className="inc-kind">
                      Tab switches so far: {i.tab_switch_count} of{" "}
                      {i.max_switches} allowed
                    </p>
                  )}

                  {isPending ? (
                    <>
                      <textarea
                        className="inc-note"
                        rows={2}
                        maxLength={300}
                        placeholder="Optional note (shown to the student if you freeze or end the test)"
                        value={notes[i.incident_id] || ""}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [i.incident_id]: e.target.value
                          }))
                        }
                      />

                      <div className="inc-actions">
                        {i.student_frozen ? (
                          <button
                            type="button"
                            className="pc-unlock-btn"
                            disabled={busy}
                            onClick={() => decide(i, "allow")}
                          >
                            <Unlock size={14} />
                            {busy ? "Saving..." : "Unlock & dismiss"}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="outline-btn"
                              disabled={busy}
                              onClick={() => decide(i, "freeze")}
                            >
                              <Lock size={14} />
                              {busy ? "Saving..." : "Freeze test"}
                            </button>

                            <button
                              type="button"
                              className="pc-unlock-btn"
                              disabled={busy}
                              onClick={() => decide(i, "allow")}
                            >
                              <UserCheck size={14} />
                              Continue test
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className="inc-reject-btn"
                          disabled={busy}
                          onClick={() => decide(i, "reject")}
                        >
                          <Ban size={14} /> End test
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="inc-decided">
                      Decided {formatDate(i.decided_at)}
                      {i.note ? ` · Note: ${i.note}` : ""}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="pc-note">
        A photo is evidence to review, not proof. A family member walking past
        or a reflection can also trigger this, so look at the photo before
        ending a test.
      </p>
    </section>
  );
}

export default IncidentPanel;