/**
 * Deletes unfiled receipts (rows + files) older than 7 days. Run with `npm run purge`
 * (e.g. daily from cron). Uses DATABASE_PATH / UPLOADS_DIR like the app.
 */
import { closeDb, getDb } from "../src/db";
import { purgeUnfiled, UNFILED_KEEP_DAYS } from "../src/lib/receipt-review";

const removed = purgeUnfiled({ db: getDb() });
closeDb();
console.log(`Deleted ${removed} unfiled receipt${removed === 1 ? "" : "s"} older than ${UNFILED_KEEP_DAYS} days.`);
