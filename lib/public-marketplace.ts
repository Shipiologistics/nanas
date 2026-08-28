import type { DemoUser } from "./demo-data";

export type PublicCareService = {
  slug: string;
  name: string;
  short: string;
  description: string;
  rate: number;
  accent: string;
  needs: string[];
  includes: string[];
};

export const careServices: PublicCareService[] = [
  {
    slug: "senior-care",
    name: "Senior care",
    short: "Companionship and daily support",
    description:
      "Respectful help with routines, mobility, meals, companionship, and family updates at home.",
    rate: 25,
    accent: "mint",
    needs: [
      "Companionship",
      "Mobility support",
      "Meal preparation",
      "Medication reminders",
      "Personal routines",
      "Family updates",
    ],
    includes: [
      "Approved individual seller",
      "Private care-request brief",
      "Clear hourly quote",
      "Booking-based review",
    ],
  },
  {
    slug: "home-nursing",
    name: "Home nursing",
    short: "Qualified nursing support at home",
    description:
      "Credential-reviewed nursing visits for approved clinical support, monitoring, wound care, and recovery plans.",
    rate: 38,
    accent: "teal",
    needs: [
      "Vital observations",
      "Wound support",
      "Recovery monitoring",
      "Medication support",
      "Care-plan follow-up",
      "Family handover",
    ],
    includes: [
      "Credential eligibility check",
      "Scope confirmed before booking",
      "Protected visit record",
      "Secure care messaging",
    ],
  },
  {
    slug: "post-hospital-care",
    name: "Post-hospital care",
    short: "A calmer recovery after discharge",
    description:
      "Practical recovery support following discharge, an outpatient procedure, or a change in health needs.",
    rate: 34,
    accent: "sand",
    needs: [
      "Mobility assistance",
      "Meal support",
      "Appointment preparation",
      "Routine reminders",
      "Calm observation",
      "Family coordination",
    ],
    includes: [
      "Recovery-focused matching",
      "Flexible visit lengths",
      "General-area privacy",
      "Simulated payment protection",
    ],
  },
  {
    slug: "respite-care",
    name: "Respite care",
    short: "Trusted relief for family caregivers",
    description:
      "Planned support that lets family caregivers rest, work, attend appointments, or manage other responsibilities.",
    rate: 28,
    accent: "sky",
    needs: [
      "Short care visits",
      "Half-day support",
      "Companionship",
      "Routine continuity",
      "Meal assistance",
      "Caregiver handover",
    ],
    includes: [
      "Recurring schedule options",
      "Care checklist",
      "Private household notes",
      "Continuity where possible",
    ],
  },
  {
    slug: "disability-care",
    name: "Disability care",
    short: "Person-centred everyday assistance",
    description:
      "Individual support shaped around access, choice, routines, community participation, and independence.",
    rate: 30,
    accent: "lilac",
    needs: [
      "Personal routines",
      "Community access",
      "Mobility assistance",
      "Meal preparation",
      "Appointment support",
      "Family coordination",
    ],
    includes: [
      "Person-centred brief",
      "Accessibility preferences",
      "Approved support scope",
      "Private care notes",
    ],
  },
  {
    slug: "physiotherapy",
    name: "Physiotherapy",
    short: "Mobility and rehabilitation at home",
    description:
      "Credential-reviewed home physiotherapy focused on movement, strength, confidence, and recovery goals.",
    rate: 52,
    accent: "coral",
    needs: [
      "Mobility assessment",
      "Home exercises",
      "Post-operative recovery",
      "Strength support",
      "Balance confidence",
      "Progress planning",
    ],
    includes: [
      "PT credential review",
      "Goal-led visit scope",
      "Home exercise guidance",
      "Progress updates",
    ],
  },
];

