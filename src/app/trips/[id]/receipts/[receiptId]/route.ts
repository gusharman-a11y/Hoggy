import fs from "node:fs";
import { getCurrentUser } from "@/lib/auth";
import { getReceipt, resolveUploadPath } from "@/lib/receipts";
import { getTripForViewer } from "@/lib/trips";

/** Opens one receipt file for anyone who can view the trip. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; receiptId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Log in to view receipts", { status: 401 });
  const p = await params;
  const tripId = Number(p.id);
  const receiptId = Number(p.receiptId);
  const trip = Number.isInteger(tripId) ? getTripForViewer(tripId, user) : undefined;
  const receipt = trip && Number.isInteger(receiptId) ? getReceipt(receiptId) : undefined;
  if (!trip || !receipt || receipt.trip_id !== trip.id || !receipt.file_path) return new Response("Not found", { status: 404 });
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(/*turbopackIgnore: true*/ resolveUploadPath(receipt.file_path));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const filename = receipt.file_path.split("/").pop() ?? "receipt";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": receipt.mime_type ?? "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
