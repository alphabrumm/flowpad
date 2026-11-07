/* Lernpfad-Editor – klickbarer Entwurf (Schritt 4)
 * Ein Lernpfad ist ein Dokument aus Stationen mit Bausteinen (JSON). Daraus entsteht
 * die Seite – im Bearbeiten-Modus mit Werkzeugen, in der Vorschau genau wie für Schüler.
 * Alles bleibt lokal im Browser (localStorage). Export folgt in Schritt 6. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const clone = o => JSON.parse(JSON.stringify(o));
const STORE = 'lpeditor.entwurf.v1';

/* ---------- Design ---------- */
const PALETTES = [
  { n: 'Pastell', d: 'FlowPad-Demo', l: { bg: '#fdf8f3', surface: '#fff', 'surface-2': '#f7edf2', ink: '#2a2340', 'ink-2': '#6c6280', line: '#eedbe4', a1: '#5b6fc2', a1s: '#b9cdf5', a2: '#c75a8c', a2s: '#f6c3d8', a3: '#f6bf3a', a3d: '#d99a0b', a3s: '#fdf0cf', a3ink: '#2b2300', g1: '#b9cdf5', g2: '#f6c3d8', g3: '#fbd98a', heroink: '#2a2340' } },
  { n: 'Meer', l: { bg: '#f3f8fa', surface: '#fff', 'surface-2': '#e6f1f5', ink: '#14303d', 'ink-2': '#55707c', line: '#d3e5ec', a1: '#1f6f8b', a1s: '#a9dbe8', a2: '#0f9d8a', a2s: '#bfece5', a3: '#f2c879', a3d: '#c99a3c', a3s: '#fbf0d9', a3ink: '#33250a', g1: '#8fd3e8', g2: '#bfece5', g3: '#f7e2b3', heroink: '#10303b' } },
  { n: 'Wald', l: { bg: '#f6f7f0', surface: '#fff', 'surface-2': '#ecefe1', ink: '#22301f', 'ink-2': '#5f6b58', line: '#dde3cd', a1: '#3e7a3a', a1s: '#c4e0b5', a2: '#9a6b2f', a2s: '#ecd9b8', a3: '#e7c14f', a3d: '#b38f1c', a3s: '#f7efcf', a3ink: '#2c2400', g1: '#c4e0b5', g2: '#e3ebc4', g3: '#f3dfa0', heroink: '#22301f' } },
  { n: 'Sonnenuntergang', l: { bg: '#fff7f1', surface: '#fff', 'surface-2': '#fdebe0', ink: '#3a1f2b', 'ink-2': '#7a5a62', line: '#f6d9c9', a1: '#c2410c', a1s: '#fdc9a8', a2: '#9d2b6b', a2s: '#f4bdd6', a3: '#fbbf24', a3d: '#d68f00', a3s: '#fff0c8', a3ink: '#2e2100', g1: '#fdba8c', g2: '#f9a8c9', g3: '#c4a5f0', heroink: '#3a1f2b' } },
  { n: 'Lavendel', l: { bg: '#f8f6fd', surface: '#fff', 'surface-2': '#efebfb', ink: '#2b2545', 'ink-2': '#6b6588', line: '#e2dcf5', a1: '#6d4fc4', a1s: '#d4c8f6', a2: '#2f9e86', a2s: '#c2eadf', a3: '#a6e3c7', a3d: '#4fae86', a3s: '#e4f6ee', a3ink: '#11372a', g1: '#d4c8f6', g2: '#e9d5f7', g3: '#c2eadf', heroink: '#2b2545' } },
  { n: 'Bonbon', l: { bg: '#fff8fb', surface: '#fff', 'surface-2': '#ffeef6', ink: '#3b2340', 'ink-2': '#7d6283', line: '#fbdbe9', a1: '#e0458f', a1s: '#ffc6de', a2: '#16a3a3', a2s: '#bdf0ee', a3: '#fde047', a3d: '#d6b400', a3s: '#fff8c7', a3ink: '#332a00', g1: '#ffc6de', g2: '#bdf0ee', g3: '#fff19a', heroink: '#3b2340' } },
  { n: 'Papier', l: { bg: '#faf6ee', surface: '#fffdf8', 'surface-2': '#f3ecdf', ink: '#2f2a24', 'ink-2': '#6f6558', line: '#e7dccb', a1: '#8c3b2e', a1s: '#ead1c6', a2: '#2e5a6b', a2s: '#c9dde4', a3: '#d9b56a', a3d: '#a8822f', a3s: '#f5ead1', a3ink: '#2c2208', g1: '#efe3cc', g2: '#e8d6c4', g3: '#dfe6e0', heroink: '#2f2a24' } },
  { n: 'Schiefer', l: { bg: '#f4f6f8', surface: '#fff', 'surface-2': '#e9edf1', ink: '#1e2833', 'ink-2': '#5b6876', line: '#d9e0e7', a1: '#34506b', a1s: '#c4d3e2', a2: '#e0662f', a2s: '#fbd2bf', a3: '#f59e0b', a3d: '#c27c00', a3s: '#fdecc8', a3ink: '#2a1c00', g1: '#c4d3e2', g2: '#dde4ea', g3: '#fbd2bf', heroink: '#1e2833' } },
  { n: 'Retro-Arcade', d: 'dunkel', l: { bg: '#14112b', surface: '#1e1a3d', 'surface-2': '#2a2552', ink: '#f2eeff', 'ink-2': '#b3aad8', line: '#3a3470', a1: '#29e0ff', a1s: '#123d55', a2: '#ff3fb4', a2s: '#4a1440', a3: '#ffe23f', a3d: '#c9a800', a3s: '#3a3410', a3ink: '#1a1600', g1: '#3b1f7a', g2: '#9a1f7a', g3: '#e05a2a', heroink: '#ffffff' } },
  { n: 'Terminal', d: 'dunkel', l: { bg: '#0d1410', surface: '#121c16', 'surface-2': '#18261d', ink: '#d9f7e3', 'ink-2': '#8fb79c', line: '#1f3328', a1: '#4ade80', a1s: '#143322', a2: '#38bdf8', a2s: '#0f2c3a', a3: '#a3e635', a3d: '#6c9d1a', a3s: '#1d2a10', a3ink: '#0b1400', g1: '#0f2e1c', g2: '#123b2a', g3: '#1d4a20', heroink: '#d9f7e3' } },
];
const FONTS = {
  pixel: { n: 'Pixel', d: '"Pixelify Sans", "Courier New", monospace', w: 700, ls: '0' },
  schlicht: { n: 'Schlicht', d: '"Atkinson Hyperlegible", -apple-system, system-ui, sans-serif', w: 700, ls: '-.01em' },
  elegant: { n: 'Elegant', d: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif', w: 600, ls: '.005em' },
};

/* ---------- Bausteine ---------- */
const INFO_KINDS = { merke: ['💡', 'Merke'], tipp: ['👉', 'Tipp'], achtung: ['⚠️', 'Achtung'], begriff: ['📘', 'Begriff'] };
const T = {
  text: { n: 'Text', ic: '¶', g: 'Grundbausteine', h: 'Absatz mit fett, kursiv, Code, Link', make: () => ({ html: '' }) },
  info: { n: 'Infokasten', ic: '💡', g: 'Grundbausteine', h: 'Merke, Tipp, Achtung, Begriff', make: () => ({ kind: 'merke', title: '', html: '' }) },
  image: { n: 'Bild / GIF', ic: '🖼', g: 'Grundbausteine', h: 'mit Bildunterschrift', make: () => ({ src: '', alt: '', caption: '', size: 'voll' }) },
  reveal: { n: 'Aufdecken', ic: '▸', g: 'Grundbausteine', h: 'Klappbox, z. B. „Mehr erfahren“', make: () => ({ summary: 'Mehr erfahren', html: '' }) },
  task: { n: 'Aufgabe', ic: '✎', g: 'Aufgaben', h: 'Auftrag mit Tipps, Lösung, Haken', make: () => ({ title: '', html: '', xp: 20, app: { kind: 'keine', cell: '', target: '' }, tips: [], solution: '', img: '' }) },
  quiz: { n: 'Quiz', ic: '?', g: 'Aufgaben', h: 'Einfach- oder Mehrfachauswahl', make: () => ({ q: '', opts: [{ t: '', ok: true }, { t: '', ok: false }, { t: '', ok: false }], multi: false, xp: 10 }) },
  gap: { n: 'Lückentext', ic: '▭', g: 'Aufgaben', h: 'Lücken als [[Antwort]] schreiben', make: () => ({ html: 'Eine Formel beginnt immer mit [[=]].', xp: 10 }) },
  match: { n: 'Zuordnen', ic: '⇄', g: 'Aufgaben', h: 'Paare per Drag & Drop', make: () => ({ title: 'Ordne zu', pairs: [{ a: '', b: '' }, { a: '', b: '' }], xp: 10 }) },
  lock: { n: 'Sperre', ic: '🔒', g: 'Ablauf', h: 'Ab hier erst frei, wenn … gelöst', make: () => ({ after: '' }) },
  sheet: { n: 'Tabelle laden', ic: '▦', g: 'FlowPad', app: 'flowpad', h: 'übernimmt die Tabelle aus FlowPad', make: () => ({ title: 'Tabelle laden', html: '', sheet: null }) },
  ftask: { n: 'Formel-Aufgabe', ic: 'fx', g: 'FlowPad', app: 'flowpad', h: 'Aufgabe mit Zielzelle und Zielformel', alias: 'task', make: () => ({ ...T.task.make(), app: { kind: 'formel', cell: '', target: '' } }) },
  dtask: { n: 'Diagramm-Aufgabe', ic: '⬭', g: 'FlowPad', app: 'flowpad', h: 'Diagramm bauen statt Formel tippen', alias: 'task', make: () => ({ ...T.task.make(), app: { kind: 'diagramm', cell: '', target: '' } }) },
  code: { n: 'Code', ic: '{ }', g: 'JPad · QPad', app: 'jpad', h: 'mit „In den Editor kopieren“', make: () => ({ lang: 'java', code: '' }) },
};
const CHECKABLE = new Set(['task', 'quiz', 'gap', 'match']);

/* ---------- Beispiel-Lernpfad ---------- */
function sample() {
  const s = (title, sub, blocks) => ({ id: uid(), title, sub, blocks: blocks.map(b => ({ id: uid(), ...b })) });
  const sheet = { A1: 'Artikel', B1: 'Preis', C1: 'Anzahl', D1: 'Gesamt', A2: 'Brezel', B2: '0,9', C2: '14', A3: 'Semmel', B3: '0,45', C3: '20', A4: 'Kakao', B4: '1,2', C4: '9' };
  const t1 = uid();
  return {
    v: 1, form: 'lernpfad', design: { pal: 0, font: 'pixel', shape: 'eckig', hero: 'logo', heroImg: '' },
    kicker: 'FlowPad · Lernpfad', title: 'Zellen und Formeln', subtitle: 'Jahrgangsstufe 9 · Tabellenkalkulation',
    stations: [
      s('Willkommen', 'Rundgang', [
        { type: 'text', html: 'In diesem Lernpfad rechnest du mit <b>Formeln</b> statt mit dem Taschenrechner. Links siehst du FlowPad, rechts diesen Lernpfad.' },
        { type: 'info', kind: 'merke', title: 'Merke', html: 'Eine Formel beginnt immer mit <code>=</code>.' },
      ]),
      s('Rechnen mit Zellbezügen', 'Baustein „Formel“', [
        { type: 'sheet', title: 'Tabelle laden', html: 'Die Preisliste des Pausenverkaufs.', sheet },
        { type: 'task', id: t1, title: 'Aufgabe 2.1', html: 'Schreibe in <b>D2</b> die Formel für den Gesamtpreis: Preis mal Anzahl.', xp: 30, app: { kind: 'formel', cell: 'D2', target: '=B2*C2' }, tips: ['Tippe zuerst <code>=</code>, dann die Zelle B2 an.', 'Mal heißt in Formeln <code>*</code>.'], solution: '<code>=B2*C2</code>', img: '' },
        { type: 'lock', after: t1 },
        { type: 'text', html: 'Stark! Jetzt kannst du die Formel nach unten ausfüllen – D3 und D4 rechnen dann automatisch mit.' },
      ]),
      s('Teste dich', 'Wiederholung', [
        { type: 'quiz', q: 'Was steht in D2, wenn B2 = 0,90 und C2 = 14 ist?', opts: [{ t: '14,90', ok: false }, { t: '12,60', ok: true }, { t: '=B2*C2', ok: false }], multi: false, xp: 10 },
        { type: 'gap', html: 'Eine Formel beginnt mit [[=]]. Für „mal“ schreibt man [[*]].', xp: 10 },
        { type: 'match', title: 'Ordne zu', pairs: [{ a: '=SUMME(B2:B4)', b: 'Summe aller Preise' }, { a: '=MITTELWERT(B2:B4)', b: 'Durchschnitt' }, { a: '=MAX(B2:B4)', b: 'Größter Preis' }], xp: 15 },
      ]),
      s('Zum Weiterlesen', 'Extra', [
        { type: 'reveal', summary: 'Warum nicht einfach die Zahlen eintippen?', html: 'Ändert sich ein Preis, rechnet eine Formel sofort neu – eine getippte Zahl bleibt falsch.' },
        { type: 'code', lang: 'java', code: 'double gesamt = preis * anzahl;' },
      ]),
    ],
    cert: { on: true, need: 'alle', pct: 80, text: 'hat den Lernpfad erfolgreich bearbeitet.', show: { zeit: true, tipps: true, quiz: true, xp: true } },
  };
}

/* ---------- Zustand ---------- */
let doc, mode = 'edit', selId = null, curSid = null, single = false, fz = 1;
let hist = [], fut = [], pending = null;
let prog = freshProg();
function freshProg() { return { solved: {}, quiz: {}, tips: {}, sol: {}, visited: {}, start: Date.now(), active: 0, last: Date.now() }; }
try { doc = JSON.parse(localStorage.getItem(STORE)) || sample(); } catch (e) { doc = sample(); }
hist = [JSON.stringify(doc)];

const lp = $('#lp'), scroller = $('#scroll');
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(doc)); $('#saved').textContent = '✓ gesichert'; } catch (e) { $('#saved').textContent = '⚠ zu groß zum Sichern'; }
}
function commit() { // Änderung abschließen: Verlauf + Sichern
  clearTimeout(pending); pending = null;
  const s = JSON.stringify(doc); if (s === hist[hist.length - 1]) return;
  hist.push(s); if (hist.length > 200) hist.shift(); fut = []; save(); updUndo();
}
function softCommit() { $('#saved').textContent = '…'; clearTimeout(pending); pending = setTimeout(commit, 500); }
function undo() { if (pending) commit(); if (hist.length < 2) return; fut.push(hist.pop()); doc = JSON.parse(hist[hist.length - 1]); save(); render(); updUndo(); }
function redo() { if (!fut.length) return; const s = fut.pop(); hist.push(s); doc = JSON.parse(s); save(); render(); updUndo(); }
function updUndo() { $('#bUndo').disabled = hist.length < 2; $('#bRedo').disabled = !fut.length; }

