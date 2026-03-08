/**
 * gazeOverlay.js — Calibration UI and gaze dot DOM management.
 *
 * Two independent DOM layers (created programmatically, appended to body):
 *
 *   1. #calib-overlay  — dark full-screen overlay shown during calibration.
 *      Contains #calib-instr (intro text) and #calib-dot (pulsing target dot).
 *
 *   2. #gaze-dot — fixed-position red dot that follows the calibrated gaze
 *      point across the full browser window.
 *
 * Call initOverlay() once (from main.js) before using any other export.
 */

// ── Module-level DOM refs ─────────────────────────────────────────────────────
let _overlay     = null;   // semi-transparent dark cover
let _instrEl     = null;   // intro / status text inside overlay
let _calibDot    = null;   // pulsing target dot (the thing user stares at)
let _dotLabel    = null;   // "N / 9" counter below the dot
let _progressArc = null;   // spinning arc showing collection progress
let _gazeDot     = null;   // live gaze cursor shown after calibration

// ── Public API ────────────────────────────────────────────────────────────────

/** Create all overlay elements and inject the pulse animation keyframe. */
export function initOverlay() {
  if (_overlay) return; // idempotent

  // ── Dark full-screen overlay ──────────────────────────────────────────────
  _overlay = _el("div", "calib-overlay", `
    display:none; position:fixed; inset:0; z-index:10000;
    background:rgba(0,0,0,0.85); pointer-events:all;
  `);

  // Instructions / status text (centred in overlay)
  _instrEl = _el("div", "calib-instr", `
    display:none; position:absolute; top:50%; left:50%;
    transform:translate(-50%,-50%);
    color:#e6edf3; font-family:system-ui,sans-serif; font-size:18px;
    text-align:center; line-height:1.8; pointer-events:none;
    text-shadow:0 2px 8px #000;
  `);
  _overlay.appendChild(_instrEl);

  // ── Calibration target dot ────────────────────────────────────────────────
  _calibDot = _el("div", "calib-dot", `
    display:none; position:fixed; z-index:10001;
    width:28px; height:28px; border-radius:50%;
    background:#00FF88; border:3px solid #fff;
    transform:translate(-50%,-50%); pointer-events:none;
    animation:calib-pulse 1s ease-out infinite;
  `);

  // Point counter label (below dot)
  _dotLabel = _el("div", "", `
    position:absolute; top:38px; left:50%; transform:translateX(-50%);
    color:#fff; font-family:monospace; font-size:12px;
    white-space:nowrap; text-shadow:0 1px 4px #000;
  `);
  _calibDot.appendChild(_dotLabel);

  // Collection-progress spinner ring (overlaid on dot)
  _progressArc = _el("div", "", `
    position:absolute; inset:-7px; border-radius:50%;
    border:3px solid transparent; border-top-color:#FFD700;
    transition:transform 0.08s linear;
  `);
  _calibDot.appendChild(_progressArc);

  // ── Live gaze dot ─────────────────────────────────────────────────────────
  _gazeDot = _el("div", "gaze-dot", `
    display:none; position:fixed; z-index:9999;
    width:20px; height:20px; border-radius:50%;
    background:rgba(255,55,55,0.80); border:2px solid rgba(255,255,255,0.85);
    box-shadow:0 0 14px rgba(255,55,55,0.65); transform:translate(-50%,-50%);
    pointer-events:none; will-change:left,top;
    transition:left 0.05s linear, top 0.05s linear;
  `);

  document.body.appendChild(_overlay);
  document.body.appendChild(_calibDot);
  document.body.appendChild(_gazeDot);

  // Inject keyframe animation once
  if (!document.getElementById("gaze-overlay-styles")) {
    const s = document.createElement("style");
    s.id = "gaze-overlay-styles";
    s.textContent = `
      @keyframes calib-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(0,255,136,0.75); }
        70%  { box-shadow: 0 0 0 16px rgba(0,255,136,0); }
        100% { box-shadow: 0 0 0 0 rgba(0,255,136,0); }
      }
    `;
    document.head.appendChild(s);
  }
}

