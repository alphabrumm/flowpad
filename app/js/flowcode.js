/*
 * FlowCodes – kurze Codes (5 Zeichen, z. B. „H88HF“), mit denen Schüler ein Lernprojekt öffnen. Wie die JCodes von JPad:
 * Der Code wird aus dem Pfad der Datei unterhalb von learn/ berechnet, z. B. „9/FlowPad-Willkommen.html“
 * (FNV-1a, 32 Bit; die unteren 25 Bit als 5 Zeichen). Er muss also nirgends eingetragen werden.
 * Auflösen: learn/flowcode.php (Webspace mit PHP), sonst die beim Bauen erzeugte Liste learn/flowcodes.json.
 * Gefragt wird nur der eigene Server, von dem FlowPad geladen wurde.
 */
export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const LENGTH = 5;

export function flowcodeOf(rel) {
    let h = 0x811c9dc5;
    for (const b of new TextEncoder().encode(rel)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    let code = '';
    for (let i = 0; i < LENGTH; i++) { code += ALPHABET[h & 31]; h >>>= 5; }
    return code;
}
export const normalizeCode = s => String(s).toUpperCase().replace(/[\s\-_.]/g, '');
export function codeFormatError(code) {
    if (!code.length) return 'Bitte gib den Code ein.';
    if (code.length != LENGTH) return `Ein FlowCode hat genau ${LENGTH} Zeichen.`;
    if (/[0O1I]/.test(code)) return 'In FlowCodes kommen 0, O, 1 und I nicht vor. Schau noch einmal genau hin.';
    if ([...code].some(ch => !ALPHABET.includes(ch))) return 'Der Code enthält ein Zeichen, das es in FlowCodes nicht gibt.';
    return null;
}
/** Pfad (relativ zu FlowPad, z. B. „learn/9/Datei.json“) zum Code suchen */
export async function resolveCode(code) {
    const base = new URL('learn/', location.href);
    const unknown = { error: `Zum Code „${code}“ gibt es kein Projekt. Prüfe die Schreibweise.` };
    try {
        const r = await fetch(new URL('flowcode.php?code=' + encodeURIComponent(code), base), { cache: 'no-store' });
        const text = await r.text();
        if (/^\s*\{/.test(text)) { const j = JSON.parse(text); if (j.path) return { path: 'learn/' + j.path }; if (r.status == 404) return unknown; }
    } catch (e) { /* weiter mit der Liste */ }
    try {
        const r = await fetch(new URL('flowcodes.json', base), { cache: 'no-store' });
        if (r.ok) { const map = await r.json(); return typeof map[code] == 'string' ? { path: 'learn/' + map[code] } : unknown; }
    } catch (e) { }
    return { error: 'Die Liste der Lernprojekte ist gerade nicht erreichbar. Bist du online?' };
}
/** FlowCode zu einer Adresse unter learn/<Klasse>/ (sonst null) */
export function codeOfUrl(url) {
    const m = url && url.match(/(?:^|\/)learn\/(\d{1,2}\/[^/?#\s]+\.(?:json|html?|zip))(?:[?#\s]|$)/);
    return m ? flowcodeOf(decodeURIComponent(m[1])) : null;
}
export async function loadLearnIndex() {
    const r = await fetch(new URL('learn/index.json', location.href), { cache: 'no-store' });
    if (!r.ok) throw new Error(`Die Liste der Lernpfade wurde nicht gefunden (Fehler ${r.status}).`);
    return r.json();
}
