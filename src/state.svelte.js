// El Niño × food security: the page's shared state. Components and modules read it; whatever reads a value updates when
// it changes, so nothing has to be redrawn by hand.

import {zoomIdentity} from 'd3';

// the second measure on the map, and the region on screen ('world' or a zoom region)
export const view = $state({measure: 'imports', region: 'world'});

// the zoom: the transform on screen (every frame while zooming), the one it settles on, the target's scale, and whether it
// is moving (from the start until the first zoom, onto the world view, settles)
export const zoom = $state({current: zoomIdentity, settled: zoomIdentity, scale: 1, moving: true});

// the tooltip: the country it shows, where (pixels within the map), and whether it is visible
export const tip = $state({id: null, x: 0, y: 0, shown: false});

// the map's width on screen in pixels: set at the start and after a resize, for what depends on it (the legend's size)
export const layout = $state({width: 0});

// elements that other modules measure, set when the figure mounts
export const els = {mapbox: null, svg: null, legend: null};
