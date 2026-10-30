/* FlowPad-Adapter für die Informatik-9-Lernpfade.
 * Außerhalb von FlowPad (z. B. als Datei in Moodle) ändert sich nichts.
 * In FlowPad werden die eingebauten Mini-Tabellen und DFD-Baukästen durch Karten ersetzt,
 * die links in FlowPad die Tabelle laden bzw. die Diagramm-Aufgabe stellen und das Ergebnis zurückbekommen.
 * Wird von tools/adapt-lernpfad.mjs in den Lernpfad eingesetzt. */
(function () {
  if (!(window.FlowPad && window.FlowPad.inside) || !window.LP || typeof CalcEngine === 'undefined') return;
  var LP = window.LP, E = CalcEngine, FP = window.FlowPad;
  var KEY = 'inf9-' + (LP.key || 'lp') + '-flowpad';
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var plain = function (h) { var d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
  var done = {}; try { done = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { }
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) { } };
  var GORI = '<svg class="fpa-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="4" fill="#ffe135"/><rect x="5" y="6" width="6" height="4" fill="#fff" stroke="#0f1a2b" stroke-width="1.4"/><rect x="13" y="6" width="6" height="4" fill="#fff" stroke="#0f1a2b" stroke-width="1.4"/><ellipse cx="12" cy="15" rx="4.5" ry="2.4" fill="#1f8f55" stroke="#0f1a2b" stroke-width="1.4"/></svg>';

  var css = document.createElement('style');
  css.textContent = '.fpa-ico{width:22px;height:22px;flex:none;vertical-align:-5px;margin-right:6px}'
    + '.fpa-body{padding:12px 14px;display:grid;gap:8px}.fpa-body p{margin:0}'
    + '.fpa-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'
    + '.fpa-note{font-size:.9em;color:var(--ink-2)}'
    + '.fbtn.fpa-go{background:#ffe135;border-color:#e8b800;color:#2b2300}'
    + '.calc.fpa, .dfd.fpa{margin:18px 0 22px}'
    + '.fpa .fpa-state{margin-left:auto;font-weight:700;font-size:.9em}'
    + '.fpa.solved .fpa-state::after{content:"✓ geschafft";color:var(--good)}'
    + '.fpa-mini{font:13px/1.3 var(--font-code,monospace);border-collapse:collapse;margin-top:2px}'
    + '.fpa-mini td,.fpa-mini th{border:1px solid var(--line);padding:2px 6px;white-space:nowrap}.fpa-mini th{background:var(--surface-2);color:var(--ink-2);font-weight:600}';
  document.head.appendChild(css);

  // ---------- Mini-Tabellen → Tabelle in FlowPad ----------
  var expand = function (list) { var out = []; (list || []).forEach(function (r) { E.rangeCells(r).forEach(function (a) { out.push(a); }); }); return out; };
  function evalRule(rule, raw, R, C) {
    var norm = function (s) { return String(s || '').replace(/\s+/g, '').toUpperCase(); };
    var sheet = new E.Sheet(R, C, raw);
    if (rule.test) {
      var s2 = new E.Sheet(R, C, Object.assign({}, raw, rule.test.set)), v0 = s2.value(rule.test.cell);
      if (rule.test.text !== undefined) return E.display(v0).toLowerCase() === String(rule.test.text).toLowerCase();
      return typeof v0 === 'number' && Math.abs(v0 - rule.test.eq) < 1e-6;
    }
    var cells = rule.cells ? E.rangeCells(rule.cells) : [rule.cell];
    return cells.every(function (a) {
      var r = sheet.get(a), v = sheet.value(a);
      if (rule.formula && !sheet.isFormula(a)) return false;
      if (rule.has && norm(r).indexOf(norm(rule.has)) < 0) return false;
      if (rule.not && norm(r).indexOf(norm(rule.not)) >= 0) return false;
      if (rule.eq !== undefined && !(typeof v === 'number' && Math.abs(v - rule.eq) < 1e-6)) return false;
      if (rule.text !== undefined && E.display(v).toLowerCase() !== String(rule.text).toLowerCase()) return false;
      if (rule.noerr && E.isErr(v)) return false;
      return true;
    });
  }
  function miniTable(cfg) {
    var R = Math.min(cfg.rows, 4), C = Math.min(cfg.cols, 6), sh = new E.Sheet(cfg.rows, cfg.cols, cfg.cells || {});
    var h = '<table class="fpa-mini"><tr><th></th>';
    for (var c = 0; c < C; c++) h += '<th>' + E.colName(c) + '</th>';
    h += '</tr>';
    for (var r = 0; r < R; r++) { h += '<tr><th>' + (r + 1) + '</th>'; for (c = 0; c < C; c++) h += '<td>' + esc(E.display(sh.value(E.addr(r, c)))) + '</td>'; h += '</tr>'; }
    return h + '</table>';
  }
  document.querySelectorAll('.calc[data-calc]').forEach(function (el) {
    var id = el.dataset.calc, cfg = (LP.calcs || {})[id]; if (!cfg) return;
    var sid = (LP.key || 'lp') + ':' + id, canCheck = !!(cfg.check && cfg.check.length);
    el.classList.add('fpa');
    el.innerHTML = '<div class="calc-title">' + esc(cfg.title || 'Tabellenblatt') + '</div>'
      + '<div class="fpa-body">' + (cfg.hint ? '<p>' + cfg.hint + '</p>' : '')
      + miniTable(cfg)
      + '<div class="fpa-row"><button type="button" class="fbtn fpa-go" data-a="load">' + GORI + 'Tabelle links in FlowPad laden</button>'
      + (canCheck ? '<button type="button" class="fbtn primary" data-a="check">Prüfen</button>' : '')
      + '<span class="fpa-state"></span></div>'
      + '<p class="fpa-note">Du arbeitest links in der Tabelle von FlowPad. ' + (canCheck ? 'Mit <b>Prüfen</b> schaut der Lernpfad nach, ob alles stimmt.' : 'Probiere dort alles aus.') + ' Tipp: Mit <b>Formel → DFD</b> siehst du zu jeder Formel das Datenflussdiagramm.</p></div>'
      + '<div class="calc-foot"><div class="calc-msg" aria-live="polite"></div></div>';
    var msg = el.querySelector('.calc-msg');
    var say = function (t, cls) { msg.className = 'calc-msg' + (cls ? ' ' + cls : ''); msg.innerHTML = t; };
    if (done[sid]) el.classList.add('solved');
    el.querySelector('[data-a=load]').addEventListener('click', function () {
      FP.sheet({ id: sid, title: cfg.title, cells: cfg.cells || {}, rows: cfg.rows, cols: cfg.cols, widths: cfg.widths, styles: cfg.styles, fmt: cfg.fmt, edit: cfg.edit, select: cfg.start, show: true });
      say('Die Tabelle steht jetzt links in FlowPad – oben als eigener Reiter.');
    });
    var chk = el.querySelector('[data-a=check]');
    if (chk) chk.addEventListener('click', function () {
      FP.getSheet(sid).then(function (s) {
        if (s.id !== sid) { say('Lade zuerst die Tabelle „' + esc(cfg.title) + '“ (gelber Knopf). Sie öffnet sich links als eigener Reiter.', 'bad'); return; }
        for (var i = 0; i < cfg.check.length; i++) {
          var rule = cfg.check[i];
          if (!evalRule(rule, s.cells, cfg.rows, cfg.cols)) {
            var t = rule.msg || 'Noch nicht ganz. Prüfe deine Formeln.';
            say('✗ ' + t, 'bad'); el.classList.remove('solved'); FP.say('✗ ' + plain(t), false); return;
          }
        }
        done[sid] = 1; save(); el.classList.add('solved');
        say('✓ ' + (cfg.ok || 'Stark! Alles richtig.'), 'good'); FP.say('✓ ' + plain(cfg.ok || 'Alles richtig.'), true);
      }).catch(function () { say('FlowPad hat nicht geantwortet. Lade die Seite neu.', 'bad'); });
    });
  });

  // ---------- DFD-Baukästen → Diagramm-Aufgabe in FlowPad ----------
  var isCell = function (s) { return /^\$?[A-Za-z]\$?\d+$/.test(String(s || '')); };
  function sheetFor(t) {
    // Eingabezellen mit Beispielwerten (aus den Tests) und Beschriftungen, dazu die Zelle für die Ausgabe
    var cells = {}, used = {}, first = null, maxR = 0, maxC = 0, sample = (t.tests && t.tests[0]) || {}, n = 0;
    var vals = ['12', '8', '15', '9', '20', '5', '11', '7'];
    (t.inputs || []).forEach(function (inp) {
      E.rangeCells(inp.ref.replace(/\$/g, '')).forEach(function (a) {
        cells[a] = sample[a] !== undefined ? String(sample[a]) : vals[n++ % vals.length]; used[a] = 1;
        var p = E.parseAddr(a); maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); if (!first) first = p;
      });
    });
    var label = function (a, text) {
      var p = E.parseAddr(a); if (!text || text === a) return;
      var up = p.r > 0 ? E.addr(p.r - 1, p.c) : null, left = p.c > 0 ? E.addr(p.r, p.c - 1) : null;
      if (up && !used[up] && !cells[up]) { cells[up] = text; used[up] = 1; }
      else if (left && !used[left] && !cells[left]) { cells[left] = text; used[left] = 1; }
    };
    (t.inputs || []).forEach(function (inp) { if (inp.label !== inp.ref) label(inp.ref.split(':')[0].replace(/\$/g, ''), inp.label); });
    var out;
    if (isCell(t.output)) out = t.output.replace(/\$/g, '').toUpperCase();
    else {
      first = first || { r: 1, c: 1 };
      out = E.addr(maxR + 1, first.c);
      if (cells[out]) out = E.addr(first.r, maxC + 1);
      label(out, t.output);
    }
    return { cells: cells, out: out };
  }
  document.querySelectorAll('[data-dfd]').forEach(function (el) {
    var id = el.dataset.dfd, t = (LP.dfd || {})[id]; if (!t || !t.term) return;
    var sid = (LP.key || 'lp') + ':dfd:' + id, s = sheetFor(t), tries = 0;
    el.classList.add('fpa');
    el.innerHTML = (t.title ? '<div class="dfd-title">' + esc(t.title) + '</div>' : '')
      + (t.prompt ? '<div class="dfd-prompt">' + t.prompt + '</div>' : '')
      + '<div class="fpa-body"><div class="fpa-row"><button type="button" class="fbtn fpa-go" data-a="task">' + GORI + 'Diagramm links in FlowPad bauen</button>'
      + '<button type="button" class="fbtn" data-a="solve" hidden>Lösung zeigen</button><span class="fpa-state"></span></div>'
      + '<p class="fpa-note">FlowPad legt dafür eine kleine Tabelle an. Baue das Diagramm für <b>' + esc(s.out) + '</b>, dann <b>Prüfen</b> – das Ergebnis erscheint auch hier.</p></div>'
      + '<div class="dfd-foot"><div class="dfd-msg" aria-live="polite"></div></div>';
    var msg = el.querySelector('.dfd-msg'), solve = el.querySelector('[data-a=solve]');
    var say = function (h, cls) { msg.className = 'dfd-msg' + (cls ? ' ' + cls : ''); msg.innerHTML = h; };
    if (done[sid]) el.classList.add('solved');
    el.querySelector('[data-a=task]').addEventListener('click', function () {
      FP.task({ cell: s.out, id: sid, target: t.term, title: t.title, prompt: t.prompt, mode: 'diagramm', dfd: 'leer', tests: t.tests,
        cells: s.cells, sheetTitle: t.title, rows: 12, cols: 8 });
      say('Die Aufgabe steht links in FlowPad. Baue das Diagramm für <b>' + esc(s.out) + '</b>.');
    });
    solve.addEventListener('click', function () { FP.send('dfd', { cell: s.out, term: t.term }); say('Links siehst du eine mögliche Lösung. Vergleiche mit deinem Diagramm und baue es danach noch einmal selbst.'); });
    FP.onResult(function (r) {
      if (r.task !== sid) return;
      if (r.ok) { done[sid] = 1; save(); el.classList.add('solved'); say('✓ Richtig! Dein Diagramm rechnet wie <code>' + esc(t.term) + '</code>.', 'good'); }
      else { tries++; if (tries >= 2) solve.hidden = false; say('✗ Noch nicht – die Rückmeldung steht links unter dem Diagramm.', 'bad'); }
    });
  });

  // ---------- Excel-Vorlagen: zusätzlich direkt in FlowPad öffnen ----------
  document.querySelectorAll('.dl[data-file]').forEach(function (box) {
    var name = box.dataset.file, b64 = (LP.files || {})[name], head = box.querySelector('.dl-head'); if (!b64 || !head) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'fbtn fpa-go'; b.innerHTML = GORI + 'In FlowPad öffnen';
    b.addEventListener('click', function () { FP.send('xlsx', { name: name, data: b64, id: (LP.key || 'lp') + ':file:' + name }); });
    head.appendChild(b);
  });
})();
