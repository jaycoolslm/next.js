import * as React from "react";
import { ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatusBadge, statusLabel } from "@/components/deals/status-badge";
import { LifecycleRail } from "@/components/deals/timeline";
import { DealActions } from "@/components/deals/deal-actions";
import { DealDocuments } from "@/components/deals/deal-documents";
import { DealWitnesses } from "@/components/deals/deal-witnesses";
import { DealRepayments } from "@/components/deals/deal-repayments";
import {
  PRE_ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  lifecycleFor,
  primaryAction,
} from "@/lib/deals/state-machine";
import { guidedLifecycle } from "@/content/deal-lifecycle";
import { summaries } from "@/content/summaries";
import { dealRef, formatDate, formatDateTime, formatPence } from "@/lib/format";
import type { DealDetail } from "@/lib/deals/queries";
import type { DealStatus } from "@/lib/types";

const guided = guidedLifecycle["en-GB"];
const summaryCopy = summaries["en-GB"];

const REPAYMENT_STATUSES: DealStatus[] = [
  "active",
  "disputed",
  "in_arbitration",
  "settled",
];
const RECORDABLE_STATUSES: DealStatus[] = [
  "active",
  "disputed",
  "in_arbitration",
];

/** Replace {token} placeholders in copy with concrete deal values. */
function fill(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key) => tokens[key] ?? whole);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

