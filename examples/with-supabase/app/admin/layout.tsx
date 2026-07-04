import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getActiveOrg } from "@/lib/org";

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
  const activeOrg = await getActiveOrg();
  const isAdmin = activeOrg?.role === "admin";

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <AppNav />
        <div className="flex-1 w-full max-w-5xl flex flex-col gap-8 p-5 py-10">
          {isAdmin && activeOrg ? (
            <>
              <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Admin
                </h1>
                <p className="text-sm text-muted-foreground">
                  {activeOrg.name}
                </p>
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
            </>
          ) : (
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="text-2xl">
                  Admins only
                </CardTitle>
                <CardDescription>
                  You need to be an administrator of this organisation to view
                  the admin area. If you believe this is a mistake, ask another
                  admin to update your role.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          )}
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
