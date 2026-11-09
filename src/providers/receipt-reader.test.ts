import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  ClaudeReceiptReader,
  MockReceiptReader,
  ReceiptReadError,
  findAbn,
  findDate,
  findGstCents,
  findTotalCents,
  getReceiptReader,
  pdfToText,
  readText,
  sha256Hex,
  textFromContentStream,
  validateReading,
} from "./receipt-reader";
import { RECEIPT_SIDECARS } from "./receipt-sidecars";

const FIX = path.join(process.cwd(), "src/providers/__fixtures__/receipts");
const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(FIX, name)));
const fixtureText = (name: string) => fs.readFileSync(path.join(FIX, name), "utf8");

async function pdfWith(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((t, i) => page.drawText(t, { x: 40, y: 560 - i * 20, size: 11, font }));
  return doc.save();
}

describe("MockReceiptReader", () => {
  const reader = new MockReceiptReader();

  it("reads a text tax invoice", async () => {
    const r = await reader.read({ bytes: fixture("tax-invoice.txt"), mimeType: "text/plain" });
    expect(r).toEqual({
      supplierName: "SAMPLE Harbour Conference Centre",
      supplierAbn: "51824753556",
      totalCents: 110000,
      gstCents: 10000,
      date: "2027-02-14",
      isTaxInvoice: true,
      kind: "registration",
      confidence: 1,
    });
  });

  it("reads a plain cafe receipt (no ABN, no GST, not a tax invoice)", async () => {
    const r = await reader.read({ bytes: fixture("cafe-receipt.txt"), mimeType: "text/plain" });
    expect(r).toMatchObject({
      supplierName: "SAMPLE Bean There Cafe",
      supplierAbn: null,
      totalCents: 1050,
      gstCents: null,
      date: "2027-03-12",
      isTaxInvoice: false,
      kind: "meals",
    });
    expect(r.confidence).toBeCloseTo(0.7);
  });

  it("reads a PDF's embedded text", async () => {
    const bytes = await pdfWith([
      "SAMPLE Bayside Hotel",
      "Tax Invoice",
      "ABN 51 824 753 556",
      "Check-in 2027-03-09, 3 nights",
      "Date issued: 2027-03-12",
      "GST: $54.00",
      "Amount paid: AUD 594.00",
    ]);
    const r = await reader.read({ bytes, mimeType: "application/pdf" });
    expect(r).toEqual({
      supplierName: "SAMPLE Bayside Hotel",
      supplierAbn: "51824753556",
      totalCents: 59400,
      gstCents: 5400,
      date: "2027-03-12",
      isTaxInvoice: true,
      kind: "accommodation",
      confidence: 1,
    });
  });

  it("reads the app's own generated booking receipts", async () => {
    const bytes = await pdfWith(["StudyLeave", "Flight booking receipt", "Issued: 2027-01-05", "Total paid: AUD 420.00"]);
    const r = await reader.read({ bytes, mimeType: "application/pdf" });
    expect(r.totalCents).toBe(42000);
    expect(r.date).toBe("2027-01-05");
    expect(r.kind).toBe("flight");
  });

  it("reads an email body, using the From name as supplier", async () => {
    const emailText = fixtureText("flight-email.txt");
    const r = await reader.read({ bytes: new Uint8Array(), mimeType: "text/plain", emailText });
    expect(r).toMatchObject({
      supplierName: "SAMPLE Skyways",
      supplierAbn: "49004028077",
      totalCents: 42020,
      gstCents: 3820,
      date: "2027-02-01",
      isTaxInvoice: true,
      kind: "flight",
    });
  });

  it("fills gaps in an attachment from the email it came with", async () => {
    const bytes = await pdfWith(["Receipt", "Total $15.00"]);
    const r = await reader.read({
      bytes,
      mimeType: "application/pdf",
      emailText: 'From: "SAMPLE City Cabs" <rides@example.org>\nDate: 3 Mar 2027\nTax invoice. ABN 51 824 753 556',
    });
    expect(r).toMatchObject({
      supplierName: "SAMPLE City Cabs",
      supplierAbn: "51824753556",
      totalCents: 1500,
      date: "2027-03-03",
      isTaxInvoice: true,
      kind: "taxi",
    });
  });

  it("returns empty, zero-confidence fields for an unknown photo", async () => {
    const r = await reader.read({ bytes: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), mimeType: "image/jpeg" });
    expect(r).toEqual({
      supplierName: null,
      supplierAbn: null,
      totalCents: null,
      gstCents: null,
      date: null,
      isTaxInvoice: null,
      kind: "other",
      confidence: 0,
    });
  });

  it("uses a sidecar fixture for a known photo", async () => {
    const bytes = fixture("taxi-photo.png");
    expect(RECEIPT_SIDECARS[sha256Hex(bytes)]).toBeDefined();
    const r = await reader.read({ bytes, mimeType: "image/png" });
    expect(r).toEqual({
      supplierName: "SAMPLE Harbour Taxis",
      supplierAbn: "51824753556",
      totalCents: 4575,
      gstCents: 416,
      date: "2027-03-10",
      isTaxInvoice: true,
      kind: "taxi",
      confidence: 0.9,
    });
  });

  it("accepts extra sidecars from the constructor", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9, 9]);
    const r = await new MockReceiptReader({ sidecars: { [sha256Hex(bytes)]: { totalCents: 999 } } }).read({
      bytes,
      mimeType: "image/png",
    });
    expect(r.totalCents).toBe(999);
    expect(r.supplierName).toBeNull();
  });

  it("is deterministic", async () => {
    const input = { bytes: fixture("tax-invoice.txt"), mimeType: "text/plain" };
    expect(await reader.read(input)).toEqual(await reader.read(input));
  });

  it("returns empty fields for an unreadable PDF and rejects unknown types", async () => {
    expect((await reader.read({ bytes: new TextEncoder().encode("%PDF-1.4 junk"), mimeType: "application/pdf" })).confidence).toBe(0);
    await expect(reader.read({ bytes: new Uint8Array([1]), mimeType: "application/zip" })).rejects.toThrow(ReceiptReadError);
  });
});

