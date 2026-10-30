/*
 * FlowPad – ZIP lesen/schreiben und Tabellen als Excel-Datei (.xlsx) speichern und öffnen.
 * Alles passiert im Browser, nichts wird verschickt.
 */
import E from './engine.js';

export const isZip = b => b.length > 4 && b[0] == 0x50 && b[1] == 0x4b && b[2] == 0x03 && b[3] == 0x04;

async function inflate(data) {
    if (typeof DecompressionStream == 'undefined') throw new Error('Dieser Browser kann komprimierte Dateien nicht entpacken (iPadOS 16.4 oder neuer nötig).');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inhaltsverzeichnis einer ZIP-Datei; Einträge werden erst bei read() entpackt (aus QPad übernommen) */
export function readZip(zip) {
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    let eocd = -1;
    for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) if (dv.getUint32(i, true) == 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Die ZIP-Datei ist beschädigt.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder(), entries = [];
    for (let i = 0; i < count; i++) {
        if (dv.getUint32(p, true) != 0x02014b50) break;
        const method = dv.getUint16(p + 10, true), compSize = dv.getUint32(p + 20, true);
        const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
        const lp = dv.getUint32(p + 42, true);
        const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
        entries.push({
            name, read: async () => {
                const start = lp + 30 + dv.getUint16(lp + 26, true) + dv.getUint16(lp + 28, true);
                const raw = zip.subarray(start, start + compSize);
                return method == 0 ? raw.slice() : await inflate(raw);
            }
        });
        p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}

// ---------- ZIP schreiben (ohne Kompression, genügt für xlsx) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function writeZip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const [name, content] of Object.entries(files)) {
        const data = typeof content === 'string' ? enc.encode(content) : content, nb = enc.encode(name), crc = crc32(data);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
        h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
        h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
        parts.push(new Uint8Array(h.buffer), nb, data);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
        c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
        c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
        central.push(new Uint8Array(c.buffer), nb);
        off += 30 + nb.length + data.length;
    }
    const csize = central.reduce((s, b) => s + b.length, 0), n = Object.keys(files).length;
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}

