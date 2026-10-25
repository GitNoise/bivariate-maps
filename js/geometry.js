// El Niño × food security: small geometry helpers for label placement and arrows. Points are [x, y]; boxes are [x0, y0, x1, y1].

// bounding box of a list of points
function bbox(points){
  const [x0, x1] = d3.extent(points, p => p[0]);
  const [y0, y1] = d3.extent(points, p => p[1]);
  return [x0, y0, x1, y1];
}

// the ring with the largest area (outer rings and holes alike), e.g. a country's main piece
const largestRing = rings => d3.greatest(rings, r => Math.abs(d3.polygonArea(r)));

// do two boxes overlap?
const boxesOverlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

// is the point strictly inside the box?
const insideBox = (p, b) => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3];

// squared distance from point p to the segment ab
function segDist2(p, a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let q = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
  q = Math.max(0, Math.min(1, q));
  const ex = p[0] - a[0] - q * dx, ey = p[1] - a[1] - q * dy;
  return ex * ex + ey * ey;
}

// ---- label boxes given by centre (x, y) and size (w, h) ------------------------------------------------
// push two overlapping labels apart, half each, along the shorter way
function pushApart(a, b, pad){
  const ox = (a.w + b.w) / 2 + 2 * pad - Math.abs(a.x - b.x);
  const oy = (a.h + b.h) / 2 + 2 * pad - Math.abs(a.y - b.y);
  if(ox <= 0 || oy <= 0) return;
  if(ox < oy){
    const d = (a.x < b.x ? -1 : 1) * ox / 2;
    a.x += d; b.x -= d;
  } else {
    const d = (a.y < b.y ? -1 : 1) * oy / 2;
    a.y += d; b.y -= d;
  }
}

// keep a label inside the map frame, at least `edge` from each side
function clampToFrame(n, edge){
  n.x = Math.max(edge + n.w / 2, Math.min(MAP_WIDTH - edge - n.w / 2, n.x));
  n.y = Math.max(edge + n.h / 2, Math.min(MAP_HEIGHT - edge - n.h / 2, n.y));
}

// ---- swoopy arrows (after bizweekgraphics/swoopyarrows): a circular arc from p0 to p1 ---------------------
// angle: how far the arc bends (0 = straight); sweep: which way (1 or 0)
function swoopPath(p0, p1, angle, sweep){
  const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if(!angle || d < 1e-6) return `M${p0[0]},${p0[1]}L${p1[0]},${p1[1]}`;
  const r = d / (2 * Math.sin(angle / 2));
  return `M${p0[0]},${p0[1]}A${r},${r} 0 0,${sweep} ${p1[0]},${p1[1]}`;
}

// the same arc as a polyline of n segments, for crossing tests
function arcPoints(p0, p1, angle, sweep, n = 24){
  const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if(!angle || d < 1e-6) return d3.range(n + 1).map(i => [p0[0] + (p1[0] - p0[0]) * i / n, p0[1] + (p1[1] - p0[1]) * i / n]);
  const r = d / (2 * Math.sin(angle / 2)), mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) ** 2)), ux = (p1[0] - p0[0]) / d, uy = (p1[1] - p0[1]) / d;
  // the centre sits on the side that makes the short arc bend the chosen way
  const s = sweep ? 1 : -1, cx = mx - s * uy * h, cy = my + s * ux * h;
  let a0 = Math.atan2(p0[1] - cy, p0[0] - cx), a1 = Math.atan2(p1[1] - cy, p1[0] - cx), da = a1 - a0;
  if(sweep){ while(da < 0) da += 2 * Math.PI; } else { while(da > 0) da -= 2 * Math.PI; }
  return d3.range(n + 1).map(i => [cx + r * Math.cos(a0 + da * i / n), cy + r * Math.sin(a0 + da * i / n)]);
}

// does any segment of polyline a cross any segment of polyline b?
function segsCross(a, b){
  const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) - (q[1] - p[1]) * (r[0] - p[0]);
  for(let i = 0; i < a.length - 1; i++){
    for(let j = 0; j < b.length - 1; j++){
      const p = a[i], q = a[i + 1], r = b[j], s = b[j + 1];
      const d1 = ccw(r, s, p), d2 = ccw(r, s, q), d3_ = ccw(p, q, r), d4 = ccw(p, q, s);
      if(((d1 > 0) !== (d2 > 0)) && ((d3_ > 0) !== (d4 > 0))) return true;
    }
  }
  return false;
}
