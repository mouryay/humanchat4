import { z } from 'zod';

import { addConversationMessage, ensureSamConversation, getSamActivityForUser } from './conversationService.js';
import { sendToSam } from './samAPI.js';
import { SamResponse, SamChatResult, SamAction, ProfileUpdateFields, SamOnboardingMeta, User } from '../types/index.js';
import { getUserById, searchUsers, updateUserProfile } from './userService.js';
import { logRequestedPersonInterest, logSkillRequest } from './requestedPeopleService.js';
import { ApiError } from '../errors/ApiError.js';
import { logger } from '../utils/logger.js';
import { validate as uuidValidate } from 'uuid';
import { SamProfileSummary } from '../types/index.js';

const SamPayloadSchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'sam']),
      content: z.string(),
      timestamp: z.string().optional()
    })
  ),
  userContext: z
    .object({
      sidebarState: z.record(z.string(), z.any()).optional(),
      timezone: z.string().optional(),
      availableProfiles: z
        .array(
          z.object({
            name: z.string(),
            headline: z.string(),
            expertise: z.array(z.string()),
            rate_per_minute: z.number(),
            status: z.enum(['available', 'away', 'booked'])
          })
        )
        .optional()
    })
    .catchall(z.any())
    .optional()
});

export type SamPayload = z.infer<typeof SamPayloadSchema>;

