import { handleInboundRequest } from "@/lib/inbound-email";

/**
 * Inbound email webhook. The mail provider POSTs each message sent to
 * trip-<code>@in.studyleave.app here as JSON, with header
 * x-inbound-secret = INBOUND_SECRET (compared in constant time).
 * There is no GET: only POST, and only with the secret.
 */
export async function POST(req: Request) {
  return handleInboundRequest(req, { secret: process.env.INBOUND_SECRET });
}
