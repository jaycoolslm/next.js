"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/deals/money-input";
import { advanceDealAction } from "@/app/actions/deals";
import { availableActions, primaryAction } from "@/lib/deals/state-machine";
import type { DealAction } from "@/lib/deals/state-machine";
import { dealLifecycle, guidedLifecycle } from "@/content/deal-lifecycle";
import { formatPence } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DealStatus, DealType } from "@/lib/types";

const lifecycle = dealLifecycle["en-GB"];
const guided = guidedLifecycle["en-GB"];

interface ActionMeta {
  label: string;
  destructive?: boolean;
  title: string;
  body: string;
}

const META: Record<DealAction, ActionMeta> = {
  record_promise: {
    label: "Record non-binding promise",
    title: lifecycle.promise.title,
    body: lifecycle.promise.body,
  },
  record_purchase: {
    label: "Record purchase & ownership",
    title: lifecycle.ownershipWindow.title,
    body:
      "Record that the financier has bought the asset and now owns it. This requires an uploaded purchase receipt. " +
      lifecycle.ownershipWindow.body,
  },
  offer_sale: {
    label: "Offer sale",
    title: lifecycle.saleOffer.title,
    body: lifecycle.saleOffer.body,
  },
  accept_sale: {
    label: "Accept sale",
    title: "Accept the sale offer",
    body: "By accepting, you agree to buy the asset at the disclosed total price on the recorded schedule. This is a separate contract from the earlier promise.",
  },
  offer_terms: {
    label: "Offer loan terms",
    title: "Offer the benevolent loan",
    body: "Offer the qard hasan to the borrower on the recorded terms. The loan is of principal only; you can never ask for anything above it.",
  },
  accept_terms: {
    label: "Accept loan terms",
    title: "Accept the benevolent loan",
    body: "By accepting, you agree to repay the principal on the recorded schedule. The most you can ever owe is the principal.",
  },
  begin_witnessing: {
    label: "Begin witnessing",
    title: lifecycle.witnessing.title,
    body:
      "When you begin witnessing, the contract terms are frozen into a snapshot and given a fingerprint (hash). That exact snapshot is what the two witnesses attest to, and it cannot change afterwards. " +
      lifecycle.witnessing.body,
  },
  cancel: {
    label: "Cancel deal",
    destructive: true,
    title: lifecycle.statuses.cancelled.label,
    body: lifecycle.statuses.cancelled.description,
  },
  raise_dispute: {
    label: "Raise a dispute",
    title: lifecycle.dispute.title,
    body: lifecycle.dispute.body,
  },
  move_to_arbitration: {
    label: "Move to arbitration",
    title: lifecycle.arbitration.title,
    body: lifecycle.arbitration.body,
  },
  settle: {
    label: "Mark as settled",
    title: lifecycle.statuses.settled.label,
    body: lifecycle.statuses.settled.description,
  },
  mark_defaulted: {
    label: "Record default",
    destructive: true,
    title: lifecycle.statuses.defaulted.label,
    body: lifecycle.statuses.defaulted.description,
  },
  grant_ibra: {
    label: "Grant rebate (ibra')",
    title: "Grant a rebate (ibra')",
    body: "You may, entirely at your own choice, reduce the amount owed by granting a rebate. This is recorded as an event and reduces the outstanding balance. The customer cannot require it.",
  },
};

