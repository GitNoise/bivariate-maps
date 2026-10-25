// El Niño × food security: starts the page. The figure goes where index.html leaves room for it, before the score table;
// the table's rows go into its body. The rest of the page is plain HTML.

import {mount} from 'svelte';
import Figure from './Figure.svelte';
import ScoreTable from './ScoreTable.svelte';

const scores = document.getElementById('scores');
mount(Figure, {target: scores.parentNode, anchor: scores});
mount(ScoreTable, {target: scores.querySelector('tbody')});
