// ─────────────────────────────────────────────────────────────────────────────
// face-eye-tracker.js
// Face mesh drawing, iris/eye contours, gaze estimation, EAR, PD, distance,
// zoom crop, and gaze calibration (polynomial least-squares).
// ─────────────────────────────────────────────────────────────────────────────

// ── Landmark index constants ──────────────────────────────────────────────────
export const FACE_OVAL = [
  10,338,297,332,284,251,389,356,454,323,361,288,
  397,365,379,378,400,377,152,148,176,149,150,136,
  172,58,132,93,234,127,162,21,54,103,67,109
];
export const R_EYE_CONTOUR = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
export const L_EYE_CONTOUR = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
export const R_EAR_IDX = [33,160,158,133,153,144];
export const L_EAR_IDX = [362,385,387,263,373,380];
export const NOSE_IDX   = [4,45,275,220,440,1,5,51,281,44,274,241,461,125,354,218,438,195,167,393,165,391,3,248];

// ── Helpers ───────────────────────────────────────────────────────────────────
export function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(prev, next, a = 0.1) {
  if (!prev) return { ...next };
  return {
    nx: prev.nx + (next.nx - prev.nx) * a,
    ny: prev.ny + (next.ny - prev.ny) * a,
    nw: prev.nw + (next.nw - prev.nw) * a,
    nh: prev.nh + (next.nh - prev.nh) * a,
  };
}

/**
 * Returns a landmark → canvas-pixel transform function.
 * When crop is provided, maps the cropped sub-region to fill the canvas.
 * Always mirrors horizontally (selfie view).
 */
export function toScreen(crop, cw, ch) {
  if (!crop) return lm => ({ x: (1 - lm.x) * cw, y: lm.y * ch });
  return lm => ({
    x: (1 - (lm.x - crop.nx) / crop.nw) * cw,
    y: ((lm.y - crop.ny) / crop.nh) * ch,
  });
}

/**
 * Compute a tight crop rect around the face with padding, maintaining
 * the canvas aspect ratio.
 */
export function faceBBox(lms, cw, ch) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const l of lms) {
    if (l.x < minX) minX = l.x; if (l.x > maxX) maxX = l.x;
    if (l.y < minY) minY = l.y; if (l.y > maxY) maxY = l.y;
  }
  const fw = maxX - minX, fh = maxY - minY;
  const cx = minX + fw / 2, cy = minY + fh / 2;
  const PAD = 0.35;
  let nw = fw * (1 + 2 * PAD), nh = fh * (1 + 2 * PAD);
  const ar = cw / ch;
  if (nw * cw / (nh * ch) > ar) nh = nw * cw / (ar * ch);
  else nw = nh * ch * ar / cw;
  const nx = Math.max(0, Math.min(1 - nw, cx - nw / 2));
  const ny = Math.max(0, Math.min(1 - nh, cy - nh / 2));
  return { nx, ny, nw: Math.min(nw, 1 - nx), nh: Math.min(nh, 1 - ny) };
}

// ── Eye Aspect Ratio (EAR) ────────────────────────────────────────────────────
export function computeEAR(lms, idx) {
  const p = i => lms[idx[i]];
  const n = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  return (n(p(1), p(5)) + n(p(2), p(4))) / (2 * n(p(0), p(3)));
}

// ── Pupillary distance & face distance ───────────────────────────────────────
export function computePD(lms, vw, vh) {
  if (!lms[468] || !lms[473]) return null;
  const pdPx = Math.hypot(
    (lms[473].x - lms[468].x) * vw,
    (lms[473].y - lms[468].y) * vh
  );
  const IRIS_REAL_MM = 11.7, ASSUMED_FOV = 60;
  const irisPx = Math.hypot(
    (lms[469].x - lms[471].x) * vw,
    (lms[469].y - lms[471].y) * vh
  ) / 2;
  const pdMm = irisPx > 0 ? (pdPx / irisPx) * (IRIS_REAL_MM / 2) : null;
  const focalPx = vw / (2 * Math.tan(ASSUMED_FOV * Math.PI / 360));
  const IPD_MM = 63;
  const distCm = pdPx > 0 ? (IPD_MM * focalPx) / (pdPx * 10) : null;
  return { pdPx, pdMm, distCm };
}