describe("heuristics", () => {
  it("finds totals, ignoring subtotals and GST lines", () => {
    expect(findTotalCents("Subtotal $90.00\nGST $9.00\nTotal $99.00")).toBe(9900);
    expect(findTotalCents("Amount due: $1,234.56\nTotal items 3")).toBe(123456);
    expect(findTotalCents("Coffee 4.50\nMuffin 5.25")).toBe(525);
    expect(findTotalCents("nothing here")).toBeNull();
  });

  it("finds GST, including GST-free", () => {
    expect(findGstCents("Total includes GST of $4.16")).toBe(416);
    expect(findGstCents("GST amount AUD 12.00")).toBe(1200);
    expect(findGstCents("Total (inc GST) $50.00")).toBeNull();
    expect(findGstCents("GST-free item")).toBe(0);
  });

  it("finds an 11-digit ABN, labelled or checksum-valid", () => {
    expect(findAbn("ABN: 51-824-753-556")).toBe("51824753556");
    expect(findAbn("Call 51 824 753 556 for help")).toBe("51824753556");
    expect(findAbn("Ref 12 345 678 901")).toBeNull();
  });

  it("finds dates in Australian and ISO formats, preferring a dated line", () => {
    expect(findDate("Printed 2027-01-01\nInvoice date: 05/03/2027")).toBe("2027-03-05");
    expect(findDate("March 7, 2027")).toBe("2027-03-07");
    expect(findDate("31/02/2027")).toBeNull();
  });

  it("reads PDF literal strings and TJ arrays", () => {
    expect(textFromContentStream("BT (TAX INVOICE) Tj 0 -14 Td [(To) -20 (tal \\(paid\\)) ] TJ ET")).toBe(
      "TAX INVOICE\nTotal (paid)\n",
    );
  });

  it("readText on empty text is empty", () => {
    expect(readText("   ").confidence).toBe(0);
  });

  it("pdfToText joins every page", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage().drawText("Page one", { x: 10, y: 10, font });
    doc.addPage().drawText("Page two", { x: 10, y: 10, font });
    const text = await pdfToText(await doc.save());
    expect(text).toContain("Page one");
    expect(text).toContain("Page two");
  });
});

