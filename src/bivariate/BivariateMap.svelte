<!-- A bivariate world map. Each country is coloured by its cell in a 3 × 3 grid, drawn as a diamond legend: i, the class
     on the first axis (to the left edge), and j, on the second (to the right edge). The washes are watercolour, on a canvas;
     over it the SVG carries the hover shapes, small-country dots, hatching, pencil borders and outlines, all in one layer that
     zooms between regions. The legend, the tooltip and an optional overlay (labels) sit in the same box.

     geo          from createGeo()
     cells        {id: [i, j]}; a country without a cell is grey (no data), or bare paper where `grey` leaves it out
     grey         ids without a cell painted grey (default: all of them)
     raisedCells  cells whose countries are raised off the page with a shadow, and lifted in the legend
     hatched      ids hatched (a weak signal, say)
     outlines     {solid, dashed}: ids, one dark outline around each group of touching countries
     small        ids that also get a dot in the world view, so they stay visible (default: SMALL_COUNTRIES, world.js)
     regions      {key: ids}: the views to zoom to (createRegions().members, regions.js); region: the view on screen, 'world'
                  or a key (RegionButtons.svelte switches it)
     framed       ids a region's frame fits (default: all its members)
     legend       {a: {title, ticks}, b: {title, ticks}, top, label}: the legend's text
     watercolour  the brush settings (default: BRUSH, brush.js)
     label        the map's accessible name
     hasTooltip   id => whether the country has a tooltip (default: a cell or a solid outline); only in the view on screen
     tooltip      snippet(id): the tooltip's content
     overlay      snippet(map): drawn last, inside the SVG; map: {zoom, unitsPerPx(), legendBox(u, pad), pxWidth()}

     Colours come from the CSS custom properties --bi{j}{i}, --land, --nodata, --nodatadeep and --bg. -->
