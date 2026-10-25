<!-- A sparkline for a yearly series (values from 1980, null where missing), drawn through the years that have a value.
     The first and last values are marked with a dot and labelled (valueText: how a value reads); when years are missing
     (poverty surveys), every value gets a small dot. domain: the fixed [lo, hi] of the y-axis (log: on a log scale);
     cuts: class limits, drawn as faint dashed lines; enYears: El Niño harvest years, shaded. -->
<script module>
  import {DATA} from './data.js';
  export const SPARK_FROM = 1980, SPARK_TO = DATA.harvestsLastYear;   // both sparklines share one timeline
  // the years with a value, as [year, value]
  export const pointsOf = (values, log) => values.map((v, i) => [SPARK_FROM + i, v]).filter(p => p[1] != null && (!log || p[1] > 0));
</script>

<script>
  import * as d3 from 'd3';
  let {values, label, cls, domain, log = false, cuts = [], enYears, valueText} = $props();

  const w = 236, h = 40, labelRoom = 30;   // room for the end values left and right of the line
  const x = d3.scaleLinear().domain([SPARK_FROM, SPARK_TO]).range([labelRoom, w - labelRoom]);
  const step = x(SPARK_FROM + 1) - x(SPARK_FROM);
  const y = $derived((log ? d3.scaleLog() : d3.scaleLinear()).domain(domain).range([h - 2, 2]).clamp(true));
  const points = $derived(pointsOf(values, log));
  const start = $derived(points[0]), end = $derived(points[points.length - 1]);
  const sparse = $derived(points.length < end[0] - start[0] + 1);   // years missing
  const across = yv => ({x1: x(SPARK_FROM).toFixed(1), x2: x(SPARK_TO).toFixed(1), y1: y(yv).toFixed(1), y2: y(yv).toFixed(1)});
</script>

<div class="sp"><div class="sp-cap"><span>{label}</span><span>{end === start ? `${start[0]}` : `${start[0]}–${end[0]}`}</span></div><svg width={w} height={h} viewBox="0 0 {w} {h}" aria-hidden="true">
  {#each enYears as yr}<rect x={(x(yr) - step / 2).toFixed(1)} y="0" width={step.toFixed(1)} height={h} class="sp-en"/>{/each}
  {#if domain[0] < 0 && domain[1] > 0}<line {...across(0)} class="sp-zero"/>{/if}
  {#each cuts as c}<line {...across(c)} class="sp-cut"/>{/each}
  <path d={d3.line().x(p => x(p[0])).y(p => y(p[1]))(points)} class="sp-line {cls}"/>
  {#if sparse}{#each points as p}<circle cx={x(p[0]).toFixed(1)} cy={y(p[1]).toFixed(1)} r="1.5" class="sp-dot {cls}"/>{/each}{/if}
  <circle cx={x(start[0]).toFixed(1)} cy={y(start[1]).toFixed(1)} r="2.2" class="sp-dot {cls}"/>
  {#if end !== start}<circle cx={x(end[0]).toFixed(1)} cy={y(end[1]).toFixed(1)} r="2.2" class="sp-dot {cls}"/>{/if}
  <!-- end values: the first to the left of the line, the last to the right -->
  {#if end !== start}<text x={(x(start[0]) - 5).toFixed(1)} y={y(start[1]).toFixed(1)} dy="0.35em" text-anchor="end" class="sp-val">{valueText(start[1])}</text>{/if}
  <text x={(x(end[0]) + 5).toFixed(1)} y={y(end[1]).toFixed(1)} dy="0.35em" text-anchor="start" class="sp-val">{valueText(end[1])}</text>
</svg></div>
