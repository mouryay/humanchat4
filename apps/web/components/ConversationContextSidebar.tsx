'use client';

interface ConversationContextSidebarProps {
  title: string;
  subtitle?: string;
  participantNames: string[];
  lastActivityLabel?: string;
}

export default function ConversationContextSidebar({
  title,
  subtitle,
  participantNames,
  lastActivityLabel
}: ConversationContextSidebarProps) {
  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Conversation details</h3>
        <p className="mt-1 text-xs text-white/55">Context for this chat.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-white/65">{subtitle}</p>}
        {lastActivityLabel && <p className="mt-2 text-xs text-white/45">Last active {lastActivityLabel}</p>}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Participants</p>
        <ul className="mt-2 space-y-2">
          {participantNames.length === 0 ? (
            <li className="text-sm text-white/60">No participant info yet.</li>
          ) : (
            participantNames.map((name) => (
              <li key={name} className="text-sm text-white/85">
                {name}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
