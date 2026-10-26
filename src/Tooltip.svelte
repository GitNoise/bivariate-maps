<!-- The tooltip's content: a country's figures for both axes of the map, its crises, and two sparklines: its harvests
     against a normal year, and the selected measure over time where the data has a series. The map places it. -->
<script>
  import {DATA, NATIONAL_CRISES, SMALLER_CRISES} from './data.js';
  import {HARVEST_RANGE, MEASURE_DISPLAY} from './settings.js';
  import {MEASURE_DATA} from './measures.js';
  import {isWeakSignal, shortName} from './classes.js';
  import Sparkline, {pointsOf} from './Sparkline.svelte';
  import {view} from './state.svelte.js';

  let {id} = $props();
  const r = $derived(DATA.countries[id]);
  const spec = $derived(MEASURE_DISPLAY[view.measure]);
  const shortfall = $derived(r && Math.round(r.harvestShortfall));
  // the selected measure's value and yearly series for the country (series: null where the data has none)
  const value = $derived(r && (view.measure === 'imports' ? r.importShare : MEASURE_DATA[view.measure].values[id]));
  const series = $derived(r && (view.measure === 'imports' ? r.importShareByYear : MEASURE_DATA[view.measure].series?.[id] ?? null));
  const enYears = $derived(r?.elNinoHarvestYears || []);
  // each year's harvest against a normal year: the country's long-term (LOWESS) trend
  const harvestSpark = $derived(!!r?.harvestVsTrendByYear && pointsOf(r.harvestVsTrendByYear).length > 0);
  const measureSpark = $derived(!!series && pointsOf(series, spec.log).length > 0);
  const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) + '%';
</script>

{#if r}
  <b>{shortName(r)}</b>
  <div class="tr"><span>El Niño harvest</span><b>{#if r.harvestShortfall == null}not tested{:else if shortfall > 0}{shortfall}% smaller{#if isWeakSignal(r)}{' '}<i>weak signal</i>{/if}{:else}no shortfall{/if}</b></div>
  <div class="tr"><span>{MEASURE_DATA[view.measure].label}</span><b>{value == null ? 'no data' : spec.format(value)}</b></div>
  {#if NATIONAL_CRISES[id]}<div class="tr"><span>Crisis</span><b>{NATIONAL_CRISES[id].join(', ')}</b></div>
  {:else if SMALLER_CRISES[id]}<div class="tr"><span>Smaller crisis</span><b>{SMALLER_CRISES[id].join(', ')}</b></div>{/if}
  {#if harvestSpark}<Sparkline values={r.harvestVsTrendByYear} label="Harvest vs normal year" cls="sp-hit" domain={HARVEST_RANGE} {enYears} valueText={signed}/>{/if}
  {#if measureSpark}<Sparkline values={series} label={spec.series} cls="sp-measure" domain={spec.range} log={spec.log} {enYears} valueText={spec.short}/>{/if}
  {#if (harvestSpark || measureSpark) && enYears.length}<div class="sp-key"><span><i></i>El Niño years</span></div>{/if}
{/if}
