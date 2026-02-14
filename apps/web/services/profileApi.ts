import type { ProfileSummary } from '../../../src/lib/db';
import type {
  LivedExperience,
  ProductService,
  PlaceKnown,
  InterestHobby,
  CurrentlyDealingWith
} from '../../../src/server/types/index';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ConversationCategory = 'free' | 'paid' | 'charity';

export interface ScheduledRateEntry {
  durationMinutes: number;
  price: number;
}

export type { LivedExperience, ProductService, PlaceKnown, InterestHobby, CurrentlyDealingWith };

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  conversationType: ConversationCategory;
  instantRatePerMinute: number | null;
  minPricePer15Min: number | null;
  scheduledRates: ScheduledRateEntry[];
  donationPreference: 'on' | 'off' | null;
  charityId: string | null;
  charityName: string | null;
  isOnline: boolean;
  hasActiveSession: boolean;
  managed: boolean;
  managerId: string | null;
  managerDisplayName: string | null;
  displayMode: 'normal' | 'by_request' | 'confidential' | null;
  confidentialRate: boolean | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  quoraUrl: string | null;
  mediumUrl: string | null;
  youtubeUrl: string | null;
  otherSocialUrl: string | null;
  interests: string[];
  skills: string[];
  experiences: string | null;
  locationBorn: string | null;
  citiesLivedIn: string[];
  dateOfBirth: string | null;
  acceptInboundRequests: boolean;
  // New structured fields
  currentRoleTitle: string | null;
  currentFocus: string | null;
  livedExperiences: LivedExperience[];
  productsServices: ProductService[];
  placesKnown: PlaceKnown[];
  interestsHobbies: InterestHobby[];
  currentlyDealingWith: CurrentlyDealingWith[];
  languages: string[];
  education: string | null;
  preferredConnectionTypes: string[];
  topicsToAvoid: string[];
  updatedAt: string;
}

interface UserProfileApiResponse {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  conversation_type: ConversationCategory;
  instant_rate_per_minute: number | null;
  min_price_per_15_min: number | null;
  scheduled_rates: Record<string, number> | null;
  donation_preference: 'on' | 'off' | null;
  charity_id: string | null;
  charity_name: string | null;
  is_online: boolean;
  has_active_session: boolean;
  managed: boolean;
  manager_id: string | null;
  manager_display_name?: string | null;
  display_mode?: 'normal' | 'by_request' | 'confidential' | null;
  confidential_rate: boolean | null;
  presence_state?: 'active' | 'idle' | 'offline' | null;
  last_seen_at?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  quora_url?: string | null;
  medium_url?: string | null;
  youtube_url?: string | null;
  other_social_url?: string | null;
  interests?: string[] | null;
  skills?: string[] | null;
  experiences?: string | null;
  location_born?: string | null;
  cities_lived_in?: string[] | null;
  date_of_birth?: string | null;
  accept_inbound_requests?: boolean;
  // New structured fields
  current_role_title?: string | null;
  current_focus?: string | null;
  lived_experiences?: LivedExperience[] | null;
  products_services?: ProductService[] | null;
  places_known?: PlaceKnown[] | null;
  interests_hobbies?: InterestHobby[] | null;
  currently_dealing_with?: CurrentlyDealingWith[] | null;
  languages?: string[] | null;
  education?: string | null;
  preferred_connection_types?: string[] | null;
  topics_to_avoid?: string[] | null;
  updated_at: string;
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Request failed');
  }
  return response.json();
};

const withCredentials = (init: RequestInit = {}): RequestInit => ({
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    ...(init.headers ?? {})
  },
  ...init
});

const unwrap = <T>(payload: unknown, key?: string): T => {
  if (payload && typeof payload === 'object') {
    const bag = payload as Record<string, unknown> & { data?: Record<string, unknown> };
    if (key) {
      if (bag[key] !== undefined) return bag[key] as T;
      if (bag.data && bag.data[key] !== undefined) return bag.data[key] as T;
    }
    if (bag.data !== undefined) {
      return bag.data as T;
    }
  }
  return payload as T;
};

