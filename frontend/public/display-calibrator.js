// display-calibrator.js
// Determines physical mm/px of the display using a credit card calibration step.
// Credit card ISO standard: 85.6mm × 54.0mm

export const CARD_W_MM = 85.6;
export const CARD_H_MM = 54.0;
const STORAGE_KEY = 'astig_display_cal';

export class DisplayCalibrator {
  constructor() {
    this.mmPerPx   = null;
    this.ppi       = null;
    this.screenHMm = null;
    this._load();
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  _load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (s && s.mmPerPx > 0.04 && s.mmPerPx < 1.2) {
        this.mmPerPx   = s.mmPerPx;
        this.ppi       = s.ppi;
        this.screenHMm = s.screenHMm;
      }
    } catch (_) {}
  }

  save(mmPerPx) {
    this.mmPerPx   = mmPerPx;
    this.ppi       = 25.4 / mmPerPx;
    this.screenHMm = window.screen.height * mmPerPx;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mmPerPx: this.mmPerPx,
      ppi:     this.ppi,
      screenHMm: this.screenHMm,
      ts:      Date.now(),
    }));
  }

  clear() {
    localStorage.removeItem(STORAGE_KEY);
    this.mmPerPx = null;
    this.ppi     = null;
  }

  isCalibrated() {
    return this.mmPerPx != null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Given a measured card size in pixels, compute mm/px
  static fromCardPx(widthPx, heightPx) {
    return ((CARD_W_MM / widthPx) + (CARD_H_MM / heightPx)) / 2;
  }

  // Physical card dimensions in pixels at current calibration
  cardPx() {
    if (!this.mmPerPx) return null;
    return { w: CARD_W_MM / this.mmPerPx, h: CARD_H_MM / this.mmPerPx };
  }

  // Physical screen height in mm
  getScreenHeightMm() {
    return this.screenHMm ?? (this.mmPerPx ? window.screen.height * this.mmPerPx : null);
  }
}
