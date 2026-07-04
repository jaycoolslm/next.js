import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { DealDetailView } from "@/components/deals/deal-detail-view";
import { getDealDetail } from "@/lib/deals/queries";

async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getDealDetail(id);
  if (!detail) notFound();

  return (
    <>
      <AppNav />
      <div className="w-full max-w-4xl mx-auto py-8 px-4">
        <DealDetailView detail={detail} />
      </div>
    </>
  );
}

// cacheComponents requires uncached data access (cookies/auth) behind Suspense.
export default function DealDetailPageWrapper(
  props: Parameters<typeof DealDetailPage>[0],
) {
  return (
    <Suspense fallback={<PageLoading />}>
      <DealDetailPage {...props} />
    </Suspense>
  );
}
