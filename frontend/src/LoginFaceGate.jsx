// import { useEffect, useMemo, useRef, useState } from "react";
// import { AlertTriangle, Camera, Loader2, LogOut, ScanFace } from "lucide-react";
// import IdentityGate from "./IdentityGate.jsx";
// import { markFaceVerified } from "./faceSession.js";
// import "./IdentityGate.css";

// const API_BASE = "http://localhost:5000";

// /*
//   Login ke turant baad, dashboard dikhne se pehle face check.
//   - Pehli baar login: face register
//   - Baad mein:        registered face se match
// */
// function LoginFaceGate({ onVerified, onLogout }) {
//   const token = localStorage.getItem("codeshield_token");

//   const videoRef = useRef(null);
//   const streamRef = useRef(null);

//   const [camera, setCamera] = useState("idle"); // idle|starting|on|error
//   const [error, setError] = useState("");

//   const identity = useMemo(() => {
//     const call = async (path, method, body) => {
//       const response = await fetch(`${API_BASE}${path}`, {
//         method,
//         headers: {
//           Authorization: `Bearer ${token || ""}`,
//           "Content-Type": "application/json"
//         },
//         body: body ? JSON.stringify(body) : undefined
//       });

//       const data = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(data.error || "Identity request failed.");
//       }

//       return data;
//     };

//     return {
//       getStatus: () => call("/api/identity/status", "GET"),
//       submit: (payload) =>
//         call("/api/identity/login-check", "POST", {
//           ...payload,
//           kind: payload.kind === "start" ? "login" : payload.kind
//         })
//     };
//   }, [token]);

//   const stopCamera = () => {
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach((t) => t.stop());
//       streamRef.current = null;
//     }
//   };

//   useEffect(() => stopCamera, []);

//   const startCamera = async () => {
//     setCamera("starting");
//     setError("");

//     try {
//       if (!navigator.mediaDevices?.getUserMedia) {
//         throw new Error(
//           "This browser does not support camera access. Use localhost or HTTPS."
//         );
//       }

//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { width: 640, height: 480, facingMode: "user" },
//         audio: false
//       });

//       streamRef.current = stream;
//       videoRef.current.srcObject = stream;
//       await videoRef.current.play();

//       setCamera("on");
//     } catch (err) {
//       stopCamera();

//       const name = err?.name || "";

//       setError(
//         name === "NotAllowedError" || name === "SecurityError"
//           ? "Camera permission was denied. Allow camera access in your browser and try again."
//           : name === "NotFoundError"
//             ? "No camera was found on this device."
//             : name === "NotReadableError"
//               ? "Your camera is being used by another application."
//               : err?.message || "Could not start the camera."
//       );
//       setCamera("error");
//     }
//   };

//   const handlePassed = () => {
//     stopCamera();
//     markFaceVerified();
//     onVerified();
//   };

//   return (
//     <>
//       <video
//         ref={videoRef}
//         muted
//         playsInline
//         style={{ position: "fixed", width: 1, height: 1, opacity: 0 }}
//       />

//       {camera === "on" ? (
//         <>
//           <IdentityGate
//             sourceVideoRef={videoRef}
//             identity={identity}
//             onPassed={handlePassed}
//             blockedMessage="Too many failed face checks. Please wait a few minutes and try again, or contact your teacher."
//           />

//           <button
//             type="button"
//             className="idg-logout"
//             onClick={() => {
//               stopCamera();
//               onLogout?.();
//             }}
//           >
//             <LogOut size={14} /> Log out
//           </button>
//         </>
//       ) : (
//         <div className="idg-overlay" role="dialog" aria-modal="true">
//           <div className="idg-card">
//             <div className="idg-icon">
//               <ScanFace size={28} />
//             </div>

//             <h2>Verify your identity</h2>

//             <p>
//               To protect your account and your exams, we confirm it is really
//               you with your webcam each time you log in. If this is your first
//               login, we will register your face.
//             </p>

//             <ul className="idg-points">
//               <li>
//                 <Camera size={14} />
//                 Video is never recorded. A small snapshot and a numeric face
//                 signature are saved to confirm your identity; your teacher can
//                 see them.
//               </li>
//             </ul>

