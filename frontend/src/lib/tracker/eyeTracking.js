/**
 * eyeTracking.js — Webcam gaze estimation matching the reference algorithm.
 *
 * Full pipeline (matches JEOresearch/EyeTracker – MonitorTracking.py):
 *
 *   1.  Nose-area PCA  →  stable 3D head coordinate frame (rotation matrix R)
 *         • Extract ~24 nose-region landmarks in pixel-3D
 *         • Compute 3×3 covariance matrix
 *         • Jacobi eigendecomposition → 3 principal axes
 *         • Sort axes by descending eigenvalue
 *
 *   2.  Sign stabilization
 *         • At calibration: save R_ref (current eigenvectors)
 *         • Every frame: flip any axis whose dot with R_ref < 0
 *         • Prevents inter-frame sign ambiguity of PCA axes
 *
 *   3.  Nose scale  →  head-distance compensation
 *         • scale = mean distance of nose pts from nose centroid
 *         • scale_ratio = current_scale / calibration_scale
 *         • Applied to sphere-local offset each frame
 *
 *   4.  Eye sphere centers  (ONE-TIME during calibration)
 *         • sphere_local = R × (iris_world − head_center)
 *                        + BASE_RADIUS × camera_dir_local
 *         • BASE_RADIUS pushes the sphere back along the camera direction
 *           to approximate the anatomical eyeball center behind the cornea
 *
 *   5.  Sphere reconstruction (every frame)
 *         • sphere_world = head_center + Rᵀ × (sphere_local × scale_ratio)
 *
 *   6.  Gaze rays
 *         • dir = normalize(iris_world − sphere_world)   per eye
 *
 *   7.  Binocular fusion
 *         • combined = normalize(dir_L + dir_R)
 *         • Simple direction averaging (matches reference; ray intersection
 *           is only used for the 3D monitor visualization)
 *
 *   8.  Temporal smoothing
 *         • Deque of SMOOTH_LEN recent combined directions
 *         • Output = normalize(mean of all buffered directions)
 *
 *   9.  Head-local gaze angles
 *         • gaze_head = R × smoothed_dir_world
 *         • yaw   = atan2(gaze_head.x,  gaze_head.z)
 *         • pitch = atan2(-gaze_head.y, gaze_head.z)
 *
 *   10. Virtual monitor plane (3D visualization only)
 *         • Placed at face_depth + 3.5 × face_width forward
 *         • Ray-plane intersection for the overlay crosshair
 *         • Cursor position driven by yaw/pitch → 9-point polynomial
 *
 * Coordinate conventions (pixel 3D):
 *   x = lm.x × vw,  y = lm.y × vh,  z = lm.z × vw
 *   z increases away from the camera.
 */

import { RIGHT_EYE_CONTOUR, LEFT_EYE_CONTOUR } from "./draw.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Iris landmark indices (undocumented but stable). */
const IRIS_R = 468;
const IRIS_L = 473;

/** Nose-area landmarks for PCA head-pose estimation.
 *  Chosen to be stable and minimally affected by eye/mouth movement. */
const NOSE_LMS = [
   1,   2,   5,   6,  19,  48,  64,  94,  98, 102,
 115, 131, 141, 168, 195, 197, 220, 237, 275, 278,
 294, 327, 344, 370, 440, 457,
];

/** Bizygomatic landmarks for virtual monitor sizing. */
const LM_LEFT_CHEEK  = 234;
const LM_RIGHT_CHEEK = 454;

/** Eyeball-center pushback behind the iris (pixel units).
 *  Approximates anatomical eyeball-center depth behind the cornea. */
const BASE_RADIUS = 20;

/** Temporal smoothing: number of frames to average. */
const SMOOTH_LEN = 10;

// ── Module state ──────────────────────────────────────────────────────────────

let _R_ref         = null;   // eigenvector rows captured at calibration (sign reference)
let _sphereLocalR  = null;   // right eye sphere offset in head-local coords
let _sphereLocalL  = null;
let _noseScaleRef  = null;   // nose point spread at calibration time

const _gazeBuffer  = [];     // deque of recent combined gaze directions

// ── Vector math (pixel 3D objects {x,y,z}) ───────────────────────────────────

const add3   = (a, b) => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z });
const sub3   = (a, b) => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });
const scale3 = (v, s) => ({ x: v.x*s,   y: v.y*s,   z: v.z*s   });
const dot3   = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z;
const len3   = (v)    => Math.sqrt(dot3(v, v));
const norm3  = (v)    => { const l = len3(v); return l < 1e-9 ? {x:0,y:0,z:1} : scale3(v,1/l); };

function mean3(pts) {
  const s = { x:0, y:0, z:0 };
  for (const p of pts) { s.x += p.x; s.y += p.y; s.z += p.z; }
  return scale3(s, 1 / pts.length);
}

