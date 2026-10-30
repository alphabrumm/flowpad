# FlowPad – Beschreibung für Lehrkräfte und Entwickler

## Oberfläche

| Bereich | Inhalt |
|---|---|
| oben links | Tabelle: Zelle antippen, in der Eingabezeile schreiben, ✓. Der gelbe Knopf **fx** öffnet das Handbuch aller Funktionen (kleines Beispiel in der Liste, angetippt ein größeres mit Tabelle; Ergebnisse rechnet FlowPad live aus, „einfügen“ schreibt den Funktionsnamen in die Formel). Beim Schreiben einer Formel fügt das Antippen einer Zelle ihre Adresse ein. Tasten `= $ ; : ( ) + - * / " < >`, Kopieren/Einfügen (Bezüge verschieben sich), ↓/→ Ausfüllen, Formeln zeigen. |
| unten links | Datenflussdiagramm **der gewählten Zelle**. Jede Zelle hat ihr eigenes Diagramm (kleines Dreieck in der Zelle). |
| rechts | Lernpfad (nur, wenn das Projekt einen hat). Breiter/schmaler und „nur Lernpfad“ über die Knöpfe im Kopf. |
| unten (iPad hochkant, Handy) | Umschalten zwischen Lernpfad, Tabelle und Diagramm. |

Trennlinie zwischen Tabelle und Diagramm lässt sich ziehen (wird gemerkt).

### Schulnotation im Diagramm
Eingaben und Ausgabe in Rechtecken, Funktionen **und Rechenzeichen** in Ellipsen, Konstanten als reine Zahl,
Verteiler als gefüllter Punkt. Aus jedem Baustein geht nur ein Pfeil; mehrfach gebrauchte Daten gehen über einen Verteiler.
Eingaben heißen „Name (Zelle)“, z. B. **Preis (B2)**: Der Name kommt aus dem Spaltenkopf (lückenlos darüber) oder,
wenn es keinen gibt, aus der Beschriftung links in derselben Zeile. `$`-Bezüge bleiben erhalten (`Satz ($B$6)`).

### Knöpfe im Diagramm
* **Formel → DFD** – zeichnet das Diagramm zur Formel der Zelle (gleiche Teilausdrücke werden nur einmal berechnet und verteilt).
* **DFD → Zelle** – schreibt die Formel des Diagramms in die Zelle und rechnet. Stand vorher eine andere Formel in der Zelle,
  vergleicht FlowPad beide und meldet, ob sie gleich rechnen (Rückgängig mit ↶).
* **Prüfen** – Regeln der Notation (fehlende Pfeile, Verteiler mit nur einem Ausgang, doppelte Eingaben, doppelt berechnete Funktionen),
  dann Vergleich mit der Aufgabe bzw. mit der Formel in der Zelle.

Verglichen wird mit mehreren Testbelegungen: zuerst die Werte der Tabelle, dann andere Zahlen in den Eingabezellen und die Konstanten
der Formeln selbst (Grenzfälle wie `>=100` gegen `>100`). Bei vertauschten Eingängen gibt es einen Tipp.

Bausteine: Eingabe (danach Zelle oben antippen oder über einen Bereich ziehen), Konstante, Funktion (Katalog mit allen Funktionen der
DFD-Werkstatt und Rechenzeichen), Verteiler, Ausgabe. Verbinden: Baustein antippen, am orangen Pfeil zum Ziel ziehen oder den Pfeil
antippen und dann das Ziel. Ausgewählte Bausteine und Pfeile werden in der gelben Leiste bearbeitet und gelöscht.

## Projekte und Dateien

* Projekte liegen in der IndexedDB dieses Browsers (automatisch gespeichert). **Sichern** lädt `Name.flowpad.json` herunter.
* Menü → Tabelle: **Als Excel-Datei (.xlsx) sichern** (Formeln werden ins englische Excel-Format übersetzt, Excel/Numbers rechnen neu)
  und **Excel-Datei übernehmen** (erstes Tabellenblatt, Formeln werden zurück übersetzt).
* Auf dem Home-Bildschirm installiert läuft FlowPad offline (Service Worker) und Safari löscht die Projekte nicht.

### Projektdatei (`.flowpad.json`)
```json
{
  "format": "flowpad", "version": 1, "name": "Pausenverkauf",
  "sheet": { "rows": 20, "cols": 8, "cells": { "A1": "Preis", "B2": "0,9", "D2": "=B2*C2" },
             "widths": { "A": 110 }, "fmt": { "B2:B4": "eur" }, "styles": { "A1:E1": "head" }, "edit": ["B2:D9"] },
  "dfds": { "D2": { "nodes": [], "edges": [] } },
  "tasks": { "E2": { "target": "=D2-D2*$B$6", "title": "Endpreis", "prompt": "…", "mode": "diagramm" } },
  "lernpfadHtml": "<!doctype html>…", "lernpfadState": "{}"
}
```
`fmt`: `eur`, `pct`, `d1`, `d2`, `int`. `styles`: `head`, `inp`, `out`. `edit` (optional): nur diese Bereiche sind beschreibbar.
Eine Projektdatei kann also auch Aufgaben und einen Lernpfad mitbringen.

