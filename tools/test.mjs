// Kleine Selbsttests ohne Browser: node tools/test.mjs
import assert from 'node:assert/strict';
import E from '../js/engine.js';
import DFD from '../js/dfd.js';
import { toExcelFormula, fromExcelFormula } from '../js/zip.js';
import { flowcodeOf } from '../js/flowcode.js';

let n = 0; const t = (name, fn) => { fn(); n++; };
const ctx = (raw, cell = 'Z30') => ({ raw, rows: 30, cols: 26, cell });

t('Formel → Diagramm → Formel (Hin und zurück)', () => {
    for (const f of ['=B2*C2', '=B1-B1*B2', '=RUNDEN(MITTELWERT(B2:D2);1)', '=MAX(B2:B9)-MIN(B2:B9)', '=WENN(SUMME(B2:B6)>=100;SUMME(B2:B6)*0,9;SUMME(B2:B6))',
        '=GROSS(LINKS(B2;3))', '=B2*$C$1', '=(B2+C2)/2', '=B2-(C2-D2)', '=2^B2', '=-B2+3', '=SUMMEWENN(A2:A9;"x";B2:B9)', '=A1&" "&B1']) {
        const m = DFD.fromTerm(f, {});
        const g = DFD.formula(m);
        assert.equal(g.missing, 0, f);
        assert.ok(DFD.compare(g.text, f, ctx({ A1: 'Max', B1: 'Muster', B2: '4', C2: '2,5', D2: '1', A2: 'x', C1: '3' })).ok, f + ' → ' + g.text);
        assert.equal(DFD.ruleCheck(m, g), null, f);
    }
});
t('$-Bezüge bleiben erhalten', () => { assert.equal(DFD.formula(DFD.fromTerm('=B2*$C$1', {})).text, '=B2*$C$1'); });
t('Verteiler bei mehrfachen Eingaben', () => {
    const m = DFD.fromTerm('=B1-B1*B2', { labelOf: r => r === 'B1' ? 'Preis' : 'Rabatt', outRef: 'C1', output: 'Endpreis' });
    assert.equal(m.nodes.filter(x => x.kind === 'split').length, 1);
    assert.deepEqual(m.nodes.filter(x => x.kind === 'in').map(x => x.label).sort(), ['Preis (B1)', 'Rabatt (B2)']);
    assert.equal(m.nodes.find(x => x.kind === 'out').label, 'Endpreis (C1)');
});
t('Vergleich findet Grenzfälle', () => {
    const r = DFD.compare('=WENN(B2>=100;1;0)', '=WENN(B2>100;1;0)', ctx({ B2: '5' }));
    assert.equal(r.ok, false);
});
t('Regeln: Verteiler mit einem Ausgang, doppelte Eingabe', () => {
    const m = { nodes: [{ id: 'n1', kind: 'in', ref: 'B2', label: 'B2' }, { id: 'n2', kind: 'split' }, { id: 'n3', kind: 'out', label: 'C2' }], edges: [{ from: 'n1', to: 'n2', slot: 0 }, { from: 'n2', to: 'n3', slot: 0 }] };
    assert.match(DFD.ruleCheck(m), /Verteiler/);
});
t('Excel-Formeln übersetzen', () => {
    assert.equal(toExcelFormula('=RUNDEN(MITTELWERT(B2:D2);1)*1,5'), 'ROUND(AVERAGE(B2:D2),1)*1.5');
    assert.equal(toExcelFormula('=WENN(A1="a;b";ZÄHLENWENN(B2:B9;">3");0)'), 'IF(A1="a;b",COUNTIF(B2:B9,">3"),0)');
    assert.equal(fromExcelFormula('ROUND(AVERAGE(B2:D2),1)*1.5'), '=RUNDEN(MITTELWERT(B2:D2);1)*1,5');
    assert.equal(fromExcelFormula('_xlfn.CONCAT(A1,"x")'), '=TEXTKETTE(A1;"x")');
});
t('FlowCodes wie JCodes', () => { assert.equal(flowcodeOf('10/JPad-Schafkonstruktor.json'), 'LPANT'); });
t('Engine rechnet', () => { const s = new E.Sheet(10, 6, { B2: '0,9', C2: '14', D2: '=B2*C2' }); assert.ok(Math.abs(s.value('D2') - 12.6) < 1e-9); });
console.log(`${n} Tests bestanden.`);
