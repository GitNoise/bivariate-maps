// El Niño × food security: the tooltip. A country's figures for both axes of the map, its crises, and two sparklines:
// its harvests against trend, and the selected measure over time where the data has a series.

const SPARK_FROM = 1980, SPARK_TO = DATA.plast;   // both sparklines share one timeline

// a sparkline for a yearly series (values from SPARK_FROM, null where missing), drawn through the years that have a value.
// The first and last values are marked with a dot and labelled (valueText: how a value reads); when years are missing
// (poverty surveys), every value gets a small dot. domain: the fixed [lo, hi] of the y-axis (log: on a log scale);
// cuts: class limits, drawn as faint dashed lines; enYears: El Niño harvest years, shaded
function sparkline(values, {label, cls, domain, log, cuts = [], enYears, valueText}){
  const points = values.map((v, i) => [SPARK_FROM + i, v]).filter(p => p[1] != null && (!log || p[1] > 0));
  if(!points.length) return '';
  const w = 236, h = 40, labelRoom = 30;   // room for the end values left and right of the line
  const x = d3.scaleLinear().domain([SPARK_FROM, SPARK_TO]).range([labelRoom, w - labelRoom]);
  const y = (log ? d3.scaleLog() : d3.scaleLinear()).domain(domain).range([h - 2, 2]).clamp(true);
  const across = yv => `x1="${x(SPARK_FROM).toFixed(1)}" x2="${x(SPARK_TO).toFixed(1)}" y1="${y(yv).toFixed(1)}" y2="${y(yv).toFixed(1)}"`;
  const limits = cuts.map(c => `<line ${across(c)} class="sp-cut"/>`).join('');
  const step = x(SPARK_FROM + 1) - x(SPARK_FROM);
  const bands = enYears.map(yr => `<rect x="${(x(yr) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${h}" class="sp-en"/>`).join('');
  const zero = domain[0] < 0 && domain[1] > 0 ? `<line ${across(0)} class="sp-zero"/>` : '';
  const line = d3.line().x(p => x(p[0])).y(p => y(p[1]))(points);
  const start = points[0], end = points[points.length - 1];
  const dot = (p, r) => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="${r}" class="sp-dot ${cls}"/>`;
  const sparse = points.length < end[0] - start[0] + 1;   // years missing
  const dots = (sparse ? points.map(p => dot(p, 1.5)).join('') : '') + dot(start, 2.2) + (end === start ? '' : dot(end, 2.2));
  // end values: the first to the left of the line, the last to the right
  const value = (p, side) => `<text x="${(x(p[0]) + side * 5).toFixed(1)}" y="${y(p[1]).toFixed(1)}" dy="0.35em" text-anchor="${side < 0 ? 'end' : 'start'}" class="sp-val">${valueText(p[1])}</text>`;
  const endValues = (end === start ? '' : value(start, -1)) + value(end, 1);
  const years = end === start ? `${start[0]}` : `${start[0]}–${end[0]}`;
  return `<div class="sp"><div class="sp-cap"><span>${label}</span><span>${years}</span></div>`
    + `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${bands}${zero}${limits}<path d="${line}" class="sp-line ${cls}"/>${dots}${endValues}</svg></div>`;
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
  if(r.han){   // each year's harvest against a normal year: the country's long-term (LOWESS) trend
    const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) + '%';
    sparks += sparkline(r.han, {label: 'Harvest vs normal year', cls: 'sp-hit', domain: HARVEST_RANGE, enYears, valueText: signed});
  }
  const series = measureSeries(id, r);
  let limits = false;
  if(series){   // the selected measure, with the limits of its map classes
    const spec = MEASURES[AXIS], cuts = AXES[AXIS].cuts || [];
    const spark = sparkline(series, {label: spec.series, cls: 'sp-measure', domain: spec.range, log: spec.log, cuts, enYears, valueText: spec.short});
    sparks += spark; limits = !!spark && cuts.length > 0;
  }
  const keyItems = (enYears.length ? '<span><i></i>El Niño years</span>' : '') + (limits ? '<span><b></b>Class limits</span>' : '');
  const key = sparks && keyItems ? `<div class="sp-key">${keyItems}</div>` : '';
  return `<b>${shortName(r)}</b>${row('El Niño harvest', harvest)}${row(AXES[AXIS].label, measureText(id, r))}${crisis}${sparks}${key}`;
}

// shown for countries with a colour or a crisis border, in the selected region
const hasTip = id => DATA.world[id] && (fillFor(id) || FOOD_INSEC[id]) && inRegion(id);

// the tooltip's content, rebuilt only when the country or the measure changes. false: this country has no tooltip
let tipKey = null, tipId = null;   // tipId: the country the tooltip is open for
function fillTip(id){
  if(!hasTip(id)){ hideTip(); return false; }
  const key = id + '|' + AXIS;
  if(key !== tipKey){ tipKey = key; tip.innerHTML = tooltipHtml(id, DATA.world[id]); }
  tipId = id;
  return true;
}

// on mouse moves: fill the tooltip for the country under the pointer and move it beside the pointer
function showTip(ev, d){
  if(!fillTip(d.id)) return;
  const box = mapbox.getBoundingClientRect();
  let x = ev.clientX - box.left + 14;
  const y = ev.clientY - box.top + 14;
  if(x + 300 > box.width) x = ev.clientX - box.left - 304;   // flip to the left near the right edge
  tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1;
}
function hideTip(){ tip.style.opacity = 0; tipId = null; }

// after a change of measure or region (paint calls it): refill the open tooltip in place, without waiting for the mouse to move
function refreshTip(){
  if(tipId) fillTip(tipId);
}
paths.on('pointermove', showTip).on('pointerleave', hideTip);
marks.on('pointermove', showTip).on('pointerleave', hideTip);
