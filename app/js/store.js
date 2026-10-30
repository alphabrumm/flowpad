/*
 * FlowPad – Projekte im Browser (IndexedDB) und als Datei (.flowpad.json).
 * Es gibt keinen Server: Was nicht als Datei gesichert wird, bleibt nur auf diesem Gerät.
 */
export const FORMAT = 'flowpad';
export const VERSION = 1;

export function emptySheet(rows = 20, cols = 8) { return { rows, cols, cells: {} }; }
export function newProject(name) {
    return { format: FORMAT, version: VERSION, id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name || 'Neues Projekt', sheet: emptySheet(), dfds: {}, tasks: {}, created: Date.now(), modified: Date.now() };
}
/** Projektdatei prüfen und auf den aktuellen Stand bringen */
export function normalizeProject(p) {
    if (!p || typeof p !== 'object' || (p.format && p.format !== FORMAT) || !p.sheet) throw new Error('Das ist keine FlowPad-Projektdatei.');
    const s = p.sheet;
    s.rows = Math.max(1, Math.min(200, +s.rows || 20)); s.cols = Math.max(1, Math.min(26, +s.cols || 8)); s.cells = s.cells || {};
    return Object.assign({ dfds: {}, tasks: {} }, p, { format: FORMAT, version: VERSION });
}
/** Für die Datei: nur das, was zum Projekt gehört */
export function projectFile(p) {
    const { id, source, format, version, name, sheet, dfds, tasks, ...rest } = p;
    return JSON.stringify({ format, version, name, sheet, dfds, tasks, ...rest }, null, 1);
}

// ---------- IndexedDB ----------
let dbp = null;
function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
        const r = indexedDB.open('flowpad', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('projects', { keyPath: 'id' });
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
}
async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction('projects', mode); const st = t.objectStore('projects'); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); });
}
export const putProject = p => tx('readwrite', st => st.put(p));
export const deleteProject = id => tx('readwrite', st => st.delete(id));
export const getProject = id => tx('readonly', st => st.get(id));
export async function listProjects() {
    const all = await tx('readonly', st => st.getAll());
    return all.map(p => ({ id: p.id, name: p.name, modified: p.modified, source: p.source, lernpfad: !!p.lernpfadHtml })).sort((a, b) => b.modified - a.modified);
}
/** Safari löscht Website-Daten sonst nach längerer Nichtnutzung */
export function persist() { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { } }
