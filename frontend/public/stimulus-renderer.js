// stimulus-renderer.js
// Renders psychophysical stimuli (gratings, tripole) for astigmatism screening.
// All stimuli are dynamically rescaled to maintain constant angular size (CPD)
// as the user's face-to-screen distance changes.

export class StimulusRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
  }

  // ── Core: compute grating period in pixels ─────────────────────────────────
  /**
   * How many pixels wide is one full cycle (dark+light) of a grating
   * that appears at targetCPD cycles/degree when viewed from distMm?
   *
   * @param {number} targetCPD   - desired spatial frequency (cycles/degree)
   * @param {number} distMm      - face-to-screen distance (mm)
   * @param {number} mmPerPx     - physical mm per CSS pixel
   * @returns {number} period in pixels
   */
  static periodPx(targetCPD, distMm, mmPerPx) {
    if (targetCPD <= 0 || distMm <= 0 || mmPerPx <= 0) return 0;
    const cycleDeg = 1 / targetCPD;                               // degrees per cycle
    const cycleMm  = distMm * Math.tan(cycleDeg * Math.PI / 180); // mm per cycle on screen
    return cycleMm / mmPerPx;                                      // px per cycle
  }

  // ── Maximum displayable CPD given current screen + distance ────────────────
  static maxCPD(distMm, mmPerPx) {
    // Nyquist: minimum resolvable stripe = 2px, so min period = 2px
    return StimulusRenderer.cpdFromPeriod(2, distMm, mmPerPx);
  }

  static cpdFromPeriod(periodPx, distMm, mmPerPx) {
    const cycleMm  = periodPx * mmPerPx;
    const cycleDeg = Math.atan(cycleMm / distMm) * 180 / Math.PI;
    return 1 / cycleDeg;
  }

  // ── Fixation dot radius in pixels ─────────────────────────────────────────
  static fixDotPx(distMm, mmPerPx, subtendDeg = 0.5) {
    const r_mm = distMm * Math.tan((subtendDeg / 2) * Math.PI / 180);
    return Math.max(5, r_mm / mmPerPx);
  }

  // ── Clear canvas to black ─────────────────────────────────────────────────
  clear() {
    const { ctx, canvas: c } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
  }

  // ── Draw a grating (square-wave) or tripole ────────────────────────────────
  /**
   * @param {object} opts
   * @param {number}  opts.angleDeg    - orientation of lines (0 = vertical)
   * @param {number}  opts.cpd         - spatial frequency in cycles/degree
   * @param {number}  opts.distMm      - viewing distance in mm
   * @param {number}  opts.mmPerPx     - display calibration
   * @param {string}  opts.color       - CSS color string ('#FF0000' | '#0000FF' | '#fff')
   * @param {boolean} opts.fixationDot - draw central black fixation circle
   * @param {'grating'|'tripole'} opts.type
   */
  drawGrating({
    angleDeg    = 0,
    cpd         = 3,
    distMm      = 400,
    mmPerPx     = 0.18,
    color       = '#FF0000',
    fixationDot = true,
    type        = 'grating',
  }) {
    const { ctx, canvas: c } = this;
    const W = c.width, H = c.height;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const period = StimulusRenderer.periodPx(cpd, distMm, mmPerPx);
    if (period < 1) return; // below Nyquist — nothing to draw

    // Duty width: 50% for grating, 1/3 for tripole
    const duty = type === 'tripole' ? period / 3 : period / 2;

    // Draw stripes on a rotated context
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(angleDeg * Math.PI / 180);

    const diag = Math.ceil(Math.sqrt(W * W + H * H));
    // For tripole, offset the bright bar to the CENTRE third (dark-bright-dark)
    const offset = type === 'tripole' ? period / 3 : 0;
    ctx.fillStyle = color;
    for (let x = -diag; x < diag; x += period) {
      ctx.fillRect(x + offset, -diag, duty, diag * 2);
    }
    ctx.restore();

    // Central fixation dot (black circle — for line target, omit for letter/MDSF)
    if (fixationDot) {
      const r = StimulusRenderer.fixDotPx(distMm, mmPerPx);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Draw blank fixation screen (for inter-stimulus intervals) ─────────────
  drawFixation(crossColor = '#333') {
    const { ctx, canvas: c } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height / 2;
    ctx.strokeStyle = crossColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12);
    ctx.stroke();
  }

  // ── Draw debug overlay (period px, CPD, distance) ─────────────────────────
  drawDebugOverlay({ cpd, distMm, mmPerPx, period, label = '' }) {
    const { ctx, canvas: c } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 8, 280, 70);
    ctx.fillStyle = '#00FF88';
    ctx.font = '12px monospace';
    const lines = [
      `dist:   ${distMm ? (distMm/10).toFixed(1) : '?'} cm`,
      `cpd:    ${cpd?.toFixed(2)} | period: ${period?.toFixed(1)} px`,
      `maxCPD: ${distMm ? StimulusRenderer.maxCPD(distMm, mmPerPx).toFixed(1) : '?'}`,
      label,
    ];
    lines.forEach((l, i) => ctx.fillText(l, 14, 26 + i * 16));
    ctx.restore();
  }
}
