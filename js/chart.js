// El Niño × food security: the map, legend, labels, tooltip and insights.
// Needs d3 v7, topojson-client, js/data.js and js/settings.js loaded first.
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt = v => v <= 0 ? 'net exporter' : Math.round(v) + '% imported';
const pts = v => { const r = Math.round(v); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + ' pts'; };


// ---- map ---------------------------------------------------------------
const mapbox = document.getElementById('mapbox'), tip = document.getElementById('tip');
const PHONE = window.matchMedia('(max-width: 640px)').matches;
const W = PHONE ? 700 : 1180, H = PHONE ? 560 : 600;
const svg = d3.select(mapbox).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role','img')
  .attr('aria-label','World map of El Niño harvest risk and cereal import dependency by country');
const countries = topojson.feature(WORLD, WORLD.objects.countries);
countries.features = countries.features.filter(f => f.id !== '010');   // drop Antarctica
const proj = d3.geoNaturalEarth1().fitExtent([[0,PHONE?100:0],[W,PHONE?H-100:H]], FOCUS);
const path = d3.geoPath(proj);
const zoomG = svg.append('g');
const washG = zoomG.append('g');
const paths = washG.selectAll('path').data(countries.features).join('path').attr('d', path).attr('class','country');
const small = countries.features.filter(f => DATA.world[f.id] && SMALL_OK.has(f.id) && path.area(f) < 60);
const marks = zoomG.append('g').selectAll('circle').data(small).join('circle')
  .attr('cx', f => path.centroid(f)[0]).attr('cy', f => path.centroid(f)[1]).attr('r', 3.2).attr('class','country smallmark');
const defs = svg.append('defs');
defs.html(`
  <clipPath id="landclip"><path id="landclipPath"/></clipPath>`);
