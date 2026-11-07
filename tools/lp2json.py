#!/usr/bin/env python3
"""Bestehende Lernpfade (HTML) in das Bausteinformat des Lernpfad-Editors umwandeln.

  python3 tools/lp2json.py            → editor/beispiele/*.json + index.json

Unterstützt das FlowPad-Demo (h2-Stationen, data-flowpad-Knöpfe) und die Informatik-9-Lernpfade
(section.station, window.LP mit calcs/quiz/heft/files/dfd). Was in keinen Baustein passt,
landet in einem HTML-Baustein – so geht nichts verloren.
"""
import base64, json, os, re, sys, random
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'editor', 'beispiele')
rnd = random.Random(7)
uid = lambda: ''.join(rnd.choice('abcdefghijklmnopqrstuvwxyz0123456789') for _ in range(7))

OK_TAGS = {'b', 'strong', 'i', 'em', 'code', 'a', 'br', 'ul', 'ol', 'li', 'sub', 'sup', 'kbd'}


def inline(el):
    """HTML eines Elements auf einfache Auszeichnung reduzieren (wie clean() im Editor)."""
    if el is None:
        return ''
    soup = BeautifulSoup(str(el), 'html.parser')
    root = soup.find()
    for t in list(root.find_all(True)):
        if t.name in ('script', 'style', 'svg', 'img', 'button'):
            t.decompose(); continue
        if t.name in ('p', 'div') and t is not root:
            t.insert_before(soup.new_tag('br')); t.unwrap(); continue
        if t.name not in OK_TAGS:
            if t.name in ('span', 'label'): t.insert_after(' ')
            t.unwrap(); continue
        keep = {'href': t.get('href')} if t.name == 'a' and t.get('href', '').startswith('http') else {}
        t.attrs = keep
    for t in root.find_all('span'):
        t.insert_after(' ')
    html = root.decode_contents()
    html = re.sub(r'\s+', ' ', html).strip()
    html = re.sub(r'^(<br/?>\s*)+|(\s*<br/?>)+$', '', html)
    return html.replace('<br/>', '<br>')


def text_block(el):
    return {'id': uid(), 'type': 'text', 'html': inline(el) if el.name != 'ul' and el.name != 'ol' else str_list(el)}


def str_list(el):
    items = ''.join(f'<li>{inline(li)}</li>' for li in el.find_all('li', recursive=False))
    return f'<{el.name}>{items}</{el.name}>'


def svg_data(svg):
    s = str(svg)
    if 'xmlns=' not in s:
        s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    return 'data:image/svg+xml;base64,' + base64.b64encode(s.encode()).decode()


def base_doc(title, kicker, subtitle, pal=0, font='pixel', shape='eckig'):
    return {'v': 2, 'id': '', 'form': 'lernpfad', 'design': {'pal': pal, 'font': font, 'shape': shape, 'hero': 'logo', 'heroImg': ''},
            'kicker': kicker, 'title': title, 'subtitle': subtitle, 'goals': [], 'rank': '', 'stations': [],
            'cert': {'on': True, 'need': 'alle', 'pct': 80, 'text': 'hat den Lernpfad erfolgreich bearbeitet.', 'show': {'zeit': True, 'tipps': True, 'quiz': True, 'xp': True}}}


