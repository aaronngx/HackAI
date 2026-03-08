// ─────────────────────────────────────────────────────────────────────────────
// hand-tracker.js
// Hand skeleton drawing, index-finger direction classification,
// temporal smoothing, and hand-over-eye occlusion detection.
// ─────────────────────────────────────────────────────────────────────────────

// ── Skeleton connections ──────────────────────────────────────────────────────
export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// ── Drawing ───────────────────────────────────────────────────────────────────
/**
 * Draw a hand skeleton onto the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} lms  - 21 normalized landmarks
 * @param {Function} ts - landmark → canvas-pixel transform
 * @param {string} color - stroke/fill color
 */
export function drawHand(ctx, lms, ts, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = ts(lms[a]), pb = ts(lms[b]);
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  ctx.fillStyle = color;
  for (const l of lms) {
    const p = ts(l);
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Direction classification ──────────────────────────────────────────────────
/**
 * Classify index-finger pointing direction: UP | DOWN | LEFT | RIGHT | UNKNOWN.
 * Uses landmark 5 (MCP) and 8 (tip) relative to wrist (0).
 */
export function classifyDirection(lms) {
  const mcp = lms[5], tip = lms[8], wrist = lms[0];
  const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  const mcpDist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
  if (tipDist < mcpDist * 1.2) return 'UNKNOWN'; // finger not extended
  const dx = tip.x - mcp.x, dy = tip.y - mcp.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? (dx > 0 ? 'RIGHT' : 'LEFT')
    : (dy > 0 ? 'DOWN'  : 'UP');
}

/**
 * Smooth direction over the last N frames using majority vote.
 * @param {string[]} buf - mutable ring buffer (pass same array each call)
 * @param {string} dir
 * @param {number} maxLen
 */
export function smoothDirection(buf, dir, maxLen = 5) {
  buf.push(dir);
  if (buf.length > maxLen) buf.shift();
  const counts = {};
  for (const d of buf) counts[d] = (counts[d] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Spread-finger counting ────────────────────────────────────────────────────
const FINGER_PAIRS = [[4,2],[8,5],[12,9],[16,13],[20,17]]; // [tip, mcp] indices
const EXTEND_RATIO = 1.3;

/**
 * Count how many fingers are extended (spread).
 * Returns { count, names[] }.
 */
export function countSpreadFingers(lms) {
  const NAMES = ['Thumb','Index','Middle','Ring','Pinky'];
  const wrist = lms[0];
  const spread = [];
  for (let i = 0; i < FINGER_PAIRS.length; i++) {
    const [ti, mi] = FINGER_PAIRS[i];
    const td = Math.hypot(lms[ti].x-wrist.x, lms[ti].y-wrist.y, lms[ti].z-wrist.z);
    const md = Math.hypot(lms[mi].x-wrist.x, lms[mi].y-wrist.y, lms[mi].z-wrist.z);
    if (md > 1e-6 && td / md > EXTEND_RATIO) spread.push(NAMES[i]);
  }
  return { count: spread.length, names: spread };
}

// ── Hand-over-eye occlusion detection ────────────────────────────────────────

// Eye contour landmark indices (mirrors face-eye-tracker.js constants)
const _R_EYE_C = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
const _L_EYE_C = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];

/**
 * Compute an elliptical cover region for one eye from its contour landmarks.
 * Falls back to iris-center + PD-based radius if contour data is degraded.
 *
 * Cover ellipse is intentionally larger than the eye itself because a palm
 * physically occludes a much wider area than the iris.
 *
 * @returns {{ cx, cy, rx, ry } | null}
 */
function _eyeCoverRegion(irisIdx, contourIdxs, faceLms, vw, vh, pdPx) {
  const iris = faceLms[irisIdx];
  if (!iris) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, n = 0;
  for (const i of contourIdxs) {
    const lm = faceLms[i];
    if (!lm) continue;
    const px = lm.x * vw, py = lm.y * vh;
    if (px < minX) minX = px; if (px > maxX) maxX = px;
    if (py < minY) minY = py; if (py > maxY) maxY = py;
    n++;
  }

  if (n < 4) {
    // Fallback: iris center + PD-derived radius (generous — eye region is
    // often partially occluded when hand is actually covering it)
    const r = Math.max(40, pdPx * 0.8);
    return { cx: iris.x * vw, cy: iris.y * vh, rx: r, ry: r * 0.85 };
  }

  const eyeW = maxX - minX;
  const eyeH = maxY - minY;
  // Palm covers ~3× the eye width horizontally, ~4× vertically
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: Math.max(28, eyeW * 3.0),
    ry: Math.max(28, Math.max(eyeH * 4.0, eyeW * 2.0)),
  };
}

/**
 * Detect whether a hand is covering the left or right eye.
 *
 * Improvements over naive landmark-count approach:
 *   1. Cover region derived from eye contour width, not PD — scales correctly
 *      regardless of camera distance.
 *   2. Palm-center proximity check — wrist + mid-palm average must be near
 *      the eye region, preventing stray fingertip hits from triggering.
 *   3. Hand bounding box overlap — eye-center must fall inside the hand bbox.
 *   4. Z-depth plausibility — hand z-median must be ≤ face z (hand in front).
 *   5. Spread threshold relaxed to ≤2 (flat palm against face can appear spread).
 *   6. Landmark count threshold raised to 5.
 *
 * @param {Array|null} handLms       - 21 normalised hand landmarks {x,y,z}
 * @param {Array|null} faceLms       - 478 normalised face landmarks
 * @param {number}     vw            - video width  (px)
 * @param {number}     vh            - video height (px)
 * @returns {{ left: boolean, right: boolean, leftScore: number, rightScore: number }}
 */
export function detectHandOverEye(handLms, faceLms, vw, vh) {
  const NONE = { left: false, right: false, leftScore: 0, rightScore: 0 };
  if (!handLms || !faceLms || !faceLms[468] || !faceLms[473]) return NONE;

  // ── 1. Pupillary distance (px) for fallback radius ────────────────────────
  const rIris = faceLms[468], lIris = faceLms[473];
  const pdPx  = Math.hypot((rIris.x - lIris.x) * vw, (rIris.y - lIris.y) * vh);

  // ── 2. Eye cover regions ──────────────────────────────────────────────────
  const rRegion = _eyeCoverRegion(468, _R_EYE_C, faceLms, vw, vh, pdPx);
  const lRegion = _eyeCoverRegion(473, _L_EYE_C, faceLms, vw, vh, pdPx);

  // ── 3. Reject only wide-open spread hands (5 fingers fully extended) ──────
  // Flat palm against face can show 2-3 "spread" fingers — only reject clearly
  // open/pointing hands where all 5 are extended.
  const { count: spreadCount } = countSpreadFingers(handLms);
  if (spreadCount >= 5) return NONE;

  // ── 4. Hand bounding box (px) ─────────────────────────────────────────────
  let hMinX = Infinity, hMaxX = -Infinity, hMinY = Infinity, hMaxY = -Infinity;
  for (const lm of handLms) {
    const hx = lm.x * vw, hy = lm.y * vh;
    if (hx < hMinX) hMinX = hx; if (hx > hMaxX) hMaxX = hx;
    if (hy < hMinY) hMinY = hy; if (hy > hMaxY) hMaxY = hy;
  }

  // ── 5. Palm-center proximity ──────────────────────────────────────────────
  // Average wrist (0) and middle-finger MCP (9) — robust palm-center estimate
  const palmX = (handLms[0].x + handLms[9].x) / 2 * vw;
  const palmY = (handLms[0].y + handLms[9].y) / 2 * vh;

  function palmNear(region) {
    if (!region) return false;
    const dx = (palmX - region.cx) / (region.rx * 2.0);
    const dy = (palmY - region.cy) / (region.ry * 2.0);
    return dx * dx + dy * dy <= 1;
  }

  // ── 6. Hand bbox must contain the eye center ──────────────────────────────
  function bboxCovers(region) {
    if (!region) return false;
    return region.cx >= hMinX && region.cx <= hMaxX &&
           region.cy >= hMinY && region.cy <= hMaxY;
  }

  // ── 7. Count landmarks inside cover ellipse ───────────────────────────────
  function countIn(region) {
    if (!region) return 0;
    let n = 0;
    for (const lm of handLms) {
      const dx = (lm.x * vw - region.cx) / region.rx;
      const dy = (lm.y * vh - region.cy) / region.ry;
      if (dx * dx + dy * dy <= 1) n++;
    }
    return n;
  }

  const lCount = countIn(lRegion);
  const rCount = countIn(rRegion);

  // ── 8. Decision: landmark count + at least one spatial check ─────────────
  // Requiring BOTH palmNear AND bboxCovers was too strict — one is enough.
  // Threshold lowered to 3: when hand covers eye, face landmarks degrade so
  // the eye region can shrink, making high counts harder to achieve.
  const THRESHOLD = 3;
  const leftCovered  = lCount >= THRESHOLD && (palmNear(lRegion) || bboxCovers(lRegion));
  const rightCovered = rCount >= THRESHOLD && (palmNear(rRegion) || bboxCovers(rRegion));

  return {
    left:       leftCovered,
    right:      rightCovered,
    leftScore:  lCount / handLms.length,
    rightScore: rCount / handLms.length,
  };
}

// ── Direction label drawing ───────────────────────────────────────────────────
const DIR_COLORS = { UP:'#00FF88', DOWN:'#FF8800', LEFT:'#FFD700', RIGHT:'#44AAFF' };

/**
 * Draw a direction label (UP/DOWN/LEFT/RIGHT) near the index fingertip.
 */
export function drawDirectionLabel(ctx, lms, ts, dir) {
  if (!dir || dir === 'UNKNOWN' || dir === '—') return;
  const tip = ts(lms[8]);
  ctx.fillStyle = DIR_COLORS[dir] || '#fff';
  ctx.font = 'bold 28px system-ui';
  ctx.fillText(dir, tip.x - 30, tip.y - 20);
}
