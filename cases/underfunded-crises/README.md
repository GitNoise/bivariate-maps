# Need and missing money (draft)

Humanitarian need against the share of each country's 2025 UN appeals that went unfunded. Both high, the top of the
diamond, is a severe crisis whose appeal is largely unfunded. The outline adds a third dimension: gaps that persist, funded
below the year's average every year since 2021. (The folder keeps its first name.)

| File | What it holds |
|---|---|
| `index.html`, `style.css` | The page and its styles: the shared shell (`css/page.css`) and the map (`src/bivariate/bivariate.css`). |
| `main.js`, `Figure.svelte`, `Tooltip.svelte` | The figure: the bivariate map with this case's cells, outlines and tooltip, and the key. |
| `settings.js` | The choices: the classes on both axes, the raised cells, what counts as a persistent gap, the zoom regions, the notes, and ECHO's list of forgotten crises (named in the tooltip). |
| `build_data.py` | Writes `data.js` from the three source files. |
| `data.js` | Written by `build_data.py`. |

## Data

1. **Need:** INFORM Severity, January 2025 (European Commission JRC, INFORM Severity "Results and data"), as the 2025 appeals began. Its categories are INFORM's own: High above 3, Very High above 4 on the 1–5 index (INFORM Severity methodology, Table 7).
2. **Funding and people in need:** OCHA, Global Humanitarian Overview 2025 on HDX, the monthly table of appeals for December 2025 (`GHO_2025_December_HDX.xlsx`).
3. **Years of appeals:** OCHA's Financial Tracking Service, the global requirements-and-funding CSV on HDX (`fts_requirements_funding_global.csv`, modified 23 October 2026).
4. **Tooltip context:** DG ECHO's forgotten crises for 2026 (its forgotten crises page, updated 7 October 2025), entered by hand in `settings.js`.

```bash
make underfunded-crises GHO=data/raw/underfunded-crises/gho-2025/GHO_2025_December_HDX.xlsx INFORM=data/raw/underfunded-crises/inform-2025-01/202501_INFORM_Severity_January_2025.xlsx FTS=data/raw/underfunded-crises/fts/fts_requirements_funding_global.csv
npm run dev                                             # then open /cases/underfunded-crises/
make page                                               # dist/cases/underfunded-crises/index.html, with the El Niño page
```

`make setup` installs `openpyxl`, which reads the Excel files.

## Choices, and what is still open

- **The unfunded share of the appeal**, the funding gap OCHA and ECHO report. Classes: equal thirds of the unfunded share (under 33%, 33–67%, 67% or more: 2, 8 and 22 countries). Changed after seeing the data, as was the switch from funding per person in need to the share of the appeal; both are said in the method note.
- **Funding per person in need** is in the tooltip, because the ask is already trimmed to what seems fundable: a well-covered appeal does not mean a well-funded crisis. People in need is the largest figure among a country's plans, since plans for one country overlap.
- **Severe crises without a UN country appeal** (High or Very High, no appeal) are coloured by need only, under hatching. Lebanon's 2025 flash appeal gives no people in need, so its tooltip has no funding per person.
- **Persistent gaps** are outlined: funded below that year's share across all country appeals every year 2021–2025 (Mali and Haiti for 10 years, DR Congo and Cameroon 9, Burkina Faso and El Salvador 5). Four of the last five years would mark 14 countries. FTS's 2025 figures (October 2026) run a few points above the GHO table's (December 2025); each year is compared with its own share.
- **Hatched countries** have no 2025 country appeal for different reasons: refugee crises covered by regional plans (Uganda, Iran, Türkiye, Mexico, Kenya), appeals that stopped (Ethiopia, Libya, Burundi), none possible (North Korea). None is a new crisis awaiting its first appeal. Ethiopia's missing 2025 plan is worth checking against OCHA.
- **The country is the unit**, but all three sources work by crisis: a country's colour and the crisis ECHO names can differ (the Philippines: the 2025 appeal was for typhoons, ECHO names the Mindanao conflict).