# ---------------------------------------------------------------- FlowPad-Demo
def convert_demo(path):
    s = open(path, encoding='utf-8').read()
    soup = BeautifulSoup(s, 'html.parser')
    hero = soup.select_one('.hero')
    d = base_doc(hero.h1.get_text(strip=True), hero.small.get_text(' ', strip=True).title().replace('Flowpad', 'FlowPad').replace('Einführung', 'Einführung'), inline(hero.p))
    d['id'] = 'flowpad-demo'
    # FlowPad-Logo aus dem Repo (das Inline-SVG der Demo braucht deren Stylesheet)
    d['design']['hero'] = 'bild'; d['design']['heroImg'] = 'data:image/svg+xml;base64,' + base64.b64encode(open(os.path.join(ROOT, 'icon.svg'), 'rb').read()).decode()
    js = soup.find_all('script')[-1].string or ''
    # Tabellen aus dem Skript der Demo
    def js_obj(name):
        m = re.search(r'var ' + name + r' = (\{.*?\});\n', js, re.S)
        src = m.group(1)
        src = re.sub(r'([{,]\s*)([A-Za-z]\w*)\s*:', r'\1"\2":', src)
        src = src.replace("'", '"')
        return json.loads(src)
    pause, kasse = js_obj('PAUSE'), js_obj('KASSE')
    main = soup.find('main')
    st = None; lock_after = {}  # Zelle → id der Aufgabe
    def add(b):
        b.setdefault('id', uid()); st['blocks'].append(b); return b
    def add_lock(cell):
        if cell in lock_after:
            add({'type': 'lock', 'after': lock_after[cell]})
    for el in main.children:
        if not isinstance(el, Tag):
            continue
        if el.name == 'h2':
            nr = el.select_one('.nr'); nr.extract() if nr else None
            st = {'id': uid(), 'title': el.get_text(strip=True), 'sub': '', 'check': False, 'blocks': []}
            d['stations'].append(st); continue
        cls = el.get('class', [])
        if el.name in ('p', 'ul', 'ol'):
            add(text_block(el)); continue
        if 'legend' in cls:
            add({'type': 'legend'}); continue
        if el.name == 'button' and el.get('id') == 'btnSheet':
            add({'type': 'sheet', 'title': pause['title'], 'html': '', 'sheet': {'cells': pause['cells'], 'title': pause['title'], 'widths': pause.get('widths'), 'styles': pause.get('styles'), 'fmt': pause.get('fmt')}, 'rules': [], 'ok': ''}); continue
        if 'task' in cls:
            cell = el.get('data-flowpad-cell')
            nach = el.select_one('[data-flowpad-nach]')
            if nach: add_lock(nach['data-flowpad-nach'])
            btn = el.select_one('[data-flowpad]') or el.select_one('button')
            body = BeautifulSoup(str(el), 'html.parser').find()
            for t in body.select('button, .state, [data-flowpad-nach]'): t.decompose()
            first_b = body.find('b')
            if first_b and first_b.get_text(strip=True).startswith('Aufgabe'): first_b.decompose()
            html = inline(body)
            if btn and btn.get('data-flowpad'):
                cfg = json.loads(btn['data-flowpad'])
                b = add({'type': 'fptask', 'title': cfg.get('title', 'Aufgabe'), 'html': html, 'xp': 20,
                         'app': {'kind': 'diagramm' if cfg.get('mode') == 'diagramm' else 'formel', 'cell': cfg['cell'], 'target': cfg['target'], 'tabelle': pause['title'], 'dfd': 'leer' if cfg.get('dfd') == 'leer' else ''},
                         'tips': [], 'solution': '', 'img': ''})
            else:  # „Diagramme lesen“ (btnRead im Skript)
                b = add({'type': 'fptask', 'title': 'Durchschnitt', 'html': html, 'xp': 20,
                         'app': {'kind': 'formel', 'cell': 'B8', 'target': '=RUNDEN(MITTELWERT(B2:B6);2)', 'tabelle': 'Klassenkasse', 'dfd': 'vorgegeben'},
                         'sheet': {'cells': kasse, 'title': 'Klassenkasse', 'widths': {'A': 110}, 'styles': {'A1:B1': 'head'}, 'fmt': {'B2:B8': 'eur'}},
                         'tips': [], 'solution': '', 'img': ''})
            lock_after[cell] = b['id']; continue
        if el.has_attr('data-flowpad-nach'):
            add_lock(el['data-flowpad-nach'])
            btn = el.find('button')
            if btn and btn.get('data-flowpad'):
                cfg = json.loads(btn['data-flowpad'])
                add({'type': 'action', 'label': btn.get_text(strip=True), 'act': 'ansichten', 'tabelle': cfg.get('tabelle', True), 'diagramm': cfg.get('diagramm', True), 'cell': ''})
            elif btn and btn.get('id') == 'btnFlowDemo':
                add({'type': 'action', 'label': btn.get_text(strip=True), 'act': 'dfd', 'tabelle': True, 'diagramm': True, 'cell': 'D2', 'term': '=B2*C2', 'sheet': {'cells': pause['cells'], 'title': pause['title']}})
            continue
        if 'debbie' in cls:
            who = el.find('b'); name = who.get_text(strip=True).rstrip(':') if who else 'Debbie Debug'
            if who: who.decompose()
            add({'type': 'info', 'kind': 'figur', 'name': name, 'title': '', 'img': '', 'html': inline(el)}); continue
        add({'type': 'html', 'html': str(el)})
    return d


# ---------------------------------------------------------------- Informatik-9-Lernpfade
RULE_OUT = []


