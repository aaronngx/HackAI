/**
 * main.js — Entry point and requestAnimationFrame render loop.
 *
 * New features added over baseline:
 *
 *  ┌─ Hand-over-eye detection ────────────────────────────────────────────────┐
 *  │ detectHandOverEye() checks if any hand landmark cluster overlaps each    │
 *  │ eye's spatial region (pixel-space proximity, hysteresis-smoothed).       │
 *  │ Results are shown in the debug panel and as a red "COVERED" overlay in  │
 *  │ the Eye Focus PIP panel.                                                 │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─ Eye Focus PIP ──────────────────────────────────────────────────────────┐
 *  │ A picture-in-picture panel in the bottom-right corner of the canvas      │
 *  │ shows a magnified crop of both eyes. Drawn whenever a face is detected. │
 *  │                                                                          │
 *  │ Contents:                                                                │
 *  │  • Mirrored video crop of the eye region (EMA-smoothed crop rect)        │
 *  │  • Eye contour overlays (blue = right, pink = left)                     │
 *  │  • Iris circles + pupil center crosshairs                               │
 *  │  • Dashed PD measurement line between iris centers                      │
 *  │  • PD in pixels + estimated mm (using iris diameter as physical ref)    │
 *  │  • "COVERED" warning over any eye blocked by a hand                     │
 *  │                                                                          │
 *  │ The eyeRegion crop is computed via computeEyeRegion(), then EMA-smoothed │
 *  │ (α=0.12) so the PIP glides when the face moves.                         │
 *  └─────────────────────────────────────────────────────────────────────────┘
 */

import { startCamera, stopCamera, estimateCameraFOV } from "./camera.js";
import { loadModels, detectFrame }   from "./mediapipe.js";
import {
  classifyHandDirection,
  smoothDirection,
  resetDirectionBuffer,
} from "./direction.js";
import {
  clearCanvas,
  drawVideoFrame,
  drawZoomRegion,
  drawHand,
  drawDirectionLabel,
  drawEyes,
  drawFaceOutline,
  drawEyePIP,
  drawDistanceBadge,
  drawGazeRays,
  computeEAR,
  RIGHT_EYE_EAR,
  LEFT_EYE_EAR,
  EYE_PIP_AR,
} from "./draw.js";
import {
  detectHandOverEye,
  resetEyeCoverCounters,
  computePupilData,
  computeEyeRegion,
  computeCameraDistance,
} from "./eyeAnalysis.js";
import { computeGaze, resetGazeSmoothing, lockEyeSpheres, clearLockedSpheres } from "./eyeTracking.js";
import { CalibrationManager, CalibState  } from "./calibration.js";
import {
  initOverlay,
  showCalibrationIntro,
  showCalibrationDot,
  setCalibrationDotProgress,
  showCalibrationStatus,
  showSphereLockDot,
  hideCalibrationOverlay,
  showGazeDot,
  hideGazeDot,
} from "./gazeOverlay.js";
import { state } from "./state.js";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const video       = /** @type {HTMLVideoElement}         */ (document.getElementById("video"));
const canvas      = /** @type {HTMLCanvasElement}        */ (document.getElementById("overlay"));
const ctx         = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
const btnStart    = /** @type {HTMLButtonElement} */ (document.getElementById("btn-start"));
const btnStop     = /** @type {HTMLButtonElement} */ (document.getElementById("btn-stop"));
const btnZoom     = /** @type {HTMLButtonElement} */ (document.getElementById("btn-zoom"));
const btnCalibGaze = /** @type {HTMLButtonElement} */ (document.getElementById("btn-calib-gaze"));
const statusEl    = document.getElementById("status");
const loadingEl = document.getElementById("loading");
const zoomBadge = document.getElementById("zoom-badge");

