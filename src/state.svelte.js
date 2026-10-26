// El Niño × food security: the page's shared state, the selected measure and region ('world' or a zoom region).
// Whatever reads a value updates when it changes, so nothing has to be redrawn by hand.

export const view = $state({measure: 'imports', region: 'world'});
