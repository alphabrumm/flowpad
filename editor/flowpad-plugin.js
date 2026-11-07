/* FlowPad-Erweiterung für PathFinder: Bausteine, die FlowPad brauchen.
 *  – Rechenblatt: Tabelle in FlowPad laden, optional mit Prüfregeln (wie in den Informatik-9-Lernpfaden)
 *  – Formel- und Diagramm-Aufgabe: Zielzelle + Zielformel, FlowPad prüft mit Testwerten
 *  – Aktionsknopf: Ansichten schalten oder ein Diagramm zeigen
 *  – DFD-Legende
 * Die Verbindung zur App läuft über den host (in FlowPad selbst, im Entwurf über die Attrappe). */
import CalcEngine from '../js/engine.js';
const CE = CalcEngine;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = h => { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent; };

/* ---------- Rechnen und Prüfen ---------- */
export const sheetOf = cells => new CE.Sheet(40, 12, cells || {});
const numEq = (v, x) => { const n = parseFloat(String(x).replace(',', '.')); return typeof v === 'number' && !isNaN(n) && Math.abs(v - n) < 1e-6; };
function parseSet(s) { const o = {}; String(s || '').split(/[;\n]/).forEach(p => { const m = p.match(/^\s*([A-Za-z]+\d+)\s*=\s*(.*?)\s*$/); if (m) o[m[1].toUpperCase()] = m[2]; }); return o; }
/** Formel in Zelle a rechnet wie target – mit den Tabellenwerten und mit abgewandelten Eingaben */
export function sameResults(cells, a, target) {
  const raw = cells[a]; if (!raw || !String(raw).startsWith('=') || !target) return false;
  const refs = [...new Set((String(target).toUpperCase().replace(/\$/g, '').match(/[A-Z]+\d+(:[A-Z]+\d+)?/g) || []).flatMap(x => x.includes(':') ? CE.rangeCells(x) : [x]))].filter(x => x !== a);
  const sets = [{}, ...[1, 2, 3, 4].map(k => Object.fromEntries(refs.map((x, i) => [x, String(k * 3 + i * 7 + 0.5)])))];
  return sets.every(o => { const c = { ...cells, ...o }, v1 = sheetOf(c).value(a), v2 = sheetOf({ ...c, [a]: target }).value(a); return typeof v1 === 'number' ? typeof v2 === 'number' && Math.abs(v1 - v2) < 1e-9 : CE.display(v1) === CE.display(v2); });
}
export function evalRule(r, cells) {
  const norm = s => String(s || '').replace(/\s+/g, '').toUpperCase();
  const refs = r.ref ? (r.ref.includes(':') ? CE.rangeCells(r.ref) : [r.ref]) : [];
  if (r.kind === 'test') { const sh = sheetOf({ ...cells, ...parseSet(r.set) }); return refs.every(a => { const v = sh.value(a); return numEq(v, r.val) || CE.display(v).toLowerCase() === String(r.val).toLowerCase(); }); }
  if (r.kind === 'wie') return refs.every(a => sameResults(cells, a, r.val));
  if (r.kind === 'fuell') { const p0 = CE.parseAddr(refs[0]); return refs.every(a => { const p = CE.parseAddr(a); return sameResults(cells, a, CE.shiftFormula(r.val, p.r - p0.r, p.c - p0.c)); }); }
  const sh = sheetOf(cells);
  return refs.every(a => {
    const raw = cells[a], v = sh.value(a);
    switch (r.kind) {
      case 'formel': return String(raw || '').startsWith('=');
      case 'wert': return numEq(v, r.val);
      case 'text': return CE.display(v).toLowerCase() === String(r.val).toLowerCase();
      case 'enthaelt': return norm(raw).includes(norm(r.val));
      case 'nicht': return !norm(raw).includes(norm(r.val));
      case 'keinfehler': return !CE.isErr(v);
    }
    return true;
  });
}
function fmtOf(fmt, a) { if (!fmt) return undefined; if (fmt[a]) return fmt[a]; for (const k in fmt) { try { if (k.includes(':') && CE.rangeCells(k).includes(a)) return fmt[k]; } catch (e) { } } return undefined; }
function miniTable(cells, fmt) {
  const keys = Object.keys(cells || {}); if (!keys.length) return '';
  let R = 0, C = 0; keys.forEach(a => { const p = CE.parseAddr(a); if (p) { R = Math.max(R, p.r + 1); C = Math.max(C, p.c + 1); } });
  R = Math.min(R, 12); C = Math.min(C, 8);
  const sh = sheetOf(cells);
  let h = '<table class="lp-mini"><tr><th></th>'; for (let c = 0; c < C; c++) h += `<th>${CE.colName(c)}</th>`; h += '</tr>';
  for (let r = 0; r < R; r++) { h += `<tr><th>${r + 1}</th>`; for (let c = 0; c < C; c++) { let v = ''; try { const a = CE.addr(r, c); v = CE.display(sh.value(a), fmtOf(fmt, a)); } catch (e) { } h += `<td>${esc(v)}</td>`; } h += '</tr>'; }
  return h + '</table>';
}