const washFill = (i, j) => biColor(i, j);
document.getElementById('landclipPath').setAttribute('d', path({type:'FeatureCollection', features: countries.features}));
function scaleWatercolour(z){}
const hatchPat = defs.append('pattern').attr('id','hatch').attr('patternUnits','userSpaceOnUse').attr('width',5).attr('height',5).attr('patternTransform','rotate(45)');
hatchPat.append('rect').attr('width',0.9).attr('height',5).attr('class','hatchline');
// a second hatch with light lines, for dark fills (brown, mauve, purple) where pencil-grey lines disappear
const hatchPatL = defs.append('pattern').attr('id','hatchL').attr('patternUnits','userSpaceOnUse').attr('width',5).attr('height',5).attr('patternTransform','rotate(45)');
hatchPatL.append('rect').attr('width',1.1).attr('height',5).attr('class','hatchline-l');
const lumOf = hex => { const c = hex.replace('#', '').match(/../g).map(h => { const v = parseInt(h, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const hatchFor = id => { const r = DATA.world[id]; if(!r || r.hgap == null || depClass(r) == null) return 'url(#hatch)'; return lumOf(biColor(hitClass(r), depClass(r)).trim()) < 0.2 ? 'url(#hatchL)' : 'url(#hatch)'; };
const hatchG = zoomG.append('g').style('pointer-events','none');
const hatchPaths = hatchG.selectAll('path').data(countries.features).join('path').attr('d', path).attr('fill','url(#hatch)');
// Natural Earth draws Somaliland as its own shape without a country code; FAO's reports count it as part of Somalia
const fiOf = f => f.id || (f.properties && f.properties.name === 'Somaliland' ? '706' : undefined);
const fiText = id => FOOD_INSEC[id] ? `El Niño food insecurity or drought emergency: <em>${FOOD_INSEC[id].join(' and ')}</em>.` : '';
const inkG = zoomG.append('g').style('pointer-events','none');
const inkPaths = inkG.selectAll('path').data(countries.features.filter(f => DATA.world[f.id] || true)).join('path').attr('d', path).attr('class', d => 'ink' + (FOOD_INSEC[d.id] ? ' fi' : ''));
// one outline around each group of touching flagged countries: shared borders between them are dissolved
// dark borders: one outline around each group of touching flagged countries. topojson.merge dissolves only shared borders,
// so a country enclosed by flagged ones stays out, as a hole with its own outline. Outside the selected region the border is dimmed.
// dashed (smaller crises) first, so a border shared with a solid country is drawn solid
const fiMinorDim = inkG.append('path').attr('class', 'fi-outline minor dim');
const fiMinor = inkG.append('path').attr('class', 'fi-outline minor');
const fiOutlineDim = inkG.append('path').attr('class', 'fi-outline dim');
const fiOutline = inkG.append('path').attr('class', 'fi-outline');
const fiInView = g => region === 'world' || (REGIONS_Z[region] || []).includes(fiOf(g));
function drawFiOutlines(){
  const flagged = WORLD.objects.countries.geometries.filter(g => FOOD_INSEC[fiOf(g)]);
  fiOutline.datum(topojson.merge(WORLD, flagged.filter(fiInView))).attr('d', path);
  fiOutlineDim.datum(topojson.merge(WORLD, flagged.filter(g => !fiInView(g)))).attr('d', path);
  const minor = WORLD.objects.countries.geometries.filter(g => FOOD_INSEC_MINOR[fiOf(g)]);
  fiMinor.datum(topojson.merge(WORLD, minor.filter(fiInView))).attr('d', path);
  fiMinorDim.datum(topojson.merge(WORLD, minor.filter(g => !fiInView(g)))).attr('d', path);
}
const labelG = zoomG.append('g').attr('class','maplabels');
// ---- callouts: labels beside the region, joined to their country by swoopy arrows ------------
// (after bizweekgraphics/swoopyarrows: a circular arc between label and country, with an arrowhead)
const calloutG = svg.append('g').attr('class', 'callouts').style('opacity', 0);
defs.append('marker').attr('id', 'swoopHead').attr('viewBox', '0 0 10 10').attr('refX', 8.5).attr('refY', 5)
  .attr('markerWidth', 5.5).attr('markerHeight', 5.5).attr('orient', 'auto-start-reverse').attr('markerUnits', 'strokeWidth')
  .append('path').attr('d', 'M0,1 L9,5 L0,9 z').attr('class', 'swoop-head');
let zoomAnimating = false;
function swoopPath(p0, p1, angle, sweep){
  const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if(!angle || d < 1e-6) return `M${p0[0]},${p0[1]}L${p1[0]},${p1[1]}`;
  const r = d / (2 * Math.sin(angle / 2));
  return `M${p0[0]},${p0[1]}A${r},${r} 0 0,${sweep} ${p1[0]},${p1[1]}`;
}
function arcPoints(p0, p1, angle, sweep, n = 24){   // the same arc as a polyline, for crossing tests
  const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if(!angle || d < 1e-6) return d3.range(n + 1).map(i => [p0[0] + (p1[0] - p0[0]) * i / n, p0[1] + (p1[1] - p0[1]) * i / n]);
  const r = d / (2 * Math.sin(angle / 2)), mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) ** 2)), ux = (p1[0] - p0[0]) / d, uy = (p1[1] - p0[1]) / d;
  const s = sweep ? 1 : -1, cx = mx - s * uy * h, cy = my + s * ux * h;   // centre on the side that makes the short arc bend the chosen way
  let a0 = Math.atan2(p0[1] - cy, p0[0] - cx), a1 = Math.atan2(p1[1] - cy, p1[0] - cx), da = a1 - a0;
  if(sweep){ while(da < 0) da += 2 * Math.PI; } else { while(da > 0) da -= 2 * Math.PI; }
  return d3.range(n + 1).map(i => [cx + r * Math.cos(a0 + da * i / n), cy + r * Math.sin(a0 + da * i / n)]);
}
function segsCross(a, b){   // does any segment of polyline a cross any segment of polyline b
  const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) - (q[1] - p[1]) * (r[0] - p[0]);
  for(let i = 0; i < a.length - 1; i++) for(let j = 0; j < b.length - 1; j++){
    const p = a[i], q = a[i + 1], r = b[j], s = b[j + 1];
    const d1 = ccw(r, s, p), d2 = ccw(r, s, q), d3_ = ccw(p, q, r), d4 = ccw(p, q, s);
    if(((d1 > 0) !== (d2 > 0)) && ((d3_ > 0) !== (d4 > 0))) return true;
  }
  return false;
}
function anchorOf(f, t){   // label point: the spot deepest inside the country's largest piece (pole of inaccessibility), on screen
  const rings = ringsOf(f); let best = null, bestA = -1;
  rings.forEach(r => { const a = Math.abs(d3.polygonArea(r)); if(a > bestA){ bestA = a; best = r; } });
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let q = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; q = Math.max(0, Math.min(1, q));
    return Math.hypot(p[0] - a[0] - q * dx, p[1] - a[1] - q * dy); };
  const edgeDist = p => { let m = Infinity; for(let i = 0; i < best.length; i++){ const d = segDist(p, best[i], best[(i + 1) % best.length]); if(d < m) m = d; } return m; };
  const xs = best.map(p => p[0]), ys = best.map(p => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), c = d3.polygonCentroid(best), cd = d3.polygonContains(best, c) ? edgeDist(c) : -1;
  // coarse grid, then two finer passes around the best spot
  for(let pass = 0; pass < 3; pass++){
    const N = 14;
    for(let i = 0; i <= N; i++) for(let j = 0; j <= N; j++){
      const p = [x0 + (x1 - x0) * i / N, y0 + (y1 - y0) * j / N];
      if(!d3.polygonContains(best, p)) continue;
      const d = edgeDist(p); if(d > cd){ cd = d; c = p; }
    }
    const wx = (x1 - x0) / 5, wy = (y1 - y0) / 5; x0 = c[0] - wx; x1 = c[0] + wx; y0 = c[1] - wy; y1 = c[1] + wy;
  }
  return [t.applyX(c[0]), t.applyY(c[1])];
}
// world view: short notes on the clusters of dark borders, without leader lines. A force simulation pulls each note towards its
// cluster and pushes it off land, off the other notes and off the legend, so it settles in the nearest open water.
// clusters of dark-border countries, found from the data: countries in the same zoom region join if they touch or lie within
// CLUSTER_KM of each other; a country left on its own joins the nearest cluster in its region
let clusterCache = null;
function crisisClusters(){
  if(clusterCache) return clusterCache;
  const geoms = WORLD.objects.countries.geometries, idx = geoms.map((g, i) => i).filter(i => FOOD_INSEC[fiOf(geoms[i])]);
  const featCache = {}, feat = i => featCache[i] || (featCache[i] = topojson.feature(WORLD, geoms[i])), zone = i => zoneOf(fiOf(geoms[i]));   // shape straight from the map file
  const nb = topojson.neighbors(geoms);
  const pts = {}; idx.forEach(i => { const all = []; const g = feat(i).geometry, P = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    P.forEach(pl => pl[0].forEach(p => all.push(p))); const step = Math.max(1, Math.floor(all.length / 150)); pts[i] = all.filter((p, k) => k % step === 0); });
  const km = (a, b) => { let m = Infinity; for(const p of pts[a]) for(const q of pts[b]){ const d = d3.geoDistance(p, q); if(d < m) m = d; } return m * 6371; };
  const parent = {}; idx.forEach(i => parent[i] = i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i])), join = (a, b) => { parent[find(a)] = find(b); };
  idx.forEach(a => idx.forEach(b => { if(a < b && zone(a) === zone(b) && (nb[a].includes(b) || km(a, b) < CLUSTER_KM)) join(a, b); }));
  const groups = () => { const m = {}; idx.forEach(i => (m[find(i)] = m[find(i)] || []).push(i)); return Object.values(m); };
  groups().filter(gr => gr.length === 1).forEach(([i]) => {      // a loner joins the nearest cluster in its region
    let best = null; idx.forEach(j => { if(find(j) !== find(i) && zone(j) === zone(i)){ const d = km(i, j); if(!best || d < best.d) best = {j, d}; } });
    if(best) join(i, best.j);
  });
  return (clusterCache = groups().map(gr => ({ids: gr.map(i => fiOf(geoms[i])), features: gr.map(feat)})));
}
let landMask = null;
function landMaskFor(t){
  const key = [t.k, t.x, t.y].map(v => v.toFixed(3)).join(',');
  if(landMask && landMask.key === key) return landMask;
  // full resolution (S = 1), so small islands are in the mask
  const S = 1, mc = document.createElement('canvas'); mc.width = Math.ceil(W / S); mc.height = Math.ceil(H / S);
  const ctx = mc.getContext('2d'); ctx.setTransform(t.k / S, 0, 0, t.k / S, t.x / S, t.y / S);
  const gp = d3.geoPath(proj, ctx); ctx.beginPath(); countries.features.forEach(f => gp(f)); ctx.fill();
  return (landMask = {key, S, w: mc.width, h: mc.height, a: ctx.getImageData(0, 0, mc.width, mc.height).data});
}
function drawWorldNotes(t){
  const u = W / Math.max(300, mapbox.clientWidth), narrow = mapbox.clientWidth <= 800;   // narrower maps only get the phone notes
  const notes = WORLD_NOTES.filter(n => (!narrow || n.phone) && crisisClusters().some(k => k.ids.includes(n.member)));
  if(!notes.length) return;
  const mask = landMaskFor(t), pad = 5 * u, edge = 6 * u;
  // share of a box (centre x, y) that lies on land, sampled on a grid
  const landIn = (x, y, w, h) => { let on = 0, all = 0; const st = Math.max(2, Math.min(w, h) / 8);
    for(let sx = x - w / 2 - pad; sx <= x + w / 2 + pad; sx += st) for(let sy = y - h / 2 - pad; sy <= y + h / 2 + pad; sy += st){
      all++; const mx = Math.floor(sx / mask.S), my = Math.floor(sy / mask.S);
      if(mx >= 0 && my >= 0 && mx < mask.w && my < mask.h && mask.a[(my * mask.w + mx) * 4 + 3] > 0) on++; }
    return on / Math.max(1, all); };
  const kr = document.getElementById('mapkey').getBoundingClientRect(), mr = svg.node().getBoundingClientRect();
  const keyOn = getComputedStyle(document.getElementById('mapkey')).position === 'absolute' && kr.width > 0;
  const keyBox = keyOn ? [(kr.left - mr.left) * u - pad, (kr.top - mr.top) * u - pad, (kr.right - mr.left) * u + pad, (kr.bottom - mr.top) * u + pad] : null;
  // build each note's text (left-aligned lines) and measure it
  const nodes = notes.map(n => {
    const g = calloutG.append('g').attr('class', 'wnote'), titles = [].concat(n.title);
    [...titles, ...n.lines].forEach((txt, i) => g.append('text').attr('x', 0).attr('y', i * 13.5 * u)
      .attr('class', i < titles.length ? 'wn-title' : 'wn-body').style('font-size', (i < titles.length ? 12 : 11.5) * u + 'px').text(txt));
    // pulled towards the geographic centre of its cluster's shapes
    const cl = crisisClusters().find(k => k.ids.includes(n.member)), cen = proj(d3.geoCentroid({type: 'FeatureCollection', features: cl.features}));
    const bb = g.node().getBBox(), tx = t.applyX(cen[0]), ty = t.applyY(cen[1]);
    return {g, bx: bb.x, by: bb.y, w: bb.width, h: bb.height, tx, ty, x: tx, y: ty};
  });
  const hit = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w + 2 * pad && Math.abs(a.y - b.y) * 2 < a.h + b.h + 2 * pad;
  const onKey = n => keyBox && n.x + n.w / 2 > keyBox[0] && n.x - n.w / 2 < keyBox[2] && n.y + n.h / 2 > keyBox[1] && n.y - n.h / 2 < keyBox[3];
  const clamp = n => { n.x = Math.max(edge + n.w / 2, Math.min(W - edge - n.w / 2, n.x)); n.y = Math.max(edge + n.h / 2, Math.min(H - edge - n.h / 2, n.y)); };
  const DIRS = d3.range(16).map(k => [Math.cos(k / 16 * 2 * Math.PI), Math.sin(k / 16 * 2 * Math.PI)]);
  const sim = d3.forceSimulation(nodes).alphaDecay(0.02).velocityDecay(0.35)
    .force('x', d3.forceX(n => n.tx).strength(0.04)).force('y', d3.forceY(n => n.ty).strength(0.04))
    .force('land', alpha => nodes.forEach(n => {      // look around for less land and drift that way
      const here = landIn(n.x, n.y, n.w, n.h); if(here <= 0) return;
      for(const R of [10 * u, 25 * u, 50 * u, 90 * u]){
        let best = null;
        DIRS.forEach(([dx, dy]) => { const c = landIn(n.x + dx * R, n.y + dy * R, n.w, n.h); if(!best || c < best.c) best = {c, dx, dy}; });
        if(best.c < here){ const f = (here - best.c) * 14 * u * alpha * 4; n.vx += best.dx * f; n.vy += best.dy * f; return; }
      }
    }))
    .force('apart', () => { for(let i = 0; i < nodes.length; i++) for(let j = i + 1; j < nodes.length; j++){
      const a = nodes[i], b = nodes[j]; if(!hit(a, b)) continue;
      const ox = (a.w + b.w) / 2 + 2 * pad - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 + 2 * pad - Math.abs(a.y - b.y);
      if(ox < oy){ const d = (a.x < b.x ? -1 : 1) * ox / 2; a.x += d; b.x -= d; } else { const d = (a.y < b.y ? -1 : 1) * oy / 2; a.y += d; b.y -= d; } } })
    .force('frame', () => nodes.forEach(n => { if(onKey(n)){ n.y = Math.min(n.y, keyBox[1] - n.h / 2 - pad); } clamp(n); }))
    .stop();
  for(let i = 0; i < 400; i++) sim.tick();
  // fallback: a note still on land (or touching another note or the legend) takes the nearest free spot around its cluster
  // strict check for the final placement: sample every 1.5 units, so thin islands (Haiti, Puerto Rico) cannot slip between samples
  const landFine = (x, y, w, h) => { const st = 1.5; for(let sx = x - w / 2 - pad; sx <= x + w / 2 + pad; sx += st) for(let sy = y - h / 2 - pad; sy <= y + h / 2 + pad; sy += st){
      const mx = Math.floor(sx / mask.S), my = Math.floor(sy / mask.S);
      if(mx >= 0 && my >= 0 && mx < mask.w && my < mask.h && mask.a[(my * mask.w + mx) * 4 + 3] > 0) return true; } return false; };
  const bad = n => landFine(n.x, n.y, n.w, n.h) || onKey(n) || nodes.some(o => o !== n && hit(n, o));
  // and every note takes the nearest free spot around its cluster if that is closer than where the simulation left it
  const cost = n => Math.hypot(n.x - n.tx, n.y - n.ty);
  nodes.forEach(n => {
    const px = n.x, py = n.y, here = bad(n) ? Infinity : cost(n); let best = null;
    for(let r = 6; r <= 260; r += 6) for(let k = 0; k < 32; k++){
      const th = k / 32 * 2 * Math.PI; n.x = n.tx + Math.cos(th) * r * u; n.y = n.ty + Math.sin(th) * r * u * 0.75; clamp(n);
      if(!bad(n)){ const d = cost(n); if(!best || d < best.d) best = {x: n.x, y: n.y, d}; }
    }
    if(best && best.d < here){ n.x = best.x; n.y = best.y; } else { n.x = px; n.y = py; }
  });
  nodes.forEach(n => n.g.attr('transform', `translate(${(n.x - n.w / 2 - n.bx).toFixed(1)},${(n.y - n.h / 2 - n.by).toFixed(1)})`));
}
function drawCallouts(t){
  calloutG.selectAll('*').remove(); calloutG.interrupt().style('opacity', 0);
  if(region === 'world'){ drawWorldNotes(t); calloutG.transition().duration(zoomAnimating ? 0 : 220).style('opacity', 1); return; }
  const ids = new Set(REGIONS_Z[region]);
  const u = W / Math.max(300, mapbox.clientWidth);   // viewBox units per screen pixel
  const edge = 6 * u, pad = 3 * u;
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  // legend area in viewBox units: callouts must stay clear of it
  const kr = document.getElementById('mapkey').getBoundingClientRect(), mr = svg.node().getBoundingClientRect();
  const keyOn = getComputedStyle(document.getElementById('mapkey')).position === 'absolute';
  const keyBox = keyOn ? [(kr.left - mr.left) * u - pad, (kr.top - mr.top) * u - pad, (kr.right - mr.left) * u + pad, (kr.bottom - mr.top) * u + pad] : null;
  const items = countries.features.filter(f => ids.has(f.id) && isLabelled(DATA.world[f.id])).map(f => {
    const r = DATA.world[f.id];
    const g = calloutG.append('g').attr('class', 'callout');
    g.append('text').attr('class', 'ml-name').attr('y', 4 * u).style('font-size', (11 * u) + 'px').text(shortName(r));   // name only; figures are in the tooltip and panel
    const bb = g.node().getBBox();
    // the country's outline on screen, for the coverage test
    const rings = ringsOf(f).map(rg => rg.map(p => [t.applyX(p[0]), t.applyY(p[1])]));
    return {id: f.id, f, r, g, w: bb.width, h: bb.height, bx: bb.x, by: bb.y, a: anchorOf(f, t), rings};
  });
  if(!items.length) return;
  // 1. how much of each country would a label on top of it cover?
  items.forEach(it => {
    const bx0 = it.a[0] - it.w / 2 - pad, by0 = it.a[1] - it.h / 2 - pad, bx1 = it.a[0] + it.w / 2 + pad, by1 = it.a[1] + it.h / 2 + pad;
    it.inBox = [bx0, by0, bx1, by1];
    const xs = it.rings.flat().map(p => p[0]), ys = it.rings.flat().map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let inside = 0, covered = 0; const N = 36;
    for(let i = 0; i < N; i++) for(let j = 0; j < N; j++){
      const p = [x0 + (x1 - x0) * (i + 0.5) / N, y0 + (y1 - y0) * (j + 0.5) / N];
      if(it.rings.some(rg => d3.polygonContains(rg, p))){ inside++; if(p[0] > bx0 && p[0] < bx1 && p[1] > by0 && p[1] < by1) covered++; }
    }
    it.area = (x1 - x0) * (y1 - y0) * inside / (N * N);
    it.coverage = inside ? covered / inside : 1;
  });
  // 2. labels on their country where the label covers at most half of it; largest countries first, no overlaps
  const placed = [];
  items.slice().sort((a, b) => b.area - a.area).forEach(it => {
    const b = it.inBox;
    const fits = it.coverage <= 0.5 && b[0] >= edge && b[2] <= W - edge && b[1] >= edge && b[3] <= H - edge
      && !placed.some(q => hit(b, q)) && !(keyBox && hit(b, keyBox))
      && !items.some(o => o !== it && o.a[0] > b[0] - 4 * u && o.a[0] < b[2] + 4 * u && o.a[1] > b[1] - 4 * u && o.a[1] < b[3] + 4 * u);   // nor cover another country's arrow point
    if(fits){ it.inline = true; it.box = b; placed.push(b); }
  });
  // 3. callouts: placed by a d3 force simulation near their own country
  const outs = items.filter(it => !it.inline);
  const cx0 = d3.mean(items, it => it.a[0]), cy0 = d3.mean(items, it => it.a[1]);
  const boxOf = it => [it.x - it.w / 2 - pad, it.y - it.h / 2 - pad, it.x + it.w / 2 + pad, it.y + it.h / 2 + pad];
  const setBox = it => { it.box = boxOf(it); };
  // fixed obstacles: on-country labels, the legend, every arrow point, and the small countries being pointed at
  const statics = [...placed];
  if(keyBox) statics.push(keyBox);
  items.forEach(it => statics.push([it.a[0] - 9 * u, it.a[1] - 9 * u, it.a[0] + 9 * u, it.a[1] + 9 * u]));
  outs.forEach(it => { const xs = it.rings.flat().map(p => p[0]), ys = it.rings.flat().map(p => p[1]);
    statics.push([Math.min(...xs) - 2 * u, Math.min(...ys) - 2 * u, Math.max(...xs) + 2 * u, Math.max(...ys) + 2 * u]); });
  outs.forEach(it => {   // start a short way out from the country, away from the centre of the labelled countries
    let dx = it.a[0] - cx0, dy = it.a[1] - cy0; if(Math.hypot(dx, dy) < 1e-3){ dx = 1; dy = -1; }
    const L = Math.hypot(dx, dy), off = 41.5 * u + Math.max(it.w, it.h) / 2;   // gap between label and country sets the arrow length
    it.tx = it.a[0] + dx / L * off; it.ty = it.a[1] + dy / L * off; it.x = it.tx; it.y = it.ty;
  });
  const clampIt = it => { it.x = Math.min(Math.max(it.x, edge + it.w / 2), W - edge - it.w / 2); it.y = Math.min(Math.max(it.y, edge + it.h / 2), H - edge - it.h / 2); };
  const pushOut = (it, b) => {   // move a label out of a fixed box, along the shorter way
    const bb = boxOf(it); if(!hit(bb, b)) return false;
    const left = bb[2] - b[0], right = b[2] - bb[0], up = bb[3] - b[1], down = b[3] - bb[1], m = Math.min(left, right, up, down);
    if(m === left) it.x -= left; else if(m === right) it.x += right; else if(m === up) it.y -= up; else it.y += down;
    return true;
  };
  const separate = () => {
    for(let a = 0; a < outs.length; a++) for(let b = a + 1; b < outs.length; b++){
      const p = outs[a], q = outs[b], ox = (p.w + q.w) / 2 + 2 * pad - Math.abs(p.x - q.x), oy = (p.h + q.h) / 2 + 2 * pad - Math.abs(p.y - q.y);
      if(ox > 0 && oy > 0){ if(ox < oy){ const d = (p.x < q.x ? -1 : 1) * ox / 2; p.x += d; q.x -= d; } else { const d = (p.y < q.y ? -1 : 1) * oy / 2; p.y += d; q.y -= d; } }
    }
    outs.forEach(it => { statics.forEach(b => pushOut(it, b)); clampIt(it); });
  };
  const blocked = it => { const bb = boxOf(it); return statics.some(b => hit(bb, b)) || outs.some(o => o !== it && hit(bb, boxOf(o))); };
  if(outs.length){
    const sim = d3.forceSimulation(outs).alphaDecay(0.03)
      .force('x', d3.forceX(it => it.tx).strength(0.15)).force('y', d3.forceY(it => it.ty).strength(0.15))
      .force('separate', separate).stop();
    for(let i = 0; i < 250; i++) sim.tick();
    for(let i = 0; i < 200 && outs.some(blocked); i++) separate();
    // anything still boxed in: nearest free spot on rings around its country
    outs.forEach(it => {
      if(!blocked(it)) return;
      const cand = [];
      for(let r = 24; r <= 260; r += 12) for(let k = 0; k < 32; k++){ const th = k / 32 * 2 * Math.PI;
        cand.push([it.a[0] + Math.cos(th) * (r * u + it.w / 2), it.a[1] + Math.sin(th) * (r * u + it.h / 2), r]); }
      for(const [x, y] of cand){ const px = it.x, py = it.y; it.x = x; it.y = y; clampIt(it); if(!blocked(it)) return; it.x = px; it.y = py; }
    });
  }
  outs.forEach(setBox);
  // 4. arrows: a gentle swoop from the label's edge towards the country; crossings resolved by flipping, flattening or swapping
  const startOf = it => { const dx = it.a[0] - it.x, dy = it.a[1] - it.y, sx = (it.w / 2 + 3 * u) / Math.max(1e-6, Math.abs(dx)), sy = (it.h / 2 + 3 * u) / Math.max(1e-6, Math.abs(dy));
    const sc = Math.min(sx, sy, 1); return [it.x + dx * sc, it.y + dy * sc]; };
  const choose = () => {
    const boxes = items.map(it => it.box || it.inBox), drawn = []; let cost = 0;
    outs.forEach(it => {
      const p0 = startOf(it), options = [[Math.PI / 6, 1], [Math.PI / 6, 0], [0, 0], [Math.PI / 3, 1], [Math.PI / 3, 0]];
      let best = null;
      for(const o of options){ const c = arcPoints(p0, it.a, o[0], o[1]);
        const k = drawn.filter(q => segsCross(c, q)).length * 30 + boxes.filter(b => b !== it.box && c.slice(2, -2).some(p => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3])).length * 10;
        if(!best || k < best.k) best = {o, c, k}; if(k === 0) break; }
      let len = 0; for(let i = 1; i < best.c.length; i++) len += Math.hypot(best.c[i][0] - best.c[i - 1][0], best.c[i][1] - best.c[i - 1][1]);
      // long arrows cost heavily, so a swap never moves a label far from its country
      it.p0 = p0; it.arc = best.o; drawn.push(best.c); cost += best.k + len / (0.08 * W) + (len > 90 * u ? 40 + (len - 90 * u) / u : 0);
    });
    return cost;
  };
  let cost = choose();
  for(let round = 0; round < 8; round++){
    let improved = false;
    for(let a = 0; a < outs.length; a++) for(let b = a + 1; b < outs.length; b++){
      const p = outs[a], q = outs[b];
      if(Math.hypot(p.x - q.x, p.y - q.y) > 0.3 * W) continue;   // only near neighbours trade places
      const snap = outs.map(it => [it.x, it.y]);
      [p.x, q.x] = [q.x, p.x]; [p.y, q.y] = [q.y, p.y];
      for(let i = 0; i < 60 && outs.some(blocked); i++) separate();
      outs.forEach(setBox);
      const c2 = outs.some(blocked) ? Infinity : choose();
      if(c2 < cost - 1e-6){ cost = c2; improved = true; } else { outs.forEach((it, n) => { it.x = snap[n][0]; it.y = snap[n][1]; }); outs.forEach(setBox); choose(); }
    }
    if(!improved) break;
  }
  // 4b. repair: a callout whose arrow still crosses another label moves to the nearest spot with a clear path to its country
  const boxesAll = () => items.map(it => it.box || it.inBox);
  const crossesBox = (p0, p1, bx) => { for(let s = 0.08; s <= 0.92; s += 0.04){ const x = p0[0] + (p1[0] - p0[0]) * s, y = p0[1] + (p1[1] - p0[1]) * s; if(x > bx[0] && x < bx[2] && y > bx[1] && y < bx[3]) return true; } return false; };
  outs.forEach(it => {
    const others = () => boxesAll().filter(b => b !== it.box);
    if(!others().some(b => crossesBox(it.p0, it.a, b))) return;
    let best = null;
    for(let r = 24; r <= 180; r += 8) for(let q = 0; q < 36; q++){
      const th = q / 36 * 2 * Math.PI, x = it.a[0] + Math.cos(th) * (r * u + it.w / 2), y = it.a[1] + Math.sin(th) * (r * u + it.h / 2);
      const px = it.x, py = it.y; it.x = x; it.y = y; clampIt(it);
      const bx = boxOf(it), ok = !blocked(it);
      if(ok){ setBox(it); const p0 = startOf(it); if(!others().some(b => crossesBox(p0, it.a, b))){ const d = Math.hypot(p0[0] - it.a[0], p0[1] - it.a[1]); if(!best || d < best.d) best = {x: it.x, y: it.y, d}; } }
      it.x = px; it.y = py; setBox(it);
    }
    if(best){ it.x = best.x; it.y = best.y; setBox(it); it.p0 = startOf(it); it.arc = [Math.PI / 6, 1]; }
  });
  choose();
  // 4c. last pass: two arrows that still cross try swapping their labels' places (any distance apart)
  const arcOf = it => arcPoints(it.p0, it.a, it.arc[0], it.arc[1]);
  const crossingPairs = () => { const out = []; for(let i = 0; i < outs.length; i++) for(let j = i + 1; j < outs.length; j++) if(segsCross(arcOf(outs[i]), arcOf(outs[j]))) out.push([outs[i], outs[j]]); return out; };
  for(let round = 0; round < 6; round++){
    const pairs = crossingPairs(); if(!pairs.length) break;
    let fixed = false;
    for(const [p, q] of pairs){
      const before = crossingPairs().length, snap = outs.map(it => [it.x, it.y]);
      [p.x, q.x] = [q.x, p.x]; [p.y, q.y] = [q.y, p.y];
      for(let i = 0; i < 60 && outs.some(blocked); i++) separate();
      outs.forEach(setBox); choose();
      if(!outs.some(blocked) && crossingPairs().length < before){ fixed = true; break; }
      outs.forEach((it, n) => { it.x = snap[n][0]; it.y = snap[n][1]; }); outs.forEach(setBox); choose();
    }
    if(!fixed) break;
  }
  // 5. draw
  items.forEach(it => {
    const x = it.inline ? it.a[0] : it.x, y = it.inline ? it.a[1] : it.y;
    it.g.attr('transform', `translate(${x},${y - it.by - it.h / 2})`).selectAll('text').attr('text-anchor', 'middle');
    if(it.inline) return;
    calloutG.insert('path', ':first-child').attr('class', 'swoop').attr('d', swoopPath(it.p0, it.a, it.arc[0], it.arc[1]))
      .attr('marker-end', 'url(#swoopHead)').style('stroke-width', (1 * u) + 'px');
  });
  calloutG.transition().duration(zoomAnimating ? 0 : 220).style('opacity', 1);
}

