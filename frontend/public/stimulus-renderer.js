// stimulus-renderer.js
// Renders psychophysical stimuli for astigmatism screening.
// All stimuli dynamically rescale to maintain constant angular size (CPD)
// as face-to-screen distance changes.
//
// Circle-based rendering (Stages 2–5) uses OffscreenCanvas + destination-in
// compositing so the circle mask is fully isolated from the caller's canvas state.

// Paper-aligned color constants (Salmeron-Campillo et al. 2025)
// Stages 2–4: BLUE  |  Stage 5 primary: RED  |  Stage 5 fallback: BLUE
export const STIM_BLUE = '#0088FF';
export const STIM_RED  = '#FF2200';

export class StimulusRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
  }

  // ── Core geometry helpers ──────────────────────────────────────────────────
  static periodPx(targetCPD, distMm, mmPerPx) {
    if (!targetCPD || targetCPD <= 0 || !distMm || distMm <= 0 || !mmPerPx || mmPerPx <= 0) return 0;
    const cycleMm = distMm * Math.tan((1 / targetCPD) * Math.PI / 180);
    return cycleMm / mmPerPx;
  }

  static maxCPD(distMm, mmPerPx) {
    return StimulusRenderer.cpdFromPeriod(2, distMm, mmPerPx);
  }

  static cpdFromPeriod(periodPx, distMm, mmPerPx) {
    const cycleDeg = Math.atan((periodPx * mmPerPx) / distMm) * 180 / Math.PI;
    return 1 / cycleDeg;
  }

  static fixDotPx(distMm, mmPerPx, subtendDeg = 0.5) {
    const r_mm = distMm * Math.tan((subtendDeg / 2) * Math.PI / 180);
    return Math.max(5, r_mm / mmPerPx);
  }

  // ── Dark variant helper ────────────────────────────────────────────────────
  static _darkVariant(cssColor, factor = 0.22) {
    const hex = cssColor.replace('#', '');
    if (hex.length !== 6) return '#111';
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
  }

  // ── Helper: draw tripole stripes onto a context ────────────────────────────
  static _drawStripes(targetCtx, cx, cy, angleDeg, period, radius, color) {
    if (period < 2) return;
    targetCtx.save();
    targetCtx.translate(cx, cy);
    targetCtx.rotate(angleDeg * Math.PI / 180);
    const diag   = Math.ceil(radius * 2.8);
    const duty   = period / 3;   // bright stripe = 1/3 of period (tripole)
    const offset = period / 3;   // centre the bright bar within each period
    targetCtx.fillStyle = color;
    for (let x = -diag; x < diag; x += period) {
      targetCtx.fillRect(x + offset, -diag, duty, diag * 2);
    }
    targetCtx.restore();
  }

  // ── Build a circle-grating image on an OffscreenCanvas ────────────────────
  // Returns an OffscreenCanvas that can be blitted with ctx.drawImage(off, 0, 0)
  _makeCircleGratingOff({ cx, cy, radius, angleDeg, period, color, W, H }) {
    const dark = StimulusRenderer._darkVariant(color, 0.22);

    // ① Grating layer: dark base + bright stripes
    const grat = new OffscreenCanvas(W, H);
    const gc   = grat.getContext('2d');
    gc.fillStyle = dark;
    gc.fillRect(0, 0, W, H);
    StimulusRenderer._drawStripes(gc, cx, cy, angleDeg, period, radius, color);

    // ② Circle mask (white circle on transparent background)
    const mask  = new OffscreenCanvas(W, H);
    const mc    = mask.getContext('2d');
    mc.fillStyle = '#fff';
    mc.beginPath();
    mc.arc(cx, cy, radius, 0, Math.PI * 2);
    mc.fill();

    // ③ Apply mask: keep grating pixels only where mask is opaque
    gc.globalCompositeOperation = 'destination-in';
    gc.drawImage(mask, 0, 0);
    gc.globalCompositeOperation = 'source-over';

    return grat;
  }

  // ── Draw a grating inside a filled circle (paper Stage 3/4/5) ─────────────
  drawCircleGrating({
    angleDeg    = 0,
    cpd         = 3,
    distMm      = 400,
    mmPerPx     = 0.18,
    color       = STIM_BLUE,
    fixationDot = true,
    cx, cy, radius,
  }) {
    const { ctx, canvas: c } = this;
    const W = c.width, H = c.height;
    cx     = cx     ?? W / 2;
    cy     = cy     ?? H / 2;
    radius = radius ?? Math.min(W, H) * 0.38;

    const rawPeriod = StimulusRenderer.periodPx(cpd, distMm, mmPerPx);
    const maxPeriod = radius / 4;   // ≥ 8 stripes always visible across diameter
    const period    = rawPeriod > 0
      ? Math.min(rawPeriod, maxPeriod)
      : Math.max(3, radius / 12);
    const off    = this._makeCircleGratingOff({ cx, cy, radius, angleDeg, period, color, W, H });
    ctx.drawImage(off, 0, 0);

    if (fixationDot) {
      const r = StimulusRenderer.fixDotPx(distMm, mmPerPx);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Draw two stacked axis-comparison circles (Stage 3) ────────────────────
  drawDualAxisCircles({ angle1, angle2, cpd, distMm, mmPerPx, color = STIM_BLUE }) {
    const { ctx, canvas: c } = this;
    const W = c.width, H = c.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Reserve vertical space for question text (top) and hint text (bottom)
    const topRes = Math.max(42, H * 0.08);
    const botRes = Math.max(30, H * 0.05);
    const avail  = H - topRes - botRes;

    // Gap between the two circles
    const gap = Math.max(12, H * 0.03);

    // Radius: 4R + gap must fit in avail; also cap by width
    const R   = Math.min(W * 0.38, (avail - gap) / 4);

    // Position both circles centred within the available zone
    const totalH = R * 4 + gap;
    const cy1    = topRes + (avail - totalH) / 2 + R;
    const cy2    = cy1 + 2 * R + gap;

    // Period: compute from CPD/distance, then hard-cap so ≥ 8 stripes are
    // always visible across the diameter (guards against bad calibration).
    const rawPeriod = StimulusRenderer.periodPx(cpd, distMm, mmPerPx);
    const maxPeriod = R / 4;          // guarantees ≥ 8 stripes in diameter
    const period    = rawPeriod > 0
      ? Math.min(rawPeriod, maxPeriod)
      : Math.max(3, R / 12);         // fallback: ~24 fine stripes

    const off1 = this._makeCircleGratingOff({ cx: W/2, cy: cy1, radius: R, angleDeg: angle1, period, color, W, H });
    const off2 = this._makeCircleGratingOff({ cx: W/2, cy: cy2, radius: R, angleDeg: angle2, period, color, W, H });
    ctx.drawImage(off1, 0, 0);
    ctx.drawImage(off2, 0, 0);

    // Fixation dots
    const fd = StimulusRenderer.fixDotPx(distMm, mmPerPx);
    ctx.fillStyle = '#000';
    for (const cy of [cy1, cy2]) {
      ctx.beginPath(); ctx.arc(W/2, cy, fd, 0, Math.PI*2); ctx.fill();
    }

    // Minimal labels: just tiny 1/2 markers beside each circle
    const lblPx = Math.max(11, R * 0.11);
    ctx.font         = `600 ${lblPx}px sans-serif`;
    ctx.textAlign    = 'right';
    ctx.fillStyle    = 'rgba(255,255,255,0.25)';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', W/2 - R - 8, cy1);
    ctx.fillText('2', W/2 - R - 8, cy2);
  }

  // ── Draw blank fixation screen ─────────────────────────────────────────────
  drawFixation(crossColor = '#333') {
    const { ctx, canvas: c } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height / 2;
    ctx.strokeStyle = crossColor;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12);
    ctx.stroke();
  }

  // ── Letter target for axis-check positioning (Stage 2) ────────────────────
  drawLetterTarget({ distMm, mmPerPx, color = STIM_BLUE, letter = 'P', sizeDeg = 5 }) {
    const { ctx, canvas: c } = this;
    const W = c.width, H = c.height;
    const cx = W / 2, cy = H / 2;
    const R  = Math.min(W, H) * 0.42;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // No on-canvas instruction text — overlay handles guidance

    // ── Build letter inside circle via OffscreenCanvas ────────────────────────
    const off  = new OffscreenCanvas(W, H);
    const ox   = off.getContext('2d');

    // Dark base circle
    ox.fillStyle = StimulusRenderer._darkVariant(color, 0.25);
    ox.beginPath();
    ox.arc(cx, cy, R, 0, Math.PI * 2);
    ox.fill();

    // Letter has a FIXED physical size on screen (same as far-point grating fix).
    // Using live distMm would make the letter grow as the user walks back, which
    // defeats the purpose — blur from defocus should be what makes it disappear.
    const REF_DIST_MM = 400;
    const sizeMm      = REF_DIST_MM * Math.tan(sizeDeg * Math.PI / 180);
    const mmPerPxSafe = (mmPerPx > 0 && isFinite(mmPerPx)) ? mmPerPx : 0.18;
    const sizePx      = Math.max(R * 0.55, Math.min(R * 1.0, sizeMm / mmPerPxSafe));

    ox.font         = `900 ${Math.round(sizePx)}px monospace`;
    ox.textAlign    = 'center';
    ox.textBaseline = 'middle';

    // Dim fill (intermediate layer of tripole)
    ox.globalAlpha = 0.50;
    ox.fillStyle   = color;
    ox.fillText(letter, cx, cy);

    // Bright outline (bright edge of tripole)
    ox.globalAlpha = 1.0;
    ox.strokeStyle = color;
    ox.lineWidth   = Math.max(3, sizePx * 0.05);
    ox.strokeText(letter, cx, cy);

    // Mask to circle using destination-in
    const mask = new OffscreenCanvas(W, H);
    const mCtx = mask.getContext('2d');
    mCtx.fillStyle = '#fff';
    mCtx.beginPath();
    mCtx.arc(cx, cy, R, 0, Math.PI * 2);
    mCtx.fill();
    ox.globalCompositeOperation = 'destination-in';
    ox.drawImage(mask, 0, 0);

    ctx.drawImage(off, 0, 0);

    // Sub-instruction removed — floating panel handles this
  }

  // ── Full-screen grating (square-wave or tripole) — legacy stages ───────────
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

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const period = StimulusRenderer.periodPx(cpd, distMm, mmPerPx);
    if (period < 1) return;

    const duty   = type === 'tripole' ? period / 3 : period / 2;
    const offset = type === 'tripole' ? period / 3 : 0;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(angleDeg * Math.PI / 180);
    const diag = Math.ceil(Math.sqrt(W * W + H * H));
    ctx.fillStyle = color;
    for (let x = -diag; x < diag; x += period) {
      ctx.fillRect(x + offset, -diag, duty, diag * 2);
    }
    ctx.restore();

    if (fixationDot) {
      const r = StimulusRenderer.fixDotPx(distMm, mmPerPx);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Debug overlay ─────────────────────────────────────────────────────────
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
