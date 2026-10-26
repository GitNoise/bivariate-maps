<!-- The region buttons: World, then each region from createRegions(), short labels with the full name as the tooltip.
     region: the view on screen, bound ('world' or a region's key). -->
<script>
  let {regions, region = $bindable('world')} = $props();
</script>

<div class="seg" id="zoomseg" role="group" aria-label="Zoom to region">
  <button aria-pressed={region === 'world'} onclick={() => region = 'world'}>World</button>
  {#each regions.keys as key}
    <button aria-pressed={region === key} title={regions.title[key]} onclick={() => region = key}>{regions.short[key]}</button>
  {/each}
</div>