// ── Calibration overlay control ───────────────────────────────────────────────

/**
 * Show the intro screen with instructions before calibration starts.
 * The overlay is shown; the pulsing dot is hidden.
 */
export function showCalibrationIntro() {
  _overlay.style.display  = "block";
  _instrEl.style.display  = "block";
  _calibDot.style.display = "none";
  _instrEl.innerHTML = `
    <strong style="color:#00FF88;font-size:24px">Eye Tracking Calibration</strong><br><br>
    <strong>Step 1:</strong> A dot will appear at screen center — look straight at it<br>
    while your eye positions are locked to your head structure.<br>
    <strong>Step 2:</strong> Follow <strong>9 dots</strong> around the screen to calibrate gaze mapping.<br><br>
    Keep your <strong>head still</strong> throughout. Sit at a comfortable distance.<br><br>
    <span style="color:#FFD700">Press <strong>Space</strong> or click anywhere to begin.</span>
  `;
}

/**
 * Show the sphere-lock dot at screen center (Phase 1).
 * @param {number} progress [0..1]
 */
export function showSphereLockDot(progress) {
  _instrEl.style.display  = "none";
  _calibDot.style.display = "block";
  _calibDot.style.left    = "50vw";
  _calibDot.style.top     = "50vh";
  _dotLabel.textContent   = "Look here — locking eye positions…";
  _progressArc.style.transform = `rotate(${progress * 360}deg)`;
}

/**
 * Move the calibration dot to a new screen position and show the point counter.
 *
 * @param {number} sx  — screen x fraction [0..1]
 * @param {number} sy  — screen y fraction [0..1]
 * @param {number} idx — current point index (0-based)
 * @param {number} total — total calibration points
 */
export function showCalibrationDot(sx, sy, idx, total) {
  _instrEl.style.display  = "none";
  _calibDot.style.display = "block";
  _calibDot.style.left    = `${sx * 100}vw`;
  _calibDot.style.top     = `${sy * 100}vh`;
  _dotLabel.textContent   = `${idx + 1} / ${total}`;
  _progressArc.style.transform = "rotate(0deg)";
}

/**
 * Update the spinning progress ring around the calibration dot.
 * @param {number} fraction — [0..1], 1 = full rotation
 */
export function setCalibrationDotProgress(fraction) {
  _progressArc.style.transform = `rotate(${fraction * 360}deg)`;
}

/** Show a transient message inside the overlay (e.g. "Computing…"). */
export function showCalibrationStatus(msg) {
  _calibDot.style.display = "none";
  _instrEl.style.display  = "block";
  _instrEl.innerHTML = `<span style="color:#FFD700;font-size:20px">${msg}</span>`;
}

/** Hide the calibration overlay and dot entirely. */
export function hideCalibrationOverlay() {
  _overlay.style.display  = "none";
  _calibDot.style.display = "none";
}

// ── Gaze dot control ──────────────────────────────────────────────────────────

/**
 * Position and show the live gaze dot.
 * @param {number} sx  — screen x fraction [0..1]
 * @param {number} sy  — screen y fraction [0..1]
 */
export function showGazeDot(sx, sy) {
  _gazeDot.style.display = "block";
  _gazeDot.style.left    = `${sx * 100}vw`;
  _gazeDot.style.top     = `${sy * 100}vh`;
}

/** Hide the gaze dot (e.g. when camera stops or recalibrating). */
export function hideGazeDot() {
  _gazeDot.style.display = "none";
}

// ── DOM helper ────────────────────────────────────────────────────────────────

function _el(tag, id, css) {
  const el = document.createElement(tag);
  if (id) el.id = id;
  el.style.cssText = css.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return el;
}