// Debug spans
const dbgHand       = document.getElementById("dbg-hand");
const dbgFace       = document.getElementById("dbg-face");
const dbgEyes       = document.getElementById("dbg-eyes");
const dbgDir        = document.getElementById("dbg-dir");
const dbgFps        = document.getElementById("dbg-fps");
const dbgLeftEar    = document.getElementById("dbg-left-ear");
const dbgRightEar   = document.getElementById("dbg-right-ear");
const dbgRightCover = document.getElementById("dbg-right-cover");
const dbgLeftCover  = document.getElementById("dbg-left-cover");
const dbgPdPx       = document.getElementById("dbg-pd-px");
const dbgPdMm       = document.getElementById("dbg-pd-mm");
const dbgDist       = document.getElementById("dbg-dist");
const dbgGazeYaw    = document.getElementById("dbg-gaze-yaw");
const dbgGazePitch  = document.getElementById("dbg-gaze-pitch");
const dbgCalib      = document.getElementById("dbg-calib");
const dbgZoom       = document.getElementById("dbg-zoom");

// ── Model handles ─────────────────────────────────────────────────────────────
let handLandmarker = null;
let faceLandmarker = null;
let modelsLoaded   = false;

// ── Gaze tracking ─────────────────────────────────────────────────────────────
const calibManager    = new CalibrationManager();
let   gazeResult   = null;   // latest GazeResult from eyeTracking.js
let   _lastFaceLms = null;   // retained for doLockSpheres callback

// Phase 1: lock eye spheres using the most recent face detection result
calibManager.doLockSpheres = () => {
  const faceLms = _lastFaceLms;
  if (!faceLms) return false;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  return lockEyeSpheres(faceLms, vw, vh);
};

calibManager.onSphereProgress = (progress) => {
  showSphereLockDot(progress);
};

calibManager.onPoint = (sx, sy, idx, total) => {
  showCalibrationDot(sx, sy, idx, total);
};
calibManager.onComplete = (success) => {
  if (success) {
    hideCalibrationOverlay();
    btnCalibGaze.textContent = "Recalibrate Gaze";
    btnCalibGaze.classList.add("calibrated");
    setStatus("Eye tracking calibrated — gaze dot is live.");
  } else {
    hideCalibrationOverlay();
    setStatus("Calibration failed — try again with better lighting.", true);
  }
};

// Bootstrap overlay (creates DOM elements before camera starts)
initOverlay();

// Clicking the intro overlay starts calibration
document.getElementById("calib-overlay").addEventListener("click", () => {
  if (calibManager.state === CalibState.IDLE) calibManager.start();
});

