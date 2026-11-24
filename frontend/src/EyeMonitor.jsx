// import { useEffect, useRef, useState } from "react";
// import { Camera, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
// import useEyeMonitor from "./useEyeMonitor.js";
// import useIdentityWatch from "./useIdentityWatch.js";
// import IdentityGate from "./IdentityGate.jsx";
// import "./EyeMonitor.css";

// const LIVE_LABELS = {
//   OK: "Monitoring",
//   NO_FACE: "Face not visible",
//   MULTI_FACE: "Multiple faces",
//   LOOK_AWAY: "Look at the screen"
// };

// /*
//   Props
//   - active:   camera chalna chahiye (test in-progress)
//   - paused:   freeze ke dauran alert report na ho
//   - identity: { getStatus(), submit(payload) }  -> face verification (optional)
//   - onViolation({ type, durationMs })  -> alert sirf teacher ko jata hai
//   - onStartingChange(bool): permission prompt khulne par tab-switch na ginne ke liye
// */
// function EyeMonitor({
//   active,
//   paused,
//   identity,
//   onViolation,
//   onStartingChange
// }) {
//   const { videoRef, status, live, error, start, stop } = useEyeMonitor({
//     paused,
//     onViolation
//   });

//   const startingRef = useRef(onStartingChange);
//   const [idPassed, setIdPassed] = useState(false);

//   useEffect(() => {
//     startingRef.current = onStartingChange;
//   }, [onStartingChange]);

//   // Test submit / band hone par camera band
//   useEffect(() => {
//     if (!active) stop();
//   }, [active, stop]);

//   useEffect(() => {
//     startingRef.current?.(status === "loading");
//   }, [status]);

//   const running = status === "running";
//   const loading = status === "loading";
//   const alert = running && live !== "OK";

//   const needsIdentity = Boolean(identity);

//   // Test ke dauran beech-beech mein identity dobara check
//   useIdentityWatch({
//     enabled: running && active && !paused && needsIdentity && idPassed,
//     videoRef,
//     submit: identity?.submit,
//     onMismatch: (photo) =>
//       onViolation?.({ type: "FACE_MISMATCH", durationMs: 0, photo })
//   });

//   return (
//     <>
//       {/* Live preview (hamesha mounted, taaki video element ready rahe) */}
//       <div
//         className={`eye-preview ${running ? "show" : ""} ${
//           alert ? "alert" : ""
//         }`}
//       >
//         <video ref={videoRef} muted playsInline />
//         <div className="eye-preview-label">
//           <span className="eye-dot" />
//           {LIVE_LABELS[live] || "Monitoring"}
//         </div>
//       </div>

//       {/* Consent + permission screen */}
//       {active && !running && (
//         <div className="eye-overlay" role="dialog" aria-modal="true">
//           <div className="eye-card">
//             <div className="eye-icon">
//               <Camera size={28} />
//             </div>

//             <h2>Camera monitoring is required</h2>

//             <p>
//               This test uses your webcam to check that you stay in front of the
//               screen{needsIdentity ? " and that it is really you" : ""}. Please
//               read how it works before you continue.
//             </p>

//             <ul className="eye-points">
//               <li>
//                 <ShieldCheck size={15} />
//                 Video is processed on your device and is never recorded or
//                 uploaded.
//               </li>
//               {needsIdentity && (
//                 <li>
//                   <ShieldCheck size={15} />
//                   To confirm your identity, a small snapshot of your face and a
//                   numeric face signature are saved. Your teacher can see them.
//                 </li>
//               )}
//               <li>
//                 <ShieldCheck size={15} />
//                 Alerts are sent to your teacher: face not visible, multiple
//                 faces, looking away, a different person, or camera turned off.
//               </li>
//               <li>
//                 <ShieldCheck size={15} />
//                 Your teacher reviews these alerts and may freeze or end your
//                 test. Switching tabs more than 6 times also freezes your test.
//               </li>
//             </ul>

//             <p className="eye-tip">
//               Sit in a well-lit place and keep your face centred in the frame.
//             </p>

//             {error && (
//               <div className="eye-error">
//                 <AlertTriangle size={15} /> {error}
//               </div>
//             )}

//             <button
//               type="button"
//               className="eye-start-btn"
//               onClick={start}
//               disabled={loading}
//             >
//               {loading ? (
//                 <>
//                   <Loader2 size={16} className="spin" /> Starting camera...
//                 </>
//               ) : (
//                 <>
//                   <Camera size={16} />{" "}
//                   {status === "error" ? "Try again" : "Allow camera & continue"}
//                 </>
//               )}
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Identity check: camera chalne ke baad, test dikhne se pehle */}
//       {active && running && needsIdentity && !idPassed && (
//         <IdentityGate
//           sourceVideoRef={videoRef}
//           identity={identity}
//           onPassed={() => setIdPassed(true)}
//         />
//       )}
//     </>
//   );
// }

// export default EyeMonitor;