// ---- watercolour washes -----------------------------------------------------
// Tyler Hobbs' layered-deformation method, as used by mattqg/Watercolor and 32bitkid/watercolorizer:
// each outline is recursively split with randomly displaced midpoints, and many faint deformed layers are stacked,
// so colour builds up in the interior and feathers unevenly at the edges.
const wc = document.createElement('canvas'); wc.className = 'wc'; wc.setAttribute('aria-hidden', 'true');
mapbox.insertBefore(wc, svg.node());
const wctx = wc.getContext('2d');
let wcSeed = 1; const wrnd = () => (wcSeed = (wcSeed * 16807) % 2147483647) / 2147483647;
const gauss = () => { let u = 0, v = 0; while(!u) u = wrnd(); while(!v) v = wrnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function ringsOf(feature){
  const rings = []; let cur = null;
  d3.geoPath(proj).context({ moveTo(x, y){ cur = [[x, y]]; rings.push(cur); }, lineTo(x, y){ cur.push([x, y]); }, closePath(){}, arc(){} })(feature);
  return rings;
}
function simplifyRing(pts, tol){   // Douglas-Peucker
  if(pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]], t2 = tol * tol;
  while(st.length){
    const [a, b] = st.pop(); let md = 0, mi = -1; const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    for(let i = a + 1; i < b; i++){ const [px, py] = pts[i]; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey; if(d > md){ md = d; mi = i; } }
    if(md > t2){ keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function deform(ring, iters, amp, maxd){
  let r = ring;
  for(let it = 0; it < iters; it++){
    const out = [];
    for(let i = 0; i < r.length; i++){
      const a = r[i], b = r[(i + 1) % r.length]; out.push(a);
      const d = Math.min(Math.hypot(b[0] - a[0], b[1] - a[1]) * amp, maxd);
      out.push([(a[0] + b[0]) / 2 + gauss() * d, (a[1] + b[1]) / 2 + gauss() * d]);
    }
    r = out;
  }
  return r;
}
function smoothRing(p, r){
  const n = r.length, mid = i => [(r[i][0] + r[(i + 1) % n][0]) / 2, (r[i][1] + r[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1); p.moveTo(m0[0], m0[1]);
  for(let i = 0; i < n; i++){ const m = mid(i); p.quadraticCurveTo(r[i][0], r[i][1], m[0], m[1]); }
  p.closePath();
}
const featBounds = new Map(countries.features.map(f => [f.id + ':' + countries.features.indexOf(f), path.bounds(f)]));
function buildWash(z, t){
  // map units per screen pixel at this zoom, with the brushwork scaled down on small maps so edges stay fine
  const brush = Math.max(0.5, Math.min(1, mapbox.clientWidth / 900));
  const u = (W / Math.max(300, mapbox.clientWidth)) / z * brush;
  const out = [];
  countries.features.forEach((f, n) => {
    const b = featBounds.get(f.id + ':' + n);
    if(t && (t.applyX(b[1][0]) < -60 || t.applyX(b[0][0]) > W + 60 || t.applyY(b[1][1]) < -60 || t.applyY(b[0][1]) > H + 60) && (b[1][0] - b[0][0]) < W / 2) return;   // off screen
    wcSeed = WC.seed + n * 7919;   // same country, same brushwork, every time
    let rings = ringsOf(f).map(r => simplifyRing(r, WC.simplify * u)).filter(r => r.length >= 3);
    const area = r => { let A = 0; for(let i = 0; i < r.length; i++){ const p = r[i], q = r[(i + 1) % r.length]; A += p[0] * q[1] - q[0] * p[1]; } return A / 2; };
    const outerSign = Math.sign(area(rings.reduce((m, r) => Math.abs(area(r)) > Math.abs(area(m)) ? r : m, rings[0] || [])));
    rings = rings.map(r => {   // let the pigment flow out past the border by WC.spill of the shape's size
      const cx = d3.mean(r, p => p[0]), cy = d3.mean(r, p => p[1]), g = Math.sign(area(r)) === outerSign ? 1 + WC.spill : 1 / (1 + WC.spill);
      return r.map(p => [cx + (p[0] - cx) * g, cy + (p[1] - cy) * g]);
    });
    if(!rings.length) return;
    const base = rings.map(r => deform(r, WC.pre, WC.amp, WC.maxPre * u));
    const layers = [];
    for(let l = 0; l < WC.layers; l++){
      const p = new Path2D();
      base.forEach(r => smoothRing(p, deform(r, WC.per, WC.amp, WC.maxLayer * u)));
      // Hobbs' texture mask: each layer only paints inside a random scatter of blotches, so overlaps vary across the wash
      const m = new Path2D(), bw = b[1][0] - b[0][0] + 8 * u, bh = b[1][1] - b[0][1] + 8 * u;
      const r2 = ((WC.rMin + WC.rMax) / 2 * u) ** 2 * 1.08, nWant = Math.max(2, Math.ceil(-Math.log(1 - WC.maskShare) * bw * bh / (Math.PI * r2)));
      const nUse = Math.min(nWant, WC.maxBlotches), grow = Math.sqrt(nWant / nUse);   // fewer, larger blotches for big countries, same coverage
      for(let q = 0; q < nUse; q++){ const cx = b[0][0] - 4 * u + wrnd() * bw, cy = b[0][1] - 4 * u + wrnd() * bh, rr = (WC.rMin + wrnd() * (WC.rMax - WC.rMin)) * u * grow;
        m.moveTo(cx + rr, cy); m.arc(cx, cy, rr, 0, Math.PI * 2); }
      layers.push([p, m]);
    }
    const bp = new Path2D(); base.forEach(r => smoothRing(bp, r));
    out.push({id: fiOf(f) || f.id, fi: !!FOOD_INSEC[fiOf(f)], layers, basePath: bp});   // Somaliland paints as part of Somalia
  });
  return out;
}
function sizeWash(){
  const r = svg.node().getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  wc.style.width = r.width + 'px'; wc.style.height = r.height + 'px';
  wc.width = Math.max(1, Math.round(r.width * dpr)); wc.height = Math.max(1, Math.round(r.height * dpr));
}
const RAISE_CRISIS = false;   // raised plates with shadows for crisis countries: off, so the bivariate colours lead
// the named highest-risk countries (top three diamond cells for the selected measure) are raised with a shadow, in every view
const raisedId = id => !!id && isLabelled(DATA.world[id]);   // raised = the top three diamond cells (the named countries) only; crisis borders lie flat
const sheetCache = {};
function regionSheet(key){
  if(sheetCache[key]) return sheetCache[key];
  const ids = new Set(REGIONS_Z[key] || []), p = new Path2D();
  countries.features.filter(f => ids.has(fiOf(f) || f.id)).forEach(f => ringsOf(f).forEach(r => { p.moveTo(r[0][0], r[0][1]); r.slice(1).forEach(q => p.lineTo(q[0], q[1])); p.closePath(); }));
  return (sheetCache[key] = p);
}
let plateCache = null;
function raisedPlates(){
  if(plateCache) return plateCache;
  plateCache = countries.features.filter(f => raisedId(fiOf(f) || f.id)).map(f => { const pid = fiOf(f) || f.id; const p = new Path2D(); ringsOf(f).forEach(r => { p.moveTo(r[0][0], r[0][1]); r.slice(1).forEach(q => p.lineTo(q[0], q[1])); p.closePath(); }); return {id: pid, path: p}; });
  return plateCache;
}
// the raised countries (levels 1 and 2) cast their shadow over the flat countries and into holes, then get clean paper
function castRaisedShadow(key){
const pc = raisedPiece(key), pdpr = wc.width / Math.max(1, wc.getBoundingClientRect().width);
  // three layers: an ambient shadow all round (so the top edges lift too), a key shadow below, and a dark contact line
  if(pc) [[7, 0, 0, DARK_BG() ? 'rgba(0,0,0,0.75)' : 'rgba(40,30,50,0.45)'], [2, 0, 0, DARK_BG() ? 'rgba(0,0,0,0.85)' : 'rgba(40,30,50,0.55)'], [4, 0, 6, DARK_BG() ? 'rgba(0,0,0,0.8)' : 'rgba(40,30,50,0.50)'], [1.2, 0, 1.5, DARK_BG() ? 'rgba(0,0,0,0.95)' : 'rgba(40,30,50,0.80)']].forEach(([blur, dx, dy, col]) => {
    wctx.save(); wctx.fillStyle = cssVar('--bg'); wctx.shadowColor = col; wctx.shadowBlur = blur * pdpr; wctx.shadowOffsetX = dx * pdpr; wctx.shadowOffsetY = dy * pdpr; wctx.globalAlpha = 1;
    wctx.fill(pc.piece, 'nonzero'); wctx.restore();   // holes keep their rims, so enclosed countries get a shadow too
  });
  if(pc){ wctx.fillStyle = cssVar('--bg'); wctx.fill(pc.piece, 'nonzero'); }   // clean paper under the raised countries only; shadows in holes stay
}
// one merged shape per region for the raised countries (levels 1 and 2), with no seams between neighbours
const pieceCache = {};
function raisedPiece(key){
  if(key in pieceCache) return pieceCache[key];
  const ids = key === 'world' ? null : new Set(REGIONS_Z[key] || []);   // world view: every raisable country
  const geoms = WORLD.objects.countries.geometries.filter(g => { const id = fiOf(g) || g.id; return (!ids || ids.has(id)) && raisedId(id); });
  if(!geoms.length) return (pieceCache[key] = null);
  const merged = topojson.merge(WORLD, geoms);
  const outer = {type: 'MultiPolygon', coordinates: merged.coordinates.map(poly => [poly[0]])};   // holes filled: enclosed countries get no shadow
  return (pieceCache[key] = {piece: new Path2D(path(merged)), outer: new Path2D(path(outer))});
}
const DARK_BG = () => getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).reduce((x, y) => x + +y, 0) < 300;
function drawWash(t, cache){
  if(!cache) return;
  const s = wc.width / W;
  wctx.setTransform(1, 0, 0, 1, 0, 0); wctx.clearRect(0, 0, wc.width, wc.height);
  wctx.setTransform(s * t.k, 0, 0, s * t.k, s * t.x, s * t.y);
  const inR = id => region === 'world' || (REGIONS_Z[region] || []).includes(id);
  const nodata = cssVar('--nodata');
  const paintOne = c => {
    const r = DATA.world[c.id], col = fillFor(c.id) || nodata;
    const cover = !fillFor(c.id) ? WC.nodata : (r && r.hgap != null && hitClass(r) === 0 && depClass(r) === 0 ? WC.low : WC.cover);
    if(cover <= 0) return;   // unpainted: the paper shows through
    // a first even wash, then masked layers that on average bring the interior up to the class colour
    // on the dark theme the gaps in the mottling show dark ground, so the base wash carries more of the colour
    // the pale no-data grey gets a thin first coat and more of the mottled layers, so its brushwork still shows
    const isNoData = !fillFor(c.id);
    const base = isNoData ? 0.3 : Math.min(DARK_BG() ? WC.baseDark : WC.base, cover), rest = 1 - (1 - cover) / (1 - base);
    const a = Math.min(1, (1 - Math.pow(1 - rest, 1 / c.layers.length)) / WC.maskShare), dimF = inR(c.id) ? 1 : 0.14;
    wctx.fillStyle = col;
    wctx.globalAlpha = base * dimF; wctx.fill(c.basePath, 'evenodd');
    wctx.globalAlpha = a * dimF;
    if(isNoData) wctx.fillStyle = cssVar('--nodatadeep');   // two tones: a pale first coat, mottling in a slightly deeper grey
    c.layers.forEach(([p, m]) => { wctx.save(); wctx.clip(m); wctx.fill(p, 'evenodd'); wctx.restore(); });
  };
  // 1. the surface: every country that is not raised
  // crisis countries are marked by their dark border only; they are painted flat like every other country, so the colours lead
  if(region === 'world'){
    cache.filter(c => !raisedId(c.id)).forEach(paintOne);   // flat countries
    castRaisedShadow('world');
  } else {
    // zoomed in: dimmed countries outside the region first
    cache.filter(c => !inR(c.id)).forEach(paintOne);
    // the region sits on a plain paper sheet (no shadow), so dimmed neighbours' paint does not bleed into it; only levels 1 and 2 are raised
    const sheet = regionSheet(region);
    wctx.fillStyle = cssVar('--bg'); wctx.globalAlpha = 1; wctx.fill(sheet, 'nonzero');   // the sheet itself, without shadow inside
    cache.filter(c => inR(c.id) && !raisedId(c.id)).forEach(paintOne);   // level 3: flat on the sheet
    castRaisedShadow(region);   // levels 1 and 2 cast their shadow over the flat countries and into holes
  }
  // 2. levels 1 and 2 (zoomed views only): raised plates with the shared two-part shadow (soft 50%, edge 50%), scaled to country size
  // levels 1 and 2: their washes on top (their shadow was cast earlier, from the group's outer edge)
  cache.filter(c => inR(c.id) && raisedId(c.id)).forEach(paintOne);
  wctx.globalAlpha = 1;
}
const wcCache = {}; let wcT = d3.zoomIdentity, wcNow = null;
// the painting is made once per map width, at the deepest regional zoom; zooming only scales it, it is never repainted
function washFor(){ const id = 'all@' + Math.round(mapbox.clientWidth);
  if(!wcCache[id]){ const zPaint = Math.max(...Object.keys(REGIONS_Z).filter(r => REGIONS_Z[r]).map(r => frameFor(r).k)); wcCache[id] = buildWash(zPaint, null); }
  return wcCache[id]; }
function washTo(key, t, dur){
  const target = washFor(), from = wcT, anim = target;
  const iz = d3.interpolate([from.x, from.y, from.k], [t.x, t.y, t.k]);
  zoomAnimating = true; calloutG.selectAll('*').remove(); calloutG.style('opacity', 0);
  d3.select(wc).interrupt().transition().duration(dur).ease(d3.easeCubicInOut)
    .tween('wash', () => q => { const [x, y, kk] = iz(q); const T = d3.zoomIdentity.translate(x, y).scale(kk); zoomG.attr('transform', T.toString()); drawWash(T, anim); })
    .on('start', () => { zoomAnimating = true; })
    .on('end interrupt', function(){ wcT = t; wcNow = target; zoomG.attr('transform', t.toString()); drawWash(t, target); zoomAnimating = false; drawCallouts(t); });
}
let wcResize;
window.addEventListener('resize', () => { clearTimeout(wcResize); wcResize = setTimeout(() => {
  if(window.matchMedia('(max-width: 640px)').matches !== PHONE){   // the map frame is set at load: redraw in the other shape
    try { sessionStorage.setItem('elnino-region', region); } catch(e){}
    location.reload(); return;
  }
  sizeWash(); wcNow = washFor(); zoomTo(region); }, 150); });   // re-frame and re-size the legend for the new width
sizeWash();

const view = 'bi';
let region = 'world', k = 1;

// bivariate 3x3: across = El Niño harvest shortfall, up = import dependency
const hitClass = r => r.hgap == null ? null : (-r.hgap >= 15 ? 2 : -r.hgap >= 5 ? 1 : 0);
// second axis: cereal imports by default; the explorer can switch it to another measure (classes in js/axes.js)
let AXIS = 'imports';
const ID_OF = new Map(Object.entries(DATA.world).map(([id, r]) => [r, id]));
const depClass = r => { if(AXIS === 'imports') return r.now >= 50 ? 2 : r.now >= 25 ? 1 : 0; const c = AXES[AXIS].cls[ID_OF.get(r)]; return c == null ? null : c; };
const biColor = (i, j) => cssVar(`--bi${j}${i}`);   // i = shortfall class, j = second-measure class; the palette's ramps are swapped so shortfall is purple (left edge) and the second measure gold (right edge)
function fillFor(id){
  const r = DATA.world[id]; if(!r) return null;
  const i = hitClass(r); if(i == null) return null; const j = depClass(r); return j == null ? null : biColor(i, j);   // no data on the second axis: grey
}
// weak harvest signal: hatch over the true class colour (fading would turn it into a different class)
const weak = id => { const r = DATA.world[id]; return view === 'bi' && r && r.hgap != null && hitClass(r) >= 1 && r.hp >= 0.1; };   // only where the colour claims a harvest shortfall
// the lowest class is laid on at half strength so most of the world stays close to bare paper, as in ink-and-wash drawings
const LOW_WASH = 0;   // the lowest class is not painted: white paper shows through
const alphaFor = id => { const r = DATA.world[id]; return r && r.hgap != null && hitClass(r) === 0 && depClass(r) === 0 ? LOW_WASH : 1; };

// legend cells painted with the same layered method as the map (fixed seed, cached per colour)
const wcCellCache = {};
function wcCell(pts, colour, cover, seed){
  const key = colour + cover + pts.flat().join(','); if(wcCellCache[key]) return wcCellCache[key];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 5, S = 3;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S); const g = c.getContext('2d');
  g.setTransform(S, 0, 0, S, -x0 * S, -y0 * S); wcSeed = seed;
  const spill = 1.02 + wrnd() * 0.03, cx0 = d3.mean(pts, p => p[0]), cy0 = d3.mean(pts, p => p[1]);   // cells spill 2-5% past their box
  const base = deform(pts.map(p => [cx0 + (p[0] - cx0) * spill, cy0 + (p[1] - cy0) * spill]), 1, 0.3, 1.2); const L = 12, a = Math.min(1, (1 - Math.pow(1 - cover, 1 / L)) / 0.6);
  g.fillStyle = colour; g.globalAlpha = a;
  for(let l = 0; l < L; l++){
    const d = deform(base, 2, 0.3, 1.0), p = new Path2D(); smoothRing(p, d);
    const m = new Path2D(); for(let q = 0; q < 6; q++){ const cx = x0 + wrnd() * w, cy = y0 + wrnd() * h, rr = 4 + wrnd() * 7; m.moveTo(cx + rr, cy); m.arc(cx, cy, rr, 0, Math.PI * 2); }
    g.save(); g.clip(m); g.fill(p); g.restore();
  }
  return (wcCellCache[key] = {href: c.toDataURL('image/png'), x: x0, y: y0, w, h});
}
function biLegend(){
  // diamond legend: bottom = low on both, left axis = imports (blue), right axis = harvest shortfall (red), top = highest risk
  const d = 13.35, bx = 190, by = 178, n = Math.SQRT1_2;   // cell side ≈ 19px
  const P = (u, v) => [bx + (v - u)*d, by - (u + v)*d];   // u = shortfall, rising to the upper left; v = the selected measure, rising to the upper right
  // the painted cells may blend into each other, but are clipped to the diamond's outer edge
  const outer = [P(0,0), P(3,0), P(3,3), P(0,3)].map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  let g = `<defs><clipPath id="legDiamond"><polygon points="${outer}"/></clipPath></defs><g clip-path="url(#legDiamond)">`;
  for(let i = 0; i < 3; i++) for(let j = 0; j < 3; j++){
    const pts = [P(i,j), P(i+1,j), P(i+1,j+1), P(i,j+1)].map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    g += `${(() => { const cp = [P(i,j), P(i+1,j), P(i+1,j+1), P(i,j+1)]; const im = wcCell(cp, biColor(i,j), i === 0 && j === 0 ? WC.low : WC.cover, 101 + i * 7 + j * 31); return `<image href="${im.href}" x="${im.x}" y="${im.y}" width="${im.w}" height="${im.h}"/>`; })()}<polygon points="${pts}" class="bl-inkcell"/>`;
  }
  g += '</g>';
  // the top three cells (the named countries) lift off the diamond as one piece, with a short, sharp shadow
  { const lift = [P(2,1), P(3,1), P(3,3), P(1,3), P(1,2), P(2,2)].map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    // paper backing in the shape of the three cells first, then their paint, then the cell lines
    let paint = '', lines = '';
    for(const [i, j] of [[2,1],[1,2],[2,2]]){
      const cp = [P(i,j), P(i+1,j), P(i+1,j+1), P(i,j+1)], im = wcCell(cp, biColor(i,j), WC.cover, 101 + i * 7 + j * 31);
      paint += `<image href="${im.href}" x="${im.x}" y="${im.y}" width="${im.w}" height="${im.h}"/>`;
      lines += `<polygon points="${cp.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" class="bl-inkcell"/>`;
    }
    g += `<g class="bl-lift" filter="url(#blLift)" transform="translate(0,-2.6)"><polygon points="${lift}" class="bl-liftpaper"/><g clip-path="url(#legTop3)">${paint}</g>${lines}<polygon points="${lift}" class="bl-liftedge"/></g>`;   // a clean paper rim, like a cut-out sheet
    g = g.replace('<defs>', `<defs><clipPath id="legTop3"><polygon points="${lift}"/></clipPath><filter id="blLift" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="b1"/><feOffset in="b1" dx="0" dy="3.3" result="o1"/><feFlood flood-color="#281e32" flood-opacity="0.50"/><feComposite in2="o1" operator="in" result="s1"/><feGaussianBlur in="SourceAlpha" stdDeviation="0.45" result="b2"/><feOffset in="b2" dx="0" dy="1.3" result="o2"/><feFlood flood-color="#281e32" flood-opacity="0.50"/><feComposite in2="o2" operator="in" result="s2"/><feMerge><feMergeNode in="s1"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`); }
  const t = (x, y, rot, txt, cls, anchor) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" class="${cls}" text-anchor="${anchor||'middle'}">${txt}</text>`;
  // ticks on the lower-right edge (harvest hit) and lower-left edge (imports), offset outward
  [[1,'5'],[2,'15%']].forEach(([u,l]) => { const [x,y] = P(u,0); g += t(x - 10*n, y + 10*n, 45, l, 'bl-tk', 'end'); });
  [[1, AXES[AXIS].ticks[0]],[2, AXES[AXIS].ticks[1]]].forEach(([v,l]) => { const [x,y] = P(0,v); g += t(x + 10*n, y + 10*n, -45, l, 'bl-tk', 'start'); });
  // axis titles, reading along each edge like the reference
  // centred on the middle of each edge, so the labels never run past the diamond's ends
  { const [x,y] = P(1.5,0); g += t(x - 23*n, y + 23*n, 45, '← Shortfall', 'bl-ax', 'middle'); }
  { const [x,y] = P(0,1.5); g += t(x + 23*n, y + 23*n, -45, AXES[AXIS].axis + ' →', 'bl-ax', 'middle'); }
  // units and years as a centred caption, which keeps the legend about as tall as it is wide
  // definitions live in the key line under the map
  // title on top: the lifted cells are the countries named on the map
  { const [tx, ty] = P(3,3); g += t(tx, ty - 9, 0, 'Highest-risk countries', 'bl-top'); }
  return `<span class="bilegend"><svg viewBox="0 0 380 236" width="380" height="236" role="img" aria-label="Legend: colour combines import share (left axis, blue) and El Niño harvest shortfall (right axis, red); purple at the top is highest risk">${g}</svg></span>`;
}
const KEYS = { bi: biLegend };
function headline(){
  const v = Object.values(DATA.world), both = v.filter(r => r.e80 != null);
  if(view === 'bi'){
    const cell = Object.entries(DATA.world).filter(([, r]) => r.hgap != null && hitClass(r) === 2 && depClass(r) === 2);
    const sure = cell.filter(([id, r]) => r.hp < 0.1 && !CAUTION[id]).map(([, r]) => r).sort((a, b) => a.hgap - b.hgap);
    const caution = cell.filter(([id, r]) => r.hp < 0.1 && CAUTION[id]).map(([id]) => id);
    const unsure = cell.filter(([, r]) => r.hp >= 0.1).map(([, r]) => r);
    const nm = a => { const n = a.map(r => r.name.replace(/ \(.*\)/,'')); return n.length > 1 ? n.slice(0,-1).join(', ') + ' and ' + n[n.length-1] : n.join(''); };
    const zoomNote = ' Hover over a country for its figures.';
    const one = sure.length === 1, r0 = sure[0];
    const title = one ? `${nm(sure)} faces both risks: a large harvest shortfall in El Niño years, and most of its cereals imported`
                      : `${sure.length} countries face both risks: large harvest shortfalls in El Niño years, and more than half their cereals imported`;
    const lead = one ? `${nm(sure)}’s harvests are ${Math.round(-r0.hgap)}% smaller in El Niño years than in neutral years, and it imports ${Math.round(r0.now)}% of its cereals.`
                     : `${nm(sure)} come in ${Math.round(Math.min(...sure.map(r => -r.hgap)))} to ${Math.round(Math.max(...sure.map(r => -r.hgap)))}% smaller harvests in El Niño years than in neutral years and import more than half their cereals.`;
    const cNote = caution.map(id => ' ' + CAUTION[id]).join('');
    return [title, `${lead}${cNote}${unsure.length ? ` ${nm(unsure)} ${unsure.length>1?'fall':'falls'} in the same class with a weaker harvest signal (hatched).` : ''}${zoomNote}`];
  }
}
// zoom regions: every UN subregion with at least one purple country, i.e. any mixed colour: a harvest shortfall (5%+)
// together with import dependence (25%+). Ordered by the strongest clear finding, then by how many clear and purple countries.
const isPurple = r => !!r && r.hgap != null && hitClass(r) >= 1 && depClass(r) >= 1;
// labelled on the map: the highest-risk cell and the two cells that share an edge with it in the diamond (22, 21, 12)
const isLabelled = r => isPurple(r) && hitClass(r) + depClass(r) >= 3;
const PURPLE = Object.entries(DATA.world).filter(([, r]) => isPurple(r));
const zoneOf = id => { if(ZONE_OVERRIDE[id]) return ZONE_OVERRIDE[id]; const sb = M49_SUB[id]; return sb ? (ZOOM_GROUP[sb] || sb) : null; };
// zoom regions: every region with a labelled country (top three diamond cells) or a recorded El Niño food crisis, most crises first
const subStats = {};
const bump = (id, key) => { const sb = zoneOf(id); if(!sb) return; const st = subStats[sb] || (subStats[sb] = {crises: 0, labelled: 0}); st[key]++; };
Object.entries(DATA.world).forEach(([id, r]) => { if(isLabelled(r)) bump(id, 'labelled'); });
Object.keys(FOOD_INSEC).forEach(id => bump(id, 'crises'));
const ZOOM_SUBS = Object.keys(subStats).sort((a, b) => {
  const ia = ZOOM_ORDER.indexOf(a), ib = ZOOM_ORDER.indexOf(b);
  if(ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return subStats[b].crises - subStats[a].crises || subStats[b].labelled - subStats[a].labelled;
});
const REGIONS_Z = {world: null};
const REGION_NAME = {};
ZOOM_SUBS.forEach(sb => { REGIONS_Z[sb] = Object.keys(M49_SUB).filter(id => zoneOf(id) === sb); REGION_NAME[sb] = GROUP_NAME[sb] || M49_NAME[sb]; });
document.getElementById('zoomseg').innerHTML = '<button data-z="world" aria-pressed="true">World</button>' +
  ZOOM_SUBS.map(sb => `<button data-z="${sb}" aria-pressed="false" title="${REGION_NAME[sb]}">${REGION_NAME[sb].replace(' and the ', ' & ').replace(' and ', ' & ').replace('Central America', 'C. America').replace('West Asia', 'W. Asia').replace('North Africa', 'N. Africa').replace('Southeast Asia', 'SE Asia')}</button>`).join('');   // shorter button labels; the full name stays as the tooltip

const nameOf = (r, start) => { const n = shortName(r); return THE.has(n) ? (start ? 'The ' : 'the ') + n : n; };
const pctWords = x => Math.abs(x - 33) <= 1.5 ? 'a third' : Math.abs(x - 25) <= 1.5 ? 'a quarter' : Math.abs(x - 50) <= 2 ? 'half' : `${x}%`;
const listWords = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('');
function insightFor(key){
  // editorial insights: say what the pattern means, but only about what the map marks
  // (labelled countries = top three diamond cells; brown; hatching; dark borders = El Niño food crises)
  const ids = key === 'world' ? Object.keys(DATA.world) : REGIONS_Z[key];
  const rows = ids.map(id => [id, DATA.world[id]]).filter(([, r]) => r && r.hgap != null);
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const num = v => v <= 10 ? WORDS[v] : String(v);
  const nameById = id => DATA.world[id] ? nameOf(DATA.world[id]) : ((countries.features.find(f => f.id === id) || {properties: {name: id}}).properties.name);
  const names = list => listWords(list.map(nameById));
  if(key === 'world'){   // the harvest signal alone: imports add nothing to predicting crises
    const sf = rows.filter(([, r]) => hitClass(r) >= 1), rest = rows.filter(([, r]) => hitClass(r) === 0);
    const rate = list => list.filter(([id]) => FOOD_INSEC[id]).length / Math.max(1, list.length);
    const times = Math.floor(rate(sf) / Math.max(1e-9, rate(rest)));
    const sa = crisisClusters().find(k => k.ids.includes('716')), sfc = sf.filter(([id]) => FOOD_INSEC[id]), inSa = sa ? sfc.filter(([id]) => sa.ids.includes(id)).length : 0;
    return inSa === sfc.length ? `Where harvests fall in El Niño years, hunger has followed, but only in southern Africa: all ${num(sfc.length)} national food crises among those countries were there.`
      : `Where harvests fall in El Niño years, hunger has followed: ${num(inSa)} of the ${num(sfc.length)} national food crises among those countries were in southern Africa.`;
  }
  const lab = rows.filter(([, r]) => isLabelled(r)).map(([id]) => id);
  const crises = ids.filter(id => FOOD_INSEC[id]);   // every dark border counts, with or without harvest data (Somalia, Sudan)
  const labC = lab.filter(id => FOOD_INSEC[id]), labN = lab.filter(id => !FOOD_INSEC[id]), other = crises.filter(id => !lab.includes(id));
  // a researched line replaces the computed one only while the data still matches it
  const pick = INSIGHT_TEXT[key];
  if(pick && ((pick.when === 'noLabelledCrisis' && lab.length && !labC.length) || (pick.when === 'noLabelled' && !lab.length && crises.length))) return pick.text;
  if(!lab.length){
    if(!crises.length) return 'No country here is in the three highest-risk groups, and none had a recorded El Niño food crisis.';
    return `Hunger came without a harvest warning here: ${names(crises)} had El Niño food crises, but ${crises.length === 1 ? 'it has' : crises.length === 2 ? 'neither has' : 'none has'} a clear harvest shortfall on record.`;
  }
  if(labC.length === lab.length)
    return `This is where El Niño has hit hardest. Every labelled country here had a food crisis in 2015–16 or 2023–24${other.length ? `, and so did ${num(other.length)} others with dark borders` : ''}.`;
  if(!labC.length){
    const hatched = lab.filter(id => DATA.world[id].hp >= 0.1).length;
    return `High import bills, but no El Niño hunger on record: none of the labelled countries had a food crisis${hatched * 2 > lab.length ? ', and most of their harvest signals may be chance' : ''}.`;
  }
  return `El Niño’s toll here is patchy. ${names(labC)} had ${labC.length === 1 ? 'a food crisis' : 'food crises'} and ${names(labN)} did not${other.length ? `, while ${names(other)} had crises despite ranking lower` : ''}.`;
}
function showInsight(){
  const el = document.getElementById('insight'); if(!el){ scoreLine(); return; }   // the insight line was removed from the figure; the numbers still update
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = AXIS === 'imports' ? insightFor(region) : ''; el.style.display = AXIS === 'imports' ? '' : 'none'; el.style.opacity = 1; scoreLine(); }, 120);   // the count of highest-risk countries follows the region
}
// the legend shrinks on narrower maps, keeping its proportions (it is drawn once and scaled as a whole)
const legendScale = () => { const w = mapbox.clientWidth || 1000, onMap = getComputedStyle(document.getElementById('mapkey')).position === 'absolute';
  return !onMap ? 1 : w > 900 ? 1 : w > 680 ? 0.85 : w > 500 ? 0.72 : 0.6; };   // the legend always sits on the map
function paint(){
  mapbox.classList.toggle('world-view', region === 'world');   // world view: dark borders a little lighter
  showInsight();
  drawFiOutlines();
  mapbox.classList.toggle('bi', view === 'bi');
  // when zoomed to a region, dim every country outside it
  const inRegion = id => region === 'world' || (REGIONS_Z[region] || []).includes(id);
  paths.style('fill', 'transparent')
    .attr('class', d => 'country' + (fillFor(d.id) && inRegion(d.id) ? ' hit' : '') + (inRegion(d.id) ? '' : ' dim'));
  // small-country dots are for the world view only; zoomed in, the country itself is visible (and has its label or arrow)
  marks.style('display', region === 'world' ? null : 'none');
  marks.classed('fi', d => !!FOOD_INSEC[d.id]).style('fill', d => fillFor(d.id) || cssVar('--land')).style('fill-opacity', d => alphaFor(d.id)).attr('r', 3.2/k).style('stroke-dasharray', d => weak(d.id) ? '1.5 1.5' : null)
    .classed('dim', d => !inRegion(d.id));
  // keep the hatch a fine, constant texture on screen at every zoom level
  [hatchPat, hatchPatL].forEach(p => p.attr('patternTransform', `rotate(45) scale(${(1 / Math.max(1, k)).toFixed(4)})`));
  hatchPaths.attr('fill', d => hatchFor(d.id)).style('display', d => weak(d.id) ? null : 'none').classed('dim', d => !inRegion(d.id));
  // pencil borders: a tad stronger inside the selected region, a tad lighter outside it (Somaliland counts as Somalia)
  inkPaths.classed('dim', d => !inRegion(fiOf(d) || d.id)).classed('inreg', d => region !== 'world' && inRegion(fiOf(d) || d.id));
  scaleWatercolour(k);
  hatchPat.attr('patternTransform', `rotate(45) scale(${1/k})`);
  document.getElementById('mapkey').innerHTML = KEYS[view]();
  // crop the legend's viewBox to its drawing so it renders as large as possible in the corner
  const lsv = document.querySelector('#mapkey svg');
  if(lsv) lsv.querySelectorAll('.bl-ax').forEach(e => { const L = e.getComputedTextLength(), max = 54; if(L > max) e.style.fontSize = (10.5 * max / L).toFixed(2) + 'px'; });
  if(lsv){ const bb = lsv.getBBox(); const p = 3; lsv.setAttribute('viewBox', `${bb.x-p} ${bb.y-p} ${bb.width+2*p} ${bb.height+2*p}`); const ls = legendScale(); lsv.setAttribute('width', Math.ceil((bb.width+2*p) * ls)); lsv.setAttribute('height', Math.ceil((bb.height+2*p) * ls)); }
  const [h, s] = headline();
  // the figure has no visible title; its accessible name follows the selected region
  document.querySelector('.fig').setAttribute('aria-label', region === 'world' ? 'Map: El Niño harvest shortfall and cereal import dependence, by country' : `Map: El Niño harvest shortfall and cereal import dependence, ${REGION_NAME[region]}`);
  labels();
}
function labels(){
  labelG.selectAll('*').remove();
  calloutG.selectAll('*').remove(); calloutG.style('opacity', 0);
  if(region !== 'world' && !zoomAnimating) drawCallouts(wcT);
}
function frameFor(key){
  let t = d3.zoomIdentity, k;
  if(REGIONS_Z[key]){
    const ids = new Set(REGIONS_Z[key]);
    // frame on the countries that carry data; grey no-data countries (Botswana, Cuba, Papua New Guinea) do not pull the frame
    const feats = countries.features.filter(f => ids.has(f.id) && ((DATA.world[f.id] && DATA.world[f.id].hgap != null) || FOOD_INSEC[f.id]) && (() => { const [[a], [c]] = path.bounds(f); return c - a < W / 2; })());
    // regions whose islands cross the 180° line are framed on their real outlines, skipping points west of 0°
    // (New Zealand's Chatham Islands would otherwise stretch the frame across the whole map)
    const WRAP = {};   // no current zoom region crosses the 180° line
    let x0, y0, x1, y1;
    if(WRAP[key]){
      const pts = [];
      feats.forEach(f => { const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        polys.forEach(pl => pl[0].forEach(c => { if(c[0] > 0) pts.push(proj(c)); })); });
      x0 = d3.min(pts, p => p[0]); x1 = d3.max(pts, p => p[0]); y0 = d3.min(pts, p => p[1]); y1 = d3.max(pts, p => p[1]);
    } else [[x0, y0], [x1, y1]] = path.bounds({type:'FeatureCollection', features: feats});
    const pad = 30;
    const fit = (lw) => { const aw = W - lw, kk = Math.min(9, 0.92 / Math.max((x1-x0+pad)/aw, (y1-y0+pad)/H));
      return [kk, d3.zoomIdentity.translate(lw + aw/2 - kk*(x0+x1)/2, H/2 - kk*(y0+y1)/2).scale(kk)]; };
    // centre on the full map first; only make room for the legend if a country of this region would sit under it
    const keyEl = document.getElementById('mapkey');
    const over = getComputedStyle(keyEl).position === 'absolute';
    const lw = over ? keyEl.offsetWidth / Math.max(1, mapbox.clientWidth) * W : 0;
    const lh = over ? keyEl.offsetHeight / Math.max(1, mapbox.clientHeight) * H : 0;
    let [kk, tt] = fit(0);
    // check every country in the region, with or without data
    const hits = over && countries.features.filter(f => ids.has(f.id)).some(f => { const [[a, b], [c, e]] = path.bounds(f); if(c - a > W/2) return false;
      return tt.applyX(a) < lw && tt.applyY(e) > H - lh; });
    if(hits) [kk, tt] = fit(lw);
    k = kk; t = tt;
  } else {
    // world view: frame on the land itself (the projection still leaves room for the removed Antarctica);
    // features that cross the 180° line (Russia, Fiji) are left out of the bounds, the rest spans the full width anyway
    const feats = countries.features.filter(f => { const [[a], [c]] = path.bounds(f); return c - a < W / 2; });
    const [[x0, y0], [x1, y1]] = path.bounds({type: 'FeatureCollection', features: feats});
    const pad = 16;
    const fitW = lw => { const aw = W - lw, kk = Math.min(aw / (x1 - x0 + pad), H / (y1 - y0 + pad));
      return d3.zoomIdentity.translate(lw + aw / 2 - kk * (x0 + x1) / 2, H / 2 - kk * (y0 + y1) / 2).scale(kk); };
    t = fitW(0);   // the world keeps its full size; the legend may overlap South America
    k = t.k;
  }
  return t;
}
function zoomTo(key){
  region = key;
  const t = frameFor(key); k = t.k;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  paint();
  washTo(key, t, reduce ? 0 : 650);
}
paint();
// minimal sparklines for the tooltip: one line, faint El Niño harvest-year bands, a zero line where it matters
const SPARK_END = 2024;
function sparkline(vals, y0, opts){
  const w = 236, h = 30, pts = vals.map((v, i) => [y0 + i, v]).filter(p => p[1] != null);
  if(pts.length < 5) return '';
  const x = d3.scaleLinear().domain([y0, SPARK_END]).range([1, w - 1]);   // both charts share one timeline
  const lo = opts.lo(pts), hi = opts.hi(pts);
  const y = d3.scaleLinear().domain([lo, hi]).range([h - 2, 2]).clamp(true);
  const step = x(y0 + 1) - x(y0);
  const bands = (opts.enYears || []).filter(yr => yr >= y0 && yr <= SPARK_END).map(yr => `<rect x="${(x(yr) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${h}" class="sp-en"/>`).join('');
  const zero = lo < 0 && hi > 0 ? `<line x1="0" x2="${w}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="sp-zero"/>` : '';
  const d = d3.line().defined(p => p[1] != null).x(p => x(p[0])).y(p => y(p[1]))(vals.map((v, i) => [y0 + i, v]));
  return `<div class="sp"><div class="sp-cap"><span>${opts.label}</span><span>${opts.note || ''}</span></div>
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${bands}${zero}<path d="${d}" class="sp-line ${opts.cls}"/></svg></div>`;
}
const showTip = (ev, d) => {
  const r = DATA.world[d.id]; if(!r || (!fillFor(d.id) && !FOOD_INSEC[d.id]) || (region !== 'world' && !(REGIONS_Z[region] || []).includes(d.id))){ tip.style.opacity = 0; return; }
  // compact rows: a short label and its value
  const row = (k, v) => `<div class="tr"><span>${k}</span><b>${v}</b></div>`;
  const hv = r.hgap != null ? row('El Niño harvest', Math.round(-r.hgap) > 0 ? `${Math.round(-r.hgap)}% smaller${r.hp >= 0.1 ? ' <i>weak signal</i>' : ''}` : 'no shortfall') : row('El Niño harvest', 'not tested');
  const fiLine = FOOD_INSEC[d.id] ? row('Crisis', FOOD_INSEC[d.id].join(', ')) : FOOD_INSEC_MINOR[d.id] ? row('Smaller crisis', FOOD_INSEC_MINOR[d.id].join(', ')) : '';
  // two sparklines: harvest against trend and import share, with El Niño harvest years shaded
  const enYears = r.hev ? r.hev.map(e => e[0]) : [];
  const spH = r.han ? sparkline(r.han, 1980, {label: 'Harvest vs trend', note: '1980–2024', cls: 'sp-hit', enYears,
    lo: p => -Math.min(60, Math.max(20, d3.max(p, q => Math.abs(q[1])))), hi: p => Math.min(60, Math.max(20, d3.max(p, q => Math.abs(q[1])))) }) : '';
  const spI = r.imp ? sparkline(r.imp, 1980, {label: 'Imports, %', note: '1980–2022', cls: 'sp-imp', enYears,
    lo: p => Math.min(0, d3.min(p, q => q[1])), hi: p => Math.max(50, Math.min(100, d3.max(p, q => q[1]))) }) : '';
  const spKey = (spH || spI) && enYears.length ? '<div class="sp-key"><i></i>El Niño years</div>' : '';
  tip.innerHTML = `<b>${shortName(r)}</b>${AXIS === 'imports' ? row('Imports', r.now <= 0 ? 'net exporter' : `${Math.round(r.now)}% of cereals`) : row(AXES[AXIS].label, axisValue(ID_OF.get(r)))}${hv}${fiLine}${spH}${spI}${spKey}`;
  const rr = mapbox.getBoundingClientRect(); let x = ev.clientX - rr.left + 14, y = ev.clientY - rr.top + 14;
  if(x + 300 > rr.width) x = ev.clientX - rr.left - 304;
  tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1;
};
paths.on('pointermove', showTip).on('pointerleave', () => tip.style.opacity = 0);
marks.on('pointermove', showTip).on('pointerleave', () => tip.style.opacity = 0);
document.querySelectorAll('#zoomseg button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#zoomseg button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  zoomTo(b.dataset.z);
}));
const shortName = r => SHORT[r.name] || r.name.replace(/ \(.*\)/, '').replace('Democratic Republic of the ', 'DR ').replace('United Republic of ', '').replace(' of America', '');

