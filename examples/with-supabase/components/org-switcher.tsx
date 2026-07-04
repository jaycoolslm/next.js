"use client";

import { useTransition } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchOrgAction } from "@/app/actions/org";
import type { ActiveOrg } from "@/lib/org";

export function OrgSwitcher({
  orgs,
  activeOrgId,
}: {
  orgs: ActiveOrg[];
  activeOrgId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const active = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];

  if (orgs.length === 0 || !active) return null;

  const handleChange = (orgId: string) => {
    if (orgId === activeOrgId) return;
    startTransition(() => {
      switchOrgAction(orgId);
    });
  };

  // A single org needs no switcher — just show the name.
  if (orgs.length === 1) {
    return (
      <span className="text-sm font-medium truncate max-w-[10rem]">
        {active.name}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          className="gap-2"
        >
          <span className="truncate max-w-[10rem]">{active.name}</span>
          <ChevronsUpDown size={14} className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel>Organisation</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={activeOrgId} onValueChange={handleChange}>
          {orgs.map((org) => (
            <DropdownMenuRadioItem key={org.id} value={org.id}>
              {org.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
