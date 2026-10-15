import base64
import re

with open('assets/icons/ksa-official-logo.svg', 'r', encoding='utf-8') as f:
    svg_txt = f.read()

m = re.search(r'xlink:href="data:image/png;base64,([^"]+)"', svg_txt)
if m:
    data = base64.b64decode(m.group(1))
    with open('assets/icons/ksa-logo.png', 'wb') as out_f:
        out_f.write(data)
    print('Saved assets/icons/ksa-logo.png, size:', len(data))
else:
    print('Base64 not found')
