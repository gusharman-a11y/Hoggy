import { buildClaimPack, claimPackFilename } from "@/claims/pack";
import { getCurrentUser } from "@/lib/auth";
import { getTripForViewer } from "@/lib/trips";

/** The trip's claim pack PDF, for anyone who can view the trip. Read-only: builds in memory, stores nothing. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Log in to view the claim pack", { status: 401 });
  const tripId = Number((await params).id);
  const trip = Number.isInteger(tripId) && tripId > 0 ? getTripForViewer(tripId, user) : undefined;
  if (!trip) return new Response("Not found", { status: 404 });
  const pack = await buildClaimPack(trip.id, { orgId: user.org_id ?? -1 });
  const filename = claimPackFilename(trip.conference_slug, trip.owner_name);
  return new Response(new Uint8Array(pack.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pack.bytes.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
