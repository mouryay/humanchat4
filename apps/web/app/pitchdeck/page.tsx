import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HumanChat Pitch Deck',
  description: 'HumanChat - Talk to Anyone, About Anything',
};

export default function PitchDeckPage() {
  return (
    <iframe
      src="/humanchat_deck0.html"
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
