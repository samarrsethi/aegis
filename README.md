# A.E.G.I.S. — Adaptive Engine for General Intelligence Systems

A futuristic personal AI assistant built with Next.js (App Router), TypeScript, Tailwind CSS, GSAP, Framer Motion, Three.js / React Three Fiber, and the OpenAI SDK.

## Features

- **Cinematic 6-Scene Startup Sequence**: Synchronized GSAP + 2D Canvas/SVG sequence (~8–9s) featuring darkness ignition, concentric arc core activation, mechanical armor assembly, helmet HUD boot diagnostics reflecting real API status, synthesized Web Audio tones, and a continuous transition into the chat workspace (with a Skip button and `prefers-reduced-motion` support).
- **Interactive 3D AI Orb**: Built with Three.js and React Three Fiber (`AIOrb.tsx` + `OrbStateController.tsx`), featuring custom GLSL vertex/fragment shaders, dual orbital rings, particle system, adaptive quality, WebGL fallback, and a centralized state machine (`idle`, `listening`, `thinking`, `speaking`, `error`, `offline`).
- **Real Streaming AI Chat**: Server-side Next.js API route (`/api/chat`) using the official `openai` SDK with SSE streaming, rate limiting, request validation, abort/stop support, and no exposed secrets.
- **Voice Interaction**: Web Speech API speech-to-text microphone input and optional SpeechSynthesis text-to-speech output (`VoiceControls.tsx`), synchronized with the AI orb states.
- **Persistent Conversation Memory & Settings**: LocalStorage-backed multi-conversation history (auto-titling, search, rename, delete, clear) and a slide-in Settings panel (voice toggles, startup sound, replay intro, reduced motion, model selection, animation quality).
- **Collapsible System Diagnostics**: Real-time assistant status, active model, API connection state, and session metrics.

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and add your OpenAI API key:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local`:
   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   # Optional:
   # OPENAI_MODEL=gpt-4o
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Project Structure

```text
src/
├── app/
│   ├── api/chat/route.ts    # Secure server-side OpenAI streaming endpoint
│   ├── layout.tsx           # Root layout and metadata
│   └── page.tsx             # Entry point orchestrating intro & chat
├── components/
│   ├── ai/                  # 3D Three.js AIOrb & OrbStateController
│   ├── chat/                # ChatInterface, ChatSidebar, ChatMessage, ChatInput, MessageRenderer
│   ├── intro/               # CinematicIntro, ReactorCore, ArmorAssembly, BootDiagnostics, IntroTransition
│   ├── settings/            # Slide-in SettingsPanel
│   └── voice/               # Web Speech API VoiceControls & useVoice hook
├── hooks/                   # useChat, useAudioContext, useMediaQuery
├── lib/                     # store.ts (Zustand + localStorage), chat.ts (SSE client)
├── styles/                  # globals.css (design tokens, markdown & scrollbar styles)
└── types/                   # Shared TypeScript interfaces
```
