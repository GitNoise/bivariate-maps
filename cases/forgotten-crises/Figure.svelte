<!-- The figure: the region buttons, the bivariate map of need against the unfunded share of each country's appeals, and
     the key. -->
<script>
  import {DATA} from './data.js';
  import {NEED_CLASSES, UNFUNDED_FROM, RAISED_CELLS, PERSISTENT_GAP_YEARS, WORLD_NOTES, REGION_GROUPS, REGION_NAMES, REGION_SHORT_NAMES, REGION_ORDER} from './settings.js';
  import {createGeo} from '../../src/bivariate/geo.js';
  import {createRegions} from '../../src/bivariate/regions.js';
  import BivariateMap from '../../src/bivariate/BivariateMap.svelte';
  import RegionButtons from '../../src/bivariate/RegionButtons.svelte';
  import {createLabeller} from '../../src/bivariate/labels.js';
  import Labels from '../../src/bivariate/Labels.svelte';
  import Tooltip from './Tooltip.svelte';

  const geo = createGeo();
  const NAME = Object.fromEntries(geo.shapes.features.map(f => [f.id, f.properties.name]));   // Natural Earth's names

  // the funding class, 0 to 2: the share of the ask unfunded, in thirds
  const fundingClass = funded => 100 - funded >= UNFUNDED_FROM[1] ? 2 : 100 - funded >= UNFUNDED_FROM[0] ? 1 : 0;
  const needClass = r => NEED_CLASSES[r.severityCategory] ?? 0;
  // a crisis INFORM rates High or Very High, with no UN appeal for the country: its need colour (the purple edge) under
  // hatching, since its funding is unknown
  const noAppeal = new Set(Object.keys(DATA.countries).filter(id => needClass(DATA.countries[id]) && DATA.countries[id].requirements == null));
  // a cell for each country with a severity and an appeal, and for the hatched ones; nothing is grey, a country with no
  // crisis listed is bare paper
  const cells = Object.fromEntries(Object.entries(DATA.countries)
    .filter(([id, r]) => r.severity != null && (r.funded != null || noAppeal.has(id)))
    .map(([id, r]) => [id, [needClass(r), noAppeal.has(id) ? 0 : fundingClass(r.funded)]]));
  // the outline, dashed: a persistent gap, funded below each year's share across all country appeals, every year since 2021
  const outlines = {solid: new Set(), dashed: new Set(Object.keys(cells).filter(id => DATA.countries[id].gapYears >= PERSISTENT_GAP_YEARS))};
  const grey = new Set();
  const legend = {
    a: {title: 'Need', ticks: ['3', '4']},   // where INFORM's High and Very High start
    b: {title: 'Unfunded', ticks: [Math.round(UNFUNDED_FROM[0]), Math.round(UNFUNDED_FROM[1]) + '%'].map(String)},   // 33, 67%
    top: 'Severe and unfunded',
    label: 'Legend: colour combines humanitarian need (left edge, purple) and the unfunded share of the appeal (right edge, gold); the raised cells at the top are severe crises with largely unfunded appeals',
  };
  const hasData = Object.keys(cells).length > 0;

  // the zoom regions (settings.js): a region gets a button when it holds two or more coloured or hatched countries, and
  // its frame fits those countries
  const shown = new Set([...Object.keys(cells), ...Object.keys(DATA.countries).filter(id => DATA.countries[id].requirements != null)]);
  const regions = createRegions({include: shown, groups: REGION_GROUPS, names: REGION_NAMES, shortNames: REGION_SHORT_NAMES, order: REGION_ORDER});
  let region = $state('world');

  // the labels (settings.js): the regional notes in the world view; zoomed in, the region's own notes and the names of the
  // raised countries
  const labeller = createLabeller({geo, regionOf: regions.regionOf, notes: WORLD_NOTES});
  const named = new Set(Object.keys(cells).filter(id => RAISED_CELLS.some(([i, j]) => cells[id][0] === i && cells[id][1] === j)));
  const nameOf = id => NAME[id];
</script>

<figure class="fig" aria-label="Map: humanitarian need and unfunded appeals, by country">
  <div class="fig-top"><RegionButtons {regions} bind:region/></div>
  {#if !hasData}<p class="draft">No data yet: run build_data.py with the two source files (see README.md). Every country is grey until then.</p>{/if}
  <BivariateMap {geo} {cells} raisedCells={RAISED_CELLS} {outlines} {legend} regions={regions.members} {region} framed={shown} hatched={noAppeal} {grey}
                label="World map of humanitarian need and unfunded appeals by country" hasTooltip={id => shown.has(id)}>
    {#snippet tooltip(id)}<Tooltip {id} name={NAME[id]}/>{/snippet}
    {#snippet overlay(map)}<Labels {map} {labeller} {region} members={regions.members[region]} {named} {nameOf}/>{/snippet}
  </BivariateMap>
  <figcaption>
    <p class="keyline keysym"><span><i class="fiswatch minor"></i>Persistent gap: funded below the year’s average every year since {2026 - PERSISTENT_GAP_YEARS}</span><span><i class="hatchswatch paper"></i>Severe crisis without a UN country appeal (refugees covered by regional plans, appeals that stopped, or none possible): colour shows need only</span></p>
    <p class="keyline keydefs"><span><b>Need:</b>&nbsp;INFORM Severity category, January 2025 (High above 3, Very High above 4 on its 1–5 index)</span><span><b>Unfunded:</b>&nbsp;% of the country’s {DATA.year ?? ''} UN appeals not funded, in thirds: under 33%, 33–67%, 67% or more; across all of them, {Math.round(100 - (DATA.fundedOverall ?? 0))}%</span></p>
    <p class="source">Sources: OCHA, Global Humanitarian Overview 2025 (December 2025 figures) and Financial Tracking Service; INFORM Severity (European Commission JRC).</p>
  </figcaption>
</figure>
