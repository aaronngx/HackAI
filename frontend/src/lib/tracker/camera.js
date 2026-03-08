/**
 * camera.js — getUserMedia setup, teardown, and camera FOV estimation.
 */

// ── Known camera FOV database (horizontal, degrees) ──────────────────────────
// Sourced from manufacturer specs and community measurements.
// Only used when the camera label matches a known substring.
const KNOWN_FOV = [
  // Apple
  { match: "facetime",           fov: 73 },
  { match: "continuity camera",  fov: 74 },
  // Logitech
  { match: "c920",               fov: 78 },
  { match: "c922",               fov: 78 },
  { match: "c925",               fov: 78 },
  { match: "c270",               fov: 60 },
  { match: "c310",               fov: 60 },
  { match: "brio",               fov: 90 },
  { match: "streamcam",          fov: 78 },
  // Microsoft
  { match: "lifecam",            fov: 68 },
  { match: "modern webcam",      fov: 78 },
  // Razer
  { match: "razer",              fov: 90 },
  // Generic keywords
  { match: "wide",               fov: 90 },
  { match: "ultrawide",          fov: 110 },
  { match: "integrated",         fov: 70 },
  { match: "built-in",           fov: 70 },
  { match: "internal",           fov: 70 },
];

/**
 * Request webcam access, attach the stream to a <video> element, and wait
 * until the video is ready to play.
 *
 * @param {HTMLVideoElement} video
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(video) {
  const constraints = {
    video: {
      width:      { ideal: 1280 },
      height:     { ideal: 720  },
      frameRate:  { ideal: 30   },
      facingMode: "user",           // front-facing / selfie camera
    },
    audio: false,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;

  // Wait for the browser to know the stream dimensions before we start
  // reading frames — otherwise videoWidth/videoHeight would be 0.
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = (e) => reject(new Error(`Video error: ${e.message ?? e}`));
  });

  await video.play();
  return stream;
}

/**
 * Estimate the horizontal field-of-view (in degrees) of the active camera.
 *
 * Strategy (in order):
 *   1. Match the track label against a database of known webcam models.
 *   2. Use the facingMode and resolution as secondary signals.
 *   3. Fall back to 70° — the most common value for laptop/desktop webcams.
 *
 * This is inherently approximate. The browser does not expose focal length
 * or sensor size for generic webcams via any standard API.
 *
 * @param {MediaStream} stream
 * @returns {{ fovDeg: number, source: string }}
 */
export function estimateCameraFOV(stream) {
  const track    = stream.getVideoTracks()[0];
  if (!track) return { fovDeg: 70, source: "default" };

  const label    = (track.label ?? "").toLowerCase();
  const settings = track.getSettings();

  // 1. Label match against known models
  for (const { match, fov } of KNOWN_FOV) {
    if (label.includes(match)) {
      return { fovDeg: fov, source: `label:${match}` };
    }
  }

  // 2. Facing mode heuristics
  if (settings.facingMode === "environment") {
    // Rear-facing mobile camera (wide primary lens)
    return { fovDeg: 74, source: "facingMode:environment" };
  }
  if (settings.facingMode === "user") {
    // Front-facing selfie camera — generally narrower
    return { fovDeg: 68, source: "facingMode:user" };
  }

  // 3. Resolution hint: very high resolution (>1080p) → likely a high-end wide cam
  if (settings.width >= 2560 || settings.height >= 1440) {
    return { fovDeg: 78, source: "resolution:high" };
  }

  return { fovDeg: 70, source: "default" };
}

/**
 * Stop every track in a MediaStream so the camera LED turns off.
 *
 * @param {MediaStream|null} stream
 */
export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
