import type { Metadata } from 'next';

import HeroExperience from '../components/HeroExperience';

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

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-midnight text-white">
      <main className="flex flex-1 items-center justify-center px-4 py-6 sm:py-10">
        <HeroExperience />
      </main>
    </div>
  );
}
