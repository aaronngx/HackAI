/**
 * draw.js — Canvas drawing utilities.
 *
 * Every landmark-drawing function accepts a `toScreen(lm) → {x, y}` callback
 * instead of raw (w, h) values. This supports both full-frame and zoomed views.
 * The mapper is created in main.js via makeToScreen().
 *
 * ── Eye landmark indices (478-point Face Landmarker model) ───────────────────
 *
 *   Right eye (subject's right = camera-left):
 *     Contour: 33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
 *     EAR:     top=159, bottom=145, top2=158, bottom2=153, left=33, right=133
 *     Iris center: 468  |  Cardinal edges: 469=R, 470=Bot, 471=L, 472=Top
 *
 *   Left eye (subject's left = camera-right):
 *     Contour: 362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
 *     EAR:     top=386, bottom=374, top2=385, bottom2=380, left=362, right=263
 *     Iris center: 473  |  Cardinal edges: 474=R, 475=Bot, 476=L, 477=Top
 */

// ── Hand skeleton connections ─────────────────────────────────────────────────
const HAND_CONNECTIONS = [
  [0, 1],  [1, 2],   [2, 3],   [3, 4],   // thumb
  [0, 5],  [5, 6],   [6, 7],   [7, 8],   // index
  [5, 9],  [9, 10],  [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13,17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17],                               // palm base
];

// ── Eye contour indices ───────────────────────────────────────────────────────
export const RIGHT_EYE_CONTOUR = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];
export const LEFT_EYE_CONTOUR = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398,
];

// ── EAR anchor definitions ────────────────────────────────────────────────────
export const RIGHT_EYE_EAR = {
  top: 159, bottom: 145, top2: 158, bottom2: 153, left: 33, right: 133,
};
export const LEFT_EYE_EAR = {
  top: 386, bottom: 374, top2: 385, bottom2: 380, left: 362, right: 263,
};

// ── Face oval silhouette ──────────────────────────────────────────────────────
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172,  58, 132,  93, 234, 127, 162,  21,  54, 103,  67, 109, 10,
];

// ── Direction visual maps ─────────────────────────────────────────────────────
const DIR_ARROW = { UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→", UNKNOWN: "?" };
const DIR_COLOR = {
  UP: "#00FF88", DOWN: "#FF8800", LEFT: "#00AAFF", RIGHT: "#FF44FF", UNKNOWN: "#888888",
};

// ── PIP layout constants ──────────────────────────────────────────────────────
export const EYE_PIP_AR = 3.5; // target width:height ratio for the eye PIP

// Distance badge colour thresholds (cm)
const DIST_CLOSE  = 40;   // < 40 cm → orange warning
const DIST_DANGER = 25;   // < 25 cm → red warning

// ─────────────────────────────────────────────────────────────────────────────
// Gaze ray overlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw the 3D gaze geometry on the main canvas:
 *   • Cyan dots at orbit (eye-socket) centers
 *   • Small bright dots at iris centers
 *   • Blue/pink dashed rays: orbit → iris → monitor plane
 *   • Purple dashed rectangle: virtual monitor boundary
 *   • Red crosshair dot: gaze ray-plane intersection (where user is looking)
 *
 * All 3D camera-pixel coordinates from GazeResult are projected to canvas
 * via toScreen (which handles mirror flip and optional zoom crop).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./eyeTracking.js').GazeResult} gazeResult
 * @param {(lm:{x,y,z})=>{x:number,y:number}} toScreen
 * @param {number} vw  video width (used to un-normalise 3D pixel coords)
 * @param {number} vh  video height
 */
export function drawGazeRays(ctx, gazeResult, toScreen, vw, vh) {
  const {
    eyeOriginL, eyeOriginR,
    irisL, irisR,
    monitorHit, monitorCenter, monitorW, monitorH,
  } = gazeResult;

  // Convert camera-pixel-3D → canvas using toScreen (normalise first)
  const p3s = (p) => toScreen({ x: p.x / vw, y: p.y / vh, z: p.z / vw });

  const oR = p3s(eyeOriginR);
  const oL = p3s(eyeOriginL);
  const iR = p3s(irisR);
  const iL = p3s(irisL);

  ctx.save();

  // ── Orbit centers (cyan rings) ───────────────────────────────────────────
  ctx.strokeStyle = "#00FFFF";
  ctx.lineWidth   = 1.5;
  [oR, oL].forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ── Iris centers (bright dots) ───────────────────────────────────────────
  ctx.fillStyle = "#FFFFFF";
  [iR, iL].forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Gaze rays: orbit → iris → monitor hit ────────────────────────────────
  function drawRay(orbit, iris, hitPt, color) {
    const end = hitPt ?? _extend2D(orbit, iris, 180);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(orbit.x, orbit.y);
    ctx.lineTo(iris.x,  iris.y);
    ctx.lineTo(end.x,   end.y);
    ctx.stroke();
  }

  const hit = monitorHit ? p3s(monitorHit) : null;
  drawRay(oR, iR, hit, "#44AAFF");   // right eye: blue
  drawRay(oL, iL, hit, "#FF44AA");   // left eye: pink
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // ── Virtual monitor boundary (dashed purple rectangle) ───────────────────
  const hw = monitorW / 2;
  const hh = monitorH / 2;
  const mz = monitorCenter.z;
  const corners = [
    p3s({ x: monitorCenter.x - hw, y: monitorCenter.y - hh, z: mz }),
    p3s({ x: monitorCenter.x + hw, y: monitorCenter.y - hh, z: mz }),
    p3s({ x: monitorCenter.x + hw, y: monitorCenter.y + hh, z: mz }),
    p3s({ x: monitorCenter.x - hw, y: monitorCenter.y + hh, z: mz }),
  ];

  ctx.strokeStyle = "rgba(170,68,255,0.6)";
  ctx.lineWidth   = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(corners[3].x, corners[3].y);
  corners.forEach(c => ctx.lineTo(c.x, c.y));
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Gaze hit point (red crosshair) ───────────────────────────────────────
  if (hit) {
    ctx.fillStyle   = "#FF3333";
    ctx.strokeStyle = "rgba(255,51,51,0.55)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hit.x - 12, hit.y); ctx.lineTo(hit.x + 12, hit.y);
    ctx.moveTo(hit.x, hit.y - 12); ctx.lineTo(hit.x, hit.y + 12);
    ctx.stroke();
  }

  ctx.restore();
}

/** Extend a 2D line segment (a→b) by `pixels` past b. */
function _extend2D(a, b, pixels) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: b.x + (dx / len) * pixels, y: b.y + (dy / len) * pixels };
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw a floating distance badge on the main canvas above the detected face.
 *
 * Badge colour:
 *   green  = > 40 cm (comfortable)
 *   orange = 25–40 cm (close)
 *   red    = < 25 cm (too close)
 *
 * @param {CanvasRenderingContext2D}        ctx
 * @param {Array<{x,y,z}>}                 faceLandmarks   478-pt face mesh
 * @param {{ distanceCm:number }} distanceData
 * @param {(lm:{x,y,z})=>{x:number,y:number}} toScreen
 */
