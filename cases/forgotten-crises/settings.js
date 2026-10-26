// Need and missing money: the choices the map makes. Facts live in data.js (written by build_data.py).
//
// The two axes, each in three classes, cell (i, j):
//   i: humanitarian need, INFORM Severity's category, to purple on the left edge
//   j: how much of the country's UN appeals went unfunded, the share of the ask that never arrived (OCHA, Global
//      Humanitarian Overview 2025), to gold on the right edge
// Both high, the top of the diamond, is a severe crisis whose appeal is largely unfunded. The outline adds a third
// dimension: how long the gap has lasted (PERSISTENT_GAP_YEARS).
//
// need: INFORM's own categories, so the cut-offs are theirs: on the 1–5 index of its January 2025 release, High is above 3
// and Very High above 4 (INFORM Severity methodology, Table 7). Very Low to Medium are class 0
export const NEED_CLASSES = {'High': 1, 'Very High': 2};
// unfunded: equal thirds of the scale, % of the ask not funded: class 0 under a third, class 1 a third to two thirds,
// class 2 two thirds or more. Most 2025 appeals are in the top third (22 of 32; 2 in the bottom, 8 in the middle), as
// across all of them two thirds went unfunded (data.js). Funding per person in need is in the tooltip: the ask is already
// trimmed to what seems fundable, so a well-covered appeal does not mean a well-funded crisis
export const UNFUNDED_FROM = [100 / 3, 200 / 3];

// the cells raised off the page and named: high on one axis and at least middle on the other
export const RAISED_CELLS = [[2, 1], [1, 2], [2, 2]];

// ---- Outlines: a persistent gap, funded below that year's share across all country appeals for at least this many years
// in a row up to 2025 (data.js, from OCHA's Financial Tracking Service): every year since 2021. Four of the last five
// would mark 14 of the 32 coloured countries; every year marks 6
export const PERSISTENT_GAP_YEARS = 5;

// ---- ECHO's forgotten crises for 2026 (its Forgotten Crisis Assessment, made in 2025, so it matches the 2025 appeals),
// named in the tooltip for context. 20 crises in 24 countries, each country with ECHO's name for its crisis.
// Source: European Commission, DG ECHO, "Forgotten crises", page updated 7 October 2025:
// https://civil-protection-humanitarian-aid.ec.europa.eu/what/humanitarian-aid/needs-assessment/forgotten-crises_en
export const ECHO_FORGOTTEN = {
  '004': 'Complex crisis in Afghanistan',
  '012': 'Sahrawi refugees in Algeria',
  '050': 'Rohingya refugee crisis',   // Bangladesh
  '108': 'Complex crisis in Burundi',
  '120': 'Multiple crises in Cameroon',
  '140': 'Complex crisis in CAR',
  '320': 'Complex crisis in Central America',   // Guatemala
  '222': 'Complex crisis in Central America',   // El Salvador
  '340': 'Complex crisis in Central America',   // Honduras
  '854': 'Complex crisis in the Central Sahel',   // Burkina Faso
  '466': 'Complex crisis in the Central Sahel',   // Mali
  '562': 'Complex crisis in the Central Sahel',   // Niger
  '170': 'Complex crisis in Colombia and Venezuela displacement in Colombia',
  '332': 'Complex crisis in Haiti',
  '368': 'Multiple crises (conflict, and Syrian and Palestinian refugees in Iraq)',
  '400': 'Syrian refugees in Jordan',
  '434': 'Mixed migration flows in Libya',
  '508': 'Cabo Delgado Islamist insurgency',   // Mozambique
  '608': 'Mindanao conflict',   // Philippines
  '706': 'Complex crisis in Somalia',
  '728': 'Complex crisis in South Sudan',
  '800': 'Refugee crisis, international displacement',   // Uganda
  '862': 'Venezuela complex crisis',
  '887': 'Conflict in Yemen',
};

