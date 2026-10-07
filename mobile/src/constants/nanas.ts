export const colors = {
  ink: '#123F40', teal: '#116966', tealDark: '#0B514F', aqua: '#DDF2EF',
  aquaStrong: '#9DD8D2', ivory: '#F8F6F0', white: '#FFFFFF', muted: '#667675',
  border: '#DCE6E2', warning: '#B66C13', danger: '#B83A3A', success: '#197A58', shadow: '#092E2B',
} as const;

export type AppRole = 'buyer' | 'seller';
export type SectionDefinition = { id: string; label: string; eyebrow: string; title: string; description: string };

export const buyerSections: SectionDefinition[] = [
  { id: 'overview', label: 'Overview', eyebrow: 'MY NANAS', title: 'Care, all in one place.', description: 'Your requests, bookings, messages and care updates.' },
  { id: 'find-care', label: 'Find care', eyebrow: 'TRUSTED PROVIDERS', title: 'Find care close to home.', description: 'Browse approved care and household-service providers across The Bahamas.' },
  { id: 'care-requests', label: 'Care requests', eyebrow: 'MY REQUESTS', title: 'Care, your way.', description: 'Post, track and manage your care requests.' },
  { id: 'quotes', label: 'Quotes', eyebrow: 'PROVIDER QUOTES', title: 'Compare trusted options.', description: 'Review provider rates, availability and messages.' },
  { id: 'bookings', label: 'Bookings', eyebrow: 'MY BOOKINGS', title: 'Every visit in one place.', description: 'Track upcoming, recurring and completed care.' },
  { id: 'messages', label: 'Messages', eyebrow: 'SECURE MESSAGING', title: 'Keep care conversations together.', description: 'Messages follow the same marketplace access rules as the web app.' },
  { id: 'wallet', label: 'Payments & wallet', eyebrow: 'PAYMENTS', title: 'Clear, recorded payments.', description: 'Review simulated payments, refunds and wallet activity.' },
  { id: 'reviews', label: 'Reviews', eyebrow: 'REVIEWS', title: 'Share your care experience.', description: 'Reviews are available only for eligible completed bookings.' },
  { id: 'favorites', label: 'Favorites', eyebrow: 'MY NANAS', title: 'Care relationships worth returning to.', description: 'Your private list of saved providers.' },
  { id: 'household', label: 'Care recipients', eyebrow: 'HOUSEHOLD', title: 'The people and pets you care for.', description: 'Manage care recipients and emergency contacts.' },
  { id: 'notifications', label: 'Notifications', eyebrow: 'UPDATES', title: 'Know what needs attention.', description: 'Quotes, bookings, messages, visits and payment updates.' },
  { id: 'safety', label: 'Safety & support', eyebrow: 'SAFETY', title: 'Support when it matters.', description: 'Open and track safety or service support cases.' },
  { id: 'account', label: 'Account & privacy', eyebrow: 'ACCOUNT', title: 'Your account, your control.', description: 'Manage your identity, privacy and sign-in.' },
];

export const providerSections: SectionDefinition[] = [
  { id: 'overview', label: 'Overview', eyebrow: 'PROVIDER DASHBOARD', title: 'Let’s make a difference today.', description: 'Care for people, support families and manage your work.' },
  { id: 'requests', label: 'Care requests', eyebrow: 'REQUEST MARKETPLACE', title: 'Care requests that match you.', description: 'Review eligible requests before deciding whether to quote.' },
  { id: 'quotes', label: 'My quotes', eyebrow: 'MY QUOTES', title: 'Follow every offer.', description: 'Track pending, accepted and declined quotes.' },
  { id: 'bookings', label: 'Bookings', eyebrow: 'MY BOOKINGS', title: 'Your visits, clearly scheduled.', description: 'Manage upcoming, active and completed services.' },
  { id: 'messages', label: 'Messages', eyebrow: 'SECURE MESSAGING', title: 'Keep clients informed.', description: 'Use Nanas messaging for booking and care communication.' },
  { id: 'availability', label: 'Availability', eyebrow: 'SCHEDULE', title: 'Choose when you provide care.', description: 'Keep your weekly availability accurate.' },
  { id: 'services', label: 'Services & rates', eyebrow: 'SERVICES', title: 'Offer care with clear pricing.', description: 'Manage approved services, experience and rates.' },
  { id: 'earnings', label: 'Earnings', eyebrow: 'EARNINGS & WALLET', title: 'Track what you earn.', description: 'Review available balances, pending amounts and payouts.' },
  { id: 'profile', label: 'Profile & coverage', eyebrow: 'PROFILE STUDIO', title: 'Build the profile clients trust.', description: 'Manage public details, service areas and profile visibility.' },
  { id: 'kyc', label: 'Verification', eyebrow: 'VERIFICATION', title: 'Keep credentials current.', description: 'Track identity documents and service credentials.' },
  { id: 'badges', label: 'Badges & reviews', eyebrow: 'TRUST', title: 'Show the care you provide.', description: 'View earned badges, ratings and verified reviews.' },
  { id: 'notifications', label: 'Notifications', eyebrow: 'UPDATES', title: 'Stay ready for what’s next.', description: 'Request, quote, booking and payout updates.' },
  { id: 'safety', label: 'Safety & support', eyebrow: 'SAFETY', title: 'Help is close by.', description: 'Open and track support or safety cases.' },
  { id: 'account', label: 'Account & privacy', eyebrow: 'ACCOUNT', title: 'Your provider account.', description: 'Manage identity, privacy and sign-in.' },
];

export const mainTabs: Record<AppRole, string[]> = {
  buyer: ['find-care', 'care-requests', 'bookings', 'messages', 'favorites'],
  seller: ['requests', 'quotes', 'bookings', 'messages', 'services'],
};

export const sectionsFor = (role: AppRole) => role === 'buyer' ? buyerSections : providerSections;
export const sectionFor = (role: AppRole, id: string) => sectionsFor(role).find((item) => item.id === id);
