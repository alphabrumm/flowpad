/*
 * FlowPad – Lernpfade (Portierung von QPad/JPad).
 *
 * Ein Lernpfad ist eine HTML-Seite, die in der Projektdatei (Feld `lernpfadHtml`) mitreist und rechts angezeigt wird.
 * Bilder und andere eingebundene Dateien werden als data-URIs direkt ins HTML geschrieben.
 * Der Lernpfad läuft in einem abgeschotteten iframe. Er kann FlowPad nur über eine kleine Nachrichten-Schnittstelle
 * Aufgaben schicken (siehe FLOWPAD.md, Abschnitt „Lernpfad-Schnittstelle“).
 */
import { isZip, readZip } from './zip.js';

const MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
    css: 'text/css', js: 'text/javascript', json: 'application/json', mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', pdf: 'application/pdf', txt: 'text/plain',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const mimeOf = p => MIME[p.split(/[?#]/)[0].split('.').pop().toLowerCase()] || 'application/octet-stream';
function normalize(path) { const out = []; for (const part of path.split('/')) { if (part == '' || part == '.') continue; if (part == '..') out.pop(); else out.push(part); } return out.join('/'); }
const isExternal = ref => /^([a-z][a-z0-9+.-]*:|\/\/|#|\$\{)/i.test(ref) || ref.trim() == '';
export const looksLikeHtml = t => /<(html|body|div|p|h1|h2|section|main)\b/i.test(t);
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }

