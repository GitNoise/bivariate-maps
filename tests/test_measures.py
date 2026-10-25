"""The second measures' classes, and what the walk-forward test may know in each round."""
import unittest

import pandas as pd

from pipeline import enso, measures, walkforward


class Classes(unittest.TestCase):
    def classes(self, measure, values, year=2022):
        return list(measures.classes(measure, pd.Series(values, dtype=float), year))

    def test_higher_is_weaker(self):
        self.assertEqual(self.classes('imports', [0, 24.9, 25, 49.9, 50, 90]), [0, 0, 1, 1, 2, 2])

    def test_lower_is_weaker(self):
        self.assertEqual(self.classes('hdi', [0.9, 0.700, 0.699, 0.550, 0.549]), [0, 0, 1, 1, 2])

    def test_missing_value_has_no_class(self):
        self.assertTrue(pd.isna(self.classes('poverty', [float('nan')])[0]))

    def test_income_thresholds_of_the_time(self):
        # 4200 a person: middle income by the thresholds before 2020, lower by those from 2020
        self.assertEqual(self.classes('gdp', [4200], 2019), [0])
        self.assertEqual(self.classes('gdp', [4200], 2020), [1])


class KnownBeforeTheRound(unittest.TestCase):
    def test_only_earlier_el_ninos_and_harvests(self):
        anomalies = walkforward.anomalies()
        for rnd in walkforward.ROUNDS:
            known = anomalies[anomalies['year'] <= rnd.last_harvest]
            el_ninos = {y for y in enso.EL_NINO_YEARS if y <= rnd.last_el_nino}
            expected = walkforward.harvests.shortfalls(known, walkforward.MIN_HARVESTS_PER_ROUND, el_ninos)['shortfall']
            pd.testing.assert_series_equal(walkforward.shortfalls_known_before(rnd), expected, check_names=False)

    def test_classes_as_known_then(self):
        o = walkforward.outcomes()
        cls = measures.classes_known_then(o, 'gdp')
        for i in [0, len(o) - 1]:
            row = o.iloc[i]
            self.assertEqual(cls.iloc[i], measures.known_in(row['last_harvest']).at[row['m49'], 'gdp_class'])


if __name__ == '__main__':
    unittest.main()
