// Bivariate map: the watercolour brush. Tyler Hobbs' layered-deformation method, as used by mattqg/Watercolor and
// 32bitkid/watercolorizer: each outline is recursively split with randomly displaced midpoints, and many faint deformed
// layers are stacked, so colour builds up in the interior and feathers unevenly at the edges.

import * as d3 from 'd3';
import {bbox, segDist2} from './geometry.js';

// the brush settings: layers, coverage (cover; low for the lowest cell, nodata for grey), edge spill, deformation, blotch
// sizes and the seed; stipple (optional) dots the sea (wash.js). A map can pass its own
export const BRUSH = {maxBlotches: 160, spill: 0.01, layers: 14, cover: 0.97, base: 0.72, baseDark: 0.86, low: 0.55, nodata: 0.88, pre: 1, per: 2, amp: 0.3, maxPre: 2.6, maxLayer: 2.2, simplify: 0.8, seed: 11, maskShare: 0.55, rMin: 7, rMax: 24};

// seeded random numbers (Park-Miller), so the same shape gets the same brushwork every time
let brushSeed = 1;
export function seedBrush(seed){ brushSeed = seed; }
export const brushRandom = () => (brushSeed = (brushSeed * 16807) % 2147483647) / 2147483647;
// normally distributed (Box-Muller)
function brushGaussian(){
  let u = 0, v = 0;
  while(!u) u = brushRandom();
  while(!v) v = brushRandom();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// fewer points for the brush: Douglas-Peucker, dropping points within `tol` of the line
export function simplifyRing(pts, tol){
  if(pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]], t2 = tol * tol;
  while(stack.length){
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    for(let i = a + 1; i < b; i++){
      const d = segDist2(pts[i], pts[a], pts[b]);
      if(d > md){ md = d; mi = i; }
    }
    if(md > t2){ keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// split every edge `iters` times, moving each new midpoint randomly by up to `amp` of the edge's length (at most maxd)
export function deformRing(ring, iters, amp, maxd){
  let r = ring;
  for(let it = 0; it < iters; it++){
    const out = [];
    for(let i = 0; i < r.length; i++){
      const a = r[i], b = r[(i + 1) % r.length];
      out.push(a);
      const d = Math.min(Math.hypot(b[0] - a[0], b[1] - a[1]) * amp, maxd);
      out.push([(a[0] + b[0]) / 2 + brushGaussian() * d, (a[1] + b[1]) / 2 + brushGaussian() * d]);
    }
    r = out;
  }
  return r;
}

// add a ring to a Path2D as a smooth closed curve through its edge midpoints
export function smoothRing(p, r){
  const n = r.length, mid = i => [(r[i][0] + r[(i + 1) % n][0]) / 2, (r[i][1] + r[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1);
  p.moveTo(m0[0], m0[1]);
  for(let i = 0; i < n; i++){ const m = mid(i); p.quadraticCurveTo(r[i][0], r[i][1], m[0], m[1]); }
  p.closePath();
}

// a legend cell's wash, as an image ({href, x, y, w, h}); cached per colour, coverage and shape
const legendCellCache = {};
export function legendCellImage(pts, colour, cover, seed){
  const key = colour + cover + pts.flat().join(',');
  if(legendCellCache[key]) return legendCellCache[key];
  const [bx0, by0, bx1, by1] = bbox(pts), pad = 5, S = 3;   // S: pixels per legend unit
  const x0 = bx0 - pad, y0 = by0 - pad, w = bx1 - x0 + pad, h = by1 - y0 + pad;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
  const g = c.getContext('2d');
  g.setTransform(S, 0, 0, S, -x0 * S, -y0 * S);
  seedBrush(seed);
  // the cell spills 2-5% past its box
  const spill = 1.02 + brushRandom() * 0.03, cx0 = d3.mean(pts, p => p[0]), cy0 = d3.mean(pts, p => p[1]);
  const base = deformRing(pts.map(p => [cx0 + (p[0] - cx0) * spill, cy0 + (p[1] - cy0) * spill]), 1, 0.3, 1.2);
  const L = 12, alpha = Math.min(1, (1 - Math.pow(1 - cover, 1 / L)) / 0.6);
  g.fillStyle = colour; g.globalAlpha = alpha;
  for(let l = 0; l < L; l++){
    const p = new Path2D(); smoothRing(p, deformRing(base, 2, 0.3, 1.0));
    const mask = new Path2D();
    for(let q = 0; q < 6; q++){
      const cx = x0 + brushRandom() * w, cy = y0 + brushRandom() * h, rr = 4 + brushRandom() * 7;
      mask.moveTo(cx + rr, cy); mask.arc(cx, cy, rr, 0, Math.PI * 2);
    }
    g.save(); g.clip(mask); g.fill(p); g.restore();
  }
  return (legendCellCache[key] = {href: c.toDataURL('image/png'), x: x0, y: y0, w, h});
}
