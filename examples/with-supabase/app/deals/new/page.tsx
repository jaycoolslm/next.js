import { AppNav } from "@/components/app-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DealWizard } from "@/components/deals/deal-wizard";
import { getActiveOrg } from "@/lib/org";

export default async function NewDealPage() {
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
                You need to accept an invitation from a masjid before you can
                record an agreement.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <div className="w-full max-w-3xl mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Record a new deal</h1>
          <p className="text-sm text-muted-foreground">{org.name}</p>
        </div>
        <DealWizard orgId={org.id} />
      </div>
    </>
  );
}
