'use client';

import { useEffect } from 'react';
import ChatExperience from './ChatExperience';
import HeroExperience from './HeroExperience';
import { useAuthIdentity } from '../hooks/useAuthIdentity';
import { useBreakpoint } from '../hooks/useBreakpoint';

const HomePageExperience = () => {
  const { identity, loading } = useAuthIdentity();
  const { isMobile } = useBreakpoint();
  const showOverlay = !loading && !identity;

  // Prevent body scrolling on mobile chat pages
  useEffect(() => {
    if (isMobile) {
      // Set data attribute to enable CSS scroll blocking for chat page
      document.documentElement.setAttribute('data-chat-page', 'true');
      
      // Also handle overlay state
      if (showOverlay) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    } else {
      document.documentElement.removeAttribute('data-chat-page');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.documentElement.removeAttribute('data-chat-page');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [showOverlay, isMobile]);

  return (
    <div className="relative min-h-screen bg-midnight text-white">
      {(!showOverlay || !isMobile) && <ChatExperience />}
      {showOverlay && (
        <>
          <div className="fixed inset-0 z-[60] bg-[#030519] backdrop-blur-sm" />
          <div className="fixed inset-0 z-[70] flex flex-col justify-start sm:justify-center p-4 sm:p-8 overflow-y-auto">
            <div 
              className="w-full max-w-4xl mx-auto my-auto rounded-[32px] sm:rounded-[48px] border border-white/10 bg-[#050718]/95 backdrop-blur-xl flex flex-col overflow-hidden"
            >
              <HeroExperience />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HomePageExperience;
