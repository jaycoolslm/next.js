"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { addWitnessAction } from "@/app/actions/deals";
import type { DealWitness } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DealWitnesses({
  dealId,
  orgId,
  witnesses,
  canInvite,
}: {
  dealId: string;
  orgId: string;
  witnesses: Array<DealWitness & { full_name: string }>;
  canInvite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");

  const slots = [0, 1];

  function invite() {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    startTransition(async () => {
      const result = await addWitnessAction(dealId, orgId, email.trim());
      if (!result.ok) {
        setError(result.error ?? "Could not invite that witness.");
        return;
      }
      setEmail("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {slots.map((index) => {
          const witness = witnesses[index];
          return (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <span className="text-sm">
                {witness ? witness.full_name : `Witness ${index + 1} — vacant`}
              </span>
              {witness && (
                <Badge
                  variant={
                    witness.status === "attested" ? "default" : "secondary"
                  }
                >
                  {witness.status === "attested" ? "Attested" : "Invited"}
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Two witnesses are required. The parties to the deal cannot witness their
        own agreement. Each witness must be a member of this organisation.
      </p>

      {canInvite && witnesses.length < 2 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="witness-email">Invite a witness by email</Label>
            <Input
              id="witness-email"
              type="email"
              placeholder="member@example.org"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div>
            <Button type="button" onClick={invite} disabled={pending}>
              {pending ? "Inviting…" : "Invite witness"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
