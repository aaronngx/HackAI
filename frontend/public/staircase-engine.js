// staircase-engine.js
// 3-down-1-up transformed staircase for 2AFC MDSF measurement.
// [Research fact] 2AFC procedure used for MDSF.
// [Inference] 3-down-1-up targeting ~79% correct; 6 reversals; √2 step factor.

export class StaircaseEngine {
  /**
   * @param {object} opts
   * @param {number} opts.startCPD      - initial spatial frequency
   * @param {number} opts.stepFactor    - multiply/divide CPD by this on each step (default √2)
   * @param {number} opts.maxReversals  - stop after this many direction reversals
   * @param {number} opts.maxTrials     - hard cap on trial count
   * @param {number} opts.minCPD        - lower clamp
   * @param {number} opts.maxCPD        - upper clamp (should not exceed display Nyquist)
   */
  constructor({
    startCPD     = 6,
    stepFactor   = Math.SQRT2,
    maxReversals = 6,
    maxTrials    = 40,
    minCPD       = 0.5,
    maxCPD       = 20,
  } = {}) {
    this.cpd         = startCPD;
    this.stepFactor  = stepFactor;
    this.maxReversals = maxReversals;
    this.maxTrials   = maxTrials;
    this.minCPD      = minCPD;
    this.maxCPD      = maxCPD;

    this._reversals  = [];
    this._history    = [];   // { cpd, correct, direction }
    this._streak     = 0;    // consecutive correct answers
    this._lastDir    = null; // 'up' | 'down'
    this._done       = false;
  }

  /**
   * Record one trial result and update CPD.
   * @param {boolean} correct
   * @returns {number} new CPD for next trial
   */
  trial(correct) {
    const prevCPD = this.cpd;
    let moved = false;

    if (correct) {
      this._streak++;
      if (this._streak >= 3) {
        // 3 correct → harder (raise CPD)
        if (this._lastDir === 'down') this._reversals.push(prevCPD);
        this.cpd       = Math.min(this.maxCPD, this.cpd * this.stepFactor);
        this._lastDir  = 'up';
        this._streak   = 0;
        moved          = true;
      }
    } else {
      // 1 wrong → easier (lower CPD)
      if (this._lastDir === 'up') this._reversals.push(prevCPD);
      this.cpd      = Math.max(this.minCPD, this.cpd / this.stepFactor);
      this._lastDir = 'down';
      this._streak  = 0;
      moved         = true;
    }

    this._history.push({ cpd: prevCPD, correct, moved });
    this._done = this._reversals.length >= this.maxReversals ||
                 this._history.length  >= this.maxTrials;
    return this.cpd;
  }

  isDone() { return this._done; }

  /** Threshold = mean of last 4 reversal CPDs [Inference]. */
  threshold() {
    const last = this._reversals.slice(-4);
    if (!last.length) return this.cpd;
    return last.reduce((a, b) => a + b, 0) / last.length;
  }

  /** Spread of last 4 reversals (std dev) — proxy for reliability. */
  spread() {
    const last = this._reversals.slice(-4);
    if (last.length < 2) return 0;
    const mean = last.reduce((a, b) => a + b, 0) / last.length;
    return Math.sqrt(last.reduce((s, v) => s + (v - mean) ** 2, 0) / last.length);
  }

  /** Approximate Snellen denominator from CPD threshold [Inference]. */
  static toSnellen(cpd) {
    // Snellen denominator ≈ 600 / cpd  (30 cpd → 20/20)
    return Math.round(600 / cpd);
  }

  get reversalCount() { return this._reversals.length; }
  get trialCount()    { return this._history.length; }
  get currentCPD()    { return this.cpd; }
}