// ---- Zoom regions: the regions OCHA and ECHO report by, built from UN M49 subregions (Sudan sits with Sub-Saharan
// Africa, the module's default exception). A region gets a button with two or more coloured or hatched countries
export const REGION_GROUPS = {
  '014': 'ssa', '017': 'ssa', '018': 'ssa', '011': 'ssa',   // Eastern, Middle, Southern and Western Africa
  '015': 'mena', '145': 'mena',   // Northern Africa, Western Asia
  '034': 'asia', '035': 'asia', '030': 'asia', '143': 'asia', '054': 'asia', '057': 'asia', '061': 'asia', '053': 'asia',   // Southern, South-eastern, Eastern and Central Asia, the Pacific
  '013': 'lac', '029': 'lac', '005': 'lac',   // Central America, the Caribbean, South America
};
export const REGION_NAMES = {ssa: 'Sub-Saharan Africa', mena: 'Middle East and North Africa', asia: 'Asia and the Pacific', lac: 'Latin America and the Caribbean'};
export const REGION_SHORT_NAMES = {mena: 'Middle East & N. Africa', asia: 'Asia & Pacific', lac: 'Latin America & Caribbean'};
export const REGION_ORDER = ['ssa', 'mena', 'asia', 'lac'];

// ---- Notes: in the world view, one finding per region, placed by the region's appeal countries; zoomed in (region), a
// few about its subregions and countries. All from data.js (December 2025 figures). phone: whether it also shows on maps
// 800px wide or less.
export const WORLD_NOTES = [
  // Mali 10 years below average, DR Congo and Cameroon 9 (gapYears)
  {member: '180', countries: ['120', '140', '148', '180', '454', '466', '508', '562', '566', '706', '716', '728', '729', '854', '894'],
   title: 'Sub-Saharan Africa', lines: ['The longest gaps: Mali,', 'DR Congo, Cameroon short', 'for 9–10 years'], phone: true},
  // Yemen 19.5 million in need, $0.69bn; Syria and Palestine 19.8 million, $2.65bn
  {member: '887', countries: ['275', '422', '760', '887'], title: 'Middle East, N. Africa', lines: ['Yemen: as many in need', 'as Syria and Palestine,', 'a quarter of the money'], phone: false},
  // Afghanistan 22.9 and Myanmar 19.9 million in need; 34.5% of their combined ask funded
  {member: '104', countries: ['104', '586', '704', '004', '050'], title: 'Asia and Pacific', lines: ['Afghanistan, Myanmar:', '43 million in need,', 'a third funded'], phone: false},
  // 21.4% of the region's ask funded, the lowest; Honduras 11.8%
  {member: '170', countries: ['170', '222', '320', '332', '340', '862'], title: 'Latin America', lines: ['Least-funded region,', '21%; Honduras 12%'], phone: true},
  // Sub-Saharan Africa: Mali 20%, Burkina Faso 33.1%, Niger 22.9% funded, Mali 10 years below average; Sudan 30.4 million
  // in need, the most of any appeal, 36% funded; Malawi 14.8%, Zambia 20.8%, Zimbabwe 14.6%
  {region: 'ssa', member: '466', countries: ['466', '854', '562'], title: 'Central Sahel', lines: ['All three under a third', 'funded; Mali short', 'for 10 years'], phone: true},
  {region: 'ssa', member: '729', countries: ['729'], title: 'Sudan', lines: ['30 million in need, the', 'most anywhere; 36% funded'], phone: false},
  {region: 'ssa', member: '716', countries: ['454', '894', '716'], title: 'Southern Africa', lines: ['Drought appeals', '15–21% funded'], phone: false},
  // Middle East and North Africa: Yemen 19.5 million, 27.8%; Palestine $4.07bn, after Sudan's $4.16bn, 39.7%
  {region: 'mena', member: '887', countries: ['887'], title: 'Yemen', lines: ['19.5 million in need,', '28% funded'], phone: true},
  {region: 'mena', member: '275', countries: ['275'], title: 'Palestine', lines: ['Second-largest ask,', '$4.1 billion, 40% funded'], phone: false},
  // Asia and the Pacific: Myanmar 19.9 million, 28.3%; Afghanistan 22.9 million, 38.1%
  {region: 'asia', member: '104', countries: ['104'], title: 'Myanmar', lines: ['20 million in need,', '28% funded'], phone: true},
  {region: 'asia', member: '004', countries: ['004'], title: 'Afghanistan', lines: ['23 million in need,', '38% funded'], phone: false},
  // Latin America and the Caribbean: Honduras 11.8%, the lowest of any appeal; Haiti 10 years below average; Venezuela
  // 7.9 million, 16.8%
  {region: 'lac', member: '340', countries: ['340'], title: 'Honduras', lines: ['12% funded, the', 'lowest of any appeal'], phone: true},
  {region: 'lac', member: '332', countries: ['332'], title: 'Haiti', lines: ['Below average', '10 years in a row'], phone: false},
  {region: 'lac', member: '862', countries: ['862'], title: 'Venezuela', lines: ['7.9 million in need,', '17% funded'], phone: false},
];
