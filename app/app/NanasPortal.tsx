"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Ban,
  Bell,
  BookOpenCheck,
  BriefcaseMedical,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Filter,
  HeartHandshake,
  HeartPulse,
  House,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
  UserRoundCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  adminCommand,
  idempotencyKey,
  issueUploadUrl,
  marketplaceCommand,
} from "../../lib/nanas-api";
import {
  demoIdentity,
  DemoBooking,
  DemoQuote,
  DemoRequest,
  DemoRole,
  DemoState,
  initialDemoState,
} from "../../lib/demo-data";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";
import {
  DetailNotFound,
  NanasCareRequestDetail,
  NanasProviderProfile,
} from "./TargetedMarketplaceDetails";
import { CareSellerPreview, CareSellerResultCard } from "./CareStyleDiscovery";
import {
  SellerProfileStudio,
  type SellerProfileDraft,
} from "./SellerProfileStudio";
import "./portal.css";
import "./portal-overrides.css";
import "./buyer-experience.css";
import "./buyer-filter-enhancements.css";
import "./marketplace-makeover.css";

type Modal =
  | "request"
  | "quote"
  | "message"
  | "review"
  | "user-action"
  | "kyc-upload"
  | "kyc-review"
  | "dispute-review"
  | "privacy-action"
  | "booking-detail"
  | "cancel-booking"
  | "open-dispute"
  | "safety-alert"
  | "support-case"
  | "message-audit"
  | "message-upgrade"
  | "moderation-action"
  | "operations-case"
  | "catalog-service"
  | "catalog-area"
  | "posting-plan"
  | "household-member"
  | "weekly-availability"
  | "seller-service"
  | "seller-coverage"
  | null;
const isLegacyRequestWizard = (modal: Modal, step: number) =>
  modal === "request" && step === -1;
type NavItem = { id: string; label: string; icon: ReactNode; count?: number };
type RequestRecipient = {
  id: string;
  label: string;
  relationship: "self" | "child" | "family_member" | "other_dependent";
  birthMonth: string;
  birthYear: string;
  expecting: boolean;
};
type RequestPet = {
  id: string;
  kind: "dog" | "cat";
  name: string;
  breed: string;
  mixedBreed: boolean;
  ageGroup: "puppy_kitten" | "adult";
  size: "1_15" | "16_40" | "41_100" | "101_plus";
  gender: "female" | "male";
};
type CareCategoryCode =
  | "child_care"
  | "senior_care"
  | "adult_care"
  | "pet_care"
  | "housekeeping"
  | "tutoring";
type RequestDraft = {
  categoryCode: CareCategoryCode;
  subcategoryCode: string;
  serviceId: string;
  recipientId: string;
  recipientLabel: string;
  recipients: RequestRecipient[];
  needs: string[];
  qualities: string[];
  recipientGender: "" | "female" | "male";
  recipientAgeBand: string;
  pets: RequestPet[];
  homeBedrooms: number;
  homeBathrooms: number;
  homeHasPets: boolean;
  homeSquareFeet: string;
  cleaningFrequency: string;
  extras: string[];
  distanceLearning: "" | "yes" | "no";
  areaId: string;
  islandId: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  postalCode: string;
  accessNotes: string;
  mode: "scheduled" | "on_demand";
  scheduleKind: "recurring" | "one_time";
  startsAt: string;
  endDate: string;
  flexibleStart: boolean;
  weekdays: number[];
  timePeriods: string[];
  useSpecificTimes: boolean;
  startTime: string;
  endTime: string;
  scheduleVaries: boolean;
  hours: number;
  summary: string;
  budget: number;
  minRate: number;
  maxRate: number;
  postingPlanCode: string;
};
type PostingPlan = {
  id: string;
  code: string;
  name: string;
  description: string;
  fee: number;
  durationDays: number;
  freePostAllowance: number;
  featured: boolean;
  active: boolean;
};
type RealtimeMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  deleted_at?: string | null;
};
type SellerServiceRow = {
  id: string;
  serviceId: string;
  name: string;
  rate: number;
  rateMax?: number;
  bio?: string;
  yearsExperience: number;
  capabilities: string[];
  additionalHelp: string[];
  active: boolean;
};
type AdminOpsState = {
  overview: {
    activeUsers: number;
    sellersUnderReview: number;
    openRequests: number;
    activeBookings: number;
    openDisputes: number;
    moderationQueue: number;
    simulatedVolume: number;
  };
  flags: {
    key: string;
    description: string;
    enabled: boolean;
    rollout: number;
    updatedAt: string;
  }[];
  workers: {
    key: string;
    schedule: string;
    enabled: boolean;
    health: string;
    lastRunAt?: string;
    nextRunAt?: string;
  }[];
  workerRuns: {
    id: string;
    key: string;
    status: string;
    processed: number;
    startedAt: string;
    endedAt?: string;
    error?: string;
  }[];
  deadLetters: {
    id: string;
    source: string;
    attempts: number;
    error: string;
    createdAt: string;
  }[];
  audits: {
    id: string;
    action: string;
    targetType: string;
    targetId?: string;
    reason: string;
    traceId: string;
    createdAt: string;
  }[];
  accessLogs: {
    id: string;
    resourceType: string;
    purpose: string;
    fields: string[];
    createdAt: string;
  }[];
  outbox: {
    id: string;
    template: string;
    category: string;
    status: string;
    attempts: number;
    createdAt: string;
  }[];
  deliveries: {
    id: string;
    channel: string;
    status: string;
    attempts: number;
    vendor: string;
    createdAt: string;
  }[];
  categories: { id: string; name: string }[];
  services: {
    id: string;
    categoryId: string;
    name: string;
    description: string;
    pricingUnit: string;
    riskLevel: string;
    active: boolean;
  }[];
  islands: { id: string; name: string }[];
  areas: {
    id: string;
    islandId: string;
    islandName: string;
    name: string;
    active: boolean;
  }[];
  postingPlans: PostingPlan[];
};

const roleNav: Record<DemoRole, NavItem[]> = {
  buyer: [
    { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
    { id: "find-care", label: "Find care", icon: <Search /> },
    { id: "care-requests", label: "Care requests", icon: <HeartHandshake /> },
    { id: "quotes", label: "Quotes", icon: <ClipboardCheck /> },
    { id: "bookings", label: "Bookings", icon: <CalendarDays /> },
    { id: "messages", label: "Messages", icon: <MessageCircle /> },
    { id: "wallet", label: "Payments & wallet", icon: <WalletCards /> },
    { id: "reviews", label: "Reviews", icon: <Star /> },
    { id: "favorites", label: "Favorites", icon: <Star /> },
    { id: "household", label: "Care recipients", icon: <Users /> },
    { id: "notifications", label: "Notifications", icon: <Bell /> },
    { id: "safety", label: "Safety & support", icon: <LifeBuoy /> },
    { id: "account", label: "Account & privacy", icon: <ShieldCheck /> },
  ],
  seller: [
    { id: "overview", label: "Overview", icon: <LayoutDashboard /> },
    { id: "requests", label: "Care requests", icon: <Search /> },
    { id: "quotes", label: "My quotes", icon: <ClipboardCheck /> },
    { id: "bookings", label: "Bookings", icon: <CalendarDays /> },
    { id: "messages", label: "Messages", icon: <MessageCircle /> },
    { id: "availability", label: "Availability", icon: <Clock3 /> },
    { id: "services", label: "Services & rates", icon: <Stethoscope /> },
    { id: "earnings", label: "Earnings", icon: <CircleDollarSign /> },
    { id: "profile", label: "Profile & coverage", icon: <UserRoundCheck /> },
    { id: "kyc", label: "Verification", icon: <FileCheck2 /> },
    { id: "badges", label: "Badges & reviews", icon: <BadgeCheck /> },
    { id: "safety", label: "Safety & support", icon: <LifeBuoy /> },
    { id: "account", label: "Account & privacy", icon: <ShieldCheck /> },
  ],
  admin: [
    { id: "overview", label: "Operations", icon: <LayoutDashboard /> },
    { id: "users", label: "Users", icon: <Users /> },
    { id: "kyc", label: "KYC review", icon: <UserRoundCheck /> },
    { id: "bookings", label: "Bookings", icon: <CalendarDays /> },
    { id: "disputes", label: "Disputes & safety", icon: <LifeBuoy /> },
    { id: "messages", label: "Message audit", icon: <MessageCircle /> },
    { id: "moderation", label: "Moderation", icon: <ShieldCheck /> },
    { id: "finance", label: "Finance", icon: <CircleDollarSign /> },
    { id: "notifications", label: "Delivery health", icon: <Bell /> },
    { id: "catalog", label: "Care catalog", icon: <BriefcaseMedical /> },
    { id: "areas", label: "Islands & areas", icon: <House /> },
    { id: "cases", label: "Safety & support", icon: <LifeBuoy /> },
    { id: "analytics", label: "Analytics & exports", icon: <Activity /> },
    { id: "access", label: "Permissions & privacy", icon: <ShieldCheck /> },
    { id: "workers", label: "Workers & integrations", icon: <Settings /> },
    { id: "audit", label: "Audit log", icon: <BookOpenCheck /> },
    { id: "settings", label: "Configuration", icon: <Settings /> },
  ],
};

const serviceOptions = [
  "Senior care",
  "Home nursing",
  "Post-hospital care",
  "Respite care",
  "Disability care",
  "Physiotherapy",
];
type IntakeCategory = {
  code: CareCategoryCode;
  name: string;
  description: string;
  subcategories: { code: string; name: string; serviceId: string }[];
  needs: string[];
  qualities: string[];
};
const careIntakeCategories: IntakeCategory[] = [
  {
    code: "child_care",
    name: "Child care",
    description: "Babysitters, nannies and special-needs support",
    subcategories: [
      {
        code: "babysitter",
        name: "Babysitter",
        serviceId: "23000000-0000-0000-0000-000000000001",
      },
      {
        code: "nanny",
        name: "Nanny",
        serviceId: "23000000-0000-0000-0000-000000000002",
      },
      {
        code: "daycare_centers",
        name: "Daycare centers",
        serviceId: "23000000-0000-0000-0000-000000000003",
      },
      {
        code: "special_needs",
        name: "Special needs",
        serviceId: "23000000-0000-0000-0000-000000000004",
      },
    ],
    needs: [
      "Light housekeeping / meal prep",
      "Homework or curriculum help",
      "Structuring activities",
    ],
    qualities: [
      "Comfortable with pets",
      "College educated",
      "CPR / First Aid trained",
      "Has a reliable car",
      "Non-smoker",
    ],
  },
  {
    code: "senior_care",
    name: "Senior care",
    description: "Companion, hands-on and live-in care",
    subcategories: [
      {
        code: "companion",
        name: "Companion",
        serviceId: "23000000-0000-0000-0000-000000000005",
      },
      {
        code: "hands_on",
        name: "Hands-on",
        serviceId: "23000000-0000-0000-0000-000000000006",
      },
      {
        code: "live_in",
        name: "Live-in",
        serviceId: "23000000-0000-0000-0000-000000000007",
      },
    ],
    needs: [
      "Feeding",
      "Bathing / Dressing",
      "Companionship",
      "Meal Preparation",
      "Transportation",
      "Errands / Shopping",
      "Light Housekeeping",
      "Medication Prompting",
      "Mobility Assistance",
      "Wound Care",
      "Help Staying Physically Active",
      "Heavy Lifting",
    ],
    qualities: [
      "Comfortable with pets",
      "College degree",
      "CPR / First Aid trained",
      "Own transportation",
      "Does not smoke",
      "Alzheimer’s / Dementia experience",
      "COVID-19 vaccinated caregiver",
    ],
  },
  {
    code: "adult_care",
    name: "Adult care",
    description: "Everyday disability and independent-living support",
    subcategories: [
      {
        code: "companion",
        name: "Companion",
        serviceId: "23000000-0000-0000-0000-000000000008",
      },
      {
        code: "hands_on",
        name: "Hands-on",
        serviceId: "23000000-0000-0000-0000-000000000009",
      },
      {
        code: "live_in",
        name: "Live-in",
        serviceId: "23000000-0000-0000-0000-000000000010",
      },
    ],
    needs: [
      "Feeding",
      "Bathing / Dressing",
      "Companionship",
      "Meal Preparation",
      "Transportation",
      "Errands / Shopping",
      "Light Housekeeping",
      "Medication Prompting",
      "Mobility Assistance",
      "Wound Care",
      "Help Staying Physically Active",
      "Heavy Lifting",
    ],
    qualities: [
      "Comfortable with pets",
      "College degree",
      "CPR / First Aid trained",
      "Own transportation",
      "Does not smoke",
      "Disability care experience",
      "COVID-19 vaccinated caregiver",
    ],
  },
  {
    code: "pet_care",
    name: "Pet care",
    description: "Sitting, walking, training and grooming",
    subcategories: [
      {
        code: "pet_sitter",
        name: "Sitter",
        serviceId: "23000000-0000-0000-0000-000000000011",
      },
      {
        code: "dog_walker",
        name: "Walker",
        serviceId: "23000000-0000-0000-0000-000000000012",
      },
      {
        code: "pet_trainer",
        name: "Trainer",
        serviceId: "23000000-0000-0000-0000-000000000013",
      },
      {
        code: "pet_groomer",
        name: "Groomer",
        serviceId: "23000000-0000-0000-0000-000000000014",
      },
    ],
    needs: [
      "Play & exercise",
      "Boarding",
      "Walking",
      "Grooming",
      "Waste cleanup",
      "Feeding",
      "Training",
      "Medicine administration",
      "Overnight care",
    ],
    qualities: ["College degree", "Own transportation", "Does not smoke"],
  },
  {
    code: "housekeeping",
    name: "Housekeeping",
    description: "Home cleaning, assistance and errands",
    subcategories: [
      {
        code: "housekeeper",
        name: "Housekeeper",
        serviceId: "23000000-0000-0000-0000-000000000017",
      },
      {
        code: "house_cleaning",
        name: "House cleaning",
        serviceId: "23000000-0000-0000-0000-000000000018",
      },
      {
        code: "personal_assistant",
        name: "Personal assistant",
        serviceId: "23000000-0000-0000-0000-000000000019",
      },
      {
        code: "errands_odd_jobs",
        name: "Errands & odd jobs",
        serviceId: "23000000-0000-0000-0000-000000000020",
      },
    ],
    needs: [
      "Bathroom Cleaning",
      "Kitchen Cleaning",
      "General Room Cleaning",
      "Vacuuming / mopping",
      "Dusting",
      "Standard cleaning",
      "Deep cleaning",
    ],
    qualities: [
      "Housekeeper provides supplies",
      "Housekeeper provides equipment",
    ],
  },
  {
    code: "tutoring",
    name: "Tutoring",
    description: "Academic help, test prep and more subjects",
    subcategories: [
      {
        code: "math",
        name: "Math",
        serviceId: "23000000-0000-0000-0000-000000000021",
      },
      {
        code: "science",
        name: "Science",
        serviceId: "23000000-0000-0000-0000-000000000022",
      },
      {
        code: "test_prep",
        name: "Test prep",
        serviceId: "23000000-0000-0000-0000-000000000023",
      },
      {
        code: "more_subjects",
        name: "More subjects",
        serviceId: "23000000-0000-0000-0000-000000000024",
      },
    ],
    needs: [
      "Math",
      "English",
      "Science",
      "Test Prep",
      "Foreign Language",
      "Computers",
      "Art, Music & Drama",
      "Musical Instruments",
      "Dance",
      "Sports & Fitness",
      "Business",
      "Special Education",
      "Other",
      "Study Skills",
      "History",
    ],
    qualities: [
      "Comfortable with pets",
      "College degree",
      "Own transportation",
      "Willing to drive children",
      "Does not smoke",
    ],
  },
];
const careNeedOptions = careIntakeCategories[0].needs;
const housekeepingExtraOptions = [
  "Changing bed linens",
  "Oven Cleaning",
  "Refrigerator Cleaning",
  "Cabinet Cleaning",
  "Window Washing",
  "Carpet Cleaning",
  "Wall Washing",
  "Laundry",
  "Pet waste cleanup",
  "Attic Cleaning",
  "Basement Cleaning",
  "Organization",
  "Move-out cleaning",
];
const weekdayOptions = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const defaultPostingPlans: PostingPlan[] = [
  {
    id: "demo-plan-free",
    code: "free",
    name: "Free care request",
    description: "Your first request, visible to matching approved sellers.",
    fee: 0,
    durationDays: 7,
    freePostAllowance: 1,
    featured: false,
    active: true,
  },
  {
    id: "demo-plan-premium",
    code: "premium",
    name: "Premium care request",
    description: "Longer visibility with priority placement in matching.",
    fee: 19,
    durationDays: 30,
    freePostAllowance: 0,
    featured: true,
    active: true,
  },
  {
    id: "demo-plan-premium-plus",
    code: "premium_plus",
    name: "Premium Plus",
    description: "Maximum visibility duration and featured placement.",
    fee: 39,
    durationDays: 45,
    freePostAllowance: 0,
    featured: true,
    active: true,
  },
];
const professionalSkillOptions = [
  "CPR training",
  "First aid training",
  "Medication support",
  "Mobility support",
  "Wound care",
  "Dementia care",
];
const preferenceOptions = [
  "College educated",
  "Comfortable with pets",
  "Has reliable transportation",
  "Does not smoke",
  "Weekend availability",
];
const languageOptions = [
  "English",
  "Spanish",
  "Haitian Creole",
  "Bahamian Creole",
  "French",
  "Chinese",
];
const publicLanguageLabel = (language: string) =>
  (
    ({
      "en-BS": "English (Bahamas)",
      en: "English",
      es: "Spanish",
      fr: "French",
      ht: "Haitian Creole",
    }) as Record<string, string>
  )[language] ?? language;
const money = (amount: number) =>
  new Intl.NumberFormat("en-BS", { style: "currency", currency: "BSD" }).format(
    amount,
  );
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-BS", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Nassau",
  }).format(new Date(value));
const bahamasInputValue = (timestamp: number) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Nassau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};
const bahamasLocalToIso = (value: string) => {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const assumedUtc = Date.UTC(year, month - 1, day, hour, minute);
  const zoneParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Nassau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(assumedUtc));
  const zonePart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(zoneParts.find((item) => item.type === type)?.value ?? 0);
  const zoneAsUtc = Date.UTC(
    zonePart("year"),
    zonePart("month") - 1,
    zonePart("day"),
    zonePart("hour"),
    zonePart("minute"),
  );
  return new Date(assumedUtc - (zoneAsUtc - assumedUtc)).toISOString();
};
const cloneInitial = () =>
  JSON.parse(JSON.stringify(initialDemoState)) as DemoState;
const commaList = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const demoSellerSeed = initialDemoState.users.find(
  (user) => user.id === demoIdentity.seller,
)!;
const demoSellerDetails = demoSellerSeed.sellerDetails!;
const emptyAdminOps = (): AdminOpsState => ({
  overview: {
    activeUsers: 0,
    sellersUnderReview: 0,
    openRequests: 0,
    activeBookings: 0,
    openDisputes: 0,
    moderationQueue: 0,
    simulatedVolume: 0,
  },
  flags: [],
  workers: [],
  workerRuns: [],
  deadLetters: [],
  audits: [],
  accessLogs: [],
  outbox: [],
  deliveries: [],
  categories: [{ id: "demo-healthcare", name: "Healthcare at home" }],
  services: serviceOptions.map((name) => ({
    id: serviceId(name),
    categoryId: "demo-healthcare",
    name,
    description: `${name} delivered safely in the home by an approved seller.`,
    pricingUnit: "hour",
    riskLevel: name === "Home nursing" ? "enhanced" : "standard",
    active: true,
  })),
  islands: [
    { id: "10000000-0000-0000-0000-000000000001", name: "New Providence" },
    { id: "10000000-0000-0000-0000-000000000002", name: "Grand Bahama" },
    { id: "10000000-0000-0000-0000-000000000003", name: "Abaco" },
  ],
  areas: [
    { id: serviceAreaId("Nassau & Paradise Island"), islandId: "10000000-0000-0000-0000-000000000001", islandName: "New Providence", name: "Nassau & Paradise Island", active: true },
    { id: serviceAreaId("Freeport & Lucaya"), islandId: "10000000-0000-0000-0000-000000000002", islandName: "Grand Bahama", name: "Freeport & Lucaya", active: true },
    { id: serviceAreaId("Marsh Harbour"), islandId: "10000000-0000-0000-0000-000000000003", islandName: "Abaco", name: "Marsh Harbour", active: true },
  ],
  postingPlans: defaultPostingPlans,
});

