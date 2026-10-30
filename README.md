# FlowPad – Tabellenkalkulation und Datenflüsse am iPad

FlowPad ist eine touchfreundliche Web-App für den Informatikunterricht (Informatik 9, LehrplanPLUS Bayern):
**oben eine kleine Tabellenkalkulation, unten das Datenflussdiagramm (DFD) der gewählten Zelle, rechts ein Lernpfad.**

* Formel → DFD: Zelle mit Formel antippen, „Formel → DFD“ zeichnet das Diagramm (Eingaben beschriftet wie „Preis (B2)“).
* DFD → Zelle: Diagramm bauen, „Prüfen“ vergleicht es mit vielen Testwerten, „DFD → Zelle“ schreibt die Formel in die Zelle.
* Lernpfade (HTML/ZIP) reisen in der Projektdatei mit und können FlowPad Aufgaben schicken.
* FlowCodes (5 Zeichen) öffnen Lernprojekte, genau wie die JCodes von JPad.
* Alles läuft lokal im Browser: kein Login, kein Server, keine Daten an Dritte. Projekte werden als Datei gesichert.

Die App liegt in [`app/`](app/), die ausführliche Beschreibung in [`FLOWPAD.md`](FLOWPAD.md).

## Bauen und testen

```
node tools/test.mjs          # Selbsttests (Formel ↔ Diagramm, Excel-Formeln, FlowCodes)
node tools/build.mjs dist    # fertige App nach dist/ (FlowCode-Liste, Lernpfad-Index, Service Worker)
```

Es werden keine Pakete gebraucht, nur Node 18+. Jeder Push auf `main` baut die App und veröffentlicht sie auf GitHub Pages
(Settings → Pages → Source = „GitHub Actions“). Das Paket für einen eigenen Webspace liegt als Artefakt `flowpad-webspace` am Workflow-Lauf.

## Herkunft

Rechenkern (MiniCalc) und DFD-Baukasten stammen aus der DFD-Werkstatt und den Lernpfaden zu Informatik 9.
Bedienkonzept, Lernpfad-Einbettung und Codes folgen JPad und QPad. Schriften: Atkinson Hyperlegible, JetBrains Mono, Pixelify Sans (SIL OFL, in `app/fonts`).
