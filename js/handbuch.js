/*
 * FlowPad – Handbuch der Funktionen (Knopf „fx“ links neben der Eingabezeile).
 * Jede Funktion: Beschreibung, kleines Beispiel direkt darunter, angetippt ein größeres Beispiel mit Tabelle.
 * Alle Ergebnisse werden mit der echten Rechen-Engine ausgerechnet – sie stimmen also immer.
 */
import E from './engine.js';
import DFD from './dfd.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// kurz: Formel ohne Tabelle · lang: { t: Tabelle, f: Formel, z: Zelle der Formel, x: Erklärung }
const EX = {
    '+': { kurz: '=2+3', lang: { t: { A1: 'Preis', B1: 'Versand', A2: '12,5', B2: '4,9' }, f: '=A2+B2', x: 'Addiert zwei Werte: Preis plus Versand.' } },
    '-': { kurz: '=10-4', lang: { t: { A1: 'Kontostand', B1: 'Ausgabe', A2: '50', B2: '17,5' }, f: '=A2-B2', x: 'Zieht den zweiten Wert vom ersten ab. Die Reihenfolge ist wichtig!' } },
    '*': { kurz: '=3*4', lang: { t: { A1: 'Preis', B1: 'Anzahl', A2: '0,9', B2: '14' }, f: '=A2*B2', x: 'Multipliziert: Preis mal Anzahl ergibt den Gesamtpreis.' } },
    '/': { kurz: '=12/4', lang: { t: { A1: 'Strecke (km)', B1: 'Zeit (h)', A2: '150', B2: '2' }, f: '=A2/B2', x: 'Teilt den ersten Wert durch den zweiten – hier die Geschwindigkeit in km/h. Teilen durch 0 ergibt #DIV/0!.' } },
    '^': { kurz: '=2^3', lang: { t: { A1: 'Seite (cm)', A2: '5' }, f: '=A2^2', x: 'Potenz: 5 hoch 2 ist die Fläche eines Quadrats mit 5 cm Seitenlänge.' } },
    '&': { kurz: '="Hallo "&"Welt"', lang: { t: { A1: 'Vorname', B1: 'Nachname', A2: 'Lena', B2: 'Huber' }, f: '=A2&" "&B2', x: 'Hängt Texte aneinander. Das Leerzeichen dazwischen muss man selbst einfügen.' } },
    '=': { kurz: '=5=5', lang: { t: { A1: 'Eingabe', B1: 'Lösung', A2: '42', B2: '42' }, f: '=A2=B2', x: 'Vergleich: WAHR, wenn beide Werte gleich sind.' } },
    '<>': { kurz: '=5<>3', lang: { t: { A1: 'Eingabe', B1: 'Lösung', A2: '41', B2: '42' }, f: '=A2<>B2', x: 'Vergleich: WAHR, wenn die Werte verschieden sind.' } },
    '<': { kurz: '=3<5', lang: { t: { A1: 'Alter', A2: '13' }, f: '=A2<14', x: 'WAHR, wenn der linke Wert kleiner ist.' } },
    '>': { kurz: '=7>5', lang: { t: { A1: 'Punkte', A2: '87' }, f: '=A2>80', x: 'WAHR, wenn der linke Wert größer ist.' } },
    '<=': { kurz: '=5<=5', lang: { t: { A1: 'Gewicht (kg)', A2: '20' }, f: '=A2<=20', x: 'WAHR, wenn der linke Wert kleiner oder gleich ist – Grenzfall 20 zählt mit.' } },
    '>=': { kurz: '=5>=6', lang: { t: { A1: 'Einkauf (€)', A2: '100' }, f: '=A2>=100', x: 'WAHR, wenn der linke Wert größer oder gleich ist – genau 100 € zählt mit.' } },

    ABS: { kurz: '=ABS(-7)', lang: { t: { A1: 'Soll', B1: 'Ist', A2: '20', B2: '17' }, f: '=ABS(B2-A2)', x: 'Der Betrag macht aus einer negativen Zahl eine positive: die Abweichung ohne Vorzeichen.' } },
    ABRUNDEN: { kurz: '=ABRUNDEN(3,79;1)', lang: { t: { A1: 'Betrag', A2: '12,987' }, f: '=ABRUNDEN(A2;2)', x: 'Schneidet nach 2 Nachkommastellen ab – es wird nie aufgerundet.' } },
    AUFRUNDEN: { kurz: '=AUFRUNDEN(3,21;0)', lang: { t: { A1: 'Schüler', B1: 'pro Bus', A2: '130', B2: '50' }, f: '=AUFRUNDEN(A2/B2;0)', x: '130 Schüler, 50 pro Bus: 2,6 Busse – man braucht aber 3. Deshalb aufrunden.' } },
    GANZZAHL: { kurz: '=GANZZAHL(7,9)', lang: { t: { A1: 'Minuten', A2: '135' }, f: '=GANZZAHL(A2/60)', x: 'Rundet auf die nächste ganze Zahl ab: 135 Minuten sind 2 volle Stunden.' } },
    OBERGRENZE: { kurz: '=OBERGRENZE(23;5)', lang: { t: { A1: 'Preis', A2: '3,42' }, f: '=OBERGRENZE(A2;0,5)', x: 'Rundet auf das nächste Vielfache von 0,5 auf – praktisch für Preise.' } },
    POTENZ: { kurz: '=POTENZ(2;10)', lang: { t: { A1: 'Bits', A2: '8' }, f: '=POTENZ(2;A2)', x: 'Mit 8 Bit lassen sich 2 hoch 8 verschiedene Werte darstellen.' } },
    PRODUKT: { kurz: '=PRODUKT(2;3;4)', lang: { t: { A1: 'Länge', B1: 'Breite', C1: 'Höhe', A2: '4', B2: '2,5', C2: '3' }, f: '=PRODUKT(A2:C2)', x: 'Multipliziert alle Zahlen eines Bereichs: das Volumen eines Quaders.' } },
    QUOTIENT: { kurz: '=QUOTIENT(17;5)', lang: { t: { A1: 'Eier', B1: 'pro Packung', A2: '40', B2: '6' }, f: '=QUOTIENT(A2;B2)', x: 'Nur der ganzzahlige Anteil: Aus 40 Eiern werden 6 volle Packungen.' } },
    REST: { kurz: '=REST(17;5)', lang: { t: { A1: 'Zahl', A2: '27' }, f: '=REST(A2;2)', x: 'Der Rest beim Teilen. Rest 1 beim Teilen durch 2 heißt: die Zahl ist ungerade.' } },
    RUNDEN: { kurz: '=RUNDEN(3,456;1)', lang: { t: { A1: 'V1', B1: 'V2', C1: 'V3', A2: '4,12', B2: '4,35', C2: '4,28' }, f: '=RUNDEN(MITTELWERT(A2:C2);2)', x: 'Rundet kaufmännisch – hier den Durchschnitt auf 2 Nachkommastellen.' } },
    SUMME: { kurz: '=SUMME(1;2;3)', lang: { t: { A1: 'Punkte', A2: '12', A3: '8', A4: '15', A5: '9' }, f: '=SUMME(A2:A5)', z: 'A6', x: 'Addiert alle Zahlen im Bereich A2 bis A5. Leere Zellen und Texte werden übersprungen.' } },
    VORZEICHEN: { kurz: '=VORZEICHEN(-3)', lang: { t: { A1: 'Änderung', A2: '-12' }, f: '=VORZEICHEN(A2)', x: 'Liefert 1 (positiv), 0 oder −1 (negativ).' } },
    WURZEL: { kurz: '=WURZEL(81)', lang: { t: { A1: 'Fläche (m²)', A2: '49' }, f: '=WURZEL(A2)', x: 'Ein quadratischer Raum mit 49 m² hat eine Seitenlänge von 7 m.' } },
    ZUFALLSZAHL: { kurz: '=ZUFALLSZAHL()', lang: { t: {}, f: '=GANZZAHL(ZUFALLSZAHL()*6)+1', z: 'A1', x: 'Ein Würfel: Zufallszahl von 0 bis unter 1, mal 6, abrunden, plus 1. Bei jeder Änderung wird neu gewürfelt.' } },
    ZUFALLSBEREICH: { kurz: '=ZUFALLSBEREICH(1;6)', lang: { t: { A1: 'von', B1: 'bis', A2: '1', B2: '100' }, f: '=ZUFALLSBEREICH(A2;B2)', x: 'Eine ganze Zufallszahl zwischen den beiden Grenzen (beide eingeschlossen).' } },

    ANZAHL: { kurz: '=ANZAHL(4;"x";7)', lang: { t: { A1: 'Spieler', B1: 'Punkte', A2: 'Lena', B2: '1250', A3: 'Paul', B3: '980', A4: 'Tim' }, f: '=ANZAHL(B2:B4)', z: 'B5', x: 'Zählt nur Zellen mit Zahlen. Tim hat noch keine Punkte – er zählt nicht mit.' } },
    MAX: { kurz: '=MAX(4;9;2)', lang: { t: { A1: 'Weite (m)', A2: '4,12', A3: '4,35', A4: '4,28' }, f: '=MAX(A2:A4)', z: 'A5', x: 'Der größte Wert im Bereich – der beste Sprung.' } },
    MIN: { kurz: '=MIN(4;9;2)', lang: { t: { A1: 'Zeit (s)', A2: '13,2', A3: '12,8', A4: '14,1' }, f: '=MIN(A2:A4)', z: 'A5', x: 'Der kleinste Wert im Bereich – die schnellste Zeit.' } },
    MITTELWERT: { kurz: '=MITTELWERT(2;4;9)', lang: { t: { A1: 'Note', A2: '2', A3: '3', A4: '1', A5: '' }, f: '=MITTELWERT(A2:A5)', z: 'A6', x: 'Der Durchschnitt: Summe geteilt durch die Anzahl der Zahlen. Die leere Zelle A5 zählt nicht mit.' } },
    SUMMEWENN: { kurz: '=SUMMEWENN(A2:A4;"Obst";B2:B4)', lang: { t: { A1: 'Art', B1: 'Preis', A2: 'Obst', B2: '1,5', A3: 'Getränk', B3: '2', A4: 'Obst', B4: '0,9' }, f: '=SUMMEWENN(A2:A4;"Obst";B2:B4)', z: 'B5', x: 'Addiert die Preise nur in den Zeilen, in denen in Spalte A „Obst“ steht.' } },
    'ZÄHLENWENN': { kurz: '=ZÄHLENWENN(A2:A6;">=4")', lang: { t: { A1: 'Note', A2: '2', A3: '5', A4: '3', A5: '4', A6: '1' }, f: '=ZÄHLENWENN(A2:A6;">=4")', z: 'A7', x: 'Zählt, wie viele Zellen das Kriterium erfüllen: hier Noten 4 oder schlechter. Das Kriterium steht in Anführungszeichen.' } },

    WENN: { kurz: '=WENN(5>3;"ja";"nein")', lang: { t: { A1: 'Punkte', B1: 'Ergebnis', A2: '17' }, f: '=WENN(A2>=20;"bestanden";"nicht bestanden")', z: 'B2', x: 'Prüft eine Bedingung. Ist sie WAHR, kommt der Dann-Wert heraus, sonst der Sonst-Wert. Ändere A2 auf 20 – was passiert?' } },
    UND: { kurz: '=UND(WAHR;FALSCH)', lang: { t: { A1: 'Alter', B1: 'Größe (cm)', A2: '12', B2: '145' }, f: '=UND(A2>=10;B2>=140)', z: 'C2', x: 'Darf ins Fahrgeschäft? Nur WAHR, wenn alle Bedingungen erfüllt sind.' } },
    ODER: { kurz: '=ODER(WAHR;FALSCH)', lang: { t: { A1: 'Tag', A2: 'Sa' }, f: '=ODER(A2="Sa";A2="So")', z: 'B2', x: 'Wochenende? WAHR, wenn mindestens eine Bedingung erfüllt ist.' } },
    NICHT: { kurz: '=NICHT(WAHR)', lang: { t: { A1: 'bezahlt?', A2: 'FALSCH' }, f: '=NICHT(A2)', z: 'B2', x: 'Kehrt einen Wahrheitswert um: aus FALSCH wird WAHR („noch offen“).' } },

    CODE: { kurz: '=CODE("A")', lang: { t: { A1: 'Zeichen', A2: 'a' }, f: '=CODE(A2)', z: 'B2', x: 'Die Nummer eines Zeichens im Zeichensatz: „a“ hat die 97.' } },
    FINDEN: { kurz: '=FINDEN("o";"Hallo")', lang: { t: { A1: 'E-Mail', A2: 'lena@schule.de' }, f: '=FINDEN("@";A2)', z: 'B2', x: 'An welcher Stelle steht das @? FINDEN unterscheidet Groß- und Kleinbuchstaben.' } },
    GROSS: { kurz: '=GROSS("info")', lang: { t: { A1: 'Name', A2: 'Fatima' }, f: '=GROSS(LINKS(A2;3))', z: 'B2', x: 'Ein Kürzel aus den ersten drei Buchstaben, in GROSSBUCHSTABEN.' } },
    IDENTISCH: { kurz: '=IDENTISCH("Abc";"abc")', lang: { t: { A1: 'Passwort', B1: 'Eingabe', A2: 'Banane42', B2: 'banane42' }, f: '=IDENTISCH(A2;B2)', z: 'C2', x: 'Prüft, ob zwei Texte genau gleich sind – auch Groß/klein muss stimmen.' } },
    KLEIN: { kurz: '=KLEIN("HALLO")', lang: { t: { A1: 'Benutzer', A2: 'Max.Muster' }, f: '=KLEIN(A2)&"@schule.de"', z: 'B2', x: 'Alles in Kleinbuchstaben, dann eine Adresse daraus bauen.' } },
    'LÄNGE': { kurz: '=LÄNGE("Banane")', lang: { t: { A1: 'Passwort', A2: 'gorilla7' }, f: '=WENN(LÄNGE(A2)>=8;"ok";"zu kurz")', z: 'B2', x: 'Zählt die Zeichen – hier für einen Passwort-Check.' } },
    LINKS: { kurz: '=LINKS("Banane";3)', lang: { t: { A1: 'Kennzeichen', A2: 'M-AB 123' }, f: '=LINKS(A2;1)', z: 'B2', x: 'Die ersten Zeichen von links: der Ort im Kennzeichen.' } },
    RECHTS: { kurz: '=RECHTS("Banane";2)', lang: { t: { A1: 'Datei', A2: 'bericht.pdf' }, f: '=RECHTS(A2;3)', z: 'B2', x: 'Die letzten Zeichen von rechts: die Dateiendung.' } },
    TEIL: { kurz: '=TEIL("Banane";3;2)', lang: { t: { A1: 'Artikelnr.', A2: 'DE-4711-X' }, f: '=TEIL(A2;4;4)', z: 'B2', x: 'Zeichen aus der Mitte: ab Stelle 4 genau 4 Zeichen.' } },
    VERKETTEN: { kurz: '=VERKETTEN("Ba";"na";"ne")', lang: { t: { A1: 'Vorname', B1: 'Nachname', A2: 'Lena', B2: 'Huber' }, f: '=VERKETTEN(B2;", ";A2)', z: 'C2', x: 'Hängt beliebig viele Texte aneinander – wie das Zeichen &.' } },
    TEXTKETTE: { kurz: '=TEXTKETTE("Ba";"na";"ne")', lang: { t: { A1: 'Straße', B1: 'Nr.', A2: 'Bahnhofstr.', B2: '12' }, f: '=TEXTKETTE(A2;" ";B2)', z: 'C2', x: 'Neuere Schreibweise von VERKETTEN; funktioniert genauso.' } },
    WECHSELN: { kurz: '=WECHSELN("Banane";"a";"o")', lang: { t: { A1: 'Telefon', A2: '0821/12345' }, f: '=WECHSELN(A2;"/";" ")', z: 'B2', x: 'Ersetzt einen Text durch einen anderen – hier den Schrägstrich durch ein Leerzeichen.' } },
    ZEICHEN: { kurz: '=ZEICHEN(65)', lang: { t: { A1: 'Code', A2: '72' }, f: '=ZEICHEN(A2)&ZEICHEN(105)', z: 'B2', x: 'Das Zeichen zu einer Nummer – das Gegenstück zu CODE.' } },

    DATUM: { kurz: '=TAG(DATUM(2026;10;30))', lang: { t: { A1: 'Jahr', B1: 'Monat', C1: 'Tag', A2: '2026', B2: '12', C2: '24' }, f: '=WOCHENTAG(DATUM(A2;B2;C2);2)', z: 'D2', x: 'DATUM baut aus Jahr, Monat und Tag ein Datum (intern eine Tageszahl). Hier: Welcher Wochentag ist Heiligabend? 1 = Montag … 7 = Sonntag.' } },
    HEUTE: { kurz: '=JAHR(HEUTE())', lang: { t: { A1: 'Geburtsjahr', A2: '2012' }, f: '=JAHR(HEUTE())-A2', z: 'B2', x: 'HEUTE() hat keinen Parameter und liefert das heutige Datum. So wird das Alter in diesem Jahr ausgerechnet.' } },
    JAHR: { kurz: '=JAHR(DATUM(2026;5;1))', lang: { t: {}, f: '=JAHR(HEUTE())', z: 'A1', x: 'Das Jahr eines Datums.' } },
    JETZT: { kurz: '=STUNDE(JETZT())', lang: { t: {}, f: '=STUNDE(JETZT())&":"&MINUTE(JETZT())', z: 'A1', x: 'JETZT() liefert Datum und Uhrzeit; STUNDE und MINUTE holen die Uhrzeit heraus.' } },
    MINUTE: { kurz: '=MINUTE(ZEIT(9;45;0))', lang: { t: { A1: 'Start (h)', B1: 'Start (min)', A2: '7', B2: '55' }, f: '=MINUTE(ZEIT(A2;B2+20;0))', z: 'C2', x: '20 Minuten nach 7:55 – die Minute der neuen Uhrzeit ist 15.' } },
    MONAT: { kurz: '=MONAT(DATUM(2026;10;30))', lang: { t: {}, f: '=MONAT(HEUTE())', z: 'A1', x: 'Der Monat eines Datums als Zahl von 1 bis 12.' } },
    SEKUNDE: { kurz: '=SEKUNDE(ZEIT(0;1;30))', lang: { t: {}, f: '=SEKUNDE(ZEIT(0;0;95))', z: 'A1', x: '95 Sekunden sind 1 Minute und 35 Sekunden – SEKUNDE liefert die 35.' } },
    STUNDE: { kurz: '=STUNDE(ZEIT(14;30;0))', lang: { t: { A1: 'Minuten', A2: '150' }, f: '=STUNDE(ZEIT(0;A2;0))', z: 'B2', x: '150 Minuten sind 2 Stunden (und 30 Minuten).' } },
    TAG: { kurz: '=TAG(DATUM(2026;10;30))', lang: { t: {}, f: '=TAG(HEUTE())', z: 'A1', x: 'Der Tag im Monat (1 bis 31).' } },
    WOCHENTAG: { kurz: '=WOCHENTAG(DATUM(2026;10;30);2)', lang: { t: {}, f: '=WENN(WOCHENTAG(HEUTE();2)>5;"Wochenende";"Schultag")', z: 'A1', x: 'Mit Typ 2 ist Montag = 1 und Sonntag = 7. Ohne Typ zählt Sonntag als 1.' } },
    ZEIT: { kurz: '=STUNDE(ZEIT(9;45;0))', lang: { t: { A1: 'Stunde', B1: 'Minute', A2: '9', B2: '45' }, f: '=ZEIT(A2;B2;0)*24*60', z: 'C2', x: 'ZEIT baut eine Uhrzeit (intern ein Teil eines Tages). Mal 24 mal 60 ergibt die Minuten seit Mitternacht.' } },
};

