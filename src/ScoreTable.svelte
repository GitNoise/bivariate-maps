<!-- The table of every measure, worldwide (the rows of #scores in index.html); the measure on the map is highlighted. -->
<script>
  import {MEASURE_DATA, MEASURE_SCORES} from './measures.js';
  import {view} from './state.svelte.js';

  const rows = [['region', 'Every southern African country'], ['none', 'Shortfall alone']]
    .concat(Object.keys(MEASURE_DATA).map(measure => [measure, 'Shortfall + ' + MEASURE_DATA[measure].label.toLowerCase()]))
    .map(([key, label]) => {
      const o = MEASURE_SCORES.world[key];
      // per count: both rounds together, and each round
      const count = field => ({total: o['2015'][field] + o['2023'][field], rounds: `${o['2015'][field]} + ${o['2023'][field]}`});
      return {key, label, counts: [count('hits'), count('missed'), count('falseAlarms')]};
    });
</script>

{#each rows as row}
  <tr class:cur={row.key === view.measure}>
    <th scope="row">{row.label}</th>
    {#each row.counts as c}<td>{c.total} <span class="fa">({c.rounds})</span></td>{/each}
  </tr>
{/each}
