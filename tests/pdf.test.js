const test = require('node:test'), assert = require('node:assert');
const { pdfText } = require('../lib/pdftext.js');
const { parseReceipt } = require('../parse.js');
function makePdf(lines) {
  const stream = 'BT /F1 12 Tf 50 750 Td 14 TL ' + lines.map(l => `(${l}) Tj T*`).join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n', off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
test('PDF text layer feeds the receipt parser', async () => {
  const t = await pdfText(makePdf(['Qantas Airways', 'Date: 2027-04-12', 'Total paid EUR 1,234.50']));
  assert.match(t, /Qantas/);
  const r = parseReceipt('From: x\n' + t);
  assert.equal(r.amount, 1234.5); assert.equal(r.currency, 'EUR'); assert.equal(r.date, '2027-04-12');
  assert.equal(await pdfText(Buffer.from('not a pdf')), '');
});