const toScheduledRateArray = (rates: Record<string, number> | null): ScheduledRateEntry[] => {
  if (!rates) return [];
  return Object.entries(rates)
    .map(([duration, price]) => ({ durationMinutes: Number(duration), price }))
    .filter((entry) => Number.isFinite(entry.durationMinutes) && Number.isFinite(entry.price))
    .sort((a, b) => a.durationMinutes - b.durationMinutes);
};

const toScheduledRateRecord = (rates?: ScheduledRateEntry[] | null): Record<string, number> | undefined => {
  if (!rates) return undefined;
  const record: Record<string, number> = {};
  for (const rate of rates) {
    if (!Number.isFinite(rate.durationMinutes) || !Number.isFinite(rate.price)) {
      continue;
    }
    if (rate.durationMinutes <= 0 || rate.price <= 0) {
      continue;
    }
    record[String(Math.round(rate.durationMinutes))] = Math.round(rate.price * 100) / 100;
  }
  return Object.keys(record).length > 0 ? record : undefined;
};

const mapApiProfile = (record: UserProfileApiResponse): UserProfile => ({
  id: record.id,
  name: record.name,
  email: record.email,
  avatarUrl: record.avatar_url,
  headline: record.headline,
  bio: record.bio,
  conversationType: record.conversation_type,
  minPricePer15Min: record.min_price_per_15_min ?? null,
  instantRatePerMinute: record.instant_rate_per_minute,
  scheduledRates: toScheduledRateArray(record.scheduled_rates),
  donationPreference: record.donation_preference ?? null,
  charityId: record.charity_id,
  charityName: record.charity_name,
  isOnline: record.is_online,
  hasActiveSession: record.has_active_session,
  managed: record.managed,
  managerId: record.manager_id,
  managerDisplayName: record.manager_display_name ?? null,
  displayMode: record.display_mode ?? null,
  confidentialRate: record.confidential_rate,
  linkedinUrl: record.linkedin_url ?? null,
  facebookUrl: record.facebook_url ?? null,
  instagramUrl: record.instagram_url ?? null,
  quoraUrl: record.quora_url ?? null,
  mediumUrl: record.medium_url ?? null,
  youtubeUrl: record.youtube_url ?? null,
  otherSocialUrl: record.other_social_url ?? null,
  interests: Array.isArray(record.interests) ? record.interests : [],
  skills: Array.isArray(record.skills) ? record.skills : [],
  experiences: record.experiences ?? null,
  locationBorn: record.location_born ?? null,
  citiesLivedIn: Array.isArray(record.cities_lived_in) ? record.cities_lived_in : [],
  dateOfBirth: record.date_of_birth ?? null,
  acceptInboundRequests: Boolean(record.accept_inbound_requests),
  // New structured fields
  currentRoleTitle: record.current_role_title ?? null,
  currentFocus: record.current_focus ?? null,
  livedExperiences: Array.isArray(record.lived_experiences) ? record.lived_experiences : [],
  productsServices: Array.isArray(record.products_services) ? record.products_services : [],
  placesKnown: Array.isArray(record.places_known) ? record.places_known : [],
  interestsHobbies: Array.isArray(record.interests_hobbies) ? record.interests_hobbies : [],
  currentlyDealingWith: Array.isArray(record.currently_dealing_with) ? record.currently_dealing_with : [],
  languages: Array.isArray(record.languages) ? record.languages : [],
  education: record.education ?? null,
  preferredConnectionTypes: Array.isArray(record.preferred_connection_types) ? record.preferred_connection_types : [],
  topicsToAvoid: Array.isArray(record.topics_to_avoid) ? record.topics_to_avoid : [],
  updatedAt: record.updated_at
});

