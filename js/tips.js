/*
 * FlowPad – Hilfe per langem Drücken (wie in JPad, PlanPad und QPad).
 * Finger etwa eine Sekunde auf einen Knopf legen: Statt den Knopf auszulösen, erscheint eine kurze Erklärung.
 * Bei den Rechenzeichen der Eingabeleiste gibt es zusätzlich ein kleines Beispiel.
 * Die Glühbirne oben weist darauf hin.
 */
const HOLD_MS = 900;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// [Selektor, Titel, Erklärung, Beispiel (Formel), Ergebnis/Hinweis zum Beispiel]
const TIPS = [
    // ---------- Rechenzeichen und Zeichen der Eingabeleiste ----------
    ['[data-ins="="]', 'Gleichheitszeichen', 'Am Anfang macht es aus dem Eintrag eine Formel. Mitten in einer Formel vergleicht es zwei Werte (WAHR oder FALSCH).', '=B2*C2', 'Ohne = am Anfang wäre es nur Text.'],
    ['[data-ins="$"]', 'Dollarzeichen (absoluter Bezug)', 'Hält beim Kopieren und Ausfüllen die Spalte und/oder Zeile fest. $B$6 bleibt immer B6, B6 wird beim Ausfüllen nach unten zu B7, B8 …', '=D2*$B$6', 'Nach unten ausgefüllt: =D3*$B$6, =D4*$B$6 …'],
    ['[data-ins=";"]', 'Strichpunkt', 'Trennt die Parameter einer Funktion.', '=RUNDEN(A2;1)', 'Erster Parameter: die Zahl, zweiter: die Anzahl der Stellen.'],
    ['[data-ins=":"]', 'Doppelpunkt (Bereich)', 'Bedeutet „bis“: A2:A6 ist der Bereich von A2 bis A6.', '=SUMME(A2:A6)', 'Addiert A2, A3, A4, A5 und A6.'],
    ['[data-ins="("]', 'Klammer auf', 'Öffnet die Parameter einer Funktion oder legt fest, was zuerst gerechnet wird. Jede Klammer, die aufgeht, muss auch wieder zu.', '=(B2+C2)*2', 'Ohne Klammern würde erst C2*2 gerechnet.'],
    ['[data-ins=")"]', 'Klammer zu', 'Schließt eine Klammer. Zähle nach: gleich viele auf wie zu.', '=RUNDEN(MITTELWERT(B2:D2);1)', 'Zwei Klammern auf, zwei zu.'],
    ['[data-ins="+"]', 'Plus', 'Addiert zwei Werte.', '=B2+C2', 'Preis plus Versand.'],
    ['[data-ins="-"]', 'Minus', 'Subtrahiert den zweiten Wert vom ersten. Die Reihenfolge ist wichtig!', '=B2-C2', 'Kontostand minus Ausgabe.'],
    ['[data-ins="*"]', 'Mal', 'Multipliziert zwei Werte. Punkt vor Strich: * wird vor + und - gerechnet.', '=B2*C2', 'Preis mal Anzahl.'],
    ['[data-ins="/"]', 'Geteilt', 'Teilt den ersten Wert durch den zweiten. Durch 0 teilen ergibt #DIV/0!.', '=B2/C2', 'Strecke geteilt durch Zeit.'],
    ['[data-ins=\'"\']', 'Anführungszeichen', 'Umschließen einen Text in einer Formel. Zahlen und Zellbezüge stehen ohne Anführungszeichen.', '=WENN(B2>=50;"gratis";"4,90 €")', 'Ergibt den Text „gratis“ oder „4,90 €“.'],
    ['[data-ins="<"]', 'Kleiner als', 'Vergleich: WAHR, wenn der linke Wert kleiner ist. Mit = dahinter: kleiner oder gleich (<=). <> heißt ungleich.', '=WENN(B2<14;"Kind";"Erwachsen")', 'Genau 14 ist nicht kleiner als 14!'],
    ['[data-ins=">"]', 'Größer als', 'Vergleich: WAHR, wenn der linke Wert größer ist. Mit = dahinter: größer oder gleich (>=).', '=WENN(B2>=50;0;4,9)', 'Ab genau 50 € ist der Versand gratis.'],

    // ---------- Kopfzeile ----------
    ['#btnMenu', 'Menü', 'Projekte öffnen, sichern und teilen, Lernpfade einbetten, Excel-Dateien übernehmen, Darstellung ändern.'],
    ['#projectName', 'Projektname', 'Antippen, um das Projekt umzubenennen.'],
    ['[data-tabadd]', 'Neue Tabelle', 'Legt im Projekt einen neuen Reiter mit einer leeren Tabelle an. Jede Tabelle hat ihre eigenen Diagramme.'],
    ['.tab.active', 'Aktuelle Tabelle', 'Antippen: umbenennen, löschen oder (bei Tabellen aus dem Lernpfad) wieder neu laden.'],
    ['.tab[data-tab]', 'Andere Tabelle', 'Wechselt zu dieser Tabelle. Dein Stand bleibt erhalten.'],
    ['#btnUndo', 'Rückgängig', 'Nimmt die letzte Änderung an Tabelle oder Diagramm zurück.'],
    ['#btnRedo', 'Wiederholen', 'Stellt eine zurückgenommene Änderung wieder her.'],
    ['#btnSave', 'Sichern', 'Lädt das ganze Projekt als Datei herunter (.flowpad.json). Am iPad in „Dateien“ ablegen – nächstes Mal über Menü → „Projekt aus Datei öffnen“ wieder laden.'],
    ['#teachCode', 'FlowCode', 'Mit diesem Code öffnen die Schüler den Lernpfad (Menü → „Projekt über FlowCode öffnen“).'],

    // ---------- Tabelle ----------
    ['.calc-fxbtn', 'fx – Handbuch', 'Zeigt alle Funktionen mit Beispielen. „Einfügen“ schreibt die Funktion in die Formel.'],
    ['.calc-name', 'Zelladresse', 'Die gewählte Zelle: Spalte (Buchstabe) und Zeile (Zahl), z. B. D6.'],
    ['.calc-input', 'Eingabezeile', 'Hier steht der Inhalt der gewählten Zelle. Eine Formel beginnt mit =. Während du eine Formel schreibst, fügt das Antippen einer Zelle ihre Adresse ein.'],
    ['.calc-clear', 'Zelle leeren', 'Löscht den Inhalt der gewählten Zelle.'],
    ['.calc-ok', 'Übernehmen', 'Schreibt die Eingabe in die Zelle (wie die Return-Taste).'],
    ['[data-act="copy"]', 'Kopieren', 'Merkt sich den Inhalt der gewählten Zelle. Danach eine andere Zelle wählen und „Einfügen“.'],
    ['[data-act="paste"]', 'Einfügen', 'Fügt die kopierte Zelle ein. Relative Bezüge verschieben sich mit: Aus =B2*C2 in D2 wird in D3 =B3*C3.'],
    ['[data-act="filldown"]', 'Nach unten ausfüllen', 'Kopiert die Formel der gewählten Zelle in die Zellen darunter – so weit die Tabelle daneben gefüllt ist.'],
    ['[data-act="fillright"]', 'Nach rechts ausfüllen', 'Kopiert die Formel der gewählten Zelle in die Zellen rechts daneben.'],
    ['[data-act="formulas"]', 'Formeln zeigen', 'Zeigt in den Zellen die Formeln statt der Ergebnisse. Nochmal antippen: wieder die Werte.'],
    ['[data-act="pickcancel"]', 'Abbrechen', 'Bricht das Auswählen einer Zelle für das Diagramm ab.'],

    // ---------- Diagramm ----------
    ['#btnToDfd', 'fx → DFD', 'Zeichnet zur Formel der gewählten Zelle das Datenflussdiagramm.'],
    ['#btnToCell', 'DFD → Zelle', 'Schreibt die Formel des Diagramms in die Ausgabezelle und rechnet sie aus.'],
    ['#btnFlow', 'Ablauf', 'Die Werte aus der Tabelle fließen Schritt für Schritt durch das Diagramm. Unter jeder Ellipse dreht sich ein Zahnrad, dann kommt das Zwischenergebnis heraus.'],
    ['#btnCheck', 'Prüfen', 'Kontrolliert die Regeln (alle Pfeile, Verteiler, keine doppelten Eingaben) und vergleicht die Rechnung mit vielen Testwerten.'],
    ['#btnZoomOut', 'Verkleinern', 'Zeigt das Diagramm kleiner.'],
    ['#btnZoomIn', 'Vergrößern', 'Zeigt das Diagramm größer.'],
    ['#btnZoomFit', 'Einpassen', 'Passt das Diagramm in die Fläche ein.'],
    ['#btnDfdClear', 'Diagramm löschen', 'Löscht das Diagramm der gewählten Zelle (Rückgängig geht mit ↶).'],
    ['.dfd-paltoggle', 'Bausteinleiste ein-/ausklappen', 'Macht die Leiste mit den Bausteinen schmal (nur Symbole) – so bleibt mehr Platz für das Diagramm. Nochmal antippen: wieder mit Namen.'],
    ['[data-add="in"]', 'Eingabe', 'Ein Rechteck für eine Zelle oder einen Bereich der Tabelle. Danach die Zelle oben antippen oder über einen Bereich ziehen.'],
    ['[data-add="const"]', 'Konstante', 'Eine feste Zahl oder ein Text – ohne Rahmen, z. B. 2 oder 0,19.'],
    ['[data-add="fn"]', 'Funktion', 'Eine Ellipse für eine Funktion (SUMME, WENN …) oder ein Rechenzeichen (+, *, …).'],
    ['[data-add="split"]', 'Verteiler', 'Ein Punkt: ein Pfeil hinein, mehrere heraus. Nur nötig, wenn ein Datum an mehrere Funktionen geht.'],
    ['[data-add="out"]', 'Ausgabe', 'Das Rechteck für die Zelle, in der das Ergebnis steht.'],
    ['.dfd-edit [data-act="pickcell"]', 'Zelle antippen', 'Wähle die Zelle direkt in der Tabelle aus.'],
    ['.dfd-edit [data-act="pick"]', 'Funktion ändern', 'Wählt eine andere Funktion für diese Ellipse.'],
    ['.dfd-edit [data-act="del"]', 'Löschen', 'Löscht den ausgewählten Baustein oder Pfeil.'],
    ['.dfd-edit [data-act="ok"]', 'Übernehmen', 'Übernimmt die Eingaben dieser Leiste.'],
    ['[data-fb="slower"]', 'Langsamer', 'Der Ablauf wird langsamer.'],
    ['[data-fb="faster"]', 'Schneller', 'Der Ablauf wird schneller.'],
    ['[data-fb="step"]', 'Schritt für Schritt', 'Der Ablauf hält nach jeder Ebene an. Mit „Weiter“ geht es eine Ellipse weiter.'],
    ['[data-fb="stop"]', 'Stopp', 'Beendet den Ablauf.'],
    ['[data-fb="again"]', 'Nochmal', 'Startet den Ablauf noch einmal.'],
    ['[data-fb="close"]', 'Fertig', 'Blendet die Werte des Ablaufs wieder aus.'],

    // ---------- Lernpfad, Ansicht ----------
    ['#btnLpWide', 'Lernpfad breiter/schmaler', 'Macht den Lernpfad breiter oder wieder schmaler.'],
    ['#btnLpCollapse', 'Lernpfad ausblenden', 'Blendet den Lernpfad aus. Dann steht das Diagramm rechts neben der Tabelle. Wieder einblenden: oben mit dem Lernpfad-Schalter.'],
    ['#tgGrid', 'Tabelle ein/aus', 'Gefüllt: Die Tabelle ist zu sehen. Antippen blendet sie aus oder wieder ein.'],
    ['#tgDfd', 'Diagramm ein/aus', 'Gefüllt: Das Datenflussdiagramm ist zu sehen. Antippen blendet es aus oder wieder ein.'],
    ['#tgLp', 'Lernpfad ein/aus', 'Gefüllt: Der Lernpfad ist zu sehen. Ausgeblendet steht das Diagramm rechts neben der Tabelle. Dein Stand im Lernpfad bleibt erhalten.'],
    ['#bottomnav [data-view="lernpfad"]', 'Lernpfad', 'Zeigt den Lernpfad.'],
    ['#bottomnav [data-view="tabelle"]', 'Tabelle', 'Zeigt die Tabelle (und das Diagramm).'],
    ['#bottomnav [data-view="diagramm"]', 'Diagramm', 'Zeigt das Datenflussdiagramm der gewählten Zelle.'],
];

