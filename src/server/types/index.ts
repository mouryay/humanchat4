export type ConversationType = 'sam' | 'human';
export type ConversationCategory = 'free' | 'paid' | 'charity';
export type SessionType = 'instant' | 'scheduled';
export type SessionStatus = 'pending' | 'in_progress' | 'complete';
export type PaymentMode = 'free' | 'paid' | 'charity';
export type InstantInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export type UserRole = 'user' | 'admin' | 'manager';

// --- Profile section JSONB shapes ---

export interface LivedExperience {
  rawText: string; // What the user actually said, in their words
  // Structured metadata — extracted by Sam, never shown to user
  type?: string | null; // health | legal | financial | career | life_transition | other
  situation?: string | null;
  location?: string | null;
  timePeriod?: string | null;
  status?: 'resolved' | 'ongoing' | 'recurring' | null;
  canHelpWith?: string | null;
  visibility?: 'public' | 'match_only' | 'private';
  willingToDiscuss?: 'yes' | 'only_if_asked' | 'no';
}

export interface ProductService {
  rawText: string;
  category?: string | null;
  name?: string | null;
  duration?: string | null;
  usageContext?: string | null;
  opinion?: string | null;
  wouldRecommend?: 'yes' | 'no' | 'with_caveats' | null;
}

export interface PlaceKnown {
  rawText: string;
  type?: string | null;
  name?: string | null;
  relationship?: 'resident' | 'former_resident' | 'frequent_visitor' | 'visitor' | null;
  timePeriod?: string | null;
  insights?: string | null;
  wouldRecommend?: 'yes' | 'no' | 'with_caveats' | null;
}

export interface InterestHobby {
  rawText: string;
  name?: string | null;
  engagement?: 'casual' | 'regular' | 'serious' | null;
  skillLevel?: 'beginner' | 'intermediate' | 'expert' | null;
  lookingTo?: 'learn' | 'share' | 'collaborate' | 'just_enjoy' | null;
}

export interface CurrentlyDealingWith {
  rawText: string;
  situation?: string | null;
  timeIn?: string | null;
  lookingFor?: 'advice' | 'support' | 'just_relating' | null;
}

export interface SamOnboardingMeta {
  inboundPrompted?: boolean;
  inboundDeclined?: boolean;
  declinedTopics?: string[];
  completedTopics?: string[];
  lastUpdatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  conversation_type: ConversationCategory;
  donation_preference: string | null;
  charity_id: string | null;
  charity_name: string | null;
  instant_rate_per_minute: number | null;
  min_price_per_15_min: number | null;
  scheduled_rates: Record<string, number> | null;
  is_online: boolean;
  has_active_session: boolean;
  managed: boolean;
  manager_id: string | null;
  confidential_rate: boolean | null;
  display_mode?: 'normal' | 'by_request' | 'confidential' | null;
  manager_display_name?: string | null;
  presence_state?: 'active' | 'idle' | 'offline' | null;
  last_seen_at?: string | null;
  // Social links
  linkedin_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  quora_url?: string | null;
  medium_url?: string | null;
  youtube_url?: string | null;
  other_social_url?: string | null;
  // Basic info
  current_role_title?: string | null;
  current_focus?: string | null;
  // Legacy simple fields (kept for backward compat)
  interests?: string[] | null;
  skills?: string[] | null;
  experiences?: string | null;
  location_born?: string | null;
  cities_lived_in?: string[] | null;
  date_of_birth?: string | null;
  accept_inbound_requests?: boolean;
  // Structured profile sections (JSONB)
  lived_experiences?: LivedExperience[] | null;
  products_services?: ProductService[] | null;
  places_known?: PlaceKnown[] | null;
  interests_hobbies?: InterestHobby[] | null;
  currently_dealing_with?: CurrentlyDealingWith[] | null;
  // Background
  languages?: string[] | null;
  education?: string | null;
  // Matching preferences
  preferred_connection_types?: string[] | null;
  topics_to_avoid?: string[] | null;
  // Sam onboarding memory
  sam_onboarding_meta?: SamOnboardingMeta | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  host_user_id: string;
  guest_user_id: string;
  conversation_id: string;
  type: SessionType;
  status: SessionStatus;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  agreed_price: number;
  payment_mode: PaymentMode;
  payment_intent_id: string | null;
  donation_allowed?: boolean | null;
  donation_target?: string | null;
  donation_preference?: string | null;
  donation_amount?: number | null;
  charity_id?: string | null;
  charity_name?: string | null;
  charity_stripe_account_id?: string | null;
  confidential_rate?: boolean | null;
  representative_name?: string | null;
  display_mode?: 'normal' | 'by_request' | 'confidential' | null;
  created_at: string;
  updated_at: string;
}

