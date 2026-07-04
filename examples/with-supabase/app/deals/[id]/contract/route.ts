// The contract pack (§8): a single print-ready HTML document.
//
// Access control is the deal's own RLS: this handler uses the caller's
// cookie-scoped client, so a non-participant simply gets 404 — the deal row
// does not exist for them.
//
// Snapshot behaviour: once a snapshot exists (created at entry to
// `witnessing`), this route serves the snapshot bytes verbatim — what you
// print is byte-for-byte what the witnesses attested to (same sha256). Before
// that, it renders a live preview watermarked as such.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContractPackData } from "@/lib/contract/data";
import { renderContractPackHtml } from "@/lib/contract/render";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!deal) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Serve the attested snapshot when one exists.
  const { data: snapshot } = await supabase
    .from("deal_documents")
    .select("storage_path")
    .eq("deal_id", id)
    .eq("kind", "contract_snapshot")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshot) {
    const { data: file, error } = await supabase.storage
      .from("contract-snapshots")
      .download(snapshot.storage_path);
    if (!error && file) {
      return new NextResponse(await file.text(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "private, no-store",
        },
      });
    }
  }

  // No snapshot yet: live preview.
  const pack = await getContractPackData(supabase, id);
  if (!pack) return new NextResponse("Not found", { status: 404 });
  const html = renderContractPackHtml(pack).replace(
    "<h1>282 — Contract pack</h1>",
    '<h1>282 — Contract pack</h1><p style="color:#8a6d00;font-weight:bold">PREVIEW — this document has not been snapshotted for witnessing yet.</p>',
  );
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
