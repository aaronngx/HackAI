/**
 * mediapipe.js — Model loading and per-frame inference.
 *
 * Uses dynamic import so @mediapipe/tasks-vision is never processed server-side
 * or at bundle compile time — it only loads in the browser when loadModels() runs.
 *
 * WASM runtime is served from public/mediapipe-wasm (copied from node_modules
 * to ensure the JS bindings version matches the WASM binary version).
 *
 * Models are fetched from Google's public CDN. To run offline:
 *   1. Download the .task files from the URLs in HAND_MODEL_URL / FACE_MODEL_URL
 *   2. Place them in public/models/
 *   3. Change the URLs below to "/models/hand_landmarker.task" etc.
 */

// ── Paths ─────────────────────────────────────────────────────────────────────
const WASM_PATH = "/mediapipe-wasm";

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Initialize the MediaPipe WASM runtime and load both landmarker models.
 * Uses a dynamic import so this only ever runs in the browser.
 *
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<{ handLandmarker, faceLandmarker }>}
 */
export async function loadModels(onProgress) {
  onProgress?.("Loading MediaPipe WASM runtime…");

  // new Function() creates a runtime function whose body is opaque to all
  // bundlers (Turbopack, webpack, Rollup).  The import() inside fires in the
  // browser, fetching mediapipe-vision.js from Next.js's public/ static server.
  // Using .js guarantees a text/javascript MIME type on every platform.
  const { HandLandmarker, FaceLandmarker, FilesetResolver } =
    // eslint-disable-next-line no-new-func
    await new Function('return import("/mediapipe-vision.js")')();

  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  onProgress?.("Loading Hand Landmarker model…");
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 2,
  });

  onProgress?.("Loading Face Landmarker model…");
  const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });

  onProgress?.("Models ready.");
  return { handLandmarker, faceLandmarker };
}

// ── Per-frame inference ───────────────────────────────────────────────────────

/**
 * Run both landmarkers on a single video frame.
 *
 * Must be called inside a requestAnimationFrame callback so that
 * `timestamp` (from rAF or performance.now()) is strictly increasing.
 *
 * @param {HandLandmarker}   handLandmarker
 * @param {FaceLandmarker}   faceLandmarker
 * @param {HTMLVideoElement} video
 * @param {number}           timestamp  — monotonically increasing ms value
 * @returns {{ handResult: HandLandmarkerResult, faceResult: FaceLandmarkerResult }}
 */
export function detectFrame(handLandmarker, faceLandmarker, video, timestamp) {
  // detectForVideo expects the video element directly; MediaPipe reads the
  // current frame internally — no need to copy pixels to a canvas first.
  const handResult = handLandmarker.detectForVideo(video, timestamp);
  const faceResult = faceLandmarker.detectForVideo(video, timestamp);
  return { handResult, faceResult };
}