export type SessionPaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed';

export interface SessionPayment {
  sessionId: string;
  paymentIntentId: string | null;
  amount: number;
  currency: string;
  status: SessionPaymentStatus;
  platformFee: number;
  hostPayout: number;
  charityId?: string | null;
  donationAmount?: number | null;
  donationIntentId?: string | null;
  donationCheckoutId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: string[];
  participant_display_map?: Record<string, string> | null;
  linked_session_id: string | null;
  last_activity: string;
  created_at: string;
}

export interface InstantInvite {
  id: string;
  conversation_id: string;
  requester_user_id: string;
  target_user_id: string;
  status: InstantInviteStatus;
  expires_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
  cancelled_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarConnection {
  user_id: string;
  provider: 'google' | 'microsoft' | 'apple';
  account_email: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  last_synced_at: string | null;
}

export interface Request {
  id: string;
  requester_user_id: string;
  target_user_id: string;
  manager_user_id?: string | null;
  representative_name?: string | null;
  message: string;
  preferred_time?: string | null;
  budget_range?: string | null;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

export type RequestedPersonStatus = 'pending' | 'contacted' | 'declined' | 'onboarded';

export interface RequestedPerson {
  name: string;
  normalized_name: string;
  request_count: number;
  status: RequestedPersonStatus;
  last_requested_at: string;
  created_at: string;
}

export interface RequestLog {
  id: string;
  user_id: string;
  requested_name: string;
  search_query: string;
  created_at: string;
}

export interface SamProfileSummary {
  name: string;
  headline: string;
  expertise: string[];
  rate_per_minute: number;
  status: 'available' | 'away' | 'booked';
}

export interface ProfileUpdateFields {
  headline?: string;
  bio?: string;
  interests?: string[];
  skills?: string[];
  experiences?: string;
  location_born?: string;
  cities_lived_in?: string[];
  date_of_birth?: string;
  accept_inbound_requests?: boolean;
  // New structured fields
  current_role_title?: string;
  current_focus?: string;
  lived_experiences?: LivedExperience[];
  products_services?: ProductService[];
  places_known?: PlaceKnown[];
  interests_hobbies?: InterestHobby[];
  currently_dealing_with?: CurrentlyDealingWith[];
  languages?: string[];
  education?: string;
  preferred_connection_types?: string[];
  topics_to_avoid?: string[];
}

export type SamAction =
  | {
      type: 'show_profiles';
      profiles: SamProfileSummary[];
    }
  | {
      type: 'offer_call';
      participant: string;
      availability_window: string;
      purpose: string;
    }
  | {
      type: 'create_session';
      host: string;
      guest: string;
      suggested_start: string;
      duration_minutes: number;
      notes: string;
    }
  | {
      type: 'follow_up_prompt';
      prompt: string;
    }
  | {
      type: 'system_notice';
      notice: string;
    }
  | {
      type: 'update_profile';
      fields: ProfileUpdateFields;
    };

export interface SamResponse {
  text: string;
  actions: SamAction[];
}

export interface SamChatResult extends SamResponse {
  conversationId: string;
}
