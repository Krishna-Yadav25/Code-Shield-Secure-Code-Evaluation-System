import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import MODEL_URL from "./models/face_landmarker.task?url";
import { captureFrame } from "./snapshot.js";

/* ============================================================
   SETTINGS
   ============================================================ */

// Version package.json wali version se match honi chahiye (0.10.14)
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// Model file: frontend/src/models/face_landmarker.task (upar import ho rahi hai)

const CHECK_MS = 250;              // 4 frames per second kaafi hai
const VIOLATION_AFTER_MS = 3000;   // itni der gadbad rahe tab warning
const REPEAT_MS = 10000;           // gadbad chalti rahe to dobara warning
const RESET_AFTER_MS = 1500;       // itni der theek rahe to reset

const YAW_LIMIT = 0.22;            // sir left/right ghuma (0.5 = seedha)
const GAZE_LIMIT = 0.6;            // aankhein side mein (0 se 1)

/* ============================================================
   FRAME CLASSIFIER
   ============================================================ */

function classify(result) {
  const faces = result?.faceLandmarks || [];

  if (faces.length === 0) return "NO_FACE";
  if (faces.length > 1) return "MULTI_FACE";

  const lm = faces[0];

  // Head turn: nose ki position dono gaalon ke beech
  const nose = lm[1];
  const cheekA = lm[234];
  const cheekB = lm[454];

  const minX = Math.min(cheekA.x, cheekB.x);
  const width = Math.abs(cheekA.x - cheekB.x) || 1e-6;
  const ratio = (nose.x - minX) / width;

  if (Math.abs(ratio - 0.5) > YAW_LIMIT) return "LOOK_AWAY";

  // Eye gaze: blendshape scores
  const shapes = result?.faceBlendshapes?.[0]?.categories || [];
  const score = (name) =>
    shapes.find((c) => c.categoryName === name)?.score ?? 0;

  const toRight =
    (score("eyeLookOutLeft") + score("eyeLookInRight")) / 2;
  const toLeft =
    (score("eyeLookInLeft") + score("eyeLookOutRight")) / 2;

  if (Math.max(toRight, toLeft) > GAZE_LIMIT) return "LOOK_AWAY";

  return "OK";
}

function friendlyError(err) {
  const name = err?.name || "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission was denied. Allow camera access in your browser and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError") {
    return "Your camera is being used by another application.";
  }

  return err?.message || "Could not start the camera.";
}

/* ============================================================
   HOOK
   ============================================================ */

export default function useEyeMonitor({ paused = false, onViolation }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const timerRef = useRef(null);

  const pausedRef = useRef(paused);
  const onViolationRef = useRef(onViolation);

  const trackRef = useRef({
    badType: null,
    badSince: null,
    reportedAt: null,
    okSince: null
  });

  const [status, setStatus] = useState("idle"); // idle|loading|running|error
  const [live, setLive] = useState("OK");
  const [error, setError] = useState("");

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  const resetTracking = () => {
    trackRef.current = {
      badType: null,
      badSince: null,
      reportedAt: null,
      okSince: null
    };
  };

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    resetTracking();
    setLive("OK");
    setStatus((s) => (s === "error" ? s : "idle"));
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) return;

    let state;

    try {
      state = classify(
        landmarker.detectForVideo(video, performance.now())
      );
    } catch {
      return;
    }

    const now = Date.now();
    const t = trackRef.current;

    if (state === "OK") {
      if (t.okSince == null) t.okSince = now;

      if (now - t.okSince >= RESET_AFTER_MS) {
        t.badType = null;
        t.badSince = null;
        t.reportedAt = null;
        setLive("OK");
      }
      return;
    }

    t.okSince = null;

    if (t.badType !== state) {
      t.badType = state;
      t.badSince = now;
      t.reportedAt = null;
    }

    setLive(state);

    const longEnough = now - t.badSince >= VIOLATION_AFTER_MS;
    const dueAgain =
      t.reportedAt == null || now - t.reportedAt >= REPEAT_MS;

    if (longEnough && dueAgain) {
      t.reportedAt = now;

      if (!pausedRef.current) {
        onViolationRef.current?.({
          type: state,
          durationMs: now - t.badSince,
          // Multiple faces par camera ki photo teacher ko evidence ke taur par jati hai
          snapshot: state === "MULTI_FACE" ? captureFrame(video) : null
        });
      }
    }
  }, []);

  const start = useCallback(async () => {
    setStatus("loading");
    setError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "This browser does not support camera access. Use localhost or HTTPS."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false
      });

      streamRef.current = stream;

      // Student ne test ke beech camera band kar diya / nikaal diya
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        streamRef.current = null;
        setStatus("error");
        setError("Your camera was turned off. Turn it on to continue the test.");

        if (!pausedRef.current) {
          onViolationRef.current?.({ type: "CAMERA_OFF", durationMs: 0 });
        }
      });

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      if (!landmarkerRef.current) {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);

        landmarkerRef.current = await FaceLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: { modelAssetPath: MODEL_URL },
            runningMode: "VIDEO",
            numFaces: 2,
            outputFaceBlendshapes: true
          }
        );
      }

      resetTracking();
      timerRef.current = setInterval(tick, CHECK_MS);
      setStatus("running");
    } catch (err) {
      console.error("Eye monitor start error:", err);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setError(friendlyError(err));
      setStatus("error");
    }
  }, [tick]);

  // Unmount par sab band
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      try {
        landmarkerRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { videoRef, status, live, error, start, stop };
}