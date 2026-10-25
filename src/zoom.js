// El Niño × food security: switching the region. The map and its wash zoom to the region's frame over 650 ms (at once
// with reduced motion); the labels wait until the zoom has settled.

import {timer, interpolate, easeCubicInOut, zoomIdentity} from 'd3';
import {view, zoom} from './state.svelte.js';
import {frameOf} from './map.js';
import {washesForWidth, drawWash} from './watercolour.js';

let running = null;   // the zoom under way: {timer, t, washes}

export function zoomTo(key){
  view.region = key;
  const t = frameOf(key);
  zoom.scale = t.k;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  animateTo(t, reduceMotion ? 0 : 650);
}

function animateTo(t, duration){
  if(running){ running.timer.stop(); settle(running.t, running.washes); }   // an interrupted zoom ends at once
  const washes = washesForWidth(), from = zoom.settled;
  const between = interpolate([from.x, from.y, from.k], [t.x, t.y, t.k]);
  zoom.moving = true;
  const tick = timer(elapsed => {
    if(elapsed >= duration){ tick.stop(); running = null; settle(t, washes); return; }
    const [x, y, k] = between(easeCubicInOut(elapsed / duration)), frame = zoomIdentity.translate(x, y).scale(k);
    zoom.current = frame;
    drawWash(frame, washes);
  });
  running = {timer: tick, t, washes};
}

function settle(t, washes){
  zoom.current = zoom.settled = t;
  zoom.moving = false;
  drawWash(t, washes);
}
