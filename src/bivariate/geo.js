// Bivariate map: the geometry. The projection, the country shapes and their rings, merged outlines, and how a view is
// framed. Nothing here knows what the map shows.

import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import {WORLD, WORLD_FRAME, countryIdOf} from './world.js';

export const PHONE_QUERY = '(max-width: 640px)';   // the phone layout's breakpoint, as in the page's CSS

// topology: TopoJSON with the countries as `object` (default: Natural Earth's, world.js); frame: the GeoJSON area the
// projection fits (default: WORLD_FRAME); idOf: a shape's id (default: its id, Somaliland as Somalia); drop: ids left off
// the map (default: Antarctica). The frame is set for the layout at load (phone or not).
export function createGeo({topology = WORLD, object = 'countries', frame = WORLD_FRAME, idOf = countryIdOf, drop = ['010']} = {}){
  const isPhone = window.matchMedia(PHONE_QUERY).matches;
  const width = isPhone ? 700 : 1180, height = isPhone ? 560 : 600;   // viewBox size

  const shapes = topojson.feature(topology, topology.objects[object]);
  shapes.features = shapes.features.filter(f => !drop.includes(f.id));
  const projection = d3.geoNaturalEarth1().fitExtent([[0, isPhone ? 100 : 0], [width, isPhone ? height - 100 : height]], frame);
  const path = d3.geoPath(projection);
  const bounds = shapes.features.map(f => path.bounds(f));   // by feature index, in map units

  // each feature's rings in map units; the projection never changes, so each is traced once
  const ringCache = new Map();
  function ringsOf(feature){
    if(!ringCache.has(feature)){
      const rings = []; let current = null;
      d3.geoPath(projection).context({
        moveTo(x, y){ current = [[x, y]]; rings.push(current); },
        lineTo(x, y){ current.push([x, y]); },
        closePath(){}, arc(){},
      })(feature);
      ringCache.set(feature, rings);
    }
    return ringCache.get(feature);
  }

  // SVG path data of one outline around each group of touching countries whose id passes keep (null if none).
  // topojson.merge dissolves only shared borders, so a country enclosed by kept ones stays out, as a hole with its own outline
  const geometries = topology.objects[object].geometries;
  const outline = keep => path(topojson.merge(topology, geometries.filter(g => keep(idOf(g)))));

  // archipelagos: countries whose largest piece holds less than half their area (Indonesia, the Philippines, Solomon
  // Islands). A line along every coast would bury their islands, so their outline is one envelope around all of them
  const share = {};
  shapes.features.forEach(f => {
    const g = f.geometry;
    if(!g || g.type !== 'MultiPolygon') return;
    const areas = g.coordinates.map(p => d3.geoArea({type: 'Polygon', coordinates: p}));
    share[idOf(f)] = Math.max(...areas) / d3.sum(areas);
  });
  const isArchipelago = id => share[id] < 0.5;
  // SVG path data of the envelopes around the archipelagos whose id passes keep (null if none): the convex hull of their
  // islands, `pad` map units clear of every coast, with rounded corners
  function envelopes(keep, pad){
    const rings = shapes.features.filter(f => isArchipelago(idOf(f)) && keep(idOf(f))).map(f => {
      const around = ringsOf(f).flat().flatMap(([x, y]) => d3.range(12).map(k => [x + pad * Math.cos(k * Math.PI / 6), y + pad * Math.sin(k * Math.PI / 6)]));
      return 'M' + d3.polygonHull(around).map(p => p.map(v => v.toFixed(2)).join(',')).join('L') + 'Z';
    });
    return rings.length ? rings.join('') : null;
  }

  // features that cross the 180° line (Russia, Fiji) would stretch a frame across the whole map
  const crossesDateLine = i => bounds[i][1][0] - bounds[i][0][0] >= width / 2;

  // the zoom transform that frames a view. members: null for the world, or a region's ids. framed: the members the frame
  // fits (countries without data do not pull it). legend: {w, h} in map units when the legend sits in the lower left, so
  // the frame moves right if a member would lie under it
  function frameOf(members, framed, legend){
    if(!members){
      // world view: frame on the land itself (the projection still leaves room for anything dropped)
      const feats = shapes.features.filter((f, i) => !crossesDateLine(i));
      const [[x0, y0], [x1, y1]] = path.bounds({type: 'FeatureCollection', features: feats});
      const pad = 16, kk = Math.min(width / (x1 - x0 + pad), height / (y1 - y0 + pad));
      return d3.zoomIdentity.translate(width / 2 - kk * (x0 + x1) / 2, height / 2 - kk * (y0 + y1) / 2).scale(kk);   // the legend may overlap
    }
    const feats = shapes.features.filter((f, i) => members.has(f.id) && (!framed || framed.has(f.id)) && !crossesDateLine(i));
    const [[x0, y0], [x1, y1]] = path.bounds({type: 'FeatureCollection', features: feats});
    const pad = 30;
    // fit the frame into the width left of a strip lw wide (the legend's), at most 9 times the world scale
    const fit = lw => {
      const aw = width - lw, kk = Math.min(9, 0.92 / Math.max((x1 - x0 + pad) / aw, (y1 - y0 + pad) / height));
      return d3.zoomIdentity.translate(lw + aw / 2 - kk * (x0 + x1) / 2, height / 2 - kk * (y0 + y1) / 2).scale(kk);
    };
    // centre on the full map first; make room for the legend only if a member, with or without data, would sit under it
    const t = fit(0);
    if(!legend) return t;
    const underLegend = shapes.features.some((f, i) => {
      if(!members.has(f.id) || crossesDateLine(i)) return false;
      const [[left], [, bottom]] = bounds[i];
      return t.applyX(left) < legend.w && t.applyY(bottom) > height - legend.h;
    });
    return underLegend ? fit(legend.w) : t;
  }

  return {width, height, isPhone, shapes, projection, path, bounds, idOf, ringsOf, outline, isArchipelago, envelopes, frameOf};
}