function findBlock(id) {
  for (const st of doc.stations) { const i = st.blocks.findIndex(b => b.id === id); if (i >= 0) return { st, i, b: st.blocks[i] }; }
  return null;
}
function toast(msg, ms = 2200) { $$('.ed-toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'ed-toast'; t.innerHTML = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }

/* ---------- Text säubern (nur einfache Auszeichnung bleibt) ---------- */
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'CODE', 'A', 'BR', 'UL', 'OL', 'LI', 'SUB', 'SUP']);
function clean(html) {
  const d = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html').body.firstChild;
  const walk = n => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1) { c.remove(); continue; }
      walk(c);
      if (c.tagName === 'DIV' || c.tagName === 'P') { c.before(document.createElement('br')); c.replaceWith(...c.childNodes); continue; }
      if (!OK_TAGS.has(c.tagName)) { c.replaceWith(...c.childNodes); continue; }
      for (const a of [...c.attributes]) if (!(c.tagName === 'A' && a.name === 'href')) c.removeAttribute(a.name);
      if (c.tagName === 'A') { if (!/^https?:\/\//i.test(c.getAttribute('href') || '')) c.removeAttribute('href'); c.setAttribute('class', 'link'); }
    }
  };
  walk(d);
  return d.innerHTML.replace(/^(<br>)+/, '').replace(/(<br>)+$/, '');
}

/* ---------- Rendern ---------- */
const E = () => mode === 'edit';
/** Bearbeitbares Feld: path = Feld im Baustein (z. B. "html", "opts.1.t"), rich = mit Auszeichnung */
function ce(path, val, ph, { rich = false, tag = 'div', cls = '' } = {}) {
  if (!E()) return `<${tag}${cls ? ` class="${cls}"` : ''}>${rich ? (val || '') : esc(val)}</${tag}>`;
  return `<${tag} class="${cls}" contenteditable="true" data-f="${path}"${rich ? ' data-rich="1"' : ''} data-ph="${esc(ph)}" spellcheck="true">${rich ? (val || '') : esc(val)}</${tag}>`;
}
function applyDesign() {
  const p = PALETTES[doc.design.pal] || PALETTES[0], f = FONTS[doc.design.font] || FONTS.pixel, st = lp.style;
  for (const k in p.l) st.setProperty('--' + k, p.l[k]);
  st.setProperty('--font-display', f.d); st.setProperty('--display-weight', f.w); st.setProperty('--display-ls', f.ls); st.setProperty('--fz', fz);
  lp.dataset.shape = doc.design.shape; lp.dataset.form = doc.form;
  $('.lpwrap').style.background = p.l.bg;
}
function render() {
  const sc = scroller.scrollTop;
  applyDesign();
  lp.classList.toggle('editing', E());
  lp.classList.toggle('single-station', single);
  if (!curSid || !doc.stations.some(s => s.id === curSid)) curSid = doc.stations[0]?.id;
  const d = doc.design, logo = d.hero === 'bild' && d.heroImg ? `<img src="${d.heroImg}" alt="">` : 'F';
  let h = `<div class="fontsize"><button data-fz="-" aria-label="Schrift kleiner">A−</button><button data-fz="+" aria-label="Schrift größer">A+</button></div>`;
  h += `<header class="lp-hero${d.hero === 'hintergrund' && d.heroImg ? ' has-bg' : ''}"${d.hero === 'hintergrund' && d.heroImg ? ` style="background-image:url(${d.heroImg})"` : ''}>`
    + (d.hero !== 'hintergrund' ? `<div class="lp-logo"${E() ? ' title="Antippen: eigenes Bild oder GIF setzen"' : ''}>${logo}</div>` : '')
    + `<div>${ce('$kicker', doc.kicker, 'Kopfzeile', { tag: 'small' })}${ce('$title', doc.title, 'Titel des Lernpfads', { tag: 'h1' })}${ce('$subtitle', doc.subtitle, 'Untertitel', { tag: 'p' })}</div></header>`;
  h += `<nav class="lp-trail"><div class="lp-trail-in"><div class="lp-stops" id="stops">${doc.stations.map((s, i) => `<a data-sid="${s.id}" class="${stationDone(s) ? 'done' : ''}${s.id === curSid ? ' cur' : ''}" title="${esc(s.title)}">${stationDone(s) ? '✓' : i + 1}</a>`).join('')}${doc.cert.on ? '<a data-sid="cert" title="Abschluss">🏁</a>' : ''}</div><span class="lp-count">${doc.stations.filter(stationDone).length} / ${doc.stations.length}</span></div></nav>`;
  h += `<main class="lp-main">`;
  if (doc.form === 'challenge') { const x = xpNow(), mx = xpMax() || 1; h += `<div class="lp-hud"><span>⚡ ${x} XP</span><span class="bar"><i style="width:${Math.round(100 * x / mx)}%"></i></span><span>von ${mx}</span></div>`; }
  doc.stations.forEach((s, si) => {
    h += `<section class="lp-station${s.id === curSid ? ' cur' : ''}" id="st-${s.id}" data-sid="${s.id}">`;
    h += `<div class="lp-sh"><span class="lp-nr">${si + 1}</span><div style="flex:1;min-width:0">${ce('$st.sub', s.sub, 'Untertitel der Station', { tag: 'small' })}${ce('$st.title', s.title, 'Titel der Station', { tag: 'h2' })}</div>`
      + `<span class="ed-station-tools"><button data-sact="up" title="Station nach oben">↑</button><button data-sact="down" title="Station nach unten">↓</button><button data-sact="del" title="Station löschen">🗑</button></span></div>`;
    let locked = false, open = '';
    s.blocks.forEach((b, i) => {
      if (E()) h += plus(s.id, i);
      if (b.type === 'lock' && !E()) {
        if (open) h += '</div></div>';
        const isLocked = !prog.solved[b.after];
        const ref = findBlock(b.after);
        h += `<div class="lp-lock${isLocked ? ' locked' : ''}"><div class="lp-lock-note">🔒 Geht weiter, sobald ${ref ? esc(blockLabel(ref.b)) : 'die Aufgabe'} gelöst ist.</div><div class="lp-lock-body">`;
        open = 'x'; locked = isLocked; return;
      }
      h += blockHtml(b, locked);
    });
    if (open) h += '</div></div>';
    if (E()) h += plus(s.id, s.blocks.length);
    h += `</section>`;
  });
  if (E()) h += `<button class="ed-add-station" data-act="addStation">＋ Neue Station</button>`;
  if (doc.cert.on || E()) h += certHtml();
  h += `</main><footer class="lp-foot">${doc.form === 'challenge' ? 'Challenge' : 'Lernpfad'} · erstellt mit dem Lernpfad-Editor · läuft komplett im Browser</footer>`;
  lp.innerHTML = h;
  scroller.scrollTop = sc;
  if (selId && !findBlock(selId)) selId = null;
  markSel();
}
function plus(sid, at) { return `<div class="ed-plus" data-sid="${sid}" data-at="${at}"><button title="Baustein einfügen" aria-label="Baustein einfügen">+</button></div>`; }
function blockLabel(b) {
  if (b.type === 'task') return (b.title || 'die Aufgabe') + (b.app?.cell ? ` (${b.app.cell})` : '');
  if (b.type === 'quiz') return 'das Quiz „' + (b.q || '').replace(/<[^>]+>/g, '').slice(0, 30) + '“';
  return T[b.type]?.n || b.type;
}
function tools(b) {
  const t = T[b.type];
  return `<div class="ed-tools" contenteditable="false"><button class="grip" data-bact="grip" title="Ziehen zum Verschieben" aria-label="Verschieben">⠿</button><span class="lbl">${esc(t?.n || b.type)}</span>`
    + `<button data-bact="up" title="Nach oben (⌥↑)">↑</button><button data-bact="down" title="Nach unten (⌥↓)">↓</button>`
    + `<button data-bact="dup" title="Verdoppeln">⧉</button>${FORMS[b.type] ? '<button data-bact="cfg" title="Einstellungen">⚙</button>' : ''}<button class="del" data-bact="del" title="Löschen">🗑</button></div>`;
}
function wrap(b, inner, cls = '') { return `<div class="blk ${cls}" data-id="${b.id}">${E() ? tools(b) : ''}${inner}</div>`; }
function imgHtml(src, cap, size) { return src ? `<figure class="lp-img"${size === 'klein' ? ' style="max-width:45%"' : ''}><img src="${src}" alt="">${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>` : ''; }
function xpTag(b) { return doc.form === 'challenge' && b.xp ? `<span class="xp">+${b.xp} XP</span>` : ''; }

