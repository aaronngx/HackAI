/**
 * eyeAnalysis.js — Hand-over-eye detection, pupil center location, and PD measurement.
 *
 * ── Hand-over-eye detection ───────────────────────────────────────────────────
 *
 * Algorithm:
 *   1. For each eye, compute its center (centroid of contour landmarks) and
 *      its "radius" (half the horizontal landmark span) — both in pixel space
 *      so video aspect ratio is accounted for.
 *   2. For each detected hand, count how many of its 21 landmarks fall within
 *      COVER_RADIUS_FACTOR × eye_radius of the eye center.
 *   3. If ≥ MIN_COVER_HITS landmarks are in range → raw coverage detected.
 *   4. A hysteresis counter ramps up quickly (by 3) on detection and decays
 *      slowly (by 1) when absent. This eliminates single-frame flicker.
 *
 * ── Pupillary Distance (PD) estimation ───────────────────────────────────────
 *
 * MediaPipe Face Landmarker outputs iris landmarks when the full 478-point
 * model is active:
 *
 *   Right iris: 468=center, 469=right-edge, 470=bottom, 471=left-edge, 472=top
 *   Left  iris: 473=center, 474=right-edge, 475=bottom, 476=left-edge, 477=top
 *
 * PD estimation uses the iris diameter as a physical reference:
 *
 *   pd_mm = (pixel_distance_between_iris_centers / avg_iris_diameter_px) × 11.7mm
 *
 * The average human iris diameter is ~11.7 mm. Accuracy depends on camera
 * distance and lens distortion — treat the mm value as a rough estimate only.
 * Typical adult PD is 54–74 mm, average ~63 mm.
 */

import { RIGHT_EYE_CONTOUR, LEFT_EYE_CONTOUR } from "./draw.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const AVERAGE_IRIS_DIAMETER_MM = 11.7;

// ── Biological reference sizes (population averages, in mm) ──────────────────
// Iris diameter: mean 11.7 mm, SD ~0.5 mm  (highly consistent across adults)
// Bizygomatic face width (lm 234↔454): mean 145 mm, SD ~8 mm  (more variable)
const FACE_WIDTH_MM = 145;
// AVERAGE_IRIS_DIAMETER_MM already defined above
const COVER_RADIUS_FACTOR = 3.0;   // how many eye-radii around the eye center to check
const MIN_COVER_HITS      = 5;     // min hand landmarks in range to count as covering
const COVER_RAMP_UP       = 3;     // counter increment when coverage detected
const COVER_RAMP_DOWN     = 1;     // counter decrement when no coverage
const COVER_MAX           = 8;     // ceiling for the counter
const COVER_THRESHOLD     = 5;     // counter must reach this to flip state → covered