// ---- explorer: switch the second axis; shortfall stays fixed -------------------------------------------------
const AXIS_ORDER = Object.keys(AXES);   // the measures present in js/axes.js, in order
function axisValue(id){
  const v = AXES[AXIS].vals[id]; if(v == null) return 'no data';
  return AXIS === 'gdp' ? '$' + Math.round(v).toLocaleString('en') + ' per person' : AXIS === 'poverty' ? Math.round(v) + '% in extreme poverty'
    : AXIS === 'hdi' ? v.toFixed(3) : AXIS === 'life' ? Math.round(v) + ' years' : AXIS === 'undernourishment' ? Math.round(v) + '% undernourished' : v;
}
const sc = o => ({h: o['2015'].hits + o['2023'].hits, f: o['2015'].false + o['2023'].false, m: o['2015'].missed + o['2023'].missed});
// count hits, false alarms and misses for a measure over a set of countries, both rounds together
function scoreFor(axis, ids){
  const SA = new Set(['024','072','748','426','450','454','508','516','710','894','716']);
  let h = 0, f = 0, m = 0;
  ids.forEach(id => { const t = AXIS_TEST[id]; if(!t) return;
    for(let k = 0; k < 2; k++){
      if(t.s[k] < 0) continue;
      const flag = axis === 'region' ? SA.has(id) : axis === 'none' ? t.s[k] === 1 : t.s[k] === 1 && t.k[axis][k] >= 1, crisis = t.c[k] === 1;
      if(flag && crisis) h++; else if(flag) f++; else if(crisis) m++;
    }
  });
  return {h, f, m};
}
function scoreLine(){
  // three big numbers for the selected measure, counted for the countries in view
  const el = document.getElementById('score'); if(!el) return;
  const ids = region === 'world' ? Object.keys(AXIS_TEST) : (REGIONS_Z[region] || []);
  const a = scoreFor(AXIS, ids);
  const top = Object.keys(DATA.world).filter(id => isLabelled(DATA.world[id]));
  const inView = region === 'world' ? top.length : top.filter(id => (REGIONS_Z[region] || []).includes(id)).length;
  // big number first, its meaning underneath
  const stat = (big, unit, label) => `<div class="stat"><div class="sb">${big}<span class="su">${unit}</span></div><div class="sl">${label}</div></div>`;
  el.innerHTML = stat(inView, ` of ${top.length}`, 'highest-risk countries in view') +
    stat(a.h, ` of ${a.h + a.m}`, 'food crises the map would have warned of') +
    stat(a.f, '', 'warnings followed by no crisis') +
    '<div class="scontext">If drawn before each of the last two El Niños.</div>';
}
const SCOPE = 'world';   // the table always shows worldwide results
function scoreMatrix(){
  const el = document.getElementById('scores'); if(!el) return;
  const rows = [['region', 'Every southern African country'], ['none', 'Shortfall alone']].concat(AXIS_ORDER.map(a => [a, 'Shortfall + ' + AXES[a].label.toLowerCase()]));
  const cell = o => `${o.hits} of ${o.hits + o.missed}<span class="fa"> · ${o.false} false</span>`;
  el.querySelector('tbody').innerHTML = rows.map(([k, label]) => { const o = AXIS_SCORES[SCOPE][k], s = sc(o);
    return `<tr class="${k === AXIS ? 'cur' : ''}${AXES[k] ? ' pick' : ''}" data-axis="${AXES[k] ? k : ''}"><th scope="row">${label}</th><td>${cell(o['2015'])}</td><td>${cell(o['2023'])}</td><td>${Math.round(100 * s.h / (s.h + s.m))}%</td><td>${Math.round(100 * s.h / Math.max(1, s.h + s.f))}%</td></tr>`; }).join('');
  el.querySelectorAll('tr.pick').forEach(tr => tr.addEventListener('click', () => setAxis(tr.dataset.axis)));
}
function setAxis(a){
  if(!AXES[a] || a === AXIS) return;
  AXIS = a;
  const sel = document.getElementById('axissel'); if(sel) sel.value = a;   // keep the dropdown in step when the matrix switches the theory
  for(const k in pieceCache) delete pieceCache[k]; plateCache = null;   // which countries are named and raised depends on the axis
  const def = document.getElementById('axisdef'); if(def) def.innerHTML = AXIS_DEFS[a];
  wcNow = washFor(); paint(); drawWash(wcT, wcNow); showInsight(); scoreLine(); scoreMatrix();
}
const AXIS_DEFS = {
  imports: '<b>Imports:</b>&nbsp;% of cereals, 2020–22',
  gdp: '<b>Income:</b>&nbsp;GDP per person in US dollars, 2022; classes follow the World Bank’s income groups (4.5k, 1.1k)',
  poverty: '<b>Extreme poverty:</b>&nbsp;% living below the international poverty line, latest survey',
  hdi: '<b>Human development:</b>&nbsp;UNDP Human Development Index; medium below 0.70, low below 0.55',
  life: '<b>Life expectancy:</b>&nbsp;years at birth; classes split at the median (74) and 65',
  undernourishment: '<b>Undernourishment:</b>&nbsp;% of people eating too little, FAO three-year average; classes at 10% and 25%. Chronic hunger makes any shock worse, El Niño or not',
};
// the theory to test: one dropdown, "Shortfall + <measure>"
document.getElementById('axisseg').innerHTML = '<select id="axissel" aria-label="Theory to test">' +
  AXIS_ORDER.map(a => `<option value="${a}"${a === AXIS ? ' selected' : ''}>Shortfall + ${AXES[a].label.toLowerCase()}</option>`).join('') + '</select>';
