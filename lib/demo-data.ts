export type DemoRole = "buyer" | "seller" | "admin";
export type DemoSellerService = {
  id: string;
  slug?: string;
  name: string;
  rate: number;
  rateMax?: number;
  bio?: string;
  yearsExperience?: number;
  capabilities?: string[];
  additionalHelp?: string[];
};
export type DemoUser = {
  publicSlug?: string;
  id: string; name: string; email: string; role: DemoRole;
  status: "active" | "restricted" | "suspended" | "closed"; avatar: string; avatarUrl?: string;
  sellerDetails?: {
    published?: boolean;
    headline?: string; locality?: string; island?: string;
    rating: number; reviewCount: number; completedBookings: number;
    responseRate?: number; badges?: string[];
    languages: string[];
    vaccinations?: string[];
    additionalDetails?: string[];
    availability?: { weekday: number; start: string; end: string; timezone?: string }[];
    availabilityUpdatedAt?: string;
    credentials?: { type: string; issuingBody?: string; verifiedAt?: string; expiryDate?: string }[];
    safetyChecks?: { type: string; status: string; completedAt?: string; expiresAt?: string; summary?: string }[];
    services: DemoSellerService[];
  };
};
export type DemoQuote = { id: string; requestId: string; sellerId: string; sellerName: string; rate: number; travel: number; fee: number; total: number; message: string; status: "pending" | "accepted" | "declined" };
export type DemoRequest = {
  id: string; buyerId: string; buyerName: string; service: string; area: string;
  mode?: "scheduled" | "on_demand"; startsAt: string; endsAt: string;
  schedule?: { kind: "recurring" | "one_time"; startDate: string; endDate?: string | null; flexibleStart: boolean; weekdays: number[]; timePeriods: string[]; specificStart?: string | null; specificEnd?: string | null; scheduleMayVary: boolean; timezone: string };
  createdAt?: string; publishedUntil?: string | null; featured?: boolean; quoteCount?: number; hasQuoted?: boolean;
  summary: string; budget: number; status: "requested" | "offered" | "confirmed" | "expired"; quotes: DemoQuote[];
};
export type DemoBooking = { id: string; reference: string; requestId: string; buyerId: string; buyerName: string; sellerId: string; sellerName: string; service: string; startsAt: string; endsAt: string; completedAt?: string; status: "confirmed" | "in_progress" | "completion_pending" | "completed" | "cancelled" | "disputed" | "resolved"; total: number; sellerNet: number; cancellationFee?: number; refundAmount?: number; conversationId: string; reviewedBy: string[] };
export type DemoMessage = { id: string; conversationId: string; senderId: string; senderName: string; body: string; at: string };
export type DemoKyc = { id: string; sellerId: string; sellerName: string; type: string; status: "pending" | "needs_information" | "approved" | "rejected"; fileName: string; submittedAt: string; decisionReason?: string };
export type DemoDispute = { id: string; bookingId: string; openedBy: string; reason: string; summary: string; status: "open" | "escalated" | "resolved"; resolution?: string };
export type DemoSupportCase = { id: string; openedBy: string; category: string; subject: string; status: "open" | "awaiting_user" | "resolved"; createdAt: string };
export type DemoSafetyIncident = { id: string; bookingId?: string; reporterId: string; category: string; status: "open" | "acknowledged" | "resolved"; createdAt: string };
export type DemoPrivacyRequest = { id: string; userId: string; type: "export" | "delete"; status: "open" | "processing" | "completed"; createdAt: string };
export type DemoModerationReport = { id: string; reporterId: string; targetType: string; targetId: string; reason: string; details?: string; priority: string; status: "open" | "escalated" | "resolved"; createdAt: string };
export type DemoState = {
  users: DemoUser[];
  requests: DemoRequest[];
  bookings: DemoBooking[];
  messages: DemoMessage[];
  kyc: DemoKyc[];
  disputes: DemoDispute[];
  favorites: string[];
  supportCases: DemoSupportCase[];
  safetyIncidents: DemoSafetyIncident[];
  privacyRequests: DemoPrivacyRequest[];
  moderationReports: DemoModerationReport[];
  notifications: { id: string; userId: string; text: string; read: boolean; at: string; deepLink?: string }[];
  sessionCodes: Record<string, string>;
  payouts: { id: string; sellerId: string; amount: number; status: "scheduled" | "paid"; createdAt: string }[];
};