## Lernpfade

Menü → **Lernpfad einbetten** (HTML-Seite oder ZIP mit `index.html` und Bildern; Bilder werden eingebettet) oder per Link:

* `…/?lernpfad=learn/9/Datei.html` (HTML, ZIP oder Projektdatei), `…/?projekt=learn/9/Datei.flowpad.json`, `…/?code=H7K2Q`
* Beim ersten Aufruf entsteht ein neues Projekt, derselbe Link öffnet später das eigene Projekt mit Stand.

Der Lernpfad läuft abgeschottet (kein Zugriff auf FlowPad). Sein `localStorage` (z. B. abgehakte Stationen) wird im Projekt gespeichert.

### Lernpfad-Schnittstelle
Ohne eigenes Skript: Knöpfe mit `data-flowpad` (JSON).

```html
<button data-flowpad='{"action":"sheet","title":"Pausenverkauf","cells":{"A1":"Preis","B2":"0,9"},"select":"B2"}'>Tabelle laden</button>
<button data-flowpad='{"action":"task","cell":"E2","target":"=D2-D2*$B$6","title":"Endpreis","prompt":"…","mode":"diagramm","dfd":"leer"}'>Aufgabe öffnen</button>
<button data-flowpad='{"action":"dfd","cell":"B8","term":"=RUNDEN(SUMME(E2:E4);1)"}'>Diagramm zeigen</button>
<button data-flowpad='{"action":"select","cell":"D2"}'>Zu D2</button>
<div data-flowpad-cell="E2">… bekommt die Klasse flowpad-ok / flowpad-bad, sobald FlowPad ein Ergebnis meldet …</div>
```

| Aktion | Felder |
|---|---|
| `sheet` | `cells`, optional `rows`, `cols`, `widths`, `fmt`, `styles`, `edit`, `title`, `select`. Ersetzt die Tabelle (fragt nach, wenn schon etwas drinsteht). |
| `task` | `cell`, `target` (Musterformel), `title`, `prompt` (HTML), `mode` (`diagramm`, `formel` oder leer = beides), `dfd: "leer"` (vorhandenes Diagramm entfernen), `tests` (eigene Testbelegungen, z. B. `[{"B2":"Fatima"}]`), optional `cells` usw. wie bei `sheet`. |
| `dfd` | `cell`, `term` – zeigt das Diagramm zu einer Formel (zum Lesen). |
| `select` | `cell` |

Mit Skript: `FlowPad.sheet({...})`, `FlowPad.task({...})`, `FlowPad.select("D2")`, `FlowPad.send(action, {...})` und
`FlowPad.onResult(r => …)`. Ergebnis: `{ type: "flowpad-result", cell, ok, how: "diagramm" | "formel", formula }` –
gemeldet bei **Prüfen**, **DFD → Zelle** und wenn eine Formel direkt in eine Aufgabenzelle geschrieben wird.

## FlowCodes

Wie JCodes: 5 Zeichen aus `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, berechnet aus dem Pfad unter `learn/`
(z. B. `9/FlowPad-Willkommen.html` → `B3JKZ`; FNV-1a 32 Bit, untere 25 Bit). Dateien in `learn/9` … `learn/13`
bekommen ihren Code automatisch. Aufgelöst wird über `learn/flowcode.php` (Webspace mit PHP; ohne Parameter zeigt sie der
Lehrkraft alle Codes mit Links, doppelte rot) oder die beim Bauen erzeugte `learn/flowcodes.json` (GitHub Pages).
`tools/build.mjs` listet die Codes beim Bauen auf.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `index.html`, `css/style.css` | Oberfläche, Themes (Werkstatt mit Bananengelb, Standard, Hacker; hell/dunkel) |
| `js/engine.js` | MiniCalc: Tabellenkalkulation mit deutschen Funktionen (aus der DFD-Werkstatt) |
| `js/dfd.js` | DFD: Katalog, Formel ↔ Diagramm, Layout, Regeln, Vergleich, Zeichenfläche |
| `js/handbuch.js` | Handbuch der Funktionen (fx-Knopf) mit Beispielen |
| `js/grid.js` | Tabellenblatt (Touch, Zeigen, Ausfüllen, Zellen für das Diagramm wählen) |
| `js/main.js` | App: Projekte, Rückgängig, Aufgaben, Lernpfad-Schnittstelle, Menü, Layout |
| `js/store.js` | Projekte in IndexedDB, Projektdatei |
| `js/lernpfad.js` | Lernpfade einlesen (HTML/ZIP/Link), Brücke ins abgeschottete iframe |
| `js/flowcode.js`, `learn/flowcode.php` | FlowCodes |
| `js/zip.js` | ZIP lesen/schreiben, xlsx sichern und öffnen |
| `tools/build.mjs`, `tools/test.mjs` | Bauen, Selbsttests |
