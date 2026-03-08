/**
 * calibration.js — Multi-point gaze-to-screen calibration.
 *
 * Collects (yaw, pitch) → (screen_x, screen_y) sample pairs at N known
 * screen positions, then fits a degree-2 bivariate polynomial:
 *
 *   screen_x = a₀ + a₁·u + a₂·v + a₃·u·v + a₄·u² + a₅·v²
 *   screen_y = b₀ + b₁·u + b₂·v + b₃·u·v + b₄·u² + b₅·v²
 *
 * where u = yaw (°) and v = pitch (°). The 6 coefficients per axis are
 * solved by least squares via normal equations (Gaussian elimination with
 * partial pivoting).
 *
 * State machine:  IDLE → RUNNING → COMPUTING → READY
 *
 * Usage:
 *   const cal = new CalibrationManager();
 *   cal.onPoint    = (sx, sy, idx, total) => showDotAt(sx, sy);
 *   cal.onComplete = (ok) => ok ? showGazeDot() : showError();
 *   cal.start();
 *   // each frame:
 *   cal.feedFrame({ yaw, pitch });
 *   // after READY:
 *   const { x, y } = cal.mapGaze(yaw, pitch) ?? {};
 */

// ── Calibration grid — 9 points in a 3×3 layout, 15% inset from edges ────────
export const CALIB_POINTS = [
  [0.15, 0.15], [0.50, 0.15], [0.85, 0.15],
  [0.15, 0.50], [0.50, 0.50], [0.85, 0.50],
  [0.15, 0.85], [0.50, 0.85], [0.85, 0.85],
];

// Sphere-lock phase: collect this many frames while user looks at center dot
const N_SPHERE_LOCK = 40;

// Per-point timing
const N_SETTLE  = 25;  // frames to wait (let user settle gaze) before collecting
const N_COLLECT = 45;  // frames to collect per calibration point

export const CalibState = Object.freeze({
  IDLE:        "IDLE",
  LOCK_SPHERE: "LOCK_SPHERE",  // Phase 1: locking eye spheres
  RUNNING:     "RUNNING",      // Phase 2: 9-point screen calibration
  COMPUTING:   "COMPUTING",
  READY:       "READY",
});

