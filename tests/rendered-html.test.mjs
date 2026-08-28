import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const port = 3217;
let server;
let serverOutput = "";

before(async () => {
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`Next.js production server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // Keep polling until the production server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Next.js production server did not start.\n${serverOutput}`);
});

after(() => {
  server?.kill("SIGTERM");
});

async function render(pathname) {
  return fetch(`http://127.0.0.1:${port}${pathname}`, {
    headers: { accept: "text/html" },
  });
}

async function html(pathname) {
  const response = await render(pathname);
  assert.equal(response.status, 200, `${pathname} should render successfully`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

test("renders the Nanas Bahamas healthcare landing and authentication experiences", async () => {
  const [home, auth] = await Promise.all([html("/"), html("/auth")]);

  assert.match(
    home,
    /<title>Nanas \| Trusted healthcare at home in The Bahamas<\/title>/i,
  );
  assert.match(home, /Trusted care/i);
  assert.match(home, /close to home/i);
  assert.match(home, /Popular care searches/i);
  assert.match(home, /The Bahamas/i);
  assert.match(home, /not an emergency service/i);
  assert.doesNotMatch(home, /contractor|shift jobs?|task rabbit/i);

  assert.match(auth, /Welcome back\./i);
  assert.match(auth, /Local full-flow testing/i);
  assert.match(auth, /Create account/i);
  assert.match(auth, /Phone/i);
  assert.match(auth, /one-time sign-in/i);
  assert.match(auth, /Forgot password/i);
  assert.match(
    auth,
    /Supabase is connected|Supabase keys are not configured yet/i,
  );
});

test("renders dedicated buyer, seller, and admin workspaces", async () => {
  const [
    buyer,
    buyerFind,
    buyerFavorites,
    seller,
    sellerProfile,
    sellerServices,
    admin,
  ] = await Promise.all([
    html("/app/buyer/overview"),
    html("/app/buyer/find-care"),
    html("/app/buyer/favorites"),
    html("/app/seller/overview"),
    html("/app/seller/profile"),
    html("/app/seller/services"),
    html("/app/admin/overview"),
  ]);

  assert.match(buyer, /What care would make today easier/i);
  assert.match(buyer, /Find the right care/i);
  assert.match(buyer, /What kind of help do you need/i);
  assert.match(buyer, /Buyer navigation/i);
  assert.doesNotMatch(buyer, /buyer workspace/i);

  assert.match(buyerFind, /Filter sellers by area/i);
  assert.match(buyerFind, /Smart search · Beta/i);
  assert.match(buyerFind, /Advanced healthcare seller filters/i);
  assert.match(buyerFind, /Pay rate/i);
  assert.match(buyerFind, /Employment type/i);
  assert.match(buyerFind, /Years of experience/i);
  assert.match(buyerFind, /Professional skills/i);
  assert.match(buyerFind, /Languages spoken/i);
  assert.match(buyerFind, /Reset[\s\S]{0,40}filters/i);

  assert.match(buyerFavorites, /Favorite sellers/i);
  assert.match(buyerFavorites, /Saved approved seller/i);
  assert.match(buyerFavorites, /View full profile/i);
  assert.match(buyerFavorites, /Request care/i);

  assert.match(seller, /Seller workspace/i);
  assert.match(seller, /Browse matching requests/i);
  assert.match(seller, /Approved to provide care/i);

  assert.match(sellerProfile, /Build the profile buyers compare/i);
  assert.match(sellerProfile, /Public profile readiness/i);
  assert.match(sellerProfile, /Public display name/i);
  assert.match(sellerProfile, /Professional headline/i);
  assert.match(sellerProfile, /Vaccinations/i);
  assert.match(sellerProfile, /Additional details/i);
  assert.match(sellerProfile, /1–3 service-specific profiles/i);
  assert.match(sellerProfile, /Edit service profiles/i);
  assert.match(sellerProfile, /Buyer preview/i);
  assert.match(sellerProfile, /System managed/i);

  assert.match(sellerServices, /1–3 service profiles/i);
  assert.match(sellerServices, /of 3 service profiles/i);
  assert.match(sellerServices, /Every category has its own About section/i);

  assert.match(admin, /Healthcare marketplace control centre\./i);
  assert.match(admin, /KYC queue/i);
  assert.match(admin, /Open disputes/i);
  assert.match(admin, />Users</i);
  assert.match(admin, /Message audit/i);
  assert.match(admin, />admin</i);
  assert.doesNotMatch(admin, /<div class="role-switch"[^>]*>[\s\S]*?>buyer</i);
  assert.doesNotMatch(admin, /<div class="role-switch"[^>]*>[\s\S]*?>seller</i);
});

test("renders Care.com-inspired seller profiles and detailed care-request pages", async () => {
  const [profile, publicProfile, buyerRequest, sellerRequest] =
    await Promise.all([
      html("/app/buyer/providers/seller-alicia"),
      html("/providers/alicia-m"),
      html("/app/buyer/care-requests/req-1001"),
      html("/app/seller/requests/req-1002"),
    ]);

  assert.match(profile, /Alicia M\./i);
  assert.match(profile, /Healthcare seller profile/i);
  assert.match(profile, /About[\s\S]{0,40}Alicia/i);
  assert.match(profile, /I provide calm and dependable senior care/i);
  assert.match(profile, /Credentials/i);
  assert.match(profile, /Care qualification for[\s\S]{0,80}Senior care/i);
  assert.match(profile, /Senior care/i);
  assert.match(profile, /Home nursing/i);
  assert.match(profile, /Post-hospital care/i);
  assert.match(profile, /Services/i);
  assert.match(profile, /Rates/i);
  assert.match(profile, /Other ways[\s\S]{0,60}Alicia[\s\S]{0,60}can help/i);
  assert.match(profile, /Availability/i);
  assert.match(profile, /Available dates/i);
  assert.match(profile, /Previous month/i);
  assert.match(profile, /Next month/i);
  assert.match(profile, /Profile details/i);
  assert.match(profile, /Languages/i);
  assert.match(profile, /Vaccinations/i);
  assert.match(profile, /Additional details/i);
  assert.match(profile, /Safety/i);
  assert.match(profile, /Communication and booking protection/i);
  assert.match(profile, /Reviews/i);
  assert.match(profile, /Contact[\s\S]{0,40}Alicia/i);

  assert.match(publicProfile, /Home nursing/i);
  assert.match(publicProfile, /Senior care/i);
  assert.match(publicProfile, /Post-hospital care/i);
  assert.match(publicProfile, /Alicia M\./i);
  assert.match(publicProfile, /Healthcare seller profile/i);
  assert.match(publicProfile, /6[\s\S]{0,40}years work experience/i);
  assert.match(publicProfile, /Availability/i);
  assert.match(publicProfile, /Communication and booking protection/i);

  assert.match(buyerRequest, /Senior care/i);
  assert.match(buyerRequest, /support in/i);
  assert.match(buyerRequest, /Care request details/i);
  assert.match(buyerRequest, /Offers/i);
  assert.match(buyerRequest, /Buyer activity/i);
  assert.match(buyerRequest, /Maximum care budget/i);

  assert.match(sellerRequest, /Post-hospital care/i);
  assert.match(sellerRequest, /support in/i);
  assert.match(sellerRequest, /Make an offer/i);
  assert.match(sellerRequest, /Buyer budget/i);
  assert.match(sellerRequest, /Request statistics/i);
});

test("renders the complete public healthcare marketplace as dedicated pages", async () => {
  const [
    services,
    service,
    directory,
    requests,
    request,
    post,
    how,
    safety,
    seller,
  ] = await Promise.all([
    html("/services"),
    html("/services/home-nursing"),
    html("/find-care"),
    html("/care-requests"),
    html("/care-requests/senior-care-nassau-morning"),
    html("/post-care-request"),
    html("/how-it-works"),
    html("/safety"),
    html("/become-a-seller"),
  ]);

  assert.match(services, /Choose the support that fits real life/i);
  assert.match(services, /Post-hospital care/i);
  assert.match(service, /Home nursing, arranged around real life/i);
  assert.match(service, /Choose the support you need/i);
  assert.match(directory, /Every card opens a complete profile page/i);
  assert.match(directory, /href="\/providers\/alicia-m"/i);
  assert.match(requests, /Open care requests/i);
  assert.match(requests, /Request preview/i);
  assert.match(request, /About this care request/i);
  assert.match(request, /Sign in to send a quote/i);
  assert.match(post, /Tell us about the care/i);
  assert.match(post, /Save draft and continue securely/i);
  assert.match(how, /Built for three roles only/i);
  assert.match(safety, /Trust is a process, not a badge/i);
  assert.match(seller, /This is not a generic gig board/i);

  for (const page of [
    services,
    service,
    directory,
    requests,
    request,
    post,
    how,
    safety,
    seller,
  ]) {
    assert.match(page, /href="\/services"/i);
    assert.match(page, /href="\/find-care"/i);
    assert.match(page, /href="\/care-requests"/i);
    assert.match(page, /href="\/how-it-works"/i);
    assert.match(page, /href="\/become-a-seller"/i);
  }
});

test("seller discovery uses full profile routes rather than seller profile dialogs", async () => {
  const [home, portal] = await Promise.all([
    readFile(new URL("../app/NanasHome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(home, /href=\{`\/providers\//);
  assert.doesNotMatch(home, /setSelectedSeller|seller-modal/);
  assert.match(portal, /profileHref=\{["`]\/app\/buyer\/providers\//);
  assert.doesNotMatch(
    portal,
    /setModal\("seller-profile"\)|modal === "seller-profile"/,
  );
});

test("connected portals rebuild participant state through table-level RLS", async () => {
  const portal = await readFile(
    new URL("../app/app/NanasPortal.tsx", import.meta.url),
    "utf8",
  );
  for (const table of [
    "booking_requests",
    "booking_quotes",
    "bookings",
    "conversations",
    "messages",
    "favorites",
    "notifications",
    "support_cases",
    "safety_incidents",
    "privacy_requests",
    "reviews",
    "verification_cases",
  ])
    assert.match(
      portal,
      new RegExp(`from\\("${table}"\\)`),
      `${table} must hydrate through its own RLS policy`,
    );

  assert.match(
    portal,
    /users: adminUsers \?\? \[\.\.\.connectedUsers\.values\(\)\]/,
  );
  assert.match(portal, /quotesByRequest/);
  assert.match(portal, /conversationByBooking/);
  assert.doesNotMatch(portal, /get_portal_state/);
});

test("buyer care requests collect recipients, location, schedule, pricing, and publication plan", async () => {
  const [portal, css] = await Promise.all([
    readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/app/buyer-experience.css", import.meta.url),
      "utf8",
    ),
  ]);

  for (const copy of [
    "Birth month",
    "Birth year",
    "Add another child",
    "Postal / ZIP code",
    "Which days and times?",
    "Add specific times instead",
    "Minimum hourly rate",
    "Post free or reach sellers faster?",
    "Free posting already used",
  ])
    assert.match(portal, new RegExp(copy.replace(/[?]/g, "\\?"), "i"));

  assert.match(portal, /Step \{requestStep \+ 1\} of \{steps\.length\}/);
  assert.match(portal, /simulated_payment_confirmed: chosenPlan\.fee > 0/);
  assert.match(portal, /adminCommand\("upsert_job_posting_plan"/);
  assert.match(css, /Buyer wizard readability floor/);
  assert.match(css, /font-size:\s*14px/);
});

test("buyer request intake covers all six Care.com service families and their distinct questions", async () => {
  const portal = await readFile(
    new URL("../app/app/NanasPortal.tsx", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260824163431_care_category_intake_templates.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const catalogueAlignment = await readFile(
    new URL(
      "../supabase/migrations/20260824174416_align_care_subcategory_catalog.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const category of [
    "Child care",
    "Senior care",
    "Adult care",
    "Pet care",
    "Housekeeping",
    "Tutoring",
  ])
    assert.match(portal, new RegExp(category, "i"));
  for (const subtype of [
    "Babysitter",
    "Nanny",
    "Daycare centers",
    "Special needs",
    "Companion",
    "Hands-on",
    "Live-in",
    "Sitter",
    "Walker",
    "Trainer",
    "Groomer",
    "House cleaning",
    "Personal assistant",
    "Math",
    "Science",
    "Test prep",
    "More subjects",
  ])
    assert.match(`${portal}\n${migration}`, new RegExp(subtype, "i"));
  for (const question of [
    "Tell us about your pets",
    "Birth month",
    "Age range",
    "Square footage",
    "Needs distance learning help",
    "Housekeeper provides supplies",
    "Alzheimer’s / Dementia experience",
    "Medicine administration",
  ])
    assert.match(portal, new RegExp(question, "i"));

  assert.match(portal, /category_code: requestDraft\.categoryCode/);
  assert.match(portal, /intake_answers:/);
  assert.match(
    migration,
    /create table public\.booking_request_intake_answers/i,
  );
  assert.match(migration, /private_answers jsonb/i);
  assert.match(migration, /public_summary jsonb/i);
  assert.match(migration, /invalid_care_category_service/i);
  assert.match(portal, /buyer-service-subcategories/);
  assert.match(catalogueAlignment, /code in \('boarding', 'doggy_daycare'\)/i);
  assert.match(catalogueAlignment, /set active = false/i);
});

test("database contract enforces the three-role healthcare marketplace and core lifecycle", async () => {
  const migrationDir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(migrationDir)).sort();
  const sql = (
    await Promise.all(
      names.map((name) => readFile(new URL(name, migrationDir), "utf8")),
    )
  ).join("\n");
  const prd = await readFile(
    new URL("../../README.md", import.meta.url),
    "utf8",
  );

  assert.match(
    sql,
    /create type public\.app_role as enum \('buyer', 'seller', 'admin'\)/i,
  );
  assert.doesNotMatch(
    sql,
    /create type public\.app_role[^;]*(contractor|business)/i,
  );

  for (const table of [
    "profiles",
    "seller_profiles",
    "seller_documents",
    "verification_cases",
    "booking_requests",
    "booking_quotes",
    "bookings",
    "conversations",
    "messages",
    "payment_intents",
    "ledger_transactions",
    "ledger_entries",
    "reviews",
    "badges",
    "user_badges",
    "seller_public_safety_checks",
    "service_disputes",
    "moderation_reports",
    "notifications",
    "notification_outbox",
    "admin_audit_logs",
    "support_cases",
    "cancellations",
    "refunds",
    "job_posting_plans",
    "booking_request_recipients",
    "booking_request_schedules",
    "booking_request_publications",
    "care_intake_categories",
    "care_intake_subcategories",
    "booking_request_intake_answers",
  ])
    assert.match(
      sql,
      new RegExp(`create table public\\.${table}\\b`, "i"),
      `${table} must exist`,
    );

  const modelSection = prd.slice(
    prd.indexOf("### 13.4"),
    prd.indexOf("## 14."),
  );
  const prdTables = [...modelSection.matchAll(/^\| `([a-z][a-z0-9_]*)`/gm)].map(
    (match) => match[1],
  );
  assert.ok(
    prdTables.length >= 100,
    "the complete PRD table inventory must be parsed",
  );
  for (const table of prdTables)
    assert.match(
      sql,
      new RegExp(`create table public\\.${table}\\b`, "i"),
      `${table} from the PRD data model must exist`,
    );

  for (const command of [
    "create_care_request",
    "submit_seller_quote",
    "accept_quote_with_simulated_payment",
    "transition_booking",
    "submit_verified_review",
    "admin_user_action",
    "admin_review_verification",
    "admin_conversation_messages",
    "open_service_dispute",
    "create_support_case",
    "generate_session_code",
    "verify_session_code",
    "preview_booking_cancellation",
    "cancel_booking",
    "admin_resolve_service_dispute",
    "authorize_booking_transition",
    "accept_booking_offer",
    "post_ledger_transaction",
    "check_review_eligibility",
    "evaluate_user_badges",
    "enqueue_domain_event",
    "report_content",
    "admin_resolve_moderation_report",
    "admin_manage_operations_case",
    "admin_update_feature_flag",
    "admin_upsert_service",
    "admin_upsert_service_area",
    "upsert_household_member",
    "seller_upsert_service",
    "seller_replace_weekly_availability",
    "seller_update_public_profile",
    "seller_upsert_service_area",
    "admin_upsert_job_posting_plan",
  ])
    assert.match(
      sql,
      new RegExp(`function (?:(?:public|app_private)\\.)?${command}\\b`, "i"),
      `${command} must be transactional`,
    );

  assert.match(sql, /enable row level security/i);
  assert.match(sql, /wallet_balances/i);
  assert.match(sql, /admin_overview/i);
  assert.match(sql, /booking_cancelled/i);
  assert.match(sql, /ledger_transaction_id/i);
  assert.match(
    sql,
    /seller_request_history_access|Sellers retain access to the safe request summary/i,
  );
  assert.match(sql, /add column service_bio text/i);
  assert.match(sql, /add column years_experience integer/i);
  assert.match(sql, /add column rate_max_minor bigint/i);
  assert.match(sql, /add column capabilities text\[\]/i);
  assert.match(sql, /alter table public\.seller_profiles drop column bio/i);
  assert.match(
    sql,
    /alter table public\.seller_profiles drop column years_experience/i,
  );
  assert.match(sql, /q\.seller_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /b\.seller_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /free_posting_allowance_used/i);
  assert.match(sql, /booking_publications_enforce_free_allowance/i);
});

test("private storage, notifications, maintenance, and verified webhooks are scaffolded locally", async () => {
  const config = await readFile(
    new URL("../supabase/config.toml", import.meta.url),
    "utf8",
  );
  const security = await readFile(
    new URL(
      "../supabase/migrations/20260824051835_nanas_security_rpc_storage.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const functionNames = await readdir(
    new URL("../supabase/functions/", import.meta.url),
    { withFileTypes: true },
  );
  const directories = functionNames
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name);

  for (const bucket of [
    "seller-documents",
    "booking-attachments",
    "case-evidence",
    "receipts-statements",
    "exports",
  ])
    assert.match(
      security,
      new RegExp(bucket),
      `${bucket} storage bucket must be declared`,
    );

  for (const fn of [
    "marketplace-command",
    "admin-command",
    "issue-upload-url",
    "notification-worker",
    "maintenance-worker",
    "payment-webhook",
    "identity-webhook",
    "delivery-webhook",
  ]) {
    assert.ok(directories.includes(fn), `${fn} must exist`);
    assert.match(config, new RegExp(`\\[functions\\.${fn}\\]`));
  }

  assert.match(config, /site_url = "http:\/\/localhost:3000"/);
  assert.match(config, /project_id = "nanas"/);
});
