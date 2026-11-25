'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { checkApiStatus } from '@/lib/chat';
import dynamic from 'next/dynamic';

// Dynamic imports to avoid SSR issues with Three.js/GSAP
const CinematicIntro = dynamic(
  () => import('@/components/intro/CinematicIntro'),
  { ssr: false }
);
const ChatInterface = dynamic(
  () => import('@/components/chat/ChatInterface'),
  { ssr: false }
);

export default function Home() {
  const {
    showIntro,
    introComplete,
    hydrated,
    hydrate,
    setSystemStatus,
    settings,
  } = useAppStore();

  const [mounted, setMounted] = useState(false);

  // Hydrate store from localStorage
  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  // Check API status on mount
  useEffect(() => {
    if (!mounted) return;
    checkApiStatus().then((status) => {
      setSystemStatus({
        apiConnected: status.connected,
        model: status.model,
        isReady: true,
      });
    });
  }, [mounted, setSystemStatus]);

  // Don't render until hydrated to avoid hydration mismatch
  if (!hydrated || !mounted) {
    return (
      <div className="h-screen w-screen bg-aegis-obsidian flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-aegis-cyan/30 animate-pulse" />
      </div>
    );
  }

  return (
    <main className="h-screen w-screen bg-aegis-obsidian overflow-hidden relative">
      {/* Cinematic Intro */}
      {showIntro && !introComplete && (
        <CinematicIntro />
      )}

      {/* Main Chat Interface — always mounted but hidden during intro */}
      <div
        className={`h-full w-full transition-opacity duration-500 ${
          introComplete ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChatInterface />
      </div>
    </main>
  );
}
