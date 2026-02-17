'use client';

import clsx from 'clsx';
import { useMemo, useRef, useState } from 'react';
import ConversationListItem from './ConversationListItem';
import { useConversationData, type ConversationListEntry, SAM_CONCIERGE_ID } from '../hooks/useConversationData';
import { useArchivedConversations } from '../hooks/useArchivedConversations';
import { deleteConversationCascade, type ChatRequest, type InstantInvite } from '../../../src/lib/db';
import styles from './ConversationSidebar.module.css';

interface ConversationSidebarProps {
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
  collapsed?: boolean;
  requests?: ChatRequest[];
  requestProfiles?: Record<string, { name?: string; headline?: string | null; avatarUrl?: string | null }>;
  requestLoading?: boolean;
  requestError?: string | null;
  onRequestAction?: (requestId: string, status: ChatRequest['status']) => Promise<unknown> | void;
  requestActionPendingId?: string | null;
  pendingInvites?: Map<string, InstantInvite>;
  onInviteAccept?: (inviteId: string) => Promise<unknown> | void;
  onInviteDecline?: (inviteId: string) => Promise<unknown> | void;
  inviteActionPendingId?: string | null;
}

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleString();
};

export default function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  collapsed,
  requests,
  requestProfiles,
  requestLoading,
  requestError,
  onRequestAction,
  requestActionPendingId,
  pendingInvites,
  onInviteAccept,
  onInviteDecline,
  inviteActionPendingId
}: ConversationSidebarProps) {
  const { conversations, hasHumanConversations, error, reload, refreshing } = useConversationData();
  const { archive, unarchive, isArchived } = useArchivedConversations();
  const [pullHint, setPullHint] = useState<'idle' | 'ready' | 'refreshing'>('idle');
  const [deleteCandidate, setDeleteCandidate] = useState<ConversationListEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<number>(0);
  const pulling = useRef(false);
  const pendingRequests = useMemo(() => {
    return (requests ?? []).filter((request) => request.status === 'pending');
  }, [requests]);

  // Build fake ConversationListEntry items for pending requests
  const requestEntries = useMemo(() => {
    return pendingRequests.map((request) => {
      const profile = requestProfiles?.[request.requesterId];
      const displayName = profile?.name ?? 'New request';
      const initials = displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .join('') || 'RQ';
      const entry: ConversationListEntry = {
        conversation: {
          conversationId: `request-${request.requestId}`,
          type: 'human',
          participants: [request.requesterId],
          participantLabels: { [request.requesterId]: displayName },
          lastActivity: request.createdAt,
          unreadCount: 0
        },
        meta: {
          displayName,
          initials,
          lastMessage: profile?.headline ?? 'Wants to connect',
          relativeTimestamp: formatRelativeTime(request.createdAt),
          avatarUrl: profile?.avatarUrl ?? undefined
        }
      };
      return { entry, request };
    });
  }, [pendingRequests, requestProfiles]);

  const unreadCount = useMemo(() => {
    return conversations.slice(1).filter((entry) =>
      !isArchived(entry.conversation.conversationId) && (entry.conversation.unreadCount ?? 0) > 0
    ).length;
  }, [conversations, isArchived]);
  
  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      }).format(new Date());
    } catch (error) {
      return new Date().toLocaleDateString();
    }
  }, []);

  const handleSelect = (conversationId: string) => {
    onSelectConversation?.(conversationId);
  };

  const samEntry = conversations[0];
  const humanEntries = conversations.slice(1).filter((entry) => !isArchived(entry.conversation.conversationId));
  const archivedEntries = conversations.slice(1).filter((entry) => isArchived(entry.conversation.conversationId));
  
  const visibleHumanEntries = humanEntries.slice(0, visibleCount);
  const hasMore = humanEntries.length > visibleCount;
  
  const handleScroll = (event: React.UIEvent<HTMLUListElement>) => {
    if (!hasMore) return;
    const target = event.currentTarget;
    const scrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    if (scrolledToBottom && !refreshing) {
      setVisibleCount((prev) => prev + 10);
    }
  };

  const handleDeleteRequest = (conversationId: string) => {
    const target = conversations.find((entry) => entry.conversation.conversationId === conversationId);
    if (!target || target.conversation.type === 'sam') {
      return;
    }
    setDeleteCandidate(target);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    const id = deleteCandidate.conversation.conversationId;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteConversationCascade(id);
      setDeleteCandidate(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside className={clsx(
      styles.sidebar,
      "flex flex-col h-full bg-background-secondary transition-all duration-base",
      collapsed ? "w-24" : "w-[300px]"
    )}>
      {/* Premium Header */}
      <div className="hidden sm:block p-6 bg-gradient-to-b from-background-secondary to-background-secondary/80">
        {!collapsed && (
          <h1 className="text-2xl font-semibold text-text-primary">{formattedDate}</h1>
        )}
          </div>

      {/* Premium Scrollable Content */}
      <div className={clsx(styles.scroller, "flex-1 overflow-y-auto")} ref={scrollerRef}>
        {/* Sam Section */}
        <section className="px-4 py-2">
              {samEntry && (
                <ConversationListItem
                  entry={samEntry}
                  isActive={activeConversationId === samEntry.conversation.conversationId}
                  onSelect={handleSelect}
                  onArchive={archive}
                  showMetadata={!collapsed}
                />
              )}
        </section>

        {/* Humans Section */}
        <section className="pt-2">
          {!collapsed && unreadCount > 0 && (
            <div className="px-6 pb-3">
              <span className="px-2.5 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary text-xs font-semibold">
                {unreadCount} unread
            </span>
          </div>
          )}

              <ul className="list-none p-0 m-0" onScroll={handleScroll}>
            {requestEntries.map(({ entry, request }) => {
              const isUpdating = requestActionPendingId === request.requestId;
              const handleAction = (status: ChatRequest['status']) => {
                if (!onRequestAction) return;
                const outcome = onRequestAction(request.requestId, status);
                if (outcome && typeof (outcome as Promise<unknown>).catch === 'function') {
                  (outcome as Promise<unknown>).catch((actionError) => {
                    console.warn('Request action failed', actionError);
                  });
                }
              };
              return (
                <li key={entry.conversation.conversationId} className="px-4 mb-1">
                  <ConversationListItem
                    entry={entry}
                    isActive={false}
                    onSelect={() => {}}
                    showMetadata={!collapsed}
                    disableGestures
                    pendingRequest={{
                      requestId: request.requestId,
                      onAccept: () => handleAction('approved'),
                      onDecline: () => handleAction('declined'),
                      isPending: isUpdating
                    }}
                  />
                </li>
              );
            })}
            {visibleHumanEntries.map((entry) => {
              const invite = pendingInvites?.get(entry.conversation.conversationId);
              const inviteOverlay = invite
                ? {
                    requestId: invite.inviteId,
                    onAccept: () => onInviteAccept?.(invite.inviteId),
                    onDecline: () => onInviteDecline?.(invite.inviteId),
                    isPending: inviteActionPendingId === invite.inviteId
                  }
                : undefined;
              return (
                  <li key={entry.conversation.conversationId} className="px-4 mb-1">
              <ConversationListItem
                entry={entry}
                isActive={activeConversationId === entry.conversation.conversationId}
                onSelect={handleSelect}
                onArchive={archive}
                onDelete={handleDeleteRequest}
                deletePending={deletingId === entry.conversation.conversationId}
                showMetadata={!collapsed}
                pendingRequest={inviteOverlay}
              />
                  </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="px-6 py-4 text-center text-sm text-text-tertiary">
              Loading more conversations...
            </div>
          )}

          {!hasHumanConversations && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-text-primary">No human conversations yet.</p>
            </div>
          )}

          {/* Request loading/error indicators */}
          {requestLoading && (
            <div className="px-6 py-4 text-center text-sm text-text-secondary">
              Loading requests…
            </div>
          )}
          {requestError && !requestLoading && (
            <div className="px-6 py-2 text-center text-sm text-red-400">
              {requestError}
            </div>
          )}
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={() => setDeleteCandidate(null)}
        >
          <div 
            className="card-premium p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-text-primary mb-2">Delete conversation?</h3>
            <p className="text-sm text-text-secondary mb-6">
              This will permanently delete the conversation and all messages. This action cannot be undone.
            </p>
            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                {deleteError}
          </div>
            )}
            <div className="flex gap-3">
            <button
                className="flex-1 btn-premium btn-premium-secondary"
                onClick={() => setDeleteCandidate(null)}
            >
              Cancel
            </button>
            <button
                className="flex-1 btn-premium bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
                onClick={confirmDelete}
                disabled={Boolean(deletingId)}
            >
                {deletingId ? 'Deleting...' : 'Delete'}
            </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
