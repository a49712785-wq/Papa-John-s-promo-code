#!/usr/bin/env python3
"""Pre-render the promo-code cards as static semantic HTML.

Reads the DEALS array from js/deals.js, renders one <article> card per
deal (same markup the JS would generate), and injects them into the
#pjGrid container in index.html. Run this every time js/deals.js changes:

    python3 tools/build_codes.py

The JS (js/deals.js) hydrates the static cards on load: it will NOT wipe
them, it only binds the modal, filters and search on top.
"""
import html
import io
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEALS_JS = os.path.join(ROOT, 'js', 'deals.js')
INDEX_HTML = os.path.join(ROOT, 'index.html')

CHECK_SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" '
             'width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>')
CLOCK_SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
             'width="11" height="11"><circle cx="12" cy="12" r="10"/>'
             '<path d="M12 6v6l4 2"/></svg>')
EYE_SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
           'stroke-width="2" width="13" height="13">'
           '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>'
           '<circle cx="12" cy="12" r="3"/></svg>')
WARN_SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
            'width="14" height="14"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>'
            '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>')

VERIFY_META = {
    'confirmed': ('Community-reported', 'confirmed'),
    'checkout': ('Confirm at checkout', 'checkout'),
    'official': ('Official offer', 'official'),
    'expired': ('Expired', 'expired'),
}


def mask_code(code):
    visible = min(3, max(2, len(code) - 3))
    return code[:visible] + '\u2022' * max(3, len(code) - visible)


def load_deals():
    dump = subprocess.run(
        ['node', '-e',
         'const fs=require("fs");'
         'const s=fs.readFileSync(process.argv[1],"utf8");'
         'const m=s.match(/var DEALS = (\\[[\\s\\S]*?\\n  \\]);/);'
         'const d=eval(m[1]);'
         'const l=s.match(/var LAST_CHECKED = \'([^\']+)\'/);'
         'console.log(JSON.stringify({deals:d,lastChecked:l[1]}));',
         DEALS_JS],
        capture_output=True, text=True, check=True)
    return json.loads(dump.stdout)


def card_html(d, idx, last_checked):
    label, cls = VERIFY_META[d['verify']]
    is_expired = d['verify'] == 'expired'
    checked = d.get('checked') or last_checked
    badge_icon = WARN_SVG if is_expired else CHECK_SVG
    tag_cls = 'code' if d['type'] == 'code' else 'member'
    if d['type'] == 'code':
        if is_expired:
            footer = '<span class="pj-masked">Expired code</span>'
        else:
            footer = (
                '<div class="pj-code-row">'
                '<code class="pj-code-text">{code}</code>'
                '<button type="button" class="pj-copy-inline pj-copy-btn" '
                'data-code="{code}">Copy</button></div>'
                '<button type="button" class="pj-details-btn" '
                'data-idx="{idx}">Terms and details</button>'
            ).format(idx=idx, code=html.escape(d['code']))
    else:
        footer = (
            '<button type="button" class="pj-btn-offer" data-idx="{idx}">'
            '{check} Get official deal &amp; offers</button>'
        ).format(idx=idx, check=CHECK_SVG)
    return (
        '<article class="pj-card{exp}">'
        '<div class="pj-card-top">'
        '<span class="pj-tag {tag_cls}">{tag}</span>'
        '<span class="pj-ribbon">{discount}</span>'
        '</div>'
        '<div class="pj-card-body">'
        '<h3 class="pj-card-title">{title}</h3>'
        '<p class="pj-card-desc">{desc}</p>'
        '</div>'
        '<div class="pj-verify-row">'
        '<span class="pj-verify-badge {cls}">{icon} {label}</span>'
        '<span class="pj-last-checked">{clock} {checked}</span>'
        '</div>'
        '<div class="pj-card-footer">{footer}</div>'
        '<details class="pj-terms"><summary>Terms and restrictions</summary>'
        '<p>{restrict}</p></details>'
        '</article>'
    ).format(
        exp=' is-expired' if is_expired else '',
        tag_cls=tag_cls, tag=html.escape(d['tag']),
        discount=html.escape(d['discount']),
        title=html.escape(d['title']), desc=html.escape(d['desc']),
        cls=cls, icon=badge_icon, label=label,
        clock=CLOCK_SVG, checked=html.escape(checked),
        footer=footer, restrict=html.escape(d['restrict']))


def main():
    data = load_deals()
    cards = '\n'.join(card_html(d, i, data['lastChecked'])
                      for i, d in enumerate(data['deals']))
    s = io.open(INDEX_HTML, encoding='utf-8').read()
    new_grid = '<div id="pjGrid" class="pj-grid">\n%s\n    </div>' % cards
    s2, n = re.subn(r'<div id="pjGrid" class="pj-grid">\s*</div>', new_grid, s, count=1)
    if n != 1:
        raise SystemExit('pjGrid container not found (is it already filled? '
                         'clear it to an empty div first)')
    io.open(INDEX_HTML, 'w', encoding='utf-8').write(s2)
    print('rendered %d cards into #pjGrid' % len(data['deals']))


if __name__ == '__main__':
    main()
