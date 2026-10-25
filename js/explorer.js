// El Niño × food security: the controls (the measure dropdown and the region buttons), the score line beside the map,
// the table of every measure, and starting the page. Loaded last.

// ---- score line: three big numbers for the selected measure, counted for the countries in view -----------------
// hits, false alarms and misses for a measure over a set of countries, both rounds (2015–16, 2023–24) together
function scoreOf(axis, ids){
  let h = 0, f = 0, m = 0;
  ids.forEach(id => {
    const t = TEST_RESULTS[id];
    if(!t) return;
    for(let round = 0; round < 2; round++){
      if(t.flagged[round] < 0) continue;   // shortfall not known before this round
      const flag = axis === 'region' ? SOUTHERN_AFRICA.has(id)
        : axis === 'none' ? t.flagged[round] === 1
        : t.flagged[round] === 1 && t.classes[axis][round] >= 1;
      const crisis = t.crisis[round] === 1;
      if(flag && crisis) h++; else if(flag) f++; else if(crisis) m++;
    }
  });
  return {h, f, m};
}

function drawScoreLine(){
  const el = document.getElementById('score');
  if(!el) return;
  const a = scoreOf(selectedMeasure, selectedRegion === 'world' ? Object.keys(TEST_RESULTS) : REGION_MEMBERS[selectedRegion]);
  const named = Object.keys(DATA.countries).filter(id => isHighestRisk(DATA.countries[id]));
  // big number first, its meaning underneath
  const stat = (big, unit, label) => `<div class="stat"><div class="sb">${big}<span class="su">${unit}</span></div><div class="sl">${label}</div></div>`;
  el.innerHTML = stat(named.filter(inSelectedRegion).length, ` of ${named.length}`, 'highest-risk countries in view')
    + stat(a.h, ` of ${a.h + a.m}`, 'food crises the map would have warned of')
    + stat(a.f, '', 'warnings followed by no crisis')
    + '<div class="scontext">If drawn before each of the last two El Niños.</div>';
}

// ---- the table of every measure, worldwide; a click on a measure's row shows it on the map ---------------------
function drawScoreTable(){
  const el = document.getElementById('scores');
  if(!el) return;
  const rows = [['region', 'Every southern African country'], ['none', 'Shortfall alone']]
    .concat(MEASURE_ORDER.map(a => [a, 'Shortfall + ' + MEASURE_DATA[a].label.toLowerCase()]));
  const cell = o => `${o.hits} of ${o.hits + o.missed}<span class="fa"> · ${o.falseAlarms} false</span>`;
  el.querySelector('tbody').innerHTML = rows.map(([key, label]) => {
    const o = MEASURE_SCORES.world[key];
    const h = o['2015'].hits + o['2023'].hits, f = o['2015'].falseAlarms + o['2023'].falseAlarms, m = o['2015'].missed + o['2023'].missed;
    const hitRate = Math.round(100 * h / (h + m)), precision = Math.round(100 * h / Math.max(1, h + f));
    return `<tr class="${key === selectedMeasure ? 'cur' : ''}${MEASURE_DATA[key] ? ' pick' : ''}" data-axis="${MEASURE_DATA[key] ? key : ''}"><th scope="row">${label}</th>`
      + `<td>${cell(o['2015'])}</td><td>${cell(o['2023'])}</td><td>${hitRate}%</td><td>${precision}%</td></tr>`;
  }).join('');
  el.querySelectorAll('tr.pick').forEach(tr => tr.addEventListener('click', () => selectMeasure(tr.dataset.axis)));
}

// ---- switching the measure ---------------------------------------------------------------------------------
const MEASURE_ORDER = Object.keys(MEASURE_DATA);   // the measures present in js/measures.js, in order
const showMeasureDefinition = () => { const def = document.getElementById('axisdef'); if(def) def.innerHTML = MEASURE_DISPLAY[selectedMeasure].definition; };

function selectMeasure(a){
  if(!MEASURE_DATA[a] || a === selectedMeasure) return;
  selectedMeasure = a;
  const select = document.getElementById('axissel');
  if(select) select.value = a;   // keep the dropdown in step when the table switches the measure
  for(const key in pieceCache) delete pieceCache[key];   // which countries are named and raised depends on the measure
  showMeasureDefinition();
  washesShown = washesForWidth(); redrawMap(); drawWash(washTransform, washesShown); drawScoreTable();
}

// ---- controls ----------------------------------------------------------------------------------------------
// the measure: one dropdown, "Shortfall + <measure>"
document.getElementById('axisseg').innerHTML = '<select id="axissel" aria-label="Theory to test">'
  + MEASURE_ORDER.map(a => `<option value="${a}"${a === selectedMeasure ? ' selected' : ''}>Shortfall + ${MEASURE_DATA[a].label.toLowerCase()}</option>`).join('')
  + '</select>';
document.getElementById('axissel').addEventListener('change', e => selectMeasure(e.target.value));

// the regions: short button labels, with the full name as the tooltip
document.getElementById('zoomseg').innerHTML = '<button data-z="world" aria-pressed="true">World</button>'
  + ZOOM_REGIONS.map(zone => `<button data-z="${zone}" aria-pressed="false" title="${REGION_TITLE[zone]}">${ZOOM_REGION_SHORT_NAME[zone] || REGION_TITLE[zone]}</button>`).join('');
document.querySelectorAll('#zoomseg button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#zoomseg button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  zoomTo(b.dataset.z);
}));

// on resize: re-frame and re-size the legend for the new width. Crossing the phone breakpoint reloads,
// because the map's frame is set at load
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if(window.matchMedia('(max-width: 640px)').matches !== IS_PHONE_LAYOUT){ location.reload(); return; }
    sizeWash(); washesShown = washesForWidth(); zoomTo(selectedRegion);
  }, 150);
});

// ---- start: always on the world view ----------------------------------------------------------------------
showMeasureDefinition(); drawScoreTable();
zoomTo('world');