async function inlineResources(html, resolve, link) {
    const pattern = /(\s(src|href|poster)\s*=\s*)(["'])([^"']*)\3|url\(\s*(["']?)([^"')]+)\5\s*\)/gi;
    const isPage = (attr, ref) => attr && attr.toLowerCase() == 'href' && /\.html?([?#]|$)/i.test(ref);
    const refs = new Set();
    for (const m of html.matchAll(pattern)) { const ref = m[4] ?? m[6]; if (ref && !isExternal(ref) && !isPage(m[2], ref)) refs.add(ref); }
    const resolved = new Map();
    for (const ref of refs) { const uri = await resolve(ref); if (uri) resolved.set(ref, uri); }
    return html.replace(pattern, (all, attr, name, q, ref1, q2, ref2) => {
        if (attr) { if (isExternal(ref1)) return all; const uri = isPage(name, ref1) ? link && link(ref1) : resolved.get(ref1); return uri ? `${attr}${q}${uri}${q}` : all; }
        const uri = resolved.get(ref2); return uri ? `url("${uri}")` : all;
    });
}
async function fromZip(bytes, label) {
    let entries; try { entries = readZip(bytes); } catch (e) { throw new Error(`„${label}“ ist kein lesbares ZIP-Archiv.`); }
    const files = entries.filter(e => !e.name.endsWith('/') && !/(^|\/)(__MACOSX|\.)/.test(e.name));
    const htmlFiles = files.filter(e => /\.html?$/i.test(e.name)).sort((a, b) => a.name.split('/').length - b.name.split('/').length);
    const main = htmlFiles.find(e => /(^|\/)index\.html?$/i.test(e.name)) || htmlFiles[0];
    if (!main) throw new Error(`Im ZIP „${label}“ ist keine HTML-Seite.`);
    const base = main.name.includes('/') ? main.name.substring(0, main.name.lastIndexOf('/') + 1) : '';
    const html = new TextDecoder().decode(await main.read());
    return inlineResources(html, async ref => {
        const path = normalize(base + decodeURIComponent(ref.split(/[?#]/)[0]));
        const entry = files.find(e => e.name == path);
        return entry ? `data:${mimeOf(path)};base64,${b64(await entry.read())}` : null;
    });
}
async function fromUrlHtml(html, url) {
    return inlineResources(html, async ref => {
        const abs = new URL(ref, url).href;
        try { const r = await fetch(abs); if (!r.ok) return abs; const type = (r.headers.get('content-type') || '').split(';')[0] || mimeOf(abs); return `data:${type};base64,${b64(new Uint8Array(await r.arrayBuffer()))}`; }
        catch (e) { return abs; }
    }, ref => new URL(ref, url).href);
}
export function titleOf(html) {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!m) return undefined;
    const div = document.createElement('div'); div.innerHTML = m[1];
    return div.textContent.replace(/\s+/g, ' ').trim() || undefined;
}
export function nameFromUrl(url) {
    const parts = new URL(url, location.href).pathname.split('/').filter(s => s).map(s => decodeURIComponent(s));
    if (parts.length && /^index\.html?$/i.test(parts[parts.length - 1])) parts.pop();
    return (parts.pop() || 'Lernpfad').replace(/\.(flowpad\.json|html?|zip|json)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Lernpfad';
}
export async function readLernpfadFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const html = isZip(bytes) ? await fromZip(bytes, file.name) : new TextDecoder().decode(bytes);
    if (!looksLikeHtml(html)) throw new Error(`„${file.name}“ sieht nicht nach einem Lernpfad (HTML-Seite) aus.`);
    return html;
}
/** Lädt HTML, ZIP oder Projektdatei von einer Adresse → { kind:'html', html, name } | { kind:'project', text, name } */
export async function loadLernpfadUrl(url) {
    let r;
    try { r = await fetch(url, { cache: 'no-cache' }); }
    catch (e) { throw new Error(`FlowPad kann „${url}“ nicht laden. Entweder ist die Adresse falsch, das Gerät offline, oder der Server erlaubt das Laden nicht (CORS). Am einfachsten liegt die Datei auf demselben Server wie FlowPad.`); }
    if (!r.ok) throw new Error(`„${url}“ wurde nicht gefunden (Fehler ${r.status}).`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (isZip(bytes)) { const html = await fromZip(bytes, nameFromUrl(url)); return { kind: 'html', html, name: titleOf(html) || nameFromUrl(url) }; }
    const text = new TextDecoder().decode(bytes);
    if (/^\s*\{/.test(text)) return { kind: 'project', text, name: nameFromUrl(url) };
    if (!looksLikeHtml(text)) throw new Error(`„${url}“ ist weder ein Lernpfad (HTML/ZIP) noch eine FlowPad-Projektdatei.`);
    const html = await fromUrlHtml(text, r.url || url);
    return { kind: 'html', html, name: titleOf(html) || nameFromUrl(url) };
}

/**
 * Vor die Seite gesetzt:
 *  1. localStorage-Ersatz (im abgeschotteten iframe gesperrt): Daten gehen per postMessage an FlowPad und reisen im Projekt mit.
 *  2. Sprunglinks scrollen selbst, externe Links öffnen in einem neuen Tab.
 *  3. window.FlowPad: Aufgaben an FlowPad schicken, Ergebnisse empfangen. Knöpfe mit data-flowpad='{"action":…}' funktionieren ohne eigenes Skript.
 */
export function withBridge(html, state) {
    const st = (state || '{}').replace(/</g, '\\u003c');
    const shim = `<script>(function(){var ok=false;try{ok=!!window.localStorage;}catch(e){}if(ok)return;`
        + `var d=${st};function save(){parent.postMessage({type:"flowpad-lernpfad-storage",state:d},"*");}`
        + `var s={getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null;},`
        + `setItem:function(k,v){d[String(k)]=String(v);save();},removeItem:function(k){delete d[String(k)];save();},`
        + `clear:function(){d={};save();},key:function(i){return Object.keys(d)[i]||null;}};`
        + `Object.defineProperty(s,"length",{get:function(){return Object.keys(d).length;}});`
        + `try{Object.defineProperty(window,"localStorage",{value:s,configurable:true});}catch(e){}})();<\/script>`
        + `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;`
        + `var h=a.getAttribute("href")||"";if(h.charAt(0)=="#"){e.preventDefault();var id=decodeURIComponent(h.slice(1));`
        + `var t=id?(document.getElementById(id)||document.getElementsByName(id)[0]):document.body;if(t)t.scrollIntoView({behavior:"smooth",block:"start"});return;}`
        + `if(/^(https?:|mailto:)/i.test(h)){if(!a.target){e.preventDefault();window.open(a.href,"_blank","noopener");}return;}`
        + `if(!/^(data:|blob:|javascript:)/i.test(h))e.preventDefault();},true);<\/script>`
        + `<script>(function(){var L=[],W={};window.FlowPad={inside:true,`
        + `send:function(action,data){var m={type:"flowpad",action:action};for(var k in data)m[k]=data[k];parent.postMessage(m,"*");},`
        + `getSheet:function(id){var r=String(Math.random()).slice(2);var me=this;return new Promise(function(ok,no){var t=setTimeout(function(){no(new Error("FlowPad antwortet nicht"));},4000);W[r]=function(m){clearTimeout(t);ok(m);};me.send("getSheet",{req:r,id:id});});},`
        + `say:function(text,ok){this.send("say",{text:text,ok:ok});},sheet:function(d){this.send("sheet",d);},task:function(d){this.send("task",d);},select:function(c){this.send("select",{cell:c});},`
        + `onResult:function(f){L.push(f);}};`
        + `window.addEventListener("message",function(e){var m=e.data;if(m&&m.type==="flowpad-sheet"&&W[m.req]){var f=W[m.req];delete W[m.req];f(m);return;}if(!m||m.type!=="flowpad-result")return;`
        + `document.querySelectorAll("[data-flowpad-cell]").forEach(function(el){if(el.getAttribute("data-flowpad-cell")===m.cell){el.classList.toggle("flowpad-ok",!!m.ok);el.classList.toggle("flowpad-bad",!m.ok);}});`
        + `L.forEach(function(f){try{f(m);}catch(x){}});});`
        + `document.addEventListener("click",function(e){var b=e.target&&e.target.closest&&e.target.closest("[data-flowpad]");if(!b)return;e.preventDefault();`
        + `try{var d=JSON.parse(b.getAttribute("data-flowpad"));var a=d.action;delete d.action;window.FlowPad.send(a,d);}catch(x){console.error("data-flowpad: kein gültiges JSON",x);}});})();<\/script>`;
    const m = html.match(/<head[^>]*>/i) || html.match(/<html[^>]*>/i);
    return m ? html.replace(m[0], m[0] + shim) : shim + html;
}