<script>
  import {untrack} from 'svelte';
  import {timer, interpolate, easeCubicInOut, zoomIdentity} from 'd3';
  import {cssVar, cellColour, luminance} from './colour.js';
  import {PHONE_QUERY} from './geo.js';
  import {SMALL_COUNTRIES} from './world.js';
  import {BRUSH} from './brush.js';
  import {createWash, LIFT} from './wash.js';
  import Legend from './Legend.svelte';

  let {geo, cells, raisedCells = [], hatched = new Set(), outlines = {solid: new Set(), dashed: new Set()}, small = SMALL_COUNTRIES,
       regions = {}, region = 'world', framed = null, grey = null, legend, watercolour = BRUSH, label,
       hasTooltip = id => !!(cells[id] || outlines.solid.has(id)), tooltip, overlay} = $props();

  // ---- what each country shows ------------------------------------------------------------------------------
  const inRegion = id => region === 'world' || regions[region].has(id);
  const fillOf = id => cells[id] ? cellColour(...cells[id]) : null;
  const isLowest = id => !!cells[id] && cells[id][0] === 0 && cells[id][1] === 0;
  const isRaised = id => !!cells[id] && raisedCells.some(([i, j]) => cells[id][0] === i && cells[id][1] === j);
  const isGrey = id => !cells[id] && (!grey || grey.has(id));
  const showsTooltip = id => hasTooltip(id) && inRegion(id);
  // hatching: pencil-grey lines, or light lines over dark fills where grey disappears
  const hatchOf = id => cells[id] && luminance(cellColour(...cells[id])) < 0.2 ? 'url(#hatchL)' : 'url(#hatch)';

  // the shapes, the dots and the brush are made once: geo, small and watercolour are fixed for the map's life
  const {shapes, dots, wash} = untrack(() => ({
    shapes: geo.shapes.features.map(f => ({f, id: f.id, d: geo.path(f)})),
    dots: geo.shapes.features.filter(f => small.has(f.id) && geo.path.area(f) < 60).map(f => ({f, id: f.id, c: geo.path.centroid(f)})),
    wash: createWash(geo, watercolour),
  }));

  // the outlines for the view on screen, in it and outside it (dimmed): {solid: [in, out], dashed: [in, out]}. Along the
  // coasts, except around archipelagos: one envelope, about 5 pixels clear of their islands at the view's zoom
  const outlineCache = {};
  function outlinesFor(key){
    if(!outlineCache[key]){
      const inView = id => key === 'world' || regions[key].has(id);
      const pad = 5 / (key === 'world' ? geo.frameOf(null) : geo.frameOf(regions[key], framed, null)).k;
      const drawn = keep => [geo.outline(id => keep(id) && !geo.isArchipelago(id)), geo.envelopes(keep, pad)].filter(Boolean).join('') || null;
      const split = ids => [drawn(id => ids.has(id) && inView(id)), drawn(id => ids.has(id) && !inView(id))];
      // each outlined archipelago's envelope also takes the hover, so the sea between its islands shows its tooltip
      const hulls = [...new Set([...outlines.solid, ...outlines.dashed])].filter(geo.isArchipelago)
        .map(id => ({id, d: geo.envelopes(other => other === id, pad)})).filter(h => h.d);
      outlineCache[key] = {solid: split(outlines.solid), dashed: split(outlines.dashed), hulls};
    }
    return outlineCache[key];
  }
  const borders = $derived(outlinesFor(region));

  // the raised countries of the view, lifted LIFT screen pixels with their washes (wash.js): their hatching, edges and outlines
  // are drawn lifted, and the flat layers are masked where a raised country was and now sits, so no line shows twice
  const raisedHere = $derived(new Set(shapes.map(s => geo.idOf(s.f)).filter(id => id && isRaised(id) && inRegion(id))));
  const raisedShapes = $derived(shapes.filter(s => raisedHere.has(geo.idOf(s.f))));
  const raisedArea = $derived(geo.outline(id => raisedHere.has(id)));
  // their outlines, one around each group of touching ones, as the flat outlines are drawn
  const raisedOutlines = $derived({solid: geo.outline(id => raisedHere.has(id) && outlines.solid.has(id)),
                                   dashed: geo.outline(id => raisedHere.has(id) && outlines.dashed.has(id))});
  const liftY = $derived(-LIFT * geo.width / Math.max(300, pxWidth || 1) / zoom.current.k);

  // ---- the box and the legend ------------------------------------------------------------------------------
  let mapbox, svg, canvas, legendEl = $state(), pxWidth = $state(0);
  const legendOnMap = () => getComputedStyle(legendEl).position === 'absolute';
  const unitsPerPx = () => geo.width / Math.max(300, mapbox.clientWidth);   // viewBox units per screen pixel
  // the legend's box in viewBox units, padded, or null when it is not on the map: overlays keep clear of it
  function legendBox(u, pad){
    if(!legendOnMap()) return null;
    const kr = legendEl.getBoundingClientRect();
    if(!(kr.width > 0)) return null;
    const mr = svg.getBoundingClientRect();
    return [(kr.left - mr.left) * u - pad, (kr.top - mr.top) * u - pad, (kr.right - mr.left) * u + pad, (kr.bottom - mr.top) * u + pad];
  }
  // the zoom transform that frames a view; roomForLegend: false ignores where the legend sits
  function frameOf(key, roomForLegend = true){
    if(key === 'world') return geo.frameOf(null);
    const room = roomForLegend && legendOnMap()
      ? {w: legendEl.offsetWidth / Math.max(1, mapbox.clientWidth) * geo.width, h: legendEl.offsetHeight / Math.max(1, mapbox.clientHeight) * geo.height}
      : null;
    return geo.frameOf(regions[key], framed, room);
  }

  // ---- the washes -------------------------------------------------------------------------------------------
  const look = () => ({fillOf, isGrey, isLowest, isRaised, inRegion, region, members: regions[region]});
  // brushed once per map width, at the deepest regional zoom (wherever the legend sits); zooming only scales them.
  // Only the current width is kept
  let washCache = {};
  function washesForWidth(){
    const id = Math.round(mapbox.clientWidth);
    if(!washCache[id]){
      const deepestZoom = Math.max(1, ...Object.keys(regions).map(key => frameOf(key, false).k));
      washCache = {[id]: wash.build(deepestZoom, mapbox.clientWidth)};
    }
    return washCache[id];
  }

  // ---- zooming ----------------------------------------------------------------------------------------------
  // the transform on screen (every frame while zooming), the one it settles on, the target's scale, and whether it is
  // moving (from the start until the first zoom settles). Over 650 ms, at once with reduced motion
  const zoom = $state({current: zoomIdentity, settled: zoomIdentity, scale: 1, moving: true});
  let running = null;   // the zoom under way: {timer, t, washes}
  function zoomTo(key){
    const t = frameOf(key);
    zoom.scale = t.k;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(running){ running.timer.stop(); settle(running.t, running.washes); }   // an interrupted zoom ends at once
    const washes = washesForWidth(), from = zoom.settled, duration = reduceMotion ? 0 : 650;
    const between = interpolate([from.x, from.y, from.k], [t.x, t.y, t.k]);
    zoom.moving = true;
    const tick = timer(elapsed => {
      if(elapsed >= duration){ tick.stop(); running = null; settle(t, washes); return; }
      const [x, y, k] = between(easeCubicInOut(elapsed / duration)), frame = zoomIdentity.translate(x, y).scale(k);
      zoom.current = frame;
      wash.draw(frame, washes, look(), false);
    });
    running = {timer: tick, t, washes};
  }
  function settle(t, washes){
    zoom.current = zoom.settled = t;
    zoom.moving = false;
    wash.draw(t, washes, look());
  }

  // fit the wash and the legend to the map's width, then frame the view: at the start, on resize, and when the view changes
  function refit(){
    wash.size(svg);
    pxWidth = mapbox.clientWidth;
  }
  let fitted = false;
  $effect(() => {
    const key = region;
    untrack(() => {
      if(!fitted){ wash.attach(canvas); refit(); fitted = true; }
      zoomTo(key);
    });
  });
  // new data repaints the washes (which countries are raised depends on it)
  let painted = untrack(() => cells);   // the cells painted at the start
  $effect(() => {
    if(cells === painted) return;
    painted = cells;
    untrack(() => { wash.clearRaised(); wash.draw(zoom.settled, washesForWidth(), look()); });
  });
  // on resize: refit. Crossing the phone breakpoint reloads, because the map's frame is set at load
  let resizeTimer;
  function onresize(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if(window.matchMedia(PHONE_QUERY).matches !== geo.isPhone) location.reload();
      else { refit(); zoomTo(region); }
    }, 150);
  }

  // ---- the tooltip ------------------------------------------------------------------------------------------
  // the country it shows, where (pixels within the map), and whether it is visible; beside the pointer, flipped to the left
  // near the right edge. A change of data or view can take it away
  const tip = $state({id: null, x: 0, y: 0, shown: false});
  const tipVisible = $derived(tip.shown && showsTooltip(tip.id));
  function showTip(ev, id){
    if(!showsTooltip(id)){ tip.shown = false; return; }
    const box = mapbox.getBoundingClientRect();
    let x = ev.clientX - box.left + 14;
    const y = ev.clientY - box.top + 14;
    if(x + 300 > box.width) x = ev.clientX - box.left - 304;
    Object.assign(tip, {id, x, y, shown: true});
  }
  const hideTip = () => { tip.shown = false; };
  // the hovered country, traced whole (all its islands; Somaliland with Somalia), or its envelope for an outlined archipelago
  const traceCache = {};
  const traceOf = id => borders.hulls.find(h => h.id === id)?.d ?? (traceCache[id] ??= geo.outline(other => other === id));
  const hovered = $derived(tipVisible ? traceOf(tip.id) : null);

  const overlayApi = {zoom, unitsPerPx, legendBox, pxWidth: () => mapbox.clientWidth};
  // the hatch stays a fine, constant texture on screen at every zoom level
  const hatchTransform = $derived(`rotate(45) scale(${(1 / Math.max(1, zoom.scale)).toFixed(4)})`);
