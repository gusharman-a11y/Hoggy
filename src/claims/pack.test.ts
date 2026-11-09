import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { createTrip } from "@/lib/trips";
import { createOrg, createUser } from "@/lib/users";
import { buildClaimFormPdf, loadClaimForm } from "./form";
import { buildClaimPack, claimPackFilename, coverPageCount } from "./pack";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const JPG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

async function pdfWithPages(n: number): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) d.addPage([300, 400]);
  return d.save();
}

describe("claim pack", () => {
  let db: DatabaseSync;
  let dir: string;
  let tripId: number;
  let orgId: number;
  let add: (kind: string, desc: string, cents: number, file: string | null, bytes?: Uint8Array, mime?: string) => void;

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pack-"));
    orgId = createOrg(db, { name: "SAMPLE District Hospital", financeEmail: "fin@a.example" }).id;
    const doc = createUser(db, { orgId, email: "zoe@a.example", name: "Dr Zoë Ng", password: "pw123456", role: "doctor" });
    const confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('sample-cardio-2027', 'SAMPLE Cardiology Meeting 2027', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
    tripId = createTrip({ orgId, userId: doc.id, conferenceId: confId }, db).id;
    const stmt = db.prepare(
      "INSERT INTO receipts (trip_id, kind, description, amount_cents, source, file_path, mime_type) VALUES (?, ?, ?, ?, 'upload', ?, ?)",
    );
    add = (kind, desc, cents, file, bytes, mime) => {
      if (file && bytes) {
        fs.mkdirSync(path.join(dir, String(tripId)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), bytes);
      }
      stmt.run(tripId, kind, desc, cents, file, mime ?? null);
    };
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("page count = cover + form pages + every receipt's pages", async () => {
    add("flight", "SAMPLE Air SYD-MEL", 41_250, `${tripId}/flight.pdf`, await pdfWithPages(1), "application/pdf");
    add("hotel", "SAMPLE Hotel, 3 nights", 66_000, `${tripId}/hotel.pdf`, await pdfWithPages(3), "application/pdf");
    add("taxi", "Airport taxi", 4_575, `${tripId}/taxi.png`, PNG, "image/png");
    add("meals", "Dinner", 3_000, `${tripId}/dinner.jpg`, JPG, "image/jpeg");

    const pack = await buildClaimPack(tripId, { db, dir });
    const { data, template } = loadClaimForm(tripId, { db });
    const formAlone = (await PDFDocument.load(await buildClaimFormPdf(data, template))).getPageCount();

    expect(pack.coverPages).toBe(1);
    expect(pack.formPages).toBe(formAlone);
    expect(pack.receiptPages).toEqual([1, 3, 1, 1]);
    const loaded = await PDFDocument.load(pack.bytes);
    expect(loaded.getPageCount()).toBe(pack.coverPages + pack.formPages + 1 + 3 + 1 + 1);
    expect(pack.pageCount).toBe(loaded.getPageCount());
    expect(pack.data.totalCents).toBe(114_825);
    // Copied receipt pages keep their own size; the cover and form are A4.
    const sizes = loaded.getPages().map((p) => Math.round(p.getWidth()));
    expect(sizes[0]).toBe(595);
    expect(sizes.slice(1 + pack.formPages, 1 + pack.formPages + 4)).toEqual([300, 300, 300, 300]);
    // The PNG and JPG pages really embed the image (not a "could not be read" placeholder).
    const imagePages = loaded.getPages().slice(-2);
    for (const p of imagePages) {
      const xobjects = p.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      expect(xobjects?.keys().length).toBe(1);
    }
  });

  it("puts a placeholder page in for missing or unreadable files", async () => {
    add("other", "No file", 1_000, null);
    add("other", "Gone", 1_000, `${tripId}/gone.pdf`);
    add("other", "Broken", 1_000, `${tripId}/broken.pdf`, Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));
    const pack = await buildClaimPack(tripId, { db, dir });
    expect(pack.receiptPages).toEqual([1, 1, 1]);
    expect((await PDFDocument.load(pack.bytes)).getPageCount()).toBe(pack.coverPages + pack.formPages + 3);
  });

  it("works with no receipts and refuses trips from another org", async () => {
    const pack = await buildClaimPack(tripId, { db, dir });
    expect(pack.receiptPages).toEqual([]);
    expect(pack.pageCount).toBe(1 + pack.formPages);
    await expect(buildClaimPack(tripId, { db, dir, orgId: orgId + 1 })).rejects.toThrow(/not found/);
  });

  it("flows a long receipts index onto more cover pages", async () => {
    for (let i = 0; i < 60; i++) add("meals", `Meal ${i + 1}`, 1_000, null);
    const pack = await buildClaimPack(tripId, { db, dir });
    expect(pack.coverPages).toBe(coverPageCount(60));
    expect(pack.coverPages).toBeGreaterThan(1);
    expect(pack.pageCount).toBe(pack.coverPages + pack.formPages + 60);
  });

  it("names the file claim-<slug>-<surname>.pdf", () => {
    expect(claimPackFilename("sample-cardio-2027", "Dr Zoë Ng")).toBe("claim-sample-cardio-2027-ng.pdf");
    expect(claimPackFilename("x", "  ")).toBe("claim-x-doctor.pdf");
    expect(claimPackFilename("x", "Dr Mary O'Brien-Smith")).toBe("claim-x-o-brien-smith.pdf");
  });
});