const mapRecordToProfileSummary = (record: UserProfileApiResponse): ProfileSummary => ({
  userId: record.id,
  name: record.name ?? 'Human',
  avatarUrl: record.avatar_url ?? undefined,
  headline: record.headline ?? undefined,
  bio: record.bio ?? undefined,
  conversationType: record.conversation_type ?? 'free',
  confidentialRate: record.confidential_rate ?? undefined,
  managed: record.managed,
  managerId: record.manager_id ?? undefined,
  managerName: record.manager_display_name ?? undefined,
  displayMode: record.display_mode ?? undefined,
  instantRatePerMinute: record.instant_rate_per_minute ?? undefined,
  minPricePer15Min: record.min_price_per_15_min ?? undefined,
  scheduledRates: toScheduledRateArray(record.scheduled_rates),
  isOnline: record.is_online,
  hasActiveSession: record.has_active_session,
  presenceState: record.presence_state ?? (record.is_online ? 'active' : 'offline'),
  lastSeenAt: record.last_seen_at ? Date.parse(record.last_seen_at) : undefined,
  charityName: record.charity_name ?? undefined,
  charityId: record.charity_id ?? undefined,
  donationPreference: record.donation_preference ?? undefined
});

export interface ProfileUpdateInput {
  name?: string;
  headline?: string | null;
  bio?: string | null;
  conversationType?: ConversationCategory;
  instantRatePerMinute?: number | null;
  minPricePer15Min?: number | null;
  scheduledRates?: ScheduledRateEntry[] | null;
  isOnline?: boolean;
  hasActiveSession?: boolean;
  displayMode?: 'normal' | 'by_request' | 'confidential' | null;
  linkedinUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  quoraUrl?: string | null;
  mediumUrl?: string | null;
  youtubeUrl?: string | null;
  otherSocialUrl?: string | null;
  interests?: string[];
  skills?: string[];
  experiences?: string | null;
  locationBorn?: string | null;
  citiesLivedIn?: string[];
  dateOfBirth?: string | null;
  acceptInboundRequests?: boolean;
  // New structured fields
  currentRoleTitle?: string | null;
  currentFocus?: string | null;
  livedExperiences?: LivedExperience[];
  productsServices?: ProductService[];
  placesKnown?: PlaceKnown[];
  interestsHobbies?: InterestHobby[];
  currentlyDealingWith?: CurrentlyDealingWith[];
  languages?: string[];
  education?: string | null;
  preferredConnectionTypes?: string[];
  topicsToAvoid?: string[];
}

export const fetchUserProfile = async (id: string): Promise<UserProfile> => {
  const payload = await handleResponse(await fetch(`${API_BASE_URL}/api/users/${id}`, withCredentials()));
  const user = unwrap<UserProfileApiResponse>(payload, 'user');
  return mapApiProfile(user);
};

