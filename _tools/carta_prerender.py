"""Zet de Spaanse carta als gewone HTML in carta/index.html (voor Google en snel laden)
en maakt de Menu-gegevens (JSON-LD). Bron = het MENU-object in carta/index.html.
Gebruik na elke wijziging van de carta:  python3 _tools/carta_prerender.py
"""
import re, json, html, pathlib, sys
P = pathlib.Path(__file__).resolve().parent.parent / 'carta' / 'index.html'
s = P.read_text(encoding='utf8')
MENU = json.loads(re.search(r'const MENU = (\{.*?\});\n', s, re.S).group(1))
FOTOS = json.loads(re.search(r'const FOTOS = (\{.*?\});', s).group(1))
cam = re.search(r"const cam = '(.*?)';", s).group(1)
es_block = re.search(r"\n  es:\{(.*?)\},?\n", s).group(1)
T = dict(re.findall(r"(\w+):'((?:[^'\\]|\\.)*)'", es_block))
esc = lambda x: html.escape(str(x), quote=True).replace('&#x27;', "'")

def sub(pattern, repl):
    global s
    s, n = re.subn(pattern, lambda m: repl, s, count=1, flags=re.S)
    if n != 1: sys.exit('niet gevonden: ' + pattern)

cats = MENU['es']
sub(r'<p class="eyebrow" id="t-eyebrow">.*?</p>', f'<p class="eyebrow" id="t-eyebrow">{T["eyebrow"]}</p>')
sub(r'<h1 id="t-title">.*?</h1>', f'<h1 id="t-title">{T["title"]}</h1>')
sub(r'<p class="lead" id="t-lead">.*?</p>', f'<p class="lead" id="t-lead">{T["lead"]}</p>')
sub(r'<p id="t-foot">.*?</p><a href="../" id="t-home">.*?</a>', f'<p id="t-foot">{T["foot"]}</p><a href="../" id="t-home">{T["home"]}</a>')
sub(r'<nav id="cats" aria-label="[^"]*">.*?</nav>',
    '<nav id="cats" aria-label="%s">' % T['cats'] + ''.join(f'<a href="#cat-{i}">{esc(c["c"])}</a>' for i, c in enumerate(cats)) + '</nav>')

def item(i, j, it):
    f = FOTOS.get(f'{i}-{j}')
    out = f'<li class="item"><div class="row"><h3>{esc(it["n"])}</h3><span class="price">{esc(it["p"])}</span></div>'
    if it.get('d'): out += f'<p class="desc">{esc(it["d"])}</p>'
    if f: out += f'<button class="photo-btn" type="button" data-k="{i}-{j}">{cam}{T["foto"]}</button>'
    return out + '</li>'
secs = []
for i, c in enumerate(cats):
    h = f'\n    <section class="cat" id="cat-{i}" aria-labelledby="cat-{i}-h">\n      <h2 id="cat-{i}-h">{esc(c["c"])}</h2>\n      <ul class="items">' + ''.join(item(i, j, it) for j, it in enumerate(c['i'])) + '</ul>'
    if c.get('notas'): h += '\n      <div class="notes">' + ''.join(f'<p>{esc(n)}</p>' for n in c['notas']) + '</div>'
    if c.get('grupos'): h += '\n      <div class="groups">' + ''.join('<div class="group"><h4>%s</h4><ul>%s</ul></div>' % (esc(g['t']), ''.join(f'<li><span>{esc(o[0])}</span>' + (f'<strong>{esc(o[1])}</strong>' if o[1] else '') + '</li>' for o in g['o'])) for g in c['grupos']) + '</div>'
    secs.append(h + '\n    </section>')
sub(r'<main class="wrap" id="menu">.*?</main>', '<main class="wrap" id="menu">' + ''.join(secs) + '\n</main>')

def price(p):
    m = re.search(r'(\d+),(\d\d)', p)
    return f'{m.group(1)}.{m.group(2)}' if m else None
menu = {"@context": "https://schema.org", "@type": "Menu", "@id": "https://luma-brunch.es/carta/#menu",
        "name": "La carta de Luma Brunch", "url": "https://luma-brunch.es/carta/", "inLanguage": "es",
        "hasMenuSection": []}
for c in cats:
    sec = {"@type": "MenuSection", "name": c['c'], "hasMenuItem": []}
    for it in c['i']:
        mi = {"@type": "MenuItem", "name": it['n']}
        if it.get('d'): mi['description'] = it['d']
        pr = price(it['p'])
        if pr: mi['offers'] = {"@type": "Offer", "price": pr, "priceCurrency": "EUR"}
        sec['hasMenuItem'].append(mi)
    menu['hasMenuSection'].append(sec)
ld = '<script type="application/ld+json" id="menu-schema">' + json.dumps(menu, ensure_ascii=False, separators=(',', ':')) + '</script>'
if 'id="menu-schema"' in s: sub(r'<script type="application/ld\+json" id="menu-schema">.*?</script>', ld)
else: sub(r'</head>', ld + '\n</head>')
P.write_text(s, encoding='utf8')
print('ok:', len(cats), 'categorieën,', sum(len(c['i']) for c in cats), 'gerechten')
