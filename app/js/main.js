/*
 * FlowPad – Tabellenkalkulation und Datenflussdiagramme lernen, am iPad, ohne Login, ohne Server.
 * Links oben die Tabelle, links unten das Datenflussdiagramm (DFD) der gewählten Zelle, rechts der Lernpfad.
 */
import E from './engine.js';
import DFD from './dfd.js';
import { Grid } from './grid.js';
import * as Store from './store.js';
import { readLernpfadFile, loadLernpfadUrl, withBridge, titleOf, nameFromUrl } from './lernpfad.js';
import { normalizeCode, codeFormatError, resolveCode, codeOfUrl } from './flowcode.js';
import { sheetToXlsx, xlsxToSheet, isZip } from './zip.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pref = { get(k, d) { try { const v = localStorage.getItem('flowpad.' + k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('flowpad.' + k, v); } catch (e) { } } };

let project = null;          // aktuelles Projekt
let cell = 'A1';             // gewählte Zelle (für sie gilt das Diagramm)
let undo = [], redo = [], lastDfdUndo = 0, dfdBefore = null;

// ================= Dialoge =================
function dialog({ title, html, input, value, placeholder, buttons, wide }) {
    return new Promise(res => {
        const ov = document.createElement('div'); ov.className = 'fp-dialog-backdrop';
        ov.innerHTML = `<div class="fp-dialog${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><h3>${esc(title || '')}</h3>${html ? `<div class="fp-dialog-body">${html}</div>` : ''}
          ${input ? `<input class="fp-dialog-input" type="text" value="${esc(value || '')}" placeholder="${esc(placeholder || '')}" autocomplete="off" autocorrect="off" spellcheck="false">` : ''}
          <div class="fp-dialog-buttons">${(buttons || [{ label: 'OK', value: true, primary: true }]).map((b, i) => `<button type="button" data-i="${i}" class="btn${b.primary ? ' primary' : ''}${b.danger ? ' danger' : ''}">${esc(b.label)}</button>`).join('')}</div></div>`;
        document.body.appendChild(ov);
        const inp = ov.querySelector('input'), bs = buttons || [{ label: 'OK', value: true, primary: true }];
        const done = v => { ov.remove(); res(v); };
        ov.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const btn = bs[+b.dataset.i]; done(input ? (btn.value ? inp.value : null) : btn.value); });
        ov.addEventListener('click', e => { if (e.target === ov) done(input ? null : undefined); });
        if (inp) { setTimeout(() => { inp.focus(); inp.select(); }, 50); inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(inp.value); if (e.key === 'Escape') done(null); }); }
        ov.querySelector('[data-i]')?.focus?.();
    });
}
const confirmBox = (title, html, ok = 'OK', danger) => dialog({ title, html, buttons: [{ label: 'Abbrechen', value: false }, { label: ok, value: true, primary: !danger, danger }] });
const promptBox = (title, value, placeholder, html) => dialog({ title, html, input: true, value, placeholder, buttons: [{ label: 'Abbrechen', value: false }, { label: 'OK', value: true, primary: true }] });
const alertBox = (title, html) => dialog({ title, html });
let toastTimer;
function toast(text) { const t = $('#toast'); t.innerHTML = text; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }

