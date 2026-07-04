import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveOrg } from "@/lib/org";

async function SettingsPage() {
  const activeOrg = await getActiveOrg();
  if (!activeOrg) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Organisation settings</h2>
        <p className="text-sm text-muted-foreground">
          These details are read-only in this version.
        </p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{activeOrg.name}</CardTitle>
          <CardDescription>Masjid organisation on 282.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{activeOrg.name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Slug</span>
            <span className="font-mono">{activeOrg.slug}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Your role</span>
            <span className="font-medium">
              {activeOrg.role === "admin" ? "Administrator" : "Member"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// cacheComponents requires uncached data access (cookies/auth) behind Suspense.
export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SettingsPage />
    </Suspense>
  );
}
