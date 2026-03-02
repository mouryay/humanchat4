export const AUTH_UPDATED_EVENT = 'humanchat-auth-updated';
export const INSTANT_INVITE_TARGETED_EVENT = 'humanchat-instant-invite-targeted';
export const NOTIFICATION_EVENT = 'humanchat-notification';

export type InstantInviteTargetedDetail = {
	conversationId: string;
	inviteId: string;
};

export type RealtimeNotificationDetail = {
	notification: {
		id: string;
		type: 'booking_scheduled' | 'booking_reminder_30m';
		title: string;
		body: string;
		payload: Record<string, unknown>;
		status: 'unread' | 'read';
		created_at?: string;
		createdAt?: string;
	};
};