export const publicProviders: DemoUser[] = [
  {
    id: "alicia-m",
    name: "Alicia M.",
    email: "",
    role: "seller",
    status: "active",
    avatar: "AM",
    sellerDetails: {
      headline: "Registered nurse providing thoughtful care at home",
      locality: "Nassau",
      island: "New Providence",
      rating: 4.9,
      reviewCount: 18,
      completedBookings: 46,
      responseRate: 96,
      badges: ["Top care seller", "Credentials current"],
      languages: ["English", "Bahamian Creole"],
      availability: [1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        start: "06:00",
        end: "23:00",
        timezone: "America/Nassau",
      })),
      credentials: [
        {
          type: "Registered nurse licence",
          issuingBody: "The Bahamas Nursing Council",
          verifiedAt: "2026-07-18T12:00:00Z",
        },
        { type: "CPR and first aid", verifiedAt: "2026-06-04T12:00:00Z" },
      ],
      safetyChecks: [
        {
          type: "background_check",
          status: "completed",
          completedAt: "2026-04-01T12:00:00Z",
          summary: "Required Nanas background screening completed.",
        },
      ],
      services: [
        {
          id: "senior-care",
          name: "Senior care",
          rate: 32,
          rateMax: 42,
          yearsExperience: 6,
          bio: "Hello, I provide calm and dependable senior care for adults who want to remain comfortable and involved in their daily routines at home. I can support companionship, safe movement, meals, medication reminders and appointment preparation. I learn each household’s preferences, communicate clearly with family members and preserve the dignity and independence of the person receiving care. I am happy to follow an established routine and provide thoughtful updates after every visit.",
          capabilities: [
            "Companionship",
            "Mobility support",
            "Meal preparation",
            "Medication reminders",
            "Appointment support",
            "Family updates",
          ],
        },
        {
          id: "home-nursing",
          name: "Home nursing",
          rate: 38,
          rateMax: 55,
          yearsExperience: 8,
          bio: "Hello, I bring experienced nursing support into the home with a calm, respectful and safety-focused approach. I can help with approved health observations, medication support, wound-care assistance, recovery monitoring and clear care-plan communication. I explain what I am doing in plain language, listen carefully to the client and family, and document important observations. My goal is to make each visit organized and reassuring while always working within my verified professional scope.",
          capabilities: [
            "Health observations",
            "Medication support",
            "Wound-care assistance",
            "Recovery monitoring",
            "Care-plan communication",
            "Family education",
          ],
        },
        {
          id: "post-hospital-care",
          name: "Post-hospital care",
          rate: 40,
          rateMax: 58,
          yearsExperience: 5,
          bio: "Hello, I help adults and families make the first days at home after a hospital stay or outpatient procedure feel safer and less overwhelming. I support the agreed discharge routine, recovery observations, safe mobility, meals and appointment reminders. I watch for changes that should be shared with the family or clinical team, communicate clearly after each visit and encourage the person receiving care to move at a comfortable pace within the written care plan.",
          capabilities: [
            "Discharge-plan support",
            "Recovery observations",
            "Mobility assistance",
            "Meal preparation",
            "Appointment reminders",
            "Family communication",
          ],
        },
      ],
    },
  },
  {
    id: "marcus-d",
    name: "Marcus D.",
    email: "",
    role: "seller",
    status: "active",
    avatar: "MD",
    sellerDetails: {
      headline: "Home health aide · respectful everyday support",
      locality: "Freeport",
      island: "Grand Bahama",
      rating: 4.8,
      reviewCount: 31,
      completedBookings: 49,
      responseRate: 94,
      badges: ["Identity verified", "Background check reviewed"],
      languages: ["English"],
      services: [
        {
          id: "senior-care",
          name: "Senior care",
          rate: 25,
          rateMax: 34,
          yearsExperience: 6,
          bio: "Patient, practical senior support for daily routines, mobility, appointments, and companionship at home.",
          capabilities: [
            "Companionship",
            "Mobility support",
            "Meal preparation",
          ],
        },
        {
          id: "respite-care",
          name: "Respite care",
          rate: 28,
          rateMax: 36,
          yearsExperience: 5,
          bio: "Dependable respite care that respects established household routines and gives family caregivers time to rest.",
          capabilities: ["Routine support", "Companionship", "Family updates"],
        },
      ],
    },
  },
  {
    id: "simone-r",
    name: "Simone R.",
    email: "",
    role: "seller",
    status: "active",
    avatar: "SR",
    sellerDetails: {
      headline: "Physiotherapist · mobility and recovery at home",
      locality: "Nassau",
      island: "New Providence",
      rating: 5,
      reviewCount: 27,
      completedBookings: 37,
      responseRate: 100,
      badges: ["Identity verified", "PT credential reviewed", "Highly rated"],
      languages: ["English"],
      services: [
        {
          id: "physiotherapy",
          name: "Physiotherapy",
          rate: 52,
          rateMax: 70,
          yearsExperience: 7,
          bio: "Home-based rehabilitation and mobility support designed around each patient’s goals and comfort.",
          capabilities: [
            "Mobility assessment",
            "Guided exercise",
            "Balance support",
          ],
        },
        {
          id: "post-hospital-care",
          name: "Post-hospital care",
          rate: 48,
          rateMax: 65,
          yearsExperience: 5,
          bio: "Movement-focused post-hospital support that helps clients rebuild confidence safely at home.",
          capabilities: [
            "Mobility assistance",
            "Recovery exercises",
            "Home-safety observations",
          ],
        },
      ],
    },
  },
  {
    id: "janine-c",
    name: "Janine C.",
    email: "",
    role: "seller",
    status: "active",
    avatar: "JC",
    sellerDetails: {
      headline: "Care companion · consistent family support",
      locality: "Nassau",
      island: "New Providence",
      rating: 4.7,
      reviewCount: 18,
      completedBookings: 29,
      languages: ["English"],
      services: [
        { id: "senior-care", name: "Senior care", rate: 27 },
        { id: "disability-care", name: "Disability care", rate: 31 },
      ],
    },
  },
];

