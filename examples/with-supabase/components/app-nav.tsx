import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { OrgSwitcher } from "@/components/org-switcher";
import { getActiveOrg, getUserOrgs } from "@/lib/org";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/deals/new", label: "New deal" },
];

export async function AppNav() {
  const [orgs, activeOrg] = await Promise.all([getUserOrgs(), getActiveOrg()]);
  const isAdmin = activeOrg?.role === "admin";

  return (
    <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
      <div className="w-full max-w-5xl flex justify-between items-center gap-4 p-3 px-5 text-sm">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="font-semibold text-lg">
            282
          </Link>
          <div className="flex items-center gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Admin
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeOrg && (
            <OrgSwitcher orgs={orgs} activeOrgId={activeOrg.id} />
          )}
          <ThemeSwitcher />
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