def rules_from(check):
    """LP-Prüfregeln (kombinierte Bedingungen) → einzelne Editor-Regeln mit gleicher Meldung."""
    out = []
    for r in check or []:
        msg = r.get('msg', '')
        if 'test' in r:
            t = r['test']
            out.append({'kind': 'test', 'ref': t['cell'], 'val': str(t.get('eq', t.get('text', ''))), 'set': '; '.join(f'{k}={v}' for k, v in t['set'].items()), 'msg': msg}); continue
        ref = r.get('cells') or r.get('cell')
        if r.get('formula'): out.append({'kind': 'formel', 'ref': ref, 'val': '', 'set': '', 'msg': msg})
        if 'has' in r: out.append({'kind': 'enthaelt', 'ref': ref, 'val': r['has'], 'set': '', 'msg': msg})
        if 'not' in r: out.append({'kind': 'nicht', 'ref': ref, 'val': r['not'], 'set': '', 'msg': msg})
        if r.get('noerr'): out.append({'kind': 'keinfehler', 'ref': ref, 'val': '', 'set': '', 'msg': msg})
        if 'eq' in r: out.append({'kind': 'wert', 'ref': ref, 'val': str(r['eq']), 'set': '', 'msg': msg})
        if 'text' in r: out.append({'kind': 'text', 'ref': ref, 'val': str(r['text']), 'set': '', 'msg': msg})
    return out


def table_block(el):
    rows = []
    for tr in el.find_all('tr'):
        rows.append([inline(c) for c in tr.find_all(['th', 'td'])])
    head = bool(el.find('tr') and el.find('tr').find('th'))
    w = max(len(r) for r in rows) if rows else 1
    rows = [r + [''] * (w - len(r)) for r in rows]
    return {'id': uid(), 'type': 'table', 'head': head, 'rows': rows}


