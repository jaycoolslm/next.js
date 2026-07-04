"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/deals/money-input";
import { previewRoutingAction, createDealAction } from "@/app/actions/deals";
import type { NewDealInput } from "@/app/actions/deals";
import { tripwire as tripwireCopy } from "@/content/tripwire";
import { formatPence } from "@/lib/format";
import type {
  BorrowerEntityType,
  DealPurpose,
  DealType,
  ScheduleFrequency,
  TripwireLevel,
} from "@/lib/types";

const tripwireLevels = tripwireCopy["en-GB"].levels;

const TYPE_EXPLAINERS: Record<DealType, string> = {
  murabaha:
    "A cost-plus-markup sale. The financier buys an asset, owns it and bears its risk, then sells it to the customer at a disclosed total price payable over time. The markup is profit on a sale, not interest.",
  qard_hasan:
    "A benevolent loan of money. The lender lends a sum and the borrower repays exactly that sum — nothing more. The lender takes no benefit of any kind.",
};

const STEPS = [
  "Type",
  "Parties",
  "Routing",
  "Terms",
  "Schedule",
  "Review",
] as const;

interface WizardState {
  type: DealType;
  myRole: "financier" | "customer";
  counterpartyEmail: string;
  borrowerEntityType: BorrowerEntityType;
  purpose: DealPurpose;
  assetDescription: string;
  supplierName: string;
  costPricePence: number | null;
  markupPence: number | null;
  principalPence: number | null;
  frequency: ScheduleFrequency;
  instalmentCount: number;
  instalmentAmountPence: number | null;
  firstDueDate: string;
  arbitratorName: string;
  arbitratorContact: string;
}

