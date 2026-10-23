"""Installer checks use a temporary fake MiSTer tree, never the live device."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASH = os.environ.get('BASH_BIN') or (r'C:\Program Files\Git\bin\bash.exe' if os.name == 'nt' else shutil.which('sh'))

def shell_path(path):
    path = Path(path).resolve()
    return '/' + path.drive[0].lower() + path.as_posix()[2:] if os.name == 'nt' else str(path)

class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mister-phone-play-test-')
        self.base = Path(self.temp.name).resolve()
        self.assertEqual(self.base.parent, Path(tempfile.gettempdir()).resolve())
        self.app = self.base / 'app'
        self.sd = self.base / 'sd'
        self.web = self.app / 'web'
        self.web.mkdir(parents=True)
        self.index = self.web / 'index.html'
        self.original = '<html>\n<head>\n<title>Fixture</title>\n</head>\n<body></body>\n</html>\n'
        self.index.write_text(self.original, encoding='utf-8')
        self.binary = self.app / 'mister-control'
        self.binary.write_bytes(b'#!/bin/sh\nprintf "0.8.3\\n"\n')
        self.binary.chmod(0o755)
        self.map = self.sd / 'config/inputs/input_4d43_0001_v3.map'
        self.env = dict(os.environ, MISTER_CONTROL_DIR=shell_path(self.app), MISTER_SD_ROOT=shell_path(self.sd))
    def tearDown(self):
        self.temp.cleanup()
    def run_installer(self, *args, package=ROOT, good=True):
        result = subprocess.run([BASH, shell_path(package / 'install.sh'), *args], env=self.env, capture_output=True, text=True)
        if good:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result
    def test_install_is_idempotent(self):
        self.run_installer()
        self.run_installer()
        html = self.index.read_text()
        self.assertEqual(html.count('<!-- mister-phone-play:begin -->'), 1)
        self.assertEqual(html.count('/phone-play/phone-play.js'), 1)
        self.assertEqual(self.map.stat().st_size, 128)
        self.assertEqual((self.web/'phone-play/phone-play.js').read_bytes(), (ROOT/'assets/phone-play.js').read_bytes())
        self.assertEqual(self.index.read_text().count('/phone-play/recording.js'), 1)
        self.assertEqual((self.web/'phone-play/recording.js').read_bytes(), (ROOT/'assets/recording.js').read_bytes())
    def test_remove_preserves_later_index_edits(self):
        self.run_installer()
        self.index.write_text(self.index.read_text().replace('Fixture', 'Edited later'))
        self.run_installer('--remove')
        self.assertIn('Edited later', self.index.read_text())
        self.assertNotIn('mister-phone-play:', self.index.read_text())
        self.assertFalse(self.map.exists())
        self.assertFalse((self.web/'phone-play').exists())
        self.assertTrue(list((self.app/'.phone-play').glob('index.*.html')))
    def test_existing_controller_map_is_preserved(self):
        self.map.parent.mkdir(parents=True)
        self.map.write_bytes(b'existing custom map')
        self.run_installer()
        self.run_installer('--remove')
        self.assertEqual(self.map.read_bytes(), b'existing custom map')
    def test_modified_created_map_is_preserved(self):
        self.run_installer()
        self.map.write_bytes(b'user changed this map')
        self.run_installer('--remove')
        self.assertEqual(self.map.read_bytes(), b'user changed this map')
    def test_unknown_version_is_rejected(self):
        self.binary.write_bytes(b'#!/bin/sh\nprintf "0.8.4\\n"\n')
        self.run_installer(good=False)
        self.assertEqual(self.index.read_text(), self.original)
        self.assertFalse(self.map.exists())
    def test_bad_asset_checksum_is_rejected(self):
        package = self.base/'package'
        package.mkdir()
        shutil.copy(ROOT/'install.sh', package/'install.sh')
        shutil.copy(ROOT/'ASSET-SHA256SUMS', package/'ASSET-SHA256SUMS')
        shutil.copytree(ROOT/'assets', package/'assets')
        (package/'assets/phone-play.css').write_text('changed asset')
        self.run_installer(package=package, good=False)
        self.assertEqual(self.index.read_text(), self.original)
    def test_prototype_replacement_requires_flag(self):
        prototype = self.original.replace('</head>', '<link href="/controller-layout-fix.css?v=old">\n<script src="/controller-view-fix.js?v=old"></script>\n</head>')
        self.index.write_text(prototype)
        self.run_installer(good=False)
        self.assertEqual(self.index.read_text(), prototype)
        self.run_installer('--replace-prototype')
        self.assertNotIn('controller-layout-fix', self.index.read_text())
        self.assertNotIn('controller-view-fix', self.index.read_text())
        self.assertIn('/phone-play/phone-play.js', self.index.read_text())
    def test_unbalanced_markers_are_rejected(self):
        broken = self.original.replace('</head>', '<!-- mister-phone-play:begin -->\n</head>')
        self.index.write_text(broken)
        self.run_installer(good=False)
        self.assertEqual(self.index.read_text(), broken)
    def test_missing_head_is_rejected(self):
        broken = '<html><body>custom page</body></html>'
        self.index.write_text(broken)
        self.run_installer(good=False)
        self.assertEqual(self.index.read_text(), broken)

if __name__ == '__main__':
    unittest.main(verbosity=2)
