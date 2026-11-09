import fs from "node:fs";
import { getCurrentUser } from "@/lib/auth";
import { resolveUploadPath } from "@/lib/receipts";
import { getUnfiledReceipt } from "@/lib/unfiled-receipts";

/** Opens one unfiled receipt file. Only its owner may see it (others get 404). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Log in to view receipts", { status: 401 });
  const id = Number((await params).id);
  const receipt = Number.isInteger(id) && id > 0 ? getUnfiledReceipt(id, user.id) : undefined;
  if (!receipt) return new Response("Not found", { status: 404 });
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
      "Content-Type": receipt.mime_type,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
