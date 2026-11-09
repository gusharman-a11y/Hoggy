import fs from "node:fs";

/** Removes the run's temp database + uploads (see e2e/test-env.ts). */
export default function globalTeardown() {
  const dir = process.env.E2E_DATA_DIR;
  if (dir && dir.includes("studyleave-e2e-")) fs.rmSync(dir, { recursive: true, force: true });
}
