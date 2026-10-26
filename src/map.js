// El Niño × food security: the map's geometry, Natural Earth's countries framed on the inhabited world (the module's
// defaults). The bivariate map (src/bivariate/) draws it; the labels place text on it.

import {createGeo} from './bivariate/geo.js';
export {countryIdOf} from './bivariate/world.js';

export const geo = createGeo();