export default function NanasPortal({
  initialRoute,
  initialRequestCategory,
  initialDemoMode,
}: {
  initialRoute: string[];
  initialRequestCategory?: string;
  initialDemoMode: boolean;
}) {
  const router = useRouter();
  const routeRole = (["buyer", "seller", "admin"] as DemoRole[]).includes(
    initialRoute[0] as DemoRole,
  )
    ? (initialRoute[0] as DemoRole)
    : "buyer";
  const routeEntityId = initialRoute[2]
    ? decodeURIComponent(initialRoute[2])
    : null;
  const initialIntakeCategory =
    routeRole === "buyer"
      ? careIntakeCategories.find(
          (category) => category.code === initialRequestCategory,
        )
      : undefined;
  const initialIntakeSubcategory = initialIntakeCategory?.subcategories[0];
  const initialRecipientLabel =
    initialIntakeCategory?.code === "child_care"
      ? "Child 1"
      : initialIntakeCategory?.code === "pet_care"
        ? "My pets"
        : initialIntakeCategory?.code === "housekeeping"
          ? "My home"
          : initialIntakeCategory?.code === "tutoring"
            ? "Student"
            : "A family member";
  const [role, setRole] = useState<DemoRole>(routeRole);
  const [section, setSection] = useState(initialRoute[1] ?? "overview");
  const [state, setState] = useState<DemoState>(cloneInitial);
  const [modal, setModal] = useState<Modal>(
    initialIntakeCategory ? "request" : null,
  );
  const [selected, setSelected] = useState<string | null>(routeEntityId);
  const [unlockedConversations, setUnlockedConversations] = useState<string[]>(
    [],
  );
  const [notificationPreferences, setNotificationPreferences] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [selectedCaseKind, setSelectedCaseKind] = useState<
    "support" | "safety" | null
  >(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryService, setDiscoveryService] = useState("all");
  const [discoverySort, setDiscoverySort] = useState("recommended");
  const [discoveryArea, setDiscoveryArea] = useState("all");
  const [discoveryMinRate, setDiscoveryMinRate] = useState(0);
  const [discoveryMaxRate, setDiscoveryMaxRate] = useState(0);
  const [discoveryMinRating, setDiscoveryMinRating] = useState(0);
  const [discoveryMinYears, setDiscoveryMinYears] = useState(0);
  const [discoveryFirstName, setDiscoveryFirstName] = useState("");
  const [discoveryLastInitial, setDiscoveryLastInitial] = useState("");
  const [discoveryEmployment, setDiscoveryEmployment] = useState<string[]>([]);
  const [discoverySkills, setDiscoverySkills] = useState<string[]>([]);
  const [discoveryPreferences, setDiscoveryPreferences] = useState<string[]>(
    [],
  );
  const [discoveryLanguages, setDiscoveryLanguages] = useState<string[]>([]);
  const [discoveryLanguageQuery, setDiscoveryLanguageQuery] = useState("");
  const [discoveryAdvancedOpen, setDiscoveryAdvancedOpen] = useState(false);
  const [sellerJobQuery, setSellerJobQuery] = useState("");
  const [sellerJobService, setSellerJobService] = useState("all");
  const [sellerJobArea, setSellerJobArea] = useState("all");
  const [sellerJobSort, setSellerJobSort] = useState("newest");
  const [focusedSellerId, setFocusedSellerId] = useState<string | null>(null);
  const [requestStep, setRequestStep] = useState(
    initialIntakeCategory ? 1 : 0,
  );
  const [requestDraft, setRequestDraft] = useState<RequestDraft>(() => ({
    categoryCode: initialIntakeCategory?.code ?? "child_care",
    subcategoryCode: initialIntakeSubcategory?.code ?? "babysitter",
    serviceId:
      initialIntakeSubcategory?.serviceId ??
      "23000000-0000-0000-0000-000000000001",
    recipientId: "",
    recipientLabel: initialRecipientLabel,
    needs: [],
    qualities: [],
    recipientGender: "",
    recipientAgeBand: "",
    recipients: [
      {
        id: "recipient-1",
        label: initialRecipientLabel,
        relationship:
          initialIntakeCategory?.code === "child_care"
            ? "child"
            : "family_member",
        birthMonth: "",
        birthYear: "",
        expecting: false,
      },
    ],
    pets: [
      {
        id: "pet-1",
        kind: "dog",
        name: "",
        breed: "",
        mixedBreed: false,
        ageGroup: "adult",
        size: "16_40",
        gender: "female",
      },
    ],
    homeBedrooms: 2,
    homeBathrooms: 1,
    homeHasPets: false,
    homeSquareFeet: "1001_1500",
    cleaningFrequency: "every_week",
    extras: [],
    distanceLearning: "",
    areaId: serviceAreaId("Nassau & Paradise Island"),
    islandId: "10000000-0000-0000-0000-000000000001",
    addressLine1: "",
    addressLine2: "",
    locality: "Nassau",
    postalCode: "",
    accessNotes: "",
    mode: "scheduled",
    scheduleKind: "recurring",
    startsAt: bahamasInputValue(Date.now() + 86400_000),
    endDate: "",
    flexibleStart: false,
    weekdays: [1, 3, 5],
    timePeriods: ["morning"],
    useSpecificTimes: false,
    startTime: "09:00",
    endTime: "12:00",
    scheduleVaries: false,
    hours: 3,
    summary: "",
    budget: 180,
    minRate: 20,
    maxRate: 45,
    postingPlanCode: "free",
  }));
  const [adminOps, setAdminOps] = useState<AdminOpsState>(emptyAdminOps);
  const [liveServices, setLiveServices] = useState(() =>
    serviceOptions.map((name) => ({ id: serviceId(name), name })),
  );
  const [liveAreas, setLiveAreas] = useState(() =>
    ["Nassau & Paradise Island", "Freeport & Lucaya", "Marsh Harbour"].map(
      (name) => ({ id: serviceAreaId(name), name }),
    ),
  );
  const liveIslands = [
    { id: "10000000-0000-0000-0000-000000000001", name: "New Providence" },
    { id: "10000000-0000-0000-0000-000000000002", name: "Grand Bahama" },
    { id: "10000000-0000-0000-0000-000000000003", name: "Abaco" },
  ];
  const [householdMembers, setHouseholdMembers] = useState<
    {
      id: string;
      relationship: string;
      name: string;
      dateOfBirth?: string;
      notes?: string;
      active: boolean;
    }[]
  >([]);
  const [sellerServiceRows, setSellerServiceRows] = useState<
    SellerServiceRow[]
  >(() =>
    demoSellerDetails.services.map((service) => ({
      id: `demo-${service.id}`,
      serviceId: service.id,
      name: service.name,
      rate: service.rate,
      rateMax: service.rateMax,
      bio: service.bio,
      yearsExperience: service.yearsExperience ?? 0,
      capabilities: service.capabilities ?? [],
      additionalHelp: service.additionalHelp ?? [],
      active: true,
    })),
  );
  const [availabilityRows, setAvailabilityRows] = useState<
    {
      id: string;
      weekday: number;
      start: string;
      end: string;
      active: boolean;
    }[]
  >(() =>
    (demoSellerDetails.availability ?? []).map((rule, index) => ({
      id: `demo-rule-${index}`,
      weekday: rule.weekday,
      start: rule.start,
      end: rule.end,
      active: true,
    })),
  );
  const [sellerProfileForm, setSellerProfileForm] =
    useState<SellerProfileDraft>({
      displayName: demoSellerSeed.name,
      headline: demoSellerDetails.headline ?? "",
      languages: demoSellerDetails.languages,
      vaccinations: demoSellerDetails.vaccinations ?? [],
      additionalDetails: demoSellerDetails.additionalDetails ?? [],
      islandId: "10000000-0000-0000-0000-000000000001",
      locality: demoSellerDetails.locality ?? "",
    });
  const [sellerCoverageRows, setSellerCoverageRows] = useState<
    {
      id: string;
      areaId: string;
      name: string;
      radius: number;
      travelFee: number;
      active: boolean;
    }[]
  >([]);
  const [authIdentity, setAuthIdentity] = useState<{
    id: string;
    name: string;
    email: string;
    role: DemoRole;
    avatar: string;
  } | null>(null);
  const [marketplaceLoaded, setMarketplaceLoaded] = useState(initialDemoMode);
  const [sellerWorkspaceLoaded, setSellerWorkspaceLoaded] =
    useState(initialDemoMode);
  const demoMode = initialDemoMode;
  const stateHydrated = useRef(false);
  const adminOpsHydrated = useRef(false);
  const backendConnected = isSupabaseConfigured() && !demoMode;
  const currentUserId = demoMode
    ? demoIdentity[role]
    : (authIdentity?.id ?? demoIdentity[role]);
  const currentUser = state.users.find((user) => user.id === currentUserId) ?? {
    id: currentUserId,
    name: !demoMode && authIdentity?.name ? authIdentity.name : "Nanas member",
    email: !demoMode && authIdentity?.email ? authIdentity.email : "",
    role,
    status: "active" as const,
    avatar: !demoMode && authIdentity?.avatar ? authIdentity.avatar : "NM",
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nanas-message-access-v1");
      if (saved)
        queueMicrotask(() =>
          setUnlockedConversations(JSON.parse(saved) as string[]),
        );
    } catch {
      // An unavailable localStorage simply keeps conversations locked.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "nanas-message-access-v1",
      JSON.stringify(unlockedConversations),
    );
  }, [unlockedConversations]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nanas-notification-preferences-v1");
      if (saved)
        queueMicrotask(() =>
          setNotificationPreferences(
            JSON.parse(saved) as Record<string, Record<string, boolean>>,
          ),
        );
    } catch {
      // Defaults remain enabled if preference storage is unavailable.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "nanas-notification-preferences-v1",
      JSON.stringify(notificationPreferences),
    );
  }, [notificationPreferences]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1" && params.get("reset") === "1") {
      localStorage.removeItem("nanas-demo-state-v3");
      localStorage.removeItem("nanas-demo-admin-ops-v1");
      stateHydrated.current = true;
      return;
    }
    const saved = localStorage.getItem("nanas-demo-state-v3");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<DemoState>;
        const restored = {
          ...cloneInitial(),
          ...parsed,
          moderationReports: parsed.moderationReports ?? [],
        } as DemoState;
        queueMicrotask(() => {
          setState(restored);
          stateHydrated.current = true;
        });
        return;
      } catch {
        /* keep seed */
      }
    }
    stateHydrated.current = true;
  }, []);
  useEffect(() => {
    if (stateHydrated.current)
      localStorage.setItem("nanas-demo-state-v3", JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1" && params.get("reset") === "1") {
      adminOpsHydrated.current = true;
      return;
    }
    const saved = localStorage.getItem("nanas-demo-admin-ops-v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AdminOpsState>;
        const restored = { ...emptyAdminOps(), ...parsed } as AdminOpsState;
        queueMicrotask(() => {
          setAdminOps(restored);
          adminOpsHydrated.current = true;
        });
        return;
      } catch {
        // Keep seeded local operations data.
      }
    }
    adminOpsHydrated.current = true;
  }, []);
  useEffect(() => {
    if (adminOpsHydrated.current)
      localStorage.setItem("nanas-demo-admin-ops-v1", JSON.stringify(adminOps));
  }, [adminOps]);
  useEffect(() => {
    if (!backendConnected) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setMarketplaceLoaded(true);
        setSellerWorkspaceLoaded(true);
        return;
      }
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", authData.user.id)
          .single(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id)
          .is("revoked_at", null),
      ]);
      const detectedRole: DemoRole = roles?.some(
        (item) => item.role === "admin",
      )
        ? "admin"
        : roles?.some((item) => item.role === "seller")
          ? "seller"
          : "buyer";
      const name =
        profile?.display_name ??
        String(
          authData.user.user_metadata.display_name ??
            authData.user.email?.split("@")[0] ??
            "Nanas member",
        );
      const avatar =
        name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("") || "NM";
      setAuthIdentity({
        id: authData.user.id,
        name,
        email: authData.user.email ?? authData.user.phone ?? "",
        role: detectedRole,
        avatar,
      });
      setRole(detectedRole);
      setState((prev) =>
        prev.users.some((item) => item.id === authData.user.id)
          ? prev
          : {
              ...prev,
              users: [
                {
                  id: authData.user.id,
                  name,
                  email: authData.user.email ?? authData.user.phone ?? "",
                  role: detectedRole,
                  status: "active",
                  avatar,
                },
                ...prev.users,
              ],
            },
      );
      let adminUsers: DemoState["users"] | null = null;
      if (detectedRole === "admin") {
        const [
          { data: remoteProfiles },
          { data: remoteRoles },
          { data: remoteKyc },
          { data: remoteDisputes },
          { data: remoteModeration },
        ] = await Promise.all([
          supabase.from("profiles").select("id,display_name,account_status"),
          supabase
            .from("user_roles")
            .select("user_id,role")
            .is("revoked_at", null),
          supabase
            .from("verification_cases")
            .select("id,seller_id,verification_type,status,created_at"),
          supabase
            .from("service_disputes")
            .select(
              "id,booking_id,opened_by,reason_code,summary,status,resolution_code,resolution_note",
            ),
          supabase
            .from("moderation_reports")
            .select(
              "id,reporter_id,target_type,target_id,reason_code,details,priority,status,created_at",
            )
            .order("created_at", { ascending: false }),
        ]);
        const profileNames = new Map(
          (remoteProfiles ?? []).map((item) => [item.id, item.display_name]),
        );
        const activeRoles = new Map<string, DemoRole>();
        for (const item of remoteRoles ?? []) {
          const current = activeRoles.get(item.user_id);
          if (
            item.role === "admin" ||
            (item.role === "seller" && current !== "admin") ||
            !current
          )
            activeRoles.set(item.user_id, item.role);
        }
        const hydratedUsers = (remoteProfiles ?? []).map((item) => {
          const hydratedName = item.display_name;
          const hydratedRole = activeRoles.get(item.id) ?? "buyer";
          return {
            id: item.id,
            name: hydratedName,
            email: "Private account",
            role: hydratedRole,
            status:
              item.account_status === "closed"
                ? ("closed" as const)
                : item.account_status === "suspended"
                  ? ("suspended" as const)
                  : item.account_status === "restricted"
                    ? ("restricted" as const)
                    : ("active" as const),
            avatar:
              hydratedName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("") || "NM",
          };
        });
        adminUsers = hydratedUsers;
        const hydratedKyc = (remoteKyc ?? []).map((item) => ({
          id: item.id,
          sellerId: item.seller_id,
          sellerName: profileNames.get(item.seller_id) ?? "Nanas seller",
          type: item.verification_type,
          status:
            item.status === "approved" ||
            item.status === "rejected" ||
            item.status === "needs_information"
              ? item.status
              : ("pending" as const),
          fileName: "Private Supabase document",
          submittedAt: item.created_at,
        }));
        const hydratedDisputes = (remoteDisputes ?? []).map((item) => ({
          id: item.id,
          bookingId: item.booking_id,
          openedBy: item.opened_by,
          reason: item.reason_code,
          summary: item.summary,
          status:
            item.status === "resolved" || item.status === "closed"
              ? ("resolved" as const)
              : ("open" as const),
          resolution: item.resolution_note ?? item.resolution_code ?? undefined,
        }));
        const hydratedModeration = (remoteModeration ?? []).map((item) => ({
          id: item.id,
          reporterId: item.reporter_id,
          targetType: item.target_type,
          targetId: item.target_id,
          reason: item.reason_code,
          details: item.details ?? undefined,
          priority: item.priority,
          status:
            item.status === "resolved" || item.status === "closed"
              ? ("resolved" as const)
              : item.status === "escalated"
                ? ("escalated" as const)
                : ("open" as const),
          createdAt: item.created_at,
        }));
        setState((prev) => ({
          ...prev,
          users: hydratedUsers,
          kyc: hydratedKyc,
          disputes: hydratedDisputes,
          moderationReports: hydratedModeration,
        }));
        const [
          overviewResult,
          flagsResult,
          workersResult,
          runsResult,
          deadResult,
          auditsResult,
          accessResult,
          outboxResult,
          deliveriesResult,
          categoriesResult,
          catalogServicesResult,
          islandsResult,
          catalogAreasResult,
          postingPlansResult,
        ] = await Promise.all([
          supabase
            .from("admin_overview")
            .select(
              "active_users,sellers_under_review,open_care_requests,active_bookings,open_disputes,moderation_queue,simulated_volume_minor",
            )
            .maybeSingle(),
          supabase
            .from("feature_flags")
            .select("key,description,enabled,rollout_percent,updated_at")
            .order("key"),
          supabase
            .from("scheduled_workers")
            .select(
              "key,schedule,enabled,health_status,last_run_at,next_run_at",
            )
            .order("key"),
          supabase
            .from("worker_runs")
            .select(
              "id,worker_key,status,processed_count,started_at,ended_at,error_summary",
            )
            .order("started_at", { ascending: false })
            .limit(30),
          supabase
            .from("dead_letters")
            .select("id,source_queue,attempts,last_error,created_at")
            .is("replayed_at", null)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("admin_audit_logs")
            .select(
              "id,action,target_type,target_id,reason,trace_id,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("admin_access_logs")
            .select("id,resource_type,purpose_code,fields_accessed,created_at")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("notification_outbox")
            .select("id,template_key,category,status,attempts,created_at")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("notification_deliveries")
            .select("id,channel,status,attempts,vendor,created_at")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("service_categories")
            .select("id,name")
            .order("sort_order"),
          supabase
            .from("services")
            .select(
              "id,category_id,name,description,pricing_unit,risk_level,active",
            )
            .order("name"),
          supabase.from("islands").select("id,name").order("name"),
          supabase
            .from("service_areas")
            .select("id,island_id,name,active")
            .order("name"),
          supabase
            .from("job_posting_plans")
            .select(
              "id,code,name,description,fee_minor,duration_days,free_post_allowance,featured,active",
            )
            .order("sort_order"),
        ]);
        const adminOperationErrors = [
          overviewResult,
          flagsResult,
          workersResult,
          runsResult,
          deadResult,
          auditsResult,
          accessResult,
          outboxResult,
          deliveriesResult,
          categoriesResult,
          catalogServicesResult,
          islandsResult,
          catalogAreasResult,
          postingPlansResult,
        ].flatMap((result) => (result.error ? [result.error.message] : []));
        if (adminOperationErrors.length)
          console.error(
            "Nanas admin operations hydration failed",
            adminOperationErrors,
          );
        const overview = overviewResult.data;
        const islandNames = new Map(
          (islandsResult.data ?? []).map((item) => [item.id, item.name]),
        );
        setAdminOps({
          overview: {
            activeUsers: Number(overview?.active_users ?? 0),
            sellersUnderReview: Number(overview?.sellers_under_review ?? 0),
            openRequests: Number(overview?.open_care_requests ?? 0),
            activeBookings: Number(overview?.active_bookings ?? 0),
            openDisputes: Number(overview?.open_disputes ?? 0),
            moderationQueue: Number(overview?.moderation_queue ?? 0),
            simulatedVolume:
              Number(overview?.simulated_volume_minor ?? 0) / 100,
          },
          flags: (flagsResult.data ?? []).map((item) => ({
            key: item.key,
            description: item.description,
            enabled: item.enabled,
            rollout: item.rollout_percent,
            updatedAt: item.updated_at,
          })),
          workers: (workersResult.data ?? []).map((item) => ({
            key: item.key,
            schedule: item.schedule,
            enabled: item.enabled,
            health: item.health_status,
            lastRunAt: item.last_run_at ?? undefined,
            nextRunAt: item.next_run_at ?? undefined,
          })),
          workerRuns: (runsResult.data ?? []).map((item) => ({
            id: item.id,
            key: item.worker_key,
            status: item.status,
            processed: item.processed_count,
            startedAt: item.started_at,
            endedAt: item.ended_at ?? undefined,
            error: item.error_summary ?? undefined,
          })),
          deadLetters: (deadResult.data ?? []).map((item) => ({
            id: item.id,
            source: item.source_queue,
            attempts: item.attempts,
            error: item.last_error,
            createdAt: item.created_at,
          })),
          audits: (auditsResult.data ?? []).map((item) => ({
            id: item.id,
            action: item.action,
            targetType: item.target_type,
            targetId: item.target_id ?? undefined,
            reason: item.reason,
            traceId: item.trace_id,
            createdAt: item.created_at,
          })),
          accessLogs: (accessResult.data ?? []).map((item) => ({
            id: item.id,
            resourceType: item.resource_type,
            purpose: item.purpose_code,
            fields: item.fields_accessed,
            createdAt: item.created_at,
          })),
          outbox: (outboxResult.data ?? []).map((item) => ({
            id: item.id,
            template: item.template_key,
            category: item.category,
            status: item.status,
            attempts: item.attempts,
            createdAt: item.created_at,
          })),
          deliveries: (deliveriesResult.data ?? []).map((item) => ({
            id: item.id,
            channel: item.channel,
            status: item.status,
            attempts: item.attempts,
            vendor: item.vendor,
            createdAt: item.created_at,
          })),
          categories: (categoriesResult.data ?? []).map((item) => ({
            id: item.id,
            name: item.name,
          })),
          services: (catalogServicesResult.data ?? []).map((item) => ({
            id: item.id,
            categoryId: item.category_id,
            name: item.name,
            description: item.description,
            pricingUnit: item.pricing_unit,
            riskLevel: item.risk_level,
            active: item.active,
          })),
          islands: (islandsResult.data ?? []).map((item) => ({
            id: item.id,
            name: item.name,
          })),
          areas: (catalogAreasResult.data ?? []).map((item) => ({
            id: item.id,
            islandId: item.island_id,
            islandName: islandNames.get(item.island_id) ?? "The Bahamas",
            name: item.name,
            active: item.active,
          })),
          postingPlans: (postingPlansResult.data ?? []).map((item) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            description: item.description,
            fee: Number(item.fee_minor) / 100,
            durationDays: item.duration_days,
            freePostAllowance: item.free_post_allowance,
            featured: item.featured,
            active: item.active,
          })),
        });
      }
      {
        // Each query is independently constrained by its table's RLS policy.
        // This keeps refresh hydration participant-scoped without a broad
        // security-definer snapshot endpoint.
        const [
          servicesResult,
          areasResult,
          sellersResult,
          requestsResult,
          quotesResult,
          bookingsResult,
          conversationsResult,
          messagesResult,
          favoritesResult,
          notificationsResult,
          supportResult,
          safetyResult,
          privacyResult,
          reviewsResult,
          verificationResult,
          householdMembersResult,
          sellerServicesOwnResult,
          availabilityOwnResult,
          sellerProfileOwnResult,
          sellerCoverageOwnResult,
          postingPlansBuyerResult,
        ] = await Promise.all([
          supabase.from("services").select("id,name").eq("active", true),
          supabase.from("service_areas").select("id,name").eq("active", true),
          supabase
            .from("seller_directory")
            .select(
              "user_id,display_name,avatar_path,headline,locality,island,rating_average,rating_count,completed_bookings,response_rate,languages,vaccinations,additional_details,services,badges,availability,availability_updated_at,credentials,safety_checks",
            ),
          supabase
            .from("booking_requests")
            .select(
              "id,buyer_id,service_id,service_area_id,mode,desired_start,desired_end,care_summary,budget_minor,status,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("booking_quotes")
            .select(
              "id,request_id,buyer_id,seller_id,service_id,starts_at,ends_at,base_minor,travel_minor,platform_fee_minor,total_minor,policy_snapshot,expires_at,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(300),
          supabase
            .from("bookings")
            .select(
              "id,reference,request_id,quote_id,buyer_id,seller_id,service_id,scheduled_start,scheduled_end,status,total_minor,seller_net_minor,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("conversations")
            .select("id,booking_id,request_id,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("messages")
            .select("id,conversation_id,sender_id,body,created_at")
            .is("deleted_at", null)
            .order("created_at", { ascending: true })
            .limit(500),
          supabase
            .from("favorites")
            .select("seller_id")
            .eq("buyer_id", authData.user.id),
          supabase
            .from("notifications")
            .select("id,recipient_id,title,body,read_at,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("support_cases")
            .select("id,requester_id,case_type,status,subject,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("safety_incidents")
            .select(
              "id,booking_id,reporter_id,category,status,acknowledged_at,created_at",
            )
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("privacy_requests")
            .select("id,user_id,request_type,status,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("reviews")
            .select("booking_id,author_id")
            .order("created_at", { ascending: false })
            .limit(300),
          supabase
            .from("verification_cases")
            .select("id,seller_id,verification_type,status,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("household_members")
            .select(
              "id,relationship,display_name,date_of_birth_private,care_notes_private,active",
            )
            .order("created_at"),
          supabase
            .from("seller_services")
            .select(
              "id,service_id,rate_minor,rate_max_minor,service_bio,years_experience,capabilities,additional_help,active",
            )
            .eq("seller_id", authData.user.id)
            .order("created_at"),
          supabase
            .from("availability_rules")
            .select("id,weekday,local_start,local_end,active")
            .eq("seller_id", authData.user.id)
            .is("service_id", null)
            .is("service_area_id", null)
            .order("weekday"),
          supabase
            .from("seller_profiles")
            .select(
              "display_name,avatar_path,headline,languages,island_id,locality,vaccinations,additional_details",
            )
            .eq("user_id", authData.user.id)
            .maybeSingle(),
          supabase
            .from("seller_service_areas")
            .select("id,service_area_id,radius_km,travel_fee_minor,active")
            .eq("seller_id", authData.user.id)
            .order("created_at"),
          supabase
            .from("job_posting_plans")
            .select(
              "id,code,name,description,fee_minor,duration_days,free_post_allowance,featured,active",
            )
            .eq("active", true)
            .order("sort_order"),
        ]);

        const serviceNames = new Map(
          (servicesResult.data ?? []).map((item) => [item.id, item.name]),
        );
        const areaNames = new Map(
          (areasResult.data ?? []).map((item) => [item.id, item.name]),
        );
        setLiveServices(
          (servicesResult.data ?? []).map((item) => ({
            id: item.id,
            name: item.name,
          })),
        );
        setLiveAreas(
          (areasResult.data ?? []).map((item) => ({
            id: item.id,
            name: item.name,
          })),
        );
        setHouseholdMembers(
          (householdMembersResult.data ?? []).map((item) => ({
            id: item.id,
            relationship: item.relationship,
            name: item.display_name,
            dateOfBirth: item.date_of_birth_private ?? undefined,
            notes: item.care_notes_private ?? undefined,
            active: item.active,
          })),
        );
        setSellerServiceRows(
          (sellerServicesOwnResult.data ?? []).map((item) => ({
            id: item.id,
            serviceId: item.service_id,
            name: serviceNames.get(item.service_id) ?? "Healthcare service",
            rate: Number(item.rate_minor) / 100,
            rateMax:
              item.rate_max_minor == null
                ? undefined
                : Number(item.rate_max_minor) / 100,
            bio: item.service_bio ?? undefined,
            yearsExperience: item.years_experience,
            capabilities: item.capabilities.map(String),
            additionalHelp: item.additional_help.map(String),
            active: item.active,
          })),
        );
        setAvailabilityRows(
          (availabilityOwnResult.data ?? []).map((item) => ({
            id: item.id,
            weekday: item.weekday,
            start: item.local_start,
            end: item.local_end,
            active: item.active,
          })),
        );
        if (sellerProfileOwnResult.data)
          setSellerProfileForm({
            displayName: sellerProfileOwnResult.data.display_name,
            avatarPath: sellerProfileOwnResult.data.avatar_path ?? undefined,
            headline: sellerProfileOwnResult.data.headline ?? "",
            languages: sellerProfileOwnResult.data.languages.map(String),
            vaccinations: sellerProfileOwnResult.data.vaccinations.map(String),
            additionalDetails:
              sellerProfileOwnResult.data.additional_details.map(String),
            islandId: sellerProfileOwnResult.data.island_id ?? undefined,
            locality: sellerProfileOwnResult.data.locality ?? "",
          });
        else
          setSellerProfileForm({
            displayName: name,
            headline: "",
            languages: [],
            vaccinations: [],
            additionalDetails: [],
            islandId: undefined,
            locality: "",
          });
        setSellerCoverageRows(
          (sellerCoverageOwnResult.data ?? []).map((item) => ({
            id: item.id,
            areaId: item.service_area_id,
            name: areaNames.get(item.service_area_id) ?? "The Bahamas",
            radius: Number(item.radius_km ?? 0),
            travelFee: Number(item.travel_fee_minor) / 100,
            active: item.active,
          })),
        );
        if (postingPlansBuyerResult.data?.length)
          setAdminOps((prev) => ({
            ...prev,
            postingPlans: postingPlansBuyerResult.data.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name,
              description: item.description,
              fee: Number(item.fee_minor) / 100,
              durationDays: item.duration_days,
              freePostAllowance: item.free_post_allowance,
              featured: item.featured,
              active: item.active,
            })),
          }));
        const remoteRequests = requestsResult.data ?? [];
        const remoteQuotes = quotesResult.data ?? [];
        const remoteBookings = bookingsResult.data ?? [];
        const remoteConversations = conversationsResult.data ?? [];
        const remoteReviews = reviewsResult.data ?? [];

        const connectedUsers = new Map<string, DemoState["users"][number]>();
        const addConnectedUser = (
          id: string,
          displayName: string,
          userRole: DemoRole,
        ) => {
          const safeName =
            displayName.trim() ||
            (userRole === "seller" ? "Nanas seller" : "Nanas buyer");
          const existing = connectedUsers.get(id);
          connectedUsers.set(id, {
            id,
            name: safeName,
            email:
              id === authData.user.id
                ? (authData.user.email ?? authData.user.phone ?? "")
                : "Private account",
            role: userRole,
            status: "active",
            avatar:
              safeName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("") || "NM",
            avatarUrl: existing?.avatarUrl,
            sellerDetails: existing?.sellerDetails,
          });
        };
        addConnectedUser(authData.user.id, name, detectedRole);
        for (const seller of sellersResult.data ?? []) {
          if (!seller.user_id) continue;
          addConnectedUser(
            seller.user_id,
            seller.display_name ?? "Nanas seller",
            "seller",
          );
          const sellerServices = Array.isArray(seller.services)
            ? seller.services.flatMap((entry) => {
                if (!entry || typeof entry !== "object" || Array.isArray(entry))
                  return [];
                const service = entry as Record<string, unknown>;
                if (
                  typeof service.name !== "string" ||
                  typeof service.service_id !== "string"
                )
                  return [];
                return [
                  {
                    id: service.service_id,
                    name: service.name,
                    rate: Number(service.rate_minor ?? 0) / 100,
                    rateMax:
                      service.rate_max_minor == null
                        ? undefined
                        : Number(service.rate_max_minor) / 100,
                    bio:
                      typeof service.bio === "string" ? service.bio : undefined,
                    yearsExperience: Number(service.years_experience ?? 0),
                    capabilities: Array.isArray(service.capabilities)
                      ? service.capabilities.map(String)
                      : [],
                    additionalHelp: Array.isArray(service.additional_help)
                      ? service.additional_help.map(String)
                      : [],
                  },
                ];
              })
            : [];
          const connectedSeller = connectedUsers.get(seller.user_id);
          if (connectedSeller)
            connectedUsers.set(seller.user_id, {
              ...connectedSeller,
              avatarUrl: seller.avatar_path
                ? supabase.storage
                    .from("public-profile-media")
                    .getPublicUrl(seller.avatar_path).data.publicUrl
                : undefined,
              sellerDetails: {
                headline: seller.headline ?? undefined,
                locality: seller.locality ?? undefined,
                island: seller.island ?? undefined,
                rating: Number(seller.rating_average ?? 0),
                reviewCount: Number(seller.rating_count ?? 0),
                completedBookings: Number(seller.completed_bookings ?? 0),
                responseRate: Number(seller.response_rate ?? 0),
                badges: Array.isArray(seller.badges)
                  ? seller.badges.flatMap((entry) =>
                      entry &&
                      typeof entry === "object" &&
                      !Array.isArray(entry) &&
                      typeof (entry as Record<string, unknown>).name ===
                        "string"
                        ? [String((entry as Record<string, unknown>).name)]
                        : [],
                    )
                  : [],
                languages: Array.isArray(seller.languages)
                  ? seller.languages.map(String)
                  : [],
                vaccinations: Array.isArray(seller.vaccinations)
                  ? seller.vaccinations.map(String)
                  : [],
                additionalDetails: Array.isArray(seller.additional_details)
                  ? seller.additional_details.map(String)
                  : [],
                availability: Array.isArray(seller.availability)
                  ? seller.availability.flatMap((entry) =>
                      entry &&
                      typeof entry === "object" &&
                      !Array.isArray(entry)
                        ? [
                            {
                              weekday: Number(
                                (entry as Record<string, unknown>).weekday ?? 0,
                              ),
                              start: String(
                                (entry as Record<string, unknown>).start ?? "",
                              ),
                              end: String(
                                (entry as Record<string, unknown>).end ?? "",
                              ),
                              timezone:
                                typeof (entry as Record<string, unknown>)
                                  .timezone === "string"
                                  ? String(
                                      (entry as Record<string, unknown>)
                                        .timezone,
                                    )
                                  : undefined,
                            },
                          ]
                        : [],
                    )
                  : [],
                availabilityUpdatedAt:
                  typeof seller.availability_updated_at === "string"
                    ? seller.availability_updated_at
                    : undefined,
                credentials: Array.isArray(seller.credentials)
                  ? seller.credentials.flatMap((entry) =>
                      entry &&
                      typeof entry === "object" &&
                      !Array.isArray(entry)
                        ? [
                            {
                              type: String(
                                (entry as Record<string, unknown>).type ??
                                  "Credential",
                              ),
                              issuingBody:
                                typeof (entry as Record<string, unknown>)
                                  .issuing_body === "string"
                                  ? String(
                                      (entry as Record<string, unknown>)
                                        .issuing_body,
                                    )
                                  : undefined,
                              verifiedAt:
                                typeof (entry as Record<string, unknown>)
                                  .verified_at === "string"
                                  ? String(
                                      (entry as Record<string, unknown>)
                                        .verified_at,
                                    )
                                  : undefined,
                              expiryDate:
                                typeof (entry as Record<string, unknown>)
                                  .expiry_date === "string"
                                  ? String(
                                      (entry as Record<string, unknown>)
                                        .expiry_date,
                                    )
                                  : undefined,
                            },
                          ]
                        : [],
                    )
                  : [],
                safetyChecks: Array.isArray(seller.safety_checks)
                  ? seller.safety_checks.flatMap((entry) =>
                      entry &&
                      typeof entry === "object" &&
                      !Array.isArray(entry)
                        ? [
                            {
                              type: String(
                                (entry as Record<string, unknown>).type ??
                                  "background_check",
                              ),
                              status: String(
                                (entry as Record<string, unknown>).status ??
                                  "not_on_file",
                              ),
                              completedAt:
                                typeof (entry as Record<string, unknown>)
                                  .completed_at === "string"
                                  ? String(
                                      (entry as Record<string, unknown>)
                                        .completed_at,
                                    )
                                  : undefined,
                              expiresAt:
                                typeof (entry as Record<string, unknown>)
                                  .expires_at === "string"
                                  ? String(
                                      (entry as Record<string, unknown>)
                                        .expires_at,
                                    )
                                  : undefined,
                              summary:
                                typeof (entry as Record<string, unknown>)
                                  .summary === "string"
                                  ? String(
                                      (entry as Record<string, unknown>)
                                        .summary,
                                    )
                                  : undefined,
                            },
                          ]
                        : [],
                    )
                  : [],
                services: sellerServices,
              },
            });
        }
        for (const adminUser of adminUsers ?? [])
          addConnectedUser(adminUser.id, adminUser.name, adminUser.role);
        for (const request of remoteRequests)
          if (!connectedUsers.has(request.buyer_id))
            addConnectedUser(request.buyer_id, "Nanas buyer", "buyer");
        for (const quote of remoteQuotes) {
          if (!connectedUsers.has(quote.buyer_id))
            addConnectedUser(quote.buyer_id, "Nanas buyer", "buyer");
          if (!connectedUsers.has(quote.seller_id))
            addConnectedUser(quote.seller_id, "Nanas seller", "seller");
        }
        for (const booking of remoteBookings) {
          if (!connectedUsers.has(booking.buyer_id))
            addConnectedUser(booking.buyer_id, "Nanas buyer", "buyer");
          if (!connectedUsers.has(booking.seller_id))
            addConnectedUser(booking.seller_id, "Nanas seller", "seller");
        }
        const userName = (id: string) =>
          connectedUsers.get(id)?.name ?? "Nanas member";
        const acceptedQuoteIds = new Set(
          remoteBookings
            .map((item) => item.quote_id)
            .filter((id): id is string => Boolean(id)),
        );

        const quotesByRequest = new Map<string, DemoQuote[]>();
        for (const quote of remoteQuotes) {
          if (!quote.request_id) continue;
          const snapshot =
            quote.policy_snapshot &&
            typeof quote.policy_snapshot === "object" &&
            !Array.isArray(quote.policy_snapshot)
              ? (quote.policy_snapshot as Record<string, unknown>)
              : {};
          const durationHours = Math.max(
            1,
            (new Date(quote.ends_at).getTime() -
              new Date(quote.starts_at).getTime()) /
              3600_000,
          );
          const requestWasBooked = remoteBookings.some(
            (booking) => booking.request_id === quote.request_id,
          );
          const hydratedQuote: DemoQuote = {
            id: quote.id,
            requestId: quote.request_id,
            sellerId: quote.seller_id,
            sellerName: userName(quote.seller_id),
            rate:
              Number(
                snapshot.rate_minor ??
                  Math.round(Number(quote.base_minor) / durationHours),
              ) / 100,
            travel: Number(quote.travel_minor) / 100,
            fee: Number(quote.platform_fee_minor) / 100,
            total: Number(quote.total_minor) / 100,
            message: String(snapshot.seller_message ?? "Verified seller quote"),
            status: acceptedQuoteIds.has(quote.id)
              ? "accepted"
              : requestWasBooked
                ? "declined"
                : "pending",
          };
          quotesByRequest.set(quote.request_id, [
            ...(quotesByRequest.get(quote.request_id) ?? []),
            hydratedQuote,
          ]);
        }

        const hydratedRequests: DemoRequest[] = remoteRequests.map(
          (request) => ({
            id: request.id,
            buyerId: request.buyer_id,
            buyerName: userName(request.buyer_id),
            service:
              serviceNames.get(request.service_id) ?? "Healthcare service",
            area: areaNames.get(request.service_area_id) ?? "The Bahamas",
            mode: request.mode,
            startsAt: request.desired_start,
            endsAt: request.desired_end,
            summary: request.care_summary,
            budget: Number(request.budget_minor ?? 0) / 100,
            status:
              request.status === "confirmed"
                ? "confirmed"
                : request.status === "expired" || request.status === "cancelled"
                  ? "expired"
                  : request.status === "offered"
                    ? "offered"
                    : "requested",
            quotes: quotesByRequest.get(request.id) ?? [],
          }),
        );

        const conversationByBooking = new Map(
          remoteConversations
            .filter((item) => item.booking_id)
            .map((item) => [item.booking_id as string, item.id]),
        );
        const reviewAuthors = new Map<string, string[]>();
        for (const review of remoteReviews)
          reviewAuthors.set(review.booking_id, [
            ...(reviewAuthors.get(review.booking_id) ?? []),
            review.author_id,
          ]);
        const hydratedBookings: DemoBooking[] = remoteBookings.map(
          (booking) => ({
            id: booking.id,
            reference: booking.reference,
            requestId: booking.request_id ?? booking.id,
            buyerId: booking.buyer_id,
            buyerName: userName(booking.buyer_id),
            sellerId: booking.seller_id,
            sellerName: userName(booking.seller_id),
            service:
              serviceNames.get(booking.service_id) ?? "Healthcare service",
            startsAt: booking.scheduled_start,
            endsAt: booking.scheduled_end,
            status:
              booking.status === "resolved"
                ? "completed"
                : booking.status === "confirmed" ||
                    booking.status === "in_progress" ||
                    booking.status === "completion_pending" ||
                    booking.status === "completed" ||
                    booking.status === "cancelled" ||
                    booking.status === "disputed"
                  ? booking.status
                  : "confirmed",
            total: Number(booking.total_minor) / 100,
            sellerNet: Number(booking.seller_net_minor) / 100,
            conversationId: conversationByBooking.get(booking.id) ?? "",
            reviewedBy: reviewAuthors.get(booking.id) ?? [],
          }),
        );

        const hydratedMessages = (messagesResult.data ?? []).map((message) => ({
          id: message.id,
          conversationId: message.conversation_id,
          senderId: message.sender_id,
          senderName: userName(message.sender_id),
          body: message.body ?? "",
          at: message.created_at,
        }));
        const hydratedKyc = (verificationResult.data ?? []).map((item) => ({
          id: item.id,
          sellerId: item.seller_id,
          sellerName: userName(item.seller_id),
          type: item.verification_type,
          status:
            item.status === "approved" ||
            item.status === "rejected" ||
            item.status === "needs_information"
              ? item.status
              : ("pending" as const),
          fileName: "Private Supabase document",
          submittedAt: item.created_at,
        }));

        setState((prev) => ({
          ...prev,
          users: adminUsers ?? [...connectedUsers.values()],
          requests: hydratedRequests,
          bookings: hydratedBookings,
          messages: hydratedMessages,
          favorites: (favoritesResult.data ?? []).map((item) => item.seller_id),
          supportCases: (supportResult.data ?? []).map((item) => ({
            id: item.id,
            openedBy: item.requester_id,
            category: item.case_type,
            subject: item.subject,
            status:
              item.status === "resolved" || item.status === "closed"
                ? "resolved"
                : item.status === "awaiting_user"
                  ? "awaiting_user"
                  : "open",
            createdAt: item.created_at,
          })),
          safetyIncidents: (safetyResult.data ?? []).map((item) => ({
            id: item.id,
            bookingId: item.booking_id ?? undefined,
            reporterId: item.reporter_id,
            category: item.category,
            status:
              item.status === "resolved" || item.status === "closed"
                ? "resolved"
                : item.acknowledged_at
                  ? "acknowledged"
                  : "open",
            createdAt: item.created_at,
          })),
          privacyRequests: (privacyResult.data ?? []).map((item) => ({
            id: item.id,
            userId: item.user_id,
            type: item.request_type === "delete" ? "delete" : "export",
            status:
              item.status === "closed"
                ? "completed"
                : item.status === "open"
                  ? "open"
                  : "processing",
            createdAt: item.created_at,
          })),
          notifications: (notificationsResult.data ?? []).map((item) => ({
            id: item.id,
            userId: item.recipient_id,
            text: item.body ? `${item.title}: ${item.body}` : item.title,
            read: Boolean(item.read_at),
            at: item.created_at,
          })),
          kyc: detectedRole === "admin" ? prev.kyc : hydratedKyc,
        }));
        setMarketplaceLoaded(true);
        setSellerWorkspaceLoaded(true);
      }
      if (detectedRole !== routeRole)
        window.history.replaceState({}, "", `/app/${detectedRole}/overview`);
    })();
  }, [backendConnected, routeRole]);

  useEffect(() => {
    if (!backendConnected) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const upsertLiveMessage = (row: RealtimeMessageRow) => {
      if (row.deleted_at) return;
      setState((prev) => {
        if (prev.messages.some((message) => message.id === row.id)) return prev;
        const sender = prev.users.find((user) => user.id === row.sender_id);
        return {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: row.id,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              senderName: sender?.name ?? "Nanas member",
              body: row.body ?? "",
              at: row.created_at,
            },
          ].sort(
            (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
          ),
        };
      });
    };
    const channel = supabase
      .channel(`nanas-message-feed-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => upsertLiveMessage(payload.new as RealtimeMessageRow),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as RealtimeMessageRow;
          setState((prev) => ({
            ...prev,
            messages: row.deleted_at
              ? prev.messages.filter((message) => message.id !== row.id)
              : prev.messages.map((message) =>
                  message.id === row.id
                    ? {
                        ...message,
                        body: row.body ?? "",
                        at: row.created_at ?? message.at,
                      }
                    : message,
                ),
          }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [backendConnected, currentUserId]);

  const myRequests = state.requests.filter(
    (request) => role === "admin" || request.buyerId === currentUserId,
  );
  const openRequests = state.requests.filter((request) =>
    ["requested", "offered"].includes(request.status),
  );
  const sellerVisibleRequests = openRequests
    .filter((request) => {
      const haystack = [
        request.service,
        request.area,
        request.summary,
        request.buyerName,
        request.status,
        request.mode ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const query = sellerJobQuery.trim().toLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (sellerJobService === "all" ||
          request.service === sellerJobService ||
          request.service.toLowerCase().includes(sellerJobService.toLowerCase())) &&
        (sellerJobArea === "all" || request.area === sellerJobArea)
      );
    })
    .sort((left, right) => {
      if (sellerJobSort === "budget")
        return Number(right.budget) - Number(left.budget);
      if (sellerJobSort === "soonest")
        return (
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
        );
      if (sellerJobSort === "quotes")
        return left.quotes.length - right.quotes.length;
      return (
        new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()
      );
    });
  const myQuotes = state.requests
    .flatMap((request) =>
      request.quotes.map((quote) => ({ ...quote, request })),
    )
    .filter((quote) =>
      role === "buyer"
        ? quote.request.buyerId === currentUserId
        : role === "seller"
          ? quote.sellerId === currentUserId
          : true,
    );
  const myBookings = state.bookings.filter((booking) =>
    role === "buyer"
      ? booking.buyerId === currentUserId
      : role === "seller"
        ? booking.sellerId === currentUserId
        : true,
  );
  const unread = state.notifications.filter(
    (note) => note.userId === currentUserId && !note.read,
  ).length;
  const wallet = useMemo(
    () =>
      role === "buyer"
        ? -state.bookings
            .filter((b) => b.buyerId === currentUserId)
            .reduce(
              (sum, b) =>
                sum + (b.status === "cancelled" ? (b.cancellationFee ?? 0) : b.total),
              0,
            )
        : state.bookings
            .filter(
              (b) => b.sellerId === currentUserId && b.status === "completed",
            )
            .reduce((sum, b) => sum + b.sellerNet, 0) -
          state.payouts
            .filter((payout) => payout.sellerId === currentUserId)
            .reduce((sum, payout) => sum + payout.amount, 0),
    [state.bookings, state.payouts, role, currentUserId],
  );
  const adminOverview = backendConnected
    ? adminOps.overview
    : {
        activeUsers: state.users.filter((user) => user.status === "active").length,
        sellersUnderReview: state.kyc.filter((item) => item.status !== "approved").length,
        openRequests: state.requests.filter((item) => item.status === "requested" || item.status === "offered").length,
        activeBookings: state.bookings.filter((item) => ["confirmed", "in_progress", "completion_pending", "disputed"].includes(item.status)).length,
        openDisputes: state.disputes.filter((item) => item.status === "open").length,
        moderationQueue: state.moderationReports.filter((item) => item.status !== "resolved").length,
        simulatedVolume: state.bookings.reduce(
          (sum, item) =>
            sum +
            (item.status === "cancelled"
              ? (item.cancellationFee ?? 0)
              : item.total),
          0,
        ),
      };
  const cancellationPreview = (booking: DemoBooking) => {
    const hours =
      (new Date(booking.startsAt).getTime() - Date.now()) / 3600_000;
    const feePercent =
      role === "buyer" ? (hours >= 24 ? 0 : hours >= 6 ? 10 : 25) : 0;
    const fee = Math.round((booking.total * feePercent) / 100);
    return { fee, refund: booking.total - fee, feePercent };
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };
  const recordAdminAudit = (
    action: string,
    targetType: string,
    targetId: string | undefined,
    reason: string,
  ) => {
    if (backendConnected) return;
    const now = new Date().toISOString();
    setAdminOps((previous) => ({
      ...previous,
      audits: [
        {
          id: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          action,
          targetType,
          targetId,
          reason,
          traceId: `demo-${Date.now()}`,
          createdAt: now,
        },
        ...previous.audits,
      ],
    }));
  };
  const recordSensitiveAccess = (
    resourceType: string,
    purpose: string,
    fields: string[],
  ) => {
    if (backendConnected) return;
    setAdminOps((previous) => ({
      ...previous,
      accessLogs: [
        {
          id: `access-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          resourceType,
          purpose,
          fields,
          createdAt: new Date().toISOString(),
        },
        ...previous.accessLogs,
      ],
    }));
  };
  const changeRole = (next: DemoRole) => {
    if (backendConnected && next !== role)
      return notify(
        "Sign out and use the matching connected test account to change roles.",
      );
    setRole(next);
    setSection("overview");
    setSelected(null);
    setModal(null);
    setSidebarOpen(false);
    const query = demoMode ? "?demo=1" : "";
    window.history.pushState({}, "", `/app/${next}/overview${query}`);
  };
  const chooseSection = (next: string) => {
    setSection(next);
    setSelected(null);
    setModal(null);
    setSidebarOpen(false);
    document
      .querySelectorAll(".app-mobile-menu[open], .seller-profile-menu[open]")
      .forEach((item) => item.removeAttribute("open"));
    const nextPath = `/app/${role}/${next}`;
    const query = demoMode ? "?demo=1" : "";
    if (
      window.location.pathname !== nextPath ||
      (demoMode && new URLSearchParams(window.location.search).get("demo") !== "1")
    ) {
      window.history.pushState({}, "", `${nextPath}${query}`);
    }
  };
  const portalHref = (targetRole: DemoRole, targetSection: string) =>
    `/app/${targetRole}/${targetSection}${demoMode ? "?demo=1" : ""}`;
  const syncCommand = async (
    action: string,
    payload: Record<string, unknown>,
    needsKey = false,
  ) => {
    if (!backendConnected) return null;
    return marketplaceCommand(
      action,
      payload,
      needsKey ? idempotencyKey(action) : undefined,
    );
  };

  function openRequestWizard(serviceIdValue?: string, initialStep = 0) {
    const freeEligible = !state.requests.some(
      (request) => request.buyerId === currentUserId,
    );
    const defaultPlan =
      adminOps.postingPlans.find(
        (plan) => plan.active && (freeEligible ? plan.fee === 0 : plan.fee > 0),
      ) ?? defaultPostingPlans[freeEligible ? 0 : 1];
    const firstHousehold = householdMembers.find((member) => member.active);
    setRequestStep(initialStep);
    const selectedIntake = careIntakeCategories
      .flatMap((category) =>
        category.subcategories.map((subcategory) => ({
          category,
          subcategory,
        })),
      )
      .find((item) => item.subcategory.serviceId === serviceIdValue);
    const intakeCategory = selectedIntake?.category ?? careIntakeCategories[0];
    const intakeSubcategory =
      selectedIntake?.subcategory ?? intakeCategory.subcategories[0];
    const initialRecipientLabel =
      intakeCategory.code === "child_care"
        ? "Child 1"
        : intakeCategory.code === "tutoring"
          ? "Student"
          : (firstHousehold?.name ?? "A family member");
    const initialRelationship: RequestRecipient["relationship"] =
      intakeCategory.code === "child_care" ? "child" : "family_member";
    setRequestDraft({
      categoryCode: intakeCategory.code,
      subcategoryCode: intakeSubcategory.code,
      serviceId: intakeSubcategory.serviceId,
      recipientId: firstHousehold?.id ?? "",
      recipientLabel: initialRecipientLabel,
      recipients: [
        {
          id: `recipient-${Date.now()}`,
          label: initialRecipientLabel,
          relationship: initialRelationship,
          birthMonth: firstHousehold?.dateOfBirth?.slice(5, 7) ?? "",
          birthYear: firstHousehold?.dateOfBirth?.slice(0, 4) ?? "",
          expecting: false,
        },
      ],
      needs: [],
      qualities: [],
      recipientGender: "",
      recipientAgeBand: "",
      pets: [
        {
          id: `pet-${Date.now()}`,
          kind: "dog",
          name: "",
          breed: "",
          mixedBreed: false,
          ageGroup: "adult",
          size: "16_40",
          gender: "female",
        },
      ],
      homeBedrooms: 2,
      homeBathrooms: 1,
      homeHasPets: false,
      homeSquareFeet: "1001_1500",
      cleaningFrequency: "every_week",
      extras: [],
      distanceLearning: "",
      areaId: liveAreas[0]?.id ?? serviceAreaId("Nassau & Paradise Island"),
      islandId: liveIslands[0]?.id ?? "",
      addressLine1: "",
      addressLine2: "",
      locality: "Nassau",
      postalCode: "",
      accessNotes: "",
      mode: "scheduled",
      scheduleKind: "recurring",
      startsAt: bahamasInputValue(Date.now() + 86400_000),
      endDate: "",
      flexibleStart: false,
      weekdays: [1, 3, 5],
      timePeriods: ["morning"],
      useSpecificTimes: false,
      startTime: "09:00",
      endTime: "12:00",
      scheduleVaries: false,
      hours: 3,
      summary: "",
      budget: 180,
      minRate: 20,
      maxRate: 45,
      postingPlanCode: defaultPlan.code,
    });
    setModal("request");
  }

  function toggleRequestNeed(need: string) {
    setRequestDraft((draft) => ({
      ...draft,
      needs: draft.needs.includes(need)
        ? draft.needs.filter((item) => item !== need)
        : [...draft.needs, need],
    }));
  }

  function toggleRequestQuality(quality: string) {
    setRequestDraft((draft) => ({
      ...draft,
      qualities: draft.qualities.includes(quality)
        ? draft.qualities.filter((item) => item !== quality)
        : [...draft.qualities, quality],
    }));
  }

  function toggleRequestExtra(extra: string) {
    setRequestDraft((draft) => ({
      ...draft,
      extras: draft.extras.includes(extra)
        ? draft.extras.filter((item) => item !== extra)
        : [...draft.extras, extra],
    }));
  }

  function updateRequestPet(id: string, changes: Partial<RequestPet>) {
    setRequestDraft((draft) => ({
      ...draft,
      pets: draft.pets.map((pet) =>
        pet.id === id ? { ...pet, ...changes } : pet,
      ),
    }));
  }

  function addRequestPet() {
    setRequestDraft((draft) =>
      draft.pets.length >= 6
        ? draft
        : {
            ...draft,
            pets: [
              ...draft.pets,
              {
                id: `pet-${Date.now()}`,
                kind: "dog",
                name: "",
                breed: "",
                mixedBreed: false,
                ageGroup: "adult",
                size: "16_40",
                gender: "female",
              },
            ],
          },
    );
  }

  function chooseRecipientRelationship(
    relationship: RequestRecipient["relationship"],
  ) {
    const label =
      relationship === "self"
        ? "Myself"
        : relationship === "child"
          ? "Child 1"
          : "A family member";
    setRequestDraft((draft) => ({
      ...draft,
      recipientId: "",
      recipientLabel: label,
      recipients: [
        {
          id: `recipient-${Date.now()}`,
          label,
          relationship,
          birthMonth: "",
          birthYear: "",
          expecting: false,
        },
      ],
    }));
  }

  function updateRequestRecipient(
    id: string,
    changes: Partial<RequestRecipient>,
  ) {
    setRequestDraft((draft) => ({
      ...draft,
      recipients: draft.recipients.map((recipient) =>
        recipient.id === id ? { ...recipient, ...changes } : recipient,
      ),
    }));
  }

  function addRequestChild() {
    setRequestDraft((draft) =>
      draft.recipients.length >= 6
        ? draft
        : {
            ...draft,
            recipientLabel: `${draft.recipients.length + 1} children`,
            recipients: [
              ...draft.recipients,
              {
                id: `recipient-${Date.now()}`,
                label: `Child ${draft.recipients.length + 1}`,
                relationship: "child",
                birthMonth: "",
                birthYear: "",
                expecting: false,
              },
            ],
          },
    );
  }

  function toggleRequestWeekday(day: number) {
    setRequestDraft((draft) => ({
      ...draft,
      weekdays: draft.weekdays.includes(day)
        ? draft.weekdays.filter((value) => value !== day)
        : [...draft.weekdays, day].sort(),
    }));
  }

  function toggleRequestTimePeriod(period: string) {
    setRequestDraft((draft) => ({
      ...draft,
      timePeriods: draft.timePeriods.includes(period)
        ? draft.timePeriods.filter((value) => value !== period)
        : [...draft.timePeriods, period],
    }));
  }

  function advanceRequestWizard() {
    if (requestStep === 0 && !requestDraft.categoryCode)
      return notify("Choose a main service category.");
    if (requestStep === 1 && !requestDraft.subcategoryCode)
      return notify("Choose the service you need.");
    if (
      requestStep === 2 &&
      requestDraft.categoryCode === "child_care" &&
      requestDraft.recipients.some(
        (recipient) => !recipient.birthMonth || !recipient.birthYear,
      )
    )
      return notify("Add the birth month and year for every child.");
    if (
      requestStep === 2 &&
      ["senior_care", "adult_care"].includes(requestDraft.categoryCode) &&
      (!requestDraft.recipientLabel.trim() ||
        !requestDraft.recipientGender ||
        !requestDraft.recipientAgeBand)
    )
      return notify("Choose the relationship, gender and age range.");
    if (
      requestStep === 2 &&
      requestDraft.categoryCode === "pet_care" &&
      requestDraft.pets.some((pet) => !pet.name.trim() || !pet.breed.trim())
    )
      return notify("Add a name and breed for every pet.");
    if (requestStep === 3 && requestDraft.needs.length === 0)
      return notify("Choose at least one service or responsibility.");
    if (
      requestStep === 4 &&
      (!requestDraft.areaId ||
        !requestDraft.islandId ||
        !requestDraft.addressLine1.trim() ||
        !requestDraft.locality.trim() ||
        !requestDraft.postalCode.trim())
    )
      return notify("Add the complete care address and postal or ZIP code.");
    if (
      requestStep === 5 &&
      (!requestDraft.startsAt ||
        new Date(bahamasLocalToIso(requestDraft.startsAt)).getTime() <=
          Date.now())
    )
      return notify("Choose a future start date.");
    if (
      requestStep === 6 &&
      requestDraft.scheduleKind === "recurring" &&
      requestDraft.weekdays.length === 0
    )
      return notify("Choose at least one day.");
    if (
      requestStep === 6 &&
      !requestDraft.useSpecificTimes &&
      requestDraft.timePeriods.length === 0
    )
      return notify("Choose at least one time of day.");
    if (
      requestStep === 6 &&
      requestDraft.useSpecificTimes &&
      (!requestDraft.startTime ||
        !requestDraft.endTime ||
        requestDraft.endTime <= requestDraft.startTime)
    )
      return notify("Choose a valid start and end time.");
    if (requestStep === 8 && requestDraft.summary.trim().length < 10)
      return notify("Add a short summary of at least 10 characters.");
    if (
      requestStep === 9 &&
      (requestDraft.minRate < 1 || requestDraft.maxRate < requestDraft.minRate)
    )
      return notify("Add a valid minimum and maximum hourly rate.");
    if (requestStep === 10 && !requestDraft.postingPlanCode)
      return notify("Choose how you want to publish this request.");
    setRequestStep((step) => Math.min(11, step + 1));
  }

  async function createRequest() {
    setBusy(true);
    const startsAt = bahamasLocalToIso(
      `${requestDraft.startsAt.slice(0, 10)}T${requestDraft.startTime || requestDraft.startsAt.slice(11, 16) || "09:00"}`,
    );
    const calculatedHours = requestDraft.useSpecificTimes
      ? Math.max(
          1,
          (Number(requestDraft.endTime.slice(0, 2)) * 60 +
            Number(requestDraft.endTime.slice(3, 5)) -
            (Number(requestDraft.startTime.slice(0, 2)) * 60 +
              Number(requestDraft.startTime.slice(3, 5)))) /
            60,
        )
      : requestDraft.hours;
    const endsAt = new Date(
      new Date(startsAt).getTime() + calculatedHours * 3600_000,
    ).toISOString();
    const intakeCategory =
      careIntakeCategories.find(
        (item) => item.code === requestDraft.categoryCode,
      ) ?? careIntakeCategories[0];
    const intakeSubcategory =
      intakeCategory.subcategories.find(
        (item) => item.code === requestDraft.subcategoryCode,
      ) ?? intakeCategory.subcategories[0];
    const service = intakeSubcategory.name;
    const area =
      liveAreas.find((item) => item.id === requestDraft.areaId)?.name ??
      "The Bahamas";
    const recipientContext =
      requestDraft.categoryCode === "pet_care"
        ? `${requestDraft.pets.length} pet${requestDraft.pets.length === 1 ? "" : "s"}`
        : requestDraft.categoryCode === "housekeeping"
          ? `${requestDraft.homeBedrooms}-bedroom home`
          : requestDraft.recipientLabel === "Myself"
            ? "Care for me"
            : `Support for ${requestDraft.recipientLabel}`;
    const safeSummary =
      `${recipientContext}. ${requestDraft.needs.join(", ")}. ${requestDraft.summary.trim()}`.slice(
        0,
        1200,
      );
    const chosenPlan =
      adminOps.postingPlans.find(
        (plan) => plan.code === requestDraft.postingPlanCode,
      ) ?? defaultPostingPlans[0];
    let request: DemoRequest = {
      id: `req-${Date.now()}`,
      buyerId: currentUserId,
      buyerName: currentUser.name,
      service,
      area,
      mode: requestDraft.mode,
      startsAt,
      endsAt,
      summary: safeSummary,
      budget: requestDraft.budget,
      status: "requested",
      quotes: [],
    };
    try {
      const result = (await syncCommand("create_care_request", {
        service_id: requestDraft.serviceId,
        service_area_id: requestDraft.areaId,
        desired_start: startsAt,
        desired_end: endsAt,
        mode: requestDraft.mode,
        care_summary: request.summary,
        budget_minor: request.budget * 100,
        rate_min_minor: requestDraft.minRate * 100,
        rate_max_minor: requestDraft.maxRate * 100,
        household_member_id: requestDraft.recipientId || null,
        recipients: requestDraft.recipients.map((recipient) => ({
          label: recipient.label,
          relationship: recipient.relationship,
          birth_month: recipient.birthMonth,
          birth_year: recipient.birthYear,
          expecting: recipient.expecting,
        })),
        address: {
          label: "Care location",
          line1: requestDraft.addressLine1,
          line2: requestDraft.addressLine2,
          locality: requestDraft.locality,
          island_id: requestDraft.islandId,
          postal_code: requestDraft.postalCode,
          access_notes: requestDraft.accessNotes,
        },
        schedule: {
          kind: requestDraft.scheduleKind,
          start_date: requestDraft.startsAt.slice(0, 10),
          end_date: requestDraft.endDate,
          flexible_start: requestDraft.flexibleStart,
          weekdays: requestDraft.weekdays,
          time_periods: requestDraft.useSpecificTimes
            ? []
            : requestDraft.timePeriods,
          specific_start: requestDraft.useSpecificTimes
            ? requestDraft.startTime
            : null,
          specific_end: requestDraft.useSpecificTimes
            ? requestDraft.endTime
            : null,
          schedule_may_vary: requestDraft.scheduleVaries,
        },
        category_code: requestDraft.categoryCode,
        subcategory_code: requestDraft.subcategoryCode,
        intake_answers: {
          recipients: requestDraft.recipients,
          recipient_gender: requestDraft.recipientGender,
          recipient_age_band: requestDraft.recipientAgeBand,
          pets: requestDraft.pets,
          home: {
            bedrooms: requestDraft.homeBedrooms,
            bathrooms: requestDraft.homeBathrooms,
            has_pets: requestDraft.homeHasPets,
            square_feet: requestDraft.homeSquareFeet,
            frequency: requestDraft.cleaningFrequency,
          },
          responsibilities: requestDraft.needs,
          extras: requestDraft.extras,
          caregiver_qualities: requestDraft.qualities,
          distance_learning: requestDraft.distanceLearning,
        },
        intake_public_summary: {
          category: intakeCategory.name,
          service: intakeSubcategory.name,
          responsibilities: requestDraft.needs,
          caregiver_qualities: requestDraft.qualities,
          extras: requestDraft.extras,
        },
        care_requirements: {
          category_code: requestDraft.categoryCode,
          subcategory_code: requestDraft.subcategoryCode,
          responsibilities: requestDraft.needs,
          caregiver_qualities: requestDraft.qualities,
        },
        access_notes: requestDraft.accessNotes,
        posting_plan_code: chosenPlan.code,
        simulated_payment_confirmed: chosenPlan.fee > 0,
      })) as { request_id?: string } | null;
      if (result?.request_id) request = { ...request, id: result.request_id };
      setState((prev) => ({
        ...prev,
        requests: [request, ...prev.requests],
        notifications: [
          {
            id: `note-${Date.now()}`,
            userId: "seller-alicia",
            text: `New ${request.service} request near ${request.area}.`,
            read: false,
            at: new Date().toISOString(),
          },
          ...prev.notifications,
        ],
      }));
      setModal(null);
      setSection("care-requests");
      window.history.pushState({}, "", "/app/buyer/care-requests");
      notify(
        `${chosenPlan.name} posted for ${chosenPlan.durationDays} days. Eligible sellers can now quote.`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const request = state.requests.find((item) => item.id === selected)!;
    const form = new FormData(event.currentTarget);
    const rate = Number(form.get("rate"));
    const travel = Number(form.get("travel"));
    const hours =
      (new Date(request.endsAt).getTime() -
        new Date(request.startsAt).getTime()) /
      3600_000;
    const fee = Math.ceil((rate * hours + travel) * 0.08);
    const total = rate * hours + travel + fee;
    let quote: DemoQuote = {
      id: `quote-${Date.now()}`,
      requestId: request.id,
      sellerId: currentUserId,
      sellerName: currentUser.name,
      rate,
      travel,
      fee,
      total,
      message: String(form.get("message")),
      status: "pending",
    };
    try {
      const result = (await syncCommand("submit_quote", {
        request_id: request.id,
        rate_minor: rate * 100,
        travel_minor: travel * 100,
        message: quote.message,
      })) as { quote_id?: string; total_minor?: number } | null;
      if (result?.quote_id)
        quote = {
          ...quote,
          id: result.quote_id,
          total:
            typeof result.total_minor === "number"
              ? result.total_minor / 100
              : quote.total,
        };
      setState((prev) => ({
        ...prev,
        requests: prev.requests.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: "offered",
                quotes: [
                  ...item.quotes.filter((q) => q.sellerId !== currentUserId),
                  quote,
                ],
              }
            : item,
        ),
        notifications: [
          {
            id: `note-${Date.now()}`,
            userId: request.buyerId,
            text: `${currentUser.name} sent a quote for ${request.service}.`,
            read: false,
            at: new Date().toISOString(),
          },
          ...prev.notifications,
        ],
      }));
      setModal(null);
      setSection("quotes");
      notify("Quote sent to the buyer.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Quote failed");
    } finally {
      setBusy(false);
    }
  }

  async function acceptQuote(quote: DemoQuote, request: DemoRequest) {
    setBusy(true);
    try {
      const result = (await syncCommand(
        "accept_quote",
        { quote_id: quote.id },
        true,
      )) as { booking_id?: string; reference?: string } | null;
      const bookingId = result?.booking_id ?? `book-${Date.now()}`;
      let conversationId = `conv-${Date.now()}`;
      if (backendConnected && result?.booking_id) {
        const { data } = await getSupabase()!
          .from("conversations")
          .select("id")
          .eq("booking_id", result.booking_id)
          .single();
        if (data?.id) conversationId = data.id;
      }
      const booking: DemoBooking = {
        id: bookingId,
        reference:
          result?.reference ??
          `NAN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        requestId: request.id,
        buyerId: request.buyerId,
        buyerName: request.buyerName,
        sellerId: quote.sellerId,
        sellerName: quote.sellerName,
        service: request.service,
        startsAt: request.startsAt,
        endsAt: request.endsAt,
        status: "confirmed",
        total: quote.total,
        sellerNet: quote.total - quote.fee,
        conversationId,
        reviewedBy: [],
      };
      setState((prev) => ({
        ...prev,
        bookings: [booking, ...prev.bookings],
        requests: prev.requests.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: "confirmed",
                quotes: item.quotes.map((q) => ({
                  ...q,
                  status: q.id === quote.id ? "accepted" : "declined",
                })),
              }
            : item,
        ),
        notifications: [
          {
            id: `note-${Date.now()}`,
            userId: quote.sellerId,
            text: `${request.buyerName} accepted your quote. Booking ${booking.reference} is confirmed.`,
            read: false,
            at: new Date().toISOString(),
          },
          ...prev.notifications,
        ],
      }));
      notify(`Payment simulated and ${booking.reference} confirmed.`);
      setSection("bookings");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Payment simulation failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function transition(
    booking: DemoBooking,
    target: DemoBooking["status"],
  ) {
    setBusy(true);
    try {
      await syncCommand(
        "transition_booking",
        { booking_id: booking.id, target, reason: "portal_action" },
        true,
      );
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((item) =>
          item.id === booking.id ? { ...item, status: target } : item,
        ),
        notifications: [
          {
            id: `note-${Date.now()}`,
            userId: role === "seller" ? booking.buyerId : booking.sellerId,
            text: `${booking.reference} is now ${target.replaceAll("_", " ")}.`,
            read: false,
            at: new Date().toISOString(),
          },
          ...prev.notifications,
        ],
      }));
      notify(`Booking updated to ${target.replaceAll("_", " ")}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Booking update failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (isBuyerConversationPaywalled(selected)) {
      notify("Upgrade to view and continue this seller conversation.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body")).trim();
    if (!body) return;
    try {
      await syncCommand("send_message", {
        conversation_id: selected,
        body,
        sender_nonce: crypto.randomUUID(),
      });
      if (!backendConnected)
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `msg-${Date.now()}`,
              conversationId: selected,
              senderId: currentUserId,
              senderName: currentUser.name,
              body,
              at: new Date().toISOString(),
            },
          ],
          notifications: (() => {
            const booking = prev.bookings.find(
              (item) => item.conversationId === selected,
            );
            const recipientId =
              booking?.buyerId === currentUserId
                ? booking.sellerId
                : booking?.buyerId;
            return recipientId
              ? [
                  {
                    id: `note-message-${Date.now()}`,
                    userId: recipientId,
                    text: `${currentUser.name} sent a secure message about ${booking?.reference ?? "your booking"}.`,
                    read: false,
                    at: new Date().toISOString(),
                  },
                  ...prev.notifications,
                ]
              : prev.notifications;
          })(),
        }));
      setModal(null);
      notify("Secure message sent.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Message failed");
    }
  }

  function isBuyerConversationPaywalled(conversationId: string) {
    if (role !== "buyer" || unlockedConversations.includes(conversationId))
      return false;
    const booking = state.bookings.find(
      (item) => item.conversationId === conversationId,
    );
    if (!booking || booking.buyerId !== currentUserId) return false;
    return state.messages.some(
      (message) =>
        message.conversationId === conversationId &&
        message.senderId === booking.sellerId,
    );
  }

  function unlockConversation(conversationId: string) {
    setUnlockedConversations((prev) =>
      prev.includes(conversationId) ? prev : [...prev, conversationId],
    );
    notify("Payment simulated. Conversation access is now unlocked.");
  }

  function openMessageUpgrade(conversationId: string) {
    setSelected(conversationId);
    setModal("message-upgrade");
  }

  function simulateMessageUpgrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    unlockConversation(selected);
    setModal(null);
  }

  function simulatePayout() {
    if (wallet <= 0) return notify("No completed-care balance is available to pay out.");
    setState((previous) => ({
      ...previous,
      payouts: [
        {
          id: `payout-${Date.now()}`,
          sellerId: currentUserId,
          amount: wallet,
          status: "scheduled",
          createdAt: new Date().toISOString(),
        },
        ...previous.payouts,
      ],
    }));
    notify(`Simulated payout of ${money(wallet)} scheduled.`);
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await syncCommand("submit_review", {
        booking_id: selected,
        rating: Number(form.get("rating")),
        body: String(form.get("body")),
      });
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === selected
            ? { ...b, reviewedBy: [...b.reviewedBy, currentUserId] }
            : b,
        ),
      }));
      setModal(null);
      notify("Verified booking review submitted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Review failed");
    }
  }

  async function adminUserAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const command = String(form.get("command")) as
      "suspend" | "restrict" | "ban" | "restore";
    const reason = String(form.get("reason"));
    try {
      if (backendConnected)
        await adminCommand("user_action", {
          user_id: selected,
          command,
          reason,
        });
      const status =
        command === "ban"
          ? "closed"
          : command === "restore"
            ? "active"
            : command === "restrict"
              ? "restricted"
              : "suspended";
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === selected ? { ...u, status } : u,
        ),
      }));
      recordAdminAudit(`user.${command}`, "user", selected, reason);
      setModal(null);
      notify(`User ${command} action recorded in the audit log.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Admin action failed");
    }
  }

  async function reviewKyc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const decision = String(form.get("decision")) as
      | "approved"
      | "rejected"
      | "needs_information";
    const reason = String(form.get("reason")).trim();
    try {
      if (backendConnected)
        await adminCommand("kyc_review", {
          case_id: selected,
          decision,
          note: reason,
        });
      setState((prev) => ({
        ...prev,
        kyc: prev.kyc.map((item) =>
          item.id === selected ? { ...item, status: decision } : item,
        ),
      }));
      recordAdminAudit("kyc.review", "verification_case", selected, reason);
      recordSensitiveAccess(`verification_case:${selected}`, `kyc-review · ${reason}`, ["fileName", "documentType", "submittedAt"]);
      setModal(null);
      notify(`KYC marked ${decision.replaceAll("_", " ")}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "KYC review failed");
    }
  }

  async function uploadKyc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file") as File;
    if (!file?.name) return notify("Choose a document first.");
    setBusy(true);
    try {
      const uploaded = backendConnected
        ? await issueUploadUrl("seller-documents", file)
        : null;
      const created = uploaded
        ? ((await syncCommand("submit_verification_document", {
            document_type: String(form.get("type")),
            storage_path: uploaded.path,
            original_name: file.name,
          })) as { case_id?: string } | null)
        : null;
      setState((prev) => ({
        ...prev,
        kyc: [
          {
            id: created?.case_id ?? `kyc-${Date.now()}`,
            sellerId: currentUserId,
            sellerName: currentUser.name,
            type: String(form.get("type")),
            status: "pending",
            fileName: file.name,
            submittedAt: new Date().toISOString(),
          },
          ...prev.kyc,
        ],
      }));
      setModal(null);
      notify("Document uploaded to the private KYC queue.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleFavorite(sellerId: string) {
    const favorite = !state.favorites.includes(sellerId);
    setState((prev) => ({
      ...prev,
      favorites: favorite
        ? [...prev.favorites, sellerId]
        : prev.favorites.filter((id) => id !== sellerId),
    }));
    void syncCommand("toggle_favorite", {
      seller_id: sellerId,
      favorite,
    }).catch(() => notify("Favorite saved locally; backend sync will retry."));
    notify(
      favorite
        ? "Seller added to favorites."
        : "Seller removed from favorites.",
    );
  }

  async function cancelBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const booking = state.bookings.find((item) => item.id === selected);
    if (!booking) return;
    const cancellation = cancellationPreview(booking);
    const reason = String(new FormData(event.currentTarget).get("reason"));
    setBusy(true);
    try {
      await syncCommand(
        "cancel_booking",
        { booking_id: booking.id, reason_code: reason },
        true,
      );
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((item) =>
          item.id === booking.id
            ? {
                ...item,
                status: "cancelled",
                cancellationFee: cancellation.fee,
                refundAmount: cancellation.refund,
              }
            : item,
        ),
        notifications: [
          {
            id: `note-${Date.now()}`,
            userId: role === "buyer" ? booking.sellerId : booking.buyerId,
            text: `${booking.reference} was cancelled. The simulated refund was recorded.`,
            read: false,
            at: new Date().toISOString(),
          },
          ...prev.notifications,
        ],
      }));
      setModal(null);
      notify(
        "Booking cancelled. Simulated refund and ledger reversal recorded.",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Cancellation failed");
    } finally {
      setBusy(false);
    }
  }

  async function openDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const booking = state.bookings.find((item) => item.id === selected);
    if (!booking) return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason"));
    const summary = String(form.get("summary"));
    try {
      const result = (await syncCommand(
        "open_dispute",
        { booking_id: booking.id, reason_code: reason, summary },
        true,
      )) as { dispute_id?: string } | null;
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((item) =>
          item.id === booking.id ? { ...item, status: "disputed" } : item,
        ),
        disputes: [
          {
            id: result?.dispute_id ?? `dispute-${Date.now()}`,
            bookingId: booking.id,
            openedBy: currentUserId,
            reason,
            summary,
            status: "open",
          },
          ...prev.disputes.filter((item) => item.id !== result?.dispute_id),
        ],
      }));
      setModal(null);
      notify("Dispute opened. Simulated funds are held for admin review.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Dispute failed");
    }
  }

  async function triggerSafetyAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get("category"));
    const bookingId =
      selected && state.bookings.some((item) => item.id === selected)
        ? selected
        : undefined;
    try {
      const result = (await syncCommand("trigger_safety_alert", {
        booking_id: bookingId,
        category,
      })) as { incident_id?: string } | null;
      setState((prev) => ({
        ...prev,
        safetyIncidents: [
          {
            id: result?.incident_id ?? `incident-${Date.now()}`,
            bookingId,
            reporterId: currentUserId,
            category,
            status: "open",
            createdAt: new Date().toISOString(),
          },
          ...prev.safetyIncidents,
        ],
      }));
      setModal(null);
      notify("Urgent safety concern sent to the Nanas operations queue.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Safety alert failed");
    }
  }

  async function createSupportCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get("category"));
    const subject = String(form.get("subject"));
    const details = String(form.get("details"));
    try {
      const result = (await syncCommand("create_support_case", {
        case_type: category,
        subject,
        details,
      })) as { case_id?: string } | null;
      setState((prev) => ({
        ...prev,
        supportCases: [
          {
            id: result?.case_id ?? `support-${Date.now()}`,
            openedBy: currentUserId,
            category,
            subject,
            status: "open",
            createdAt: new Date().toISOString(),
          },
          ...prev.supportCases,
        ],
      }));
      setModal(null);
      notify("Support case opened. You can track it from this page.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Support case failed");
    }
  }

  async function createPrivacyRequest(type: "export" | "delete") {
    try {
      const result = (await syncCommand(
        type === "export" ? "request_data_export" : "request_account_deletion",
        {},
      )) as { request_id?: string } | null;
      setState((prev) => ({
        ...prev,
        privacyRequests: [
          {
            id: result?.request_id ?? `privacy-${Date.now()}`,
            userId: currentUserId,
            type,
            status: "open",
            createdAt: new Date().toISOString(),
          },
          ...prev.privacyRequests,
        ],
      }));
      notify(
        type === "export"
          ? "Data export case opened."
          : "Account deletion case opened with retention review.",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Privacy request failed");
    }
  }

  function processPrivacyRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const nextStatus = String(form.get("status")) as
      | "processing"
      | "completed";
    const reason = String(form.get("reason")).trim();
    setState((previous) => ({
      ...previous,
      privacyRequests: previous.privacyRequests.map((item) =>
        item.id === selected ? { ...item, status: nextStatus } : item,
      ),
    }));
    recordAdminAudit("privacy.process", "privacy_request", selected, `${nextStatus}: ${reason}`);
    setModal(null);
    notify(`Privacy request marked ${nextStatus}.`);
  }

  async function signOut() {
    try {
      const supabase = getSupabase();
      if (supabase) await supabase.auth.signOut({ scope: "local" });
      router.replace("/auth");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sign out failed");
    }
  }

  async function openAdminConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const purpose = String(form.get("purpose"));
    const caseId = String(form.get("caseId")).trim();
    const reason = String(form.get("reason")).trim();
    try {
      if (backendConnected)
        await adminCommand("read_messages", {
          conversation_id: selected,
          purpose_code: purpose,
          case_id: caseId,
          reason,
        });
      recordSensitiveAccess(
        `conversation:${selected}`,
        `${purpose} · ${caseId} · ${reason}`,
        ["sender", "body", "createdAt"],
      );
      setModal(null);
      notify(`Case ${caseId} recorded before opening messages.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Message access failed");
    }
  }

  async function generateSessionCode(booking: DemoBooking) {
    try {
      const result = (await syncCommand(
        "generate_session_code",
        { booking_id: booking.id },
        true,
      )) as { code?: string } | null;
      const code =
        result?.code ?? String(Math.floor(100000 + Math.random() * 900000));
      setState((prev) => ({
        ...prev,
        sessionCodes: { ...prev.sessionCodes, [booking.id]: code },
      }));
      notify(
        "Short-lived visit code generated. Share it only with the other booking party.",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Session code failed");
    }
  }

  async function verifySessionAndCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const booking = state.bookings.find((item) => item.id === selected);
    if (!booking) return;
    const code = String(new FormData(event.currentTarget).get("code"));
    if (!backendConnected && code !== state.sessionCodes[booking.id])
      return notify("The visit code is incorrect or expired.");
    try {
      if (backendConnected)
        await syncCommand(
          "verify_session_code",
          { booking_id: booking.id, code },
          true,
        );
      await transition(booking, "in_progress");
      setModal(null);
      notify("Visit code verified and care visit checked in.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Code verification failed",
      );
    }
  }

  async function resolveDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const outcome = String(form.get("outcome"));
    const reason = String(form.get("reason")).trim();
    try {
      if (backendConnected)
        await adminCommand("resolve_dispute", {
          dispute_id: selected,
          resolution_code: outcome,
          note: reason,
        });
      setState((prev) => ({
        ...prev,
        disputes: prev.disputes.map((item) =>
          item.id === selected
            ? {
                ...item,
                status: "resolved",
                resolution: `${outcome.replaceAll("_", " ")}: ${reason}`,
              }
            : item,
        ),
      }));
      recordAdminAudit("dispute.resolve", "dispute", selected, `${outcome}: ${reason}`);
      setModal(null);
      notify("Dispute resolved and audit event recorded.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Dispute resolution failed",
      );
    }
  }
  async function resolveModerationReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const moderationAction = String(form.get("moderationAction"));
    try {
      if (backendConnected)
        await adminCommand("resolve_moderation", {
          report_id: selected,
          moderation_action: moderationAction,
          reason_code: String(form.get("reasonCode")),
          public_note: String(form.get("publicNote") ?? ""),
          private_note: String(form.get("privateNote") ?? ""),
        });
      setState((prev) => ({
        ...prev,
        moderationReports: prev.moderationReports.map((item) =>
          item.id === selected
            ? {
                ...item,
                status:
                  moderationAction === "escalate" ? "escalated" : "resolved",
              }
            : item,
        ),
      }));
      recordAdminAudit(
        "moderation.resolve",
        "moderation_report",
        selected,
        `${moderationAction}: ${String(form.get("reasonCode"))}`,
      );
      setModal(null);
      notify("Moderation decision recorded with an immutable audit entry.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Moderation action failed",
      );
    }
  }
  async function manageOperationsCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !selectedCaseKind) return;
    const form = new FormData(event.currentTarget);
    const action = String(form.get("caseAction")) as
      "assign" | "acknowledge" | "resolve";
    const note = String(form.get("note"));
    try {
      if (backendConnected)
        await adminCommand("manage_operations_case", {
          case_kind: selectedCaseKind,
          case_id: selected,
          case_action: action,
          note,
        });
      setState((prev) =>
        selectedCaseKind === "support"
          ? {
              ...prev,
              supportCases: prev.supportCases.map((item) =>
                item.id === selected
                  ? {
                      ...item,
                      status: action === "resolve" ? "resolved" : "open",
                    }
                  : item,
              ),
            }
          : {
              ...prev,
              safetyIncidents: prev.safetyIncidents.map((item) =>
                item.id === selected
                  ? {
                      ...item,
                      status:
                        action === "resolve"
                          ? "resolved"
                          : action === "acknowledge"
                            ? "acknowledged"
                            : item.status,
                    }
                  : item,
              ),
            },
      );
      recordAdminAudit(
        `${selectedCaseKind}.${action}`,
        selectedCaseKind,
        selected,
        note,
      );
      setModal(null);
      setSelectedCaseKind(null);
      notify(
        `${selectedCaseKind === "support" ? "Support case" : "Safety incident"} ${action} action recorded.`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Case action failed");
    }
  }
  async function toggleAdminFlag(key: string, enabled: boolean) {
    try {
      if (backendConnected)
        await adminCommand("update_feature_flag", {
          key,
          enabled,
          reason: `Admin configuration change: ${key} ${enabled ? "enabled" : "disabled"}.`,
        });
      setAdminOps((prev) => ({
        ...prev,
        flags: prev.flags.map((flag) =>
          flag.key === key
            ? { ...flag, enabled, updatedAt: new Date().toISOString() }
            : flag,
        ),
      }));
      recordAdminAudit("feature_flag.update", "feature_flag", key, `${enabled ? "enabled" : "disabled"}`);
      notify(`${key} feature flag ${enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Feature flag update failed",
      );
    }
  }
  async function saveCatalogService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = adminOps.services.find((item) => item.id === selected);
    const payload = {
      service_id: existing?.id,
      category_id: String(form.get("categoryId")),
      name: String(form.get("name")),
      description: String(form.get("description")),
      pricing_unit: String(form.get("pricingUnit")),
      risk_level: String(form.get("riskLevel")),
      active: form.get("active") === "on",
      reason: String(form.get("reason")),
    };
    try {
      const result = backendConnected
        ? ((await adminCommand("upsert_service", payload)) as {
            service_id?: string;
          })
        : null;
      const id = result?.service_id ?? existing?.id ?? `service-${Date.now()}`;
      const service = {
        id,
        categoryId: payload.category_id,
        name: payload.name,
        description: payload.description,
        pricingUnit: payload.pricing_unit,
        riskLevel: payload.risk_level,
        active: payload.active,
      };
      setAdminOps((prev) => ({
        ...prev,
        services: [
          ...prev.services.filter((item) => item.id !== id),
          service,
        ].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      setLiveServices((prev) =>
        payload.active
          ? [
              ...prev.filter((item) => item.id !== id),
              { id, name: payload.name },
            ].sort((a, b) => a.name.localeCompare(b.name))
          : prev.filter((item) => item.id !== id),
      );
      recordAdminAudit("catalog.service.upsert", "service", id, payload.reason);
      setModal(null);
      notify(
        existing
          ? "Healthcare service configuration updated."
          : "Healthcare service created.",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Service configuration failed",
      );
    }
  }
  async function saveCatalogArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = adminOps.areas.find((item) => item.id === selected);
    const payload = {
      area_id: existing?.id,
      island_id: String(form.get("islandId")),
      name: String(form.get("name")),
      active: form.get("active") === "on",
      reason: String(form.get("reason")),
    };
    try {
      const result = backendConnected
        ? ((await adminCommand("upsert_service_area", payload)) as {
            service_area_id?: string;
          })
        : null;
      const id =
        result?.service_area_id ?? existing?.id ?? `area-${Date.now()}`;
      const islandName =
        adminOps.islands.find((item) => item.id === payload.island_id)?.name ??
        "The Bahamas";
      const area = {
        id,
        islandId: payload.island_id,
        islandName,
        name: payload.name,
        active: payload.active,
      };
      setAdminOps((prev) => ({
        ...prev,
        areas: [...prev.areas.filter((item) => item.id !== id), area].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      }));
      setLiveAreas((prev) =>
        payload.active
          ? [
              ...prev.filter((item) => item.id !== id),
              { id, name: payload.name },
            ].sort((a, b) => a.name.localeCompare(b.name))
          : prev.filter((item) => item.id !== id),
      );
      recordAdminAudit("catalog.area.upsert", "service_area", id, payload.reason);
      setModal(null);
      notify(
        existing
          ? "Bahamas service area updated."
          : "Bahamas service area created.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Service area configuration failed",
      );
    }
  }
  async function savePostingPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = adminOps.postingPlans.find((item) => item.id === selected);
    const payload = {
      plan_id: existing?.id,
      code: String(form.get("code")).trim(),
      name: String(form.get("name")).trim(),
      description: String(form.get("description")).trim(),
      fee_minor: Number(form.get("fee")) * 100,
      duration_days: Number(form.get("durationDays")),
      free_post_allowance: Number(form.get("freePostAllowance")),
      featured: form.get("featured") === "on",
      active: form.get("active") === "on",
      reason: String(form.get("reason")),
    };
    try {
      const result = backendConnected
        ? ((await adminCommand("upsert_job_posting_plan", payload)) as {
            plan_id?: string;
          })
        : null;
      const id =
        result?.plan_id ?? existing?.id ?? `posting-plan-${Date.now()}`;
      const plan: PostingPlan = {
        id,
        code: payload.code,
        name: payload.name,
        description: payload.description,
        fee: payload.fee_minor / 100,
        durationDays: payload.duration_days,
        freePostAllowance: payload.free_post_allowance,
        featured: payload.featured,
        active: payload.active,
      };
      setAdminOps((prev) => ({
        ...prev,
        postingPlans: [
          ...prev.postingPlans.filter((item) => item.id !== id),
          plan,
        ].sort((a, b) => a.fee - b.fee),
      }));
      recordAdminAudit("posting_plan.upsert", "posting_plan", id, payload.reason);
      setModal(null);
      notify("Job-posting plan and duration updated.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Posting plan update failed",
      );
    }
  }
  async function saveHouseholdMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = householdMembers.find((item) => item.id === selected);
    const payload = {
      member_id: existing?.id,
      relationship: String(form.get("relationship")),
      display_name: String(form.get("displayName")),
      date_of_birth: String(form.get("dateOfBirth")) || null,
      care_notes: String(form.get("careNotes")),
      active: form.get("active") === "on",
    };
    try {
      const result = (await syncCommand(
        "upsert_household_member",
        payload,
      )) as { member_id?: string } | null;
      const id = result?.member_id ?? existing?.id ?? `member-${Date.now()}`;
      const member = {
        id,
        relationship: payload.relationship,
        name: payload.display_name,
        dateOfBirth: payload.date_of_birth ?? undefined,
        notes: payload.care_notes || undefined,
        active: payload.active,
      };
      setHouseholdMembers((prev) => [
        ...prev.filter((item) => item.id !== id),
        member,
      ]);
      setModal(null);
      notify("Private care recipient saved.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Care recipient failed");
    }
  }
  async function saveWeeklyAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weekdays = [0, 1, 2, 3, 4, 5, 6].filter(
      (day) => form.get(`day-${day}`) === "on",
    );
    const start = String(form.get("start")),
      end = String(form.get("end"));
    try {
      await syncCommand("seller_replace_weekly_availability", {
        weekdays,
        local_start: start,
        local_end: end,
      });
      setAvailabilityRows(
        weekdays.map((weekday) => ({
          id: `rule-${weekday}-${Date.now()}`,
          weekday,
          start,
          end,
          active: true,
        })),
      );
      setState((previous) => ({
        ...previous,
        users: previous.users.map((user) =>
          user.id === currentUserId && user.sellerDetails
            ? {
                ...user,
                sellerDetails: {
                  ...user.sellerDetails,
                  availability: weekdays.map((weekday) => ({
                    weekday,
                    start,
                    end,
                    timezone: "America/Nassau",
                  })),
                  availabilityUpdatedAt: new Date().toISOString(),
                },
              }
            : user,
        ),
      }));
      setModal(null);
      notify("Weekly availability saved.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Availability failed");
    }
  }
  async function saveSellerService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const serviceIdValue = String(form.get("serviceId"));
    const existing = sellerServiceRows.find(
      (item) => item.serviceId === serviceIdValue,
    );
    const rate = Number(form.get("rate"));
    const rateMaxValue = String(form.get("rateMax"));
    const rateMax = rateMaxValue ? Number(rateMaxValue) : undefined;
    const bio = String(form.get("bio")).trim();
    const yearsExperience = Number(form.get("yearsExperience"));
    const capabilities = commaList(form.get("capabilities"));
    const additionalHelp = commaList(form.get("additionalHelp"));
    const active = form.get("active") === "on";
    if (!existing && sellerServiceRows.length >= 3) {
      notify(
        "You can add up to 3 service profiles. Edit an existing profile instead.",
      );
      return;
    }
    if (
      !active &&
      existing?.active &&
      sellerServiceRows.filter((item) => item.active).length <= 1
    ) {
      notify("Keep at least one service profile active and public.");
      return;
    }
    if (active && bio.length < 180) {
      notify("Active service biographies must be at least 180 characters.");
      return;
    }
    try {
      const result = (await syncCommand("seller_upsert_service", {
        service_id: serviceIdValue,
        rate_minor: rate * 100,
        rate_max_minor: rateMax == null ? null : rateMax * 100,
        service_bio: bio,
        years_experience: yearsExperience,
        capabilities,
        additional_help: additionalHelp,
        active,
      })) as { seller_service_id?: string } | null;
      const row: SellerServiceRow = {
        id:
          result?.seller_service_id ??
          existing?.id ??
          `seller-service-${Date.now()}`,
        serviceId: serviceIdValue,
        name:
          liveServices.find((item) => item.id === serviceIdValue)?.name ??
          "Healthcare service",
        rate,
        rateMax,
        bio,
        yearsExperience,
        capabilities,
        additionalHelp,
        active,
      };
      setSellerServiceRows((prev) => [
        ...prev.filter((item) => item.serviceId !== serviceIdValue),
        row,
      ]);
      setModal(null);
      notify("Service-specific public profile saved.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Seller service failed");
    }
  }
  async function saveSellerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const photo = form.get("profilePhoto");
    const next = {
      displayName: String(form.get("displayName")).trim(),
      avatarPath: sellerProfileForm.avatarPath,
      headline: String(form.get("headline")),
      languages: commaList(form.get("languages")),
      vaccinations: commaList(form.get("vaccinations")),
      additionalDetails: commaList(form.get("additionalDetails")),
      islandId: String(form.get("islandId")) || undefined,
      locality: String(form.get("locality")),
    };
    try {
      if (photo instanceof File && photo.size > 0)
        next.avatarPath = (
          await issueUploadUrl("public-profile-media", photo, "profile-photo")
        ).path;
      await syncCommand("seller_update_public_profile", {
        display_name: next.displayName,
        avatar_path: next.avatarPath,
        headline: next.headline,
        languages: next.languages,
        island_id: next.islandId,
        locality: next.locality,
        vaccinations: next.vaccinations,
        additional_details: next.additionalDetails,
      });
      const supabase = getSupabase();
      const avatarUrl =
        next.avatarPath && supabase
          ? supabase.storage
              .from("public-profile-media")
              .getPublicUrl(next.avatarPath).data.publicUrl
          : undefined;
      setSellerProfileForm(next);
      setAuthIdentity((identity) =>
        identity
          ? {
              ...identity,
              name: next.displayName,
              avatar:
                next.displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("") || "NS",
            }
          : identity,
      );
      setState((previous) => ({
        ...previous,
        users: previous.users.map((user) =>
          user.id === currentUserId
            ? {
                ...user,
                name: next.displayName,
                avatar:
                  next.displayName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("") || "NS",
                avatarUrl,
              }
            : user,
        ),
      }));
      setModal(null);
      notify("Public seller profile saved.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Profile update failed");
    }
  }
  async function saveSellerCoverage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const areaId = String(form.get("areaId")),
      radius = Number(form.get("radius")),
      travelFee = Number(form.get("travelFee")),
      active = form.get("active") === "on";
    const existing = sellerCoverageRows.find((item) => item.areaId === areaId);
    try {
      const result = (await syncCommand("seller_upsert_service_area", {
        service_area_id: areaId,
        radius_km: radius,
        travel_fee_minor: travelFee * 100,
        active,
      })) as { seller_service_area_id?: string } | null;
      const row = {
        id:
          result?.seller_service_area_id ??
          existing?.id ??
          `coverage-${Date.now()}`,
        areaId,
        name:
          liveAreas.find((item) => item.id === areaId)?.name ?? "The Bahamas",
        radius,
        travelFee,
        active,
      };
      setSellerCoverageRows((prev) => [
        ...prev.filter((item) => item.areaId !== areaId),
        row,
      ]);
      setModal(null);
      notify("Seller coverage saved.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Coverage update failed");
    }
  }
  const nav = roleNav[role];
  const buyerNav: NavItem[] = [
    { id: "find-care", label: "Find care", icon: <Search /> },
    { id: "care-requests", label: "Requests", icon: <HeartHandshake /> },
    { id: "bookings", label: "Bookings", icon: <CalendarDays /> },
    { id: "messages", label: "Messages", icon: <MessageCircle /> },
    { id: "favorites", label: "Saved", icon: <Star /> },
  ];
  const sellerNav: NavItem[] = [
    { id: "requests", label: "Active jobs", icon: <Search /> },
    { id: "quotes", label: "Quotes", icon: <ClipboardCheck /> },
    { id: "bookings", label: "Bookings", icon: <CalendarDays /> },
    { id: "messages", label: "Messages", icon: <MessageCircle /> },
    { id: "services", label: "Services", icon: <Stethoscope /> },
  ];
  const overlays = (
    <>
      {toast && (
        <div className="portal-toast">
          <Check />
          {toast}
        </div>
      )}
      {modal && (
        <dialog
          open
          className="portal-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setModal(null);
          }}
        >
          <div
            className={`portal-modal ${modal === "request" ? "request-wizard-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Nanas workflow dialog"
          >
            <button
              className="modal-x"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <X />
            </button>
            {renderModal()}
          </div>
        </dialog>
      )}
    </>
  );

  if (role === "buyer")
    return (
      <div className="buyer-shell">
        <header className="buyer-topbar">
          <Link
            className="buyer-brand"
            href={portalHref("buyer", "overview")}
            onClick={(event) => {
              event.preventDefault();
              chooseSection("overview");
            }}
          >
            <span>N</span>Nanas<small>Healthcare at home</small>
          </Link>
          <nav className="buyer-primary-nav" aria-label="Buyer navigation">
            {buyerNav.map((item) => (
              <Link
                key={item.id}
                href={portalHref("buyer", item.id)}
                className={
                  section === item.id ||
                  (section === "providers" && item.id === "find-care")
                    ? "active"
                    : ""
                }
                onClick={(event) => {
                  event.preventDefault();
                  chooseSection(item.id);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === "care-requests" &&
                  myQuotes.filter((quote) => quote.status === "pending")
                    .length > 0 && (
                    <b>
                      {
                        myQuotes.filter((quote) => quote.status === "pending")
                          .length
                      }
                    </b>
                  )}
              </Link>
            ))}
          </nav>
          <div className="buyer-top-actions">
            <div
              className={`connection-pill ${backendConnected ? "connected" : "demo"}`}
            >
              <i />
              {backendConnected ? "Connected" : "Local"}
            </div>
            <button
              className="notification-button"
              onClick={() => setSection("notifications")}
              aria-label={`${unread} unread notifications`}
            >
              <Bell />
              {unread > 0 && <span>{unread}</span>}
            </button>
            <Link
              className={
                section === "account" ? "buyer-profile active" : "buyer-profile"
              }
              href={portalHref("buyer", "account")}
              onClick={(event) => {
                event.preventDefault();
                chooseSection("account");
              }}
            >
              <span>{currentUser.avatar}</span>
              <div>
                <b>{currentUser.name}</b>
                <small>My account</small>
              </div>
            </Link>
            <details className="app-mobile-menu">
              <summary aria-label="Open buyer menu">
                <Menu />
              </summary>
              <div className="app-mobile-menu-panel">
                {roleNav.buyer.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={
                      section === item.id ||
                      (section === "providers" && item.id === "find-care")
                        ? "active"
                        : ""
                    }
                    onClick={(event) => {
                      chooseSection(item.id);
                      event.currentTarget.closest("details")?.removeAttribute(
                        "open",
                      );
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </header>
        <main className="buyer-content">{renderBuyer()}</main>
        <nav className="buyer-mobile-nav" aria-label="Mobile buyer navigation">
          {buyerNav.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={portalHref("buyer", item.id)}
              className={section === item.id ? "active" : ""}
              onClick={(event) => {
                event.preventDefault();
                chooseSection(item.id);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        {overlays}
      </div>
    );

  if (role === "seller")
    return (
      <div className="buyer-shell seller-shell">
        <header className="buyer-topbar seller-topbar">
          <Link
            className="buyer-brand"
            href={portalHref("seller", "overview")}
            onClick={(event) => {
              event.preventDefault();
              chooseSection("overview");
            }}
          >
            <span>N</span>Nanas<small>Seller workspace</small>
          </Link>
          <nav className="buyer-primary-nav" aria-label="Seller navigation">
            {sellerNav.map((item) => (
              <Link
                key={item.id}
                href={portalHref("seller", item.id)}
                className={
                  section === item.id ||
                  (item.id === "services" &&
                    [
                      "availability",
                      "profile",
                      "kyc",
                      "badges",
                      "safety",
                    ].includes(section))
                    ? "active"
                    : ""
                }
                onClick={(event) => {
                  event.preventDefault();
                  chooseSection(item.id);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === "quotes" &&
                  myQuotes.filter((quote) => quote.status === "pending")
                    .length > 0 && (
                    <b>
                      {
                        myQuotes.filter((quote) => quote.status === "pending")
                          .length
                      }
                    </b>
                  )}
              </Link>
            ))}
          </nav>
          <div className="buyer-top-actions seller-top-actions">
            <button
              className="notification-button"
              onClick={() => chooseSection("notifications")}
              aria-label={`${unread} unread notifications`}
            >
              <Bell />
              {unread > 0 && <span>{unread}</span>}
            </button>
            <details className="seller-profile-menu">
              <summary
                className={
                  ["account", "profile", "kyc", "safety", "availability"].includes(
                    section,
                  )
                    ? "buyer-profile active"
                    : "buyer-profile"
                }
              >
                <span>{currentUser.avatar}</span>
                <div>
                  <b>{currentUser.name}</b>
                  <small>Seller account</small>
                </div>
                <ChevronDown />
              </summary>
              <div className="seller-profile-dropdown">
                <Link
                  href={portalHref("seller", "profile")}
                  onClick={(event) => {
                    event.preventDefault();
                    chooseSection("profile");
                  }}
                >
                  <UserRoundCheck />
                  <span>Profile</span>
                </Link>
                <Link
                  href={portalHref("seller", "services")}
                  onClick={(event) => {
                    event.preventDefault();
                    chooseSection("services");
                  }}
                >
                  <Stethoscope />
                  <span>Services</span>
                </Link>
                <Link
                  href={portalHref("seller", "availability")}
                  onClick={(event) => {
                    event.preventDefault();
                    chooseSection("availability");
                  }}
                >
                  <Clock3 />
                  <span>Availability</span>
                </Link>
                <Link
                  href={portalHref("seller", "kyc")}
                  onClick={(event) => {
                    event.preventDefault();
                    chooseSection("kyc");
                  }}
                >
                  <FileCheck2 />
                  <span>Verification</span>
                </Link>
                <Link
                  href={portalHref("seller", "account")}
                  onClick={(event) => {
                    event.preventDefault();
                    chooseSection("account");
                  }}
                >
                  <Settings />
                  <span>Settings</span>
                </Link>
                <Link
                  href={portalHref("seller", "safety")}
                  onClick={(event) => {
                    event.preventDefault();
                    chooseSection("safety");
                  }}
                >
                  <LifeBuoy />
                  <span>Safety</span>
                </Link>
              </div>
            </details>
            <details className="app-mobile-menu">
              <summary aria-label="Open seller menu">
                <Menu />
              </summary>
              <div className="app-mobile-menu-panel">
                {roleNav.seller.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={
                      section === item.id ||
                      (item.id === "services" &&
                        [
                          "availability",
                          "profile",
                          "kyc",
                          "badges",
                          "safety",
                        ].includes(section))
                        ? "active"
                        : ""
                    }
                    onClick={(event) => {
                      chooseSection(item.id);
                      event.currentTarget.closest("details")?.removeAttribute(
                        "open",
                      );
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </header>
        <main className="buyer-content seller-content">{renderSeller()}</main>
        <nav className="buyer-mobile-nav" aria-label="Mobile seller navigation">
          {sellerNav.map((item) => (
            <Link
              key={item.id}
              href={portalHref("seller", item.id)}
              className={section === item.id ? "active" : ""}
              onClick={(event) => {
                event.preventDefault();
                chooseSection(item.id);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        {overlays}
      </div>
    );

  return (
    <div className={`portal-shell portal-role-${role}`}>
      <aside className={`portal-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="portal-logo">
          <Link href="/">
            Nanas<span>.</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>
        <div className="role-label">
          {role === "admin" ? "Operations portal" : `${role} workspace`}
        </div>
        <nav>
          {nav.map((item) => (
            <Link
              key={item.id}
              href={portalHref(role, item.id)}
              className={section === item.id ? "active" : ""}
              onClick={(event) => {
                event.preventDefault();
                chooseSection(item.id);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === "notifications" && unread > 0 ? (
                <b>{unread}</b>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="sidebar-support">
          <LifeBuoy />
          <div>
            <b>Need support?</b>
            <span>Safety help and care support are always within reach.</span>
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="portal-main">
        <header className="portal-header">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <div className="portal-search">
            <Search />
            <input placeholder="Search Nanas" aria-label="Search Nanas" />
          </div>
          {role === "admin" && (
            <button
              className="workspace-header-cta"
              onClick={() => setSection("kyc")}
            >
              <UserRoundCheck /> Review KYC queue
            </button>
          )}
          <div
            className={`connection-pill ${backendConnected ? "connected" : "demo"}`}
          >
            <i />
            {backendConnected ? "Supabase connected" : "Local simulation"}
          </div>
          <button
            className="notification-button"
            onClick={() => setSection("notifications")}
            aria-label={`${unread} unread notifications`}
          >
            <Bell />
            {unread > 0 && <span>{unread}</span>}
          </button>
          <div className="role-switch" aria-label="Test Nanas as a role">
            {(backendConnected
              ? [role]
              : (["buyer", "seller", "admin"] as DemoRole[])
            ).map((item) => (
              <button
                key={item}
                className={role === item ? "active" : ""}
                aria-pressed={role === item}
                onClick={() => changeRole(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="portal-user">
            <span>{currentUser.avatar}</span>
            <div>
              <b>{currentUser.name}</b>
              <small>{role}</small>
            </div>
          </div>
        </header>
        <main className={`portal-content portal-section-${section}`}>
          {renderSection()}
        </main>
      </div>
      {overlays}
    </div>
  );

  function renderSection() {
    if (role === "buyer") return renderBuyer();
    if (role === "seller") return renderSeller();
    return renderAdmin();
  }

  function pageHead(
    kicker: string,
    title: string,
    copy: string,
    action?: ReactNode,
  ) {
    return (
      <div className="portal-page-head">
        <div>
          <span>{kicker}</span>
          <h1>{title}</h1>
          <p>{copy}</p>
        </div>
        {action}
      </div>
    );
  }
  function metric(
    icon: ReactNode,
    label: string,
    value: string,
    detail: string,
    tone = "teal",
  ) {
    return (
      <article className={`metric-card ${tone}`}>
        <div>{icon}</div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </article>
    );
  }
  function status(value: string) {
    return (
      <span className={`status status-${value}`}>
        {value.replaceAll("_", " ")}
      </span>
    );
  }
  function empty(title: string, copy: string) {
    return (
      <div className="empty-state">
        <HeartHandshake />
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
    );
  }

  function renderSafetyCenter() {
    const cases = state.supportCases.filter(
      (item) => item.openedBy === currentUserId,
    );
    return (
      <>
        {pageHead(
          "Safety & support",
          "Help before, during, and after care.",
          "Nanas is not an emergency service. For immediate danger, contact locally approved emergency services.",
          <button
            className="primary-action"
            onClick={() => {
              setSelected(null);
              setModal("support-case");
            }}
          >
            Open support case
          </button>,
        )}
        <div className="info-banner safety-warning">
          <LifeBuoy />
          <div>
            <b>Urgent concern during an active booking?</b>
            <span>
              Use the booking safety action to alert authorized Nanas
              operations. This does not claim emergency authorities were
              contacted.
            </span>
          </div>
        </div>
        <div className="case-grid safety-bookings">
          {myBookings
            .filter((booking) =>
              ["confirmed", "in_progress", "completion_pending"].includes(
                booking.status,
              ),
            )
            .map((booking) => (
              <article className="case-card" key={booking.id}>
                <header>
                  {status(booking.status)}
                  <span>{booking.reference}</span>
                </header>
                <h3>{booking.service}</h3>
                <p>
                  {dateTime(booking.startsAt)} ·{" "}
                  {role === "buyer" ? booking.sellerName : booking.buyerName}
                </p>
                <footer>
                  <button
                    onClick={() => {
                      setSelected(booking.id);
                      setModal("booking-detail");
                    }}
                  >
                    Booking details
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      setSelected(booking.id);
                      setModal("safety-alert");
                    }}
                  >
                    Report urgent concern
                  </button>
                </footer>
              </article>
            ))}
        </div>
        <Panel title={`${cases.length} support case(s)`}>
          {cases.length ? (
            <div className="list-rows">
              {cases.map((item) => (
                <article key={item.id}>
                  <div className="list-icon">
                    <LifeBuoy />
                  </div>
                  <div className="list-main">
                    <b>{item.subject}</b>
                    <span>
                      {item.category} · {item.id}
                    </span>
                    <small>{dateTime(item.createdAt)}</small>
                  </div>
                  <div className="list-side">{status(item.status)}</div>
                </article>
              ))}
            </div>
          ) : (
            empty(
              "No support cases",
              "Open a case when you need Nanas operational help.",
            )
          )}
        </Panel>
      </>
    );
  }

  function renderAccountCenter() {
    const requests = state.privacyRequests.filter(
      (item) => item.userId === currentUserId,
    );
    return (
      <>
        {pageHead(
          "Account & privacy",
          "Security and data controls.",
          "Manage notification preferences, contact security, active devices, exports, and deletion requests with step-up checks in connected mode.",
        )}
        <div className="settings-grid">
          {[
            "Booking updates",
            "Messages",
            "Payment receipts",
            "Credential reminders",
            "Safety notices",
          ].map((name, index) => (
            <div key={name}>
              <span>
                <b>{name}</b>
                <small>
                  {index === 4
                    ? "Mandatory operational notice"
                    : "In-app and email preference"}
                </small>
              </span>
              <input
                aria-label={`${name} notification preference`}
                type="checkbox"
                checked={
                  index === 4 ||
                  notificationPreferences[currentUserId]?.[name] !== false
                }
                onChange={(event) => {
                  const checked = event.target.checked;
                  setNotificationPreferences((previous) => ({
                    ...previous,
                    [currentUserId]: {
                      ...previous[currentUserId],
                      [name]: checked,
                    },
                  }));
                  notify(`${name} preference saved.`);
                }}
                disabled={index === 4}
              />
            </div>
          ))}
        </div>
        <div className="dashboard-grid account-grid">
          <Panel
            title="Security"
            action={<button onClick={signOut}>Sign out</button>}
          >
            <TaskList
              items={[
                "Contact verified",
                "Password protected",
                "1 active web device",
                "Step-up required for sensitive changes",
              ]}
            />
          </Panel>
          <Panel
            title="Privacy cases"
            action={
              <button onClick={() => createPrivacyRequest("export")}>
                Request export
              </button>
            }
          >
            <div className="privacy-actions">
              <button onClick={() => createPrivacyRequest("export")}>
                <BookOpenCheck />
                Export my data
              </button>
              <button
                className="danger"
                onClick={() => createPrivacyRequest("delete")}
              >
                <Ban />
                Request account deletion
              </button>
            </div>
            {requests.map((item) => (
              <div className="privacy-case" key={item.id}>
                {status(item.status)}
                <span>
                  {item.type} · {dateTime(item.createdAt)}
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </>
    );
  }

  function renderBuyer() {
    if (section === "providers") {
      const sellerId = selected ?? routeEntityId;
      const seller = state.users.find(
        (item) =>
          item.id === sellerId &&
          item.role === "seller" &&
          item.status === "active",
      );
      if (!seller)
        return (
          <DetailNotFound backHref="/app/buyer/find-care">
            This seller may be unavailable, outside your eligible area, or no
            longer accepting public healthcare requests.
          </DetailNotFound>
        );
      return (
        <NanasProviderProfile
          seller={seller}
          relatedSellers={state.users.filter(
            (item) =>
              item.role === "seller" &&
              item.status === "active" &&
              item.id !== seller.id,
          )}
          favorite={state.favorites.includes(seller.id)}
          onToggleFavorite={() => toggleFavorite(seller.id)}
          onRequestCare={(sellerServiceId) =>
            openRequestWizard(sellerServiceId)
          }
        />
      );
    }
    if (section === "care-requests" && (selected ?? routeEntityId)) {
      const request = myRequests.find(
        (item) => item.id === (selected ?? routeEntityId),
      );
      if (!request)
        return (
          <DetailNotFound backHref="/app/buyer/care-requests">
            This care request was not found or is no longer available to this
            buyer account.
          </DetailNotFound>
        );
      return (
        <NanasCareRequestDetail
          request={request}
          viewer="buyer"
          currentUserId={currentUserId}
          busy={busy}
          onSubmitQuote={submitQuote}
          onAcceptQuote={(quote) => acceptQuote(quote, request)}
          onMessage={() => {
            const booking = myBookings.find(
              (item) => item.requestId === request.id,
            );
            if (booking) {
              setSelected(booking.conversationId);
              setSection("messages");
            } else notify("Secure messaging opens after a quote is accepted.");
          }}
        />
      );
    }
    if (section === "overview")
      return (
        <div className="buyer-home">
          <section className="buyer-hero">
            <div className="buyer-hero-copy">
              <span className="buyer-eyebrow">
                <Sparkles /> Trusted healthcare across The Bahamas
              </span>
              <h1>What care would make today easier?</h1>
              <p>
                Tell Nanas what your family needs. We’ll help you compare
                approved healthcare sellers and book with confidence.
              </p>
              <div className="buyer-hero-actions">
                <button
                  className="buyer-main-action"
                  onClick={() => openRequestWizard()}
                >
                  Find the right care <ChevronRight />
                </button>
                <button
                  className="buyer-quiet-action"
                  onClick={() => setSection("find-care")}
                >
                  <Search /> Browse sellers
                </button>
              </div>
              <div className="buyer-trust-line">
                <span>
                  <BadgeCheck /> Identity reviewed
                </span>
                <span>
                  <ShieldCheck /> Credentials reviewed
                </span>
                <span>
                  <Star /> Booking-based reviews
                </span>
              </div>
            </div>
            <div className="buyer-hero-card">
              <Image
                src="/nanas/provider-home-care.png"
                alt="A Nanas healthcare seller supporting an older adult at home"
                fill
                sizes="(max-width: 820px) 0px, 34vw"
                priority
              />
              <div className="buyer-hero-photo-caption">
                <strong>Care that feels personal.</strong>
                <span>Simple choices, clear prices, human support.</span>
              </div>
            </div>
          </section>
          <section className="buyer-service-picker">
            <header>
              <div>
                <span>Start here</span>
                <h2>What kind of help do you need?</h2>
              </div>
              <button onClick={() => openRequestWizard()}>
                See all care options <ChevronRight />
              </button>
            </header>
            <div className="buyer-service-grid">
              {careIntakeCategories.map((category, index) => (
                <button
                  key={category.code}
                  onClick={() =>
                    openRequestWizard(category.subcategories[0].serviceId)
                  }
                >
                  <span className={`buyer-service-icon tone-${index % 6}`}>
                    {index === 0 ? (
                      <Users />
                    ) : index === 1 ? (
                      <Stethoscope />
                    ) : index === 2 ? (
                      <HeartPulse />
                    ) : index === 3 ? (
                      <HeartHandshake />
                    ) : index === 4 ? (
                      <ShieldCheck />
                    ) : (
                      <Activity />
                    )}
                  </span>
                  <b>{category.name}</b>
                  <small>{category.description}</small>
                  <ul className="buyer-service-subcategories">
                    {category.subcategories.map((subcategory) => (
                      <li key={subcategory.code}>{subcategory.name}</li>
                    ))}
                  </ul>
                  <ChevronRight />
                </button>
              ))}
            </div>
          </section>
          <section className="buyer-how-it-works">
            <div>
              <span>1</span>
              <b>Tell us what matters</b>
              <small>One friendly question at a time.</small>
            </div>
            <ChevronRight />
            <div>
              <span>2</span>
              <b>Compare approved sellers</b>
              <small>See services, rates and verified reviews.</small>
            </div>
            <ChevronRight />
            <div>
              <span>3</span>
              <b>Book protected care</b>
              <small>Accept a quote and keep everything together.</small>
            </div>
          </section>
          <section className="buyer-home-grid">
            <div className="buyer-journey-panel">
              <header>
                <div>
                  <span>Your care journey</span>
                  <h2>Everything important, at a glance</h2>
                </div>
              </header>
              <div className="buyer-journey-cards">
                <button onClick={() => setSection("care-requests")}>
                  <HeartHandshake />
                  <span>
                    <b>
                      {
                        myRequests.filter(
                          (request) => request.status !== "confirmed",
                        ).length
                      }{" "}
                      open
                    </b>
                    <small>Care requests</small>
                  </span>
                  <ChevronRight />
                </button>
                <button onClick={() => setSection("quotes")}>
                  <ClipboardCheck />
                  <span>
                    <b>
                      {
                        myQuotes.filter((quote) => quote.status === "pending")
                          .length
                      }{" "}
                      new
                    </b>
                    <small>Quotes to compare</small>
                  </span>
                  <ChevronRight />
                </button>
                <button onClick={() => setSection("bookings")}>
                  <CalendarDays />
                  <span>
                    <b>{myBookings.length} total</b>
                    <small>Care bookings</small>
                  </span>
                  <ChevronRight />
                </button>
              </div>
            </div>
            <aside className="buyer-support-card">
              <LifeBuoy />
              <span>We’re here when care feels complicated.</span>
              <p>Get operational support before, during, or after a booking.</p>
              <button onClick={() => setSection("safety")}>
                Visit safety & support
              </button>
            </aside>
          </section>
        </div>
      );
    if (section === "find-care") {
      const publicReadySeller = (user: DemoState["users"][number]) => {
        const details = user.sellerDetails;
        return Boolean(
          user.role === "seller" &&
            user.status === "active" &&
            details &&
            details.services.some(
              (service) =>
                service.id &&
                service.name &&
                (service.bio?.trim().length ?? 0) >= 40,
            ) &&
            Boolean(details.locality || details.island) &&
            ((details.credentials?.length ?? 0) > 0 ||
              (details.safetyChecks ?? []).some(
                (check) =>
                  check.status === "approved" || check.status === "completed",
              )),
        );
      };
      const approvedSellers = (backendConnected && !marketplaceLoaded
        ? []
        : state.users
      ).filter(publicReadySeller);
      const availableServices = [
        ...new Set([
          ...liveServices.map((service) => service.name),
          ...approvedSellers.flatMap(
            (seller) =>
              seller.sellerDetails?.services.map((service) => service.name) ??
              [],
          ),
        ]),
      ].sort();
      const availableAreas = [
        ...new Set(
          approvedSellers
            .flatMap((seller) => [
              seller.sellerDetails?.locality,
              seller.sellerDetails?.island,
            ])
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort();
      const availableLanguages = [
        ...new Set([
          ...languageOptions,
          ...approvedSellers.flatMap((seller) =>
            (seller.sellerDetails?.languages ?? []).map(publicLanguageLabel),
          ),
        ]),
      ].sort();
      const searchedLanguages = availableLanguages.filter((language) =>
        language
          .toLowerCase()
          .includes(discoveryLanguageQuery.trim().toLowerCase()),
      );
      const minimumRate = (seller: DemoState["users"][number]) => {
        const rates =
          seller.sellerDetails?.services
            .map((service) => service.rate)
            .filter((rate) => rate > 0) ?? [];
        return rates.length ? Math.min(...rates) : 0;
      };
      const discoveryRate = (seller: DemoState["users"][number]) =>
        discoveryService === "all"
          ? minimumRate(seller)
          : (seller.sellerDetails?.services.find(
              (service) => service.name === discoveryService,
            )?.rate ?? 0);
      const normalizeSearchText = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const matchesSmartSearch = (profileText: string, query: string) => {
        const aliases: Record<string, string[]> = {
          prep: ["preparation"],
          cpr: ["cpr"],
          smoker: ["smoke"],
          transport: ["transportation"],
          meds: ["medication"],
          physio: ["physiotherapy"],
        };
        return normalizeSearchText(query)
          .split(/\s+/)
          .filter(Boolean)
          .every(
            (term) =>
              profileText.includes(term) ||
              (aliases[term] ?? []).some((alias) =>
                profileText.includes(alias),
              ),
          );
      };
      const sellerWeeklyHours = (seller: DemoState["users"][number]) =>
        (seller.sellerDetails?.availability ?? []).reduce((total, rule) => {
          const [startHour, startMinute] = rule.start.split(":").map(Number);
          const [endHour, endMinute] = rule.end.split(":").map(Number);
          return (
            total +
            Math.max(0, endHour + endMinute / 60 - startHour - startMinute / 60)
          );
        }, 0);
      const visibleSellers = approvedSellers
        .filter((seller) => {
          const details = seller.sellerDetails;
          const searchableText = normalizeSearchText(
            [
              seller.name,
              details?.headline,
              details?.locality,
              details?.island,
              ...(details?.services.flatMap((service) => [
                service.name,
                service.bio,
                ...(service.capabilities ?? []),
                ...(service.additionalHelp ?? []),
              ]) ?? []),
              ...(details?.languages ?? []),
              ...(details?.additionalDetails ?? []),
              ...(details?.credentials?.flatMap((credential) => [
                credential.type,
                credential.issuingBody,
              ]) ?? []),
            ]
              .filter(Boolean)
              .join(" "),
          );
          const nameParts = seller.name.trim().split(/\s+/);
          const firstNameQuery = discoveryFirstName.trim().toLowerCase();
          const lastInitialQuery = discoveryLastInitial
            .trim()
            .charAt(0)
            .toLowerCase();
          const matchesQuery =
            !discoveryQuery.trim() ||
            matchesSmartSearch(searchableText, discoveryQuery);
          const matchesName =
            (!firstNameQuery ||
              nameParts[0]?.toLowerCase().startsWith(firstNameQuery)) &&
            (!lastInitialQuery ||
              nameParts
                .slice(1)
                .some(
                  (part) => part.charAt(0).toLowerCase() === lastInitialQuery,
                ));
          const matchesService =
            discoveryService === "all" ||
            details?.services.some(
              (service) => service.name === discoveryService,
            );
          const matchesArea =
            discoveryArea === "all" ||
            [details?.locality, details?.island].some(
              (value) => value === discoveryArea,
            );
          const rate = discoveryRate(seller);
          const matchesRate =
            (discoveryMinRate === 0 || rate >= discoveryMinRate) &&
            (discoveryMaxRate === 0 || (rate > 0 && rate <= discoveryMaxRate));
          const matchesRating = (details?.rating ?? 0) >= discoveryMinRating;
          const matchingServices =
            discoveryService === "all"
              ? (details?.services ?? [])
              : (details?.services.filter(
                  (service) => service.name === discoveryService,
                ) ?? []);
          const yearsExperience = Math.max(
            0,
            ...matchingServices.map((service) => service.yearsExperience ?? 0),
          );
          const matchesExperience = yearsExperience >= discoveryMinYears;
          const weeklyHours = sellerWeeklyHours(seller);
          const matchesEmployment =
            !discoveryEmployment.length ||
            discoveryEmployment.some((employment) =>
              employment === "full_time"
                ? weeklyHours >= 30
                : weeklyHours > 0 && weeklyHours < 30,
            );
          const matchesSkills = discoverySkills.every((skill) =>
            searchableText.includes(
              normalizeSearchText(skill).replace(" training", ""),
            ),
          );
          const matchesPreferences = discoveryPreferences.every((preference) =>
            preference === "Weekend availability"
              ? (details?.availability ?? []).some(
                  (rule) => rule.weekday === 0 || rule.weekday === 6,
                )
              : searchableText.includes(normalizeSearchText(preference)),
          );
          const sellerLanguages = (details?.languages ?? []).map((language) =>
            publicLanguageLabel(language).toLowerCase(),
          );
          const matchesLanguages = discoveryLanguages.every((language) =>
            sellerLanguages.includes(language.toLowerCase()),
          );
          return (
            matchesQuery &&
            matchesName &&
            matchesService &&
            matchesArea &&
            matchesRate &&
            matchesRating &&
            matchesExperience &&
            matchesEmployment &&
            matchesSkills &&
            matchesPreferences &&
            matchesLanguages
          );
        })
        .sort((left, right) => {
          if (discoverySort === "price")
            return discoveryRate(left) - discoveryRate(right);
          if (discoverySort === "rating")
            return (
              (right.sellerDetails?.rating ?? 0) -
                (left.sellerDetails?.rating ?? 0) ||
              left.name.localeCompare(right.name)
            );
          if (discoverySort === "experience")
            return (
              (right.sellerDetails?.completedBookings ?? 0) -
                (left.sellerDetails?.completedBookings ?? 0) ||
              left.name.localeCompare(right.name)
            );
          return (
            (right.sellerDetails?.rating ?? 0) -
              (left.sellerDetails?.rating ?? 0) ||
            (right.sellerDetails?.reviewCount ?? 0) -
              (left.sellerDetails?.reviewCount ?? 0) ||
            left.name.localeCompare(right.name)
          );
        });
      const focusedSeller =
        visibleSellers.find((seller) => seller.id === focusedSellerId) ??
        visibleSellers[0];
      const filterCount = [
        discoveryService !== "all",
        discoveryArea !== "all",
        discoveryMinRate > 0 || discoveryMaxRate > 0,
        discoveryMinRating > 0,
        discoveryMinYears > 0,
        Boolean(discoveryQuery.trim()),
        Boolean(discoveryFirstName.trim() || discoveryLastInitial.trim()),
        discoveryEmployment.length > 0,
        discoverySkills.length > 0,
        discoveryPreferences.length > 0,
        discoveryLanguages.length > 0,
      ].filter(Boolean).length;
      const resetDiscovery = () => {
        setDiscoveryQuery("");
        setDiscoveryService("all");
        setDiscoveryArea("all");
        setDiscoveryMinRate(0);
        setDiscoveryMaxRate(0);
        setDiscoveryMinRating(0);
        setDiscoveryMinYears(0);
        setDiscoveryFirstName("");
        setDiscoveryLastInitial("");
        setDiscoveryEmployment([]);
        setDiscoverySkills([]);
        setDiscoveryPreferences([]);
        setDiscoveryLanguages([]);
        setDiscoveryLanguageQuery("");
        setDiscoverySort("recommended");
      };
      return (
        <>
          {pageHead(
            "Find healthcare",
            "Meet care sellers who fit your family.",
            "Advanced healthcare seller filters help you search approved individual sellers across The Bahamas, then review the details that matter.",
            <button
              className="primary-action"
              onClick={() => openRequestWizard()}
            >
              Tell us what you need
            </button>,
          )}
          <div className="buyer-discovery-bar">
            <label>
              <Sparkles />
              <span>
                <small>Smart search · Beta</small>
                <input
                  aria-label="Smart search healthcare sellers"
                  value={discoveryQuery}
                  onChange={(event) => setDiscoveryQuery(event.target.value)}
                  placeholder="Meal prep, wound care, companionship"
                />
              </span>
            </label>
            <label>
              <Stethoscope />
              <span>
                <small>Care type</small>
                <select
                  aria-label="Filter sellers by service"
                  value={discoveryService}
                  onChange={(event) => setDiscoveryService(event.target.value)}
                >
                  <option value="all">All healthcare services</option>
                  {availableServices.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                </select>
              </span>
            </label>
            <label>
              <Star />
              <span>
                <small>Sort by</small>
                <select
                  aria-label="Sort healthcare sellers"
                  value={discoverySort}
                  onChange={(event) => setDiscoverySort(event.target.value)}
                >
                  <option value="recommended">Recommended</option>
                  <option value="rating">Highest rated</option>
                  <option value="price">Lowest starting rate</option>
                  <option value="experience">Most completed care</option>
                </select>
              </span>
            </label>
            <button aria-label="Search sellers">
              <Search />
            </button>
          </div>
          <div
            className="buyer-filter-toolbar"
            aria-label="Healthcare seller filters"
          >
            <button
              className={discoveryAdvancedOpen ? "active" : ""}
              onClick={() => setDiscoveryAdvancedOpen((open) => !open)}
              aria-expanded={discoveryAdvancedOpen}
            >
              <SlidersHorizontal /> Advanced filters
              {filterCount ? ` (${filterCount})` : ""}
              <ChevronDown />
            </button>
            <button
              className={
                discoveryMinRate > 0 || discoveryMaxRate > 0 ? "active" : ""
              }
              title="Open Advanced filters to edit pay rate"
            >
              <CircleDollarSign /> Pay rate
            </button>
            <button
              className={discoveryEmployment.length ? "active" : ""}
              title="Open Advanced filters to edit employment type"
            >
              <Clock3 /> Employment type
            </button>
            <button
              className={discoveryMinRating > 0 ? "active" : ""}
              title="Open Advanced filters to edit rating"
            >
              <Star /> Rating
            </button>
            <button
              className={discoveryMinYears > 0 ? "active" : ""}
              title="Open Advanced filters to edit experience"
            >
              <BookOpenCheck /> Years of experience
            </button>
            <button
              className={discoverySkills.length ? "active" : ""}
              title="Open Advanced filters to edit professional skills"
            >
              <ShieldCheck /> Professional skills
            </button>
            <button
              className={discoveryLanguages.length ? "active" : ""}
              title="Open Advanced filters to edit languages"
            >
              <Languages /> Languages spoken
            </button>
          </div>
          {discoveryAdvancedOpen && (
            <section
              className="buyer-filter-drawer"
              aria-label="Advanced healthcare seller filters"
            >
              <header>
                <div>
                  <Filter />
                  <span>
                    <b>Advanced filters</b>
                    <small>
                      Every option updates the approved seller results
                      immediately.
                    </small>
                  </span>
                </div>
                <button
                  onClick={() => setDiscoveryAdvancedOpen(false)}
                  aria-label="Close advanced filters"
                >
                  <X />
                </button>
              </header>
              <div className="buyer-filter-drawer-grid">
                <fieldset className="filter-section filter-smart">
                  <legend>
                    Smart search <em>Beta</em>
                  </legend>
                  <p>
                    Search service biographies, credentials, qualifications and
                    additional help.
                  </p>
                  <label className="filter-text-input">
                    <Sparkles />
                    <input
                      aria-label="Advanced smart search"
                      value={discoveryQuery}
                      onChange={(event) =>
                        setDiscoveryQuery(event.target.value)
                      }
                      placeholder="Example: meal prep, CPR, mobility support"
                    />
                  </label>
                </fieldset>
                <fieldset className="filter-section filter-name">
                  <legend>Search by name</legend>
                  <p>Use a first name and optional last initial.</p>
                  <div className="filter-name-fields">
                    <label>
                      First name
                      <input
                        aria-label="Seller first name"
                        value={discoveryFirstName}
                        onChange={(event) =>
                          setDiscoveryFirstName(event.target.value)
                        }
                        placeholder="Alicia"
                      />
                    </label>
                    <label>
                      Last initial
                      <input
                        aria-label="Seller last initial"
                        value={discoveryLastInitial}
                        maxLength={1}
                        onChange={(event) =>
                          setDiscoveryLastInitial(
                            event.target.value
                              .replace(/[^a-z]/gi, "")
                              .slice(0, 1),
                          )
                        }
                        placeholder="M"
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset className="filter-section">
                  <legend>Pay rate</legend>
                  <p>Starting hourly rate in BSD.</p>
                  <div className="filter-rate-fields">
                    <label>
                      Minimum
                      <input
                        aria-label="Minimum hourly rate"
                        type="number"
                        min="0"
                        max="250"
                        value={discoveryMinRate || ""}
                        onChange={(event) =>
                          setDiscoveryMinRate(
                            Math.max(0, Number(event.target.value)),
                          )
                        }
                        placeholder="$0"
                      />
                    </label>
                    <span>to</span>
                    <label>
                      Maximum
                      <input
                        aria-label="Maximum hourly rate"
                        type="number"
                        min="0"
                        max="250"
                        value={discoveryMaxRate || ""}
                        onChange={(event) =>
                          setDiscoveryMaxRate(
                            Math.max(0, Number(event.target.value)),
                          )
                        }
                        placeholder="Any"
                      />
                    </label>
                  </div>
                  <small>
                    {discoveryMinRate || discoveryMaxRate
                      ? `${money(discoveryMinRate)}–${discoveryMaxRate ? money(discoveryMaxRate) : "any"} / hour`
                      : "Any hourly rate"}
                  </small>
                </fieldset>
                <fieldset className="filter-section">
                  <legend>Employment type</legend>
                  <p>Based on the seller’s published weekly availability.</p>
                  <div className="filter-check-list">
                    {[
                      ["part_time", "Part time", "Less than 30 hours/week"],
                      ["full_time", "Full time", "30+ hours/week"],
                    ].map(([value, label, help]) => (
                      <label key={value}>
                        <input
                          aria-label={label}
                          type="checkbox"
                          checked={discoveryEmployment.includes(value)}
                          onChange={() =>
                            setDiscoveryEmployment((items) =>
                              items.includes(value)
                                ? items.filter((item) => item !== value)
                                : [...items, value],
                            )
                          }
                        />
                        <span>
                          <b>{label}</b>
                          <small>{help}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="filter-section">
                  <legend>Years of experience</legend>
                  <p>Experience for the selected healthcare service.</p>
                  <label className="filter-select-label">
                    <select
                      aria-label="Minimum years of experience"
                      value={discoveryMinYears}
                      onChange={(event) =>
                        setDiscoveryMinYears(Number(event.target.value))
                      }
                    >
                      <option value="0">0+ years</option>
                      <option value="2">2+ years</option>
                      <option value="5">5+ years</option>
                      <option value="8">8+ years</option>
                      <option value="10">10+ years</option>
                    </select>
                  </label>
                </fieldset>
                <fieldset className="filter-section">
                  <legend>Rating</legend>
                  <p>Booking-based public reviews.</p>
                  <div className="filter-rating-options">
                    {[0, 1, 2, 3, 4, 5].map((rating) => (
                      <button
                        type="button"
                        className={
                          discoveryMinRating === rating ? "selected" : ""
                        }
                        key={rating}
                        onClick={() => setDiscoveryMinRating(rating)}
                      >
                        {rating ? (
                          <>
                            <Star />
                            {rating}+
                          </>
                        ) : (
                          "Any"
                        )}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="filter-section filter-wide">
                  <legend>Professional skills</legend>
                  <p>
                    Seller-reported skills and Nanas-reviewed credential labels
                    are searchable separately.
                  </p>
                  <div className="filter-option-grid">
                    {professionalSkillOptions.map((skill) => (
                      <label key={skill}>
                        <input
                          type="checkbox"
                          checked={discoverySkills.includes(skill)}
                          onChange={() =>
                            setDiscoverySkills((items) =>
                              items.includes(skill)
                                ? items.filter((item) => item !== skill)
                                : [...items, skill],
                            )
                          }
                        />
                        <span>{skill}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="filter-section filter-wide">
                  <legend>Preferences</legend>
                  <p>Public details sellers have chosen to share.</p>
                  <div className="filter-option-grid">
                    {preferenceOptions.map((preference) => (
                      <label key={preference}>
                        <input
                          type="checkbox"
                          checked={discoveryPreferences.includes(preference)}
                          onChange={() =>
                            setDiscoveryPreferences((items) =>
                              items.includes(preference)
                                ? items.filter((item) => item !== preference)
                                : [...items, preference],
                            )
                          }
                        />
                        <span>{preference}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="filter-section filter-languages filter-wide">
                  <legend>Languages spoken</legend>
                  <p>Select one or more languages the seller must speak.</p>
                  <label className="filter-text-input">
                    <Search />
                    <input
                      aria-label="Search languages"
                      value={discoveryLanguageQuery}
                      onChange={(event) =>
                        setDiscoveryLanguageQuery(event.target.value)
                      }
                      placeholder="Search languages"
                    />
                  </label>
                  <div className="filter-option-grid">
                    {searchedLanguages.map((language) => (
                      <label key={language}>
                        <input
                          type="checkbox"
                          checked={discoveryLanguages.includes(language)}
                          onChange={() =>
                            setDiscoveryLanguages((items) =>
                              items.includes(language)
                                ? items.filter((item) => item !== language)
                                : [...items, language],
                            )
                          }
                        />
                        <span>{language}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <footer>
                <button
                  className="filter-reset"
                  type="button"
                  onClick={resetDiscovery}
                  disabled={!filterCount}
                >
                  Clear all
                </button>
                <button
                  className="filter-apply"
                  type="button"
                  onClick={() => setDiscoveryAdvancedOpen(false)}
                >
                  Show {visibleSellers.length} seller
                  {visibleSellers.length === 1 ? "" : "s"}
                </button>
              </footer>
            </section>
          )}
          <div className="buyer-advanced-filters buyer-quick-filters">
            <label>
              <span>
                <MapPin /> Area
              </span>
              <select
                aria-label="Filter sellers by area"
                value={discoveryArea}
                onChange={(event) => setDiscoveryArea(event.target.value)}
              >
                <option value="all">Everywhere in The Bahamas</option>
                {availableAreas.map((area) => (
                  <option key={area}>{area}</option>
                ))}
              </select>
            </label>
            <label>
              <span>
                <Stethoscope /> Care service
              </span>
              <select
                aria-label="Quick filter sellers by service"
                value={discoveryService}
                onChange={(event) => setDiscoveryService(event.target.value)}
              >
                <option value="all">All healthcare services</option>
                {availableServices.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                notify("Search saved locally for this Nanas beta session.")
              }
            >
              Save search
            </button>
            <button
              type="button"
              onClick={resetDiscovery}
              disabled={!filterCount}
            >
              {filterCount ? `Reset ${filterCount}` : "Reset filters"}
            </button>
          </div>
          <div className="buyer-filter-chips">
            <button className="active">
              <BadgeCheck /> Approved sellers
            </button>
            <button className="active">
              <ShieldCheck /> Credentials reviewed
            </button>
            <button
              className={discoveryArea !== "all" ? "active" : ""}
              onClick={() =>
                setDiscoveryArea(
                  discoveryArea === "all"
                    ? (availableAreas.find((area) => area.includes("Nassau")) ??
                        availableAreas[0] ??
                        "all")
                    : "all",
                )
              }
            >
              <MapPin /> Near my area
            </button>
            <button
              className={discoverySort === "price" ? "active" : ""}
              onClick={() =>
                setDiscoverySort(
                  discoverySort === "price" ? "recommended" : "price",
                )
              }
            >
              <CircleDollarSign /> Lowest rate
            </button>
            <span>
              <b>{visibleSellers.length}</b> of {approvedSellers.length}{" "}
              approved seller{approvedSellers.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="buyer-discovery-layout care-style-layout">
            <div className="buyer-provider-list care-style-results">
              {visibleSellers.map((seller) => (
                <CareSellerResultCard
                  key={seller.id}
                  seller={seller}
                  active={focusedSeller?.id === seller.id}
                  favorite={state.favorites.includes(seller.id)}
                  onFocus={() => setFocusedSellerId(seller.id)}
                  onFavorite={() => toggleFavorite(seller.id)}
                  preferredServiceName={
                    discoveryService === "all" ? undefined : discoveryService
                  }
                  profileHref={"/app/buyer/providers/" + seller.id}
                  onProfile={() => {
                    setSelected(seller.id);
                    setSection("providers");
                  }}
                />
              ))}
              {backendConnected && !marketplaceLoaded
                ? empty(
                    "Loading verified sellers",
                    "Checking live profile, service, coverage, and KYC status before showing sellers.",
                  )
                : !visibleSellers.length &&
                empty(
                  "No sellers match those filters",
                  "Try another area, rate, rating, or care type—or post a request so Nanas can surface eligible matches.",
                )}
            </div>
            {focusedSeller && (
              <CareSellerPreview
                key={`${focusedSeller.id}-${discoveryService}`}
                seller={focusedSeller}
                favorite={state.favorites.includes(focusedSeller.id)}
                onFavorite={() => toggleFavorite(focusedSeller.id)}
                onRequest={(serviceId) => openRequestWizard(serviceId)}
                preferredServiceName={
                  discoveryService === "all" ? undefined : discoveryService
                }
                profileHref={"/app/buyer/providers/" + focusedSeller.id}
                onProfile={() => {
                  setSelected(focusedSeller.id);
                  setSection("providers");
                }}
              />
            )}
          </div>
        </>
      );
    }
    if (section === "care-requests")
      return (
        <>
          {pageHead(
            "Care requests",
            "Your healthcare needs, clearly posted.",
            "Track seller interest, quotes, and booking status.",
            <button
              className="primary-action"
              onClick={() => openRequestWizard()}
            >
              New care request
            </button>,
          )}
          <Panel title={`${myRequests.length} requests`}>
            <RequestRows requests={myRequests} />
          </Panel>
        </>
      );
    if (section === "quotes")
      return (
        <>
          {pageHead(
            "Seller quotes",
            "Compare care, not guesswork.",
            "Review verified sellers, rate breakdowns, and messages before simulating payment.",
          )}
          <div className="quote-grid">
            {myQuotes.length
              ? myQuotes.map(({ request, ...quote }) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    request={request}
                    buyer
                  />
                ))
              : empty(
                  "No quotes yet",
                  "Sellers will appear here when they respond to your care requests.",
                )}
          </div>
        </>
      );
    if (section === "bookings")
      return (
        <>
          {pageHead(
            "Bookings",
            "Every care visit in one place.",
            "Use status controls to simulate the full visit lifecycle.",
          )}
          <Panel title={`${myBookings.length} bookings`}>
            <BookingRows bookings={myBookings} />
          </Panel>
        </>
      );
    if (section === "messages") return renderMessages();
    if (section === "wallet")
      return (
        <>
          {pageHead(
            "Payments & wallet",
            "Protected payment records in BSD.",
            "Nanas stores transaction references and ledger entries—not raw card details.",
          )}
          <div className="wallet-hero">
            <div>
              <span>Simulated buyer balance</span>
              <strong>{money(wallet)}</strong>
              <small>Completed and protected booking payments</small>
            </div>
            <WalletCards />
          </div>
          <Panel title="Transaction history">
            <TransactionRows bookings={myBookings} perspective="buyer" />
          </Panel>
        </>
      );
    if (section === "reviews")
      return (
        <>
          {pageHead(
            "Verified reviews",
            "Feedback tied to completed care.",
            "Reviews publish under the double-blind rules in the PRD.",
          )}
          <div className="review-grid">
            {myBookings
              .filter((b) => b.status === "completed")
              .map((b) => (
                <article className="review-card" key={b.id}>
                  <Star />
                  <h3>
                    {b.service} with {b.sellerName}
                  </h3>
                  <p>
                    {b.reviewedBy.includes(currentUserId)
                      ? "Your review was submitted and will publish under the review window rules."
                      : "This completed booking is eligible for one verified review."}
                  </p>
                  <button
                    disabled={b.reviewedBy.includes(currentUserId)}
                    onClick={() => {
                      setSelected(b.id);
                      setModal("review");
                    }}
                  >
                    {b.reviewedBy.includes(currentUserId)
                      ? "Review submitted"
                      : "Leave verified review"}
                  </button>
                </article>
              ))}
          </div>
        </>
      );
    if (section === "favorites") {
      const favoriteSellers = state.users.filter(
        (user) =>
          user.role === "seller" &&
          user.status === "active" &&
          state.favorites.includes(user.id),
      );
      return (
        <>
          {pageHead(
            "Favorite sellers",
            "Care relationships worth returning to.",
            "Favorites are private and blocked pairs never appear in matching.",
          )}
          <div className="favorite-seller-grid">
            {favoriteSellers.map((seller) => (
              <div className="favorite-seller-item" key={seller.id}>
                <CareSellerResultCard
                  seller={seller}
                  active={false}
                  favorite
                  onFocus={() => {
                    setSelected(seller.id);
                    setSection("providers");
                  }}
                  onFavorite={() => toggleFavorite(seller.id)}
                  preferredServiceName={seller.sellerDetails?.services[0]?.name}
                  profileHref={`/app/buyer/providers/${seller.id}`}
                  onProfile={() => {
                    setSelected(seller.id);
                    setSection("providers");
                  }}
                />
                <div className="favorite-seller-actions">
                  <span>
                    <BadgeCheck />
                    <b>Saved approved seller</b>
                    <small>
                      {seller.sellerDetails?.services.length ?? 0} healthcare
                      profile
                      {seller.sellerDetails?.services.length === 1 ? "" : "s"}
                    </small>
                  </span>
                  <button
                    className="quiet"
                    onClick={() => toggleFavorite(seller.id)}
                  >
                    <X /> Remove
                  </button>
                  <button
                    onClick={() =>
                      openRequestWizard(seller.sellerDetails?.services[0]?.id)
                    }
                  >
                    <HeartHandshake /> Request care
                  </button>
                </div>
              </div>
            ))}
            {!favoriteSellers.length &&
              empty(
                "No saved sellers yet",
                "Save approved sellers from Find care so you can return to their full healthcare profiles here.",
              )}
          </div>
        </>
      );
    }
    if (section === "household")
      return (
        <>
          {pageHead(
            "Care recipients",
            "Care details stay private.",
            "Store household members and care notes with participant-scoped access.",
            <button
              className="primary-action"
              onClick={() => {
                setSelected(null);
                setModal("household-member");
              }}
            >
              Add care recipient
            </button>,
          )}
          {householdMembers.map((member) => (
            <div className="care-recipient-card" key={member.id}>
              <div className="recipient-avatar">
                {member.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <span>{member.relationship}</span>
                <h3>{member.name}</h3>
                <p>{member.notes ?? "No private care notes added"}</p>
              </div>
              {status(member.active ? "active" : "inactive")}
              <button
                onClick={() => {
                  setSelected(member.id);
                  setModal("household-member");
                }}
              >
                Edit private care profile
              </button>
            </div>
          ))}
          {!householdMembers.length &&
            empty(
              "No care recipients",
              "Add the person who will receive care; details remain private.",
            )}
          <div className="info-banner">
            <ShieldCheck />
            <div>
              <b>Exact addresses and private care notes are never public.</b>
              <span>
                Sellers receive only the minimum details needed after an
                eligible booking is confirmed.
              </span>
            </div>
          </div>
        </>
      );
    if (section === "safety") return renderSafetyCenter();
    if (section === "notifications") return renderNotifications();
    return renderAccountCenter();
  }

  function renderSeller() {
    const sellerProfilePhotoUrl = sellerProfileForm.avatarPath
      ? getSupabase()
          ?.storage.from("public-profile-media")
          .getPublicUrl(sellerProfileForm.avatarPath).data.publicUrl
      : currentUser.avatarUrl;
    const sellerVerificationApproved = state.kyc.some(
      (item) => item.sellerId === currentUserId && item.status === "approved",
    );
    const sellerProfileComplete = Boolean(
      sellerProfileForm.displayName.trim() &&
        sellerProfileForm.headline.trim() &&
        sellerProfileForm.locality.trim() &&
        sellerProfileForm.languages.length,
    );
    const sellerHasPublicService = sellerServiceRows.some(
      (service) =>
        service.active &&
        service.rate > 0 &&
        (service.bio?.trim().length ?? 0) >= 40,
    );
    const sellerHasCoverage = sellerCoverageRows.some((area) => area.active);
    const sellerPublicReady =
      sellerProfileComplete &&
      sellerHasPublicService &&
      sellerHasCoverage &&
      sellerVerificationApproved;
    const sellerLockItems = [
      {
        label: "Complete public profile",
        done: sellerProfileComplete,
        action: "Edit profile",
        target: "profile",
      },
      {
        label: "Add at least one service bio and rate",
        done: sellerHasPublicService,
        action: "Add service",
        target: "services",
      },
      {
        label: "Add a service coverage area",
        done: sellerHasCoverage,
        action: "Set coverage",
        target: "profile",
      },
      {
        label: "Pass KYC / verification review",
        done: sellerVerificationApproved,
        action: "Upload KYC",
        target: "kyc",
      },
    ] as const;
    const sellerWorkspaceLoading = backendConnected && !sellerWorkspaceLoaded;
    const visibleSellerServiceRows = sellerWorkspaceLoading
      ? []
      : sellerServiceRows;
    if (section === "requests" && (selected ?? routeEntityId)) {
      const request = openRequests.find(
        (item) => item.id === (selected ?? routeEntityId),
      );
      if (!request)
        return (
          <DetailNotFound backHref="/app/seller/requests">
            This care request is unavailable or no longer matches this seller’s
            approved healthcare services and coverage.
          </DetailNotFound>
        );
      return (
        <NanasCareRequestDetail
          request={request}
          viewer="seller"
          currentUserId={currentUserId}
          busy={busy}
          onSubmitQuote={submitQuote}
          onAcceptQuote={() => undefined}
          onMessage={() =>
            notify("Secure messaging opens after the buyer accepts a quote.")
          }
        />
      );
    }
    if (section === "overview")
      return (
        <>
          <section className="workspace-welcome seller-welcome">
            <div>
              <span>
                <Sparkles /> Seller workspace
              </span>
              <h1>Welcome back, {currentUser.name.split(" ")[0]}.</h1>
              <p>
                Find care that fits your approved services, keep every visit
                organized, and grow trusted relationships across The Bahamas.
              </p>
              <div>
                <button onClick={() => setSection("requests")}>
                  <Search /> Browse matching requests
                </button>
                <button
                  className="quiet"
                  onClick={() => setSection("availability")}
                >
                  <Clock3 /> Update availability
                </button>
              </div>
            </div>
            <aside>
              <BadgeCheck />
              <b>Approved to provide care</b>
              <small>Profile 92% complete</small>
              <progress value="92" max="100" />
            </aside>
          </section>
          <div className="metric-grid">
            {metric(
              <Search />,
              "Open requests",
              String(sellerVisibleRequests.length),
              "Matching approved services",
              "mint",
            )}
            {metric(
              <ClipboardCheck />,
              "My quotes",
              String(myQuotes.length),
              "Care proposals sent",
              "blue",
            )}
            {metric(
              <CalendarDays />,
              "Active bookings",
              String(
                myBookings.filter(
                  (b) => !["completed", "cancelled"].includes(b.status),
                ).length,
              ),
              "Confirmed and in progress",
              "sand",
            )}
            {metric(
              <CircleDollarSign />,
              "Available earnings",
              money(wallet),
              "Simulated wallet balance",
              "lilac",
            )}
          </div>
          <div className="dashboard-grid">
            <Panel
              title="Recommended care requests"
              action={
                <button onClick={() => setSection("requests")}>
                  View all matches
                </button>
              }
            >
              <SellerJobCards
                requests={sellerVisibleRequests.slice(0, 3)}
                compact
              />
            </Panel>
            <Panel title="Your next steps">
              <TaskList
                items={[
                  `${myQuotes.filter((quote) => quote.status === "pending").length} quote(s) awaiting a buyer decision`,
                  `${myBookings.filter((booking) => booking.status === "confirmed").length} confirmed visit(s) to prepare for`,
                  `${sellerServiceRows.filter((service) => service.active).length} approved service(s) visible to buyers`,
                ]}
              />
            </Panel>
          </div>
        </>
      );
    if (section === "requests")
      return (
        <>
          {pageHead(
            "Care request marketplace",
            "Healthcare requests that match you.",
            "Open a complete AnyJob-style care brief before deciding whether to quote. Exact addresses remain private.",
          )}
          <SellerJobFilters total={openRequests.length} />
          <SellerJobCards requests={sellerVisibleRequests} />
        </>
      );
    if (section === "quotes")
      return (
        <>
          {pageHead(
            "My quotes",
            "Clear proposals for real care needs.",
            "Track whether each buyer is reviewing, accepted, or declined your quote.",
          )}
          <div className="quote-grid">
            {myQuotes.length
              ? myQuotes.map(({ request, ...quote }) => (
                  <QuoteCard key={quote.id} quote={quote} request={request} />
                ))
              : empty(
                  "No quotes sent",
                  "Find a matching care request and send a clear healthcare quote.",
                )}
          </div>
        </>
      );
    if (section === "bookings")
      return (
        <>
          {pageHead(
            "Seller bookings",
            "Deliver care with a clear visit record.",
            "Check in, check out, message the buyer, and follow completion status.",
          )}
          <Panel title={`${myBookings.length} care bookings`}>
            <BookingRows bookings={myBookings} />
          </Panel>
        </>
      );
    if (section === "messages") return renderMessages();
    if (section === "availability")
      return (
        <>
          {pageHead(
            "Availability",
            "Share when you can provide care.",
            "Set recurring appointment availability in America/Nassau.",
            <button
              className="primary-action"
              onClick={() => setModal("weekly-availability")}
            >
              Set weekly availability
            </button>,
          )}
          <div className="availability-week">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
              const rule = availabilityRows.find(
                (item) => item.weekday === i && item.active,
              );
              return (
                <article key={day}>
                  <b>{day}</b>
                  {rule ? (
                    <>
                      <span>{rule.start.slice(0, 5)}</span>
                      <span>{rule.end.slice(0, 5)}</span>
                    </>
                  ) : (
                    <small>Unavailable</small>
                  )}
                </article>
              );
            })}
          </div>
          <div className="info-banner">
            <Clock3 />
            <div>
              <b>Timezone: America/Nassau</b>
              <span>
                Nanas prevents confirmed care bookings from overlapping at the
                database level.
              </span>
            </div>
          </div>
        </>
      );
    if (section === "services")
      return (
        <>
          {pageHead(
            "Service profiles & rates",
            "Give every healthcare service its own story.",
            "Create 1–3 service profiles. Buyers can switch between them to compare each dedicated biography, experience, qualifications, additional help and BSD rate range.",
            <button
              className="primary-action"
              disabled={
                sellerWorkspaceLoading || visibleSellerServiceRows.length >= 3
              }
              onClick={() => {
                setSelected(null);
                setModal("seller-service");
              }}
            >
              {sellerWorkspaceLoading
                ? "Loading profile"
                : visibleSellerServiceRows.length >= 3
                  ? "3 of 3 profiles added"
                  : "Add service profile"}
            </button>,
          )}
          {sellerWorkspaceLoading ? (
            <section className="seller-public-lock seller-public-lock-loading">
              <LockKeyhole />
              <div>
                <b>Loading your real seller profile…</b>
                <span>
                  Checking Supabase before showing service cards, so demo data
                  does not flash on refresh.
                </span>
              </div>
            </section>
          ) : (
            <section
              className={
                sellerPublicReady
                  ? "seller-public-lock ready"
                  : "seller-public-lock"
              }
            >
              {sellerPublicReady ? <BadgeCheck /> : <LockKeyhole />}
              <div>
                <b>
                  {sellerPublicReady
                    ? "Profile visible in Find Care"
                    : "Profile hidden from buyer search"}
                </b>
                <span>
                  {sellerPublicReady
                    ? "Buyers can find this seller because profile, services, coverage, and KYC are complete."
                    : "Finish the required items below before this seller appears in public Find Care results."}
                </span>
                <ul>
                  {sellerLockItems.map((item) => (
                    <li key={item.label} className={item.done ? "done" : ""}>
                      <Check />
                      <span>{item.label}</span>
                      {!item.done && (
                        <button onClick={() => setSection(item.target)}>
                          {item.action}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <div className="seller-service-limit">
            <Stethoscope />
            <div>
              <b>{visibleSellerServiceRows.length} of 3 service profiles</b>
              <span>
                Keep at least one active. Every category has its own About
                section and care qualifications.
              </span>
            </div>
          </div>
          <div className="service-manage-grid seller-service-profile-grid">
            {visibleSellerServiceRows.map((service) => (
              <article key={service.id}>
                <Stethoscope />
                <div>
                  <span>{service.yearsExperience} years experience</span>
                  <h3>{service.name}</h3>
                  <p>
                    {service.bio ??
                      "Add a dedicated public biography for this service."}
                  </p>
                  <div className="seller-service-capabilities">
                    {service.capabilities.slice(0, 6).map((item) => (
                      <i key={item}>
                        <Check />
                        {item}
                      </i>
                    ))}
                  </div>
                </div>
                {status(service.active ? "active" : "inactive")}
                <label>
                  {money(service.rate)}
                  {service.rateMax ? `–${money(service.rateMax)}` : ""} / hour
                </label>
                <button
                  onClick={() => {
                    setSelected(service.serviceId);
                    setModal("seller-service");
                  }}
                >
                  Edit full profile
                </button>
              </article>
            ))}
          </div>
          {!sellerWorkspaceLoading &&
            !visibleSellerServiceRows.length &&
            empty(
              "No service profiles yet",
              "Add your first approved healthcare service and complete its buyer-facing details.",
            )}
        </>
      );
    if (section === "profile")
      return (
        <>
          {pageHead(
            "Profile & coverage",
            "Build the profile buyers compare.",
            "Manage the exact public fields used by Find Care and your full seller profile. Services, availability, verification, badges and reviews stay connected to their authoritative records.",
          )}
          <SellerProfileStudio
            user={currentUser}
            profile={sellerProfileForm}
            photoUrl={sellerProfilePhotoUrl}
            islands={liveIslands}
            services={sellerServiceRows}
            availability={availabilityRows}
            coverage={sellerCoverageRows}
            verificationApproved={sellerVerificationApproved}
            onSubmit={saveSellerProfile}
            onEditServices={() => setSection("services")}
            onEditAvailability={() => setSection("availability")}
            onEditCoverage={() => setModal("seller-coverage")}
            onOpenVerification={() => setSection("kyc")}
          />
        </>
      );
    if (section === "earnings")
      return (
        <>
          {pageHead(
            "Earnings & wallet",
            "Your completed-care ledger.",
            "Gross, Nanas fee, net earnings, holds, and payout simulation stay auditable.",
          )}
          <div className="wallet-hero seller">
            <div>
              <span>Available to pay out</span>
              <strong>{money(wallet)}</strong>
              <small>BSD · Simulated settlement</small>
            </div>
            <button onClick={simulatePayout} disabled={wallet <= 0}>
              Simulate payout
            </button>
          </div>
          <Panel title="Earning history">
            <TransactionRows bookings={myBookings} perspective="seller" />
          </Panel>
          <Panel title="Payout history">
            <div className="transaction-list">
              {state.payouts.filter((item) => item.sellerId === currentUserId).map((item) => (
                <div key={item.id}>
                  <span className="transaction-icon seller"><WalletCards /></span>
                  <div><b>Simulated payout</b><small>{dateTime(item.createdAt)}</small></div>
                  {status(item.status)}
                  <strong>-{money(item.amount)}</strong>
                </div>
              ))}
              {!state.payouts.some((item) => item.sellerId === currentUserId) && empty("No payouts", "Scheduled simulated payouts will appear here.")}
            </div>
          </Panel>
        </>
      );
    if (section === "kyc")
      return (
        <>
          {pageHead(
            "Verification & credentials",
            "Trust labels backed by review records.",
            "Upload private identity, credential, insurance, and background-check files.",
            <button
              className="primary-action"
              onClick={() => setModal("kyc-upload")}
            >
              Upload document
            </button>,
          )}
          <Panel title="Your verification files">
            <KycRows
              rows={state.kyc.filter((item) => item.sellerId === currentUserId)}
            />
          </Panel>
        </>
      );
    if (section === "badges")
      return (
        <>
          {pageHead(
            "Badges & reviews",
            "Earn trust through verified evidence.",
            "Credential badges reflect current records; performance badges follow versioned rules.",
          )}
          <div className="badge-showcase">
            {[
              "Identity verified",
              "RN credential",
              "Highly rated",
              "Reliable responder",
            ].map((name, i) => (
              <article key={name}>
                <div>
                  <BadgeCheck />
                </div>
                <h3>{name}</h3>
                <p>
                  {i < 2
                    ? "Verified and current"
                    : "Earned from completed bookings and response metrics"}
                </p>
                {status(i < 3 ? "approved" : "pending")}
              </article>
            ))}
          </div>
        </>
      );
    if (section === "safety") return renderSafetyCenter();
    if (section === "notifications") return renderNotifications();
    return renderAccountCenter();
  }

  function renderAdmin() {
    if (section === "overview")
      return (
        <>
          <section className="workspace-welcome admin-welcome">
            <div>
              <span>
                <Activity /> Live operations
              </span>
              <h1>Healthcare marketplace control centre.</h1>
              <p>
                One place for trust, care delivery, safety, simulated money, and
                platform health.
              </p>
              <div>
                <button onClick={() => setSection("kyc")}>
                  <UserRoundCheck /> Review KYC queue
                </button>
                <button className="quiet" onClick={() => setSection("cases")}>
                  <LifeBuoy /> Open safety desk
                </button>
              </div>
            </div>
            <aside>
              <ShieldCheck />
              <b>Protected operations</b>
              <small>RLS, storage and audited admin commands active</small>
            </aside>
          </section>
          <div className="metric-grid admin-metrics">
            {metric(
              <Users />,
              "Active users",
              String(adminOverview.activeUsers),
              "Buyer and individual seller accounts",
              "mint",
            )}
            {metric(
              <FileCheck2 />,
              "KYC queue",
              String(adminOverview.sellersUnderReview),
              "Manual beta verification",
              "blue",
            )}
            {metric(
              <CalendarDays />,
              "Active bookings",
              String(adminOverview.activeBookings),
              `${adminOverview.openRequests} open care request(s)`,
              "sand",
            )}
            {metric(
              <LifeBuoy />,
              "Open disputes",
              String(adminOverview.openDisputes),
              `${adminOverview.moderationQueue} moderation item(s)`,
              "coral",
            )}
          </div>
          <div className="dashboard-grid">
            <Panel title="Operations queues">
              <TaskList
                items={[
                  `${state.kyc.filter((k) => k.status === "pending").length} KYC case(s) awaiting review`,
                  `${adminOverview.openDisputes} dispute(s) open`,
                  `${adminOverview.moderationQueue} moderation report(s) open`,
                  `${state.users.filter((u) => u.status !== "active").length} restricted or suspended account(s)`,
                ]}
              />
            </Panel>
            <Panel title="Platform health">
              <div className="health-list">
                <span>
                  <i className="good" />
                  Database & RLS <b>Ready</b>
                </span>
                <span>
                  <i className="good" />
                  Storage buckets <b>Ready</b>
                </span>
                <span>
                  <i
                    className={adminOps.deadLetters.length ? "warn" : "good"}
                  />
                  Dead letters <b>{adminOps.deadLetters.length}</b>
                </span>
                <span>
                  <i className="warn" />
                  Payments & payouts <b>Simulated</b>
                </span>
              </div>
            </Panel>
          </div>
        </>
      );
    if (section === "users")
      return (
        <>
          {pageHead(
            "User management",
            "Buyer and seller account enforcement.",
            "Restrict, suspend, ban, or restore with a required reason and immutable audit event.",
          )}
          <Panel title={`${state.users.length} accounts`}>
            <div className="data-table">
              <div className="table-head">
                <span>User</span>
                <span>Role</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              {state.users
                .filter((u) => u.role !== "admin")
                .map((u) => (
                  <div className="table-row" key={u.id}>
                    <span className="user-cell">
                      <i>{u.avatar}</i>
                      <b>
                        {u.name}
                        <small>{u.email}</small>
                      </b>
                    </span>
                    <span>{u.role}</span>
                    <span>{status(u.status)}</span>
                    <span>
                      <button
                        onClick={() => {
                          setSelected(u.id);
                          setModal("user-action");
                        }}
                      >
                        Manage
                      </button>
                    </span>
                  </div>
                ))}
            </div>
          </Panel>
        </>
      );
    if (section === "kyc")
      return (
        <>
          {pageHead(
            "KYC & credential review",
            "Review evidence with a decision trail.",
            "Sensitive document reads require purpose logging; only approved facts create public badges.",
          )}
          <Panel title="Verification queue">
            <KycRows rows={state.kyc} admin />
          </Panel>
        </>
      );
    if (section === "bookings")
      return (
        <>
          {pageHead(
            "Booking operations",
            "Every care visit and transition.",
            "Inspect status, participants, value, and timing without editing immutable history.",
          )}
          <Panel title={`${state.bookings.length} bookings`}>
            <BookingRows bookings={state.bookings} />
          </Panel>
        </>
      );
    if (section === "disputes")
      return (
        <>
          {pageHead(
            "Disputes & safety",
            "Human-reviewed case resolution.",
            "Review booking, message, check-in, payment, and evidence context before any outcome.",
          )}
          <div className="case-grid">
            {state.disputes.map((d) => (
              <article className="case-card" key={d.id}>
                <header>
                  {status(d.status)}
                  <span>Normal priority</span>
                </header>
                <h3>{d.reason}</h3>
                <p>{d.summary}</p>
                <small>
                  Booking {d.bookingId} · Opened by {d.openedBy}
                </small>
                {d.resolution && (
                  <div className="resolution">
                    <Check />
                    {d.resolution}
                  </div>
                )}
                <footer>
                  <button
                    onClick={() => {
                      setSelected(d.id);
                      setModal("dispute-review");
                    }}
                  >
                    View evidence
                  </button>
                  <button
                    className="primary"
                    disabled={d.status === "resolved"}
                    onClick={() => {
                      setSelected(d.id);
                      setModal("dispute-review");
                    }}
                  >
                    {d.status === "resolved" ? "Resolved" : "Resolve case"}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </>
      );
    if (section === "messages")
      return (
        <>
          {pageHead(
            "Message audit",
            "Purpose-gated conversation access.",
            "Admin message reads require a case context and are recorded in a separate sensitive-access log.",
          )}
          <div className="audit-conversations">
            {state.bookings.map((b) => (
              <article key={b.id}>
                <MessageCircle />
                <div>
                  <h3>
                    {b.buyerName} ↔ {b.sellerName}
                  </h3>
                  <p>
                    {b.reference} ·{" "}
                    {
                      state.messages.filter(
                        (m) => m.conversationId === b.conversationId,
                      ).length
                    }{" "}
                    messages
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelected(b.conversationId);
                    setModal("message-audit");
                  }}
                >
                  Open with purpose
                </button>
              </article>
            ))}
          </div>
          {selected && !modal && <Conversation conversationId={selected} />}
        </>
      );
    if (section === "moderation") {
      const openReports = state.moderationReports.filter(
        (item) => item.status !== "resolved",
      );
      const profileReports = openReports.filter(
        (item) =>
          item.targetType === "seller_profile" || item.targetType === "user",
      );
      const messageReports = openReports.filter(
        (item) => item.targetType === "message",
      );
      const reviewReports = openReports.filter(
        (item) => item.targetType === "review",
      );
      return (
        <>
          {pageHead(
            "Content moderation",
            "Keep public healthcare content precise.",
            "Review profiles, messages, reviews, and reports without silently rewriting user history.",
          )}
          <div className="moderation-grid">
            <article>
              <ShieldCheck />
              <h3>Profile reports</h3>
              <strong>{profileReports.length}</strong>
              <p>Credential and public-profile concerns</p>
            </article>
            <article>
              <MessageCircle />
              <h3>Message flags</h3>
              <strong>{messageReports.length}</strong>
              <p>Purpose-gated message review remains audited</p>
            </article>
            <article>
              <Star />
              <h3>Review reports</h3>
              <strong>{reviewReports.length}</strong>
              <p>Verified-care feedback awaiting a decision</p>
            </article>
          </div>
          <Panel title={`${openReports.length} open moderation report(s)`}>
            {openReports.length ? (
              <div className="list-rows">
                {openReports.map((item) => (
                  <article key={item.id}>
                    <div className="list-icon">
                      <ShieldCheck />
                    </div>
                    <div className="list-main">
                      <b>{item.reason}</b>
                      <span>
                        {item.targetType} · {item.targetId}
                      </span>
                      <small>
                        {item.details ?? "No additional reporter details"} ·{" "}
                        {dateTime(item.createdAt)}
                      </small>
                    </div>
                    <div className="list-side">
                      {status(item.status)}
                      <button
                        onClick={() => {
                          setSelected(item.id);
                          setModal("moderation-action");
                        }}
                      >
                        Review
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              empty(
                "Moderation queue clear",
                "New profile, message, review, and user reports will appear here.",
              )
            )}
          </Panel>
        </>
      );
    }
    if (section === "finance")
      return (
        <>
          {pageHead(
            "Finance & reconciliation",
            "Simulated protected money with real ledger rules.",
            "Debits equal credits; refunds, payouts, holds, and reconciliations remain traceable.",
          )}
          <div className="metric-grid">
            {metric(
              <CircleDollarSign />,
              "Captured volume",
              money(adminOverview.simulatedVolume),
              "Authoritative admin overview",
              "mint",
            )}
            {metric(
              <WalletCards />,
              "Seller payable",
              money(
                state.bookings
                  .filter((b) => b.status === "completed")
                  .reduce((s, b) => s + b.sellerNet, 0) -
                  state.payouts.reduce((sum, payout) => sum + payout.amount, 0),
              ),
              "Available seller wallets",
              "blue",
            )}
            {metric(
              <Activity />,
              "Platform fees",
              money(
                state.bookings.reduce(
                  (sum, booking) =>
                    sum +
                    (booking.status === "cancelled"
                      ? (booking.cancellationFee ?? 0)
                      : booking.total - booking.sellerNet),
                  0,
                ),
              ),
              "Snapshotted simulation",
              "sand",
            )}
          </div>
          <Panel title="Ledger-linked booking activity">
            <TransactionRows bookings={state.bookings} perspective="admin" />
          </Panel>
        </>
      );
    if (section === "notifications") {
      const channels = ["in_app", "push", "email", "sms"];
      return (
        <>
          {pageHead(
            "Notification delivery",
            "Transactional outbox health.",
            "In-app, push, email, and SMS attempts are deduplicated, retried, and audited.",
          )}
          <div className="delivery-grid">
            {channels.map((channel) => {
              const attempts = adminOps.deliveries.filter(
                (item) => item.channel === channel,
              );
              const delivered = attempts.filter(
                (item) => item.status === "delivered",
              ).length;
              return (
                <article key={channel}>
                  <i
                    className={
                      attempts.some(
                        (item) =>
                          item.status === "failed" ||
                          item.status === "dead_letter",
                      )
                        ? "warn"
                        : "good"
                    }
                  />
                  <span>{channel.replace("_", " ")}</span>
                  <strong>
                    {attempts.length
                      ? `${Math.round((delivered / attempts.length) * 100)}%`
                      : channel === "in_app"
                        ? `${adminOps.outbox.length} queued`
                        : "Simulated"}
                  </strong>
                  <small>
                    {attempts.length
                      ? `${delivered}/${attempts.length} delivered`
                      : "Vendor not configured or worker local"}
                  </small>
                </article>
              );
            })}
          </div>
          <Panel title={`${adminOps.outbox.length} recent outbox event(s)`}>
            <div className="list-rows">
              {adminOps.outbox.length
                ? adminOps.outbox.map((item) => (
                    <article key={item.id}>
                      <div className="list-icon">
                        <Bell />
                      </div>
                      <div className="list-main">
                        <b>{item.template}</b>
                        <span>
                          {item.category} · {item.id}
                        </span>
                        <small>{dateTime(item.createdAt)}</small>
                      </div>
                      <div className="list-side">
                        {status(item.status)}
                        <small>{item.attempts} attempt(s)</small>
                      </div>
                    </article>
                  ))
                : empty(
                    "Outbox clear",
                    "New domain notifications will appear here before local worker delivery.",
                  )}
            </div>
          </Panel>
        </>
      );
    }
    if (section === "catalog")
      return (
        <>
          {pageHead(
            "Healthcare catalog",
            "Admin-managed eligible care services.",
            "Pricing units, credential requirements, booking rules, risk level, and launch areas are configurable.",
            <button
              className="primary-action"
              onClick={() => {
                setSelected(null);
                setModal("catalog-service");
              }}
            >
              Add care service
            </button>,
          )}
          <div className="catalog-admin-grid">
            {adminOps.services.map((service) => (
              <article key={service.id}>
                <div>
                  <Stethoscope />
                  <span>
                    {service.riskLevel} · per {service.pricingUnit}
                  </span>
                </div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <footer>
                  {status(service.active ? "active" : "inactive")}
                  <button
                    onClick={() => {
                      setSelected(service.id);
                      setModal("catalog-service");
                    }}
                  >
                    Configure
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </>
      );
    if (section === "areas")
      return (
        <>
          {pageHead(
            "Islands & service areas",
            "Bahamas launch coverage.",
            "Manage active islands, zones, boundaries, travel defaults, and healthcare-service availability without changing historical bookings.",
            <button
              className="primary-action"
              onClick={() => {
                setSelected(null);
                setModal("catalog-area");
              }}
            >
              Add service area
            </button>,
          )}
          <div className="catalog-admin-grid">
            {adminOps.areas.map((area) => (
              <article key={area.id}>
                <div>
                  <House />
                  <span>{area.active ? "Active" : "Paused"}</span>
                </div>
                <h3>{area.name}</h3>
                <p>{area.islandName} · America/Nassau</p>
                <footer>
                  {status(area.active ? "active" : "inactive")}
                  <button
                    onClick={() => {
                      setSelected(area.id);
                      setModal("catalog-area");
                    }}
                  >
                    Configure
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </>
      );
    if (section === "cases")
      return (
        <>
          {pageHead(
            "Safety & support operations",
            "Urgent incidents and support SLAs.",
            "Acknowledge, assign, investigate, resolve, and communicate without claiming external emergency contact unless confirmed.",
          )}
          <div className="metric-grid">
            {metric(
              <LifeBuoy />,
              "Open safety incidents",
              String(
                state.safetyIncidents.filter(
                  (item) => item.status !== "resolved",
                ).length,
              ),
              "High-priority response queue",
              "coral",
            )}
            {metric(
              <MessageCircle />,
              "Open support cases",
              String(
                state.supportCases.filter((item) => item.status !== "resolved")
                  .length,
              ),
              "Buyer and seller help",
              "blue",
            )}
            {metric(
              <Clock3 />,
              "Overdue SLAs",
              "0",
              "Escalation policy healthy",
              "mint",
            )}
          </div>
          <div className="dashboard-grid">
            <Panel title="Safety incident queue">
              <div className="list-rows">
                {state.safetyIncidents.length
                  ? state.safetyIncidents.map((item) => (
                      <article key={item.id}>
                        <div className="list-icon">
                          <LifeBuoy />
                        </div>
                        <div className="list-main">
                          <b>{item.category.replaceAll("_", " ")}</b>
                          <span>
                            {item.bookingId
                              ? `Booking ${item.bookingId}`
                              : "Account-level safety report"}{" "}
                            · Reporter {item.reporterId}
                          </span>
                          <small>{dateTime(item.createdAt)}</small>
                        </div>
                        <div className="list-side">
                          {status(item.status)}
                          <button
                            disabled={item.status === "resolved"}
                            onClick={() => {
                              setSelected(item.id);
                              setSelectedCaseKind("safety");
                              setModal("operations-case");
                            }}
                          >
                            Manage
                          </button>
                        </div>
                      </article>
                    ))
                  : empty(
                      "Safety queue clear",
                      "Urgent safety reports will appear here for audited handling.",
                    )}
              </div>
            </Panel>
            <Panel title="Support queue">
              <div className="list-rows">
                {state.supportCases.length
                  ? state.supportCases.map((item) => (
                      <article key={item.id}>
                        <div className="list-icon">
                          <MessageCircle />
                        </div>
                        <div className="list-main">
                          <b>{item.subject}</b>
                          <span>
                            {item.category} · {item.openedBy}
                          </span>
                          <small>{dateTime(item.createdAt)}</small>
                        </div>
                        <div className="list-side">
                          {status(item.status)}
                          <button
                            disabled={item.status === "resolved"}
                            onClick={() => {
                              setSelected(item.id);
                              setSelectedCaseKind("support");
                              setModal("operations-case");
                            }}
                          >
                            Manage
                          </button>
                        </div>
                      </article>
                    ))
                  : empty(
                      "Support queue clear",
                      "New buyer and seller support requests will appear here.",
                    )}
              </div>
            </Panel>
          </div>
        </>
      );
    if (section === "analytics") {
      const fulfilled = state.requests.filter(
        (item) =>
          item.status === "confirmed" &&
          state.bookings.some(
            (booking) =>
              booking.requestId === item.id && booking.status !== "cancelled",
          ),
      ).length;
      return (
        <>
          {pageHead(
            "Analytics & exports",
            "Operational decisions from redacted metrics.",
            "Funnel, supply, fulfillment, cancellations, GMV, fees, refunds, disputes, delivery, and safety metrics use permission-based redaction.",
            <button
              className="primary-action"
              onClick={() =>
                notify(
                  "Redacted CSV export queued in the private exports bucket.",
                )
              }
            >
              Queue export
            </button>,
          )}
          <div className="metric-grid">
            {metric(
              <Users />,
              "Approved sellers",
              String(
                state.users.filter(
                  (item) => item.role === "seller" && item.status === "active",
                ).length,
              ),
              "Individual healthcare sellers",
              "mint",
            )}
            {metric(
              <CalendarDays />,
              "Fulfillment",
              `${Math.round((fulfilled / Math.max(state.requests.length, 1)) * 100)}%`,
              `${fulfilled}/${state.requests.length} care requests confirmed`,
              "blue",
            )}
            {metric(
              <CircleDollarSign />,
              "Simulated GMV",
              money(adminOverview.simulatedVolume),
              "BSD captured booking value",
              "sand",
            )}
            {metric(
              <LifeBuoy />,
              "Dispute rate",
              `${Math.round((state.disputes.length / Math.max(state.bookings.length, 1)) * 100)}%`,
              "Connected scenario data",
              "coral",
            )}
          </div>
          <Panel title="Saved operational views">
            <TaskList
              items={[
                "Seller approval funnel",
                "Care request to confirmed booking",
                "Cancellation and refund reasons",
                "Notification delivery failures",
                "Credential expiry forecast",
              ]}
            />
          </Panel>
        </>
      );
    }
    if (section === "access")
      return (
        <>
          {pageHead(
            "Permissions & privacy",
            "Least-privilege operations.",
            "Admin permission scopes, privacy requests, sensitive reads, retention exceptions, and legal holds remain separately auditable.",
          )}
          <div className="dashboard-grid">
            <Panel title="Current admin scopes">
              <TaskList
                items={[
                  "users.enforce",
                  "kyc.review",
                  "messages.read · purpose required",
                  "finance.read",
                  "privacy.manage",
                ]}
              />
            </Panel>
            <Panel title={`${state.privacyRequests.length} privacy request(s)`}>
              {state.privacyRequests.length ? (
                <div className="list-rows">
                  {state.privacyRequests.map((item) => (
                    <article key={item.id}>
                      <div className="list-icon">
                        <ShieldCheck />
                      </div>
                      <div className="list-main">
                        <b>{item.type} request</b>
                        <span>{item.userId}</span>
                        <small>{dateTime(item.createdAt)}</small>
                      </div>
                      <div className="list-side">
                        {status(item.status)}
                        <button
                          disabled={item.status === "completed"}
                          onClick={() => {
                            setSelected(item.id);
                            setModal("privacy-action");
                          }}
                        >
                          {item.status === "completed" ? "Completed" : "Process"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                empty(
                  "No privacy requests",
                  "Export and deletion cases will appear here.",
                )
              )}
            </Panel>
          </div>
        </>
      );
    if (section === "workers")
      return (
        <>
          {pageHead(
            "Workers & integrations",
            "Background health and recovery controls.",
            "Review worker schedules, dead letters, vendor adapters, webhook health, and runbook links before replaying any failed work.",
          )}
          <div className="delivery-grid">
            {adminOps.workers.map((worker) => (
              <article key={worker.key}>
                <i
                  className={
                    worker.enabled && worker.health !== "failed"
                      ? "good"
                      : "warn"
                  }
                />
                <span>{worker.key}</span>
                <strong>{worker.enabled ? worker.health : "Disabled"}</strong>
                <small>
                  {worker.lastRunAt
                    ? `Last run ${dateTime(worker.lastRunAt)}`
                    : `Schedule ${worker.schedule}`}
                </small>
              </article>
            ))}
          </div>
          <Panel
            title={`${adminOps.workerRuns.length} recent worker run(s) · ${adminOps.deadLetters.length} dead letter(s)`}
          >
            <div className="list-rows">
              {adminOps.workerRuns.length
                ? adminOps.workerRuns.map((run) => (
                    <article key={run.id}>
                      <div className="list-icon">
                        <Activity />
                      </div>
                      <div className="list-main">
                        <b>{run.key}</b>
                        <span>
                          {run.processed} item(s) processed ·{" "}
                          {run.error ?? "No recorded error"}
                        </span>
                        <small>{dateTime(run.startedAt)}</small>
                      </div>
                      <div className="list-side">{status(run.status)}</div>
                    </article>
                  ))
                : empty(
                    "No worker runs yet",
                    "Workers remain local and intentionally undeployed; verified runs will appear here.",
                  )}
            </div>
          </Panel>
        </>
      );
    if (section === "audit")
      return (
        <>
          {pageHead(
            "Audit log",
            "Privileged actions never disappear.",
            "Enforcement, KYC, message access, finance, configuration and sensitive reads are captured with purpose and reason.",
          )}
          <Panel
            title={`${adminOps.audits.length} recent privileged action(s)`}
          >
            <div className="audit-log">
              {adminOps.audits.map((event) => (
                <div key={event.id}>
                  <ShieldCheck />
                  <span>
                    <b>{event.action}</b>
                    <small>
                      {event.targetType}
                      {event.targetId ? ` · ${event.targetId}` : ""} ·{" "}
                      {event.reason} · {dateTime(event.createdAt)}
                    </small>
                  </span>
                  <code>{event.traceId.slice(0, 13)}</code>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={`${adminOps.accessLogs.length} sensitive read(s)`}>
            <div className="audit-log">
              {adminOps.accessLogs.map((event) => (
                <div key={event.id}>
                  <BookOpenCheck />
                  <span>
                    <b>
                      {event.resourceType} · {event.purpose}
                    </b>
                    <small>
                      {event.fields.join(", ")} · {dateTime(event.createdAt)}
                    </small>
                  </span>
                  <code>{event.id.slice(0, 13)}</code>
                </div>
              ))}
            </div>
          </Panel>
        </>
      );
    return (
      <>
        {pageHead(
          "Platform configuration",
          "Change behavior without changing entities.",
          "Feature flags, Bahamas market defaults, posting fees, listing durations, hold windows, and worker schedules are versioned.",
          <button
            className="primary-action"
            onClick={() => {
              setSelected(null);
              setModal("posting-plan");
            }}
          >
            Add posting plan
          </button>,
        )}
        <Panel title="Buyer job-posting plans">
          <div className="admin-posting-plans">
            {adminOps.postingPlans.map((plan) => (
              <article key={plan.id}>
                <header>
                  <span>{plan.featured ? "Priority" : "Standard"}</span>
                  {status(plan.active ? "active" : "inactive")}
                </header>
                <h3>{plan.name}</h3>
                <strong>{plan.fee === 0 ? "Free" : money(plan.fee)}</strong>
                <p>{plan.description}</p>
                <small>
                  {plan.durationDays} days live · {plan.freePostAllowance} free
                  post allowance
                </small>
                <button
                  onClick={() => {
                    setSelected(plan.id);
                    setModal("posting-plan");
                  }}
                >
                  Edit fee & duration
                </button>
              </article>
            ))}
          </div>
        </Panel>
        <div className="settings-grid">
          {adminOps.flags.map((flag) => (
            <div key={flag.key}>
              <span>
                <b>{flag.key.replaceAll("_", " ")}</b>
                <small>
                  {flag.description} · {flag.rollout}% rollout · updated{" "}
                  {dateTime(flag.updatedAt)}
                </small>
              </span>
              <input
                aria-label={`${flag.key} feature flag`}
                type="checkbox"
                checked={flag.enabled}
                onChange={(event) =>
                  void toggleAdminFlag(flag.key, event.target.checked)
                }
              />
            </div>
          ))}
        </div>
        <div className="info-banner">
          <Settings />
          <div>
            <b>Market defaults</b>
            <span>The Bahamas · BSD · America/Nassau · +1-242</span>
          </div>
        </div>
      </>
    );
  }

  function renderMessages() {
    const conversations = myBookings;
    const activeConversationId = selected ?? conversations[0]?.conversationId;
    return (
      <>
        {pageHead(
          "Secure messages",
          "Booking-scoped care conversations.",
          "Messages, files, and read state stay tied to authorized booking participants.",
        )}
        <div className="message-layout">
          <div className="conversation-list">
            {conversations.map((booking) => {
              const locked = isBuyerConversationPaywalled(
                booking.conversationId,
              );
              return (
                <button
                  className={[
                    activeConversationId === booking.conversationId
                      ? "active"
                      : "",
                    locked ? "locked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={booking.id}
                  onClick={() => setSelected(booking.conversationId)}
                >
                  <span>
                    {role === "buyer"
                      ? booking.sellerName.slice(0, 2)
                      : booking.buyerName.slice(0, 2)}
                  </span>
                  <div>
                    <b>
                      {role === "buyer"
                        ? booking.sellerName
                        : booking.buyerName}
                    </b>
                    <small>
                      {booking.reference} · {booking.service}
                    </small>
                    {locked && (
                      <small className="conversation-lock">
                        <LockKeyhole /> Upgrade to view seller reply
                      </small>
                    )}
                  </div>
                  <ChevronRight />
                </button>
              );
            })}
          </div>
          {activeConversationId ? (
            <Conversation conversationId={activeConversationId} />
          ) : (
            <div className="message-empty">
              <MessageCircle />
              <h3>Choose a conversation</h3>
              <p>Secure booking messages will appear here.</p>
            </div>
          )}
        </div>
      </>
    );
  }
  function Conversation({ conversationId }: { conversationId: string }) {
    const booking = state.bookings.find(
      (b) => b.conversationId === conversationId,
    );
    const messages = state.messages.filter(
      (m) => m.conversationId === conversationId,
    );
    const paywalled = isBuyerConversationPaywalled(conversationId);
    const otherPartyName =
      role === "buyer" ? booking?.sellerName : booking?.buyerName;
    return (
      <div className="message-thread">
        <header>
          <div>
            <b>{booking?.reference ?? "Case conversation"}</b>
            <span>{booking?.service ?? "Admin purpose-gated view"}</span>
          </div>
          {role !== "admin" && paywalled ? (
            <button
              className="message-upgrade-button"
              onClick={() => openMessageUpgrade(conversationId)}
            >
              Upgrade to reply
            </button>
          ) : role !== "admin" ? (
            <button
              onClick={() => {
                setModal("message");
                setSelected(conversationId);
              }}
            >
              New message
            </button>
          ) : null}
        </header>
        <div className={paywalled ? "thread-scroll paywalled" : "thread-scroll"}>
          {!paywalled && <div>
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.senderId === currentUserId ? "message mine" : "message"
                }
              >
                <b>{m.senderName}</b>
                <p>{m.body}</p>
                <small>{dateTime(m.at)}</small>
              </div>
            ))}
            {!messages.length &&
              empty("No messages yet", "Start a secure booking conversation.")}
          </div>}
          {paywalled && (
            <div className="message-paywall-scrim">
              <article className="message-paywall-card">
                <div>
                  <MessageCircle />
                </div>
                <h3>View your conversation with {otherPartyName}</h3>
                <p>
                  Upgrade now to see seller messages and continue your care
                  conversation.
                </p>
                <button onClick={() => openMessageUpgrade(conversationId)}>
                  Upgrade to view
                </button>
              </article>
            </div>
          )}
        </div>
      </div>
    );
  }
  function RequestRows({
    requests,
    seller = false,
  }: {
    requests: DemoRequest[];
    seller?: boolean;
  }) {
    return (
      <div className="list-rows">
        {requests.length
          ? requests.map((request) => (
              <article key={request.id}>
                <div className="list-icon">
                  <HeartHandshake />
                </div>
                <div className="list-main">
                  <b>{request.service}</b>
                  <span>{request.summary}</span>
                  <small>
                    {request.mode === "on_demand" ? "On-demand" : "Scheduled"} ·{" "}
                    {dateTime(request.startsAt)} · {request.area}
                  </small>
                </div>
                <div className="list-side">
                  {status(request.status)}
                  <strong>{money(request.budget)}</strong>
                  <div className="row-actions">
                    <Link
                      className="ghost"
                      href={`/app/${seller ? "seller" : "buyer"}/${seller ? "requests" : "care-requests"}/${request.id}`}
                      onClick={() => {
                        setSelected(request.id);
                        setSection(seller ? "requests" : "care-requests");
                      }}
                    >
                      View details
                    </Link>
                    {seller && (
                      <button
                        onClick={() => {
                          setSelected(request.id);
                          setModal("quote");
                        }}
                      >
                        Quote
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          : empty(
              "No care requests",
              "New healthcare requests will appear here.",
            )}
      </div>
    );
  }
  function SellerJobFilters({ total }: { total: number }) {
    const activeFilters = [
      sellerJobQuery.trim(),
      sellerJobService !== "all" ? sellerJobService : "",
      sellerJobArea !== "all" ? sellerJobArea : "",
      sellerJobSort !== "newest" ? sellerJobSort : "",
    ].filter(Boolean).length;
    return (
      <section className="seller-job-filter-panel">
        <div className="seller-job-filter-search">
          <Search />
          <input
            value={sellerJobQuery}
            onChange={(event) => setSellerJobQuery(event.target.value)}
            placeholder="Search active jobs by care type, buyer, area, or summary"
            aria-label="Search active jobs"
          />
          {sellerJobQuery && (
            <button onClick={() => setSellerJobQuery("")} aria-label="Clear">
              <X />
            </button>
          )}
        </div>
        <div className="seller-job-filter-row">
          <label>
            <span>Care type</span>
            <select
              value={sellerJobService}
              onChange={(event) => setSellerJobService(event.target.value)}
            >
              <option value="all">All healthcare services</option>
              {liveServices.map((service) => (
                <option key={service.id} value={service.name}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Area</span>
            <select
              value={sellerJobArea}
              onChange={(event) => setSellerJobArea(event.target.value)}
            >
              <option value="all">All islands and areas</option>
              {liveAreas.map((area) => (
                <option key={area.id} value={area.name}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sellerJobSort}
              onChange={(event) => setSellerJobSort(event.target.value)}
            >
              <option value="newest">Newest active</option>
              <option value="soonest">Soonest care date</option>
              <option value="budget">Highest budget</option>
              <option value="quotes">Fewest quotes</option>
            </select>
          </label>
        </div>
        <div className="seller-job-filter-meta">
          <span>
            <SlidersHorizontal />
            {sellerVisibleRequests.length} of {total} active jobs showing
          </span>
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setSellerJobQuery("");
                setSellerJobService("all");
                setSellerJobArea("all");
                setSellerJobSort("newest");
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      </section>
    );
  }
  function SellerJobCards({
    requests,
    compact = false,
  }: {
    requests: DemoRequest[];
    compact?: boolean;
  }) {
    if (!requests.length)
      return empty(
        "No eligible care requests",
        "New requests appear only when your approved service, coverage area, account status, and block rules all match.",
      );
    return (
      <div className={`seller-job-list ${compact ? "compact" : ""}`}>
        {requests.map((request) => {
          const buyer = state.users.find((user) => user.id === request.buyerId);
          const buyerBookings = state.bookings.filter(
            (booking) => booking.buyerId === request.buyerId,
          );
          const completedBookings = buyerBookings.filter(
            (booking) => booking.status === "completed",
          ).length;
          const buyerRequests = state.requests.filter(
            (item) => item.buyerId === request.buyerId,
          );
          const firstKnownActivity = [
            ...buyerRequests.map((item) => item.startsAt),
            ...buyerBookings.map((item) => item.startsAt),
          ]
            .map((value) => new Date(value).getTime())
            .filter(Number.isFinite)
            .sort((a, b) => a - b)[0];
          const memberSince = firstKnownActivity
            ? new Date(firstKnownActivity).toLocaleString("en-US", {
                month: "short",
                year: "numeric",
              })
            : "New buyer";
          const durationHours = Math.max(
            1,
            Math.round(
              (new Date(request.endsAt).getTime() -
                new Date(request.startsAt).getTime()) /
                3600000,
            ),
          );
          const hasQuoted = request.quotes.some(
            (quote) => quote.sellerId === currentUserId,
          );
          const premiumBuyer =
            request.status === "offered" ||
            request.quotes.length > 0 ||
            request.budget >= 160;
          return (
            <article className="seller-job-card" key={request.id}>
              <header className="seller-job-card-head">
                <div>
                  <span>
                    {request.mode === "on_demand" ? "On-demand · " : ""}
                    {request.service}
                  </span>
                  {status(request.status)}
                </div>
                <strong>Up to {money(request.budget)}</strong>
              </header>
              <div className="seller-job-body">
                <section className="seller-job-brief">
                  <h3>{request.summary}</h3>
                  <div className="request-meta">
                    <span>
                      <CalendarDays />
                      {dateTime(request.startsAt)}
                    </span>
                    <span>
                      <House />
                      {request.area}
                    </span>
                    <span>
                      <Clock3 />
                      {durationHours} hour{durationHours === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="seller-job-stats">
                    <span>
                      <ClipboardCheck />
                      {request.quotes.length} quote
                      {request.quotes.length === 1 ? "" : "s"} submitted
                    </span>
                    <span>
                      <ShieldCheck />
                      Exact address stays private
                    </span>
                    <span>
                      <MessageCircle />
                      Message after accepted quote
                    </span>
                  </div>
                </section>
                <aside className="seller-buyer-summary">
                  <header>
                    <span>{buyer?.avatar ?? request.buyerName.slice(0, 2)}</span>
                    <div>
                      <b>{request.buyerName}</b>
                      <small>{request.area}</small>
                    </div>
                  </header>
                  <div className="buyer-trust-badges">
                    <span>
                      <UserRoundCheck />
                      Verified buyer
                    </span>
                    {premiumBuyer && (
                      <span>
                        <BadgeCheck />
                        Premium buyer
                      </span>
                    )}
                    <span>
                      <Clock3 />
                      Member since {memberSince}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Public rating</dt>
                      <dd>{completedBookings ? "5.0" : "New"}</dd>
                    </div>
                    <div>
                      <dt>Completed bookings</dt>
                      <dd>{completedBookings}</dd>
                    </div>
                    <div>
                      <dt>Open requests</dt>
                      <dd>{buyerRequests.length}</dd>
                    </div>
                  </dl>
                  <p>
                    Safe buyer summary only. Private care notes and exact home
                    address unlock after an eligible booking is confirmed.
                  </p>
                </aside>
              </div>
              <footer>
                <Link
                  className="ghost"
                  href={`/app/seller/requests/${request.id}`}
                  onClick={() => {
                    setSelected(request.id);
                    setSection("requests");
                  }}
                >
                  View full request
                </Link>
                <button
                  onClick={() => {
                    setSelected(request.id);
                    setModal("quote");
                  }}
                  disabled={hasQuoted}
                >
                  {hasQuoted ? "Quote sent" : "Send a quote"}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    );
  }
  function QuoteCard({
    quote,
    request,
    buyer = false,
  }: {
    quote: DemoQuote;
    request: DemoRequest;
    buyer?: boolean;
  }) {
    return (
      <article className="quote-card">
        <header>
          <div className="quote-avatar">
            {quote.sellerName
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <h3>{quote.sellerName}</h3>
            <span>
              <BadgeCheck />
              Identity & credential verified
            </span>
          </div>
          {status(quote.status)}
        </header>
        <p>{quote.message}</p>
        <div className="quote-breakdown">
          <span>
            Care ({money(quote.rate)}/hour)
            <b>{money(quote.total - quote.travel - quote.fee)}</b>
          </span>
          <span>
            Travel<b>{money(quote.travel)}</b>
          </span>
          <span>
            Nanas protection fee<b>{money(quote.fee)}</b>
          </span>
          <span className="total">
            Total<b>{money(quote.total)}</b>
          </span>
        </div>
        <footer>
          <small>
            {request.service} · {dateTime(request.startsAt)}
          </small>
          {buyer && quote.status === "pending" ? (
            <button disabled={busy} onClick={() => acceptQuote(quote, request)}>
              Simulate payment & book
            </button>
          ) : (
            <span>
              {quote.status === "accepted"
                ? "Booking confirmed"
                : "Awaiting buyer"}
            </span>
          )}
        </footer>
      </article>
    );
  }
  function BookingRows({ bookings }: { bookings: DemoBooking[] }) {
    return (
      <div className="list-rows booking-rows">
        {bookings.length
          ? bookings.map((booking) => (
              <article key={booking.id}>
                <div className="list-icon">
                  <CalendarDays />
                </div>
                <div className="list-main">
                  <b>
                    {booking.reference} · {booking.service}
                  </b>
                  <span>
                    {booking.buyerName} ↔ {booking.sellerName}
                  </span>
                  <small>
                    {dateTime(booking.startsAt)} · {money(booking.total)}
                  </small>
                </div>
                <div className="list-side">
                  {status(booking.status)}
                  <div className="row-actions">
                    <button
                      className="ghost"
                      onClick={() => {
                        setSelected(booking.id);
                        setModal("booking-detail");
                      }}
                    >
                      Details
                    </button>
                    {role === "seller" && booking.status === "in_progress" && (
                      <button
                        onClick={() =>
                          transition(booking, "completion_pending")
                        }
                      >
                        Check out
                      </button>
                    )}
                    {role === "buyer" &&
                      booking.status === "completion_pending" && (
                        <button
                          onClick={() => transition(booking, "completed")}
                        >
                          Confirm complete
                        </button>
                      )}
                    {role !== "admin" && (
                      <button
                        className="ghost"
                        onClick={() => {
                          setSelected(booking.conversationId);
                          setSection("messages");
                        }}
                      >
                        Message
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          : empty("No bookings", "Confirmed care visits will appear here.")}
      </div>
    );
  }
  function TransactionRows({
    bookings,
    perspective,
  }: {
    bookings: DemoBooking[];
    perspective: "buyer" | "seller" | "admin";
  }) {
    return (
      <div className="transaction-list">
        {bookings.map((b) => {
          const cancelled = b.status === "cancelled";
          const sellerEarned = b.status === "completed";
          return <div key={b.id}>
            <span className={`transaction-icon ${perspective}`}>
              <CircleDollarSign />
            </span>
            <div>
              <b>
                {perspective === "seller"
                  ? sellerEarned
                    ? "Care earnings"
                    : cancelled
                      ? "Cancelled booking · no earnings"
                      : "Protected earnings pending"
                  : perspective === "buyer"
                    ? cancelled
                      ? "Simulated payment refunded"
                      : "Protected care payment"
                    : cancelled
                      ? "Ledger reversal"
                      : "Ledger transaction"}
              </b>
              <small>
                {b.reference} · {b.service} · {dateTime(b.startsAt)}
                {perspective === "seller" && !cancelled
                  ? ` · Gross ${money(b.total)} · Nanas fee/adjustment ${money(Math.max(0, b.total - b.sellerNet))} · Net ${money(b.sellerNet)}`
                  : ""}
              </small>
            </div>
            {status(b.status)}
            <strong>
              {cancelled
                ? perspective === "buyer"
                  ? `+${money(b.refundAmount ?? b.total)}`
                  : money(0)
                : perspective === "seller"
                  ? sellerEarned
                    ? money(b.sellerNet)
                    : money(0)
                  : money(b.total)}
            </strong>
          </div>
        })}
      </div>
    );
  }
  function KycRows({
    rows,
    admin = false,
  }: {
    rows: DemoState["kyc"];
    admin?: boolean;
  }) {
    return (
      <div className="kyc-list">
        {rows.map((item) => (
          <article key={item.id}>
            <div className="list-icon">
              <FileCheck2 />
            </div>
            <div>
              <b>{item.type}</b>
              <span>{admin ? item.sellerName : item.fileName}</span>
              <small>Submitted {dateTime(item.submittedAt)}</small>
            </div>
            {status(item.status)}
            {admin && (
              <div className="kyc-actions">
                <button
                  onClick={() => {
                    setSelected(item.id);
                    setModal("kyc-review");
                  }}
                >
                  {item.status === "approved" || item.status === "rejected"
                    ? "View evidence"
                    : "Review evidence"}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    );
  }
  function renderNotifications() {
    return (
      <>
        {pageHead(
          "Notifications",
          "Every care update, delivered once.",
          "Booking, message, payment, and account events follow your preferences.",
        )}
        <Panel
          title={`${state.notifications.filter((n) => n.userId === currentUserId).length} notifications`}
        >
          <NotificationRows />
        </Panel>
      </>
    );
  }
  function NotificationRows({ all = false }: { all?: boolean }) {
    const notes = all
      ? state.notifications
      : state.notifications.filter((n) => n.userId === currentUserId);
    return (
      <div className="notification-list">
        {notes.map((n) => (
          <button
            key={n.id}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                notifications: prev.notifications.map((item) =>
                  item.id === n.id ? { ...item, read: true } : item,
                ),
              }))
            }
          >
            <i className={!n.read ? "unread" : ""} />
            <Bell />
            <span>
              <b>{n.text}</b>
              <small>{dateTime(n.at)}</small>
            </span>
            {!n.read && <em>New</em>}
          </button>
        ))}
      </div>
    );
  }
  function TaskList({ items }: { items: string[] }) {
    return (
      <div className="task-list">
        {items.map((item, i) => (
          <div key={item}>
            <span>{i + 1}</span>
            <b>{item}</b>
            <ChevronRight />
          </div>
        ))}
      </div>
    );
  }
  function Panel({
    title,
    action,
    children,
  }: {
    title: string;
    action?: ReactNode;
    children: ReactNode;
  }) {
    return (
      <section className="portal-panel">
        <header>
          <h2>{title}</h2>
          {action}
        </header>
        {children}
      </section>
    );
  }

  function renderModal() {
    const selectedBooking = state.bookings.find((item) => item.id === selected);
    const selectedKyc = state.kyc.find((item) => item.id === selected);
    const selectedDispute = state.disputes.find((item) => item.id === selected);
    const selectedDisputeBooking = state.bookings.find(
      (item) => item.id === selectedDispute?.bookingId,
    );
    const selectedPrivacyRequest = state.privacyRequests.find(
      (item) => item.id === selected,
    );
    const selectedCatalogService = adminOps.services.find(
      (item) => item.id === selected,
    );
    const selectedCatalogArea = adminOps.areas.find(
      (item) => item.id === selected,
    );
    const selectedPostingPlan = adminOps.postingPlans.find(
      (item) => item.id === selected,
    );
    const selectedMember = householdMembers.find(
      (item) => item.id === selected,
    );
    const selectedSellerServiceRow = sellerServiceRows.find(
      (item) => item.serviceId === selected,
    );
    if (modal === "kyc-review" && selectedKyc)
      return (
        <>
          <ModalHead
            icon={<FileCheck2 />}
            title={`${selectedKyc.type} evidence`}
            copy="The local demo exposes document metadata only. Opening this review creates a sensitive-access record when a decision is saved."
          />
          <div className="booking-detail-summary">
            <div>{status(selectedKyc.status)}<strong>{selectedKyc.fileName}</strong></div>
            <p>{selectedKyc.sellerName} · {selectedKyc.id}</p>
            <small>Submitted {dateTime(selectedKyc.submittedAt)}</small>
          </div>
          {selectedKyc.status === "approved" || selectedKyc.status === "rejected" ? (
            <div className="info-banner"><ShieldCheck /><div><b>Decision is final</b><span>Evidence remains viewable; action buttons are disabled.</span></div></div>
          ) : (
            <form className="portal-form" onSubmit={reviewKyc}>
              <label>
                Decision
                <select name="decision" required>
                  <option value="needs_information">Request more information</option>
                  <option value="approved">Approve evidence</option>
                  <option value="rejected">Reject evidence</option>
                </select>
              </label>
              <label>
                Evidence-based reason
                <textarea name="reason" minLength={5} maxLength={1000} required />
              </label>
              <button type="submit">Save reviewed decision</button>
            </form>
          )}
        </>
      );
    if (modal === "dispute-review" && selectedDispute)
      return (
        <>
          <ModalHead
            icon={<ShieldCheck />}
            title={`Dispute evidence · ${selectedDispute.id}`}
            copy="Review the linked booking and message context before selecting an outcome."
          />
          <div className="booking-detail-summary">
            <div>{status(selectedDispute.status)}<strong>{selectedDisputeBooking ? money(selectedDisputeBooking.total) : "No booking value"}</strong></div>
            <p>{selectedDispute.reason} · {selectedDispute.summary}</p>
            <small>{selectedDisputeBooking ? `${selectedDisputeBooking.reference} · ${state.messages.filter((message) => message.conversationId === selectedDisputeBooking.conversationId).length} message(s)` : `Booking ${selectedDispute.bookingId}`}</small>
          </div>
          {selectedDispute.status === "resolved" ? (
            <div className="resolution"><Check />{selectedDispute.resolution}</div>
          ) : (
            <form className="portal-form" onSubmit={resolveDispute}>
              <label>
                Resolution outcome
                <select name="outcome" required>
                  <option value="release_seller_funds">Release seller funds</option>
                  <option value="refund_buyer">Refund buyer</option>
                  <option value="split_settlement">Split settlement</option>
                  <option value="escalate">Escalate for specialist review</option>
                </select>
              </label>
              <label>
                Evidence and rationale
                <textarea name="reason" minLength={10} maxLength={1500} required />
              </label>
              <button type="submit">Record resolution</button>
            </form>
          )}
        </>
      );
    if (modal === "privacy-action" && selectedPrivacyRequest)
      return (
        <>
          <ModalHead icon={<ShieldCheck />} title={`Process ${selectedPrivacyRequest.type} request`} copy="Record an operational status and reason without bypassing retention or legal-hold review." />
          <form className="portal-form" onSubmit={processPrivacyRequest}>
            <label>Status<select name="status"><option value="processing">Processing</option><option value="completed">Completed</option></select></label>
            <label>Operational reason<textarea name="reason" minLength={5} maxLength={1000} required /></label>
            <button type="submit">Save privacy action</button>
          </form>
        </>
      );
    if (modal === "household-member")
      return (
        <>
          <ModalHead
            icon={<Users />}
            title={
              selectedMember
                ? "Edit private care recipient"
                : "Add private care recipient"
            }
            copy="These details are participant-scoped and are never shown in public seller discovery."
          />
          <form className="portal-form" onSubmit={saveHouseholdMember}>
            <label>
              Name
              <input
                name="displayName"
                required
                maxLength={80}
                defaultValue={selectedMember?.name}
              />
            </label>
            <label>
              Relationship
              <input
                name="relationship"
                required
                maxLength={40}
                defaultValue={selectedMember?.relationship}
              />
            </label>
            <label>
              Date of birth
              <input
                name="dateOfBirth"
                type="date"
                defaultValue={selectedMember?.dateOfBirth}
              />
            </label>
            <label>
              Private care notes
              <textarea
                name="careNotes"
                maxLength={4000}
                defaultValue={selectedMember?.notes}
              />
            </label>
            <label>
              <input
                name="active"
                type="checkbox"
                defaultChecked={selectedMember?.active ?? true}
              />{" "}
              Active care recipient
            </label>
            <button type="submit">Save private care recipient</button>
          </form>
        </>
      );
    if (modal === "weekly-availability")
      return (
        <>
          <ModalHead
            icon={<Clock3 />}
            title="Set weekly availability"
            copy="Choose recurring days and a single local-time care window in America/Nassau."
          />
          <form className="portal-form" onSubmit={saveWeeklyAvailability}>
            <div className="chip-row">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day, i) => (
                  <label key={day}>
                    <input
                      name={`day-${i}`}
                      type="checkbox"
                      defaultChecked={availabilityRows.some(
                        (item) => item.weekday === i && item.active,
                      )}
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
            <div className="form-grid">
              <label>
                Start
                <input
                  name="start"
                  type="time"
                  required
                  defaultValue={
                    availabilityRows[0]?.start?.slice(0, 5) ?? "08:00"
                  }
                />
              </label>
              <label>
                End
                <input
                  name="end"
                  type="time"
                  required
                  defaultValue={
                    availabilityRows[0]?.end?.slice(0, 5) ?? "16:00"
                  }
                />
              </label>
            </div>
            <button type="submit">Save weekly availability</button>
          </form>
        </>
      );
    if (modal === "seller-service")
      return (
        <>
          <ModalHead
            icon={<Stethoscope />}
            title="Healthcare service profile"
            copy="Sellers can publish 1–3 categories. Write a substantial, unique buyer-facing biography and qualifications for this service."
          />
          <form
            className="portal-form seller-service-editor"
            onSubmit={saveSellerService}
          >
            <label>
              Healthcare service
              <select
                name="serviceId"
                disabled={!!selectedSellerServiceRow}
                defaultValue={
                  selectedSellerServiceRow?.serviceId ??
                  liveServices.find(
                    (service) =>
                      !sellerServiceRows.some(
                        (item) => item.serviceId === service.id,
                      ),
                  )?.id
                }
              >
                {liveServices
                  .filter((service) =>
                    selectedSellerServiceRow
                      ? service.id === selectedSellerServiceRow.serviceId
                      : !sellerServiceRows.some(
                          (item) => item.serviceId === service.id,
                        ),
                  )
                  .map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
              </select>
              {selectedSellerServiceRow && (
                <input
                  type="hidden"
                  name="serviceId"
                  value={selectedSellerServiceRow.serviceId}
                />
              )}
              <small>
                A category is fixed after creation so its reviews and booking
                history stay correctly linked.
              </small>
            </label>
            <div className="form-split">
              <label>
                Years of experience
                <input
                  name="yearsExperience"
                  type="number"
                  min="0"
                  max="80"
                  required
                  defaultValue={selectedSellerServiceRow?.yearsExperience ?? 0}
                />
              </label>
              <label>
                Starting rate (BSD/hour)
                <input
                  name="rate"
                  type="number"
                  min="0"
                  required
                  defaultValue={selectedSellerServiceRow?.rate ?? 38}
                />
              </label>
            </div>
            <label>
              Maximum recurring rate (optional)
              <input
                name="rateMax"
                type="number"
                min={selectedSellerServiceRow?.rate ?? 0}
                defaultValue={selectedSellerServiceRow?.rateMax}
              />
              <small>Buyers will see a range such as BSD $38–$52/hour.</small>
            </label>
            <label>
              About you for this service
              <textarea
                name="bio"
                minLength={180}
                maxLength={2000}
                required={selectedSellerServiceRow?.active ?? true}
                defaultValue={selectedSellerServiceRow?.bio}
                placeholder="Describe your experience, care approach, communication style, typical support and who you are best equipped to help for this service."
              />
              <small>
                180–2,000 characters when active. This becomes the full About
                section buyers read for this category.
              </small>
            </label>
            <label>
              Credentials, skills and care qualifications
              <textarea
                name="capabilities"
                required={selectedSellerServiceRow?.active ?? true}
                defaultValue={selectedSellerServiceRow?.capabilities.join(", ")}
                placeholder="Medication reminders, Mobility support, CPR training, Meal preparation"
              />
              <small>
                Separate up to 30 buyer-visible qualifications with commas. Only
                Nanas-reviewed professional records receive a verified label.
              </small>
            </label>
            <label>
              Other ways you can help
              <textarea
                name="additionalHelp"
                defaultValue={selectedSellerServiceRow?.additionalHelp.join(
                  ", ",
                )}
                placeholder="Groceries and errands, Transportation, Light organizing"
              />
              <small>
                These appear beneath the selected service rather than across
                every service profile.
              </small>
            </label>
            <label>
              <input
                name="active"
                type="checkbox"
                defaultChecked={selectedSellerServiceRow?.active ?? true}
              />{" "}
              Active and public when eligible
            </label>
            <button type="submit">Save service profile</button>
          </form>
        </>
      );
    if (modal === "seller-coverage")
      return (
        <>
          <ModalHead
            icon={<House />}
            title="Add or update coverage"
            copy="Coverage eligibility is enforced before requests appear and before quotes are accepted."
          />
          <form className="portal-form" onSubmit={saveSellerCoverage}>
            <label>
              Service area
              <select name="areaId">
                {liveAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Travel radius (km)
                <input
                  name="radius"
                  type="number"
                  min="0"
                  max="500"
                  defaultValue="15"
                />
              </label>
              <label>
                Travel fee (BSD)
                <input
                  name="travelFee"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </label>
            </div>
            <label>
              <input name="active" type="checkbox" defaultChecked /> Active
              coverage
            </label>
            <button type="submit">Save coverage</button>
          </form>
        </>
      );
    if (modal === "catalog-service")
      return (
        <>
          <ModalHead
            icon={<Stethoscope />}
            title={
              selectedCatalogService
                ? "Configure healthcare service"
                : "Add healthcare service"
            }
            copy="Changes affect new discovery and requests only; historical bookings keep their service and pricing snapshots."
          />
          <form className="portal-form" onSubmit={saveCatalogService}>
            <label>
              Service name
              <input
                name="name"
                minLength={3}
                maxLength={120}
                required
                defaultValue={selectedCatalogService?.name}
              />
            </label>
            <label>
              Category
              <select
                name="categoryId"
                defaultValue={
                  selectedCatalogService?.categoryId ??
                  adminOps.categories[0]?.id
                }
              >
                {adminOps.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea
                name="description"
                minLength={10}
                maxLength={2000}
                required
                defaultValue={
                  selectedCatalogService?.description ??
                  "Personally delivered healthcare or approved healthcare-support service in The Bahamas."
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Pricing unit
                <select
                  name="pricingUnit"
                  defaultValue={selectedCatalogService?.pricingUnit ?? "hour"}
                >
                  <option value="hour">Hour</option>
                  <option value="visit">Visit</option>
                  <option value="day">Day</option>
                  <option value="fixed">Fixed</option>
                </select>
              </label>
              <label>
                Risk level
                <select
                  name="riskLevel"
                  defaultValue={selectedCatalogService?.riskLevel ?? "standard"}
                >
                  <option value="standard">Standard</option>
                  <option value="elevated">Elevated</option>
                  <option value="clinical">Clinical</option>
                </select>
              </label>
            </div>
            <label>
              <input
                name="active"
                type="checkbox"
                defaultChecked={selectedCatalogService?.active ?? true}
              />{" "}
              Active for new care requests
            </label>
            <label>
              Change reason
              <textarea
                name="reason"
                minLength={5}
                maxLength={1000}
                required
                placeholder="Record why this catalog change is appropriate."
              />
            </label>
            <button type="submit">Save healthcare service</button>
          </form>
        </>
      );
    if (modal === "catalog-area")
      return (
        <>
          <ModalHead
            icon={<House />}
            title={
              selectedCatalogArea
                ? "Configure Bahamas service area"
                : "Add Bahamas service area"
            }
            copy="Active areas appear in buyer request builders and seller coverage. Existing bookings retain their original area."
          />
          <form className="portal-form" onSubmit={saveCatalogArea}>
            <label>
              Area name
              <input
                name="name"
                minLength={3}
                maxLength={120}
                required
                defaultValue={selectedCatalogArea?.name}
              />
            </label>
            <label>
              Island
              <select
                name="islandId"
                defaultValue={
                  selectedCatalogArea?.islandId ?? adminOps.islands[0]?.id
                }
              >
                {adminOps.islands.map((island) => (
                  <option key={island.id} value={island.id}>
                    {island.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                name="active"
                type="checkbox"
                defaultChecked={selectedCatalogArea?.active ?? true}
              />{" "}
              Active for new care requests
            </label>
            <label>
              Change reason
              <textarea
                name="reason"
                minLength={5}
                maxLength={1000}
                required
                placeholder="Record why this coverage change is appropriate."
              />
            </label>
            <button type="submit">Save service area</button>
          </form>
        </>
      );
    if (modal === "posting-plan")
      return (
        <>
          <ModalHead
            icon={<CircleDollarSign />}
            title={
              selectedPostingPlan
                ? "Configure job-posting plan"
                : "Add job-posting plan"
            }
            copy="Fee, free allowance, visibility duration and priority placement apply only to newly published care requests."
          />
          <form className="portal-form" onSubmit={savePostingPlan}>
            <div className="form-grid">
              <label>
                Plan code
                <input
                  name="code"
                  required
                  pattern="[a-z0-9_]+"
                  defaultValue={selectedPostingPlan?.code ?? "premium_custom"}
                />
              </label>
              <label>
                Plan name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={
                    selectedPostingPlan?.name ?? "Premium care request"
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                name="description"
                required
                minLength={5}
                maxLength={500}
                defaultValue={
                  selectedPostingPlan?.description ??
                  "Priority placement for a configurable number of days."
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Fee (BSD)
                <input
                  name="fee"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={selectedPostingPlan?.fee ?? 19}
                />
              </label>
              <label>
                Listing duration (days)
                <input
                  name="durationDays"
                  type="number"
                  min="1"
                  max="365"
                  required
                  defaultValue={selectedPostingPlan?.durationDays ?? 30}
                />
              </label>
            </div>
            <label>
              Free posts allowed per buyer
              <input
                name="freePostAllowance"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={selectedPostingPlan?.freePostAllowance ?? 0}
              />
            </label>
            <label>
              <input
                name="featured"
                type="checkbox"
                defaultChecked={selectedPostingPlan?.featured ?? true}
              />{" "}
              Priority / featured placement
            </label>
            <label>
              <input
                name="active"
                type="checkbox"
                defaultChecked={selectedPostingPlan?.active ?? true}
              />{" "}
              Available for new postings
            </label>
            <label>
              Change reason
              <textarea
                name="reason"
                minLength={5}
                maxLength={1000}
                required
                placeholder="Record why this fee or duration is changing."
              />
            </label>
            <button type="submit">Save posting plan</button>
          </form>
        </>
      );
    if (modal === "request") {
      const steps = [
        "Category",
        "Service",
        "About the need",
        "Services",
        "Location",
        "Dates",
        "Days & times",
        "Preferences",
        "Details",
        "Pay rate",
        "Publish",
        "Review",
      ];
      const category =
        careIntakeCategories.find(
          (item) => item.code === requestDraft.categoryCode,
        ) ?? careIntakeCategories[0];
      const subcategory =
        category.subcategories.find(
          (item) => item.code === requestDraft.subcategoryCode,
        ) ?? category.subcategories[0];
      const chosenArea = liveAreas.find(
        (item) => item.id === requestDraft.areaId,
      );
      const chosenPlan =
        adminOps.postingPlans.find(
          (plan) => plan.code === requestDraft.postingPlanCode,
        ) ?? defaultPostingPlans[0];
      const freeEligible = !state.requests.some(
        (entry) => entry.buyerId === currentUserId,
      );
      const setCategory = (next: IntakeCategory) =>
        setRequestDraft((draft) => ({
          ...draft,
          categoryCode: next.code,
          subcategoryCode: next.subcategories[0].code,
          serviceId: next.subcategories[0].serviceId,
          needs: [],
          qualities: [],
          extras: [],
          recipientLabel:
            next.code === "child_care"
              ? "Child 1"
              : next.code === "pet_care"
                ? "My pets"
                : next.code === "housekeeping"
                  ? "My home"
                  : next.code === "tutoring"
                    ? "Student"
                    : "A family member",
          recipients:
            next.code === "child_care"
              ? [
                  {
                    id: `recipient-${Date.now()}`,
                    label: "Child 1",
                    relationship: "child",
                    birthMonth: "",
                    birthYear: "",
                    expecting: false,
                  },
                ]
              : draft.recipients,
        }));
      const choiceButtons = (
        options: string[],
        selected: string[],
        toggle: (value: string) => void,
      ) => (
        <div className="care-need-grid intake-check-grid">
          {options.map((option) => (
            <button
              type="button"
              key={option}
              className={selected.includes(option) ? "selected" : ""}
              onClick={() => toggle(option)}
            >
              <span>
                <Check />
              </span>
              {option}
            </button>
          ))}
        </div>
      );
      return (
        <form
          className="care-wizard care-intake-wizard"
          onSubmit={(event) => {
            event.preventDefault();
            if (requestStep === 11) void createRequest();
            else advanceRequestWizard();
          }}
        >
          <header className="care-wizard-header">
            <div>
              <span>Build your Nanas request</span>
              <b>
                Step {requestStep + 1} of {steps.length} · {steps[requestStep]}
              </b>
            </div>
            <div
              className="care-wizard-progress"
              aria-label={`Step ${requestStep + 1} of ${steps.length}`}
            >
              <i
                style={{
                  width: `${((requestStep + 1) / steps.length) * 100}%`,
                }}
              />
            </div>
          </header>
          <section className="care-wizard-body" aria-live="polite">
            {requestStep === 0 && (
              <>
                <div className="care-question">
                  <span>
                    <Sparkles /> Find the right help
                  </span>
                  <h2>What kind of help do you need?</h2>
                  <p>
                    Choose a main category. Each category has questions designed
                    for that service.
                  </p>
                </div>
                <div className="intake-category-grid">
                  {careIntakeCategories.map((item, index) => (
                    <button
                      type="button"
                      key={item.code}
                      className={
                        requestDraft.categoryCode === item.code
                          ? "selected"
                          : ""
                      }
                      onClick={() => setCategory(item)}
                    >
                      <span>
                        {index === 0 ? (
                          <Users />
                        ) : index === 1 ? (
                          <HeartHandshake />
                        ) : index === 2 ? (
                          <ShieldCheck />
                        ) : index === 3 ? (
                          <HeartPulse />
                        ) : index === 4 ? (
                          <House />
                        ) : (
                          <BookOpenCheck />
                        )}
                      </span>
                      <b>{item.name}</b>
                      <small>{item.description}</small>
                      <ul>
                        {item.subcategories.map((subcategory) => (
                          <li key={subcategory.code}>{subcategory.name}</li>
                        ))}
                      </ul>
                      <i>
                        <Check />
                      </i>
                    </button>
                  ))}
                </div>
              </>
            )}
            {requestStep === 1 && (
              <>
                <div className="care-question">
                  <span>
                    <SlidersHorizontal /> {category.name}
                  </span>
                  <h2>Which service are you looking for?</h2>
                  <p>
                    Select the closest match so Nanas can show the request to
                    the right sellers.
                  </p>
                </div>
                <div className="intake-subcategory-grid">
                  {category.subcategories.map((item) => (
                    <button
                      type="button"
                      key={item.code}
                      className={
                        requestDraft.subcategoryCode === item.code
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          subcategoryCode: item.code,
                          serviceId: item.serviceId,
                        }))
                      }
                    >
                      <b>{item.name}</b>
                      <span>
                        <ChevronRight />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {requestStep === 2 &&
              requestDraft.categoryCode === "child_care" && (
                <>
                  <div className="care-question">
                    <span>
                      <UserRound /> Child details
                    </span>
                    <h2>Who needs care?</h2>
                    <p>
                      Birth month and year help match age-appropriate experience
                      and remain private.
                    </p>
                  </div>
                  <div className="care-recipient-list">
                    {requestDraft.recipients.map((recipient, index) => (
                      <article
                        key={recipient.id}
                        className="care-recipient-editor"
                      >
                        <header>
                          <b>Child {index + 1}</b>
                          {requestDraft.recipients.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setRequestDraft((draft) => ({
                                  ...draft,
                                  recipients: draft.recipients.filter(
                                    (item) => item.id !== recipient.id,
                                  ),
                                  recipientLabel: `${draft.recipients.length - 1} children`,
                                }))
                              }
                            >
                              Remove
                            </button>
                          )}
                        </header>
                        <div className="care-form-grid">
                          <label>
                            Birth month
                            <select
                              required
                              value={recipient.birthMonth}
                              onChange={(event) =>
                                updateRequestRecipient(recipient.id, {
                                  birthMonth: event.target.value,
                                })
                              }
                            >
                              <option value="">Month</option>
                              {monthOptions.map((month, monthIndex) => (
                                <option key={month} value={monthIndex + 1}>
                                  {month}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Birth year
                            <select
                              required
                              value={recipient.birthYear}
                              onChange={(event) =>
                                updateRequestRecipient(recipient.id, {
                                  birthYear: event.target.value,
                                })
                              }
                            >
                              <option value="">Year</option>
                              {Array.from(
                                { length: 19 },
                                (_, yearIndex) =>
                                  new Date().getFullYear() - yearIndex,
                              ).map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="care-checkbox">
                          <input
                            type="checkbox"
                            checked={recipient.expecting}
                            onChange={(event) =>
                              updateRequestRecipient(recipient.id, {
                                expecting: event.target.checked,
                              })
                            }
                          />{" "}
                          I’m expecting
                        </label>
                      </article>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="care-add-person"
                    onClick={addRequestChild}
                  >
                    <span>+</span>Add another child
                  </button>
                </>
              )}
            {requestStep === 2 &&
              ["senior_care", "adult_care"].includes(
                requestDraft.categoryCode,
              ) && (
                <>
                  <div className="care-question">
                    <span>
                      <UserRound /> Recipient details
                    </span>
                    <h2>Who needs care?</h2>
                    <p>
                      Tell sellers the relationship and general age range
                      without sharing a diagnosis.
                    </p>
                  </div>
                  <div className="intake-relation-grid">
                    {[
                      ["My parent", "family_member"],
                      ["My spouse", "family_member"],
                      ["My grandparent", "family_member"],
                      ["My friend / extended relative", "other_dependent"],
                      ["Myself", "self"],
                    ].map(([label, relationship]) => (
                      <button
                        type="button"
                        key={label}
                        className={
                          requestDraft.recipientLabel === label
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            recipientLabel: label,
                            recipients: [
                              {
                                ...draft.recipients[0],
                                label,
                                relationship:
                                  relationship as RequestRecipient["relationship"],
                              },
                            ],
                          }))
                        }
                      >
                        {label}
                        <Check />
                      </button>
                    ))}
                  </div>
                  <div className="care-form-grid">
                    <label htmlFor="care-recipient-gender">
                      Gender <span aria-hidden="true">*</span>
                      <select
                        id="care-recipient-gender"
                        aria-label="Care recipient gender"
                        required
                        value={requestDraft.recipientGender}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            recipientGender: event.target.value as
                              "female" | "male",
                          }))
                        }
                      >
                        <option value="">Choose</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </label>
                    <label htmlFor="care-recipient-age">
                      Age range <span aria-hidden="true">*</span>
                      <select
                        id="care-recipient-age"
                        aria-label="Care recipient age range"
                        required
                        value={requestDraft.recipientAgeBand}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            recipientAgeBand: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose</option>
                        {[
                          "30s",
                          "40s",
                          "50s",
                          "60s",
                          "70s",
                          "80s",
                          "90s",
                          "100s",
                        ].map((age) => (
                          <option key={age}>{age}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}
            {requestStep === 2 && requestDraft.categoryCode === "pet_care" && (
              <>
                <div className="care-question">
                  <span>
                    <HeartPulse /> Pet details
                  </span>
                  <h2>Tell us about your pets</h2>
                  <p>
                    Add each pet so sitters know who they will be caring for.
                  </p>
                </div>
                <div className="care-recipient-list">
                  {requestDraft.pets.map((pet, index) => (
                    <article key={pet.id} className="care-recipient-editor">
                      <header>
                        <b>Pet {index + 1}</b>
                        {requestDraft.pets.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setRequestDraft((draft) => ({
                                ...draft,
                                pets: draft.pets.filter(
                                  (item) => item.id !== pet.id,
                                ),
                              }))
                            }
                          >
                            Remove
                          </button>
                        )}
                      </header>
                      <div className="care-form-grid">
                        <label>
                          Pet type
                          <select
                            value={pet.kind}
                            onChange={(event) =>
                              updateRequestPet(pet.id, {
                                kind: event.target.value as RequestPet["kind"],
                              })
                            }
                          >
                            <option value="dog">Dog</option>
                            <option value="cat">Cat</option>
                          </select>
                        </label>
                        <label>
                          Name
                          <input
                            required
                            value={pet.name}
                            onChange={(event) =>
                              updateRequestPet(pet.id, {
                                name: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Breed
                          <input
                            required
                            value={pet.breed}
                            onChange={(event) =>
                              updateRequestPet(pet.id, {
                                breed: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Age
                          <select
                            value={pet.ageGroup}
                            onChange={(event) =>
                              updateRequestPet(pet.id, {
                                ageGroup: event.target
                                  .value as RequestPet["ageGroup"],
                              })
                            }
                          >
                            <option value="puppy_kitten">
                              Puppy / kitten (under 1)
                            </option>
                            <option value="adult">Adult</option>
                          </select>
                        </label>
                        <label>
                          Size
                          <select
                            value={pet.size}
                            onChange={(event) =>
                              updateRequestPet(pet.id, {
                                size: event.target.value as RequestPet["size"],
                              })
                            }
                          >
                            <option value="1_15">1–15 lb</option>
                            <option value="16_40">16–40 lb</option>
                            <option value="41_100">41–100 lb</option>
                            <option value="101_plus">101+ lb</option>
                          </select>
                        </label>
                        <label>
                          Gender
                          <select
                            value={pet.gender}
                            onChange={(event) =>
                              updateRequestPet(pet.id, {
                                gender: event.target
                                  .value as RequestPet["gender"],
                              })
                            }
                          >
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                          </select>
                        </label>
                      </div>
                      <label className="care-checkbox">
                        <input
                          type="checkbox"
                          checked={pet.mixedBreed}
                          onChange={(event) =>
                            updateRequestPet(pet.id, {
                              mixedBreed: event.target.checked,
                            })
                          }
                        />{" "}
                        Mixed breed
                      </label>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="care-add-person"
                  onClick={addRequestPet}
                >
                  <span>+</span>Add another pet
                </button>
              </>
            )}
            {requestStep === 2 &&
              requestDraft.categoryCode === "housekeeping" && (
                <>
                  <div className="care-question">
                    <span>
                      <House /> Home details
                    </span>
                    <h2>Tell us about your home</h2>
                    <p>
                      These details help cleaners estimate the work accurately.
                    </p>
                  </div>
                  <div className="care-form-grid intake-home-grid">
                    <label>
                      Bedrooms
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={requestDraft.homeBedrooms}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            homeBedrooms: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Bathrooms
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={requestDraft.homeBathrooms}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            homeBathrooms: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Square footage
                      <select
                        value={requestDraft.homeSquareFeet}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            homeSquareFeet: event.target.value,
                          }))
                        }
                      >
                        {[
                          "Under 1,000",
                          "1,001–1,500",
                          "1,501–2,000",
                          "2,001–2,500",
                          "2,501–3,000",
                          "3,001–3,500",
                          "Over 3,500",
                        ].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Frequency
                      <select
                        value={requestDraft.cleaningFrequency}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            cleaningFrequency: event.target.value,
                          }))
                        }
                      >
                        <option value="every_week">Every week</option>
                        <option value="every_other_week">
                          Every other week
                        </option>
                        <option value="every_month">Every month</option>
                      </select>
                    </label>
                  </div>
                  <label className="care-checkbox">
                    <input
                      type="checkbox"
                      checked={requestDraft.homeHasPets}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          homeHasPets: event.target.checked,
                        }))
                      }
                    />{" "}
                    There are pets in the home
                  </label>
                </>
              )}
            {requestStep === 2 && requestDraft.categoryCode === "tutoring" && (
              <>
                <div className="care-question">
                  <span>
                    <BookOpenCheck /> Student details
                  </span>
                  <h2>Who needs tutoring?</h2>
                  <p>
                    Use a private label. Sellers only receive the learning
                    context needed for a safe match.
                  </p>
                </div>
                <div className="care-details-form">
                  <label>
                    Private student label
                    <input
                      required
                      value={requestDraft.recipientLabel}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          recipientLabel: event.target.value,
                        }))
                      }
                      placeholder="For example: My child"
                    />
                  </label>
                </div>
              </>
            )}
            {requestStep === 3 && (
              <>
                <div className="care-question">
                  <span>
                    <ClipboardCheck /> {category.name}
                  </span>
                  <h2>
                    {requestDraft.categoryCode === "tutoring"
                      ? "Which subjects?"
                      : requestDraft.categoryCode === "housekeeping"
                        ? "What cleaning do you need?"
                        : "What do you need help with?"}
                  </h2>
                  <p>Select every option that applies.</p>
                </div>
                {choiceButtons(
                  category.needs,
                  requestDraft.needs,
                  toggleRequestNeed,
                )}
              </>
            )}
            {requestStep === 4 && (
              <>
                <div className="care-question">
                  <span>
                    <MapPin /> Private location
                  </span>
                  <h2>Where do you need help?</h2>
                  <p>
                    The precise address is never shown in public search results.
                  </p>
                </div>
                <div className="care-choice-grid areas">
                  {liveAreas.map((area) => (
                    <button
                      type="button"
                      key={area.id}
                      className={
                        requestDraft.areaId === area.id ? "selected" : ""
                      }
                      onClick={() =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          areaId: area.id,
                        }))
                      }
                    >
                      <span>
                        <MapPin />
                      </span>
                      <b>{area.name}</b>
                      <small>Approved sellers covering this area</small>
                      <i>
                        <Check />
                      </i>
                    </button>
                  ))}
                </div>
                <div className="care-address-form">
                  <label className="full">
                    Street address
                    <input
                      required
                      value={requestDraft.addressLine1}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          addressLine1: event.target.value,
                        }))
                      }
                      placeholder="House number and street"
                    />
                  </label>
                  <label className="full">
                    Apartment, unit or building (optional)
                    <input
                      value={requestDraft.addressLine2}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          addressLine2: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Island
                    <select
                      required
                      value={requestDraft.islandId}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          islandId: event.target.value,
                        }))
                      }
                    >
                      {liveIslands.map((island) => (
                        <option key={island.id} value={island.id}>
                          {island.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    City or locality
                    <input
                      required
                      value={requestDraft.locality}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          locality: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Postal / ZIP code <span aria-hidden="true">*</span>
                    <input
                      aria-label="Postal or ZIP code"
                      required
                      value={requestDraft.postalCode}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          postalCode: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Access notes (optional)
                    <input
                      value={requestDraft.accessNotes}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          accessNotes: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="privacy-note">
                  <ShieldCheck />
                  Only the confirmed eligible seller receives the precise
                  address.
                </div>
              </>
            )}
            {requestStep === 5 && (
              <>
                <div className="care-question">
                  <span>
                    <CalendarDays /> Plan the service
                  </span>
                  <h2>When do you need help?</h2>
                  <p>
                    Choose recurring or one-time support and the date range.
                  </p>
                </div>
                <div className="care-segmented schedule-kind">
                  <button
                    type="button"
                    className={
                      requestDraft.scheduleKind === "recurring"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setRequestDraft((draft) => ({
                        ...draft,
                        scheduleKind: "recurring",
                      }))
                    }
                  >
                    Recurring
                  </button>
                  <button
                    type="button"
                    className={
                      requestDraft.scheduleKind === "one_time" ? "selected" : ""
                    }
                    onClick={() =>
                      setRequestDraft((draft) => ({
                        ...draft,
                        scheduleKind: "one_time",
                      }))
                    }
                  >
                    One time
                  </button>
                </div>
                <div className="care-form-grid">
                  <label>
                    Estimated start date
                    <input
                      type="date"
                      required
                      value={requestDraft.startsAt.slice(0, 10)}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          startsAt: `${event.target.value}T${draft.startsAt.slice(11, 16) || "09:00"}`,
                        }))
                      }
                    />
                  </label>
                  {requestDraft.scheduleKind === "recurring" && (
                    <label>
                      Estimated end date (optional)
                      <input
                        type="date"
                        min={requestDraft.startsAt.slice(0, 10)}
                        value={requestDraft.endDate}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            endDate: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                </div>
                <label className="care-checkbox">
                  <input
                    type="checkbox"
                    checked={requestDraft.flexibleStart}
                    onChange={(event) =>
                      setRequestDraft((draft) => ({
                        ...draft,
                        flexibleStart: event.target.checked,
                      }))
                    }
                  />{" "}
                  My start date is flexible
                </label>
              </>
            )}
            {requestStep === 6 && (
              <>
                <div className="care-question">
                  <span>
                    <Clock3 /> Build the schedule
                  </span>
                  <h2>Which days and times?</h2>
                  <p>Choose time periods or enter exact times.</p>
                </div>
                {requestDraft.scheduleKind === "recurring" && (
                  <div className="care-day-picker">
                    {weekdayOptions.map((day, index) => (
                      <button
                        type="button"
                        key={day}
                        className={
                          requestDraft.weekdays.includes(index)
                            ? "selected"
                            : ""
                        }
                        onClick={() => toggleRequestWeekday(index)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}
                {!requestDraft.useSpecificTimes && (
                  <div className="care-period-picker">
                    {[
                      ["morning", "Mornings"],
                      ["afternoon", "Afternoons"],
                      ["evening", "Evenings"],
                      ["overnight", "Overnight"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        className={
                          requestDraft.timePeriods.includes(value)
                            ? "selected"
                            : ""
                        }
                        onClick={() => toggleRequestTimePeriod(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {requestDraft.useSpecificTimes && (
                  <div className="care-form-grid">
                    <label>
                      Start time
                      <input
                        type="time"
                        required
                        value={requestDraft.startTime}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            startTime: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      End time
                      <input
                        type="time"
                        required
                        value={requestDraft.endTime}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            endTime: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
                <button
                  type="button"
                  className="care-text-action"
                  onClick={() =>
                    setRequestDraft((draft) => ({
                      ...draft,
                      useSpecificTimes: !draft.useSpecificTimes,
                    }))
                  }
                >
                  {requestDraft.useSpecificTimes
                    ? "Use time periods instead"
                    : "Add specific times instead"}
                </button>
                <label className="care-checkbox">
                  <input
                    type="checkbox"
                    checked={requestDraft.scheduleVaries}
                    onChange={(event) =>
                      setRequestDraft((draft) => ({
                        ...draft,
                        scheduleVaries: event.target.checked,
                      }))
                    }
                  />{" "}
                  My schedule may vary
                </label>
              </>
            )}
            {requestStep === 7 && (
              <>
                <div className="care-question">
                  <span>
                    <ShieldCheck /> Better matching
                  </span>
                  <h2>
                    {requestDraft.categoryCode === "housekeeping"
                      ? "Cleaning extras and supplies"
                      : requestDraft.categoryCode === "tutoring"
                        ? "Learning and tutor preferences"
                        : "Ideal seller qualities"}
                  </h2>
                  <p>These optional filters help narrow the best matches.</p>
                </div>
                {requestDraft.categoryCode === "housekeeping" &&
                  choiceButtons(
                    housekeepingExtraOptions,
                    requestDraft.extras,
                    toggleRequestExtra,
                  )}
                {requestDraft.categoryCode === "tutoring" && (
                  <div className="care-segmented">
                    <button
                      type="button"
                      className={
                        requestDraft.distanceLearning === "yes"
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          distanceLearning: "yes",
                        }))
                      }
                    >
                      Needs distance learning help
                    </button>
                    <button
                      type="button"
                      className={
                        requestDraft.distanceLearning === "no" ? "selected" : ""
                      }
                      onClick={() =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          distanceLearning: "no",
                        }))
                      }
                    >
                      In-person help
                    </button>
                  </div>
                )}
                {choiceButtons(
                  category.qualities,
                  requestDraft.qualities,
                  toggleRequestQuality,
                )}
              </>
            )}
            {requestStep === 8 && (
              <>
                <div className="care-question">
                  <span>
                    <ClipboardCheck /> The essentials
                  </span>
                  <h2>What should sellers know?</h2>
                  <p>
                    Describe the routine and practical needs. Do not include
                    diagnoses or highly sensitive information.
                  </p>
                </div>
                <div className="care-details-form">
                  <label>
                    Safe request summary
                    <textarea
                      value={requestDraft.summary}
                      minLength={10}
                      maxLength={900}
                      required
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          summary: event.target.value,
                        }))
                      }
                      placeholder="Describe the routine, priorities and communication preferences."
                    />
                    <small>{requestDraft.summary.length}/900 characters</small>
                  </label>
                </div>
              </>
            )}
            {requestStep === 9 && (
              <>
                <div className="care-question">
                  <span>
                    <CircleDollarSign /> Set your budget
                  </span>
                  <h2>What would you like to pay?</h2>
                  <p>Enter the hourly range in Bahamian dollars.</p>
                </div>
                <div className="care-rate-range">
                  <label>
                    Minimum hourly rate (BSD)
                    <div className="care-money-input">
                      <span>$</span>
                      <input
                        type="number"
                        min="1"
                        required
                        value={requestDraft.minRate}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            minRate: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </label>
                  <label>
                    Maximum hourly rate (BSD)
                    <div className="care-money-input">
                      <span>$</span>
                      <input
                        type="number"
                        min={requestDraft.minRate}
                        required
                        value={requestDraft.maxRate}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            maxRate: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </label>
                  <label>
                    Maximum total budget (optional)
                    <div className="care-money-input">
                      <span>$</span>
                      <input
                        type="number"
                        min="0"
                        value={requestDraft.budget}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            budget: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </label>
                </div>
              </>
            )}
            {requestStep === 10 && (
              <>
                <div className="care-question">
                  <span>
                    <BadgeCheck /> Choose how to publish
                  </span>
                  <h2>Post free or reach sellers faster?</h2>
                  <p>
                    Your first job is free. Later postings use plans whose fee
                    and duration are controlled by Nanas admins.
                  </p>
                </div>
                <div className="care-plan-grid">
                  {adminOps.postingPlans
                    .filter((plan) => plan.active)
                    .map((plan) => {
                      const unavailable = plan.fee === 0 && !freeEligible;
                      return (
                        <button
                          type="button"
                          key={plan.code}
                          disabled={unavailable}
                          className={`${requestDraft.postingPlanCode === plan.code ? "selected" : ""} ${plan.featured ? "featured" : ""}`}
                          onClick={() =>
                            setRequestDraft((draft) => ({
                              ...draft,
                              postingPlanCode: plan.code,
                            }))
                          }
                        >
                          <span>{plan.featured ? "Priority" : "Standard"}</span>
                          <b>{plan.name}</b>
                          <strong>
                            {plan.fee === 0 ? "Free" : money(plan.fee)}
                          </strong>
                          <p>{plan.description}</p>
                          <small>Visible for {plan.durationDays} days</small>
                          <i>
                            <Check />
                          </i>
                          {unavailable && <em>Free posting already used</em>}
                        </button>
                      );
                    })}
                </div>
              </>
            )}
            {requestStep === 11 && (
              <>
                <div className="care-question">
                  <span>
                    <BadgeCheck /> Ready to publish
                  </span>
                  <h2>Does everything look right?</h2>
                  <p>
                    Review the safe summary before matching with eligible
                    sellers.
                  </p>
                </div>
                <div className="care-review-card">
                  <div>
                    <span>
                      <Sparkles />
                    </span>
                    <p>
                      <small>Category</small>
                      <b>
                        {category.name} · {subcategory.name}
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(0)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <ClipboardCheck />
                    </span>
                    <p>
                      <small>Services</small>
                      <b>{requestDraft.needs.join(", ")}</b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(3)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <MapPin />
                    </span>
                    <p>
                      <small>Private location</small>
                      <b>
                        {requestDraft.locality} ·{" "}
                        {chosenArea?.name ?? "The Bahamas"} ·{" "}
                        {requestDraft.postalCode}
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(4)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <CalendarDays />
                    </span>
                    <p>
                      <small>Schedule</small>
                      <b>
                        {requestDraft.scheduleKind === "recurring"
                          ? `${requestDraft.weekdays.map((day) => weekdayOptions[day]).join(", ")} · ${requestDraft.useSpecificTimes ? `${requestDraft.startTime}–${requestDraft.endTime}` : requestDraft.timePeriods.join(", ")}`
                          : `${requestDraft.startsAt.slice(0, 10)} · ${requestDraft.startTime}–${requestDraft.endTime}`}
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(5)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <CircleDollarSign />
                    </span>
                    <p>
                      <small>Pay range</small>
                      <b>
                        {money(requestDraft.minRate)}–
                        {money(requestDraft.maxRate)} / hour
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(9)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <BadgeCheck />
                    </span>
                    <p>
                      <small>Plan</small>
                      <b>
                        {chosenPlan.name} · {chosenPlan.durationDays} days ·{" "}
                        {chosenPlan.fee === 0 ? "Free" : money(chosenPlan.fee)}
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(10)}>
                      Edit
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          <footer className="care-wizard-footer">
            {requestStep > 0 ? (
              <button
                type="button"
                className="back"
                onClick={() => setRequestStep((step) => Math.max(0, step - 1))}
              >
                <ArrowLeft />
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="continue" disabled={busy}>
              {busy
                ? "Posting…"
                : requestStep === 11
                  ? chosenPlan.fee > 0
                    ? `Pay ${money(chosenPlan.fee)} & post`
                    : "Post free request"
                  : "Continue"}
              <ChevronRight />
            </button>
          </footer>
        </form>
      );
    }
    if (isLegacyRequestWizard(modal, requestStep)) {
      const steps = [
        "Care type",
        "Who",
        "Needs",
        "Address",
        "When",
        "Days & times",
        "Details",
        "Price",
        "Publish",
        "Review",
      ];
      const chosenService = liveServices.find(
        (item) => item.id === requestDraft.serviceId,
      );
      const chosenArea = liveAreas.find(
        (item) => item.id === requestDraft.areaId,
      );
      const chosenPlan =
        adminOps.postingPlans.find(
          (plan) => plan.code === requestDraft.postingPlanCode,
        ) ?? defaultPostingPlans[0];
      const freeEligible = !state.requests.some(
        (entry) => entry.buyerId === currentUserId,
      );
      return (
        <form
          className="care-wizard"
          onSubmit={(event) => {
            event.preventDefault();
            if (requestStep === 9) void createRequest();
            else advanceRequestWizard();
          }}
        >
          <header className="care-wizard-header">
            <div>
              <span>Build your care request</span>
              <b>
                Step {requestStep + 1} of {steps.length} · {steps[requestStep]}
              </b>
            </div>
            <div
              className="care-wizard-progress"
              aria-label={`Step ${requestStep + 1} of ${steps.length}`}
            >
              <i
                style={{
                  width: `${((requestStep + 1) / steps.length) * 100}%`,
                }}
              />
            </div>
          </header>
          <section className="care-wizard-body" aria-live="polite">
            {requestStep === 0 && (
              <>
                <div className="care-question">
                  <span>
                    <Sparkles /> Let’s make this easy
                  </span>
                  <h2>What kind of care do you need?</h2>
                  <p>
                    Choose the closest match. You can add the important details
                    later.
                  </p>
                </div>
                <div className="care-choice-grid services">
                  {liveServices.map((service, index) => (
                    <button
                      type="button"
                      key={service.id}
                      className={
                        requestDraft.serviceId === service.id ? "selected" : ""
                      }
                      onClick={() =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          serviceId: service.id,
                        }))
                      }
                    >
                      <span>
                        {index === 0 ? (
                          <Users />
                        ) : index === 1 ? (
                          <Stethoscope />
                        ) : index === 2 ? (
                          <HeartPulse />
                        ) : index === 3 ? (
                          <HeartHandshake />
                        ) : index === 4 ? (
                          <ShieldCheck />
                        ) : (
                          <Activity />
                        )}
                      </span>
                      <b>{service.name}</b>
                      <small>
                        {index === 0
                          ? "Daily support and companionship"
                          : index === 1
                            ? "Qualified healthcare at home"
                            : index === 2
                              ? "Support after leaving hospital"
                              : index === 3
                                ? "Relief for family caregivers"
                                : index === 4
                                  ? "Personalized disability support"
                                  : "Movement, strength and recovery"}
                      </small>
                      <i>
                        <Check />
                      </i>
                    </button>
                  ))}
                </div>
              </>
            )}
            {requestStep === 1 && (
              <>
                <div className="care-question">
                  <span>
                    <UserRound /> Personalize the match
                  </span>
                  <h2>Who needs care?</h2>
                  <p>
                    Birth details stay private and help Nanas match appropriate
                    care. Sellers see only the necessary age context.
                  </p>
                </div>
                <div
                  className="care-segmented"
                  role="group"
                  aria-label="Care recipient type"
                >
                  <button
                    type="button"
                    className={
                      requestDraft.recipients[0]?.relationship === "self"
                        ? "selected"
                        : ""
                    }
                    onClick={() => chooseRecipientRelationship("self")}
                  >
                    Myself
                  </button>
                  <button
                    type="button"
                    className={
                      requestDraft.recipients[0]?.relationship === "child"
                        ? "selected"
                        : ""
                    }
                    onClick={() => chooseRecipientRelationship("child")}
                  >
                    My child
                  </button>
                  <button
                    type="button"
                    className={
                      requestDraft.recipients[0]?.relationship ===
                      "family_member"
                        ? "selected"
                        : ""
                    }
                    onClick={() => chooseRecipientRelationship("family_member")}
                  >
                    Family member
                  </button>
                </div>
                <div className="care-recipient-list">
                  {requestDraft.recipients.map((recipient, index) => (
                    <article
                      key={recipient.id}
                      className="care-recipient-editor"
                    >
                      <header>
                        <b>
                          {recipient.relationship === "child"
                            ? `Child ${index + 1}`
                            : recipient.label}
                        </b>
                        {requestDraft.recipients.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setRequestDraft((draft) => ({
                                ...draft,
                                recipients: draft.recipients.filter(
                                  (item) => item.id !== recipient.id,
                                ),
                                recipientLabel: `${draft.recipients.length - 1} children`,
                              }))
                            }
                          >
                            Remove
                          </button>
                        )}
                      </header>
                      {recipient.relationship !== "self" && (
                        <label>
                          Private label
                          <input
                            value={recipient.label}
                            maxLength={80}
                            onChange={(event) =>
                              updateRequestRecipient(recipient.id, {
                                label: event.target.value,
                              })
                            }
                            placeholder={
                              recipient.relationship === "child"
                                ? `Child ${index + 1}`
                                : "For example: Mum"
                            }
                          />
                        </label>
                      )}
                      <div className="care-form-grid">
                        <label>
                          Birth month
                          <select
                            aria-label={`Birth month for ${recipient.label}`}
                            required={recipient.relationship === "child"}
                            value={recipient.birthMonth}
                            onChange={(event) =>
                              updateRequestRecipient(recipient.id, {
                                birthMonth: event.target.value,
                              })
                            }
                          >
                            <option value="">Month</option>
                            {monthOptions.map((month, monthIndex) => (
                              <option
                                key={month}
                                value={String(monthIndex + 1)}
                              >
                                {month}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Birth year
                          <select
                            aria-label={`Birth year for ${recipient.label}`}
                            required={recipient.relationship === "child"}
                            value={recipient.birthYear}
                            onChange={(event) =>
                              updateRequestRecipient(recipient.id, {
                                birthYear: event.target.value,
                              })
                            }
                          >
                            <option value="">Year</option>
                            {Array.from(
                              { length: 100 },
                              (_, yearIndex) =>
                                new Date().getFullYear() - yearIndex,
                            ).map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {recipient.relationship === "child" && (
                        <label className="care-checkbox">
                          <input
                            type="checkbox"
                            checked={recipient.expecting}
                            onChange={(event) =>
                              updateRequestRecipient(recipient.id, {
                                expecting: event.target.checked,
                              })
                            }
                          />{" "}
                          I’m expecting
                        </label>
                      )}
                    </article>
                  ))}
                </div>
                {requestDraft.recipients[0]?.relationship === "child" && (
                  <button
                    type="button"
                    className="care-add-person"
                    onClick={addRequestChild}
                  >
                    <span>+</span> Add another child
                  </button>
                )}
              </>
            )}
            {requestStep === 2 && (
              <>
                <div className="care-question">
                  <span>
                    <HeartPulse /> Choose all that apply
                  </span>
                  <h2>What kind of help would be useful?</h2>
                  <p>
                    Select the support that matters most. This becomes part of
                    the safe seller summary.
                  </p>
                </div>
                <div className="care-need-grid">
                  {careNeedOptions.map((need) => (
                    <button
                      type="button"
                      key={need}
                      className={
                        requestDraft.needs.includes(need) ? "selected" : ""
                      }
                      onClick={() => toggleRequestNeed(need)}
                    >
                      <span>
                        <Check />
                      </span>
                      {need}
                    </button>
                  ))}
                </div>
              </>
            )}
            {requestStep === 3 && (
              <>
                <div className="care-question">
                  <span>
                    <MapPin /> Private care location
                  </span>
                  <h2>Where do you need care?</h2>
                  <p>
                    Your exact address is stored in private request details and
                    is never shown in public search results.
                  </p>
                </div>
                <div className="care-choice-grid areas">
                  {liveAreas.map((area) => (
                    <button
                      type="button"
                      key={area.id}
                      className={
                        requestDraft.areaId === area.id ? "selected" : ""
                      }
                      onClick={() =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          areaId: area.id,
                        }))
                      }
                    >
                      <span>
                        <MapPin />
                      </span>
                      <b>{area.name}</b>
                      <small>Approved sellers covering this area</small>
                      <i>
                        <Check />
                      </i>
                    </button>
                  ))}
                </div>
                <div className="care-address-form">
                  <label className="full">
                    Street address
                    <input
                      required
                      value={requestDraft.addressLine1}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          addressLine1: event.target.value,
                        }))
                      }
                      placeholder="House number and street"
                    />
                  </label>
                  <label className="full">
                    Apartment, unit or building (optional)
                    <input
                      value={requestDraft.addressLine2}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          addressLine2: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Island
                    <select
                      required
                      value={requestDraft.islandId}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          islandId: event.target.value,
                        }))
                      }
                    >
                      {liveIslands.map((island) => (
                        <option key={island.id} value={island.id}>
                          {island.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    City or locality
                    <input
                      required
                      value={requestDraft.locality}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          locality: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Postal / ZIP code <span aria-hidden="true">*</span>
                    <input
                      aria-label="Postal or ZIP code"
                      required
                      value={requestDraft.postalCode}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          postalCode: event.target.value,
                        }))
                      }
                      placeholder="Postal or ZIP code"
                    />
                  </label>
                  <label>
                    Access notes (optional)
                    <input
                      value={requestDraft.accessNotes}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          accessNotes: event.target.value,
                        }))
                      }
                      placeholder="Gate, parking or arrival instructions"
                    />
                  </label>
                </div>
                <div className="privacy-note">
                  <ShieldCheck />
                  Only an eligible seller receives the precise address at the
                  appropriate booking stage.
                </div>
              </>
            )}
            {requestStep === 4 && (
              <>
                <div className="care-question">
                  <span>
                    <CalendarDays /> Plan the care
                  </span>
                  <h2>When do you need care?</h2>
                  <p>
                    Choose recurring care or a one-time visit, then set the date
                    range.
                  </p>
                </div>
                <div
                  className="care-segmented schedule-kind"
                  role="group"
                  aria-label="Care schedule type"
                >
                  <button
                    type="button"
                    className={
                      requestDraft.scheduleKind === "recurring"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setRequestDraft((draft) => ({
                        ...draft,
                        scheduleKind: "recurring",
                        mode: "scheduled",
                      }))
                    }
                  >
                    Recurring
                  </button>
                  <button
                    type="button"
                    className={
                      requestDraft.scheduleKind === "one_time" ? "selected" : ""
                    }
                    onClick={() =>
                      setRequestDraft((draft) => ({
                        ...draft,
                        scheduleKind: "one_time",
                        mode: "scheduled",
                      }))
                    }
                  >
                    One time
                  </button>
                </div>
                <div className="care-form-grid schedule-dates">
                  <label>
                    Estimated start date
                    <input
                      type="date"
                      required
                      value={requestDraft.startsAt.slice(0, 10)}
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          startsAt: `${event.target.value}T${draft.startsAt.slice(11, 16) || "09:00"}`,
                        }))
                      }
                    />
                  </label>
                  {requestDraft.scheduleKind === "recurring" && (
                    <label>
                      Estimated end date (optional)
                      <input
                        type="date"
                        min={requestDraft.startsAt.slice(0, 10)}
                        value={requestDraft.endDate}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            endDate: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                </div>
                <label className="care-checkbox">
                  <input
                    type="checkbox"
                    checked={requestDraft.flexibleStart}
                    onChange={(event) =>
                      setRequestDraft((draft) => ({
                        ...draft,
                        flexibleStart: event.target.checked,
                      }))
                    }
                  />{" "}
                  My start date is flexible
                </label>
              </>
            )}
            {requestStep === 5 && (
              <>
                <div className="care-question">
                  <span>
                    <Clock3 /> Build the schedule
                  </span>
                  <h2>
                    {requestDraft.scheduleKind === "recurring"
                      ? "Which days and times?"
                      : "What time should care happen?"}
                  </h2>
                  <p>
                    Choose broad time periods or add exact start and end times.
                  </p>
                </div>
                {requestDraft.scheduleKind === "recurring" && (
                  <div className="care-day-picker">
                    {weekdayOptions.map((day, index) => (
                      <button
                        type="button"
                        key={day}
                        className={
                          requestDraft.weekdays.includes(index)
                            ? "selected"
                            : ""
                        }
                        onClick={() => toggleRequestWeekday(index)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}
                {!requestDraft.useSpecificTimes && (
                  <div className="care-period-picker">
                    {[
                      ["morning", "Mornings"],
                      ["afternoon", "Afternoons"],
                      ["evening", "Evenings"],
                      ["overnight", "Overnight"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        className={
                          requestDraft.timePeriods.includes(value)
                            ? "selected"
                            : ""
                        }
                        onClick={() => toggleRequestTimePeriod(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {requestDraft.useSpecificTimes && (
                  <div className="care-form-grid">
                    <label>
                      Start time
                      <input
                        type="time"
                        required
                        value={requestDraft.startTime}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            startTime: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      End time
                      <input
                        type="time"
                        required
                        value={requestDraft.endTime}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            endTime: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
                <button
                  type="button"
                  className="care-text-action"
                  onClick={() =>
                    setRequestDraft((draft) => ({
                      ...draft,
                      useSpecificTimes: !draft.useSpecificTimes,
                    }))
                  }
                >
                  {requestDraft.useSpecificTimes
                    ? "Use general time periods instead"
                    : "Add specific times instead"}
                </button>
                <label className="care-checkbox">
                  <input
                    type="checkbox"
                    checked={requestDraft.scheduleVaries}
                    onChange={(event) =>
                      setRequestDraft((draft) => ({
                        ...draft,
                        scheduleVaries: event.target.checked,
                      }))
                    }
                  />{" "}
                  My schedule may vary
                </label>
              </>
            )}
            {requestStep === 6 && (
              <>
                <div className="care-question">
                  <span>
                    <ClipboardCheck /> Just the essentials
                  </span>
                  <h2>What should sellers know?</h2>
                  <p>
                    Describe the routine, communication preferences, and
                    practical support needed. Avoid diagnoses or highly
                    sensitive details here.
                  </p>
                </div>
                <div className="care-details-form">
                  <label>
                    Safe care summary
                    <textarea
                      value={requestDraft.summary}
                      minLength={10}
                      maxLength={900}
                      required
                      onChange={(event) =>
                        setRequestDraft((draft) => ({
                          ...draft,
                          summary: event.target.value,
                        }))
                      }
                      placeholder="For example: Friendly morning support, mobility assistance around the home, meal preparation and clear updates to the family."
                    />
                    <small>{requestDraft.summary.length}/900 characters</small>
                  </label>
                </div>
              </>
            )}
            {requestStep === 7 && (
              <>
                <div className="care-question">
                  <span>
                    <CircleDollarSign /> Set your budget
                  </span>
                  <h2>What price range works for you?</h2>
                  <p>
                    Enter the hourly range sellers should quote within. You can
                    still compare itemized offers.
                  </p>
                </div>
                <div className="care-rate-range">
                  <label>
                    Minimum hourly rate (BSD)
                    <div className="care-money-input">
                      <span>$</span>
                      <input
                        aria-label="Minimum hourly rate"
                        type="number"
                        min="1"
                        required
                        value={requestDraft.minRate}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            minRate: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </label>
                  <label>
                    Maximum hourly rate (BSD)
                    <div className="care-money-input">
                      <span>$</span>
                      <input
                        aria-label="Maximum hourly rate"
                        type="number"
                        min={requestDraft.minRate}
                        required
                        value={requestDraft.maxRate}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            maxRate: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </label>
                  <label>
                    Maximum total budget (optional)
                    <div className="care-money-input">
                      <span>$</span>
                      <input
                        aria-label="Maximum total budget"
                        type="number"
                        min="0"
                        value={requestDraft.budget}
                        onChange={(event) =>
                          setRequestDraft((draft) => ({
                            ...draft,
                            budget: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </label>
                </div>
                <div className="care-match-reassurance">
                  <span>
                    <ShieldCheck /> You approve every quote before payment
                  </span>
                  <small>
                    No seller can charge outside an accepted, itemized quote.
                  </small>
                </div>
              </>
            )}
            {requestStep === 8 && (
              <>
                <div className="care-question">
                  <span>
                    <BadgeCheck /> Choose how to publish
                  </span>
                  <h2>Post free or reach sellers faster?</h2>
                  <p>
                    Every buyer receives one free posting. Additional postings
                    use an admin-configured plan and duration.
                  </p>
                </div>
                <div className="care-plan-grid">
                  {adminOps.postingPlans
                    .filter((plan) => plan.active)
                    .map((plan) => {
                      const unavailable = plan.fee === 0 && !freeEligible;
                      return (
                        <button
                          type="button"
                          key={plan.code}
                          disabled={unavailable}
                          className={`${requestDraft.postingPlanCode === plan.code ? "selected" : ""} ${plan.featured ? "featured" : ""}`}
                          onClick={() =>
                            setRequestDraft((draft) => ({
                              ...draft,
                              postingPlanCode: plan.code,
                            }))
                          }
                        >
                          <span>{plan.featured ? "Priority" : "Standard"}</span>
                          <b>{plan.name}</b>
                          <strong>
                            {plan.fee === 0 ? "Free" : money(plan.fee)}
                          </strong>
                          <p>{plan.description}</p>
                          <small>Visible for {plan.durationDays} days</small>
                          <i>
                            <Check />
                          </i>
                          {unavailable && <em>Free posting already used</em>}
                        </button>
                      );
                    })}
                </div>
                <div className="privacy-note">
                  <CircleDollarSign />
                  {chosenPlan.fee === 0
                    ? "No payment is required for this posting."
                    : `${money(chosenPlan.fee)} simulated payment will be confirmed when you publish.`}
                </div>
              </>
            )}
            {requestStep === 9 && (
              <>
                <div className="care-question">
                  <span>
                    <BadgeCheck /> Ready to match
                  </span>
                  <h2>Does everything look right?</h2>
                  <p>
                    Your request goes only to eligible approved sellers who
                    match the service, area and schedule.
                  </p>
                </div>
                <div className="care-review-card">
                  <div>
                    <span>
                      <Stethoscope />
                    </span>
                    <p>
                      <small>Care type</small>
                      <b>{chosenService?.name ?? "Healthcare care"}</b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(0)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <UserRound />
                    </span>
                    <p>
                      <small>Care recipient</small>
                      <b>
                        {requestDraft.recipients
                          .map((recipient) => recipient.label)
                          .join(", ")}
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(1)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <HeartPulse />
                    </span>
                    <p>
                      <small>Support needed</small>
                      <b>{requestDraft.needs.join(", ")}</b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(2)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <MapPin />
                    </span>
                    <p>
                      <small>Private location</small>
                      <b>
                        {requestDraft.addressLine1}, {requestDraft.locality} ·{" "}
                        {chosenArea?.name ?? "The Bahamas"} ·{" "}
                        {requestDraft.postalCode}
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(3)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <CalendarDays />
                    </span>
                    <p>
                      <small>Schedule</small>
                      <b>
                        {requestDraft.scheduleKind === "recurring"
                          ? `${requestDraft.weekdays.map((day) => weekdayOptions[day]).join(", ")} · ${requestDraft.useSpecificTimes ? `${requestDraft.startTime}–${requestDraft.endTime}` : requestDraft.timePeriods.join(", ")}`
                          : `${requestDraft.startsAt.slice(0, 10)} · ${requestDraft.startTime}–${requestDraft.endTime}`}
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(4)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <CircleDollarSign />
                    </span>
                    <p>
                      <small>Rate range</small>
                      <b>
                        {money(requestDraft.minRate)}–
                        {money(requestDraft.maxRate)} / hour
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(7)}>
                      Edit
                    </button>
                  </div>
                  <div>
                    <span>
                      <BadgeCheck />
                    </span>
                    <p>
                      <small>Publishing plan</small>
                      <b>
                        {chosenPlan.name} · {chosenPlan.durationDays} days ·{" "}
                        {chosenPlan.fee === 0 ? "Free" : money(chosenPlan.fee)}
                      </b>
                    </p>
                    <button type="button" onClick={() => setRequestStep(8)}>
                      Edit
                    </button>
                  </div>
                </div>
                <div className="care-match-reassurance">
                  <span>
                    <Sparkles /> Nanas will look for approved matches
                  </span>
                  <small>
                    You remain in control: compare quotes, message safely, and
                    accept only when you’re comfortable.
                  </small>
                </div>
              </>
            )}
          </section>
          <footer className="care-wizard-footer">
            {requestStep > 0 ? (
              <button
                type="button"
                className="back"
                onClick={() => setRequestStep((step) => Math.max(0, step - 1))}
              >
                <ArrowLeft /> Back
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="continue" disabled={busy}>
              {busy
                ? "Posting…"
                : requestStep === 9
                  ? chosenPlan.fee > 0
                    ? `Pay ${money(chosenPlan.fee)} & post`
                    : "Post free request"
                  : "Continue"}
              <ChevronRight />
            </button>
          </footer>
        </form>
      );
    }
    if (modal === "quote")
      return (
        <>
          <ModalHead
            icon={<ClipboardCheck />}
            title="Send a care quote"
            copy="Quote only within your approved services and availability."
          />
          <form className="portal-form" onSubmit={submitQuote}>
            <div className="form-grid">
              <label>
                Rate (BSD/hour)
                <input
                  name="rate"
                  type="number"
                  min="1"
                  defaultValue="38"
                  required
                />
              </label>
              <label>
                Travel fee (BSD)
                <input
                  name="travel"
                  type="number"
                  min="0"
                  defaultValue="0"
                  required
                />
              </label>
            </div>
            <label>
              Message to buyer
              <textarea
                name="message"
                maxLength={1200}
                required
                defaultValue="I am available and have relevant experience for this care need. I will keep you updated throughout the visit."
              />
            </label>
            <button disabled={busy} type="submit">
              {busy ? "Sending…" : "Send quote"}
            </button>
          </form>
        </>
      );
    if (modal === "message")
      return (
        <>
          <ModalHead
            icon={<MessageCircle />}
            title="New secure message"
            copy="Keep healthcare coordination inside the booking conversation."
          />
          <form className="portal-form" onSubmit={sendMessage}>
            <label>
              Message
              <textarea name="body" maxLength={4000} required />
            </label>
            <button type="submit">Send message</button>
          </form>
        </>
      );
    if (modal === "review")
      return (
        <>
          <ModalHead
            icon={<Star />}
            title="Leave a verified review"
            copy="Only this completed booking can create this review."
          />
          <form className="portal-form" onSubmit={submitReview}>
            <label>
              Overall rating
              <select name="rating">
                <option value="5">5 — Excellent</option>
                <option value="4">4 — Very good</option>
                <option value="3">3 — Good</option>
                <option value="2">2 — Needs improvement</option>
                <option value="1">1 — Poor</option>
              </select>
            </label>
            <label>
              Review
              <textarea
                name="body"
                maxLength={2000}
                placeholder="Share clear, respectful feedback about the completed care."
              />
            </label>
            <button type="submit">Submit verified review</button>
          </form>
        </>
      );
    if (modal === "user-action")
      return (
        <>
          <ModalHead
            icon={<Ban />}
            title="Account enforcement action"
            copy="A reason is required and this action will appear in the immutable admin audit log."
          />
          <form className="portal-form" onSubmit={adminUserAction}>
            <label>
              Action
              <select name="command">
                <option value="restrict">Restrict</option>
                <option value="suspend">Suspend</option>
                <option value="ban">Ban / close</option>
                <option value="restore">Restore</option>
              </select>
            </label>
            <label>
              Reason
              <textarea
                name="reason"
                minLength={5}
                maxLength={1000}
                required
                placeholder="State the evidence-based operational reason."
              />
            </label>
            <button type="submit">Record action</button>
          </form>
        </>
      );
    if (modal === "booking-detail" && selectedBooking)
      return (
        <>
          <ModalHead
            icon={<CalendarDays />}
            title={`${selectedBooking.reference} · ${selectedBooking.service}`}
            copy="Authoritative visit status, timeline, protected payment, session code, support, and next actions."
          />
          <div className="booking-detail-summary">
            <div>
              {status(selectedBooking.status)}
              <strong>{money(selectedBooking.total)}</strong>
            </div>
            <p>
              {selectedBooking.buyerName} ↔ {selectedBooking.sellerName}
            </p>
            <small>
              {dateTime(selectedBooking.startsAt)} to{" "}
              {dateTime(selectedBooking.endsAt)}
            </small>
          </div>
          <TaskList
            items={[
              "Quote accepted and simulated payment captured",
              `Booking status: ${selectedBooking.status.replaceAll("_", " ")}`,
              selectedBooking.status === "completed"
                ? "Seller funds released to simulated wallet"
                : "Funds remain protected until eligible completion",
            ]}
          />
          {selectedBooking.status === "confirmed" && role !== "admin" && (
            <div className="session-code-box">
              {role === "buyer" && (
                <>
                  <button onClick={() => generateSessionCode(selectedBooking)}>
                    Generate 6-digit visit code
                  </button>
                  {state.sessionCodes[selectedBooking.id] && (
                    <>
                      <strong>{state.sessionCodes[selectedBooking.id]}</strong>
                      <small>
                        Short-lived local test code · never stored in plaintext
                        by the database
                      </small>
                    </>
                  )}
                </>
              )}
              {role === "seller" && (
                <form
                  className="portal-form"
                  onSubmit={verifySessionAndCheckIn}
                >
                  <label>
                    Buyer’s visit code
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      required
                    />
                  </label>
                  <button type="submit">Verify code & check in</button>
                </form>
              )}
            </div>
          )}
          <div className="modal-action-grid">
            {role !== "admin" && selectedBooking.status === "confirmed" && (
              <button onClick={() => setModal("cancel-booking")}>
                Preview cancellation
              </button>
            )}
            {role !== "admin" &&
              [
                "confirmed",
                "in_progress",
                "completion_pending",
                "completed",
              ].includes(selectedBooking.status) && (
                <button onClick={() => setModal("open-dispute")}>
                  Open dispute
                </button>
              )}
            {role !== "admin" &&
              ["confirmed", "in_progress", "completion_pending"].includes(
                selectedBooking.status,
              ) && (
                <button
                  className="danger"
                  onClick={() => setModal("safety-alert")}
                >
                  Urgent safety concern
                </button>
              )}
          </div>
        </>
      );
    if (modal === "cancel-booking" && selectedBooking) {
      const preview = cancellationPreview(selectedBooking);
      return (
        <>
          <ModalHead
            icon={<Ban />}
            title="Preview booking cancellation"
            copy="The connected command recalculates the snapshotted cancellation rule and posts matching refund ledger entries."
          />
          <div className="quote-breakdown">
            <span>
              Protected payment<b>{money(selectedBooking.total)}</b>
            </span>
            <span>
              Cancellation fee ({preview.feePercent}%)
              <b>{money(preview.fee)}</b>
            </span>
            <span className="total">
              Refund<b>{money(preview.refund)}</b>
            </span>
          </div>
          <form className="portal-form" onSubmit={cancelBooking}>
            <label>
              Cancellation reason
              <select name="reason">
                <option value="buyer_schedule_changed">Schedule changed</option>
                <option value="seller_unavailable">Seller unavailable</option>
                <option value="care_need_changed">Care need changed</option>
                <option value="safety_concern">Safety concern</option>
              </select>
            </label>
            <button disabled={busy} type="submit">
              Confirm cancellation & simulated refund
            </button>
          </form>
        </>
      );
    }
    if (modal === "open-dispute" && selectedBooking)
      return (
        <>
          <ModalHead
            icon={<LifeBuoy />}
            title="Open a service dispute"
            copy="A dispute preserves evidence and holds eligible simulated funds for reasoned admin review."
          />
          <form className="portal-form" onSubmit={openDispute}>
            <label>
              Reason
              <select name="reason">
                <option value="care_quality">Care quality</option>
                <option value="visit_timing">Visit timing</option>
                <option value="payment_or_fee">Payment or fee</option>
                <option value="no_show">No-show</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              What happened?
              <textarea
                name="summary"
                minLength={10}
                maxLength={3000}
                required
              />
            </label>
            <button type="submit">Open dispute & hold funds</button>
          </form>
        </>
      );
    if (modal === "safety-alert")
      return (
        <>
          <ModalHead
            icon={<LifeBuoy />}
            title="Report an urgent safety concern"
            copy="Nanas is not an emergency service. This alerts authorized operations and never claims external authorities were contacted."
          />
          <form className="portal-form" onSubmit={triggerSafetyAlert}>
            <label>
              Concern category
              <select name="category">
                <option value="immediate_personal_safety">
                  Immediate personal safety
                </option>
                <option value="unexpected_health_event">
                  Unexpected health event
                </option>
                <option value="unsafe_environment">Unsafe environment</option>
                <option value="missing_or_unresponsive_party">
                  Missing or unresponsive party
                </option>
                <option value="other_urgent_concern">
                  Other urgent concern
                </option>
              </select>
            </label>
            <div className="privacy-note">
              <ShieldCheck />
              Only minimum booking context is included. Contact locally approved
              emergency services for immediate danger.
            </div>
            <button className="danger-button" type="submit">
              Send urgent alert
            </button>
          </form>
        </>
      );
    if (modal === "support-case")
      return (
        <>
          <ModalHead
            icon={<LifeBuoy />}
            title="Open a Nanas support case"
            copy="Choose the operational topic and describe the help you need. Sensitive details remain private."
          />
          <form className="portal-form" onSubmit={createSupportCase}>
            <label>
              Topic
              <select name="category">
                <option value="booking">Booking</option>
                <option value="payment">Payment</option>
                <option value="account">Account</option>
                <option value="verification">Verification</option>
                <option value="privacy">Privacy</option>
                <option value="appeal">Appeal</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Subject
              <input name="subject" minLength={5} maxLength={160} required />
            </label>
            <label>
              Details
              <textarea
                name="details"
                minLength={10}
                maxLength={4000}
                required
              />
            </label>
            <button type="submit">Create support case</button>
          </form>
        </>
      );
    if (modal === "moderation-action")
      return (
        <>
          <ModalHead
            icon={<ShieldCheck />}
            title="Resolve moderation report"
            copy="Choose a proportionate action and preserve the evidence-based reason. The report and immutable action remain auditable."
          />
          <form className="portal-form" onSubmit={resolveModerationReport}>
            <label>
              Decision
              <select name="moderationAction">
                <option value="allow">Allow content</option>
                <option value="warn">Warn account</option>
                <option value="limit">Limit visibility</option>
                <option value="remove">Remove content</option>
                <option value="restrict">Restrict account</option>
                <option value="escalate">Escalate for specialist review</option>
              </select>
            </label>
            <label>
              Reason code
              <input
                name="reasonCode"
                minLength={2}
                maxLength={80}
                required
                placeholder="policy_review_completed"
              />
            </label>
            <label>
              Public note
              <textarea name="publicNote" maxLength={1000} />
            </label>
            <label>
              Private operations note
              <textarea name="privateNote" maxLength={2000} />
            </label>
            <button type="submit">Record moderation decision</button>
          </form>
        </>
      );
    if (modal === "operations-case" && selectedCaseKind)
      return (
        <>
          <ModalHead
            icon={<LifeBuoy />}
            title={`Manage ${selectedCaseKind === "support" ? "support case" : "safety incident"}`}
            copy="Assignment, acknowledgement, and resolution require an operational note and create an immutable admin audit event."
          />
          <form className="portal-form" onSubmit={manageOperationsCase}>
            <label>
              Action
              <select name="caseAction">
                <option value="assign">Assign to me</option>
                <option value="acknowledge">Acknowledge and investigate</option>
                <option value="resolve">Resolve case</option>
              </select>
            </label>
            <label>
              Operational note
              <textarea
                name="note"
                minLength={5}
                maxLength={1000}
                required
                placeholder="Record the evidence reviewed, follow-up, or resolution rationale."
              />
            </label>
            <button type="submit">Record case action</button>
          </form>
        </>
      );
    if (modal === "message-audit")
      return (
        <>
          <ModalHead
            icon={<MessageCircle />}
            title="Purpose-gated message access"
            copy="Choose the specific authorized case purpose. The read and its reason will be written to the sensitive-access audit log."
          />
          <form className="portal-form" onSubmit={openAdminConversation}>
            <label>
              Access purpose
              <select name="purpose">
                <option value="dispute-review">Dispute review</option>
                <option value="safety-incident">Safety incident</option>
                <option value="support-case">Support case</option>
                <option value="moderation-review">Moderation review</option>
              </select>
            </label>
            <label>
              Authorized case ID
              <input
                name="caseId"
                required
                minLength={3}
                maxLength={120}
                placeholder="dispute-1001 or support-1001"
              />
            </label>
            <label>
              Access reason
              <textarea
                name="reason"
                required
                minLength={5}
                maxLength={1000}
                placeholder="Explain why this conversation is necessary for the named case."
              />
            </label>
            <button type="submit">Record purpose & open conversation</button>
          </form>
        </>
      );
    if (modal === "message-upgrade") {
      const plan =
        adminOps.postingPlans.find(
          (item) => item.code === "premium" && item.active,
        ) ?? defaultPostingPlans[1];
      return (
        <>
          <ModalHead
            icon={<LockKeyhole />}
            title="Unlock secure messaging"
            copy="Review the price before simulating payment. No raw card data is stored in this demo."
          />
          <form className="portal-form" onSubmit={simulateMessageUpgrade}>
            <div className="info-banner">
              <CircleDollarSign />
              <div>
                <b>{plan.name}</b>
                <span>{money(plan.fee)} BSD · one simulated checkout</span>
              </div>
            </div>
            <label>
              Payment method
              <select name="paymentMethod" required>
                <option value="demo-card">Demo card ending 4242</option>
              </select>
            </label>
            <button type="submit">Simulate {money(plan.fee)} payment & unlock</button>
          </form>
        </>
      );
    }
    return (
      <>
        <ModalHead
          icon={<FileCheck2 />}
          title="Upload verification document"
          copy="For beta, documents use a private Supabase Storage bucket. Cloudinary can replace public media later."
        />
        <form className="portal-form" onSubmit={uploadKyc}>
          <label>
            Document type
            <select name="type">
              <option>Government identity</option>
              <option>Healthcare credential</option>
              <option>Background check consent</option>
              <option>Professional indemnity insurance</option>
            </select>
          </label>
          <label>
            Private file
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
            />
          </label>
          <div className="privacy-note">
            <ShieldCheck />
            Only you and authorized KYC admins can access this file.
          </div>
          <button disabled={busy} type="submit">
            {busy ? "Uploading…" : "Upload securely"}
          </button>
        </form>
      </>
    );
  }
}

function ModalHead({
  icon,
  title,
  copy,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="modal-head">
      <div>{icon}</div>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}
function serviceId(name: string) {
  return (
    {
      "Senior care": "21000000-0000-0000-0000-000000000001",
      "Home nursing": "21000000-0000-0000-0000-000000000002",
      "Post-hospital care": "21000000-0000-0000-0000-000000000003",
      "Respite care": "21000000-0000-0000-0000-000000000004",
      "Disability care": "21000000-0000-0000-0000-000000000005",
      Physiotherapy: "21000000-0000-0000-0000-000000000006",
    } as Record<string, string>
  )[name];
}
function serviceAreaId(name: string) {
  return (
    (
      {
        "Nassau & Paradise Island": "11000000-0000-0000-0000-000000000001",
        "Freeport & Lucaya": "11000000-0000-0000-0000-000000000002",
        "Marsh Harbour": "11000000-0000-0000-0000-000000000003",
      } as Record<string, string>
    )[name] ?? "11000000-0000-0000-0000-000000000001"
  );
}