/* Für den Export ohne FlowPad: Aufgaben werden zur Selbstkontrolle – das Ergebnis wird hier vorher ausgerechnet */
function resultOf(cells, cell, target) {
  try { const v = sheetOf({ ...cells, [cell]: target }).value(cell); if (CE.isErr(v)) return null; return typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : CE.display(v); } catch (e) { return null; }
}
const legendHtml = () => `<div class="lp-card lp-legend"><span class="sym r"></span><span>Eingabe (eine Zelle oder ein Bereich), z. B. <b>Preis (B2)</b></span><span class="sym e"></span><span>Funktion – auch Rechenzeichen wie <code>*</code> stehen in einer Ellipse</span><span class="k">2</span><span>Konstante: einfach die Zahl, ohne Rahmen</span><span><span class="sym d"></span></span><span>Verteiler: gibt ein Datum an mehrere Funktionen weiter</span><span class="sym o"></span><span>Ausgabe: die Zelle mit dem Ergebnis</span></div>`;

const RULE_KINDS = [['formel', 'Formel steht in'], ['wert', 'Wert ist gleich'], ['text', 'Text/Anzeige ist gleich'], ['enthaelt', 'Formel enthält'], ['nicht', 'Formel enthält nicht'], ['keinfehler', 'kein Fehler in'], ['test', 'Test: Werte setzen, dann ist'], ['wie', 'rechnet wie Formel'], ['fuell', 'ausgefüllt wie Formel (ab erster Zelle)']];
const XP = { k: 'xp', l: 'XP (Challenge)', t: 'number' };
const taskMake = kind => () => ({ title: '', html: '', xp: 20, app: { kind, cell: '', target: '', tabelle: '', dfd: kind === 'diagramm' ? 'leer' : '' }, tips: [], solution: '', img: '' });

