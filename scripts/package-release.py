"""Package the checked-out revision and its verified production build. Standard library only."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile


parser = argparse.ArgumentParser()
parser.add_argument('--out', default='release')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
output = Path(args.out).resolve()
output.mkdir(parents=True, exist_ok=True)
version = json.loads((repo / 'package.json').read_text(encoding='utf-8'))['version']
prefix = f'quorum-lab-v{version}'
if not (repo / 'dist' / 'index.html').is_file():
    raise SystemExit('Build the production application before packaging.')

head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo).strip()
main = subprocess.check_output(['git', 'rev-parse', 'main'], cwd=repo).strip()
if head != main:
    raise SystemExit('Package main at the exact checked-out revision.')

source = output / f'{prefix}-source.zip'
subprocess.run(['git', 'archive', '--format=zip', '--prefix=quorum-lab/',
                f'--output={source}', 'HEAD'], cwd=repo, check=True)

demo = output / f'{prefix}-demo.zip'
with tempfile.TemporaryDirectory(prefix='quorum-package-', dir=output) as directory:
    staging = Path(directory) / 'quorum-lab-demo'
    shutil.copytree(repo / 'dist', staging / 'site')
    shutil.copytree(repo / 'docs' / 'experiments', staging / 'experiments')
    shutil.copy2(repo / 'scripts' / 'serve.mjs', staging / 'serve.mjs')
    shutil.copy2(repo / 'LICENSE', staging / 'LICENSE')
    (staging / 'START.cmd').write_bytes(
        b'@echo off\r\ncd /d "%~dp0"\r\nnode serve.mjs site --open\r\npause\r\n')
    (staging / 'README.txt').write_text(
        f'Quorum Lab v{version} - portable production observatory\n\n'
        'Requires Node.js 22.12+ and a modern browser. No npm install needed.\n'
        'Windows: double-click START.cmd.\n'
        'Other platforms: node serve.mjs site\n'
        'Open http://127.0.0.1:4173/quorum-lab/\n'
        'Use the automatic six-chapter tour or import a fixture from experiments/.\n'
        'The simulation and all UI assets run locally.\n'
        'Source: https://github.com/qiyuhuating/quorum-lab\n', encoding='utf-8')
    with zipfile.ZipFile(demo, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(staging.rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(staging.parent))

for file in (source, demo):
    with zipfile.ZipFile(file) as archive:
        if archive.testzip() is not None:
            raise SystemExit(f'Archive integrity check failed: {file.name}')
with zipfile.ZipFile(source) as archive:
    packaged = json.loads(archive.read('quorum-lab/package.json'))
    if packaged['version'] != version:
        raise SystemExit('Source version differs from the packaged build.')

bundle = output / f'{prefix}.bundle'
subprocess.run(['git', 'bundle', 'create', str(bundle), 'main'], cwd=repo, check=True)
subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=repo,
               check=True, stdout=subprocess.DEVNULL)
checksums = output / 'SHA256SUMS.txt'
checksums.write_text(''.join(
    f'{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.name}\n'
    for file in (source, demo, bundle)), encoding='utf-8')
for file in (source, demo, bundle, checksums):
    print(f'{file.name}: {file.stat().st_size} bytes')
