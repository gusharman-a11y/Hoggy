/**
 * The hospital's claim form, filled in from a trip and its receipts.
 *
 * Each org stores its form as JSON in orgs.claim_form_json (migration 010):
 * {title, intro?, fields: [{key, label, text?}]}. Known keys are filled from
 * the trip (CLAIM_FIELD_KEYS); any other key prints as a blank line to fill by
 * hand, and a field with `text` prints that paragraph (e.g. the declaration).
 *
 * renderClaimForm() draws onto an existing PDFDocument so the claim pack
 * (US-021) can put the form inside one PDF; buildClaimFormPdf() is standalone.
 */
import type { DatabaseSync } from "node:sqlite";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getDb } from "@/db";
import { formatDateRange, formatMoney, todayIso } from "@/lib/format";
import { UPLOAD_KIND_LABELS } from "@/lib/receipt-upload-kinds";
import { listReceipts, pdfSafe, type Receipt } from "@/lib/receipts";

export interface ClaimFormField {
  key: string;
  label: string;
  /** Fixed paragraph printed under the label (declarations, instructions). */
  text?: string;
}

export interface ClaimFormTemplate {
  title: string;
  intro?: string;
  fields: ClaimFormField[];
}

/** Field keys the app fills in. Anything else prints as a blank line. */
export const CLAIM_FIELD_KEYS = [
  "employee_name",
  "employee_email",
  "organisation",
  "conference",
  "dates",
  "location",
  "expenses",
  "total",
  "declaration",
  "date",
] as const;

/** NSW-style study leave reimbursement form. Same JSON as the column default in 010_claim_form.sql. */
export const DEFAULT_CLAIM_FORM: ClaimFormTemplate = {
  title: "Study Leave Reimbursement Claim",
  intro: "Claim for reimbursement of approved study leave (conference) expenses. Original receipts are attached.",
  fields: [
    { key: "employee_name", label: "Employee name" },
    { key: "employee_email", label: "Email" },
    { key: "organisation", label: "Hospital / organisation" },
    { key: "conference", label: "Conference / course" },
    { key: "dates", label: "Dates of leave" },
    { key: "location", label: "Location" },
    { key: "expenses", label: "Itemised expenses" },
    { key: "total", label: "Total claimed" },
    {
      key: "declaration",
      label: "Declaration",
      text: "I declare that the expenses claimed were incurred by me while attending the approved study leave above, that the attached receipts are true copies, and that I have not claimed these expenses from any other source.",
    },
    { key: "date", label: "Date" },
  ],
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Reads an org's claim_form_json; anything missing or malformed falls back to DEFAULT_CLAIM_FORM. */
export function parseClaimTemplate(json: string | null | undefined): ClaimFormTemplate {
  if (!json) return DEFAULT_CLAIM_FORM;
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return DEFAULT_CLAIM_FORM;
  }
  if (!isObj(v) || !nonEmpty(v.title) || !Array.isArray(v.fields) || v.fields.length === 0) return DEFAULT_CLAIM_FORM;
  const fields: ClaimFormField[] = [];
  for (const f of v.fields) {
    if (!isObj(f) || !nonEmpty(f.key) || !nonEmpty(f.label)) return DEFAULT_CLAIM_FORM;
    fields.push({ key: f.key, label: f.label, ...(nonEmpty(f.text) ? { text: f.text } : {}) });
  }
  return { title: v.title, ...(nonEmpty(v.intro) ? { intro: v.intro } : {}), fields };
}

export interface ClaimExpense {
  /** YYYY-MM-DD the receipt was added. */
  date: string;
  type: string;
  description: string;
  amountCents: number;
}

export interface ClaimFormData {
  employeeName: string;
  employeeEmail: string;
  organisation: string;
  conference: string;
  startDate: string;
  endDate: string;
  location: string;
  currency: string;
  expenses: ClaimExpense[];
  totalCents: number;
  /** Date of the claim, YYYY-MM-DD. */
  claimDate: string;
}

const RECEIPT_TYPE_LABELS: Record<string, string> = { flight: "Flight", hotel: "Hotel", ...UPLOAD_KIND_LABELS };

