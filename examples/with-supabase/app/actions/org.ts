"use server";

import { redirect } from "next/navigation";
import { setActiveOrgCookie } from "@/lib/org";

export async function switchOrgAction(orgId: string) {
  await setActiveOrgCookie(orgId);
  redirect("/dashboard");
}
