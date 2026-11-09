// Ingest runner: fetches each page in `sources`, honours robots.txt,
// spaces requests to the same host, extracts JSON-LD events and upserts them.
// All I/O (fetch, sleep, clock) is injectable so tests never touch the network.
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { extractEvents } from "./extract";
import { ALLOW_ALL, DISALLOW_ALL, parseRobots, type Robots } from "./robots";
import { upsertConferences } from "./upsert";

export const USER_AGENT = "StudyLeaveBot/0.1";
export const MIN_HOST_DELAY_MS = 2000;

export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface Source {
  id: number;
  url: string;
  last_fetched_at: string | null;
  last_status: string | null;
  events_found: number | null;
}

export interface IngestOptions {
  db?: DatabaseSync;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (msg: string) => void;
  minDelayMs?: number;
}

export interface SourceResult {
  url: string;
  status: string;
  events_found: number;
}

/** Adds a source page (ignored if already there). Throws on a non-http(s) URL. */
export function addSource(url: string, db: DatabaseSync = getDb()): Source {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error(`Not an http(s) URL: ${url}`);
  db.prepare("INSERT OR IGNORE INTO sources (url) VALUES (?)").run(u.href);
  return db.prepare("SELECT * FROM sources WHERE url = ?").get(u.href) as unknown as Source;
}

export function listSources(db: DatabaseSync = getDb()): Source[] {
  return db.prepare("SELECT * FROM sources ORDER BY id").all() as unknown as Source[];
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Runs every source once and records last_fetched_at / last_status / events_found. */
export async function runIngest(opts: IngestOptions = {}): Promise<SourceResult[]> {
  const db = opts.db ?? getDb();
  const doFetch: FetchLike = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const sleep = opts.sleep ?? realSleep;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? (() => {});
  const minDelay = opts.minDelayMs ?? MIN_HOST_DELAY_MS;
  const headers = { "User-Agent": USER_AGENT };

  const lastHit = new Map<string, number>();
  const robotsCache = new Map<string, Robots>();

  async function politeFetch(url: string) {
    const host = new URL(url).host;
    const prev = lastHit.get(host);
    if (prev !== undefined) {
      const wait = prev + minDelay - now();
      if (wait > 0) await sleep(wait);
    }
    try {
      return await doFetch(url, { headers });
    } finally {
      lastHit.set(host, now());
    }
  }

  async function robotsFor(u: URL): Promise<Robots> {
    const cached = robotsCache.get(u.origin);
    if (cached) return cached;
    let robots: Robots;
    try {
      const res = await politeFetch(`${u.origin}/robots.txt`);
      if (res.ok) robots = parseRobots(await res.text(), USER_AGENT);
      else if (res.status >= 400 && res.status < 500) robots = ALLOW_ALL; // no robots.txt
      else robots = DISALLOW_ALL; // server trouble: stay away this run
    } catch {
      robots = DISALLOW_ALL;
    }
    robotsCache.set(u.origin, robots);
    return robots;
  }

  const record = db.prepare(
    `UPDATE sources SET last_fetched_at = strftime('%Y-%m-%d %H:%M:%f', 'now'),
       last_status = ?, events_found = ? WHERE id = ?`,
  );

  const results: SourceResult[] = [];
  for (const src of listSources(db)) {
    let status: string;
    let found = 0;
    try {
      const u = new URL(src.url);
      const robots = await robotsFor(u);
      if (!robots.isAllowed(u.pathname + u.search)) {
        status = "blocked by robots.txt";
      } else {
        const res = await politeFetch(src.url);
        if (!res.ok) {
          status = `http ${res.status}`;
        } else {
          const events = extractEvents(await res.text(), src.url);
          upsertConferences(events, "ingest", db);
          found = events.length;
          status = "ok";
        }
      }
    } catch (e) {
      status = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
    record.run(status, found, src.id);
    log(`${src.url}: ${status} (${found} events)`);
    results.push({ url: src.url, status, events_found: found });
  }
  return results;
}
