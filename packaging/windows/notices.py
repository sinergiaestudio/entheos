"""Preserve all bundled dependency license texts from installed distributions."""
import importlib.metadata
import pathlib
import sys
import shutil
out = pathlib.Path('dist/ANATHEOS/THIRD_PARTY')
for source in pathlib.Path(sys.base_prefix).glob('LICENSE*'):
    shutil.copy2(source, out / source.name)
for name in ('numpy', 'Pillow', 'pyinstaller'):
    dist = importlib.metadata.distribution(name)
    for file in dist.files or []:
        if any(word in str(file).lower() for word in ('license', 'copying')) and dist.locate_file(file).is_file():
            target = out / name / str(file).replace('..', '_')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(dist.locate_file(file).read_bytes())