def convert_lp(path, pal=0):
    s = open(path, encoding='utf-8').read()
    i = s.find('window.LP = ') + len('window.LP = ')
    LP, _ = json.JSONDecoder().raw_decode(s[i:])
    soup = BeautifulSoup(s, 'html.parser')
    hero = soup.select_one('.hero')
    eyebrow = hero.select_one('.eyebrow')
    d = base_doc(hero.h1.get_text(strip=True), eyebrow.get_text(' ', strip=True) if eyebrow else '', inline(hero.select_one('.lead')), pal=pal)
    d['id'] = 'inf9-' + LP.get('key', 'lp')
    d['goals'] = [inline(li) for li in hero.select('.goals li')]
    rank = hero.select_one('.rank')
    if rank: d['rank'] = re.sub(r'\s+', ' ', ' '.join(rank.stripped_strings)).replace('Rang: ', 'Rang: <b>', 1).replace(' →', '</b> →', 1) if '→' in rank.get_text() else inline(rank)
    ty = hero.select_one('.typing')
    if ty and ty.get('data-lines'):
        d['typeLines'] = json.loads(ty['data-lines'])
    img = hero.select_one('.hero-art img')
    if img and img.get('src', '').startswith('data:'):
        d['design']['hero'] = 'gross'; d['design']['heroImg'] = img['src']
    figure_img = ''
    for sec in soup.select('main > section.station'):
        head = sec.select_one('.station-head')
        num = head.select_one('.station-num')
        texts = [t for t in head.find('div').stripped_strings] if head.find('div') else []
        st = {'id': uid(), 'title': texts[-1] if texts else '', 'sub': texts[0] if len(texts) > 1 else '', 'check': bool(sec.select_one('.done-row')), 'blocks': []}
        if num and not num.get_text(strip=True).isdigit(): st['nr'] = num.get_text(strip=True)
        d['stations'].append(st)
        wrap = sec.select_one('.wrap') or sec
        for el in wrap.children:
            if not isinstance(el, Tag) or el is head:
                continue
            cls = el.get('class', [])
            add = lambda b: st['blocks'].append({'id': uid(), **b})
            if 'done-row' in cls: continue
            if el.name in ('p', 'ul', 'ol'):
                st['blocks'].append(text_block(el)); continue
            if el.name == 'table':
                st['blocks'].append(table_block(el)); continue
            if 'calc' in cls and el.get('data-calc'):
                c = LP['calcs'][el['data-calc']]
                add({'type': 'sheet', 'title': c.get('title', 'Tabelle'), 'html': c.get('hint', ''), 'sheet': {'cells': c.get('cells', {}), 'title': c.get('title'), 'rows': c.get('rows'), 'cols': c.get('cols'), 'widths': c.get('widths'), 'styles': c.get('styles'), 'fmt': c.get('fmt'), 'edit': c.get('edit'), 'start': c.get('start')},
                     'rules': rules_from(c.get('check')), 'ok': c.get('ok', ''), 'xp': 10}); continue
            if el.has_attr('data-dfd'):
                t = LP['dfd'][el['data-dfd']]
                add({'type': 'fptask', 'title': t.get('title', 'Diagramm'), 'html': t.get('prompt', ''), 'xp': 20,
                     'app': {'kind': 'diagramm', 'cell': t.get('output') if re.match(r'^\$?[A-Z]+\$?\d+$', str(t.get('output', ''))) else '', 'target': t['term'], 'tabelle': '', 'dfd': 'leer'},
                     'dfdInputs': t.get('inputs'), 'tests': t.get('tests'), 'tips': [], 'solution': '', 'img': ''}); continue
            if 'duck' in cls:
                im = el.find('img'); bub = el.select_one('.bubble') or el
                who = bub.find('b'); name = who.get_text(strip=True).rstrip(':') if who else 'Debbie Debug'
                if who: who.decompose()
                src = im['src'] if im and im.get('src', '').startswith('data:') else ''
                figure_img = figure_img or src
                add({'type': 'info', 'kind': 'figur', 'name': name, 'title': '', 'img': src, 'html': inline(bub)}); continue
            if 'task' in cls and el.select_one('[data-quiz]'):
                qs = LP['quiz'][el.select_one('[data-quiz]')['data-quiz']]
                add({'type': 'quiz', 'title': el.select_one('.task-head').get_text(strip=True) if el.select_one('.task-head') else '',
                     'qs': [{'q': q['q'], 'opts': [{'t': o[0], 'ok': bool(o[1]), 'fb': o[2] if len(o) > 2 else ''} for o in q['o']]} for q in qs], 'xp': 10}); continue
            if 'note' in cls:
                t = el.select_one('.note-title'); title = t.get_text(strip=True) if t else ''
                if t: t.decompose()
                kind = 'regel' if 'rule' in cls else 'achtung' if 'warn' in cls else 'merke'
                add({'type': 'info', 'kind': kind, 'title': title, 'html': inline(el), 'img': '', 'name': ''}); continue
            if 'dl' in cls and el.get('data-file'):
                name = el['data-file']
                add({'type': 'file', 'name': name, 'data': LP.get('files', {}).get(name, ''), 'html': inline(el)}); continue
            if el.get('id') == 'heft' or 'heft-wrap' in cls:
                H = LP['heft']
                html = re.sub(r'\{\{([^}]+)\}\}', r'[[\1]]', H['html'])
                # Tabellen im Hefteintrag bleiben als HTML-Baustein davor/danach erhalten
                parts = re.split(r'(<table[\s\S]*?</table>)', html)
                text = ' '.join(inline(BeautifulSoup('<div>' + p + '</div>', 'html.parser').div) if not p.startswith('<table') else '[Tabelle]' for p in parts)
                add({'type': 'gap', 'heft': True, 'title': H.get('title', ''), 'sub': H.get('sub', ''), 'html': text.replace('[Tabelle]', '<br>'), 'bank': True, 'extra': H.get('extra', []), 'xp': 10})
                for p in parts:
                    if p.startswith('<table'):
                        st['blocks'].append(table_block(BeautifulSoup(p, 'html.parser').table))
                continue
            if 'next-level' in cls:
                im = el.find('img'); h3 = el.find('h3')
                add({'type': 'info', 'kind': 'abschluss', 'title': h3.get_text(strip=True) if h3 else '', 'html': inline(el.find('p')), 'img': im['src'] if im and im.get('src', '').startswith('data:') else '', 'name': ''}); continue
            # Bilder/SVG-Grafiken
            svg = el.find('svg') if el.name != 'svg' else el
            if el.name in ('figure', 'div') and svg and not el.get_text(strip=True).replace(svg.get_text(strip=True), '').strip():
                add({'type': 'image', 'src': svg_data(svg), 'alt': svg.get_text(' ', strip=True)[:80], 'caption': '', 'size': 'voll'}); continue
            if el.name in ('figure', 'div') and svg:
                cap = el.find('figcaption')
                add({'type': 'image', 'src': svg_data(svg), 'alt': '', 'caption': cap.get_text(' ', strip=True) if cap else '', 'size': 'voll'}); continue
            if el.name == 'h3':
                st['blocks'].append({'id': uid(), 'type': 'text', 'html': '<b>' + inline(el) + '</b>'}); continue
            add({'type': 'html', 'html': str(el)})
    return d


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ('FlowPad-Willkommen.html', 'flowpad-demo.json', convert_demo, 'FlowPad-Demo · umgewandelt'),
        ('LP1-1_Zellen_und_Formeln.html', 'lp1-1.json', convert_lp, 'Informatik 9 · Level 1.1 · umgewandelt'),
    ]
    index = []
    for src, out, fn, note in jobs:
        d = fn(os.path.join(ROOT, 'learn', '9', src))
        with open(os.path.join(OUT, out), 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
        kinds = {}
        for s in d['stations']:
            for b in s['blocks']:
                kinds[b['type']] = kinds.get(b['type'], 0) + 1
        print(f'{out}: {len(d["stations"])} Stationen, Bausteine {kinds}, {os.path.getsize(os.path.join(OUT, out)) // 1024} KB')
        index.append({'file': out, 'title': d['title'], 'note': note})
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