// ================= Speichern =================
let saveTimer = null;
function touch(noUndoSnapshot) {
    project.modified = Date.now();
    clearTimeout(saveTimer);
    $('#saved').textContent = '…';
    saveTimer = setTimeout(async () => { saveTimer = null; try { await Store.putProject(project); $('#saved').textContent = 'gespeichert'; } catch (e) { $('#saved').textContent = 'nicht gespeichert!'; console.error(e); } }, 200);
}
/** Sofort speichern (beim Verlassen der Seite, App-Wechsel am iPad) */
function flushSave() { if (!saveTimer || !project) return; clearTimeout(saveTimer); saveTimer = null; Store.putProject(project).then(() => $('#saved').textContent = 'gespeichert').catch(() => { }); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
window.addEventListener('pagehide', flushSave);
function snapshot() { return JSON.stringify({ sheet: project.sheet, dfds: project.dfds }); }
function pushUndo() { undo.push(snapshot()); if (undo.length > 60) undo.shift(); redo = []; updateHist(); }
function restore(s) { const o = JSON.parse(s); project.sheet = o.sheet; project.dfds = o.dfds; grid.rebuild(); showCell(cell, true); touch(); }
function updateHist() { $('#btnUndo').disabled = !undo.length; $('#btnRedo').disabled = !redo.length; }

// ================= Tabelle =================
/** Name zu einer Zelle oder einem Bereich aus der Tabelle: Spaltenkopf (Zeile 1) oder Text links in derselben Zeile */
function labelOf(ref) {
    const first = String(ref).replace(/\$/g, '').split(':')[0], p = E.parseAddr(first);
    if (!p) return '';
    const sh = new E.Sheet(project.sheet.rows, project.sheet.cols, project.sheet.cells);
    const isText = a => { const v = sh.value(a); return typeof v === 'string' && v.trim() !== '' && !sh.isFormula(a); };
    const clean = s => String(s).trim().replace(/\s+/g, ' ').slice(0, 24);
    // Spaltenkopf: lückenlos nach oben gehen; steht oben über dem Block ein Text, ist das der Kopf
    for (let r = p.r - 1; r >= 0; r--) {
        const a = E.addr(r, p.c);
        if (sh.get(a) === undefined) break;
        if (isText(a)) return clean(sh.value(a));
    }
    // sonst: nächste Textzelle links daneben (Zeilenbeschriftung)
    for (let c = p.c - 1; c >= 0; c--) { const a = E.addr(p.r, c); if (isText(a)) return clean(sh.value(a)); }
    return '';
}
const grid = Grid($('#grid'), {
    getSheet: () => project.sheet,
    commit(a, raw) { pushUndo(); setCell(a, raw); afterSheetChange(); checkFormulaTask(a); },
    setMany(map) { pushUndo(); Object.entries(map).forEach(([a, v]) => setCell(a, v)); afterSheetChange(); },
    onSelect(a) { showCell(a); },
});
function setCell(a, raw) { if (raw === '' || raw === undefined || raw === null) delete project.sheet.cells[a]; else project.sheet.cells[a] = raw; }
function afterSheetChange() { grid.refresh(); updateCellInfo(); touch(); }

// ================= Diagramm =================
const editor = DFD.Editor($('#dfd'), {
    onChange(model) {
        // Das Modell ist schon geändert: für Rückgängig den Stand davor (dfdBefore) ablegen
        if (Date.now() - lastDfdUndo > 1500) {
            const dfds = Object.assign({}, project.dfds); if (dfdBefore) dfds[cell] = JSON.parse(dfdBefore); else delete dfds[cell];
            undo.push(JSON.stringify({ sheet: project.sheet, dfds })); if (undo.length > 60) undo.shift(); redo = []; updateHist();
        }
        lastDfdUndo = Date.now();
        dfdBefore = model.nodes.length ? JSON.stringify(model) : null;
        if (model.nodes.length) project.dfds[cell] = model; else delete project.dfds[cell];
        grid.setMarks(new Set(Object.keys(project.dfds)));
        touch();
    },
    labelOf,
    startPick(done, text) { if (layoutMode() !== 'wide') showView('tabelle'); grid.startPick(ref => { done(ref); if (layoutMode() !== 'wide') showView('diagramm'); }, text); },
    cancelPick: () => grid.cancelPick(),
});
function showCell(a, keepMsg) {
    cell = a;
    grid.cancelPick();
    const model = project.dfds[a] ? JSON.parse(JSON.stringify(project.dfds[a])) : { nodes: [], edges: [] };
    if (project.dfds[a]) project.dfds[a] = model;
    dfdBefore = project.dfds[a] ? JSON.stringify(model) : null; lastDfdUndo = 0;
    const raw = project.sheet.cells[a], isF = typeof raw === 'string' && raw.trim().startsWith('=');
    editor.setModel(model, {
        outRef: a,
        emptyHtml: isF ? `In <b>${esc(a)}</b> steht eine Formel. Tippe auf <b>Formel → DFD</b>, dann entsteht das Datenflussdiagramm.`
            : `Baue hier das Datenflussdiagramm für <b>${esc(a)}</b>: Bausteine oben antippen, verbinden, dann <b>DFD → Zelle</b>.`,
    });
    updateCellInfo();
    const t = project.tasks && project.tasks[a];
    if (!keepMsg) editor.say(t ? `<b>${esc(t.title || 'Aufgabe')}</b>${t.prompt ? ': ' + t.prompt : ''}` : '');
    grid.setHot([]);
}
function updateCellInfo() {
    const t = project.tasks && project.tasks[cell];
    $('#dfdCell').textContent = cell;
    const lab = labelOf(cell);
    $('#dfdCellName').textContent = lab ? lab : '';
    $('#dfdTask').hidden = !t;
    const raw = project.sheet.cells[cell];
    $('#btnToDfd').disabled = !(typeof raw === 'string' && raw.trim().startsWith('='));
}
function ctxFor(a) { return { raw: project.sheet.cells, rows: project.sheet.rows, cols: project.sheet.cols, cell: a, tests: project.tasks?.[a]?.tests }; }
function testText(res) {
    const s = Object.entries(res.set || {});
    return s.length ? 'Test mit ' + s.map(([c, v]) => `${c} = ${esc(v)}`).join(', ') : 'Mit den Werten der Tabelle';
}

$('#btnToDfd').addEventListener('click', async () => {
    const raw = project.sheet.cells[cell];
    if (!(typeof raw === 'string' && raw.trim().startsWith('='))) { editor.say(`In <b>${cell}</b> steht keine Formel.`, 'bad'); return; }
    const cur = editor.getModel();
    if (cur.nodes.length && !await confirmBox('Diagramm ersetzen?', `Für <b>${esc(cell)}</b> gibt es schon ein Diagramm. Soll es durch das Diagramm der Formel <code>${esc(raw)}</code> ersetzt werden?`, 'Ersetzen')) return;
    let model;
    try { model = DFD.fromTerm(raw, { labelOf, outRef: cell, output: labelOf(cell) }); }
    catch (e) { editor.say(`Die Formel <code>${esc(raw)}</code> enthält einen Fehler und lässt sich nicht als Diagramm zeichnen.`, 'bad'); return; }
    pushUndo(); lastDfdUndo = Date.now();
    project.dfds[cell] = model; touch();
    grid.setMarks(new Set(Object.keys(project.dfds)));
    editor.setModel(model, { outRef: cell }); dfdBefore = JSON.stringify(model);
    editor.say(`Das ist das Datenflussdiagramm zu <code>${esc(raw)}</code>. Lies es von oben (Eingaben) nach unten (Ausgabe).`, 'good');
    if (layoutMode() === 'narrow') showView('diagramm');
});
$('#btnToCell').addEventListener('click', () => {
    const f = editor.formula(), model = editor.getModel();
    const err = DFD.ruleCheck(model, f);
    if (f.err || f.missing || f.cyc) { editor.say('✗ ' + (err || f.err), 'bad'); return; }
    if (project.sheet.edit && !new Set(project.sheet.edit.flatMap(r => E.rangeCells(r))).has(cell)) { editor.say(`In <b>${cell}</b> darf nichts eingetragen werden.`, 'bad'); return; }
    try { E.parse(f.text.slice(1)); } catch (e) { editor.say(`✗ Daraus entsteht keine gültige Formel: <code>${esc(f.text)}</code>`, 'bad'); return; }
    const old = project.sheet.cells[cell], oldIsF = typeof old === 'string' && old.trim().startsWith('=');
    pushUndo(); lastDfdUndo = Date.now();
    setCell(cell, f.text); afterSheetChange();
    const v = grid.value(cell), shown = esc(E.display(v, (project.sheet.fmt || {})[cell]));
    const task = project.tasks?.[cell];
    if (task && task.target) {
        const res = DFD.compare(f.text, task.target, ctxFor(cell));
        report(cell, res.ok, 'diagramm', f.text);
        if (res.ok && err) editor.say(`✓ Die Formel rechnet richtig (${cell} = <b>${shown}</b>). Aber: ${err}`, 'warn');
        else editor.say(res.ok ? `✓ Richtig! <code>${esc(f.text)}</code> steht jetzt in <b>${cell}</b> und rechnet wie verlangt (${res.sets} Tests).` :
            `✗ <code>${esc(f.text)}</code> steht jetzt in <b>${cell}</b> (= ${shown}), rechnet aber noch nicht wie verlangt. ${testText(res)}: Dein Diagramm liefert <b>${esc(E.display(res.a))}</b>, richtig wäre <b>${esc(E.display(res.b))}</b>.${DFD.swapTip(model, task.target, ctxFor(cell))}`, res.ok && !err ? 'good' : 'bad');
        return;
    }
    if (oldIsF && old.replace(/\s/g, '').toUpperCase() !== f.text.toUpperCase()) {
        const res = DFD.compare(f.text, old, ctxFor(cell));
        editor.say(res.ok ? `✓ <code>${esc(f.text)}</code> steht jetzt in <b>${cell}</b> (= <b>${shown}</b>) und rechnet genau wie die alte Formel <code>${esc(old)}</code> (${res.sets} Tests).`
            : `<code>${esc(f.text)}</code> steht jetzt in <b>${cell}</b> (= <b>${shown}</b>). Achtung: Die alte Formel <code>${esc(old)}</code> hat anders gerechnet. ${testText(res)}: neu <b>${esc(E.display(res.a))}</b>, vorher <b>${esc(E.display(res.b))}</b>. Rückgängig mit ↶.`, res.ok ? 'good' : 'warn');
        return;
    }
    editor.say(`<code>${esc(f.text)}</code> steht jetzt in <b>${cell}</b>. Ergebnis: <b>${shown}</b>.${err ? ' Aber: ' + err : ''} Ändere oben Werte und beobachte das Ergebnis.`, err ? 'warn' : 'good');
});
$('#btnCheck').addEventListener('click', () => {
    const f = editor.formula(), model = editor.getModel();
    const err = DFD.ruleCheck(model, f);
    if (err) { editor.say('✗ ' + err, 'bad'); return; }
    const task = project.tasks?.[cell], raw = project.sheet.cells[cell];
    const target = task?.target || (typeof raw === 'string' && raw.trim().startsWith('=') ? raw : null);
    if (!target) { editor.say(`Das Diagramm hält alle Regeln ein. In <b>${cell}</b> steht noch keine Formel zum Vergleichen – tippe auf <b>DFD → Zelle</b>, um es auszuprobieren.`, 'good'); return; }
    const res = DFD.compare(f.text, target, ctxFor(cell));
    if (task?.target) report(cell, res.ok, 'diagramm', f.text);
    const what = task?.target ? 'wie verlangt' : `genau wie die Formel in ${cell}`;
    if (res.ok) editor.say(`✓ Richtig! Dein Diagramm rechnet ${what} (${res.sets} Tests${task?.target ? '' : `, <code>${esc(target)}</code>`}).`, 'good');
    else {
        const cells = Object.keys(res.set || {}); grid.setHot(cells);
        editor.say(`✗ Noch nicht. ${testText(res)}: Dein Diagramm liefert <b>${esc(E.display(res.a))}</b>, ${task?.target ? 'richtig wäre' : `die Formel in ${cell} liefert`} <b>${esc(E.display(res.b))}</b>.${DFD.swapTip(model, target, ctxFor(cell))}`, 'bad');
    }
});
$('#btnDfdClear').addEventListener('click', async () => {
    if (!editor.getModel().nodes.length) return;
    if (!await confirmBox('Diagramm löschen?', `Das Diagramm für <b>${esc(cell)}</b> wird gelöscht. (Rückgängig geht mit ↶.)`, 'Löschen', true)) return;
    pushUndo(); delete project.dfds[cell]; touch(); grid.setMarks(new Set(Object.keys(project.dfds))); showCell(cell);
});
$('#dfdTask').addEventListener('click', () => { const t = project.tasks?.[cell]; if (t) editor.say(`<b>${esc(t.title || 'Aufgabe')}</b>${t.prompt ? ': ' + t.prompt : ''}`); });
$('#btnZoomIn').addEventListener('click', () => editor.zoomBy(1.2));
$('#btnZoomOut').addEventListener('click', () => editor.zoomBy(1 / 1.2));
$('#btnZoomFit').addEventListener('click', () => editor.fit());

/** Formel direkt in die Zelle geschrieben: mit einer Aufgabe vergleichen */
function checkFormulaTask(a) {
    const task = project.tasks?.[a], raw = project.sheet.cells[a];
    if (!task || !task.target || !(typeof raw === 'string' && raw.trim().startsWith('='))) return;
    if (task.mode === 'diagramm') return;
    const res = DFD.compare(raw, task.target, ctxFor(a));
    report(a, res.ok, 'formel', raw);
    grid.say(res.ok ? `✓ Richtig! <code>${esc(raw)}</code> rechnet wie verlangt.` : `✗ <code>${esc(raw)}</code> rechnet noch nicht wie verlangt. ${testText(res)}: <b>${esc(E.display(res.a))}</b> statt <b>${esc(E.display(res.b))}</b>.`, res.ok ? 'good' : 'bad');
}
function report(a, ok, how, formula) {
    const t = project.tasks?.[a]; if (t) { t.done = t.done || ok; touch(); }
    postToLernpfad({ type: 'flowpad-result', cell: a, ok, how, formula, task: t?.id });
}

// ================= Lernpfad =================
let frame = null;
function showLernpfad() {
    const has = !!project.lernpfadHtml;
    document.body.classList.toggle('has-lp', has);
    const host = $('#lernpfad'); host.innerHTML = '';
    frame = null;
    if (has) {
        frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals');
        frame.setAttribute('title', 'Lernpfad');
        frame.srcdoc = withBridge(project.lernpfadHtml, project.lernpfadState || '{}');
        host.appendChild(frame);
        $('#lpTitle').textContent = project.lernpfadTitle || titleOf(project.lernpfadHtml) || 'Lernpfad';
    }
    $('#drawerLpRemove').hidden = !has;
    applyLayout();
}
function postToLernpfad(msg) { try { frame && frame.contentWindow && frame.contentWindow.postMessage(msg, '*'); } catch (e) { } }
window.addEventListener('message', async ev => {
    if (!frame || ev.source !== frame.contentWindow) return;
    const m = ev.data; if (!m || typeof m !== 'object') return;
    if (m.type === 'flowpad-lernpfad-storage') { project.lernpfadState = JSON.stringify(m.state || {}); touch(); return; }
    if (m.type !== 'flowpad') return;
    try { await lernpfadAction(m); } catch (e) { console.error(e); toast('Lernpfad: ' + esc(e.message || e)); }
});
const validCell = a => typeof a === 'string' && !!E.parseAddr(a.toUpperCase()) && E.parseAddr(a.toUpperCase()).c < project.sheet.cols && E.parseAddr(a.toUpperCase()).r < project.sheet.rows;
async function lernpfadAction(m) {
    if (m.action === 'sheet') {
        const cells = m.cells && typeof m.cells === 'object' ? Object.fromEntries(Object.entries(m.cells).map(([k, v]) => [k.toUpperCase(), String(v)])) : {};
        const has = Object.keys(project.sheet.cells).length > 0;
        const same = JSON.stringify(project.sheet.cells) === JSON.stringify(cells);
        if (has && !same && !await confirmBox('Tabelle aus dem Lernpfad laden?', `Der Lernpfad möchte die Tabelle${m.title ? ' „' + esc(m.title) + '“' : ''} laden. Deine jetzige Tabelle wird dabei ersetzt (Rückgängig geht mit ↶).`, 'Laden')) return;
        pushUndo();
        const maxR = Math.max(0, ...Object.keys(cells).map(a => (E.parseAddr(a) || { r: 0 }).r + 1)), maxC = Math.max(0, ...Object.keys(cells).map(a => (E.parseAddr(a) || { c: 0 }).c + 1));
        project.sheet = { rows: Math.min(200, Math.max(+m.rows || 0, maxR + 3, 12)), cols: Math.min(26, Math.max(+m.cols || 0, maxC + 1, 6)), cells, widths: m.widths, fmt: m.fmt, styles: m.styles, edit: m.edit };
        project.dfds = {}; if (m.tasks !== false) project.tasks = {};
        grid.rebuild(); grid.setMarks(new Set());
        const start = (m.select || m.start || 'A1').toUpperCase();
        grid.select(validCell(start) ? start : 'A1');
        touch(); toast(m.title ? `Tabelle „${esc(m.title)}“ geladen` : 'Tabelle geladen');
        return;
    }
    if (m.action === 'task') {
        const a = String(m.cell || '').toUpperCase();
        if (!validCell(a)) throw new Error(`„${m.cell}“ ist keine Zelle dieser Tabelle.`);
        if (m.cells) await lernpfadAction({ action: 'sheet', cells: m.cells, rows: m.rows, cols: m.cols, widths: m.widths, fmt: m.fmt, styles: m.styles, edit: m.edit, title: m.sheetTitle, select: a, tasks: false });
        project.tasks = project.tasks || {};
        project.tasks[a] = { id: m.id, target: m.target, title: m.title, prompt: m.prompt, mode: m.mode, tests: Array.isArray(m.tests) ? m.tests : undefined };
        if (m.dfd === 'leer' && project.dfds[a]) { pushUndo(); delete project.dfds[a]; grid.setMarks(new Set(Object.keys(project.dfds))); }
        touch();
        grid.select(a);
        if (layoutMode() !== 'wide') showView(m.mode === 'formel' ? 'tabelle' : 'diagramm');
        return;
    }
    if (m.action === 'select') { const a = String(m.cell || '').toUpperCase(); if (validCell(a)) { grid.select(a); if (layoutMode() !== 'wide') showView('tabelle'); } return; }
    if (m.action === 'dfd') {
        const a = String(m.cell || cell).toUpperCase(); if (!validCell(a)) return;
        const term = m.term || project.sheet.cells[a]; if (!term) return;
        grid.select(a);
        pushUndo(); project.dfds[a] = DFD.fromTerm(term, { labelOf, outRef: a, output: labelOf(a) }); touch();
        grid.setMarks(new Set(Object.keys(project.dfds))); showCell(a);
        if (layoutMode() !== 'wide') showView('diagramm');
        return;
    }
}

// ================= Ansichten / Layout =================
const layoutMode = () => innerWidth >= 900 ? 'wide' : innerWidth >= 600 ? 'medium' : 'narrow';
let view = 'tabelle';
function showView(v) { view = v; applyLayout(); }
function applyLayout() {
    const mode = layoutMode(), has = !!project?.lernpfadHtml;
    document.body.dataset.layout = mode;
    if (!has && view === 'lernpfad') view = 'tabelle';
    // medium: Tabelle+Diagramm zusammen, Lernpfad als eigene Ansicht
    if (mode === 'medium' && view === 'diagramm') view = 'tabelle';
    document.body.dataset.view = view;
    document.querySelectorAll('#bottomnav [data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view || (mode === 'medium' && b.dataset.view === 'tabelle' && view !== 'lernpfad')); b.hidden = (b.dataset.view === 'lernpfad' && !has) || (mode === 'medium' && b.dataset.view === 'diagramm'); });
    $('#bottomnav').hidden = mode === 'wide' || (!has && mode === 'medium');
    document.body.classList.toggle('lp-wide', pref.get('lpWide', '0') === '1');
    document.body.classList.toggle('lp-full', pref.get('lpFull', '0') === '1' && mode === 'wide' && has);
    const ratio = +pref.get('split', '0.45');
    document.documentElement.style.setProperty('--split', String(Math.max(0.2, Math.min(0.8, ratio))));
    setTimeout(() => editor.fit(), 30);
}
window.addEventListener('resize', () => applyLayout());
document.querySelectorAll('#bottomnav [data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('#btnLpWide').addEventListener('click', () => { pref.set('lpWide', pref.get('lpWide', '0') === '1' ? '0' : '1'); pref.set('lpFull', '0'); applyLayout(); });
$('#btnLpFull').addEventListener('click', () => { pref.set('lpFull', pref.get('lpFull', '0') === '1' ? '0' : '1'); applyLayout(); });
// Trennlinie zwischen Tabelle und Diagramm verschieben
(() => {
    const sp = $('#splitter'); let drag = null;
    sp.addEventListener('pointerdown', e => { e.preventDefault(); drag = { y0: e.clientY, h: $('#left').getBoundingClientRect() }; sp.setPointerCapture(e.pointerId); sp.classList.add('active'); });
    sp.addEventListener('pointermove', e => { if (!drag) return; const r = (e.clientY - drag.h.top) / drag.h.height; document.documentElement.style.setProperty('--split', String(Math.max(0.2, Math.min(0.8, r)))); });
    const end = e => { if (!drag) return; drag = null; sp.classList.remove('active'); pref.set('split', getComputedStyle(document.documentElement).getPropertyValue('--split').trim()); editor.fit(); };
    sp.addEventListener('pointerup', end); sp.addEventListener('pointercancel', end);
})();

// ================= Projekte =================
async function openProject(p, opts) {
    project = Store.normalizeProject(p);
    if (!project.id) project.id = Store.newProject().id;
    undo = []; redo = []; updateHist();
    pref.set('last', project.id);
    $('#projectName').textContent = project.name;
    document.title = project.name + ' · FlowPad';
    grid.rebuild();
    grid.setMarks(new Set(Object.keys(project.dfds)));
    const first = project.select && validCell(project.select) ? project.select : 'A1';
    grid.select(first);
    view = project.lernpfadHtml && layoutMode() !== 'wide' ? 'lernpfad' : 'tabelle';
    showLernpfad();
    if (!opts || !opts.noSave) await Store.putProject(project).catch(() => { });
    $('#saved').textContent = 'gespeichert';
    renderProjectList();
}
async function createProject(name) { const p = Store.newProject(name); await openProject(p); return p; }
function fileName(ext) { return (project.name || 'FlowPad').replace(/[\\/:*?"<>|]+/g, ' ').trim() + ext; }
async function deliver(blob, name) {
    const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
async function shareFile(blob, name) {
    const file = new File([blob], name, { type: blob.type || 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    deliver(blob, name);
}
const projectBlob = () => new Blob([Store.projectFile(project)], { type: 'application/json' });
function pickFile(accept) {
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
}
async function openFromBytes(bytes, name) {
    if (/\.xlsx$/i.test(name) || (isZip(bytes) && !/\.zip$/i.test(name))) {
        const s = await xlsxToSheet(bytes);
        const p = Store.newProject(name.replace(/\.xlsx$/i, ''));
        p.sheet = { rows: Math.max(20, s.rows + 5), cols: Math.min(26, Math.max(8, s.cols + 1)), cells: s.cells };
        await openProject(p); toast('Excel-Datei geöffnet'); return;
    }
    const text = new TextDecoder().decode(bytes);
    const p = Store.normalizeProject(JSON.parse(text));
    p.id = Store.newProject().id; p.name = p.name || name.replace(/\.(flowpad\.)?json$/i, '');
    await openProject(p); toast('Projekt geöffnet');
}

async function renderProjectList() {
    const list = await Store.listProjects().catch(() => []);
    $('#projectList').innerHTML = list.map(p => `<li class="${p.id === project?.id ? 'current' : ''}"><button type="button" data-open="${p.id}"><b>${esc(p.name)}</b><span>${new Date(p.modified).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}${p.lernpfad ? ' · Lernpfad' : ''}</span></button>
      <button type="button" class="iconbtn small" data-dup="${p.id}" title="Duplizieren" aria-label="Duplizieren">⧉</button><button type="button" class="iconbtn small" data-del="${p.id}" title="Löschen" aria-label="Löschen">✕</button></li>`).join('');
}
$('#projectList').addEventListener('click', async e => {
    const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]'), u = e.target.closest('[data-dup]');
    if (o) { const p = await Store.getProject(o.dataset.open); if (p) { await openProject(p, { noSave: true }); closeDrawer(); } }
    if (u) { const p = await Store.getProject(u.dataset.dup); if (p) { const q = JSON.parse(JSON.stringify(p)); q.id = Store.newProject().id; q.name = p.name + ' (Kopie)'; q.modified = Date.now(); delete q.source; await Store.putProject(q); renderProjectList(); } }
    if (d) {
        const p = await Store.getProject(d.dataset.del); if (!p) return;
        if (!await confirmBox('Projekt löschen?', `„${esc(p.name)}“ wird von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.`, 'Löschen', true)) return;
        await Store.deleteProject(p.id);
        if (p.id === project.id) { const rest = await Store.listProjects(); if (rest.length) await openProject(await Store.getProject(rest[0].id), { noSave: true }); else await createProject(); }
        renderProjectList();
    }
});

/** Lernpfad- oder Projektadresse öffnen. Gleiche Adresse → eigenes Projekt mit Stand; Demo → immer frische Kopie. */
async function openLink(url, kind, fresh) {
    const abs = new URL(url, location.href).href;
    if (!fresh) {
        const mine = (await Store.listProjects()).find(p => p.source === abs);
        if (mine) { await openProject(await Store.getProject(mine.id), { noSave: true }); return; }
    }
    $('#loading').hidden = false;
    try {
        const r = await loadLernpfadUrl(abs);
        let p;
        if (r.kind === 'project') { p = Store.normalizeProject(JSON.parse(r.text)); p.id = Store.newProject().id; p.name = p.name || r.name; }
        else {
            if (kind === 'projekt') throw new Error(`„${url}“ ist keine Projektdatei.`);
            p = Store.newProject(r.name); p.lernpfadHtml = r.html; p.lernpfadTitle = r.name;
        }
        p.source = abs; p.modified = Date.now();
        await openProject(p);
    } finally { $('#loading').hidden = true; }
}

// ================= Menü =================
const drawer = $('#drawer');
function openDrawer() { renderProjectList(); drawer.classList.add('open'); drawer.inert = false; $('#drawerBackdrop').classList.add('show'); }
function closeDrawer() { drawer.classList.remove('open'); drawer.inert = true; $('#drawerBackdrop').classList.remove('show'); }
$('#btnMenu').addEventListener('click', openDrawer);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#drawerBackdrop').addEventListener('click', closeDrawer);
const on = (id, fn) => $(id).addEventListener('click', async () => { try { await fn(); } catch (e) { console.error(e); alertBox('Das hat nicht geklappt', esc(e.message || String(e))); } });

on('#drawerNew', async () => { const n = await promptBox('Neues Projekt', '', 'Name des Projekts'); if (n === null) return; await createProject(n.trim() || 'Neues Projekt'); closeDrawer(); });
on('#drawerOpen', async () => { const f = await pickFile('.json,.flowpad,.xlsx,application/json'); if (!f) return; await openFromBytes(new Uint8Array(await f.arrayBuffer()), f.name); closeDrawer(); });
on('#drawerSave', async () => { await deliver(projectBlob(), fileName('.flowpad.json')); });
on('#btnSave', async () => { await deliver(projectBlob(), fileName('.flowpad.json')); toast('Projektdatei wird gespeichert'); });
on('#drawerShare', async () => { await shareFile(projectBlob(), fileName('.flowpad.json')); });
on('#drawerRename', renameProject);
$('#projectName').addEventListener('click', renameProject);
async function renameProject() { const n = await promptBox('Projekt umbenennen', project.name); if (!n || !n.trim()) return; project.name = n.trim(); $('#projectName').textContent = project.name; document.title = project.name + ' · FlowPad'; touch(); renderProjectList(); }
on('#drawerCode', async () => {
    let msg = 'Den Code bekommst du von deiner Lehrkraft, z. B. <b>H7K2Q</b>.';
    for (; ;) {
        const v = await promptBox('Projekt über FlowCode öffnen', '', 'FlowCode', msg); if (v === null) return;
        const code = normalizeCode(v), ferr = codeFormatError(code);
        if (ferr) { msg = `<span class="bad">${esc(ferr)}</span>`; continue; }
        const r = await resolveCode(code);
        if (r.error) { msg = `<span class="bad">${esc(r.error)}</span>`; continue; }
        closeDrawer(); await openLink(r.path, 'lernpfad'); return;
    }
});
on('#drawerDemo', async () => { closeDrawer(); await openLink('learn/demo/FlowPad-Willkommen.html', 'lernpfad', true); });
on('#drawerLpAdd', async () => {
    const f = await pickFile('.html,.htm,.zip,text/html,application/zip'); if (!f) return;
    const html = await readLernpfadFile(f);
    project.lernpfadHtml = html; project.lernpfadTitle = titleOf(html) || f.name.replace(/\.(html?|zip)$/i, ''); project.lernpfadState = '{}';
    touch(); showLernpfad(); closeDrawer(); toast('Lernpfad eingebettet');
});
on('#drawerLpRemove', async () => {
    if (!await confirmBox('Lernpfad entfernen?', 'Der Lernpfad wird aus diesem Projekt entfernt. Tabelle und Diagramme bleiben.', 'Entfernen', true)) return;
    delete project.lernpfadHtml; delete project.lernpfadState; delete project.lernpfadTitle; touch(); showLernpfad(); closeDrawer();
});
on('#drawerXlsxOut', async () => { await deliver(sheetToXlsx(project.sheet, project.name), fileName('.xlsx')); });
on('#drawerXlsxIn', async () => {
    const f = await pickFile('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); if (!f) return;
    const s = await xlsxToSheet(new Uint8Array(await f.arrayBuffer()));
    if (Object.keys(project.sheet.cells).length && !await confirmBox('Tabelle ersetzen?', `Die Tabelle dieses Projekts wird durch „${esc(f.name)}“ ersetzt (Rückgängig geht mit ↶).`, 'Ersetzen')) return;
    pushUndo(); project.sheet = { rows: Math.max(20, s.rows + 5), cols: Math.min(26, Math.max(8, s.cols + 1)), cells: s.cells }; project.dfds = {};
    grid.rebuild(); grid.setMarks(new Set()); grid.select('A1'); touch(); closeDrawer(); toast('Excel-Datei übernommen');
});
on('#drawerAddRow', async () => { pushUndo(); project.sheet.rows = Math.min(200, project.sheet.rows + 5); grid.rebuild(); touch(); toast(`Jetzt ${project.sheet.rows} Zeilen`); });
on('#drawerAddCol', async () => { if (project.sheet.cols >= 26) { toast('Mehr als 26 Spalten (A–Z) gehen nicht.'); return; } pushUndo(); project.sheet.cols++; grid.rebuild(); touch(); toast(`Jetzt bis Spalte ${E.colName(project.sheet.cols - 1)}`); });
on('#drawerClearSheet', async () => {
    if (!await confirmBox('Tabelle leeren?', 'Alle Zellen und Diagramme dieses Projekts werden gelöscht (Rückgängig geht mit ↶).', 'Leeren', true)) return;
    pushUndo(); project.sheet.cells = {}; project.dfds = {}; project.tasks = {}; grid.rebuild(); grid.setMarks(new Set()); grid.select('A1'); touch(); closeDrawer();
});
on('#drawerHelp', async () => { closeDrawer(); await openLink('learn/demo/FlowPad-Willkommen.html', 'lernpfad'); });

$('#btnUndo').addEventListener('click', () => { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); updateHist(); });
$('#btnRedo').addEventListener('click', () => { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); updateHist(); });

// ---------- Darstellung ----------
const SKINS = [['standard', 'Standard'], ['werkstatt', 'Werkstatt'], ['hacker', 'Hacker']];
function applyTheme() {
    const c = pref.get('theme', 'auto'), dark = c === 'dark' || (c === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.effective = dark ? 'dark' : 'light';
    document.documentElement.dataset.skin = pref.get('skin', 'werkstatt');
    document.querySelectorAll('[data-theme-choice]').forEach(b => b.classList.toggle('active', b.dataset.themeChoice === c));
    document.querySelectorAll('[data-skin-choice]').forEach(b => b.classList.toggle('active', b.dataset.skinChoice === pref.get('skin', 'werkstatt')));
    const fs = +pref.get('font', '100');
    document.documentElement.style.setProperty('--fs', fs / 100);
    $('#fontSizeLabel').textContent = fs + ' %';
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--bar').trim() || '#ffffff';
}
$('#skinPicker').innerHTML = SKINS.map(([k, l]) => `<button type="button" data-skin-choice="${k}" class="skin-${k}"><span class="skin-swatch"></span>${l}</button>`).join('');
document.querySelectorAll('[data-theme-choice]').forEach(b => b.addEventListener('click', () => { pref.set('theme', b.dataset.themeChoice); applyTheme(); }));
document.querySelectorAll('[data-skin-choice]').forEach(b => b.addEventListener('click', () => { pref.set('skin', b.dataset.skinChoice); applyTheme(); }));
$('#fontSmaller').addEventListener('click', () => { pref.set('font', String(Math.max(80, +pref.get('font', '100') - 10))); applyTheme(); setTimeout(() => editor.fit(), 50); });
$('#fontBigger').addEventListener('click', () => { pref.set('font', String(Math.min(140, +pref.get('font', '100') + 10))); applyTheme(); setTimeout(() => editor.fit(), 50); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ================= Start =================
async function start() {
    applyTheme();
    Store.persist();
    const q = new URLSearchParams(location.search);
    const lp = q.get('lernpfad'), pj = q.get('projekt'), code = q.get('code') || q.get('flowcode');
    try {
        if (code) {
            const c = normalizeCode(code), r = codeFormatError(c) ? { error: codeFormatError(c) } : await resolveCode(c);
            if (r.error) throw new Error(r.error);
            await openLink(r.path, 'lernpfad');
        } else if (lp || pj) await openLink(lp || pj, lp ? 'lernpfad' : 'projekt');
        else {
            const last = pref.get('last', '');
            const p = last && await Store.getProject(last).catch(() => null);
            if (p) await openProject(p, { noSave: true });
            else {
                const list = await Store.listProjects().catch(() => []);
                if (list.length) await openProject(await Store.getProject(list[0].id), { noSave: true });
                else if (pref.get('welcomed', '') !== '1') { pref.set('welcomed', '1'); await openLink('learn/demo/FlowPad-Willkommen.html', 'lernpfad', true).catch(() => createProject('Mein erstes Projekt')); }
                else await createProject('Mein erstes Projekt');
            }
        }
    } catch (e) {
        console.error(e);
        if (!project) await createProject('Mein erstes Projekt');
        alertBox('Das Projekt ließ sich nicht öffnen', esc(e.message || String(e)));
    }
    if (lp || pj || code) history.replaceState(null, '', location.pathname);
    $('#loading').hidden = true;
    const c = project && codeOfUrl(project.source); if (c) $('#projectName').title = 'FlowCode ' + c;
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
}
start();