// ── FPS counter ───────────────────────────────────────────────────────────────
let frameCount  = 0;
let lastFpsTime = performance.now();
let displayFps  = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  setStatus("Loading models, please wait…");
  loadingEl.style.display = "flex";
  btnStart.disabled = true;

  try {
    ({ handLandmarker, faceLandmarker } = await loadModels(setStatus));
    modelsLoaded = true;
    btnStart.disabled = false;
    setStatus("Models ready — click Start Camera.");
  } catch (err) {
    setStatus(`Model load failed: ${err.message}`, true);
    console.error("[tracker] model load error:", err);
  } finally {
    loadingEl.style.display = "none";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera start / stop
// ─────────────────────────────────────────────────────────────────────────────

btnStart.addEventListener("click", async () => {
  if (!modelsLoaded) return;

  btnStart.disabled    = true;
  btnStop.disabled     = false;
  btnZoom.disabled     = false;
  btnCalibGaze.disabled = false;
  setStatus("Starting camera…");

  try {
    state.stream          = await startCamera(video);
    state.isRunning       = true;
    state.smoothCrop      = null;
    state.smoothEyeRegion = null;

    // Auto-detect camera FOV from track label / facing mode / resolution
    const { fovDeg, source } = estimateCameraFOV(state.stream);
    state.cameraFovDeg = fovDeg;
    console.info(`[tracker] Camera FOV: ${fovDeg}° (source: ${source})`);

    resetDirectionBuffer();
    resetEyeCoverCounters();
    resetGazeSmoothing();
    setStatus("Running — detecting hands, face, and eyes.");
    requestAnimationFrame(renderLoop);
  } catch (err) {
    setStatus(`Camera error: ${err.message}`, true);
    console.error("[tracker] camera error:", err);
    btnStart.disabled     = false;
    btnStop.disabled      = true;
    btnZoom.disabled      = true;
    btnCalibGaze.disabled = true;
  }
});

btnStop.addEventListener("click", () => {
  state.isRunning       = false;
  state.smoothCrop      = null;
  state.smoothEyeRegion = null;

  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  stopCamera(state.stream);
  state.stream    = null;
  video.srcObject = null;
  gazeResult      = null;

  clearCanvas(ctx, canvas.width, canvas.height);
  hideCalibrationOverlay();
  hideGazeDot();
  calibManager.reset();
  clearLockedSpheres();

  btnStart.disabled     = false;
  btnStop.disabled      = true;
  btnZoom.disabled      = true;
  btnCalibGaze.disabled = true;
  btnCalibGaze.textContent = "Calibrate Gaze";
  btnCalibGaze.classList.remove("calibrated");

  if (state.zoomEnabled) _setZoom(false);
  resetDirectionBuffer();
  resetEyeCoverCounters();
  resetGazeSmoothing();

  setStatus("Camera stopped — click Start Camera to restart.");
  _resetDebugPanel();
});

// ─────────────────────────────────────────────────────────────────────────────
// Zoom toggle
// ─────────────────────────────────────────────────────────────────────────────

btnZoom.addEventListener("click", () => _setZoom(!state.zoomEnabled));


// ─────────────────────────────────────────────────────────────────────────────
// Gaze calibration
// ─────────────────────────────────────────────────────────────────────────────

btnCalibGaze.addEventListener("click", () => {
  if (!state.isRunning) return;
  calibManager.reset();
  clearLockedSpheres();
  hideGazeDot();
  showCalibrationIntro();
});

// Space or click anywhere on overlay starts/advances calibration
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && calibManager.state === CalibState.IDLE) {
    const overlay = document.getElementById("calib-overlay");
    if (overlay && overlay.style.display !== "none") {
      e.preventDefault();
      calibManager.start();
    }
  }
});

