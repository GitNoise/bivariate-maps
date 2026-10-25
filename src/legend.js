// El Niño × food security: the legend's cells, each painted with the map's watercolour brush (fixed seed) as an image.

import * as d3 from 'd3';
import {bbox} from './geometry.js';
import {seedBrush, brushRandom, deformRing, smoothRing} from './watercolour.js';

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
