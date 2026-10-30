// FlowPad bauen: die App-Dateien aus dem Hauptverzeichnis nach dist/ kopieren, FlowCode-Liste und Lernpfad-Index erzeugen, Service Worker mit Dateiliste schreiben.
// Aufruf: node tools/build.mjs [zielordner]   – braucht nur Node (keine Pakete).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Was zur App gehört (alles andere – tools/, .github/, Doku – bleibt draußen)
const APP = ['index.html', 'css', 'js', 'fonts', 'learn', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
const out = path.resolve(process.argv[2] || path.join(root, 'dist'));
const KLASSEN = [9, 10, 11, 12, 13];
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// gleiche Rechnung wie js/flowcode.js und learn/flowcode.php
function flowcode(rel) {
    let h = 0x811c9dc5;
    for (const b of Buffer.from(rel, 'utf8')) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    let c = ''; for (let i = 0; i < 5; i++) { c += ALPHABET[h & 31]; h >>>= 5; } return c;
}
const copy = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); if (fs.statSync(s).isDirectory()) copy(s, d); else fs.copyFileSync(s, d); } };

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of APP) { const s = path.join(root, f), d = path.join(out, f); if (fs.statSync(s).isDirectory()) copy(s, d); else fs.copyFileSync(s, d); }

// Lernpfade und FlowCodes
const codes = {}, index = [], seen = {};
for (const k of KLASSEN) {
    const dir = path.join(out, 'learn', String(k));
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
        if (!/\.(json|zip|html?)$/i.test(f)) continue;
        const rel = `${k}/${f}`, code = flowcode(rel);
        if (codes[code]) console.warn(`Achtung: doppelter FlowCode ${code} für ${rel} und ${codes[code]} – Datei umbenennen!`);
        codes[code] = rel;
        let title = f.replace(/\.(flowpad\.json|json|html?|zip)$/i, '').replace(/[_-]+/g, ' ');
        const text = /\.html?$/i.test(f) ? fs.readFileSync(path.join(dir, f), 'utf8') : '';
        const m = text.match(/<title[^>]*>([^<]*)<\/title>/i); if (m) title = m[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        index.push({ path: 'learn/' + rel, folder: String(k), code, title, kind: path.extname(f).slice(1).toLowerCase() });
        seen[code] = (seen[code] || 0) + 1;
    }
}
// Listen auch ins Hauptverzeichnis schreiben: So funktionieren FlowCodes auch ohne Bauen (z. B. Pages „Deploy from branch“)
for (const base of [out, root]) {
    fs.writeFileSync(path.join(base, 'learn', 'flowcodes.json'), JSON.stringify(codes, null, 1) + '\n');
    fs.writeFileSync(path.join(base, 'learn', 'index.json'), JSON.stringify(index, null, 1) + '\n');
}
for (const e of index) console.log(`${e.code}  ${e.path}`);

// Service Worker: App-Dateien für die Offline-Nutzung (Lernpfade unter learn/ werden immer frisch geladen)
const files = [];
(function walk(d, rel) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), r = rel ? rel + '/' + f : f; if (fs.statSync(p).isDirectory()) { if (r !== 'learn') walk(p, r); } else if (!/\.(php|md|txt)$/.test(f) && f !== 'sw.js') files.push(r); } })(out, '');
const hash = crypto.createHash('sha256'); for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(out, f)));
const version = hash.digest('hex').slice(0, 12);
fs.writeFileSync(path.join(out, 'sw.js'), `// erzeugt von tools/build.mjs
const CACHE = 'flowpad-${version}';
const FILES = ${JSON.stringify(['./', ...files])};
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Lernpfade und Listen: zuerst das Netz, offline der zuletzt geladene Stand
  if (u.pathname.includes('/learn/')) { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request))); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
`);
console.log(`FlowPad gebaut nach ${out} (Version ${version}, ${files.length} Dateien).`);
