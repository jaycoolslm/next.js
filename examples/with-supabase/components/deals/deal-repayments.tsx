"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoneyInput } from "@/components/deals/money-input";
import {
  recordRepaymentAction,
  confirmRepaymentAction,
} from "@/app/actions/deals";
import { formatDate, formatPence } from "@/lib/format";
import type { Repayment } from "@/lib/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DealRepayments({
  dealId,
  repayments,
  viewerRole,
  financierId,
  settledPence,
  receivablePence,
  canRecord,
}: {
  dealId: string;
  repayments: Repayment[];
  viewerRole: "financier" | "customer" | "witness";
  financierId: string;
  settledPence: number;
  receivablePence: number;
  canRecord: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [amountPence, setAmountPence] = React.useState<number | null>(null);
  const [paidOn, setPaidOn] = React.useState(todayIso());
  const [note, setNote] = React.useState("");

  const percent =
    receivablePence > 0
      ? Math.min(100, Math.round((settledPence / receivablePence) * 100))
      : 0;

  function recorderRole(recordedBy: string): "financier" | "customer" {
    return recordedBy === financierId ? "financier" : "customer";
  }

  function record() {
    setError(null);
    if ((amountPence ?? 0) <= 0) {
      setError("Enter a repayment amount greater than zero.");
      return;
    }
    startTransition(async () => {
      const result = await recordRepaymentAction(
        dealId,
        amountPence ?? 0,
        paidOn,
        note.trim() || undefined,
      );
      if (!result.ok) {
        setError(result.error ?? "Could not record the repayment.");
        return;
      }
      setAmountPence(null);
      setNote("");
      setPaidOn(todayIso());
      router.refresh();
    });
  }

  function confirmRepayment(repaymentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await confirmRepaymentAction(repaymentId, dealId);
      if (!result.ok) {
        setError(result.error ?? "Could not confirm the repayment.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm">
          <span>Recorded and confirmed</span>
          <span className="font-medium">
            {formatPence(settledPence)} of {formatPence(receivablePence)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {repayments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No repayments recorded yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Confirmed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repayments.map((repayment) => {
              const recordedByRole = recorderRole(repayment.recorded_by);
              const canConfirm =
                viewerRole !== "witness" &&
                viewerRole !== recordedByRole &&
                !repayment.counterparty_confirmed;
              return (
                <TableRow key={repayment.id}>
                  <TableCell>{formatDate(repayment.paid_on)}</TableCell>
                  <TableCell>{formatPence(repayment.amount_pence)}</TableCell>
                  <TableCell className="capitalize">{recordedByRole}</TableCell>
                  <TableCell>{repayment.note ?? "—"}</TableCell>
                  <TableCell>
                    {repayment.counterparty_confirmed ? (
                      <Badge>Confirmed</Badge>
                    ) : canConfirm ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => confirmRepayment(repayment.id)}
                      >
                        Confirm
                      </Button>
                    ) : (
                      <Badge variant="secondary">Awaiting confirmation</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {canRecord && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">Record a repayment</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rp-amount">Amount</Label>
              <MoneyInput
                id="rp-amount"
                valuePence={amountPence}
                onChangePence={setAmountPence}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rp-date">Paid on</Label>
              <Input
                id="rp-date"
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rp-note">Note (optional)</Label>
              <Input
                id="rp-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div>
            <Button type="button" onClick={record} disabled={pending}>
              {pending ? "Recording…" : "Record repayment"}
            </Button>
          </div>
        </div>
      )}

      {!canRecord && error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
