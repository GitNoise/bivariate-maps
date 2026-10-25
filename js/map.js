// El Niño × food security: the map's SVG layers and how each view is framed. Redrawing them: js/redraw.js.

import {WORLD, DATA, NATIONAL_CRISES, SMALLER_CRISES} from './data.js';
import {WORLD_FRAME, SMALL_COUNTRIES} from './settings.js';
import {shortfallClass, measureClass, cellColour, REGION_MEMBER_SET, selectedRegion, inSelectedRegion} from './classes.js';

// ---- the SVG and its layers ---------------------------------------------------------------------------
export const mapbox = document.getElementById('mapbox'), tooltipBox = document.getElementById('tip'), legendContainer = document.getElementById('mapkey');
export const IS_PHONE_LAYOUT = window.matchMedia('(max-width: 640px)').matches;   // the map frame is set at load (see the resize handler)
export const MAP_WIDTH = IS_PHONE_LAYOUT ? 700 : 1180, MAP_HEIGHT = IS_PHONE_LAYOUT ? 560 : 600;              // viewBox size
export const svg = d3.select(mapbox).append('svg').attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`).attr('role','img')
  .attr('aria-label','World map of El Niño harvest risk and cereal import dependency by country');

export const countryShapes = topojson.feature(WORLD, WORLD.objects.countries);
countryShapes.features = countryShapes.features.filter(f => f.id !== '010');   // drop Antarctica
export const projection = d3.geoNaturalEarth1().fitExtent([[0, IS_PHONE_LAYOUT ? 100 : 0], [MAP_WIDTH, IS_PHONE_LAYOUT ? MAP_HEIGHT - 100 : MAP_HEIGHT]], WORLD_FRAME);
export const toSvgPath = d3.geoPath(projection);
export const shapeBounds = countryShapes.features.map(f => toSvgPath.bounds(f));   // by feature index, in map units

// Natural Earth draws Somaliland as its own shape without a country code; FAO's reports count it as part of Somalia
export const countryIdOf = f => f.id || (f.properties && f.properties.name === 'Somaliland' ? '706' : undefined);

// each feature's rings in map units; the projection never changes, so each is traced once
const ringCache = new Map();
export function ringsOf(feature){
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
export const zoomLayer = svg.append('g');
export const countryPaths = zoomLayer.append('g').selectAll('path').data(countryShapes.features).join('path').attr('d', toSvgPath).attr('class', 'country');

// small countries get a dot in the world view, so they stay visible (Lesotho, Eswatini, El Salvador...)
const smallCountryShapes = countryShapes.features.filter(f => DATA.countries[f.id] && SMALL_COUNTRIES.has(f.id) && toSvgPath.area(f) < 60);
export const smallCountryDots = zoomLayer.append('g').selectAll('circle').data(smallCountryShapes).join('circle')
  .attr('cx', f => toSvgPath.centroid(f)[0]).attr('cy', f => toSvgPath.centroid(f)[1]).attr('r', 3.2).attr('class', 'country smallmark');

// hatching for a weak harvest signal: pencil-grey lines, or light lines over dark fills (brown, mauve, purple) where grey disappears
export const defs = svg.append('defs');
const hatchPattern = (id, lineWidth, lineClass) => {
  const p = defs.append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse').attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
  p.append('rect').attr('width', lineWidth).attr('height', 5).attr('class', lineClass);
  return p;
};
export const greyHatch = hatchPattern('hatch', 0.9, 'hatchline');
export const lightHatch = hatchPattern('hatchL', 1.1, 'hatchline-l');
// relative luminance of a colour (WCAG)
function luminance(colour){
  const c = d3.rgb(colour);
  const linear = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}
export function hatchOf(id){
  const r = DATA.countries[id];
  if(!r || r.harvestShortfall == null || measureClass(r) == null) return 'url(#hatch)';
  return luminance(cellColour(shortfallClass(r), measureClass(r))) < 0.2 ? 'url(#hatchL)' : 'url(#hatch)';
}
export const hatchPaths = zoomLayer.append('g').style('pointer-events', 'none')
  .selectAll('path').data(countryShapes.features).join('path').attr('d', toSvgPath).attr('fill', 'url(#hatch)');

// pencil borders around every country
const borderLayer = zoomLayer.append('g').style('pointer-events', 'none');
export const borderPaths = borderLayer.selectAll('path').data(countryShapes.features).join('path').attr('d', toSvgPath).attr('class', d => 'ink' + (NATIONAL_CRISES[d.id] ? ' fi' : ''));

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
export function drawCrisisBorders(){
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
export const unitsPerPx = () => MAP_WIDTH / Math.max(300, mapbox.clientWidth);   // viewBox units per screen pixel
export const legendOnMap = () => getComputedStyle(legendContainer).position === 'absolute';

// the legend's box in viewBox units, padded, or null when it is not on the map: labels and notes keep clear of it
export function legendBox(u, pad){
  if(!legendOnMap()) return null;
  const kr = legendContainer.getBoundingClientRect();
  if(!(kr.width > 0)) return null;
  const mr = svg.node().getBoundingClientRect();
  return [(kr.left - mr.left) * u - pad, (kr.top - mr.top) * u - pad, (kr.right - mr.left) * u + pad, (kr.bottom - mr.top) * u + pad];
}

// ---- framing each view --------------------------------------------------------------------------------
export let isZooming = false;   // true while the map zooms; labels wait for it to settle
export function setZooming(on){ isZooming = on; }

// features that cross the 180° line (Russia, Fiji) would stretch a frame across the whole map
const crossesDateLine = i => shapeBounds[i][1][0] - shapeBounds[i][0][0] >= MAP_WIDTH / 2;

// the zoom transform that frames a region, or the whole world
export function frameOf(key){
  if(key === 'world'){
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