function blockHtml(b) {
  const ok = !!prog.solved[b.id];
  switch (b.type) {
    case 'text': return wrap(b, ce('html', b.html, 'Text schreiben … ( / für Bausteine)', { rich: true, cls: 'lp-text' }));
    case 'info': { const [ic, def] = INFO_KINDS[b.kind] || INFO_KINDS.merke; return wrap(b, `<div class="lp-info ${b.kind}"><span class="ic">${ic}</span><div style="flex:1">${ce('title', b.title || (E() ? '' : def), def, { tag: 'b', cls: 't' })}${ce('html', b.html, 'Inhalt', { rich: true })}</div></div>`); }
    case 'image': return wrap(b, b.src ? imgHtml(b.src, b.caption, b.size) : (E() ? `<div class="lp-card" style="text-align:center"><button class="lp-btn alt" data-bact="cfg">🖼 Bild oder GIF wählen</button></div>` : ''));
    case 'reveal': return wrap(b, E() ? `<div class="lp-card">${ce('summary', b.summary, 'Überschrift der Klappbox', { tag: 'b', cls: 'lp-ctitle' })}${ce('html', b.html, 'Inhalt, der aufgeklappt wird', { rich: true })}</div>`
      : `<details class="lp-card"><summary>${esc(b.summary)}</summary><div>${b.html}</div></details>`);
    case 'task': {
      const a = b.app || {}, fp = a.kind === 'formel' || a.kind === 'diagramm';
      let h = `<div class="lp-card lp-task${ok ? ' ok' : ''}"><div class="hd">${ce('title', b.title, 'Aufgabe 1', { tag: 'b', cls: 'lp-ctitle' })}${xpTag(b)}<span class="lp-state">${ok ? '✓ geschafft' : ''}</span></div>`;
      h += imgHtml(b.img, '', 'klein') + ce('html', b.html, 'Arbeitsauftrag …', { rich: true });
      if (fp) h += `<div><button class="lp-btn alt" data-run="task">${a.kind === 'diagramm' ? '⬭ Diagramm-Aufgabe in FlowPad öffnen' : '▶ Aufgabe in FlowPad öffnen'}</button></div>`
        + (E() ? `<div class="ed-hint">FlowPad prüft <b>${esc(a.cell || '?')}</b> gegen <b>${esc(a.target || '?')}</b> · ${a.kind === 'diagramm' ? 'als Diagramm' : 'als Formel'} <span style="opacity:.7">(⚙ zum Ändern)</span></div>` : '');
      else h += `<div><button class="lp-btn${ok ? ' alt' : ''}" data-run="done">${ok ? '✓ erledigt' : 'Erledigt'}</button></div>`;
      (b.tips || []).forEach((t, i) => { h += `<details data-tip="${i}"><summary>Tipp ${i + 1}</summary><div>${t}</div></details>`; });
      if (b.solution) h += `<details data-sol="1"><summary>Lösung anzeigen</summary><div>${b.solution}</div></details>`;
      if (E() && !(b.tips || []).length && !b.solution) h += `<div class="ed-hint">Tipps und Lösung über ⚙ hinzufügen</div>`;
      return wrap(b, h + '</div>');
    }
    case 'quiz': {
      const st = prog.quiz[b.id];
      let h = `<div class="lp-card lp-quiz"><b class="lp-ctitle">Quiz</b>${xpTag(b)}${ce('q', b.q, 'Frage …', { rich: true })}`;
      b.opts.forEach((o, i) => {
        if (E()) h += `<div class="opt" style="display:flex;gap:8px;align-items:center"><button data-qok="${i}" title="richtig/falsch" style="border:0;background:none;font-size:18px;cursor:pointer">${o.ok ? '✅' : '⬜'}</button>${ce(`opts.${i}.t`, o.t, 'Antwort ' + (i + 1), { tag: 'span', cls: '' })}</div>`;
        else h += `<button class="opt${st && st.picked === i ? (o.ok ? ' ok' : ' no') : ''}" data-opt="${i}">${esc(o.t)}</button>`;
      });
      if (E()) h += `<div class="ed-hint">✅ markiert die richtige Antwort · Antworten über ⚙ hinzufügen</div>`;
      else if (st) h += `<div class="fb" style="color:var(${b.opts[st.picked]?.ok ? '--good' : '--bad'})">${b.opts[st.picked]?.ok ? '✓ Richtig!' : '✗ Leider nicht – versuch es nochmal.'}</div>`;
      return wrap(b, h + '</div>');
    }
    case 'gap': {
      if (E()) return wrap(b, `<div class="lp-card lp-gap"><b class="lp-ctitle">Lückentext</b>${xpTag(b)}${ce('html', b.html, 'Text mit [[Lücke]] …', { rich: true })}<div class="ed-hint">Lücken als <b>[[Antwort]]</b> schreiben, mehrere richtige Antworten mit | trennen: [[mal|*]]</div></div>`);
      let n = 0; const html = (b.html || '').replace(/\[\[(.+?)\]\]/g, () => `<input data-gap="${n}" value="${esc(prog.quiz[b.id + ':' + n] || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" data-n="${n++}">`);
      return wrap(b, `<div class="lp-card lp-gap"><b class="lp-ctitle">Lückentext</b>${xpTag(b)}<div>${html}</div><div class="lp-state" style="margin-top:6px">${ok ? '✓ alles richtig' : ''}</div></div>`);
    }
    case 'match': {
      if (E()) return wrap(b, `<div class="lp-card lp-match">${ce('title', b.title, 'Ordne zu', { tag: 'b', cls: 'lp-ctitle' })}${xpTag(b)}<div class="grid">${b.pairs.map((p, i) => `<div class="chip" style="cursor:text">${ce(`pairs.${i}.a`, p.a, 'Karte', { tag: 'span' })}</div><div class="slot">${ce(`pairs.${i}.b`, p.b, 'passt zu …', { tag: 'span' })}</div>`).join('')}</div><div class="ed-hint">Links die Karten, rechts das Passende – in der Vorschau werden die Karten gemischt. Paare über ⚙ hinzufügen.</div></div>`);
      const got = prog.quiz[b.id] || {}; const order = shuffled(b.pairs.map((_, i) => i), b.id);
      const used = new Set(Object.values(got));
      return wrap(b, `<div class="lp-card lp-match"><b class="lp-ctitle">${esc(b.title)}</b>${xpTag(b)}<div class="grid">`
        + b.pairs.map((p, i) => { const ci = order[i]; const g = got[i]; return `<div class="chip${used.has(ci) ? ' used' : ''}" data-chip="${ci}">${esc(b.pairs[ci].a)}</div><div class="slot${g != null ? (g === i ? ' ok' : ' no') : ''}" data-slot="${i}"><span>${esc(p.b)}</span>${g != null ? `<span class="got">${esc(b.pairs[g].a)}</span>` : ''}</div>`; }).join('')
        + `</div><div class="lp-state" style="margin-top:6px">${ok ? '✓ alles richtig zugeordnet' : 'Karte antippen, dann das Passende – oder ziehen.'}</div></div>`);
    }
    case 'lock': {
      const ref = findBlock(b.after);
      return wrap(b, `<div class="lp-card" style="border-style:dashed;text-align:center;color:var(--ink-2)">🔒 <b>Sperre</b> – alles darunter in dieser Station wird erst frei, wenn <b>${ref ? esc(blockLabel(ref.b)) : '<i>(noch keine Aufgabe gewählt – ⚙)</i>'}</b> gelöst ist.</div>`);
    }
    case 'sheet': {
      const n = b.sheet ? Object.keys(b.sheet).length : 0;
      return wrap(b, `<div class="lp-card lp-sheet">${ce('title', b.title, 'Tabelle laden', { tag: 'b', cls: 'lp-ctitle' })}${ce('html', b.html, 'Beschreibung (optional)', { rich: true })}<button class="lp-btn" data-run="sheet">▦ ${esc(b.title || 'Tabelle laden')}</button>${E() ? `<div class="ed-hint">${n ? `Enthält eine Tabelle mit ${n} Zellen.` : 'Noch keine Tabelle.'} ⚙ → <b>aus FlowPad übernehmen</b> holt die aktuelle Tabelle.</div>` : ''}</div>`);
    }
    case 'code': return wrap(b, `<div class="lp-card lp-code"><b class="lp-ctitle">Code</b> <span style="color:var(--ink-2);font-size:.85em">${esc(b.lang)}</span>${E() ? `<pre contenteditable="true" data-f="code" data-ph="Code …" spellcheck="false">${esc(b.code)}</pre>` : `<pre>${esc(b.code)}</pre>`}<button class="lp-btn alt" data-run="copy">⧉ In den Editor kopieren</button>${E() ? '<div class="ed-hint">JPad/QPad-Baustein – im Entwurf nur als Beispiel</div>' : ''}</div>`);
  }
  return wrap(b, `<div class="lp-card">${esc(b.type)}</div>`);
}
function certHtml() {
  const c = doc.cert, can = certReady();
  if (!c.on) return `<div class="lp-cert" style="opacity:.5"><div class="seal">★</div><div><b>Zertifikat ist aus</b><br><button class="lp-btn alt" data-act="certcfg">⚙ Zertifikat einstellen</button></div></div>`;
  return `<div class="lp-cert" id="st-cert"><div class="seal">★</div><div><b>${doc.form === 'challenge' ? 'Challenge geschafft?' : 'Zertifikat'}</b><br>${E() ? `Am Ende: Name eingeben, PDF mit Bearbeitungszeit und Erfolgsübersicht.<br><button class="lp-btn alt" data-act="certcfg">⚙ Zertifikat einstellen</button><button class="lp-btn alt" data-act="certprev">Muster ansehen</button>`
    : (can ? `Alles geschafft – erstelle dein Zertifikat.<br><button class="lp-btn" data-act="certprev">★ Zertifikat (PDF) erstellen</button>` : `Wird frei, wenn ${c.need === 'alle' ? 'alle Aufgaben gelöst sind' : c.need === 'pct' ? `mindestens ${c.pct} % gelöst sind` : '…'}.<br><button class="lp-btn" disabled>★ Zertifikat (PDF) erstellen</button>`)}</div></div>`;
}
function shuffled(arr, seed) { let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function stationDone(s) { const c = s.blocks.filter(b => CHECKABLE.has(b.type)); return c.length ? c.every(b => prog.solved[b.id]) : !!prog.visited[s.id] && mode === 'preview'; }
function allCheckable() { return doc.stations.flatMap(s => s.blocks.filter(b => CHECKABLE.has(b.type))); }
function certReady() { const all = allCheckable(), n = all.filter(b => prog.solved[b.id]).length; if (doc.cert.need === 'immer') return true; if (doc.cert.need === 'pct') return n >= Math.ceil(all.length * doc.cert.pct / 100); return n === all.length; }
function xpMax() { return allCheckable().reduce((a, b) => a + (+b.xp || 0), 0); }
function xpNow() { return allCheckable().filter(b => prog.solved[b.id]).reduce((a, b) => a + (+b.xp || 0), 0); }
function markSel() { $$('.blk', lp).forEach(e => e.classList.toggle('sel', e.dataset.id === selId)); }

/* ---------- Eingaben im Bearbeiten-Modus ---------- */
function setPath(obj, path, val) { const ks = path.split('.'); let o = obj; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = val; }
lp.addEventListener('input', ev => {
  const el = ev.target.closest('[data-f]'); if (!el || !E()) return;
  const f = el.dataset.f, val = el.dataset.rich ? clean(el.innerHTML) : el.textContent.replace(/\s+/g, ' ').trim();
  if (f === 'code') { const r = findBlock(el.closest('.blk').dataset.id); r.b.code = el.innerText.replace(/\n$/, ''); softCommit(); return; }
  if (f.startsWith('$st.')) { const s = doc.stations.find(x => x.id === el.closest('.lp-station').dataset.sid); s[f.slice(4)] = val; softCommit(); refreshTrail(); return; }
  if (f.startsWith('$')) { doc[f.slice(1)] = val; softCommit(); return; }
  const r = findBlock(el.closest('.blk').dataset.id); if (!r) return;
  setPath(r.b, f, val); softCommit();
});
lp.addEventListener('paste', ev => { // nur Text einfügen, damit kein fremdes Design hereinkommt
  const el = ev.target.closest('[contenteditable]'); if (!el) return;
  ev.preventDefault(); const t = (ev.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, t);
});
lp.addEventListener('focusout', ev => { if (ev.target.closest('[data-f]')) commit(); });
function refreshTrail() { $$('#stops a[data-sid]', lp).forEach(a => { const s = doc.stations.find(x => x.id === a.dataset.sid); if (s) a.title = s.title; }); }

/* ---------- Klicks ---------- */
lp.addEventListener('click', ev => {
  const t = ev.target;
  if (E() && t.closest('.lp-logo, .lp-hero.has-bg') && !t.closest('[data-f]')) { openDesign(); return; } // Kopfbild direkt ändern
  const fzb = t.closest('[data-fz]'); if (fzb) { fz = Math.min(1.5, Math.max(.8, +(fz + (fzb.dataset.fz === '+' ? .1 : -.1)).toFixed(2))); lp.style.setProperty('--fz', fz); return; }
  const stop = t.closest('#stops a'); if (stop) { if (stop.dataset.sid === 'cert') { $('#st-cert')?.scrollIntoView({ behavior: 'smooth' }); return; } goStation(stop.dataset.sid, true); return; }
  const act = t.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'addStation') { const s = { id: uid(), title: '', sub: '', blocks: [{ id: uid(), type: 'text', html: '' }] }; doc.stations.push(s); curSid = s.id; commit(); render(); goStation(s.id, true); setTimeout(() => $(`#st-${s.id} h2[data-f]`)?.focus(), 350); return; }
    if (a === 'certcfg') { openForm('cert'); return; }
    if (a === 'certprev') { certPreview(); return; }
  }
  const sact = t.closest('[data-sact]');
  if (sact) {
    const sid = sact.closest('.lp-station').dataset.sid, i = doc.stations.findIndex(s => s.id === sid), a = sact.dataset.sact;
    if (a === 'del') { if (doc.stations.length < 2) { toast('Die letzte Station bleibt.'); return; } if (!confirm('Station „' + (doc.stations[i].title || 'ohne Titel') + '“ mit allen Bausteinen löschen?')) return; doc.stations.splice(i, 1); }
    else { const j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= doc.stations.length) return; [doc.stations[i], doc.stations[j]] = [doc.stations[j], doc.stations[i]]; }
    commit(); render(); if (a !== 'del') goStation(sid, false); return;
  }
  const pl = t.closest('.ed-plus button'); if (pl) { const p = pl.parentElement; openPalette(pl, { sid: p.dataset.sid, at: +p.dataset.at }); return; }
  const bact = t.closest('[data-bact]');
  if (bact && E()) { blockAction(bact.closest('.blk').dataset.id, bact.dataset.bact); return; }
  const qok = t.closest('[data-qok]');
  if (qok && E()) { const r = findBlock(qok.closest('.blk').dataset.id); const i = +qok.dataset.qok; if (r.b.multi) r.b.opts[i].ok = !r.b.opts[i].ok; else r.b.opts.forEach((o, k) => o.ok = k === i); commit(); render(); return; }
  const run = t.closest('[data-run]');
  if (run) { runAction(run.closest('.blk').dataset.id, run.dataset.run); return; }
  const opt = t.closest('[data-opt]');
  if (opt && !E()) { const id = opt.closest('.blk').dataset.id, r = findBlock(id), i = +opt.dataset.opt; prog.quiz[id] = { picked: i }; if (r.b.opts[i].ok) solve(id); else render(); return; }
  const chip = t.closest('[data-chip]');
  if (chip && !E()) { $$('.chip.picked', lp).forEach(c => c !== chip && c.classList.remove('picked')); chip.classList.toggle('picked'); return; }
  const slot = t.closest('[data-slot]');
  if (slot && !E()) { const pick = $('.chip.picked', slot.closest('.blk')); if (pick) placeChip(slot.closest('.blk').dataset.id, +pick.dataset.chip, +slot.dataset.slot); return; }
  // Baustein auswählen
  const blk = t.closest('.blk');
  if (E()) { selId = blk ? blk.dataset.id : null; markSel(); if (blk) curSid = blk.closest('.lp-station')?.dataset.sid || curSid; }
});
lp.addEventListener('toggle', ev => {
  if (E()) return;
  const d = ev.target; if (!d.matches || !d.matches('details') || !d.open) return;
  const id = d.closest('.blk')?.dataset.id; if (!id) return;
  if (d.dataset.tip != null) { prog.tips[id + ':' + d.dataset.tip] = 1; }
  if (d.dataset.sol) prog.sol[id] = 1;
}, true);
lp.addEventListener('input', ev => { // Lückentext prüfen
  if (E()) return; const inp = ev.target.closest('[data-gap]'); if (!inp) return;
  const id = inp.closest('.blk').dataset.id, r = findBlock(id); prog.quiz[id + ':' + inp.dataset.n] = inp.value;
  const ans = [...r.b.html.matchAll(/\[\[(.+?)\]\]/g)].map(m => m[1]);
  const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  let all = true;
  $$('[data-gap]', inp.closest('.blk')).forEach((e, i) => { const good = ans[i].split('|').some(a => norm(a) === norm(e.value)); e.classList.toggle('ok', good); e.classList.toggle('no', !good && e.value.trim() !== ''); if (!good) all = false; });
  if (all && !prog.solved[id]) { solve(id, true); }
});
function placeChip(id, chip, slot) {
  const r = findBlock(id), got = prog.quiz[id] || (prog.quiz[id] = {});
  for (const k in got) if (got[k] === chip) delete got[k];
  got[slot] = chip;
  if (r.b.pairs.every((_, i) => got[i] === i)) solve(id); else render();
}
function solve(id, keepFocus) {
  prog.solved[id] = true;
  const r = findBlock(id); if (doc.form === 'challenge' && r?.b.xp) toast(`⚡ +${r.b.xp} XP`);
  if (keepFocus) { const s = scroller.scrollTop; const a = document.activeElement, n = a?.dataset?.n; render(); scroller.scrollTop = s; if (n != null) { const e = $(`.blk[data-id="${id}"] [data-n="${n}"]`, lp); e?.focus(); e && (e.selectionStart = e.value.length); } }
  else render();
}

