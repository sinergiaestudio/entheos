import hashlib
import json
import pathlib
root = pathlib.Path('dist/ANATHEOS')
files = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in root.rglob('*') if p.is_file() and p.name != 'manifest.json'}
(root / 'manifest.json').write_text(json.dumps(files, sort_keys=True), encoding='utf-8')
