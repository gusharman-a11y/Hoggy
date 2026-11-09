/**
 * `npm run ingest`            fetch every page in the sources table
 * `npm run ingest -- add URL` add a source page (then run ingest)
 * `npm run ingest -- list`    show sources and their last status
 * Uses DATABASE_PATH or data/app.db.
 */
import { closeDb, getDb } from "../src/db";
import { addSource, listSources, runIngest } from "../src/ingest/runner";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const db = getDb();
  if (cmd === "add") {
    if (!args.length) throw new Error("Usage: npm run ingest -- add <url> [url...]");
    for (const url of args) console.log(`Added ${addSource(url, db).url}`);
  } else if (cmd === "list") {
    for (const s of listSources(db))
      console.log(`${s.id}\t${s.url}\t${s.last_status ?? "never fetched"}\t${s.events_found ?? "-"}\t${s.last_fetched_at ?? ""}`);
  } else if (cmd === undefined) {
    const results = await runIngest({ db, log: console.log });
    const total = results.reduce((n, r) => n + r.events_found, 0);
    console.log(`Done: ${results.length} sources, ${total} events.`);
  } else {
    throw new Error(`Unknown command "${cmd}". Use: add <url>, list, or no argument to run.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
