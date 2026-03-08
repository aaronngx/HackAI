// distance-smoother.js
// Stable, camera-offset-corrected face-to-screen distance from raw MediaPipe estimates.

export class DistanceSmoother {
  /**
   * @param {object} opts
   * @param {number} opts.windowSize      - median filter window (frames)
   * @param {number} opts.emaAlpha        - EMA smoothing factor (0–1, lower = smoother)
   * @param {number} opts.cameraOffsetMm  - vertical distance from webcam lens to top of screen (mm)
   * @param {number} opts.minCm           - reject distances below this
   * @param {number} opts.maxCm           - reject distances above this
   */
  constructor({
    windowSize     = 5,
    emaAlpha       = 0.3,
    cameraOffsetMm = 25,   // typical laptop bezel; user can override
    minCm          = 15,
    maxCm          = 200,
  } = {}) {
    this.windowSize     = windowSize;
    this.alpha          = emaAlpha;
    this.cameraOffsetMm = cameraOffsetMm;
    this.minCm          = minCm;
    this.maxCm          = maxCm;

    this._buf      = [];   // raw ring buffer (cm)
    this._smoothed = null; // EMA output (cm)
    this._frames   = 0;
    this._missedFrames = 0;
  }

  // ── Push a new raw distance reading (cm) ───────────────────────────────────
  push(rawCm) {
    if (rawCm == null || isNaN(rawCm) || rawCm < this.minCm || rawCm > this.maxCm) {
      this._missedFrames++;
      // After 10 consecutive misses, reset smoothed to force re-init on next valid
      if (this._missedFrames > 10) this._smoothed = null;
      return this._smoothed;
    }
    this._missedFrames = 0;

    // Median filter
    this._buf.push(rawCm);
    if (this._buf.length > this.windowSize) this._buf.shift();
    const sorted   = [...this._buf].sort((a, b) => a - b);
    const medianCm = sorted[Math.floor(sorted.length / 2)];

    // EMA
    if (this._smoothed === null) {
      this._smoothed = medianCm;
    } else {
      this._smoothed = this.alpha * medianCm + (1 - this.alpha) * this._smoothed;
    }
    this._frames++;
    return this._smoothed;
  }

  // ── Get smoothed camera distance (cm) ─────────────────────────────────────
  get smoothed() { return this._smoothed; }

  // ── Get camera-to-screen-center corrected distance (mm) ───────────────────
  // Geometry: camera is cameraOffsetMm above the top of the screen.
  // Screen center is an additional screenHeightMm/2 below the top.
  // The user's eye is at distance D_cam from the camera.
  // D_screen_center = sqrt(D_cam^2 - vertOffset^2)  [Pythagorean approx]
  getCorrectedMm(screenHeightMm) {
    if (!this._smoothed) return null;
    const D_cam_mm  = this._smoothed * 10;
    const vertOffset = this.cameraOffsetMm + (screenHeightMm ?? 0) / 2;
    const D_sq       = D_cam_mm * D_cam_mm - vertOffset * vertOffset;
    return D_sq > 0 ? Math.sqrt(D_sq) : D_cam_mm;
  }

  isValid() {
    return this._smoothed !== null &&
           this._smoothed >= this.minCm &&
           this._smoothed <= this.maxCm;
  }

  reset() {
    this._buf          = [];
    this._smoothed     = null;
    this._frames       = 0;
    this._missedFrames = 0;
  }
}