export function drawDistanceBadge(ctx, faceLandmarks, distanceData, toScreen) {
  if (!faceLandmarks?.length || !distanceData) return;

  // Position badge above the top of the face oval (landmark 10 = forehead top)
  const top = toScreen(faceLandmarks[10]);
  const bx  = top.x;
  const by  = top.y - 36;

  const { distanceCm } = distanceData;
  const label = `~${distanceCm} cm`;
  const warn   = distanceCm < DIST_DANGER ? "TOO CLOSE"
               : distanceCm < DIST_CLOSE  ? "CLOSE"
               : null;

  const color = distanceCm < DIST_DANGER ? "#FF4444"
              : distanceCm < DIST_CLOSE  ? "#FF8800"
              : "#00FF88";

  ctx.save();
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = warn ? `${label}  ${warn}` : label;
  const tw   = ctx.measureText(text).width;
  const ph   = 22;

  // Background pill
  ctx.fillStyle = "rgba(0,0,0,0.60)";
  ctx.beginPath();
  ctx.roundRect(bx - tw / 2 - 10, by - ph / 2, tw + 20, ph, 6);
  ctx.fill();

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx - tw / 2 - 10, by - ph / 2, tw + 20, ph, 6);
  ctx.stroke();

  // Text
  ctx.fillStyle = color;
  ctx.fillText(text, bx, by);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

/** Erase the full canvas. */
export function clearCanvas(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
}

/**
 * Draw the video frame onto the canvas, optionally cropped to a face region.
 * Applies a horizontal flip so the output looks like a mirror / selfie camera.
 */
export function drawVideoFrame(ctx, video, cw, ch, crop) {
  ctx.save();
  ctx.translate(cw, 0);
  ctx.scale(-1, 1);

  if (crop) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    ctx.drawImage(
      video,
      crop.nx * vw, crop.ny * vh,
      crop.nw * vw, crop.nh * vh,
      0, 0, cw, ch,
    );
  } else {
    ctx.drawImage(video, 0, 0, cw, ch);
  }

  ctx.restore();
}

