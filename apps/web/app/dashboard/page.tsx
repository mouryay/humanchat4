'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { useConversationData } from '../../hooks/useConversationData';

// Lightweight inline icons used by dashboard tiles
const Icon = ({ name }: { name: string }) => {
  switch (name) {
    case 'sam':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="6" fill="url(#g)" />
          <path d="M8 12h8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <defs>
            <linearGradient id="g" x1="0" x2="1">
              <stop offset="0" stopColor="#3B82F6" />
              <stop offset="1" stopColor="#60A5FA" />
            </linearGradient>
          </defs>
        </svg>
      );
    case 'browse':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="11" cy="11" r="6" stroke="#A1A1AA" strokeWidth="1.2" />
          <path d="M20 20l-3-3" stroke="#A1A1AA" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'bookings':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="#60A5FA" strokeWidth="1.2" />
          <path d="M8 3v4" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="#FBBF24" strokeWidth="1.2" />
          <path d="M8 3v4" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M3 11h18" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke="#A1A1AA" strokeWidth="1.2" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09c.67 0 1.25-.42 1.51-1a1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 017.04 3.7l.06.06c.5.5 1.18.7 1.82.33.44-.25 1-.39 1.51-.39H12a1.65 1.65 0 001.51.33c.64.37 1.32.16 1.82-.33l.06-.06A2 2 0 0118.3 3.7l-.06.06a1.65 1.65 0 00-.33 1.82c.25.44.39 1 .39 1.51V9a1.65 1.65 0 00.33 1.51c.37.64.16 1.32-.33 1.82l-.06.06A2 2 0 0119.4 15z" stroke="#A1A1AA" strokeWidth="1.0" />
        </svg>
      );
    default:
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="#71717A" strokeWidth="1.2" />
        </svg>
      );
  }
};

const quickActions = [
  { label: 'Open Sam Receptionist', href: '/?focus=sam', description: 'Continue your AI-powered thread.', icon: 'sam' },
  { label: 'Browse Workspace', href: '/chat', description: 'Jump back into any human chat.', icon: 'browse' },
  { label: 'My Bookings', href: '/bookings', description: 'View and manage your scheduled calls.', icon: 'bookings' },
  { label: 'Manage Availability', href: '/expert/availability', description: 'Set your calendar and available time slots.', icon: 'calendar' },
  { label: 'Account Preferences', href: '/account', description: 'Set availability, pricing, and chat settings.', icon: 'settings' }
];

export default function DashboardPage() {
  const { conversations, unreadTotal } = useConversationData();

  const { samConversation, recentHumanConversations } = useMemo(() => {
    const samEntry = conversations.find((entry) => entry.conversation.type === 'sam');
    const humans = conversations.filter((entry) => entry.conversation.type !== 'sam').slice(0, 4);
    return { samConversation: samEntry, recentHumanConversations: humans };
  }, [conversations]);

  return (
    <main className="min-h-screen bg-background-primary text-text-primary">
      {/* Premium Header */}
      <header className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-6 backdrop-blur-xl bg-background-primary/80">
        <Link 
          href="/?focus=sam" 
          className="text-sm font-semibold uppercase tracking-[0.35em] text-text-secondary hover:text-text-primary transition-colors duration-base"
        >
          Humanchat.com
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        {/* Premium Quick Actions Grid */}
        <section className="grid gap-6 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group relative flex items-center gap-5 card-premium p-6"
            >
              {/* Icon container with premium styling */}
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 ring-1 ring-white/10 group-hover:ring-blue-500/30 transition-all duration-base">
                <Icon name={action.icon ?? 'default'} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.25em] text-text-tertiary mb-1">Quick action</p>
                <h2 className="text-lg font-semibold text-text-primary mb-1.5">{action.label}</h2>
                <p className="text-sm text-text-secondary leading-relaxed">{action.description}</p>
              </div>

              {/* Hover arrow indicator */}
              <div className="text-text-tertiary group-hover:text-accent-primary group-hover:translate-x-1 transition-all duration-base">
                →
              </div>
            </Link>
          ))}
        </section>

        {/* Premium Sam Conversation Card */}
        {samConversation && (
          <section className="card-premium p-8">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.3em] text-accent-primary mb-2 font-semibold">Sam Receptionist</p>
                <h3 className="text-2xl font-semibold text-text-primary mb-2">Pick up where you left off</h3>
                <p className="text-sm text-text-secondary" suppressHydrationWarning>
                  Last activity · {new Date(samConversation.conversation.lastActivity).toLocaleString()}
                </p>
              </div>
              <Link
                href="/?focus=sam"
                className="btn-premium btn-premium-primary ml-6"
              >
                Go to chat
              </Link>
            </div>
          </section>
        )}

        {/* Premium Recent Conversations Section */}
        <section className="card-premium p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-text-tertiary mb-1">Recent humans</p>
              <h3 className="text-2xl font-semibold text-text-primary">Continue a conversation</h3>
            </div>
            <Link 
              href="/chat" 
              className="text-sm font-semibold text-text-secondary hover:text-accent-primary underline-offset-4 hover:underline transition-colors duration-base"
            >
              View all
            </Link>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {recentHumanConversations.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-border-medium px-6 py-8 text-center">
                <p className="text-sm text-text-tertiary">
                  No human conversations yet. Start one from the workspace.
                </p>
              </div>
            )}
            {recentHumanConversations.map((entry) => (
              <Link
                key={entry.conversation.conversationId}
                href={`/chat?conversationId=${entry.conversation.conversationId}`}
                className="group flex flex-col gap-4 card-premium p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <img 
                      src={entry.meta.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.meta.displayName)}&background=3B82F6&color=fff&size=128`}
                      alt={entry.meta.displayName}
                      className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-border-subtle group-hover:ring-accent-primary/50 transition-all duration-base"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-text-primary truncate">{entry.meta.displayName}</p>
                      <p className="text-sm text-text-secondary truncate">
                        Last activity · {new Date(entry.conversation.lastActivity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-text-tertiary group-hover:text-accent-primary group-hover:translate-x-1 transition-all duration-base">
                    →
                  </div>
                </div>
                <div className="rounded-lg border border-border-subtle bg-background-secondary/50 p-4 text-sm text-text-secondary leading-relaxed">
                  {entry.meta.lastMessage}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
