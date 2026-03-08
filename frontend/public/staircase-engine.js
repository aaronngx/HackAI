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

// ── InterleavedStaircase ───────────────────────────────────────────────────────
// 2-down-1-up dual-meridian staircase.  Each call to nextTrial() picks a
// meridian (balancing trial counts); trial() advances the selected meridian.
// Stops after maxTrials total trials (default 10, ~5 per meridian).
// threshold(m) = mean of last 2 reversals for meridian m.

export class InterleavedStaircase {
  /**
   * @param {object} opts
   * @param {number} opts.startCPD
   * @param {number} opts.stepFactor   - multiply/divide CPD (default √2)
   * @param {number} opts.maxTrials    - total trials across both meridians
   * @param {number} opts.minCPD
   * @param {number} opts.maxCPD
   * @param {number} opts.axis1        - degrees of meridian 0
   * @param {number} opts.axis2        - degrees of meridian 1
   */
  constructor({
    startCPD   = 3,
    stepFactor = Math.SQRT2,
    maxTrials  = 10,
    minCPD     = 0.5,
    maxCPD     = 20,
    axis1      = 0,
    axis2      = 90,
  } = {}) {
    this.axis1      = axis1;
    this.axis2      = axis2;
    this.maxTrials  = maxTrials;
    this.stepFactor = stepFactor;
    this.minCPD     = minCPD;
    this.maxCPD     = maxCPD;

    // Independent state per meridian [0] and [1]
    this._m = [0, 1].map(() => ({
      cpd:       startCPD,
      streak:    0,
      lastDir:   null,
      reversals: [],
      history:   [],
    }));

    this._totalTrials = 0;
    this._done        = false;
    this._curMeridian = 0; // set by nextTrial()
  }

  /**
   * Choose next meridian (balances trial counts) and return trial parameters.
   * @returns {{ meridian: 0|1, axis: number, cpd: number }}
   */
  nextTrial() {
    const t0 = this._m[0].history.length;
    const t1 = this._m[1].history.length;
    if      (t0 < t1) this._curMeridian = 0;
    else if (t1 < t0) this._curMeridian = 1;
    else              this._curMeridian = Math.random() < 0.5 ? 0 : 1;

    const m = this._m[this._curMeridian];
    return {
      meridian: this._curMeridian,
      axis:     this._curMeridian === 0 ? this.axis1 : this.axis2,
      cpd:      m.cpd,
    };
  }

  /**
   * Record response for the meridian chosen by the last nextTrial() call.
   * @param {boolean} correct
   */
  trial(correct) {
    if (this._done) return;
    const m       = this._m[this._curMeridian];
    const prevCPD = m.cpd;

    if (correct) {
      m.streak++;
      if (m.streak >= 2) { // 2-down → step up
        if (m.lastDir === 'down') m.reversals.push(prevCPD);
        m.cpd      = Math.min(this.maxCPD, m.cpd * this.stepFactor);
        m.lastDir  = 'up';
        m.streak   = 0;
      }
    } else {
      if (m.lastDir === 'up') m.reversals.push(prevCPD);
      m.cpd      = Math.max(this.minCPD, m.cpd / this.stepFactor);
      m.lastDir  = 'down';
      m.streak   = 0;
    }

    m.history.push({ cpd: prevCPD, correct });
    this._totalTrials++;
    this._done = this._totalTrials >= this.maxTrials;
  }

  isDone() { return this._done; }

  /** Threshold = mean of last 2 reversal CPDs for meridian m. */
  threshold(m) {
    const rev  = this._m[m].reversals;
    const last = rev.slice(-2);
    if (!last.length) return this._m[m].cpd;
    return last.reduce((a, b) => a + b, 0) / last.length;
  }

  /** Spread (std-dev) of last 2 reversals for meridian m. */
  spread(m) {
    const last = this._m[m].reversals.slice(-2);
    if (last.length < 2) return 0;
    const mean = last.reduce((a, b) => a + b, 0) / last.length;
    return Math.sqrt(last.reduce((s, v) => s + (v - mean) ** 2, 0) / last.length);
  }

  reversalCount(m) { return this._m[m].reversals.length; }
  trialCount(m)    { return this._m[m].history.length; }
  currentCPD(m)    { return this._m[m].cpd; }

  get totalTrials()  { return this._totalTrials; }
  get maxTrialsVal() { return this.maxTrials; }
}
