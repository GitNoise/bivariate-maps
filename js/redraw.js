// El Niño × food security: redrawMap(), which redraws everything for the current state, and zoomTo(), which switches
// the region. The one module that calls every drawing module; they get the map itself from js/map.js.

import {DATA, NATIONAL_CRISES} from './data.js';
import {WATERCOLOUR} from './settings.js';
import {clearCssCache, cssVar, fillOf, isLowestClass, showsWeakShortfall, REGION_TITLE, selectedRegion, setSelectedRegion, inSelectedRegion} from './classes.js';
import {mapbox, countryIdOf, countryPaths, smallCountryDots, greyHatch, lightHatch, hatchOf, hatchPaths, borderPaths, drawCrisisBorders, isZooming, setZooming, frameOf} from './map.js';
import {washTransform, zoomWashTo} from './watercolour.js';
import {labelLayer, drawLabels} from './labels.js';
import {drawLegend} from './legend.js';
import {refreshTooltip} from './tooltip.js';
import {drawScoreLine} from './explorer.js';

let zoomScale = 1;   // the current zoom factor

// ---- drawing --------------------------------------------------------------------------------------------
// redraw everything for the current region and measure (the watercolour wash is redrawn separately, by drawWash)
export function redrawMap(){
  clearCssCache();   // theme colours: read once per paint
  mapbox.classList.toggle('world-view', selectedRegion === 'world');   // world view: dark borders a little lighter
  drawScoreLine();
  drawCrisisBorders();
  // the shapes are transparent (the wash shows through); outside the selected region they are dimmed
  countryPaths.style('fill', 'transparent')
    .attr('class', d => 'country' + (fillOf(d.id) && inSelectedRegion(d.id) ? ' hit' : '') + (inSelectedRegion(d.id) ? '' : ' dim'));
  // small-country dots are for the world view only; zoomed in, the country itself is visible (and has its label or arrow)
  smallCountryDots.style('display', selectedRegion === 'world' ? null : 'none')
    .classed('fi', d => !!NATIONAL_CRISES[d.id])
    .style('fill', d => fillOf(d.id) || cssVar('--land'))
    .style('fill-opacity', d => isLowestClass(DATA.countries[d.id]) ? WATERCOLOUR.low : 1)
    .attr('r', 3.2 / zoomScale)
    .style('stroke-dasharray', d => showsWeakShortfall(d.id) ? '1.5 1.5' : null)
    .classed('dim', d => !inSelectedRegion(d.id));
  // the hatch stays a fine, constant texture on screen at every zoom level
  [greyHatch, lightHatch].forEach(p => p.attr('patternTransform', `rotate(45) scale(${(1 / Math.max(1, zoomScale)).toFixed(4)})`));
  hatchPaths.attr('fill', d => hatchOf(d.id))
    .style('display', d => showsWeakShortfall(d.id) ? null : 'none')
    .classed('dim', d => !inSelectedRegion(d.id));
  // pencil borders: a tad stronger inside the selected region, a tad lighter outside it (Somaliland counts as Somalia)
  borderPaths.classed('dim', d => !inSelectedRegion(countryIdOf(d))).classed('inreg', d => selectedRegion !== 'world' && inSelectedRegion(countryIdOf(d)));
  drawLegend();
  // the figure has no visible title; its accessible name follows the selected region
  document.querySelector('.fig').setAttribute('aria-label', selectedRegion === 'world'
    ? 'Map: El Niño harvest shortfall and cereal import dependence, by country'
    : `Map: El Niño harvest shortfall and cereal import dependence, ${REGION_TITLE[selectedRegion]}`);
  refreshTooltip();
  // labels: cleared here; drawn once the wash transition ends (zoomWashTo), or at once when no zoom is under way
  labelLayer.selectAll('*').remove(); labelLayer.style('opacity', 0);
  if(selectedRegion !== 'world' && !isZooming) drawLabels(washTransform);
}

// switch to a region (or 'world'): repaint, then zoom the map and its wash there
export function zoomTo(key){
  setSelectedRegion(key);
  const t = frameOf(key); zoomScale = t.k;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setZooming(true);   // the labels are drawn once the wash has settled (zoomWashTo), not on the old frame
  redrawMap();
  zoomWashTo(t, reduceMotion ? 0 : 650);
}