function calc(cells, f, z) {
    const sh = new E.Sheet(30, 10, Object.assign({}, cells, { [z]: f }));
    return E.display(sh.value(z));
}
function table(cells, f, z) {
    const keys = Object.keys(cells).concat([z]);
    let mr = 0, mc = 0;
    keys.forEach(a => { const p = E.parseAddr(a); mr = Math.max(mr, p.r); mc = Math.max(mc, p.c); });
    const sh = new E.Sheet(30, 10, Object.assign({}, cells, { [z]: f }));
    let h = '<table class="hb-table"><tr><th></th>' + Array.from({ length: mc + 1 }, (_, c) => `<th>${E.colName(c)}</th>`).join('') + '</tr>';
    for (let r = 0; r <= mr; r++) {
        h += `<tr><th>${r + 1}</th>`;
        for (let c = 0; c <= mc; c++) {
            const a = E.addr(r, c), v = sh.value(a);
            h += `<td class="${a === z ? 'hb-res' : ''}${typeof v === 'number' ? ' num' : ''}">${esc(E.display(v))}</td>`;
        }
        h += '</tr>';
    }
    return h + '</table>';
}
/** Zielzelle des großen Beispiels: angegeben, sonst rechts neben der Tabelle in Zeile 2 */
function target(l) {
    if (l.z) return l.z;
    let mc = 0; Object.keys(l.t).forEach(a => mc = Math.max(mc, E.parseAddr(a).c));
    return E.addr(Object.keys(l.t).length ? 1 : 0, Object.keys(l.t).length ? mc + 1 : 0);
}