export const demoUsers: DemoUser[] = [
  { id: "buyer-carla", name: "Carla B.", email: "buyer@nanas.bs", role: "buyer", status: "active", avatar: "CB" },
  { id: "seller-alicia", name: "Alicia M.", email: "seller@nanas.bs", role: "seller", status: "active", avatar: "AM", sellerDetails: {
    headline: "Registered nurse providing thoughtful care at home", locality: "Nassau", island: "New Providence",
    rating: 4.9, reviewCount: 18, completedBookings: 46, responseRate: 96, badges: ["Top care provider", "Credentials current"],
    languages: ["English", "Bahamian Creole"], vaccinations: ["COVID-19 vaccinated", "Influenza vaccinated"], additionalDetails: ["Does not smoke", "Comfortable with pets", "Has reliable transportation"],
    availabilityUpdatedAt: "2026-08-20T14:00:00Z", availability: [1,2,3,4,5,6].map((weekday) => ({ weekday, start: "06:00", end: "23:00", timezone: "America/Nassau" })),
    credentials: [{ type: "Registered nurse licence", issuingBody: "The Bahamas Nursing Council", verifiedAt: "2026-07-18T12:00:00Z" }, { type: "CPR and first aid", verifiedAt: "2026-06-04T12:00:00Z" }],
    safetyChecks: [{ type: "background_check", status: "completed", completedAt: "2026-04-01T12:00:00Z", summary: "Required Nanas background screening completed." }, { type: "social_media_check", status: "pending" }, { type: "enhanced_background_check", status: "not_on_file" }, { type: "motor_vehicle_report", status: "not_on_file" }],
    services: [
      { id: "21000000-0000-0000-0000-000000000001", name: "Senior care", rate: 32, rateMax: 42, yearsExperience: 6, bio: "Hello, I provide calm and dependable senior care for adults who want to remain comfortable and involved in their daily routines at home. I have experience supporting companionship, safe movement, meals, medication reminders and appointment preparation. I take time to understand each household’s preferences, communicate clearly with family members and preserve the dignity and independence of the person receiving care. I am happy to follow an established routine, provide thoughtful updates after each visit and adjust my approach within the agreed care plan as needs change.", capabilities: ["Companionship", "Mobility support", "Meal preparation", "Medication reminders", "Appointment support", "Family updates"], additionalHelp: ["Groceries and errands", "Transportation to appointments", "Light organizing"] },
      { id: "21000000-0000-0000-0000-000000000002", name: "Home nursing", rate: 38, rateMax: 55, yearsExperience: 8, bio: "Hello, I bring experienced nursing support into the home with a calm, respectful and safety-focused approach. I can help with approved health observations, medication support, wound-care assistance, recovery monitoring and clear care-plan communication. I explain what I am doing in plain language, listen carefully to the client and family, and document important observations through the Nanas booking workflow. My goal is to make each visit feel organized and reassuring while always working within my verified professional scope and the care instructions agreed before the booking.", capabilities: ["Health observations", "Medication support", "Wound-care assistance", "Recovery monitoring", "Care-plan communication", "Family education"], additionalHelp: ["Meal preparation", "Mobility assistance", "Family handover"] },
      { id: "21000000-0000-0000-0000-000000000003", name: "Post-hospital care", rate: 40, rateMax: 58, yearsExperience: 5, bio: "Hello, I help adults and families make the first days at home after a hospital stay or outpatient procedure feel safer and less overwhelming. I can support the agreed discharge routine, recovery observations, safe mobility, meal preparation, appointment reminders and practical organization around the home. I watch for changes that should be shared with the family or clinical team, communicate clearly after each visit and encourage the person receiving care to move at a comfortable pace. Every booking is shaped around the written care plan and remains within my approved Nanas scope.", capabilities: ["Discharge-plan support", "Recovery observations", "Mobility assistance", "Meal preparation", "Appointment reminders", "Family communication"], additionalHelp: ["Prescription pickup", "Light cleaning", "Transportation coordination"] },
    ],
  } },
  { id: "seller-marcus", name: "Marcus D.", email: "marcus@nanas.bs", role: "seller", status: "active", avatar: "MD", sellerDetails: {
    headline: "Reliable companion and respite-care support", locality: "Freeport", island: "Grand Bahama", rating: 4.8, reviewCount: 11, completedBookings: 31, responseRate: 91,
    badges: ["Family favorite"], languages: ["English"], vaccinations: ["COVID-19 vaccinated"], additionalDetails: ["Does not smoke", "Has reliable transportation"],
    availability: [1,2,3,4,5].map((weekday) => ({ weekday, start: "08:00", end: "18:00" })), services: [
      { id: "21000000-0000-0000-0000-000000000004", name: "Respite care", rate: 25, rateMax: 35, yearsExperience: 4, bio: "I offer dependable respite support so family caregivers can rest, attend appointments or simply take time to recharge. I learn the household routine, keep communication clear and create a calm, respectful experience for everyone involved.", capabilities: ["Companionship", "Routine support", "Meal preparation", "Mobility assistance"], additionalHelp: ["Light cleaning", "Groceries and errands"] },
    ], safetyChecks: [{ type: "background_check", status: "completed", completedAt: "2026-05-12T12:00:00Z" }],
  } },
  { id: "seller-simone", name: "Simone R.", email: "simone@nanas.bs", role: "seller", status: "active", avatar: "SR", sellerDetails: {
    headline: "Physiotherapy and movement support at home", locality: "Marsh Harbour", island: "Abaco", rating: 4.7, reviewCount: 9, completedBookings: 24, responseRate: 94,
    badges: ["Credentials current"], languages: ["English"], vaccinations: [], additionalDetails: ["Does not smoke"], availability: [2,3,4,5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" })), services: [
      { id: "21000000-0000-0000-0000-000000000006", name: "Physiotherapy", rate: 50, rateMax: 70, yearsExperience: 7, bio: "I provide practical, encouraging physiotherapy support that helps people move with greater confidence at home. Sessions are shaped around the approved care goal, safe technique and clear exercises the client and family can understand.", capabilities: ["Mobility assessment", "Guided home exercise", "Balance support", "Recovery education"], additionalHelp: ["Home-safety observations", "Caregiver movement guidance"] },
    ], safetyChecks: [{ type: "background_check", status: "completed", completedAt: "2026-03-28T12:00:00Z" }],
  } },
  { id: "admin-ops", name: "Nanas Operations", email: "admin@nanas.bs", role: "admin", status: "active", avatar: "NO" },
];

