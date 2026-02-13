import os
import requests
import re
from urllib.parse import urljoin

CSS_URL = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Outfit:wght@300;400;500;600;700&display=swap"
FONTS_DIR = "assets/fonts"
CSS_FILE = os.path.join(FONTS_DIR, "google-fonts.css")

os.makedirs(FONTS_DIR, exist_ok=True)

print(f"Downloading CSS from {CSS_URL}...")
try:
    # Need User-Agent to get woff2, otherwise might get ttf/woff which is fine too but woff2 is better
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    response = requests.get(CSS_URL, headers=headers)
    response.raise_for_status()
    css_content = response.text
except requests.RequestException as e:
    print(f"Error downloading CSS: {e}")
    exit(1)

# Find all font URLs
font_urls = re.findall(r'url\((https?://[^\)]+)\)', css_content)
font_map = {}

print(f"Found {len(font_urls)} font files.")

for url in set(font_urls):
    filename = url.split('/')[-1]
    # Clean filename of query params if any, though usually clean in fonts
    if '?' in filename:
        filename = filename.split('?')[0]
    
    local_path = os.path.join(FONTS_DIR, filename)
    relative_path = filename # in CSS it will be relative to the CSS file
    
    print(f"Downloading {filename}...")
    try:
        font_resp = requests.get(url)
        font_resp.raise_for_status()
        with open(local_path, 'wb') as f:
            f.write(font_resp.content)
        font_map[url] = relative_path
    except requests.RequestException as e:
        print(f"Failed to download {url}: {e}")

# Replace URLs in CSS
new_css_content = css_content
for url, local_file in font_map.items():
    new_css_content = new_css_content.replace(url, local_file)

with open(CSS_FILE, 'w', encoding='utf-8') as f:
    f.write(new_css_content)

print(f"Saved local CSS to {CSS_FILE}")
