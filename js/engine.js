/* MiniCalc-Engine: kleine Tabellenkalkulation mit deutschen Funktionsnamen.
   Formeln: =, ; als Trennzeichen, Dezimalkomma, $-Bezüge, Bereiche A1:B3. */
/* Übernommen aus der DFD-Werkstatt (Informatik 9). Änderung für FlowPad: Bezüge behalten ihre $-Zeichen (ac/ar). */
export const CalcEngine = (() => {
  const ERR = e => ({ err: e });
  const isErr = v => v && typeof v === 'object' && 'err' in v;
  const colName = c => String.fromCharCode(65 + c);
  const addr = (r, c) => colName(c) + (r + 1);
  function parseAddr(a) { const m = /^\$?([A-Z])\$?(\d+)$/.exec(a.toUpperCase()); return m ? { r: +m[2] - 1, c: m[1].charCodeAt(0) - 65 } : null; }
  function rangeCells(a) {
    const [p, q] = a.split(':'); const A = parseAddr(p), B = parseAddr(q || p); const out = [];
    for (let r = Math.min(A.r, B.r); r <= Math.max(A.r, B.r); r++) for (let c = Math.min(A.c, B.c); c <= Math.max(A.c, B.c); c++) out.push(addr(r, c));
    return out;
  }

  // ---------- Tokenizer ----------
  function tokenize(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ' || ch === ' ') { i++; continue; }
      const rest = src.slice(i); let m;
      if (ch === '"' || ch === '“' || ch === '„' || ch === '”') {
        let j = i + 1, s = '';
        while (j < src.length && !'"“”„'.includes(src[j])) { s += src[j]; j++; }
        if (j >= src.length) throw ERR('#NAME?');
        t.push({ k: 'str', v: s }); i = j + 1; continue;
      }
      if ((m = /^(\$?)([A-Za-z])(\$?)(\d+)/.exec(rest))) {
        const after = rest.slice(m[0].length);
        if (!/^[A-Za-zÄÖÜäöüß0-9_(]/.test(after)) {
          t.push({ k: 'ref', ac: !!m[1], c: m[2].toUpperCase().charCodeAt(0) - 65, ar: !!m[3], r: +m[4] - 1, pos: i, len: m[0].length });
          i += m[0].length; continue;
        }
      }
      if ((m = /^\d+(,\d+)?|^,\d+/.exec(rest))) { t.push({ k: 'num', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9_.]*/.exec(rest))) { t.push({ k: 'name', v: m[0].toUpperCase() }); i += m[0].length; continue; }
      if ((m = /^(<=|>=|<>|[-+*\/^&=<>();:%])/.exec(rest))) { t.push({ k: 'op', v: m[0] }); i += m[0].length; continue; }
      throw ERR('#NAME?');
    }
    return t;
  }

  // ---------- Parser ----------
  function parse(src) {
    const t = tokenize(src); let p = 0;
    const peek = () => t[p], next = () => t[p++];
    const isOp = (v) => t[p] && t[p].k === 'op' && t[p].v === v;
    function expect(v) { if (!isOp(v)) throw ERR('#NAME?'); p++; }
    function comparison() {
      let a = concat();
      while (t[p] && t[p].k === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(t[p].v)) { const o = next().v; a = { k: 'bin', o, a, b: concat() }; }
      return a;
    }
    function concat() { let a = additive(); while (isOp('&')) { next(); a = { k: 'bin', o: '&', a, b: additive() }; } return a; }
    function additive() { let a = term(); while (isOp('+') || isOp('-')) { const o = next().v; a = { k: 'bin', o, a, b: term() }; } return a; }
    function term() { let a = power(); while (isOp('*') || isOp('/')) { const o = next().v; a = { k: 'bin', o, a, b: power() }; } return a; }
    function power() { let a = unary(); while (isOp('^')) { next(); a = { k: 'bin', o: '^', a, b: unary() }; } return a; }
    function unary() { if (isOp('-')) { next(); return { k: 'neg', a: unary() }; } if (isOp('+')) { next(); return unary(); } return postfix(); }
    function postfix() { let a = primary(); while (isOp('%')) { next(); a = { k: 'bin', o: '/', a, b: { k: 'num', v: 100 } }; } return a; }
    function primary() {
      const tk = next();
      if (!tk) throw ERR('#NAME?');
      if (tk.k === 'num') return { k: 'num', v: tk.v };
      if (tk.k === 'str') return { k: 'str', v: tk.v };
      if (tk.k === 'ref') {
        if (isOp(':')) { next(); const b = next(); if (!b || b.k !== 'ref') throw ERR('#NAME?'); return { k: 'range', a: tk, b }; }
        return { k: 'ref', r: tk.r, c: tk.c, ac: tk.ac, ar: tk.ar };
      }
      if (tk.k === 'name') {
        if (isOp('(')) {
          next(); const args = [];
          if (!isOp(')')) { args.push(comparison()); while (isOp(';')) { next(); args.push(comparison()); } }
          expect(')');
          return { k: 'fn', n: tk.v, args };
        }
        if (tk.v === 'WAHR') return { k: 'bool', v: true };
        if (tk.v === 'FALSCH') return { k: 'bool', v: false };
        throw ERR('#NAME?');
      }
      if (tk.k === 'op' && tk.v === '(') { const e = comparison(); expect(')'); return e; }
      throw ERR('#NAME?');
    }
    const ast = comparison();
    if (p < t.length) throw ERR('#NAME?');
    return ast;
  }

  // ---------- Werte ----------
  function rawToValue(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    const s = String(raw).trim();
    if (/^-?\d+(,\d+)?$/.test(s)) return parseFloat(s.replace(',', '.'));
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if (/^-?\d+(,\d+)?\s*%$/.test(s)) return parseFloat(s.replace(',', '.')) / 100;
    if (/^-?\d+(,\d+)?\s*€$/.test(s)) return parseFloat(s.replace(',', '.'));
    if (s.toUpperCase() === 'WAHR') return true;
    if (s.toUpperCase() === 'FALSCH') return false;
    return String(raw);
  }
  function toNum(v) {
    if (isErr(v)) return v;
    if (v === null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const x = rawToValue(v);
    if (typeof x === 'number') return x;
    return ERR('#WERT!');
  }
  function toStr(v) {
    if (v === null) return '';
    if (typeof v === 'number') return fmtNum(v);
    if (typeof v === 'boolean') return v ? 'WAHR' : 'FALSCH';
    return String(v);
  }
  function toBool(v) {
    if (isErr(v)) return v;
    if (typeof v === 'boolean') return v;
    if (v === null) return false;
    if (typeof v === 'number') return v !== 0;
    const u = String(v).toUpperCase();
    if (u === 'WAHR') return true; if (u === 'FALSCH') return false;
    return ERR('#WERT!');
  }
  function fmtNum(x, dec) {
    if (!isFinite(x)) return '#ZAHL!';
    let s;
    if (dec !== undefined) s = x.toFixed(dec);
    else { s = String(parseFloat(x.toPrecision(12))); if (/e/.test(s)) s = x.toPrecision(6); }
    return s.replace('.', ',');
  }
  function cmp(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (a === null) a = typeof b === 'string' ? '' : 0;
    if (b === null) b = typeof a === 'string' ? '' : 0;
    if (typeof a === 'boolean') a = a ? 1 : 0;
    if (typeof b === 'boolean') b = b ? 1 : 0;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'number') return -1;
    if (typeof b === 'number') return 1;
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
  }
  function crit(c) {
    // Kriterium für ZÄHLENWENN/SUMMEWENN
    if (typeof c === 'number') return v => typeof v === 'number' && v === c;
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(String(c));
    const op = m[1] || '=', rv = rawToValue(m[2]);
    return v => {
      if (v === null) return op === '<>' ? true : false;
      const d = cmp(v, rv);
      if (typeof rv === 'number' && typeof v !== 'number') return op === '<>';
      return { '=': d === 0, '<>': d !== 0, '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[op];
    };
  }
  const EPOCH = Date.UTC(1899, 11, 30);
  const toSerial = ms => (ms - EPOCH) / 864e5;
  const fromSerial = n => new Date(EPOCH + n * 864e5);
  function round(x, n) { const f = Math.pow(10, n); const y = Math.abs(x) * f; const r = Math.floor(y + 0.5 + 1e-9); return Math.sign(x) * r / f; }

  // ---------- Blatt ----------
  class Sheet {
    constructor(rows, cols, raw) { this.rows = rows; this.cols = cols; this.raw = Object.assign({}, raw || {}); this.cache = {}; }
    set(a, v) { if (v === '' || v === null || v === undefined) delete this.raw[a]; else this.raw[a] = v; this.cache = {}; }
    get(a) { return this.raw[a]; }
    isFormula(a) { const r = this.raw[a]; return typeof r === 'string' && r.trim().startsWith('='); }
    value(a, stack) {
      if (a in this.cache) return this.cache[a];
      stack = stack || new Set();
      if (stack.has(a)) return ERR('#ZIRKEL!');
      const raw = this.raw[a];
      let v;
      if (typeof raw === 'string' && raw.trim().startsWith('=')) {
        stack.add(a);
        if (raw.toUpperCase().includes('#BEZUG!')) { stack.delete(a); this.cache[a] = ERR('#BEZUG!'); return this.cache[a]; }
        try {
          const ast = parse(raw.trim().slice(1));
          v = this.ev(ast, stack);
          if (v && v.range) v = ERR('#WERT!');
          if (v === null) v = 0;
        } catch (e) { v = isErr(e) ? e : ERR('#NAME?'); }
        stack.delete(a);
      } else v = rawToValue(raw);
      this.cache[a] = v;
      return v;
    }
    refVal(r, c, stack) {
      if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return ERR('#BEZUG!');
      return this.value(addr(r, c), stack);
    }
    rangeVals(n, stack) {
      const r0 = Math.min(n.a.r, n.b.r), r1 = Math.max(n.a.r, n.b.r), c0 = Math.min(n.a.c, n.b.c), c1 = Math.max(n.a.c, n.b.c);
      if (r0 < 0 || c0 < 0 || r1 >= this.rows || c1 >= this.cols) return ERR('#BEZUG!');
      const out = [];
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(this.value(addr(r, c), stack));
      return { range: out };
    }
    ev(n, st) {
      switch (n.k) {
        case 'num': return n.v;
        case 'str': return n.v;
        case 'bool': return n.v;
        case 'ref': return this.refVal(n.r, n.c, st);
        case 'range': return this.rangeVals(n, st);
        case 'neg': { const a = toNum(this.ev(n.a, st)); return isErr(a) ? a : -a; }
        case 'bin': {
          let a = this.ev(n.a, st), b = this.ev(n.b, st);
          if (a && a.range) a = ERR('#WERT!'); if (b && b.range) b = ERR('#WERT!');
          if (isErr(a)) return a; if (isErr(b)) return b;
          if (n.o === '&') return toStr(a) + toStr(b);
          if (['=', '<>', '<', '>', '<=', '>='].includes(n.o)) {
            const d = cmp(a, b);
            return { '=': d === 0, '<>': d !== 0, '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[n.o];
          }
          const x = toNum(a), y = toNum(b);
          if (isErr(x)) return x; if (isErr(y)) return y;
          if (n.o === '+') return x + y; if (n.o === '-') return x - y; if (n.o === '*') return x * y;
          if (n.o === '/') return y === 0 ? ERR('#DIV/0!') : x / y;
          if (n.o === '^') return Math.pow(x, y);
        }
        case 'fn': return this.fn(n, st);
      }
      return ERR('#NAME?');
    }
    nums(args, st, countText) {
      // sammelt Zahlen: aus Bereichen nur echte Zahlen, direkte Argumente werden umgewandelt
      const out = [];
      for (const a of args) {
        const v = this.ev(a, st);
        if (isErr(v)) return v;
        if (v && v.range) { for (const x of v.range) { if (isErr(x)) return x; if (typeof x === 'number') out.push(x); } }
        else { const x = toNum(v); if (isErr(x)) return x; out.push(x); }
      }
      return out;
    }
    fn(n, st) {
      const A = n.args, name = n.n.replace('ZAEHLENWENN', 'ZÄHLENWENN');
      const need = (k) => { if (A.length < k) throw ERR('#WERT!'); };
      switch (name) {
        case 'SUMME': { const v = this.nums(A, st); return isErr(v) ? v : v.reduce((s, x) => s + x, 0); }
        case 'MITTELWERT': { const v = this.nums(A, st); if (isErr(v)) return v; return v.length ? v.reduce((s, x) => s + x, 0) / v.length : ERR('#DIV/0!'); }
        case 'MIN': { const v = this.nums(A, st); if (isErr(v)) return v; return v.length ? Math.min(...v) : 0; }
        case 'MAX': { const v = this.nums(A, st); if (isErr(v)) return v; return v.length ? Math.max(...v) : 0; }
        case 'ANZAHL': { let k = 0; for (const a of A) { const v = this.ev(a, st); if (v && v.range) k += v.range.filter(x => typeof x === 'number').length; else if (typeof v === 'number') k++; } return k; }
        case 'ANZAHL2': { let k = 0; for (const a of A) { const v = this.ev(a, st); if (v && v.range) k += v.range.filter(x => x !== null && x !== '').length; else if (v !== null) k++; } return k; }
        case 'RUNDEN': { need(2); const x = toNum(this.ev(A[0], st)), d = toNum(this.ev(A[1], st)); if (isErr(x)) return x; if (isErr(d)) return d; return round(x, Math.trunc(d)); }
        case 'ABS': { need(1); const x = toNum(this.ev(A[0], st)); return isErr(x) ? x : Math.abs(x); }
        case 'WURZEL': { need(1); const x = toNum(this.ev(A[0], st)); if (isErr(x)) return x; return x < 0 ? ERR('#ZAHL!') : Math.sqrt(x); }
        case 'POTENZ': { need(2); const x = toNum(this.ev(A[0], st)), y = toNum(this.ev(A[1], st)); if (isErr(x)) return x; if (isErr(y)) return y; return Math.pow(x, y); }
        case 'WENN': {
          need(1);
          const b = toBool(this.ev(A[0], st)); if (isErr(b)) return b;
          if (b) return A.length > 1 ? this.ev(A[1], st) : true;
          return A.length > 2 ? this.ev(A[2], st) : false;
        }
        case 'UND': case 'ODER': {
          const vals = [];
          for (const a of A) { const v = this.ev(a, st); if (v && v.range) vals.push(...v.range.filter(x => x !== null)); else vals.push(v); }
          let res = name === 'UND';
          for (const v of vals) { const b = toBool(v); if (isErr(b)) return b; res = name === 'UND' ? res && b : res || b; }
          return res;
        }
        case 'NICHT': { need(1); const b = toBool(this.ev(A[0], st)); return isErr(b) ? b : !b; }
        case 'ZÄHLENWENN': {
          need(2); const r = this.ev(A[0], st); const c = this.ev(A[1], st); if (isErr(c)) return c;
          const list = r && r.range ? r.range : [r]; const f = crit(c); return list.filter(v => !isErr(v) && f(v)).length;
        }
        case 'SUMMEWENN': {
          need(2); const r = this.ev(A[0], st); const c = this.ev(A[1], st); const s = A[2] ? this.ev(A[2], st) : r;
          const list = r && r.range ? r.range : [r], sl = s && s.range ? s.range : [s], f = crit(c);
          let sum = 0; list.forEach((v, i) => { if (!isErr(v) && f(v) && typeof sl[i] === 'number') sum += sl[i]; }); return sum;
        }
        case 'ABRUNDEN': case 'AUFRUNDEN': {
          need(1); const x = toNum(this.ev(A[0], st)), d = A[1] ? toNum(this.ev(A[1], st)) : 0; if (isErr(x)) return x; if (isErr(d)) return d;
          const f = Math.pow(10, Math.trunc(d)), y = Math.abs(x) * f, r = name === 'ABRUNDEN' ? Math.floor(y + 1e-9) : Math.ceil(y - 1e-9);
          return Math.sign(x) * r / f;
        }
        case 'GANZZAHL': { need(1); const x = toNum(this.ev(A[0], st)); return isErr(x) ? x : Math.floor(x); }
        case 'OBERGRENZE': {
          need(2); const x = toNum(this.ev(A[0], st)), s_ = toNum(this.ev(A[1], st)); if (isErr(x)) return x; if (isErr(s_)) return s_;
          if (s_ === 0) return 0; if (x > 0 && s_ < 0) return ERR('#ZAHL!'); return Math.ceil(x / s_ - 1e-9) * s_;
        }
        case 'PRODUKT': { const v = this.nums(A, st); return isErr(v) ? v : v.reduce((p, x) => p * x, 1); }
        case 'QUOTIENT': { need(2); const a = toNum(this.ev(A[0], st)), b = toNum(this.ev(A[1], st)); if (isErr(a)) return a; if (isErr(b)) return b; return b === 0 ? ERR('#DIV/0!') : Math.trunc(a / b); }
        case 'REST': { need(2); const a = toNum(this.ev(A[0], st)), b = toNum(this.ev(A[1], st)); if (isErr(a)) return a; if (isErr(b)) return b; return b === 0 ? ERR('#DIV/0!') : a - b * Math.floor(a / b); }
        case 'VORZEICHEN': { need(1); const x = toNum(this.ev(A[0], st)); return isErr(x) ? x : Math.sign(x); }
        case 'ZUFALLSZAHL': return Math.random();
        case 'ZUFALLSBEREICH': { need(2); const a = toNum(this.ev(A[0], st)), b = toNum(this.ev(A[1], st)); if (isErr(a)) return a; if (isErr(b)) return b; return Math.ceil(a) + Math.floor(Math.random() * (Math.floor(b) - Math.ceil(a) + 1)); }
        case 'CODE': { need(1); const t = this.ev(A[0], st); if (isErr(t)) return t; const s2 = toStr(t); return s2.length ? s2.charCodeAt(0) : ERR('#WERT!'); }
        case 'ZEICHEN': { need(1); const x = toNum(this.ev(A[0], st)); if (isErr(x)) return x; return x < 1 || x > 255 ? ERR('#WERT!') : String.fromCharCode(Math.trunc(x)); }
        case 'GROSS': case 'KLEIN': case 'LÄNGE': {
          need(1); const t = this.ev(A[0], st); if (isErr(t)) return t; const s2 = toStr(t);
          return name === 'GROSS' ? s2.toUpperCase() : name === 'KLEIN' ? s2.toLowerCase() : s2.length;
        }
        case 'LINKS': case 'RECHTS': {
          need(1); const t = this.ev(A[0], st); if (isErr(t)) return t; const n = A[1] ? toNum(this.ev(A[1], st)) : 1; if (isErr(n)) return n;
          if (n < 0) return ERR('#WERT!'); const s2 = toStr(t); return name === 'LINKS' ? s2.slice(0, n) : (n === 0 ? '' : s2.slice(-n));
        }
        case 'TEIL': {
          need(3); const t = this.ev(A[0], st), a = toNum(this.ev(A[1], st)), n = toNum(this.ev(A[2], st)); if (isErr(t)) return t; if (isErr(a)) return a; if (isErr(n)) return n;
          if (a < 1 || n < 0) return ERR('#WERT!'); return toStr(t).substr(a - 1, n);
        }
        case 'FINDEN': {
          need(2); const q = this.ev(A[0], st), t = this.ev(A[1], st), a = A[2] ? toNum(this.ev(A[2], st)) : 1; if (isErr(q)) return q; if (isErr(t)) return t; if (isErr(a)) return a;
          const i = toStr(t).indexOf(toStr(q), a - 1); return i < 0 || a < 1 ? ERR('#WERT!') : i + 1;
        }
        case 'IDENTISCH': { need(2); const a = this.ev(A[0], st), b = this.ev(A[1], st); if (isErr(a)) return a; if (isErr(b)) return b; return toStr(a) === toStr(b); }
        case 'WECHSELN': {
          need(3); const t = toStr(this.ev(A[0], st)), alt = toStr(this.ev(A[1], st)), neu = toStr(this.ev(A[2], st));
          if (!alt) return t;
          if (A[3]) { const n = toNum(this.ev(A[3], st)); if (isErr(n)) return n; let i = -1; for (let k = 0; k < n; k++) { i = t.indexOf(alt, i + 1); if (i < 0) return t; } return t.slice(0, i) + neu + t.slice(i + alt.length); }
          return t.split(alt).join(neu);
        }
        case 'TEXTKETTE': { let s2 = ''; for (const a of A) { const v = this.ev(a, st); if (isErr(v)) return v; if (v && v.range) s2 += v.range.map(toStr).join(''); else s2 += toStr(v); } return s2; }
        case 'DATUM': {
          need(3); const y = toNum(this.ev(A[0], st)), m = toNum(this.ev(A[1], st)), d = toNum(this.ev(A[2], st)); if (isErr(y)) return y; if (isErr(m)) return m; if (isErr(d)) return d;
          return toSerial(Date.UTC(y < 1900 ? y + 1900 : y, m - 1, d));
        }
        case 'HEUTE': { const n = new Date(); return toSerial(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
        case 'JETZT': { const n = new Date(); return toSerial(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds())); }
        case 'JAHR': case 'MONAT': case 'TAG': case 'WOCHENTAG': {
          need(1); const x = toNum(this.ev(A[0], st)); if (isErr(x)) return x; if (x < 0) return ERR('#ZAHL!');
          const dt = fromSerial(Math.floor(x));
          if (name === 'JAHR') return dt.getUTCFullYear(); if (name === 'MONAT') return dt.getUTCMonth() + 1; if (name === 'TAG') return dt.getUTCDate();
          const typ = A[1] ? toNum(this.ev(A[1], st)) : 1, wd = dt.getUTCDay();
          return typ === 2 ? (wd + 6) % 7 + 1 : typ === 3 ? (wd + 6) % 7 : wd + 1;
        }
        case 'STUNDE': case 'MINUTE': case 'SEKUNDE': {
          need(1); const x = toNum(this.ev(A[0], st)); if (isErr(x)) return x; if (x < 0) return ERR('#ZAHL!');
          const sec = Math.round((x - Math.floor(x)) * 86400) % 86400;
          return name === 'STUNDE' ? Math.floor(sec / 3600) : name === 'MINUTE' ? Math.floor(sec / 60) % 60 : sec % 60;
        }
        case 'ZEIT': {
          need(3); const h = toNum(this.ev(A[0], st)), m = toNum(this.ev(A[1], st)), s3 = toNum(this.ev(A[2], st)); if (isErr(h)) return h; if (isErr(m)) return m; if (isErr(s3)) return s3;
          const t = ((h * 3600 + m * 60 + s3) % 86400 + 86400) % 86400; return t / 86400;
        }
        case 'VERKETTEN': { let s = ''; for (const a of A) { const v = this.ev(a, st); if (isErr(v)) return v; s += toStr(v); } return s; }
      }
      return ERR('#NAME?');
    }
  }

  // Formel beim Kopieren verschieben (relative Teile ändern sich)
  function shiftFormula(src, dr, dc) {
    if (typeof src !== 'string' || !src.trim().startsWith('=')) return src;
    let out = '', i = 0, inStr = false;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '"') { inStr = !inStr; out += ch; i++; continue; }
      if (!inStr) {
        const m = /^(\$?)([A-Za-z])(\$?)(\d+)/.exec(src.slice(i));
        const prev = i > 0 ? src[i - 1] : '';
        if (m && !/[A-Za-zÄÖÜäöüß0-9_]/.test(prev) && !/^[A-Za-zÄÖÜäöüß0-9_(]/.test(src.slice(i + m[0].length))) {
          let c = m[2].toUpperCase().charCodeAt(0) - 65, r = +m[4] - 1;
          if (!m[1]) c += dc; if (!m[3]) r += dr;
          if (c < 0 || r < 0 || c > 25) out += '#BEZUG!';
          else out += m[1] + String.fromCharCode(65 + c) + m[3] + (r + 1);
          i += m[0].length; continue;
        }
      }
      out += ch; i++;
    }
    return out;
  }
  // Bezüge in einer Formel finden (für farbige Markierung)
  function refsIn(src) {
    if (typeof src !== 'string' || !src.trim().startsWith('=')) return [];
    let toks; try { toks = tokenize(src.trim().slice(1)); } catch (e) { return []; }
    const off = src.indexOf('=') + 1, out = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.k !== 'ref') continue;
      if (toks[i + 1] && toks[i + 1].k === 'op' && toks[i + 1].v === ':' && toks[i + 2] && toks[i + 2].k === 'ref') {
        const b = toks[i + 2];
        out.push({ start: off + t.pos, end: off + b.pos + b.len, cells: rangeCells(addr(t.r, t.c) + ':' + addr(b.r, b.c)) });
        i += 2;
      } else out.push({ start: off + t.pos, end: off + t.pos + t.len, cells: [addr(t.r, t.c)] });
    }
    return out;
  }
  function display(v, fmt) {
    if (v === null || v === undefined) return '';
    if (isErr(v)) return v.err;
    if (typeof v === 'boolean') return v ? 'WAHR' : 'FALSCH';
    if (typeof v === 'number') {
      if (fmt === 'eur') return fmtNum(v, 2).replace(/\B(?=(\d{3})+(?!\d))/, '.') + ' €';
      if (fmt === 'pct') return fmtNum(round(v * 100, 2)) + ' %';
      if (fmt === 'd1') return fmtNum(v, 1);
      if (fmt === 'd2') return fmtNum(v, 2);
      if (fmt === 'int') return fmtNum(Math.round(v));
      return fmtNum(v);
    }
    return String(v);
  }
  // Bezug als Text, mit $-Zeichen, z. B. „$C$1“
  const refText = t => (t.ac ? '$' : '') + colName(t.c) + (t.ar ? '$' : '') + (t.r + 1);
  return { refText, tokenize, Sheet, parse, shiftFormula, refsIn, display, isErr, addr, parseAddr, rangeCells, colName, fmtNum };
})();
export default CalcEngine;
