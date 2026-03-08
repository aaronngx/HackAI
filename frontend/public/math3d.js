// ─────────────────────────────────────────────────────────────────────────────
// math3d.js  –  Vector/matrix math + PCA for 3×3 (no dependencies)
// ─────────────────────────────────────────────────────────────────────────────

// ── Vec3 ──────────────────────────────────────────────────────────────────────
export const v3add  = ([ax,ay,az],[bx,by,bz]) => [ax+bx, ay+by, az+bz];
export const v3sub  = ([ax,ay,az],[bx,by,bz]) => [ax-bx, ay-by, az-bz];
export const v3scale = ([x,y,z], s) => [x*s, y*s, z*s];
export const v3dot  = ([ax,ay,az],[bx,by,bz]) => ax*bx + ay*by + az*bz;
export const v3cross = ([ax,ay,az],[bx,by,bz]) => [ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx];
export const v3norm  = ([x,y,z]) => Math.sqrt(x*x + y*y + z*z);
export function v3normalize(v) {
  const n = v3norm(v);
  return n > 1e-9 ? v3scale(v, 1/n) : [...v];
}

// ── Mat3×3  (nested rows: M[row][col]) ───────────────────────────────────────
export const m3identity = () => [[1,0,0],[0,1,0],[0,0,1]];

export function m3MulV3(M, v) {
  return [
    M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
    M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
    M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2],
  ];
}

export function m3transpose(M) {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}

export function m3det(M) {
  return (
    M[0][0] * (M[1][1]*M[2][2] - M[1][2]*M[2][1]) -
    M[0][1] * (M[1][0]*M[2][2] - M[1][2]*M[2][0]) +
    M[0][2] * (M[1][0]*M[2][1] - M[1][1]*M[2][0])
  );
}

// Build matrix from three column vectors
export function m3fromCols(c0, c1, c2) {
  return [
    [c0[0], c1[0], c2[0]],
    [c0[1], c1[1], c2[1]],
    [c0[2], c1[2], c2[2]],
  ];
}

// Rotation matrices (same convention as Python's _rot_x / _rot_y)
export function m3rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[1,0,0],[0,c,-s],[0,s,c]];
}
export function m3rotY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c,0,s],[0,1,0],[-s,0,c]];
}

// ── Average pairwise distance (scale invariant measure) ───────────────────────
export function computeScale(pts) {
  let total = 0, count = 0;
  for (let i = 0; i < pts.length; i++)
    for (let j = i+1; j < pts.length; j++) {
      total += v3norm(v3sub(pts[i], pts[j]));
      count++;
    }
  return count > 0 ? total / count : 1;
}

// ── Jacobi eigen decomposition for 3×3 symmetric matrix ─────────────────────
// Returns { values:[λ0,λ1,λ2], R: M where columns are eigenvectors }
export function jacobiEigen3(S) {
  const A = [S[0].slice(), S[1].slice(), S[2].slice()];
  const V = [[1,0,0],[0,1,0],[0,0,1]]; // eigenvector columns accumulate here

  for (let iter = 0; iter < 50; iter++) {
    // Find largest off-diagonal element
    let maxVal = 0, p = 0, q = 1;
    for (let i = 0; i < 3; i++)
      for (let j = i+1; j < 3; j++)
        if (Math.abs(A[i][j]) > maxVal) { maxVal = Math.abs(A[i][j]); p = i; q = j; }
    if (maxVal < 1e-10) break;

    // Givens angle that zeroes A[p][q]
    const phi = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
    const c = Math.cos(phi), s = Math.sin(phi);

    // A' = Gᵀ A G  (similarity transform)
    const Ap = [A[0].slice(), A[1].slice(), A[2].slice()];
    for (let k = 0; k < 3; k++) {
      if (k === p || k === q) continue;
      Ap[k][p] = Ap[p][k] = c*A[k][p] - s*A[k][q];
      Ap[k][q] = Ap[q][k] = s*A[k][p] + c*A[k][q];
    }
    Ap[p][p] = c*c*A[p][p] - 2*s*c*A[p][q] + s*s*A[q][q];
    Ap[q][q] = s*s*A[p][p] + 2*s*c*A[p][q] + c*c*A[q][q];
    Ap[p][q] = Ap[q][p] = 0;
    for (let i = 0; i < 3; i++) A[i] = Ap[i];

    // V = V * G  (accumulate eigenvectors from right)
    for (let k = 0; k < 3; k++) {
      const vp = c*V[k][p] - s*V[k][q];
      const vq = s*V[k][p] + c*V[k][q];
      V[k][p] = vp; V[k][q] = vq;
    }
  }

  return { values: [A[0][0], A[1][1], A[2][2]], R: V };
}

// ── PCA on a set of 3D points ─────────────────────────────────────────────────
// Returns { center, R } where R columns are eigenvectors sorted by descending eigenvalue.
export function computePCA3(pts) {
  const n = pts.length;
  const cx = pts.reduce((s,p)=>s+p[0],0)/n;
  const cy = pts.reduce((s,p)=>s+p[1],0)/n;
  const cz = pts.reduce((s,p)=>s+p[2],0)/n;
  const center = [cx, cy, cz];

  // 3×3 covariance
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (const p of pts) {
    const d = [p[0]-cx, p[1]-cy, p[2]-cz];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        C[i][j] += d[i]*d[j];
  }
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      C[i][j] /= n;

  const { values, R } = jacobiEigen3(C);

  // Sort columns by descending eigenvalue
  const ord = [0,1,2].sort((a,b) => values[b] - values[a]);
  const Rsorted = m3fromCols(
    [R[0][ord[0]], R[1][ord[0]], R[2][ord[0]]],
    [R[0][ord[1]], R[1][ord[1]], R[2][ord[1]]],
    [R[0][ord[2]], R[1][ord[2]], R[2][ord[2]]],
  );

  // Ensure right-handed (det > 0)
  if (m3det(Rsorted) < 0) {
    Rsorted[0][2] *= -1;
    Rsorted[1][2] *= -1;
    Rsorted[2][2] *= -1;
  }

  return { center, R: Rsorted, eigenvalues: ord.map(i => values[i]) };
}
