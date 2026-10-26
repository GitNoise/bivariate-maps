// Forgotten crises: starts the page. The figure goes where index.html leaves room for it; the rest is plain HTML.

import {mount} from 'svelte';
import Figure from './Figure.svelte';

mount(Figure, {target: document.getElementById('figure')});
