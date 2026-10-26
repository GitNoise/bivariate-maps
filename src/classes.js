// El Niño × food security: what each country's colour means, which countries are named, hatched and outlined, and which
// belong to each zoom region. Lookups on src/data.js, src/settings.js and src/measures.js only; nothing here draws.

import {DATA, NATIONAL_CRISES, SMALLER_CRISES} from './data.js';
import {SMALL_COUNTRIES} from './bivariate/world.js';
import {createRegions} from './bivariate/regions.js';
import {SHORTFALL_THRESHOLDS, WEAK_SIGNAL_P, SHORT_NAMES, SHORT_NAME_RULES} from './settings.js';
import {MEASURE_DATA} from './measures.js';
import {view} from './state.svelte.js';

// ---- the two axes of the bivariate map ------------------------------------------------------------
const ID_OF_RECORD = new Map(Object.entries(DATA.countries).map(([id, r]) => [r, id]));   // country record -> M49 code

// first axis, 0 to 2: how much smaller El Niño harvests are, cut at SHORTFALL_THRESHOLDS. null: harvests not tested
export function shortfallClass(r){
  if(r.harvestShortfall == null) return null;
  const shortfall = r.harvestShortfall;
  if(shortfall >= SHORTFALL_THRESHOLDS[1]) return 2;
  if(shortfall >= SHORTFALL_THRESHOLDS[0]) return 1;
  return 0;
}

// second axis, 0 to 2: the class of the selected measure, from src/measures.js. null: no data
export function measureClass(r){
  const c = MEASURE_DATA[view.measure].classes[ID_OF_RECORD.get(r)];
  return c == null ? null : c;
}

// each country's cell on the map for a measure: [i, j], i = shortfall class, j = the measure's class, for the countries with
// both (the others are painted grey). Shortfall runs to purple (left edge of the diamond), the measure to gold (right edge);
// the lowest cell on both axes is laid on at the brush's `low` (0: the white paper shows through), so most of the world stays
// close to bare paper, as in ink-and-wash drawings. One object per measure, so the map repaints when the measure changes
const cellCache = {};
export function cellsFor(measure){
  if(!cellCache[measure]){
    cellCache[measure] = {};
    Object.entries(DATA.countries).forEach(([id, r]) => {
      const i = shortfallClass(r), j = MEASURE_DATA[measure].classes[id];
      if(i != null && j != null) cellCache[measure][id] = [i, j];
    });
  }
  return cellCache[measure];
}

// ---- hatching: a weak harvest signal ---------------------------------------------------------------
export const isWeakSignal = r => r.shortfallPValue >= WEAK_SIGNAL_P;   // the shortfall may be chance (Mann-Whitney p)

// hatched only where the colour claims a harvest shortfall. The hatch lies over the true class colour:
// fading the colour instead would turn it into a different class
export const WEAK_SHORTFALL = new Set(Object.keys(DATA.countries).filter(id => shortfallClass(DATA.countries[id]) >= 1 && isWeakSignal(DATA.countries[id])));

// ---- outlines, dots and frames ---------------------------------------------------------------------------
// the crisis borders: solid for a national food crisis, dashed for a smaller one or a UN appeal
export const CRISIS_OUTLINES = {solid: new Set(Object.keys(NATIONAL_CRISES)), dashed: new Set(Object.keys(SMALLER_CRISES))};
// small countries with data get a dot in the world view
export const SMALL_WITH_DATA = new Set([...SMALL_COUNTRIES].filter(id => DATA.countries[id]));
// a region's frame fits the countries with a tested harvest or a crisis; grey no-data countries (Botswana, Cuba, Papua New
// Guinea) do not pull it
export const FRAMED = new Set([...Object.keys(DATA.countries).filter(id => DATA.countries[id].harvestShortfall != null), ...Object.keys(NATIONAL_CRISES)]);

// ---- named countries ---------------------------------------------------------------------------------
// the diamond cells whose countries are named on the map: the highest-risk cell and the two that share an edge with it
// (i = shortfall class, j = second-measure class)
export const NAMED_CELLS = [[2,1],[1,2],[2,2]];

// named on the map, and raised off the paper with a shadow: the countries in the NAMED_CELLS
export const isHighestRisk = r => !!r && NAMED_CELLS.some(([i, j]) => shortfallClass(r) === i && measureClass(r) === j);
// the named countries for a measure, one set per measure, so the labels are placed again when the measure changes
const namedCache = {};
export const namedFor = measure => (namedCache[measure] ??= new Set(Object.entries(cellsFor(measure))
  .filter(([, [i, j]]) => NAMED_CELLS.some(([a, b]) => a === i && b === j)).map(([id]) => id)));

// country names as shown on the map: SHORT_NAMES first, then the SHORT_NAME_RULES in order
export const shortName = r => SHORT_NAMES[r.name] || SHORT_NAME_RULES.reduce((name, [from, to]) => name.replace(from, to), r.name);

// ---- zoom regions -----------------------------------------------------------------------------------
// the UN grouping (src/bivariate/regions.js); every region with a named country (on the first measure) or a recorded El Niño
// food crisis gets a button, even one with a single country (Southeast Asia and the Pacific: Timor-Leste)
export const REGIONS = createRegions({min: 1, include: [
  ...Object.keys(DATA.countries).filter(id => isHighestRisk(DATA.countries[id])),
  ...Object.keys(NATIONAL_CRISES),
]});

// is the country in the selected region? (the world view includes every country)
export const inSelectedRegion = id => view.region === 'world' || REGIONS.members[view.region].has(id);
