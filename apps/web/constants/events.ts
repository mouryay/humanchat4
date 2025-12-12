export const AUTH_UPDATED_EVENT = 'humanchat-auth-updated';
export const INSTANT_INVITE_TARGETED_EVENT = 'humanchat-instant-invite-targeted';

export type InstantInviteTargetedDetail = {
	conversationId: string;
	inviteId: string;
};
