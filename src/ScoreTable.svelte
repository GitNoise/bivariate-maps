<!-- The table of every measure, worldwide (the rows of #scores in index.html); a click on a measure's row shows it on the map. -->
<script>
  import {MEASURE_DATA, MEASURE_SCORES} from './measures.js';
  import {view} from './state.svelte.js';

  const rows = [['region', 'Every southern African country'], ['none', 'Shortfall alone']]
    .concat(Object.keys(MEASURE_DATA).map(measure => [measure, 'Shortfall + ' + MEASURE_DATA[measure].label.toLowerCase()]))
    .map(([key, label]) => {
      const o = MEASURE_SCORES.world[key];
      const h = o['2015'].hits + o['2023'].hits, f = o['2015'].falseAlarms + o['2023'].falseAlarms, m = o['2015'].missed + o['2023'].missed;
      return {key, label, rounds: [o['2015'], o['2023']], hitRate: Math.round(100 * h / (h + m)), precision: Math.round(100 * h / Math.max(1, h + f))};
    });
  const isMeasure = key => !!MEASURE_DATA[key];
</script>

{#each rows as row}
  <tr class:cur={row.key === view.measure} class:pick={isMeasure(row.key)} data-axis={isMeasure(row.key) ? row.key : ''}
      onclick={isMeasure(row.key) ? () => view.measure = row.key : null}>
    <th scope="row">{row.label}</th>
    {#each row.rounds as o}<td>{o.hits} of {o.hits + o.missed}<span class="fa"> · {o.falseAlarms} false</span></td>{/each}
    <td>{row.hitRate}%</td><td>{row.precision}%</td>
  </tr>
{/each}
