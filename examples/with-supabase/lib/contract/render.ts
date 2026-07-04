// Contract pack renderer (§8). Produces a single self-contained, print-ready
// (A4) HTML document as a string. Deterministic for a given ContractPackData:
// the snapshot stored at entry to `witnessing` is hashed, witnesses attest to
// that hash, and the live route re-serves the identical bytes afterwards.

import {
  CONTRACT_PACK_FOOTER,
  contracts,
  disclaimers,
  summaries,
  witness,
  type ContractSection,
  type ContractTemplate,
} from "@/content";
import { dealRef, formatDateTime, formatPence } from "@/lib/format";
import { buildSchedule } from "@/lib/deals/schedule";
import type { Deal } from "@/lib/types";

const LOCALE = "en-GB" as const;

export interface PackAttestation {
  typedFullName: string;
  attestedAt: string;
  snapshotSha256: string;
}

export interface PackEvent {
  seq: number;
  createdAt: string;
  eventType: string;
  actorName: string;
  hash: string;
}

export interface ContractPackData {
  deal: Deal;
  orgName: string;
  financierName: string;
  customerName: string;
  /** Timestamps of the shariah-critical sequence, from the event log. */
  milestones: {
    promiseRecordedAt?: string;
    purchaseRecordedAt?: string;
    saleOfferedAt?: string;
    saleAcceptedAt?: string;
    offeredAt?: string;
    acceptedAt?: string;
    witnessingStartedAt?: string;
  };
  attestations: PackAttestation[];
  events: PackEvent[];
  /** ISO timestamp the pack was generated (frozen in the snapshot). */
  generatedAt: string;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) =>
    esc(vars[key] ?? `[${key}]`),
  );
}

function renderSection(section: ContractSection, vars: Record<string, string>): string {
  const clauses = section.clauses
    .map(
      (c) => `
      <li>
        ${c.heading ? `<strong>${esc(c.heading)}.</strong> ` : ""}${fill(c.text, vars)}
      </li>`,
    )
    .join("");
  return `
    <section class="contract-section">
      <h4>${esc(section.title)}</h4>
      ${section.intro ? `<p class="intro">${fill(section.intro, vars)}</p>` : ""}
      <ol class="clauses">${clauses}</ol>
    </section>`;
}

function renderTemplate(
  template: ContractTemplate,
  vars: Record<string, string>,
  stampedAt?: string,
): string {
  return `
  <article class="contract">
    <div class="review-banner">${esc(template.reviewBanner)}</div>
    <h3>${esc(template.title)}</h3>
    ${stampedAt ? `<p class="stamp">Recorded in the deal ledger: ${esc(formatDateTime(stampedAt))} (Europe/London)</p>` : ""}
    <p class="parties">${fill(template.parties, vars)}</p>
    ${template.recitals.map((r) => `<p class="recital">${fill(r, vars)}</p>`).join("")}
    ${template.sections.map((s) => renderSection(s, vars)).join("")}
  </article>`;
}