// ── Rotation matrix helpers (rows = eigenvectors) ─────────────────────────────
// R  transforms world → head-local:  mulR(R,  v)
// Rᵀ transforms head-local → world:  mulRT(R, v)

/** R × v  (world → head-local) */
function mulR(rows, v) {
  return {
    x: rows[0][0]*v.x + rows[0][1]*v.y + rows[0][2]*v.z,
    y: rows[1][0]*v.x + rows[1][1]*v.y + rows[1][2]*v.z,
    z: rows[2][0]*v.x + rows[2][1]*v.y + rows[2][2]*v.z,
  };
}

/** Rᵀ × v  (head-local → world) */
function mulRT(rows, v) {
  return {
    x: rows[0][0]*v.x + rows[1][0]*v.y + rows[2][0]*v.z,
    y: rows[0][1]*v.x + rows[1][1]*v.y + rows[2][1]*v.z,
    z: rows[0][2]*v.x + rows[1][2]*v.y + rows[2][2]*v.z,
  };
}

// ── Landmark conversion ───────────────────────────────────────────────────────

function toLm3D(lm, vw, vh) {
  return { x: lm.x * vw, y: lm.y * vh, z: lm.z * vw };
}

// ── Jacobi eigendecomposition for 3×3 symmetric matrix ───────────────────────

/**
 * Compute eigenvalues and eigenvectors of a 3×3 symmetric matrix S.
 * S is represented as [[a,b,c],[b,d,e],[c,e,f]] (array of rows).
 *
 * Uses the Jacobi method: iteratively zeroes the largest off-diagonal element
 * with a Givens rotation until all off-diagonal elements are < TOL.
 *
 * Returns { values:[λ0,λ1,λ2], vectors:[[v00..],[v10..],[v20..]] }
 * sorted by DESCENDING eigenvalue (largest variance axis first).
 */
function jacobi3(S) {
  // Working copy
  const A = S.map(r => [...r]);
  // Eigenvector matrix starts as identity (columns = eigenvectors)
  const V = [[1,0,0],[0,1,0],[0,0,1]];

  const TOL = 1e-12;

  for (let iter = 0; iter < 100; iter++) {
    // Find largest off-diagonal |A[p][q]|
    let maxV = 0, p = 0, q = 1;
    for (let i = 0; i < 2; i++) {
      for (let j = i+1; j < 3; j++) {
        if (Math.abs(A[i][j]) > maxV) { maxV = Math.abs(A[i][j]); p = i; q = j; }
      }
    }
    if (maxV < TOL) break;

    // Compute Givens rotation angle (stable formula)
    const phi = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t   = (phi >= 0 ? 1 : -1) / (Math.abs(phi) + Math.sqrt(phi*phi + 1));
    const c   = 1 / Math.sqrt(1 + t*t);
    const s   = t * c;
    const tau = s / (1 + c);

    // Update A:  A' = Gᵀ A G
    const Apq = A[p][q];
    A[p][p] -= t * Apq;
    A[q][q] += t * Apq;
    A[p][q] = A[q][p] = 0;

    for (let r = 0; r < 3; r++) {
      if (r !== p && r !== q) {
        const Arp = A[r][p], Arq = A[r][q];
        A[r][p] = A[p][r] = Arp - s*(Arq + tau*Arp);
        A[r][q] = A[q][r] = Arq + s*(Arp - tau*Arq);
      }
    }

    // Accumulate eigenvectors:  V' = V G
    for (let r = 0; r < 3; r++) {
      const Vrp = V[r][p], Vrq = V[r][q];
      V[r][p] = Vrp - s*(Vrq + tau*Vrp);
      V[r][q] = Vrq + s*(Vrp - tau*Vrq);
    }
  }

  // Eigenvalues = diagonal of A.  Eigenvectors = columns of V (→ rows after transpose).
  const vals = [A[0][0], A[1][1], A[2][2]];
  const vecs = [
    [V[0][0], V[1][0], V[2][0]],  // eigenvector 0 (column 0 of V)
    [V[0][1], V[1][1], V[2][1]],  // eigenvector 1
    [V[0][2], V[1][2], V[2][2]],  // eigenvector 2
  ];

  // Sort by descending eigenvalue
  const order = [0,1,2].sort((a,b) => vals[b] - vals[a]);
  return {
    values:  order.map(i => vals[i]),
    vectors: order.map(i => vecs[i]),  // each row = one eigenvector
  };
}

// ── PCA head coordinate frame from nose landmarks ─────────────────────────────

