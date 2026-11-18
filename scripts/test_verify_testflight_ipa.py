import copy
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('verifier', pathlib.Path(__file__).with_name('verify-testflight-ipa.py'))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class VersionTests(unittest.TestCase):
    def setUp(self):
        self.bundles = [{'CFBundleVersion': '53', 'CFBundleShortVersionString': '1.0.4'} for _ in range(2)]
        self.inventory = {'numbers': ['51', '52'], 'selected': '53'}

    def test_matching_app_and_extension(self):
        self.assertEqual(verifier.validate(self.bundles, '1.0.4', self.inventory), '53')

    def test_extension_mismatches(self):
        for key, value in [('CFBundleVersion', '52'), ('CFBundleShortVersionString', '1.0.3')]:
            bundles = copy.deepcopy(self.bundles)
            bundles[1][key] = value
            with self.assertRaises(ValueError):
                verifier.validate(bundles, '1.0.4', self.inventory)

    def test_used_or_skipped_number(self):
        for number in ['52', '54']:
            bundles = copy.deepcopy(self.bundles)
            for bundle in bundles:
                bundle['CFBundleVersion'] = number
            with self.assertRaises(ValueError):
                verifier.validate(bundles, '1.0.4', self.inventory)

    def test_reservation_can_be_ahead_of_apple_inventory(self):
        inventory = {'numbers': ['51'], 'selected': '53'}
        self.assertEqual(verifier.validate(self.bundles, '1.0.4', inventory), '53')

    def test_missing_extension(self):
        with self.assertRaises(ValueError):
            verifier.validate(self.bundles[:1], '1.0.4', self.inventory)


if __name__ == '__main__':
    unittest.main()
