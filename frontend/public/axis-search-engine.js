// axis-search-engine.js
// Iterative pairwise blur-comparison to find astigmatic axis.
// [Research fact] High-contrast lines, pairwise comparison, user picks sharper.
// [Inference] Tournament bracket structure across 18 candidates at 10° steps.

export class AxisSearchEngine {
  constructor() {
    // 18 candidates: 0°, 10°, 20° … 170°
    this._all       = Array.from({ length: 18 }, (_, i) => i * 10);
    this._phase     = 1;  // 1=cross-axis pairs, 2=tournament, 3=refinement
    this._queue     = []; // pairs waiting to be shown
    this._byes      = []; // automatic winners (odd-man-out in tournament)
    this._winners   = []; // winners of completed comparisons
    this._history   = []; // { pair, winner, responseMs }
    this._done      = false;
    this._finalAxis = null;

    this._buildPhase1();
  }

  // ── Phase builders ──────────────────────────────────────────────────────────

  _buildPhase1() {
    // 9 cross-axis pairs — each angle vs its perpendicular (90° apart)
    const half = this._all.length / 2; // 9
    this._queue = [];
    for (let i = 0; i < half; i++) {
      this._queue.push([this._all[i], this._all[i + half]]);
    }
  }

  _buildPhase2(candidates) {
    // Shuffle to avoid position bias, then pair sequentially
    const w = [...candidates];
    for (let i = w.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [w[i], w[j]] = [w[j], w[i]];
    }
    this._queue = [];
    this._byes  = [];
    for (let i = 0; i + 1 < w.length; i += 2) this._queue.push([w[i], w[i + 1]]);
    if (w.length % 2 === 1) this._byes = [w[w.length - 1]]; // odd one gets a bye
  }

  _buildPhase3(best) {
    // Fine-tune: compare best vs ±5° and ±10°
    const cands = [
      best,
      (best +  5) % 180,
      (best - 5 + 180) % 180,
      (best + 10) % 180,
      (best - 10 + 180) % 180,
    ];
    this._queue = [];
    for (let i = 1; i < cands.length; i++) {
      this._queue.push([cands[0], cands[i]]);
    }
    this._byes = [];
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Returns the next [angleA, angleB] pair to show, or null if done. */
  nextPair() {
    if (this._done) return null;
    return this._queue[0] ?? null;
  }

  /**
   * Record user's response for the current pair.
   * @param {1|2} response  1 = first shown was sharper, 2 = second
   * @param {number} [responseMs] reaction time (optional)
   */
  recordResponse(response, responseMs = 0) {
    if (!this._queue.length) return;
    const pair   = this._queue.shift();
    const winner = response === 1 ? pair[0] : pair[1];
    this._history.push({ pair, winner, responseMs });
    this._winners.push(winner);

    if (this._queue.length > 0) return; // more pairs in this phase

    // Phase transition
    if (this._phase === 1) {
      this._phase   = 2;
      this._winners = [];
      this._buildPhase2([...this._history.map(h => h.winner)]);

    } else if (this._phase === 2) {
      const all = [...this._winners, ...this._byes];
      if (all.length > 1) {
        // More tournament rounds needed
        this._winners = [];
        this._buildPhase2(all);
      } else {
        // Tournament champion — refine
        this._phase   = 3;
        this._winners = [];
        this._buildPhase3(all[0]);
      }

    } else if (this._phase === 3) {
      this._finalAxis = this._computeFinalAxis();
      this._done      = true;
    }
  }

  isDone()       { return this._done; }
  getFinalAxis() { return this._finalAxis; }

  getProgress() {
    const done  = this._history.length;
    const remaining = this._queue.length;
    // Approximate total: 9 (p1) + ~8 (p2) + 4 (p3) = ~21
    const total = Math.max(21, done + remaining);
    return { done, total, pct: Math.round(done / total * 100) };
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _computeFinalAxis() {
    // Axis with most wins across all comparisons
    const counts = {};
    for (const h of this._history) {
      counts[h.winner] = (counts[h.winner] || 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? parseInt(best[0]) : 0;
  }
}
