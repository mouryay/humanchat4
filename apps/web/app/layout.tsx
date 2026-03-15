import './globals.css';
import type { ReactNode } from 'react';
import { DM_Sans, Lora } from 'next/font/google';
import PWAInitializer from '../components/PWAInitializer';
import FirebaseSessionBridge from '../components/FirebaseSessionBridge';
import IdentityInitializer from '../components/IdentityInitializer';
import InstantInviteListener from '../components/InstantInviteListener';
import InstantInviteNavigator from '../components/InstantInviteNavigator';
import UserSettingsMenu from '../components/UserSettingsMenu';
import NotificationBell from '../components/NotificationBell';
import CallNotificationListener from '../components/CallNotificationListener';
import { CallProvider } from '../context/CallContext';
import MinimizedCallBar from '../components/MinimizedCallBar';
import GlobalCallRoom from '../components/GlobalCallRoom';

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

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body' });
const lora = Lora({ subsets: ['latin'], variable: '--font-display' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${lora.variable}`}>
      <body className="bg-background-primary text-text-primary font-body antialiased min-h-screen overflow-x-hidden">
        <CallProvider>
          <PWAInitializer />
          <FirebaseSessionBridge />
          <IdentityInitializer />
          <InstantInviteListener />
          <InstantInviteNavigator />
          <CallNotificationListener />
          <GlobalCallRoom />
          <MinimizedCallBar />
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[9998] flex justify-end px-3 py-3 md:px-4 md:py-4 md:pr-[calc(var(--sidebar-width)+16px)] chat-layout-settings">
            <div className="pointer-events-auto flex items-center gap-2">
              <NotificationBell />
              <UserSettingsMenu />
            </div>
          </div>
          {children}
        </CallProvider>
      </body>
    </html>
  );
}
