<!-- The diamond legend in the map's corner: bottom = low on both axes, left edge = the first axis, right edge = the
     second, top = high on both. The raised cells lift off the diamond as one piece, with a short, sharp shadow. After
     drawing, long axis titles shrink and the viewBox is cropped to the drawing. -->
<script>
  import {tick, untrack} from 'svelte';
  import {cellColour} from './colour.js';
  import {legendCellImage} from './brush.js';

  // spec: {a: {title, ticks: [two class limits]}, b: {...}, top: the title over the diamond, label: its accessible name}
  // raisedCells: [[i, j], ...], sharing edges. watercolour: the brush settings (cover, low). mapWidth: the map's width in
  // pixels, for the legend's size. el: the legend's box, for the map to keep clear of
  let {spec, raisedCells, watercolour, mapWidth, el = $bindable()} = $props();

  const d = 13.35, bx = 190, by = 178, n = Math.SQRT1_2;   // cell side ≈ 19px
  // u = the first axis, rising to the upper left; v = the second, rising to the upper right
  const P = (u, v) => [bx + (v - u) * d, by - (u + v) * d];
  const poly = pts => pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  const cellPts = (i, j) => [P(i,j), P(i+1,j), P(i+1,j+1), P(i,j+1)];
  const image = (i, j, cover) => legendCellImage(cellPts(i, j), cellColour(i, j), cover, 101 + i * 7 + j * 31);
  const CELLS = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => [i, j]));
  const outer = poly([P(0,0), P(3,0), P(3,3), P(0,3)]);

  // the outline of the raised cells, as one polygon: every cell's edges in the same turning order, so an edge two raised
  // cells share runs both ways and drops out; the rest chain into a ring, and points on a straight run are dropped
  function outlineOf(cells){
    const key = p => p.join(','), edges = new Map();
    cells.forEach(([i, j]) => {
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      c.forEach((p, k) => {
        const q = c[(k + 1) % 4], back = key(q) + '>' + key(p);
        if(edges.has(back)) edges.delete(back); else edges.set(key(p) + '>' + key(q), [p, q]);
      });
    });
    const next = new Map([...edges.values()].map(([p, q]) => [key(p), q]));
    const ring = [[...edges.values()][0][0]];
    for(let p = next.get(key(ring[0])); key(p) !== key(ring[0]); p = next.get(key(p))) ring.push(p);
    const straight = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) === (b[1] - a[1]) * (c[0] - b[0]);
    return ring.filter((p, k) => !straight(ring[(k + ring.length - 1) % ring.length], p, ring[(k + 1) % ring.length]));
  }
  const lift = $derived(raisedCells.length ? poly(outlineOf(raisedCells).map(([i, j]) => P(i, j))) : null);

  // a text along an edge: at (x, y), rotated by rot degrees
  const label = (x, y, rot, text, cls, anchor = 'middle') =>
    ({x: x.toFixed(1), y: y.toFixed(1), transform: `rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})`, text, cls, anchor});
  const at = (p, dx, dy) => [p[0] + dx * n, p[1] + dy * n];
  // ticks on the lower-left edge (first axis) and lower-right edge (second axis), offset outward; the axis titles,
  // centred on each edge so they never run past the diamond's ends; the title on top
  const texts = $derived([
    label(...at(P(1, 0), -10, 10), 45, spec.a.ticks[0], 'bl-tk', 'end'),
    label(...at(P(2, 0), -10, 10), 45, spec.a.ticks[1], 'bl-tk', 'end'),
    label(...at(P(0, 1), 10, 10), -45, spec.b.ticks[0], 'bl-tk', 'start'),
    label(...at(P(0, 2), 10, 10), -45, spec.b.ticks[1], 'bl-tk', 'start'),
    label(...at(P(1.5, 0), -23, 23), 45, '← ' + spec.a.title, 'bl-ax'),
    label(...at(P(0, 1.5), 23, 23), -45, spec.b.title + ' →', 'bl-ax'),
    label(P(3, 3)[0], P(3, 3)[1] - 9, 0, spec.top, 'bl-top'),
  ]);

  // fitting: an axis title longer than its edge (54 units) shrinks; then the viewBox is cropped to the drawing, and the
  // legend shrinks on narrower maps, keeping its proportions. Measured again when the texts, the map's width or the
  // web fonts change (the bold title's font can come late)
  let svg;
  let titleSize = $state({});   // font size by axis title text, for the titles that shrink
  let frame = $state({viewBox: '0 0 380 236', width: 380, height: 236});
  let fontLoads = $state(0);
  document.fonts?.addEventListener('loadingdone', () => fontLoads++);
  // on narrow maps the page's CSS may move the legend off the map, under it: then it keeps its full size
  const legendScale = () => {
    if(getComputedStyle(el).position !== 'absolute') return 1;
    const w = mapWidth || 1000;
    return w > 900 ? 1 : w > 680 ? 0.85 : w > 500 ? 0.72 : 0.6;
  };
  // a title's natural length: written, measured, removed
  function titleLength(text){
    const e = svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'text'));
    e.setAttribute('class', 'bl-ax'); e.textContent = text;
    const length = e.getComputedTextLength();
    e.remove();
    return length;
  }
  $effect(() => {
    const titles = texts.filter(t => t.cls === 'bl-ax').map(t => t.text);
    fontLoads; mapWidth;
    untrack(() => {
      titleSize = Object.fromEntries(titles.map(text => [text, titleLength(text)]).filter(([, L]) => L > 54)
        .map(([text, L]) => [text, (10.5 * 54 / L).toFixed(2) + 'px']));
    });
    tick().then(() => {   // once the titles are sized. Text measures differently when drawn small, so the crop is measured
      // on a full-size copy (380 × 236, as first drawn), not on the legend as cropped last time
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

<div class="key" id="mapkey" bind:this={el}><span class="bilegend"><svg bind:this={svg} viewBox={frame.viewBox} width={frame.width} height={frame.height} role="img" aria-label={spec.label}>
  <defs>
    {#if lift}<clipPath id="legTop3"><polygon points={lift}/></clipPath>{/if}
    <!-- the lift's shadow: a soft blur and a sharp one, both offset down; the same on screen as the raised countries' on the
         map (wash.js), at about 0.86 pixels per legend unit -->
    <filter id="blLift" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.9" result="b1"/><feOffset in="b1" dx="0" dy="4.9" result="o1"/>
      <feFlood flood-color="#281e32" flood-opacity="0.55"/><feComposite in2="o1" operator="in" result="s1"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="b2"/><feOffset in="b2" dx="0" dy="2" result="o2"/>
      <feFlood flood-color="#281e32" flood-opacity="0.60"/><feComposite in2="o2" operator="in" result="s2"/>
      <feMerge><feMergeNode in="s1"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="legDiamond"><polygon points={outer}/></clipPath>
  </defs>
  <!-- the nine cells: painted cells may blend into each other, but are clipped to the diamond's outer edge -->
  <g clip-path="url(#legDiamond)">
    {#each CELLS as [i, j]}
      {@const im = image(i, j, i === 0 && j === 0 ? watercolour.low : watercolour.cover)}
      <image href={im.href} x={im.x} y={im.y} width={im.w} height={im.h}/><polygon points={poly(cellPts(i, j))} class="bl-inkcell"/>
    {/each}
  </g>
  <!-- the lifted cells: paper backing first, then their paint, then the cell lines, then a clean paper rim, like a cut-out sheet -->
  {#if lift}
    <g class="bl-lift" filter="url(#blLift)" transform="translate(0,-2.6)">
      <polygon points={lift} class="bl-liftpaper"/>
      <g clip-path="url(#legTop3)">
        {#each raisedCells as [i, j]}{@const im = image(i, j, watercolour.cover)}<image href={im.href} x={im.x} y={im.y} width={im.w} height={im.h}/>{/each}
      </g>
      {#each raisedCells as [i, j]}<polygon points={poly(cellPts(i, j))} class="bl-inkcell"/>{/each}
      <polygon points={lift} class="bl-liftedge"/>
    </g>
  {/if}
  {#each texts as t}
    <text x={t.x} y={t.y} transform={t.transform} class={t.cls} text-anchor={t.anchor} style:font-size={titleSize[t.text]}>{t.text}</text>
  {/each}
</svg></span></div>
