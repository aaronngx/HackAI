/**
 * state.js — Shared mutable app state.
 */

export const state = {
  isRunning:   false,
  stream:      null,
  animFrameId: null,

  // ── Detection results ────────────────────────────────────────────────────
  handDetected:  false,
  faceDetected:  false,
  eyesDetected:  false,
  handDirection: "UNKNOWN",
  leftEarValue:  null,
  rightEarValue: null,

  // ── Hand-over-eye detection ───────────────────────────────────────────────
  rightEyeCovered: false,
  leftEyeCovered:  false,

  // ── Pupillary distance ────────────────────────────────────────────────────
  pdPixels: null,   // inter-pupil distance in pixels
  pdMm:     null,   // estimated PD in mm (uses iris diameter as reference)

  // ── Face zoom ────────────────────────────────────────────────────────────
  zoomEnabled: false,
  smoothCrop:  null,  // EMA-smoothed face crop rect { nx,ny,nw,nh }

  // ── Eye PIP ──────────────────────────────────────────────────────────────
  smoothEyeRegion: null,  // EMA-smoothed eye crop rect for the PIP panel

  // ── Camera distance ───────────────────────────────────────────────────────
  distanceCm:   null,  // estimated face-to-camera distance in cm
  cameraFovDeg: 70,    // FOV in degrees — auto-detected from camera label
};
