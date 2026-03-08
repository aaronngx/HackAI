"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import styles from "./ExamTracker.module.css";

import { startCamera, stopCamera, estimateCameraFOV } from "@/lib/tracker/camera.js";
import { loadModels, detectFrame }    from "@/lib/tracker/mediapipe.js";
import {
  classifyHandDirection, smoothDirection, resetDirectionBuffer,
} from "@/lib/tracker/direction.js";
import {
  clearCanvas, drawVideoFrame, drawZoomRegion, drawHand, drawDirectionLabel,
  drawEyes, drawFaceOutline, drawEyePIP, drawDistanceBadge, drawGazeRays,
  computeEAR, RIGHT_EYE_EAR, LEFT_EYE_EAR, EYE_PIP_AR,
} from "@/lib/tracker/draw.js";
import {
  detectHandOverEye, resetEyeCoverCounters,
  computePupilData, computeEyeRegion, computeCameraDistance,
} from "@/lib/tracker/eyeAnalysis.js";
import {
  computeGaze, resetGazeSmoothing, lockEyeSpheres, clearLockedSpheres,
} from "@/lib/tracker/eyeTracking.js";
import { CalibrationManager, CalibState } from "@/lib/tracker/calibration.js";
import { state } from "@/lib/tracker/state.js";

// ── Pure helpers (no hooks) ───────────────────────────────────────────────────

function lerpCrop(prev, next, alpha = 0.10) {
  if (!prev) return { ...next };
  return {
    nx: prev.nx + (next.nx - prev.nx) * alpha,
    ny: prev.ny + (next.ny - prev.ny) * alpha,
    nw: prev.nw + (next.nw - prev.nw) * alpha,
    nh: prev.nh + (next.nh - prev.nh) * alpha,
  };
}

function computeFaceBBox(lms, vw, vh, cw, ch) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const lm of lms) {
    if (lm.x < minX) minX = lm.x; if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y; if (lm.y > maxY) maxY = lm.y;
  }
  const fw = maxX - minX, fh = maxY - minY;
  const cx = minX + fw / 2, cy = minY + fh / 2;
  const PAD = 0.35;
  let nw = fw * (1 + 2 * PAD), nh = fh * (1 + 2 * PAD);
  const ar = cw / ch;
  if ((nw * vw) / (nh * vh) > ar) nh = (nw * vw) / (ar * vh);
  else nw = (nh * vh * ar) / vw;
  let nx = Math.max(0, Math.min(1 - nw, cx - nw / 2));
  let ny = Math.max(0, Math.min(1 - nh, cy - nh / 2));
  return { nx, ny, nw: Math.min(nw, 1 - nx), nh: Math.min(nh, 1 - ny) };
}

