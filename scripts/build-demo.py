"""Empaqueta el bundle generado por esbuild con los estilos y configuración demo.
Uso: python3 scripts/build-demo.py /tmp/garaje-demo-bundle.js
"""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
css = re.sub(r'@import\s+url\([^)]*\);', '', (root / 'styles.css').read_text(), count=1)
bundle = Path(sys.argv[1]).read_text().replace('</script', '<\\/script')
config = "window.GARAJE_CONFIG = Object.freeze({demo:true,supabaseUrl:'',supabaseAnonKey:'',enablePaymentSimulation:true});"
html = ('<!doctype html><html lang="es-CL"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Garaje Premium · Demo interactiva</title><style>' + css +
        '</style></head><body><div id="app"><div class="loading">Preparando tu garaje…</div></div>'
        '<div id="toast" role="status" aria-live="polite"></div>'
        '<dialog id="modal" aria-labelledby="modal-title"></dialog><script>' + config + '\n' + bundle +
        '</script></body></html>')
(root / 'demo.html').write_text(html)
print('demo.html generado, sin dependencias externas y sin configuración privada.')
