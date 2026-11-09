import type { DatabaseSync } from "node:sqlite";
import { createOrg, createUser, findOrgByCode, findUserByEmail, type Org, type Role } from "@/lib/users";

export const DEMO_ORG = { name: "Demo Hospital", joinCode: "DEMO2026", financeEmail: "finance@demo.test" };
export const DEMO_PASSWORD = "password123";
export const DEMO_USERS: { email: string; name: string; role: Role }[] = [
  { email: "manager@demo.test", name: "Morgan Manager", role: "manager" },
  { email: "finance@demo.test", name: "Fran Finance", role: "finance" },
];

/** Inserts the demo hospital and staff logins if they are missing. Safe to run repeatedly. */
export function seed(db: DatabaseSync): { org: Org; users: string[] } {
  const org =
    findOrgByCode(db, DEMO_ORG.joinCode) ??
    createOrg(db, { name: DEMO_ORG.name, financeEmail: DEMO_ORG.financeEmail, joinCode: DEMO_ORG.joinCode });
  for (const u of DEMO_USERS) {
    if (!findUserByEmail(db, u.email)) createUser(db, { orgId: org.id, password: DEMO_PASSWORD, ...u });
  }
  return { org, users: DEMO_USERS.map((u) => u.email) };
}
