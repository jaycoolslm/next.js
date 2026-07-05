import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { requireOrgAdmin } from "@/lib/org";

const adminLinks = [
  { href: "/admin", label: "Governance" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/settings", label: "Settings" },
];

async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authorisation: non-admins are redirected to /dashboard before
  // any admin UI or data is rendered. This is the enforcement point — hiding
  // the nav link is only a convenience.
  const activeOrg = await requireOrgAdmin();

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <AppNav />
        <div className="flex-1 w-full max-w-5xl flex flex-col gap-8 p-5 py-10">
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
            <p className="text-sm text-muted-foreground">{activeOrg.name}</p>
          </header>
          <nav className="flex flex-wrap gap-4 border-b pb-3 text-sm">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </div>
    </main>
  );
}

// cacheComponents requires uncached data access (cookies/auth) behind Suspense.
export default function AdminLayoutWrapper(
  props: Parameters<typeof AdminLayout>[0],
) {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminLayout {...props} />
    </Suspense>
  );
}
