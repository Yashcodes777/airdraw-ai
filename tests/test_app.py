import unittest

from app import create_app, engine


class AppRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()

    def test_index_route_renders(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'AirDraw AI', response.data)

    def test_state_route_updates_color_and_mode(self):
        response = self.client.post('/state', json={'color': 'red', 'mode': 'erase'})
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['color'], 'red')
        self.assertEqual(payload['mode'], 'erase')

    def test_state_route_triggers_clear_flag(self):
        engine.clear_requested = False
        response = self.client.post('/state', json={'clear': True})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(engine.consume_clear_request())


if __name__ == '__main__':
    unittest.main()