let pop = null;
function hide() { if (pop) { pop.remove(); pop = null; } }
function place(p, anchor) {
    const r = anchor.getBoundingClientRect(), w = Math.min(360, innerWidth - 16);
    p.style.width = w + 'px';
    const h = p.offsetHeight;
    let x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 10; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 10);
    p.style.left = x + 'px'; p.style.top = y + 'px';
}
function show(html, anchor) {
    hide();
    pop = document.createElement('div'); pop.className = 'tip-pop'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = html + '<button type="button" class="tip-x" aria-label="Schließen">✕</button>';
    document.body.appendChild(pop); place(pop, anchor);
    pop.querySelector('.tip-x').onclick = hide;
}
function helpFor(el) {
    for (const [sel, title, text, ex, note] of TIPS) {
        const hit = el.closest(sel);
        if (hit) return { el: hit, title, text, ex, note };
    }
    const b = el.closest('button[title], [role=button][title]');
    if (b && b.title) return { el: b, title: b.getAttribute('aria-label') || '', text: b.title };
    return null;
}

/** Hilfe aktivieren. bulb: Knopf in der Kopfzeile, der den Hinweis zeigt */
export function initTips(bulb) {
    let timer = null, start = null, suppress = false;
    const cancel = () => { clearTimeout(timer); timer = null; if (start) start.el.classList.remove('tip-holding'); start = null; };
    document.addEventListener('pointerdown', e => {
        if (pop) { const inside = pop.contains(e.target); hide(); if (inside) { suppress = true; return; } }
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const h = helpFor(e.target); if (!h || h.el === bulb) return;
        cancel();
        start = { el: h.el, x: e.clientX, y: e.clientY, h };
        h.el.classList.add('tip-holding');
        timer = setTimeout(() => {
            const s = start; timer = null; if (!s) return;
            s.el.classList.remove('tip-holding'); suppress = true;
            const ex = s.h.ex ? `<div class="tip-ex"><span>Beispiel</span><code>${esc(s.h.ex)}</code>${s.h.note ? `<p>${esc(s.h.note)}</p>` : ''}</div>` : '';
            show(`${s.h.title ? `<b class="tip-title">${esc(s.h.title)}</b>` : ''}<p>${esc(s.h.text)}</p>${ex}`, s.el);
            start = null;
        }, HOLD_MS);
    }, true);
    document.addEventListener('pointermove', e => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) cancel(); }, true);
    ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { if (timer) cancel(); }, true));
    // Der Klick nach einem langen Druck löst den Knopf nicht aus
    document.addEventListener('click', e => { if (suppress) { suppress = false; e.preventDefault(); e.stopPropagation(); } }, true);
    // Kein Kontextmenü / keine Textauswahl beim langen Drücken auf iOS
    document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('button')) e.preventDefault(); });
    addEventListener('resize', hide);
    if (bulb) bulb.addEventListener('click', () => {
        if (pop && pop.dataset.bulb) { hide(); return; }
        show(`<div class="tip-bulb"><span class="tip-bulb-ic">${bulb.innerHTML}</span><p>Weißt du nicht, was ein Knopf bewirkt? Lege einfach etwa <b>eine Sekunde lang</b> deinen Finger darauf – dann erscheint eine Erklärung. Bei den Rechenzeichen über der Tabelle gibt es auch ein Beispiel.</p></div>`, bulb);
        pop.dataset.bulb = '1';
    });
}
