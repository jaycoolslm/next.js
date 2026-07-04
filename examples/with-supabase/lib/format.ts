// Display formatting. Money is stored as integer pence (GBP only); timestamps
// are stored as UTC timestamptz and displayed in Europe/London.

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export function formatPence(pence: number): string {
  return gbp.format(pence / 100);
}

const londonDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/London",
});

const londonDateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export function formatDate(value: string | Date): string {
  return londonDate.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: string | Date): string {
  return londonDateTime.format(
    typeof value === "string" ? new Date(value) : value,
  );
}

/** Deal reference shown on documents, e.g. "282-4F2A9C1B". */
export function dealRef(dealId: string): string {
  return `282-${dealId.slice(0, 8).toUpperCase()}`;
}
