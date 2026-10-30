// Setzt den FlowPad-Adapter (tools/lernpfad-adapter.js) in einen Informatik-9-Lernpfad ein.
// Aufruf: node tools/adapt-lernpfad.mjs <lernpfad.html> [ziel.html]
// Der Lernpfad funktioniert danach weiter allein (z. B. in Moodle) und nutzt in FlowPad Tabelle und Diagramm links.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [src, dst] = process.argv.slice(2);
if (!src) { console.error('Aufruf: node tools/adapt-lernpfad.mjs <lernpfad.html> [ziel.html]'); process.exit(1); }
let html = fs.readFileSync(src, 'utf8');
const A = '<!-- FlowPad-Adapter -->', B = '<!-- /FlowPad-Adapter -->';
html = html.replace(new RegExp(A + '[\\s\\S]*?' + B + '\\n?', 'g'), '');
if (!/window\.LP\s*=/.test(html)) { console.error('Kein Informatik-9-Lernpfad (window.LP fehlt).'); process.exit(1); }
// FlowPad schickt keine Daten an fremde Server: Google Fonts durch die Schriften von FlowPad ersetzen (liegen in fonts/)
const FONTS = `<style>/* Schriften von FlowPad (lokal) */
@font-face { font-family: "Atkinson Hyperlegible"; src: url(../../fonts/AtkinsonHyperlegible-Regular.ttf) format("truetype"); font-weight: 400; }
@font-face { font-family: "Atkinson Hyperlegible"; src: url(../../fonts/AtkinsonHyperlegible-Bold.ttf) format("truetype"); font-weight: 700; }
@font-face { font-family: "JetBrains Mono"; src: url(../../fonts/JetBrainsMono.ttf) format("truetype"); font-weight: 100 800; }
@font-face { font-family: "Pixelify Sans"; src: url(../../fonts/PixelifySans.ttf) format("truetype"); font-weight: 400 700; }
</style>`;
html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/gi, '');
if (!html.includes('Schriften von FlowPad (lokal)')) html = html.replace(/<\/head>/i, FONTS + '\n</head>');
const code = fs.readFileSync(path.join(here, 'lernpfad-adapter.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const block = `${A}\n<script>\n${code}</script>\n${B}\n`;
const i = html.lastIndexOf('</body>');
html = i >= 0 ? html.slice(0, i) + block + html.slice(i) : html + block;
fs.writeFileSync(dst || src, html);
console.log(`FlowPad-Adapter eingesetzt: ${dst || src}`);