interface PreviewResult {
  regulatoryStatus: string;
  note: string;
  tripwire: TripwireLevel | null;
  tripwireBody?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isFutureDate(iso: string): boolean {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${iso}T00:00:00`) > today;
}

export function DealWizard({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<WizardState>({
    type: "murabaha",
    myRole: "financier",
    counterpartyEmail: "",
    borrowerEntityType: "individual",
    purpose: "personal",
    assetDescription: "",
    supplierName: "",
    costPricePence: null,
    markupPence: null,
    principalPence: null,
    frequency: "monthly",
    instalmentCount: 1,
    instalmentAmountPence: null,
    firstDueDate: "",
    arbitratorName: "",
    arbitratorContact: "",
  });

  const [preview, setPreview] = React.useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [tripwireAck, setTripwireAck] = React.useState<TripwireLevel | null>(
    null,
  );
  const [showTripwire, setShowTripwire] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  const amountPence =
    state.type === "murabaha"
      ? (state.costPricePence ?? 0) + (state.markupPence ?? 0)
      : (state.principalPence ?? 0);

  const stepValid = React.useMemo(() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return EMAIL_RE.test(state.counterpartyEmail.trim());
      case 2:
        return Boolean(state.borrowerEntityType && state.purpose);
      case 3:
        if (state.type === "murabaha") {
          return (
            state.assetDescription.trim().length > 0 &&
            state.supplierName.trim().length > 0 &&
            (state.costPricePence ?? 0) > 0 &&
            (state.markupPence ?? 0) >= 0
          );
        }
        return (state.principalPence ?? 0) > 0;
      case 4: {
        const count = state.frequency === "lump_sum" ? 1 : state.instalmentCount;
        return (
          count >= 1 &&
          (state.instalmentAmountPence ?? 0) > 0 &&
          isFutureDate(state.firstDueDate)
        );
      }
      default:
        return true;
    }
  }, [step, state]);

  async function runPreview() {
    setPreviewLoading(true);
    setError(null);
    setPreview(null);
    setTripwireAck(null);
    const result = await previewRoutingAction(
      state.type,
      state.myRole,
      orgId,
      state.counterpartyEmail.trim().toLowerCase(),
      state.borrowerEntityType,
      state.purpose,
      amountPence,
    );
    setPreviewLoading(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Could not check this deal.");
      return;
    }
    setPreview(result.data);
    if (result.data.tripwire === "amber" || result.data.tripwire === "red") {
      setShowTripwire(true);
    }
  }

  function goNext() {
    if (step === STEPS.length - 2) {
      setStep(step + 1);
      void runPreview();
      return;
    }
    setStep(step + 1);
  }

  async function submit() {
    setError(null);
    const blocking =
      preview?.tripwire === "amber" || preview?.tripwire === "red";
    if (blocking && tripwireAck !== preview?.tripwire) {
      setShowTripwire(true);
      return;
    }
    setCreating(true);
    const count = state.frequency === "lump_sum" ? 1 : state.instalmentCount;
    const input: NewDealInput = {
      orgId,
      type: state.type,
      myRole: state.myRole,
      counterpartyEmail: state.counterpartyEmail.trim().toLowerCase(),
      instalmentCount: count,
      instalmentAmountPence: state.instalmentAmountPence ?? 0,
      firstDueDate: state.firstDueDate,
      frequency: state.frequency,
      borrowerEntityType: state.borrowerEntityType,
      purpose: state.purpose,
      arbitratorName: state.arbitratorName.trim() || undefined,
      arbitratorContact: state.arbitratorContact.trim() || undefined,
      tripwireAcknowledged: tripwireAck ?? undefined,
    };
    if (state.type === "murabaha") {
      input.assetDescription = state.assetDescription.trim();
      input.supplierName = state.supplierName.trim();
      input.costPricePence = state.costPricePence ?? 0;
      input.markupPence = state.markupPence ?? 0;
    } else {
      input.principalPence = state.principalPence ?? 0;
    }
    const result = await createDealAction(input);
    if (!result.ok || !result.data) {
      setCreating(false);
      setError(result.error ?? "Could not create the deal.");
      return;
    }
    router.push(`/deals/${result.data.dealId}`);
  }

  const financierWord = state.type === "qard_hasan" ? "lender" : "financier";
  const customerWord = state.type === "qard_hasan" ? "borrower" : "customer";
  const blocking = preview?.tripwire === "amber" || preview?.tripwire === "red";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{STEPS[step]}</CardTitle>
        <CardDescription>
          Step {step + 1} of {STEPS.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Step 1 — type */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            {(["murabaha", "qard_hasan"] as DealType[]).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer flex-col gap-1 rounded-md border p-4 has-[:checked]:border-primary"
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="deal-type"
                    checked={state.type === option}
                    onChange={() => update("type", option)}
                  />
                  {option === "murabaha" ? "Murabaha" : "Qard hasan"}
                </span>
                <span className="pl-6 text-sm text-muted-foreground">
                  {TYPE_EXPLAINERS[option]}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Step 2 — parties */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="myRole">Your role</Label>
              <Select
                id="myRole"
                value={state.myRole}
                onChange={(event) =>
                  update(
                    "myRole",
                    event.target.value as WizardState["myRole"],
                  )
                }
              >
                <option value="financier">
                  I am the {financierWord}
                </option>
                <option value="customer">I am the {customerWord}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="counterpartyEmail">
                {state.myRole === "financier" ? customerWord : financierWord}{" "}
                email
              </Label>
              <Input
                id="counterpartyEmail"
                type="email"
                placeholder="member@example.org"
                value={state.counterpartyEmail}
                onChange={(event) =>
                  update("counterpartyEmail", event.target.value)
                }
              />
              <p className="text-sm text-muted-foreground">
                Enter the exact email address of the other party. They must
                already be a member of this organisation — there is no directory
                to browse and no way to search for people.
              </p>
              {state.counterpartyEmail.length > 0 &&
                !EMAIL_RE.test(state.counterpartyEmail.trim()) && (
                  <p className="text-sm text-destructive">
                    Enter a valid email address.
                  </p>
                )}
            </div>
          </div>
        )}

        {/* Step 3 — routing */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="borrowerEntityType">
                What is the {customerWord}?
              </Label>
              <Select
                id="borrowerEntityType"
                value={state.borrowerEntityType}
                onChange={(event) =>
                  update(
                    "borrowerEntityType",
                    event.target.value as BorrowerEntityType,
                  )
                }
              >
                <option value="individual">An individual</option>
                <option value="sole_trader">A sole trader</option>
                <option value="partnership">A partnership</option>
                <option value="ltd_company">A limited company</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="purpose">Purpose of the finance</Label>
              <Select
                id="purpose"
                value={state.purpose}
                onChange={(event) =>
                  update("purpose", event.target.value as DealPurpose)
                }
              >
                <option value="personal">Personal</option>
                <option value="business">Business</option>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              These answers determine the regulatory routing note shown before
              you create the deal.
            </p>
          </div>
        )}

        {/* Step 4 — terms */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            {state.type === "murabaha" ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="assetDescription">Asset description</Label>
                  <Textarea
                    id="assetDescription"
                    placeholder="e.g. Toyota Corolla 2019, registration ..."
                    value={state.assetDescription}
                    onChange={(event) =>
                      update("assetDescription", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="supplierName">Supplier</Label>
                  <Input
                    id="supplierName"
                    placeholder="Who the financier buys the asset from"
                    value={state.supplierName}
                    onChange={(event) =>
                      update("supplierName", event.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="costPrice">Cost price</Label>
                    <MoneyInput
                      id="costPrice"
                      valuePence={state.costPricePence}
                      onChangePence={(pence) => update("costPricePence", pence)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="markup">Markup</Label>
                    <MoneyInput
                      id="markup"
                      valuePence={state.markupPence}
                      onChangePence={(pence) => update("markupPence", pence)}
                    />
                  </div>
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  Total price (cost + markup):{" "}
                  <span className="font-semibold">
                    {formatPence(
                      (state.costPricePence ?? 0) + (state.markupPence ?? 0),
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="principal">Principal</Label>
                <MoneyInput
                  id="principal"
                  valuePence={state.principalPence}
                  onChangePence={(pence) => update("principalPence", pence)}
                />
                <p className="text-sm text-muted-foreground">
                  A qard hasan is principal only. Nothing can ever be added to
                  this amount.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 5 — schedule */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="frequency">Repayment frequency</Label>
              <Select
                id="frequency"
                value={state.frequency}
                onChange={(event) => {
                  const freq = event.target.value as ScheduleFrequency;
                  update("frequency", freq);
                  if (freq === "lump_sum") update("instalmentCount", 1);
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="lump_sum">Single lump sum</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="instalmentCount">Number of instalments</Label>
                <Input
                  id="instalmentCount"
                  type="number"
                  min={1}
                  disabled={state.frequency === "lump_sum"}
                  value={
                    state.frequency === "lump_sum" ? 1 : state.instalmentCount
                  }
                  onChange={(event) =>
                    update(
                      "instalmentCount",
                      Math.max(1, Number(event.target.value) || 1),
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="instalmentAmount">Amount per instalment</Label>
                <MoneyInput
                  id="instalmentAmount"
                  valuePence={state.instalmentAmountPence}
                  onChangePence={(pence) =>
                    update("instalmentAmountPence", pence)
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstDueDate">First due date</Label>
              <Input
                id="firstDueDate"
                type="date"
                value={state.firstDueDate}
                onChange={(event) =>
                  update("firstDueDate", event.target.value)
                }
              />
              {state.firstDueDate && !isFutureDate(state.firstDueDate) && (
                <p className="text-sm text-destructive">
                  The first due date must be in the future.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="arbitratorName">
                  Nominated arbitrator (optional)
                </Label>
                <Input
                  id="arbitratorName"
                  value={state.arbitratorName}
                  onChange={(event) =>
                    update("arbitratorName", event.target.value)
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="arbitratorContact">
                  Arbitrator contact (optional)
                </Label>
                <Input
                  id="arbitratorContact"
                  value={state.arbitratorContact}
                  onChange={(event) =>
                    update("arbitratorContact", event.target.value)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 6 — review */}
        {step === 5 && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Detail label="Type">
                {state.type === "murabaha" ? "Murabaha" : "Qard hasan"}
              </Detail>
              <Detail label="Your role">
                {state.myRole === "financier" ? financierWord : customerWord}
              </Detail>
              <Detail label={`${customerWord} email`}>
                {state.counterpartyEmail}
              </Detail>
              <Detail label={`${customerWord} type`}>
                {state.borrowerEntityType.replace(/_/g, " ")}
              </Detail>
              <Detail label="Purpose">{state.purpose}</Detail>
              {state.type === "murabaha" ? (
                <>
                  <Detail label="Asset">{state.assetDescription}</Detail>
                  <Detail label="Supplier">{state.supplierName}</Detail>
                  <Detail label="Cost price">
                    {formatPence(state.costPricePence ?? 0)}
                  </Detail>
                  <Detail label="Markup">
                    {formatPence(state.markupPence ?? 0)}
                  </Detail>
                  <Detail label="Total price">
                    {formatPence(amountPence)}
                  </Detail>
                </>
              ) : (
                <Detail label="Principal">
                  {formatPence(state.principalPence ?? 0)}
                </Detail>
              )}
              <Detail label="Frequency">
                {state.frequency.replace(/_/g, " ")}
              </Detail>
              <Detail label="Instalments">
                {state.frequency === "lump_sum" ? 1 : state.instalmentCount} ×{" "}
                {formatPence(state.instalmentAmountPence ?? 0)}
              </Detail>
              <Detail label="First due date">{state.firstDueDate}</Detail>
              {state.arbitratorName && (
                <Detail label="Arbitrator">{state.arbitratorName}</Detail>
              )}
            </dl>

            {previewLoading && (
              <p className="text-sm text-muted-foreground">
                Checking regulatory routing…
              </p>
            )}

            {preview && (
              <Alert
                variant={
                  preview.tripwire === "red"
                    ? "destructive"
                    : preview.tripwire
                      ? "warning"
                      : "default"
                }
              >
                <AlertTitle>
                  Regulatory status:{" "}
                  {preview.regulatoryStatus.replace(/_/g, " ")}
                </AlertTitle>
                <AlertDescription>{preview.note}</AlertDescription>
              </Alert>
            )}

            {preview?.tripwire === "qard_info" && (
              <Alert variant="warning">
                <AlertTitle>{tripwireLevels.qard_info.title}</AlertTitle>
                <AlertDescription>
                  {tripwireLevels.qard_info.body}
                </AlertDescription>
              </Alert>
            )}

            {blocking && tripwireAck !== preview?.tripwire && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTripwire(true)}
              >
                Read the required notice
              </Button>
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || creating}
            onClick={() => setStep(Math.max(0, step - 1))}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!stepValid} onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button
              type="button"
              disabled={
                creating ||
                previewLoading ||
                !preview ||
                (blocking && tripwireAck !== preview?.tripwire)
              }
              onClick={submit}
            >
              {creating ? "Creating…" : "Create deal"}
            </Button>
          )}
        </div>
      </CardContent>

      {/* Blocking tripwire modal (§6) */}
      {preview && blocking && (
        <Dialog
          open={showTripwire}
          onOpenChange={(open) => {
            // Blocking: only allow closing once acknowledged.
            if (!open && tripwireAck === preview.tripwire) setShowTripwire(false);
          }}
        >
          <DialogContent hideClose>
            <DialogHeader>
              <DialogTitle>
                {tripwireLevels[preview.tripwire as "amber" | "red"].title}
              </DialogTitle>
              <DialogDescription className="text-left text-foreground">
                {tripwireLevels[preview.tripwire as "amber" | "red"].body}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  setTripwireAck(preview.tripwire);
                  setShowTripwire(false);
                }}
              >
                {
                  tripwireLevels[preview.tripwire as "amber" | "red"]
                    .acknowledgeLabel
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
