import unittest

from metrics import bootstrap_ci, cohen_kappa, precision_recall, quadratic_weighted_kappa


class KappaTest(unittest.TestCase):
    def test_nominal(self):
        # po = 3/4; pe = (2*1 + 2*3)/16 = 0.5; kappa = 0.25/0.5
        self.assertEqual(cohen_kappa(["yes", "yes", "no", "no"], ["yes", "no", "no", "no"]), 0.5)

    def test_identical_and_degenerate(self):
        self.assertEqual(cohen_kappa(["yes", "no"], ["yes", "no"]), 1.0)
        self.assertIsNone(cohen_kappa(["yes", "yes"], ["yes", "yes"]))
        self.assertIsNone(cohen_kappa([], []))

    def test_qwk(self):
        cats = [0, 5, 10, 15, 20]
        self.assertEqual(quadratic_weighted_kappa([0, 20], [20, 0], cats), -1.0)
        self.assertEqual(quadratic_weighted_kappa([0, 20, 10], [0, 20, 10], cats), 1.0)
        self.assertIsNone(quadratic_weighted_kappa([], [], cats))
        self.assertIsNone(quadratic_weighted_kappa([5, 5], [5, 5], cats))


class BootstrapTest(unittest.TestCase):
    def test_deterministic_and_contains_estimate(self):
        units = [1, 0, 1, 1, 0, 1, 1, 1]
        mean = lambda xs: sum(xs) / len(xs)
        ci = bootstrap_ci(units, mean, n=200, seed=3)
        self.assertEqual(ci, bootstrap_ci(units, mean, n=200, seed=3))
        self.assertLessEqual(ci[0], mean(units))
        self.assertGreaterEqual(ci[1], mean(units))

    def test_empty(self):
        self.assertIsNone(bootstrap_ci([], len))


class PrecisionRecallTest(unittest.TestCase):
    def test_hand_case(self):
        # reference yes,yes,no,no ; prediction yes,no,yes,no -> tp1 fn1 fp1
        r = precision_recall(["yes", "yes", "no", "no"], ["yes", "no", "yes", "no"])
        self.assertEqual((r["tp"], r["fp"], r["fn"]), (1, 1, 1))
        self.assertEqual((r["precision"], r["recall"]), (0.5, 0.5))

    def test_undefined(self):
        r = precision_recall(["no"], ["no"])
        self.assertIsNone(r["precision"])
        self.assertIsNone(r["recall"])


if __name__ == "__main__":
    unittest.main()
