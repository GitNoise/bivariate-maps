// El Niño × food security: editorial and visual settings that the drawing code reads.
// Facts live in data.js; choices live here.

import * as d3 from 'd3';


// ---- Classes: the shortfall cut-offs (%, smaller harvests in El Niño years), and the p-value from which a harvest signal is "weak" (hatched).
// HARVEST_RANGE: the fixed y-range of the tooltip's harvest sparkline, % against trend.
export const SHORTFALL_THRESHOLDS = [5, 15];
export const WEAK_SIGNAL_P = 0.1;
export const HARVEST_RANGE = [-50, 50];

// ---- Second measures (classes, values and series in src/measures.js): the definition in the key line under the map, how a value
// reads in the tooltip, and its sparkline: label, end values (short), and a fixed y-range, the same for every country so the
// lines can be compared (log: on a log scale). Values beyond the range are drawn at its edge; the end values stay exact.
export const MEASURE_DISPLAY = {
  imports: {definition: '<b>Imports:</b>&nbsp;% of cereals, 2020–22',
    format: v => v <= 0 ? 'net exporter' : `${Math.round(v)}% of cereals`, series: 'Imports, %', short: v => `${Math.round(v)}%`, range: [-50, 100]},   // below 0: net exporter
  gdp: {definition: '<b>Income:</b>&nbsp;GDP per person in US dollars, 2022; classes follow the World Bank’s income groups (4.5k, 1.1k)',
    format: v => '$' + Math.round(v).toLocaleString('en') + ' per person', series: 'GDP per person, US$ (log scale)', short: v => '$' + d3.format('.2~s')(v), range: [150, 60000], log: true},
  poverty: {definition: '<b>Extreme poverty:</b>&nbsp;% living below the international poverty line, latest survey',
    format: v => `${Math.round(v)}% in extreme poverty`, series: 'Extreme poverty, %', short: v => `${Math.round(v)}%`, range: [0, 100]},
  hdi: {definition: '<b>Human development:</b>&nbsp;UNDP Human Development Index; medium below 0.70, low below 0.55',
    format: v => v.toFixed(3), series: 'Human Development Index', short: v => v.toFixed(2), range: [0.3, 1]},
  life: {definition: '<b>Life expectancy:</b>&nbsp;years at birth; classes split at the median (74) and 65',
    format: v => `${Math.round(v)} years`, series: 'Life expectancy, years', short: v => `${Math.round(v)}`, range: [40, 85]},
  undernourishment: {definition: '<b>Undernourishment:</b>&nbsp;% of people eating too little, FAO three-year average; classes at 10% and 25%. Chronic hunger makes any shock worse, El Niño or not',
    format: v => v <= 2.5 ? 'under 2.5% undernourished' : `${Math.round(v)}% undernourished`, series: 'Undernourishment, %',
    short: v => v <= 2.5 ? '<2.5%' : `${Math.round(v)}%`, range: [0, 60]},   // FAO reports prevalence below 2.5% only as <2.5 (stored as 2.5)
};


// ---- Regions: the zoom regions are the UN grouping of src/bivariate/regions.js.
// the "every southern African country" baseline in the score line; the analysis reads this list too (pipeline/page_files.py)
export const SOUTHERN_AFRICA = new Set(['024','072','748','426','450','454','508','516','710','894','716']);

// ---- Country names: short forms for the map.
// country names as shown on the map (short forms of long official names), then rules applied to every other name, in order
export const SHORT_NAMES = {'Syrian Arab Republic': 'Syria', 'United Arab Emirates': 'UAE', 'State of Palestine': 'Palestine', 'Iran (Islamic Republic of)': 'Iran', 'Russian Federation': 'Russia', 'Republic of Moldova': 'Moldova', 'Bolivia (Plurinational State of)': 'Bolivia', 'Venezuela (Bolivarian Republic of)': 'Venezuela', "Lao People's Democratic Republic": 'Laos', 'Viet Nam': 'Vietnam'};
export const SHORT_NAME_RULES = [[/ \(.*\)/, ''], ['Democratic Republic of the ', 'DR '], ['United Republic of ', ''], [' of America', '']];

// ---- World view notes: the text for each cluster of dark borders. Clusters are found from the data (see clusters in
// src/bivariate/labels.js); each note names one member country (UN M49 code) to say which cluster it describes. A force simulation places it.
// phone: whether the note also shows on maps 800px wide or less.
export const WORLD_NOTES = [
  {member: '716', title: 'Southern Africa', lines: ['Food crises followed harvest', 'losses everywhere but South Africa'], phone: true},   // Zimbabwe
  {member: '706', title: 'Horn of Africa', lines: ['Drought crises', 'in 2016; too little', 'cereal data to test'], phone: false},   // Somalia; short lines so it fits beside the Horn
  {member: '332', title: 'Haiti', lines: ['El Niño drought,', 'then Hurricane', 'Matthew, in 2016'], phone: false},   // short lines: the note must fit the Atlantic gap
  {member: '626', title: 'Timor-Leste', lines: ['27% in crisis as El Niño', 'drought hit in 2023–24'], phone: false},
];
// two dark-border countries in the same zoom region belong to one cluster if they touch or lie within this distance
export const CLUSTER_KM = 900;
