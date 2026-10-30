/*
 * FlowPad – Datenflussdiagramme (DFD) nach der Schulnotation:
 * Eingabe/Ausgabe = Rechteck, Funktion (auch Rechenzeichen) = Ellipse, Konstante = Zahl ohne Rahmen, Verteiler = gefüllter Punkt.
 * Funktionskatalog, Geometrie, Formel aus dem Diagramm und Layout stammen aus der DFD-Werkstatt (Informatik 9).
 */
/* DFD-Baukasten: Datenflussdiagramme per Touch bauen, als Formel lesen und prüfen.
   Schulnotation: Eingabe/Ausgabe = Rechteck, Funktion = Ellipse, Konstante = Zahl ohne Rahmen, Verteiler = gefüllter Punkt. */
import E from './engine.js';

export const DFD = (() => {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // ---------------- Funktionskatalog (deutsche Excel-Namen und Parameter) ----------------
  const OPS = {
    '+': ['Summand1', 'Summand2'], '-': ['Minuend', 'Subtrahend'], '*': ['Faktor1', 'Faktor2'], '/': ['Dividend', 'Divisor'], '^': ['Basis', 'Exponent'], '&': ['Text1', 'Text2'],
    '=': ['Wert1', 'Wert2'], '<>': ['Wert1', 'Wert2'], '<': ['Wert1', 'Wert2'], '>': ['Wert1', 'Wert2'], '<=': ['Wert1', 'Wert2'], '>=': ['Wert1', 'Wert2'],
  };
  const OPNAME = { '+': 'plus', '-': 'minus', '*': 'mal', '/': 'geteilt durch', '^': 'hoch', '&': 'Text verketten', '=': 'gleich', '<>': 'ungleich', '<': 'kleiner als', '>': 'größer als', '<=': 'kleiner gleich', '>=': 'größer gleich' };
  const PREC = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
  // p: Parameterliste; opt: Anzahl optionaler Parameter am Ende; v: beliebig viele (ab Parameter 1 wiederholt)
  const F = {
    // Mathematik
    ABS: { g: 'Mathematik', p: ['Zahl'], d: 'Betrag einer Zahl' },
    ABRUNDEN: { g: 'Mathematik', p: ['Zahl', 'Anzahl_Stellen'], d: 'rundet in Richtung 0' },
    AUFRUNDEN: { g: 'Mathematik', p: ['Zahl', 'Anzahl_Stellen'], d: 'rundet von 0 weg' },
    GANZZAHL: { g: 'Mathematik', p: ['Zahl'], d: 'rundet auf die nächste ganze Zahl ab' },
    OBERGRENZE: { g: 'Mathematik', p: ['Zahl', 'Schritt'], d: 'rundet auf ein Vielfaches von Schritt auf' },
    POTENZ: { g: 'Mathematik', p: ['Zahl', 'Potenz'], d: 'Zahl hoch Potenz' },
    PRODUKT: { g: 'Mathematik', p: ['Zahl'], v: true, d: 'multipliziert alle Zahlen' },
    QUOTIENT: { g: 'Mathematik', p: ['Zähler', 'Nenner'], d: 'ganzzahliger Anteil einer Division' },
    REST: { g: 'Mathematik', p: ['Zahl', 'Divisor'], d: 'Rest einer Division' },
    RUNDEN: { g: 'Mathematik', p: ['Zahl', 'Anzahl_Stellen'], d: 'rundet kaufmännisch' },
    SUMME: { g: 'Mathematik', p: ['Zahl'], v: true, d: 'addiert alle Zahlen' },
    VORZEICHEN: { g: 'Mathematik', p: ['Zahl'], d: '1, 0 oder −1' },
    WURZEL: { g: 'Mathematik', p: ['Zahl'], d: 'Quadratwurzel' },
    ZUFALLSZAHL: { g: 'Mathematik', p: [], d: 'Zufallszahl zwischen 0 und 1' },
    // Statistik
    ANZAHL: { g: 'Statistik', p: ['Wert'], v: true, d: 'zählt Zellen mit Zahlen' },
    MAX: { g: 'Statistik', p: ['Zahl'], v: true, d: 'größter Wert' },
    MIN: { g: 'Statistik', p: ['Zahl'], v: true, d: 'kleinster Wert' },
    MITTELWERT: { g: 'Statistik', p: ['Zahl'], v: true, d: 'Durchschnitt' },
    // Logik
    WENN: { g: 'Logik', p: ['Prüfung', 'Dann_Wert', 'Sonst_Wert'], d: 'wählt je nach Prüfung einen Wert' },
    UND: { g: 'Logik', p: ['Wahrheitswert'], v: true, d: 'WAHR, wenn alle WAHR sind' },
    ODER: { g: 'Logik', p: ['Wahrheitswert'], v: true, d: 'WAHR, wenn mindestens einer WAHR ist' },
    NICHT: { g: 'Logik', p: ['Wahrheitswert'], d: 'kehrt WAHR/FALSCH um' },
    SUMMEWENN: { g: 'Statistik', p: ['Bereich', 'Suchkriterium', 'Summe_Bereich'], opt: 1, d: 'addiert die Zellen, die das Kriterium erfüllen' },
    ZÄHLENWENN: { g: 'Statistik', p: ['Bereich', 'Suchkriterium'], d: 'zählt die Zellen, die das Kriterium erfüllen' },
    ZUFALLSBEREICH: { g: 'Mathematik', p: ['Untere_Zahl', 'Obere_Zahl'], d: 'ganze Zufallszahl zwischen zwei Grenzen' },
    // Text
    TEXTKETTE: { g: 'Text', p: ['Text'], v: true, d: 'hängt Texte aneinander' },
    CODE: { g: 'Text', p: ['Text'], d: 'Code des ersten Zeichens' },
    FINDEN: { g: 'Text', p: ['Suchtext', 'Text', 'Erstes_Zeichen'], opt: 1, d: 'Position eines Textes' },
    GROSS: { g: 'Text', p: ['Text'], d: 'GROSSBUCHSTABEN' },
    IDENTISCH: { g: 'Text', p: ['Text1', 'Text2'], d: 'prüft, ob zwei Texte gleich sind' },
    KLEIN: { g: 'Text', p: ['Text'], d: 'kleinbuchstaben' },
    LÄNGE: { g: 'Text', p: ['Text'], d: 'Anzahl der Zeichen' },
    LINKS: { g: 'Text', p: ['Text', 'Anzahl_Zeichen'], opt: 1, d: 'Zeichen von links' },
    RECHTS: { g: 'Text', p: ['Text', 'Anzahl_Zeichen'], opt: 1, d: 'Zeichen von rechts' },
    TEIL: { g: 'Text', p: ['Text', 'Erstes_Zeichen', 'Anzahl_Zeichen'], d: 'Zeichen aus der Mitte' },
    VERKETTEN: { g: 'Text', p: ['Text'], v: true, d: 'hängt Texte aneinander' },
    WECHSELN: { g: 'Text', p: ['Text', 'Alter_Text', 'Neuer_Text', 'ntes_Auftreten'], opt: 1, d: 'ersetzt Text' },
    ZEICHEN: { g: 'Text', p: ['Zahl'], d: 'Zeichen zu einem Code' },
    // Datum und Uhrzeit
    DATUM: { g: 'Datum & Zeit', p: ['Jahr', 'Monat', 'Tag'], d: 'Datum aus Jahr, Monat, Tag' },
    HEUTE: { g: 'Datum & Zeit', p: [], d: 'heutiges Datum' },
    JAHR: { g: 'Datum & Zeit', p: ['Zahl'], d: 'Jahr eines Datums' },
    JETZT: { g: 'Datum & Zeit', p: [], d: 'Datum und Uhrzeit jetzt' },
    MINUTE: { g: 'Datum & Zeit', p: ['Zahl'], d: 'Minute einer Uhrzeit' },
    MONAT: { g: 'Datum & Zeit', p: ['Zahl'], d: 'Monat eines Datums' },
    SEKUNDE: { g: 'Datum & Zeit', p: ['Zahl'], d: 'Sekunde einer Uhrzeit' },
    STUNDE: { g: 'Datum & Zeit', p: ['Zahl'], d: 'Stunde einer Uhrzeit' },
    TAG: { g: 'Datum & Zeit', p: ['Zahl'], d: 'Tag eines Datums' },
    WOCHENTAG: { g: 'Datum & Zeit', p: ['Zahl', 'Typ'], opt: 1, d: 'Wochentag als Zahl' },
    ZEIT: { g: 'Datum & Zeit', p: ['Stunde', 'Minute', 'Sekunde'], d: 'Uhrzeit aus Stunde, Minute, Sekunde' },
  };
  const isOp = f => f in OPS;
  const fdef = f => F[f] || { g: 'Weitere', p: ['Wert'], v: true, d: 'unbekannte Funktion' };
  const sig = f => isOp(f) ? `${f}  (${OPNAME[f]})` : fdef(f).v ? `${f}(${fdef(f).p[0]}1; [${fdef(f).p[0]}2]; …)` : `${f}(${fdef(f).p.map((p, i) => (fdef(f).opt && i >= fdef(f).p.length - fdef(f).opt) ? '[' + p + ']' : p).join('; ')}${''})`;
  function slotCount(node, edges) {
    if (isOp(node.fn)) return 2;
    const d = fdef(node.fn);
    if (!d.v) return d.p.length;
    const used = edges.filter(e => e.to === node.id).reduce((m, e) => Math.max(m, e.slot + 1), 0);
    return Math.min(8, Math.max(2, used + 1));
  }
  const slotName = (node, i) => isOp(node.fn) ? OPS[node.fn][i] : (fdef(node.fn).v ? fdef(node.fn).p[0] + (i + 1) : fdef(node.fn).p[i]);
  const slotRequired = (node, i) => isOp(node.fn) ? true : fdef(node.fn).v ? i === 0 : !(fdef(node.fn).opt && i >= fdef(node.fn).p.length - fdef(node.fn).opt);

  // ---------------- Geometrie ----------------
  const W = 880, H = 560;
  const textW = t => Math.max(1, [...String(t)].length) * 10.4;
  function size(n) {
    if (n.kind === 'split') return { w: 14, h: 14 };
    if (n.kind === 'const') return { w: Math.max(26, textW(n.label) + 8), h: 36 };
    if (n.kind === 'fn') { const lab = isOp(n.fn) ? n.fn : n.fn; return { w: Math.max(84, textW(lab) + 46), h: 48 }; }
    return { w: Math.max(70, textW(n.label) + 24), h: 40 };
  }
  function slotPos(n, i, cnt) {
    const s = size(n);
    if (n.kind !== 'fn') return { x: n.x, y: n.y - s.h / 2 };
    const t = (i + 1) / (cnt + 1), dx = (t - .5) * s.w * .9;
    const a = s.w / 2, b = s.h / 2, yy = -b * Math.sqrt(Math.max(0, 1 - (dx * dx) / (a * a)));
    return { x: n.x + dx, y: n.y + yy };
  }
  const outPos = n => n.kind === 'split' ? { x: n.x, y: n.y } : { x: n.x, y: n.y + size(n).h / 2 };
  const canOut = n => n.kind !== 'out';
  const maxOut = n => n.kind === 'split' ? 99 : 1;
  const inCount = (n, edges) => n.kind === 'fn' ? slotCount(n, edges) : (n.kind === 'split' || n.kind === 'out') ? 1 : 0;

  // ---------------- Formel aus dem Diagramm ----------------
  function formula(model) {
    const outs = model.nodes.filter(n => n.kind === 'out');
    if (!outs.length) return { err: 'Es fehlt noch eine Ausgabe (Rechteck unten).' };
    if (outs.length > 1) return { err: 'Nimm genau eine Ausgabe.' };
    const byId = Object.fromEntries(model.nodes.map(n => [n.id, n]));
    const into = (id, slot) => model.edges.find(e => e.to === id && e.slot === slot);
    const used = new Set(); let missing = 0, cyc = false; const sub = {};
    function ex(id, stack) {
      const n = byId[id]; used.add(id);
      if (stack.has(id)) { cyc = true; return { t: '?', p: 9 }; }
      stack = new Set(stack); stack.add(id);
      if (n.kind === 'in') return { t: n.ref || n.label, p: 9 };
      if (n.kind === 'const') return { t: /^-?\d+(,\d+)?$/.test(n.label) ? n.label : /^(WAHR|FALSCH)$/i.test(n.label) ? n.label.toUpperCase() : '"' + n.label.replace(/^"|"$/g, '') + '"', p: 9 };
      if (n.kind === 'split' || n.kind === 'out') { const e = into(id, 0); if (!e) { missing++; return { t: '□', p: 9 }; } return ex(e.from, stack); }
      const cnt = slotCount(n, model.edges), args = [];
      for (let i = 0; i < cnt; i++) {
        const e = into(id, i);
        if (e) args.push(ex(e.from, stack));
        else if (slotRequired(n, i)) { missing++; args.push({ t: '□', p: 9 }); }
        else args.push(null);
      }
      if (isOp(n.fn)) {
        const pr = PREC[n.fn], [a, b] = args;
        const wa = a.p < pr ? '(' + a.t + ')' : a.t, wb = (b.p < pr || (b.p === pr && n.fn !== '+' && n.fn !== '*' && n.fn !== '&')) ? '(' + b.t + ')' : b.t;
        sub[id] = wa + n.fn + wb;
        return { t: wa + n.fn + wb, p: pr };
      }
      while (args.length && args[args.length - 1] === null) args.pop();
      sub[id] = n.fn + '(' + args.map(a => a ? a.t : '').join(';') + ')';
      return { t: sub[id], p: 9 };
    }
    const r = ex(outs[0].id, new Set());
    const unused = model.nodes.filter(n => !used.has(n.id));
    return { text: '=' + r.t, missing, cyc, unused, out: outs[0], sub };
  }

  // ---------------- Bewerten ----------------
  // ---------------- Bewerten ----------------
  const same = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b)) : E.display(a) === E.display(b);
  function cellsOfFormula(f) { const s = new Set(); E.refsIn(f).forEach(r => r.cells.forEach(a => s.add(a))); return [...s]; }
  const numConsts = f => { try { const out = []; (function w(n) { if (!n) return; if (n.k === 'num') out.push(n.v); (n.args || []).forEach(w); if (n.k === 'bin' || n.k === 'neg') { w(n.a); w(n.b); } })(E.parse(String(f).trim().replace(/^=/, ''))); return out; } catch (e) { return []; } };

  /**
   * Testbelegungen für den Vergleich zweier Formeln. ctx = { raw, rows, cols, cell, tests? }
   * Belegung 1 sind die echten Werte der Tabelle. Danach werden die Eingabezellen (keine Formeln, Zahl oder leer)
   * mit anderen Zahlen belegt – auch mit den Konstanten der Formeln (Grenzfälle bei WENN, z. B. genau 100).
   */
  function testSets(fa, fb, ctx) {
    if (ctx.tests && ctx.tests.length) return ctx.tests;
    const sh = new E.Sheet(ctx.rows, ctx.cols, ctx.raw);
    const cells = [...new Set(cellsOfFormula(fa).concat(cellsOfFormula(fb)))].filter(a => a !== ctx.cell);
    const vary = cells.filter(a => !sh.isFormula(a) && (sh.get(a) === undefined || typeof sh.value(a) === 'number'));
    const sets = [{}];
    if (!vary.length) return sets;
    for (let k = 0; k < 6; k++) { const s = {}; vary.forEach((c, i) => s[c] = String(((k * 7 + i * 13) % 17) + 2 + (k % 2 ? ',5' : ''))); sets.push(s); }
    const ks = [...new Set(numConsts(fa).concat(numConsts(fb)))].slice(0, 4);
    ks.forEach(k => { [k, k / Math.max(1, vary.length)].forEach(v => { const s = {}; vary.forEach(c => s[c] = E.fmtNum(v)); sets.push(s); }); });
    return sets;
  }
  function evalIn(f, set, ctx) {
    const sh = new E.Sheet(ctx.rows, ctx.cols, Object.assign({}, ctx.raw, set, { [ctx.cell]: f }));
    return sh.value(ctx.cell);
  }
  /** Rechnen zwei Formeln gleich? → { ok } oder { ok:false, set, a, b } */
  function compare(fa, fb, ctx) {
    const sets = testSets(fa, fb, ctx);
    for (const s of sets) {
      const a = evalIn(fa, s, ctx), b = evalIn(fb, s, ctx);
      if (!same(a, b)) return { ok: false, set: s, a, b, sets: sets.length };
    }
    return { ok: true, sets: sets.length };
  }
  /** Regeln der Schulnotation prüfen. Liefert eine Fehlermeldung (HTML) oder null. */
  function ruleCheck(model, f) {
    f = f || formula(model);
    if (f.err) return f.err;
    if (f.cyc) return 'Dein Diagramm enthält einen Kreis.';
    if (f.missing) return `Es ${f.missing === 1 ? 'fehlt noch ein Pfeil' : 'fehlen noch ' + f.missing + ' Pfeile'} (leere Eingänge □ in der Formel).`;
    if (f.unused.length) return `${f.unused.length === 1 ? 'Ein Baustein hängt' : f.unused.length + ' Bausteine hängen'} nirgends dran. Verbinde ${f.unused.length === 1 ? 'ihn' : 'sie'} oder lösche ${f.unused.length === 1 ? 'ihn' : 'sie'}.`;
    if (model.nodes.some(n => n.kind === 'in' && !n.ref)) return 'Bei einer Eingabe fehlt noch die Zelle (z. B. B2).';
    const lonely = model.nodes.filter(n => n.kind === 'split' && model.edges.filter(e => e.from === n.id).length < 2);
    if (lonely.length) return 'Ein Verteiler hat nur <b>einen</b> Ausgang. Einen Verteiler brauchst du nur, wenn ein Datum an <b>mehrere</b> Stellen weitergeleitet wird – sonst geht der Pfeil direkt in die nächste Ellipse oder in die Ausgabe.';
    const refs = model.nodes.filter(n => n.kind === 'in').map(n => (n.ref || '').replace(/\$/g, ''));
    if (new Set(refs).size < refs.length) return 'Eine Eingabe kommt doppelt vor. Zeichne jede Eingabe nur einmal und verteile sie mit einem <b>Verteiler</b>, wenn sie mehrfach gebraucht wird.';
    const seen = {};
    for (const t of Object.values(f.sub)) {
      if (/^(ZUFALLSZAHL|HEUTE|JETZT)\(\)$/.test(t) || /ZUFALL/.test(t)) continue;
      if (seen[t]) return `Die Funktion <code>${esc(t)}</code> wird zweimal berechnet. Berechne sie nur <b>einmal</b> und führe ihre Ausgabe in einen <b>Verteiler</b>.`;
      seen[t] = 1;
    }
    return null;
  }
  /** Tipp, wenn nur die Eingänge einer Funktion vertauscht sind */
  function swapTip(model, target, ctx) {
    for (const n of model.nodes.filter(n => n.kind === 'fn' && slotCount(n, model.edges) === 2)) {
      const sw = JSON.parse(JSON.stringify(model)); sw.edges.forEach(e => { if (e.to === n.id) e.slot = 1 - e.slot; });
      const g = formula(sw);
      if (!g.err && !g.missing && compare(g.text, target, ctx).ok) return ` Tipp: Prüfe die <b>Reihenfolge der Eingänge</b> bei <b>${esc(n.fn)}</b>.`;
    }
    return '';
  }

  // ---------------- Diagramm aus einer Formel ----------------
  /** opts: { labelOf(ref) → Beschriftung, output: Beschriftung der Ausgabe, outRef: Zelle der Ausgabe } */
  function fromTerm(term, opts) {
    opts = opts || {};
    const ast = E.parse(String(term).trim().replace(/^=/, ''));
    const nodes = [], edges = []; let k = 0;
    const refKey = n => n.k === 'ref' ? E.refText(n) : E.refText(n.a) + ':' + E.refText(n.b);
    const count = {};
    (function cnt(n) { if (!n) return; if (n.k === 'ref' || n.k === 'range') count[refKey(n)] = (count[refKey(n)] || 0) + 1; (n.args || []).forEach(cnt); if (n.a && n.k !== 'range') cnt(n.a); if (n.b && n.k !== 'range') cnt(n.b); })(ast);
    const ser = n => n.k === 'num' ? 'n' + n.v : n.k === 'str' ? 's' + n.v : n.k === 'bool' ? 'b' + n.v : (n.k === 'ref' || n.k === 'range') ? 'r' + refKey(n)
      : n.k === 'neg' ? '-(' + ser(n.a) + ')' : n.k === 'bin' ? '(' + ser(n.a) + n.o + ser(n.b) + ')' : n.n + '(' + n.args.map(ser).join(';') + ')';
    const fcount = {};
    (function cf(n) { if (!n) return; if (n.k === 'bin' || n.k === 'fn') { const k2 = ser(n); fcount[k2] = (fcount[k2] || 0) + 1; } (n.args || []).forEach(cf); if (n.k === 'bin' || n.k === 'neg') { cf(n.a); if (n.b) cf(n.b); } })(ast);
    const inputNode = {}, splitNode = {};
    const add = o => { o.id = 'n' + (++k); nodes.push(o); return o.id; };
    const nameOf = ref => (opts.labelOf && opts.labelOf(ref)) || undefined;
    const lab = (name, ref) => name ? `${name} (${ref})` : ref;
    function build(n) {
      if (n.k === 'num') return add({ kind: 'const', label: E.fmtNum(n.v) });
      if (n.k === 'str') return add({ kind: 'const', label: '"' + n.v + '"' });
      if (n.k === 'bool') return add({ kind: 'const', label: n.v ? 'WAHR' : 'FALSCH' });
      if (n.k === 'neg') {
        if (n.a.k === 'num') return add({ kind: 'const', label: E.fmtNum(-n.a.v) });
        const id = add({ kind: 'fn', fn: '*' }); edges.push({ from: build(n.a), to: id, slot: 0 }); edges.push({ from: add({ kind: 'const', label: '-1' }), to: id, slot: 1 }); return id;
      }
      if (n.k === 'ref' || n.k === 'range') {
        const key = refKey(n);
        if (!inputNode[key]) { const nm = nameOf(key); inputNode[key] = add({ kind: 'in', name: nm, label: lab(nm, key), ref: key }); }
        if (count[key] > 1) { if (!splitNode['r' + key]) { splitNode['r' + key] = add({ kind: 'split' }); edges.push({ from: inputNode[key], to: splitNode['r' + key], slot: 0 }); } return splitNode['r' + key]; }
        return inputNode[key];
      }
      const key = ser(n), shared = fcount[key] > 1 && !/ZUFALL/.test(key);
      if (shared && splitNode[key]) return splitNode[key];
      let id;
      if (n.k === 'bin') { id = add({ kind: 'fn', fn: n.o }); edges.push({ from: build(n.a), to: id, slot: 0 }); edges.push({ from: build(n.b), to: id, slot: 1 }); }
      else if (n.k === 'fn') { id = add({ kind: 'fn', fn: n.n.replace('ZAEHLENWENN', 'ZÄHLENWENN') }); n.args.forEach((a, i) => edges.push({ from: build(a), to: id, slot: i })); }
      else throw new Error('?');
      if (shared) { splitNode[key] = add({ kind: 'split' }); edges.push({ from: id, to: splitNode[key], slot: 0 }); return splitNode[key]; }
      return id;
    }
    const root = build(ast);
    const out = add({ kind: 'out', name: opts.output || undefined, label: opts.outRef ? lab(opts.output, opts.outRef) : (opts.output || 'Ergebnis'), ref: opts.outRef });
    edges.push({ from: root, to: out, slot: 0 });
    // Verteiler mit nur einem Ausgang wieder entfernen
    nodes.filter(n => n.kind === 'split').forEach(sp => {
      const outsE = edges.filter(e => e.from === sp.id);
      if (outsE.length === 1) {
        const inE = edges.find(e => e.to === sp.id); outsE[0].from = inE.from;
        edges.splice(edges.indexOf(inE), 1); nodes.splice(nodes.indexOf(sp), 1);
      }
    });
    const dim = layout(nodes, edges);
    return { nodes, edges, w: dim.w, h: dim.h };
  }
  function layout(nodes, edges) {
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const kids = id => edges.filter(e => e.to === id).sort((a, b) => a.slot - b.slot).map(e => e.from);
    const depth = {};
    (function d(id, l) { if ((depth[id] || -1) >= l) return; depth[id] = l; kids(id).forEach(c => d(c, l + 1)); })(nodes.find(n => n.kind === 'out').id, 0);
    // Eingaben ganz oben, Verteiler direkt darunter, Konstanten direkt über ihrer Funktion
    const maxD = Math.max(...Object.values(depth));
    nodes.forEach(n => { if (n.kind === 'in') depth[n.id] = maxD; });
    nodes.forEach(n => { if (n.kind === 'const') { const p = edges.find(e => e.from === n.id); depth[n.id] = depth[p.to] + 0.75; } });
    const top = Math.max(...Object.values(depth));
    const order = []; const seen = new Set();
    (function walk(id) { if (seen.has(id)) return; seen.add(id); const ks = kids(id); if (!ks.length) order.push(id); ks.forEach(walk); if (byId[id].kind === 'split') order.push(id); })(nodes.find(n => n.kind === 'out').id);
    const xs = {}; const leaves = order.filter(id => !kids(id).length || byId[id].kind === 'split');
    const leafIds = order.filter(id => !kids(id).length);
    const ws = leafIds.map(id => size(byId[id]).w + 34), tot = ws.reduce((a, b) => a + b, 0);
    const CW = Math.max(W, Math.round(tot + 20)), f = 1; let acc = (CW - tot) / 2;
    leafIds.forEach((id, i) => { xs[id] = acc + ws[i] * f / 2; acc += ws[i] * f; });
    (function px(id) { const ks = kids(id); if (!ks.length) return xs[id]; const v = ks.map(px); xs[id] = v.reduce((a, b) => a + b, 0) / v.length; return xs[id]; })(nodes.find(n => n.kind === 'out').id);
    // Überlappungen je Zeile auflösen
    const rows = {};
    nodes.forEach(n => { const r = Math.round(depth[n.id] * 4); (rows[r] = rows[r] || []).push(n); });
    Object.values(rows).forEach(list => {
      list.sort((a, b) => xs[a.id] - xs[b.id]);
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i], gap = (size(a).w + size(b).w) / 2 + 34;
        if (xs[b.id] - xs[a.id] < gap) xs[b.id] = xs[a.id] + gap;
      }
      const lo = xs[list[0].id] - size(list[0]).w / 2, hi = xs[list[list.length - 1].id] + size(list[list.length - 1]).w / 2;
      const shift = lo < 10 ? 10 - lo : 0;
      list.forEach(n => xs[n.id] += shift);
    });
    const rowH = 86;
    nodes.forEach(n => { n.x = Math.round(xs[n.id] ?? CW / 2); n.y = Math.round(45 + (top - depth[n.id]) * rowH); });
    const maxX = Math.max(...nodes.map(n => n.x + size(n).w / 2));
    return { w: Math.max(CW, Math.round(maxX + 20)), h: Math.max(H, Math.round(90 + top * rowH)) };
  }

  // ================= Editor (Zeichenfläche) =================
  /**
   * host: {
   *   onChange(model)            – Diagramm wurde geändert (zum Speichern)
   *   labelOf(ref) → string      – Name aus der Tabelle (Spaltenkopf o. Ä.), z. B. „Preis“
   *   startPick(done(ref), text) – Zelle/Bereich oben in der Tabelle antippen lassen
   *   cancelPick()
   * }
   */
  function Editor(root, host) {
    let model = { nodes: [], edges: [] }, seq = 0;
    let sel = null, connectFrom = null, drag = null, edgeSel = null, zoom = 1, autoZoom = true, outRef = null;
    const uid = 'e' + Math.random().toString(36).slice(2, 7);
    root.classList.add('dfd');
    root.innerHTML = `
      <div class="dfd-palette" role="toolbar" aria-label="Bausteine">
        <button type="button" class="dfd-pal" data-add="in" title="Eingabe: eine Zelle oder ein Bereich der Tabelle"><span class="sym-rect"></span>Eingabe</button>
        <button type="button" class="dfd-pal" data-add="const" title="Konstante: eine feste Zahl oder ein Text"><span class="sym-const">2</span>Konstante</button>
        <button type="button" class="dfd-pal" data-add="fn" title="Funktion oder Rechenzeichen (Ellipse)"><span class="sym-ell"></span>Funktion</button>
        <button type="button" class="dfd-pal" data-add="split" title="Verteiler: gibt ein Datum an mehrere Funktionen weiter"><span class="sym-dot"></span>Verteiler</button>
        <button type="button" class="dfd-pal" data-add="out" title="Ausgabe: die Zelle, in der das Ergebnis steht"><span class="sym-rect out"></span>Ausgabe</button>
      </div>
      <div class="dfd-body"><div class="dfd-stage"><div class="dfd-edit" hidden></div><div class="dfd-canvas"><svg xmlns="http://www.w3.org/2000/svg" role="application" aria-label="Zeichenfläche für das Datenflussdiagramm">
        <defs><marker id="dfdArrow-${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arrowhead"/></marker></defs>
        <g class="edges"></g><g class="nodes"></g><path class="rubber" fill="none" stroke-width="3" stroke-dasharray="6 5"/></svg>
        <div class="dfd-empty" hidden></div></div></div></div>
      <div class="dfd-formula"><span>Formel des Diagramms:</span> <code></code></div>
      <div class="dfd-msg" aria-live="polite"></div>`;
    root.querySelector('.dfd-body').prepend(root.querySelector('.dfd-palette'));
    const canvas = root.querySelector('.dfd-canvas'), svg = root.querySelector('svg'), gE = root.querySelector('.edges'), gN = root.querySelector('.nodes'), rubber = root.querySelector('.rubber');
    const msg = root.querySelector('.dfd-msg'), fcode = root.querySelector('.dfd-formula code'), edit = root.querySelector('.dfd-edit'), empty = root.querySelector('.dfd-empty');
    // Statusleiste: eine Zeile; ist die Meldung länger, zeigt „▾“ das an und ein Tipp klappt sie auf
    msg.innerHTML = '<div class="dfd-msg-in"></div>';
    const msgIn = msg.firstChild;
    const say = (t, cls) => {
      msg.className = 'dfd-msg' + (cls ? ' ' + cls : ''); msgIn.innerHTML = t || '';
      requestAnimationFrame(() => msg.classList.toggle('more', msgIn.scrollWidth > msgIn.clientWidth + 2));
    };
    msg.addEventListener('click', () => { if (msg.classList.contains('more') || msg.classList.contains('open')) msg.classList.toggle('open'); });
    const byId = id => model.nodes.find(n => n.id === id);
    const cw = () => model.w || W, ch = () => model.h || H;
    const save = () => host.onChange && host.onChange(model);
    const labelFor = (name, ref) => name ? `${name} (${ref})` : (ref || '?');

    /** Freier Platz für einen neuen Baustein – im sichtbaren Ausschnitt */
    function freeSpot(kind, probe) {
      const ps = size(Object.assign({ kind, label: '?' }, probe || {}));
      const clash = (x, y) => model.nodes.some(n => { const s = size(n); return Math.abs(n.x - x) < (s.w + ps.w) / 2 + 24 && Math.abs(n.y - y) < (s.h + ps.h) / 2 + 22; });
      const r = canvas.getBoundingClientRect();
      const vx0 = canvas.scrollLeft / zoom, vy0 = canvas.scrollTop / zoom, vx1 = vx0 + r.width / zoom, vy1 = vy0 + r.height / zoom;
      const frac = { in: [.12, .3], const: [.12, .3, .5], split: [.3, .5], fn: [.5, .7, .3], out: [.85, .7] }[kind] || [.5];
      const step = 30, x0 = vx0 + ps.w / 2 + 16, x1 = Math.max(x0, vx1 - ps.w / 2 - 16);
      for (const f of frac) {
        const y = Math.round(Math.max(30, vy0 + f * (vy1 - vy0)));
        for (let x = x0; x <= x1; x += step) if (!clash(x, y)) return { x: Math.round(x), y };
      }
      for (let y = vy0 + 40; y < vy1 + 400; y += 40) for (let x = x0; x <= x1; x += step) if (!clash(x, y)) return { x: Math.round(x), y: Math.round(y) };
      return { x: Math.round((vx0 + vx1) / 2), y: Math.round((vy0 + vy1) / 2) };
    }
    function addNode(o) { const p = freeSpot(o.kind, o); const n = Object.assign({ id: 'n' + (++seq), x: p.x, y: p.y }, o); model.nodes.push(n); sel = n.id; edgeSel = null; save(); render(); return n; }
    function pt(ev) { const m = svg.getScreenCTM().inverse(); const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(m); return { x: q.x, y: q.y }; }

    // ---------- Zoom ----------
    let vw = W, vh = H;
    function applyZoom() {
      // Zeichenfläche füllt mindestens den sichtbaren Bereich
      const r = canvas.getBoundingClientRect();
      vw = Math.max(cw(), Math.ceil((r.width || 0) / zoom)); vh = Math.max(ch(), Math.ceil((r.height || 0) / zoom));
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      svg.style.width = Math.floor(vw * zoom) + 'px'; svg.style.height = Math.floor(vh * zoom) + 'px';
    }
    function bbox() {
      if (!model.nodes.length) return null;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      model.nodes.forEach(n => { const s = size(n); x0 = Math.min(x0, n.x - s.w / 2); y0 = Math.min(y0, n.y - s.h / 2); x1 = Math.max(x1, n.x + s.w / 2); y1 = Math.max(y1, n.y + s.h / 2); });
      return { x0, y0, x1, y1 };
    }
    /** Diagramm einpassen: so groß wie möglich (aber lesbar), mittig */
    function fit() {
      autoZoom = true;
      const r = canvas.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      const b = bbox();
      if (!b) { zoom = Math.min(0.9, Math.max(0.6, r.width / W)); applyZoom(); canvas.scrollTo(0, 0); return; }
      const bw = b.x1 - b.x0 + 50, bh = b.y1 - b.y0 + 50;
      zoom = Math.max(0.45, Math.min(1.1, Math.min(r.width / bw, r.height / bh)));
      applyZoom();
      canvas.scrollLeft = Math.max(0, ((b.x0 + b.x1) / 2) * zoom - r.width / 2);
      canvas.scrollTop = Math.max(0, ((b.y0 + b.y1) / 2) * zoom - r.height / 2);
    }
    function zoomBy(f) {
      autoZoom = false;
      const r = canvas.getBoundingClientRect(), cx = (canvas.scrollLeft + r.width / 2) / zoom, cy = (canvas.scrollTop + r.height / 2) / zoom;
      zoom = Math.max(0.35, Math.min(2.2, zoom * f)); applyZoom();
      canvas.scrollLeft = cx * zoom - r.width / 2; canvas.scrollTop = cy * zoom - r.height / 2;
    }
    let lastW = 0;
    new ResizeObserver(() => { const r = canvas.getBoundingClientRect(); if (lastW < 40 && r.width >= 40) fit(); else applyZoom(); lastW = r.width; }).observe(canvas);

    // ---------- Zeichnen ----------
    function render() {
      applyZoom();
      let es = '';
      model.edges.forEach((e, i) => {
        const a = byId(e.from), b = byId(e.to); if (!a || !b) return;
        const p = outPos(a), q = slotPos(b, e.slot, inCount(b, model.edges));
        const ty = q.y - (b.kind === 'fn' ? 2 : b.kind === 'split' ? 7 : 1), my = (p.y + ty) / 2, d = `M${p.x},${p.y} C${p.x},${my} ${q.x},${my} ${q.x},${ty}`;
        es += `<path class="hit" data-edge="${i}" d="${d}"/><path class="edge${edgeSel === i ? ' is-sel' : ''}" d="${d}" marker-end="url(#dfdArrow-${uid})"/>`;
      });
      gE.innerHTML = es;
      let ns = '';
      const order = model.nodes.slice().sort((a, b) => ((a.id === sel || a.id === connectFrom) ? 1 : 0) - ((b.id === sel || b.id === connectFrom) ? 1 : 0));
      order.forEach(n => {
        const s = size(n), cls = 'node k-' + n.kind + (sel === n.id ? ' is-sel' : '') + (connectFrom === n.id ? ' is-src' : '') + (n.kind === 'in' && !n.ref ? ' is-open' : '');
        ns += `<g class="${cls}" data-id="${n.id}" transform="translate(${n.x},${n.y})">`;
        if (n.kind === 'split') ns += `<circle r="12" class="pad"/><circle r="6.5" class="dot"/>`;
        else if (n.kind === 'const') ns += `<rect x="${-s.w / 2}" y="${-s.h / 2}" width="${s.w}" height="${s.h}" class="pad"/><text y="3" class="lab">${esc(n.label)}</text>`;
        else if (n.kind === 'fn') ns += `<ellipse rx="${s.w / 2}" ry="${s.h / 2}" class="shape"/><text y="6" class="lab">${esc(n.fn)}</text>`;
        else ns += `<rect x="${-s.w / 2}" y="${-s.h / 2}" width="${s.w}" height="${s.h}" class="shape"/><text y="6" class="lab">${esc(n.label)}</text>`;
        const cnt = inCount(n, model.edges);
        if (n.kind === 'fn') for (let i = 0; i < cnt; i++) {
          const q = slotPos(n, i, cnt), full = model.edges.some(e => e.to === n.id && e.slot === i);
          const wiring = !!(connectFrom || (drag && drag.mode === 'wire'));
          ns += `<g class="slot${full ? ' full' : ''}${slotRequired(n, i) ? '' : ' opt'}${wiring && !full ? ' target' : ''}" data-slot="${i}" transform="translate(${q.x - n.x},${q.y - n.y})"><circle r="16" class="slot-hit"/>${wiring && !full ? '<circle r="11" class="ring"/>' : ''}<text x="${full ? -11 : 0}" y="${full ? -4 : 5}">${i + 1}</text></g>`;
        }
        if (canOut(n) && (sel === n.id || connectFrom === n.id)) {
          const p = outPos(n), hy = p.y - n.y + (n.kind === 'split' ? 12 : 4);
          ns += `<g class="grip" data-handle="1" transform="translate(0,${hy})"><rect x="-22" y="0" width="44" height="30" rx="8"/><path d="M0 7 L0 21 M-6 15 L0 22 L6 15"/><rect class="handle-hit" x="-30" y="-6" width="60" height="44"/></g>`;
        }
        ns += '</g>';
      });
      gN.innerHTML = ns;
      const f = formula(model);
      fcode.textContent = f.err ? '–' : f.text;
      root.querySelector('[data-add=out]').disabled = model.nodes.some(n => n.kind === 'out');
      empty.hidden = model.nodes.length > 0;
      renderEdit();
    }
    function field(label, value, attrs) {
      return `<label class="dfd-field">${label ? `<span>${label}</span>` : ''}<input type="text" value="${esc(value || '')}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ${attrs || ''}></label>`;
    }
    const delBtn = '<button type="button" class="fbtn danger" data-act="del" title="Löschen">✕<span class="hide-narrow"> Löschen</span></button>';
    function renderEdit() {
      const n = sel && byId(sel);
      if (!n && edgeSel === null) { edit.hidden = true; return; }
      edit.hidden = false;
      if (!n) { edit.innerHTML = `<div class="sig">Pfeil ausgewählt</div>${delBtn}`; bindDel(); return; }
      if (n.kind === 'split') { edit.innerHTML = `<div class="sig">Verteiler: ein Pfeil hinein, mehrere heraus</div>${delBtn}`; bindDel(); return; }
      if (n.kind === 'fn') {
        const cnt = slotCount(n, model.edges);
        const parts = [...Array(cnt)].map((_, i) => `<span class="${model.edges.some(e => e.to === n.id && e.slot === i) ? 'on' : ''}">${i + 1}: ${esc(slotName(n, i))}${slotRequired(n, i) ? '' : ' (optional)'}</span>`).join('');
        edit.innerHTML = `<div class="sig"><b>${esc(isOp(n.fn) ? n.fn + ' · ' + OPNAME[n.fn] : n.fn)}</b> ${parts}</div><button type="button" class="fbtn" data-act="pick">Funktion ändern</button>${delBtn}`; bindDel();
        edit.querySelector('[data-act=pick]').onclick = () => picker(fn => { n.fn = fn; const c = slotCount(n, model.edges); model.edges = model.edges.filter(e => !(e.to === n.id && e.slot >= c)); save(); render(); });
        return;
      }
      if (n.kind === 'in') {
        edit.innerHTML = `<span class="sig-l">Eingabe</span>` + field('', n.ref, 'data-f="ref" class="f-cell" placeholder="B2:B6" autocapitalize="characters"')
          + field('Name', n.name, 'data-f="name" class="f-name" placeholder="z. B. Preis"')
          + `<button type="button" class="fbtn icon" data-act="pickcell" title="Zelle in der Tabelle antippen" aria-label="Zelle antippen">▦</button><button type="button" class="fbtn icon" data-act="ok" aria-label="Übernehmen">✓</button>${delBtn}`; bindDel();
        const fr = edit.querySelector('[data-f=ref]'), fname = edit.querySelector('[data-f=name]');
        const apply = () => {
          const r = fr.value.trim().toUpperCase().replace(/\s+/g, '');
          if (r && !/^\$?[A-Z]\$?\d+(:\$?[A-Z]\$?\d+)?$/.test(r)) { say('Das ist keine Zelle. Schreibe z. B. <code>B2</code> oder einen Bereich wie <code>B2:B6</code>.', 'bad'); return; }
          const changedRef = r !== (n.ref || '');
          n.ref = r || undefined;
          n.name = fname.value.trim() || (changedRef && r ? host.labelOf(r) : '') || undefined;
          n.label = labelFor(n.name, n.ref); save(); render();
        };
        edit.querySelector('[data-act=ok]').onclick = apply;
        edit.querySelector('[data-act=pickcell]').onclick = () => pickFor(n);
        [fr, fname].forEach(i => i.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); apply(); } }));
        return;
      }
      if (n.kind === 'out') {
        // Ausgabe in [Zelle] ▦ · Name · ✓ · ✕ – eine Zeile
        edit.innerHTML = `<span class="sig-l">Ausgabe in</span>` + field('', n.ref, 'data-f="ref" class="f-cell" placeholder="D2" autocapitalize="characters"')
          + `<button type="button" class="fbtn icon" data-act="pickcell" title="Zielzelle in der Tabelle antippen" aria-label="Zielzelle antippen">▦</button>`
          + field('Name', n.name, 'data-f="name" class="f-name" placeholder="z. B. Endpreis"') + `<button type="button" class="fbtn icon" data-act="ok" aria-label="Übernehmen">✓</button>${delBtn}`; bindDel();
        const fname = edit.querySelector('[data-f=name]'), fref = edit.querySelector('[data-f=ref]');
        const apply = () => {
          n.name = fname.value.trim() || undefined;
          const r = fref.value.trim().toUpperCase().replace(/\$/g, '');
          n.label = n.ref ? labelFor(n.name, n.ref) : (n.name || 'Ergebnis'); save(); render();
          if (r && r !== n.ref) {
            if (!/^[A-Z]\d+$/.test(r)) { say('Die Ausgabe ist genau eine Zelle, z. B. <code>D2</code>.', 'bad'); return; }
            host.moveOutput && host.moveOutput(r);
          }
        };
        edit.querySelector('[data-act=ok]').onclick = apply;
        edit.querySelector('[data-act=pickcell]').onclick = () => host.startPick(ref => { const r = ref.split(':')[0]; fref.value = r; apply(); }, 'Tippe die Zelle an, in die das Ergebnis soll.');
        [fname, fref].forEach(i => i.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); apply(); } }));
        return;
      }
      // Konstante
      edit.innerHTML = field('Wert', n.label, 'data-f="v" inputmode="decimal"') + `<button type="button" class="fbtn" data-act="ok">✓</button><span class="dfd-hint">Text in Anführungszeichen: <code>"ja"</code></span>${delBtn}`; bindDel();
      const inp = edit.querySelector('input');
      const apply = () => { n.label = inp.value.trim() || n.label; save(); render(); };
      edit.querySelector('[data-act=ok]').onclick = apply;
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); apply(); } });
      if (n.fresh) { delete n.fresh; setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) { } }, 30); }
    }
    function pickFor(n) {
      host.startPick(ref => {
        const node = byId(n.id); if (!node) return;
        node.ref = ref; node.name = host.labelOf(ref) || undefined; node.label = labelFor(node.name, ref);
        sel = node.id; save(); render(); say(`Eingabe <b>${esc(node.label)}</b> gesetzt.`);
      }, 'Tippe die Zelle der Eingabe an – oder ziehe über einen Bereich.');
    }
    // ---------- Funktionsauswahl ----------
    function picker(done) {
      const ov = document.createElement('div'); ov.className = 'dfd-picker';
      const groups = {};
      Object.keys(OPS).forEach(o => { const g = PREC[o] === 1 ? 'Vergleich' : 'Rechenzeichen'; (groups[g] = groups[g] || []).push(o); });
      Object.entries(F).forEach(([k, v]) => (groups[v.g] = groups[v.g] || []).push(k));
      const btn = f => `<button type="button" data-fn="${esc(f)}"><b>${esc(f)}</b><span>${esc(isOp(f) ? OPNAME[f] : sig(f))}</span>${isOp(f) ? '' : `<i>${esc(F[f].d)}</i>`}</button>`;
      ov.innerHTML = `<div class="dfd-picker-in"><div class="dfd-picker-head"><b>Funktion wählen</b><input type="search" placeholder="suchen …" autocomplete="off" autocapitalize="characters"><button type="button" class="fbtn" data-x aria-label="Schließen">✕</button></div>
        <div class="dfd-picker-list">${Object.entries(groups).map(([g, fs]) => `<h4>${esc(g)}</h4><div class="grid">${fs.map(btn).join('')}</div>`).join('')}</div></div>`;
      document.body.appendChild(ov);
      const close = () => ov.remove();
      ov.querySelector('[data-x]').onclick = close;
      ov.addEventListener('click', e => { if (e.target === ov) close(); const b = e.target.closest('[data-fn]'); if (b) { close(); done(b.dataset.fn); } });
      const s = ov.querySelector('input[type=search]');
      s.addEventListener('input', () => { const q = s.value.trim().toUpperCase(); ov.querySelectorAll('[data-fn]').forEach(b => b.hidden = q && !b.dataset.fn.includes(q) && !b.textContent.toUpperCase().includes(q)); });
    }
    // ---------- Verbinden ----------
    function connect(fromId, toId, slot) {
      const a = byId(fromId), b = byId(toId);
      if (!a || !b || a === b) return;
      if (b.kind === 'in' || b.kind === 'const') { say('In Eingaben und Konstanten führt kein Pfeil hinein.', 'bad'); return; }
      const outs = model.edges.filter(e => e.from === fromId).length;
      if (outs >= maxOut(a)) {
        say(a.kind === 'out' ? 'Aus der Ausgabe führt kein Pfeil heraus.'
          : 'Aus diesem Baustein führt schon ein Pfeil. Soll das Datum an mehrere Funktionen gehen, führe den Pfeil in einen <b>Verteiler</b> – aus dem Verteiler dürfen mehrere Pfeile herausgehen.', 'bad'); return;
      }
      const cnt = inCount(b, model.edges);
      if (slot === undefined || slot === null) { slot = [...Array(cnt).keys()].find(i => !model.edges.some(e => e.to === toId && e.slot === i)); }
      if (slot === undefined) { say('Alle Eingänge dieses Bausteins sind schon belegt. Tippe einen Pfeil an und lösche ihn, wenn du umstecken willst.', 'bad'); return; }
      const reach = new Set([toId]); let ch2 = true;
      while (ch2) { ch2 = false; model.edges.forEach(e => { if (reach.has(e.from) && !reach.has(e.to)) { reach.add(e.to); ch2 = true; } }); }
      if (reach.has(fromId)) { say('So entstünde ein Kreis. Daten fließen nur in eine Richtung.', 'bad'); return; }
      model.edges = model.edges.filter(e => !(e.to === toId && e.slot === slot));
      model.edges.push({ from: fromId, to: toId, slot });
      save(); say(b.kind === 'fn' ? `Verbunden mit Eingang ${slot + 1} (${esc(slotName(b, slot))}) von <b>${esc(b.fn)}</b>.` : 'Verbunden.');
    }
    /** Ziel unter dem Finger – Eingänge (Slots) haben Vorrang, der Quell-Baustein selbst zählt nicht */
    function hitTarget(ev, exclude) {
      const els = document.elementsFromPoint ? document.elementsFromPoint(ev.clientX, ev.clientY) : [document.elementFromPoint(ev.clientX, ev.clientY)];
      let node = null;
      for (const el of els) {
        if (!el || !el.closest) continue;
        const g = el.closest('.node'); if (!g || g.dataset.id === exclude) continue;
        const s = el.closest('.slot'); if (s) return { id: g.dataset.id, slot: +s.dataset.slot };
        if (!node) node = { id: g.dataset.id, slot: null };
      }
      return node;
    }
    svg.addEventListener('pointerdown', ev => {
      const handle = ev.target.closest('[data-handle]'), g = ev.target.closest('.node'), edgeEl = ev.target.closest('[data-edge]');
      const p = pt(ev);
      if (connectFrom) {
        const t = hitTarget(ev, connectFrom);
        if (t) { ev.preventDefault(); connect(connectFrom, t.id, t.slot); connectFrom = null; render(); return; }
      }
      if (handle && g) { ev.preventDefault(); drag = { mode: 'wire', id: g.dataset.id, x0: p.x, y0: p.y, moved: false, pid: ev.pointerId }; try { svg.setPointerCapture(ev.pointerId); } catch (e) { } return; }
      if (g) {
        ev.preventDefault(); const n = byId(g.dataset.id);
        drag = { mode: 'move', id: n.id, dx: p.x - n.x, dy: p.y - n.y, x0: p.x, y0: p.y, moved: false, pid: ev.pointerId };
        try { svg.setPointerCapture(ev.pointerId); } catch (e) { } return;
      }
      if (edgeEl) { edgeSel = +edgeEl.dataset.edge; sel = null; connectFrom = null; render(); return; }
      if (sel || edgeSel !== null || connectFrom) { sel = null; edgeSel = null; connectFrom = null; render(); }
    });
    svg.addEventListener('pointermove', ev => {
      if (!drag || ev.pointerId !== drag.pid) return;
      const p = pt(ev);
      if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 6) drag.moved = true;
      if (drag.mode === 'move' && drag.moved) {
        const n = byId(drag.id);
        n.x = Math.max(30, Math.round(p.x - drag.dx)); n.y = Math.max(24, Math.round(p.y - drag.dy));
        if (n.x > cw() - 40) model.w = cw() + 120;
        if (n.y > ch() - 30) model.h = ch() + 100;
        render();
      } else if (drag.mode === 'wire' && drag.moved) {
        if (!drag.shown) { drag.shown = true; render(); }
        const s = outPos(byId(drag.id)); rubber.setAttribute('d', `M${s.x},${s.y} L${p.x},${p.y}`);
      }
    });
    function endDrag(ev) {
      if (!drag || ev.pointerId !== drag.pid) return;
      const d = drag; drag = null; rubber.setAttribute('d', '');
      if (d.mode === 'wire') {
        if (d.moved) { const t = hitTarget(ev, d.id); if (t) connect(d.id, t.id, t.slot); }
        else { connectFrom = d.id; sel = null; say('Jetzt das Ziel antippen. Bei Funktionen zeigen orange Ringe die freien Eingänge.'); }
      } else if (!d.moved) { sel = d.id; edgeSel = null; }
      save(); render();
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    // ---------- Knöpfe ----------
    root.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.add;
      if (t === 'in') { const n = addNode({ kind: 'in', label: '?' }); pickFor(n); }
      if (t === 'const') addNode({ kind: 'const', label: '2', fresh: true });
      if (t === 'split') addNode({ kind: 'split' });
      if (t === 'out') { const name = outRef ? host.labelOf(outRef) : ''; addNode({ kind: 'out', ref: outRef || undefined, name: name || undefined, label: outRef ? labelFor(name, outRef) : 'Ergebnis' }); }
      if (t === 'fn') picker(fn => addNode({ kind: 'fn', fn }));
    }));
    function bindDel() {
      edit.querySelector('[data-act=del]').onclick = () => {
        if (edgeSel !== null) { model.edges.splice(edgeSel, 1); edgeSel = null; }
        else if (sel) { model.nodes = model.nodes.filter(n => n.id !== sel); model.edges = model.edges.filter(e => e.from !== sel && e.to !== sel); sel = null; }
        save(); render();
      };
    }

    return {
      /** Diagramm anzeigen. info: { outRef, emptyHtml } */
      setModel(m, info) {
        model = m || { nodes: [], edges: [] };
        seq = model.nodes.reduce((mx, n) => Math.max(mx, +String(n.id).slice(1) || 0), 0);
        sel = null; edgeSel = null; connectFrom = null; drag = null;
        outRef = info && info.outRef || null;
        // Ausgabe-Rechteck folgt der Zelle, für die das Diagramm gilt
        const out = model.nodes.find(n => n.kind === 'out');
        if (out && outRef && out.ref !== outRef) { out.ref = outRef; out.label = labelFor(out.name, outRef); }
        empty.innerHTML = (info && info.emptyHtml) || '';
        render(); fit();
      },
      getModel: () => model,
      formula: () => formula(model),
      render, say, fit, zoomBy,
      clearSelection() { sel = null; edgeSel = null; connectFrom = null; render(); },
    };
  }

  return { Editor, fromTerm, formula, ruleCheck, compare, swapTip, F, OPS, OPNAME, sig, isOp };
})();
export default DFD;
