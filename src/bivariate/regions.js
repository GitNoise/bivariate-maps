// Bivariate map: the zoom regions, the views the map's region buttons zoom to. Countries group by their UN M49 subregion,
// merged into larger regions; a region gets a button when it holds a country the map has something to say about.

import {UN_SUBREGION, UN_SUBREGION_NAME} from './world.js';

// ---- the default grouping -----------------------------------------------------------------------------------------
// merged regions: the UN's Sub-Saharan Africa (Southern, Eastern, Western and Middle Africa), West Asia and North Africa
// (UN Northern Africa + Western Asia, the grouping used by FAO, the World Bank and UNICEF), Central America and the
// Caribbean, and Southeast Asia with Melanesia. Any other subregion is a region of its own
export const UN_GROUPS = {'018': 'ssa', '014': 'ssa', '011': 'ssa', '017': 'ssa', '015': 'wana', '145': 'wana', '013': 'cac', '029': 'cac', '035': 'seap', '054': 'seap'};
// one exception: Sudan (UN Northern Africa) sits with Sub-Saharan Africa, as the World Bank, IGAD and FAO place it
export const UN_GROUP_EXCEPTIONS = {'729': 'ssa'};
export const GROUP_NAMES = {ssa: 'Sub-Saharan Africa', wana: 'West Asia and North Africa', seap: 'Southeast Asia and the Pacific', cac: 'Central America and the Caribbean'};
// shorter button labels; the full name stays as the button's tooltip
export const GROUP_SHORT_NAMES = {wana: 'W. Asia & N. Africa', seap: 'SE Asia & Pacific', cac: 'C. America & Caribbean'};
export const GROUP_ORDER = ['ssa', 'cac', 'wana', 'seap'];

// include: the ids whose regions get a button, if a region holds at least `min` of them (default 2, so a lone country
// never gets a button of its own; it stays in the world view). The other options replace the defaults above: groups (UN
// subregion -> region), exceptions (id -> region), names and shortNames (by region), order (the known regions' button
// order; any other region follows, the one with most included countries first).
// Returns {keys: the buttons' regions in order, members: {key: Set of ids}, title, short: {key: name}, regionOf(id)}.
export function createRegions({include, min = 2, groups = UN_GROUPS, exceptions = UN_GROUP_EXCEPTIONS, names = GROUP_NAMES,
                               shortNames = GROUP_SHORT_NAMES, order = GROUP_ORDER}){
  const regionOf = id => {
    if(exceptions[id]) return exceptions[id];
    const subregion = UN_SUBREGION[id];
    return subregion ? (groups[subregion] || subregion) : null;
  };
  const count = {};
  for(const id of include){ const key = regionOf(id); if(key) count[key] = (count[key] || 0) + 1; }
  const keys = Object.keys(count).filter(key => count[key] >= min).sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if(ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return count[b] - count[a];
  });
  const members = {}, title = {}, short = {};
  keys.forEach(key => {
    members[key] = new Set(Object.keys(UN_SUBREGION).filter(id => regionOf(id) === key));
    title[key] = names[key] || UN_SUBREGION_NAME[key];
    short[key] = shortNames[key] || title[key];
  });
  return {keys, members, title, short, regionOf};
}
