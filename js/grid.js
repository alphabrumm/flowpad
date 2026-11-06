/*
 * FlowPad – Tabellenblatt (aus der Mini-Tabellenkalkulation der Lernpfade, Informatik 9).
 * Bedienung per Fingertipp: Zelle antippen, oben in der Eingabezeile schreiben, ✓ oder Return.
 * Beim Schreiben einer Formel fügt das Antippen einer Zelle deren Adresse ein („Zeigen“).
 */
import E from './engine.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const expand = list => { const out = new Set(); (list || []).forEach(r => { try { E.rangeCells(r).forEach(a => out.add(a)); } catch (e) { } }); return out; };
const expandMap = obj => { const out = {}; Object.entries(obj || {}).forEach(([r, v]) => { try { E.rangeCells(r).forEach(a => out[a] = v); } catch (e) { } }); return out; };

/**
 * host: {
 *   getSheet() → { rows, cols, cells, fmt?, styles?, widths?, edit? }
 *   commit(addr, raw)  – Inhalt einer Zelle ändern (host speichert, rechnet, ruft render())
 *   setMany(map)       – mehrere Zellen auf einmal (Ausfüllen, Einfügen)
 *   onSelect(addr)
 * }
 */
export function Grid(root, host) {
    let sheet, R, C, style = {}, fmt = {}, editable = null, tds = {};
    let lastTap = { a: null, t: 0 };
    let sel = 'A1', showF = false, clip = null, editing = false, justPointed = false, justPicked = false;
    let pick = null;            // { done(ref), a, b } – Zelle für das Diagramm wählen
    let marks = new Set(), hot = new Set();

    root.classList.add('grid');
    root.innerHTML = `
      <div class="calc-fx"><span class="calc-name" aria-label="Zelladresse"></span><button type="button" class="calc-fxbtn" title="Handbuch der Funktionen" aria-label="Handbuch der Funktionen öffnen">fx</button>
        <input class="calc-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Inhalt der Zelle">
        <button class="calc-clear" type="button" title="Inhalt der Zelle löschen" aria-label="Inhalt der Zelle löschen">✕</button>
        <button class="calc-ok" type="button" aria-label="Eingabe übernehmen">✓</button></div>
      <div class="calc-keybar">
        <div class="calc-keys">${['=', '$', ';', ':', '(', ')', '+', '-', '*', '/', '"', '<', '>'].map(k => `<button type="button" data-ins="${esc(k)}">${esc(k)}</button>`).join('')}</div>
        <div class="calc-tools">
          <button type="button" class="calc-tool" data-act="copy" title="Kopieren" aria-label="Kopieren"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg></button>
          <button type="button" class="calc-tool" data-act="paste" disabled title="Einfügen" aria-label="Einfügen"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2"/><path d="M9 12h6M9 16h4"/></svg></button>
          <button type="button" class="calc-tool" data-act="filldown" title="Nach unten ausfüllen" aria-label="Nach unten ausfüllen"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="6" rx="1.5"/><path d="M12 11v9"/><path d="M8 16l4 4 4-4"/></svg></button>
          <button type="button" class="calc-tool" data-act="fillright" title="Nach rechts ausfüllen" aria-label="Nach rechts ausfüllen"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="6" height="12" rx="1.5"/><path d="M11 12h9"/><path d="M16 8l4 4-4 4"/></svg></button>
          <button type="button" class="calc-tool" data-act="formulas" aria-pressed="false" title="Formeln zeigen" aria-label="Formeln zeigen"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><path d="M9.5 10.5h5M9.5 13.5h5"/></svg></button>
        </div>
      </div>
      <div class="calc-pick" hidden><span></span><button type="button" class="fbtn" data-act="pickcancel">Abbrechen</button></div>
      <div class="calc-preview" aria-live="polite"></div>
      <div class="calc-scroll"><table></table></div>`;
    const input = root.querySelector('.calc-input'), nameBox = root.querySelector('.calc-name'), prev = root.querySelector('.calc-preview');
    const table = root.querySelector('table'), pickBar = root.querySelector('.calc-pick'), scroller = root.querySelector('.calc-scroll');
    let sayTimer = null;
    function say(t, cls) {
        prev.innerHTML = `<span class="calc-say ${cls || ''}">${t}</span>`;
        clearTimeout(sayTimer); sayTimer = setTimeout(() => showRefs(editing ? input.value : sheet.get(sel)), 6000);
    }

    function build() {
        const s = host.getSheet();
        R = s.rows; C = s.cols;
        sheet = new E.Sheet(R, C, s.cells);
        style = expandMap(s.styles); fmt = expandMap(s.fmt); editable = s.edit ? expand(s.edit) : null;
        table.innerHTML = `<thead><tr><th class="corner"></th>${Array.from({ length: C }, (_, c) => `<th data-col="${c}">${E.colName(c)}</th>`).join('')}</tr></thead>
        <tbody>${Array.from({ length: R }, (_, r) => `<tr><th data-row="${r}">${r + 1}</th>${Array.from({ length: C }, (_, c) => {
            const a = E.addr(r, c), w = s.widths && s.widths[E.colName(c)];
            return `<td data-a="${a}"${w ? ` style="min-width:${w}px;max-width:${w}px"` : ''}></td>`;
        }).join('')}</tr>`).join('')}</tbody>`;
        tds = {}; table.querySelectorAll('td').forEach(td => tds[td.dataset.a] = td);
        if (!tds[sel]) sel = 'A1';
    }
    const canEdit = a => !editable || editable.has(a);

    function colored(src) {
        const refs = E.refsIn(src); if (!refs.length) return esc(src);
        let out = '', p = 0;
        refs.forEach((rf, i) => { out += esc(src.slice(p, rf.start)) + `<span class="rf c${i % 6}">${esc(src.slice(rf.start, rf.end))}</span>`; p = rf.end; });
        return out + esc(src.slice(p));
    }
    function render() {
        for (const a in tds) {
            const td = tds[a], raw = sheet.get(a), v = sheet.value(a), isF = sheet.isFormula(a);
            td.className = '';
            if (style[a]) td.classList.add(style[a]);
            if (!canEdit(a)) td.classList.add('lock');
            if (marks.has(a)) td.classList.add('has-dfd');
            if (hot.has(a)) td.classList.add('hot');
            if (showF && isF) { td.textContent = raw; td.classList.add('fx'); }
            else {
                td.textContent = E.display(v, fmt[a]);
                if (typeof v === 'number') td.classList.add('num');
                if (E.isErr(v)) td.classList.add('err');
            }
        }
        if (clip) tds[clip.a] && tds[clip.a].classList.add('copysrc');
        if (pick && pick.a) E.rangeCells(pick.a + ':' + (pick.b || pick.a)).forEach(a => tds[a] && tds[a].classList.add('picked'));
        const td = tds[sel]; if (td) td.classList.add('sel');
        table.querySelectorAll('th.hl').forEach(th => th.classList.remove('hl'));
        const p = E.parseAddr(sel);
        if (p) { const h = table.querySelector(`th[data-col="${p.c}"]`), v = table.querySelector(`th[data-row="${p.r}"]`); h && h.classList.add('hl'); v && v.classList.add('hl'); }
        showRefs(editing ? input.value : sheet.get(sel));
        root.querySelector('[data-act=paste]').disabled = !clip;
    }
    function showRefs(src) {
        Object.values(tds).forEach(td => td.classList.remove('rf0', 'rf1', 'rf2', 'rf3', 'rf4', 'rf5'));
        if (typeof src === 'string' && src.trim().startsWith('=')) {
            E.refsIn(src).forEach((rf, i) => rf.cells.forEach(a => tds[a] && tds[a].classList.add('rf' + (i % 6))));
            const v = editing ? null : sheet.value(sel);
            prev.innerHTML = `<b>${sel}</b>: ${colored(src)}${v !== null && v !== undefined ? ` <span>→ <b>${esc(E.display(v, fmt[sel]))}</b></span>` : ''}`;
        } else prev.innerHTML = sheet.get(sel) !== undefined ? `<b>${sel}</b>: ${esc(sheet.get(sel))}` : `<b>${sel}</b>: <i>leer</i>`;
    }
    function select(a, quiet) {
        sel = a; editing = false;
        nameBox.textContent = a;
        const raw = sheet.get(a);
        input.value = raw === undefined ? '' : String(raw);
        input.disabled = !canEdit(a);
        input.placeholder = canEdit(a) ? 'Inhalt oder =Formel eingeben' : 'Diese Zelle ist gesperrt';
        render();
        reveal(tds[a]);
        if (!quiet && host.onSelect) host.onSelect(a);
    }
    /** Zelle sichtbar machen – nur die Tabelle scrollt (scrollIntoView würde auch die Seite verschieben) */
    function reveal(td) {
        if (!td) return;
        const sr = scroller.getBoundingClientRect(), tr = td.getBoundingClientRect();
        const headH = table.tHead ? table.tHead.getBoundingClientRect().height : 0, rowW = table.querySelector('tbody th')?.getBoundingClientRect().width || 0;
        if (tr.top < sr.top + headH) scroller.scrollTop -= sr.top + headH - tr.top; else if (tr.bottom > sr.bottom) scroller.scrollTop += tr.bottom - sr.bottom;
        if (tr.left < sr.left + rowW) scroller.scrollLeft -= sr.left + rowW - tr.left; else if (tr.right > sr.right) scroller.scrollLeft += tr.right - sr.right;
    }
    function commit(move) {
        if (!canEdit(sel)) return;
        let v = input.value;
        if (v.trim() === '') v = '';
        editing = false;
        const a = sel;
        if (String(sheet.get(a) ?? '') !== v) host.commit(a, v);
        if (move) { const p = E.parseAddr(a); if (p.r + 1 < R) { select(E.addr(p.r + 1, p.c)); return; } }
        select(a, true);
        if (/^\s+=/.test(v)) say('Achtung: Vor dem = steht ein Leerzeichen. Dann ist es keine Formel, sondern Text.', 'bad');
    }
    function pointable() {
        if (document.activeElement !== input) return false;
        const v = input.value, pos = input.selectionStart ?? v.length;
        return v.trim().startsWith('=') && /[=+\-*\/^(;:<>&]\s*$/.test(v.slice(0, pos));
    }
    function insertAt(txt) {
        const v = input.value, s = input.selectionStart ?? v.length, e = input.selectionEnd ?? v.length;
        input.value = v.slice(0, s) + txt + v.slice(e);
        const np = s + txt.length;
        try { input.setSelectionRange(np, np); } catch (err) { }
        editing = true; showRefs(input.value);
    }

    // ---------- Auswahl für das Diagramm (Zelle oder Bereich) ----------
    const tdAt = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); return el && el.closest && el.closest('td[data-a]'); };
    function finishPick() {
        if (!pick || !pick.a) return;
        const p = pick; pick = null; justPicked = true; setTimeout(() => justPicked = false, 400); root.classList.remove('picking'); pickBar.hidden = true;
        let ref = p.a;
        if (p.b && p.b !== p.a) { const A = E.parseAddr(p.a), B = E.parseAddr(p.b); ref = E.addr(Math.min(A.r, B.r), Math.min(A.c, B.c)) + ':' + E.addr(Math.max(A.r, B.r), Math.max(A.c, B.c)); }
        render(); p.done(ref);
    }
    // Zeigen beim Formelschreiben: Erst beim Loslassen einsetzen – und nur, wenn der Finger nicht gescrollt hat
    let point = null;
    const dropPoint = () => { point = null; };
    const dropTouchPick = () => { if (pick && pick.t) { clearTimeout(pick.t.timer); if (pick.t.drag) { pick.a = null; pick.b = null; render(); } pick.t = null; } };
    // Während ein Bereich gezogen wird, darf die Tabelle nicht scrollen
    scroller.addEventListener('touchmove', ev => { if (pick && pick.t && pick.t.drag) ev.preventDefault(); }, { passive: false });
    table.addEventListener('pointerdown', ev => {
        const td = ev.target.closest('td'); if (!td) return;
        if (pick) {
            // Maus: sofort wählen und ziehen. Finger: Tippen erst beim Loslassen an derselben Stelle,
            // Wischen scrollt, kurz Halten und dann Ziehen wählt einen Bereich.
            if (ev.pointerType === 'mouse') { ev.preventDefault(); pick.a = td.dataset.a; pick.b = null; pick.pid = ev.pointerId; pick.t = null; try { table.setPointerCapture(ev.pointerId); } catch (e) { } render(); return; }
            dropTouchPick();
            const t = pick.t = { a: td.dataset.a, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, st: scroller.scrollTop, sl: scroller.scrollLeft, drag: false };
            t.timer = setTimeout(() => { if (pick && pick.t === t) { t.drag = true; pick.a = t.a; pick.b = null; pick.pid = t.pid; try { navigator.vibrate && navigator.vibrate(15); } catch (e) { } render(); } }, 380);
            return;
        }
        point = pointable() ? { a: td.dataset.a, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, st: scroller.scrollTop, sl: scroller.scrollLeft,
            s: input.selectionStart, e: input.selectionEnd } : null;
    });
    table.addEventListener('pointermove', ev => {
        if (point && ev.pointerId === point.pid && Math.hypot(ev.clientX - point.x, ev.clientY - point.y) > 8) dropPoint();
        if (pick && pick.t && ev.pointerId === pick.t.pid && !pick.t.drag) { if (Math.hypot(ev.clientX - pick.t.x, ev.clientY - pick.t.y) > 8) dropTouchPick(); return; }
        if (!pick || !pick.a || ev.pointerId !== pick.pid) return;
        const td = tdAt(ev); if (td && td.dataset.a !== (pick.b || pick.a)) { pick.b = td.dataset.a; render(); }
    });
    scroller.addEventListener('scroll', () => {
        if (point && (Math.abs(scroller.scrollTop - point.st) > 2 || Math.abs(scroller.scrollLeft - point.sl) > 2)) dropPoint();
        if (pick && pick.t && !pick.t.drag && (Math.abs(scroller.scrollTop - pick.t.st) > 2 || Math.abs(scroller.scrollLeft - pick.t.sl) > 2)) dropTouchPick();
    }, { passive: true });
    table.addEventListener('pointercancel', ev => { dropPoint(); if (pick && pick.t && ev.pointerId === pick.t.pid) dropTouchPick(); });
    table.addEventListener('pointerup', ev => {
        if (pick && pick.t && ev.pointerId === pick.t.pid) {
            const t = pick.t; clearTimeout(t.timer); pick.t = null; ev.preventDefault();
            if (t.drag) { finishPick(); return; }
            const td = tdAt(ev);
            if (td && td.dataset.a === t.a && Math.hypot(ev.clientX - t.x, ev.clientY - t.y) <= 8) { pick.a = t.a; pick.b = null; finishPick(); }
            return;
        }
        if (pick && pick.a && ev.pointerId === pick.pid) { ev.preventDefault(); finishPick(); return; }
        if (!point || ev.pointerId !== point.pid) return;
        const p = point; point = null;
        const td = ev.target.closest && ev.target.closest('td');
        if (!td || td.dataset.a !== p.a) return;
        ev.preventDefault();
        try { input.focus({ preventScroll: true }); if (p.s != null) input.setSelectionRange(p.s, p.e); } catch (e) { }
        insertAt(p.a); justPointed = true; setTimeout(() => { justPointed = false; }, 600);
    });
    table.addEventListener('mousedown', ev => { if (justPointed || point || pointable() || pick) ev.preventDefault(); });
    table.addEventListener('click', ev => {
        const td = ev.target.closest('td'); if (!td || pick) return;
        if (justPicked) { justPicked = false; return; }
        if (justPointed) { justPointed = false; try { input.focus({ preventScroll: true }); } catch (e) { } return; }
        // Doppeltippen: Eingabezeile mit Schreibmarke am Ende, sofort losschreiben (Fokus im selben Tipp, sonst blockt iOS die Tastatur)
        const now = Date.now(), dbl = lastTap.a === td.dataset.a && now - lastTap.t < 450;
        lastTap = dbl ? { a: null, t: 0 } : { a: td.dataset.a, t: now };
        if (dbl && sel === td.dataset.a && !input.disabled) {
            try { input.focus({ preventScroll: true }); const n = input.value.length; input.setSelectionRange(n, n); } catch (e) { }
            return;
        }
        if (editing) commit(false);
        select(td.dataset.a);
    });
    root.querySelector('[data-act=pickcancel]').addEventListener('click', () => { dropTouchPick(); pick = null; root.classList.remove('picking'); pickBar.hidden = true; render(); });

    root.querySelector('.calc-fxbtn').addEventListener('click', () => host.onFx && host.onFx());
    input.addEventListener('input', () => { editing = true; showRefs(input.value); });
    input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(true); } if (ev.key === 'Escape') select(sel, true); });
    root.querySelector('.calc-ok').addEventListener('click', () => commit(false));
    root.querySelector('.calc-clear').addEventListener('click', () => {
        if (!canEdit(sel)) { say('Diese Zelle ist gesperrt.', 'bad'); return; }
        editing = false; input.value = '';
        if (sheet.get(sel) !== undefined) host.commit(sel, '');
        select(sel, true);
    });
    root.querySelectorAll('[data-ins]').forEach(b => {
        b.addEventListener('pointerdown', ev => ev.preventDefault());
        b.addEventListener('mousedown', ev => ev.preventDefault());
        b.addEventListener('click', () => { if (input.disabled) return; if (document.activeElement !== input) input.focus(); insertAt(b.dataset.ins); });
    });
    root.querySelectorAll('.calc-tools [data-act]').forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (editing && act !== 'formulas') commit(false);
        if (act === 'copy') { clip = { a: sel, raw: sheet.get(sel) }; say(`<b>${sel}</b> kopiert. Wähle die Zielzelle und tippe auf <b>Einfügen</b>.`); render(); }
        if (act === 'paste' && clip) {
            if (!canEdit(sel)) { say('In diese Zelle kannst du nichts einfügen.', 'bad'); return; }
            const p = E.parseAddr(sel), q = E.parseAddr(clip.a);
            const nr = E.shiftFormula(clip.raw, p.r - q.r, p.c - q.c);
            host.setMany({ [sel]: nr === undefined ? '' : nr }); select(sel, true);
            say(sheet.isFormula(sel) ? `Eingefügt in <b>${sel}</b>: <code>${esc(nr)}</code>` : `Eingefügt in <b>${sel}</b>.`);
        }
        if (act === 'filldown' || act === 'fillright') {
            const p = E.parseAddr(sel), src = sheet.get(sel);
            if (src === undefined) { say('Wähle zuerst eine Zelle mit Inhalt (meist eine Formel).', 'bad'); return; }
            // bis zur letzten Zeile/Spalte mit Daten daneben ausfüllen
            const lim = act === 'filldown' ? lastFilled(p, 'down') : lastFilled(p, 'right');
            const map = {}; let n = 0;
            for (let k = 1; k <= lim; k++) {
                const r = act === 'filldown' ? p.r + k : p.r, c = act === 'fillright' ? p.c + k : p.c;
                const a = E.addr(r, c); if (!canEdit(a)) break;
                map[a] = E.shiftFormula(src, r - p.r, c - p.c); n++;
            }
            if (n) host.setMany(map);
            select(sel, true);
            say(n ? `Formel aus <b>${sel}</b> in ${n} Zelle${n > 1 ? 'n' : ''} ${act === 'filldown' ? 'darunter' : 'rechts daneben'} kopiert. Tippe die Zellen an und vergleiche die Bezüge!` : 'Hier ist kein Platz zum Ausfüllen.', n ? '' : 'bad');
        }
        if (act === 'formulas') { showF = !showF; b.setAttribute('aria-pressed', String(showF)); b.title = showF ? 'Werte zeigen' : 'Formeln zeigen'; b.setAttribute('aria-label', b.title); render(); }
    }));
    /** Wie weit ausfüllen? Bis zur letzten Zeile (Spalte), in der links (oben) daneben noch etwas steht – sonst bis zum Rand. */
    function lastFilled(p, dir) {
        let last = 0;
        if (dir === 'down') { for (let r = p.r + 1; r < R; r++) for (let c = 0; c < C; c++) if (c !== p.c && sheet.get(E.addr(r, c)) !== undefined) { last = r - p.r; break; } }
        else { for (let c = p.c + 1; c < C; c++) for (let r = 0; r < R; r++) if (r !== p.r && sheet.get(E.addr(r, c)) !== undefined) { last = c - p.c; break; } }
        return last || (dir === 'down' ? R - 1 - p.r : C - 1 - p.c);
    }

    return {
        rebuild() { build(); scroller.scrollTop = 0; scroller.scrollLeft = 0; select(sel, true); },
        /** nach Änderungen von außen (Diagramm → Zelle, Rückgängig …) neu rechnen und zeichnen */
        refresh() { const s = host.getSheet(); sheet = new E.Sheet(R, C, s.cells); if (s.rows !== R || s.cols !== C) { build(); } select(sel, true); },
        select: a => select(a),
        get selected() { return sel; },
        setMarks(set) { marks = set; render(); },
        setHot(cells) { hot = new Set(cells || []); render(); },
        startPick(done, text) {
            if (editing) commit(false);
            pick = { done }; root.classList.add('picking'); pickBar.hidden = false;
            pickBar.querySelector('span').innerHTML = text || 'Zelle antippen';
            render();
        },
        cancelPick() { if (pick) { dropTouchPick(); pick = null; root.classList.remove('picking'); pickBar.hidden = true; render(); } },
        say,
        value: a => sheet.value(a),
        /** Text an der Schreibmarke einfügen (Handbuch); leere Zelle bekommt zuerst ein = */
        insertText(txt) {
            if (input.disabled) { say('Diese Zelle ist gesperrt – wähle eine andere Zelle.', 'bad'); return; }
            if (!input.value.trim()) { input.value = '='; try { input.setSelectionRange(1, 1); } catch (e) { } }
            input.focus(); insertAt(txt);
        },
    };
}
