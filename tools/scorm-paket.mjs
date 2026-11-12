// FlowPad samt Lernpfad als SCORM-Lernpaket (SCORM 1.2) für Moodle / die ByCS-Lernplattform packen.
//
// Aufruf:  node tools/scorm-paket.mjs learn/9/C1-2_Challenge_Bezugs-Hacks-PathFinder.html [ziel.zip]
//
// Im Paket steckt die ganze App (index.html, css, js, fonts, Icons) – ohne Lernpfad-Editor, ohne andere Lernpfade,
// ohne Service Worker. Moodle startet scorm.html; das öffnet FlowPad mit dem Lernpfad des Pakets (?scorm).
// FlowPad meldet dann Punkte (in %), Status und Fortschritt an Moodle (js/scorm.js). Der Lernpfad muss ein
// PathFinder-Lernpfad sein; nur dann kennt er SCORM. Alles läuft im Browser, nichts geht an andere Server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** true, wenn die Datei ein PathFinder-Lernpfad ist, der Ergebnisse an Moodle melden kann */
export const canScorm = html => /startPathFinder\(\{ player: true, scorm: (true|false)/.test(html);

/** Baut das Paket; gibt den Pfad der ZIP-Datei zurück */
export function buildScorm(src, outFile, root = ROOT) {
let lp = fs.readFileSync(path.resolve(src), 'utf8');
if (!canScorm(lp)) throw new Error(`${src}: kein PathFinder-Lernpfad (oder Originaldesign) – kann keine Ergebnisse an Moodle melden`);
lp = lp.replace(/startPathFinder\(\{ player: true, scorm: false/, 'startPathFinder({ player: true, scorm: true');
const base = path.basename(src).replace(/\.html?$/i, '');
const out = path.resolve(outFile || path.join(root, 'dist', 'scorm', base + '_FlowPad_SCORM.zip'));
const title = (lp.match(/<title>([^<]*)<\/title>/i)?.[1] || base).trim();
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const files = {};
const add = (rel, data) => { files[rel.split(path.sep).join('/')] = typeof data === 'string' ? Buffer.from(data, 'utf8') : data; };
const addDir = rel => { for (const f of fs.readdirSync(path.join(root, rel))) { const r = path.join(rel, f); if (fs.statSync(path.join(root, r)).isDirectory()) addDir(r); else add(r, fs.readFileSync(path.join(root, r))); } };
for (const f of ['index.html', 'icon.svg', 'icon-180.png', 'icon-192.png', 'favicon.ico', 'favicon-32.png']) add(f, fs.readFileSync(path.join(root, f)));
for (const d of ['css', 'js', 'fonts']) addDir(d);
const lpFile = 'lernpfad/' + base + '.html';
add(lpFile, lp);
add('scorm.html', `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xml(title)}</title></head>
<body style="font-family:system-ui,sans-serif;background:#1d1b24;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0">FlowPad startet …
<script>location.replace('index.html?scorm&lernpfad=' + encodeURIComponent(${JSON.stringify(lpFile)}));</script></body></html>`);
const res = Object.keys(files).map(f => `<file href="${xml(f)}"/>`).join('');
add('imsmanifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="flowpad-${xml(base.replace(/[^\w-]/g, '-'))}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org1"><organization identifier="org1"><title>${xml(title)}</title>
    <item identifier="item1" identifierref="res1"><title>${xml(title)}</title></item>
  </organization></organizations>
  <resources><resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="scorm.html">${res}</resource></resources>
</manifest>`);

// ZIP ohne Kompression (wie js/zip.js)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const parts = [], central = []; let off = 0;
for (const [name, data] of Object.entries(files)) {
    const nb = Buffer.from(name, 'utf8'), crc = crc32(data), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8); h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nb.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, nb, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nb); off += 30 + nb.length + data.length;
}
const cd = Buffer.concat(central), e = Buffer.alloc(22);
e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([...parts, cd, e]));
return { out, title, files: Object.keys(files).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const src = process.argv[2];
    if (!src) { console.error('Aufruf: node tools/scorm-paket.mjs <lernpfad.html> [ziel.zip]'); process.exit(1); }
    try {
        const r = buildScorm(src, process.argv[3]);
        console.log(`SCORM-Paket: ${path.relative(process.cwd(), r.out)} (${(fs.statSync(r.out).size / 1048576).toFixed(1)} MB, ${r.files} Dateien) – „${r.title}“`);
    } catch (e) { console.error(e.message); process.exit(1); }
}