/** Handbuch öffnen. insert(text): Funktionsanfang in die Eingabezeile schreiben */
export function openHandbuch(insert) {
    const groups = {};
    Object.keys(DFD.OPS).forEach(o => { const g = ['=', '<>', '<', '>', '<=', '>='].includes(o) ? 'Vergleich' : 'Rechenzeichen'; (groups[g] = groups[g] || []).push(o); });
    Object.entries(DFD.F).forEach(([k, v]) => (groups[v.g] = groups[v.g] || []).push(k));
    const order = ['Rechenzeichen', 'Mathematik', 'Statistik', 'Logik', 'Vergleich', 'Text', 'Datum & Zeit'];
    const gl = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
    const entry = name => {
        const ex = EX[name], op = DFD.isOp(name), d = op ? DFD.OPNAME[name] : DFD.F[name].d;
        const sig = op ? `Wert1 ${name} Wert2` : DFD.sig(name);
        const kurz = ex ? `<div class="hb-kurz"><code>${esc(ex.kurz)}</code> → <b>${esc(calc(ex.lang ? ex.lang.t : {}, ex.kurz, 'J30'))}</b></div>` : '';
        return `<li class="hb-item" data-name="${esc(name)}"><button type="button" class="hb-head" aria-expanded="false">
            <span class="hb-name">${esc(name)}</span><span class="hb-sig">${esc(sig)}</span><span class="hb-desc">${esc(d)}</span>${kurz}</button>
            <div class="hb-more" hidden></div></li>`;
    };
    const ov = document.createElement('div'); ov.className = 'hb-backdrop';
    ov.innerHTML = `<div class="hb" role="dialog" aria-modal="true" aria-label="Handbuch der Funktionen">
        <div class="hb-top"><b>fx · Handbuch der Funktionen</b><input type="search" placeholder="suchen, z. B. runden" autocomplete="off" autocapitalize="off"><button type="button" class="fbtn" data-x aria-label="Schließen">✕</button></div>
        <div class="hb-list">${gl.map(g => `<h4>${esc(g)}</h4><ul>${groups[g].map(entry).join('')}</ul>`).join('')}
        <p class="hb-foot">Parameter trennst du mit <code>;</code>, Dezimalzahlen schreibst du mit Komma: <code>1,5</code>. Text steht in Anführungszeichen: <code>"ja"</code>. Optionale Parameter stehen in [ ].</p></div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('[data-x]').onclick = close;
    ov.addEventListener('click', e => {
        if (e.target === ov) return close();
        const ins = e.target.closest('[data-insert]');
        if (ins) { close(); insert(ins.dataset.insert); return; }
        const head = e.target.closest('.hb-head'); if (!head) return;
        const li = head.parentElement, more = li.querySelector('.hb-more'), name = li.dataset.name;
        const open = more.hidden;
        if (open && !more.innerHTML) {
            const ex = EX[name], op = DFD.isOp(name);
            let h = '';
            if (ex && ex.lang) {
                const z = target(ex.lang);
                h += `<div class="hb-ex">${table(ex.lang.t, ex.lang.f, z)}<div class="hb-f"><b>${z}</b>: <code>${esc(ex.lang.f)}</code> → <b>${esc(calc(ex.lang.t, ex.lang.f, z))}</b></div><p>${esc(ex.lang.x)}</p></div>`;
            }
            h += `<button type="button" class="fbtn" data-insert="${esc(op ? name : name + '(')}">${op ? `„${esc(name)}“ einfügen` : `${esc(name)}( in die Formel einfügen`}</button>`;
            more.innerHTML = h;
        }
        more.hidden = !open; head.setAttribute('aria-expanded', String(open));
        if (open) setTimeout(() => li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    });
    const s = ov.querySelector('input[type=search]');
    s.addEventListener('input', () => {
        const q = s.value.trim().toUpperCase();
        ov.querySelectorAll('.hb-item').forEach(li => li.hidden = !!q && !li.textContent.toUpperCase().includes(q));
        ov.querySelectorAll('.hb-list h4').forEach(h => { const ul = h.nextElementSibling; h.hidden = ![...ul.children].some(li => !li.hidden); });
    });
}
export const _test = { EX, calc, target };
