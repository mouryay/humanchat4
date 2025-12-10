import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'HumanChat — Talk to Anyone, About Anything',
  description: 'Sam, your AI concierge, connects you with human experts in seconds. Share your expertise or learn from others on HumanChat.',
  openGraph: {
    title: 'HumanChat — Talk to Anyone, About Anything',
    description: 'Join HumanChat to meet Sam, the AI concierge that pairs you with the perfect human expert.',
    url: 'https://humanchat.com',
    siteName: 'HumanChat',
    images: [{ url: 'https://humanchat.com/og.jpg', width: 1200, height: 630, alt: 'HumanChat landing page preview' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HumanChat — Talk to Anyone, About Anything',
    description: 'Get introduced to vetted experts through Sam, your AI concierge.',
    images: ['https://humanchat.com/og.jpg']
  }
};

const sections = [
  {
    title: 'Sam',
    description: 'Chat with the concierge and route every request instantly.',
    actions: [{ label: 'Open Sam', href: '/chat?focus=sam' }]
  },
  {
    title: 'Humans',
    description: 'Jump straight into live humans who can help right now.',
    actions: [{ label: 'Browse Humans', href: '/chat?focus=humans' }]
  },
  {
    title: 'Account Settings',
    description: 'Adjust details, notifications, and payment info without hunting menus.',
    actions: [
      { label: 'User Settings', href: '/settings' },
      { label: 'Profile Tab', href: '/settings?tab=profile' }
    ]
  }
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-midnight text-white">
      <header className="flex flex-none items-center justify-between border-b border-white/10 px-5 py-4 text-xs text-white/70 sm:text-sm">
        <Link href="/" className="font-display text-lg text-white">
          HumanChat
        </Link>
        <span className="hidden sm:block">Direct access to Sam, humans, and settings. Nothing else.</span>
      </header>

      <main className="flex flex-1 items-stretch justify-center px-4 py-4">
        <section className="grid h-full w-full max-w-5xl grid-cols-1 grid-rows-3 gap-3 md:grid-cols-3 md:grid-rows-1">
          {sections.map((section) => (
            <article
              key={section.title}
              className="flex h-full flex-col rounded-2xl border border-white/15 bg-white/5 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.6)]"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">{section.title}</p>
                <h2 className="mt-2 font-display text-2xl text-white">{section.title}</h2>
                <p className="mt-2 text-sm text-white/75">{section.description}</p>
              </div>
              <div className="mt-auto flex flex-col gap-3 pt-5">
                {section.actions.map((action) => (
                  <Link
                    key={`${section.title}-${action.label}`}
                    href={action.href}
                    className="inline-flex items-center justify-center rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold text-white transition hover:border-white"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
