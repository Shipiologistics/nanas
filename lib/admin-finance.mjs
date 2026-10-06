import { z } from "zod";
const minor = z.number().refine(Number.isSafeInteger, "Unsafe financial amount");
const nonnegativeMinor = minor.refine((value) => value >= 0);
const currency = z.string().regex(/^[A-Z]{3}$/);
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid record time");
const record = { id: z.string().uuid(), currency, created_at: timestamp };
export const financeActivitySchema = z.object({
  payments: z.array(z.object({ ...record, booking_id: z.string().uuid().nullable(), processor: z.string(), status: z.string(), captured_minor: nonnegativeMinor, refunded_minor: nonnegativeMinor }).refine((value) => value.refunded_minor <= value.captured_minor)),
  transactions: z.array(z.object({ ...record, event_type: z.string(), description: z.string().nullable(), ledger_entries: z.array(z.object({ id: z.string().uuid(), direction: z.enum(["credit", "debit"]), amount_minor: nonnegativeMinor, ledger_accounts: z.object({ account_type: z.string(), currency }).nullable() })) }).refine((value) => ["credit", "debit"].every((direction) => Number.isSafeInteger(value.ledger_entries.filter((entry) => entry.direction === direction).reduce((sum, entry) => sum + entry.amount_minor, 0))), "Unsafe ledger total")),
  payouts: z.array(z.object({ ...record, processor: z.string(), status: z.string(), amount_minor: nonnegativeMinor })),
  paymentCount: nonnegativeMinor,
  transactionCount: nonnegativeMinor,
  payoutCount: nonnegativeMinor,
});
export const financeSummarySchema = z.object({
  as_of: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid snapshot time"),
  currencies: z.array(z.object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    payment_count: minor.refine((value) => value >= 0),
    captured_minor: minor.refine((value) => value >= 0),
    refunded_minor: minor.refine((value) => value >= 0),
    simulated_captured_minor: minor.refine((value) => value >= 0),
    external_captured_minor: minor.refine((value) => value >= 0),
    provider_wallet_minor: minor,
    buyer_wallet_minor: minor,
    protected_minor: minor,
    platform_minor: minor,
    held_provider_wallet_minor: minor,
    ledger_imbalance_minor: minor,
  }).refine((row) => row.refunded_minor <= row.captured_minor && row.simulated_captured_minor + row.external_captured_minor === row.captured_minor, "Inconsistent capture totals")),
}).refine((summary) => new Set(summary.currencies.map((row) => row.currency)).size === summary.currencies.length, "Duplicate currency totals");

/** @param {number} minorUnits @param {string} currency */
export function financeAmount(minorUnits, currency) {
  if (!Number.isSafeInteger(minorUnits)) throw new Error("Unsafe financial amount");
  const formatter = new Intl.NumberFormat("en-BS", { style: "currency", currency, currencyDisplay: "code" });
  return formatter.format(minorUnits / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
}
