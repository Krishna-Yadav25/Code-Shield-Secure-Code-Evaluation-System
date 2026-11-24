import { useEffect, useRef } from "react";
import { captureFace } from "./faceId.js";

/*
  Test ke dauran beech-beech mein chupchap check karta hai ki
  camera ke saamne wahi student hai ya koi aur.

  Mismatch ek baar aaye to 20 second baad dobara check hota hai;
  lagatar 2 baar mismatch ho tabhi onMismatch() chalta hai.
*/

const FIRST_CHECK_MS = 2 * 60 * 1000;
const EVERY_MS = 5 * 60 * 1000;
const JITTER_MS = 60 * 1000;
const CONFIRM_MS = 20 * 1000;
const RETRY_MS = 30 * 1000;

export default function useIdentityWatch({
  enabled,
  videoRef,
  submit,
  onMismatch
}) {
  const submitRef = useRef(submit);
  const mismatchRef = useRef(onMismatch);

  useEffect(() => {
    submitRef.current = submit;
    mismatchRef.current = onMismatch;
  }, [submit, onMismatch]);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let timer = null;
    let mismatches = 0;

    const schedule = (ms) => {
      if (!cancelled) timer = setTimeout(run, ms);
    };

    const nextRegular = () => EVERY_MS + Math.random() * JITTER_MS;

    async function run() {
      if (cancelled) return;

      const video = videoRef.current;

      try {
        if (!video || video.readyState < 2) {
          throw new Error("video not ready");
        }

        const face = await captureFace(video, 1);
        const result = await submitRef.current({ kind: "periodic", ...face });

        if (result.matched) {
          mismatches = 0;
          schedule(nextRegular());
          return;
        }

        mismatches += 1;

        if (mismatches >= 2) {
          mismatches = 0;
          mismatchRef.current?.(face.photo);
          schedule(nextRegular());
        } else {
          schedule(CONFIRM_MS);
        }
      } catch {
        // Chehra nahi dikha / network gadbad: thodi der baad dobara
        schedule(RETRY_MS);
      }
    }

    schedule(FIRST_CHECK_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, videoRef]);
}