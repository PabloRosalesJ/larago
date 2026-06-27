#!/usr/bin/env python3
"""Extract structure from a Laravel docs page: headings, code blocks, TOC."""
import sys, json, re, urllib.request

URLS = [
    # Prólogo
    "https://laravel.com/docs/13.x/releases",
    "https://laravel.com/docs/13.x/upgrade",
    "https://laravel.com/docs/13.x/contributions",
    # Getting Started
    "https://laravel.com/docs/13.x/installation",
    "https://laravel.com/docs/13.x/configuration",
    "https://laravel.com/docs/13.x/structure",
    "https://laravel.com/docs/13.x/deployment",
    # Arquitectura
    "https://laravel.com/docs/13.x/lifecycle",
    "https://laravel.com/docs/13.x/container",
    "https://laravel.com/docs/13.x/providers",
    "https://laravel.com/docs/13.x/facades",
    # The Basics
    "https://laravel.com/docs/13.x/routing",
    "https://laravel.com/docs/13.x/middleware",
    "https://laravel.com/docs/13.x/csrf",
    "https://laravel.com/docs/13.x/controllers",
    "https://laravel.com/docs/13.x/requests",
    "https://laravel.com/docs/13.x/responses",
    "https://laravel.com/docs/13.x/views",
    "https://laravel.com/docs/13.x/session",
    "https://laravel.com/docs/13.x/validation",
    "https://laravel.com/docs/13.x/errors",
    "https://laravel.com/docs/13.x/logging",
    # Seguridad
    "https://laravel.com/docs/13.x/authentication",
    "https://laravel.com/docs/13.x/authorization",
    "https://laravel.com/docs/13.x/encryption",
    "https://laravel.com/docs/13.x/hashing",
    "https://laravel.com/docs/13.x/passwords",
    # Database
    "https://laravel.com/docs/13.x/database",
    "https://laravel.com/docs/13.x/queries",
    "https://laravel.com/docs/13.x/pagination",
    "https://laravel.com/docs/13.x/migrations",
    "https://laravel.com/docs/13.x/seeding",
    # Digging Deeper
    "https://laravel.com/docs/13.x/cache",
    "https://laravel.com/docs/13.x/events",
    "https://laravel.com/docs/13.x/filesystem",
    "https://laravel.com/docs/13.x/http-client",
    "https://laravel.com/docs/13.x/mail",
    "https://laravel.com/docs/13.x/notifications",
    "https://laravel.com/docs/13.x/queues",
    "https://laravel.com/docs/13.x/scheduling",
    # Testing
    "https://laravel.com/docs/13.x/testing",
    "https://laravel.com/docs/13.x/http-tests",
    "https://laravel.com/docs/13.x/database-testing",
    "https://laravel.com/docs/13.x/mocking",
    # AI
    "https://laravel.com/docs/13.x/ai",
]

def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8")

def extract_structure(html):
    # Remove script/style blocks
    html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL)

    # Find JSON index embedded in page
    index_match = re.search(r'"index":(\[.*?\]),\s*"tableOfContents"', html, re.DOTALL)

    # Extract TOC from JSON
    toc_items = []
    toc_match = re.search(r'"tableOfContents":(\[.*?\]),\s*"currentVersion"', html, re.DOTALL)
    if toc_match:
        try:
            toc = json.loads(toc_match.group(1))
            for item in toc:
                entry = {"text": item.get("text",""), "href": item.get("href",""), "children": []}
                for child in item.get("children", []):
                    entry["children"].append({"text": child.get("text",""), "href": child.get("href","")})
                toc_items.append(entry)
        except:
            pass

    # Extract all headings
    headings = []
    for match in re.finditer(r'<h([1-4])[^>]*id="([^"]*)"[^>]*>(.*?)</h\1>', html, re.DOTALL):
        level = int(match.group(1))
        hid = match.group(2)
        text = re.sub(r'<[^>]+>', '', match.group(3)).strip()
        headings.append({"level": level, "id": hid, "text": text})

    # Count code blocks
    code_blocks = len(re.findall(r'<pre[^>]*><code', html))

    # Extract first h1 for title
    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
    title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else ""

    # Find related pages (docs links)
    related = list(set(re.findall(r'href="/docs/13\.x/([a-z-]+)"', html)))

    return {
        "url": "",
        "title": title,
        "headings": headings,
        "toc": toc_items,
        "code_blocks": code_blocks,
        "related_pages": related,
    }

base = "https://laravel.com/docs/13.x"

for url in URLS:
    slug = url.replace(base, "").strip("/")
    print(f"Scraping: {slug}...", file=sys.stderr)
    try:
        html = fetch_text(url)
        data = extract_structure(html)
        data["url"] = url
        filename = f"scraped/{slug}.json"
        with open(filename, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  ✅ {slug} — {data['title']} ({data['code_blocks']} code blocks, {len(data['headings'])} headings)", file=sys.stderr)
    except Exception as e:
        print(f"  ❌ {slug}: {e}", file=sys.stderr)
