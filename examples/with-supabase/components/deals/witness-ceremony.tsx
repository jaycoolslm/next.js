"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  requestAttestationOtpAction,
  attestDealAction,
} from "@/app/actions/witness";
import { witness as witnessCopy } from "@/content/witness";

const copy = witnessCopy["en-GB"];

export function WitnessCeremony({
  dealId,
  snapshotSha,
  alreadyAttested,
}: {
  dealId: string;
  snapshotSha: string | null;
  alreadyAttested: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<"start" | "attest" | "done">(
    "start",
  );
  const [otp, setOtp] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [nowActive, setNowActive] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (alreadyAttested) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{copy.confirmation.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {copy.confirmation.body}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!snapshotSha) {
    return (
      <Alert>
        <AlertTitle>Not ready to attest yet</AlertTitle>
        <AlertDescription>
          The parties have not yet frozen the contract snapshot for this deal.
          You will be able to attest once they begin witnessing.
        </AlertDescription>
      </Alert>
    );
  }

  function requestOtp() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await requestAttestationOtpAction();
      if (!result.ok) {
        setError(result.error ?? "Could not send the code.");
        return;
      }
      setPhase("attest");
      setInfo("We have emailed you a 6-digit code.");
    });
  }

  function submit() {
    setError(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Type your full legal name.");
      return;
    }
    startTransition(async () => {
      const result = await attestDealAction(
        dealId,
        otp.trim(),
        name.trim(),
        snapshotSha as string,
      );
      if (!result.ok || !result.data) {
        setError(result.error ?? "Attestation failed.");
        return;
      }
      setNowActive(result.data.newStatus === "active");
      setPhase("done");
      router.refresh();
    });
  }

  if (phase === "done") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{copy.confirmation.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {copy.confirmation.body}
          </p>
          {nowActive && (
            <Alert>
              <AlertDescription>
                Both witnesses have now attested. The deal is active and all
                parties are being emailed a link to the contract pack.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {phase === "start" ? copy.otpRequest.title : copy.attestation.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {phase === "start" && (
          <>
            <p className="text-sm text-muted-foreground">
              {copy.otpRequest.body}
            </p>
            <div>
              <Button type="button" onClick={requestOtp} disabled={pending}>
                {pending ? "Sending…" : copy.otpRequest.buttonLabel}
              </Button>
            </div>
          </>
        )}

        {phase === "attest" && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{copy.otpEntry.title}</p>
              <p className="text-sm text-muted-foreground">
                {copy.otpEntry.body}
              </p>
              <Label htmlFor="otp">{copy.otpEntry.inputLabel}</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="max-w-[10rem] tracking-[0.4em]"
              />
              <button
                type="button"
                className="self-start text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
                onClick={requestOtp}
                disabled={pending}
              >
                {copy.otpEntry.resendLabel}
              </button>
            </div>

            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-sm font-medium">{copy.attestation.title}</p>
              <p className="text-sm text-muted-foreground">
                {copy.attestation.instruction}
              </p>
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                {copy.attestation.declaration}
              </div>
              <Label htmlFor="attest-name">
                {copy.attestation.nameFieldLabel}
              </Label>
              <Input
                id="attest-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div>
              <Button type="button" onClick={submit} disabled={pending}>
                {pending ? "Attesting…" : copy.attestation.submitLabel}
              </Button>
            </div>
          </>
        )}

        {info && !error && (
          <p className="text-sm text-muted-foreground">{info}</p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
