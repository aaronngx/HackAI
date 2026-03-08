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
/**
 * Detect whether the hand is covering the left or right eye.
 * Requires the hand fingers to be closed (≤1 spread), with ≥3 landmarks
 * landing within the iris cover-radius of each eye.
 *
 * @param {Array|null} handLms  - 21 normalized hand landmarks
 * @param {Array|null} faceLms  - 478 normalized face landmarks
 * @param {number} vw - video width  (pixels)
 * @param {number} vh - video height (pixels)
 * @returns {{ left: boolean, right: boolean }}
 */
export function detectHandOverEye(handLms, faceLms, vw, vh) {
  if (!handLms || !faceLms || !faceLms[468]) return { left: false, right: false };

  const lIris = { x: faceLms[473].x * vw, y: faceLms[473].y * vh };
  const rIris = { x: faceLms[468].x * vw, y: faceLms[468].y * vh };
  const pd    = Math.hypot(rIris.x - lIris.x, rIris.y - lIris.y);
  const R     = Math.max(30, pd * 0.6);

  // Reject if fingers are spread (not a covering gesture)
  const { count: spreadCount } = countSpreadFingers(handLms);
  if (spreadCount > 1) return { left: false, right: false };

  let lc = 0, rc = 0;
  for (const lm of handLms) {
    const hx = lm.x * vw, hy = lm.y * vh;
    if (Math.hypot(hx - lIris.x, hy - lIris.y) <= R) lc++;
    if (Math.hypot(hx - rIris.x, hy - rIris.y) <= R) rc++;
  }
  return { left: lc >= 3, right: rc >= 3 };
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
