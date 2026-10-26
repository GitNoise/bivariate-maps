// Bivariate map: the colours, read from CSS custom properties so the page's themes apply.
// Cell (i, j): i = the first axis's class, j = the second's, 0 to 2. The palette is --bi{j}{i}.

import * as d3 from 'd3';

// cached; the wash clears the cache before each frame, so a theme change shows on the next frame
let cssCache = {};
export function clearCssCache(){ cssCache = {}; }
export function cssVar(name){
  if(!cssCache[name]) cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return cssCache[name];
}

export const cellColour = (i, j) => cssVar(`--bi${j}${i}`);

// relative luminance of a colour (WCAG)
export function luminance(colour){
  const c = d3.rgb(colour);
  const linear = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}