/**
 * Compute head orientation (R) and nose centroid from nose-area landmarks.
 *
 * Steps:
 *   1. Extract NOSE_LMS in pixel-3D, compute centroid.
 *   2. Centre the points and build 3×3 covariance matrix.
 *   3. Jacobi eigendecomposition → 3 principal axes.
 *   4. vectors[0] = largest variance (≈ face width, left–right)
 *      vectors[1] = medium variance (≈ face height, up–down)
 *      vectors[2] = smallest variance (≈ nose depth / forward)
 *
 * @returns {{ R: number[][], center: {x,y,z}, scale: number }}
 *   R      — 3×3 rotation matrix (rows = eigenvectors); mulR(R,v) = world→head-local
 *   center — nose centroid in pixel-3D
 *   scale  — mean distance of nose pts from centroid (used for distance compensation)
 */
function computeHeadPose(lms, vw, vh) {
  const pts    = NOSE_LMS.map(i => toLm3D(lms[i], vw, vh));
  const center = mean3(pts);

  // Centre
  const cx = pts.map(p => [p.x - center.x, p.y - center.y, p.z - center.z]);

  // 3×3 covariance matrix  C = Σ xᵢ xᵢᵀ / N
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (const v of cx) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C[i][j] += v[i] * v[j];
      }
    }
  }
  const n = cx.length;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] /= n;

  const { vectors } = jacobi3(C);

  // Nose scale = mean distance of pts from centroid (head-size proxy)
  const scale = cx.reduce((s, v) => s + Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2), 0) / n;

  return { R: vectors, center, scale };
}

/**
 * Stabilize eigenvector signs by comparing with a stored reference frame.
 * If the dot product of an axis with its reference is negative, flip it.
 * This prevents the random ±1 sign flip that PCA produces each frame.
 */
function stabilizeR(R) {
  if (!_R_ref) return R;
  return R.map((v, i) => {
    const ref = _R_ref[i];
    const d   = v[0]*ref[0] + v[1]*ref[1] + v[2]*ref[2];
    return d < 0 ? [-v[0], -v[1], -v[2]] : v;
  });
}

// ── Ray-plane intersection ────────────────────────────────────────────────────

function rayPlaneIntersect(origin, dir, planeZ) {
  if (Math.abs(dir.z) < 1e-6) return null;
  const t = (planeZ - origin.z) / dir.z;
  if (t < 0.01) return null;
  return add3(origin, scale3(dir, t));
}

// ── Public: eye sphere locking ────────────────────────────────────────────────

/**
 * Lock eye sphere centers in head-local coordinates.
 *
 * Called ONCE at the start of calibration (while user looks straight ahead).
 *
 * sphere_local = R × (iris_world − nose_center)
 *              + BASE_RADIUS × camera_dir_local
 *
 * BASE_RADIUS pushes the computed center backward along the camera-view
 * direction, approximating the anatomical eyeball center behind the cornea.
 *
 * The reference nose_scale is saved for frame-by-frame distance adaptation.
 *
 * @returns {boolean} true on success
 */
export function lockEyeSpheres(faceLandmarks, vw, vh) {
  if (!faceLandmarks || faceLandmarks.length < 478) return false;

  const { R, center, scale } = computeHeadPose(faceLandmarks, vw, vh);
  const stableR = stabilizeR(R);

  // Save reference frame (sign stabilization) and nose scale
  _R_ref        = stableR;
  _noseScaleRef = scale;

  const irisR = toLm3D(faceLandmarks[IRIS_R], vw, vh);
  const irisL = toLm3D(faceLandmarks[IRIS_L], vw, vh);

  // Camera forward direction in head-local space: R × (0,0,1) = R column 2
  // as an {x,y,z} object
  const camLocal = { x: stableR[0][2], y: stableR[1][2], z: stableR[2][2] };

  // Raw iris offset in head-local, then push back by BASE_RADIUS
  const rawR = mulR(stableR, sub3(irisR, center));
  const rawL = mulR(stableR, sub3(irisL, center));

  _sphereLocalR = add3(rawR, scale3(camLocal, BASE_RADIUS));
  _sphereLocalL = add3(rawL, scale3(camLocal, BASE_RADIUS));

  console.info("[eyeTracking] Spheres locked. noseScale:", scale.toFixed(2),
    "ΔR:", _sphereLocalR, "ΔL:", _sphereLocalL);
  return true;
}

export function hasLockedSpheres() {
  return _sphereLocalR !== null && _sphereLocalL !== null;
}

export function clearLockedSpheres() {
  _sphereLocalR  = null;
  _sphereLocalL  = null;
  _R_ref         = null;
  _noseScaleRef  = null;
  _gazeBuffer.length = 0;
}

// ── Public: per-frame gaze computation ───────────────────────────────────────

