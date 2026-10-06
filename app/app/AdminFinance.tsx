"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { getSupabase } from "../../lib/supabase";
import { financeActivitySchema, financeAmount, financeSummarySchema } from "../../lib/admin-finance.mjs";
import "./admin-finance.css";

type Summary = z.infer<typeof financeSummarySchema>;
type Records = { summary: Summary } & z.infer<typeof financeActivitySchema>;
type Report = "payments" | "transactions" | "payouts";
const pageSize = 10;
const recordedTime = (value: string) => new Intl.DateTimeFormat("en-BS", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Nassau" }).format(new Date(value));

export function AdminFinance() {
  const [records, setRecords] = useState<Records | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [pages, setPages] = useState({ payments: 0, transactions: 0, payouts: 0 });
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();
    if (!supabase) return;
    void (async () => {
      try {
        const [summary, payments, transactions, payouts] = await Promise.all([
          supabase.rpc("admin_finance_summary"),
          supabase.from("payment_intents").select("id,booking_id,processor,currency,status,captured_minor,refunded_minor,created_at", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(pages.payments * pageSize, (pages.payments + 1) * pageSize - 1),
          supabase.from("ledger_transactions").select("id,event_type,currency,description,created_at,ledger_entries(id,direction,amount_minor,ledger_accounts(account_type,currency))", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(pages.transactions * pageSize, (pages.transactions + 1) * pageSize - 1),
          supabase.from("payouts").select("id,processor,currency,status,amount_minor,created_at", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(pages.payouts * pageSize, (pages.payouts + 1) * pageSize - 1),
        ]);
        const failure = [summary, payments, transactions, payouts].find((result) => result.error)?.error;
        if (failure) throw failure;
        if (!payments.data || !transactions.data || !payouts.data || payments.count === null || transactions.count === null || payouts.count === null) throw new Error("Incomplete financial response");
        const parsed = financeSummarySchema.parse(summary.data);
        const activity = financeActivitySchema.parse({ payments: payments.data, paymentCount: payments.count, transactions: transactions.data, transactionCount: transactions.count, payouts: payouts.data, payoutCount: payouts.count });
        if (!cancelled) {
          setRecords({ summary: parsed, ...activity });
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          const message = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "";
          setError(/permission|denied/i.test(message) ? "Finance-read permission is required to view these records." : "Financial records could not be verified. Refresh to retry; no totals are shown.");
          setRecords(null);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [pages, revision]);
  function refresh() { setLoading(true); setError(null); setPages({ payments: 0, transactions: 0, payouts: 0 }); setRevision((value) => value + 1); }
  function paginate(report: Report, delta: number) { setLoading(true); setPages((previous) => ({ ...previous, [report]: previous[report] + delta })); }
  function pagination(report: Report, count: number) {
    return <nav className="finance-pagination" aria-label={`${report} pages`}>
      <button disabled={pages[report] === 0 || loading} onClick={() => paginate(report, -1)}>Previous {report}</button>
      <span>Page {pages[report] + 1} of {Math.max(1, Math.ceil(count / pageSize))} · {count} records</span>
      <button disabled={(pages[report] + 1) * pageSize >= count || loading} onClick={() => paginate(report, 1)}>Next {report}</button>
    </nav>;
  }
  return <section className="admin-finance" aria-label="Recorded financial reports">
    <div className="finance-toolbar"><p>Totals include all recorded rows, separated by currency. Wallet balances are not bank payouts. Simulated captures are not real charges.</p><button disabled={loading} onClick={refresh}>Refresh finance</button></div>
    {loading ? <p role="status">Loading financial records…</p> : error ? <p role="alert">{error}</p> : records && <>
      <p>Totals as of {recordedTime(records.summary.as_of)} (Bahamas time). Activity lists are paginated and may include newer records.</p>
      {!records.summary.currencies.length && <p>No recorded financial activity.</p>}
      {records.summary.currencies.map((row) => <section key={row.currency} aria-label={`${row.currency} financial totals`}>
        <h2>{row.currency} recorded totals</h2>
        {row.ledger_imbalance_minor !== 0 && <p role="alert">Ledger imbalance: {financeAmount(row.ledger_imbalance_minor, row.currency)}. Reconciliation is required.</p>}
        <div className="finance-totals">
          {[
            ["Gross captured", row.captured_minor, `${row.payment_count} payment records · before refunds`],
            ["Recorded refunds", row.refunded_minor, "Cumulative refunds, not pending requests"],
            ["Captured less refunds", row.captured_minor - row.refunded_minor, "Not a bank or wallet balance"],
            ["Provider wallets", row.provider_wallet_minor, "Recorded balance including held accounts"],
            ["Buyer wallets", row.buyer_wallet_minor, "Recorded credits less debits"],
            ["Protected funds", row.protected_minor, "Current ledger balance"],
            ["Platform revenue", row.platform_minor, "Ledger credits less reversals"],
            ["Held provider wallets", row.held_provider_wallet_minor, "Included in provider wallet total"],
          ].map(([label, value, note]) => <article key={String(label)}><span>{label}</span><strong>{financeAmount(Number(value), row.currency)}</strong><small>{note}</small></article>)}
        </div>
        <p>Simulated captures: {financeAmount(row.simulated_captured_minor, row.currency)} · Other processor captures: {financeAmount(row.external_captured_minor, row.currency)}. Processor records alone do not confirm bank settlement.</p>
      </section>)}
      <section className="finance-report" aria-label="Payment receipts"><h2>Payment receipts</h2>
        {records.payments.map((payment) => <article key={payment.id}><div><h3>{payment.processor === "simulation" ? "Simulated payment" : "Processor payment"} · {payment.status.replaceAll("_", " ")}</h3><small>{recordedTime(payment.created_at)} · {payment.id}</small>{payment.booking_id && <small>Booking {payment.booking_id}</small>}</div><p>Captured {financeAmount(payment.captured_minor, payment.currency)}<br />Refunded {financeAmount(payment.refunded_minor, payment.currency)}</p></article>)}
        {!records.payments.length && <p>No payment receipts on this page.</p>}{pagination("payments", records.paymentCount)}
      </section>
      <section className="finance-report" aria-label="Ledger transactions"><h2>Ledger transactions</h2><p>Actual immutable transaction records and account movements—not booking-status estimates.</p>
        {records.transactions.map((transaction) => {
          const credits = transaction.ledger_entries.filter((entry) => entry.direction === "credit").reduce((sum, entry) => sum + entry.amount_minor, 0);
          const debits = transaction.ledger_entries.filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + entry.amount_minor, 0);
          const verified = transaction.ledger_entries.length > 0 && credits === debits && transaction.ledger_entries.every((entry) => entry.ledger_accounts?.currency === transaction.currency);
          return <article key={transaction.id} className="finance-transaction"><div><h3>{transaction.event_type.replaceAll("_", " ")}</h3><p>{transaction.description}</p><small>{recordedTime(transaction.created_at)} · {transaction.id}</small></div><p>{verified ? "Balanced" : "Needs reconciliation"}<br />Debits {financeAmount(debits, transaction.currency)} · Credits {financeAmount(credits, transaction.currency)}</p><ul>{transaction.ledger_entries.map((entry) => <li key={entry.id}>{entry.ledger_accounts?.account_type.replace("seller_wallet", "provider_wallet").replaceAll("_", " ") ?? "Account unavailable"} · {entry.direction} {financeAmount(entry.amount_minor, entry.ledger_accounts?.currency ?? transaction.currency)}</li>)}</ul></article>;
        })}
        {!records.transactions.length && <p>No ledger transactions on this page.</p>}{pagination("transactions", records.transactionCount)}
      </section>
      <section className="finance-report" aria-label="Payout records"><h2>Payout records</h2><p>A simulated payout record is not a bank transfer.</p>
        {records.payouts.map((payout) => <article key={payout.id}><div><h3>{payout.processor === "simulation" ? "Simulated payout" : "Processor payout"} · {payout.status.replaceAll("_", " ")}</h3><small>{recordedTime(payout.created_at)} · {payout.id}</small></div><strong>{financeAmount(payout.amount_minor, payout.currency)}</strong></article>)}
        {!records.payouts.length && <p>No payout records on this page.</p>}{pagination("payouts", records.payoutCount)}
      </section>
    </>}
  </section>;
}
