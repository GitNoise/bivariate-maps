<!-- The tooltip's content: a country's severity, its appeal and how much of it was funded, and ECHO's forgotten crisis there.
     The map places it. -->
<script>
  import {DATA} from './data.js';
  import {ECHO_FORGOTTEN} from './settings.js';

  let {id, name} = $props();
  const r = $derived(DATA.countries[id]);
  const money = v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}bn` : `$${Math.round(v / 1e6)}m`;
</script>

<b>{name}</b>
{#if r}
  <div class="tr"><span>Severity (INFORM)</span><b>{r.severity == null ? 'not rated' : `${r.severity.toFixed(1)}, ${r.severityCategory}`}</b></div>
  {#if r.crisis}<div class="tr"><span>Most severe crisis</span><b>{r.crisis}</b></div>{/if}
  <div class="tr"><span>Appeal {DATA.year}</span><b>{r.requirements == null ? 'none' : money(r.requirements)}</b></div>
  {#if r.funded != null}<div class="tr"><span>Unfunded</span><b>{r.funded >= 100 ? 'none (fully funded)' : `${Math.round(100 - r.funded)}%`}</b></div>{/if}
  {#if r.peopleInNeed != null}<div class="tr"><span>People in need</span><b>{(r.peopleInNeed / 1e6).toFixed(1)} million</b></div>{/if}
  {#if r.perPerson != null}<div class="tr"><span>Funding per person in need</span><b>${Math.round(r.perPerson)}</b></div>{/if}
  {#if r.appealYears}<div class="tr"><span>UN appeals</span><b>{r.appealYears === 1 ? 'first year' : `${r.appealYears} years in a row`}</b></div>{/if}
  {#if r.gapYears}<div class="tr"><span>Funded below average</span><b>{r.gapYears === 1 ? 'this year' : `${r.gapYears} years in a row`}</b></div>{/if}
{:else}
  <div class="tr"><span>Severity and appeal</span><b>no data</b></div>
{/if}
{#if ECHO_FORGOTTEN[id]}<div class="tr"><span>Forgotten crisis for ECHO</span><b>{ECHO_FORGOTTEN[id]}</b></div>{/if}