/**
 * @typedef {Object} GazeResult
 * @property {number}        yaw           head-local horizontal angle (°, +right)
 * @property {number}        pitch         head-local vertical angle (°, +up)
 * @property {{x,y,z}}      eyeOriginL    left sphere center (pixel 3D)
 * @property {{x,y,z}}      eyeOriginR    right sphere center (pixel 3D)
 * @property {{x,y,z}}      irisL         left iris center (pixel 3D)
 * @property {{x,y,z}}      irisR         right iris center (pixel 3D)
 * @property {{x,y,z}}      gazeOrigin    midpoint between sphere centers
 * @property {{x,y,z}}      gazeDirWorld  smoothed combined gaze direction (world)
 * @property {{x,y,z}|null} monitorHit    ray-plane intersection (visualization)
 * @property {{x,y,z}}      monitorCenter virtual monitor center
 * @property {number}        monitorW
 * @property {number}        monitorH
 * @property {boolean}       spheresLocked
 */

/**
 * Compute gaze angles and 3D geometry for one video frame.
 *
 * @param {Array<{x,y,z}>} faceLandmarks  478-pt face mesh
 * @param {number} vw
 * @param {number} vh
 * @returns {GazeResult|null}
 */
export function computeGaze(faceLandmarks, _unused, vw, vh) {
  if (!faceLandmarks || faceLandmarks.length < 478) return null;

  // 1. PCA head coordinate frame from nose landmarks
  const { R: rawR, center: noseCenter, scale: noseScale } = computeHeadPose(faceLandmarks, vw, vh);
  const R = stabilizeR(rawR);   // sign-stabilized eigenvectors (rows = axes)

  // 2. Nose scale ratio for distance compensation
  const scaleRatio = (_noseScaleRef && _noseScaleRef > 1e-6)
    ? noseScale / _noseScaleRef
    : 1.0;

  // 3. Iris centers
  const irisR = toLm3D(faceLandmarks[IRIS_R], vw, vh);
  const irisL = toLm3D(faceLandmarks[IRIS_L], vw, vh);

  // 4. Eye sphere centers
  //    Locked spheres: reconstruct world position by Rᵀ × (sphere_local × scale_ratio)
  //    Fallback:       use eye-contour mean (biased but works before calibration)
  let orbitR, orbitL;
  if (hasLockedSpheres()) {
    orbitR = add3(noseCenter, mulRT(R, scale3(_sphereLocalR, scaleRatio)));
    orbitL = add3(noseCenter, mulRT(R, scale3(_sphereLocalL, scaleRatio)));
  } else {
    // Pre-calibration fallback: mean of eye contour (informative for visualisation)
    orbitR = mean3(RIGHT_EYE_CONTOUR.map(i => toLm3D(faceLandmarks[i], vw, vh)));
    orbitL = mean3(LEFT_EYE_CONTOUR .map(i => toLm3D(faceLandmarks[i], vw, vh)));
  }

  // 5. Per-eye gaze directions (world space)
  const dirR = norm3(sub3(irisR, orbitR));
  const dirL = norm3(sub3(irisL, orbitL));

  // 6. Binocular fusion: simple average (matches reference)
  const fused = norm3(add3(dirR, dirL));

  // 7. Temporal smoothing: deque moving average
  _gazeBuffer.push(fused);
  if (_gazeBuffer.length > SMOOTH_LEN) _gazeBuffer.shift();
  const smoothed = norm3(mean3(_gazeBuffer));

  // 8. Head-local gaze angles
  //    R × world_dir = head-local dir
  const gazeHead = mulR(R, smoothed);
  const yaw   =  Math.atan2(gazeHead.x,  gazeHead.z) * (180 / Math.PI);
  const pitch  =  Math.atan2(-gazeHead.y, gazeHead.z) * (180 / Math.PI);

  // 9. Virtual monitor plane (for 3D visualization overlay)
  const gazeOrigin = scale3(add3(orbitR, orbitL), 0.5);
  const faceWidthPx = len3(sub3(
    toLm3D(faceLandmarks[LM_RIGHT_CHEEK], vw, vh),
    toLm3D(faceLandmarks[LM_LEFT_CHEEK],  vw, vh),
  ));
  const monitorDist   = faceWidthPx * 3.5;
  const monitorW      = faceWidthPx * 6.0;
  const monitorH      = monitorW * (vh / vw);
  const monitorZ      = gazeOrigin.z + monitorDist;
  const monitorCenter = { x: vw / 2, y: vh / 2, z: monitorZ };
  const monitorHit    = rayPlaneIntersect(gazeOrigin, smoothed, monitorZ);

  return {
    yaw, pitch,
    eyeOriginL:   orbitL,
    eyeOriginR:   orbitR,
    irisL, irisR,
    gazeOrigin,
    gazeDirWorld: smoothed,
    monitorHit,
    monitorCenter,
    monitorW,
    monitorH,
    spheresLocked: hasLockedSpheres(),
  };
}

/** Reset temporal smoothing buffer (call on camera stop). */
export function resetGazeSmoothing() {
  _gazeBuffer.length = 0;
}
