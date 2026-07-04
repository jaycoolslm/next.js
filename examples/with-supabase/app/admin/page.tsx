import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org";
import { formatDate, formatDateTime } from "@/lib/format";
import { STANDARD_DISCLAIMER } from "@/content/disclaimers";
import type {
  DealStatus,
  DealType,
  RegulatoryStatus,
  TripwireAlert,
  TripwireLevel,
} from "@/lib/types";
import { TripwireBadge } from "@/components/tripwire-badge";

interface GovernanceDeal {
  id: string;
  org_id: string;
  type: DealType;
  status: DealStatus;
  created_at: string;
  regulatory_status: RegulatoryStatus;
  financier_name: string | null;
  customer_name: string | null;
}

const TYPE_LABELS: Record<DealType, string> = {
  murabaha: "Murabaha",
  qard_hasan: "Qard hasan",
};

function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default async function GovernancePage() {
  const activeOrg = await getActiveOrg();
  if (!activeOrg) return null;

  const supabase = await createClient();

  const [dealsResult, alertsResult] = await Promise.all([
    supabase.rpc("get_governance_deals", { p_org_id: activeOrg.id }),
    supabase
      .from("tripwire_alerts")
      .select("*")
      .eq("org_id", activeOrg.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const deals: GovernanceDeal[] = (dealsResult.data as GovernanceDeal[]) ?? [];
  const alerts: TripwireAlert[] = (alertsResult.data as TripwireAlert[]) ?? [];

  const byStatus = countBy(deals, (d) => d.status);
  const byType = countBy(deals, (d) => d.type);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total deals</CardDescription>
            <CardTitle className="text-3xl">{deals.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} className="flex justify-between">
                <span>{TYPE_LABELS[type as DealType] ?? humanise(type)}</span>
                <span className="font-medium text-foreground">{count}</span>
              </div>
            ))}
            {deals.length === 0 && <span>No deals recorded yet.</span>}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>By status</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(byStatus).length === 0 && (
              <span className="text-sm text-muted-foreground">
                No deals recorded yet.
              </span>
            )}
            {Object.entries(byStatus).map(([status, count]) => (
              <Badge key={status} variant="secondary" className="gap-1.5">
                {humanise(status)}
                <span className="font-semibold">{count}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Tripwire alerts</h2>
          <p className="text-sm text-muted-foreground">
            Alerts raised for financiers in this organisation.
          </p>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tripwire alerts.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((alert) => (
              <Alert
                key={alert.id}
                variant={alertVariant(alert.level)}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <TripwireBadge level={alert.level} />
                  <AlertTitle className="mb-0">
                    {humanise(alert.level)}
                  </AlertTitle>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(alert.created_at)}
                    {alert.acknowledged_at ? " · acknowledged" : ""}
                  </span>
                </div>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{STANDARD_DISCLAIMER}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Deals</h2>
        <p className="text-sm text-muted-foreground">
          Governance metadata only — financial terms, documents and events are
          never visible to admins unless they are a party or witness.
        </p>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Financier</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Regulatory</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No deals recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {deals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell>
                      {TYPE_LABELS[deal.type] ?? humanise(deal.type)}
                    </TableCell>
                    <TableCell>{deal.financier_name ?? "—"}</TableCell>
                    <TableCell>{deal.customer_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {humanise(deal.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{humanise(deal.regulatory_status)}</TableCell>
                    <TableCell>{formatDate(deal.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function alertVariant(level: TripwireLevel): "warning" | "destructive" | "default" {
  if (level === "red") return "destructive";
  if (level === "amber") return "warning";
  return "default";
}
