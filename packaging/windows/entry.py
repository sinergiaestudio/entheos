"""Frozen entry point. Explicit child mode prevents recursive server launches."""
import io
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(getattr(sys, '_MEIPASS', pathlib.Path(__file__).resolve().parents[2]))
sys.path[:0] = [str(ROOT / 'research/anatheos-cmr/r2'), str(ROOT / 'research/anatheos-cmr/w1')]

def main():
    if '--prepare' in sys.argv:
        from preparar_todas_las_series import main as prepare
        return prepare(sys.argv[2:])
    if '--self-test' in sys.argv:
        import numpy as np
        from PIL import Image, features
        assert features.check('jpg_2000')
        pixels = np.arange(1024, dtype=np.uint16).reshape(32, 32)
        stream = io.BytesIO()
        Image.fromarray(pixels).save(stream, format='JPEG2000', irreversible=False)
        stream.seek(0)
        assert np.array_equal(np.asarray(Image.open(stream)), pixels)
        assert (ROOT / 'demos/anatheos-local-v0.5/index.html').is_file()
        manifest = pathlib.Path(sys.executable).parent / 'version.json'
        version = json.loads(manifest.read_text())['version'] if manifest.exists() else 'development'
        print(json.dumps({'jpeg2000': 'PASS', 'version': version}))
        return 0
    data = pathlib.Path(os.environ['LOCALAPPDATA']) / 'ANATHEOS'
    for name in ('projects', 'preferences', 'temp'):
        (data / name).mkdir(parents=True, exist_ok=True)
    import tempfile
    tempfile.tempdir = str(data / 'temp')
    from servidor_anatheos_unificado import main as serve
    return serve(sys.argv[1:] or ['--open-browser'])

if __name__ == '__main__':
    raise SystemExit(main())
