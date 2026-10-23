// El Niño × food security: what each country's colour means, which countries are named, and which belong to each zoom region.
// Lookups on js/data.js, js/settings.js and js/axes.js only; nothing here draws.

// ---- theme colours ----------------------------------------------------------------------------------
// CSS custom properties, cached; paint() and drawWash() clear the cache, so a theme change shows on the next frame
let cssCache = {};
function cssVar(name){
  if(!cssCache[name]) cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return cssCache[name];
}

// ---- the two axes of the bivariate map ------------------------------------------------------------
// the measure on the second axis: cereal imports by default; the explorer can switch it (its classes are in js/axes.js)
let AXIS = 'imports';
const ID_OF = new Map(Object.entries(DATA.world).map(([id, r]) => [r, id]));   // country record -> M49 code

// first axis, 0 to 2: how much smaller El Niño harvests are, cut at SHORTFALL_CUTS. null: harvests not tested
function hitClass(r){
  if(r.hgap == null) return null;
  const shortfall = -r.hgap;
  if(shortfall >= SHORTFALL_CUTS[1]) return 2;
  if(shortfall >= SHORTFALL_CUTS[0]) return 1;
  return 0;
}

// second axis, 0 to 2: the share of cereals imported (25%, 50%), or the class of the selected measure. null: no data
function depClass(r){
  if(AXIS === 'imports') return r.now >= 50 ? 2 : r.now >= 25 ? 1 : 0;
  const c = AXES[AXIS].cls[ID_OF.get(r)];
  return c == null ? null : c;
}

// i = shortfall class, j = second-measure class. The palette's ramps are swapped,
// so shortfall runs to purple (left edge of the diamond) and the second measure to gold (right edge)
const biColor = (i, j) => cssVar(`--bi${j}${i}`);

// a country's colour, or null when either axis has no data (the country is painted grey)
function fillFor(id){
  const r = DATA.world[id];
  if(!r) return null;
  const i = hitClass(r);
  if(i == null) return null;
  const j = depClass(r);
  return j == null ? null : biColor(i, j);
}

// the lowest class on both axes is laid on at WC.low (0: the white paper shows through),
// so most of the world stays close to bare paper, as in ink-and-wash drawings
function isLowestClass(r){
  return r.hgap != null && hitClass(r) === 0 && depClass(r) === 0;
}

// ---- hatching: a weak harvest signal ---------------------------------------------------------------
const isWeak = r => r.hp >= WEAK_P;   // the shortfall may be chance (Mann-Whitney p)

// hatched only where the colour claims a harvest shortfall. The hatch lies over the true class colour:
// fading the colour instead would turn it into a different class
function showsWeakShortfall(id){
  const r = DATA.world[id];
  return r && r.hgap != null && hitClass(r) >= 1 && isWeak(r);
}

// ---- named countries ---------------------------------------------------------------------------------
// the diamond cells whose countries are named on the map: the highest-risk cell and the two that share an edge with it
// (i = shortfall class, j = second-measure class)
const TOP_CELLS = [[2,1],[1,2],[2,2]];

// "purple": any mixed colour, a harvest shortfall together with the middle or top class of the second measure
const isPurple = r => !!r && r.hgap != null && hitClass(r) >= 1 && depClass(r) >= 1;

// named on the map, and raised off the paper with a shadow: the TOP_CELLS (22, 21, 12)
const isLabelled = r => isPurple(r) && hitClass(r) + depClass(r) >= 3;

// country names as shown on the map: SHORT first, then the SHORT_RULES in order
const shortName = r => SHORT[r.name] || SHORT_RULES.reduce((name, [from, to]) => name.replace(from, to), r.name);

// ---- zoom regions ---------------------------------------------------------------------------------
// a country's zoom region: its UN M49 subregion, grouped by ZOOM_GROUP, with ZONE_OVERRIDE exceptions (Sudan)
function zoneOf(id){
  if(ZONE_OVERRIDE[id]) return ZONE_OVERRIDE[id];
  const subregion = M49_SUB[id];
  return subregion ? (ZOOM_GROUP[subregion] || subregion) : null;
}

// every region with a labelled country or a recorded El Niño food crisis gets a button
const zoneStats = {};
function countIn(id, key){
  const zone = zoneOf(id);
  if(!zone) return;
  if(!zoneStats[zone]) zoneStats[zone] = {crises: 0, labelled: 0};
  zoneStats[zone][key]++;
}
Object.entries(DATA.world).forEach(([id, r]) => { if(isLabelled(r)) countIn(id, 'labelled'); });
Object.keys(FOOD_INSEC).forEach(id => countIn(id, 'crises'));

// known regions in ZOOM_ORDER; any other region the data brings in follows, most crises first, then most labelled countries
const ZOOM_SUBS = Object.keys(zoneStats).sort((a, b) => {
  const ia = ZOOM_ORDER.indexOf(a), ib = ZOOM_ORDER.indexOf(b);
  if(ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return zoneStats[b].crises - zoneStats[a].crises || zoneStats[b].labelled - zoneStats[a].labelled;
});

// each region's member countries, as a list and as a set, and its full name; 'world' has no member list
const REGIONS_Z = {world: null}, REGION_SET = {}, REGION_NAME = {};
ZOOM_SUBS.forEach(zone => {
  REGIONS_Z[zone] = Object.keys(M49_SUB).filter(id => zoneOf(id) === zone);
  REGION_SET[zone] = new Set(REGIONS_Z[zone]);
  REGION_NAME[zone] = GROUP_NAME[zone] || M49_NAME[zone];
});

let region = 'world';   // the region on screen

// is the country in the selected region? (the world view includes every country)
const inRegion = id => region === 'world' || REGION_SET[region].has(id);
