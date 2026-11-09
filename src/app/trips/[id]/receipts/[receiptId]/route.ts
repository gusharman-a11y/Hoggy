import fs from "node:fs";
import { getCurrentUser } from "@/lib/auth";
import { getReceipt, resolveUploadPath } from "@/lib/receipts";
import { getTripForViewer } from "@/lib/trips";

/** Opens one receipt file for anyone who can view the trip. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; receiptId: string }> }) {
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
  const filename = receipt.original_name || receipt.file_path.split("/").pop() || "receipt";
  const download = new URL(req.url).searchParams.get("download") === "1";
  const ascii = filename.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": receipt.mime_type ?? "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
