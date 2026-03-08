// far-point-capture.js
// Walk-back far-point measurement for refractive error estimation.
//
// Protocol:
//   1. Show a fine fixed-pixel grating at the test meridian
//   2. User starts close (~30 cm) where grating is clearly visible
//   3. User slowly moves BACK until grating blurs / disappears
//   4. User presses button — current distance recorded as far point
//
// Diopter conversion:  P = 1 / D_meters  (far point in metres)
// Astigmatic refraction: SPH = least myopic meridian; CYL = difference.

export class FarPointCapture {
  constructor() {
    this._farPointMm = null;
  }

  /** Record the moment the user signals the grating disappeared. */
  capture(smoothedDistMm) {
    this._farPointMm = smoothedDistMm > 0 ? smoothedDistMm : null;
    return this._farPointMm;
  }

  isCaptured()      { return this._farPointMm !== null; }
  getFarPointMm()   { return this._farPointMm; }

  /** Far-point distance (mm) → diopters of correction needed. */
  static toDiopters(distMm) {
    if (!distMm || distMm <= 0) return 0;
    return 1000 / distMm; // 1 / D_meters
  }

  /**
   * Compute clinical refraction (signed minus-cylinder convention).
   *
   * P = −1000 / fpMm  (always ≤ 0 for myopia)
   * SPH = max(P1, P2)       — least-myopic meridian power
   * CYL = min(P1, P2) − SPH — always ≤ 0
   * AXIS = the less-myopic (SPH) meridian's angle
   *
   * @param {number|null} fp1Mm - far point for meridian 1 (mm), null = emmetrope
   * @param {number|null} fp2Mm - far point for meridian 2 (mm)
   * @param {number}      axis1 - orientation of meridian 1 (degrees)
   * @returns {{ sph: number, cyl: number, axis: number, note: string }}
   */
  static computeRefractionV3(fp1Mm, fp2Mm, axis1) {
    const p1 = fp1Mm ? -1000 / fp1Mm : 0;
    const p2 = fp2Mm ? -1000 / fp2Mm : 0;

    const sph  = Math.max(p1, p2);           // least myopic (closest to 0)
    const cyl  = Math.min(p1, p2) - sph;     // always ≤ 0
    // AXIS is the angle of the less-myopic (SPH) meridian
    const axis = p1 >= p2 ? axis1 : (axis1 + 90) % 180;

    let note = '';
    const absSph = Math.abs(sph), absCyl = Math.abs(cyl);
    if (absSph < 0.25 && absCyl < 0.25)  note = 'Emmetropia — no correction indicated.';
    else if (absCyl < 0.5)               note = 'Primarily spherical myopia, little astigmatism.';
    else if (absCyl >= 1.5)              note = 'Significant astigmatism detected.';
    else                                 note = 'Mild–moderate astigmatism detected.';

    return {
      sph:  +sph.toFixed(2),
      cyl:  +cyl.toFixed(2),
      axis,
      note,
    };
  }

  /** Legacy unsigned helper (kept for compatibility). */
  static computeRefraction(fp1Mm, fp2Mm, axis1) {
    return FarPointCapture.computeRefractionV3(fp1Mm, fp2Mm, axis1);
  }
}

// ── HoldCapture ────────────────────────────────────────────────────────────────
// Auto-captures the user's distance after they hold still for holdMs.
// The hold timer resets whenever the user moves (distance change > moveThr mm).

export class HoldCapture {
  /**
   * @param {number} holdMs   - ms the user must hold still (default 1500)
   * @param {number} moveThr  - mm movement that resets the hold timer (default 15)
   */
  constructor(holdMs = 1500, moveThr = 15) {
    this._holdMs    = holdMs;
    this._moveThr   = moveThr;
    this._holdStart = null;
    this._lastDist  = null;
    this._captured  = false;
    this._captMm    = null;
  }

  /**
   * Call every frame with current distance and face-visibility.
   * @returns {{ progress: number, captured: boolean, distMm: number|null }}
   */
  update(distMm, faceVisible) {
    if (this._captured) {
      return { progress: 1, captured: true, distMm: this._captMm };
    }
    if (!faceVisible || !distMm || distMm <= 0) {
      this._holdStart = null;
      this._lastDist  = null;
      return { progress: 0, captured: false, distMm: null };
    }

    // Reset timer if user is moving
    if (this._lastDist !== null && Math.abs(distMm - this._lastDist) > this._moveThr) {
      this._holdStart = null;
    }
    this._lastDist = distMm;

    if (!this._holdStart) this._holdStart = performance.now();
    const elapsed  = performance.now() - this._holdStart;
    const progress = Math.min(1, elapsed / this._holdMs);

    if (progress >= 1) {
      this._captured = true;
      this._captMm   = distMm;
    }
    return { progress, captured: this._captured, distMm };
  }

  isCaptured() { return this._captured; }
  getDistMm()  { return this._captMm; }

  reset() {
    this._holdStart = null;
    this._lastDist  = null;
    this._captured  = false;
    this._captMm    = null;
  }
}
