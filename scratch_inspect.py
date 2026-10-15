import urllib.request
import re
from bs4 import BeautifulSoup
from collections import Counter

url = 'https://www.ksa.be'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
soup = BeautifulSoup(html, 'html.parser')

styles = [s.get('href') for s in soup.find_all('link', rel='stylesheet')]
print('Stylesheets:')
for s in styles:
    print(' ', s)

# Download and analyze steam theme css
steam_css_urls = [s for s in styles if 'steam' in s]
all_css = ''
for s in steam_css_urls:
    full_url = s if s.startswith('http') else 'https://www.ksa.be' + s
    css_content = urllib.request.urlopen(urllib.request.Request(full_url, headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8', errors='ignore')
    all_css += css_content

colors = re.findall(r'#(?:[0-9a-fA-F]{3}){1,2}', all_css)
print('\nTop Colors:')
for c, cnt in Counter([col.lower() for col in colors]).most_common(25):
    print(f'  {c}: {cnt}')

fonts = re.findall(r'font-family\s*:\s*([^;\}]+)', all_css)
print('\nTop Fonts:')
for f, cnt in Counter([font.strip() for font in fonts]).most_common(10):
    print(f'  {f}: {cnt}')

# Look at main layout elements, nav, headers
print('\nKey CSS selectors:')
classes = re.findall(r'\.([a-zA-Z0-9_\-]+)\s*\{', all_css)
for cl, cnt in Counter(classes).most_common(20):
    print(f'  .{cl}: {cnt}')