describe("validateReading", () => {
  it("keeps good fields and nulls bad ones", () => {
    expect(
      validateReading({
        supplierName: "  Acme  ",
        supplierAbn: "51 824 753 556",
        totalCents: 1000.4,
        gstCents: 5000,
        date: "2027-02-30",
        isTaxInvoice: "yes",
        kind: "spaceship",
        confidence: 7,
      }),
    ).toEqual({
      supplierName: "Acme",
      supplierAbn: "51824753556",
      totalCents: 1000,
      gstCents: null,
      date: null,
      isTaxInvoice: null,
      kind: "other",
      confidence: 1,
    });
  });

  it("rejects non-objects", () => {
    expect(() => validateReading("nope")).toThrow(ReceiptReadError);
    expect(() => validateReading([1])).toThrow(ReceiptReadError);
  });
});

describe("ClaudeReceiptReader (fake client, no network)", () => {
  function fakeClient(reply: { stop_reason: string; text: string }) {
    const create = vi.fn(async () => ({ stop_reason: reply.stop_reason, content: [{ type: "text", text: reply.text }] }));
    return { create, client: { beta: { messages: { create } } } as never };
  }

  it("sends a PDF as a document block and validates the JSON reply", async () => {
    const { create, client } = fakeClient({
      stop_reason: "end_turn",
      text: JSON.stringify({ supplierName: "SAMPLE Co", supplierAbn: "51824753556", totalCents: 2200, gstCents: 200, date: "2027-03-01", isTaxInvoice: true, kind: "taxi", confidence: 0.8 }),
    });
    const reader = new ClaudeReceiptReader("test-key", "claude-sonnet-5-5", client);
    const r = await reader.read({ bytes: new TextEncoder().encode("%PDF-1.4"), mimeType: "application/pdf", emailText: "From: x" });
    expect(r).toMatchObject({ supplierName: "SAMPLE Co", totalCents: 2200, kind: "taxi", confidence: 0.8 });
    const req = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0] as {
      model: string;
      messages: { content: { type: string }[] }[];
      output_config: { format: { type: string } };
    };
    expect(req.model).toBe("claude-sonnet-5-5");
    expect(req.messages[0].content.map((c) => c.type)).toEqual(["document", "text", "text"]);
    expect(req.output_config.format.type).toBe("json_schema");
  });

  it("sends a photo as an image block", async () => {
    const { create, client } = fakeClient({ stop_reason: "end_turn", text: "{}" });
    await new ClaudeReceiptReader("k", "m", client).read({ bytes: new Uint8Array([1]), mimeType: "image/jpeg" });
    const req = (create.mock.calls[0] as unknown as [{ messages: { content: { type: string }[] }[] }])[0];
    expect(req.messages[0].content[0].type).toBe("image");
  });

  it("throws a friendly error on refusal or bad JSON", async () => {
    for (const reply of [
      { stop_reason: "refusal", text: "" },
      { stop_reason: "end_turn", text: "not json" },
    ]) {
      const { client } = fakeClient(reply);
      await expect(new ClaudeReceiptReader("k", "m", client).read({ bytes: new Uint8Array([1]), mimeType: "image/png" })).rejects.toThrow(
        ReceiptReadError,
      );
    }
  });
});

describe("getReceiptReader", () => {
  it("uses the mock unless ANTHROPIC_API_KEY is set", () => {
    expect(getReceiptReader({}).name).toBe("mock");
    expect(getReceiptReader({ ANTHROPIC_API_KEY: "sk-test" }).name).toBe("claude");
  });

  it("takes the model from RECEIPT_MODEL, default claude-sonnet-5-5", () => {
    const def = getReceiptReader({ ANTHROPIC_API_KEY: "sk-test" }) as unknown as { model: string };
    expect(def.model).toBe("claude-sonnet-5-5");
    const custom = getReceiptReader({ ANTHROPIC_API_KEY: "sk-test", RECEIPT_MODEL: "claude-haiku-5-5" }) as unknown as { model: string };
    expect(custom.model).toBe("claude-haiku-5-5");
  });
});
