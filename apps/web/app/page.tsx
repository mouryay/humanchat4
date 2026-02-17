import type { Metadata } from 'next';

import HomePageExperience from '../components/HomePageExperience';

export const metadata: Metadata = {
  title: 'Done talking to AI? Come talk to a human.',
  description: 'Real people, real trust, any topic, on demand.',
  openGraph: {
    title: 'Done talking to AI? Come talk to a human.',
    description: 'Real people, real trust, any topic, on demand.',
    url: 'https://humanchat.com',
    siteName: 'HumanChat',
    images: [{ url: 'https://humanchat.com/og.jpg', width: 1200, height: 630, alt: 'HumanChat' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Done talking to AI? Come talk to a human.',
    description: 'Real people, real trust, any topic, on demand.',
    images: ['https://humanchat.com/og.jpg']
  }
};

export default function LandingPage() {
  return <HomePageExperience />;
}
