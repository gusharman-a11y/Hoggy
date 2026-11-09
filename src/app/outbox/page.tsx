import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { listOutbox, outboxScope } from "@/lib/mailer";

export const metadata = { title: "Outbox · StudyLeave" };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function OutboxPage() {
  const user = await requireRole([], "/outbox");
  const scope = outboxScope(user);
  if (!scope) redirect("/?denied=1");
  const emails = listOutbox({ orgId: scope.orgId });

  return (
    <main>
      <h1>Outbox</h1>
      <p className="muted">
        Emails the app has sent. Nothing here left the building: in this setup emails are stored, not
        delivered.
      </p>
      {emails.length === 0 ? (
        <p className="empty">No emails yet.</p>
      ) : (
        <ul className="outbox-list" data-testid="outbox-list">
          {emails.map((e) => (
            <li key={e.id} className="outbox-email" data-testid={`outbox-email-${e.id}`}>
              <h2>{e.subject}</h2>
              <p className="conf-meta">
                <span>To: {e.to_addr}</span>
                {e.cc_addr && <span>Cc: {e.cc_addr}</span>}
                <span>{e.created_at.replace("T", " ").slice(0, 16)} UTC</span>
              </p>
              {e.body_text && <pre className="outbox-body">{e.body_text}</pre>}
              {e.attachments.length > 0 && (
                <ul className="outbox-attachments">
                  {e.attachments.map((a) => (
                    <li key={a.id}>
                      <a href={`/outbox/attachments/${a.id}`} download={a.filename}>
                        {a.filename}
                      </a>{" "}
                      <span className="muted small">
                        ({a.content_type}, {formatSize(a.size_bytes)})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
