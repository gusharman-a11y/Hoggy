import type { DatabaseSync } from "node:sqlite";
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { createTrip } from "@/lib/trips";
import { createOrg, createUser } from "@/lib/users";
import {
  DEFAULT_CLAIM_FORM,
  buildClaimFormPdf,
  claimTotalCents,
  loadClaimForm,
  parseClaimTemplate,
  type ClaimFormData,
} from "./form";

/** Text drawn on each page (pdf-lib writes one `<hex> Tj` per drawText). */
async function pdfText(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
    let out = "";
    for (const s of streams) {
      if (!(s instanceof PDFRawStream)) continue;
      const raw = Buffer.from(decodePDFRawStream(s).decode()).toString("latin1");
      for (const m of raw.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out += Buffer.from(m[1], "hex").toString("latin1") + "\n";
    }
    return out;
  });
}

describe("claim form template", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = getDb(":memory:");
  });
  afterEach(() => closeDb());

  it("migration 010 gives every org the default NSW-style form", () => {
    const org = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" });
    const { claim_form_json } = db.prepare("SELECT claim_form_json FROM orgs WHERE id = ?").get(org.id) as {
      claim_form_json: string;
    };
    expect(JSON.parse(claim_form_json)).toEqual(DEFAULT_CLAIM_FORM);
    expect(DEFAULT_CLAIM_FORM.fields.map((f) => f.key)).toEqual([
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
    ]);
  });

  it("parses custom templates and falls back to the default when malformed", () => {
    expect(parseClaimTemplate(null)).toBe(DEFAULT_CLAIM_FORM);
    expect(parseClaimTemplate("not json")).toBe(DEFAULT_CLAIM_FORM);
    expect(parseClaimTemplate('{"title":"X","fields":[]}')).toBe(DEFAULT_CLAIM_FORM);
    expect(parseClaimTemplate('{"title":"X","fields":[{"key":"a"}]}')).toBe(DEFAULT_CLAIM_FORM);
    expect(parseClaimTemplate('{"title":"X","fields":[{"key":"cost_centre","label":"Cost centre","extra":1}]}')).toEqual({
      title: "X",
      fields: [{ key: "cost_centre", label: "Cost centre" }],
    });
  });
});

describe("filled claim form PDF", () => {
  let db: DatabaseSync;
  let tripId: number;

  beforeEach(() => {
    db = getDb(":memory:");
    const orgId = createOrg(db, { name: "SAMPLE District Hospital", financeEmail: "fin@a.example" }).id;
    const doc = createUser(db, { orgId, email: "zoe@a.example", name: "Dr Zoë Ng", password: "pw123456", role: "doctor" });
    const confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('c', 'SAMPLE Cardiology Meeting 2027', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
    tripId = createTrip({ orgId, userId: doc.id, conferenceId: confId }, db).id;
    const add = db.prepare(
      "INSERT INTO receipts (trip_id, kind, description, amount_cents, source) VALUES (?, ?, ?, ?, 'upload')",
    );
    add.run(tripId, "flight", "SAMPLE Air SYD-MEL", 41_250);
    add.run(tripId, "hotel", "SAMPLE Hotel, 3 nights", 66_000);
    add.run(tripId, "taxi", "Airport taxi", 4_575);
  });
  afterEach(() => closeDb());

  it("loads the trip, doctor and receipts into the form data", () => {
    const { data, template, receipts } = loadClaimForm(tripId, { db, now: new Date("2027-03-20T00:00:00Z") });
    expect(template).toEqual(DEFAULT_CLAIM_FORM);
    expect(receipts).toHaveLength(3);
    expect(data).toMatchObject({
      employeeName: "Dr Zoë Ng",
      employeeEmail: "zoe@a.example",
      organisation: "SAMPLE District Hospital",
      conference: "SAMPLE Cardiology Meeting 2027",
      location: "Melbourne, Australia",
      totalCents: 111_825,
      claimDate: "2027-03-20",
    });
    expect(data.expenses.map((e) => [e.type, e.amountCents])).toEqual([
      ["Flight", 41_250],
      ["Hotel", 66_000],
      ["Taxi / rideshare", 4_575],
    ]);
    expect(claimTotalCents(receipts)).toBe(111_825);
    expect(() => loadClaimForm(tripId, { db, orgId: 999 })).toThrow(/not found/);
  });

  it("renders a PDF with the doctor's name, every expense and the correct total", async () => {
    const { data, template } = loadClaimForm(tripId, { db, now: new Date("2027-03-20T00:00:00Z") });
    const bytes = await buildClaimFormPdf(data, template);
    const pages = await pdfText(bytes);
    expect(pages).toHaveLength(1);
    const text = pages.join("");
    expect(text).toContain("Study Leave Reimbursement Claim");
    expect(text).toContain("Dr Zoë Ng");
    expect(text).toContain("zoe@a.example");
    expect(text).toContain("SAMPLE Cardiology Meeting 2027");
    expect(text).toContain("10-12 Mar 2027");
    expect(text).toContain("Airport taxi");
    expect(text).toContain("AUD 45.75");
    expect(text).toMatch(/Total claimed\nAUD 1,118\.25\n/);
    expect(text).toContain("I declare that");
    expect(text).toContain("2027-03-20");
  });

  it("uses the org's own template, leaving unknown fields blank", async () => {
    db.prepare("UPDATE orgs SET claim_form_json = ?").run(
      JSON.stringify({
        title: "SAMPLE Health Education Claim",
        fields: [
          { key: "employee_name", label: "Claimant" },
          { key: "cost_centre", label: "Cost centre" },
          { key: "total", label: "Amount payable" },
        ],
      }),
    );
    const { data, template } = loadClaimForm(tripId, { db });
    const text = (await pdfText(await buildClaimFormPdf(data, template))).join("");
    expect(text).toContain("SAMPLE Health Education Claim");
    expect(text).toContain("Claimant\nDr Zoë Ng");
    expect(text).toContain("Cost centre");
    expect(text).toMatch(/Amount payable\nAUD 1,118\.25/);
    expect(text).not.toContain("Itemised expenses");
  });

  it("flows long expense lists onto extra pages", async () => {
    const data: ClaimFormData = {
      ...loadClaimForm(tripId, { db }).data,
      expenses: Array.from({ length: 80 }, (_, i) => ({
        date: "2027-03-10",
        type: "Meals",
        description: `Meal ${i + 1}`,
        amountCents: 1_000,
      })),
      totalCents: 80_000,
    };
    const pages = await pdfText(await buildClaimFormPdf(data));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1]).toContain("(continued)");
    expect(pages.join("")).toContain("Meal 80");
    expect(pages.join("")).toContain("AUD 800.00");
  });
});