// ---------- Formeln: deutsch (FlowPad) ↔ Excel-Datei (englisch, Komma, Punkt) ----------
const DE_EN = {
    ABRUNDEN: 'ROUNDDOWN', ABS: 'ABS', ANZAHL: 'COUNT', AUFRUNDEN: 'ROUNDUP', CODE: 'CODE', DATUM: 'DATE', FINDEN: 'FIND', GANZZAHL: 'INT',
    GROSS: 'UPPER', HEUTE: 'TODAY', IDENTISCH: 'EXACT', JAHR: 'YEAR', JETZT: 'NOW', KLEIN: 'LOWER', LINKS: 'LEFT', 'LÄNGE': 'LEN', MAX: 'MAX',
    MIN: 'MIN', MINUTE: 'MINUTE', MITTELWERT: 'AVERAGE', MONAT: 'MONTH', NICHT: 'NOT', OBERGRENZE: 'CEILING', ODER: 'OR', POTENZ: 'POWER',
    PRODUKT: 'PRODUCT', QUOTIENT: 'QUOTIENT', RECHTS: 'RIGHT', REST: 'MOD', RUNDEN: 'ROUND', SEKUNDE: 'SECOND', STUNDE: 'HOUR', SUMME: 'SUM',
    SUMMEWENN: 'SUMIF', TAG: 'DAY', TEIL: 'MID', TEXTKETTE: '_xlfn.CONCAT', UND: 'AND', VERKETTEN: 'CONCATENATE', VORZEICHEN: 'SIGN',
    WECHSELN: 'SUBSTITUTE', WENN: 'IF', WOCHENTAG: 'WEEKDAY', WURZEL: 'SQRT', 'ZÄHLENWENN': 'COUNTIF', ZAEHLENWENN: 'COUNTIF', ZEICHEN: 'CHAR',
    ZEIT: 'TIME', ZUFALLSBEREICH: 'RANDBETWEEN', ZUFALLSZAHL: 'RAND', WAHR: 'TRUE', FALSCH: 'FALSE',
};
const EN_DE = Object.fromEntries(Object.entries(DE_EN).filter(([k]) => k !== 'ZAEHLENWENN').map(([k, v]) => [v.toUpperCase().replace(/^_XLFN\./, ''), k]));
/** Formeltext Zeichen für Zeichen umschreiben: Namen übersetzen, Trennzeichen und Dezimalzeichen tauschen; Texte bleiben. */
function translate(f, toExcel) {
    let out = '', i = 0;
    while (i < f.length) {
        const ch = f[i];
        if (ch === '"') { const j = f.indexOf('"', i + 1); const end = j < 0 ? f.length : j + 1; out += f.slice(i, end); i = end; continue; }
        const rest = f.slice(i); let m;
        if ((m = toExcel ? /^\$?[A-Za-z]{1,3}\$?\d+(?![\w(])/.exec(rest) : /^\$?[A-Za-z]{1,3}\$?\d+(?![\w(])/.exec(rest))) { out += m[0]; i += m[0].length; continue; }
        if ((m = /^[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_.]*/.exec(rest))) {
            const up = toExcel ? m[0].toUpperCase() : m[0].toUpperCase().replace(/^_XLFN\./, ''), map = toExcel ? DE_EN : EN_DE;
            out += map[up] ?? (toExcel ? m[0] : up); i += m[0].length; continue;
        }
        if ((m = toExcel ? /^\d+(,\d+)?/.exec(rest) : /^\d+(\.\d+)?/.exec(rest))) { out += toExcel ? m[0].replace(',', '.') : m[0].replace('.', ','); i += m[0].length; continue; }
        if (toExcel && ch === ';') { out += ','; i++; continue; }
        if (!toExcel && ch === ',') { out += ';'; i++; continue; }
        out += ch; i++;
    }
    return out;
}
export const toExcelFormula = f => translate(String(f).trim().replace(/^=/, ''), true);
export const fromExcelFormula = f => '=' + translate(f, false);

const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Tabellenblatt als .xlsx (Formeln bleiben Formeln, Excel/Numbers rechnen sie beim Öffnen neu). */
export function sheetToXlsx(sheetData, title) {
    const sh = new E.Sheet(sheetData.rows, sheetData.cols, sheetData.cells);
    const rows = {};
    for (const a of Object.keys(sheetData.cells)) { const p = E.parseAddr(a); if (p) (rows[p.r] = rows[p.r] || []).push([p.c, a]); }
    let xmlRows = '';
    for (const r of Object.keys(rows).map(Number).sort((x, y) => x - y)) {
        xmlRows += `<row r="${r + 1}">`;
        for (const [, a] of rows[r].sort((x, y) => x[0] - y[0])) {
            const raw = sheetData.cells[a], v = sh.value(a);
            if (sh.isFormula(a)) {
                const f = xmlEsc(toExcelFormula(raw));
                if (typeof v === 'number') xmlRows += `<c r="${a}"><f>${f}</f><v>${v}</v></c>`;
                else if (typeof v === 'boolean') xmlRows += `<c r="${a}" t="b"><f>${f}</f><v>${v ? 1 : 0}</v></c>`;
                else if (typeof v === 'string') xmlRows += `<c r="${a}" t="str"><f>${f}</f><v>${xmlEsc(v)}</v></c>`;
                else xmlRows += `<c r="${a}"><f>${f}</f></c>`;
            } else if (typeof v === 'number') xmlRows += `<c r="${a}"><v>${v}</v></c>`;
            else if (typeof v === 'boolean') xmlRows += `<c r="${a}" t="b"><v>${v ? 1 : 0}</v></c>`;
            else if (v !== null && v !== undefined) xmlRows += `<c r="${a}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
        }
        xmlRows += '</row>';
    }
    const widths = sheetData.widths || {};
    const cols = Object.keys(widths).length ? `<cols>${Object.entries(widths).map(([c, w]) => { const i = c.charCodeAt(0) - 64; return `<col min="${i}" max="${i}" width="${Math.max(8, Math.round(w / 7))}" customWidth="1"/>`; }).join('')}</cols>` : '';
    const name = xmlEsc((title || 'Tabelle1').replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Tabelle1');
    return writeZip({
        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>`,
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${xmlRows}</sheetData></worksheet>`,
    });
}

/** Erstes Tabellenblatt einer .xlsx-Datei lesen → { cells, rows, cols, title } */
/**
 * Ein Tabellenblatt einer .xlsx-Datei lesen → { cells, rows, cols, title, sheets }.
 * Hat die Datei mehrere Blätter (z. B. „Auftrag“ und „Weitsprung“), wird das Blatt mit den meisten Zahlen und Formeln genommen.
 */
export async function xlsxToSheet(bytes) {
    const entries = readZip(bytes), dec = new TextDecoder();
    const get = async name => { const e = entries.find(x => x.name === name); return e ? dec.decode(await e.read()) : null; };
    const wb = await get('xl/workbook.xml');
    const list = [];
    if (wb) {
        const doc = new DOMParser().parseFromString(wb, 'application/xml');
        const rels = await get('xl/_rels/workbook.xml.rels');
        const rd = rels ? new DOMParser().parseFromString(rels, 'application/xml') : null;
        for (const sh of doc.getElementsByTagName('sheet')) {
            const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
            const rel = rd && [...rd.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
            if (!rel) continue;
            const t = rel.getAttribute('Target').replace(/^\//, '');
            list.push({ title: sh.getAttribute('name') || 'Tabelle', path: t.startsWith('xl/') ? t : 'xl/' + t });
        }
    }
    if (!list.length) list.push({ title: 'Tabelle', path: 'xl/worksheets/sheet1.xml' });
    let best = null;
    for (const s of list) {
        const xml = await get(s.path); if (!xml) continue;
        const r = await readSheet(xml, get);
        r.title = s.title;
        r.score = Object.values(r.cells).filter(v => /^=|^-?\d+(,\d+)?$/.test(v)).length;
        if (!best || r.score > best.score) best = r;
    }
    if (!best) throw new Error('In der Datei wurde kein Tabellenblatt gefunden.');
    best.sheets = list.map(s => s.title);
    return best;
}
async function readSheet(xml, get) {
    const ssXml = await get('xl/sharedStrings.xml');
    const shared = ssXml ? [...new DOMParser().parseFromString(ssXml, 'application/xml').getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const cells = {}; let maxR = 0, maxC = 0, skipped = 0;
    const sharedF = {};
    for (const c of doc.getElementsByTagName('c')) {
        const a = c.getAttribute('r'), p = E.parseAddr(a || '');
        if (!p) { skipped++; continue; }
        const fEl = c.getElementsByTagName('f')[0], vEl = c.getElementsByTagName('v')[0], t = c.getAttribute('t');
        let raw;
        if (fEl) {
            let ftext = fEl.textContent;
            if (fEl.getAttribute('t') === 'shared') {
                const si = fEl.getAttribute('si');
                if (ftext) sharedF[si] = { a, f: ftext };
                else if (sharedF[si]) { const q = E.parseAddr(sharedF[si].a); ftext = E.shiftFormula('=' + sharedF[si].f, p.r - q.r, p.c - q.c).slice(1); }
            }
            raw = fromExcelFormula(ftext);
        } else if (t === 's') raw = shared[+vEl?.textContent] ?? '';
        else if (t === 'inlineStr') raw = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
        else if (t === 'b') raw = vEl?.textContent === '1' ? 'WAHR' : 'FALSCH';
        else if (vEl) { const n = +vEl.textContent; raw = isFinite(n) ? E.fmtNum(Math.round(n * 1e10) / 1e10) : vEl.textContent; }
        if (raw === undefined || raw === '') continue;
        cells[a] = raw; maxR = Math.max(maxR, p.r + 1); maxC = Math.max(maxC, p.c + 1);
    }
    return { cells, rows: maxR, cols: maxC, skipped };
}