/* ---------- Bausteine bearbeiten ---------- */
function blockAction(id, a) {
  const r = findBlock(id); if (!r) return;
  if (a === 'cfg') { selId = id; markSel(); openForm(id); return; }
  if (a === 'grip') return;
  if (a === 'del') { r.st.blocks.splice(r.i, 1); selId = null; commit(); render(); toast('Baustein gelöscht · <b>⌘Z</b> holt ihn zurück'); return; }
  if (a === 'dup') { const c = clone(r.b); c.id = uid(); r.st.blocks.splice(r.i + 1, 0, c); selId = c.id; commit(); render(); return; }
  if (a === 'up' || a === 'down') moveBlock(id, a === 'up' ? -1 : 1);
}
function moveBlock(id, dir) {
  const r = findBlock(id); if (!r) return;
  const si = doc.stations.indexOf(r.st), j = r.i + dir;
  if (j >= 0 && j < r.st.blocks.length) { [r.st.blocks[r.i], r.st.blocks[j]] = [r.st.blocks[j], r.st.blocks[r.i]]; }
  else { const ns = doc.stations[si + dir]; if (!ns) return; r.st.blocks.splice(r.i, 1); if (dir < 0) ns.blocks.push(r.b); else ns.blocks.unshift(r.b); curSid = ns.id; }
  commit(); render(); $(`.blk[data-id="${id}"]`, lp)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function insertBlock(type, sid, at, replaceId) {
  const def = T[type]; const b = { id: uid(), type: def.alias || type, ...def.make() };
  const st = doc.stations.find(s => s.id === sid);
  if (replaceId) { const r = findBlock(replaceId); r.st.blocks.splice(r.i, 1, b); } else st.blocks.splice(at, 0, b);
  selId = b.id; curSid = sid; commit(); render();
  const el = $(`.blk[data-id="${b.id}"]`, lp);
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (['image', 'lock', 'sheet'].includes(type) || b.app?.kind === 'formel' || b.app?.kind === 'diagramm') openForm(b.id);
  else setTimeout(() => $('[data-f]', el)?.focus(), 60);
}

/* ---------- Bausteinauswahl (+ und /) ---------- */
let pop = null;
function closePop() { pop?.remove(); pop = null; }
function openPalette(anchor, ctx) {
  closePop();
  pop = document.createElement('div'); pop.className = 'ed-pop';
  let filter = '', hi = 0;
  const draw = () => {
    const items = Object.entries(T).filter(([k, t]) => !filter || (t.n + ' ' + t.h + ' ' + k).toLowerCase().includes(filter));
    let g = '', h = `<h3>${ctx.slash ? `Baustein: „/${esc(filter)}“` : 'Baustein einfügen'}</h3><div class="ed-pal">`;
    items.forEach(([k, t], i) => { if (t.g !== g) { g = t.g; h += `<div class="grp">${g}</div>`; } h += `<button data-type="${k}" class="${i === hi ? 'hi' : ''}"><b>${t.ic} ${esc(t.n)}</b><span>${esc(t.h)}</span></button>`; });
    if (!items.length) h += '<div class="grp">nichts gefunden</div>';
    pop.innerHTML = h + '</div>'; pop._items = items;
  };
  draw();
  pop.addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; closePop(); insertBlock(b.dataset.type, ctx.sid, ctx.at, ctx.replaceId); });
  pop._key = e => {
    const items = pop._items;
    if (e.key === 'ArrowDown') { hi = Math.min(items.length - 1, hi + 1); draw(); e.preventDefault(); return true; }
    if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); draw(); e.preventDefault(); return true; }
    if (e.key === 'Enter') { e.preventDefault(); const it = items[hi]; closePop(); if (it) insertBlock(it[0], ctx.sid, ctx.at, ctx.replaceId); return true; }
    if (e.key === 'Escape') { closePop(); return true; }
    if (ctx.slash) {
      if (e.key === 'Backspace') { if (!filter) { closePop(); return false; } filter = filter.slice(0, -1); hi = 0; draw(); return false; }
      if (e.key.length === 1) { filter += e.key.toLowerCase(); hi = 0; draw(); return false; }
    }
    return false;
  };
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, ph = pop.offsetHeight;
  let x = Math.min(innerWidth - w - 10, Math.max(10, r.left + r.width / 2 - w / 2)), y = r.bottom + 6;
  if (y + ph > innerHeight - 10) y = Math.max(10, r.top - ph - 6);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
document.addEventListener('pointerdown', e => { if (pop && !pop.contains(e.target) && !e.target.closest('.ed-plus')) closePop(); }, true);

/* ---------- Tastenkürzel ---------- */
document.addEventListener('keydown', e => {
  if (pop && pop._key && pop._key(e)) return;
  if ($('.ed-dlg')) { if (e.key === 'Escape') closeDlg(false); return; }
  const mod = e.metaKey || e.ctrlKey, ed = e.target.closest?.('[data-f]');
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); setMode(mode === 'edit' ? 'preview' : 'edit'); return; }
  if (!E()) return;
  if (ed && mod && e.key.toLowerCase() === 'e') { e.preventDefault(); wrapSel('code'); return; }
  if (ed && mod && e.key.toLowerCase() === 'k') { e.preventDefault(); const url = prompt('Link-Adresse (https://…)'); if (url && /^https?:\/\//.test(url)) document.execCommand('createLink', false, url); return; }
  if (ed && mod && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'i') && !ed.dataset.rich) { e.preventDefault(); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); const r = selId && findBlock(selId); const st = r ? r.st : doc.stations.find(s => s.id === curSid); insertBlock('text', st.id, r ? r.i + 1 : st.blocks.length); return; }
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && selId) { e.preventDefault(); if (pending) commit(); moveBlock(selId, e.key === 'ArrowUp' ? -1 : 1); return; }
  if (e.key === '/' && ed && ed.dataset.f === 'html' && ed.textContent.trim() === '') { // /-Befehl in leerem Textbaustein
    const blk = ed.closest('.blk'), r = findBlock(blk.dataset.id);
    if (r && r.b.type === 'text') { e.preventDefault(); openPalette(ed, { sid: r.st.id, at: r.i, replaceId: r.b.id, slash: true }); }
    return;
  }
  if (e.key === 'Escape') { selId = null; markSel(); document.activeElement?.blur(); }
});
function wrapSel(tag) {
  const s = getSelection(); if (!s.rangeCount) return; const r = s.getRangeAt(0); if (r.collapsed) return;
  const el = document.createElement(tag); el.appendChild(r.extractContents()); r.insertNode(el);
  s.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(el); s.addRange(nr);
  el.closest('[data-f]')?.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ---------- Ziehen: Bausteine und Stationen ---------- */
let drag = null;
lp.addEventListener('pointerdown', e => {
  if (!E()) { chipDown(e); return; }
  const g = e.target.closest('.grip');
  if (g) { e.preventDefault(); const blk = g.closest('.blk'); selId = blk.dataset.id; markSel(); drag = { kind: 'blk', id: blk.dataset.id, el: blk, line: document.createElement('div') }; drag.line.className = 'ed-drop-line'; blk.classList.add('drag-ghost'); g.setPointerCapture(e.pointerId); return; }
  const stop = e.target.closest('#stops a[data-sid]');
  if (stop && stop.dataset.sid !== 'cert') { drag = { kind: 'st', id: stop.dataset.sid, el: stop, x: e.clientX, moved: false, pid: e.pointerId }; }
});
lp.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.kind === 'chip') { chipMove(e); return; }
  if (drag.kind === 'st') {
    if (!drag.moved && Math.abs(e.clientX - drag.x) < 8) return;
    if (!drag.moved) { drag.moved = true; drag.el.classList.add('dragging'); try { drag.el.setPointerCapture(drag.pid); } catch (er) { } }
    $$('#stops a', lp).forEach(a => a.classList.remove('drop-before', 'drop-after'));
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('#stops a[data-sid]');
    if (over && over !== drag.el && over.dataset.sid !== 'cert') { const r = over.getBoundingClientRect(); const after = e.clientX > r.left + r.width / 2; over.classList.add(after ? 'drop-after' : 'drop-before'); drag.to = { sid: over.dataset.sid, after }; } else drag.to = null;
    return;
  }
  // Baustein
  autoScroll(e.clientY);
  const els = document.elementsFromPoint(e.clientX, e.clientY);
  const over = els.map(x => x.closest('.blk')).find(x => x && x !== drag.el);
  drag.line.remove(); drag.to = null;
  if (over) { const r = over.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2; (after ? over.after(drag.line) : over.before(drag.line)); drag.to = { id: over.dataset.id, after }; return; }
  const st = els.map(x => x.closest('.lp-station')).find(Boolean);
  if (st) { const last = [...st.querySelectorAll(':scope > .ed-plus')].pop(); last?.before(drag.line); drag.to = { sid: st.dataset.sid, end: true }; }
});
function endDrag(e) {
  if (!drag) return;
  if (drag.kind === 'chip') { chipUp(e); return; }
  const d = drag; drag = null;
  if (d.kind === 'st') {
    $$('#stops a', lp).forEach(a => a.classList.remove('drop-before', 'drop-after', 'dragging'));
    if (d.moved && d.to) { const i = doc.stations.findIndex(s => s.id === d.id); const [s] = doc.stations.splice(i, 1); let j = doc.stations.findIndex(x => x.id === d.to.sid); if (d.to.after) j++; doc.stations.splice(j, 0, s); commit(); render(); toast('Station verschoben'); }
    return;
  }
  d.line.remove(); d.el.classList.remove('drag-ghost'); clearInterval(scrollTimer); scrollTimer = null;
  if (!d.to) return;
  const r = findBlock(d.id); r.st.blocks.splice(r.i, 1);
  if (d.to.end) { const st = doc.stations.find(s => s.id === d.to.sid); st.blocks.push(r.b); curSid = st.id; }
  else { const t = findBlock(d.to.id); t.st.blocks.splice(t.i + (d.to.after ? 1 : 0), 0, r.b); curSid = t.st.id; }
  commit(); render();
}
lp.addEventListener('pointerup', endDrag); lp.addEventListener('pointercancel', endDrag);
let scrollTimer = null, scrollDy = 0;
function autoScroll(y) {
  const r = scroller.getBoundingClientRect(); scrollDy = y < r.top + 60 ? -12 : y > r.bottom - 60 ? 12 : 0;
  if (scrollDy && !scrollTimer) scrollTimer = setInterval(() => { if (!scrollDy) { clearInterval(scrollTimer); scrollTimer = null; } scroller.scrollTop += scrollDy; }, 16);
}
/* Zuordnen in der Vorschau: Karte ziehen (oder antippen + antippen) */
function chipDown(e) {
  const c = e.target.closest('[data-chip]'); if (!c || c.classList.contains('used')) return;
  drag = { kind: 'chip', el: c, x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId };
}
function chipMove(e) {
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
  if (!drag.moved) { drag.moved = true; try { drag.el.setPointerCapture(drag.pid); } catch (er) { } drag.ghost = drag.el.cloneNode(true); Object.assign(drag.ghost.style, { position: 'fixed', zIndex: 300, pointerEvents: 'none', width: drag.el.offsetWidth + 'px', opacity: .9, boxShadow: '0 8px 20px rgba(0,0,0,.25)' }); document.body.appendChild(drag.ghost); }
  drag.ghost.style.left = (e.clientX - drag.el.offsetWidth / 2) + 'px'; drag.ghost.style.top = (e.clientY - 20) + 'px';
  $$('.slot.hover', lp).forEach(s => s.classList.remove('hover'));
  document.elementsFromPoint(e.clientX, e.clientY).find(x => x.matches?.('[data-slot]'))?.classList.add('hover');
}
function chipUp(e) {
  const d = drag; drag = null; if (!d.moved) return;
  d.ghost?.remove(); $$('.slot.hover', lp).forEach(s => s.classList.remove('hover'));
  const s = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.matches?.('[data-slot]'));
  if (s && s.closest('.blk') === d.el.closest('.blk')) placeChip(s.closest('.blk').dataset.id, +d.el.dataset.chip, +s.dataset.slot);
}

