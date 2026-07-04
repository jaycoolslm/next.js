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
import {
  acceptInvitationExistingAction,
  acceptInvitationSignupAction,
} from "@/app/actions/invitations";
import type { OrgRole } from "@/lib/types";

export function AcceptInvitationForm({
  token,
  email,
  orgName,
  role,
  isSignedIn,
}: {
  token: string;
  email: string;
  orgName: string;
  role: OrgRole;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const finish = () => {
    router.push("/dashboard");
    router.refresh();
  };

  if (isSignedIn) {
    const handleJoin = () => {
      setError(null);
      startTransition(async () => {
        const result = await acceptInvitationExistingAction(token);
        if (!result.ok) {
          setError(result.error ?? "Could not accept the invitation");
          return;
        }
        finish();
      });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Join {orgName}</CardTitle>
          <CardDescription>
            You have been invited to join {orgName} as {roleLabel(role)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={handleJoin} disabled={isPending} className="w-full">
            {isPending ? "Joining…" : `Join ${orgName}`}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }
    startTransition(async () => {
      const result = await acceptInvitationSignupAction(
        token,
        fullName,
        password,
      );
      if (!result.ok) {
        setError(result.error ?? "Could not create your account");
        return;
      }
      finish();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Accept your invitation</CardTitle>
        <CardDescription>
          Set up your account to join {orgName} as {roleLabel(role)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} readOnly disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="repeat-password">Repeat password</Label>
            <Input
              id="repeat-password"
              type="password"
              required
              autoComplete="new-password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating your account…" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function roleLabel(role: OrgRole): string {
  return role === "admin" ? "an administrator" : "a member";
}
