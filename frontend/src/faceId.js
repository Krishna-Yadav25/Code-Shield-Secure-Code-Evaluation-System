/*
  Browser mein face ki "signature" (128 numbers) nikalta hai.
  Video kahin upload nahi hoti; sirf signature + chhota snapshot server ko jata hai.

  Models: frontend/public/models/face/  (setup commands dekho)
*/

const MODEL_URL = "/models/face";

let apiPromise = null;

export function loadFaceApi() {
  if (!apiPromise) {
    apiPromise = (async () => {
      // Lazy import: bhari library sirf identity check ke waqt load hoti hai
      const faceapi = await import("@vladmandic/face-api");

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);

      return faceapi;
    })().catch((err) => {
      apiPromise = null;
      throw new Error(
        "Could not load the face model files. Check frontend/public/models/face/."
      );
    });
  }

  return apiPromise;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Chehre ke aas-paas ka chhota square JPEG
function cropPhoto(video, box) {
  const side = Math.max(box.width, box.height) * 1.7;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 192, 192);

  ctx.drawImage(
    video,
    cx - side / 2,
    cy - side / 2,
    side,
    side,
    0,
    0,
    192,
    192
  );

  return canvas.toDataURL("image/jpeg", 0.7);
}

function faceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// Ek frame se ek hi chehra: { descriptor, photo }
export async function detectFace(video) {
  const faceapi = await loadFaceApi();

  const results = await faceapi
    .detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5
      })
    )
    .withFaceLandmarks(true)
    .withFaceDescriptors();

  if (results.length === 0) {
    throw faceError(
      "NO_FACE",
      "No face detected. Look at the camera in good light."
    );
  }

  if (results.length > 1) {
    throw faceError("MULTI_FACE", "Only you should be in the frame.");
  }

  const [result] = results;

  return {
    descriptor: Array.from(result.descriptor, (n) =>
      Math.round(n * 100000) / 100000
    ),
    photo: cropPhoto(video, result.detection.box)
  };
}

// Kai samples ka average (enrollment ke liye zyada pakka)
export async function captureFace(video, samples = 1, gapMs = 500) {
  const taken = [];

  for (let i = 0; i < samples; i += 1) {
    taken.push(await detectFace(video));

    if (i < samples - 1) await sleep(gapMs);
  }

  const size = taken[0].descriptor.length;
  const average = new Array(size).fill(0);

  taken.forEach((t) => {
    t.descriptor.forEach((n, i) => {
      average[i] += n / taken.length;
    });
  });

  return {
    descriptor: average.map((n) => Math.round(n * 100000) / 100000),
    photo: taken[0].photo
  };
}