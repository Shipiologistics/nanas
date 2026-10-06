import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { financeActivitySchema, financeAmount, financeSummarySchema } from "../lib/admin-finance.mjs";
const row = {currency:"BSD",payment_count:9,captured_minor:69942,refunded_minor:32916,simulated_captured_minor:69942,external_captured_minor:0,provider_wallet_minor:30500,buyer_wallet_minor:32916,protected_minor:0,platform_minor:6526,held_provider_wallet_minor:0,ledger_imbalance_minor:0};
const report = {as_of:"2026-10-06T00:00:00Z",currencies:[row]};
test("financial response validation rejects missing, unsafe or inconsistent totals",()=>{
  assert.equal(financeSummarySchema.parse(report).currencies[0].provider_wallet_minor,30500);
  for(const value of [null,{}, {...report,as_of:'bad'}, {...report,currencies:[{}]}, {...report,currencies:[{...row,captured_minor:Number.MAX_SAFE_INTEGER+1}]}, {...report,currencies:[{...row,refunded_minor:99999}]}, {...report,currencies:[row,row]}, {...report,currencies:[{...row,external_captured_minor:10}]}]) assert.equal(financeSummarySchema.safeParse(value).success,false);
  assert.equal(financeSummarySchema.safeParse({...report,currencies:[{...row,provider_wallet_minor:-50,ledger_imbalance_minor:-50}]}).success,true);
});
test("financial formatting identifies currency and respects minor-unit precision",()=>{
  assert.match(financeAmount(6526,'BSD'),/BSD.*65\.26/);
  assert.match(financeAmount(125,'USD'),/USD.*1\.25/);
  assert.match(financeAmount(125,'JPY'),/JPY.*125/);
  assert.throws(()=>financeAmount(Number.MAX_SAFE_INTEGER+1,'BSD'),/Unsafe/);
});
test("financial activity rejects malformed timestamps, unsafe amounts and ledger sums before rendering",()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const base={id,currency:'BSD',created_at:report.as_of};
  const entry={id,direction:'credit',amount_minor:100,ledger_accounts:{account_type:'platform_revenue',currency:'BSD'}};
  const transaction={...base,event_type:'payment_captured',description:null,ledger_entries:[entry]};
  const payment={...base,booking_id:null,processor:'simulation',status:'captured',captured_minor:100,refunded_minor:0};
  const activity={payments:[payment],transactions:[transaction],payouts:[],paymentCount:1,transactionCount:1,payoutCount:0};
  assert.equal(financeActivitySchema.safeParse(activity).success,true);
  for(const bad of [
    {...activity,payments:[{...payment,created_at:'invalid'}]},
    {...activity,payments:[{...payment,refunded_minor:101}]},
    {...activity,payments:[{...payment,captured_minor:Number.MAX_SAFE_INTEGER+1}]},
    {...activity,transactionCount:null},
    {...activity,transactions:[{...transaction,ledger_entries:[{...entry,direction:'unknown'}]}]},
    {...activity,transactions:[{...transaction,ledger_entries:[{...entry,amount_minor:Number.MAX_SAFE_INTEGER},entry]}]},
  ]) assert.equal(financeActivitySchema.safeParse(bad).success,false);
});
test("connected finance uses checked RPC totals and paginated real receipts/ledger",async()=>{
  const source=await readFile(new URL('../app/app/AdminFinance.tsx',import.meta.url),'utf8');
  assert.match(source,/rpc\("admin_finance_summary"\)/);
  assert.match(source,/financeSummarySchema.parse\(summary.data\)/);
  assert.match(source,/setRecords\(null\)/);
  assert.match(source,/from\("ledger_transactions"\)/);
  assert.match(source,/pagination\("transactions", records.transactionCount\)/);
  assert.doesNotMatch(source,/state.bookings|sellerNet/);
});
