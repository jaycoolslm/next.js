import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WitnessCeremony } from "@/components/deals/witness-ceremony";
import { createClient } from "@/lib/supabase/server";
import { getDealDetail } from "@/lib/deals/queries";
import { witness as witnessCopy, summaries } from "@/content";
import { dealRef, formatDate, formatPence } from "@/lib/format";

const ayah = witnessCopy["en-GB"].ayah;
const reviewIntro = witnessCopy["en-GB"].reviewIntro;
const summaryCopy = summaries["en-GB"];

async function WitnessPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const detail = await getDealDetail(dealId);
  if (!detail) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const witnessRow = detail.witnesses.find((w) => w.user_id === user?.id);

  if (!witnessRow) {
    return (
      <>
        <AppNav />
        <div className="w-full max-w-2xl mx-auto py-10 px-4">
          <Card>
            <CardHeader>
              <CardTitle>You are not a witness on this deal</CardTitle>
              <CardDescription>
                Only invited witnesses can review and attest this agreement.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  const { deal } = detail;
  const summary =
    deal.type === "murabaha" ? summaryCopy.murabaha : summaryCopy.qardHasan;
  const snapshotSha =
    detail.documents.find((doc) => doc.kind === "contract_snapshot")?.sha256 ??
    null;
  const alreadyAttested =
    witnessRow.status === "attested" ||
    detail.attestations.some((a) => a.witness_user_id === user?.id);

  return (
    <>
      <AppNav />
      <div className="w-full max-w-4xl mx-auto py-8 px-4 flex flex-col gap-6">
        {/* Ayah */}
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 text-center">
            <p dir="rtl" lang="ar" className="text-2xl leading-loose">
              {ayah.arabic}
            </p>
            <p className="text-sm italic text-muted-foreground">
              “{ayah.translation}”
            </p>
            <p className="text-xs text-muted-foreground">
              {ayah.reference} · {ayah.translationAttribution}
            </p>
          </CardContent>
        </Card>

        {/* Review intro */}
        <Card>
          <CardHeader>
            <CardTitle>{reviewIntro.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{reviewIntro.body}</p>
          </CardContent>
        </Card>

        {/* Plain-English summary */}
        <Card>
          <CardHeader>
            <CardTitle>{summary.title}</CardTitle>
            <CardDescription>{summary.overview}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <Fact label="Reference">{dealRef(deal.id)}</Fact>
              <Fact label={deal.type === "murabaha" ? "Financier" : "Lender"}>
                {deal.financier_name}
              </Fact>
              <Fact label={deal.type === "murabaha" ? "Customer" : "Borrower"}>
                {deal.customer_name}
              </Fact>
              {deal.type === "murabaha" ? (
                <>
                  <Fact label="Asset">{deal.asset_description ?? "—"}</Fact>
                  <Fact label="Cost price">
                    {formatPence(deal.cost_price_pence ?? 0)}
                  </Fact>
                  <Fact label="Markup">
                    {formatPence(deal.markup_pence ?? 0)}
                  </Fact>
                  <Fact label="Total price">
                    {formatPence(deal.total_price_pence ?? 0)}
                  </Fact>
                </>
              ) : (
                <Fact label="Principal">
                  {formatPence(deal.principal_pence ?? 0)}
                </Fact>
              )}
              <Fact label="Schedule">
                {deal.frequency?.replace(/_/g, " ")} ·{" "}
                {deal.instalment_count ?? 1} ×{" "}
                {formatPence(deal.instalment_amount_pence ?? 0)}
              </Fact>
              <Fact label="First due date">
                {deal.first_due_date ? formatDate(deal.first_due_date) : "—"}
              </Fact>
            </dl>

            <ul className="flex flex-col gap-2">
              {summary.obligations.map((line) => (
                <li key={line.party}>
                  <span className="font-medium">{line.party}: </span>
                  <span className="text-muted-foreground">
                    {line.obligation}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-muted-foreground">{summary.witnesses}</p>
            <p className="text-muted-foreground">{summary.dispute}</p>
          </CardContent>
        </Card>

        {/* Read-only contract snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>The recorded terms you are attesting to</CardTitle>
            <CardDescription>
              This is the exact, frozen contract snapshot. It will not change
              after you attest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <iframe
              title="Contract snapshot"
              src={`/deals/${deal.id}/contract`}
              className="w-full h-[70vh] border rounded"
            />
          </CardContent>
        </Card>

        {/* Ceremony */}
        <WitnessCeremony
          dealId={deal.id}
          snapshotSha={snapshotSha}
          alreadyAttested={alreadyAttested}
        />
      </div>
    </>
  );
}

function Fact({
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
      <dd className="capitalize break-words">{children}</dd>
    </div>
  );
}

// cacheComponents requires uncached data access (cookies/auth) behind Suspense.
export default function WitnessPageWrapper(
  props: Parameters<typeof WitnessPage>[0],
) {
  return (
    <Suspense fallback={<PageLoading />}>
      <WitnessPage {...props} />
    </Suspense>
  );
}
