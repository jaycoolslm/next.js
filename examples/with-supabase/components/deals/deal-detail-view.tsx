"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/deals/status-badge";
import { Timeline } from "@/components/deals/timeline";
import { DealActions } from "@/components/deals/deal-actions";
import { DealDocuments } from "@/components/deals/deal-documents";
import { DealWitnesses } from "@/components/deals/deal-witnesses";
import { DealRepayments } from "@/components/deals/deal-repayments";
import { PRE_ACTIVE_STATUSES } from "@/lib/deals/state-machine";
import { dealLifecycle } from "@/content/deal-lifecycle";
import { dealRef, formatDateTime } from "@/lib/format";
import type { DealDetail } from "@/lib/deals/queries";
import type { DealStatus } from "@/lib/types";

const lifecycle = dealLifecycle["en-GB"];

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

export function DealDetailView({ detail }: { detail: DealDetail }) {
  const { deal, viewerRole } = detail;
  const [tab, setTab] = React.useState<"deal" | "log">("deal");
  const isParty = viewerRole === "financier" || viewerRole === "customer";

  const hasReceipt = detail.documents.some(
    (doc) => doc.kind === "purchase_receipt",
  );
  const canUpload =
    viewerRole === "financier" && PRE_ACTIVE_STATUSES.includes(deal.status);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-3">
                <span className="font-mono text-base">{dealRef(deal.id)}</span>
                <StatusBadge status={deal.status} />
              </CardTitle>
              <CardDescription>
                {deal.type === "murabaha" ? "Murabaha" : "Qard hasan"} ·{" "}
                {deal.type === "murabaha" ? "Financier" : "Lender"}:{" "}
                {deal.financier_name} ·{" "}
                {deal.type === "murabaha" ? "Customer" : "Borrower"}:{" "}
                {deal.customer_name}
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <a
                href={`/deals/${deal.id}/contract`}
                target="_blank"
                rel="noreferrer"
              >
                View contract pack
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Timeline type={deal.type} status={deal.status} />
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Regulatory status: {deal.regulatory_status.replace(/_/g, " ")}
            </summary>
            <p className="mt-2 text-muted-foreground">{deal.routing_notes}</p>
          </details>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <TabButton active={tab === "deal"} onClick={() => setTab("deal")}>
          Deal
        </TabButton>
        <TabButton active={tab === "log"} onClick={() => setTab("log")}>
          Event log
        </TabButton>
      </div>

      {tab === "deal" && (
        <div className="flex flex-col gap-6">
          {deal.status === "ownership_window" && (
            <Alert variant="warning">
              <AlertTitle>{lifecycle.ownershipWindow.title}</AlertTitle>
              <AlertDescription>
                {lifecycle.ownershipWindow.body}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Next required action</CardTitle>
            </CardHeader>
            <CardContent>
              <DealActions
                dealId={deal.id}
                type={deal.type}
                status={deal.status}
                viewerRole={viewerRole}
                hasReceipt={hasReceipt}
                settledPence={detail.settledPence}
                receivablePence={detail.receivablePence}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Receipts and the frozen contract snapshot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DealDocuments
                dealId={deal.id}
                documents={detail.documents}
                canUpload={canUpload}
              />
            </CardContent>
          </Card>

          {deal.status === "witnessing" && (
            <Card>
              <CardHeader>
                <CardTitle>Witnesses</CardTitle>
                <CardDescription>
                  Two witnesses must attest before the deal becomes active.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DealWitnesses
                  dealId={deal.id}
                  orgId={deal.org_id}
                  witnesses={detail.witnesses}
                  canInvite={isParty}
                />
              </CardContent>
            </Card>
          )}

          {REPAYMENT_STATUSES.includes(deal.status) && (
            <Card>
              <CardHeader>
                <CardTitle>Repayments</CardTitle>
                <CardDescription>
                  282 records repayments; it never moves money.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DealRepayments
                  dealId={deal.id}
                  repayments={detail.repayments}
                  viewerRole={viewerRole}
                  financierId={deal.financier_id}
                  settledPence={detail.settledPence}
                  receivablePence={detail.receivablePence}
                  canRecord={
                    isParty && RECORDABLE_STATUSES.includes(deal.status)
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "log" && (
        <Card>
          <CardHeader>
            <CardTitle>Event log</CardTitle>
            <CardDescription>
              An append-only, hash-chained record of every change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detail.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seq</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.seq}</TableCell>
                      <TableCell>{formatDateTime(event.created_at)}</TableCell>
                      <TableCell className="font-medium">
                        {event.event_type}
                      </TableCell>
                      <TableCell>{event.actor_name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.hash.slice(0, 12)}…
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
