// El Niño × food security: what each country's colour means, which countries are named, and which belong to each zoom region.
// Lookups on js/data.js, js/settings.js and js/measures.js only; nothing here draws.

import {DATA, UN_SUBREGION, UN_SUBREGION_NAME, NATIONAL_CRISES} from './data.js';
import {SHORTFALL_THRESHOLDS, WEAK_SIGNAL_P, ZOOM_REGION_OF_SUBREGION, ZOOM_REGION_EXCEPTIONS, ZOOM_REGION_NAME, ZOOM_REGION_ORDER, SHORT_NAMES, SHORT_NAME_RULES} from './settings.js';
import {MEASURE_DATA} from './measures.js';

// ---- theme colours ----------------------------------------------------------------------------------
// CSS custom properties, cached; redrawMap() and drawWash() clear the cache, so a theme change shows on the next frame
let cssCache = {};
export function clearCssCache(){ cssCache = {}; }
export function cssVar(name){
  if(!cssCache[name]) cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return cssCache[name];
}

// ---- the two axes of the bivariate map ------------------------------------------------------------
// the measure on the second axis: cereal imports by default; the explorer can switch it (its classes are in js/measures.js)
export let selectedMeasure = 'imports';
export function setSelectedMeasure(measure){ selectedMeasure = measure; }
const ID_OF_RECORD = new Map(Object.entries(DATA.countries).map(([id, r]) => [r, id]));   // country record -> M49 code

// first axis, 0 to 2: how much smaller El Niño harvests are, cut at SHORTFALL_THRESHOLDS. null: harvests not tested
export function shortfallClass(r){
  if(r.harvestShortfall == null) return null;
  const shortfall = r.harvestShortfall;
  if(shortfall >= SHORTFALL_THRESHOLDS[1]) return 2;
  if(shortfall >= SHORTFALL_THRESHOLDS[0]) return 1;
  return 0;
}

// second axis, 0 to 2: the class of the selected measure, from js/measures.js. null: no data
export function measureClass(r){
  const c = MEASURE_DATA[selectedMeasure].classes[ID_OF_RECORD.get(r)];
  return c == null ? null : c;
}

// i = shortfall class, j = second-measure class. The palette's ramps are swapped,
// so shortfall runs to purple (left edge of the diamond) and the second measure to gold (right edge)
export const cellColour = (i, j) => cssVar(`--bi${j}${i}`);

// a country's colour, or null when either axis has no data (the country is painted grey)
export function fillOf(id){
  const r = DATA.countries[id];
  if(!r) return null;
  const i = shortfallClass(r);
  if(i == null) return null;
  const j = measureClass(r);
  return j == null ? null : cellColour(i, j);
}

// the lowest class on both axes is laid on at WATERCOLOUR.low (0: the white paper shows through),
// so most of the world stays close to bare paper, as in ink-and-wash drawings
export function isLowestClass(r){
  return shortfallClass(r) === 0 && measureClass(r) === 0;
}

// ---- hatching: a weak harvest signal ---------------------------------------------------------------
export const isWeakSignal = r => r.shortfallPValue >= WEAK_SIGNAL_P;   // the shortfall may be chance (Mann-Whitney p)

// hatched only where the colour claims a harvest shortfall. The hatch lies over the true class colour:
// fading the colour instead would turn it into a different class
export function showsWeakShortfall(id){
  const r = DATA.countries[id];
  return r && shortfallClass(r) >= 1 && isWeakSignal(r);
}

// ---- named countries ---------------------------------------------------------------------------------
// the diamond cells whose countries are named on the map: the highest-risk cell and the two that share an edge with it
// (i = shortfall class, j = second-measure class)
export const NAMED_CELLS = [[2,1],[1,2],[2,2]];

// "purple": any mixed colour, a harvest shortfall together with the middle or top class of the second measure
const hasBothRisks = r => !!r && shortfallClass(r) >= 1 && measureClass(r) >= 1;

// named on the map, and raised off the paper with a shadow: the countries in the NAMED_CELLS
export const isHighestRisk = r => !!r && NAMED_CELLS.some(([i, j]) => shortfallClass(r) === i && measureClass(r) === j);

// country names as shown on the map: SHORT_NAMES first, then the SHORT_NAME_RULES in order
export const shortName = r => SHORT_NAMES[r.name] || SHORT_NAME_RULES.reduce((name, [from, to]) => name.replace(from, to), r.name);

// ---- zoom regions ---------------------------------------------------------------------------------
// a country's zoom region: its UN M49 subregion, grouped by ZOOM_REGION_OF_SUBREGION, with ZOOM_REGION_EXCEPTIONS (Sudan)
export function zoomRegionOf(id){
  if(ZOOM_REGION_EXCEPTIONS[id]) return ZOOM_REGION_EXCEPTIONS[id];
  const subregion = UN_SUBREGION[id];
  return subregion ? (ZOOM_REGION_OF_SUBREGION[subregion] || subregion) : null;
}

// every region with a labelled country or a recorded El Niño food crisis gets a button
const zoomRegionStats = {};
function countInZoomRegion(id, key){
  const zone = zoomRegionOf(id);
  if(!zone) return;
  if(!zoomRegionStats[zone]) zoomRegionStats[zone] = {crises: 0, labelled: 0};
  zoomRegionStats[zone][key]++;
}
Object.entries(DATA.countries).forEach(([id, r]) => { if(isHighestRisk(r)) countInZoomRegion(id, 'labelled'); });
Object.keys(NATIONAL_CRISES).forEach(id => countInZoomRegion(id, 'crises'));

// known regions in ZOOM_REGION_ORDER; any other region the data brings in follows, most crises first, then most labelled countries
export const ZOOM_REGIONS = Object.keys(zoomRegionStats).sort((a, b) => {
  const ia = ZOOM_REGION_ORDER.indexOf(a), ib = ZOOM_REGION_ORDER.indexOf(b);
  if(ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return zoomRegionStats[b].crises - zoomRegionStats[a].crises || zoomRegionStats[b].labelled - zoomRegionStats[a].labelled;
});

// each zoom region's member countries, as a list and as a set, and its full name ('world' is not a zoom region)
export const REGION_MEMBERS = {}, REGION_MEMBER_SET = {}, REGION_TITLE = {};
ZOOM_REGIONS.forEach(zone => {
  REGION_MEMBERS[zone] = Object.keys(UN_SUBREGION).filter(id => zoomRegionOf(id) === zone);
  REGION_MEMBER_SET[zone] = new Set(REGION_MEMBERS[zone]);
  REGION_TITLE[zone] = ZOOM_REGION_NAME[zone] || UN_SUBREGION_NAME[zone];
});

export let selectedRegion = 'world';   // the region on screen
export function setSelectedRegion(key){ selectedRegion = key; }

// is the country in the selected region? (the world view includes every country)
export const inSelectedRegion = id => selectedRegion === 'world' || REGION_MEMBER_SET[selectedRegion].has(id);
