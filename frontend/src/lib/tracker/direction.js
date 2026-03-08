/**
 * direction.js — Hand pointing-direction classification with frame smoothing.
 *
 * ── Algorithm ────────────────────────────────────────────────────────────────
 *
 * MediaPipe Hand Landmarker returns 21 landmarks in normalized [0,1] image
 * coordinates:
 *
 *   Wrist          = landmark 0
 *   Index MCP      = landmark 5   (knuckle at the base of the index finger)
 *   Index fingertip = landmark 8
 *
 * We compute a composite direction vector by summing two sub-vectors:
 *
 *   v1 = indexMCP  − wrist      (lower finger segment direction)
 *   v2 = indexTip  − indexMCP   (upper finger segment direction)
 *   v  = v1 + v2                (combined, stable pointing direction)
 *
 * Using two vectors (rather than just wrist→tip) reduces sensitivity to
 * wrist rotation and gives a more stable axis when the finger is bent.
 *
 * Classification rules (image/landmark coordinate space):
 *   |dy| ≥ |dx|  →  dominant axis is vertical
 *                     dy < 0  →  "UP"   (y=0 is top, so negative = up)
 *                     dy > 0  →  "DOWN"
 *   |dx| >  |dy| →  dominant axis is horizontal
 *                     dx < 0  →  "LEFT"
 *                     dx > 0  →  "RIGHT"
 *
 * ── Mirror note ──────────────────────────────────────────────────────────────
 *
 * The webcam preview is CSS-mirrored (scaleX(-1)) so it feels like a selfie
 * camera. The canvas overlay is mirrored the same way, so landmark dots
 * visually align with the mirrored image.
 *
 * MediaPipe landmark x-coordinates are in the RAW (un-mirrored) image frame:
 *   landmark x=0.1  →  appears near the RIGHT edge of the mirrored preview
 *   landmark x=0.9  →  appears near the LEFT  edge of the mirrored preview
 *
 * Therefore, in the VISUAL/MIRRORED space:
 *   Landmark "LEFT"  (dx < 0)  → user sees arrow pointing RIGHT
 *   Landmark "RIGHT" (dx > 0)  → user sees arrow pointing LEFT
 *
 * The direction label and arrow are drawn in the same mirrored canvas space,
 * so visually they always point the same way the finger actually points on
 * screen. The string values (LEFT/RIGHT) however reflect landmark space.
 * This is documented clearly in the UI.
 *
 * ── Smoothing ─────────────────────────────────────────────────────────────────
 *
 * The last SMOOTH_BUFFER_SIZE raw classifications are stored in a ring buffer.
 * The final output is the modal (most-frequent) label in the buffer, which
 * eliminates single-frame flicker when the direction is near an axis boundary.
 */

const SMOOTH_BUFFER_SIZE = 8;  // frames — higher = smoother but more lag
const MIN_MAGNITUDE = 0.08;     // normalized units — ignore tiny movements

/** @type {string[]} */
const buffer = [];

/**
 * Classify the pointing direction of a hand from its 21 landmarks.
 *
 * @param {Array<{x:number,y:number,z:number}>} landmarks
 * @returns {"UP"|"DOWN"|"LEFT"|"RIGHT"|"UNKNOWN"}
 */
export function classifyHandDirection(landmarks) {
  if (!landmarks || landmarks.length < 9) return "UNKNOWN";

  const wrist    = landmarks[0];
  const indexMCP = landmarks[5];   // knuckle at base of index finger
  const indexTip = landmarks[8];   // index fingertip

  // Two-segment composite vector (wrist→MCP + MCP→tip)
  const dx = (indexMCP.x - wrist.x) + (indexTip.x - indexMCP.x);
  const dy = (indexMCP.y - wrist.y) + (indexTip.y - indexMCP.y);

  // Reject if the hand is nearly flat or landmarks are noise
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag < MIN_MAGNITUDE) return "UNKNOWN";

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy >= absDx) {
    // Vertical dominant — y=0 is top of frame, so negative dy = upward
    return dy < 0 ? "UP" : "DOWN";
  } else {
    // Horizontal dominant
    return dx < 0 ? "LEFT" : "RIGHT";
  }
}

/**
 * Push a raw direction into the smoothing buffer and return the modal label.
 *
 * @param {string} direction
 * @returns {string}
 */
export function smoothDirection(direction) {
  buffer.push(direction);
  if (buffer.length > SMOOTH_BUFFER_SIZE) buffer.shift();

  // Tally occurrences
  /** @type {Record<string,number>} */
  const counts = {};
  for (const d of buffer) counts[d] = (counts[d] ?? 0) + 1;

  // Return the highest-count entry
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Clear the smoothing buffer — call this when the hand disappears or the
 * camera is stopped to prevent stale history affecting the next detection.
 */
export function resetDirectionBuffer() {
  buffer.length = 0;
}
