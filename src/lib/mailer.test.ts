import { afterEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import {
  getMailer,
  getOutboxAttachment,
  listOutbox,
  OutboxMailer,
  outboxScope,
  SmtpMailer,
} from "./mailer";

afterEach(() => closeDb());

function org(db: ReturnType<typeof getDb>, code: string): number {
  return Number(db.prepare("INSERT INTO orgs (name, join_code) VALUES (?, ?)").run(`H ${code}`, code).lastInsertRowid);
}

describe("OutboxMailer", () => {
  it("stores the email and its attachments byte for byte", async () => {
    const db = getDb(":memory:");
    const pdf = Buffer.from("%PDF-1.7 sample\x00\xff", "binary");
    const sent = await new OutboxMailer(db).send({
      to: " finance@hospital.test ",
      subject: "Claim pack",
      text: "Please find attached.",
      attachments: [
        { filename: "claim.pdf", content: pdf, contentType: "application/pdf" },
        { filename: "note.txt", content: Buffer.from("hi"), contentType: "text/plain" },
      ],
    });
    const [email] = listOutbox({}, db);
    expect(email).toMatchObject({
      id: sent.id,
      org_id: null,
      to_addr: "finance@hospital.test",
      subject: "Claim pack",
      body_text: "Please find attached.",
    });
    expect(email.attachments.map((a) => [a.filename, a.content_type, a.size_bytes])).toEqual([
      ["claim.pdf", "application/pdf", pdf.length],
      ["note.txt", "text/plain", 2],
    ]);
    const file = getOutboxAttachment(email.attachments[0].id, {}, db);
    expect(file?.content.equals(pdf)).toBe(true);
    expect(Buffer.isBuffer(file?.content)).toBe(true);
  });

  it("works without attachments and lists newest first", async () => {
    const db = getDb(":memory:");
    const mailer = new OutboxMailer(db);
    await mailer.send({ to: "a@x.test", subject: "First", text: "1" });
    await mailer.send({ to: "b@x.test", subject: "Second", text: "2" });
    const list = listOutbox({}, db);
    expect(list.map((e) => e.subject)).toEqual(["Second", "First"]);
    expect(list[0].attachments).toEqual([]);
    expect(listOutbox({ to: "A@X.test" }, db).map((e) => e.subject)).toEqual(["First"]);
  });

  it("rejects an empty recipient and stores nothing", async () => {
    const db = getDb(":memory:");
    await expect(new OutboxMailer(db).send({ to: "  ", subject: "x", text: "" })).rejects.toThrow(/recipient/);
    expect(listOutbox({}, db)).toEqual([]);
  });

  it("scopes by org for listing and attachment download", async () => {
    const db = getDb(":memory:");
    const a = org(db, "AAA111");
    const b = org(db, "BBB222");
    const mailer = new OutboxMailer(db);
    await mailer.send({
      to: "fin@a.test",
      subject: "A",
      text: "",
      orgId: a,
      attachments: [{ filename: "a.pdf", content: Buffer.from("a"), contentType: "application/pdf" }],
    });
    await mailer.send({ to: "fin@b.test", subject: "B", text: "", orgId: b });
    expect(listOutbox({ orgId: a }, db).map((e) => e.subject)).toEqual(["A"]);
    expect(listOutbox({ orgId: null }, db)).toHaveLength(2);
    const attId = listOutbox({ orgId: a }, db)[0].attachments[0].id;
    expect(getOutboxAttachment(attId, { orgId: a }, db)?.filename).toBe("a.pdf");
    expect(getOutboxAttachment(attId, { orgId: b }, db)).toBeUndefined();
    expect(getOutboxAttachment(9999, {}, db)).toBeUndefined();
  });

  it("deleting an email removes its attachments", async () => {
    const db = getDb(":memory:");
    await new OutboxMailer(db).send({
      to: "x@x.test",
      subject: "x",
      text: "",
      attachments: [{ filename: "a.txt", content: Buffer.from("a"), contentType: "text/plain" }],
    });
    db.exec("DELETE FROM outbox");
    expect(db.prepare("SELECT COUNT(*) AS n FROM outbox_attachments").get()).toEqual({ n: 0 });
  });
});

describe("getMailer", () => {
  it("returns the outbox unless SMTP_URL is set", () => {
    const db = getDb(":memory:");
    expect(getMailer({}, db)).toBeInstanceOf(OutboxMailer);
    const smtp = getMailer({ SMTP_URL: "smtp://localhost:2525" }, db);
    expect(smtp).toBeInstanceOf(SmtpMailer);
  });
});

describe("outboxScope", () => {
  it("lets anyone see everything outside production", () => {
    expect(outboxScope({ role: "doctor", org_id: 1 }, "development")).toEqual({ orgId: null });
    expect(outboxScope({ role: "doctor", org_id: 1 }, "test")).toEqual({ orgId: null });
  });

  it("limits production to admin/finance, scoped to their hospital", () => {
    expect(outboxScope({ role: "doctor", org_id: 1 }, "production")).toBe(false);
    expect(outboxScope({ role: "manager", org_id: 1 }, "production")).toBe(false);
    expect(outboxScope({ role: "finance", org_id: 7 }, "production")).toEqual({ orgId: 7 });
    expect(outboxScope({ role: "admin", org_id: 7 }, "production")).toEqual({ orgId: 7 });
    expect(outboxScope({ role: "admin", org_id: null }, "production")).toBe(false);
  });
});