/**
 * Draw a dashed rectangle showing the face zoom target region.
 * Call this when zoom is OFF to give a visual preview of the crop.
 */
export function drawZoomRegion(ctx, crop, cw, ch) {
  const x = (1 - (crop.nx + crop.nw)) * cw;
  const y = crop.ny * ch;
  const w = crop.nw * cw;
  const h = crop.nh * ch;

  ctx.save();
  ctx.strokeStyle = "#AA44FF";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#AA44FF";
  ctx.font = "bold 11px monospace";
  ctx.fillText("ZOOM", x + 4, y + 14);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Hand drawing
// ─────────────────────────────────────────────────────────────────────────────

/** Draw the hand skeleton (connections + landmark dots). */
export function drawHand(ctx, landmarks, toScreen, color = "#00FF88") {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    const pA = toScreen(landmarks[a]);
    const pB = toScreen(landmarks[b]);
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();
  }
  for (let i = 0; i < landmarks.length; i++) {
    const p = toScreen(landmarks[i]);
    ctx.fillStyle = i === 8 ? "#FF4444" : color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === 0 ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw direction label + arrow above the hand. */
export function drawDirectionLabel(ctx, landmarks, toScreen, direction) {
  if (!landmarks?.length) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  for (const lm of landmarks) {
    const p = toScreen(lm);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
  }

  const cx = (minX + maxX) / 2;
  const cy = minY - 28;
  const label = `${DIR_ARROW[direction] ?? "?"} ${direction}`;
  const color = DIR_COLOR[direction] ?? "#888888";

  ctx.font = "bold 18px monospace";
  const tw = ctx.measureText(label).width;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(cx - tw / 2 - 8, cy - 18, tw + 16, 24, 6);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy - 6);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ─────────────────────────────────────────────────────────────────────────────
// Face / eye drawing
// ─────────────────────────────────────────────────────────────────────────────

/** Draw face oval silhouette. */
export function drawFaceOutline(ctx, lms, toScreen) {
  if (!lms?.length) return;
  ctx.strokeStyle = "rgba(255, 200, 0, 0.65)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const first = toScreen(lms[FACE_OVAL[0]]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < FACE_OVAL.length; i++) {
    const p = toScreen(lms[FACE_OVAL[i]]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
}

/** Draw both eye contours and iris center dots on the main canvas. */
export function drawEyes(ctx, lms, toScreen) {
  if (!lms || lms.length < 390) return;
  _drawContour(ctx, lms, RIGHT_EYE_CONTOUR, toScreen, "#44AAFF");
  _drawContour(ctx, lms, LEFT_EYE_CONTOUR,  toScreen, "#FF44AA");
  if (lms.length >= 478) {
    _dot(ctx, toScreen(lms[468]), "#44AAFF", 4);
    _dot(ctx, toScreen(lms[473]), "#FF44AA", 4);
  }
}

/** Compute Eye Aspect Ratio in normalized landmark space. */
export function computeEAR(lms, ear) {
  if (!lms || lms.length < 478) return null;
  const dist = (a, b) => {
    const dx = lms[a].x - lms[b].x;
    const dy = lms[a].y - lms[b].y;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const v1 = dist(ear.top,  ear.bottom);
  const v2 = dist(ear.top2, ear.bottom2);
  const h  = dist(ear.left, ear.right);
  return h > 0 ? (v1 + v2) / (2 * h) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Eye PIP (picture-in-picture)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw the Eye Focus PIP panel — a magnified inset showing both eyes with:
 *   - Cropped & mirrored video of the eye region
 *   - Eye contours (blue = right, pink = left)
 *   - Iris circles with pupil center crosshairs
 *   - Dashed PD measurement line between pupils
 *   - PD distance in both pixels and estimated mm
 *   - Red "COVERED" warning overlay for each covered eye
 *
 * Panel is positioned in the bottom-right corner of the canvas.
 *
 * @param {CanvasRenderingContext2D}          ctx
 * @param {HTMLVideoElement}                  video
 * @param {Array<{x,y,z}>}                   faceLandmarks  478-point face mesh
 * @param {number}                            cw             canvas width
 * @param {number}                            ch             canvas height
 * @param {import('./eyeAnalysis.js').PupilData|null} pupilData
 * @param {{ rightCovered:boolean, leftCovered:boolean }} eyeCover
 * @param {{ nx,ny,nw,nh }}                  eyeRegion     normalized crop rect
 * @param {{ distanceCm:number }|null} [distanceData]
 */
export function drawEyePIP(ctx, video, faceLandmarks, cw, ch, pupilData, eyeCover, eyeRegion, distanceData) {
  const PIP_W    = Math.max(200, Math.min(Math.round(cw * 0.40), 440));
  const PIP_H    = Math.round(PIP_W / EYE_PIP_AR);
  const PIP_X    = cw - PIP_W - 10;
  const PIP_Y    = ch - PIP_H - 10;
  const HDR_H    = 22;
  const vw       = video.videoWidth;
  const vh       = video.videoHeight;

  ctx.save();

  // ── Drop shadow ──────────────────────────────────────────────────────────
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = "#090b0f";
  ctx.beginPath();
  ctx.roundRect(PIP_X - 1, PIP_Y - HDR_H - 1, PIP_W + 2, PIP_H + HDR_H + 2, 7);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── Header bar ───────────────────────────────────────────────────────────
  ctx.fillStyle = "#141824";
  ctx.beginPath();
  ctx.roundRect(PIP_X, PIP_Y - HDR_H, PIP_W, HDR_H, [7, 7, 0, 0]);
  ctx.fill();

  ctx.font = "bold 10px monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#AA44FF";
  ctx.fillText("EYE FOCUS", PIP_X + 7, PIP_Y - HDR_H / 2);

  // Camera distance (left side, after title)
  if (distanceData) {
    const titleW = ctx.measureText("EYE FOCUS").width;
    ctx.fillStyle = "#AACCAA";
    ctx.font = "10px monospace";
    ctx.fillText(`  |  ~${distanceData.distanceCm} cm`, PIP_X + 7 + titleW, PIP_Y - HDR_H / 2);
    ctx.font = "bold 10px monospace";
  }

  if (pupilData) {
    const pdLabel = pupilData.pdMm != null
      ? `PD ${pupilData.pdMm.toFixed(1)}mm  (~${Math.round(pupilData.pdPixels)}px)`
      : `PD ${Math.round(pupilData.pdPixels)}px`;
    ctx.fillStyle = "#FFD700";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(pdLabel, PIP_X + PIP_W - 7, PIP_Y - HDR_H / 2);
    ctx.textAlign = "left";
  }
  ctx.textBaseline = "alphabetic";

  // ── Video crop (mirrored) ─────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(PIP_X, PIP_Y, PIP_W, PIP_H);
  ctx.clip();
  ctx.translate(PIP_X + PIP_W, PIP_Y);
  ctx.scale(-1, 1);
  ctx.drawImage(
    video,
    eyeRegion.nx * vw, eyeRegion.ny * vh,
    eyeRegion.nw * vw, eyeRegion.nh * vh,
    0, 0, PIP_W, PIP_H,
  );
  ctx.restore();

  // ── PIP-space coordinate mapper ───────────────────────────────────────────
  // Maps normalized face landmarks into PIP canvas coordinates (mirrored).
  const pip = (lm) => {
    const relX = (lm.x - eyeRegion.nx) / eyeRegion.nw;
    const relY = (lm.y - eyeRegion.ny) / eyeRegion.nh;
    return { x: PIP_X + (1 - relX) * PIP_W, y: PIP_Y + relY * PIP_H };
  };

  // ── Eye contours ─────────────────────────────────────────────────────────
  if (faceLandmarks?.length >= 390) {
    _drawContour(ctx, faceLandmarks, RIGHT_EYE_CONTOUR, pip, "rgba(68,170,255,0.75)");
    _drawContour(ctx, faceLandmarks, LEFT_EYE_CONTOUR,  pip, "rgba(255,68,170,0.75)");
  }

  // ── Iris circles + pupil crosshairs ───────────────────────────────────────
  let rCenter = null;
  let lCenter = null;

  if (pupilData && faceLandmarks?.length >= 478) {
    rCenter = _drawIris(ctx, faceLandmarks[468], pupilData.rightCardinals, pip, "#44AAFF");
    lCenter = _drawIris(ctx, faceLandmarks[473], pupilData.leftCardinals,  pip, "#FF44AA");
  }

  // ── PD measurement line ───────────────────────────────────────────────────
  if (rCenter && lCenter && pupilData) {
    _drawPDLine(ctx, rCenter, lCenter, pupilData.pdMm, pupilData.pdPixels);
  }

  // ── Covered-eye warnings ──────────────────────────────────────────────────
  // Split the PIP at the midpoint between the two pupil screen positions.
  const splitX = (rCenter && lCenter)
    ? (rCenter.x + lCenter.x) / 2
    : PIP_X + PIP_W / 2;

  if (eyeCover.rightCovered) {
    // Right eye appears on the RIGHT side of the mirrored PIP
    _drawCoveredOverlay(ctx, splitX, PIP_X + PIP_W, PIP_Y, PIP_H);
  }
  if (eyeCover.leftCovered) {
    // Left eye appears on the LEFT side of the mirrored PIP
    _drawCoveredOverlay(ctx, PIP_X, splitX, PIP_Y, PIP_H);
  }

  // ── Eye side labels ───────────────────────────────────────────────────────
  ctx.font = "bold 10px monospace";
  ctx.fillStyle = "rgba(68,170,255,0.9)";
  ctx.fillText("R", PIP_X + PIP_W - 16, PIP_Y + 13);
  ctx.fillStyle = "rgba(255,68,170,0.9)";
  ctx.fillText("L", PIP_X + 6, PIP_Y + 13);

  // ── PIP border (red when any eye is covered) ──────────────────────────────
  ctx.strokeStyle = (eyeCover.rightCovered || eyeCover.leftCovered) ? "#FF4444" : "#AA44FF";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(PIP_X, PIP_Y - HDR_H, PIP_W, PIP_H + HDR_H, 7);
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function _drawContour(ctx, lms, indices, toScreen, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const first = toScreen(lms[indices[0]]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < indices.length; i++) {
    const p = toScreen(lms[indices[i]]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
}

function _dot(ctx, p, color, r = 3) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw iris circle from center + 4 cardinal edge landmarks.
 * Returns the screen-space center of the iris (for PD line drawing).
 *
 * @param {CanvasRenderingContext2D}              ctx
 * @param {{x,y,z}}                              center    iris center landmark
 * @param {Array<{x,y,z}>}                       cardinals 4 edge landmarks
 * @param {(lm:{x,y,z})=>{x:number,y:number}}   toScreen
 * @param {string}                               color
 * @returns {{x:number, y:number}}               screen position of center
 */
function _drawIris(ctx, center, cardinals, toScreen, color) {
  const cp = toScreen(center);

  // Radius = average distance from center to each cardinal point in screen space
  let r = 0;
  for (const c of cardinals) {
    const p = toScreen(c);
    r += Math.sqrt((cp.x - p.x) ** 2 + (cp.y - p.y) ** 2);
  }
  r = Math.max(r / cardinals.length, 5); // ensure visible minimum

  // Iris ring
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
  ctx.stroke();

  // Pupil center white dot
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cp.x, cp.y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Crosshair lines
  const CH = Math.max(r * 0.6, 6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cp.x - CH, cp.y);
  ctx.lineTo(cp.x + CH, cp.y);
  ctx.moveTo(cp.x, cp.y - CH);
  ctx.lineTo(cp.x, cp.y + CH);
  ctx.stroke();

  return cp;
}

/**
 * Draw a dashed measurement line between two pupil screen positions.
 * Shows PD value as a label above the line midpoint.
 */
function _drawPDLine(ctx, rCenter, lCenter, pdMm, pdPx) {
  ctx.save();

  // Dashed line
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(rCenter.x, rCenter.y);
  ctx.lineTo(lCenter.x, lCenter.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tick marks at each end
  const TICK = 6;
  ctx.lineWidth = 1.5;
  for (const p of [rCenter, lCenter]) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - TICK);
    ctx.lineTo(p.x, p.y + TICK);
    ctx.stroke();
  }

  // Label at midpoint, above the line
  const mx = (rCenter.x + lCenter.x) / 2;
  const my = Math.min(rCenter.y, lCenter.y) - 9;
  const label = pdMm != null
    ? `PD: ${pdMm.toFixed(1)} mm`
    : `PD: ${Math.round(pdPx)} px`;

  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  const tw = ctx.measureText(label).width;

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(mx - tw / 2 - 4, my - 12, tw + 8, 14);

  ctx.fillStyle = "#FFD700";
  ctx.fillText(label, mx, my);

  ctx.textAlign = "left";
  ctx.restore();
}

/**
 * Draw a semi-transparent "COVERED" overlay over a section of the PIP.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1   left edge of the covered region
 * @param {number} x2   right edge
 * @param {number} y    top edge (PIP_Y)
 * @param {number} h    height (PIP_H)
 */
function _drawCoveredOverlay(ctx, x1, x2, y, h) {
  ctx.save();

  // Clip to PIP video area only (don't bleed into border)
  ctx.beginPath();
  ctx.rect(x1, y, x2 - x1, h);
  ctx.clip();

  // Red tint
  ctx.fillStyle = "rgba(255, 40, 40, 0.50)";
  ctx.fillRect(x1, y, x2 - x1, h);

  // Warning text
  ctx.fillStyle = "#FF4444";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("COVERED", (x1 + x2) / 2, y + h / 2);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}
