// El Niño × food security: the tooltip. A country's figures for both axes of the map, its crises, and two sparklines:
// its harvests against trend, and the selected measure over time where the data has a series.

const SPARK_FROM = 1980, SPARK_TO = DATA.plast;   // both sparklines share one timeline

// a sparkline for a yearly series (values from SPARK_FROM, null where missing), drawn through the years that have a value.
// domain: [lo, hi] of the y-axis; enYears: El Niño harvest years, shaded
function sparkline(values, {label, cls, domain, enYears}){
  const points = values.map((v, i) => [SPARK_FROM + i, v]).filter(p => p[1] != null);
  if(points.length < 5) return '';
  const w = 236, h = 30;
  const x = d3.scaleLinear().domain([SPARK_FROM, SPARK_TO]).range([1, w - 1]);
  const y = d3.scaleLinear().domain(domain).range([h - 2, 2]).clamp(true);
  const step = x(SPARK_FROM + 1) - x(SPARK_FROM);
  const bands = enYears.map(yr => `<rect x="${(x(yr) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${h}" class="sp-en"/>`).join('');
  const zero = domain[0] < 0 && domain[1] > 0 ? `<line x1="0" x2="${w}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="sp-zero"/>` : '';
  const line = d3.line().x(p => x(p[0])).y(p => y(p[1]))(points);
  const years = `${points[0][0]}–${points[points.length - 1][0]}`;
  return `<div class="sp"><div class="sp-cap"><span>${label}</span><span>${years}</span></div>`
    + `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${bands}${zero}<path d="${line}" class="sp-line ${cls}"/></svg></div>`;
}

// the selected measure's value for a country, as text
function measureText(id, r){
  const v = AXIS === 'imports' ? r.now : AXES[AXIS].vals[id];
  return v == null ? 'no data' : MEASURES[AXIS].format(v);
}

// the selected measure's yearly series for a country (from SPARK_FROM), or null where the data has none
function measureSeries(id, r){
  if(AXIS === 'imports') return r.imp;
  return AXES[AXIS].series ? AXES[AXIS].series[id] : null;
}

function tooltipHtml(id, r){
  const row = (label, value) => `<div class="tr"><span>${label}</span><b>${value}</b></div>`;
  const shortfall = Math.round(-r.hgap);
  const harvest = r.hgap == null ? 'not tested'
    : shortfall > 0 ? `${shortfall}% smaller${isWeak(r) ? ' <i>weak signal</i>' : ''}` : 'no shortfall';
  const crisis = FOOD_INSEC[id] ? row('Crisis', FOOD_INSEC[id].join(', '))
    : FOOD_INSEC_MINOR[id] ? row('Smaller crisis', FOOD_INSEC_MINOR[id].join(', ')) : '';

  const enYears = r.hev ? r.hev.map(e => e[0]) : [];
  let sparks = '';
  if(r.han){   // harvest against trend: a symmetric axis, at least ±20% and at most ±60%
    const reach = Math.min(60, Math.max(20, d3.max(r.han, v => v == null ? null : Math.abs(v))));
    sparks += sparkline(r.han, {label: 'Harvest vs trend', cls: 'sp-hit', domain: [-reach, reach], enYears});
  }
  const series = measureSeries(id, r);
  if(series){   // the selected measure: from 0 (or below), to at least its `floor`
    const spec = MEASURES[AXIS];
    sparks += sparkline(series, {label: spec.series, cls: 'sp-measure', domain: [Math.min(0, d3.min(series)), Math.max(spec.floor || 0, d3.max(series))], enYears});
  }
  const key = sparks && enYears.length ? '<div class="sp-key"><i></i>El Niño years</div>' : '';
  return `<b>${shortName(r)}</b>${row('El Niño harvest', harvest)}${row(AXES[AXIS].label, measureText(id, r))}${crisis}${sparks}${key}`;
}

// shown for countries with a colour or a crisis border, in the selected region. Rebuilt only when the country (or the measure)
// changes; mouse moves just reposition it
let tipKey = null;
function showTip(ev, d){
  const r = DATA.world[d.id];
  if(!r || (!fillFor(d.id) && !FOOD_INSEC[d.id]) || !inRegion(d.id)){ tip.style.opacity = 0; return; }
  const key = d.id + '|' + AXIS;
  if(key !== tipKey){ tipKey = key; tip.innerHTML = tooltipHtml(d.id, r); }
  const box = mapbox.getBoundingClientRect();
  let x = ev.clientX - box.left + 14;
  const y = ev.clientY - box.top + 14;
  if(x + 300 > box.width) x = ev.clientX - box.left - 304;   // flip to the left near the right edge
  tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1;
}
const hideTip = () => { tip.style.opacity = 0; };
paths.on('pointermove', showTip).on('pointerleave', hideTip);
marks.on('pointermove', showTip).on('pointerleave', hideTip);
