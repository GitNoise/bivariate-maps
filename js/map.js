// El Niño × food security: the map's SVG layers, how each view is framed, and redrawMap(), which redraws everything for the current state.

// ---- the SVG and its layers ---------------------------------------------------------------------------
const mapbox = document.getElementById('mapbox'), tooltipBox = document.getElementById('tip'), legendContainer = document.getElementById('mapkey');
const IS_PHONE_LAYOUT = window.matchMedia('(max-width: 640px)').matches;   // the map frame is set at load (see the resize handler)
const MAP_WIDTH = IS_PHONE_LAYOUT ? 700 : 1180, MAP_HEIGHT = IS_PHONE_LAYOUT ? 560 : 600;              // viewBox size
const svg = d3.select(mapbox).append('svg').attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`).attr('role','img')
  .attr('aria-label','World map of El Niño harvest risk and cereal import dependency by country');

const countryShapes = topojson.feature(WORLD, WORLD.objects.countries);
countryShapes.features = countryShapes.features.filter(f => f.id !== '010');   // drop Antarctica
const projection = d3.geoNaturalEarth1().fitExtent([[0, IS_PHONE_LAYOUT ? 100 : 0], [MAP_WIDTH, IS_PHONE_LAYOUT ? MAP_HEIGHT - 100 : MAP_HEIGHT]], WORLD_FRAME);
const toSvgPath = d3.geoPath(projection);
const shapeBounds = countryShapes.features.map(f => toSvgPath.bounds(f));   // by feature index, in map units

// Natural Earth draws Somaliland as its own shape without a country code; FAO's reports count it as part of Somalia
const countryIdOf = f => f.id || (f.properties && f.properties.name === 'Somaliland' ? '706' : undefined);

// each feature's rings in map units; the projection never changes, so each is traced once
const ringCache = new Map();
function ringsOf(feature){
  if(!ringCache.has(feature)){
    const rings = []; let current = null;
    d3.geoPath(projection).context({
      moveTo(x, y){ current = [[x, y]]; rings.push(current); },
      lineTo(x, y){ current.push([x, y]); },
      closePath(){}, arc(){},
    })(feature);
    ringCache.set(feature, rings);
  }
  return ringCache.get(feature);
}

// everything that zooms sits in zoomLayer, bottom to top: country shapes (for hover), small-country dots, hatching, pencil borders
const zoomLayer = svg.append('g');
const countryPaths = zoomLayer.append('g').selectAll('path').data(countryShapes.features).join('path').attr('d', toSvgPath).attr('class', 'country');

// small countries get a dot in the world view, so they stay visible (Lesotho, Eswatini, El Salvador...)
const smallCountryShapes = countryShapes.features.filter(f => DATA.countries[f.id] && SMALL_COUNTRIES.has(f.id) && toSvgPath.area(f) < 60);
const smallCountryDots = zoomLayer.append('g').selectAll('circle').data(smallCountryShapes).join('circle')
  .attr('cx', f => toSvgPath.centroid(f)[0]).attr('cy', f => toSvgPath.centroid(f)[1]).attr('r', 3.2).attr('class', 'country smallmark');

// hatching for a weak harvest signal: pencil-grey lines, or light lines over dark fills (brown, mauve, purple) where grey disappears
const defs = svg.append('defs');
const hatchPattern = (id, lineWidth, lineClass) => {
  const p = defs.append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse').attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
  p.append('rect').attr('width', lineWidth).attr('height', 5).attr('class', lineClass);
  return p;
};
const greyHatch = hatchPattern('hatch', 0.9, 'hatchline');
const lightHatch = hatchPattern('hatchL', 1.1, 'hatchline-l');
// relative luminance of a colour (WCAG)
function luminance(colour){
  const c = d3.rgb(colour);
  const linear = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}
function hatchOf(id){
  const r = DATA.countries[id];
  if(!r || r.harvestShortfall == null || measureClass(r) == null) return 'url(#hatch)';
  return luminance(cellColour(shortfallClass(r), measureClass(r))) < 0.2 ? 'url(#hatchL)' : 'url(#hatch)';
}
const hatchPaths = zoomLayer.append('g').style('pointer-events', 'none')
  .selectAll('path').data(countryShapes.features).join('path').attr('d', toSvgPath).attr('fill', 'url(#hatch)');

// pencil borders around every country
const borderLayer = zoomLayer.append('g').style('pointer-events', 'none');
const borderPaths = borderLayer.selectAll('path').data(countryShapes.features).join('path').attr('d', toSvgPath).attr('class', d => 'ink' + (NATIONAL_CRISES[d.id] ? ' fi' : ''));

// ---- crisis borders --------------------------------------------------------------------------------------
// one dark outline around each group of touching crisis countries. topojson.merge dissolves only shared borders, so a country
// enclosed by flagged ones stays out, as a hole with its own outline. Outside the selected region the border is dimmed.
// Dashed (smaller crises) first, so a border shared with a solid country is drawn solid.
const smallerCrisisBordersOutside = borderLayer.append('path').attr('class', 'fi-outline minor dim');
const smallerCrisisBorders = borderLayer.append('path').attr('class', 'fi-outline minor');
const crisisBordersOutside = borderLayer.append('path').attr('class', 'fi-outline dim');
const crisisBorders = borderLayer.append('path').attr('class', 'fi-outline');
const geometriesListedIn = table => WORLD.objects.countries.geometries.filter(g => table[countryIdOf(g)]);
const CRISIS_BORDER_LAYERS = [   // [the countries, their outline in the region, their outline outside it]
  [geometriesListedIn(NATIONAL_CRISES), crisisBorders, crisisBordersOutside],
  [geometriesListedIn(SMALLER_CRISES), smallerCrisisBorders, smallerCrisisBordersOutside],
];
const crisisBorderCache = {};   // the merged outlines depend only on the region
function drawCrisisBorders(){
  const inView = g => inSelectedRegion(countryIdOf(g));
  if(!crisisBorderCache[selectedRegion]){
    crisisBorderCache[selectedRegion] = CRISIS_BORDER_LAYERS.map(([geoms]) => [
      topojson.merge(WORLD, geoms.filter(inView)),
      topojson.merge(WORLD, geoms.filter(g => !inView(g))),
    ]);
  }
  CRISIS_BORDER_LAYERS.forEach(([, inside, outside], i) => {
    inside.datum(crisisBorderCache[selectedRegion][i][0]).attr('d', toSvgPath);
    outside.datum(crisisBorderCache[selectedRegion][i][1]).attr('d', toSvgPath);
  });
}

// ---- the legend's place on the map -------------------------------------------------------------------
const unitsPerPx = () => MAP_WIDTH / Math.max(300, mapbox.clientWidth);   // viewBox units per screen pixel
const legendOnMap = () => getComputedStyle(legendContainer).position === 'absolute';

// the legend's box in viewBox units, padded, or null when it is not on the map: labels and notes keep clear of it
function legendBox(u, pad){
  if(!legendOnMap()) return null;
  const kr = legendContainer.getBoundingClientRect();
  if(!(kr.width > 0)) return null;
  const mr = svg.node().getBoundingClientRect();
  return [(kr.left - mr.left) * u - pad, (kr.top - mr.top) * u - pad, (kr.right - mr.left) * u + pad, (kr.bottom - mr.top) * u + pad];
}

// ---- framing each view --------------------------------------------------------------------------------
let isZooming = false;   // true while the map zooms; labels wait for it to settle
let k = 1;                   // the current zoom factor

// features that cross the 180° line (Russia, Fiji) would stretch a frame across the whole map
const crossesDateLine = i => shapeBounds[i][1][0] - shapeBounds[i][0][0] >= MAP_WIDTH / 2;

// the zoom transform that frames a region, or the whole world
function frameOf(key){
  if(!REGION_MEMBERS[key]){
    // world view: frame on the land itself (the projection still leaves room for the removed Antarctica)
    const feats = countryShapes.features.filter((f, i) => !crossesDateLine(i));
    const [[x0, y0], [x1, y1]] = toSvgPath.bounds({type: 'FeatureCollection', features: feats});
    const pad = 16, kk = Math.min(MAP_WIDTH / (x1 - x0 + pad), MAP_HEIGHT / (y1 - y0 + pad));
    return d3.zoomIdentity.translate(MAP_WIDTH / 2 - kk * (x0 + x1) / 2, MAP_HEIGHT / 2 - kk * (y0 + y1) / 2).scale(kk);   // the legend may overlap South America
  }
  const ids = REGION_MEMBER_SET[key];
  // frame on the countries that carry data; grey no-data countries (Botswana, Cuba, Papua New Guinea) do not pull the frame
  const hasData = id => (DATA.countries[id] && DATA.countries[id].harvestShortfall != null) || NATIONAL_CRISES[id];
  const feats = countryShapes.features.filter((f, i) => ids.has(f.id) && hasData(f.id) && !crossesDateLine(i));
  const [[x0, y0], [x1, y1]] = toSvgPath.bounds({type: 'FeatureCollection', features: feats});
  const pad = 30;
  // fit the frame into the width left of a strip lw wide (the legend's), at most 9 times the world scale
  const fit = lw => {
    const aw = MAP_WIDTH - lw, kk = Math.min(9, 0.92 / Math.max((x1 - x0 + pad) / aw, (y1 - y0 + pad) / MAP_HEIGHT));
    return d3.zoomIdentity.translate(lw + aw / 2 - kk * (x0 + x1) / 2, MAP_HEIGHT / 2 - kk * (y0 + y1) / 2).scale(kk);
  };
  // centre on the full map first; make room for the legend only if a country of this region, with or without data, would sit under it
  const t = fit(0);
  if(!legendOnMap()) return t;
  const lw = legendContainer.offsetWidth / Math.max(1, mapbox.clientWidth) * MAP_WIDTH;
  const lh = legendContainer.offsetHeight / Math.max(1, mapbox.clientHeight) * MAP_HEIGHT;
  const underLegend = countryShapes.features.some((f, i) => {
    if(!ids.has(f.id) || crossesDateLine(i)) return false;
    const [[left], [, bottom]] = shapeBounds[i];
    return t.applyX(left) < lw && t.applyY(bottom) > MAP_HEIGHT - lh;
  });
  return underLegend ? fit(lw) : t;
}

// ---- drawing --------------------------------------------------------------------------------------------
// redraw everything for the current region and measure (the watercolour wash is redrawn separately, by drawWash)
function redrawMap(){
  cssCache = {};   // theme colours: read once per paint
  mapbox.classList.toggle('world-view', selectedRegion === 'world');   // world view: dark borders a little lighter
  drawScoreLine();
  drawCrisisBorders();
  // the shapes are transparent (the wash shows through); outside the selected region they are dimmed
  countryPaths.style('fill', 'transparent')
    .attr('class', d => 'country' + (fillOf(d.id) && inSelectedRegion(d.id) ? ' hit' : '') + (inSelectedRegion(d.id) ? '' : ' dim'));
  // small-country dots are for the world view only; zoomed in, the country itself is visible (and has its label or arrow)
  smallCountryDots.style('display', selectedRegion === 'world' ? null : 'none')
    .classed('fi', d => !!NATIONAL_CRISES[d.id])
    .style('fill', d => fillOf(d.id) || cssVar('--land'))
    .style('fill-opacity', d => isLowestClass(DATA.countries[d.id]) ? WATERCOLOUR.low : 1)
    .attr('r', 3.2 / k)
    .style('stroke-dasharray', d => showsWeakShortfall(d.id) ? '1.5 1.5' : null)
    .classed('dim', d => !inSelectedRegion(d.id));
  // the hatch stays a fine, constant texture on screen at every zoom level
  [greyHatch, lightHatch].forEach(p => p.attr('patternTransform', `rotate(45) scale(${(1 / Math.max(1, k)).toFixed(4)})`));
  hatchPaths.attr('fill', d => hatchOf(d.id))
    .style('display', d => showsWeakShortfall(d.id) ? null : 'none')
    .classed('dim', d => !inSelectedRegion(d.id));
  // pencil borders: a tad stronger inside the selected region, a tad lighter outside it (Somaliland counts as Somalia)
  borderPaths.classed('dim', d => !inSelectedRegion(countryIdOf(d))).classed('inreg', d => selectedRegion !== 'world' && inSelectedRegion(countryIdOf(d)));
  drawLegend();
  // the figure has no visible title; its accessible name follows the selected region
  document.querySelector('.fig').setAttribute('aria-label', selectedRegion === 'world'
    ? 'Map: El Niño harvest shortfall and cereal import dependence, by country'
    : `Map: El Niño harvest shortfall and cereal import dependence, ${REGION_TITLE[selectedRegion]}`);
  refreshTooltip();
  // labels: cleared here; drawn once the wash transition ends (zoomWashTo), or at once when no zoom is under way
  labelLayer.selectAll('*').remove(); labelLayer.style('opacity', 0);
  if(selectedRegion !== 'world' && !isZooming) drawLabels(washTransform);
}

// switch to a region (or 'world'): repaint, then zoom the map and its wash there
function zoomTo(key){
  selectedRegion = key;
  const t = frameOf(key); k = t.k;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  isZooming = true;   // the labels are drawn once the wash has settled (zoomWashTo), not on the old frame
  redrawMap();
  zoomWashTo(t, reduceMotion ? 0 : 650);
}
