"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uploadReceiptAction } from "@/app/actions/deals";
import { formatDate } from "@/lib/format";
import type { DealDocument } from "@/lib/types";

const KIND_LABELS: Record<DealDocument["kind"], string> = {
  purchase_receipt: "Purchase receipt",
  contract_snapshot: "Contract snapshot",
};

export function DealDocuments({
  dealId,
  documents,
  canUpload,
}: {
  dealId: string;
  documents: DealDocument[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadReceiptAction(dealId, formData);
      if (!result.ok) {
        setError(result.error ?? "Upload failed.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents recorded yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Fingerprint (sha256)</TableHead>
              <TableHead>Recorded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{KIND_LABELS[doc.kind]}</TableCell>
                <TableCell className="font-mono text-xs">
                  {doc.sha256.slice(0, 12)}…
                </TableCell>
                <TableCell>{formatDate(doc.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canUpload && (
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-file">Upload a purchase receipt</Label>
            <Input id="receipt-file" name="file" type="file" required />
            <p className="text-xs text-muted-foreground">
              Evidence that the financier bought and owns the asset. Stored
              privately; a fingerprint is recorded in the ledger.
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Upload receipt"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
