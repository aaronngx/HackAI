// confidence-reporter.js
// Tracks psychophysical test quality metrics during an eye screening session.
//
// Metrics:
//   - Face presence ratio  (frames where face was detected / total frames)
//   - Distance stability   (std dev of viewing distance samples in mm)
//   - Reversal spread      (from staircase — lower = more reliable threshold)
//   - Response speed       (mean reaction time; very fast = guessing, very slow = inattentive)
//
// Composite score 0–100:
//   presence × 0.35 + stability × 0.35 + spread × 0.20 + speed × 0.10

export class ConfidenceReporter {
  constructor() {
    this._distSamples    = [];  // distance (mm) per frame during active phases
    this._responseTimes  = [];  // reaction times in ms
    this._totalFrames    = 0;   // total frames sampled
    this._faceFrames     = 0;   // frames where face was visible
  }

  /** Call each frame during active test phases (AXIS, MDSF, FAR_POINT). */
  update(distMm, faceVisible) {
    this._totalFrames++;
    if (faceVisible) {
      this._faceFrames++;
      if (distMm > 0) this._distSamples.push(distMm);
    }
  }

  /** Record user response time for a single trial (ms). */
  recordResponseMs(ms) {
    if (ms > 100 && ms < 20000) this._responseTimes.push(ms);
  }

  /** Face presence ratio 0–1. */
  presenceRatio() {
    return this._totalFrames > 0 ? this._faceFrames / this._totalFrames : 1;
  }

  /** Distance std-dev (mm). Lower = steadier viewing distance. */
  distStabilityMm() {
    const s = this._distSamples;
    if (s.length < 2) return 0;
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    return Math.sqrt(s.reduce((sum, v) => sum + (v - mean) ** 2, 0) / s.length);
  }

  /** Mean response time (ms). */
  meanResponseMs() {
    if (!this._responseTimes.length) return 600;
    return this._responseTimes.reduce((a, b) => a + b, 0) / this._responseTimes.length;
  }

  /**
   * Composite quality score 0–100.
   * @param {number} staircaseSpread1  - CPD std-dev from staircase 1
   * @param {number} staircaseSpread2  - CPD std-dev from staircase 2
   */
  score(staircaseSpread1 = 0, staircaseSpread2 = 0) {
    const presence  = this.presenceRatio();                              // 0–1, want 1
    const stability = Math.max(0, 1 - this.distStabilityMm() / 30);     // penalty if >30mm movement
    const spread    = Math.max(0, 1 - (staircaseSpread1 + staircaseSpread2) / 2 / 3); // penalty if >3 CPD
    const rt        = this.meanResponseMs();
    const speedOk   = rt > 200 && rt < 8000 ? 1 : 0.5;                 // penalise extreme RT

    const raw = (presence * 0.35 + stability * 0.35 + spread * 0.20 + speedOk * 0.10) * 100;
    return Math.round(Math.min(100, Math.max(0, raw)));
  }

  /** Label for the quality score. */
  static label(score) {
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Poor — consider retesting';
  }

  reset() {
    this._distSamples   = [];
    this._responseTimes = [];
    this._totalFrames   = 0;
    this._faceFrames    = 0;
  }
}