export function receiptTypeLabel(kind: string): string {
  return RECEIPT_TYPE_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** One line per receipt. */
export function claimExpenses(receipts: Receipt[]): ClaimExpense[] {
  return receipts.map((r) => ({
    date: r.created_at.slice(0, 10),
    type: receiptTypeLabel(r.kind),
    description: r.description,
    amountCents: r.amount_cents,
  }));
}

/** What the claim adds up to: the sum of every receipt. */
export function claimTotalCents(receipts: Pick<Receipt, "amount_cents">[]): number {
  return receipts.reduce((sum, r) => sum + r.amount_cents, 0);
}

/** Loads the trip, its doctor, org, conference and receipts, plus the org's form template. */
export function loadClaimForm(
  tripId: number,
  opts: { db?: DatabaseSync; orgId?: number; now?: Date } = {},
): { data: ClaimFormData; template: ClaimFormTemplate; receipts: Receipt[] } {
  const db = opts.db ?? getDb();
  const row = db
    .prepare(
      `SELECT t.org_id, t.currency, u.name AS employee_name, u.email AS employee_email,
              o.name AS org_name, o.claim_form_json, c.name AS conference, c.start_date, c.end_date,
              c.city, c.country, c.venue
       FROM trips t JOIN users u ON u.id = t.user_id JOIN orgs o ON o.id = t.org_id
       JOIN conferences c ON c.id = t.conference_id WHERE t.id = ?`,
    )
    .get(tripId) as
    | {
        org_id: number;
        currency: string;
        employee_name: string;
        employee_email: string;
        org_name: string;
        claim_form_json: string | null;
        conference: string;
        start_date: string;
        end_date: string;
        city: string;
        country: string;
        venue: string | null;
      }
    | undefined;
  if (!row || (opts.orgId !== undefined && row.org_id !== opts.orgId)) throw new Error(`Trip ${tripId} not found`);
  const receipts = listReceipts(tripId, db);
  return {
    template: parseClaimTemplate(row.claim_form_json),
    receipts,
    data: {
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      organisation: row.org_name,
      conference: row.conference,
      startDate: row.start_date,
      endDate: row.end_date,
      location: [row.venue, row.city, row.country].filter(Boolean).join(", "),
      currency: row.currency,
      expenses: claimExpenses(receipts),
      totalCents: claimTotalCents(receipts),
      claimDate: todayIso(opts.now),
    },
  };
}

// ---- PDF ----

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const WIDTH = A4[0] - MARGIN * 2;
const LABEL_W = 150;
const INK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.45, 0.45, 0.45);

function fit(text: string, font: PDFFont, size: number, max: number): string {
  let t = pdfSafe(text);
  if (font.widthOfTextAtSize(t, size) <= max) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > max) t = t.slice(0, -1);
  return t + "...";
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of pdfSafe(text).split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && font.widthOfTextAtSize(next, size) > max) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.map((l) => fit(l, font, size, max));
}

/**
 * Draws the filled claim form onto `doc` (A4, as many pages as the expenses need).
 * Returns the number of pages added.
 */
