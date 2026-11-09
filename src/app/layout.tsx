import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { outboxScope } from "@/lib/mailer";
import { APP_NAME, TAGLINE } from "@/lib/site";
import { logoutAction } from "./auth-actions";

export const metadata: Metadata = {
  title: APP_NAME,
  description: TAGLINE,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="topnav">
          <Link href="/" className="brand">
            {APP_NAME}
          </Link>
          <nav>
            <Link href="/conferences">Conferences</Link>
            {user ? (
              <>
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/trips">Trips</Link>
                {(user.role === "manager" || user.role === "admin") && (
                  <>
                    <Link href="/approvals">Approvals</Link>
                    <Link href="/team">Team</Link>
                  </>
                )}
                {(user.role === "finance" || user.role === "admin") && <Link href="/claims">Claims</Link>}
                {user.role === "admin" && <Link href="/settings">Settings</Link>}
                {outboxScope(user) && <Link href="/outbox">Outbox</Link>}
                <Link href="/account">{user.name}</Link>
                <form action={logoutAction}>
                  <button type="submit" className="link">
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/signup">Sign up</Link>
              </>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
