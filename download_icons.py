import os
import requests
import re
from urllib.parse import urljoin

ICONS_DIR = "assets/icons"
WEBFONTS_DIR = os.path.join(ICONS_DIR, "webfonts")

os.makedirs(ICONS_DIR, exist_ok=True)
os.makedirs(WEBFONTS_DIR, exist_ok=True)

def download_css_and_assets(css_url, local_css_name, headers=None):
    print(f"Processing {local_css_name} from {css_url}...")
    try:
        response = requests.get(css_url, headers=headers)
        response.raise_for_status()
        css_content = response.text
    except requests.RequestException as e:
        print(f"Error downloading CSS: {e}")
        return

    # Find all url(...) patterns
    # Handles quotes or no quotes
    urls = re.findall(r'url\([\'"]?([^\'"\)]+)[\'"]?\)', css_content)
    
    # Map original URL -> Local Relative Path
    url_map = {}
    
    for asset_url in set(urls):
        # Skip data URIs
        if asset_url.startswith('data:'):
            continue
            
        # Resolve absolute URL
        absolute_url = urljoin(css_url, asset_url)
        
        filename = asset_url.split('/')[-1]
        # Remove query params
        if '?' in filename:
            filename = filename.split('?')[0]
        if '#' in filename:
            filename = filename.split('#')[0]

        # Determine local path
        # For FontAwesome, keeping it in webfonts/ is standard
        # For Material Icons, they are usually flat, but we can put them in webfonts/ too for consistency or root of icons
        
        # Let's put everything in webfonts/ to be tidy, except maybe if it causes issues. 
        # Actually for FontAwesome structure: css/all.css refers to ../webfonts/
        # so if we save css in assets/icons/all.css, we should save fonts in assets/icons/webfonts/
        
        local_path = os.path.join(WEBFONTS_DIR, filename)
        relative_path = f"webfonts/{filename}"
        
        print(f"Downloading {filename}...")
        try:
            # Fake user agent for Google Fonts
            dl_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            asset_resp = requests.get(absolute_url, headers=dl_headers)
            asset_resp.raise_for_status()
            with open(local_path, 'wb') as f:
                f.write(asset_resp.content)
            url_map[asset_url] = relative_path
        except requests.RequestException as e:
            print(f"Failed to download {absolute_url}: {e}")

    # Replace URLs in CSS
    new_css_content = css_content
    for original_url, local_rel_path in url_map.items():
        new_css_content = new_css_content.replace(original_url, local_rel_path)

    local_css_path = os.path.join(ICONS_DIR, local_css_name)
    with open(local_css_path, 'w', encoding='utf-8') as f:
        f.write(new_css_content)
    print(f"Saved {local_css_name}")

# 1. Material Icons
# Use the woff2 version directly if possible or let the regex find it from the CSS
MATERIAL_ICONS_URL = "https://fonts.googleapis.com/icon?family=Material+Icons"
download_css_and_assets(MATERIAL_ICONS_URL, "material-icons.css", headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
})

# 2. FontAwesome 6 (Free)
FA_URL = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
download_css_and_assets(FA_URL, "fontawesome.css")
