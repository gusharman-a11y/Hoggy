import { getCurrentUser } from "@/lib/auth";
import { getOutboxAttachment, outboxScope } from "@/lib/mailer";

/** Downloads one outbox attachment (same access rule as /outbox). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Log in to download", { status: 401 });
  const scope = outboxScope(user);
  if (!scope) return new Response("Not allowed", { status: 403 });
  const id = Number((await params).id);
  const file = Number.isInteger(id) ? getOutboxAttachment(id, { orgId: scope.orgId }) : undefined;
  if (!file) return new Response("Not found", { status: 404 });
  const ascii = file.filename.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": file.content_type,
      "Content-Length": String(file.content.length),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
