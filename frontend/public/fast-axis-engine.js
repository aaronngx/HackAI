// fast-axis-engine.js
// 6-trial 2-phase axis search for astigmatism screening.
//
// Phase 1 (3 trials): Cross-axis pairs (0/90, 30/120, 60/150) → 3 winners
// Phase 2 (3 trials): Winners bracket → final axis
//
// axisConfidence: maxWins >= 3 → 1.0, >= 2 → 0.5, else → 0.0

export class FastAxisEngine {
  static PHASE1_PAIRS = [[0, 90], [30, 120], [60, 150]];

  constructor() {
    this._wins      = {};   // degrees -> win count
    this._rtMs      = [];
    this._responses = [];   // index i: which (1|2) won pair i
    this._pairs     = [...FastAxisEngine.PHASE1_PAIRS]; // grows as phase 2 pairs are added
    this._phase     = 1;
    this._idx       = 0;    // current pair index
    this._done      = false;
    this._foundAxis = null;
    this._axisConf  = 0;
  }

  /** Returns [angleA, angleB] for the current trial, or null if done. */
  nextPair() {
    if (this._done) return null;
    return this._pairs[this._idx];
  }

  /**
   * Record user response and advance engine.
   * @param {1|2} which   - 1 = first stimulus sharper, 2 = second
   * @param {number} rtMs - reaction time in ms (optional)
   */
  recordResponse(which, rtMs = 0) {
    if (this._done) return;
    const pair   = this._pairs[this._idx];
    const winner = which === 1 ? pair[0] : pair[1];
    this._wins[winner] = (this._wins[winner] || 0) + 1;
    this._responses.push(which);
    this._rtMs.push(rtMs);
    this._idx++;

    // After phase-1 complete: build phase-2 pairs
    if (this._phase === 1 && this._idx === 3) {
      const r   = this._responses;
      const p   = FastAxisEngine.PHASE1_PAIRS;
      const wA  = r[0] === 1 ? p[0][0] : p[0][1];
      const wB  = r[1] === 1 ? p[1][0] : p[1][1];
      const wC  = r[2] === 1 ? p[2][0] : p[2][1];
      this._pairs.push([wA, wB]); // trial 3 → finalist_1
      this._pairs.push([wB, wC]); // trial 4 → finalist_2
      // trial 5 (finalist_1 vs finalist_2) added after those resolve
      this._phase = 2;
    }

    // After trials 3 & 4: add the grand final
    if (this._phase === 2 && this._idx === 5) {
      const r  = this._responses;
      const f1 = r[3] === 1 ? this._pairs[3][0] : this._pairs[3][1];
      const f2 = r[4] === 1 ? this._pairs[4][0] : this._pairs[4][1];
      this._pairs.push([f1, f2]); // trial 5 → foundAxis
    }

    // After all 6 trials: finalise
    if (this._idx === 6) {
      const last = this._pairs[5];
      const r    = this._responses;
      this._foundAxis = r[5] === 1 ? last[0] : last[1];
      const maxWins   = this._wins[this._foundAxis] || 0;
      this._axisConf  = maxWins >= 3 ? 1.0 : maxWins >= 2 ? 0.5 : 0.0;
      this._done      = true;
    }
  }

  isDone()            { return this._done; }
  getFinalAxis()      { return this._foundAxis; }
  getAxisConfidence() { return this._axisConf; }

  getProgress() {
    return { done: this._idx, total: 6, phase: this._phase };
  }

  meanRtMs() {
    if (!this._rtMs.length) return 0;
    return this._rtMs.reduce((a, b) => a + b, 0) / this._rtMs.length;
  }
}
