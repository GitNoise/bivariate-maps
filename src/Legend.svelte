<!-- The diamond legend in the map's corner: bottom = low on both axes, left edge = shortfall, right edge = the second
     measure, top = highest risk. The NAMED_CELLS (the named countries) lift off the diamond as one piece, with a short,
     sharp shadow. After drawing, long axis titles shrink and the viewBox is cropped to the drawing. -->
<script>
  import {untrack} from 'svelte';
  import {SHORTFALL_THRESHOLDS, WATERCOLOUR} from './settings.js';
  import {MEASURE_DATA} from './measures.js';
  import {cellColour, NAMED_CELLS} from './classes.js';
  import {legendOnMap} from './map.js';
  import {legendCellImage} from './legend.js';
  import {view, layout, els} from './state.svelte.js';

  const d = 13.35, bx = 190, by = 178, n = Math.SQRT1_2;   // cell side ≈ 19px
  // u = shortfall, rising to the upper left; v = the selected measure, rising to the upper right
  const P = (u, v) => [bx + (v - u) * d, by - (u + v) * d];
  const poly = pts => pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  const cellPts = (i, j) => [P(i,j), P(i+1,j), P(i+1,j+1), P(i,j+1)];
  const image = (i, j, cover) => legendCellImage(cellPts(i, j), cellColour(i, j), cover, 101 + i * 7 + j * 31);
  const CELLS = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => [i, j]));
  const outer = poly([P(0,0), P(3,0), P(3,3), P(0,3)]);
  const lift = poly([P(2,1), P(3,1), P(3,3), P(1,3), P(1,2), P(2,2)]);   // the outline of the NAMED_CELLS

  // a text along an edge: at (x, y), rotated by rot degrees
  const label = (x, y, rot, text, cls, anchor = 'middle') =>
    ({x: x.toFixed(1), y: y.toFixed(1), transform: `rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})`, text, cls, anchor});
  const at = (p, dx, dy) => [p[0] + dx * n, p[1] + dy * n];
  // ticks on the lower-left edge (shortfall) and lower-right edge (the second measure), offset outward; the axis titles,
  // centred on each edge so they never run past the diamond's ends; the title on top
  const texts = $derived([
    label(...at(P(1, 0), -10, 10), 45, String(SHORTFALL_THRESHOLDS[0]), 'bl-tk', 'end'),
    label(...at(P(2, 0), -10, 10), 45, SHORTFALL_THRESHOLDS[1] + '%', 'bl-tk', 'end'),
    label(...at(P(0, 1), 10, 10), -45, MEASURE_DATA[view.measure].ticks[0], 'bl-tk', 'start'),
    label(...at(P(0, 2), 10, 10), -45, MEASURE_DATA[view.measure].ticks[1], 'bl-tk', 'start'),
    label(...at(P(1.5, 0), -23, 23), 45, '← Shortfall', 'bl-ax'),
    label(...at(P(0, 1.5), 23, 23), -45, MEASURE_DATA[view.measure].axis + ' →', 'bl-ax'),
    label(P(3, 3)[0], P(3, 3)[1] - 9, 0, 'Highest-risk countries', 'bl-top'),
  ]);

  // fitting: an axis title longer than its edge (54 units) shrinks; then the viewBox is cropped to the drawing, and the
  // legend shrinks on narrower maps, keeping its proportions
  let svg;
  let titleSize = $state({});   // font size by axis title text, for the titles that shrink
  let fontLoads = $state(0);   // text is measured again whenever web fonts finish loading (the bold title's can come late)
  document.fonts?.addEventListener('loadingdone', () => fontLoads++);
  let frame = $state({viewBox: '0 0 380 236', width: 380, height: 236});
  const legendScale = () => {
    const w = layout.width || 1000;
    if(!legendOnMap()) return 1;
    return w > 900 ? 1 : w > 680 ? 0.85 : w > 500 ? 0.72 : 0.6;
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  $effect(() => {
    const titles = texts.filter(t => t.cls === 'bl-ax').map(t => t.text);
    fontLoads;
    untrack(() => {
      const sizes = {};
      titles.forEach(text => {   // its natural length: written, measured, removed
        const e = svg.appendChild(document.createElementNS(SVG_NS, 'text'));
        e.setAttribute('class', 'bl-ax'); e.textContent = text;
        const L = e.getComputedTextLength(), max = 54;
        e.remove();
        if(L > max) sizes[text] = (10.5 * max / L).toFixed(2) + 'px';
      });
      titleSize = sizes;
    });
  });
  $effect(() => {
    titleSize; texts; layout.width;   // after the titles are sized, and when the map's width changes
    untrack(() => {
      // measured on a full-size copy (380 × 236, as first drawn), so the crop does not depend on the previous one
      const copy = svg.cloneNode(true);
      copy.setAttribute('viewBox', '0 0 380 236'); copy.setAttribute('width', 380); copy.setAttribute('height', 236);
      svg.after(copy);
      const bb = copy.getBBox(), p = 3, scale = legendScale();
      copy.remove();
      frame = {viewBox: `${bb.x - p} ${bb.y - p} ${bb.width + 2 * p} ${bb.height + 2 * p}`,
               width: Math.ceil((bb.width + 2 * p) * scale), height: Math.ceil((bb.height + 2 * p) * scale)};
    });
  });
</script>

<div class="key" id="mapkey" bind:this={els.legend}><span class="bilegend"><svg bind:this={svg} viewBox={frame.viewBox} width={frame.width} height={frame.height} role="img" aria-label="Legend: colour combines the El Niño harvest shortfall (left edge, purple) and the selected measure (right edge, gold); the raised cells at the top are the highest-risk countries">
  <defs>
    <clipPath id="legTop3"><polygon points={lift}/></clipPath>
    <!-- the lift's shadow: a soft blur and a sharp one, both offset down -->
    <filter id="blLift" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="b1"/><feOffset in="b1" dx="0" dy="3.3" result="o1"/>
      <feFlood flood-color="#281e32" flood-opacity="0.50"/><feComposite in2="o1" operator="in" result="s1"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.45" result="b2"/><feOffset in="b2" dx="0" dy="1.3" result="o2"/>
      <feFlood flood-color="#281e32" flood-opacity="0.50"/><feComposite in2="o2" operator="in" result="s2"/>
      <feMerge><feMergeNode in="s1"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="legDiamond"><polygon points={outer}/></clipPath>
  </defs>
  <!-- the nine cells: painted cells may blend into each other, but are clipped to the diamond's outer edge -->
  <g clip-path="url(#legDiamond)">
    {#each CELLS as [i, j]}
      {@const im = image(i, j, i === 0 && j === 0 ? WATERCOLOUR.low : WATERCOLOUR.cover)}
      <image href={im.href} x={im.x} y={im.y} width={im.w} height={im.h}/><polygon points={poly(cellPts(i, j))} class="bl-inkcell"/>
    {/each}
  </g>
  <!-- the lifted cells: paper backing first, then their paint, then the cell lines, then a clean paper rim, like a cut-out sheet -->
  <g class="bl-lift" filter="url(#blLift)" transform="translate(0,-2.6)">
    <polygon points={lift} class="bl-liftpaper"/>
    <g clip-path="url(#legTop3)">
      {#each NAMED_CELLS as [i, j]}{@const im = image(i, j, WATERCOLOUR.cover)}<image href={im.href} x={im.x} y={im.y} width={im.w} height={im.h}/>{/each}
    </g>
    {#each NAMED_CELLS as [i, j]}<polygon points={poly(cellPts(i, j))} class="bl-inkcell"/>{/each}
    <polygon points={lift} class="bl-liftedge"/>
  </g>
  {#each texts as t}
    <text x={t.x} y={t.y} transform={t.transform} class={t.cls} text-anchor={t.anchor} style:font-size={titleSize[t.text]}>{t.text}</text>
  {/each}
</svg></span></div>
