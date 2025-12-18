/**
 * Booking Notification Service
 * Handles sending booking confirmations to chat conversations
 */

import { ensureHumanConversation, addConversationMessage } from './conversationService.js';

/**
 * Send booking confirmation message to chat
 * Creates conversation if it doesn't exist between user and expert
 */
export const sendBookingConfirmationToChat = async (
  bookingId: string,
  expertId: string,
  userId: string,
  userName: string,
  expertName: string,
  startTime: Date,
  durationMinutes: number
): Promise<void> => {
  try {
    console.log(`[Booking Notification] Starting for booking ${bookingId}, expert: ${expertId}, user: ${userId}`);

    const conversation = await ensureHumanConversation(userId, expertId);
    const conversationId = conversation.id;
    console.log(`[Booking Notification] Using conversation ${conversationId}`);

    // Format booking details
    const start = startTime instanceof Date ? startTime : new Date(startTime);
    const formattedDate = start.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Create booking confirmation message for the client
    const clientMessage = `✅ **Booking Confirmed**\n\n` +
      `**Session Details:**\n` +
      `📅 Date: ${formattedDate}\n` +
      `🕐 Time: ${formattedTime}\n` +
      `⏱️ Duration: ${durationMinutes} minutes\n` +
      `👤 Expert: ${expertName}\n\n` +
      `Your session has been confirmed. You'll receive reminders before the call.`;

    // Create notification message for the expert
    const expertMessage = `📅 **New Booking Request**\n\n` +
      `**Session Details:**\n` +
      `📅 Date: ${formattedDate}\n` +
      `🕐 Time: ${formattedTime}\n` +
      `⏱️ Duration: ${durationMinutes} minutes\n` +
      `👤 Client: ${userName}\n\n` +
      `A new session has been scheduled with you.`;

    const metadata = {
      bookingId,
      startTime: start.toISOString(),
      durationMinutes,
      expertName,
      userName
    };

    await addConversationMessage(conversationId, null, clientMessage, 'system_notice', [
      { type: 'booking_confirmation', role: 'client', ...metadata }
    ]);

    await addConversationMessage(conversationId, null, expertMessage, 'system_notice', [
      { type: 'booking_notification', role: 'expert', ...metadata }
    ]);

    console.log(`[Booking Notification] ✅ Successfully sent notifications to conversation ${conversationId} for booking ${bookingId}`);
  } catch (error) {
    console.error('[Booking Notification] ❌ Error sending booking confirmation to chat:', error);
    throw error;
  }
};
