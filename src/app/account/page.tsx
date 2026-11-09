import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { getOrg } from "@/lib/users";

export const metadata = { title: "Account · StudyLeave" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const user = await requireRole([], "/account");
  const { created } = await searchParams;
  const org = user.org_id ? getOrg(getDb(), user.org_id) : undefined;

  return (
    <main className="narrow">
      <h1>Hi {user.name}</h1>
      {created && org && (
        <p className="notice" role="status">
          Your hospital is set up. Share this join code with your doctors: <strong>{org.join_code}</strong>
        </p>
      )}
      <dl className="facts">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Role</dt>
        <dd>{user.role}</dd>
        <dt>Hospital</dt>
        <dd>{org?.name ?? "—"}</dd>
        {org && user.role === "admin" && (
          <>
            <dt>Join code</dt>
            <dd data-testid="join-code">{org.join_code}</dd>
          </>
        )}
      </dl>
    </main>
  );
}
