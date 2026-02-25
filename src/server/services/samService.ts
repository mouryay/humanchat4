import { z } from 'zod';

import { addConversationMessage, ensureSamConversation, getSamActivityForUser } from './conversationService.js';
import { sendToSam } from './samAPI.js';
import { SamResponse, SamChatResult, SamAction, ProfileUpdateFields } from '../types/index.js';
import { searchUsers, updateUserProfile } from './userService.js';
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
  'headline', 'bio', 'interests', 'skills', 'experiences',
  'location_born', 'cities_lived_in', 'date_of_birth',
  'accept_inbound_requests'
]);

const processProfileUpdates = async (userId: string, actions: SamAction[]): Promise<void> => {
  for (const action of actions) {
    if (action.type !== 'update_profile') continue;
    const fields = (action as Extract<SamAction, { type: 'update_profile' }>).fields;
    if (!fields || typeof fields !== 'object') continue;

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (!ALLOWED_PROFILE_FIELDS.has(key)) continue;
      if (value === undefined || value === null) continue;
      sanitized[key] = value;
    }

    if (Object.keys(sanitized).length === 0) continue;

    try {
      await updateUserProfile(userId, sanitized as Partial<ProfileUpdateFields>);
      logger.info('Sam updated user profile via onboarding', {
        userId,
        fields: Object.keys(sanitized)
      });
    } catch (error) {
      logger.warn('Failed to apply Sam profile update', { userId, error, fields: Object.keys(sanitized) });
    }
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

  const samActivity = await getSamActivityForUser(userId);

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
      sessionContext: {
        isReturningAfterLongIdle: samActivity.isReturningAfterLongIdle,
        hoursIdle: samActivity.hoursIdle,
        lastActivityAt: samActivity.lastActivityAt?.toISOString() ?? null
      }
    };

    // Check if the user has completed onboarding (has interests or bio beyond default)
    // If the intro was heard but this is among the first few messages, treat as onboarding
    const messageCount = parsed.conversationHistory.length;
    if (messageCount <= 20) {
      // Still early in the conversation - Sam might still be onboarding
      enrichedContext.isFirstTimeUser = true;
    }
    
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
      await processProfileUpdates(userId, response.actions);
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