function makeToScreen(crop, cw, ch) {
  if (!crop) return (lm) => ({ x: (1 - lm.x) * cw, y: lm.y * ch });
  return (lm) => ({
    x: (1 - (lm.x - crop.nx) / crop.nw) * cw,
    y: ((lm.y - crop.ny) / crop.nh) * ch,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ExamTracker() {
  // ── DOM refs ─────────────────────────────────────────────────────────────
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // Calibration overlay / gaze dot refs (rendered in JSX, not appended to body)
  const calibOverlayRef = useRef(null);
  const calibInstrRef   = useRef(null);
  const calibDotRef     = useRef(null);
  const dotLabelRef     = useRef(null);
  const progressArcRef  = useRef(null);
  const gazeDotRef      = useRef(null);

  // Debug panel refs — updated every frame, bypassing React state for perf
  const dbgHandRef       = useRef(null);
  const dbgFaceRef       = useRef(null);
  const dbgEyesRef       = useRef(null);
  const dbgDirRef        = useRef(null);
  const dbgFpsRef        = useRef(null);
  const dbgLeftEarRef    = useRef(null);
  const dbgRightEarRef   = useRef(null);
  const dbgRightCoverRef = useRef(null);
  const dbgLeftCoverRef  = useRef(null);
  const dbgPdPxRef       = useRef(null);
  const dbgPdMmRef       = useRef(null);
  const dbgDistRef       = useRef(null);
  const dbgGazeYawRef    = useRef(null);
  const dbgGazePitchRef  = useRef(null);
  const dbgCalibRef      = useRef(null);
  const dbgZoomRef       = useRef(null);

  // ── React state (infrequent UI changes only) ──────────────────────────────
  const [btnStartDisabled, setBtnStartDisabled] = useState(true);
  const [btnStopDisabled,  setBtnStopDisabled]  = useState(true);
  const [btnZoomDisabled,  setBtnZoomDisabled]  = useState(true);
  const [btnCalibDisabled, setBtnCalibDisabled] = useState(true);
  const [btnCalibText,     setBtnCalibText]     = useState("Calibrate Gaze");
  const [btnCalibrated,    setBtnCalibrated]    = useState(false);
  const [zoomOn,           setZoomOn]           = useState(false);
  const [statusMsg,        setStatusMsg]        = useState("Initializing…");
  const [statusError,      setStatusError]      = useState(false);
  const [loading,          setLoading]          = useState(true);

  // ── Internal refs (render-loop state, avoids re-renders) ─────────────────
  const handLandmarkerRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const modelsLoadedRef   = useRef(false);
  const calibManagerRef   = useRef(null);
  const gazeResultRef     = useRef(null);
  const lastFaceLmsRef    = useRef(null);
  const frameCountRef     = useRef(0);
  const lastFpsTimeRef    = useRef(0);
  const displayFpsRef     = useRef(0);

  // ── Overlay helpers (mirror gazeOverlay.js API but use JSX refs) ─────────

  const _showSphereLockDot = useCallback((progress) => {
    if (calibInstrRef.current)  calibInstrRef.current.style.display  = "none";
    if (calibDotRef.current) {
      calibDotRef.current.style.display = "block";
      calibDotRef.current.style.left = "50vw";
      calibDotRef.current.style.top  = "50vh";
    }
    if (dotLabelRef.current)    dotLabelRef.current.textContent = "Look here — locking eye positions…";
    if (progressArcRef.current) progressArcRef.current.style.transform = `rotate(${progress * 360}deg)`;
  }, []);

  const _showCalibDot = useCallback((sx, sy, idx, total) => {
    if (calibInstrRef.current)  calibInstrRef.current.style.display  = "none";
    if (calibDotRef.current) {
      calibDotRef.current.style.display = "block";
      calibDotRef.current.style.left = `${sx * 100}vw`;
      calibDotRef.current.style.top  = `${sy * 100}vh`;
    }
    if (dotLabelRef.current)    dotLabelRef.current.textContent = `${idx + 1} / ${total}`;
    if (progressArcRef.current) progressArcRef.current.style.transform = "rotate(0deg)";
  }, []);

  const _setCalibDotProgress = useCallback((f) => {
    if (progressArcRef.current)
      progressArcRef.current.style.transform = `rotate(${f * 360}deg)`;
  }, []);

  const _hideCalibOverlay = useCallback(() => {
    if (calibOverlayRef.current) calibOverlayRef.current.style.display = "none";
    if (calibDotRef.current)     calibDotRef.current.style.display     = "none";
  }, []);

  const _showGazeDot = useCallback((sx, sy) => {
    if (!gazeDotRef.current) return;
    gazeDotRef.current.style.display = "block";
    gazeDotRef.current.style.left    = `${sx * 100}vw`;
    gazeDotRef.current.style.top     = `${sy * 100}vh`;
  }, []);

  const _hideGazeDot = useCallback(() => {
    if (gazeDotRef.current) gazeDotRef.current.style.display = "none";
  }, []);

  const _showCalibIntro = useCallback(() => {
    if (calibOverlayRef.current) calibOverlayRef.current.style.display = "block";
    if (calibDotRef.current)     calibDotRef.current.style.display     = "none";
    if (calibInstrRef.current) {
      calibInstrRef.current.style.display = "block";
      calibInstrRef.current.innerHTML = `
        <strong style="color:#00FF88;font-size:22px">Eye Tracking Calibration</strong><br><br>
        <strong>Step 1:</strong> A dot will appear at screen center — look straight at it<br>
        while your eye positions are locked.<br>
        <strong>Step 2:</strong> Follow <strong>9 dots</strong> around the screen.<br><br>
        Keep your <strong>head still</strong>. Sit at a comfortable distance.<br><br>
        <span style="color:#FFD700">Click anywhere or press <strong>Space</strong> to begin.</span>
      `;
    }
  }, []);

  // ── Debug panel helpers ───────────────────────────────────────────────────

  const _setVal = (el, text, cls = "") => {
    if (!el) return;
    el.textContent = text;
    el.className   = cls ? `val ${cls}` : "val";
  };

  const _earStr = (v) =>
    v == null ? "—" : `${v > 0.20 ? "open" : "closed"} (${v.toFixed(2)})`;

  const _updateDebugPanel = (gazeResult) => {
    _setVal(dbgHandRef.current, state.handDetected ? "YES" : "NO", state.handDetected ? "yes" : "no");
    _setVal(dbgFaceRef.current, state.faceDetected ? "YES" : "NO", state.faceDetected ? "yes" : "no");
    _setVal(dbgEyesRef.current, state.eyesDetected ? "YES" : "NO", state.eyesDetected ? "yes" : "no");
    if (dbgDirRef.current) dbgDirRef.current.textContent = state.handDirection;
    if (dbgFpsRef.current) dbgFpsRef.current.textContent = `${displayFpsRef.current} fps`;
    if (dbgLeftEarRef.current)  dbgLeftEarRef.current.textContent  = _earStr(state.leftEarValue);
    if (dbgRightEarRef.current) dbgRightEarRef.current.textContent = _earStr(state.rightEarValue);
    _setVal(dbgRightCoverRef.current, state.rightEyeCovered ? "COVERED" : "clear", state.rightEyeCovered ? "covered" : "clear-eye");
    _setVal(dbgLeftCoverRef.current,  state.leftEyeCovered  ? "COVERED" : "clear", state.leftEyeCovered  ? "covered" : "clear-eye");
    if (dbgPdPxRef.current) dbgPdPxRef.current.textContent = state.pdPixels != null ? `${Math.round(state.pdPixels)} px` : "—";
    if (dbgPdMmRef.current) dbgPdMmRef.current.textContent = state.pdMm     != null ? `~${state.pdMm.toFixed(1)} mm`    : "—";
    if (state.distanceCm != null) {
      _setVal(dbgDistRef.current, `~${state.distanceCm} cm`,
        state.distanceCm < 25 ? "distDanger" : state.distanceCm < 40 ? "distClose" : "distOk");
    } else if (dbgDistRef.current) {
      dbgDistRef.current.textContent = "—"; dbgDistRef.current.className = "val";
    }
    if (gazeResult) {
      if (dbgGazeYawRef.current)   dbgGazeYawRef.current.textContent   = `${gazeResult.yaw.toFixed(1)}°`;
      if (dbgGazePitchRef.current) dbgGazePitchRef.current.textContent = `${gazeResult.pitch.toFixed(1)}°`;
    } else {
      if (dbgGazeYawRef.current)   dbgGazeYawRef.current.textContent   = "—";
      if (dbgGazePitchRef.current) dbgGazePitchRef.current.textContent = "—";
    }
    const cm = calibManagerRef.current;
    if (cm) {
      const cs = cm.state;
      if      (cs === CalibState.READY)       _setVal(dbgCalibRef.current, "READY",    "yes");
      else if (cs === CalibState.LOCK_SPHERE) _setVal(dbgCalibRef.current, "locking…", "");
      else if (cs === CalibState.RUNNING) {
        const t = cm.currentTarget;
        _setVal(dbgCalibRef.current, t ? `pt ${t.idx + 1}/${t.total}` : "running", "");
      } else if (dbgCalibRef.current) {
        dbgCalibRef.current.textContent = "—"; dbgCalibRef.current.className = "val";
      }
      if (gazeResult?.spheresLocked && dbgCalibRef.current)
        dbgCalibRef.current.textContent += " 🔒";
    }
    _setVal(dbgZoomRef.current, state.zoomEnabled ? "ON" : "OFF", state.zoomEnabled ? "zoomOn" : "zoomOff");
  };

  const _resetDebugPanel = () => {
    [dbgHandRef, dbgFaceRef, dbgEyesRef, dbgRightCoverRef, dbgLeftCoverRef].forEach(r => {
      if (r.current) { r.current.textContent = "—"; r.current.className = "val"; }
    });
    [dbgDirRef, dbgGazeYawRef, dbgGazePitchRef, dbgPdPxRef, dbgPdMmRef].forEach(r => {
      if (r.current) r.current.textContent = "—";
    });
    if (dbgFpsRef.current)  dbgFpsRef.current.textContent  = "0 fps";
    if (dbgLeftEarRef.current)  dbgLeftEarRef.current.textContent  = "—";
    if (dbgRightEarRef.current) dbgRightEarRef.current.textContent = "—";
    if (dbgDistRef.current) { dbgDistRef.current.textContent = "—"; dbgDistRef.current.className = "val"; }
    if (dbgCalibRef.current){ dbgCalibRef.current.textContent = "—"; dbgCalibRef.current.className = "val"; }
    _setVal(dbgZoomRef.current, "OFF", "zoomOff");
  };

  // ── Mount: load models + calibration manager setup ────────────────────────
  useEffect(() => {
    lastFpsTimeRef.current = performance.now();

    // Reset module singletons from any prior session
    state.isRunning   = false;
    state.stream      = null;
    state.animFrameId = null;
    resetDirectionBuffer();
    resetEyeCoverCounters();
    resetGazeSmoothing();

    // Calibration manager
    const cm = new CalibrationManager();
    calibManagerRef.current = cm;

    cm.doLockSpheres = () => {
      const lms   = lastFaceLmsRef.current;
      const video = videoRef.current;
      if (!lms || !video) return false;
      return lockEyeSpheres(lms, video.videoWidth, video.videoHeight);
    };
    cm.onSphereProgress = (p) => _showSphereLockDot(p);
    cm.onPoint          = (sx, sy, i, n) => _showCalibDot(sx, sy, i, n);
    cm.onComplete       = (ok) => {
      if (ok) {
        _hideCalibOverlay();
        setBtnCalibText("Recalibrate Gaze");
        setBtnCalibrated(true);
        setStatusMsg("Eye tracking calibrated — gaze dot is live.");
        setStatusError(false);
      } else {
        _hideCalibOverlay();
        setStatusMsg("Calibration failed — try again with better lighting.");
        setStatusError(true);
      }
    };

    // Keyboard: Space starts calibration when intro overlay is visible
    const onKeydown = (e) => {
      const mgr = calibManagerRef.current;
      if (e.code === "Space" && mgr?.state === CalibState.IDLE) {
        const ov = calibOverlayRef.current;
        if (ov && ov.style.display !== "none") {
          e.preventDefault();
          mgr.start();
        }
      }
    };
    document.addEventListener("keydown", onKeydown);

    // Load models — guard against React strict-mode double-mount
    let isMounted = true;
    async function init() {
      setLoading(true);
      setStatusMsg("Loading models, please wait…");
      try {
        const { handLandmarker, faceLandmarker } = await loadModels(
          (msg) => { if (isMounted) setStatusMsg(msg); },
        );
        if (!isMounted) {
          // Component was unmounted while loading; discard the models
          try { handLandmarker.close(); } catch (_) {}
          try { faceLandmarker.close(); } catch (_) {}
          return;
        }
        handLandmarkerRef.current = handLandmarker;
        faceLandmarkerRef.current = faceLandmarker;
        modelsLoadedRef.current   = true;
        setBtnStartDisabled(false);
        setStatusMsg("Models ready — click Start Camera.");
      } catch (err) {
        if (isMounted) {
          setStatusMsg(`Model load failed: ${err.message}`);
          setStatusError(true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();

    return () => {
      isMounted = false;
      document.removeEventListener("keydown", onKeydown);
      state.isRunning = false;
      if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
      if (state.stream) stopCamera(state.stream);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!modelsLoadedRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");

    setBtnStartDisabled(true);
    setBtnStopDisabled(false);
    setBtnZoomDisabled(false);
    setBtnCalibDisabled(false);
    setStatusMsg("Starting camera…");
    setStatusError(false);

    try {
      state.stream          = await startCamera(video);
      state.isRunning       = true;
      state.smoothCrop      = null;
      state.smoothEyeRegion = null;

      const { fovDeg } = estimateCameraFOV(state.stream);
      state.cameraFovDeg = fovDeg;

      resetDirectionBuffer();
      resetEyeCoverCounters();
      resetGazeSmoothing();
      frameCountRef.current  = 0;
      lastFpsTimeRef.current = performance.now();
      displayFpsRef.current  = 0;

      setStatusMsg("Running — detecting hands, face, and eyes.");

      // ── Render loop ──────────────────────────────────────────────────────
      function renderLoop(timestamp) {
        if (!state.isRunning) return;
        state.animFrameId = requestAnimationFrame(renderLoop);

        if (video.videoWidth === 0 || video.readyState < 2) return;

        if (canvas.width !== video.videoWidth) {
          canvas.width  = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const cw = canvas.width, ch = canvas.height;
        const vw = video.videoWidth, vh = video.videoHeight;

        const { handResult, faceResult } = detectFrame(
          handLandmarkerRef.current, faceLandmarkerRef.current, video, timestamp,
        );

        // ── Face processing ──────────────────────────────────────────────
        const facesFound = faceResult.faceLandmarks?.length > 0;
        state.faceDetected    = facesFound;
        state.eyesDetected    = false;
        state.leftEarValue    = null;
        state.rightEarValue   = null;
        state.rightEyeCovered = false;
        state.leftEyeCovered  = false;
        state.pdPixels        = null;
        state.pdMm            = null;

        let faceLms    = null;
        let pupilData  = null;
        let activeCrop = null;
        let gazeResult = null;

        if (facesFound) {
          faceLms = faceResult.faceLandmarks[0];
          state.eyesDetected = faceLms.length >= 390;

          if (state.eyesDetected) {
            state.leftEarValue  = computeEAR(faceLms, LEFT_EYE_EAR);
            state.rightEarValue = computeEAR(faceLms, RIGHT_EYE_EAR);
          }

          pupilData = computePupilData(faceLms, vw, vh);
          if (pupilData) {
            state.pdPixels = pupilData.pdPixels;
            state.pdMm     = pupilData.pdMm;
          }

          const distData = computeCameraDistance(pupilData, faceLms, vw, vh, state.cameraFovDeg);
          state.distanceCm = distData?.distanceCm ?? null;

          lastFaceLmsRef.current = faceLms;
          gazeResult = computeGaze(faceLms, null, vw, vh);
          gazeResultRef.current  = gazeResult;

          const cm = calibManagerRef.current;
          const cs = cm.state;
          if (cs === CalibState.LOCK_SPHERE) {
            cm.feedFrame(gazeResult);
          } else if (cs === CalibState.RUNNING && gazeResult) {
            cm.feedFrame(gazeResult);
            _setCalibDotProgress(cm.pointProgress);
          }

          if (gazeResult && cm.isReady) {
            const sp = cm.mapGaze(gazeResult.yaw, gazeResult.pitch);
            if (sp) _showGazeDot(sp.x, sp.y);
          }

          const rawEye = computeEyeRegion(faceLms, vw, vh, EYE_PIP_AR);
          if (rawEye) state.smoothEyeRegion = lerpCrop(state.smoothEyeRegion, rawEye, 0.12);

          if (state.zoomEnabled) {
            const rawCrop = computeFaceBBox(faceLms, vw, vh, cw, ch);
            state.smoothCrop = lerpCrop(state.smoothCrop, rawCrop, 0.10);
            activeCrop = state.smoothCrop;
          }
        }

        // ── Hand-over-eye ────────────────────────────────────────────────
        const eyeCover = detectHandOverEye(handResult.landmarks ?? [], faceLms, vw, vh);
        state.rightEyeCovered = eyeCover.rightCovered;
        state.leftEyeCovered  = eyeCover.leftCovered;

        // ── Draw ─────────────────────────────────────────────────────────
        clearCanvas(ctx, cw, ch);
        drawVideoFrame(ctx, video, cw, ch, activeCrop);
        const toScreen = makeToScreen(activeCrop, cw, ch);

        const handsFound = handResult.landmarks?.length > 0;
        state.handDetected = handsFound;

        if (handsFound) {
          for (let i = 0; i < handResult.landmarks.length; i++) {
            const lms   = handResult.landmarks[i];
            const label = handResult.handedness[i]?.[0]?.categoryName
                       ?? handResult.handedness[i]?.[0]?.displayName ?? "";
            drawHand(ctx, lms, toScreen, label === "Left" ? "#00FF88" : "#FF8800");
            if (i === 0) {
              const dir = smoothDirection(classifyHandDirection(lms));
              state.handDirection = dir;
              drawDirectionLabel(ctx, lms, toScreen, dir);
            }
          }
        } else {
          resetDirectionBuffer();
          state.handDirection = "UNKNOWN";
        }

        if (faceLms) {
          drawFaceOutline(ctx, faceLms, toScreen);
          drawEyes(ctx, faceLms, toScreen);
          const dd = state.distanceCm != null ? { distanceCm: state.distanceCm } : null;
          drawDistanceBadge(ctx, faceLms, dd, toScreen);
          if (gazeResult) drawGazeRays(ctx, gazeResult, toScreen, vw, vh);
        }

        if (!activeCrop && facesFound) {
          drawZoomRegion(ctx, computeFaceBBox(faceLms, vw, vh, cw, ch), cw, ch);
        }

        if (faceLms && state.smoothEyeRegion) {
          const dd = state.distanceCm != null ? { distanceCm: state.distanceCm } : null;
          drawEyePIP(ctx, video, faceLms, cw, ch, pupilData, eyeCover, state.smoothEyeRegion, dd);
        }

        // FPS
        frameCountRef.current++;
        const now = performance.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          displayFpsRef.current  = frameCountRef.current;
          frameCountRef.current  = 0;
          lastFpsTimeRef.current = now;
        }

        _updateDebugPanel(gazeResult);
      }

      requestAnimationFrame(renderLoop);
    } catch (err) {
      setStatusMsg(`Camera error: ${err.message}`);
      setStatusError(true);
      setBtnStartDisabled(false);
      setBtnStopDisabled(true);
      setBtnZoomDisabled(true);
      setBtnCalibDisabled(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stop camera ───────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    state.isRunning       = false;
    state.smoothCrop      = null;
    state.smoothEyeRegion = null;

    if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
    stopCamera(state.stream);
    state.stream = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    gazeResultRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) clearCanvas(canvas.getContext("2d"), canvas.width, canvas.height);

    _hideCalibOverlay();
    _hideGazeDot();
    calibManagerRef.current?.reset();
    clearLockedSpheres();

    setBtnStartDisabled(false);
    setBtnStopDisabled(true);
    setBtnZoomDisabled(true);
    setBtnCalibDisabled(true);
    setBtnCalibText("Calibrate Gaze");
    setBtnCalibrated(false);
    setZoomOn(false);
    state.zoomEnabled = false;

    resetDirectionBuffer();
    resetEyeCoverCounters();
    resetGazeSmoothing();

    setStatusMsg("Camera stopped — click Start Camera to restart.");
    setStatusError(false);
    _resetDebugPanel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Zoom toggle ───────────────────────────────────────────────────────────
  const handleZoom = useCallback(() => {
    const on = !state.zoomEnabled;
    state.zoomEnabled = on;
    if (!on) state.smoothCrop = null;
    setZoomOn(on);
  }, []);

  // ── Calibrate gaze ────────────────────────────────────────────────────────
  const handleCalib = useCallback(() => {
    if (!state.isRunning) return;
    calibManagerRef.current?.reset();
    clearLockedSpheres();
    _hideGazeDot();
    _showCalibIntro();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Click on intro overlay starts calibration ────────────────────────────
  const handleOverlayClick = useCallback(() => {
    const cm = calibManagerRef.current;
    if (cm?.state === CalibState.IDLE) cm.start();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>Eye Exam Tracker</h1>
        <p className={styles.subtitle}>Hand · Face · Eyes · Direction · PD · Gaze Calibration</p>
      </header>

      <main className={styles.main}>
        {/* ── Viewport ──────────────────────────────────────────────────── */}
        <div className={styles.viewportWrap}>
          <video ref={videoRef} playsInline autoPlay muted className={styles.video} />
          <canvas ref={canvasRef} className={styles.overlay} />
          <div className={`${styles.zoomBadge}${zoomOn ? " " + styles.zoomBadgeVisible : ""}`}>
            FACE ZOOM
          </div>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <span>Loading models…</span>
            </div>
          )}
        </div>

        {/* ── Debug panel ───────────────────────────────────────────────── */}
        <aside className={styles.debugPanel}>
          <h2 className={styles.debugTitle}>Debug</h2>

          <table className={styles.debugTable}>
            <tbody>
              <tr><td className={styles.label}>Hand detected</td><td><span ref={dbgHandRef} className="val">—</span></td></tr>
              <tr><td className={styles.label}>Face detected</td><td><span ref={dbgFaceRef} className="val">—</span></td></tr>
              <tr><td className={styles.label}>Eyes detected</td><td><span ref={dbgEyesRef} className="val">—</span></td></tr>
              <tr><td className={styles.label}>Direction</td><td><span ref={dbgDirRef} className="val">—</span></td></tr>
            </tbody>
          </table>

          <hr className={styles.hr} />
          <div className={styles.sectionLabel}>Eye openness (EAR)</div>
          <table className={styles.debugTable}><tbody>
            <tr><td className={styles.label}>Right eye</td><td><span ref={dbgRightEarRef} className="val">—</span></td></tr>
            <tr><td className={styles.label}>Left eye</td><td><span ref={dbgLeftEarRef} className="val">—</span></td></tr>
          </tbody></table>

          <hr className={styles.hr} />
          <div className={styles.sectionLabel}>Hand over eye</div>
          <table className={styles.debugTable}><tbody>
            <tr><td className={styles.label}>Right eye</td><td><span ref={dbgRightCoverRef} className="val">—</span></td></tr>
            <tr><td className={styles.label}>Left eye</td><td><span ref={dbgLeftCoverRef} className="val">—</span></td></tr>
          </tbody></table>

          <hr className={styles.hr} />
          <div className={styles.sectionLabel}>Pupillary distance</div>
          <table className={styles.debugTable}><tbody>
            <tr><td className={styles.label}>PD (pixels)</td><td><span ref={dbgPdPxRef} className="val">—</span></td></tr>
            <tr><td className={styles.label}>PD (est. mm)</td><td><span ref={dbgPdMmRef} className="val pdMm">—</span></td></tr>
          </tbody></table>
          <p className={styles.note}>mm estimate uses iris diameter (~11.7 mm ref).</p>

          <hr className={styles.hr} />
          <div className={styles.sectionLabel}>Camera distance</div>
          <table className={styles.debugTable}><tbody>
            <tr><td className={styles.label}>Distance</td><td><span ref={dbgDistRef} className="val">—</span></td></tr>
          </tbody></table>

          <hr className={styles.hr} />
          <div className={styles.sectionLabel}>Gaze tracking</div>
          <table className={styles.debugTable}><tbody>
            <tr><td className={styles.label}>Yaw</td><td><span ref={dbgGazeYawRef} className="val">—</span></td></tr>
            <tr><td className={styles.label}>Pitch</td><td><span ref={dbgGazePitchRef} className="val">—</span></td></tr>
            <tr><td className={styles.label}>Calibration</td><td><span ref={dbgCalibRef} className="val">—</span></td></tr>
          </tbody></table>

          <hr className={styles.hr} />
          <table className={styles.debugTable}><tbody>
            <tr><td className={styles.label}>Face zoom</td><td><span ref={dbgZoomRef} className="val">OFF</span></td></tr>
            <tr><td className={styles.label}>FPS</td><td><span ref={dbgFpsRef} className="val fps">0</span></td></tr>
          </tbody></table>

          <hr className={styles.hr} />
          <div className={styles.legend}>
            {[
              ["#00FF88", "Hand (cam-right)"],
              ["#FF8800", "Hand (cam-left)"],
              ["#FFD700", "Face oval"],
              ["#44AAFF", "Right eye / iris"],
              ["#FF44AA", "Left eye / iris"],
              ["#AA44FF", "Zoom box / PD line"],
            ].map(([c, l]) => (
              <div key={l}><span className={styles.dot} style={{ background: c }} />{l}</div>
            ))}
          </div>
        </aside>
      </main>

      {/* ── Footer controls ────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.controls}>
          <button className={styles.btnStart} onClick={handleStart} disabled={btnStartDisabled}>
            Start Camera
          </button>
          <button className={styles.btnStop} onClick={handleStop} disabled={btnStopDisabled}>
            Stop Camera
          </button>
          <button
            className={`${styles.btnZoom} ${zoomOn ? styles.btnZoomOn : styles.btnZoomOff}`}
            onClick={handleZoom}
            disabled={btnZoomDisabled}
          >
            {zoomOn ? "Exit Zoom" : "Focus Face"}
          </button>
          <button
            className={`${styles.btnCalib}${btnCalibrated ? " " + styles.btnCalibrated : ""}`}
            onClick={handleCalib}
            disabled={btnCalibDisabled}
          >
            {btnCalibText}
          </button>
        </div>
        <div className={styles.statusBar}>
          <span className={statusError ? styles.statusError : styles.status}>{statusMsg}</span>
        </div>
      </footer>

      {/* ── Calibration overlay (rendered in-tree, fixed-positioned) ─────── */}
      <div
        ref={calibOverlayRef}
        className={styles.calibOverlay}
        style={{ display: "none" }}
        onClick={handleOverlayClick}
      >
        <div ref={calibInstrRef} className={styles.calibInstr} style={{ display: "none" }} />
      </div>

      {/* Pulsing calibration target dot */}
      <div ref={calibDotRef} className={styles.calibDot} style={{ display: "none" }}>
        <div ref={dotLabelRef}    className={styles.dotLabel} />
        <div ref={progressArcRef} className={styles.progressArc} />
      </div>

      {/* Live gaze cursor */}
      <div ref={gazeDotRef} className={styles.gazeDot} style={{ display: "none" }} />
    </div>
  );
}
