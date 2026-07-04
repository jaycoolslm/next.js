"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createInvitationAction } from "@/app/actions/invitations";
import type { OrgRole } from "@/lib/types";

export function CreateInvitationForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    startTransition(async () => {
      const result = await createInvitationAction(orgId, email, role);
      if (!result.ok || !result.data) {
        setError(result.error ?? "Could not create the invitation");
        return;
      }
      setInviteUrl(result.data.inviteUrl);
      setEmail("");
      setRole("member");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Invite someone</CardTitle>
        <CardDescription>
          Send an invitation to join this organisation. Access is invite-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="grid gap-2 flex-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:w-40">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending…" : "Send invitation"}
          </Button>
        </form>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {inviteUrl && (
          <div className="grid gap-2 rounded-md border bg-muted/40 p-4">
            <Label htmlFor="invite-url">Invitation link</Label>
            <Input
              id="invite-url"
              type="text"
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              This link is shown once. It has also been emailed to the invitee.
              Copy it now if you want to share it directly.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