// Hysteresis counters per eye (module-level, persist between frames)
const coverCounter = { right: 0, left: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect whether a hand is covering each eye.
 * Uses pixel-space proximity to handle non-square video correctly.
 *
 * @param {Array<Array<{x,y,z}>>} handLandmarks  — all detected hand landmark sets
 * @param {Array<{x,y,z}>|null}   faceLandmarks  — 478-point face mesh (or null)
 * @param {number}                vw             — video width in pixels
 * @param {number}                vh             — video height in pixels
 * @returns {{ rightCovered: boolean, leftCovered: boolean }}
 */
export function detectHandOverEye(handLandmarks, faceLandmarks, vw, vh) {
  // Decay counters if there's nothing to check
  if (!faceLandmarks?.length || !handLandmarks?.length) {
    coverCounter.right = Math.max(0, coverCounter.right - COVER_RAMP_DOWN);
    coverCounter.left  = Math.max(0, coverCounter.left  - COVER_RAMP_DOWN);
    return _countersToResult();
  }

  // Eye centers in pixel space
  const rc = _eyeCenter(faceLandmarks, RIGHT_EYE_CONTOUR, vw, vh);
  const lc = _eyeCenter(faceLandmarks, LEFT_EYE_CONTOUR,  vw, vh);

  // Eye "radius" = half the pixel-space horizontal span of the eye contour
  // landmark 33 & 133 are the inner/outer corners of the right eye
  // landmark 362 & 263 are the inner/outer corners of the left eye
  const rRadius = Math.abs(faceLandmarks[133].x - faceLandmarks[33].x)  * vw / 2;
  const lRadius = Math.abs(faceLandmarks[263].x - faceLandmarks[362].x) * vw / 2;

  const rThresh = rRadius * COVER_RADIUS_FACTOR;
  const lThresh = lRadius * COVER_RADIUS_FACTOR;

  let rawRight = false;
  let rawLeft  = false;

  for (const lms of handLandmarks) {
    let rHits = 0, lHits = 0;
    for (const lm of lms) {
      const px = lm.x * vw;
      const py = lm.y * vh;
      if (_dist2d(px, py, rc.x, rc.y) < rThresh) rHits++;
      if (_dist2d(px, py, lc.x, lc.y) < lThresh) lHits++;
    }
    if (rHits >= MIN_COVER_HITS) rawRight = true;
    if (lHits >= MIN_COVER_HITS) rawLeft  = true;
  }

  // Ramp counters
  coverCounter.right = rawRight
    ? Math.min(coverCounter.right + COVER_RAMP_UP, COVER_MAX)
    : Math.max(coverCounter.right - COVER_RAMP_DOWN, 0);
  coverCounter.left  = rawLeft
    ? Math.min(coverCounter.left  + COVER_RAMP_UP, COVER_MAX)
    : Math.max(coverCounter.left  - COVER_RAMP_DOWN, 0);

  return _countersToResult();
}

/** Reset coverage counters — call when camera stops or resets. */
export function resetEyeCoverCounters() {
  coverCounter.right = 0;
  coverCounter.left  = 0;
}

/**
 * Compute pupil centers (iris centers) and Pupillary Distance.
 *
 * Returns null if landmarks are unavailable (need all 478 for iris data).
 *
 * @param {Array<{x,y,z}>} lms  — 478-point face landmarks
 * @param {number}         vw   — video pixel width
 * @param {number}         vh   — video pixel height
 * @returns {PupilData|null}
 */
export function computePupilData(lms, vw, vh) {
  // IMPORTANT: Iris landmarks (indices 468–477) are NOT explicitly documented
  // in the official MediaPipe Face Landmarker web API guide. They exist in the
  // current face_landmarker.task model (which bundles iris refinement) and
  // the total landmark count is 478, but Google does not guarantee these
  // indices will remain stable across model versions. We guard with length >= 478
  // and return null gracefully if they are absent, so PD/pupil features degrade
  // cleanly rather than crashing. Re-verify against the model changelog if you
  // update the .task file to a new version.
  if (!lms || lms.length < 478) return null;

  // Iris centers
  const ri = lms[468]; // right iris center
  const li = lms[473]; // left  iris center

  // Iris horizontal diameter: right-edge to left-edge cardinal points
  // Right iris: 469=right-edge, 471=left-edge
  // Left  iris: 474=right-edge, 476=left-edge
  const rDiam = _pixDist(lms[469], lms[471], vw, vh);
  const lDiam = _pixDist(lms[474], lms[476], vw, vh);
  const avgDiam = (rDiam + lDiam) / 2;

  // PD in pixel space (Euclidean, aspect-ratio-corrected)
  const pdPx = _pixDist(ri, li, vw, vh);

  // Estimated PD in mm using iris-diameter reference
  const pdMm = avgDiam > 0 ? (pdPx / avgDiam) * AVERAGE_IRIS_DIAMETER_MM : null;

  return {
    // Normalized landmark positions (same space as face/hand landmarks)
    rightPupil: { x: ri.x, y: ri.y },
    leftPupil:  { x: li.x, y: li.y },

    // Cardinal points for iris circle drawing (the 4 edge points around each iris)
    rightCardinals: [lms[469], lms[470], lms[471], lms[472]],
    leftCardinals:  [lms[474], lms[475], lms[476], lms[477]],

    // Measurements
    rightIrisDiamPx: rDiam,
    leftIrisDiamPx:  lDiam,
    pdPixels: pdPx,
    pdMm,
  };
}

/**
 * Compute the bounding region that covers BOTH eyes, sized to a target aspect
 * ratio (the PIP's AR) so the drawImage crop is distortion-free.
 *
 * @param {Array<{x,y,z}>} lms    — face landmarks
 * @param {number}         vw     — video pixel width
 * @param {number}         vh     — video pixel height
 * @param {number}         pipAR  — desired width/height ratio for the PIP
 * @returns {{ nx,ny,nw,nh }|null}  normalized [0,1] crop rect
 */
export function computeEyeRegion(lms, vw, vh, pipAR) {
  if (!lms?.length) return null;

  // Union bounding box of all eye contour landmarks
  const indices = [...RIGHT_EYE_CONTOUR, ...LEFT_EYE_CONTOUR];
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const i of indices) {
    const lm = lms[i];
    if (!lm) continue;
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }

  const fw = maxX - minX;
  const fh = maxY - minY;
  const cx = minX + fw / 2;
  const cy = minY + fh / 2;

  // Generous padding: eyes need more vertical room for eyelids/eyebrows
  let nw = fw * 2.4;
  let nh = fh * 5.0;

  // Expand whichever dimension is too small to match the PIP aspect ratio
  const cropAR = (nw * vw) / (nh * vh);
  if (cropAR > pipAR) {
    nh = (nw * vw) / (pipAR * vh);
  } else {
    nw = (nh * vh * pipAR) / vw;
  }

  // Center on the eye midpoint and clamp to [0, 1]
  let nx = cx - nw / 2;
  let ny = cy - nh / 2;
  nx = Math.max(0, Math.min(1 - nw, nx));
  ny = Math.max(0, Math.min(1 - nh, ny));
  nw = Math.min(nw, 1 - nx);
  nh = Math.min(nh, 1 - ny);

  return { nx, ny, nw, nh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera distance estimation (fully automatic, no calibration required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate camera-to-face distance using two independent biological references
 * cross-validated against each other via the pinhole camera model:
 *
 *   distance = (real_size_mm × focal_length_px) / measured_px
 *
 * References used:
 *   1. Iris diameter  — 11.7 mm avg, SD ~0.5 mm  (very consistent)
 *   2. Face width (bizygomatic, landmarks 234↔454) — 145 mm avg, SD ~8 mm
 *
 * Both are weighted by their pixel span (more pixels = less quantisation noise)
 * and by their biological consistency (iris is tighter, so it gets extra weight).
 *
 * Focal length is computed from the camera's estimated horizontal FOV
 * (detected automatically from the camera label/capabilities in camera.js).
 *
 * Expected accuracy:
 *   ±10–20% at 30–120 cm, depending on how well the FOV matches reality.
 *   The reading is most reliable when your face is centred and frontal.
 *
 * @param {import('./eyeAnalysis.js').PupilData|null} pupilData
 * @param {Array<{x,y,z}>|null}                      faceLandmarks
 * @param {number}                                   videoWidth   px
 * @param {number}                                   videoHeight  px
 * @param {number}                                   fovDeg       horizontal FOV in degrees
 * @returns {{ distanceCm:number, distanceMm:number, fovDeg:number, refs:string[] }|null}
 */
export function computeCameraDistance(pupilData, faceLandmarks, videoWidth, videoHeight, fovDeg = 70) {
  // Focal length from estimated FOV (pinhole camera model)
  const focalPx = videoWidth / (2 * Math.tan((fovDeg / 2) * Math.PI / 180));

  const estimates = []; // { distMm, weight }

  // ── Reference 1: Iris diameter ───────────────────────────────────────────
  // Most reliable biological ruler: iris varies only ~4% across adults.
  // Weight = pixel span × consistency factor (2.5×, since SD is tighter).
  if (pupilData) {
    const avgIrisPx = (pupilData.rightIrisDiamPx + pupilData.leftIrisDiamPx) / 2;
    if (avgIrisPx > 2) {
      const distMm = (AVERAGE_IRIS_DIAMETER_MM * focalPx) / avgIrisPx;
      estimates.push({ distMm, weight: avgIrisPx * 2.5, ref: "iris" });
    }
  }

  // ── Reference 2: Bizygomatic face width (landmarks 234 ↔ 454) ───────────
  // Spans many more pixels at normal distances → low quantisation noise.
  // More variable between people (~6% SD), so lower weight per pixel.
  // Only reliable when face is roughly frontal (|yaw| < ~20°).
  if (faceLandmarks && faceLandmarks.length > 454) {
    const lmL = faceLandmarks[234]; // left face edge
    const lmR = faceLandmarks[454]; // right face edge
    const faceWidthPx = Math.abs(lmL.x - lmR.x) * videoWidth;

    if (faceWidthPx > 20) {
      // Frontality check: if the face is turned, the face-width reading is
      // compressed and unreliable. Use the Y symmetry of the two cheek
      // landmarks as a rough yaw proxy — if they differ by > 5% of height,
      // skip this reference.
      const yDiffPx = Math.abs(lmL.y - lmR.y) * videoHeight;
      const yawOk   = yDiffPx < faceWidthPx * 0.12;

      if (yawOk) {
        const distMm = (FACE_WIDTH_MM * focalPx) / faceWidthPx;
        estimates.push({ distMm, weight: faceWidthPx * 1.0, ref: "face-width" });
      }
    }
  }

  if (estimates.length === 0) return null;

  // Weighted average
  const totalW  = estimates.reduce((s, e) => s + e.weight, 0);
  const avgDistMm = estimates.reduce((s, e) => s + e.distMm * e.weight, 0) / totalW;

  return {
    distanceCm: Math.round(avgDistMm / 10),
    distanceMm: Math.round(avgDistMm),
    fovDeg,
    refs: estimates.map(e => e.ref),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function _countersToResult() {
  return {
    rightCovered: coverCounter.right >= COVER_THRESHOLD,
    leftCovered:  coverCounter.left  >= COVER_THRESHOLD,
  };
}

function _eyeCenter(lms, indices, vw, vh) {
  let sx = 0, sy = 0;
  for (const i of indices) { sx += lms[i].x * vw; sy += lms[i].y * vh; }
  return { x: sx / indices.length, y: sy / indices.length };
}

function _dist2d(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function _pixDist(a, b, vw, vh) {
  return Math.sqrt(((a.x - b.x) * vw) ** 2 + ((a.y - b.y) * vh) ** 2);
}

/**
 * @typedef {Object} PupilData
 * @property {{ x:number, y:number }} rightPupil       normalized landmark position
 * @property {{ x:number, y:number }} leftPupil        normalized landmark position
 * @property {Array<{x,y,z}>}         rightCardinals   4 iris edge points (right)
 * @property {Array<{x,y,z}>}         leftCardinals    4 iris edge points (left)
 * @property {number}                 rightIrisDiamPx  right iris diameter in pixels
 * @property {number}                 leftIrisDiamPx   left iris diameter in pixels
 * @property {number}                 pdPixels         inter-pupil distance in pixels
 * @property {number|null}            pdMm             estimated PD in mm
 */