/* ---------- Stationen: springen, aktuelle merken ---------- */
function goStation(sid, smooth) {
  curSid = sid;
  if (single) { render(); scroller.scrollTop = 0; return; }
  $$('.lp-station', lp).forEach(s => s.classList.toggle('cur', s.dataset.sid === sid));
  $$('#stops a', lp).forEach(a => a.classList.toggle('cur', a.dataset.sid === sid));
  const el = $(`#st-${sid}`, lp); if (el) scroller.scrollTo({ top: el.offsetTop - ($('.lp-trail', lp)?.offsetHeight || 0) - 4, behavior: smooth ? 'smooth' : 'auto' });
}
scroller.addEventListener('scroll', () => {
  if (single) return;
  const top = scroller.getBoundingClientRect().top + ($('.lp-trail', lp)?.offsetHeight || 0) + 40;
  let cur = null; for (const s of $$('.lp-station', lp)) { if (s.getBoundingClientRect().top <= top) cur = s.dataset.sid; }
  cur = cur || doc.stations[0]?.id;
  if (cur && cur !== curSid) { curSid = cur; if (mode === 'preview') { prog.visited[cur] = 1; } $$('.lp-station', lp).forEach(s => s.classList.toggle('cur', s.dataset.sid === cur)); $$('#stops a', lp).forEach(a => a.classList.toggle('cur', a.dataset.sid === cur)); $('#stops a.cur', lp)?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }
}, { passive: true });

/* ---------- Einstellungen (⚙) ---------- */
const FORMS = {
  text: null,
  info: [{ k: 'kind', l: 'Art', t: 'select', o: Object.entries(INFO_KINDS).map(([k, v]) => [k, v[0] + ' ' + v[1]]) }, { k: 'title', l: 'Überschrift', t: 'text', help: 'leer = Name der Art' }],
  image: [{ k: 'src', l: 'Bild oder GIF', t: 'image' }, { k: 'caption', l: 'Bildunterschrift', t: 'text' }, { k: 'alt', l: 'Alternativtext (für Vorlese-Programme)', t: 'text' }, { k: 'size', l: 'Größe', t: 'select', o: [['voll', 'volle Breite'], ['klein', 'klein']] }],
  reveal: [{ k: 'summary', l: 'Überschrift der Klappbox', t: 'text' }],
  task: [
    { k: 'title', l: 'Titel', t: 'text' },
    { k: 'app.kind', l: 'Prüfung', t: 'select', o: [['keine', 'ohne App – Schüler hakt „Erledigt“ ab'], ['formel', 'FlowPad: Formel in einer Zelle'], ['diagramm', 'FlowPad: Diagramm bauen']] },
    { k: 'app.cell', l: 'Zielzelle', t: 'cell', show: b => b.app.kind !== 'keine' },
    { k: 'app.target', l: 'Zielformel', t: 'formula', show: b => b.app.kind !== 'keine', help: 'FlowPad vergleicht das Ergebnis mit vielen Testwerten – nicht die Schreibweise.' },
    { k: 'tips', l: 'Tipps (werden nacheinander aufgedeckt)', t: 'list', ph: 'Tipp' },
    { k: 'solution', l: 'Lösung zum Aufdecken (leer = keine)', t: 'text' },
    { k: 'img', l: 'Bild oder GIF zur Aufgabe', t: 'image' },
    { k: 'xp', l: 'XP (Challenge)', t: 'number', show: () => doc.form === 'challenge' },
  ],
  quiz: [{ k: 'opts', l: 'Antworten', t: 'opts' }, { k: 'multi', l: 'Mehrere Antworten richtig', t: 'check' }, { k: 'xp', l: 'XP (Challenge)', t: 'number', show: () => doc.form === 'challenge' }],
  gap: [{ k: 'xp', l: 'XP (Challenge)', t: 'number', show: () => doc.form === 'challenge' }],
  match: [{ k: 'title', l: 'Überschrift', t: 'text' }, { k: 'pairs', l: 'Paare', t: 'pairs' }, { k: 'xp', l: 'XP (Challenge)', t: 'number', show: () => doc.form === 'challenge' }],
  lock: [{ k: 'after', l: 'Frei, sobald gelöst ist:', t: 'target' }],
  sheet: [{ k: 'title', l: 'Beschriftung des Knopfs', t: 'text' }, { k: 'sheet', l: 'Tabelle', t: 'sheet' }],
  code: [{ k: 'lang', l: 'Sprache', t: 'select', o: [['java', 'Java (JPad)'], ['sql', 'SQL (QPad)']] }],
};
const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
let dlg = null;
function closeDlg(apply) {
  if (!dlg) return;
  if (apply) dlg.apply();
  dlg.el.remove(); dlg.bd.remove(); dlg = null;
}
function openForm(id) {
  let fields, b, title, apply;
  if (id === 'cert') {
    b = clone(doc.cert); title = '★ Zertifikat';
    fields = [{ k: 'on', l: 'Zertifikat am Ende anbieten', t: 'check' },
      { k: 'need', l: 'Erreichbar, wenn …', t: 'select', o: [['alle', 'alle Aufgaben gelöst sind'], ['pct', 'ein Mindestanteil gelöst ist'], ['immer', 'immer']] },
      { k: 'pct', l: 'Mindestanteil in %', t: 'number', show: x => x.need === 'pct' },
      { k: 'text', l: 'Text auf dem Zertifikat', t: 'text', help: '„Max Muster … hat den Lernpfad erfolgreich bearbeitet.“' },
      { k: 'show.zeit', l: 'Bearbeitungszeit zeigen', t: 'check' }, { k: 'show.tipps', l: 'Benutzte Tipps und Lösungshilfen zeigen', t: 'check' },
      { k: 'show.quiz', l: 'Ergebnis je Station zeigen', t: 'check' }, { k: 'show.xp', l: 'XP zeigen (Challenge)', t: 'check' }];
    apply = () => { doc.cert = b; commit(); render(); };
  } else {
    const r = findBlock(id); b = clone(r.b); fields = FORMS[b.type]; title = (T[b.type]?.ic || '') + ' ' + (T[b.type]?.n || b.type);
    if (b.type === 'task' && b.app.kind !== 'keine') title = 'fx Aufgabe für FlowPad';
    apply = () => { const rr = findBlock(id); if (rr) rr.st.blocks[rr.i] = b; commit(); render(); };
  }
  const bd = document.createElement('div'); bd.className = 'ed-backdrop'; bd.onclick = () => closeDlg(true);
  const el = document.createElement('div'); el.className = 'ed-dlg'; el.setAttribute('role', 'dialog');
  document.body.append(bd, el);
  dlg = { el, bd, apply };
  const draw = () => {
    let h = `<header><b>${esc(title)}</b><button data-x="cancel">Abbrechen</button><button class="ok" data-x="ok">Fertig</button></header><div class="ed-form">`;
    fields.forEach((f, fi) => {
      if (f.show && !f.show(b)) return;
      const v = getP(b, f.k), help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
      if (f.t === 'text') h += `<label>${esc(f.l)}<input type="text" data-k="${f.k}" value="${esc(String(v ?? '').replace(/<[^>]+>/g, ''))}">${help}</label>`;
      else if (f.t === 'number') h += `<label>${esc(f.l)}<input type="number" min="0" data-k="${f.k}" value="${esc(v ?? 0)}">${help}</label>`;
      else if (f.t === 'check') h += `<label class="chk"><input type="checkbox" data-k="${f.k}"${v ? ' checked' : ''}>${esc(f.l)}</label>`;
      else if (f.t === 'select') h += `<label>${esc(f.l)}<select data-k="${f.k}">${f.o.map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>${help}</label>`;
      else if (f.t === 'cell') h += `<div class="row"><label>${esc(f.l)}<input type="text" class="mono" data-k="${f.k}" value="${esc(v)}" placeholder="D2" autocapitalize="characters"></label><button class="take" data-take="cell">▦ gewählte Zelle</button></div>`;
      else if (f.t === 'formula') h += `<div class="row"><label>${esc(f.l)}<input type="text" class="mono" data-k="${f.k}" value="${esc(v)}" placeholder="=B2*C2" autocapitalize="off" autocorrect="off" spellcheck="false">${help}</label><button class="take" data-take="formula">fx aus FlowPad</button></div>`;
      else if (f.t === 'list') h += `<label>${esc(f.l)}</label><div class="list">${(v || []).map((t, i) => `<div class="it"><input type="text" data-li="${f.k}" data-i="${i}" value="${esc(String(t).replace(/<[^>]+>/g, ''))}" placeholder="${esc(f.ph)} ${i + 1}"><button data-ldel="${f.k}" data-i="${i}" aria-label="entfernen">✕</button></div>`).join('')}<button class="add" data-ladd="${f.k}">＋ ${esc(f.ph)}</button></div>`;
      else if (f.t === 'opts') h += `<label>${esc(f.l)}</label><div class="list">${v.map((o, i) => `<div class="it"><input type="checkbox" data-ook="${i}"${o.ok ? ' checked' : ''} title="richtig" style="width:24px;height:24px"><input type="text" data-ot="${i}" value="${esc(o.t)}" placeholder="Antwort ${i + 1}"><button data-odel="${i}" aria-label="entfernen">✕</button></div>`).join('')}<button class="add" data-oadd="1">＋ Antwort</button><span class="help">Haken = richtige Antwort</span></div>`;
      else if (f.t === 'pairs') h += `<label>${esc(f.l)}</label><div class="list">${v.map((p, i) => `<div class="it"><input type="text" data-pa="${i}" value="${esc(p.a)}" placeholder="Karte"><span>→</span><input type="text" data-pb="${i}" value="${esc(p.b)}" placeholder="passt zu"><button data-pdel="${i}" aria-label="entfernen">✕</button></div>`).join('')}<button class="add" data-padd="1">＋ Paar</button></div>`;
      else if (f.t === 'image') h += `<label>${esc(f.l)}</label><div class="imgprev">${v ? `<img src="${v}" alt="">` : ''}<label class="take" style="display:inline-flex;align-items:center;cursor:pointer">🖼 ${v ? 'Anderes Bild' : 'Bild/GIF wählen'}<input type="file" accept="image/*" data-img="${f.k}" hidden></label>${v ? `<button class="add" data-imgdel="${f.k}">entfernen</button>` : ''}</div><span class="help">Große Fotos werden verkleinert, GIFs bleiben animiert.</span>`;
      else if (f.t === 'sheet') { const n = v ? Object.keys(v).length : 0; h += `<label>${esc(f.l)}</label><div class="row"><span class="help" style="align-self:center">${n ? `${n} Zellen gespeichert (${esc(Object.keys(v).slice(0, 6).join(', '))}${n > 6 ? ' …' : ''})` : 'noch leer'}</span><button class="take" data-take="sheet">▦ aus FlowPad übernehmen</button></div>`; }
      else if (f.t === 'target') { const opts = doc.stations.flatMap(s => s.blocks.filter(x => CHECKABLE.has(x.type)).map(x => [x.id, s.title + ' · ' + blockLabel(x)])); h += `<label>${esc(f.l)}<select data-k="${f.k}"><option value="">– bitte wählen –</option>${opts.map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><span class="help">Alles unter der Sperre (bis zum Ende der Station) wird erst danach frei.</span></label>`; }
    });
    el.innerHTML = h + '</div>';
  };
  draw();
  el.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.k) { const f = fields.find(x => x.k === t.dataset.k); let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value : t.value; if (f?.t === 'cell') v = v.toUpperCase().replace(/\s/g, ''); setPath(b, t.dataset.k, v); if (t.tagName === 'SELECT' || t.type === 'checkbox') draw(); }
    if (t.dataset.li) getP(b, t.dataset.li)[+t.dataset.i] = esc(t.value);
    if (t.dataset.ot != null) b.opts[+t.dataset.ot].t = t.value;
    if (t.dataset.ook != null) { if (b.multi) b.opts[+t.dataset.ook].ok = t.checked; else { b.opts.forEach((o, i) => o.ok = i === +t.dataset.ook); draw(); } }
    if (t.dataset.pa != null) b.pairs[+t.dataset.pa].a = t.value;
    if (t.dataset.pb != null) b.pairs[+t.dataset.pb].b = t.value;
  });
  el.addEventListener('change', async e => {
    const t = e.target; if (!t.dataset.img || !t.files[0]) return;
    const url = await loadImage(t.files[0]); if (url) { setPath(b, t.dataset.img, url); draw(); }
  });
  el.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.x) { closeDlg(t.dataset.x === 'ok'); return; }
    if (t.dataset.ladd) { getP(b, t.dataset.ladd).push(''); draw(); $$(`[data-li]`, el).pop()?.focus(); }
    if (t.dataset.ldel) { getP(b, t.dataset.ldel).splice(+t.dataset.i, 1); draw(); }
    if (t.dataset.oadd) { b.opts.push({ t: '', ok: false }); draw(); }
    if (t.dataset.odel) { b.opts.splice(+t.dataset.odel, 1); draw(); }
    if (t.dataset.padd) { b.pairs.push({ a: '', b: '' }); draw(); }
    if (t.dataset.pdel) { b.pairs.splice(+t.dataset.pdel, 1); draw(); }
    if (t.dataset.imgdel) { setPath(b, t.dataset.imgdel, ''); draw(); }
    if (t.dataset.take === 'cell') { b.app.cell = mock.sel; draw(); toast(`Zelle ${mock.sel} übernommen`); }
    if (t.dataset.take === 'formula') { const f = mock.cells[mock.sel]; if (!f || !String(f).startsWith('=')) { toast(`In ${mock.sel} steht keine Formel – in FlowPad erst eine Formel eintragen.`); return; } b.app.cell = mock.sel; b.app.target = f; draw(); toast(`${mock.sel}: ${esc(f)} übernommen`); }
    if (t.dataset.take === 'sheet') { b.sheet = { ...mock.cells }; draw(); toast('Tabelle übernommen'); }
  });
}
async function loadImage(file) {
  if (file.type === 'image/gif') { if (file.size > 3e6) toast(`⚠ GIF ist ${(file.size / 1e6).toFixed(1)} MB groß – das macht den Lernpfad schwer.`, 3500); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); }); }
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const max = 1600, sc = Math.min(1, max / img.naturalWidth), c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const png = file.type === 'image/png' && file.size < 400e3;
  return c.toDataURL(png ? 'image/png' : 'image/jpeg', .85);
}

