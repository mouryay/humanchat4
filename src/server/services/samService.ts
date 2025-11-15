import { z } from 'zod';
import { addConversationMessage } from './conversationService.js';
import { SamResponse } from '../types/index.js';

const SamPayloadSchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'sam']),
      content: z.string()
    })
  ),
  userContext: z.record(z.string(), z.any()).optional()
});

export type SamPayload = z.infer<typeof SamPayloadSchema>;

export const handleSamChat = async (conversationId: string, userId: string, payload: SamPayload): Promise<SamResponse> => {
  SamPayloadSchema.parse(payload);

  // Placeholder AI call. Real implementation would call Gemini API here.
  const response: SamResponse = {
    text: `Hi ${userId}, I can help you connect with the right expert.`,
    actions: [
      { type: 'connect', label: 'Connect Now', payload: { conversationId } },
      { type: 'schedule', label: 'Schedule Session', payload: { conversationId } }
    ]
  };

  await addConversationMessage(conversationId, 'sam', response.text, 'sam_response', response.actions as []);
  return response;
};
