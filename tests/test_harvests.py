"""The harvest shortfall: its formula, the El Niño / neutral split, the trend, and the published values in src/data.js."""
import math
import unittest

import numpy as np
import pandas as pd

from pipeline import enso, harvests


def reference_lowess(years, tonnes, span):
    """LOWESS written out: a weighted straight line at each year, over the nearest ceil(span·n) years (at least 4),
    tricube weights. The convention the map was built with."""
    x, y = np.asarray(years, float), np.asarray(tonnes, float)
    window = max(harvests.MIN_TREND_WINDOW, math.ceil(span * len(x)))
    fitted = []
    for x0 in x:
        distances = np.abs(x - x0)
        h = np.sort(distances)[window - 1]
        w = np.clip(1 - (distances / h) ** 3, 0, None) ** 3
        slope, intercept = np.polyfit(x, y, 1, w=np.sqrt(w))
        fitted.append(slope * x0 + intercept)
    return np.array(fitted)


class Shortfall(unittest.TestCase):
    def test_no_difference_is_zero(self):
        self.assertAlmostEqual(harvests.shortfall_pct(-3.0, -3.0), 0.0)

    def test_smaller_el_nino_harvest_is_positive(self):
        self.assertAlmostEqual(harvests.shortfall_pct(-10.0, 0.0), 10.0)

    def test_relative_to_the_neutral_harvest(self):
        # El Niño at trend, neutral 10% above it: El Niño harvests are 1/1.1 of neutral ones, 9.09% smaller
        self.assertAlmostEqual(harvests.shortfall_pct(0.0, 10.0), 100 / 11, places=6)


class Phases(unittest.TestCase):
    def table(self, m49):
        years = range(enso.FIRST_YEAR, enso.LAST_YEAR + 1)
        return pd.DataFrame({'m49': m49, 'year': list(years), 'vs_trend': 0.0})

    def test_same_year_harvest(self):
        phased = harvests.by_phase(self.table('356'))   # India: harvest in the onset year
        self.assertEqual(set(phased.loc[phased['phase'] == 'El Niño', 'year']), enso.EL_NINO_YEARS)

    def test_harvest_the_year_after(self):
        phased = harvests.by_phase(self.table('716'))   # Zimbabwe: harvest the year after
        expected = {y + 1 for y in enso.EL_NINO_YEARS if y + 1 <= enso.LAST_YEAR}
        self.assertEqual(set(phased.loc[phased['phase'] == 'El Niño', 'year']), expected)

    def test_la_nina_harvests_are_left_out(self):
        phased = harvests.by_phase(self.table('356'))
        self.assertFalse(set(phased['year']) & enso.LA_NINA_YEARS)

    def test_too_few_harvests_are_left_out(self):
        table = self.table('356')
        self.assertIn('356', harvests.shortfalls(table, harvests.MAP_MIN_HARVESTS).index)
        self.assertNotIn('356', harvests.shortfalls(table, (len(enso.EL_NINO_YEARS) + 1, 0)).index)


class Trend(unittest.TestCase):
    def test_window_rounds_up(self):
        # 23 years at a span of 0.3: 6.9 years, so each local fit uses 7; statsmodels alone would use 6
        rng = np.random.default_rng(1)
        years = np.arange(2000, 2023)
        tonnes = 1e6 + 2e4 * (years - 2000) + rng.normal(0, 5e4, len(years))
        np.testing.assert_allclose(harvests.trend(years, tonnes), reference_lowess(years, tonnes, harvests.TREND_SPAN), rtol=1e-9)

    def test_short_series_uses_at_least_four_years(self):
        years, tonnes = np.arange(2010, 2018), np.array([5, 9, 4, 8, 6, 9, 5, 7], float)
        np.testing.assert_allclose(harvests.trend(years, tonnes), reference_lowess(years, tonnes, harvests.TREND_SPAN), rtol=1e-9)


class PublishedValues(unittest.TestCase):
    """The pipeline reproduces the shortfalls and p-values in src/data.js."""

    @classmethod
    def setUpClass(cls):
        from pipeline.countries import COUNTRIES, PRODUCTION, TESTED
        cls.countries, cls.tested = COUNTRIES, TESTED
        cls.anomalies = harvests.against_trend(PRODUCTION[PRODUCTION['m49'].isin(TESTED)])

    def test_shortfalls(self):
        table = harvests.shortfalls(self.anomalies, harvests.MAP_MIN_HARVESTS)
        self.assertEqual(set(table.index), self.tested)
        for m49, row in table.iterrows():
            self.assertEqual(round(float(row['shortfall']), 1), self.countries[m49]['harvestShortfall'], m49)

    def test_p_values(self):
        phased = harvests.by_phase(self.anomalies)
        for m49 in ['516', '716', '710', '454', '036']:
            mine = phased[phased['m49'] == m49]
            p = harvests.mann_whitney_p(mine.loc[mine['phase'] == 'El Niño', 'vs_trend'], mine.loc[mine['phase'] == 'neutral', 'vs_trend'])
            self.assertEqual(round(float(p), 3), self.countries[m49]['shortfallPValue'], m49)


if __name__ == '__main__':
    unittest.main()
