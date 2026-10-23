// El Niño × food security: the map's SVG layers, how each view is framed, and paint(), which redraws everything for the current state.

// ---- the SVG and its layers ---------------------------------------------------------------------------
const mapbox = document.getElementById('mapbox'), tip = document.getElementById('tip'), mapkey = document.getElementById('mapkey');
const PHONE = window.matchMedia('(max-width: 640px)').matches;   // the map frame is set at load (see the resize handler)
const W = PHONE ? 700 : 1180, H = PHONE ? 560 : 600;              // viewBox size
const svg = d3.select(mapbox).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role','img')
  .attr('aria-label','World map of El Niño harvest risk and cereal import dependency by country');

const countries = topojson.feature(WORLD, WORLD.objects.countries);
countries.features = countries.features.filter(f => f.id !== '010');   // drop Antarctica
const proj = d3.geoNaturalEarth1().fitExtent([[0, PHONE ? 100 : 0], [W, PHONE ? H - 100 : H]], FOCUS);
const path = d3.geoPath(proj);
const featBounds = countries.features.map(f => path.bounds(f));   // by feature index, in map units

// Natural Earth draws Somaliland as its own shape without a country code; FAO's reports count it as part of Somalia
const fiOf = f => f.id || (f.properties && f.properties.name === 'Somaliland' ? '706' : undefined);

// each feature's rings in map units; the projection never changes, so each is traced once
const ringCache = new Map();
function ringsOf(feature){
  if(!ringCache.has(feature)){
    const rings = []; let current = null;
    d3.geoPath(proj).context({
      moveTo(x, y){ current = [[x, y]]; rings.push(current); },
      lineTo(x, y){ current.push([x, y]); },
      closePath(){}, arc(){},
    })(feature);
    ringCache.set(feature, rings);
  }
  return ringCache.get(feature);
}

// everything that zooms sits in zoomG, bottom to top: country shapes (for hover), small-country dots, hatching, pencil borders
const zoomG = svg.append('g');
const paths = zoomG.append('g').selectAll('path').data(countries.features).join('path').attr('d', path).attr('class', 'country');

// small countries get a dot in the world view, so they stay visible (Lesotho, Eswatini, El Salvador...)
const small = countries.features.filter(f => DATA.world[f.id] && SMALL_OK.has(f.id) && path.area(f) < 60);
const marks = zoomG.append('g').selectAll('circle').data(small).join('circle')
  .attr('cx', f => path.centroid(f)[0]).attr('cy', f => path.centroid(f)[1]).attr('r', 3.2).attr('class', 'country smallmark');

// hatching for a weak harvest signal: pencil-grey lines, or light lines over dark fills (brown, mauve, purple) where grey disappears
const defs = svg.append('defs');
const hatchPattern = (id, lineWidth, lineClass) => {
  const p = defs.append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse').attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
  p.append('rect').attr('width', lineWidth).attr('height', 5).attr('class', lineClass);
  return p;
};
const hatchPat = hatchPattern('hatch', 0.9, 'hatchline');
const hatchPatL = hatchPattern('hatchL', 1.1, 'hatchline-l');
// relative luminance of a colour (WCAG)
function luminance(colour){
  const c = d3.rgb(colour);
  const linear = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}
function hatchFor(id){
  const r = DATA.world[id];
  if(!r || r.hgap == null || depClass(r) == null) return 'url(#hatch)';
  return luminance(biColor(hitClass(r), depClass(r))) < 0.2 ? 'url(#hatchL)' : 'url(#hatch)';
}
const hatchPaths = zoomG.append('g').style('pointer-events', 'none')
  .selectAll('path').data(countries.features).join('path').attr('d', path).attr('fill', 'url(#hatch)');

// pencil borders around every country
const inkG = zoomG.append('g').style('pointer-events', 'none');
const inkPaths = inkG.selectAll('path').data(countries.features).join('path').attr('d', path).attr('class', d => 'ink' + (FOOD_INSEC[d.id] ? ' fi' : ''));