/* ---------- Design-Fenster ---------- */
function openDesign() {
  const bd = document.createElement('div'); bd.className = 'ed-backdrop clear'; bd.onclick = () => closeDlg(true);
  const el = document.createElement('div'); el.className = 'ed-dlg dock'; // links andocken: der Lernpfad bleibt sichtbar
  document.body.append(bd, el); dlg = { el, bd, apply: () => commit() };
  const seg = (k, opts, cur) => `<span class="ed-dseg" data-seg="${k}">${opts.map(([v, n]) => `<button data-v="${v}" aria-pressed="${v === cur}">${n}</button>`).join('')}</span>`;
  const draw = () => {
    const d = doc.design;
    el.innerHTML = `<header><b>🎨 Design</b><button class="ok" data-x="ok">Fertig</button></header><div class="ed-form">
      <label>Form</label>${seg('form', [['lernpfad', 'Lernpfad'], ['challenge', 'Challenge']], doc.form)}
      <label>Farbpalette <span class="help">${esc(PALETTES[d.pal].n)}</span></label><div class="ed-sw">${PALETTES.map((p, i) => `<button data-pal="${i}" title="${esc(p.n)}" aria-pressed="${i === d.pal}"><span style="background:${p.l.a1}"></span><span style="background:${p.l.a2}"></span><span style="background:${p.l.a3}"></span></button>`).join('')}</div>
      <label>Schrift</label>${seg('font', Object.entries(FONTS).map(([k, f]) => [k, f.n]), d.font)}
      <label>Stationen</label>${seg('shape', [['eckig', '▢ eckig'], ['rund', '◯ rund']], d.shape)}
      <fieldset><legend>Kopf</legend>${seg('hero', [['logo', 'App-Logo'], ['bild', 'eigenes Bild'], ['hintergrund', 'Bild als Hintergrund']], d.hero)}
      ${d.hero !== 'logo' ? `<div class="imgprev">${d.heroImg ? `<img src="${d.heroImg}" alt="">` : ''}<label class="take" style="display:inline-flex;align-items:center;cursor:pointer">🖼 ${d.heroImg ? 'Anderes Bild' : 'Bild/GIF wählen'}<input type="file" accept="image/*" id="heroFile" hidden></label></div>` : ''}</fieldset>
    </div>`;
  };
  draw();
  el.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.x) { closeDlg(true); return; }
    if (t.dataset.pal) doc.design.pal = +t.dataset.pal;
    const sg = t.closest('[data-seg]'); if (sg) { const k = sg.dataset.seg; if (k === 'form') doc.form = t.dataset.v; else doc.design[k] = t.dataset.v; }
    draw(); render();
  });
  el.addEventListener('change', async e => { if (e.target.id === 'heroFile' && e.target.files[0]) { doc.design.heroImg = await loadImage(e.target.files[0]); draw(); render(); } });
}

/* ---------- Zertifikat (Muster; das echte PDF folgt) ---------- */
function certPreview() {
  const bd = document.createElement('div'); bd.className = 'ed-backdrop'; bd.onclick = () => closeDlg(false);
  const el = document.createElement('div'); el.className = 'ed-dlg'; document.body.append(bd, el); dlg = { el, bd, apply: () => { } };
  const mins = Math.max(1, Math.round((Date.now() - prog.start) / 60000));
  const c = doc.cert, p = PALETTES[doc.design.pal].l;
  const rows = doc.stations.map(s => { const ch = s.blocks.filter(b => CHECKABLE.has(b.type)); const n = ch.filter(b => prog.solved[b.id]).length; const tips = s.blocks.reduce((a, b) => a + Object.keys(prog.tips).filter(k => k.startsWith(b.id + ':')).length, 0); const sols = s.blocks.filter(b => prog.sol[b.id]).length; return `<tr><td>${esc(s.title)}</td><td>${ch.length ? `${n} / ${ch.length}` : '–'}</td>${c.show.tipps ? `<td>${tips || sols ? `${tips} Tipp${tips === 1 ? '' : 's'}${sols ? `, ${sols} Lösung` : ''}` : 'ohne Hilfe'}</td>` : ''}</tr>`; }).join('');
  el.innerHTML = `<header><b>★ Zertifikat – Muster</b><button class="ok" data-x="ok">Schließen</button></header>
    <div class="ed-form"><label>Dein Name<input type="text" id="certName" value="Max Muster"></label></div>
    <div class="ed-certprev" style="border-color:${p.a1}"><div style="font-size:12px;letter-spacing:.14em;color:#888">${esc(doc.kicker).toUpperCase()}</div>
    <h2 style="color:${p.a1}">${doc.form === 'challenge' ? 'Challenge-Urkunde' : 'Zertifikat'}</h2><div style="font-size:20px;font-weight:700;margin:8px 0" id="certN">Max Muster</div>
    <div>${esc(c.text)}</div><div style="font-weight:700;margin-top:4px">„${esc(doc.title)}“</div>
    ${c.show.zeit ? `<div style="margin-top:8px;font-size:14px">Aktive Bearbeitungszeit: <b>${mins} min</b> · ${new Date(prog.start).toLocaleDateString('de-DE')} – ${new Date().toLocaleDateString('de-DE')}</div>` : ''}
    ${c.show.quiz ? `<table><tr><td><b>Station</b></td><td><b>gelöst</b></td>${c.show.tipps ? '<td><b>Hilfen</b></td>' : ''}</tr>${rows}</table>` : ''}
    ${c.show.xp && doc.form === 'challenge' ? `<div>⚡ ${xpNow()} von ${xpMax()} XP</div>` : ''}
    <div class="code">Prüfcode K7M-2QX</div></div>
    <div class="ed-form"><span class="help">Im fertigen Editor entsteht daraus ein PDF zum Speichern oder Hochladen in Moodle. Die Zeit zählt nur, solange der Lernpfad offen ist und benutzt wird.</span></div>`;
  el.addEventListener('input', e => { if (e.target.id === 'certName') $('#certN', el).textContent = e.target.value; });
  el.addEventListener('click', e => { if (e.target.closest('[data-x]')) closeDlg(false); });
}

