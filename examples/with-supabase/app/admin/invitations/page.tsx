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
import { getActiveOrg } from "@/lib/org";
import { formatDate } from "@/lib/format";
import { CreateInvitationForm } from "@/components/create-invitation-form";
import type { Invitation } from "@/lib/types";

type InvitationStatus = "pending" | "accepted" | "expired";

function invitationStatus(invite: Invitation): InvitationStatus {
  if (invite.accepted_at) return "accepted";
  if (new Date(invite.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

const STATUS_VARIANT: Record<
  InvitationStatus,
  "default" | "secondary" | "outline"
> = {
  accepted: "default",
  pending: "secondary",
  expired: "outline",
};

const STATUS_LABEL: Record<InvitationStatus, string> = {
  accepted: "Accepted",
  pending: "Pending",
  expired: "Expired",
};

export default async function InvitationsPage() {
  const activeOrg = await getActiveOrg();
  if (!activeOrg) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("*")
    .eq("org_id", activeOrg.id)
    .order("created_at", { ascending: false });

  const invitations: Invitation[] = (data as Invitation[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <CreateInvitationForm orgId={activeOrg.id} />

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Invitations</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No invitations yet.
                    </TableCell>
                  </TableRow>
                )}
                {invitations.map((invite) => {
                  const status = invitationStatus(invite);
                  return (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">
                        {invite.email}
                      </TableCell>
                      <TableCell>
                        {invite.role === "admin" ? "Admin" : "Member"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[status]}>
                          {STATUS_LABEL[status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invite.created_at)}</TableCell>
                      <TableCell>{formatDate(invite.expires_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
