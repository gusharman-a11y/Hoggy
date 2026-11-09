import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
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
                {(user.role === "manager" || user.role === "admin") && <Link href="/team">Team</Link>}
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
