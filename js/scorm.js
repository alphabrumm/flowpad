// FlowPad als SCORM-Lernpaket (z. B. in der ByCS-Lernplattform / Moodle)
//
// FlowPad läuft dann im Fenster des Lernpakets und findet dort das SCORM-API von Moodle.
// Der Lernpfad selbst steckt in einem abgeschotteten iframe (sandbox ohne allow-same-origin) und
// kommt an dieses API nicht heran. Er bekommt deshalb einen Stellvertreter (window.API), der Lesewerte
// aus einem Zwischenspeicher liefert und jede Änderung über postMessage an FlowPad schickt;
// FlowPad trägt sie in das echte API ein. Es gehen keine Daten an andere Server als die Lernplattform.

let API = null;
const cache = {};
const t0 = Date.now();

export function scormStart() {
    try { let w = window; for (let n = 0; w && n < 12; n++) { if (w.API) { API = w.API; break; } if (w === w.parent) break; w = w.parent; } } catch (e) { }
    try { if (!API && window.opener && window.opener.API) API = window.opener.API; } catch (e) { }
    if (!API) return false;
    try { API.LMSInitialize(''); } catch (e) { API = null; return false; }
    for (const k of ['cmi.suspend_data', 'cmi.core.lesson_status', 'cmi.core.student_name', 'cmi.core.score.raw', 'cmi.interactions._count']) {
        try { cache[k] = String(API.LMSGetValue(k) || ''); } catch (e) { cache[k] = ''; }
    }
    if (!cache['cmi.core.lesson_status'] || cache['cmi.core.lesson_status'] === 'not attempted') set('cmi.core.lesson_status', 'incomplete');
    addEventListener('pagehide', finish);
    return true;
}

export const scormActive = () => !!API;
export const scormStudent = () => cache['cmi.core.student_name'] || '';

function set(k, v) { cache[k] = v; try { API.LMSSetValue(k, v); } catch (e) { } }

/** Skript für den Kopf des Lernpfads: Stellvertreter-API (leer, wenn FlowPad nicht als Lernpaket läuft) */
export function scormStub() {
    if (!API) return '';
    const c = JSON.stringify(cache).replace(/</g, '\\u003c');
    return `<script>(function(){var c=${c};function p(o,k,v){parent.postMessage({type:"flowpad-scorm",op:o,k:k,v:v},"*");}`
        + `window.API={LMSInitialize:function(){return "true";},LMSGetValue:function(k){return Object.prototype.hasOwnProperty.call(c,k)?c[k]:"";},`
        + `LMSSetValue:function(k,v){v=String(v);c[k]=v;var m=/^cmi\\.interactions\\.(\\d+)\\.id$/.exec(k);if(m&&+m[1]>=(+c["cmi.interactions._count"]||0))c["cmi.interactions._count"]=String(+m[1]+1);p("set",k,v);return "true";},`
        + `LMSCommit:function(){p("commit");return "true";},LMSFinish:function(){p("commit");return "true";},`
        + `LMSGetLastError:function(){return "0";},LMSGetErrorString:function(){return "";},LMSGetDiagnostic:function(){return "";}};})();<\/script>`;
}

/** Nachricht des Stellvertreters aus dem Lernpfad */
export function scormMessage(m) {
    if (!API) return;
    if (m.op === 'set' && typeof m.k === 'string' && /^cmi\./.test(m.k)) {
        // Sitzungsende meldet FlowPad selbst (der Lernpfad-Rahmen wird auch beim Umschalten neu aufgebaut)
        if (m.k === 'cmi.core.exit' || m.k === 'cmi.core.session_time') return;
        if (m.k === 'cmi.interactions._count') return;
        set(m.k, String(m.v));
        const mi = /^cmi\.interactions\.(\d+)\.id$/.exec(m.k);
        if (mi) { const n = +mi[1] + 1; if (n > (+cache['cmi.interactions._count'] || 0)) cache['cmi.interactions._count'] = String(n); }
    } else if (m.op === 'commit') { try { API.LMSCommit(''); } catch (e) { } }
}

function finish() {
    if (!API) return;
    const s = Math.round((Date.now() - t0) / 1000), hh = String(Math.floor(s / 3600)).padStart(4, '0'), mm = String(Math.floor(s / 60) % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    try {
        API.LMSSetValue('cmi.core.session_time', `${hh}:${mm}:${ss}`);
        API.LMSSetValue('cmi.core.exit', 'suspend');
        API.LMSCommit(''); API.LMSFinish('');
    } catch (e) { }
    API = null;
}
