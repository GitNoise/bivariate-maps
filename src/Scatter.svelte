<!-- The companion scatters, one small multiple per second measure: each tested country's harvest shortfall (across) against
     the measure (up). Countries with a national food crisis after the last two El Niños are highlighted; the shaded corner is
     where the map flags a country (shortfall of 5% or more, the measure in its middle or top class). Hovering a dot names
     that country in every panel; the panel of the measure on the map is marked. -->
<script>
  import * as d3 from 'd3';
  import {DATA, NATIONAL_CRISES} from './data.js';
  import {MEASURE_DISPLAY} from './settings.js';
  import {MEASURE_DATA} from './measures.js';
  import {shortName} from './classes.js';
  import {view} from './state.svelte.js';

  const FLAG_AT = 5;   // % shortfall, as in the walk-forward test
  const SHORTFALL_RANGE = [-20, 40];
  const HIGHER_IS_WEAKER = {imports: true, poverty: true, undernourishment: true, gdp: false, hdi: false, life: false};
  const Y_TICKS = {gdp: [300, 3000, 30000], undernourishment: [20, 40, 60]};   // log scale; and no 0 tick where 0 would read as FAO's <2.5 floor
  const margin = {top: 8, right: 10, bottom: 22, left: 38};

  let width = $state(680);
  const columns = $derived(width < 520 ? 1 : 2);
  const panelWidth = $derived(Math.floor((width - (columns - 1) * 20) / columns));
  const panelHeight = $derived(Math.round(panelWidth * 0.62));
  const x = $derived(d3.scaleLinear().domain(SHORTFALL_RANGE).range([margin.left, panelWidth - margin.right]).clamp(true));

  // per measure: its scale, the flagged corner and its dots (crisis countries last, so they draw on top)
  const panels = $derived(Object.keys(MEASURE_DATA).map(measure => {
    const spec = MEASURE_DISPLAY[measure], data = MEASURE_DATA[measure], cut = data.thresholds[0];
    const y = (spec.log ? d3.scaleLog() : d3.scaleLinear()).domain(spec.range).range([panelHeight - margin.bottom, margin.top]).clamp(true);
    const weakUp = HIGHER_IS_WEAKER[measure];
    return {measure, label: data.label, spec, y, cut, yTicks: Y_TICKS[measure] || y.ticks(3),
      corner: {x: x(FLAG_AT), y: weakUp ? margin.top : y(cut), width: panelWidth - margin.right - x(FLAG_AT),
               height: weakUp ? y(cut) - margin.top : panelHeight - margin.bottom - y(cut)},
      dots: Object.entries(DATA.countries)
        .filter(([id, r]) => r.harvestShortfall != null && data.values[id] != null)
        .map(([id, r]) => ({id, crisis: !!NATIONAL_CRISES[id], cx: x(r.harvestShortfall), cy: y(data.values[id])}))
        .sort((a, b) => a.crisis - b.crisis)};
  }));

  // hover: the dot nearest the pointer (within 12px) names its country in every panel
  let hovered = $state(null);
  function onpointermove(ev, panel){
    const box = ev.currentTarget.getBoundingClientRect(), px = ev.clientX - box.left, py = ev.clientY - box.top;
    const near = d3.least(panel.dots, d => Math.hypot(d.cx - px, d.cy - py));
    hovered = near && Math.hypot(near.cx - px, near.cy - py) < 12 ? near.id : null;
  }
  const hoveredName = $derived(hovered && shortName(DATA.countries[hovered]));
</script>

<section class="scatter">
  <h3>The same ideas, country by country</h3>
  <p class="snote">Each panel pairs the harvest shortfall (across) with one second measure (up). Dark dots are the countries
    with a national food crisis after the 2015–16 or 2023–24 El Niño; the map flags the shaded corner. Hover a dot to find the
    country in every panel. Values as on the map, over the whole period, not as known before each El Niño.</p>
  <div class="sc-grid-wrap" style:grid-template-columns="repeat({columns}, 1fr)" bind:clientWidth={width}>
    {#each panels as p (p.measure)}
      <figure class="sc-panel" class:cur={p.measure === view.measure}>
        <figcaption>{p.label}</figcaption>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <svg width={panelWidth} height={panelHeight} viewBox="0 0 {panelWidth} {panelHeight}" role="img" aria-label="Harvest shortfall against {p.label.toLowerCase()}"
             onpointermove={ev => onpointermove(ev, p)} onpointerleave={() => hovered = null}>
          <rect class="sc-flag" x={p.corner.x} y={p.corner.y} width={Math.max(0, p.corner.width)} height={Math.max(0, p.corner.height)}/>
          {#each [-20, 0, 20, 40] as t}
            <line class="sc-rule" x1={x(t)} x2={x(t)} y1={margin.top} y2={panelHeight - margin.bottom}/>
            <text class="sc-tick" x={x(t)} y={panelHeight - margin.bottom + 13} text-anchor="middle">{t}%</text>
          {/each}
          {#each p.yTicks as t}
            <line class="sc-rule" x1={margin.left} x2={panelWidth - margin.right} y1={p.y(t)} y2={p.y(t)}/>
            <text class="sc-tick" x={margin.left - 5} y={p.y(t) + 3.5} text-anchor="end">{p.spec.short(t)}</text>
          {/each}
          <line class="sc-cut" x1={x(FLAG_AT)} x2={x(FLAG_AT)} y1={margin.top} y2={panelHeight - margin.bottom}/>
          <line class="sc-cut" x1={margin.left} x2={panelWidth - margin.right} y1={p.y(p.cut)} y2={p.y(p.cut)}/>
          {#each p.dots as d (d.id)}<circle class="sc-dot" class:crisis={d.crisis} cx={d.cx} cy={d.cy} r={d.crisis ? 3.4 : 2.4}/>{/each}
          {#each p.dots.filter(d => d.id === hovered) as d (d.id)}
            <circle class="sc-hover" cx={d.cx} cy={d.cy} r="6"/>
            <text class="sc-label" x={d.cx > panelWidth - 90 ? d.cx - 9 : d.cx + 9} y={d.cy - 7} text-anchor={d.cx > panelWidth - 90 ? 'end' : 'start'}>{hoveredName}</text>
          {/each}
        </svg>
      </figure>
    {/each}
  </div>
  <p class="sc-axes">Across: harvest shortfall in El Niño years, % · Up: the measure in each panel’s title</p>
</section>
