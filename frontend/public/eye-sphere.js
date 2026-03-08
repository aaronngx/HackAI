// ─────────────────────────────────────────────────────────────────────────────
// eye-sphere.js  –  Eye-sphere locking, gaze direction, monitor plane,
//                   screen mapping.  Port of Python's eye-sphere model.
// ─────────────────────────────────────────────────────────────────────────────

import {
  v3add, v3sub, v3scale, v3normalize, v3dot, v3norm, v3cross,
  m3MulV3, m3transpose, computeScale, computePCA3,
} from '/math3d.js';

export { computePCA3, computeScale };

// ── Nose landmark indices (same as Python) ────────────────────────────────────
export const NOSE_IDX = [
  4,45,275,220,440,1,5,51,281,44,274,241,
  461,125,354,218,438,195,167,393,165,391,3,248,
];

// ── Extract 3-D nose points from MediaPipe face landmarks ─────────────────────
export function getNosePoints3d(lms, vw, vh) {
  return NOSE_IDX.map(i => [lms[i].x*vw, lms[i].y*vh, lms[i].z*vw]);
}

// ── Stabilise R against per-frame eigenvector sign-flips ─────────────────────
export function stabilizeR(R, Rref) {
  if (!Rref) return R;
  const S = R.map(row => [...row]);
  for (let col = 0; col < 3; col++) {
    const dot = R[0][col]*Rref[0][col] + R[1][col]*Rref[1][col] + R[2][col]*Rref[2][col];
    if (dot < 0) { S[0][col] *= -1; S[1][col] *= -1; S[2][col] *= -1; }
  }
  return S;
}

// ── Lock one eye sphere into the head-local frame ─────────────────────────────
// Returns a sphere object { localOffset, noseScale }
export function lockSphere(iris3d, headCenter, R, noseScale) {
  const RT = m3transpose(R);
  const raw = m3MulV3(RT, v3sub(iris3d, headCenter));
  // Push slightly toward camera (+Z in local frame) to sit on sphere surface
  const camDirLocal = m3MulV3(RT, [0, 0, 1]);
  const offset = v3add(raw, v3scale(camDirLocal, 20)); // 20 px depth offset
  return { localOffset: offset, noseScale };
}

// ── Reconstruct sphere world position from current head pose ──────────────────
export function getSphereWorld(sphere, headCenter, R, currentNoseScale) {
  const ratio = sphere.noseScale > 0 ? currentNoseScale / sphere.noseScale : 1;
  return v3add(headCenter, m3MulV3(R, v3scale(sphere.localOffset, ratio)));
}

// ── Gaze direction from sphere center toward iris ─────────────────────────────
export function gazeDir(iris3d, sphereWorld) {
  return v3normalize(v3sub(iris3d, sphereWorld));
}

// ── Ring-buffer for temporal smoothing ───────────────────────────────────────
export class GazeDeque {
  constructor(maxLen = 10) { this._buf = []; this._max = maxLen; }
  push(v) { this._buf.push(v); if (this._buf.length > this._max) this._buf.shift(); }
  avg() {
    if (!this._buf.length) return null;
    const s = [0,0,0];
    for (const v of this._buf) { s[0]+=v[0]; s[1]+=v[1]; s[2]+=v[2]; }
    const n = this._buf.length;
    return v3normalize([s[0]/n, s[1]/n, s[2]/n]);
  }
  get length() { return this._buf.length; }
  reset() { this._buf = []; }
}

// ── Port of Python's convert_gaze_to_screen_coordinates ──────────────────────
// Returns { sx, sy, rawYaw, rawPitch }
export function gazeToScreen(dir, offsetYaw, offsetPitch, screenW, screenH) {
  const YAW_RANGE = 15, PITCH_RANGE = 5;  // degrees to screen edge
  const d = v3normalize(dir);
  const ref = [0, 0, -1];

  // Yaw: angle in XZ plane
  const xz = v3normalize([d[0], 0, d[2]]);
  let yawRad = Math.acos(Math.max(-1, Math.min(1, xz[0]*ref[0] + xz[2]*ref[2])));
  if (d[0] < 0) yawRad = -yawRad;

  // Pitch: angle in YZ plane
  const yz = v3normalize([0, d[1], d[2]]);
  let pitchRad = Math.acos(Math.max(-1, Math.min(1, yz[1]*ref[1] + yz[2]*ref[2])));
  if (d[1] > 0) pitchRad = -pitchRad;

  let yawDeg   = yawRad   * 180 / Math.PI;
  let pitchDeg = pitchRad * 180 / Math.PI;
  yawDeg = -yawDeg; // match Python sign convention

  const rawYaw = yawDeg, rawPitch = pitchDeg;
  yawDeg   += offsetYaw;
  pitchDeg += offsetPitch;

  const sx = ((yawDeg   + YAW_RANGE)   / (2 * YAW_RANGE))   * screenW;
  const sy = ((PITCH_RANGE - pitchDeg) / (2 * PITCH_RANGE)) * screenH;

  return {
    sx: Math.max(10, Math.min(screenW - 10, Math.round(sx))),
    sy: Math.max(10, Math.min(screenH - 10, Math.round(sy))),
    rawYaw, rawPitch,
  };
}

// ── Create 3-D monitor plane (60 cm × 40 cm) 50 cm in front of face ──────────
// Returns { corners:[p0,p1,p2,p3], center, normal, upc }
export function createMonitorPlane(headCenter, R, faceLms, vw, vh, forwardHint, gazeOrigin, gazeDir_) {
  // Scale from chin (152) ↔ forehead (10) distance  (≈15 cm)
  const chin = faceLms[152], fore = faceLms[10];
  const chinW = [chin.x*vw, chin.y*vh, chin.z*vw];
  const foreW = [fore.x*vw, fore.y*vh, fore.z*vw];
  const upc = v3norm(v3sub(foreW, chinW)) / 15; // units per cm

  const halfW = 30 * upc, halfH = 20 * upc; // 60 cm wide, 40 cm tall

  // Head forward = −Z column of R
  let headFwd = forwardHint || v3normalize([-R[0][2], -R[1][2], -R[2][2]]);

  // Place center: intersect gaze ray with plane at 50 cm if available
  let centerW;
  if (gazeOrigin && gazeDir_) {
    const planePoint = v3add(headCenter, v3scale(headFwd, 50*upc));
    const denom = v3dot(headFwd, gazeDir_);
    if (Math.abs(denom) > 1e-6) {
      const t = v3dot(headFwd, v3sub(planePoint, gazeOrigin)) / denom;
      centerW = v3add(gazeOrigin, v3scale(gazeDir_, t));
    } else {
      centerW = v3add(headCenter, v3scale(headFwd, 50*upc));
    }
  } else {
    centerW = v3add(headCenter, v3scale(headFwd, 50*upc));
  }

  const worldUp  = [0, -1, 0];
  const headRight = v3normalize(v3cross(worldUp, headFwd));
  const headUp    = v3normalize(v3cross(headFwd, headRight));

  const p0 = v3sub(v3sub(centerW, v3scale(headRight, halfW)), v3scale(headUp, halfH)); // TL
  const p1 = v3sub(v3add(centerW, v3scale(headRight, halfW)), v3scale(headUp, halfH)); // TR
  const p2 = v3add(v3add(centerW, v3scale(headRight, halfW)), v3scale(headUp, halfH)); // BR
  const p3 = v3add(v3sub(centerW, v3scale(headRight, halfW)), v3scale(headUp, halfH)); // BL

  return { corners: [p0,p1,p2,p3], center: centerW, normal: headFwd, upc };
}
