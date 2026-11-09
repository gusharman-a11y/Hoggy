/**
 * The claim pack: ONE PDF for the hospital's finance team.
 *
 *   1. Cover sheet — who, what, when, the total, and an index of receipts
 *      with the page each one starts on.
 *   2. The org's claim form, filled in (src/claims/form.ts).
 *   3. Every receipt: PDF pages copied in, JPG/PNG embedded one per page.
 *      A receipt whose file is missing or can't be read gets one placeholder
 *      page, so the index and page count still line up.
 */
import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getDb } from "@/db";
import { formatDateRange, formatMoney } from "@/lib/format";
import { pdfSafe, resolveUploadPath, uploadsDir, type Receipt } from "@/lib/receipts";
import { loadClaimForm, receiptTypeLabel, renderClaimForm, type ClaimFormData } from "./form";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const WIDTH = A4[0] - MARGIN * 2;
const INK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.45, 0.45, 0.45);

export interface ClaimPack {
  bytes: Uint8Array;
  pageCount: number;
  coverPages: number;
  formPages: number;
  /** Pages added for each receipt, in receipt order. */
  receiptPages: number[];
  data: ClaimFormData;
  receipts: Receipt[];
}

export interface ClaimPackOptions {
  db?: DatabaseSync;
  /** Uploads folder; defaults to uploadsDir(). */
  dir?: string;
  /** Only build the pack if the trip belongs to this org. */
  orgId?: number;
  now?: Date;
}

/** claim-<conference-slug>-<surname>.pdf, filesystem- and email-safe. */
export function claimPackFilename(conferenceSlug: string, doctorName: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const words = doctorName.trim().split(/\s+/).filter(Boolean);
  const surname = clean(words[words.length - 1] ?? "") || "doctor";
  return `claim-${clean(conferenceSlug) || "trip"}-${surname}.pdf`;
}

type Source =
  | { type: "pdf"; doc: PDFDocument }
  | { type: "jpg" | "png"; bytes: Uint8Array }
  | { type: "missing"; reason: string };

async function loadSource(r: Receipt, dir: string): Promise<Source> {
  if (!r.file_path) return { type: "missing", reason: "No file was attached to this receipt." };
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(/*turbopackIgnore: true*/ resolveUploadPath(r.file_path, dir));
  } catch {
    return { type: "missing", reason: "The receipt file could not be found." };
  }
  // Hand pdf-lib unpooled copies (new Uint8Array): its JPEG reader ignores a Buffer's byteOffset.
  const head = bytes.subarray(0, 8);
  if (head[0] === 0xff && head[1] === 0xd8) return { type: "jpg", bytes: new Uint8Array(bytes) };
  if (head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: "png", bytes: new Uint8Array(bytes) };
  try {
    const doc = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true, updateMetadata: false });
    if (doc.getPageCount() === 0) throw new Error("no pages");
    return { type: "pdf", doc };
  } catch {
    return { type: "missing", reason: "The receipt file could not be read. See the original in StudyLeave." };
  }
}

function sourcePages(s: Source): number {
  return s.type === "pdf" ? s.doc.getPageCount() : 1;
}

function fit(text: string, font: PDFFont, size: number, max: number): string {
  let t = pdfSafe(text);
  if (font.widthOfTextAtSize(t, size) <= max) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > max) t = t.slice(0, -1);
  return t + "...";
}

const ROW_H = 16;
const COVER_HEAD_H = 300; // summary block on the first cover page
const COVER_CONT_HEAD_H = 60;
const indexRowsFirst = Math.floor((A4[1] - MARGIN * 2 - COVER_HEAD_H) / ROW_H);
const indexRowsCont = Math.floor((A4[1] - MARGIN * 2 - COVER_CONT_HEAD_H) / ROW_H);

/** How many cover pages an index of `n` receipts needs. */
export function coverPageCount(n: number): number {
  if (n <= indexRowsFirst) return 1;
  return 1 + Math.ceil((n - indexRowsFirst) / indexRowsCont);
}

