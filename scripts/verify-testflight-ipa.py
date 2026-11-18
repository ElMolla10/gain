"""Validate the exported signed IPA, including every app extension."""
import hashlib
import json
import pathlib
import plistlib
import subprocess
import tempfile
import zipfile


def validate(bundles, expected_version, inventory):
    if len(bundles) < 2:
        raise ValueError('Expected app and Live Activity extension')
    build = bundles[0]['CFBundleVersion']
    if not str(build).isdigit() or str(build) != str(inventory['selected']):
        raise ValueError('Build does not match the reconciled reservation')
    if str(build) in inventory['numbers']:
        raise ValueError('Build number already used')
    for bundle in bundles:
        if bundle['CFBundleShortVersionString'] != expected_version or bundle['CFBundleVersion'] != build:
            raise ValueError('App/extension version mismatch')
    return str(build)


def main():
    directory = pathlib.Path('apps/mobile/build')
    ipa = directory / 'gain.ipa'
    expected = json.loads(pathlib.Path('apps/mobile/app.json').read_text(encoding='utf-8'))['expo']['version']
    inventory = json.loads((directory / 'testflight-preflight.json').read_text())
    with zipfile.ZipFile(ipa) as archive, tempfile.TemporaryDirectory() as temporary:
        for name in archive.namelist():
            if name.startswith('/') or '..' in pathlib.PurePosixPath(name).parts:
                raise ValueError('Unsafe IPA path')
        names = [n for n in archive.namelist() if n.startswith('Payload/') and
                 (n.count('/') == 2 and n.endswith('.app/Info.plist') or n.count('/') == 4 and n.endswith('.appex/Info.plist'))]
        names.sort(key=lambda n: (n.count('/'), n))
        bundles = [plistlib.loads(archive.read(n)) for n in names]
        build = validate(bundles, expected, inventory)
        # ditto preserves bundle symlinks and metadata needed by codesign.
        subprocess.run(['ditto', '-x', '-k', str(ipa.resolve()), temporary], check=True)
        for name in names:
            subprocess.run(['codesign', '--verify', '--deep', '--strict', '--verbose=2', str(pathlib.Path(temporary) / name.removesuffix('/Info.plist'))], check=True)
    report = {'version': expected, 'build': build, 'signatureVerified': True,
              'sha256': hashlib.sha256(ipa.read_bytes()).hexdigest(),
              'bundles': [{key: b[key] for key in ['CFBundleIdentifier', 'CFBundleShortVersionString', 'CFBundleVersion']} for b in bundles]}
    (directory / 'ipa-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
