/* PDF receipt text extraction (pdfjs-dist, the only runtime dependency). Text-layer PDFs only; scanned images are not OCR'd. */
let pdfjs = null;
async function pdfText(buf, maxPages = 5) {
  try {
    pdfjs = pdfjs || await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
    let out = '';
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const c = await (await doc.getPage(i)).getTextContent();
      let line = '';
      for (const it of c.items) { line += it.str; if (it.hasEOL) { out += line + '\n'; line = ''; } else line += ' '; }
      out += line + '\n';
    }
    await doc.destroy();
    return out.slice(0, 20000);
  } catch (e) { return ''; }
}
module.exports = { pdfText };
