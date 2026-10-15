import requests
import re
from bs4 import BeautifulSoup

url = 'https://sites.google.com/view/ksazonhoven/media'
s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

r = s.get(url)
soup = BeautifulSoup(r.text, 'html.parser')

print("All 'a' tags:")
for a in soup.find_all('a'):
    print(a.get('href'), '-->', a.get_text(strip=True))

# Test subpages
candidates = [
    'https://sites.google.com/view/ksazonhoven/media/het-kamp',
    'https://sites.google.com/view/ksazonhoven/media/kamp',
    'https://sites.google.com/view/ksazonhoven/het-kamp',
    'https://sites.google.com/view/ksazonhoven/kamp'
]
for c in candidates:
    rc = s.get(c)
    print(c, '-->', rc.status_code)
    if rc.status_code == 200:
        sp = BeautifulSoup(rc.text, 'html.parser')
        imgs = sp.find_all('img')
        print(f"  Found {len(imgs)} imgs on {c}")
        for im in imgs:
            print("   img:", im.get('src')[:80])

# Search in JS data of media page for drive or photo IDs
ids = re.findall(r'https://[^"]+(?:drive|googleusercontent|sitesv)[^"]+', r.text)
print(f"\nFound {len(ids)} media urls in page:")
for i in set(ids):
    print(" ", i[:100])
