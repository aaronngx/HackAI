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

  // ── LCA-aware methods (paper-aligned, Salmeron-Campillo et al. 2025) ────────

  // Longitudinal chromatic aberration constants from OLED smartphone screens.
  // RED  (+0.22 D) shifts the apparent far point farther → less myopia measured.
  // BLUE (−0.67 D) shifts the apparent far point closer  → more myopia measured.
  static LCA_RED  = +0.22;
  static LCA_BLUE = -0.67;

  /**
   * Convert a measured far-point distance (mm) to true dioptric power,
   * applying the LCA correction for the stimulus color used.
   *
   * Formula: P_true = P_measured − LCA_color
   *   RED:  P_true = (−1000/mm) − 0.22
   *   BLUE: P_true = (−1000/mm) − (−0.67) = (−1000/mm) + 0.67
   *
   * @param {number} fpMm  - measured far-point distance in mm
   * @param {'RED'|'BLUE'} color - stimulus color used during measurement
   * @returns {number} LCA-corrected power in diopters (≤ 0 for myopia)
   */
  static fpToTruePower(fpMm, color = 'RED') {
    if (!fpMm || fpMm <= 0) return 0;
    const raw = -1000 / fpMm;
    const lca = color === 'RED' ? FarPointCapture.LCA_RED : FarPointCapture.LCA_BLUE;
    return raw - lca;
  }

  /**
   * Determine whether a BLUE-fallback far-point measurement is needed.
   * Per the paper: run an additional BLUE measurement when the provisional
   * sphere (from RED) is greater than −0.75 D — i.e. mild myopia, emmetropia,
   * or hyperopia — because the BLUE LCA shift brings the virtual far point into
   * a measurable range for these subjects.
   *
   * @param {number|null} fpRedMm - far-point distance from RED measurement (mm)
   * @returns {boolean}
   */
  static needsBlueFallback(fpRedMm) {
    if (!fpRedMm || fpRedMm <= 0) return true; // no measurement → emmetrope/hyperope
    const p = FarPointCapture.fpToTruePower(fpRedMm, 'RED');
    return p > -0.75;
  }

  /**
   * LCA-aware sphero-cylindrical refraction computation.
   * Applies chromatic-aberration correction for both RED and BLUE measurements
   * before computing SPH / CYL / AXIS.
   *
   * Replaces computeRefractionV3 in the paper-aligned measurement flow.
   * computeRefractionV3 is kept for backwards compatibility.
   *
   * @param {number|null} fp1Mm     - far point meridian 1, RED measurement (mm)
   * @param {number|null} fp2Mm     - far point meridian 2, RED measurement (mm)
   * @param {number}      axis1     - orientation of meridian 1 (degrees)
   * @param {number|null} fp1BlueMm - blue fallback meridian 1 (null if not used)
   * @param {number|null} fp2BlueMm - blue fallback meridian 2 (null if not used)
   * @returns {{ sph, cyl, axis, usedBlue, colorNote, note }}
   */
  static computeRefractionV4(fp1Mm, fp2Mm, axis1, fp1BlueMm = null, fp2BlueMm = null) {
    // Use blue measurement when available; otherwise use red
    const p1 = fp1BlueMm
      ? FarPointCapture.fpToTruePower(fp1BlueMm, 'BLUE')
      : FarPointCapture.fpToTruePower(fp1Mm, 'RED');
    const p2 = fp2BlueMm
      ? FarPointCapture.fpToTruePower(fp2BlueMm, 'BLUE')
      : FarPointCapture.fpToTruePower(fp2Mm, 'RED');

    const sph      = Math.max(p1, p2);
    const cyl      = Math.min(p1, p2) - sph;
    const axis     = p1 >= p2 ? axis1 : (axis1 + 90) % 180;
    const usedBlue = !!(fp1BlueMm || fp2BlueMm);
    const colorNote = usedBlue
      ? ' · LCA-corrected (blue fallback used)'
      : ' · LCA-corrected (red)';

    let note = '';
    const a = Math.abs(sph), b = Math.abs(cyl);
    if (a < 0.25 && b < 0.25)  note = 'Emmetropia — no correction indicated.';
    else if (b < 0.5)           note = 'Primarily spherical myopia, little astigmatism.';
    else if (b >= 1.5)          note = 'Significant astigmatism detected.';
    else                        note = 'Mild–moderate astigmatism detected.';

    return { sph: +sph.toFixed(2), cyl: +cyl.toFixed(2), axis, usedBlue, colorNote, note };
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