export class CalibrationManager {
  constructor() {
    this.state      = CalibState.IDLE;
    this.pointIdx   = 0;
    this.frameCount = 0;
    this.samples    = [];   // {yaw,pitch}[] for current point
    this.pairs      = [];   // {u,v,sx,sy}[] all collected pairs
    this._coeffX    = null; // 6 polynomial coefficients for screen_x
    this._coeffY    = null; // 6 polynomial coefficients for screen_y

    /** Called during LOCK_SPHERE phase with progress [0..1].
     *  @type {((progress:number) => void)|null} */
    this.onSphereProgress = null;

    /** Called when sphere locking should happen (return false to abort).
     *  Main.js wires this to lockEyeSpheres().
     *  @type {(() => boolean)|null} */
    this.doLockSpheres = null;

    /** Called when a new calibration dot should be shown.
     *  @type {((sx:number, sy:number, idx:number, total:number) => void)|null} */
    this.onPoint = null;

    /** Called when calibration finishes (success=true) or fails (false).
     *  @type {((success:boolean) => void)|null} */
    this.onComplete = null;
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  get isReady() { return this.state === CalibState.READY; }

  /** Current calibration target, or null if not running. */
  get currentTarget() {
    if (this.state !== CalibState.RUNNING) return null;
    const [sx, sy] = CALIB_POINTS[this.pointIdx];
    return { sx, sy, idx: this.pointIdx, total: CALIB_POINTS.length };
  }

  /**
   * Fraction [0..1] of the current point's collection phase that is complete.
   * 0 during the settle period, ramps to 1 during collection.
   */
  get pointProgress() {
    if (this.state === CalibState.LOCK_SPHERE) {
      return Math.min(1, this.frameCount / N_SPHERE_LOCK);
    }
    if (this.state !== CalibState.RUNNING) return 0;
    return Math.max(0, Math.min(1,
      (this.frameCount - N_SETTLE) / N_COLLECT,
    ));
  }

  // ── Control ─────────────────────────────────────────────────────────────────

  /**
   * Begin calibration.
   * Phase 1 (LOCK_SPHERE): user looks at screen center while we lock the
   *   eye sphere positions in head-local coordinates.
   * Phase 2 (RUNNING): 9-point polynomial screen calibration.
   */
  start() {
    this.state      = CalibState.LOCK_SPHERE;
    this.pointIdx   = 0;
    this.frameCount = 0;
    this.samples    = [];
    this.pairs      = [];
    this._coeffX    = null;
    this._coeffY    = null;
  }

  /** Discard all calibration data and return to IDLE. */
  reset() {
    this.state   = CalibState.IDLE;
    this._coeffX = null;
    this._coeffY = null;
    this.pairs   = [];
    this.samples = [];
  }

  // ── Per-frame update ────────────────────────────────────────────────────────

  /**
   * Feed one frame into the calibration state machine.
   * Safe to call every frame regardless of state.
   *
   * @param {{yaw:number, pitch:number}|null} gazeAngles
   * @returns {string} current CalibState
   */
  feedFrame(gazeAngles) {
    // ── Phase 1: sphere locking ─────────────────────────────────────────────
    if (this.state === CalibState.LOCK_SPHERE) {
      this.frameCount++;
      const progress = Math.min(1, this.frameCount / N_SPHERE_LOCK);
      this.onSphereProgress?.(progress);

      if (this.frameCount >= N_SPHERE_LOCK) {
        // Trigger the actual sphere lock via the injected callback
        const ok = this.doLockSpheres?.() ?? false;
        if (!ok) {
          // No face / matrix available — retry from start
          this.frameCount = 0;
          return this.state;
        }
        // Advance to 9-point screen calibration
        this.state      = CalibState.RUNNING;
        this.frameCount = 0;
        this._notifyPoint();
      }
      return this.state;
    }

    // ── Phase 2: 9-point screen calibration ─────────────────────────────────
    if (this.state !== CalibState.RUNNING || !gazeAngles) return this.state;

    this.frameCount++;
    if (this.frameCount <= N_SETTLE) return this.state;

    this.samples.push({ yaw: gazeAngles.yaw, pitch: gazeAngles.pitch });

    if (this.samples.length >= N_COLLECT) {
      const n = this.samples.length;
      const meanYaw   = this.samples.reduce((s, p) => s + p.yaw,   0) / n;
      const meanPitch = this.samples.reduce((s, p) => s + p.pitch, 0) / n;
      const [sx, sy]  = CALIB_POINTS[this.pointIdx];

      this.pairs.push({ u: meanYaw, v: meanPitch, sx, sy });
      this.samples    = [];
      this.frameCount = 0;
      this.pointIdx++;

      if (this.pointIdx >= CALIB_POINTS.length) {
        this._fit();
      } else {
        this._notifyPoint();
      }
    }

    return this.state;
  }

  // ── Gaze mapping ────────────────────────────────────────────────────────────

  /**
   * Map a raw (yaw, pitch) to a calibrated screen position.
   * Returns null if calibration is not ready.
   *
   * @param {number} yaw   — degrees
   * @param {number} pitch — degrees
   * @returns {{x:number, y:number}|null}  screen fraction [0..1]
   */
  mapGaze(yaw, pitch) {
    if (!this._coeffX || !this._coeffY) return null;
    const f = _polyBasis(yaw, pitch);
    const x = _evalPoly(this._coeffX, f);
    const y = _evalPoly(this._coeffY, f);
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _notifyPoint() {
    const [sx, sy] = CALIB_POINTS[this.pointIdx];
    this.onPoint?.(sx, sy, this.pointIdx, CALIB_POINTS.length);
  }

  _fit() {
    this.state = CalibState.COMPUTING;
    try {
      if (this.pairs.length < 6) throw new Error("Too few calibration points");

      // Design matrix A (N×6) and target vectors
      const A  = this.pairs.map(p => _polyBasis(p.u, p.v));
      const bx = this.pairs.map(p => p.sx);
      const by = this.pairs.map(p => p.sy);

      this._coeffX = _leastSquares(A, bx);
      this._coeffY = _leastSquares(A, by);
      this.state   = CalibState.READY;
      this.onComplete?.(true);
    } catch (err) {
      console.error("[calibration] polynomial fit failed:", err);
      this.state = CalibState.IDLE;
      this.onComplete?.(false);
    }
  }
}

// ── Polynomial helpers ────────────────────────────────────────────────────────

/**
 * Degree-2 bivariate polynomial basis:
 *   [1,  u,  v,  u·v,  u²,  v²]
 */
function _polyBasis(u, v) {
  return [1, u, v, u * v, u * u, v * v];
}

function _evalPoly(coeffs, basis) {
  return coeffs.reduce((s, c, i) => s + c * basis[i], 0);
}

/**
 * Solve Ax ≈ b in the least-squares sense via normal equations.
 *
 * Computes AᵀA·x = Aᵀb then solves the resulting M×M system by
 * Gaussian elimination with partial pivoting.
 *
 * @param {number[][]} A  — N×M design matrix
 * @param {number[]}   b  — N×1 target vector
 * @returns {number[]}    — M×1 coefficient vector
 */
function _leastSquares(A, b) {
  const N = A.length;
  const M = A[0].length;

  // Build AᵀA (M×M) and Aᵀb (M×1)
  const ATA = Array.from({ length: M }, () => new Float64Array(M));
  const ATb = new Float64Array(M);

  for (let i = 0; i < N; i++) {
    for (let r = 0; r < M; r++) {
      ATb[r] += A[i][r] * b[i];
      for (let c = 0; c < M; c++) {
        ATA[r][c] += A[i][r] * A[i][c];
      }
    }
  }

  // Build augmented matrix [ATA | ATb] as plain arrays (mutable)
  const aug = ATA.map((row, r) => [...row, ATb[r]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < M; col++) {
    let maxRow = col;
    for (let row = col + 1; row < M; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const piv = aug[col][col];
    if (Math.abs(piv) < 1e-12) throw new Error("Singular matrix in least-squares");

    for (let row = col + 1; row < M; row++) {
      const factor = aug[row][col] / piv;
      for (let k = col; k <= M; k++) {
        aug[row][k] -= factor * aug[col][k];
      }
    }
  }

  // Back substitution
  const x = new Float64Array(M);
  for (let row = M - 1; row >= 0; row--) {
    x[row] = aug[row][M];
    for (let col = row + 1; col < M; col++) {
      x[row] -= aug[row][col] * x[col];
    }
    x[row] /= aug[row][row];
  }

  return Array.from(x);
}
