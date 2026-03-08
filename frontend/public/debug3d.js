// ─────────────────────────────────────────────────────────────────────────────
// debug3d.js  –  Orbit-camera 3-D debug renderer (port of Python's
//               render_debug_view_orbit).  No external dependencies.
// Controls: mouse-drag to orbit, scroll to zoom.
// ─────────────────────────────────────────────────────────────────────────────

import {
  v3add, v3sub, v3scale, v3normalize, v3dot, v3norm, v3cross,
  m3MulV3, m3rotX, m3rotY,
} from '/math3d.js';

export class Debug3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    // Default view: oblique angle matching Python default
    this.yaw    = -2.637; // ≈ −151°
    this.pitch  = 0;
    this.radius = 1500;
    this.fovDeg = 50;
    this._bindInput();
  }

  _bindInput() {
    let drag = false, lx = 0, ly = 0;
    this.canvas.addEventListener('mousedown', e => {
      drag = true; lx = e.clientX; ly = e.clientY;
      e.preventDefault();
    });
    window.addEventListener('mouseup',   () => { drag = false; });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      this.yaw    += (e.clientX - lx) * 0.012;
      this.pitch   = Math.max(-Math.PI/2 + 0.01,
                     Math.min( Math.PI/2 - 0.01,
                               this.pitch - (e.clientY - ly) * 0.012));
      lx = e.clientX; ly = e.clientY;
    });
    this.canvas.addEventListener('wheel', e => {
      this.radius = Math.max(80, this.radius + e.deltaY * 0.4);
    }, { passive: true });
  }

  // ── Project one world point to canvas pixel ─────────────────────────────────
  _proj(P, camPos, V, fPx) {
    const cw = this.canvas.width, ch = this.canvas.height;
    const Pc = m3MulV3(V, v3sub(P, camPos));
    if (Pc[2] <= 0.001) return null;
    const x = fPx * (Pc[0] / Pc[2]) + cw * 0.5;
    const y = -fPx * (Pc[1] / Pc[2]) + ch * 0.5;
    if (!isFinite(x) || !isFinite(y)) return null;
    return [Math.round(x), Math.round(y)];
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  render(opts = {}) {
    const { canvas, ctx } = this;
    const cw = canvas.width, ch = canvas.height;

    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, cw, ch);

    const {
      headCenter,
      sphereL, sphereR,
      irisL, irisR,
      lockedL = false, lockedR = false,
      landmarks,
      combinedDir,
      gazeLen = 3000,
      monitorCorners,
      monitorCenter,
      monitorNormal,
      gazeMarkers = [],
    } = opts;

    if (!headCenter) {
      ctx.fillStyle = '#444'; ctx.font = '13px system-ui';
      ctx.fillText('No face detected', 10, 20);
      return;
    }

    // ── Camera setup ──────────────────────────────────────────────────────────
    const fPx    = (cw / 2) / Math.tan(this.fovDeg * Math.PI / 360);
    const pivot  = monitorCenter
      ? v3scale(v3add(headCenter, monitorCenter), 0.5)
      : headCenter;

    const offset  = m3MulV3(m3rotY(this.yaw), m3MulV3(m3rotX(this.pitch), [0,0,this.radius]));
    const camPos  = v3add(pivot, offset);
    const fwd     = v3normalize(v3sub(pivot, camPos));
    const worldUp = [0, -1, 0];
    const right   = v3normalize(v3cross(fwd, worldUp));
    const up      = v3normalize(v3cross(right, fwd));
    const V       = [right, up, fwd]; // view matrix rows

    const proj = P => this._proj(P, camPos, V, fPx);

    // ── Draw helpers ──────────────────────────────────────────────────────────
    const line = (A, B, color, lw = 1) => {
      const a = proj(A), b = proj(B); if (!a || !b) return;
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
    };

    const cross3d = (P, size, color) => {
      const c = proj(P); if (!c) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c[0]-size,c[1]); ctx.lineTo(c[0]+size,c[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c[0],c[1]-size); ctx.lineTo(c[0],c[1]+size); ctx.stroke();
    };

    const arrow3d = (A, B, color, lw = 2) => {
      const a = proj(A), b = proj(B); if (!a || !b) return;
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
      const dx = b[0]-a[0], dy = b[1]-a[1], len = Math.hypot(dx,dy);
      if (len < 2) return;
      const ux = dx/len, uy = dy/len, ah = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0]-ux*ah+uy*ah*0.5, b[1]-uy*ah-ux*ah*0.5);
      ctx.lineTo(b[0]-ux*ah-uy*ah*0.5, b[1]-uy*ah+ux*ah*0.5);
      ctx.fill();
    };

    const label3d = (P, text, color) => {
      const c = proj(P); if (!c) return;
      ctx.fillStyle = color; ctx.font = '11px system-ui';
      ctx.fillText(text, c[0]+8, c[1]-6);
    };

    // ── Landmarks (tiny dots) ─────────────────────────────────────────────────
    if (landmarks) {
      ctx.fillStyle = '#383860';
      for (const P of landmarks) {
        const c = proj(P); if (!c) continue;
        ctx.fillRect(c[0]-1, c[1]-1, 2, 2);
      }
    }

    // ── Head center ───────────────────────────────────────────────────────────
    cross3d(headCenter, 10, '#FF44FF');
    label3d(headCenter, 'Head', '#FF44FF');

    // ── Eye spheres + per-eye gaze rays ───────────────────────────────────────
    const drawEye = (sphere, iris, locked, ringColor, rayColor) => {
      if (locked && sphere) {
        const sc = proj(sphere);
        if (sc) {
          // Approximate screen radius from a point 20 units to the side
          const side = proj(v3add(sphere, [20, 0, 0]));
          const rpx  = side ? Math.max(3, Math.abs(side[0] - sc[0])) : 5;
          ctx.beginPath(); ctx.strokeStyle = ringColor; ctx.lineWidth = 1.5;
          ctx.arc(sc[0], sc[1], rpx, 0, Math.PI*2); ctx.stroke();
        }
        if (iris) {
          const d = v3normalize(v3sub(iris, sphere));
          line(sphere, v3add(sphere, v3scale(d, gazeLen)), rayColor, 1);
        }
      } else if (iris) {
        const ic = proj(iris); if (!ic) return;
        ctx.beginPath(); ctx.strokeStyle = ringColor; ctx.lineWidth = 1;
        ctx.arc(ic[0], ic[1], 3, 0, Math.PI*2); ctx.stroke();
      }
    };

    drawEye(sphereL, irisL, lockedL, '#FFFF19', '#9B9B19');
    drawEye(sphereR, irisR, lockedR, '#19FFFF', '#199B9B');

    // ── Combined gaze arrow ───────────────────────────────────────────────────
    if (lockedL && lockedR && sphereL && sphereR && combinedDir) {
      const origin = v3scale(v3add(sphereL, sphereR), 0.5);
      const tip    = v3add(origin, v3scale(v3normalize(combinedDir), gazeLen * 1.2));
      arrow3d(origin, tip, '#9BC80A', 2);
    }

    // ── Monitor plane wireframe ───────────────────────────────────────────────
    if (monitorCorners?.length === 4) {
      const [p0,p1,p2,p3] = monitorCorners;
      for (const [A,B] of [[p0,p1],[p1,p2],[p2,p3],[p3,p0]]) line(A, B, '#00C8FF', 2);
      line(p0, p2, '#0096D2', 1);
      line(p1, p3, '#0096D2', 1);
      if (monitorCenter) {
        cross3d(monitorCenter, 7, '#00C8FF');
        if (monitorNormal) {
          const tip = v3add(monitorCenter, v3scale(monitorNormal, 60));
          arrow3d(monitorCenter, tip, '#00DCFF', 2);
        }
      }
    }

    // ── Stored gaze markers ───────────────────────────────────────────────────
    if (gazeMarkers.length && monitorCorners) {
      const [p0,p1,,p3] = monitorCorners;
      const u = v3sub(p1, p0), v_ = v3sub(p3, p0);
      for (const [a, b] of gazeMarkers) {
        const Pm = v3add(p0, v3add(v3scale(u, a), v3scale(v_, b)));
        const c  = proj(Pm); if (!c) continue;
        ctx.beginPath(); ctx.strokeStyle = '#00FF44'; ctx.lineWidth = 1.5;
        ctx.arc(c[0], c[1], 5, 0, Math.PI*2); ctx.stroke();
      }
    }

    // ── Live gaze hit circle on monitor plane ─────────────────────────────────
    if (monitorCorners && monitorCenter && monitorNormal && combinedDir && sphereL && sphereR) {
      const O = v3scale(v3add(sphereL, sphereR), 0.5);
      const D = v3normalize(combinedDir);
      const N = v3normalize(monitorNormal);
      const denom = v3dot(N, D);
      if (Math.abs(denom) > 1e-6) {
        const t = v3dot(N, v3sub(monitorCenter, O)) / denom;
        if (t > 0) {
          const P    = v3add(O, v3scale(D, t));
          const [p0,p1,,p3] = monitorCorners;
          const u    = v3sub(p1, p0), vv = v3sub(p3, p0);
          const wv   = v3sub(P, p0);
          const ul2  = v3dot(u, u), vl2 = v3dot(vv, vv);
          if (ul2 > 1e-9 && vl2 > 1e-9) {
            const a = v3dot(wv, u) / ul2, b = v3dot(wv, vv) / vl2;
            if (a >= 0 && a <= 1 && b >= 0 && b <= 1) {
              const c = proj(P); if (c) {
                ctx.beginPath(); ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2;
                ctx.arc(c[0], c[1], 9, 0, Math.PI*2); ctx.stroke();
              }
            }
          }
        }
      }
    }

    // ── HUD: controls help ────────────────────────────────────────────────────
    const help = ['Drag: orbit', 'Scroll: zoom', 'C: lock eyes', 'Calib btn: gaze dots'];
    ctx.fillStyle = '#445'; ctx.font = '10px system-ui';
    help.forEach((t, i) => ctx.fillText(t, 6, ch - 6 - i*13));

    // ── Sphere lock status ────────────────────────────────────────────────────
    ctx.fillStyle = (lockedL && lockedR) ? '#00FF88' : '#FF6644';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText((lockedL && lockedR) ? '● Spheres locked' : '○ Press C to lock eyes', 6, 14);
  }
}
