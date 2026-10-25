// El Niño × food security: the watercolour washes, painted on a canvas under the SVG.
// Tyler Hobbs' layered-deformation method, as used by mattqg/Watercolor and 32bitkid/watercolorizer: each outline is
// recursively split with randomly displaced midpoints, and many faint deformed layers are stacked, so colour builds up
// in the interior and feathers unevenly at the edges.

import {WORLD, DATA} from './data.js';
import {WATERCOLOUR} from './settings.js';
import {clearCssCache, cssVar, fillOf, isLowestClass, isHighestRisk, ZOOM_REGIONS, REGION_MEMBER_SET, selectedRegion, inSelectedRegion} from './classes.js';
import {largestRing, segDist2} from './geometry.js';
import {mapbox, MAP_WIDTH, MAP_HEIGHT, svg, countryShapes, toSvgPath, shapeBounds, countryIdOf, ringsOf, zoomLayer, unitsPerPx, setZooming, frameOf} from './map.js';
import {drawLabels} from './labels.js';

const washCanvas = document.createElement('canvas'); washCanvas.className = 'wc'; washCanvas.setAttribute('aria-hidden', 'true');
mapbox.insertBefore(washCanvas, svg.node());
const washContext = washCanvas.getContext('2d');

// ---- the brush ---------------------------------------------------------------------------------------------
// seeded random numbers (Park-Miller), so the same country gets the same brushwork every time
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
function simplifyRing(pts, tol){
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

// ---- building the washes ---------------------------------------------------------------------------------
// every country's wash, brushed for zoom z: per country a base path and WATERCOLOUR.layers deformed layers, each with a blotch mask.
// With a transform t, countries off screen are skipped.
function buildWash(z, t){
  // map units per screen pixel at this zoom, with the brushwork scaled down on small maps so edges stay fine
  const brush = Math.max(0.5, Math.min(1, mapbox.clientWidth / 900));
  const u = unitsPerPx() / z * brush;
  const out = [];
  countryShapes.features.forEach((f, n) => {
    const b = shapeBounds[n];
    const offScreen = t && (t.applyX(b[1][0]) < -60 || t.applyX(b[0][0]) > MAP_WIDTH + 60 || t.applyY(b[1][1]) < -60 || t.applyY(b[0][1]) > MAP_HEIGHT + 60);
    if(offScreen && (b[1][0] - b[0][0]) < MAP_WIDTH / 2) return;
    brushSeed = WATERCOLOUR.seed + n * 7919;   // same country, same brushwork, every time
    let rings = ringsOf(f).map(r => simplifyRing(r, WATERCOLOUR.simplify * u)).filter(r => r.length >= 3);
    // let the pigment flow out past the border by WATERCOLOUR.spill of the shape's size: outer rings grow, holes shrink.
    // d3.polygonArea is signed, so an outer ring and its holes wind opposite ways
    const area = d3.polygonArea;
    const outerSign = Math.sign(area(largestRing(rings) || []));
    rings = rings.map(r => {
      const cx = d3.mean(r, p => p[0]), cy = d3.mean(r, p => p[1]);
      const g = Math.sign(area(r)) === outerSign ? 1 + WATERCOLOUR.spill : 1 / (1 + WATERCOLOUR.spill);
      return r.map(p => [cx + (p[0] - cx) * g, cy + (p[1] - cy) * g]);
    });
    if(!rings.length) return;
    const base = rings.map(r => deformRing(r, WATERCOLOUR.pre, WATERCOLOUR.amp, WATERCOLOUR.maxPre * u));
    const layers = [];
    for(let l = 0; l < WATERCOLOUR.layers; l++){
      const p = new Path2D();
      base.forEach(r => smoothRing(p, deformRing(r, WATERCOLOUR.per, WATERCOLOUR.amp, WATERCOLOUR.maxLayer * u)));
      layers.push([p, blotchMask(b, u)]);
    }
    const basePath = new Path2D();
    base.forEach(r => smoothRing(basePath, r));
    out.push({id: countryIdOf(f), layers, basePath});   // Somaliland paints as part of Somalia
  });
  return out;
}

// Hobbs' texture mask: each layer only paints inside a random scatter of blotches over the country's box b,
// so overlaps vary across the wash. Big countries get fewer, larger blotches with the same coverage.
function blotchMask(b, u){
  const m = new Path2D(), bw = b[1][0] - b[0][0] + 8 * u, bh = b[1][1] - b[0][1] + 8 * u;
  const r2 = ((WATERCOLOUR.rMin + WATERCOLOUR.rMax) / 2 * u) ** 2 * 1.08;
  const nWant = Math.max(2, Math.ceil(-Math.log(1 - WATERCOLOUR.maskShare) * bw * bh / (Math.PI * r2)));
  const nUse = Math.min(nWant, WATERCOLOUR.maxBlotches), grow = Math.sqrt(nWant / nUse);
  for(let q = 0; q < nUse; q++){
    const cx = b[0][0] - 4 * u + brushRandom() * bw, cy = b[0][1] - 4 * u + brushRandom() * bh;
    const rr = (WATERCOLOUR.rMin + brushRandom() * (WATERCOLOUR.rMax - WATERCOLOUR.rMin)) * u * grow;
    m.moveTo(cx + rr, cy); m.arc(cx, cy, rr, 0, Math.PI * 2);
  }
  return m;
}

// ---- the raised countries --------------------------------------------------------------------------------
// the named highest-risk countries are raised off the paper with a shadow, in every view; crisis borders lie flat, so the colours lead
const isRaised = id => !!id && isHighestRisk(DATA.countries[id]);

// one merged shape per region for the raised countries, with no seams between neighbours (null if there are none)
export const pieceCache = {};
function raisedPiece(key){
  if(key in pieceCache) return pieceCache[key];
  const ids = key === 'world' ? null : (REGION_MEMBER_SET[key] || new Set());   // world view: every raised country
  const geoms = WORLD.objects.countries.geometries.filter(g => (!ids || ids.has(countryIdOf(g))) && isRaised(countryIdOf(g)));
  return (pieceCache[key] = geoms.length ? new Path2D(toSvgPath(topojson.merge(WORLD, geoms))) : null);
}

// the raised countries cast their shadow over the flat countries and into holes, then get clean paper
function castRaisedShadow(key, dark, bg){
  const piece = raisedPiece(key);
  if(!piece) return;
  const dpr = washCanvas.width / Math.max(1, washCanvas.getBoundingClientRect().width);
  // [blur, dx, dy, colour]: an ambient shadow all round (so the top edges lift too), a key shadow below, and a dark contact line
  const SHADOWS = [
    [7,   0, 0,   dark ? 'rgba(0,0,0,0.75)' : 'rgba(40,30,50,0.45)'],
    [2,   0, 0,   dark ? 'rgba(0,0,0,0.85)' : 'rgba(40,30,50,0.55)'],
    [4,   0, 6,   dark ? 'rgba(0,0,0,0.8)'  : 'rgba(40,30,50,0.50)'],
    [1.2, 0, 1.5, dark ? 'rgba(0,0,0,0.95)' : 'rgba(40,30,50,0.80)'],
  ];
  SHADOWS.forEach(([blur, dx, dy, colour]) => {
    washContext.save();
    washContext.fillStyle = bg; washContext.shadowColor = colour; washContext.shadowBlur = blur * dpr; washContext.shadowOffsetX = dx * dpr; washContext.shadowOffsetY = dy * dpr; washContext.globalAlpha = 1;
    washContext.fill(piece, 'nonzero');   // holes keep their rims, so enclosed countries get a shadow too
    washContext.restore();
  });
  washContext.fillStyle = bg; washContext.fill(piece, 'nonzero');   // clean paper under the raised countries only; shadows in holes stay
}

// a region's plain paper sheet: the outline of all its countries
const sheetCache = {};
function regionSheet(key){
  if(sheetCache[key]) return sheetCache[key];
  const ids = REGION_MEMBER_SET[key] || new Set(), p = new Path2D();
  countryShapes.features.filter(f => ids.has(countryIdOf(f))).forEach(f => ringsOf(f).forEach(r => {
    p.moveTo(r[0][0], r[0][1]);
    r.slice(1).forEach(q => p.lineTo(q[0], q[1]));
    p.closePath();
  }));
  return (sheetCache[key] = p);
}

// ---- painting --------------------------------------------------------------------------------------------
const isDarkTheme = () => { const c = d3.rgb(getComputedStyle(document.body).backgroundColor); return c.r + c.g + c.b < 300; };

// paint the washes (built by buildWash) at zoom transform t
export function drawWash(t, washes){
  if(!washes) return;
  const s = washCanvas.width / MAP_WIDTH;
  washContext.setTransform(1, 0, 0, 1, 0, 0); washContext.clearRect(0, 0, washCanvas.width, washCanvas.height);
  washContext.setTransform(s * t.k, 0, 0, s * t.k, s * t.x, s * t.y);
  clearCssCache();   // theme colours: read once per frame
  const nodata = cssVar('--nodata'), nodataDeep = cssVar('--nodatadeep'), bg = cssVar('--bg'), dark = isDarkTheme();

  const paintOne = c => {
    const r = DATA.countries[c.id], fill = fillOf(c.id), isNoData = !fill;
    const cover = isNoData ? WATERCOLOUR.nodata : (r && isLowestClass(r) ? WATERCOLOUR.low : WATERCOLOUR.cover);
    if(cover <= 0) return;   // unpainted: the paper shows through
    // a first even wash, then masked layers that on average bring the interior up to the class colour.
    // On the dark theme the gaps in the mottling show dark ground, so the base wash carries more of the colour;
    // the pale no-data grey gets a thin first coat and more of the mottled layers, so its brushwork still shows
    const base = isNoData ? 0.3 : Math.min(dark ? WATERCOLOUR.baseDark : WATERCOLOUR.base, cover);
    const rest = 1 - (1 - cover) / (1 - base);
    const layerAlpha = Math.min(1, (1 - Math.pow(1 - rest, 1 / c.layers.length)) / WATERCOLOUR.maskShare);
    const dim = inSelectedRegion(c.id) ? 1 : 0.14;
    washContext.fillStyle = fill || nodata;
    washContext.globalAlpha = base * dim; washContext.fill(c.basePath, 'evenodd');
    washContext.globalAlpha = layerAlpha * dim;
    if(isNoData) washContext.fillStyle = nodataDeep;   // two tones: a pale first coat, mottling in a slightly deeper grey
    c.layers.forEach(([p, mask]) => { washContext.save(); washContext.clip(mask); washContext.fill(p, 'evenodd'); washContext.restore(); });
  };

  // 1. the surface: every country that is not raised. Crisis countries are marked by their dark border only
  if(selectedRegion === 'world'){
    washes.filter(c => !isRaised(c.id)).forEach(paintOne);
    castRaisedShadow('world', dark, bg);
  } else {
    // zoomed in: the dimmed countries outside the region first, then the region on a plain paper sheet
    // (so the dimmed neighbours' paint does not bleed into it), then its flat countries on the sheet
    washes.filter(c => !inSelectedRegion(c.id)).forEach(paintOne);
    washContext.fillStyle = bg; washContext.globalAlpha = 1; washContext.fill(regionSheet(selectedRegion), 'nonzero');
    washes.filter(c => inSelectedRegion(c.id) && !isRaised(c.id)).forEach(paintOne);
    castRaisedShadow(selectedRegion, dark, bg);
  }
  // 2. the raised countries' washes on top (their shadow was cast from the group's outer edge)
  washes.filter(c => inSelectedRegion(c.id) && isRaised(c.id)).forEach(paintOne);
  washContext.globalAlpha = 1;
}

// ---- size and zoom ---------------------------------------------------------------------------------------
export function sizeWash(){
  const r = svg.node().getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  washCanvas.style.width = r.width + 'px'; washCanvas.style.height = r.height + 'px';
  washCanvas.width = Math.max(1, Math.round(r.width * dpr)); washCanvas.height = Math.max(1, Math.round(r.height * dpr));
}

// the washes are brushed once per map width, at the deepest regional zoom; zooming only scales them.
// Only the current width is kept.
export let washCache = {}, washTransform = d3.zoomIdentity, washesShown = null;   // washTransform: the transform on screen; washesShown: the washes on screen
function washesForWidth(){
  const id = 'all@' + Math.round(mapbox.clientWidth);
  if(!washCache[id]){
    const deepestZoom = Math.max(...ZOOM_REGIONS.map(zone => frameOf(zone).k));
    washCache = {[id]: buildWash(deepestZoom, null)};
  }
  return washCache[id];
}
// show the washes for the current width (after a resize or a change of measure)
export function refitWashes(){ washesShown = washesForWidth(); }

// zoom the map and its wash to transform t over dur ms (zoomTo has cleared the labels and set isZooming); the labels are drawn when it ends
export function zoomWashTo(t, dur){
  const target = washesForWidth();
  const iz = d3.interpolate([washTransform.x, washTransform.y, washTransform.k], [t.x, t.y, t.k]);
  d3.select(washCanvas).interrupt().transition().duration(dur).ease(d3.easeCubicInOut)
    .tween('wash', () => q => {
      const [x, y, kk] = iz(q), T = d3.zoomIdentity.translate(x, y).scale(kk);
      zoomLayer.attr('transform', T.toString());
      drawWash(T, target);
    })
    .on('end interrupt', () => {
      washTransform = t; washesShown = target;
      zoomLayer.attr('transform', t.toString());
      drawWash(t, target);
      setZooming(false);
      drawLabels(t);
    });
}

sizeWash();