// ── Head gaze estimate (iris vs nose-tip) ─────────────────────────────────────
export function computeHeadGaze(lms) {
  const rIris = lms[468], lIris = lms[473];
  if (!rIris || !lIris) return null;
  const eyeMidX = (rIris.x + lIris.x) / 2;
  const eyeMidY = (rIris.y + lIris.y) / 2;
  const nose = lms[4];
  return {
    yaw:   -(eyeMidX - nose.x) * 180,
    pitch: -(eyeMidY - nose.y) * 180,
  };
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
export function drawFace(ctx, lms, ts, cw) {
  // Face oval
  ctx.beginPath(); ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
  FACE_OVAL.forEach((i, k) => {
    const p = ts(lms[i]);
    k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.closePath(); ctx.stroke();

  // Right eye contour
  ctx.beginPath(); ctx.strokeStyle = '#44AAFF'; ctx.lineWidth = 1.2;
  R_EYE_CONTOUR.forEach((i, k) => {
    const p = ts(lms[i]);
    k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.closePath(); ctx.stroke();

  // Left eye contour
  ctx.beginPath(); ctx.strokeStyle = '#FF44AA'; ctx.lineWidth = 1.2;
  L_EYE_CONTOUR.forEach((i, k) => {
    const p = ts(lms[i]);
    k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.closePath(); ctx.stroke();

  // Right iris circle
  if (lms[468] && lms[469] && lms[471]) {
    const rp = ts(lms[468]);
    const rr = dist2d(lms[469], lms[471]) / 2;
    ctx.beginPath(); ctx.strokeStyle = '#44AAFF'; ctx.lineWidth = 2;
    ctx.arc(rp.x, rp.y, rr * cw, 0, Math.PI * 2); ctx.stroke();
  }

  // Left iris circle
  if (lms[473] && lms[474] && lms[476]) {
    const lp = ts(lms[473]);
    const lr = dist2d(lms[474], lms[476]) / 2;
    ctx.beginPath(); ctx.strokeStyle = '#FF44AA'; ctx.lineWidth = 2;
    ctx.arc(lp.x, lp.y, lr * cw, 0, Math.PI * 2); ctx.stroke();
  }
}

// ── Calibration (polynomial least-squares) ───────────────────────────────────
export function polyBasis(u, v) { return [1, u, v, u * v, u * u, v * v]; }
export function evalPoly(coeffs, basis) {
  return coeffs.reduce((s, c, i) => s + c * basis[i], 0);
}

export function leastSquares(A, b) {
  const N = A.length, M = A[0].length;
  const ATA = Array.from({ length: M }, () => new Array(M).fill(0));
  const ATb = new Array(M).fill(0);
  for (let i = 0; i < N; i++) {
    for (let r = 0; r < M; r++) {
      ATb[r] += A[i][r] * b[i];
      for (let c = 0; c < M; c++) ATA[r][c] += A[i][r] * A[i][c];
    }
  }
  const aug = ATA.map((row, r) => [...row, ATb[r]]);
  for (let col = 0; col < M; col++) {
    let maxRow = col;
    for (let row = col + 1; row < M; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const piv = aug[col][col];
    if (Math.abs(piv) < 1e-12) throw new Error('Singular matrix');
    for (let row = col + 1; row < M; row++) {
      const f = aug[row][col] / piv;
      for (let k = col; k <= M; k++) aug[row][k] -= f * aug[col][k];
    }
  }
  const x = new Array(M);
  for (let row = M - 1; row >= 0; row--) {
    x[row] = aug[row][M];
    for (let col = row + 1; col < M; col++) x[row] -= aug[row][col] * x[col];
    x[row] /= aug[row][row];
  }
  return x;
}
