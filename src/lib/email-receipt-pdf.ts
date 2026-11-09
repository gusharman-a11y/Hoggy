/**
 * Emails with no attachment (an e-receipt in the body) become a one-page PDF so they
 * can be read, stored and put in the claim pack like any other receipt.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { pdfSafe } from "./receipts";

export interface EmailPdfInput {
  from: string;
  subject: string;
  text: string;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;

/** Splits text into lines no wider than maxWidth (long words are broken). */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = pdfSafe(raw).split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (let word of words) {
      while (font.widthOfTextAtSize(word, size) > maxWidth) {
        let cut = word.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
        if (line) out.push(line);
        out.push(word.slice(0, cut));
        line = "";
        word = word.slice(cut);
      }
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  // Collapse runs of blank lines.
  return out.filter((l, i) => l !== "" || (i > 0 && out[i - 1] !== ""));
}

/** One A4 page: the body (as much as fits), then a footer with the subject and who forwarded it. Pure. */
export async function buildEmailReceiptPdf(input: EmailPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(input.subject || "Emailed receipt"));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(A4);
  const width = A4[0] - MARGIN * 2;
  let y = A4[1] - MARGIN;
  const draw = (t: string, size: number, f: PDFFont = font, grey = 0.1) => {
    page.drawText(t, { x: MARGIN, y, size, font: f, color: rgb(grey, grey, grey) });
    y -= size + 4;
  };

  // Text order matters to readers: body first, then a footer. The forwarder (the doctor) is in
  // the footer, never a "From:" line, so they aren't taken for the supplier; no received date
  // either, so the only dates on the page are the receipt's own.
  draw("Receipt", 16, bold);
  y -= 2;
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: A4[0] - MARGIN, y: y + 6 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 6;

  const footer = wrapText(`Subject: ${input.subject || "(no subject)"} - forwarded to StudyLeave by ${input.from}`, font, 8, width);
  const footerTop = MARGIN + footer.length * 12;
  const body = wrapText(input.text.trim() || "(empty email)", font, 10, width);
  const room = Math.floor((y - footerTop - 14) / 14);
  const shown = body.length > room ? body.slice(0, Math.max(0, room - 1)) : body;
  for (const l of shown) draw(l, 10);
  if (shown.length < body.length) draw("... (rest of the email not shown)", 9, font, 0.45);
  y = footerTop - 4;
  for (const l of footer) {
    page.drawText(l, { x: MARGIN, y, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
    y -= 12;
  }
  return doc.save();
}