async function drawCover(
  doc: PDFDocument,
  data: ClaimFormData,
  receipts: Receipt[],
  startPages: number[],
  formStart: number,
  coverPages: number,
): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage;
  let y = 0;
  let pageNo = 0;
  const text = (t: string, x: number, o: { size?: number; f?: PDFFont; max?: number; color?: typeof INK } = {}) => {
    const size = o.size ?? 10.5;
    const f = o.f ?? font;
    page.drawText(fit(t, f, size, o.max ?? WIDTH - (x - MARGIN)), { x, y, size, font: f, color: o.color ?? INK });
  };
  const right = (t: string, xr: number, o: { size?: number; f?: PDFFont } = {}) => {
    const size = o.size ?? 10.5;
    const f = o.f ?? font;
    const s = pdfSafe(t);
    page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y, size, font: f, color: INK });
  };
  const newPage = () => {
    page = doc.insertPage(pageNo, A4);
    pageNo++;
    y = A4[1] - MARGIN;
  };
  const money = (c: number) => formatMoney(c, data.currency);

  newPage();
  text("StudyLeave claim pack", MARGIN, { size: 10, color: GREY });
  y -= 26;
  text(`Study leave claim: ${data.employeeName}`, MARGIN, { size: 18, f: bold });
  y -= 30;
  const facts: [string, string][] = [
    ["Doctor", `${data.employeeName} (${data.employeeEmail})`],
    ["Hospital", data.organisation],
    ["Conference", data.conference],
    ["Dates", formatDateRange(data.startDate, data.endDate).replace(/–/g, "-")],
    ["Location", data.location || "-"],
    ["Receipts", String(receipts.length)],
    ["Total claimed", money(data.totalCents)],
    ["Prepared", data.claimDate],
  ];
  for (const [k, v] of facts) {
    text(k, MARGIN, { f: bold });
    text(v, MARGIN + 120);
    y -= 18;
  }
  y -= 10;
  const contents = [`cover sheet (page 1)`, `claim form (page ${formStart})`];
  if (startPages.length > 0) contents.push(`receipts (from page ${startPages[0]})`);
  text(`Contents: ${contents.join(", ")}.`, MARGIN, { size: 9.5, color: GREY });
  // The index starts at a fixed height so coverPageCount() can predict the page count.
  y = A4[1] - MARGIN - COVER_HEAD_H + 30;

  const cols = { no: MARGIN, type: MARGIN + 28, desc: MARGIN + 130, amountRight: MARGIN + WIDTH - 56, pageRight: MARGIN + WIDTH };
  const header = (title: string) => {
    text(title, MARGIN, { f: bold, size: 12 });
    y -= 20;
    text("#", cols.no, { f: bold, size: 9.5 });
    text("Type", cols.type, { f: bold, size: 9.5 });
    text("Description", cols.desc, { f: bold, size: 9.5 });
    right("Amount", cols.amountRight, { f: bold, size: 9.5 });
    right("Page", cols.pageRight, { f: bold, size: 9.5 });
    page.drawLine({ start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + WIDTH, y: y - 5 }, thickness: 0.6, color: GREY });
    y -= 18;
  };
  header("Receipts index");
  if (receipts.length === 0) {
    text("No receipts attached.", MARGIN, { size: 9.5, color: GREY });
    y -= ROW_H;
  }
  let onPage = 0;
  let capacity = indexRowsFirst;
  receipts.forEach((r, i) => {
    if (onPage >= capacity) {
      newPage();
      text(`Study leave claim: ${data.employeeName} (continued)`, MARGIN, { size: 9, color: GREY });
      y -= 24;
      header("Receipts index (continued)");
      onPage = 0;
      capacity = indexRowsCont;
    }
    const amount = money(r.amount_cents);
    const aw = font.widthOfTextAtSize(pdfSafe(amount), 9.5);
    text(String(i + 1), cols.no, { size: 9.5 });
    text(receiptTypeLabel(r.kind), cols.type, { size: 9.5, max: cols.desc - cols.type - 8 });
    text(r.description || "-", cols.desc, { size: 9.5, max: cols.amountRight - aw - 12 - cols.desc });
    right(amount, cols.amountRight, { size: 9.5 });
    right(String(startPages[i]), cols.pageRight, { size: 9.5 });
    y -= ROW_H;
    onPage++;
  });
  if (pageNo !== coverPages) throw new Error(`Cover drew ${pageNo} pages, expected ${coverPages}`);
}