// ---- crisis borders --------------------------------------------------------------------------------------
// one dark outline around each group of touching crisis countries. topojson.merge dissolves only shared borders, so a country
// enclosed by flagged ones stays out, as a hole with its own outline. Outside the selected region the border is dimmed.
// Dashed (smaller crises) first, so a border shared with a solid country is drawn solid.
const fiMinorDim = inkG.append('path').attr('class', 'fi-outline minor dim');
const fiMinor = inkG.append('path').attr('class', 'fi-outline minor');
const fiOutlineDim = inkG.append('path').attr('class', 'fi-outline dim');
const fiOutline = inkG.append('path').attr('class', 'fi-outline');
const geometriesIn = table => WORLD.objects.countries.geometries.filter(g => table[fiOf(g)]);
const FI_LAYERS = [   // [the countries, their outline in the region, their outline outside it]
  [geometriesIn(FOOD_INSEC), fiOutline, fiOutlineDim],
  [geometriesIn(FOOD_INSEC_MINOR), fiMinor, fiMinorDim],
];
const fiOutlineCache = {};   // the merged outlines depend only on the region
function drawFiOutlines(){
  const inView = g => inRegion(fiOf(g));
  if(!fiOutlineCache[region]){
    fiOutlineCache[region] = FI_LAYERS.map(([geoms]) => [
      topojson.merge(WORLD, geoms.filter(inView)),
      topojson.merge(WORLD, geoms.filter(g => !inView(g))),
    ]);
  }
  FI_LAYERS.forEach(([, inside, outside], i) => {
    inside.datum(fiOutlineCache[region][i][0]).attr('d', path);
    outside.datum(fiOutlineCache[region][i][1]).attr('d', path);
  });
}

// ---- the legend's place on the map -------------------------------------------------------------------
const unitsPerPx = () => W / Math.max(300, mapbox.clientWidth);   // viewBox units per screen pixel
const legendOnMap = () => getComputedStyle(mapkey).position === 'absolute';

// the legend's box in viewBox units, padded, or null when it is not on the map: labels and notes keep clear of it
function legendBox(u, pad){
  if(!legendOnMap()) return null;
  const kr = mapkey.getBoundingClientRect();
  if(!(kr.width > 0)) return null;
  const mr = svg.node().getBoundingClientRect();
  return [(kr.left - mr.left) * u - pad, (kr.top - mr.top) * u - pad, (kr.right - mr.left) * u + pad, (kr.bottom - mr.top) * u + pad];
}

// ---- framing each view --------------------------------------------------------------------------------
let zoomAnimating = false;   // true while the map zooms; labels wait for it to settle
let k = 1;                   // the current zoom factor

// features that cross the 180° line (Russia, Fiji) would stretch a frame across the whole map
const crossesDateLine = i => featBounds[i][1][0] - featBounds[i][0][0] >= W / 2;

// the zoom transform that frames a region, or the whole world
function frameFor(key){
  if(!REGIONS_Z[key]){
    // world view: frame on the land itself (the projection still leaves room for the removed Antarctica)
    const feats = countries.features.filter((f, i) => !crossesDateLine(i));
    const [[x0, y0], [x1, y1]] = path.bounds({type: 'FeatureCollection', features: feats});
    const pad = 16, kk = Math.min(W / (x1 - x0 + pad), H / (y1 - y0 + pad));
    return d3.zoomIdentity.translate(W / 2 - kk * (x0 + x1) / 2, H / 2 - kk * (y0 + y1) / 2).scale(kk);   // the legend may overlap South America
  }
  const ids = REGION_SET[key];
  // frame on the countries that carry data; grey no-data countries (Botswana, Cuba, Papua New Guinea) do not pull the frame
  const hasData = id => (DATA.world[id] && DATA.world[id].hgap != null) || FOOD_INSEC[id];
  const feats = countries.features.filter((f, i) => ids.has(f.id) && hasData(f.id) && !crossesDateLine(i));
  const [[x0, y0], [x1, y1]] = path.bounds({type: 'FeatureCollection', features: feats});
  const pad = 30;
  // fit the frame into the width left of a strip lw wide (the legend's), at most 9 times the world scale
  const fit = lw => {
    const aw = W - lw, kk = Math.min(9, 0.92 / Math.max((x1 - x0 + pad) / aw, (y1 - y0 + pad) / H));
    return d3.zoomIdentity.translate(lw + aw / 2 - kk * (x0 + x1) / 2, H / 2 - kk * (y0 + y1) / 2).scale(kk);
  };
  // centre on the full map first; make room for the legend only if a country of this region, with or without data, would sit under it
  const t = fit(0);
  if(!legendOnMap()) return t;
  const lw = mapkey.offsetWidth / Math.max(1, mapbox.clientWidth) * W;
  const lh = mapkey.offsetHeight / Math.max(1, mapbox.clientHeight) * H;
  const underLegend = countries.features.some((f, i) => {
    if(!ids.has(f.id) || crossesDateLine(i)) return false;
    const [[left], [, bottom]] = featBounds[i];
    return t.applyX(left) < lw && t.applyY(bottom) > H - lh;
  });
  return underLegend ? fit(lw) : t;
}