export const flowpadPlugin = {
  id: 'flowpad', name: 'FlowPad',
  migrate(b) {
    if (b.type === 'task' && b.app) { if (b.app.kind === 'formel' || b.app.kind === 'diagramm') b.type = 'fptask'; else delete b.app; }
    if (b.type === 'fptask') b.app = { tabelle: '', dfd: '', ...b.app };
    if (b.type === 'sheet') { if (b.sheet && !b.sheet.cells) b.sheet = { cells: b.sheet }; b.rules = b.rules || []; }
  },
  // Textformat („Vorlage für KI“): so schreibt eine KI FlowPad-Bausteine
  text: {
    rechenblatt: {
      n: 'Rechenblatt', type: 'sheet', alias: ['tabelle laden', 'tabelle'], keys: [],
      help: `### Rechenblatt: Name der Tabelle
Kurzer Text, was in der Tabelle steht.
| Artikel | Preis | Anzahl |
| Brezel | 0,9 | 14 |
(die erste Tabellenzeile landet in Zeile 1 ab Spalte A; Zahlen mit Komma; Formeln mit =)`,
      make(S, H) {
        const cells = {}; S.table.forEach((r, i) => r.forEach((v, c) => { v = v.replace(/<[^>]+>/g, '').trim(); if (v) cells[CE.addr(i, c)] = v; }));
        if (!S.table.length) H.warn(S.line, `Rechenblatt „${S.title}“ ohne Tabelle (Zeilen mit | … |).`);
        return { type: 'sheet', title: S.title || 'Tabelle', html: H.md(S.body), sheet: S.table.length ? { cells } : null, rules: [], ok: '', xp: 10 };
      },
      toText(b, { md }) {
        const cells = b.sheet?.cells || {}; let R = 0, C = 0; for (const a in cells) { const p = CE.parseAddr(a); if (p) { R = Math.max(R, p.r + 1); C = Math.max(C, p.c + 1); } }
        const rows = []; for (let r = 0; r < R; r++) { const row = []; for (let c = 0; c < C; c++) row.push(cells[CE.addr(r, c)] ?? ''); rows.push('| ' + row.join(' | ') + ' |'); }
        return [`### Rechenblatt: ${b.title}`, md(b.html || ''), ...rows].filter(Boolean).join('\n') + ((b.rules || []).length ? '\n%% (Prüfregeln bleiben nur im Editor)' : '');
      },
    },
    'formel-aufgabe': {
      n: 'Formel-Aufgabe', type: 'fptask', alias: ['formelaufgabe', 'diagramm-aufgabe', 'diagrammaufgabe'], keys: ['zelle', 'formel', 'tipp', 'loesung', 'xp', 'punkte', 'als'],
      help: `### Formel-Aufgabe: Titel
Schreibe in D2 die Formel für den Gesamtpreis.
Zelle: D2              (Zielzelle)
Formel: =B2*C2         (Musterformel – FlowPad prüft das Ergebnis, andere richtige Formeln zählen auch)
Als: Formel            (oder: Diagramm – dann baut man die Formel als Datenflussdiagramm)
Tipp: …
Lösung: …
XP: 30
(Die Formel-Aufgabe rechnet mit dem Rechenblatt, das in der Station davor geladen wird.)`,
      make(S, H) {
        const cell = (S.one('zelle') || '').toUpperCase().replace(/\s/g, ''), target = (S.one('formel') || '').replace(/^`|`$/g, '');
        if (!/^[A-Z]{1,2}\d{1,4}$/.test(cell)) H.err(S.line, `Formel-Aufgabe „${S.title}“: „Zelle: D2“ fehlt oder ist ungültig.`);
        if (!target.startsWith('=')) H.err(S.line, `Formel-Aufgabe „${S.title}“: „Formel: =…“ fehlt.`);
        const kind = /diagramm/i.test(S.one('als') || S.head) ? 'diagramm' : 'formel';
        return { type: 'fptask', title: S.title, html: H.md(S.body), xp: S.num('xp', 20), app: { kind, cell, target, tabelle: '', dfd: kind === 'diagramm' ? 'leer' : '' }, tips: S.all('tipp').map(H.inline || (x => x)), solution: S.one('loesung') || `<code>${target}</code>`, img: '' };
      },
      toText(b, { md }) {
        const a = b.app || {};
        return [`### Formel-Aufgabe: ${md(b.title || '')}`, md(b.html || ''), `Zelle: ${a.cell}`, `Formel: ${a.target}`, `Als: ${a.kind === 'diagramm' ? 'Diagramm' : 'Formel'}`, ...(b.tips || []).map(t => 'Tipp: ' + md(t)), b.solution ? 'Lösung: ' + md(b.solution).replace(/\n+/g, ' ') : '', `XP: ${b.xp ?? 20}`].filter(Boolean).join('\n');
      },
    },
  },
  blocks: {
    sheet: {
      n: 'Rechenblatt', ic: '▦', g: 'FlowPad', h: 'Tabelle laden, optional mit Prüfregeln', openForm: true,
      make: () => ({ title: 'Tabelle laden', html: '', sheet: null, rules: [], ok: '', xp: 10 }),
      check: b => (b.rules || []).length > 0,
      label: b => 'das Rechenblatt „' + (b.title || '') + '“',
      render(b, x) {
        const cells = b.sheet?.cells || {}, n = Object.keys(cells).length, rules = b.rules || [], res = x.prog.quiz[b.id], ok = x.prog.solved[b.id];
        return `<div class="lp-card lp-sheet${ok ? ' ok' : ''}"><div class="hd">${x.ce('title', b.title, 'Tabelle laden', { tag: 'b', cls: 'lp-ctitle' })}${x.xpTag(b)}<span class="lp-state">${ok ? '✓ geschafft' : ''}</span></div>${x.ce('html', b.html, 'Auftrag oder Beschreibung (optional)', { rich: true })}${miniTable(cells, b.sheet?.fmt)}`
          + `<div><button class="lp-btn" data-run="sheet">▦ Tabelle in FlowPad laden</button>${rules.length ? '<button class="lp-btn alt" data-run="check">✓ Prüfen</button>' : ''}</div>`
          + (res && !x.E() ? `<div class="fb" style="color:var(${res.ok ? '--good' : '--bad'})">${res.ok ? '✓ ' : '✗ '}${res.msg}</div>` : '')
          + (x.E() ? `<div class="ed-hint">${n ? `${n} Zellen` : 'Noch keine Tabelle'} · ${rules.length ? `${rules.length} Prüfregel${rules.length > 1 ? 'n' : ''}` : 'ohne Prüfung'} · ⚙ → <b>aus FlowPad übernehmen</b>, Prüfregeln</div>` : '') + '</div>';
      },
      exportAs(b) {
        const tab = miniTable(b.sheet?.cells || {}, b.sheet?.fmt);
        if ((b.rules || []).length) return { type: 'task', title: b.title, html: `${b.html || ''}${tab}<i>Bearbeite die Tabelle in einer Tabellenkalkulation und hake danach ab.</i>`, xp: b.xp || 10, tips: [], solution: '', img: '' };
        return { type: 'html', html: `<div class="lp-card lp-sheet"><b class="lp-ctitle">${esc(b.title)}</b>${b.html ? `<div>${b.html}</div>` : ''}${tab}</div>` };
      },
      form: [{ k: 'title', l: 'Titel (auch Name des Reiters in FlowPad)', t: 'text' }, { k: 'sheet', l: 'Tabelle', t: 'fp-sheet' }, { k: 'rules', l: 'Prüfregeln (der Reihe nach – die erste, die nicht passt, wird gemeldet)', t: 'fp-rules' }, { k: 'ok', l: 'Meldung, wenn alles stimmt', t: 'text', show: b => (b.rules || []).length > 0 }, XP],
      run(a, b, x) {
        const h = x.host;
        if (a === 'sheet') { if (!b.sheet?.cells) { x.toast('Noch keine Tabelle – ⚙ → „aus FlowPad übernehmen“'); return; } h.loadSheet?.(b.sheet, b.title); x.toast('▦ Tabelle „' + esc(b.title) + '“ in FlowPad geladen'); return; }
        if (a === 'check') {
          if (x.E()) { x.toast('In der <b>Vorschau</b> (⌘P) ausprobieren'); return; }
          if (h.tab?.() !== b.title) { x.prog.quiz[b.id] = { ok: false, msg: `Lade zuerst die Tabelle „${esc(b.title)}“.` }; x.render(); return; }
          const bad = (b.rules || []).find(r => !evalRule(r, h.cells()));
          x.prog.quiz[b.id] = bad ? { ok: false, msg: bad.msg || 'Noch nicht ganz. Prüfe deine Formeln.' } : { ok: true, msg: b.ok || 'Stark! Alles richtig.' };
          if (!bad) x.solve(b.id); else x.render();
        }
      },
    },
    fptask: {
      n: 'Formel-Aufgabe', ic: 'fx', g: 'FlowPad', h: 'Zielzelle + Zielformel, FlowPad prüft', openForm: true, make: taskMake('formel'),
      check: () => true,
      label: b => (b.title || 'die Aufgabe') + (b.app?.cell ? ` (${b.app.cell})` : ''),
      render(b, x) {
        const a = b.app || {}, ok = x.prog.solved[b.id];
        const buttons = `<button class="lp-btn alt" data-run="task">${a.kind === 'diagramm' ? '⬭ Diagramm-Aufgabe in FlowPad öffnen' : '▶ Aufgabe in FlowPad öffnen'}</button>`
          + (!x.E() && a.kind === 'diagramm' && (x.prog.tries[b.id] || 0) >= 2 && !ok ? '<button class="lp-btn alt" data-run="solve">Lösung zeigen</button>' : '');
        const hint = `FlowPad prüft <b>${esc(a.cell || '?')}</b> gegen <b>${esc(a.target || '?')}</b> · ${a.kind === 'diagramm' ? 'als Diagramm' : 'als Formel'}${a.dfd === 'vorgegeben' ? ' · Diagramm wird gezeigt' : ''}${b.sheet?.cells ? ' · mit eigener Tabelle' : ''} <span style="opacity:.7">(⚙ zum Ändern)</span>`;
        return x.taskCard(b, { buttons, hint, where: a.tabelle ? '▦ ' + a.tabelle : '' });
      },
      exportAs(b, env) {
        const a = b.app || {}, sheet = b.sheet?.cells ? b.sheet : env.sheetBefore(env.station, env.index), cells = sheet?.cells || {};
        const res = a.cell && a.target ? resultOf(cells, a.cell, a.target) : null;
        const tab = miniTable(cells, sheet?.fmt);
        const ask = res != null ? `<p><b>Selbstkontrolle:</b> Rechne mit den Werten der Tabelle. Welches Ergebnis steht in <b>${esc(a.cell)}</b>?</p>` : '';
        return { type: 'task', title: b.title, html: `${b.html || ''}${tab}${ask}`, answer: res ?? '', answerPh: a.cell ? 'Ergebnis in ' + a.cell : 'Ergebnis', xp: b.xp, tips: b.tips || [], solution: b.solution || (a.target ? `<code>${esc(a.target)}</code>` : ''), img: b.img || '' };
      },
      form: [
        { k: 'title', l: 'Titel', t: 'text' },
        { k: 'app.kind', l: 'Art', t: 'select', o: [['formel', 'Formel in einer Zelle'], ['diagramm', 'Diagramm bauen']] },
        { k: 'app.cell', l: 'Zielzelle', t: 'cell' },
        { k: 'app.target', l: 'Zielformel', t: 'formula', help: 'FlowPad vergleicht das Ergebnis mit vielen Testwerten – nicht die Schreibweise.' },
        { k: 'app.dfd', l: 'Diagramm dazu', t: 'select', o: [['', 'keins'], ['leer', 'leer – selbst bauen'], ['vorgegeben', 'Lösung als Diagramm zeigen (Diagramm lesen)']] },
        { k: 'app.tabelle', l: 'Tabelle (Reiter in FlowPad)', t: 'text', help: 'optional, z. B. „LAN-Party“ – wird an der Aufgabe angezeigt' },
        { k: 'sheet', l: 'Eigene Tabelle für diese Aufgabe (optional)', t: 'fp-sheet' },
        { k: 'tips', l: 'Tipps (werden nacheinander aufgedeckt)', t: 'list', ph: 'Tipp' },
        { k: 'solution', l: 'Lösung zum Aufdecken (leer = keine)', t: 'text' },
        { k: 'img', l: 'Bild oder GIF zur Aufgabe', t: 'image' }, XP,
      ],
      run(a, b, x) {
        const ap = b.app || {};
        if (a === 'task') {
          if (!ap.cell || !ap.target) { x.toast('Zielzelle und Zielformel fehlen – ⚙'); return; }
          x.host.task?.({ id: b.id, cell: ap.cell, target: ap.target, title: b.title, html: b.html, kind: ap.kind, dfd: ap.dfd, sheet: b.sheet, tabelle: ap.tabelle });
        }
        if (a === 'solve') x.host.showSolution?.(b) ?? x.toast('Im echten FlowPad erscheint jetzt das Lösungsdiagramm.');
      },
    },
    dtask: { n: 'Diagramm-Aufgabe', ic: '⬭', g: 'FlowPad', h: 'Diagramm bauen statt Formel tippen', alias: 'fptask', openForm: true, make: taskMake('diagramm') },
    action: {
      n: 'Aktionsknopf', ic: '▶', g: 'FlowPad', h: 'Ansichten schalten, Diagramm zeigen', openForm: true,
      make: () => ({ label: 'Diagramm-Ansicht öffnen', act: 'ansichten', tabelle: true, diagramm: true, cell: '', term: '' }),
      render: (b, x) => `<div class="lp-action"><button class="lp-btn alt" data-run="action">${esc(b.label || 'Knopf')}</button>${x.E() ? `<span class="ed-hint" style="margin-left:6px">${b.act === 'dfd' ? `zeigt das Diagramm von ${esc(b.cell || '?')}` : `Ansichten: ${b.tabelle ? 'Tabelle' : ''}${b.tabelle && b.diagramm ? ' + ' : ''}${b.diagramm ? 'Diagramm' : ''}`}</span>` : ''}</div>`,
      form: [{ k: 'label', l: 'Beschriftung', t: 'text' }, { k: 'act', l: 'Was passiert?', t: 'select', o: [['ansichten', 'Ansichten in FlowPad schalten'], ['dfd', 'Diagramm einer Zelle zeigen']] }, { k: 'tabelle', l: 'Tabelle zeigen', t: 'check', show: b => b.act === 'ansichten' }, { k: 'diagramm', l: 'Diagramm zeigen', t: 'check', show: b => b.act === 'ansichten' }, { k: 'cell', l: 'Zelle', t: 'cell', show: b => b.act === 'dfd' }, { k: 'term', l: 'Formel (falls die Zelle noch leer ist)', t: 'formula', show: b => b.act === 'dfd' }, { k: 'sheet', l: 'Vorher diese Tabelle laden (optional)', t: 'fp-sheet', show: b => b.act === 'dfd' }],
      run(a, b, x) { x.host.action?.(b) ?? x.toast('Aktion in FlowPad ausgeführt'); },
      exportAs: () => null, // ohne FlowPad gibt es nichts umzuschalten
    },
    legend: {
      n: 'DFD-Legende', ic: '⬭', g: 'FlowPad', h: 'Symbole der Datenflussdiagramme', make: () => ({}),
      exportAs: () => ({ type: 'html', html: legendHtml() }),
      render: () => `<div class="lp-card lp-legend"><span class="sym r"></span><span>Eingabe (eine Zelle oder ein Bereich), z. B. <b>Preis (B2)</b></span><span class="sym e"></span><span>Funktion – auch Rechenzeichen wie <code>*</code> stehen in einer Ellipse</span><span class="k">2</span><span>Konstante: einfach die Zahl, ohne Rahmen</span><span><span class="sym d"></span></span><span>Verteiler: gibt ein Datum an mehrere Funktionen weiter</span><span class="sym o"></span><span>Ausgabe: die Zelle mit dem Ergebnis</span></div>`,
    },
  },
  fields: {
    'fp-sheet': {
      html(f, v, b, x) { const n = Object.keys(v?.cells || {}).length; return `<label>${esc(f.l)}</label><div class="row"><span class="help" style="align-self:center">${n ? `${n} Zellen` : 'noch leer'}</span>${x.host.cells ? `<button class="take" data-fptake="${f.k}">▦ aus FlowPad übernehmen</button>` : ''}${n ? `<button class="add" data-fpclear="${f.k}">leeren</button>` : ''}</div>${n ? miniTable(v.cells, v.fmt) : ''}`; },
      click(d, b, draw, x) {
        if (d.fptake) { b[d.fptake] = { ...(b[d.fptake] || {}), cells: { ...x.host.cells() }, title: x.host.tab?.() }; draw(); x.toast('Tabelle übernommen'); }
        if (d.fpclear) { b[d.fpclear] = null; draw(); }
      },
    },
    'fp-rules': {
      html(f, v, b, x) {
        const row = (r, i) => `<div class="rule"><div class="it"><select data-rk="${i}">${RULE_KINDS.map(([k, n]) => `<option value="${k}"${k === r.kind ? ' selected' : ''}>${n}</option>`).join('')}</select><input type="text" class="mono" data-rf="${i}.ref" value="${esc(r.ref)}" placeholder="B2 oder B2:B5" style="max-width:8em">${['wert', 'text', 'enthaelt', 'nicht', 'test', 'wie'].includes(r.kind) ? `<input type="text" class="mono" data-rf="${i}.val" value="${esc(r.val)}" placeholder="${r.kind === 'wie' ? '=B2*C2' : r.kind === 'enthaelt' || r.kind === 'nicht' ? 'SUMME(' : 'Wert'}" style="max-width:8em">` : ''}<button data-rdel="${i}" aria-label="Regel entfernen">✕</button></div>${r.kind === 'test' ? `<input type="text" class="mono" data-rf="${i}.set" value="${esc(r.set)}" placeholder="setze: B2=2; C2=5">` : ''}<input type="text" data-rf="${i}.msg" value="${esc(plain(r.msg))}" placeholder="Meldung, wenn die Regel nicht passt"></div>`;
        return `<label>${esc(f.l)}</label><div class="list rules">${(v || []).map(row).join('')}<button class="add" data-radd="1">＋ Prüfregel</button><span class="help">„rechnet wie Formel“ prüft wie FlowPad mit Testwerten. „Test“ setzt Werte (z. B. <code>B2=2; C2=5</code>) und prüft dann das Ergebnis – so fällt auf, wer feste Zahlen statt Zellbezügen schreibt.</span></div>`;
      },
      input(t, b, draw) {
        if (t.dataset.rk != null) { b.rules[+t.dataset.rk].kind = t.value; draw(); }
        if (t.dataset.rf) { const [i, k] = t.dataset.rf.split('.'); b.rules[+i][k] = k === 'ref' ? t.value.toUpperCase().replace(/\s/g, '') : (k === 'msg' ? esc(t.value) : t.value); }
      },
      click(d, b, draw, x) {
        if (d.radd) { (b.rules = b.rules || []).push({ kind: 'wie', ref: x.host.selectedCell?.() || '', val: '', set: '', msg: '' }); draw(); }
        if (d.rdel) { b.rules.splice(+d.rdel, 1); draw(); }
      },
    },
  },
  css: `
.lp-sheet .lp-ctitle::before { content: "▦ "; }
.lp-sheet.ok { border-color: var(--good); }
.lp-sheet .fb { font-weight: 700; margin-top: 6px; }
.lp-mini { font: 13px/1.3 ui-monospace, Menlo, monospace; border-collapse: collapse; margin: 8px 0; display: block; overflow-x: auto; }
.lp-mini td, .lp-mini th { border: 1px solid var(--line); padding: 2px 6px; white-space: nowrap; }
.lp-mini th { background: var(--surface-2); color: var(--ink-2); font-weight: 600; }
.lp-mini td { background: var(--surface); }
.lp-legend { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; }
.lp-legend .sym { width: 40px; height: 24px; display: inline-block; }
.lp-legend .r { border: 2px solid #2a6fd6; background: #e6efff; } .lp-legend .o { border: 2px solid #1f8f55; background: #e3f6ea; } .lp-legend .e { border: 2px solid #a87400; background: #fff3c4; border-radius: 50%; }
.lp-legend .d { width: 12px; height: 12px; border-radius: 50%; background: var(--ink); margin: 0 14px; } .lp-legend .k { font: 700 18px ui-monospace, monospace; text-align: center; }
.lp-action { margin: 8px 0; }`,
};