function _setZoom(on) {
  state.zoomEnabled = on;
  btnZoom.textContent = on ? "Exit Zoom" : "Focus Face";
  btnZoom.className   = on ? "btn-zoom-on" : "btn-zoom-off";
  zoomBadge.classList.toggle("visible", on);
  if (!on) state.smoothCrop = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Render loop
// ─────────────────────────────────────────────────────────────────────────────

function renderLoop(timestamp) {
  if (!state.isRunning) return;
  state.animFrameId = requestAnimationFrame(renderLoop);

  if (video.videoWidth === 0 || video.readyState < 2) return;

  if (canvas.width !== video.videoWidth) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const cw = canvas.width;
  const ch = canvas.height;
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // ── MediaPipe inference ────────────────────────────────────────────────────
  // NOTE: detectForVideo() runs SYNCHRONOUSLY and blocks the main thread.
  // The official docs recommend Web Workers for production apps to keep the
  // UI responsive. For this demo the rAF loop is acceptable, but if you need
  // consistent 60 fps, move inference into a Worker and post results back.
  const { handResult, faceResult } = detectFrame(
    handLandmarker, faceLandmarker, video, timestamp,
  );

  // ── Face processing ────────────────────────────────────────────────────────
  const facesFound = faceResult.faceLandmarks?.length > 0;
  state.faceDetected  = facesFound;
  state.eyesDetected  = false;
  state.leftEarValue  = null;
  state.rightEarValue = null;
  state.rightEyeCovered = false;
  state.leftEyeCovered  = false;
  state.pdPixels = null;
  state.pdMm     = null;

  let faceLms    = null;   // face landmark array for this frame
  let pupilData  = null;   // pupil + PD data
  let activeCrop = null;   // face zoom crop (null = full frame)

  if (facesFound) {
    faceLms = faceResult.faceLandmarks[0];
    state.eyesDetected = faceLms.length >= 390;

    if (state.eyesDetected) {
      state.leftEarValue  = computeEAR(faceLms, LEFT_EYE_EAR);
      state.rightEarValue = computeEAR(faceLms, RIGHT_EYE_EAR);
    }

    // Pupil centers + PD (requires full 478-landmark iris data)
    pupilData = computePupilData(faceLms, vw, vh);
    if (pupilData) {
      state.pdPixels = pupilData.pdPixels;
      state.pdMm     = pupilData.pdMm;
    }

    // Camera distance estimate — auto FOV from camera label, two biological refs
    const distData = computeCameraDistance(pupilData, faceLms, vw, vh, state.cameraFovDeg);
    state.distanceCm = distData?.distanceCm ?? null;

    // ── Gaze tracking ──────────────────────────────────────────────────────
    _lastFaceLms = faceLms;
    gazeResult   = computeGaze(faceLms, null, vw, vh);

    // Feed calibration state machine every frame face is visible
    const cs = calibManager.state;
    if (cs === CalibState.LOCK_SPHERE) {
      // Phase 1: show sphere-lock dot, doLockSpheres fires at N_SPHERE_LOCK frames
      calibManager.feedFrame(gazeResult);
    } else if (cs === CalibState.RUNNING && gazeResult) {
      // Phase 2: collect gaze samples per calibration point
      calibManager.feedFrame(gazeResult);
      setCalibrationDotProgress(calibManager.pointProgress);
    }

    // Show live gaze dot when calibration is ready
    if (gazeResult && calibManager.isReady) {
      const screenPos = calibManager.mapGaze(gazeResult.yaw, gazeResult.pitch);
      if (screenPos) showGazeDot(screenPos.x, screenPos.y);
    }

    // Eye region for PIP (EMA-smoothed)
    const rawEyeRegion = computeEyeRegion(faceLms, vw, vh, EYE_PIP_AR);
    if (rawEyeRegion) {
      state.smoothEyeRegion = lerpCrop(state.smoothEyeRegion, rawEyeRegion, 0.12);
    }

    // Face zoom crop (EMA-smoothed)
    if (state.zoomEnabled) {
      const rawCrop = computeFaceBBox(faceLms, vw, vh, cw, ch);
      state.smoothCrop = lerpCrop(state.smoothCrop, rawCrop, 0.10);
      activeCrop = state.smoothCrop;
    }
  }

  // ── Hand-over-eye detection ────────────────────────────────────────────────
  // Run always so the coverage counters decay properly when hands leave.
  const eyeCover = detectHandOverEye(
    handResult.landmarks ?? [],
    faceLms,
    vw, vh,
  );
  state.rightEyeCovered = eyeCover.rightCovered;
  state.leftEyeCovered  = eyeCover.leftCovered;

  // ── Draw video frame ───────────────────────────────────────────────────────
  clearCanvas(ctx, cw, ch);
  drawVideoFrame(ctx, video, cw, ch, activeCrop);

  // ── Landmark coordinate mapper ─────────────────────────────────────────────
  const toScreen = makeToScreen(activeCrop, cw, ch);

  // ── Hand skeleton + direction ──────────────────────────────────────────────
  const handsFound = handResult.landmarks?.length > 0;
  state.handDetected = handsFound;

  if (handsFound) {
    for (let i = 0; i < handResult.landmarks.length; i++) {
      const lms   = handResult.landmarks[i];
      // The official docs define handedness as a "Category" object.
      // categoryName ("Left"/"Right") is the primary field; displayName is
      // often an empty string in current model versions — always prefer categoryName.
      const label = handResult.handedness[i]?.[0]?.categoryName
                 ?? handResult.handedness[i]?.[0]?.displayName
                 ?? "";
      const color = label === "Left" ? "#00FF88" : "#FF8800";
      drawHand(ctx, lms, toScreen, color);

      if (i === 0) {
        const smoothed = smoothDirection(classifyHandDirection(lms));
        state.handDirection = smoothed;
        drawDirectionLabel(ctx, lms, toScreen, smoothed);
      }
    }
  } else {
    resetDirectionBuffer();
    state.handDirection = "UNKNOWN";
  }

  // ── Face outline + eye overlays + distance badge ──────────────────────────
  if (faceLms) {
    drawFaceOutline(ctx, faceLms, toScreen);
    drawEyes(ctx, faceLms, toScreen);
    const distData = state.distanceCm != null
      ? { distanceCm: state.distanceCm }
      : null;
    drawDistanceBadge(ctx, faceLms, distData, toScreen);

    // Gaze rays: orbit centers → iris → virtual monitor plane + hit point
    if (gazeResult) {
      drawGazeRays(ctx, gazeResult, toScreen, vw, vh);
    }
  }

  // ── Face zoom region preview (when zoom is OFF but face is tracked) ────────
  if (!activeCrop && facesFound) {
    const raw = computeFaceBBox(faceLms, vw, vh, cw, ch);
    drawZoomRegion(ctx, raw, cw, ch);
  }

  // ── Eye Focus PIP ──────────────────────────────────────────────────────────
  // Show whenever a face (and thus eye region) is detected.
  if (faceLms && state.smoothEyeRegion) {
    const distData = state.distanceCm != null
      ? { distanceCm: state.distanceCm }
      : null;
    drawEyePIP(
      ctx, video, faceLms, cw, ch,
      pupilData,
      eyeCover,
      state.smoothEyeRegion,
      distData,
    );
  }

  // ── FPS ────────────────────────────────────────────────────────────────────
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    displayFps  = frameCount;
    frameCount  = 0;
    lastFpsTime = now;
  }

  _updateDebugPanel();
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a normalized face bounding box from face landmarks.
 * Adds padding and expands to match canvas aspect ratio.
 */
function computeFaceBBox(lms, vw, vh, cw, ch) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const lm of lms) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  const fw = maxX - minX, fh = maxY - minY;
  const cx = minX + fw / 2,  cy = minY + fh / 2;
  const PAD = 0.35;
  let nw = fw * (1 + 2 * PAD);
  let nh = fh * (1 + 2 * PAD);

  const canvasAR    = cw / ch;
  const cropPixelAR = (nw * vw) / (nh * vh);
  if (cropPixelAR > canvasAR) {
    nh = (nw * vw) / (canvasAR * vh);
  } else {
    nw = (nh * vh * canvasAR) / vw;
  }

  let nx = cx - nw / 2;
  let ny = cy - nh / 2;
  nx = Math.max(0, Math.min(1 - nw, nx));
  ny = Math.max(0, Math.min(1 - nh, ny));
  nw = Math.min(nw, 1 - nx);
  nh = Math.min(nh, 1 - ny);
  return { nx, ny, nw, nh };
}

