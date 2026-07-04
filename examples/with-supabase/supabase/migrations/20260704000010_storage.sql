-- 20260704000010_storage.sql
-- Private storage buckets and object policies. Storage RLS mirrors deal access:
-- the deal id is the first path segment, so participation is checked against it.
--
--   deal-documents     : <deal_id>/receipts/<filename>   (purchase receipts)
--   contract-snapshots : <deal_id>/<sha256>.html         (attested contract pack)

insert into storage.buckets (id, name, public)
values
  ('deal-documents',     'deal-documents',     false),
  ('contract-snapshots', 'contract-snapshots', false)
on conflict (id) do nothing;

-- deal-documents: participants read; parties upload. (storage.foldername(name))[1]
-- is the <deal_id> segment.
create policy "deal_documents_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deal-documents'
    and public.is_deal_participant(((storage.foldername(name))[1])::uuid)
  );

create policy "deal_documents_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deal-documents'
    and public.is_deal_party(((storage.foldername(name))[1])::uuid)
  );

-- contract-snapshots: participants read; there is NO authenticated INSERT policy.
-- The immutable snapshot is written by the server with the service role (which
-- bypasses RLS) at entry to witnessing, so clients can never forge or alter it.
create policy "contract_snapshots_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contract-snapshots'
    and public.is_deal_participant(((storage.foldername(name))[1])::uuid)
  );
