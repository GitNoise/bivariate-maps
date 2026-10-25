<!-- The map: the watercolour wash on a canvas, and over it the SVG: country shapes (for hover), small-country dots,
     hatching for a weak harvest signal, pencil borders and crisis outlines, all in one layer that zooms; then the labels.
     The legend and the tooltip sit in the same box. -->
<script>
  import {onMount, untrack} from 'svelte';
  import {DATA, NATIONAL_CRISES} from './data.js';
  import {WATERCOLOUR} from './settings.js';
  import {cssVar, fillOf, isLowestClass, showsWeakShortfall, inSelectedRegion} from './classes.js';
  import {MAP_WIDTH, MAP_HEIGHT, countryShapes, toSvgPath, countryIdOf, smallCountryShapes, hatchOf, crisisBorders, hasTooltip} from './map.js';
  import {attachWash, repaintWashes} from './watercolour.js';
  import Labels from './Labels.svelte';
  import Legend from './Legend.svelte';
  import Tooltip from './Tooltip.svelte';
  import {view, zoom, tip, els} from './state.svelte.js';

  const shapes = countryShapes.features.map(f => ({f, id: f.id, d: toSvgPath(f)}));   // the projection never changes
  const dots = smallCountryShapes.map(f => ({f, id: f.id, c: toSvgPath.centroid(f)}));
  const borders = $derived(crisisBorders(view.region));
  // the hatch stays a fine, constant texture on screen at every zoom level
  const hatchTransform = $derived(`rotate(45) scale(${(1 / Math.max(1, zoom.scale)).toFixed(4)})`);

  let canvas;
  onMount(() => attachWash(canvas));
  // a change of measure repaints the wash (a change of region repaints it as the map zooms)
  let measurePainted = view.measure;
  $effect(() => {
    if(view.measure === measurePainted) return;
    measurePainted = view.measure;
    untrack(repaintWashes);
  });

  // the tooltip, for countries with a colour or a crisis border in the selected region, beside the pointer
  function showTooltip(ev, id){
    if(!hasTooltip(id)){ tip.shown = false; return; }
    const box = els.mapbox.getBoundingClientRect();
    let x = ev.clientX - box.left + 14;
    const y = ev.clientY - box.top + 14;
    if(x + 300 > box.width) x = ev.clientX - box.left - 304;   // flip to the left near the right edge
    Object.assign(tip, {id, x, y, shown: true});
  }
  const hideTooltip = () => { tip.shown = false; };
</script>

<div class="mapbox" class:world-view={view.region === 'world'} id="mapbox" bind:this={els.mapbox}>
  <Tooltip/>
  <Legend/>
  <canvas class="wc" aria-hidden="true" bind:this={canvas}></canvas>
  <svg bind:this={els.svg} viewBox="0 0 {MAP_WIDTH} {MAP_HEIGHT}" role="img" aria-label="World map of El Niño harvest risk and cereal import dependency by country">
    <g transform={zoom.current.toString()}>
      <!-- the shapes are transparent (the wash shows through); outside the selected region they are dimmed. Hovering shows the
           tooltip, which repeats figures given elsewhere on the page, so the shapes have no keyboard role -->
      <g>
        {#each shapes as s}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <path d={s.d} class="country" class:hit={fillOf(s.id) && inSelectedRegion(s.id)} class:dim={!inSelectedRegion(s.id)} style:fill="transparent"
                onpointermove={ev => showTooltip(ev, s.id)} onpointerleave={hideTooltip}/>
        {/each}
      </g>
      <!-- small-country dots are for the world view only; zoomed in, the country itself is visible (and has its label or arrow) -->
      <g>
        {#if view.region === 'world'}{#each dots as s}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <circle cx={s.c[0]} cy={s.c[1]} r={3.2 / zoom.scale} class="country smallmark" class:fi={!!NATIONAL_CRISES[s.id]}
                  style:fill={fillOf(s.id) || cssVar('--land')}
                  style:fill-opacity={isLowestClass(DATA.countries[s.id]) ? WATERCOLOUR.low : 1} style:stroke-dasharray={showsWeakShortfall(s.id) ? '1.5 1.5' : null}
                  onpointermove={ev => showTooltip(ev, s.id)} onpointerleave={hideTooltip}/>
        {/each}{/if}
      </g>
      <!-- hatching for a weak harvest signal -->
      <g style:pointer-events="none">
        {#each shapes as s}
          {#if showsWeakShortfall(s.id)}<path d={s.d} fill={hatchOf(s.id)} class:dim={!inSelectedRegion(s.id)}/>{/if}
        {/each}
      </g>
      <!-- pencil borders: a tad stronger inside the selected region, a tad lighter outside it (Somaliland counts as Somalia);
           then one dark outline around each group of crisis countries, dashed for smaller crises (drawn first, so a border
           shared with a solid country is drawn solid) and dimmed outside the selected region -->
      <g style:pointer-events="none">
        {#each shapes as s}
          <path d={s.d} class="ink" class:fi={!!NATIONAL_CRISES[s.id]} class:dim={!inSelectedRegion(countryIdOf(s.f))}
                class:inreg={view.region !== 'world' && inSelectedRegion(countryIdOf(s.f))}/>
        {/each}
        <path class="fi-outline minor dim" d={borders.smaller[1]}/>
        <path class="fi-outline minor" d={borders.smaller[0]}/>
        <path class="fi-outline dim" d={borders.national[1]}/>
        <path class="fi-outline" d={borders.national[0]}/>
      </g>
    </g>
    <defs>
      <!-- hatching: pencil-grey lines, or light lines over dark fills (brown, mauve, purple) where grey disappears -->
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform={hatchTransform}><rect width="0.9" height="5" class="hatchline"/></pattern>
      <pattern id="hatchL" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform={hatchTransform}><rect width="1.1" height="5" class="hatchline-l"/></pattern>
      <marker id="swoopHead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse" markerUnits="strokeWidth">
        <path d="M0,1 L9,5 L0,9 z" class="swoop-head"/>
      </marker>
    </defs>
    <Labels/>
  </svg>
</div>