</script>

<svelte:window {onresize}/>

<div class="mapbox" class:world-view={region === 'world'} id="mapbox" bind:this={mapbox}>
  <div class="tip" id="tip" style:left="{tip.x}px" style:top="{tip.y}px" style:opacity={tipVisible ? 1 : 0}>
    {#if tip.id && tooltip}{@render tooltip(tip.id)}{/if}
  </div>
  <Legend spec={legend} {raisedCells} {watercolour} mapWidth={pxWidth} bind:el={legendEl}/>
  <canvas class="wc" aria-hidden="true" bind:this={canvas}></canvas>
  <svg bind:this={svg} viewBox="0 0 {geo.width} {geo.height}" role="img" aria-label={label}>
    <g transform={zoom.current.toString()}>
      <!-- the shapes are transparent (the wash shows through); outside the selected region they are dimmed. Hovering shows the
           tooltip, which repeats figures given elsewhere on the page, so the shapes have no keyboard role -->
      <g>
        <!-- the envelopes first, so the islands and any neighbour inside one keep their own hover -->
        {#each borders.hulls as h (h.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <path d={h.d} class="hull-hit" style:fill="transparent" onpointermove={ev => showTip(ev, h.id)} onpointerleave={hideTip}/>
        {/each}
        {#each shapes as s}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <path d={s.d} class="country" class:hit={fillOf(s.id) && inRegion(s.id)} class:dim={!inRegion(s.id)} style:fill="transparent"
                onpointermove={ev => showTip(ev, s.id)} onpointerleave={hideTip}/>
        {/each}
      </g>
      <!-- small-country dots are for the world view only; zoomed in, the country itself is visible -->
      <g>
        {#if region === 'world'}{#each dots as s}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <circle cx={s.c[0]} cy={s.c[1]} r={3.2 / zoom.scale} class="country smallmark" class:fi={outlines.solid.has(s.id)}
                  style:fill={fillOf(s.id) || cssVar(isGrey(s.id) ? '--land' : '--bg')}
                  style:fill-opacity={isLowest(s.id) ? watercolour.low : 1} style:stroke-dasharray={hatched.has(s.id) ? '1.5 1.5' : null}
                  onpointermove={ev => showTip(ev, s.id)} onpointerleave={hideTip}/>
        {/each}{/if}
      </g>
      <g style:pointer-events="none" mask="url(#flat)">
        {#each shapes as s}
          {#if hatched.has(s.id)}<path d={s.d} fill={hatchOf(s.id)} class:dim={!inRegion(s.id)}/>{/if}
        {/each}
      </g>
      <!-- pencil borders: a tad stronger inside the selected region, a tad lighter outside it; then one dark outline around
           each group of outlined countries, dashed ones first (so a border shared with a solid one is drawn solid), dimmed
           outside the selected region -->
      <g style:pointer-events="none">
        <g mask="url(#flat)">
          {#each shapes as s}
            {#if !raisedHere.has(geo.idOf(s.f))}
              <path d={s.d} class="ink" class:fi={outlines.solid.has(s.id)} class:dim={!inRegion(geo.idOf(s.f))}
                    class:inreg={region !== 'world' && inRegion(geo.idOf(s.f))}/>
            {/if}
          {/each}
          <path class="fi-outline minor dim" d={borders.dashed[1]}/>
          <path class="fi-outline minor" d={borders.dashed[0]}/>
          <path class="fi-outline dim" d={borders.solid[1]}/>
          <path class="fi-outline" d={borders.solid[0]}/>
        </g>
        <!-- the raised countries, lifted with their washes: hatching, a thin dark edge so each reads sharp off the paper,
             and their outlines -->
        <g transform="translate(0,{liftY.toFixed(3)})">
          {#each raisedShapes as s}{#if hatched.has(s.id)}<path d={s.d} fill={hatchOf(s.id)}/>{/if}{/each}
          <!-- the edge, except where a dashed outline marks the country: its gaps must read as gaps -->
          {#each raisedShapes as s}{#if !outlines.dashed.has(geo.idOf(s.f))}<path class="raised-edge" d={s.d}/>{/if}{/each}
          {#if raisedOutlines.dashed}<path class="fi-outline minor" d={raisedOutlines.dashed}/>{/if}
          {#if raisedOutlines.solid}<path class="fi-outline" d={raisedOutlines.solid}/>{/if}
        </g>
        {#if hovered}<path class="hover-halo" d={hovered}/><path class="hover-line" d={hovered}/>{/if}
      </g>
    </g>
    <defs>
      <!-- the flat layers' mask: everything but the raised countries' area where it was and where it is lifted to, with a
           little margin so no edge of an old line shows -->
      <mask id="flat" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000">
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="white"/>
        {#if raisedArea}
          {#each [0, 0.5, 1] as f}
            <path d={raisedArea} transform="translate(0,{(liftY * f).toFixed(3)})" fill="black" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/>
          {/each}
        {/if}
      </mask>
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform={hatchTransform}><rect width="0.9" height="5" class="hatchline"/></pattern>
      <pattern id="hatchL" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform={hatchTransform}><rect width="1.1" height="5" class="hatchline-l"/></pattern>
      <!-- an arrowhead for the overlay's arrows -->
      <marker id="swoopHead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse" markerUnits="strokeWidth">
        <path d="M0,1 L9,5 L0,9 z" class="swoop-head"/>
      </marker>
    </defs>
    {#if overlay}{@render overlay(overlayApi)}{/if}
  </svg>
</div>