// A fixed seed clock keeps server-rendered demo data byte-for-byte identical
// during browser hydration. Live actions still use the real current time.
const seedNow = Date.UTC(2026, 7, 24, 12, 0, 0);
const tomorrow = new Date(seedNow + 30 * 3600_000);
const nextWeek = new Date(seedNow + 5 * 86400_000);
// Construct seed timestamps independently of the machine timezone so server and
// browser hydration render the same Bahamas appointment date.
const isoAt = (date: Date, hour: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour + 4)).toISOString();

export const initialDemoState: DemoState = {
  users: demoUsers,
  requests: [
    { id: "req-1001", buyerId: "buyer-carla", buyerName: "Carla B.", service: "Senior care", area: "Nassau, New Providence", startsAt: isoAt(tomorrow, 10), endsAt: isoAt(tomorrow, 14), summary: "Companionship, meal support, and safe mobility help for my mother while I attend appointments.", budget: 180, status: "offered", quotes: [
      { id: "quote-1001", requestId: "req-1001", sellerId: "seller-alicia", sellerName: "Alicia M.", rate: 38, travel: 0, fee: 12, total: 164, message: "I am available and experienced with mobility and recovery support.", status: "pending" },
      { id: "quote-1002", requestId: "req-1001", sellerId: "seller-marcus", sellerName: "Marcus D.", rate: 25, travel: 10, fee: 9, total: 119, message: "Happy to help with the routine and keep your family updated.", status: "pending" },
    ] },
    { id: "req-1002", buyerId: "buyer-carla", buyerName: "Carla B.", service: "Post-hospital care", area: "Nassau, New Providence", startsAt: isoAt(nextWeek, 9), endsAt: isoAt(nextWeek, 12), summary: "Three hours of calm support after an outpatient procedure, including mobility and meal preparation.", budget: 160, status: "requested", quotes: [] },
  ],
  bookings: [
    { id: "book-1000", reference: "NAN-4F8K2B", requestId: "req-old", buyerId: "buyer-carla", buyerName: "Carla B.", sellerId: "seller-alicia", sellerName: "Alicia M.", service: "Home nursing", startsAt: new Date(seedNow - 3 * 86400_000).toISOString(), endsAt: new Date(seedNow - 3 * 86400_000 + 2 * 3600_000).toISOString(), status: "completed", total: 94, sellerNet: 86, conversationId: "conv-1000", reviewedBy: [] },
  ],
  messages: [
    { id: "msg-1", conversationId: "conv-1000", senderId: "seller-alicia", senderName: "Alicia M.", body: "Good morning Carla — I’m on my way and will arrive within the agreed window.", at: new Date(seedNow - 3 * 86400_000).toISOString() },
    { id: "msg-2", conversationId: "conv-1000", senderId: "buyer-carla", senderName: "Carla B.", body: "Thank you. I’ll meet you at the front entrance.", at: new Date(seedNow - 3 * 86400_000 + 600_000).toISOString() },
  ],
  kyc: [
    { id: "kyc-1001", sellerId: "seller-alicia", sellerName: "Alicia M.", type: "RN licence", status: "approved", fileName: "rn-licence.pdf", submittedAt: new Date(seedNow - 30 * 86400_000).toISOString() },
    { id: "kyc-1002", sellerId: "seller-marcus", sellerName: "Marcus D.", type: "Identity + background check", status: "pending", fileName: "identity-document.pdf", submittedAt: new Date(seedNow - 2 * 86400_000).toISOString() },
    { id: "kyc-1003", sellerId: "seller-simone", sellerName: "Simone R.", type: "Physiotherapy licence", status: "needs_information", fileName: "pt-credential.pdf", submittedAt: new Date(seedNow - 4 * 86400_000).toISOString() },
  ],
  disputes: [{ id: "dispute-1001", bookingId: "book-1000", openedBy: "buyer-carla", reason: "Visit timing", summary: "The recorded checkout time needs review before funds are finalized.", status: "open" }],
  favorites: ["seller-alicia"],
  supportCases: [{ id: "support-1001", openedBy: "buyer-carla", category: "booking", subject: "Question about a completed care receipt", status: "resolved", createdAt: new Date(seedNow - 7 * 86400_000).toISOString() }],
  safetyIncidents: [],
  privacyRequests: [],
  moderationReports: [],
  notifications: [
    { id: "note-1", userId: "buyer-carla", text: "Alicia sent a quote for Senior care.", read: false, at: new Date(seedNow - 3600_000).toISOString() },
    { id: "note-2", userId: "seller-alicia", text: "A new Senior care request matches your profile.", read: false, at: new Date(seedNow - 2 * 3600_000).toISOString() },
  ],
  sessionCodes: {},
  payouts: [],
};

export const demoIdentity = { buyer: "buyer-carla", seller: "seller-alicia", admin: "admin-ops" } as const;
