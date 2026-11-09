import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { getOrg } from "@/lib/users";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Settings · StudyLeave" };

export default async function SettingsPage() {
  const user = await requireRole(["admin"], "/settings");
  const org = user.org_id == null ? undefined : getOrg(getDb(), user.org_id);

  return (
    <main className="narrow">
      <h1>Hospital settings</h1>
      {!org ? (
        <p className="empty">You aren&apos;t part of a hospital yet.</p>
      ) : (
        <>
          <dl className="facts">
            <dt>Hospital</dt>
            <dd>{org.name}</dd>
            <dt>Join code</dt>
            <dd>
              <code>{org.join_code}</code>
            </dd>
          </dl>
          <SettingsForm financeEmail={org.finance_email ?? ""} />
        </>
      )}
    </main>
  );
}