export async function renderClaimForm(
  doc: PDFDocument,
  data: ClaimFormData,
  template: ClaimFormTemplate = DEFAULT_CLAIM_FORM,
): Promise<number> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let pages = 0;
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = doc.addPage(A4);
    pages++;
    y = A4[1] - MARGIN;
    if (pages > 1) {
      page.drawText(fit(`${template.title} (continued)`, font, 9, WIDTH), { x: MARGIN, y, size: 9, font, color: GREY });
      y -= 24;
    }
  };
  const need = (h: number) => {
    if (y - h < MARGIN) newPage();
  };
  const text = (t: string, x: number, opts: { size?: number; f?: PDFFont; max?: number; color?: typeof INK } = {}) => {
    const size = opts.size ?? 10.5;
    const f = opts.f ?? font;
    page.drawText(fit(t, f, size, opts.max ?? WIDTH - (x - MARGIN)), { x, y, size, font: f, color: opts.color ?? INK });
  };
  const rule = (yy: number, thickness = 0.6) =>
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: MARGIN + WIDTH, y: yy }, thickness, color: GREY });

  const money = (cents: number) => formatMoney(cents, data.currency);
  const row = (label: string, value: string) => {
    need(20);
    text(label, MARGIN, { f: bold });
    text(value, MARGIN + LABEL_W);
    y -= 20;
  };

  newPage();
  text(data.organisation, MARGIN, { size: 10, color: GREY });
  y -= 24;
  text(template.title, MARGIN, { size: 18, f: bold });
  y -= 22;
  if (template.intro) {
    for (const l of wrap(template.intro, font, 9.5, WIDTH)) {
      text(l, MARGIN, { size: 9.5, color: GREY });
      y -= 13;
    }
  }
  y -= 10;

  const values: Record<string, string> = {
    employee_name: data.employeeName,
    employee_email: data.employeeEmail,
    organisation: data.organisation,
    conference: data.conference,
    dates: formatDateRange(data.startDate, data.endDate).replace(/–/g, "-"),
    location: data.location,
    total: money(data.totalCents),
    date: data.claimDate,
  };

  for (const field of template.fields) {
    if (field.key === "expenses") {
      need(60);
      y -= 6;
      text(field.label, MARGIN, { f: bold, size: 12 });
      y -= 18;
      const cols = { date: MARGIN, type: MARGIN + 72, desc: MARGIN + 172, amountRight: MARGIN + WIDTH };
      const header = () => {
        text("Date", cols.date, { f: bold, size: 9.5 });
        text("Type", cols.type, { f: bold, size: 9.5 });
        text("Description", cols.desc, { f: bold, size: 9.5 });
        const w = bold.widthOfTextAtSize("Amount", 9.5);
        page.drawText("Amount", { x: cols.amountRight - w, y, size: 9.5, font: bold, color: INK });
        rule(y - 5);
        y -= 18;
      };
      header();
      if (data.expenses.length === 0) {
        text("No receipts yet.", cols.date, { size: 9.5, color: GREY });
        y -= 16;
      }
      for (const e of data.expenses) {
        if (y - 16 < MARGIN) {
          newPage();
          header();
        }
        const amount = pdfSafe(money(e.amountCents));
        const aw = font.widthOfTextAtSize(amount, 9.5);
        text(e.date, cols.date, { size: 9.5 });
        text(e.type, cols.type, { size: 9.5, max: cols.desc - cols.type - 8 });
        text(e.description || "-", cols.desc, { size: 9.5, max: cols.amountRight - aw - 12 - cols.desc });
        page.drawText(amount, { x: cols.amountRight - aw, y, size: 9.5, font, color: INK });
        y -= 16;
      }
      rule(y + 10);
      y -= 8;
      continue;
    }
    if (field.key === "total") {
      need(30);
      text(field.label, MARGIN, { f: bold, size: 12 });
      const t = pdfSafe(values.total);
      page.drawText(t, { x: MARGIN + WIDTH - bold.widthOfTextAtSize(t, 12), y, size: 12, font: bold, color: INK });
      y -= 30;
      continue;
    }
    if (field.text) {
      const lines = wrap(field.text, font, 9.5, WIDTH);
      need(24 + lines.length * 13 + (field.key === "declaration" ? 36 : 0));
      text(field.label, MARGIN, { f: bold });
      y -= 16;
      for (const l of lines) {
        text(l, MARGIN, { size: 9.5 });
        y -= 13;
      }
      if (field.key === "declaration") {
        y -= 22;
        text("Signature:", MARGIN, { f: bold });
        page.drawLine({ start: { x: MARGIN + LABEL_W, y: y - 2 }, end: { x: MARGIN + LABEL_W + 200, y: y - 2 }, thickness: 0.6, color: GREY });
        y -= 14;
      }
      y -= 8;
      continue;
    }
    if (field.key in values) {
      row(field.label, values[field.key]);
      continue;
    }
    // A field the app doesn't know: leave a line to fill by hand.
    need(22);
    text(field.label, MARGIN, { f: bold });
    page.drawLine({ start: { x: MARGIN + LABEL_W, y: y - 2 }, end: { x: MARGIN + WIDTH, y: y - 2 }, thickness: 0.6, color: GREY });
    y -= 22;
  }

  need(20);
  y -= 6;
  text("Prepared by StudyLeave from the trip's bookings and receipts.", MARGIN, { size: 8, color: GREY });
  return pages;
}

/** The filled claim form on its own, as PDF bytes. */
export async function buildClaimFormPdf(
  data: ClaimFormData,
  template: ClaimFormTemplate = DEFAULT_CLAIM_FORM,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${template.title} - ${data.employeeName}`);
  doc.setProducer("StudyLeave");
  doc.setCreator("StudyLeave");
  await renderClaimForm(doc, data, template);
  return doc.save();
}
