<!-- Text on the map (placed by labels.js): notes on the clusters in the world view, the names of the named countries
     when zoomed in. Hidden while the map zooms; placed again, and faded in, once it settles. Drawn as the bivariate map's
     overlay. -->
<script>
  import {untrack} from 'svelte';
  import {Tween} from 'svelte/motion';

  // map: the bivariate map's overlay API (its zoom, width and legend box); labeller: from createLabeller(); region: the
  // view on screen; members: its ids; named: the ids named when zoomed in (a new set places the labels again); nameOf(id)
  let {map, labeller, region, members, named, nameOf} = $props();
  let layer, placed = $state.raw(null);
  const opacity = new Tween(0, {duration: 220});
  $effect(() => {
    const t = map.zoom.settled, moving = map.zoom.moving;
    const ids = named, view = {region, members, isNamed: id => ids.has(id), nameOf};   // placed again when either changes
    untrack(() => {
      opacity.set(0, {duration: 0});
      placed = moving ? null : labeller.placeLabels(layer, t, map, view);
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
