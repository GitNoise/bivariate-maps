<!-- The score line beside the map: three big numbers for the selected measure, counted for the countries in view. -->
<script>
  import {DATA} from './data.js';
  import {SOUTHERN_AFRICA} from './settings.js';
  import {TEST_RESULTS} from './measures.js';
  import {isHighestRisk, REGION_MEMBERS, inSelectedRegion} from './classes.js';
  import {view} from './state.svelte.js';

  // hits, false alarms and misses for a theory over a set of countries, both rounds (2015–16, 2023–24) together.
  // theory: a measure, 'none' (the shortfall alone) or 'region' (every southern African country)
  function scoreOf(theory, ids){
    let h = 0, f = 0, m = 0;
    ids.forEach(id => {
      const t = TEST_RESULTS[id];
      if(!t) return;
      for(let round = 0; round < 2; round++){
        if(t.flagged[round] < 0) continue;   // shortfall not known before this round
        const flag = theory === 'region' ? SOUTHERN_AFRICA.has(id)
          : theory === 'none' ? t.flagged[round] === 1
          : t.flagged[round] === 1 && t.classes[theory][round] >= 1;
        const crisis = t.crisis[round] === 1;
        if(flag && crisis) h++; else if(flag) f++; else if(crisis) m++;
      }
    });
    return {h, f, m};
  }
  const score = $derived(scoreOf(view.measure, view.region === 'world' ? Object.keys(TEST_RESULTS) : REGION_MEMBERS[view.region]));
  const named = $derived(Object.keys(DATA.countries).filter(id => isHighestRisk(DATA.countries[id])));
  const stats = $derived([
    [named.filter(inSelectedRegion).length, ` of ${named.length}`, 'highest-risk countries in view'],
    [score.h, ` of ${score.h + score.m}`, 'food crises the map would have warned of'],
    [score.f, '', 'warnings followed by no crisis'],
  ]);
</script>

<!-- big number first, its meaning underneath -->
{#each stats as [big, unit, label]}<div class="stat"><div class="sb">{big}<span class="su">{unit}</span></div><div class="sl">{label}</div></div>{/each}<div class="scontext">If drawn before each of the last two El Niños.</div>
