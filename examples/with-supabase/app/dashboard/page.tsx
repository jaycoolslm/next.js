import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/deals/status-badge";
import { getActiveOrg } from "@/lib/org";
import {
  getMyDeals,
  getMyWitnessRequests,
  getReceivablesSummary,
  getMyTripwireAlerts,
} from "@/lib/deals/queries";
import { dealRef, formatDate, formatPence } from "@/lib/format";
import type { TripwireLevel } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  murabaha: "Murabaha",
  qard_hasan: "Qard hasan",
};

const TRIPWIRE_VARIANT: Record<TripwireLevel, "warning" | "destructive"> = {
  amber: "warning",
  red: "destructive",
  qard_info: "warning",
};

export default async function DashboardPage() {
  const org = await getActiveOrg();

  if (!org) {
    return (
      <>
        <AppNav />
        <div className="w-full max-w-2xl mx-auto py-10 px-4">
          <Card>
            <CardHeader>
              <CardTitle>No organisation yet</CardTitle>
              <CardDescription>
                282 is invite-only. You need to accept an invitation from a
                masjid before you can record or witness agreements.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Ask an administrator of your organisation to send you an
              invitation by email, then open the link it contains to join.
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const [deals, witnessRequests, receivables, tripwires] = await Promise.all([
    getMyDeals(org.id),
    getMyWitnessRequests(),
    getReceivablesSummary(org.id),
    getMyTripwireAlerts(org.id),
  ]);

  return (
    <>
      <AppNav />
      <div className="w-full max-w-5xl mx-auto py-8 px-4 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{org.name}</p>
          </div>
          <Button asChild>
            <Link href="/deals/new">Record a new deal</Link>
          </Button>
        </div>

        {tripwires.length > 0 && (
          <div className="flex flex-col gap-3">
            {tripwires.map((alert) => (
              <Alert key={alert.id} variant={TRIPWIRE_VARIANT[alert.level]}>
                <AlertTitle className="flex items-center gap-2">
                  <Badge
                    variant={
                      alert.level === "red" ? "destructive" : "secondary"
                    }
                  >
                    {alert.level === "qard_info"
                      ? "Notice"
                      : alert.level.toUpperCase()}
                  </Badge>
                  Compliance notice
                </AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Receivables</CardTitle>
            <CardDescription>
              Total outstanding owed to you across your active agreements.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="text-3xl font-bold">
              {formatPence(receivables.outstandingPence)}
            </span>
            <span className="text-sm text-muted-foreground">
              across {receivables.activeDeals}{" "}
              {receivables.activeDeals === 1 ? "agreement" : "agreements"} — may
              be relevant to your zakat calculation
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My deals</CardTitle>
            <CardDescription>
              Agreements where you are the financier or the customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have no deals yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => (
                    <TableRow key={deal.id}>
                      <TableCell className="font-mono text-xs">
                        {dealRef(deal.id)}
                      </TableCell>
                      <TableCell>{TYPE_LABELS[deal.type] ?? deal.type}</TableCell>
                      <TableCell>
                        {deal.financier_id === deal.customer_id
                          ? "—"
                          : deal.customer_name === "System"
                            ? deal.financier_name
                            : `${deal.financier_name} / ${deal.customer_name}`}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={deal.status} />
                      </TableCell>
                      <TableCell>{formatDate(deal.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" size="sm" asChild>
                          <Link href={`/deals/${deal.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My witnessing requests</CardTitle>
            <CardDescription>
              Agreements you have been asked to witness.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {witnessRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have no witnessing requests.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Parties</TableHead>
                    <TableHead>Your status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {witnessRequests.map((deal) => (
                    <TableRow key={deal.id}>
                      <TableCell className="font-mono text-xs">
                        {dealRef(deal.id)}
                      </TableCell>
                      <TableCell>{TYPE_LABELS[deal.type] ?? deal.type}</TableCell>
                      <TableCell>
                        {deal.financier_name} / {deal.customer_name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            deal.witness_status === "attested"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {deal.witness_status === "attested"
                            ? "Attested"
                            : "Invited"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" size="sm" asChild>
                          <Link href={`/witness/${deal.id}`}>
                            {deal.witness_status === "attested"
                              ? "Review"
                              : "Witness"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