document.getElementById('axissel').addEventListener('change', e => setAxis(e.target.value));
scoreLine(); scoreMatrix();

zoomTo('world');
// open on the story: Sub-Saharan Africa (World is one click away)

// ---- the selected region button is painted as a watercolour wash, with the same layered method as the map ----
const btnWashCache = {};
// paint a button-sized watercolour wash in the given colour; kept gentle so it reads as one even brushstroke
const seedOf = str => { let h = 2166136261; for(const ch of str){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; };
function washImage(w, h, colour, seedKey){
  // one horizontal brushstroke: a nearly straight band, fine bristle streaks along it, and a slightly dry, frayed right end
  const key = w + 'x' + h + colour + seedKey; if(btnWashCache[key]) return btnWashCache[key];
  const S = 2, pad = 3, c = document.createElement('canvas'); c.width = (w + 2 * pad) * S; c.height = (h + 2 * pad) * S;
  const g = c.getContext('2d'); g.setTransform(S, 0, 0, S, pad * S, pad * S); wcSeed = seedOf(seedKey);
  const ph1 = wrnd() * 6.28, ph2 = wrnd() * 6.28, amp = 0.7 + wrnd() * 0.5;
  const top = x => 1 + amp * Math.sin(x / w * Math.PI * 1.3 + ph1) * 0.8, bot = x => h - 1 - amp * Math.sin(x / w * Math.PI * 1.1 + ph2) * 0.8;
  // the band itself: slight wave along top and bottom, the right end tapering a touch
  const band = new Path2D(), n = 40, endX = w - 2 - wrnd() * 3;
  band.moveTo(0.5, top(0));
  for(let i = 1; i <= n; i++){ const x = endX * i / n; band.lineTo(x, top(x) + (i > n - 4 ? (i - n + 4) * 0.35 : 0)); }
  for(let i = n; i >= 0; i--){ const x = endX * i / n; band.lineTo(x, bot(x) - (i > n - 4 ? (i - n + 4) * 0.35 : 0)); }
  band.closePath();
  g.fillStyle = colour; g.globalAlpha = 0.82; g.fill(band);
  // bristle streaks: thin lines along the stroke, a little lighter or denser, some stopping short at the right
  g.save(); g.clip(band); g.strokeStyle = colour; g.lineCap = 'round';
  const bristles = Math.round(h * 2.2);
  for(let b = 0; b < bristles; b++){
    const y = 1.5 + wrnd() * (h - 3), x0 = wrnd() * 2, x1 = endX - (wrnd() < 0.3 ? wrnd() * w * 0.25 : wrnd() * 2);
    g.globalAlpha = 0.06 + wrnd() * 0.16; g.lineWidth = 0.5 + wrnd() * 1.4;
    g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + (wrnd() - 0.5) * 1.2, x1, y + (wrnd() - 0.5) * 0.8); g.stroke();
  }
  // a few lighter gaps where the brush ran dry
  g.globalCompositeOperation = 'destination-out';
  for(let b = 0; b < 4; b++){
    const y = 2 + wrnd() * (h - 4), x0 = w * (0.55 + wrnd() * 0.3);
    g.globalAlpha = 0.18 + wrnd() * 0.2; g.lineWidth = 0.6 + wrnd() * 0.8;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(endX + 1, y + (wrnd() - 0.5)); g.stroke();
  }
  g.restore();
  return (btnWashCache[key] = c.toDataURL('image/png'));
}
function paintButton(btn, colour, kind){
  btn.style.backgroundImage = colour ? `url(${washImage(Math.round(btn.offsetWidth), Math.round(btn.offsetHeight), colour, btn.dataset.z + ':' + kind)})` : '';
  btn.style.backgroundSize = 'calc(100% + 6px) calc(100% + 6px)'; btn.style.backgroundPosition = '-3px -3px';
}
const washButton = btn => paintButton(btn, cssVar('--ink'), 'selected');
function washSelected(){ document.querySelectorAll('#zoomseg button').forEach(b => { b.style.backgroundImage = ''; }); }   // buttons use plain CSS fills
document.querySelectorAll('#zoomseg button').forEach(b => b.addEventListener('click', () => setTimeout(washSelected, 0)));
window.addEventListener('resize', () => setTimeout(washSelected, 200));
{ let keep = null; try { keep = sessionStorage.getItem('elnino-region'); sessionStorage.removeItem('elnino-region'); } catch(e){}
  const start = document.querySelector('#zoomseg button[data-z="world"]');   // always open on the world view
  if(start) start.click(); }
washSelected();
