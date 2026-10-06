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
      "Approved individual provider",
      "Private care-request brief",
      "Clear hourly quote",
      "Booking-based review",
    ],
  },
  {
    slug: "child-care",
    name: "Child care",
    short: "Trusted help for children and families",
    description:
      "Babysitting, nanny-style support, school pickup help, after-school care, and practical family assistance.",
    rate: 22,
    accent: "teal",
    needs: [
      "Babysitting",
      "After-school support",
      "Homework routine",
      "Meal and snack help",
      "School pickup support",
      "Family updates",
    ],
    includes: [
      "Identity-reviewed provider",
      "Family-specific brief",
      "Secure care messaging",
      "Booking-based review",
    ],
  },
  {
    slug: "home-healthcare",
    name: "Home healthcare",
    short: "Health-focused support at home",
    description:
      "Nursing visits, recovery help, medication reminders, wellness check-ins, and approved health support at home.",
    rate: 38,
    accent: "sand",
    needs: [
      "Home nursing",
      "Recovery support",
      "Medication reminders",
      "Wellness check-ins",
      "Care-plan follow-up",
      "Family coordination",
    ],
    includes: [
      "Credential-aware matching",
      "Scope confirmed before booking",
      "Protected visit record",
      "Secure care messaging",
    ],
  },
  {
    slug: "housekeeping",
    name: "Housekeeping",
    short: "Reliable help around the home",
    description:
      "Cleaning, laundry, errands, organizing, light meal prep, and household routines handled by trusted providers.",
    rate: 28,
    accent: "sky",
    needs: [
      "Cleaning",
      "Laundry",
      "Errands",
      "Home organizing",
      "Light meal prep",
      "Routine household help",
    ],
    includes: [
      "Recurring booking options",
      "Household checklist",
      "Private household notes",
      "Continuity with saved providers",
    ],
  },
  {
    slug: "tutoring",
    name: "Tutoring",
    short: "Learning support at home",
    description:
      "Homework help, test prep, reading, math, science, confidence-building, and patient academic support.",
    rate: 32,
    accent: "lilac",
    needs: [
      "Homework help",
      "Math support",
      "Reading support",
      "Science tutoring",
      "Test prep",
      "Study routines",
    ],
    includes: [
      "Subject-specific matching",
      "Learning goals",
      "Progress updates",
      "Recurring session options",
    ],
  },
  {
    slug: "pet-care",
    name: "Pet care",
    short: "Trusted help for pets",
    description:
      "Pet sitting, walking, feeding visits, check-ins, and steady help when work, travel, or family life gets busy.",
    rate: 18,
    accent: "coral",
    needs: [
      "Pet sitting",
      "Dog walking",
      "Feeding visits",
      "Medication reminders",
      "Litter or crate routines",
      "Photo updates",
    ],
    includes: [
      "Pet routine brief",
      "Visit updates",
      "Recurring walk options",
      "Saved provider favorites",
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
      badges: ["Top care provider", "Credentials current"],
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
          id: "home-healthcare",
          name: "Home healthcare",
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
          id: "housekeeping",
          name: "Housekeeping",
          rate: 40,
          rateMax: 58,
          yearsExperience: 5,
          bio: "Hello, I help families keep the home calm and organized with light housekeeping, errands, laundry, meal preparation and practical routines that support care at home.",
          capabilities: [
            "Light cleaning",
            "Laundry",
            "Errands",
            "Meal preparation",
            "Home organization",
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
          id: "housekeeping",
          name: "Housekeeping",
          rate: 28,
          rateMax: 36,
          yearsExperience: 5,
          bio: "Dependable housekeeping support that respects established household routines and helps families stay organized.",
          capabilities: ["Cleaning", "Errands", "Family updates"],
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
          id: "home-healthcare",
          name: "Home healthcare",
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
          id: "tutoring",
          name: "Tutoring",
          rate: 48,
          rateMax: 65,
          yearsExperience: 5,
          bio: "Patient tutoring support that helps students build confidence, routines, and clear learning goals.",
          capabilities: [
            "Study routines",
            "Homework help",
            "Progress updates",
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
        { id: "pet-care", name: "Pet care", rate: 24 },
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
    service: "Home healthcare",
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
    service: "Housekeeping",
    title: "Saturday housekeeping help for a family caregiver",
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
    service: "Tutoring",
    title: "At-home tutoring and homework session",
    area: "Nassau & Paradise Island",
    when: "Next week · Flexible",
    hours: 1,
    budget: 120,
    quotes: 1,
    description:
      "A tutoring visit focused on homework help, confidence, and a simple study plan.",
    needs: [
      "Homework help",
      "Study plan",
      "Reading support",
      "Progress update",
    ],
  },
];
