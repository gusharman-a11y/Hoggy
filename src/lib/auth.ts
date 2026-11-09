import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { createSession, deleteSession, getSessionUser, SESSION_DAYS, type Role, type User } from "./users";

export type { Role, User } from "./users";

export const SESSION_COOKIE = "sl_session";

/** The logged-in user for this request, or undefined. */
export async function getCurrentUser(): Promise<User | undefined> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(getDb(), id);
}

/**
 * Returns the logged-in user if they have one of `roles` (any role when none given).
 * Logged-out users go to /login (and back to `next` afterwards); wrong role goes home.
 */
export async function requireRole(roles: Role | Role[] = [], next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (allowed.length > 0 && !allowed.includes(user.role)) redirect("/?denied=1");
  return user;
}

/** Starts a session for the user and sets the httpOnly cookie (server actions only). */
export async function logIn(userId: number): Promise<void> {
  const id = createSession(getDb(), userId);
  (await cookies()).set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/** Ends the current session and clears the cookie (server actions only). */
export async function logOut(): Promise<void> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) deleteSession(getDb(), id);
  store.delete(SESSION_COOKIE);
}
