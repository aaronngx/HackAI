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
   * Compute clinical refraction from two meridian far-point distances.
   *
   * @param {number|null} fp1Mm  - far point for meridian 1 (mm), null = infinity (emmetrope)
   * @param {number|null} fp2Mm  - far point for meridian 2 (mm), null = infinity
   * @param {number}      axis1  - orientation of meridian 1 (degrees)
   * @returns {{ sph: number, cyl: number, axis: number, note: string }}
   */
  static computeRefraction(fp1Mm, fp2Mm, axis1) {
    // null / very large distance → 0 D (emmetrope for that meridian)
    const p1 = fp1Mm ? FarPointCapture.toDiopters(fp1Mm) : 0;
    const p2 = fp2Mm ? FarPointCapture.toDiopters(fp2Mm) : 0;

    const sph  = Math.min(p1, p2);
    const cyl  = Math.abs(p1 - p2);
    // CYL axis = the LESS myopic (higher far-point / lower diopter) meridian
    const axis = p1 <= p2 ? axis1 : (axis1 + 90) % 180;

    let note = '';
    if (sph < 0.25 && cyl < 0.25) note = 'Emmetropia — no correction indicated.';
    else if (cyl < 0.5)            note = 'Primarily spherical myopia, little astigmatism.';
    else if (cyl >= 1.5)           note = 'Significant astigmatism detected.';
    else                           note = 'Mild–moderate astigmatism detected.';

    return {
      sph:  +sph.toFixed(2),
      cyl:  +cyl.toFixed(2),
      axis,
      note,
    };
  }
}