export const updateUserProfile = async (id: string, updates: ProfileUpdateInput): Promise<UserProfile> => {
  const payload: Record<string, unknown> = {};
  if ('name' in updates) {
    const trimmedName = updates.name?.trim();
    payload.name = trimmedName;
  }
  if ('headline' in updates) {
    payload.headline = updates.headline ?? null;
  }
  if ('bio' in updates) {
    payload.bio = updates.bio ?? null;
  }
  if ('conversationType' in updates && updates.conversationType) {
    payload.conversation_type = updates.conversationType;
  }
  if ('instantRatePerMinute' in updates) {
    payload.instant_rate_per_minute = updates.instantRatePerMinute ?? null;
  }
  if ('minPricePer15Min' in updates) {
    payload.min_price_per_15_min = updates.minPricePer15Min ?? null;
  }
  if ('scheduledRates' in updates) {
    payload.scheduled_rates = toScheduledRateRecord(updates.scheduledRates ?? null);
  }
  if ('isOnline' in updates) {
    payload.is_online = Boolean(updates.isOnline);
  }
  if ('hasActiveSession' in updates) {
    payload.has_active_session = Boolean(updates.hasActiveSession);
  }
  if ('displayMode' in updates) {
    payload.display_mode = updates.displayMode ?? null;
  }
  if ('linkedinUrl' in updates) {
    payload.linkedin_url = updates.linkedinUrl ?? null;
  }
  if ('facebookUrl' in updates) {
    payload.facebook_url = updates.facebookUrl ?? null;
  }
  if ('instagramUrl' in updates) {
    payload.instagram_url = updates.instagramUrl ?? null;
  }
  if ('quoraUrl' in updates) {
    payload.quora_url = updates.quoraUrl ?? null;
  }
  if ('mediumUrl' in updates) {
    payload.medium_url = updates.mediumUrl ?? null;
  }
  if ('youtubeUrl' in updates) {
    payload.youtube_url = updates.youtubeUrl ?? null;
  }
  if ('otherSocialUrl' in updates) {
    payload.other_social_url = updates.otherSocialUrl ?? null;
  }
  if ('interests' in updates) {
    payload.interests = updates.interests ?? [];
  }
  if ('skills' in updates) {
    payload.skills = updates.skills ?? [];
  }
  if ('experiences' in updates) {
    payload.experiences = updates.experiences ?? null;
  }
  if ('locationBorn' in updates) {
    payload.location_born = updates.locationBorn ?? null;
  }
  if ('citiesLivedIn' in updates) {
    payload.cities_lived_in = updates.citiesLivedIn ?? [];
  }
  if ('dateOfBirth' in updates) {
    payload.date_of_birth = updates.dateOfBirth ?? null;
  }
  if ('acceptInboundRequests' in updates) {
    payload.accept_inbound_requests = Boolean(updates.acceptInboundRequests);
  }
  // New structured fields
  if ('currentRoleTitle' in updates) {
    payload.current_role_title = updates.currentRoleTitle ?? null;
  }
  if ('currentFocus' in updates) {
    payload.current_focus = updates.currentFocus ?? null;
  }
  if ('livedExperiences' in updates) {
    payload.lived_experiences = updates.livedExperiences ?? [];
  }
  if ('productsServices' in updates) {
    payload.products_services = updates.productsServices ?? [];
  }
  if ('placesKnown' in updates) {
    payload.places_known = updates.placesKnown ?? [];
  }
  if ('interestsHobbies' in updates) {
    payload.interests_hobbies = updates.interestsHobbies ?? [];
  }
  if ('currentlyDealingWith' in updates) {
    payload.currently_dealing_with = updates.currentlyDealingWith ?? [];
  }
  if ('languages' in updates) {
    payload.languages = updates.languages ?? [];
  }
  if ('education' in updates) {
    payload.education = updates.education ?? null;
  }
  if ('preferredConnectionTypes' in updates) {
    payload.preferred_connection_types = updates.preferredConnectionTypes ?? [];
  }
  if ('topicsToAvoid' in updates) {
    payload.topics_to_avoid = updates.topicsToAvoid ?? [];
  }

  const response = await handleResponse(
    await fetch(`${API_BASE_URL}/api/users/${id}`, {
      ...withCredentials({ method: 'PATCH' }),
      body: JSON.stringify(payload)
    })
  );
  const user = unwrap<UserProfileApiResponse>(response, 'user');
  return mapApiProfile(user);
};

export const searchProfiles = async (
  query: string,
  options?: { onlineOnly?: boolean }
): Promise<ProfileSummary[]> => {
  const searchParams = new URLSearchParams();
  const trimmedQuery = query?.trim();
  if (trimmedQuery) {
    searchParams.set('q', trimmedQuery);
  }
  if (options?.onlineOnly) {
    searchParams.set('online', 'true');
  }
  const queryString = searchParams.toString();
  const url = queryString ? `${API_BASE_URL}/api/users/search?${queryString}` : `${API_BASE_URL}/api/users/search`;
  const payload = await handleResponse(await fetch(url, withCredentials()));
  const users = unwrap<UserProfileApiResponse[]>(payload, 'users');
  const records = Array.isArray(users) ? users : [];
  return records.map(mapRecordToProfileSummary);
};
