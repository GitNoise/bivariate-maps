<!-- The figure: the controls (the measure dropdown and the region buttons), the map, the score line and the key. -->
<script>
  import {onMount} from 'svelte';
  import {MEASURE_DISPLAY, ZOOM_REGION_SHORT_NAME} from './settings.js';
  import {MEASURE_DATA} from './measures.js';
  import {ZOOM_REGIONS, REGION_TITLE} from './classes.js';
  import {PHONE_QUERY, IS_PHONE_LAYOUT} from './map.js';
  import {sizeWash} from './watercolour.js';
  import {zoomTo} from './zoom.js';
  import Map from './Map.svelte';
  import ScoreLine from './ScoreLine.svelte';
  import {view, layout, els} from './state.svelte.js';

  // the figure has no visible title; its accessible name follows the selected region
  const figureLabel = $derived('Map: El Niño harvest shortfall and cereal import dependence, '
    + (view.region === 'world' ? 'by country' : REGION_TITLE[view.region]));

  // fit the wash and the legend to the map's width, and frame the region
  function refit(region){
    sizeWash();
    layout.width = els.mapbox.clientWidth;
    zoomTo(region);
  }
  onMount(() => refit('world'));   // start on the world view

  // on resize: refit. Crossing the phone breakpoint reloads, because the map's frame is set at load
  let resizeTimer;
  function onresize(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if(window.matchMedia(PHONE_QUERY).matches !== IS_PHONE_LAYOUT) location.reload();
      else refit(view.region);
    }, 150);
  }
</script>

<svelte:window {onresize}/>

<figure class="fig" aria-label={figureLabel}>
  <div class="fig-top">
    <div class="seg axisseg" id="axisseg" role="group" aria-label="Compare the harvest shortfall with another measure">
      <select id="axissel" aria-label="Theory to test" bind:value={view.measure}>
        {#each Object.keys(MEASURE_DATA) as measure}<option value={measure}>Shortfall + {MEASURE_DATA[measure].label.toLowerCase()}</option>{/each}
      </select>
    </div>
    <!-- the regions: short button labels, with the full name as the tooltip -->
    <div class="seg" id="zoomseg" role="group" aria-label="Zoom to region">
      <button aria-pressed={view.region === 'world'} onclick={() => zoomTo('world')}>World</button>
      {#each ZOOM_REGIONS as zone}
        <button aria-pressed={view.region === zone} title={REGION_TITLE[zone]} onclick={() => zoomTo(zone)}>{ZOOM_REGION_SHORT_NAME[zone] || REGION_TITLE[zone]}</button>
      {/each}
    </div>
  </div>
  <div class="fig-body">
    <Map/>
    <div class="score" id="score" aria-live="polite"><ScoreLine/></div>
  </div>
  <figcaption>
    <p class="keyline keysym"><span><i class="fiswatch"></i>National food crisis (10%+ in IPC Crisis or worse)</span><span><i class="fiswatch minor"></i>Smaller crisis (5–10%) or UN appeal</span><span><i class="hatchswatch"></i>Shortfall may be chance</span><span><i class="nodataswatch"></i>Too little data</span></p>
    <p class="keyline keydefs"><span id="axisdef">{@html MEASURE_DISPLAY[view.measure].definition}</span><span><b>Shortfall:</b>&nbsp;% smaller harvests in El Niño vs neutral years, 1980–2024</span></p>
    <p class="source">Sources: FAO, via Our World in Data; NOAA.</p>
  </figcaption>
</figure>
