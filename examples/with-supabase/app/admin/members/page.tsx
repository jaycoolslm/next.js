import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/org";
import type { OrgRole } from "@/lib/types";

interface MemberRow {
  user_id: string;
  role: OrgRole;
  full_name: string | null;
  email: string | null;
}

async function MembersPage() {
  const activeOrg = await requireOrgAdmin();

  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", activeOrg.id);

  const members = memberRows ?? [];
  const userIds = members.map((m) => m.user_id);

  const { data: profileRows } = userIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds)
    : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };

  const profiles = new Map(
    (profileRows ?? []).map((p) => [p.user_id, p]),
  );

  const rows: MemberRow[] = members
    .map((m) => {
      const profile = profiles.get(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role as OrgRole,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
      };
    })
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Members</h2>
        <p className="text-sm text-muted-foreground">
          People who belong to {activeOrg.name}.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No members yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell className="font-medium">
                    {row.full_name ?? "—"}
                  </TableCell>
                  <TableCell>{row.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={row.role === "admin" ? "default" : "secondary"}
                    >
                      {row.role === "admin" ? "Admin" : "Member"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// cacheComponents requires uncached data access (cookies/auth) behind Suspense.
export default function MembersPageWrapper() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MembersPage />
    </Suspense>
  );
}