export const publicCareRequests = [
  {
    slug: "senior-care-nassau-morning",
    service: "Senior care",
    title: "Morning senior-care support in Nassau",
    area: "Nassau & Paradise Island",
    when: "Tomorrow · 8:00 AM",
    hours: 3,
    budget: 180,
    quotes: 2,
    description:
      "Companionship, medication reminders, breakfast support, and a calm family update after the visit.",
    needs: [
      "Companionship",
      "Medication reminders",
      "Meal support",
      "Family update",
    ],
  },
  {
    slug: "post-hospital-freeport",
    service: "Post-hospital care",
    title: "Support after an outpatient procedure",
    area: "Freeport & Lucaya",
    when: "Friday · 11:00 AM",
    hours: 4,
    budget: 220,
    quotes: 1,
    description:
      "Help settling in at home, preparing a light meal, safe mobility, and routine reminders after discharge.",
    needs: [
      "Mobility assistance",
      "Meal preparation",
      "Recovery support",
      "Calm observation",
    ],
  },
  {
    slug: "respite-care-nassau",
    service: "Respite care",
    title: "Saturday respite visit for a family caregiver",
    area: "Nassau & Paradise Island",
    when: "Saturday · 1:00 PM",
    hours: 5,
    budget: 260,
    quotes: 3,
    description:
      "Planned afternoon support so a family caregiver can attend an event while the usual home routine continues.",
    needs: [
      "Companionship",
      "Routine continuity",
      "Meal support",
      "Caregiver handover",
    ],
  },
  {
    slug: "physiotherapy-home-visit",
    service: "Physiotherapy",
    title: "At-home mobility and strength session",
    area: "Nassau & Paradise Island",
    when: "Next week · Flexible",
    hours: 1,
    budget: 120,
    quotes: 1,
    description:
      "A home physiotherapy visit focused on safe movement, balance confidence, and a simple exercise plan.",
    needs: [
      "Mobility assessment",
      "Balance",
      "Home exercises",
      "Progress plan",
    ],
  },
];
