import './globals.css';
import type { ReactNode } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import PWAInitializer from '../components/PWAInitializer';
import FirebaseSessionBridge from '../components/FirebaseSessionBridge';
import IdentityInitializer from '../components/IdentityInitializer';
import InstantInviteListener from '../components/InstantInviteListener';
import InstantInviteNavigator from '../components/InstantInviteNavigator';
import UserSettingsMenu from '../components/UserSettingsMenu';
import CallNotificationListener from '../components/CallNotificationListener';
import { CallProvider } from '../context/CallContext';
import MinimizedCallBar from '../components/MinimizedCallBar';

export const metadata = {
  title: 'Done talking to AI? Come talk to a human.',
  description: 'Real people, real trust, any topic, on demand.'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover'
};

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-midnight text-white font-body antialiased min-h-screen overflow-x-hidden">
        <CallProvider>
          <PWAInitializer />
          <FirebaseSessionBridge />
          <IdentityInitializer />
          <InstantInviteListener />
          <InstantInviteNavigator />
          <CallNotificationListener />
          <MinimizedCallBar />
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[9998] flex justify-end px-4 py-4 chat-layout-settings">
            <div className="pointer-events-auto">
              <UserSettingsMenu />
            </div>
          </div>
          {children}
        </CallProvider>
      </body>
    </html>
  );
}