const REQUEST_REGEX = /(?:talk|speak|chat|connect|book)\s+(?:to|with)\s+([A-Za-z][A-Za-z\s.'-]{2,})/i;
const NAME_SEARCH_PATTERNS: RegExp[] = [
  /(?:find|search(?:\s+for)?|look(?:ing)?\s+for|show(?:\s+me)?|do\s+you\s+have)\s+([A-Za-z][A-Za-z\s.'-]{1,})/i,
  /(?:people|person|member|members)\s+(?:named|called)\s+([A-Za-z][A-Za-z\s.'-]{1,})/i
];
const SAM_CONCIERGE_ID = 'sam-concierge';
const SAM_INTRO_MESSAGE =
  "Hello. I am Sam, the AI receptionist at HumanChat. I can chat with you about anything, or help you connect with real humans for live conversations. We are in early testing, so our network is small but growing. What brings you here today?";

const normalizeSamActions = (
  actions: unknown
): Parameters<typeof addConversationMessage>[4] => {
  if (!actions) {
    return undefined;
  }

  let candidate = actions;
  if (typeof actions === 'string') {
    try {
      candidate = JSON.parse(actions);
    } catch (error) {
      logger.warn('Failed to parse stringified Sam actions; dropping payload', {
        error,
        sample: actions.slice(0, 200)
      });
      return undefined;
    }
  }

  if (!Array.isArray(candidate)) {
    logger.warn('Sam actions payload was not an array; dropping payload', {
      typeof: typeof candidate
    });
    return undefined;
  }

  const cleaned = candidate.filter((entry) => entry && typeof entry === 'object');
  return cleaned.length > 0 ? (cleaned as Parameters<typeof addConversationMessage>[4]) : undefined;
};

const shouldBootstrapSamConversation = (conversationId: string): boolean => {
  if (!conversationId) {
    return true;
  }
  if (conversationId === SAM_CONCIERGE_ID) {
    return true;
  }
  return !uuidValidate(conversationId);
};

const extractRequestedName = (message: string): string | null => {
  const match = message.match(REQUEST_REGEX);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
};

const extractNameSearchQuery = (message: string): string | null => {
  const trimmed = message.trim();
  if (!trimmed) return null;

  for (const pattern of NAME_SEARCH_PATTERNS) {
    const match = trimmed.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && candidate.length >= 2) {
      return candidate;
    }
  }
  return null;
};

const profileNameMatchesQuery = (profileName: string, query: string): boolean => {
  const normalizedName = profileName.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedName || !normalizedQuery) return false;
  if (normalizedName.includes(normalizedQuery)) return true;

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return false;
  return queryTokens.every((token) => normalizedName.includes(token));
};

const maybeHandleProfileNameSearch = (
  message: string,
  availableProfiles?: SamProfileSummary[]
): SamResponse | null => {
  const query = extractNameSearchQuery(message);
  if (!query || !availableProfiles || availableProfiles.length === 0) {
    return null;
  }

  const matches = availableProfiles.filter((profile) => profileNameMatchesQuery(profile.name, query));
  if (matches.length > 0) {
    return {
      text:
        matches.length === 1
          ? `Found 1 match for "${query}" on HumanChat.`
          : `Found ${matches.length} matches for "${query}" on HumanChat.`,
      actions: [
        {
          type: 'show_profiles',
          profiles: matches
        }
      ]
    };
  }

  return {
    text: `I couldn't find anyone named "${query}" yet. Here are the people currently on HumanChat.`,
    actions: [
      {
        type: 'show_profiles',
        profiles: availableProfiles
      }
    ]
  };
};

const maybeHandleRequestedPerson = async (userId: string, message: string): Promise<SamResponse | null> => {
  const candidate = extractRequestedName(message);
  if (!candidate || candidate.length < 3) {
    return null;
  }

  const existing = await searchUsers(candidate, undefined);
  if (existing.length > 0) {
    return null;
  }

  // Log the interest for tracking, but let Sam handle the response
  // Sam has better context (availableProfiles) to provide a helpful answer
  await logRequestedPersonInterest({ requestedName: candidate, searchQuery: message, userId }).catch((error) => {
    console.warn('Failed to log requested person request', error);
  });

  // Return null so Sam processes the request with full context
  return null;
};

// Detect skill-based requests (e.g., "someone who knows X", "person with Y skills", "expert in Z")
const extractSkillRequest = (message: string): string | null => {
  const skillPatterns = [
    /(?:someone|person|expert|professional|someone who|a person who|an expert who|a professional who)\s+(?:who\s+)?(?:knows|has|with|in|specializes?|is\s+good\s+at|can\s+help\s+with|understands?)\s+([^.?!]+)/i,
    /(?:looking\s+for|need|want|find|connect\s+with)\s+(?:someone|a person|an expert|a professional)\s+(?:who\s+)?(?:knows|has|with|in|specializes?|is\s+good\s+at|can\s+help\s+with|understands?)\s+([^.?!]+)/i,
    /(?:someone|person|expert|professional)\s+(?:with|in|specialized\s+in|who\s+does)\s+([^.?!]+)/i
  ];

  for (const pattern of skillPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const skills = match[1].trim();
      // Only return if it's substantial (at least 3 characters) and not just a name
      if (skills.length >= 3 && !/^[A-Z][a-z]+\s+[A-Z]/.test(skills)) {
        return skills;
      }
    }
  }

  return null;
};

const ALLOWED_PROFILE_FIELDS = new Set([
  'headline',
  'bio',
  'interests',
  'skills',
  'experiences',
  'location_born',
  'cities_lived_in',
  'date_of_birth',
  'accept_inbound_requests',
  'current_role_title',
  'current_focus',
  'lived_experiences',
  'products_services',
  'places_known',
  'interests_hobbies',
  'currently_dealing_with',
  'languages',
  'education',
  'preferred_connection_types',
  'topics_to_avoid'
]);

const parseOnboardingMeta = (value: unknown): SamOnboardingMeta => {
  if (!value || typeof value !== 'object') return {};
  return value as SamOnboardingMeta;
};

const ONBOARDING_TOPIC_FIELDS: Array<{ topic: string; fields: string[] }> = [
  { topic: 'inbound_requests', fields: ['accept_inbound_requests'] },
  { topic: 'bio', fields: ['bio', 'headline'] },
  { topic: 'role_focus', fields: ['current_role_title', 'current_focus'] },
  { topic: 'experiences', fields: ['lived_experiences', 'experiences'] },
  { topic: 'interests', fields: ['interests', 'interests_hobbies', 'skills'] },
  { topic: 'background', fields: ['location_born', 'cities_lived_in', 'languages', 'education'] },
  { topic: 'preferences', fields: ['preferred_connection_types', 'topics_to_avoid'] }
];

const hasMeaningfulText = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== 'human';
};

const hasAnyEntries = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const buildProfileProgress = (user: User) => {
  return {
    hasInboundPreference: typeof user.accept_inbound_requests === 'boolean',
    hasBio: hasMeaningfulText(user.bio) || hasMeaningfulText(user.headline),
    hasRoleFocus: hasMeaningfulText(user.current_role_title) || hasMeaningfulText(user.current_focus),
    hasExperiences: hasAnyEntries(user.lived_experiences) || hasMeaningfulText(user.experiences),
    hasInterests: hasAnyEntries(user.interests_hobbies) || hasAnyEntries(user.interests) || hasAnyEntries(user.skills),
    hasBackground:
      hasMeaningfulText(user.location_born) ||
      hasAnyEntries(user.cities_lived_in) ||
      hasAnyEntries(user.languages) ||
      hasMeaningfulText(user.education)
  };
};

const inferDeclinedTopic = (message: string, lastSamMessage?: string): string | null => {
  const declined = /\b(no|not now|skip|don't|do not|rather not|not interested|later)\b/i.test(message);
  if (!declined) return null;
  const source = (lastSamMessage ?? '').toLowerCase();
  if (source.includes('inbound') || source.includes('discoverable') || source.includes('receive inbound')) {
    return 'inbound_requests';
  }
  if (source.includes('tell me about yourself') || source.includes('bio') || source.includes('headline')) {
    return 'bio';
  }
  if (source.includes('role') || source.includes('focus')) {
    return 'role_focus';
  }
  if (source.includes('experience')) {
    return 'experiences';
  }
  if (source.includes('interest') || source.includes('hobbies') || source.includes('skills')) {
    return 'interests';
  }
  return null;
};

const mergeOnboardingMeta = (
  existing: SamOnboardingMeta,
  appliedFields: string[],
  updates: Record<string, unknown>,
  message: string,
  lastSamMessage?: string
): SamOnboardingMeta => {
  const next: SamOnboardingMeta = {
    inboundPrompted: Boolean(existing.inboundPrompted),
    inboundDeclined: Boolean(existing.inboundDeclined),
    declinedTopics: [...(existing.declinedTopics ?? [])],
    completedTopics: [...(existing.completedTopics ?? [])],
    lastUpdatedAt: new Date().toISOString()
  };

  const completed = new Set(next.completedTopics);
  for (const mapping of ONBOARDING_TOPIC_FIELDS) {
    if (mapping.fields.some((field) => appliedFields.includes(field))) {
      completed.add(mapping.topic);
    }
  }
  next.completedTopics = Array.from(completed);

  if (appliedFields.includes('accept_inbound_requests')) {
    next.inboundPrompted = true;
    if (updates.accept_inbound_requests === false) {
      next.inboundDeclined = true;
    } else if (updates.accept_inbound_requests === true) {
      next.inboundDeclined = false;
    }
  }

  const declinedTopic = inferDeclinedTopic(message, lastSamMessage);
  if (declinedTopic) {
    const declined = new Set(next.declinedTopics);
    declined.add(declinedTopic);
    next.declinedTopics = Array.from(declined);
    if (declinedTopic === 'inbound_requests') {
      next.inboundPrompted = true;
      next.inboundDeclined = true;
    }
  }

  return next;
};

const processProfileUpdates = async (
  userId: string,
  actions: SamAction[],
  user: User,
  message: string,
  lastSamMessage?: string
): Promise<void> => {
  const merged: Record<string, unknown> = {};
  const appliedFields: string[] = [];

  for (const action of actions) {
    if (action.type !== 'update_profile') continue;
    const fields = (action as Extract<SamAction, { type: 'update_profile' }>).fields;
    if (!fields || typeof fields !== 'object') continue;

    for (const [key, value] of Object.entries(fields)) {
      if (!ALLOWED_PROFILE_FIELDS.has(key)) continue;
      if (value === undefined || value === null) continue;
      merged[key] = value;
      appliedFields.push(key);
    }
  }

  const existingMeta = parseOnboardingMeta(user.sam_onboarding_meta);
  const nextMeta = mergeOnboardingMeta(existingMeta, appliedFields, merged, message, lastSamMessage);
  merged.sam_onboarding_meta = nextMeta;

  if (Object.keys(merged).length === 1 && merged.sam_onboarding_meta) {
    try {
      await updateUserProfile(userId, merged as Partial<ProfileUpdateFields>);
    } catch (error) {
      logger.warn('Failed to persist Sam onboarding memory', { userId, error });
    }
    return;
  }

  try {
    await updateUserProfile(userId, merged as Partial<ProfileUpdateFields>);
    logger.info('Sam updated user profile via onboarding', {
      userId,
      fields: Object.keys(merged)
    });
  } catch (error) {
    logger.warn('Failed to apply Sam profile update', { userId, error, fields: Object.keys(merged) });
  }
};

const maybeHandleSkillRequest = async (userId: string, message: string): Promise<void> => {
  const skillsDescription = extractSkillRequest(message);
  if (!skillsDescription) {
    return;
  }

  // Check if there are users with similar skills already (basic check)
  // If found, don't log as a skill request since we have matches
  const existing = await searchUsers(skillsDescription, undefined);
  if (existing.length > 0) {
    return;
  }

  // Log the skill request for tracking
  await logSkillRequest({
    skillsDescription,
    searchQuery: message,
    userId
  }).catch((error) => {
    logger.warn('Failed to log skill request', { error, skillsDescription });
  });
};

export const handleSamChat = async (conversationId: string, userId: string, payload: SamPayload): Promise<SamChatResult> => {
  const parsed = SamPayloadSchema.parse(payload);

  let activeConversationId = conversationId;
  if (shouldBootstrapSamConversation(activeConversationId)) {
    const conversation = await ensureSamConversation(userId);
    activeConversationId = conversation.id;
  }

  const persistMessage = async (
    senderId: string,
    content: string,
    type: Parameters<typeof addConversationMessage>[3],
    actions?: Parameters<typeof addConversationMessage>[4]
  ) => {
    const normalizedSenderId = uuidValidate(senderId) ? senderId : null;
    try {
      await addConversationMessage(activeConversationId, normalizedSenderId, content, type, actions);
    } catch (error) {
      const isExpectedMissingConversation =
        error instanceof ApiError && (error.code === 'NOT_FOUND' || error.code === 'INVALID_REQUEST');
      if (isExpectedMissingConversation) {
        const conversation = await ensureSamConversation(userId);
        activeConversationId = conversation.id;
        await addConversationMessage(activeConversationId, normalizedSenderId, content, type, actions);
        logger.info('Recreated missing Sam conversation for user', {
          userId,
          conversationId: activeConversationId
        });
      } else {
        throw error;
      }
    }
  };

  await persistMessage(userId, parsed.message, 'user_text');

  const [samActivity, currentUser] = await Promise.all([getSamActivityForUser(userId), getUserById(userId)]);
  const onboardingMeta = parseOnboardingMeta(currentUser.sam_onboarding_meta);
  const profileProgress = buildProfileProgress(currentUser);
  const lastSamMessage = [...parsed.conversationHistory].reverse().find((entry) => entry.role === 'sam')?.content;

  const intercepted = await maybeHandleRequestedPerson(userId, parsed.message);
  const nameSearchIntercepted = maybeHandleProfileNameSearch(parsed.message, parsed.userContext?.availableProfiles);
  
  // Also check for skill-based requests and log them
  // This runs regardless of whether a specific person was requested
  await maybeHandleSkillRequest(userId, parsed.message);
  
  logger.info('Sam receptionist dispatching Gemini request', {
    conversationId: activeConversationId,
    userId,
    historyCount: parsed.conversationHistory.length,
    hasContext: Boolean(parsed.userContext),
    isFirstTime: !samActivity.hasHeardIntro,
    isReturningAfterIdle: samActivity.isReturningAfterLongIdle,
    hoursIdle: samActivity.hoursIdle
  });

  const isFirstTimeUser = !samActivity.hasHeardIntro;

  let response: SamResponse;
  if (isFirstTimeUser) {
    // First-time user - give a clear intro, then Gemini handles onboarding
    response = {
      text: SAM_INTRO_MESSAGE,
      actions: [
        {
          type: 'follow_up_prompt',
          prompt: 'Tell me what you need and I will route it.'
        }
      ]
    };
  } else {
    // Returning or continuing user - pass activity and first-time context to Sam
    const enrichedContext = {
      ...parsed.userContext,
      isFirstTimeUser: false,
      profileProgress,
      onboardingMemory: onboardingMeta,
      sessionContext: {
        isReturningAfterLongIdle: samActivity.isReturningAfterLongIdle,
        hoursIdle: samActivity.hoursIdle,
        lastActivityAt: samActivity.lastActivityAt?.toISOString() ?? null
      }
    };
    
    response =
      intercepted ??
      nameSearchIntercepted ??
      (await sendToSam({
        userMessage: parsed.message,
        conversationHistory: parsed.conversationHistory,
        userContext: enrichedContext
      }));

    // Process any update_profile actions from Sam's response
    if (response.actions && Array.isArray(response.actions)) {
      await processProfileUpdates(userId, response.actions, currentUser, parsed.message, lastSamMessage);
    }
  }

  logger.info('Sam receptionist response received', {
    conversationId: activeConversationId,
    userId,
    actionCount: Array.isArray(response.actions) ? response.actions.length : 0,
    textPreview: response.text?.slice(0, 120) ?? null
  });

  const normalizedActions = normalizeSamActions(response.actions);
  await persistMessage('sam', response.text, 'sam_response', normalizedActions);

  return {
    ...response,
    conversationId: activeConversationId
  };
};
