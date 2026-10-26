<!-- The figure: the controls (the measure dropdown and the region buttons), the bivariate map with its tooltip and labels,
     the score line and the key. -->
<script>
  import {DATA} from './data.js';
  import {MEASURE_DISPLAY, SHORTFALL_THRESHOLDS, WORLD_NOTES, CLUSTER_KM} from './settings.js';
  import {MEASURE_DATA} from './measures.js';
  import {cellsFor, namedFor, shortName, NAMED_CELLS, WEAK_SHORTFALL, CRISIS_OUTLINES, SMALL_WITH_DATA, FRAMED, REGIONS} from './classes.js';
  import {geo} from './map.js';
  import BivariateMap from './bivariate/BivariateMap.svelte';
  import RegionButtons from './bivariate/RegionButtons.svelte';
  import {createLabeller} from './bivariate/labels.js';
  import Labels from './bivariate/Labels.svelte';
  import Tooltip from './Tooltip.svelte';
  import ScoreLine from './ScoreLine.svelte';
  import {view} from './state.svelte.js';

  // the figure has no visible title; its accessible name follows the selected region
  const figureLabel = $derived('Map: El Niño harvest shortfall and cereal import dependence, '
    + (view.region === 'world' ? 'by country' : REGIONS.title[view.region]));

  // the world view's notes describe the clusters of national food crises
  const labeller = createLabeller({geo, clusterIds: CRISIS_OUTLINES.solid, regionOf: REGIONS.regionOf, notes: WORLD_NOTES, clusterKm: CLUSTER_KM});
  const nameOf = id => shortName(DATA.countries[id]);

  const legend = $derived({
    a: {title: 'Shortfall', ticks: [String(SHORTFALL_THRESHOLDS[0]), SHORTFALL_THRESHOLDS[1] + '%']},
    b: {title: MEASURE_DATA[view.measure].axis, ticks: MEASURE_DATA[view.measure].ticks},
    top: 'Highest-risk countries',
    label: 'Legend: colour combines the El Niño harvest shortfall (left edge, purple) and the selected measure (right edge, gold); the raised cells at the top are the highest-risk countries',
  });
</script>

<figure class="fig" aria-label={figureLabel}>
  <div class="fig-top">
    <div class="seg axisseg" id="axisseg" role="group" aria-label="Compare the harvest shortfall with another measure">
      <select id="axissel" aria-label="Theory to test" bind:value={view.measure}>
        {#each Object.keys(MEASURE_DATA) as measure}<option value={measure}>Shortfall + {MEASURE_DATA[measure].label.toLowerCase()}</option>{/each}
      </select>
    </div>
    <RegionButtons regions={REGIONS} bind:region={view.region}/>
  </div>
  <div class="fig-body">
    <BivariateMap {geo} cells={cellsFor(view.measure)} raisedCells={NAMED_CELLS} hatched={WEAK_SHORTFALL} outlines={CRISIS_OUTLINES}
                  small={SMALL_WITH_DATA} regions={REGIONS.members} region={view.region} framed={FRAMED} {legend}
                  label="World map of El Niño harvest risk and cereal import dependency by country" hasTooltip={id => !!DATA.countries[id] && !!(cellsFor(view.measure)[id] || CRISIS_OUTLINES.solid.has(id))}>
      {#snippet tooltip(id)}<Tooltip {id}/>{/snippet}
      {#snippet overlay(map)}<Labels {map} {labeller} region={view.region} members={REGIONS.members[view.region]} named={namedFor(view.measure)} {nameOf}/>{/snippet}
    </BivariateMap>
    <div class="score" id="score" aria-live="polite"><ScoreLine/></div>
  </div>
  <figcaption>
    <p class="keyline keysym"><span><i class="fiswatch"></i>National food crisis (10%+ in IPC Crisis or worse)</span><span><i class="fiswatch minor"></i>Smaller crisis (5–10%) or UN appeal</span><span><i class="hatchswatch"></i>Shortfall may be chance</span><span><i class="nodataswatch"></i>Too little data</span></p>
    <p class="keyline keydefs"><span id="axisdef">{@html MEASURE_DISPLAY[view.measure].definition}</span><span><b>Shortfall:</b>&nbsp;% smaller harvests in El Niño vs neutral years, 1980–2024</span></p>
    <p class="source">Sources: FAO, via Our World in Data; NOAA.</p>
  </figcaption>
</figure>