function drawPlaceholder(page: PDFPage, font: PDFFont, bold: PDFFont, label: string, reason: string) {
  let y = A4[1] - MARGIN;
  page.drawText(fit(label, bold, 12, WIDTH), { x: MARGIN, y, size: 12, font: bold, color: INK });
  y -= 24;
  page.drawText(fit(reason, font, 10.5, WIDTH), { x: MARGIN, y, size: 10.5, font, color: GREY });
}

/** Builds the whole claim pack for a trip. */
export async function buildClaimPack(tripId: number, opts: ClaimPackOptions = {}): Promise<ClaimPack> {
  const db = opts.db ?? getDb();
  const dir = opts.dir ?? uploadsDir();
  const { data, template, receipts } = loadClaimForm(tripId, { db, orgId: opts.orgId, now: opts.now });
  const sources = await Promise.all(receipts.map((r) => loadSource(r, dir)));
  const receiptPages = sources.map(sourcePages);

  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`Study leave claim - ${data.employeeName} - ${data.conference}`));
  doc.setAuthor(pdfSafe(data.employeeName));
  doc.setProducer("StudyLeave");
  doc.setCreator("StudyLeave");

  // Form first (its length decides receipt page numbers), then the cover is inserted in front.
  const formPages = await renderClaimForm(doc, data, template);
  const coverPages = coverPageCount(receipts.length);
  const formStart = coverPages + 1;
  const startPages: number[] = [];
  let next = coverPages + formPages + 1;
  for (const n of receiptPages) {
    startPages.push(next);
    next += n;
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    const s = sources[i];
    const label = `Receipt ${i + 1}: ${receiptTypeLabel(r.kind)} - ${r.description || "-"} - ${formatMoney(r.amount_cents, r.currency)}`;
    if (s.type === "pdf") {
      try {
        const copied = await doc.copyPages(s.doc, s.doc.getPageIndices());
        copied.forEach((p) => doc.addPage(p));
        continue;
      } catch {
        // Fall through to a placeholder page per source page so numbering holds.
        for (let k = 0; k < receiptPages[i]; k++)
          drawPlaceholder(doc.addPage(A4), font, bold, label, "This receipt's PDF could not be copied. See the original in StudyLeave.");
        continue;
      }
    }
    const page = doc.addPage(A4);
    if (s.type === "missing") {
      drawPlaceholder(page, font, bold, label, s.reason);
      continue;
    }
    page.drawText(fit(label, font, 9, WIDTH), { x: MARGIN, y: A4[1] - MARGIN + 20, size: 9, font, color: GREY });
    try {
      const img = s.type === "jpg" ? await doc.embedJpg(s.bytes) : await doc.embedPng(s.bytes);
      const boxW = WIDTH;
      const boxH = A4[1] - MARGIN * 2;
      const scale = Math.min(boxW / img.width, boxH / img.height, 2);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: MARGIN + (boxW - w) / 2, y: MARGIN + (boxH - h), width: w, height: h });
    } catch {
      drawPlaceholder(page, font, bold, label, "This receipt's image could not be read. See the original in StudyLeave.");
    }
  }

  await drawCover(doc, data, receipts, startPages, formStart, coverPages);

  const bytes = await doc.save();
  return { bytes, pageCount: doc.getPageCount(), coverPages, formPages, receiptPages, data, receipts };
}