/* ---------- Aktionen der Knöpfe (Vorschau = echt, Bearbeiten = Hinweis) ---------- */
function runAction(id, a) {
  const r = findBlock(id); if (!r) return;
  if (E() && a !== 'sheet' && a !== 'task') { toast('In der <b>Vorschau</b> (⌘P) ausprobieren'); return; }
  if (a === 'sheet') { if (!r.b.sheet) { toast('Noch keine Tabelle – ⚙ → „aus FlowPad übernehmen“'); return; } mock.load(r.b.sheet); toast('▦ Tabelle in FlowPad geladen'); }
  if (a === 'task') { const ap = r.b.app; if (!ap.cell || !ap.target) { toast('Zielzelle und Zielformel fehlen – ⚙'); return; } mock.task({ id, cell: ap.cell, target: ap.target, title: r.b.title, html: r.b.html, kind: ap.kind }); }
  if (a === 'done') { prog.solved[id] = !prog.solved[id]; render(); }
  if (a === 'copy') toast('⧉ Code in den Editor kopiert (in JPad/QPad)');
}

/* ---------- Attrappe von FlowPad ---------- */
const mock = {
  cells: {}, sel: 'D2', cur: null,
  cols: ['A', 'B', 'C', 'D', 'E'], rows: 8,
  num(v) { if (v == null || v === '') return 0; const s = String(v); if (s.startsWith('=')) return this.calc(s); const n = parseFloat(s.replace(',', '.')); return isNaN(n) ? s : n; },
  range(a, b) { const c1 = a.charCodeAt(0), c2 = b.charCodeAt(0), r1 = +a.slice(1), r2 = +b.slice(1), out = []; for (let c = c1; c <= c2; c++) for (let r = r1; r <= r2; r++) out.push(this.num(this.cells[String.fromCharCode(c) + r])); return out; },
  calc(f, over) { // kleine Rechnung für den Entwurf (das echte FlowPad rechnet mit MiniCalc)
    const cells = over ? { ...this.cells, ...over } : this.cells, self = this;
    let e = f.slice(1).toUpperCase().replace(/(\d),(\d)/g, '$1.$2').replace(/;/g, ',');
    e = e.replace(/([A-Z])(\d+):([A-Z])(\d+)/g, (m, a, b, c, d) => { const o = []; for (let x = a.charCodeAt(0); x <= c.charCodeAt(0); x++) for (let y = +b; y <= +d; y++) o.push(`V("${String.fromCharCode(x)}${y}")`); return '[' + o.join(',') + ']'; });
    e = e.replace(/(^|[^"A-Z])([A-Z]\d+)/g, (m, p, k) => `${p}V("${k}")`);
    const fn = { SUMME: (...a) => a.flat().reduce((s, x) => s + x, 0), MITTELWERT: (...a) => { const f = a.flat(); return f.reduce((s, x) => s + x, 0) / f.length; }, MAX: (...a) => Math.max(...a.flat()), MIN: (...a) => Math.min(...a.flat()), RUNDEN: (x, n) => Math.round(x * 10 ** n) / 10 ** n };
    e = e.replace(/\b(SUMME|MITTELWERT|MAX|MIN|RUNDEN)\(/g, 'F.$1(');
    if (/[^\d+\-*/().,\s\[\]"VFA-Z]/.test(e)) return NaN;
    try { return Function('V', 'F', 'return (' + e + ')')(k => { const v = cells[k]; if (v == null || v === '') return 0; if (String(v).startsWith('=')) return self.calc(v, over); const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }, fn); } catch (er) { return NaN; }
  },
  show(v) { if (typeof v === 'number') return isNaN(v) ? '#FEHLER' : (Math.round(v * 100) / 100).toLocaleString('de-DE'); return v ?? ''; },
  draw() {
    let h = '<tr><th></th>' + this.cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
    for (let r = 1; r <= this.rows; r++) { h += `<tr><th>${r}</th>`; for (const c of this.cols) { const a = c + r, v = this.cells[a]; h += `<td data-a="${a}" class="${a === this.sel ? 'sel' : ''}${this.cur && this.cur.cell === a ? (this.cur.ok ? ' ok' : ' task') : ''}">${v == null || v === '' ? '' : esc(this.show(this.num(v)))}</td>`; } h += '</tr>'; }
    $('#mGrid').innerHTML = h; $('#mAddr').textContent = this.sel; $('#mFx').value = this.cells[this.sel] ?? '';
    const t = this.cur; $('#mTask').innerHTML = t ? `<div class="mock-card${t.ok ? ' ok' : ''}"><b>${t.ok ? '✓' : '🎯'} ${esc(t.title || 'Aufgabe')}</b><div>${t.html}</div>${t.ok ? '<div>geschafft – der Lernpfad geht weiter.</div>' : `<div style="opacity:.75">Formel in ${esc(t.cell)} eintragen${t.kind === 'diagramm' ? ' (im echten FlowPad: als Diagramm bauen)' : ''}.</div>`}</div>` : '';
  },
  load(sheet) { this.cells = { ...sheet }; this.draw(); },
  task(t) { this.cur = { ...t, ok: false }; this.sel = t.cell; this.draw(); $('#mFx').focus(); },
  check() { // gleiche Idee wie FlowPad: Ergebnis mit mehreren Testwerten vergleichen
    const t = this.cur; if (!t || t.ok) return; const f = this.cells[t.cell]; if (!f || !String(f).startsWith('=')) return;
    const refs = [...new Set((t.target.toUpperCase().match(/[A-Z]\d+/g) || []))];
    const tests = [{}, ...[1, 2, 3].map(k => Object.fromEntries(refs.map((r, i) => [r, String(k * 3 + i * 7 + 0.5)])))];
    const same = tests.every(o => { const a = this.calc(f, o), b = this.calc(t.target, o); return Math.abs(a - b) < 1e-9; });
    if (same) { t.ok = true; this.draw(); if (mode === 'preview') solve(t.id); toast('✓ Richtig! Der Lernpfad geht weiter.'); }
    else toast('Noch nicht – vergleiche dein Ergebnis mit der Aufgabe.');
  },
};
mock.cells = { A1: 'Artikel', B1: 'Preis', C1: 'Anzahl', D1: 'Gesamt', A2: 'Brezel', B2: '0,9', C2: '14', A3: 'Semmel', B3: '0,45', C3: '20', A4: 'Kakao', B4: '1,2', C4: '9' };
$('#mGrid').addEventListener('click', e => { const td = e.target.closest('td[data-a]'); if (!td) return; mock.sel = td.dataset.a; mock.draw(); });
$('#mFx').addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = e.target.value.trim(); if (v) mock.cells[mock.sel] = v; else delete mock.cells[mock.sel]; const a = mock.sel; mock.draw(); if (mock.cur && mock.cur.cell === a) mock.check(); });
mock.draw();

/* ---------- Leiste oben ---------- */
function setMode(m) {
  if (pending) commit();
  mode = m; selId = null; closePop();
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  if (m === 'preview') { prog.visited[curSid] = 1; }
  render();
  toast(m === 'preview' ? '▶ Vorschau – so sehen es die Schüler. Fortschritt wird hier nur probeweise gezählt.' : '✎ Bearbeiten');
}
$('#modeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
$('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
$('#bSingle').onclick = () => { single = !single; $('#bSingle').classList.toggle('on', single); $('#bSingle').setAttribute('aria-pressed', String(single)); render(); scroller.scrollTop = 0; };
$('#bDesign').onclick = openDesign;
$('#bWide').onclick = () => { $('#app').classList.toggle('lp-only'); };
$('#bMore').onclick = e => {
  closePop(); pop = document.createElement('div'); pop.className = 'ed-pop';
  pop.innerHTML = `<h3>Mehr</h3><div class="ed-pal">
    <button data-m="reset"><b>↺ Vorschau-Fortschritt zurücksetzen</b><span>Haken, Quiz, Sperren wieder leer</span></button>
    <button data-m="sample"><b>⟲ Beispiel neu laden</b><span>verwirft deine Änderungen</span></button>
    <button data-m="json"><b>{ } Dokument ansehen</b><span>so wird der Lernpfad gespeichert</span></button>
    <button data-m="keys"><b>⌘ Tastenkürzel</b><span>für die iPad-Tastatur</span></button>
    <button data-m="export" disabled style="opacity:.5"><b>⇩ Export</b><span>HTML für Moodle · Projekt – kommt in Schritt 6</span></button></div>`;
  document.body.appendChild(pop);
  const r = e.currentTarget.getBoundingClientRect(); pop.style.left = Math.max(10, r.right - pop.offsetWidth) + 'px'; pop.style.top = (r.bottom + 6) + 'px';
  pop.onclick = ev => {
    const m = ev.target.closest('[data-m]')?.dataset.m; if (!m) return; closePop();
    if (m === 'reset') { prog = freshProg(); mock.cur = null; mock.draw(); render(); toast('Fortschritt zurückgesetzt'); }
    if (m === 'sample') { if (!confirm('Beispiel neu laden? Deine Änderungen gehen verloren.')) return; doc = sample(); prog = freshProg(); commit(); render(); }
    if (m === 'json') { const bd = document.createElement('div'); bd.className = 'ed-backdrop'; bd.onclick = () => closeDlg(false); const el = document.createElement('div'); el.className = 'ed-dlg'; document.body.append(bd, el); dlg = { el, bd, apply: () => { } }; el.innerHTML = `<header><b>{ } Dokument</b><button class="ok" data-x="1">Schließen</button></header><pre style="margin:0;padding:12px;font:12px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all">${esc(JSON.stringify(doc, (k, v) => typeof v === 'string' && v.startsWith('data:') ? v.slice(0, 40) + '…' : v, 2))}</pre>`; el.onclick = ev2 => { if (ev2.target.closest('[data-x]')) closeDlg(false); }; }
    if (m === 'keys') { const bd = document.createElement('div'); bd.className = 'ed-backdrop'; bd.onclick = () => closeDlg(false); const el = document.createElement('div'); el.className = 'ed-dlg'; document.body.append(bd, el); dlg = { el, bd, apply: () => { } };
      el.innerHTML = `<header><b>⌘ Tastenkürzel</b><button class="ok" data-x="1">Schließen</button></header><div class="ed-form"><table style="border-collapse:collapse;font-size:15px">${[['⌘B / ⌘I', 'fett / kursiv'], ['⌘E', 'Code'], ['⌘K', 'Link'], ['⌘Z / ⇧⌘Z', 'rückgängig / wiederholen'], ['⌘↵', 'neuer Textbaustein darunter'], ['⌥↑ / ⌥↓', 'gewählten Baustein verschieben'], ['⌘P', 'Vorschau ein/aus'], ['/', 'in leerem Text: Bausteinauswahl, weitertippen filtert (z. B. /quiz ↵)'], ['Esc', 'Auswahl aufheben']].map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;font-weight:700;white-space:nowrap">${k}</td><td>${v}</td></tr>`).join('')}</table></div>`; el.onclick = ev2 => { if (ev2.target.closest('[data-x]')) closeDlg(false); }; }
  };
};
addEventListener('beforeunload', () => { if (pending) commit(); });

render(); updUndo(); $('#saved').textContent = '✓ gesichert';
