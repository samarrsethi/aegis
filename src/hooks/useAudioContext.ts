'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/lib/store';

interface AudioContextWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

let sharedAudioContext: AudioContext | null = null;
let gestureListenerAttached = false;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as AudioContextWindow;
  return win.AudioContext || win.webkitAudioContext || null;
}

function handleUserGesture() {
  if (!sharedAudioContext) return;

  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }

  if (sharedAudioContext.state === 'running') {
    window.removeEventListener('pointerdown', handleUserGesture);
    window.removeEventListener('keydown', handleUserGesture);
    window.removeEventListener('touchstart', handleUserGesture);
    gestureListenerAttached = false;
  }
}

function attachGestureResumeListener() {
  if (typeof window === 'undefined' || gestureListenerAttached) return;
  gestureListenerAttached = true;

  window.addEventListener('pointerdown', handleUserGesture, { passive: true });
  window.addEventListener('keydown', handleUserGesture, { passive: true });
  window.addEventListener('touchstart', handleUserGesture, { passive: true });
}

function getOrCreateAudioContext(): AudioContext | null {
  const AudioCtx = getAudioContextConstructor();
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }

  attachGestureResumeListener();
  return sharedAudioContext;
}

async function ensureAudioContextResumed(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'closed') return false;
  if (ctx.state !== 'suspended') return true;

  let resumed = false;
  try {
    await Promise.race([
      ctx.resume().then(() => {
        resumed = true;
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 60)),
    ]);
  } catch {
    return false;
  }

  // If browser autoplay policy kept the context suspended, skip scheduling frozen audio
  if (!resumed && ctx.state === 'suspended') {
    return false;
  }

  return true;
}

export async function playStartupTone(): Promise<void> {
  if (!useAppStore.getState().settings.startupSoundEnabled) {
    return;
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  const ready = await ensureAudioContextResumed(ctx);
  if (!ready) return;

  try {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Subtle electronic ascending sine sweep (200Hz -> 600Hz over 0.3s)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.3);

    // Gain envelope: 0 -> 0.08 -> fade to 0 over 0.5s (~0.8s total)
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.3);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.8);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };

    oscillator.start(now);
    oscillator.stop(now + 0.82);
  } catch {
    // Ignore audio synthesis errors in restricted environments
  }
}

export async function playNotificationTone(): Promise<void> {
  if (!useAppStore.getState().settings.startupSoundEnabled) {
    return;
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  const ready = await ensureAudioContextResumed(ctx);
  if (!ready) return;

  try {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Quick subtle electronic blip (0.1s, 800Hz, very low volume)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.04, now + 0.015);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };

    oscillator.start(now);
    oscillator.stop(now + 0.11);
  } catch {
    // Ignore audio synthesis errors in restricted environments
  }
}

export interface UseAudioContextReturn {
  playStartupTone: () => Promise<void>;
  playNotificationTone: () => Promise<void>;
}

export function useAudioContext(): UseAudioContextReturn {
  const triggerStartupTone = useCallback(() => {
    return playStartupTone();
  }, []);

  const triggerNotificationTone = useCallback(() => {
    return playNotificationTone();
  }, []);

  return {
    playStartupTone: triggerStartupTone,
    playNotificationTone: triggerNotificationTone,
  };
}

export default useAudioContext;
