import unittest

from app.drawing_utils import smooth_point, toolbar_action


class DrawingUtilsTests(unittest.TestCase):
    def test_smooth_point_without_previous_returns_current(self):
        self.assertEqual(smooth_point(None, (10, 20)), (10, 20))

    def test_smooth_point_blends_coordinates(self):
        self.assertEqual(smooth_point((0, 0), (10, 10), alpha=0.5), (5, 5))

    def test_toolbar_action_routes_segments(self):
        self.assertEqual(toolbar_action(10, 600), ("color", "blue"))
        self.assertEqual(toolbar_action(560, 600), ("mode", "erase"))


if __name__ == "__main__":
    unittest.main()
