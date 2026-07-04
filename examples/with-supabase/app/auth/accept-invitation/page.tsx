import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { validateInvitationAction } from "@/app/actions/invitations";
import { AcceptInvitationForm } from "@/components/accept-invitation-form";

async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {await renderInner(token)}
      </div>
    </div>
  );
}

async function renderInner(token: string | undefined) {
  if (!token) {
    return (
      <InvalidCard message="This invitation link is missing its token. Ask your organisation's admin for a new invitation." />
    );
  }

  const result = await validateInvitationAction(token);
  if (!result.ok || !result.data) {
    return (
      <InvalidCard
        message={
          result.error ??
          "This invitation is no longer valid. It may have expired or already been used."
        }
      />
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  return (
    <AcceptInvitationForm
      token={token}
      email={result.data.email}
      orgName={result.data.orgName}
      role={result.data.role}
      isSignedIn={isSignedIn}
    />
  );
}

function InvalidCard({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Invitation not valid</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// cacheComponents requires uncached data access (cookies/auth) behind Suspense.
export default function AcceptInvitationPageWrapper(
  props: Parameters<typeof AcceptInvitationPage>[0],
) {
  return (
    <Suspense fallback={<PageLoading />}>
      <AcceptInvitationPage {...props} />
    </Suspense>
  );
}
