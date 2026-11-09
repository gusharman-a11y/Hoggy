import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { closeDb, getDb } from "@/db";
import { parseRobots } from "./robots";
import { addSource, listSources, runIngest, USER_AGENT, type FetchLike } from "./runner";

const fixture = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

type Reply = { status: number; body?: string } | Error;

/** Fake fetch over a URL -> reply map; records every call with a fake clock time. */
function fakeWeb(pages: Record<string, Reply>, clock: { t: number }) {
  const calls: { url: string; at: number; ua: string }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, at: clock.t, ua: init.headers["User-Agent"] });
    const r = pages[url] ?? { status: 404, body: "not found" };
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.body ?? "" };
  };
  return { fetch, calls };
}

describe("parseRobots", () => {
  const txt = `
# comment
User-agent: *
Disallow: /private/
Allow: /private/ok
Disallow: /*.pdf$

User-agent: OtherBot
Disallow: /

User-agent: StudyLeaveBot
Disallow: /no-bots
`;
  it("uses the group for our bot when there is one", () => {
    const r = parseRobots(txt, USER_AGENT);
    expect(r.isAllowed("/no-bots/page")).toBe(false);
    expect(r.isAllowed("/private/x")).toBe(true); // * group doesn't apply
  });
  it("falls back to * with longest-match, wildcards and $", () => {
    const r = parseRobots(txt, "SomeBot/1.0");
    expect(r.isAllowed("/private/x")).toBe(false);
    expect(r.isAllowed("/private/ok/page")).toBe(true);
    expect(r.isAllowed("/files/a.pdf")).toBe(false);
    expect(r.isAllowed("/files/a.pdf?x=1")).toBe(true);
    expect(r.isAllowed("/events")).toBe(true);
  });
  it("empty Disallow allows everything; empty file allows everything", () => {
    expect(parseRobots("User-agent: *\nDisallow:", USER_AGENT).isAllowed("/a")).toBe(true);
    expect(parseRobots("", USER_AGENT).isAllowed("/a")).toBe(true);
  });
});

describe("runIngest", () => {
  let db: DatabaseSync;
  let clock: { t: number };
  const sleeps: number[] = [];
  const sleep = async (ms: number) => {
    sleeps.push(ms);
    clock.t += ms;
  };

  beforeEach(() => {
    db = getDb(":memory:");
    clock = { t: 1_000_000 };
    sleeps.length = 0;
  });
  afterEach(() => closeDb());

  it("adds sources once and rejects non-http URLs", () => {
    addSource("https://example.org/events", db);
    addSource("https://example.org/events", db);
    expect(listSources(db)).toHaveLength(1);
    expect(() => addSource("ftp://example.org/x", db)).toThrow();
  });

  it("fetches with our User-Agent, extracts, upserts and records status", async () => {
    addSource("https://example.org/asm", db);
    addSource("https://example.org/events", db);
    addSource("https://example.org/private/page", db);
    addSource("https://example.org/missing", db);
    addSource("https://example.net/plain", db);
    addSource("https://down.example.com/x", db);
    const web = fakeWeb(
      {
        "https://example.org/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /private/" },
        "https://example.org/asm": { status: 200, body: fixture("graph-education-event.html") },
        "https://example.org/events": { status: 200, body: fixture("array-events.html") },
        // example.net has no robots.txt (404 -> allowed)
        "https://example.net/plain": { status: 200, body: fixture("no-jsonld.html") },
        "https://down.example.com/robots.txt": new Error("ECONNREFUSED"),
      },
      clock,
    );

    const results = await runIngest({ db, fetch: web.fetch, sleep, now: () => clock.t });

    expect(results.map((r) => [r.url, r.status, r.events_found])).toEqual([
      ["https://example.org/asm", "ok", 1],
      ["https://example.org/events", "ok", 2],
      ["https://example.org/private/page", "blocked by robots.txt", 0],
      ["https://example.org/missing", "http 404", 0],
      ["https://example.net/plain", "ok", 0],
      ["https://down.example.com/x", "blocked by robots.txt", 0],
    ]);
    expect(web.calls.every((c) => c.ua === "StudyLeaveBot/0.1")).toBe(true);
    // robots.txt fetched once per host; the blocked page never fetched
    expect(web.calls.filter((c) => c.url === "https://example.org/robots.txt")).toHaveLength(1);
    expect(web.calls.some((c) => c.url.includes("/private/"))).toBe(false);

    const count = db.prepare("SELECT COUNT(*) AS n FROM conferences WHERE source = 'ingest'").get() as { n: number };
    expect(count.n).toBe(3);

    const rows = listSources(db);
    expect(rows.every((r) => r.last_fetched_at)).toBe(true);
    expect(rows.find((r) => r.url.endsWith("/events"))).toMatchObject({ last_status: "ok", events_found: 2 });
  });

  it("waits at least 2s between requests to the same host, not across hosts", async () => {
    addSource("https://example.org/a", db);
    addSource("https://example.net/a", db);
    addSource("https://example.org/b", db);
    const web = fakeWeb({}, clock);
    await runIngest({ db, fetch: web.fetch, sleep, now: () => clock.t });

    const byHost = new Map<string, number[]>();
    for (const c of web.calls) {
      const h = new URL(c.url).host;
      byHost.set(h, [...(byHost.get(h) ?? []), c.at]);
    }
    expect(byHost.get("example.org")).toHaveLength(3); // robots + a + b
    for (const times of byHost.values())
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(2000);
    // example.net's first request didn't wait for example.org
    const netFirst = web.calls.findIndex((c) => c.url.startsWith("https://example.net"));
    expect(web.calls[netFirst].at - web.calls[netFirst - 1].at).toBeLessThan(2000);
  });

  it("re-running updates rather than duplicating", async () => {
    addSource("https://example.org/asm", db);
    const pages = { "https://example.org/asm": { status: 200, body: fixture("graph-education-event.html") } };
    await runIngest({ db, fetch: fakeWeb(pages, clock).fetch, sleep, now: () => clock.t });
    await runIngest({ db, fetch: fakeWeb(pages, clock).fetch, sleep, now: () => clock.t });
    const count = db.prepare("SELECT COUNT(*) AS n FROM conferences").get() as { n: number };
    expect(count.n).toBe(1);
  });
});
