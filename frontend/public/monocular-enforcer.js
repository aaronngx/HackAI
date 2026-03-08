// monocular-enforcer.js
// Verifies one eye is continuously covered during monocular test phases.

export class MonocularEnforcer {
  /**
   * @param {object} opts
   * @param {number} opts.sustainMs  - how long cover must be held before confirmed
   */
  constructor({ sustainMs = 500 } = {}) {
    this.sustainMs    = sustainMs;
    this._coverStart  = null;
  }

  /**
   * Call every frame.
   * @param {{ left: string|null, right: string|null }} coverState - from detectHandOverEye
   * @param {'left'|'right'} targetEye  - which eye should be covered
   * @param {number} earLeft            - EAR of left eye (0=closed)
   * @param {number} earRight           - EAR of right eye
   * @returns {{ ok: boolean, progress: number, coveredBy: string|null }}
   */
  update(coverState, targetEye, earLeft = 0.3, earRight = 0.3) {
    const covered   = targetEye === 'left' ? coverState.left : coverState.right;
    const score     = targetEye === 'left' ? (coverState.leftScore  ?? 0)
                                           : (coverState.rightScore ?? 0);
    const ear       = targetEye === 'left' ? earLeft : earRight;
    // Covered = hand detected over eye (with score > 0 giving partial credit)
    // OR EAR very low (eye physically closed/blocked)
    const confirmed = !!covered || score >= 0.15 || ear < 0.15;

    if (confirmed) {
      if (!this._coverStart) this._coverStart = performance.now();
      const elapsed  = performance.now() - this._coverStart;
      return {
        ok:        elapsed >= this.sustainMs,
        progress:  Math.min(1, elapsed / this.sustainMs),
        coveredBy: covered || 'closed',
      };
    }

    this._coverStart = null;
    return { ok: false, progress: 0, coveredBy: null };
  }

  reset() { this._coverStart = null; }
}