export function DealActions({
  dealId,
  type,
  status,
  viewerRole,
  hasReceipt,
  settledPence,
  receivablePence,
  layout = "list",
}: {
  dealId: string;
  type: DealType;
  status: DealStatus;
  viewerRole: "financier" | "customer" | "witness";
  hasReceipt: boolean;
  settledPence: number;
  receivablePence: number;
  /** "guided" surfaces one primary CTA with secondary controls beneath. */
  layout?: "list" | "guided";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState<DealAction | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [arbitratorName, setArbitratorName] = React.useState("");
  const [arbitratorContact, setArbitratorContact] = React.useState("");
  const [ibraPence, setIbraPence] = React.useState<number | null>(null);

  if (viewerRole === "witness") {
    return (
      <p className="text-sm text-muted-foreground">
        You are viewing this deal as a witness. Only the parties can advance it.
      </p>
    );
  }

  const actions = availableActions(type, status, viewerRole);
  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        There is no action for you to take right now.
      </p>
    );
  }

  const settleDisabled = settledPence < receivablePence;

  function isDisabled(action: DealAction): string | null {
    if (action === "record_purchase" && !hasReceipt) {
      return "Upload a purchase receipt first (see the Documents section below).";
    }
    if (action === "settle" && settleDisabled) {
      return `Recorded and confirmed repayments (${formatPence(
        settledPence,
      )}) do not yet cover the receivable (${formatPence(receivablePence)}).`;
    }
    return null;
  }

  function confirm(action: DealAction) {
    setError(null);
    const payload: Record<string, unknown> = {};
    if (action === "move_to_arbitration") {
      if (arbitratorName.trim())
        payload.arbitrator_name = arbitratorName.trim();
      if (arbitratorContact.trim())
        payload.arbitrator_contact = arbitratorContact.trim();
    }
    if (action === "grant_ibra") {
      if ((ibraPence ?? 0) <= 0) {
        setError("Enter a rebate amount greater than zero.");
        return;
      }
      payload.amount_pence = ibraPence;
    }
    startTransition(async () => {
      const result = await advanceDealAction(dealId, action, payload);
      if (!result.ok) {
        setError(result.error ?? "Could not complete the action.");
        return;
      }
      setOpen(null);
      setArbitratorName("");
      setArbitratorContact("");
      setIbraPence(null);
      router.refresh();
    });
  }

  function openDialog(action: DealAction) {
    setError(null);
    setOpen(action);
  }

  const primary =
    layout === "guided"
      ? primaryAction(type, status, viewerRole)
      : null;

  return (
    <div className="flex flex-col gap-3">
      {layout === "guided" ? (
        <GuidedTriggers
          actions={actions}
          primary={primary}
          isDisabled={isDisabled}
          onOpen={openDialog}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const meta = META[action];
            const disabledReason = isDisabled(action);
            return (
              <div key={action} className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant={meta.destructive ? "destructive" : "default"}
                  disabled={Boolean(disabledReason)}
                  onClick={() => openDialog(action)}
                >
                  {meta.label}
                </Button>
                {disabledReason && (
                  <span className="max-w-xs text-xs text-muted-foreground">
                    {disabledReason}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
      >
        <DialogContent>
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{META[open].title}</DialogTitle>
                <DialogDescription className="text-left">
                  {META[open].body}
                </DialogDescription>
              </DialogHeader>

              {open === "move_to_arbitration" && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="arb-name">Arbitrator name</Label>
                    <Input
                      id="arb-name"
                      value={arbitratorName}
                      onChange={(event) =>
                        setArbitratorName(event.target.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="arb-contact">Arbitrator contact</Label>
                    <Input
                      id="arb-contact"
                      value={arbitratorContact}
                      onChange={(event) =>
                        setArbitratorContact(event.target.value)
                      }
                    />
                  </div>
                </div>
              )}

              {open === "grant_ibra" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ibra-amount">Rebate amount</Label>
                  <MoneyInput
                    id="ibra-amount"
                    valuePence={ibraPence}
                    onChangePence={setIbraPence}
                  />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(null)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={META[open].destructive ? "destructive" : "default"}
                  onClick={() => confirm(open)}
                  disabled={pending}
                >
                  {pending ? "Working…" : "Confirm"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Guided layout: one primary CTA, cancel as a quiet link, rest as outlines. */
function GuidedTriggers({
  actions,
  primary,
  isDisabled,
  onOpen,
}: {
  actions: DealAction[];
  primary: DealAction | null;
  isDisabled: (action: DealAction) => string | null;
  onOpen: (action: DealAction) => void;
}) {
  const rest = actions.filter((action) => action !== primary);
  const hasCancel = rest.includes("cancel");
  const manage = rest.filter((action) => action !== "cancel");
  const primaryDisabled = primary ? isDisabled(primary) : null;

  return (
    <div className="flex flex-col items-center gap-3">
      {primary && (
        <div className="flex w-full flex-col items-center gap-1.5">
          <Button
            type="button"
            size="lg"
            disabled={Boolean(primaryDisabled)}
            onClick={() => onOpen(primary)}
            className="w-full bg-emerald-600 text-base font-semibold text-white shadow-md hover:bg-emerald-700 focus-visible:ring-emerald-600 sm:w-auto sm:min-w-64"
          >
            {guided.actions[primary]?.headline ?? META[primary].label}
            <span aria-hidden> →</span>
          </Button>
          {primaryDisabled && (
            <span className="max-w-sm text-center text-xs text-muted-foreground">
              {primaryDisabled}
            </span>
          )}
        </div>
      )}

      {manage.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {manage.map((action) => {
            const disabledReason = isDisabled(action);
            return (
              <div key={action} className="flex flex-col items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={META[action].destructive ? "destructive" : "outline"}
                  disabled={Boolean(disabledReason)}
                  onClick={() => onOpen(action)}
                >
                  {META[action].label}
                </Button>
                {disabledReason && (
                  <span className="max-w-xs text-center text-[11px] text-muted-foreground">
                    {disabledReason}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasCancel && (
        <button
          type="button"
          onClick={() => onOpen("cancel")}
          className={cn(
            "text-sm text-muted-foreground underline underline-offset-2",
            "hover:text-foreground",
          )}
        >
          {primary ? "Not ready? Cancel this deal" : "Cancel this deal"}
        </button>
      )}
    </div>
  );
}