import { useCallback, useEffect, useRef } from "react";
import { Camera, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import useEyeMonitor from "./useEyeMonitor.js";
import useIdentityWatch from "./useIdentityWatch.js";
import "./EyeMonitor.css";

const LIVE_LABELS = {
  OK: "Monitoring",
  NO_FACE: "Face not visible",
  MULTI_FACE: "Multiple faces",
  LOOK_AWAY: "Look at the screen"
};

/*
  Exam ke dauran sirf camera monitoring hoti hai. Face verification
  (gate) yahan nahi maangi jati; face sirf ek baar signup ke baad
  pehle login par register hota hai.

  Props
  - active:   camera chalna chahiye (test in-progress)
  - paused:   freeze ke dauran alert report na ho
  - identity: { submit(payload) }  -> chupchap check ki doosra insaan to nahi (optional)
  - onViolation({ type, durationMs, photo })  -> alert sirf teacher ko jata hai
  - onStartingChange(bool): permission prompt khulne par tab-switch na ginne ke liye
*/

// Video ka ek chhota frame (JPEG) banata hai teacher ke liye
function captureFrame(video) {
  if (!video || !video.videoWidth || !video.videoHeight) return null;

  try {
    const width = 320;
    const height = Math.round((video.videoHeight / video.videoWidth) * width);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height || 240;

    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

function EyeMonitor({
  active,
  paused,
  identity,
  onViolation,
  onStartingChange
}) {
  const startingRef = useRef(onStartingChange);
  const onViolationRef = useRef(onViolation);
  const videoHolderRef = useRef(null);

  useEffect(() => {
    startingRef.current = onStartingChange;
  }, [onStartingChange]);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  // Har alert ke saath ek photo jodte hain (agar hook ne nahi di ho)
  const handleViolation = useCallback((violation) => {
    const handler = onViolationRef.current;

    if (!handler) return;

    const video = videoHolderRef.current?.current;

    handler({
      ...violation,
      photo: violation.snapshot || violation.photo || captureFrame(video)
    });
  }, []);

  const { videoRef, status, live, error, start, stop } = useEyeMonitor({
    paused,
    onViolation: handleViolation
  });

  videoHolderRef.current = videoRef;

  // Test submit / band hone par camera band
  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  useEffect(() => {
    startingRef.current?.(status === "loading");
  }, [status]);

  const running = status === "running";
  const loading = status === "loading";
  const alert = running && live !== "OK";

  const needsIdentity = Boolean(identity);

  // Exam ke dauran beech-beech mein chupchap check: kya wahi student hai?
  // Doosra chehra aaye to teacher ko incident jata hai.
  useIdentityWatch({
    enabled: running && active && !paused && needsIdentity,
    videoRef,
    submit: identity?.submit,
    onMismatch: (photo) =>
      handleViolation({ type: "FACE_MISMATCH", durationMs: 0, photo })
  });

  return (
    <>
      {/* Live preview (hamesha mounted, taaki video element ready rahe) */}
      <div
        className={`eye-preview ${running ? "show" : ""} ${
          alert ? "alert" : ""
        }`}
      >
        <video ref={videoRef} muted playsInline />
        <div className="eye-preview-label">
          <span className="eye-dot" />
          {LIVE_LABELS[live] || "Monitoring"}
        </div>
      </div>

      {/* Consent + permission screen */}
      {active && !running && (
        <div className="eye-overlay" role="dialog" aria-modal="true">
          <div className="eye-card">
            <div className="eye-icon">
              <Camera size={28} />
            </div>

            <h2>Camera monitoring is required</h2>

            <p>
              This test uses your webcam to check that you stay in front of the
              screen{needsIdentity ? " and that it is really you" : ""}. Please
              read how it works before you continue.
            </p>

            <ul className="eye-points">
              <li>
                <ShieldCheck size={15} />
                Video is processed on your device and is never recorded or
                uploaded.
              </li>
              {needsIdentity && (
                <li>
                  <ShieldCheck size={15} />
                  A numeric face signature is compared with the face you
                  registered at sign-up. A photo is saved only when something
                  looks wrong.
                </li>
              )}
              <li>
                <ShieldCheck size={15} />
                If something unusual happens (another face, a different person,
                face not visible, looking away, camera turned off), your
                teacher receives an alert with a photo.
              </li>
              <li>
                <ShieldCheck size={15} />
                Your teacher decides whether you continue, or whether your test
                is frozen or ended. Switching tabs more than 6 times also
                freezes your test.
              </li>
            </ul>

            <p className="eye-tip">
              Sit in a well-lit place and keep your face centred in the frame.
            </p>

            {error && (
              <div className="eye-error">
                <AlertTriangle size={15} /> {error}
              </div>
            )}

            <button
              type="button"
              className="eye-start-btn"
              onClick={start}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" /> Starting camera...
                </>
              ) : (
                <>
                  <Camera size={16} />{" "}
                  {status === "error" ? "Try again" : "Allow camera & continue"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default EyeMonitor;