// ---- drawing --------------------------------------------------------------------------------------------
// redraw everything for the current region and measure (the watercolour wash is redrawn separately, by drawWash)
function paint(){
  cssCache = {};   // theme colours: read once per paint
  mapbox.classList.toggle('world-view', region === 'world');   // world view: dark borders a little lighter
  scoreLine();
  drawFiOutlines();
  // the shapes are transparent (the wash shows through); outside the selected region they are dimmed
  paths.style('fill', 'transparent')
    .attr('class', d => 'country' + (fillFor(d.id) && inRegion(d.id) ? ' hit' : '') + (inRegion(d.id) ? '' : ' dim'));
  // small-country dots are for the world view only; zoomed in, the country itself is visible (and has its label or arrow)
  marks.style('display', region === 'world' ? null : 'none')
    .classed('fi', d => !!FOOD_INSEC[d.id])
    .style('fill', d => fillFor(d.id) || cssVar('--land'))
    .style('fill-opacity', d => isLowestClass(DATA.world[d.id]) ? WC.low : 1)
    .attr('r', 3.2 / k)
    .style('stroke-dasharray', d => showsWeakShortfall(d.id) ? '1.5 1.5' : null)
    .classed('dim', d => !inRegion(d.id));
  // the hatch stays a fine, constant texture on screen at every zoom level
  [hatchPat, hatchPatL].forEach(p => p.attr('patternTransform', `rotate(45) scale(${(1 / Math.max(1, k)).toFixed(4)})`));
  hatchPaths.attr('fill', d => hatchFor(d.id))
    .style('display', d => showsWeakShortfall(d.id) ? null : 'none')
    .classed('dim', d => !inRegion(d.id));
  // pencil borders: a tad stronger inside the selected region, a tad lighter outside it (Somaliland counts as Somalia)
  inkPaths.classed('dim', d => !inRegion(fiOf(d))).classed('inreg', d => region !== 'world' && inRegion(fiOf(d)));
  drawLegend();
  // the figure has no visible title; its accessible name follows the selected region
  document.querySelector('.fig').setAttribute('aria-label', region === 'world'
    ? 'Map: El Niño harvest shortfall and cereal import dependence, by country'
    : `Map: El Niño harvest shortfall and cereal import dependence, ${REGION_NAME[region]}`);
  // labels: cleared here; drawn once the wash transition ends (washTo), or at once when no zoom is under way
  calloutG.selectAll('*').remove(); calloutG.style('opacity', 0);
  if(region !== 'world' && !zoomAnimating) drawCallouts(wcT);
}

// switch to a region (or 'world'): repaint, then zoom the map and its wash there
function zoomTo(key){
  region = key;
  const t = frameFor(key); k = t.k;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  zoomAnimating = true;   // the labels are drawn once the wash has settled (washTo), not on the old frame
  paint();
  washTo(t, reduceMotion ? 0 : 650);
}
