// El Niño × food security: text on the map. In the world view, short notes on the clusters of crisis countries;
// zoomed into a region, the names of the highest-risk countries, on the country or beside it with a swoopy arrow.

const calloutG = svg.append('g').attr('class', 'callouts').style('opacity', 0);
defs.append('marker').attr('id', 'swoopHead').attr('viewBox', '0 0 10 10').attr('refX', 8.5).attr('refY', 5)
  .attr('markerWidth', 5.5).attr('markerHeight', 5.5).attr('orient', 'auto-start-reverse').attr('markerUnits', 'strokeWidth')
  .append('path').attr('d', 'M0,1 L9,5 L0,9 z').attr('class', 'swoop-head');

// draw the labels for the current region at zoom transform t
function drawCallouts(t){
  calloutG.selectAll('*').remove(); calloutG.interrupt().style('opacity', 0);
  if(region === 'world') drawWorldNotes(t);
  else if(!drawRegionLabels(t)) return;   // no named country in this region
  calloutG.transition().duration(zoomAnimating ? 0 : 220).style('opacity', 1);
}

// ---- world view: notes on the clusters of crisis borders -------------------------------------------------
// clusters of crisis countries, found from the data: countries in the same zoom region join if they touch or lie within
// CLUSTER_KM of each other; a country left on its own joins the nearest cluster in its region
let clusterCache = null;
function crisisClusters(){
  if(clusterCache) return clusterCache;
  const geoms = WORLD.objects.countries.geometries;
  const idx = geoms.map((g, i) => i).filter(i => FOOD_INSEC[fiOf(geoms[i])]);
  const featCache = {}, feat = i => featCache[i] || (featCache[i] = topojson.feature(WORLD, geoms[i]));   // shape straight from the map file
  const zone = i => zoneOf(fiOf(geoms[i]));
  const neighbours = topojson.neighbors(geoms);

  // up to about 150 points along each country's outer rings, for the distance tests
  const pts = {};
  idx.forEach(i => {
    const g = feat(i).geometry, polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const all = [];
    polygons.forEach(pl => pl[0].forEach(p => all.push(p)));
    const step = Math.max(1, Math.floor(all.length / 150));
    pts[i] = all.filter((p, k) => k % step === 0);
  });
  const distanceKm = (a, b) => {
    let m = Infinity;
    for(const p of pts[a]) for(const q of pts[b]){ const d = d3.geoDistance(p, q); if(d < m) m = d; }
    return m * 6371;
  };
  const within = (a, b, limitKm) => {   // stops at the first close pair
    const limit = limitKm / 6371;
    for(const p of pts[a]) for(const q of pts[b]) if(d3.geoDistance(p, q) < limit) return true;
    return false;
  };

  // union-find over the crisis countries
  const parent = {}; idx.forEach(i => parent[i] = i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const join = (a, b) => { parent[find(a)] = find(b); };
  idx.forEach(a => idx.forEach(b => {
    if(a < b && zone(a) === zone(b) && (neighbours[a].includes(b) || within(a, b, CLUSTER_KM))) join(a, b);
  }));
  const groups = () => { const m = {}; idx.forEach(i => (m[find(i)] = m[find(i)] || []).push(i)); return Object.values(m); };
  groups().filter(gr => gr.length === 1).forEach(([i]) => {   // a loner joins the nearest cluster in its region
    let best = null;
    idx.forEach(j => {
      if(find(j) === find(i) || zone(j) !== zone(i)) return;
      const d = distanceKm(i, j);
      if(!best || d < best.d) best = {j, d};
    });
    if(best) join(i, best.j);
  });
  return (clusterCache = groups().map(gr => ({ids: gr.map(i => fiOf(geoms[i])), features: gr.map(feat)})));
}

// where the land is, at transform t: the alpha channel of every country filled on a canvas the size of the viewBox
let landMask = null;
function landMaskFor(t){
  const key = [t.k, t.x, t.y].map(v => v.toFixed(3)).join(',');
  if(landMask && landMask.key === key) return landMask;
  // full resolution (S = 1), so small islands are in the mask
  const S = 1, mc = document.createElement('canvas');
  mc.width = Math.ceil(W / S); mc.height = Math.ceil(H / S);
  const ctx = mc.getContext('2d');
  ctx.setTransform(t.k / S, 0, 0, t.k / S, t.x / S, t.y / S);
  const gp = d3.geoPath(proj, ctx);
  ctx.beginPath(); countries.features.forEach(f => gp(f)); ctx.fill();
  return (landMask = {key, S, w: mc.width, h: mc.height, a: ctx.getImageData(0, 0, mc.width, mc.height).data});
}
function isLand(mask, sx, sy){
  const mx = Math.floor(sx / mask.S), my = Math.floor(sy / mask.S);
  return mx >= 0 && my >= 0 && mx < mask.w && my < mask.h && mask.a[(my * mask.w + mx) * 4 + 3] > 0;
}

// short notes on the clusters, without leader lines. A force simulation pulls each note towards its cluster and pushes it
// off land, off the other notes and off the legend, so it settles in the nearest open water
function drawWorldNotes(t){
  const u = unitsPerPx(), narrow = mapbox.clientWidth <= 800;   // narrower maps only get the phone notes
  const notes = WORLD_NOTES.filter(n => (!narrow || n.phone) && crisisClusters().some(k => k.ids.includes(n.member)));
  if(!notes.length) return;
  const mask = landMaskFor(t), pad = 5 * u, edge = 6 * u;
  const keyBox = legendBox(u, pad);

  // share of a note's box (centre x, y, size w, h, padded) that lies on land, sampled on a grid
  const landShare = (x, y, w, h) => {
    let on = 0, all = 0;
    const step = Math.max(2, Math.min(w, h) / 8);
    for(let sx = x - w / 2 - pad; sx <= x + w / 2 + pad; sx += step){
      for(let sy = y - h / 2 - pad; sy <= y + h / 2 + pad; sy += step){ all++; if(isLand(mask, sx, sy)) on++; }
    }
    return on / Math.max(1, all);
  };
  // strict check for the final placement: every 1.5 units, so thin islands (Haiti, Puerto Rico) cannot slip between samples
  const touchesLand = (x, y, w, h) => {
    for(let sx = x - w / 2 - pad; sx <= x + w / 2 + pad; sx += 1.5){
      for(let sy = y - h / 2 - pad; sy <= y + h / 2 + pad; sy += 1.5) if(isLand(mask, sx, sy)) return true;
    }
    return false;
  };

  // write each note (left-aligned lines), measure it, and aim it at the geographic centre of its cluster
  const nodes = notes.map(n => {
    const g = calloutG.append('g').attr('class', 'wnote'), titles = [].concat(n.title);
    [...titles, ...n.lines].forEach((text, i) => g.append('text').attr('x', 0).attr('y', i * 13.5 * u)
      .attr('class', i < titles.length ? 'wn-title' : 'wn-body').style('font-size', (i < titles.length ? 12 : 11.5) * u + 'px').text(text));
    const cluster = crisisClusters().find(k => k.ids.includes(n.member));
    const centre = proj(d3.geoCentroid({type: 'FeatureCollection', features: cluster.features}));
    const bb = g.node().getBBox(), tx = t.applyX(centre[0]), ty = t.applyY(centre[1]);
    return {g, bx: bb.x, by: bb.y, w: bb.width, h: bb.height, tx, ty, x: tx, y: ty};
  });
  const overlap = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w + 2 * pad && Math.abs(a.y - b.y) * 2 < a.h + b.h + 2 * pad;
  const onLegend = n => keyBox && n.x + n.w / 2 > keyBox[0] && n.x - n.w / 2 < keyBox[2] && n.y + n.h / 2 > keyBox[1] && n.y - n.h / 2 < keyBox[3];

  // 1. the simulation
  const DIRS = d3.range(16).map(k => [Math.cos(k / 16 * 2 * Math.PI), Math.sin(k / 16 * 2 * Math.PI)]);
  const driftOffLand = alpha => nodes.forEach(n => {   // look around for less land, nearest ring first, and drift that way
    const here = landShare(n.x, n.y, n.w, n.h);
    if(here <= 0) return;
    for(const R of [10 * u, 25 * u, 50 * u, 90 * u]){
      let best = null;
      DIRS.forEach(([dx, dy]) => { const c = landShare(n.x + dx * R, n.y + dy * R, n.w, n.h); if(!best || c < best.c) best = {c, dx, dy}; });
      if(best.c < here){ const f = (here - best.c) * 14 * u * alpha * 4; n.vx += best.dx * f; n.vy += best.dy * f; return; }
    }
  });
  const keepApart = () => {
    for(let i = 0; i < nodes.length; i++) for(let j = i + 1; j < nodes.length; j++) if(overlap(nodes[i], nodes[j])) pushApart(nodes[i], nodes[j], pad);
  };
  const keepInFrame = () => nodes.forEach(n => {
    if(onLegend(n)) n.y = Math.min(n.y, keyBox[1] - n.h / 2 - pad);   // lift it above the legend
    clampToFrame(n, edge);
  });
  const sim = d3.forceSimulation(nodes).alphaDecay(0.02).velocityDecay(0.35)
    .force('x', d3.forceX(n => n.tx).strength(0.04)).force('y', d3.forceY(n => n.ty).strength(0.04))
    .force('land', driftOffLand).force('apart', keepApart).force('frame', keepInFrame)
    .stop();
  for(let i = 0; i < 400; i++) sim.tick();

  // 2. each note then takes the nearest free spot around its cluster, if that is closer than where the simulation left it
  // (or if it is still on land, on the legend, or on another note)
  const bad = n => touchesLand(n.x, n.y, n.w, n.h) || onLegend(n) || nodes.some(o => o !== n && overlap(n, o));
  const distance = n => Math.hypot(n.x - n.tx, n.y - n.ty);
  nodes.forEach(n => {
    const px = n.x, py = n.y, here = bad(n) ? Infinity : distance(n);
    let best = null;
    for(let r = 6; r <= 260; r += 6){
      for(let k = 0; k < 32; k++){
        const th = k / 32 * 2 * Math.PI;
        n.x = n.tx + Math.cos(th) * r * u; n.y = n.ty + Math.sin(th) * r * u * 0.75;
        clampToFrame(n, edge);
        if(!bad(n)){ const d = distance(n); if(!best || d < best.d) best = {x: n.x, y: n.y, d}; }
      }
    }
    if(best && best.d < here){ n.x = best.x; n.y = best.y; } else { n.x = px; n.y = py; }
  });
  nodes.forEach(n => n.g.attr('transform', `translate(${(n.x - n.w / 2 - n.bx).toFixed(1)},${(n.y - n.h / 2 - n.by).toFixed(1)})`));
}

// ---- zoomed in: the names of the highest-risk countries --------------------------------------------------
// label point: the spot deepest inside the country's largest piece (pole of inaccessibility), on screen at transform t
function anchorOf(f, t){
  let best = null, bestArea = -1;
  ringsOf(f).forEach(r => { const a = Math.abs(d3.polygonArea(r)); if(a > bestArea){ bestArea = a; best = r; } });
  const edgeDist = p => {
    let m = Infinity;
    for(let i = 0; i < best.length; i++){ const d = segDist2(p, best[i], best[(i + 1) % best.length]); if(d < m) m = d; }
    return Math.sqrt(m);
  };
  let [x0, y0, x1, y1] = bbox(best), c = d3.polygonCentroid(best), cd = d3.polygonContains(best, c) ? edgeDist(c) : -1;
  // a coarse grid, then two finer passes around the best spot
  for(let pass = 0; pass < 3; pass++){
    const N = 14;
    for(let i = 0; i <= N; i++){
      for(let j = 0; j <= N; j++){
        const p = [x0 + (x1 - x0) * i / N, y0 + (y1 - y0) * j / N];
        if(!d3.polygonContains(best, p)) continue;
        const d = edgeDist(p);
        if(d > cd){ cd = d; c = p; }
      }
    }
    const wx = (x1 - x0) / 5, wy = (y1 - y0) / 5;
    x0 = c[0] - wx; x1 = c[0] + wx; y0 = c[1] - wy; y1 = c[1] + wy;
  }
  return [t.applyX(c[0]), t.applyY(c[1])];
}

// Each name goes on its country where it covers at most half of it; the others sit beside the region, placed by a force
// simulation, with a swoopy arrow to their country. Arrow crossings are then removed by bending arrows and swapping labels.
function drawRegionLabels(t){
  const u = unitsPerPx(), edge = 6 * u, pad = 3 * u;
  const keyBox = legendBox(u, pad);   // the legend, in viewBox units: labels stay clear of it
  const items = measureLabels(t, u);
  if(!items.length) return false;
  const placed = placeOnCountries(items, u, edge, pad, keyBox);
  const outs = items.filter(it => !it.inline);   // the labels that go beside the region
  // fixed obstacles for those: the labels on countries, the legend, every arrow point, and the countries being pointed at
  const statics = [...placed];
  if(keyBox) statics.push(keyBox);
  items.forEach(it => statics.push([it.a[0] - 9 * u, it.a[1] - 9 * u, it.a[0] + 9 * u, it.a[1] + 9 * u]));
  outs.forEach(it => { const [x0, y0, x1, y1] = bbox(it.pts); statics.push([x0 - 2 * u, y0 - 2 * u, x1 + 2 * u, y1 + 2 * u]); });
  const blocked = it => {   // does a side label overlap an obstacle or another side label?
    const bb = boxOf(it, pad);
    return statics.some(b => boxesOverlap(bb, b)) || outs.some(o => o !== it && boxesOverlap(bb, boxOf(o, pad)));
  };
  const separate = separator(outs, statics, edge, pad);
  if(outs.length) placeBeside(items, outs, u, edge, separate, blocked);
  outs.forEach(it => setBox(it, pad));
  routeArrows(items, outs, u, edge, pad, separate, blocked);
  // draw
  items.forEach(it => {
    const x = it.inline ? it.a[0] : it.x, y = it.inline ? it.a[1] : it.y;
    it.g.attr('transform', `translate(${x},${y - it.by - it.h / 2})`).selectAll('text').attr('text-anchor', 'middle');
    if(it.inline) return;
    calloutG.insert('path', ':first-child').attr('class', 'swoop').attr('d', swoopPath(it.p0, it.a, it.arc[0], it.arc[1]))
      .attr('marker-end', 'url(#swoopHead)').style('stroke-width', (1 * u) + 'px');
  });
  return true;
}

// a label placed beside its country: its box from centre (x, y) and size (w, h), padded
const boxOf = (it, pad) => [it.x - it.w / 2 - pad, it.y - it.h / 2 - pad, it.x + it.w / 2 + pad, it.y + it.h / 2 + pad];
const setBox = (it, pad) => { it.box = boxOf(it, pad); };

// one item per named country in the region: its label (written and measured), its anchor point and its outline on screen
function measureLabels(t, u){
  const ids = REGION_SET[region];
  return countries.features.filter(f => ids.has(f.id) && isLabelled(DATA.world[f.id])).map(f => {
    const r = DATA.world[f.id];
    const g = calloutG.append('g').attr('class', 'callout');
    g.append('text').attr('class', 'ml-name').attr('y', 4 * u).style('font-size', (11 * u) + 'px').text(shortName(r));   // name only; figures are in the tooltip
    const bb = g.node().getBBox();
    const rings = ringsOf(f).map(rg => rg.map(p => [t.applyX(p[0]), t.applyY(p[1])]));
    return {id: f.id, f, r, g, w: bb.width, h: bb.height, bx: bb.x, by: bb.y, a: anchorOf(f, t), rings, pts: rings.flat()};
  });
}

// labels on their own country (it.inline) where the label covers at most half of it, largest countries first, without overlaps.
// Returns the boxes of the labels placed
function placeOnCountries(items, u, edge, pad, keyBox){
  // how much of each country would a label at its anchor cover? sampled on a 36 × 36 grid over the country's box
  items.forEach(it => {
    const bx0 = it.a[0] - it.w / 2 - pad, by0 = it.a[1] - it.h / 2 - pad, bx1 = it.a[0] + it.w / 2 + pad, by1 = it.a[1] + it.h / 2 + pad;
    it.inBox = [bx0, by0, bx1, by1];
    const [x0, y0, x1, y1] = bbox(it.pts);
    let inside = 0, covered = 0;
    const N = 36;
    for(let i = 0; i < N; i++){
      for(let j = 0; j < N; j++){
        const p = [x0 + (x1 - x0) * (i + 0.5) / N, y0 + (y1 - y0) * (j + 0.5) / N];
        if(!it.rings.some(rg => d3.polygonContains(rg, p))) continue;
        inside++;
        if(p[0] > bx0 && p[0] < bx1 && p[1] > by0 && p[1] < by1) covered++;
      }
    }
    it.area = (x1 - x0) * (y1 - y0) * inside / (N * N);
    it.coverage = inside ? covered / inside : 1;
  });
  const placed = [];
  items.slice().sort((a, b) => b.area - a.area).forEach(it => {
    const b = it.inBox;
    const inFrame = b[0] >= edge && b[2] <= W - edge && b[1] >= edge && b[3] <= H - edge;
    // nor may it cover another country's arrow point
    const coversAnchor = items.some(o => o !== it && o.a[0] > b[0] - 4 * u && o.a[0] < b[2] + 4 * u && o.a[1] > b[1] - 4 * u && o.a[1] < b[3] + 4 * u);
    const fits = it.coverage <= 0.5 && inFrame && !placed.some(q => boxesOverlap(b, q)) && !(keyBox && boxesOverlap(b, keyBox)) && !coversAnchor;
    if(fits){ it.inline = true; it.box = b; placed.push(b); }
  });
  return placed;
}

// the labels beside the region: a force simulation pulls each towards a spot a short way out from its country,
// and pushes them off each other and off the fixed obstacles; anything still boxed in takes the nearest free spot
function placeBeside(items, outs, u, edge, separate, blocked){
  // start a short way out from the country, away from the centre of all the named countries; that gap sets the arrow length
  const cx0 = d3.mean(items, it => it.a[0]), cy0 = d3.mean(items, it => it.a[1]);
  outs.forEach(it => {
    let dx = it.a[0] - cx0, dy = it.a[1] - cy0;
    if(Math.hypot(dx, dy) < 1e-3){ dx = 1; dy = -1; }
    const L = Math.hypot(dx, dy), off = 41.5 * u + Math.max(it.w, it.h) / 2;
    it.tx = it.a[0] + dx / L * off; it.ty = it.a[1] + dy / L * off; it.x = it.tx; it.y = it.ty;
  });

  const sim = d3.forceSimulation(outs).alphaDecay(0.03)
    .force('x', d3.forceX(it => it.tx).strength(0.15)).force('y', d3.forceY(it => it.ty).strength(0.15))
    .force('separate', separate).stop();
  for(let i = 0; i < 250; i++) sim.tick();
  for(let i = 0; i < 200 && outs.some(blocked); i++) separate();

  // anything still boxed in: the first free spot on rings around its country, nearest ring first
  outs.forEach(it => {
    if(!blocked(it)) return;
    for(let r = 24; r <= 260; r += 12){
      for(let k = 0; k < 32; k++){
        const th = k / 32 * 2 * Math.PI, px = it.x, py = it.y;
        it.x = it.a[0] + Math.cos(th) * (r * u + it.w / 2); it.y = it.a[1] + Math.sin(th) * (r * u + it.h / 2);
        clampToFrame(it, edge);
        if(!blocked(it)) return;
        it.x = px; it.y = py;
      }
    }
  });
}

// push the side labels off each other and out of the fixed obstacles, along the shorter way, and keep them in frame
function separator(outs, statics, edge, pad){
  const pushOut = (it, b) => {
    const bb = boxOf(it, pad);
    if(!boxesOverlap(bb, b)) return;
    const left = bb[2] - b[0], right = b[2] - bb[0], up = bb[3] - b[1], down = b[3] - bb[1], m = Math.min(left, right, up, down);
    if(m === left) it.x -= left; else if(m === right) it.x += right; else if(m === up) it.y -= up; else it.y += down;
  };
  return () => {
    for(let a = 0; a < outs.length; a++) for(let b = a + 1; b < outs.length; b++) pushApart(outs[a], outs[b], pad);
    outs.forEach(it => { statics.forEach(b => pushOut(it, b)); clampToFrame(it, edge); });
  };
}

// the arrows: from each side label's edge to its country, as a gentle swoop. Crossings are removed by trying other bends,
// by swapping nearby labels' places, by moving a label whose arrow crosses another label, and finally by swapping any two
function routeArrows(items, outs, u, edge, pad, separate, blocked){
  const setBoxes = () => outs.forEach(it => setBox(it, pad));

  // where the arrow leaves the label: the point on the label's padded box towards the country
  const startOf = it => {
    const dx = it.a[0] - it.x, dy = it.a[1] - it.y;
    const sx = (it.w / 2 + 3 * u) / Math.max(1e-6, Math.abs(dx)), sy = (it.h / 2 + 3 * u) / Math.max(1e-6, Math.abs(dy));
    const sc = Math.min(sx, sy, 1);
    return [it.x + dx * sc, it.y + dy * sc];
  };

  // give every arrow its best bend: [angle, sweep]. Returns the total cost: crossed arrows, crossed labels, and length;
  // long arrows cost heavily, so a swap never moves a label far from its country
  const BENDS = [[Math.PI / 6, 1], [Math.PI / 6, 0], [0, 0], [Math.PI / 3, 1], [Math.PI / 3, 0]];
  const chooseBends = () => {
    const boxes = items.map(it => it.box || it.inBox), drawn = [];
    let cost = 0;
    outs.forEach(it => {
      const p0 = startOf(it);
      let best = null;
      for(const bend of BENDS){
        const arc = arcPoints(p0, it.a, bend[0], bend[1]);
        const crossedArrows = drawn.filter(q => segsCross(arc, q)).length;
        const crossedLabels = boxes.filter(b => b !== it.box && arc.slice(2, -2).some(p => insideBox(p, b))).length;
        const k = crossedArrows * 30 + crossedLabels * 10;
        if(!best || k < best.k) best = {bend, arc, k};
        if(k === 0) break;
      }
      let len = 0;
      for(let i = 1; i < best.arc.length; i++) len += Math.hypot(best.arc[i][0] - best.arc[i - 1][0], best.arc[i][1] - best.arc[i - 1][1]);
      it.p0 = p0; it.arc = best.bend; drawn.push(best.arc);
      cost += best.k + len / (0.08 * W) + (len > 90 * u ? 40 + (len - 90 * u) / u : 0);
    });
    return cost;
  };

  // swap two labels' places and settle the others; restore() puts every label back
  const swap = (p, q) => {
    const snap = outs.map(it => [it.x, it.y]);
    [p.x, q.x] = [q.x, p.x]; [p.y, q.y] = [q.y, p.y];
    for(let i = 0; i < 60 && outs.some(blocked); i++) separate();
    setBoxes();
    return () => { outs.forEach((it, n) => { it.x = snap[n][0]; it.y = snap[n][1]; }); setBoxes(); chooseBends(); };
  };

  // 1. nearby labels trade places while that lowers the cost
  let cost = chooseBends();
  for(let round = 0; round < 8; round++){
    let improved = false;
    for(let a = 0; a < outs.length; a++){
      for(let b = a + 1; b < outs.length; b++){
        const p = outs[a], q = outs[b];
        if(Math.hypot(p.x - q.x, p.y - q.y) > 0.3 * W) continue;   // only near neighbours
        const restore = swap(p, q);
        const c2 = outs.some(blocked) ? Infinity : chooseBends();
        if(c2 < cost - 1e-6){ cost = c2; improved = true; } else restore();
      }
    }
    if(!improved) break;
  }

  // 2. a label whose arrow still crosses another label moves to the nearest spot with a clear path to its country
  const crossesBox = (p0, p1, bx) => {
    for(let s = 0.08; s <= 0.92; s += 0.04){
      const x = p0[0] + (p1[0] - p0[0]) * s, y = p0[1] + (p1[1] - p0[1]) * s;
      if(x > bx[0] && x < bx[2] && y > bx[1] && y < bx[3]) return true;
    }
    return false;
  };
  outs.forEach(it => {
    const others = items.filter(o => o !== it).map(o => o.box || o.inBox);   // the other labels do not move meanwhile
    if(!others.some(b => crossesBox(it.p0, it.a, b))) return;
    let best = null;
    for(let r = 24; r <= 180; r += 8){
      for(let q = 0; q < 36; q++){
        const th = q / 36 * 2 * Math.PI, px = it.x, py = it.y;
        it.x = it.a[0] + Math.cos(th) * (r * u + it.w / 2); it.y = it.a[1] + Math.sin(th) * (r * u + it.h / 2);
        clampToFrame(it, edge);
        if(!blocked(it)){
          setBox(it, pad);
          const p0 = startOf(it);
          if(!others.some(b => crossesBox(p0, it.a, b))){
            const d = Math.hypot(p0[0] - it.a[0], p0[1] - it.a[1]);
            if(!best || d < best.d) best = {x: it.x, y: it.y, d};
          }
        }
        it.x = px; it.y = py; setBox(it, pad);
      }
    }
    if(best){ it.x = best.x; it.y = best.y; setBox(it, pad); it.p0 = startOf(it); it.arc = [Math.PI / 6, 1]; }
  });
  chooseBends();

  // 3. two arrows that still cross try swapping their labels' places, any distance apart
  const arcOf = it => arcPoints(it.p0, it.a, it.arc[0], it.arc[1]);
  const crossingPairs = () => {
    const pairs = [];
    for(let i = 0; i < outs.length; i++) for(let j = i + 1; j < outs.length; j++) if(segsCross(arcOf(outs[i]), arcOf(outs[j]))) pairs.push([outs[i], outs[j]]);
    return pairs;
  };
  for(let round = 0; round < 6; round++){
    const pairs = crossingPairs();
    if(!pairs.length) break;
    let fixed = false;
    for(const [p, q] of pairs){
      const before = crossingPairs().length;
      const restore = swap(p, q);
      chooseBends();
      if(!outs.some(blocked) && crossingPairs().length < before){ fixed = true; break; }
      restore();
    }
    if(!fixed) break;
  }
}
