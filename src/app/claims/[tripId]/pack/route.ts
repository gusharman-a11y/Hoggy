import { claimPackForFinance } from "@/claims/finance";
import { getCurrentUser } from "@/lib/auth";

/** The claim pack exactly as emailed to finance (finance/admin of the trip's hospital). Read-only. */
export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Log in to download", { status: 401 });
  const tripId = Number((await params).tripId);
  const file = Number.isInteger(tripId) && tripId > 0 ? await claimPackForFinance(tripId, user) : undefined;
  if (!file) return new Response("Not found", { status: 404 });
  const ascii = file.filename.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
