import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Done talking to AI? Come talk to a human.',
  description: 'Real people, real trust, any topic, on demand.',
  openGraph: {
    title: 'Done talking to AI? Come talk to a human.',
    description: 'Real people, real trust, any topic, on demand.',
    url: 'https://humanchat.com/pitchdeck',
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

export default function PitchDeckPage() {
  return (
    <iframe
      src="/humanchat_deck.html"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none',
      }}
    />
  );
}