/**
 * Exponential moving average blend between two crop rects.
 * α=0.10 = smooth (slow to follow), α=0.30 = snappier.
 */
function lerpCrop(prev, next, alpha = 0.10) {
  if (!prev) return { ...next };
  return {
    nx: prev.nx + (next.nx - prev.nx) * alpha,
    ny: prev.ny + (next.ny - prev.ny) * alpha,
    nw: prev.nw + (next.nw - prev.nw) * alpha,
    nh: prev.nh + (next.nh - prev.nh) * alpha,
  };
}

/**
 * Build a toScreen(lm) → {x, y} mapper for this frame.
 * The canvas is drawn with the video flipped horizontally (mirror mode),
 * so x is always inverted: screenX = (1 − relX) × cw.
 */
function makeToScreen(crop, cw, ch) {
  if (!crop) return (lm) => ({ x: (1 - lm.x) * cw, y: lm.y * ch });
  return (lm) => {
    const relX = (lm.x - crop.nx) / crop.nw;
    const relY = (lm.y - crop.ny) / crop.nh;
    return { x: (1 - relX) * cw, y: relY * ch };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug panel
// ─────────────────────────────────────────────────────────────────────────────

function _updateDebugPanel() {
  _setVal(dbgHand, state.handDetected ? "YES" : "NO", state.handDetected ? "yes" : "no");
  _setVal(dbgFace, state.faceDetected ? "YES" : "NO", state.faceDetected ? "yes" : "no");
  _setVal(dbgEyes, state.eyesDetected ? "YES" : "NO", state.eyesDetected ? "yes" : "no");

  dbgDir.textContent = state.handDirection;
  dbgFps.textContent = `${displayFps} fps`;

  dbgLeftEar.textContent  = _earStr(state.leftEarValue);
  dbgRightEar.textContent = _earStr(state.rightEarValue);

  _setVal(dbgRightCover,
    state.rightEyeCovered ? "COVERED" : "clear",
    state.rightEyeCovered ? "covered" : "clear-eye");
  _setVal(dbgLeftCover,
    state.leftEyeCovered  ? "COVERED" : "clear",
    state.leftEyeCovered  ? "covered" : "clear-eye");

  dbgPdPx.textContent = state.pdPixels != null ? `${Math.round(state.pdPixels)} px`   : "—";
  dbgPdMm.textContent = state.pdMm     != null ? `~${state.pdMm.toFixed(1)} mm` : "—";

  if (state.distanceCm != null) {
    _setVal(dbgDist,
      `~${state.distanceCm} cm`,
      state.distanceCm < 25 ? "dist-danger"
        : state.distanceCm < 40 ? "dist-close"
        : "dist-ok");
  } else {
    dbgDist.textContent = "—"; dbgDist.className = "val";
  }

  // Gaze
  if (gazeResult) {
    dbgGazeYaw.textContent   = `${gazeResult.yaw.toFixed(1)}°`;
    dbgGazePitch.textContent = `${gazeResult.pitch.toFixed(1)}°`;
  } else {
    dbgGazeYaw.textContent   = "—";
    dbgGazePitch.textContent = "—";
  }
  const cs = calibManager.state;
  if (cs === CalibState.READY) {
    _setVal(dbgCalib, "READY", "yes");
  } else if (cs === CalibState.LOCK_SPHERE) {
    _setVal(dbgCalib, "locking…", "");
  } else if (cs === CalibState.RUNNING) {
    const t = calibManager.currentTarget;
    _setVal(dbgCalib, t ? `pt ${t.idx + 1}/${t.total}` : "running", "");
  } else {
    dbgCalib.textContent = "—"; dbgCalib.className = "val";
  }
  // Show sphere lock status
  if (gazeResult?.spheresLocked) {
    dbgCalib.textContent += " 🔒";
  }

  const zOn = state.zoomEnabled;
  _setVal(dbgZoom, zOn ? "ON" : "OFF", zOn ? "zoom-on" : "zoom-off");
}

function _resetDebugPanel() {
  [dbgHand, dbgFace, dbgEyes, dbgRightCover, dbgLeftCover].forEach((el) => {
    el.textContent = "—"; el.className = "val";
  });
  dbgDir.textContent      = "—";
  dbgFps.textContent      = "0 fps";
  dbgLeftEar.textContent  = "—";
  dbgRightEar.textContent = "—";
  dbgPdPx.textContent     = "—";
  dbgPdMm.textContent     = "—";
  dbgDist.textContent      = "—"; dbgDist.className = "val";
  dbgGazeYaw.textContent   = "—";
  dbgGazePitch.textContent = "—";
  dbgCalib.textContent     = "—"; dbgCalib.className = "val";
  _setVal(dbgZoom, "OFF", "zoom-off");
}

function _setVal(el, text, cls = "") {
  el.textContent = text;
  el.className   = cls ? `val ${cls}` : "val";
}

function _earStr(v) {
  if (v == null) return "—";
  return `${v > 0.20 ? "open" : "closed"} (${v.toFixed(2)})`;
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className   = isError ? "error" : "";
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
init();
