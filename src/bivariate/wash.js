// Bivariate map: the watercolour washes, painted with the brush (brush.js) on a canvas under the SVG. The raised
// countries are lifted off the paper with a shadow.

import * as d3 from 'd3';
import {clearCssCache, cssVar} from './colour.js';
import {largestRing} from './geometry.js';
import {seedBrush, brushRandom, simplifyRing, deformRing, smoothRing} from './brush.js';

// how far the raised countries lift off the paper, in screen pixels, as the legend's lifted cells (2.6 legend units): they,
// their paper backing and their shadow move up together (BivariateMap.svelte moves their edges with them)
export const LIFT = 2.2;

// geo: from createGeo(); settings: how the washes are painted (layers, coverage, edge spill, brush size)
export function createWash(geo, settings){
  let canvas, context;
  const attach = c => { canvas = c; context = c.getContext('2d'); };

  // ---- building the washes ---------------------------------------------------------------------------------
  // every country's wash, brushed for zoom z on a map pxWidth pixels wide: per country a base path and settings.layers
  // deformed layers, each with a blotch mask
  function build(z, pxWidth){
    // map units per screen pixel at this zoom, with the brushwork scaled down on small maps so edges stay fine
    const brush = Math.max(0.5, Math.min(1, pxWidth / 900));
    const u = geo.width / Math.max(300, pxWidth) / z * brush;
    const out = [];
    geo.shapes.features.forEach((f, n) => {
      const b = geo.bounds[n];
      seedBrush(settings.seed + n * 7919);   // same country, same brushwork, every time
      let rings = geo.ringsOf(f).map(r => simplifyRing(r, settings.simplify * u)).filter(r => r.length >= 3);
      // let the pigment flow out past the border by settings.spill of the shape's size: outer rings grow, holes shrink.
      // d3.polygonArea is signed, so an outer ring and its holes wind opposite ways
      const area = d3.polygonArea;
      const outerSign = Math.sign(area(largestRing(rings) || []));
      rings = rings.map(r => {
        const cx = d3.mean(r, p => p[0]), cy = d3.mean(r, p => p[1]);
        const g = Math.sign(area(r)) === outerSign ? 1 + settings.spill : 1 / (1 + settings.spill);
        return r.map(p => [cx + (p[0] - cx) * g, cy + (p[1] - cy) * g]);
      });
      if(!rings.length) return;
      const base = rings.map(r => deformRing(r, settings.pre, settings.amp, settings.maxPre * u));
      const layers = [];
      for(let l = 0; l < settings.layers; l++){
        const p = new Path2D();
        base.forEach(r => smoothRing(p, deformRing(r, settings.per, settings.amp, settings.maxLayer * u)));
        layers.push([p, blotchMask(b, u)]);
      }
      const basePath = new Path2D();
      base.forEach(r => smoothRing(basePath, r));
      out.push({id: geo.idOf(f), layers, basePath});
    });
    return out;
  }

  // Hobbs' texture mask: each layer only paints inside a random scatter of blotches over the country's box b,
  // so overlaps vary across the wash. Big countries get fewer, larger blotches with the same coverage.
  function blotchMask(b, u){
    const m = new Path2D(), bw = b[1][0] - b[0][0] + 8 * u, bh = b[1][1] - b[0][1] + 8 * u;
    const r2 = ((settings.rMin + settings.rMax) / 2 * u) ** 2 * 1.08;
    const nWant = Math.max(2, Math.ceil(-Math.log(1 - settings.maskShare) * bw * bh / (Math.PI * r2)));
    const nUse = Math.min(nWant, settings.maxBlotches), grow = Math.sqrt(nWant / nUse);
    for(let q = 0; q < nUse; q++){
      const cx = b[0][0] - 4 * u + brushRandom() * bw, cy = b[0][1] - 4 * u + brushRandom() * bh;
      const rr = (settings.rMin + brushRandom() * (settings.rMax - settings.rMin)) * u * grow;
      m.moveTo(cx + rr, cy); m.arc(cx, cy, rr, 0, Math.PI * 2);
    }
    return m;
  }

  // ---- the raised countries --------------------------------------------------------------------------------
  // one merged shape per view for the raised countries, with no seams between neighbours (null if there are none).
  // Which countries are raised depends on the data, so clearRaised() empties the cache when it changes
  let pieceCache = {};
  const clearRaised = () => { pieceCache = {}; };
  function raisedPiece(look){
    const key = look.region;
    if(key in pieceCache) return pieceCache[key];
    const d = geo.outline(id => (!look.members || look.members.has(id)) && look.isRaised(id));   // world view: every raised country
    return (pieceCache[key] = d ? new Path2D(d) : null);
  }

  // the raised countries cast their shadow over the flat countries and into holes, then get clean paper
  function castRaisedShadow(look, dark, bg){
    const piece = raisedPiece(look);
    if(!piece) return;
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    // [blur, dx, dy, colour], the same as the legend's lifted cells (Legend.svelte): a soft and a sharp shadow, both only
    // below, so the top and sides of a raised country stay crisp
    const SHADOWS = [
      [5,   0, 4.2, dark ? 'rgba(0,0,0,0.75)' : 'rgba(40,30,50,0.55)'],
      [1.2, 0, 1.7, dark ? 'rgba(0,0,0,0.85)' : 'rgba(40,30,50,0.60)'],
    ];
    SHADOWS.forEach(([blur, dx, dy, colour]) => {
      context.save();
      context.fillStyle = bg; context.shadowColor = colour; context.shadowBlur = blur * dpr; context.shadowOffsetX = dx * dpr; context.shadowOffsetY = dy * dpr; context.globalAlpha = 1;
      context.fill(piece, 'nonzero');   // holes keep their rims, so enclosed countries get a shadow too
      context.restore();
    });
    context.fillStyle = bg; context.fill(piece, 'nonzero');   // clean paper under the raised countries only; shadows in holes stay
  }

  // a region's plain paper sheet: the outline of all its countries
  const sheetCache = {};
  function regionSheet(look){
    if(sheetCache[look.region]) return sheetCache[look.region];
    const p = new Path2D();
    geo.shapes.features.filter(f => look.members.has(geo.idOf(f))).forEach(f => geo.ringsOf(f).forEach(r => {
      p.moveTo(r[0][0], r[0][1]);
      r.slice(1).forEach(q => p.lineTo(q[0], q[1]));
      p.closePath();
    }));
    return (sheetCache[look.region] = p);
  }

  // ---- painting --------------------------------------------------------------------------------------------
  const isDarkTheme = () => { const c = d3.rgb(getComputedStyle(document.body).backgroundColor); return c.r + c.g + c.b < 300; };

  // paint the washes (from build) at zoom transform t. look: what the data says about each country —
  // {fillOf(id), isGrey(id), isLowest(id), isRaised(id), inRegion(id), region: 'world' or a region's key, members: its ids}
  function draw(t, washes, look){
    if(!washes) return;
    const s = canvas.width / geo.width;
    context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(s * t.k, 0, 0, s * t.k, s * t.x, s * t.y);
    clearCssCache();   // theme colours: read once per frame
    const nodata = cssVar('--nodata'), nodataDeep = cssVar('--nodatadeep'), bg = cssVar('--bg'), dark = isDarkTheme();

    const paintOne = c => {
      const fill = look.fillOf(c.id), isNoData = !fill;
      if(isNoData && !look.isGrey(c.id)) return;   // no cell and not grey: bare paper
      const cover = isNoData ? settings.nodata : (look.isLowest(c.id) ? settings.low : settings.cover);
      if(cover <= 0) return;   // unpainted: the paper shows through
      // a first even wash, then masked layers that on average bring the interior up to the class colour.
      // On the dark theme the gaps in the mottling show dark ground, so the base wash carries more of the colour;
      // the pale no-data grey gets a thin first coat and more of the mottled layers, so its brushwork still shows
      const base = isNoData ? 0.3 : Math.min(dark ? settings.baseDark : settings.base, cover);
      const rest = 1 - (1 - cover) / (1 - base);
      const layerAlpha = Math.min(1, (1 - Math.pow(1 - rest, 1 / c.layers.length)) / settings.maskShare);
      const dim = look.inRegion(c.id) ? 1 : 0.14;
      context.fillStyle = fill || nodata;
      context.globalAlpha = base * dim; context.fill(c.basePath, 'evenodd');
      context.globalAlpha = layerAlpha * dim;
      if(isNoData) context.fillStyle = nodataDeep;   // two tones: a pale first coat, mottling in a slightly deeper grey
      c.layers.forEach(([p, mask]) => { context.save(); context.clip(mask); context.fill(p, 'evenodd'); context.restore(); });
    };

    // 1. the surface: every country that is not raised. Outlined countries are marked by their border only
    if(look.region === 'world'){
      washes.filter(c => !look.isRaised(c.id)).forEach(paintOne);
    } else {
      // zoomed in: the dimmed countries outside the region first, then the region on a plain paper sheet
      // (so the dimmed neighbours' paint does not bleed into it), then its flat countries on the sheet
      washes.filter(c => !look.inRegion(c.id)).forEach(paintOne);
      context.fillStyle = bg; context.globalAlpha = 1; context.fill(regionSheet(look), 'nonzero');
      washes.filter(c => look.inRegion(c.id) && !look.isRaised(c.id)).forEach(paintOne);
    }
    // 2. the raised countries, lifted LIFT pixels up the screen: their shadow (cast from the group's outer edge onto the
    // paper they lifted from), then their washes, clipped to their exact shapes, so they end sharp at the edge the SVG
    // draws around each of them
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    context.save();
    context.translate(0, -LIFT * dpr / (s * t.k));
    castRaisedShadow(look, dark, bg);
    const piece = raisedPiece(look);
    if(piece) context.clip(piece, 'nonzero');
    washes.filter(c => look.inRegion(c.id) && look.isRaised(c.id)).forEach(paintOne);
    context.restore();
    context.globalAlpha = 1;
  }

  // the canvas, the size of the SVG over it
  function size(svg){
    const r = svg.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  }

  return {attach, size, build, draw, clearRaised};
}
