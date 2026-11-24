import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Loader2,
  ScanFace,
  ShieldCheck
} from "lucide-react";
import { captureFace, loadFaceApi } from "./faceId.js";
import "./IdentityGate.css";

/*
  Test shuru hone se pehle identity check.
  - Pehli baar:  face register karo (3 samples)
  - Baad mein:   registered face se match karo (max 3 koshish)
  - 3 baar fail: teacher approve kare tab tak blocked
*/
function IdentityGate({
  sourceVideoRef,
  identity,
  onPassed,
  blockedMessage
}) {
  const gateVideoRef = useRef(null);

  const [phase, setPhase] = useState("loading"); // loading|enroll|verify|blocked|error
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState({ failed: 0, max: 3 });

  const applyStatus = useCallback(
    (status) => {
      setInfo({
        failed: status.failed_attempts ?? 0,
        max: status.max_attempts ?? 3
      });

      if (status.verified) {
        onPassed();
      } else if (status.blocked) {
        setPhase("blocked");
      } else {
        setPhase(status.enrolled ? "verify" : "enroll");
      }
    },
    [onPassed]
  );

  const loadStatus = useCallback(async () => {
    setPhase("loading");
    setMessage("");

    try {
      const [status] = await Promise.all([
        identity.getStatus(),
        loadFaceApi()
      ]);

      applyStatus(status);
    } catch (err) {
      setMessage(err.message || "Could not start the identity check.");
      setPhase("error");
    }
  }, [identity, applyStatus]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Camera ki stream ko is bade video mein dikhao
  useEffect(() => {
    const video = gateVideoRef.current;
    const stream = sourceVideoRef.current?.srcObject;

    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [sourceVideoRef, phase]);

  // Blocked ho to teacher ke approval ka intezaar
  useEffect(() => {
    if (phase !== "blocked") return undefined;

    const timer = setInterval(async () => {
      try {
        const status = await identity.getStatus();

        if (status.verified) onPassed();
        else if (!status.blocked) applyStatus(status);
      } catch {
        /* agle round mein dobara */
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [phase, identity, onPassed, applyStatus]);

  const enroll = async () => {
    setBusy(true);
    setMessage("Hold still, capturing...");

    try {
      const face = await captureFace(gateVideoRef.current, 3, 600);
      await identity.submit({ kind: "enroll", ...face });
      onPassed();
    } catch (err) {
      setMessage(err.message || "Could not register your face.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setMessage("Checking...");

    try {
      const face = await captureFace(gateVideoRef.current, 1);
      const result = await identity.submit({ kind: "start", ...face });

      if (result.matched || result.verified) {
        onPassed();
        return;
      }

      setInfo({
        failed: result.failed_attempts ?? 0,
        max: result.max_attempts ?? 3
      });

      if (result.blocked) {
        setPhase("blocked");
        setMessage("");
      } else {
        setMessage(
          `Face did not match (attempt ${result.failed_attempts} of ${result.max_attempts}). Check the lighting and try again.`
        );
      }
    } catch (err) {
      setMessage(err.message || "Could not verify your face.");
    } finally {
      setBusy(false);
    }
  };

  const showVideo = phase === "enroll" || phase === "verify";

  return (
    <div className="idg-overlay" role="dialog" aria-modal="true">
      <div className="idg-card">
        <div className="idg-icon">
          <ScanFace size={28} />
        </div>

        {phase === "loading" && (
          <>
            <h2>Preparing identity check</h2>
            <p className="idg-wait">
              <Loader2 size={16} className="spin" /> Loading face model...
            </p>
          </>
        )}

        {phase === "error" && (
          <>
            <h2>Identity check unavailable</h2>
            <div className="idg-error">
              <AlertTriangle size={15} /> {message}
            </div>
            <button className="idg-btn" type="button" onClick={loadStatus}>
              Try again
            </button>
          </>
        )}

        {phase === "blocked" && (
          <>
            <h2>We could not verify your identity</h2>
            <p>
              {blockedMessage ||
                `Your face did not match the registered face after ${info.max} attempts. Your teacher has been notified. Please ask your teacher to approve you.`}
            </p>
            <p className="idg-wait">
              <Loader2 size={16} className="spin" />{" "}
              {blockedMessage
                ? "Checking again shortly..."
                : "Waiting for your teacher..."}
            </p>
          </>
        )}

        {showVideo && (
          <>
            <h2>
              {phase === "enroll"
                ? "Register your face"
                : "Verify it is you"}
            </h2>

            <p>
              {phase === "enroll"
                ? "This is your first test, so we need to register your face. Only you should be in the frame, with your face centred and clearly lit."
                : "Look straight at the camera. Your face is compared with the face registered on your account."}
            </p>

            <video
              ref={gateVideoRef}
              className="idg-video"
              muted
              playsInline
              autoPlay
            />

            <ul className="idg-points">
              <li>
                <ShieldCheck size={14} />
                A small snapshot and a numeric face signature are saved so your
                teacher can confirm your identity. Video is never recorded.
              </li>
              {phase === "verify" && (
                <li>
                  <ShieldCheck size={14} />
                  Attempts used: {info.failed} of {info.max}
                </li>
              )}
            </ul>

            {message && (
              <div
                className={`idg-note ${
                  message.startsWith("Face did not") ||
                  message.startsWith("No face") ||
                  message.startsWith("Only you")
                    ? "bad"
                    : ""
                }`}
              >
                {message}
              </div>
            )}

            <button
              className="idg-btn"
              type="button"
              onClick={phase === "enroll" ? enroll : verify}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="spin" /> Working...
                </>
              ) : (
                <>
                  <Camera size={16} />
                  {phase === "enroll" ? "Register my face" : "Verify my face"}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default IdentityGate;