export function renderContractPackHtml(data: ContractPackData): string {
  const { deal } = data;
  const copy = contracts[LOCALE];
  const summary = summaries[LOCALE][deal.type === "murabaha" ? "murabaha" : "qardHasan"];
  const ayah = witness[LOCALE].ayah;
  const banner = disclaimers[LOCALE].solicitorReviewBanner;

  const vars: Record<string, string> = {
    deal_reference: dealRef(deal.id),
    organisation_name: data.orgName,
    financier_full_name: data.financierName,
    customer_full_name: data.customerName,
    asset_description: deal.asset_description ?? "",
    supplier_name: deal.supplier_name ?? "",
    cost_price: deal.cost_price_pence != null ? formatPence(deal.cost_price_pence) : "",
    markup: deal.markup_pence != null ? formatPence(deal.markup_pence) : "",
    total_price: deal.total_price_pence != null ? formatPence(deal.total_price_pence) : "",
    principal: deal.principal_pence != null ? formatPence(deal.principal_pence) : "",
    instalment_count: deal.instalment_count != null ? String(deal.instalment_count) : "",
    instalment_amount:
      deal.instalment_amount_pence != null ? formatPence(deal.instalment_amount_pence) : "",
    first_due_date: deal.first_due_date ?? "",
    frequency: deal.frequency ?? "",
    promise_date: data.milestones.promiseRecordedAt
      ? formatDateTime(data.milestones.promiseRecordedAt)
      : "",
    purchase_date: data.milestones.purchaseRecordedAt
      ? formatDateTime(data.milestones.purchaseRecordedAt)
      : "",
    sale_acceptance_date: data.milestones.saleAcceptedAt
      ? formatDateTime(data.milestones.saleAcceptedAt)
      : "",
    arbitrator_nomination_process:
      deal.arbitrator_name
        ? `nomination of ${deal.arbitrator_name} (${deal.arbitrator_contact ?? "contact recorded in the deal ledger"})`
        : "a nomination made by the organisation's committee",
  };

  const schedule =
    deal.instalment_count != null &&
    deal.instalment_amount_pence != null &&
    deal.first_due_date != null &&
    deal.frequency != null
      ? buildSchedule(
          deal.instalment_count,
          deal.instalment_amount_pence,
          deal.first_due_date,
          deal.frequency,
        )
      : [];

  const receivable =
    deal.type === "murabaha" ? deal.total_price_pence : deal.principal_pence;

  const sequenceRows: Array<[string, string | undefined]> =
    deal.type === "murabaha"
      ? [
          ["1. Non-binding promise to purchase recorded", data.milestones.promiseRecordedAt],
          ["2. Financier purchase and ownership recorded", data.milestones.purchaseRecordedAt],
          ["3. Separate murabaha sale offered", data.milestones.saleOfferedAt],
          ["4. Sale accepted by the customer", data.milestones.saleAcceptedAt],
          ["5. Witnessing opened (this document snapshotted)", data.milestones.witnessingStartedAt],
        ]
      : [
          ["1. Qard hasan terms offered", data.milestones.offeredAt],
          ["2. Terms accepted by the borrower", data.milestones.acceptedAt],
          ["3. Witnessing opened (this document snapshotted)", data.milestones.witnessingStartedAt],
        ];

  const contractsHtml =
    deal.type === "murabaha"
      ? [
          renderTemplate(copy.murabaha.promiseToPurchase, vars, data.milestones.promiseRecordedAt),
          renderTemplate(copy.murabaha.purchaseDeclaration, vars, data.milestones.purchaseRecordedAt),
          renderTemplate(copy.murabaha.saleContract, vars, data.milestones.saleAcceptedAt),
        ].join("")
      : renderTemplate(copy.qardHasan, vars, data.milestones.acceptedAt);

  const attestationsHtml =
    data.attestations.length === 0
      ? `<p>No attestations have been recorded yet. This deal requires exactly two witness attestations before it becomes active.</p>`
      : `<table class="data">
          <thead><tr><th>Witness (typed full legal name)</th><th>Attested at (Europe/London)</th><th>Document fingerprint (SHA-256)</th></tr></thead>
          <tbody>${data.attestations
            .map(
              (a) =>
                `<tr><td>${esc(a.typedFullName)}</td><td>${esc(formatDateTime(a.attestedAt))}</td><td class="mono">${esc(a.snapshotSha256)}</td></tr>`,
            )
            .join("")}</tbody>
        </table>`;

  const scheduleHtml =
    schedule.length === 0
      ? "<p>No payment schedule recorded.</p>"
      : `<table class="data">
          <thead><tr><th>#</th><th>Due date</th><th>Amount</th></tr></thead>
          <tbody>${schedule
            .map(
              (row) =>
                `<tr><td>${row.instalment}</td><td>${esc(row.dueDate)}</td><td>${esc(formatPence(row.amountPence))}</td></tr>`,
            )
            .join("")}</tbody>
          <tfoot><tr><td></td><td>Total</td><td>${
            receivable != null ? esc(formatPence(receivable)) : ""
          }</td></tr></tfoot>
        </table>`;

  const eventsHtml = `<table class="data events">
      <thead><tr><th>Seq</th><th>Timestamp (Europe/London)</th><th>Event</th><th>Actor</th><th>Hash</th></tr></thead>
      <tbody>${data.events
        .map(
          (e) =>
            `<tr><td>${e.seq}</td><td>${esc(formatDateTime(e.createdAt))}</td><td>${esc(e.eventType)}</td><td>${esc(e.actorName)}</td><td class="mono">${esc(e.hash.slice(0, 16))}…</td></tr>`,
        )
        .join("")}</tbody>
    </table>`;

  const typeLabel = deal.type === "murabaha" ? "Murabaha (cost-plus sale)" : "Qard hasan (benevolent loan)";

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>Contract pack ${esc(dealRef(deal.id))} — 282</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #111; margin: 0; padding: 2rem;
    max-width: 50rem; margin-inline: auto; line-height: 1.5;
    font-size: 11pt;
  }
  h1 { font-size: 20pt; margin: 0 0 .25rem; }
  h2 { font-size: 14pt; border-bottom: 1px solid #999; padding-bottom: .25rem; margin-top: 2rem; }
  h3 { font-size: 12.5pt; margin-bottom: .25rem; }
  h4 { font-size: 11pt; margin-bottom: .25rem; }
  .cover { text-align: center; padding: 3rem 0 2rem; }
  .cover .ayah-arabic { font-size: 15pt; direction: rtl; margin: 1.5rem 0 .5rem; }
  .cover .ayah-translation { font-style: italic; }
  .cover .ayah-ref { font-size: 9pt; color: #444; }
  .meta { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
  .meta td { border: 1px solid #bbb; padding: .35rem .6rem; text-align: left; }
  .meta td:first-child { width: 34%; font-weight: bold; background: #f5f5f5; }
  table.data { width: 100%; border-collapse: collapse; margin: .75rem 0; }
  table.data th, table.data td { border: 1px solid #bbb; padding: .3rem .55rem; text-align: left; vertical-align: top; }
  table.data th { background: #f0f0f0; }
  table.data tfoot td { font-weight: bold; }
  .mono { font-family: "Courier New", monospace; font-size: 8.5pt; word-break: break-all; }
  .review-banner {
    border: 2px solid #8a6d00; background: #fff8e1; padding: .6rem .8rem;
    font-weight: bold; margin: 1rem 0; font-size: 10pt;
  }
  .contract { margin-top: 1.5rem; }
  .contract .stamp { font-size: 9.5pt; color: #333; font-style: italic; }
  .contract .parties { font-weight: 500; }
  .contract .recital { font-style: italic; }
  ol.clauses { padding-left: 1.4rem; }
  ol.clauses li { margin-bottom: .4rem; }
  .footer {
    margin-top: 3rem; border-top: 1px solid #999; padding-top: .75rem;
    font-size: 9.5pt; color: #333;
  }
  .obligations li { margin-bottom: .35rem; }
  @page {
    size: A4;
    margin: 18mm 16mm;
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #444; }
  }
  @media print {
    body { padding: 0; max-width: none; font-size: 10.5pt; }
    h2 { break-after: avoid; }
    .contract, section.contract-section { break-inside: avoid-page; }
    table.data tr { break-inside: avoid; }
    .cover { padding-top: 5rem; }
    .page-break { break-before: page; }
  }
</style>
</head>
<body>
  <header class="cover">
    <h1>282 — Contract pack</h1>
    <p>${esc(typeLabel)}</p>
    <p class="ayah-arabic">${esc(ayah.arabic)}</p>
    <p class="ayah-translation">“${esc(ayah.translation)}”</p>
    <p class="ayah-ref">${esc(ayah.reference)} — ${esc(ayah.translationAttribution)}</p>
    <table class="meta">
      <tbody>
        <tr><td>Deal reference</td><td>${esc(dealRef(deal.id))}</td></tr>
        <tr><td>Organisation</td><td>${esc(data.orgName)}</td></tr>
        <tr><td>Financier${deal.type === "qard_hasan" ? " (lender)" : ""}</td><td>${esc(data.financierName)}</td></tr>
        <tr><td>Customer${deal.type === "qard_hasan" ? " (borrower)" : ""}</td><td>${esc(data.customerName)}</td></tr>
        <tr><td>Regulatory routing</td><td>${esc(deal.regulatory_status)}</td></tr>
        <tr><td>Pack generated</td><td>${esc(formatDateTime(data.generatedAt))} (Europe/London)</td></tr>
      </tbody>
    </table>
  </header>

  <h2>Plain-English summary</h2>
  <p>${esc(summary.overview)}</p>
  <ul class="obligations">
    ${summary.obligations.map((o) => `<li><strong>${esc(o.party)}:</strong> ${esc(o.obligation)}</li>`).join("")}
  </ul>
  <p><strong>Witnesses:</strong> ${esc(summary.witnesses)}</p>
  <p><strong>If there is a dispute:</strong> ${esc(summary.dispute)}</p>

  <h2>The recorded sequence</h2>
  <p>${
    deal.type === "murabaha"
      ? "A valid murabaha is two separate contracts in a strict order: a non-binding promise, then the financier's purchase and ownership of the asset, then — and only then — a separate sale contract. The ledger timestamps below are the evidence of that order."
      : "The ledger timestamps below evidence the order in which this benevolent loan was offered, accepted, and witnessed."
  }</p>
  <table class="data">
    <thead><tr><th>Step</th><th>Recorded at (Europe/London)</th></tr></thead>
    <tbody>${sequenceRows
      .map(
        ([label, at]) =>
          `<tr><td>${esc(label)}</td><td>${at ? esc(formatDateTime(at)) : "—"}</td></tr>`,
      )
      .join("")}</tbody>
  </table>

  <div class="page-break"></div>
  <h2>${deal.type === "murabaha" ? "The contracts" : "The agreement"}</h2>
  <div class="review-banner">${esc(banner.title)} — ${esc(banner.body)}</div>
  ${contractsHtml}

  <h2>Payment schedule</h2>
  ${scheduleHtml}

  <h2>Witness attestations</h2>
  ${attestationsHtml}

  <h2>Appendix — event log</h2>
  <p>Every entry below is part of an append-only, hash-chained ledger. Each hash commits to the entire history before it; the chain can be independently verified with the <span class="mono">verify-chain</span> tool.</p>
  ${eventsHtml}

  <footer class="footer">
    <p>${esc(CONTRACT_PACK_FOOTER)}</p>
  </footer>
</body>
</html>
`;
}
