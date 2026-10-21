// El Niño × food security: editorial and visual settings that js/chart.js reads.
// Loaded after js/data.js and before js/chart.js. Facts live in data.js; choices live here.

// ---- Map frame: the area the world projection fits, and small countries drawn as dots in the world view.
const FOCUS = {type:'Polygon', coordinates:[[[-120,-48],[179.9,-48],[179.9,62],[-120,62],[-120,-48]]]};   // reaches 180° so New Zealand is not clipped
// small countries get a marker so they stay visible (Lesotho, Eswatini, El Salvador...)
const SMALL_OK = new Set(['426','748','222','332','214','188','591','558','340','320','454','626','084','308','662','670','780','044','052','174','480','690']);

// ---- Watercolour: how the washes are painted (layers, coverage, edge spill, brush size).
const WC = {maxBlotches: 160, spill: 0.01, layers: 14, cover: 0.97, base: 0.72, baseDark: 0.86, low: 0, nodata: 0.88, pre: 1, per: 2, amp: 0.3, maxPre: 2.6, maxLayer: 2.2, simplify: 0.8, seed: 11, maskShare: 0.55, rMin: 7, rMax: 24};

// ---- Zoom regions: UN M49 subregions grouped into the region buttons, one exception (Sudan), names and button order.
// merged zoom regions: the UN's Sub-Saharan Africa (Southern, Eastern, Western and Middle Africa), and the Middle East and
// North Africa (UN Northern Africa + Western Asia, the grouping used by FAO, the World Bank and UNICEF)
const ZOOM_GROUP = {'018': 'ssa', '014': 'ssa', '011': 'ssa', '017': 'ssa', '015': 'wana', '145': 'wana', '013': 'cac', '029': 'cac', '035': 'seap', '054': 'seap'};
// one exception to the UN grouping: Sudan (UN Northern Africa) sits with Sub-Saharan Africa, as the World Bank, IGAD and FAO's El Niño reporting place it
const ZONE_OVERRIDE = {'729': 'ssa'};
const GROUP_NAME = {ssa: 'Sub-Saharan Africa', wana: 'West Asia and North Africa', seap: 'Southeast Asia and the Pacific', cac: 'Central America and the Caribbean'};
// fixed editorial order for the known regions; any other region the data brings in follows, most crises first
const ZOOM_ORDER = ['ssa', 'cac', 'wana', 'seap'];

// ---- Country names: short forms for the map, and names that take "the" in running text.
// country names as shown on the map (short forms of long official names)
const SHORT = {'Syrian Arab Republic': 'Syria', 'United Arab Emirates': 'UAE', 'State of Palestine': 'Palestine', 'Iran (Islamic Republic of)': 'Iran', 'Russian Federation': 'Russia', 'Republic of Moldova': 'Moldova', 'Bolivia (Plurinational State of)': 'Bolivia', 'Venezuela (Bolivarian Republic of)': 'Venezuela', "Lao People's Democratic Republic": 'Laos', 'Viet Nam': 'Vietnam'};
// ---- one insight for the selected view, written from the data -------------------------------
// country names that take 'the' in running text; capitalised at the start of a sentence
const THE = new Set(['Philippines', 'Netherlands', 'Gambia', 'United States', 'UAE', 'DR Congo', 'Central African Rep.', 'Central African Republic', 'Comoros', 'Bahamas', 'Dominican Republic', 'Czech Republic', 'Maldives', 'Solomon Islands', 'United Kingdom']);

// ---- World view notes: the text for each cluster of dark borders. Clusters are found from the data (see crisisClusters in
// chart.js); each note names one member country (UN M49 code) to say which cluster it describes. A force simulation places it.
// phone: whether the note also shows on maps 800px wide or less.
const WORLD_NOTES = [
  {member: '716', title: 'Southern Africa', lines: ['Food crises followed harvest', 'losses everywhere but South Africa'], phone: true},   // Zimbabwe
  {member: '706', title: 'Horn of Africa', lines: ['Drought crises', 'in 2016; too little', 'cereal data to test'], phone: false},   // Somalia; short lines so it fits beside the Horn
  {member: '332', title: 'Haiti', lines: ['El Niño drought,', 'then Hurricane', 'Matthew, in 2016'], phone: false},   // short lines: the note must fit the Atlantic gap
  {member: '626', title: 'Timor-Leste', lines: ['27% in crisis as El Niño', 'drought hit in 2023–24'], phone: false},
];
// two dark-border countries in the same zoom region belong to one cluster if they touch or lie within this distance
const CLUSTER_KM = 900;

// ---- Researched insight lines: used instead of the computed sentence only while the data still matches (when).
// Sources are listed in the method section of index.html.
//   wana: World Bank, Climate Variability, Drought, and Drought Management in Tunisia's Agricultural Sector (NAO, not ENSO, drove
//         the 2015-16 drought); FAO GIEWS Crop Prospects and Food Situation, March 2016 (Morocco and Algeria: dry conditions;
//         Iraq, Syria and Yemen: conflict).
//   cac:  Global Report on Food Crises 2017 (Haiti) and 2024 (Guatemala, Honduras, Nicaragua).
//   seap: IPC Timor-Leste, November 2023-April 2024 (27% in Phase 3 or worse; El Niño drought named first).
const INSIGHT_TEXT = {
  wana: {when: 'noLabelledCrisis', text: 'High import bills, but El Niño isn’t the main threat here: harvests swing with the North Atlantic more than the Pacific, and the region’s hunger crises come from conflict.'},
  cac:  {when: 'noLabelledCrisis', text: 'Harvest losses here didn’t become national crises: neither labelled country crossed the IPC bar, while Haiti’s 2016 crisis came from drought worsened by El Niño, then Hurricane Matthew.'},
  seap: {when: 'noLabelled', text: 'Timor-Leste is the one national food crisis here: 27% of its people faced crisis as El Niño drought hit in 2023–24. Elsewhere, comparable data is missing.'},
};
