// El Niño × food security: the diamond legend in the map's corner, its cells painted with the same watercolour brush as the map.

// a legend cell's wash (fixed seed), as an image; cached per colour, coverage and shape
const legendCellCache = {};
function legendCellImage(pts, colour, cover, seed){
  const key = colour + cover + pts.flat().join(',');
  if(legendCellCache[key]) return legendCellCache[key];
  const [bx0, by0, bx1, by1] = bbox(pts), pad = 5, S = 3;   // S: pixels per legend unit
  const x0 = bx0 - pad, y0 = by0 - pad, w = bx1 - x0 + pad, h = by1 - y0 + pad;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
  const g = c.getContext('2d');
  g.setTransform(S, 0, 0, S, -x0 * S, -y0 * S);
  brushSeed = seed;
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

// the diamond, as SVG markup: bottom = low on both axes, left edge = shortfall, right edge = the second measure, top = highest risk.
// The NAMED_CELLS (the named countries) lift off the diamond as one piece, with a short, sharp shadow
function legendMarkup(){
  const d = 13.35, bx = 190, by = 178, n = Math.SQRT1_2;   // cell side ≈ 19px
  // u = shortfall, rising to the upper left; v = the selected measure, rising to the upper right
  const P = (u, v) => [bx + (v - u) * d, by - (u + v) * d];
  const poly = pts => pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  const cellPts = (i, j) => [P(i,j), P(i+1,j), P(i+1,j+1), P(i,j+1)];
  const cellImage = (i, j, cover) => {
    const im = legendCellImage(cellPts(i, j), cellColour(i, j), cover, 101 + i * 7 + j * 31);
    return `<image href="${im.href}" x="${im.x}" y="${im.y}" width="${im.w}" height="${im.h}"/>`;
  };
  const cellLines = (i, j) => `<polygon points="${poly(cellPts(i, j))}" class="bl-inkcell"/>`;
  const text = (x, y, rot, txt, cls, anchor) =>
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" class="${cls}" text-anchor="${anchor || 'middle'}">${txt}</text>`;

  const outer = poly([P(0,0), P(3,0), P(3,3), P(0,3)]);
  const lift = poly([P(2,1), P(3,1), P(3,3), P(1,3), P(1,2), P(2,2)]);   // the outline of the NAMED_CELLS
  // the lift's shadow: a soft blur and a sharp one, both offset down
  const liftShadow = `<filter id="blLift" x="-30%" y="-30%" width="160%" height="160%">`
    + `<feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="b1"/><feOffset in="b1" dx="0" dy="3.3" result="o1"/>`
    + `<feFlood flood-color="#281e32" flood-opacity="0.50"/><feComposite in2="o1" operator="in" result="s1"/>`
    + `<feGaussianBlur in="SourceAlpha" stdDeviation="0.45" result="b2"/><feOffset in="b2" dx="0" dy="1.3" result="o2"/>`
    + `<feFlood flood-color="#281e32" flood-opacity="0.50"/><feComposite in2="o2" operator="in" result="s2"/>`
    + `<feMerge><feMergeNode in="s1"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  let g = `<defs><clipPath id="legTop3"><polygon points="${lift}"/></clipPath>${liftShadow}<clipPath id="legDiamond"><polygon points="${outer}"/></clipPath></defs>`;

  // the nine cells: painted cells may blend into each other, but are clipped to the diamond's outer edge
  g += '<g clip-path="url(#legDiamond)">';
  for(let i = 0; i < 3; i++) for(let j = 0; j < 3; j++) g += cellImage(i, j, i === 0 && j === 0 ? WATERCOLOUR.low : WATERCOLOUR.cover) + cellLines(i, j);
  g += '</g>';
  // the lifted cells: paper backing first, then their paint, then the cell lines, then a clean paper rim, like a cut-out sheet
  let liftedPaint = '', lines = '';
  for(const [i, j] of NAMED_CELLS){ liftedPaint += cellImage(i, j, WATERCOLOUR.cover); lines += cellLines(i, j); }
  g += `<g class="bl-lift" filter="url(#blLift)" transform="translate(0,-2.6)"><polygon points="${lift}" class="bl-liftpaper"/>`
    + `<g clip-path="url(#legTop3)">${liftedPaint}</g>${lines}<polygon points="${lift}" class="bl-liftedge"/></g>`;

  // ticks on the lower-left edge (shortfall) and lower-right edge (the second measure), offset outward
  [[1, String(SHORTFALL_THRESHOLDS[0])], [2, SHORTFALL_THRESHOLDS[1] + '%']].forEach(([u, label]) => { const [x, y] = P(u, 0); g += text(x - 10*n, y + 10*n, 45, label, 'bl-tk', 'end'); });
  [[1, MEASURE_DATA[selectedMeasure].ticks[0]], [2, MEASURE_DATA[selectedMeasure].ticks[1]]].forEach(([v, label]) => { const [x, y] = P(0, v); g += text(x + 10*n, y + 10*n, -45, label, 'bl-tk', 'start'); });
  // axis titles along each edge, centred on its middle, so they never run past the diamond's ends
  { const [x, y] = P(1.5, 0); g += text(x - 23*n, y + 23*n, 45, '← Shortfall', 'bl-ax', 'middle'); }
  { const [x, y] = P(0, 1.5); g += text(x + 23*n, y + 23*n, -45, MEASURE_DATA[selectedMeasure].axis + ' →', 'bl-ax', 'middle'); }
  // title on top: the lifted cells are the countries named on the map (definitions live in the key line under the map)
  { const [x, y] = P(3, 3); g += text(x, y - 9, 0, 'Highest-risk countries', 'bl-top'); }
  return `<span class="bilegend"><svg viewBox="0 0 380 236" width="380" height="236" role="img" aria-label="Legend: colour combines import share (left axis, blue) and El Niño harvest shortfall (right axis, red); purple at the top is highest risk">${g}</svg></span>`;
}

// the legend shrinks on narrower maps, keeping its proportions
function legendScale(){
  const w = mapbox.clientWidth || 1000;
  if(!legendOnMap()) return 1;
  return w > 900 ? 1 : w > 680 ? 0.85 : w > 500 ? 0.72 : 0.6;
}

// draw the legend, then crop its viewBox to the drawing so it renders as large as possible in the corner
function drawLegend(){
  legendContainer.innerHTML = legendMarkup();
  const legendSvg = legendContainer.querySelector('svg');
  if(!legendSvg) return;
  legendSvg.querySelectorAll('.bl-ax').forEach(e => {   // shrink an axis title longer than its edge
    const L = e.getComputedTextLength(), max = 54;
    if(L > max) e.style.fontSize = (10.5 * max / L).toFixed(2) + 'px';
  });
  const bb = legendSvg.getBBox(), p = 3, scale = legendScale();
  legendSvg.setAttribute('viewBox', `${bb.x - p} ${bb.y - p} ${bb.width + 2 * p} ${bb.height + 2 * p}`);
  legendSvg.setAttribute('width', Math.ceil((bb.width + 2 * p) * scale));
  legendSvg.setAttribute('height', Math.ceil((bb.height + 2 * p) * scale));
}