//             {error && (
//               <div className="idg-error">
//                 <AlertTriangle size={15} /> {error}
//               </div>
//             )}

//             <button
//               className="idg-btn"
//               type="button"
//               onClick={startCamera}
//               disabled={camera === "starting"}
//             >
//               {camera === "starting" ? (
//                 <>
//                   <Loader2 size={16} className="spin" /> Starting camera...
//                 </>
//               ) : (
//                 <>
//                   <Camera size={16} /> Allow camera &amp; continue
//                 </>
//               )}
//             </button>

//             <button
//               type="button"
//               className="idg-link"
//               onClick={() => onLogout?.()}
//             >
//               Not you? Log out
//             </button>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default LoginFaceGate;


import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Loader2, LogOut, ScanFace } from "lucide-react";
import IdentityGate from "./IdentityGate.jsx";
import { markFaceVerified } from "./faceSession.js";
import "./IdentityGate.css";

const API_BASE = "http://localhost:5000";

/*
  Pehli baar login par ek baar face setup.
  Setup ke baad StudentDashboard ye gate dobara nahi dikhata
  (sirf teacher "reset face" kare tab dobara).
  - Face registered nahi: face register
  - Registered (par is browser mein flag nahi): ek baar match, phir kabhi nahi
*/
function LoginFaceGate({ onVerified, onLogout }) {
  const token = localStorage.getItem("codeshield_token");

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [camera, setCamera] = useState("idle"); // idle|starting|on|error
  const [error, setError] = useState("");

  const identity = useMemo(() => {
    const call = async (path, method, body) => {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Identity request failed.");
      }

      return data;
    };

    return {
      getStatus: () => call("/api/identity/status", "GET"),
      submit: (payload) =>
        call("/api/identity/login-check", "POST", {
          ...payload,
          kind: payload.kind === "start" ? "login" : payload.kind
        })
    };
  }, [token]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    setCamera("starting");
    setError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "This browser does not support camera access. Use localhost or HTTPS."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCamera("on");
    } catch (err) {
      stopCamera();

      const name = err?.name || "";

      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera permission was denied. Allow camera access in your browser and try again."
          : name === "NotFoundError"
            ? "No camera was found on this device."
            : name === "NotReadableError"
              ? "Your camera is being used by another application."
              : err?.message || "Could not start the camera."
      );
      setCamera("error");
    }
  };

  const handlePassed = () => {
    stopCamera();
    markFaceVerified();
    onVerified();
  };

  return (
    <>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ position: "fixed", width: 1, height: 1, opacity: 0 }}
      />

      {camera === "on" ? (
        <>
          <IdentityGate
            sourceVideoRef={videoRef}
            identity={identity}
            onPassed={handlePassed}
            blockedMessage="Too many failed face checks. Please wait a few minutes and try again, or contact your teacher."
          />

          <button
            type="button"
            className="idg-logout"
            onClick={() => {
              stopCamera();
              onLogout?.();
            }}
          >
            <LogOut size={14} /> Log out
          </button>
        </>
      ) : (
        <div className="idg-overlay" role="dialog" aria-modal="true">
          <div className="idg-card">
            <div className="idg-icon">
              <ScanFace size={28} />
            </div>

            <h2>One-time face setup</h2>

            <p>
              We register your face once so your exams can be protected. You
              will not be asked again when you log in. During an exam, the
              camera only runs quietly in the background.
            </p>

            <ul className="idg-points">
              <li>
                <Camera size={14} />
                Video is never recorded. A small snapshot and a numeric face
                signature are saved to confirm your identity; your teacher can
                see them.
              </li>
            </ul>

            {error && (
              <div className="idg-error">
                <AlertTriangle size={15} /> {error}
              </div>
            )}

            <button
              className="idg-btn"
              type="button"
              onClick={startCamera}
              disabled={camera === "starting"}
            >
              {camera === "starting" ? (
                <>
                  <Loader2 size={16} className="spin" /> Starting camera...
                </>
              ) : (
                <>
                  <Camera size={16} /> Allow camera &amp; continue
                </>
              )}
            </button>

            <button
              type="button"
              className="idg-link"
              onClick={() => onLogout?.()}
            >
              Not you? Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default LoginFaceGate;