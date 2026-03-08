// confidence-reporter.js
// Tracks psychophysical test quality metrics during an eye screening session.
//
// V3 composite score (0–100) uses 8 components:
//   presence    × 0.20  (face visible ratio)
//   stability   × 0.15  (distance std-dev)
//   axisConf    × 0.15  (FastAxisEngine confidence: 0 / 0.5 / 1.0)
//   reversals   × 0.15  (staircase reversal count / expected 4)
//   spread      × 0.10  (CPD spread of reversals)
//   holdCapture × 0.10  (far-points captured: 0 / 1 / 2)
//   RT          × 0.10  (response time reasonableness)
//   cover       × 0.05  (monocular cover detected)

export class ConfidenceReporter {
  constructor() {
    this._distSamples   = [];
    this._responseTimes = [];
    this._totalFrames   = 0;
    this._faceFrames    = 0;
  }

  /** Call each frame during active test phases. */
  update(distMm, faceVisible) {
    this._totalFrames++;
    if (faceVisible) {
      this._faceFrames++;
      if (distMm > 0) this._distSamples.push(distMm);
    }
  }

  /** Record user response time (ms) for one trial. */
  recordResponseMs(ms) {
    if (ms > 100 && ms < 20000) this._responseTimes.push(ms);
  }

  presenceRatio() {
    return this._totalFrames > 0 ? this._faceFrames / this._totalFrames : 1;
  }

  distStabilityMm() {
    const s = this._distSamples;
    if (s.length < 2) return 0;
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    return Math.sqrt(s.reduce((sum, v) => sum + (v - mean) ** 2, 0) / s.length);
  }

  meanResponseMs() {
    if (!this._responseTimes.length) return 600;
    return this._responseTimes.reduce((a, b) => a + b, 0) / this._responseTimes.length;
  }

  /**
   * V3 composite quality score 0–100.
   *
   * @param {object} opts
   * @param {number}   opts.axisConfidence  - 0 | 0.5 | 1.0 from FastAxisEngine
   * @param {number[]} opts.reversals       - [r0, r1] reversal counts per meridian
   * @param {number[]} opts.spread          - [s0, s1] CPD spread per meridian
   * @param {number}   opts.holdCaptures    - 0 | 1 | 2 far-points captured
   * @param {boolean}  opts.coverOk         - monocular cover was confirmed
   */
  scoreV3({
    axisConfidence = 0,
    reversals      = [0, 0],
    spread         = [0, 0],
    holdCaptures   = 0,
    coverOk        = true,
  } = {}) {
    const presence  = this.presenceRatio();
    const stability = Math.max(0, 1 - this.distStabilityMm() / 30);
    const axisConf  = axisConfidence;                                       // 0–1

    // reversals: target 4 total (2 per meridian) in 10 trials
    const revScore  = Math.min(1, (reversals[0] + reversals[1]) / 4);

    // spread: lower = better; penalise if avg spread > 2 CPD
    const avgSpread  = (spread[0] + spread[1]) / 2;
    const spreadScore = Math.max(0, 1 - avgSpread / 2);

    // holdCapture: 0 / 1 / 2 captures
    const holdScore = holdCaptures / 2;

    // RT
    const rt       = this.meanResponseMs();
    const rtScore  = (rt > 200 && rt < 8000) ? 1 : 0.5;

    // cover
    const coverScore = coverOk ? 1 : 0.5;

    const raw = (
      presence    * 0.20 +
      stability   * 0.15 +
      axisConf    * 0.15 +
      revScore    * 0.15 +
      spreadScore * 0.10 +
      holdScore   * 0.10 +
      rtScore     * 0.10 +
      coverScore  * 0.05
    ) * 100;

    return Math.round(Math.min(100, Math.max(0, raw)));
  }

  /** Legacy 4-component score (kept for compatibility). */
  score(staircaseSpread1 = 0, staircaseSpread2 = 0) {
    return this.scoreV3({ spread: [staircaseSpread1, staircaseSpread2] });
  }

  /** Label for quality score. */
  static label(score) {
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Poor — consider retesting';
  }

  /**
   * Return retest/warning messages based on score and refraction.
   * @param {number} score
   * @param {{ sph, cyl }|null} ref
   * @returns {string[]}
   */
  static autoRetest(score, ref) {
    const msgs = [];
    if (score < 60) msgs.push('Low quality score — retest recommended.');
    if (ref && Math.abs(ref.cyl) >= 1.5 && score < 80) {
      msgs.push('High astigmatism with suboptimal data quality — consider clinical evaluation.');
    }
    return msgs;
  }

  /** Myopia severity label from spherical power (diopters, signed). */
  static myopiaLabel(sph) {
    const s = Math.abs(sph);
    if (s < 0.25) return 'None';
    if (s < 3.0)  return 'Mild myopia';
    if (s < 6.0)  return 'Moderate myopia';
    return 'High myopia';
  }

  /** Astigmatism severity label from cylinder power (diopters, ≤ 0). */
  static astigLabel(cyl) {
    const c = Math.abs(cyl);
    if (c < 0.25) return 'None';
    if (c < 1.0)  return 'Mild astigmatism';
    if (c < 2.0)  return 'Moderate astigmatism';
    return 'Significant astigmatism';
  }

  reset() {
    this._distSamples   = [];
    this._responseTimes = [];
    this._totalFrames   = 0;
    this._faceFrames    = 0;
  }
}