export function DealDetailView({ detail }: { detail: DealDetail }) {
  const { deal, viewerRole } = detail;
  const isParty = viewerRole === "financier" || viewerRole === "customer";
  const isMurabaha = deal.type === "murabaha";

  const primary =
    viewerRole === "witness"
      ? null
      : primaryAction(deal.type, deal.status, viewerRole);

  const hasReceipt = detail.documents.some(
    (doc) => doc.kind === "purchase_receipt",
  );
  const canUpload =
    viewerRole === "financier" && PRE_ACTIVE_STATUSES.includes(deal.status);

  const tokens: Record<string, string> = {
    financier: deal.financier_name,
    customer: deal.customer_name,
    price: formatPence(detail.receivablePence),
    cost: formatPence(deal.cost_price_pence ?? 0),
    markup: formatPence(deal.markup_pence ?? 0),
    count: String(deal.instalment_count ?? 1),
    instalment: formatPence(deal.instalment_amount_pence ?? 0),
    first: deal.first_due_date ? formatDate(deal.first_due_date) : "—",
  };

  // Hero copy: the pending action if it's the viewer's turn, else a resting /
  // waiting message derived from status. Everything is data-driven from content.
  const heroCopy =
    (primary && guided.actions[primary]) ||
    guided.waiting[deal.status] || {
      kicker: statusLabel(deal.status),
      headline: statusLabel(deal.status),
      support: "",
    };
  const kicker = viewerRole === "witness" ? "Witness view" : heroCopy.kicker;
  const headline = fill(heroCopy.headline, tokens);
  const support = fill(heroCopy.support, tokens);

  const why = primary ? guided.why[primary] : guided.whyStatus[deal.status];
  const generalOverview = isMurabaha
    ? summaryCopy.murabaha.overview
    : summaryCopy.qardHasan.overview;

  const steps = lifecycleFor(deal.type);
  const stepIndex = steps.indexOf(deal.status);

  const roleLabel = (party: "financier" | "customer") =>
    isMurabaha
      ? party === "financier"
        ? "Financier"
        : "Customer"
      : party === "financier"
        ? "Lender"
        : "Borrower";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="truncate text-sm text-muted-foreground">
            {isMurabaha ? "Murabaha" : "Qard hasan"} ·{" "}
            <span className="font-mono">{dealRef(deal.id)}</span>
          </span>
          {stepIndex >= 0 ? (
            <span className="shrink-0 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Step {stepIndex + 1} of {steps.length}
            </span>
          ) : (
            <StatusBadge status={deal.status} className="shrink-0" />
          )}
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-emerald-600/5 to-transparent px-5 py-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {kicker}
          </span>
          <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {headline}
          </h1>
          {support && (
            <p className="max-w-sm text-pretty text-sm text-muted-foreground">
              {support}
            </p>
          )}
          {!TERMINAL_STATUSES.includes(deal.status) && (
            <div className="mt-2 w-full">
              <DealActions
                layout="guided"
                dealId={deal.id}
                type={deal.type}
                status={deal.status}
                viewerRole={viewerRole}
                hasReceipt={hasReceipt}
                settledPence={detail.settledPence}
                receivablePence={detail.receivablePence}
              />
            </div>
          )}
        </div>

        {/* Lifecycle rail */}
        <div className="border-t px-5 py-4">
          <LifecycleRail type={deal.type} status={deal.status} />
        </div>

        {/* Why this step — collapsed by default */}
        {why && (
          <Disclosure summary="Why this step?">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
              <p>{generalOverview}</p>
              <p>
                <span className="font-medium text-foreground">
                  {why.title}.
                </span>{" "}
                {why.body}
              </p>
            </div>
          </Disclosure>
        )}

        {/* The numbers */}
        <Disclosure
          summary="The numbers"
          hint={`${tokens.price} total`}
        >
          <dl className="flex flex-col">
            {isMurabaha ? (
              <>
                <MoneyRow k="You paid for the asset" v={tokens.cost} />
                <MoneyRow k="Your markup" v={tokens.markup} />
                <MoneyRow k="Sale price" v={tokens.price} emphasis />
              </>
            ) : (
              <MoneyRow k="Principal" v={tokens.price} emphasis />
            )}
            <MoneyRow
              k="Repayment"
              v={`${tokens.count} × ${tokens.instalment} / ${deal.frequency === "weekly" ? "week" : "month"}`}
            />
            <MoneyRow k="First instalment" v={tokens.first} />
          </dl>
        </Disclosure>

        {/* Who's involved */}
        <Disclosure summary="Who's involved">
          <div className="flex flex-col">
            <Person
              name={deal.financier_name}
              role={roleLabel("financier")}
              tag={viewerRole === "financier" ? "You" : undefined}
              color="bg-emerald-600"
            />
            <Person
              name={deal.customer_name}
              role={roleLabel("customer")}
              tag={viewerRole === "customer" ? "You" : undefined}
              color="bg-indigo-600"
            />
            {detail.witnesses.length > 0 ? (
              detail.witnesses.map((w) => (
                <Person
                  key={w.user_id}
                  name={w.full_name}
                  role="Witness"
                  tag={w.status === "attested" ? "Attested" : "Invited"}
                  color="bg-slate-500"
                />
              ))
            ) : (
              <Person
                name="Two witnesses"
                role="Invited at the witnessing step"
                color="bg-muted-foreground/40"
                muted
              />
            )}
          </div>
        </Disclosure>

        {/* Documents */}
        <Disclosure
          summary="Documents"
          hint={`${detail.documents.length} on file`}
        >
          <DealDocuments
            dealId={deal.id}
            documents={detail.documents}
            canUpload={canUpload}
          />
        </Disclosure>

        {/* Regulatory scope */}
        <Disclosure
          summary="Regulatory scope"
          hint={deal.regulatory_status.replace(/_/g, " ")}
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            {deal.routing_notes}
          </p>
        </Disclosure>

        {/* Activity log */}
        <Disclosure
          summary="Activity log"
          hint={`${detail.events.length} events`}
        >
          {detail.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seq</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.seq}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(event.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {event.event_type}
                      </TableCell>
                      <TableCell>{event.actor_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Disclosure>

        {/* Contract pack */}
        <div className="border-t p-4">
          <a
            href={`/deals/${deal.id}/contract`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border py-3 text-center text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            View the full contract pack ↗
          </a>
        </div>
      </div>

      {/* Witnessing is the live step — surface it prominently, not hidden. */}
      {deal.status === "witnessing" && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Witnesses</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Two witnesses must attest before the deal becomes active.
          </p>
          <DealWitnesses
            dealId={deal.id}
            orgId={deal.org_id}
            witnesses={detail.witnesses}
            canInvite={isParty}
          />
        </section>
      )}

      {/* Repayments are the ongoing work once a deal is active. */}
      {REPAYMENT_STATUSES.includes(deal.status) && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Repayments</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            282 records repayments; it never moves money.
          </p>
          <DealRepayments
            dealId={deal.id}
            repayments={detail.repayments}
            viewerRole={viewerRole}
            financierId={deal.financier_id}
            settledPence={detail.settledPence}
            receivablePence={detail.receivablePence}
            canRecord={isParty && RECORDABLE_STATUSES.includes(deal.status)}
          />
        </section>
      )}
    </div>
  );
}

/** A native tap-to-expand disclosure row, closed by default. */
function Disclosure({
  summary,
  hint,
  children,
}: {
  summary: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        {hint && (
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90",
            hint ? "" : "ml-auto",
          )}
        />
      </summary>
      <div className="px-5 pb-5 pt-0">{children}</div>
    </details>
  );
}

function MoneyRow({
  k,
  v,
  emphasis,
}: {
  k: string;
  v: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={cn(
          "text-right font-mono font-semibold tabular-nums",
          emphasis && "text-base text-emerald-700 dark:text-emerald-400",
        )}
      >
        {v}
      </span>
    </div>
  );
}

function Person({
  name,
  role,
  tag,
  color,
  muted,
}: {
  name: string;
  role: string;
  tag?: string;
  color: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white",
          color,
        )}
      >
        {muted ? "2" : initials(name)}
      </span>
      <div className="min-w-0">
        <div
          className={cn(
            "truncate text-sm font-medium",
            muted && "text-muted-foreground",
          )}
        >
          {name}
        </div>
        <div className="truncate text-xs text-muted-foreground">{role}</div>
      </div>
      {tag && (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {tag}
        </span>
      )}
    </div>
  );
}
