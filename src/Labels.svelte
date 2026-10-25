<!-- Text on the map (placed by labels.js): notes on the crisis clusters in the world view, the names of the highest-risk
     countries when zoomed in. Hidden while the map zooms; placed again, and faded in, once it settles. -->
<script>
  import {untrack} from 'svelte';
  import {Tween} from 'svelte/motion';
  import {placeLabels} from './labels.js';
  import {view, zoom} from './state.svelte.js';

  let layer, placed = $state.raw(null);
  const opacity = new Tween(0, {duration: 220});
  $effect(() => {
    const t = zoom.settled, moving = zoom.moving;
    view.region; view.measure;   // which countries are named depends on both
    untrack(() => {
      opacity.set(0, {duration: 0});
      placed = moving ? null : placeLabels(layer, t);
      if(placed) opacity.set(1);
    });
  });
</script>

<g class="callouts" bind:this={layer} style:opacity={opacity.current}>
  {#if placed}
    {#each placed.swoops as s (s.id)}<path class="swoop" d={s.d} marker-end="url(#swoopHead)" style:stroke-width={s.width}/>{/each}
    {#each placed.notes as note}
      <g class="wnote" transform={note.transform}>
        {#each note.lines as line}<text x={line.x} y={line.y} class={line.cls} style:font-size={line.size}>{line.text}</text>{/each}
      </g>
    {/each}
    {#each placed.callouts as c (c.id)}
      <g class="callout" transform={c.transform}><text class="ml-name" y={c.y} style:font-size={c.size} text-anchor="middle">{c.name}</text></g>
    {/each}
  {/if}
</g>
