/* Attrappe von FlowPad für den Editor-Entwurf: eine kleine Tabelle, die mit der echten
 * FlowPad-Rechenmaschine rechnet. Sie spielt den „host“ für die FlowPad-Erweiterung von PathFinder.
 * Im fertigen Einbau übernimmt FlowPad selbst diese Rolle. */
import CalcEngine from '../js/engine.js';
import { sheetOf, sameResults } from './flowpad-plugin.js';
const CE = CalcEngine;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const START = { A1: 'Artikel', B1: 'Preis', C1: 'Anzahl', D1: 'Gesamt', A2: 'Brezel', B2: '0,9', C2: '14', A3: 'Semmel', B3: '0,45', C3: '20', A4: 'Kakao', B4: '1,2', C4: '9' };

export function createMock() {
  let api = null;
  const m = {
    cells: { ...START }, sel: 'D2', cur: null, tabName: 'Tabelle 1',
    draw() {
      const sh = sheetOf(this.cells);
      let R = 12, C = 6; for (const a in this.cells) { const p = CE.parseAddr(a); if (p) { R = Math.max(R, p.r + 2); C = Math.max(C, p.c + 2); } }
      let h = '<tr><th></th>'; for (let c = 0; c < C; c++) h += `<th>${CE.colName(c)}</th>`; h += '</tr>';
      for (let r = 0; r < R; r++) { h += `<tr><th>${r + 1}</th>`; for (let c = 0; c < C; c++) { const a = CE.addr(r, c), v = this.cells[a]; let s = ''; if (v != null && v !== '') { try { s = CE.display(sh.value(a)); } catch (e) { s = '#FEHLER'; } } h += `<td data-a="${a}" class="${a === this.sel ? 'sel' : ''}${this.cur && this.cur.cell === a ? (this.cur.ok ? ' ok' : ' task') : ''}">${esc(s)}</td>`; } h += '</tr>'; }
      $('#mGrid').innerHTML = h; $('#mAddr').textContent = this.sel; $('#mFx').value = this.cells[this.sel] ?? ''; $('#mTab').textContent = this.tabName;
      const t = this.cur; $('#mTask').innerHTML = t ? `<div class="mock-card${t.ok ? ' ok' : ''}"><b>${t.ok ? '✓' : '🎯'} ${esc(t.title || 'Aufgabe')}</b><div>${t.html}</div>${t.ok ? '<div>geschafft – der Lernpfad geht weiter.</div>' : `<div style="opacity:.75">Formel in ${esc(t.cell)} eintragen${t.kind === 'diagramm' ? ' (im echten FlowPad: als Diagramm bauen)' : ''}.</div>`}</div>` : '';
    },
    check() {
      const t = this.cur; if (!t || t.ok || !api) return;
      if (sameResults(this.cells, t.cell, t.target)) { t.ok = true; this.draw(); if (api.mode === 'preview') api.solve(t.id); api.toast('✓ Richtig! Der Lernpfad geht weiter.'); }
      else { api.prog.tries[t.id] = (api.prog.tries[t.id] || 0) + 1; api.toast('Noch nicht – vergleiche dein Ergebnis mit der Aufgabe.'); if (api.mode === 'preview') api.render(); }
    },
  };
  $('#mGrid').addEventListener('click', e => { const td = e.target.closest('td[data-a]'); if (!td) return; m.sel = td.dataset.a; m.draw(); });
  $('#mFx').addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = e.target.value.trim(); if (v) m.cells[m.sel] = v; else delete m.cells[m.sel]; const a = m.sel; m.draw(); if (m.cur && m.cur.cell === a) m.check(); });
  m.draw();

  // Schnittstelle, die PathFinder und die FlowPad-Erweiterung benutzen
  const host = {
    name: 'FlowPad', copyLabel: 'Kopieren',
    attach(a) { api = a; },
    selectedCell: () => m.sel,
    cellFormula: a => m.cells[a],
    cells: () => m.cells,
    tab: () => m.tabName,
    reset() { m.cells = { ...START }; m.cur = null; m.tabName = 'Tabelle 1'; m.sel = 'D2'; m.draw(); },
    loadSheet(sheet, title) { m.cells = { ...(sheet.cells || {}) }; m.tabName = title || sheet.title || 'Tabelle'; m.cur = null; m.draw(); },
    task(t) {
      if (t.sheet?.cells) host.loadSheet(t.sheet, t.sheet.title || t.tabelle || t.title);
      if (t.dfd === 'vorgegeben') api?.toast('Im echten FlowPad steht jetzt das Diagramm – die Formel bleibt verborgen.');
      m.cur = { ...t, ok: false }; m.sel = t.cell; m.draw(); $('#mFx').focus();
    },
    action(b) {
      if (b.sheet?.cells) host.loadSheet(b.sheet, b.sheet.title);
      api?.toast(b.act === 'dfd' ? `Im echten FlowPad: Diagramm von ${esc(b.cell)} wird gezeigt.` : `Im echten FlowPad: Ansichten ${b.tabelle ? 'Tabelle' : ''}${b.tabelle && b.diagramm ? ' + ' : ''}${b.diagramm ? 'Diagramm' : ''}.`);
      return true;
    },
    showSolution() { api?.toast('Im echten FlowPad erscheint jetzt links das Lösungsdiagramm.'); return true; },
    fileButton: b => /\.xlsx$/i.test(b.name || '') ? '<button class="lp-btn alt" data-run="file:xlsx">▦ In FlowPad öffnen</button>' : '',
    runFile() { api?.toast('▦ Im echten FlowPad öffnet sich die Excel-Datei als neuer Reiter.'); },
  };
  return host;
}
