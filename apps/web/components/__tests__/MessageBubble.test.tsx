/// <reference types="jest" />
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';
import type { Message } from '../../../../src/lib/db';

describe('MessageBubble', () => {
  const baseMessage: Message = {
    conversationId: 'sam-concierge',
    senderId: 'sam',
    content: 'Swipe me to quote',
    timestamp: Date.now(),
    type: 'sam_response'
  };

  it('invokes quick reply handler when swiped right', () => {
    const quickReply = jest.fn();
    render(<MessageBubble message={baseMessage} variant="sam" onQuickReply={quickReply} />);

    const bubble = screen.getByText(/swipe me/i);
    fireEvent.touchStart(bubble, { touches: [{ clientX: 0 }] });
    fireEvent.touchMove(bubble, { touches: [{ clientX: 80 }] });
    fireEvent.touchEnd(bubble);

    expect(quickReply).toHaveBeenCalledWith(expect.objectContaining({ content: baseMessage.content }));
  });
});
